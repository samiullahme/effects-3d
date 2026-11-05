// Records the /video stage page headlessly and encodes a 10 s MP4.
// Usage:
//   node scripts/render-video.mjs [--url http://localhost:3000/video] [--w 1920] [--h 1080]
//                                 [--duration 10] [--out out/lanesite-promo.mp4]
//
// Page contract: window.__videoReady === true when ready,
//                window.__startVideo() starts the timeline,
//                window.__videoDone === true when the timeline ends.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1];
}

const url = args.url ?? 'http://localhost:3000/video';
const W = Number(args.w ?? 1920);
const H = Number(args.h ?? 1080);
const DURATION = Number(args.duration ?? 10);
const out = args.out ?? 'out/lanesite-promo.mp4';
const tmp = 'out/.rec';

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: tmp, size: { width: W, height: H } },
});
const page = await context.newPage();
const recordingStartedAt = Date.now(); // video recording begins when the page is created
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__videoReady === true, null, { timeout: 30000 });
await page.waitForTimeout(300); // let layout settle

const timelineStartedAt = Date.now();
await page.evaluate(() => window.__startVideo());
await page.waitForFunction(() => window.__videoDone === true, null, {
  timeout: (DURATION + 10) * 1000,
});
await page.waitForTimeout(300);

const video = page.video();
await context.close(); // flushes the recording to disk
const raw = await video.path();
await browser.close();

const offset = Math.max(0, (timelineStartedAt - recordingStartedAt) / 1000).toFixed(3);
console.log(`trimming first ${offset}s, keeping ${DURATION}s`);

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-ss', offset,
    '-i', raw,
    '-t', String(DURATION),
    '-vf', 'fps=30,format=yuv420p',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-movflags', '+faststart',
    '-an',
    out,
  ],
  { stdio: 'inherit' },
);

rmSync(tmp, { recursive: true, force: true });
console.log('wrote', out);
