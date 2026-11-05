#!/usr/bin/env node
// Render /video compositions to MP4 (H.264 + AAC), frame-exact.
//
//   node scripts/video/render.mjs --list
//   node scripts/video/render.mjs --id launch --format 16x9,9x16
//   node scripts/video/render.mjs --id faq --props '{"index":2}' --format 9x16 --music assets/music/bed.mp3
//   node scripts/video/render.mjs --id launch --stills 1,4.6,9.5        # quick PNG checks, no encode
//   node scripts/video/render.mjs --campaign video/campaigns/week-46.json
//
// Options
//   --url <http://localhost:3000/video>  stage page
//   --id <composition>   --format <16x9|9x16|1x1|4x5|all>[,..]   --props <json|file.json>
//   --fps <30>           --scale <1|2>  (2 = supersampled, crisper text, ~3x slower)
//   --out <file.mp4|dir> (default out/video/<id>-<format>.mp4)
//   --mode <deterministic|realtime>    realtime = old screen-recording fallback
//   --music <file> --music-volume <0.22>   --no-sfx   --sfx-volume <1>
//   --crf <18>  --preset <medium>      --no-check (skip contact sheet + poster)
//   --stills <t1,t2,..>  write PNGs at these seconds and stop
//   --from <s> --to <s>  render only part of the timeline (preview cuts)

import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureSounds, muxAudio } from "./lib/audio.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLOCK = readFileSync(path.join(HERE, "lib/virtual-clock.js"), "utf8");
const FORMATS = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] };

/* ------------------------------------------------------------------ args */
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const key = k.slice(2);
    if (key.startsWith("no-")) a[key.slice(3)] = false;
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith("--")) a[key] = true;
    else a[key] = argv[++i];
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
const BASE_URL = args.url ?? "http://localhost:3000/video";

function readJsonArg(v) {
  if (!v || v === true) return {};
  if (existsSync(v)) return JSON.parse(readFileSync(v, "utf8"));
  return JSON.parse(v);
}
const b64url = (obj) => Buffer.from(JSON.stringify(obj), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function stageUrl(base, { id, format, props, fps }) {
  const u = new URL(base);
  u.searchParams.set("id", id);
  u.searchParams.set("format", format);
  if (props && Object.keys(props).length) u.searchParams.set("props", b64url(props));
  if (fps) u.searchParams.set("fps", String(fps));
  return u.toString();
}

async function assertServer(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.error(`\n✗ ${url} is not reachable (${e.message}).\n  Start the app first, e.g. "npm run build && npm run start" (best) or "npm run dev", then pass --url if the port differs.\n`);
    process.exit(1);
  }
}

/* --------------------------------------------------------------- browser */
let browser;
async function getBrowser() {
  browser ??= await chromium.launch({
    args: ["--hide-scrollbars", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--font-render-hinting=none", "--force-color-profile=srgb"],
  });
  return browser;
}

async function openStage({ url, w, h, scale, mode }) {
  const b = await getBrowser();
  const ctx = await b.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: scale,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    ...(mode === "realtime" ? { recordVideo: { dir: path.join(os.tmpdir(), `vk-rec-${process.pid}`), size: { width: w, height: h } } } : {}),
  });
  await ctx.addInitScript({ content: `window.__vkRender = { mode: ${JSON.stringify(mode)}, realInput: true };\n${mode === "deterministic" ? CLOCK : ""}` });
  const page = await ctx.newPage();
  const recStart = Date.now();
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) console.log(`  [page:${m.type()}]`, m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => console.error("  [pageerror]", e.message));
  await page.goto(url, { waitUntil: "load" });
  await page.addStyleTag({ content: "*{caret-color:transparent!important} ::-webkit-scrollbar{display:none} nextjs-portal{display:none!important}" });
  await page.waitForFunction(() => window.__videoReady === true, null, { timeout: 60000 }).catch(async () => {
    const missing = await page.evaluate(() => (document.body.innerText || "").slice(0, 300));
    throw new Error(`stage never became ready (window.__videoReady). Page says: ${missing}`);
  });
  const meta = await page.evaluate(() => window.__videoMeta);
  return { ctx, page, meta, recStart };
}

/* -------------------------------------------------------------- encoding */
function startEncoder({ out, fps, w, h, scale, crf, preset, from = 0 }) {
  const vf = [];
  if (scale !== 1) vf.push(`scale=${w}:${h}:flags=lanczos`);
  vf.push("scale=out_color_matrix=bt709:out_range=tv", "format=yuv420p");
  const ff = spawn(
    "ffmpeg",
    [
      "-y", "-v", "error",
      "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
      "-vf", vf.join(","),
      "-c:v", "libx264", "-preset", preset, "-crf", String(crf), "-profile:v", "high",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
      "-r", String(fps), "-movflags", "+faststart", "-an",
      out,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  return {
    write: (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once("drain", res))),
    end: async () => {
      ff.stdin.end();
      await done;
    },
    from,
  };
}

/* ------------------------------------------------------- deterministic */
async function renderDeterministic({ page, meta, fps, enc, stills, from, to }) {
  const cdp = await page.context().newCDPSession(page);
  const total = Math.round(meta.duration * fps);
  const first = Math.max(0, Math.floor((from ?? 0) * fps));
  const last = Math.min(total, to !== undefined ? Math.ceil(to * fps) : total);
  const stillFrames = stills ? new Map(stills.map((s) => [Math.min(total - 1, Math.round(s * fps)), s])) : null;
  const lastNeeded = stillFrames ? Math.max(...stillFrames.keys()) : last - 1;
  const mouse = { x: -1, y: -1, down: false };
  const stillFiles = [];
  const t0 = Date.now();

  await page.evaluate(() => {
    window.__vclock.freeze();
    window.__startVideo();
  });
  await page.evaluate(() => window.__vclock.settle());

  for (let f = 0; f <= lastNeeded; f++) {
    if (f > 0) await page.evaluate((ms) => window.__vclock.advance(ms), 1000 / fps);

    // mirror the scripted cursor with the real mouse: hover, focus and clicks are real
    const cs = await page.evaluate(() => window.__cursorState ?? null);
    if (cs) {
      let pressed = false;
      if (Math.abs(cs.x - mouse.x) > 0.01 || Math.abs(cs.y - mouse.y) > 0.01) {
        await page.mouse.move(cs.x, cs.y);
        mouse.x = cs.x;
        mouse.y = cs.y;
      }
      if (cs.down !== mouse.down) {
        cs.down ? await page.mouse.down() : await page.mouse.up();
        mouse.down = cs.down;
        pressed = true;
      }
      if (pressed) await page.evaluate(() => window.__vclock.settle());
    }

    const wantFrame = stillFrames ? stillFrames.has(f) : f >= first && f < last;
    if (!wantFrame) continue;
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true, captureBeyondViewport: false });
    const buf = Buffer.from(data, "base64");
    if (stillFrames) {
      const file = stills.outFor(stillFrames.get(f));
      writeFileSync(file, buf);
      stillFiles.push(file);
    } else await enc.write(buf);

    if (!stillFrames && (f % (fps * 2) === 0 || f === last - 1)) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\r  frame ${f + 1}/${last}  ${(((f + 1 - first) / Math.max(1, el))).toFixed(1)} fps   `);
    }
  }
  if (!stillFrames) process.stdout.write("\n");
  const events = await page.evaluate(() => window.__videoEvents ?? []);
  return { events, stillFiles };
}

/* ------------------------------------------------------------ realtime */
async function renderRealtime({ ctx, page, meta, recStart, out, fps, crf, preset }) {
  const mouse = { x: -1, y: -1, down: false };
  const startedAt = Date.now();
  await page.evaluate(() => window.__startVideo());
  while (!(await page.evaluate(() => window.__videoDone === true))) {
    const cs = await page.evaluate(() => window.__cursorState ?? null);
    if (cs) {
      if (cs.x !== mouse.x || cs.y !== mouse.y) await page.mouse.move(cs.x, cs.y);
      if (cs.down !== mouse.down) cs.down ? await page.mouse.down() : await page.mouse.up();
      Object.assign(mouse, cs);
    }
    await page.waitForTimeout(8);
  }
  const events = await page.evaluate(() => window.__videoEvents ?? []);
  const video = page.video();
  await ctx.close();
  const raw = await video.path();
  const offset = Math.max(0, (startedAt - recStart) / 1000).toFixed(3);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", offset, "-i", raw, "-t", String(meta.duration), "-vf", `fps=${fps},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`, "-c:v", "libx264", "-preset", preset, "-crf", String(crf), "-an", out]);
  rmSync(raw, { force: true });
  return { events };
}

/* --------------------------------------------------------------- checks */
function makeChecks({ file, duration, poster, base }) {
  const posterT = Math.min(duration - 0.05, poster ?? duration * 0.45);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", posterT.toFixed(3), "-i", file, "-frames:v", "1", "-q:v", "2", `${base}-poster.jpg`]);
  const n = 12;
  const step = duration / n;
  const sel = Array.from({ length: n }, (_, i) => `lt(prev_pts*TB\\,${(i * step + step / 2).toFixed(3)})*gte(pts*TB\\,${(i * step + step / 2).toFixed(3)})`).join("+");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", `select='${sel}',scale=480:-2,tile=4x3:padding=6:color=0x222222`, "-frames:v", "1", "-fps_mode", "passthrough", "-q:v", "3", `${base}-check.jpg`]);
  return { poster: `${base}-poster.jpg`, check: `${base}-check.jpg`, checkTimes: Array.from({ length: n }, (_, i) => +(i * step + step / 2).toFixed(2)) };
}

function probe(file) {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", file]).toString());
  return j;
}

/* ------------------------------------------------------------------ job */
async function renderJob(job, globalOpts) {
  const { id, format } = job;
  const [w, h] = FORMATS[format] ?? [];
  if (!w) throw new Error(`unknown format ${format}`);
  const fps = Number(job.fps ?? globalOpts.fps ?? 30);
  const scale = Number(job.scale ?? globalOpts.scale ?? 1);
  const mode = job.mode ?? globalOpts.mode ?? "deterministic";
  const crf = Number(globalOpts.crf ?? 18);
  const preset = globalOpts.preset ?? "medium";
  const out = job.out;
  mkdirSync(path.dirname(out), { recursive: true });
  const url = stageUrl(globalOpts.url ?? BASE_URL, { id, format, props: job.props, fps: job.fps ?? globalOpts.fps });
  console.log(`▶ ${id} ${format} ${w}x${h}@${fps} ${mode}${scale !== 1 ? ` x${scale}` : ""}`);

  const { ctx, page, meta, recStart } = await openStage({ url, w, h, scale, mode });
  const silent = out.replace(/\.mp4$/, ".silent.mp4");
  let events = [];

  if (job.stills) {
    const base = out.replace(/\.mp4$/, "");
    const stills = job.stills.map(Number);
    stills.outFor = (t) => `${base}-t${t.toFixed(2)}.png`;
    const r = await renderDeterministic({ page, meta, fps, stills });
    await ctx.close();
    r.stillFiles.forEach((f) => console.log("  still", f));
    return { stills: r.stillFiles };
  }

  if (mode === "realtime") {
    ({ events } = await renderRealtime({ ctx, page, meta, recStart, out: silent, fps, crf, preset }));
  } else {
    const enc = startEncoder({ out: silent, fps, w, h, scale, crf, preset });
    ({ events } = await renderDeterministic({ page, meta, fps, enc, from: globalOpts.from !== undefined ? Number(globalOpts.from) : undefined, to: globalOpts.to !== undefined ? Number(globalOpts.to) : undefined }));
    await enc.end();
    await ctx.close();
  }

  const part = globalOpts.from !== undefined || globalOpts.to !== undefined;
  const from = part ? Number(globalOpts.from ?? 0) : 0;
  const duration = part ? Math.min(meta.duration, Number(globalOpts.to ?? meta.duration)) - from : meta.duration;
  const sounds = ensureSounds(path.join(os.homedir(), ".cache", "video-kit", "sfx"));
  const useSfx = (job.sfx ?? globalOpts.sfx) !== false;
  const music = job.music ?? globalOpts.music;
  if (music && !existsSync(music)) console.warn(`  ! music file not found: ${music}`);
  muxAudio({
    videoIn: silent,
    out,
    duration,
    events: useSfx ? events.map((e) => ({ ...e, t: e.t - from })) : [],
    sounds,
    music: music && existsSync(music) ? music : undefined,
    musicVolume: Number(job.musicVolume ?? globalOpts["music-volume"] ?? 0.22),
    sfxVolume: Number(globalOpts["sfx-volume"] ?? 1),
  });
  rmSync(silent, { force: true });

  const info = probe(out);
  const v = info.streams.find((s) => s.codec_type === "video");
  const dur = Number(info.format.duration);
  console.log(`  ✓ ${out}  ${v.width}x${v.height} ${v.r_frame_rate} ${dur.toFixed(2)}s ${(Number(info.format.size) / 1e6).toFixed(1)}MB  sfx:${useSfx ? events.length : 0}${music ? " +music" : ""}`);
  let checks = {};
  if (globalOpts.check !== false) {
    checks = makeChecks({ file: out, duration: dur, poster: part ? undefined : meta.poster, base: out.replace(/\.mp4$/, "") });
    console.log(`  ✓ ${checks.check}  (contact sheet, frames at ${checks.checkTimes.join(", ")}s)`);
    console.log(`  ✓ ${checks.poster}`);
  }
  return { file: out, width: v.width, height: v.height, duration: dur, ...checks };
}

function expandFormats(f, all) {
  if (!f || f === true) return ["16x9"];
  if (f === "all") return all ?? Object.keys(FORMATS);
  return String(f).split(",").map((s) => s.trim());
}

/* ---------------------------------------------------------------- list */
async function listCompositions(url) {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => Array.isArray(window.__compositions), null, { timeout: 30000 });
  const list = await page.evaluate(() => window.__compositions);
  await page.close();
  return list;
}

/* ------------------------------------------------------------ campaign */
async function runCampaign(file) {
  const c = JSON.parse(readFileSync(file, "utf8"));
  const outDir = c.out ?? path.join("out", "campaigns", path.basename(file, ".json"));
  mkdirSync(outDir, { recursive: true });
  const opts = { ...args, url: args.url ?? c.url ?? BASE_URL, music: args.music ?? c.music, fps: args.fps ?? c.fps };
  await assertServer(opts.url);
  const manifest = { campaign: c.name ?? path.basename(file, ".json"), generatedAt: new Date().toISOString(), posts: [] };
  const csv = [["date", "platform", "video", "poster", "caption"]];
  for (const v of c.videos) {
    const name = v.name ?? v.id;
    const formats = expandFormats(v.formats ?? c.formats);
    const files = {};
    for (const format of formats) {
      const out = path.join(outDir, name, `${name}-${format}.mp4`);
      if (args["skip-existing"] && existsSync(out)) {
        files[format] = { file: out, skipped: true };
        continue;
      }
      files[format] = await renderJob({ id: v.id, format, props: v.props, out, music: v.music, fps: v.fps, sfx: v.sfx }, opts);
    }
    const post = v.post ?? {};
    const caption = [post.caption, (post.hashtags ?? c.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
    const platforms = post.platforms ?? c.platforms ?? {};
    const md = [`# ${name}`, "", `Composition: \`${v.id}\``, post.schedule ? `Schedule: ${post.schedule}` : "", "", "## Files", ...Object.entries(files).map(([f, r]) => `- ${f}: ${r.file}`), "", "## Caption", "", caption || "_(none)_", ""];
    for (const [platform, spec] of Object.entries(platforms)) {
      const format = spec.format ?? (["instagram", "tiktok", "youtube-shorts", "reels", "stories"].includes(platform) ? "9x16" : formats[0]);
      const pc = [spec.caption ?? post.caption, (spec.hashtags ?? post.hashtags ?? c.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
      md.push(`## ${platform} (${format})`, "", pc, "");
      manifest.posts.push({ name, platform, format, video: files[format]?.file ?? null, poster: files[format]?.poster ?? null, caption: pc, schedule: spec.schedule ?? post.schedule ?? null });
      csv.push([spec.schedule ?? post.schedule ?? "", platform, files[format]?.file ?? "", files[format]?.poster ?? "", pc]);
    }
    if (!Object.keys(platforms).length) manifest.posts.push({ name, platform: null, files, caption, schedule: post.schedule ?? null });
    writeFileSync(path.join(outDir, name, "post.md"), md.filter((l) => l !== undefined).join("\n"));
  }
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  writeFileSync(path.join(outDir, "schedule.csv"), csv.map((r) => r.map(esc).join(",")).join("\n"));
  console.log(`\n✓ campaign → ${outDir}/manifest.json, schedule.csv, */post.md`);
}

/* ---------------------------------------------------------------- main */
try {
  if (args.list) {
    await assertServer(BASE_URL);
    const list = await listCompositions(BASE_URL);
    for (const c of list) console.log(`${c.id.padEnd(16)} ${String(c.duration + "s").padEnd(6)} ${c.formats.join(",").padEnd(22)} ${c.title}: ${c.description}`);
  } else if (args.campaign) {
    await runCampaign(args.campaign);
  } else if (args.id) {
    await assertServer(BASE_URL);
    const props = readJsonArg(args.props);
    const formats = expandFormats(args.format);
    const stills = args.stills ? String(args.stills).split(",").map(Number) : undefined;
    for (const format of formats) {
      let out = args.out && args.out !== true ? args.out : path.join("out", "video", `${args.id}-${format}.mp4`);
      if (!out.endsWith(".mp4")) out = path.join(out, `${args.id}-${format}.mp4`);
      else if (formats.length > 1) out = out.replace(/\.mp4$/, `-${format}.mp4`);
      await renderJob({ id: args.id, format, props, out, stills }, args);
    }
  } else {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 22).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  }
} catch (e) {
  console.error("\n✗", e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
