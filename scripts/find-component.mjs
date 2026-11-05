#!/usr/bin/env node
// Search free shadcn-compatible component registries for video-friendly components.
//   node scripts/video/find-component.mjs "number ticker"
//   node scripts/video/find-component.mjs cursor --registry magicui,reactbits --limit 20
// Prints name, registry, description and the install command. Index cached 24h in ~/.cache/video-kit.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const REGISTRIES = {
  watermelon: { index: "https://registry.watermelon.sh/r/registry.json", item: (n) => `https://registry.watermelon.sh/r/${n}.json` },
  magicui: { index: "https://magicui.design/r/registry.json", item: (n) => `https://magicui.design/r/${n}.json` },
  aceternity: { index: "https://ui.aceternity.com/registry/registry.json", item: (n) => `https://ui.aceternity.com/registry/${n}.json` },
  reactbits: { index: "https://reactbits.dev/r/registry.json", item: (n) => `https://reactbits.dev/r/${n}.json`, filter: (n) => n.endsWith("-TS-TW") },
  animateui: { index: "https://animate-ui.com/r/registry.json", item: (n) => `https://animate-ui.com/r/${n}.json`, filter: (n) => !n.startsWith("icons-") },
  cultui: { index: "https://cult-ui.com/r/registry.json", item: (n) => `https://cult-ui.com/r/${n}.json` },
  motionprimitives: { index: "https://motion-primitives.com/c/registry.json", item: (n) => `https://motion-primitives.com/c/${n}.json` },
};

const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i === -1 ? undefined : argv.splice(i, 2)[1]; };
const only = flag("registry")?.split(",");
const limit = Number(flag("limit") ?? 25);
const terms = argv.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
const cacheDir = path.join(os.homedir(), ".cache", "video-kit", "registries");
mkdirSync(cacheDir, { recursive: true });

async function load(name, reg) {
  const file = path.join(cacheDir, `${name}.json`);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 864e5) return JSON.parse(readFileSync(file, "utf8"));
  try {
    const j = await (await fetch(reg.index)).json();
    const items = (j.items ?? j).filter((i) => i.type !== "registry:example" && i.type !== "registry:style").map((i) => ({ name: i.name, title: i.title ?? "", description: i.description ?? "", deps: i.dependencies ?? [] }));
    writeFileSync(file, JSON.stringify(items));
    return items;
  } catch (e) {
    console.error(`! ${name}: ${e.message}`);
    return [];
  }
}

const rows = [];
for (const [name, reg] of Object.entries(REGISTRIES)) {
  if (only && !only.includes(name)) continue;
  for (const it of await load(name, reg)) {
    if (reg.filter && !reg.filter(it.name)) continue;
    if (name === "watermelon" && it.name.endsWith("-base")) continue;
    const hay = `${it.name} ${it.title} ${it.description}`.toLowerCase();
    const score = terms.reduce((s, t) => s + (it.name.toLowerCase().includes(t) ? 3 : hay.includes(t) ? 1 : 0), 0);
    if (!terms.length || score > 0) rows.push({ ...it, registry: name, score, url: reg.item(it.name) });
  }
}
rows.sort((a, b) => b.score - a.score);
for (const r of rows.slice(0, limit)) {
  const warn = r.deps.some((d) => /three|ogl|gsap|@react-three/.test(d)) ? `  [deps: ${r.deps.filter((d) => /three|ogl|gsap/.test(d)).join(", ")}]` : "";
  console.log(`${r.registry.padEnd(16)} ${r.name}${warn}\n  ${r.description.slice(0, 140)}\n  npx shadcn@latest add ${r.url}\n`);
}
console.log(`${rows.length} matches${rows.length > limit ? ` (showing ${limit}, use --limit)` : ""}`);
