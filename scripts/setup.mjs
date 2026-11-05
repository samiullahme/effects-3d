#!/usr/bin/env node
// Install / update the video kit in a Next.js (App Router) project.
//
//   node <skill>/scripts/setup.mjs --project .            first install (skips files you own)
//   node <skill>/scripts/setup.mjs --project . --update   refresh kit + scripts only
//
// Writes:
//   components/video-kit/**      kit (vendor code: overwritten by --update)
//   components/video/*.ts(x)     your compositions registry + player (never overwritten)
//   app/video/{layout,page}.tsx  hidden stage route (never overwritten)
//   scripts/video/**             renderer, capture and search tools (overwritten by --update)
import { execSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
};
const project = path.resolve(opt("project", "."));
const update = !!opt("update", false);
const log = (...a) => console.log(" ", ...a);

const pkgPath = path.join(project, "package.json");
if (!existsSync(pkgPath)) {
  console.error(`✗ no package.json in ${project}`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
if (!deps.next) console.warn("! this is not a Next.js project. The kit is plain React: see references/setup.md for Vite.");

const appDir = existsSync(path.join(project, "src", "app")) ? path.join(project, "src", "app") : path.join(project, "app");
const srcRoot = appDir.includes(`${path.sep}src${path.sep}`) ? path.join(project, "src") : project;

function copyDir(from, to, { overwrite }) {
  for (const name of readdirSync(from)) {
    const a = path.join(from, name);
    const b = path.join(to, name);
    if (statSync(a).isDirectory()) {
      mkdirSync(b, { recursive: true });
      copyDir(a, b, { overwrite });
    } else if (overwrite || !existsSync(b)) {
      const existed = existsSync(b);
      mkdirSync(path.dirname(b), { recursive: true });
      cpSync(a, b);
      log(existed ? "updated" : "added  ", path.relative(project, b));
    } else log("kept   ", path.relative(project, b));
  }
}

console.log(`video-kit → ${project}`);
copyDir(path.join(SKILL, "kit"), path.join(srcRoot, "components", "video-kit"), { overwrite: true });
copyDir(path.join(SKILL, "scripts"), path.join(project, "scripts", "video"), { overwrite: true });
if (!update) {
  copyDir(path.join(SKILL, "templates", "next", "components"), path.join(srcRoot, "components"), { overwrite: false });
  copyDir(path.join(SKILL, "templates", "next", "app"), appDir, { overwrite: false });
  mkdirSync(path.join(project, "video", "campaigns"), { recursive: true });
  const camp = path.join(project, "video", "campaigns", "example.json");
  if (!existsSync(camp)) {
    cpSync(path.join(SKILL, "campaigns", "example.json"), camp);
    log("added  ", path.relative(project, camp));
  }
}

// tsconfig alias check
try {
  const ts = readFileSync(path.join(project, "tsconfig.json"), "utf8");
  if (!/"@\/\*"/.test(ts)) console.warn('! tsconfig has no "@/*" path alias. Add it or change the imports in components/video/*.');
} catch {}

// dependencies
const need = ["motion", "lucide-react"].filter((d) => !deps[d]);
const needDev = ["playwright"].filter((d) => !deps[d]);
const pm = existsSync(path.join(project, "pnpm-lock.yaml")) ? "pnpm" : existsSync(path.join(project, "yarn.lock")) ? "yarn" : existsSync(path.join(project, "bun.lockb")) || existsSync(path.join(project, "bun.lock")) ? "bun" : "npm";
const add = pm === "npm" ? "install" : "add";
if (need.length) {
  log(`installing ${need.join(" ")}`);
  execSync(`${pm} ${add} ${need.join(" ")}`, { cwd: project, stdio: "inherit" });
}
if (needDev.length) {
  log(`installing ${needDev.join(" ")} (dev)`);
  execSync(`${pm} ${add} -D ${needDev.join(" ")}`, { cwd: project, stdio: "inherit" });
}
const chromiumOk = spawnSync("node", ["-e", "require('playwright').chromium.executablePath() && require('fs').existsSync(require('playwright').chromium.executablePath()) || process.exit(1)"], { cwd: project }).status === 0;
if (!chromiumOk) {
  log("installing Playwright chromium");
  execSync("npx playwright install chromium", { cwd: project, stdio: "inherit" });
}
const ff = spawnSync("ffmpeg", ["-version"]);
if (ff.status !== 0) console.warn("! ffmpeg not found. Install it: sudo apt-get install -y ffmpeg  (macOS: brew install ffmpeg)");

console.log(`
✓ ready
  1. npm run dev                    (or: npm run build && npm run start for final renders)
  2. open http://localhost:3000/video            gallery + live preview
  3. node scripts/video/render.mjs --list
  4. node scripts/video/render.mjs --id launch --format 16x9,9x16
`);
