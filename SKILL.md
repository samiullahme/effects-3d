---
name: lanesite-video
description: Create a 10-second promo video for lanesite.pro by animating shadcn/watermelon components on a dedicated stage page, recording it headlessly with Playwright and encoding with ffmpeg. Use when asked to make, redo or tweak the lanesite promo/website video.
---

# Lanesite 10-second promo video

Goal: a polished 10 s MP4 (H.264, 30 fps, no audio) made from the real UI components already installed in this project (`components/watermelon/*`), recorded from a hidden `/video` page. No Remotion: `motion/react` springs run on the real clock, so we record in real time instead of rendering frame by frame.

## 0. Brief (fill these in; if blank, derive them yourself)

- BRAND: Lanesite (lanesite.pro)
- ONE-LINE PROMISE: `<what lanesite does for the visitor, max 8 words>`
- 4 FEATURES (title max 4 words, description max 14 words): `<...>`
- CTA TEXT: `<e.g. Start free at lanesite.pro>`
- FORMAT: 16:9 1920x1080 (default). For Reels/Shorts use 9:16 1080x1920 and run render with `--w 1080 --h 1920`.
- BRAND COLORS / FONT: read them from `tailwind.config.*`, `globals.css` (`:root` CSS variables) or the live site. Never invent a palette if the project already has one.

Rules for filling gaps: read the repo (`README`, `app/page.tsx`, hero and feature sections, metadata) and the live site https://lanesite.pro to get real copy. Reuse the site's wording, shortened. Never use lorem ipsum or generic "UX design" placeholder text (the accordion ships with placeholder items; always replace them via the `items` prop).

## 1. Preflight (once per VPS)

```bash
ffmpeg -version || sudo apt-get update && sudo apt-get install -y ffmpeg
npm i -D playwright
npx playwright install --with-deps chromium
```

Detect the framework (`next` or `vite` in package.json) and the dev command. Start the dev server in the background and confirm it answers on its port before recording. Headless Chromium needs no display.

## 2. Storyboard (exactly 10.0 s)

| Time | Scene | What is on screen | Motion |
|---|---|---|---|
| 0.0-0.2 | Empty | Brand background only | none (trim buffer) |
| 0.2-1.5 | Hook | Brand name + promise headline | words blur-in, y 24 to 0, 0.06 s stagger, ease `[0.22,1,0.36,1]` |
| 1.5-8.0 | Demo | Hero component (accordion) with the 4 features, headline shrinks to a small top label | component slides up and fades in (0.5 s), fake cursor clicks items at 2.0 / 3.6 / 5.2 / 6.8 s |
| 8.0-10.0 | CTA | Large "lanesite.pro" + CTA button | scale 0.9 to 1 spring, button gentle pulse once, everything fades out 9.7-10.0 |

Adjust timings only if the total stays 10.0 s. Hold every readable state at least 1.2 s.

## 3. How to pick the best element for each point

Choose by what the viewer must understand in that moment, not by what looks fanciest. One hero component per scene, at most 3 scenes.

| Point to make | Pattern | Pick | Animation recipe |
|---|---|---|---|
| Hook / promise | Text only, no component | plain `motion.h1` | per-word blur-in + rise |
| 3-5 features, steps or FAQs shown one after another | Accordion / expanding cards | `card-split-accordian` (installed) | scripted clicks, one item opens at a time |
| Before vs after, two plans, two options | Tabs, toggle, comparison slider | a tabs / compare component | switch at the midpoint, animate the changing values |
| Proof (users, speed, uptime) | Stat cards / counters | a stat or number-ticker component | count 0 to N with `animate()` over 1.2 s, ease-out |
| Many integrations or logos | Marquee / logo cloud | a marquee component | constant slow x-translation, fade edges |
| Offer / pricing | Pricing cards | a pricing component | highlighted card scales 1.03 and glows once |
| Process / roadmap | Stepper / timeline | a stepper component | steps light up in order, 0.4 s apart |
| Call to action | Button + URL | button component (shiny / ripple style) | spring in, one pulse |

If the pattern you need is not in `components/watermelon/`:
1. Look for it at the watermelon registry (try `https://registry.watermelon.sh/r/registry.json`, otherwise browse the site's component list).
2. Install with `npx shadcn@latest add https://registry.watermelon.sh/r/<name>.json`.
3. Open the installed file and read its props, dependencies and whether it holds its own state before using it.
4. If nothing fits, compose it from shadcn primitives plus `motion/react` rather than forcing the wrong component.

Never edit files inside `components/watermelon/` in place. Pass props, wrap them, or copy the file to `components/video/` if you need controlled state.

## 4. Animation rules

- Use `motion/react` (already a dependency). Springs for objects: `{type:'spring', stiffness:300-600, damping:30-50}`. Ease curves for text and opacity: `[0.22,1,0.36,1]`, 0.4-0.7 s.
- Animate at most two things at once. Everything else waits.
- Readability at 1080p: headline 72-110 px, item titles at least 28 px effective, body at least 22 px effective, 96 px safe margin, strong contrast against the background.
- The accordion is small by default (about 320-384 px wide). Wrap it in a `transform: scale(1.8-2.2)` container (`transform-origin: center`) so it reads on a 1920 px canvas. Do not change its internals.
- The accordion is uncontrolled, so drive it with real DOM clicks on its `li button` elements from the stage timeline, plus a fake cursor (Playwright recordings do not show the OS cursor). Move the cursor to the target 0.45 s before each click (0.4 s ease), re-read the target's bounding box just before clicking because earlier items are still animating, then press feedback (scale 0.85 for 0.1 s) on click.
- Background: subtle brand-colored gradient, optional slow drift. No busy loops, no rapid flashing.
- Disable everything that does not belong in the video: no scrollbars (`overflow:hidden` on body), no dev overlays (hide the Next.js dev indicator or run a production build with `next build && next start`), no cookie banners, no layout shift after `__videoReady`.

## 5. Build the stage page

Create a route that is not linked from the site, e.g. `app/video/page.tsx` (Next) or `src/pages/Video.tsx` plus a route (Vite). Add `robots: noindex`. One timeline on one clock inside the page is what keeps timings reliable.

Contract with the render script (do not rename):
- `window.__videoReady = true` once fonts and layout are ready.
- `window.__startVideo()` starts the timeline at t = 0.
- `window.__videoDone = true` at t = 10.0 s.

Skeleton (adapt, do not paste blindly):

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, animate } from 'motion/react';
import { AccordionApp } from '@/components/watermelon/card-split-accordian';
// import the same lucide icons the component uses, or pick ones that match each feature

declare global {
  interface Window { __videoReady?: boolean; __videoDone?: boolean; __startVideo?: () => void }
}

type Scene = 'idle' | 'hook' | 'demo' | 'cta' | 'end';

export default function VideoStage() {
  const [scene, setScene] = useState<Scene>('idle');
  const cursor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);

    const moveTo = (i: number, dur = 0.4) => {
      const btn = document.querySelectorAll<HTMLElement>('[data-stage="acc"] li button')[i];
      if (!btn || !cursor.current) return;
      const r = btn.getBoundingClientRect();
      animate(cursor.current, { x: r.left + r.width * 0.75, y: r.top + r.height / 2 },
        { duration: dur, ease: [0.22, 1, 0.36, 1] });
    };
    const click = (i: number) => {
      moveTo(i, 0.12); // correct for layout that moved meanwhile
      at(120, () => {
        document.querySelectorAll<HTMLElement>('[data-stage="acc"] li button')[i]?.click();
        if (cursor.current) animate(cursor.current, { scale: [1, 0.85, 1] }, { duration: 0.2 });
      });
    };

    window.__startVideo = () => {
      at(200, () => setScene('hook'));
      at(1500, () => setScene('demo'));
      [2000, 3600, 5200, 6800].forEach((ms, i) => {
        at(ms - 450, () => moveTo(i));
        at(ms - 120, () => click(i));
      });
      at(8000, () => setScene('cta'));
      at(10000, () => { setScene('end'); window.__videoDone = true; });
    };

    document.fonts.ready.then(() => { window.__videoReady = true; });
  }, []);

  // render: background, hook text, <div data-stage="acc" style={{transform:'scale(1.9)'}}><AccordionApp items={FEATURES}/></div>,
  // CTA block, and the cursor div (position:fixed; left:0; top:0; z-50; pointer-events:none) using motion variants keyed on `scene`.
  return null;
}
```

Define `FEATURES` as `AccordionItemData[]` (import the type from the component) with the 4 real features from the brief.

## 6. Render

Copy `render.mjs` (shipped next to this file) to `scripts/render-video.mjs`, then:

```bash
node scripts/render-video.mjs --url http://localhost:3000/video --out out/lanesite-promo.mp4
# vertical version
node scripts/render-video.mjs --url http://localhost:3000/video --w 1080 --h 1920 --out out/lanesite-promo-9x16.mp4
```

(Use the dev server's real port. A production build is preferred for the final render.) The script records the page in real time, trims to the moment `__startVideo()` was called, and re-encodes to H.264, yuv420p, CRF 18, 30 fps.

## 7. Verify before reporting done

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 out/lanesite-promo.mp4   # expect 10.0 (+/- 0.1)
for t in 0.8 3 5.5 9; do ffmpeg -y -v error -ss $t -i out/lanesite-promo.mp4 -frames:v 1 out/check_$t.png; done
```

Open the four PNGs and check:
- hook text visible and not clipped at 0.8 s
- accordion open on a different item at 3 s and 5.5 s, text fully readable, cursor on the item
- CTA with lanesite.pro readable at 9 s
- no dev overlay, scrollbar, blank frame or layout jump

If anything fails, fix the stage page and re-render. Do not hand over an unchecked video.

## 8. Hand-off

Report: output path(s), duration, resolution, and the two or three things the user can change easily (copy in `FEATURES`, timings in `__startVideo`, brand colors). Delete `out/check_*.png` and `out/.rec`. Do not commit `/video` to production navigation or the sitemap.
