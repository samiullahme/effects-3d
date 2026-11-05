---
name: lanesite-video
description: Use when asked to make, redo or batch SaaS promo / social media videos for lanesite.pro (or another web product) from real UI components: product launch, feature demo, UI walkthrough with mouse clicks, typing and zooms, testimonials, pricing, FAQ or changelog clips, Reels/Shorts/TikTok/LinkedIn formats, or a scheduled video campaign. Also when adding animated components from watermelon.sh, Magic UI, Aceternity, React Bits, Animate UI, Cult UI or Motion Primitives to a video.
---

# LaneSite video studio

Videos are React pages rendered frame by frame. A hidden `/video` route shows one composition; `render.mjs` freezes the page clock (timers, rAF, `performance.now`, `Date`, CSS/WAAPI animations, `<video>`, SMIL) and steps it exactly 1/fps per frame. So every frame is exact, at any machine speed, even with third-party components that animate themselves. A scripted cursor drives the UI, and the real Playwright mouse mirrors it, so hover, focus, `onClick` and `whileHover` fire for real.

Output: H.264 MP4 with AAC (synthesised click/key/whoosh/pop/success SFX plus optional music), a poster JPG, and a contact sheet JPG for checking.

## 1. Setup (once per project)

```bash
node <skill-dir>/scripts/setup.mjs --project .      # Next.js App Router project
npm run build && npm run start                        # or npm run dev while iterating
open http://localhost:3000/video                      # gallery + live preview (R restarts)
```

Setup copies `components/video-kit/` (the kit; refresh it with `--update`) and `scripts/video/`. It also creates the files you own, which are never overwritten: `components/video/compositions.ts`, `components/video/player.tsx`, `app/video/{layout,page}.tsx` (noindex, brand fonts) and `video/campaigns/example.json`. It installs `motion`, `lucide-react`, `playwright` + chromium if missing, and checks ffmpeg.

If another tool or agent is editing the same app, do not run setup in it. Copy the project to a separate folder and use a different port.

## 2. Workflow for every video

1. **Brief.** Goal, format(s), length, CTA. Default: 9:16 + 16:9, 10-15 s, CTA `lanesite.pro`.
2. **Copy.** Only from `components/video-kit/brand.ts`, which was taken from the live site. If the site changed, re-read https://lanesite.pro and update `brand.ts`. Never invent stats, testimonials, prices or features.
3. **Pick a format** from the table below. Use a ready template, or build a composition from the recipe.
4. **Pick components.** Prefer the kit plus brand UI. For extra flair, search the free registries (section 5).
5. **Script** cursor, camera and cues in local seconds (section 4).
6. **Check stills first** (fast, no encode): `node scripts/video/render.mjs --id <id> --format 9x16 --stills 0.5,3,6,9`. Then open the PNGs.
7. **Render**: `node scripts/video/render.mjs --id <id> --format 16x9,9x16`.
8. **Verify** (mandatory). Open `out/video/<id>-<format>-check.jpg` (12 frames). Look for clipped text, a cursor not on its target, a click that did not change the UI, blank frames, dev overlays, and anything unreadable on a phone. Fix and re-render. The renderer prints duration, size and SFX count; the duration must equal the composition's.
9. **Hand off**: file paths, duration and the props the user can change.

## 3. Formats (video styles)

| id | Status | Length | Use for | Story |
|---|---|---|---|---|
| `launch` | template | 15 s | hero promo, pinned post, site header | hook → browser drops in (3D) → cursor types brief → clicks Build → build log → site live → order toast → end card |
| feature spotlight | recipe | 10 s | one feature per post (booking, chat edits, domain, photos) | eyebrow + title → UI demo with cursor + zoom + Highlight/Callout → end card |
| how it works | recipe | 12 s | explainer, ads | 3 steps × ~3 s, step rail, visual per step (`brand.steps`) |
| proof / stats | recipe | 8-9 s | retargeting | `Counter` tiles from real numbers (`$0` start, `$5`/mo, 5 sites, 100 edits) + `Marquee` of shop types |
| testimonial | recipe | 8 s | social proof, daily series | big quote via `KineticText`, initials avatar, name · shop · city (`brand.testimonials[i]`, verbatim) |
| pricing | recipe | 10 s | offer / trial push | Free vs Pro cards, cursor hovers Free, clicks "Start free trial", Pro glows + `Confetti`, price `Counter` |
| before / after | recipe | 8 s | pain → gain | compare slider dragged by cursor (`drag` step); quote "My phone used to ring all day" |
| site tour | recipe | 12-14 s | walkthrough of the real site | full-page screenshot in `BrowserFrame` + `ScrollShot` stops + camera zooms + `Captions` |
| kinetic hook | recipe | 6 s | Reels/TikTok openers | 3-4 big-type beats, `WordSwap` (bakery/salon/pharmacy), whoosh per beat, URL |
| what's new | recipe | 10 s | changelog posts | cards spring in with tags (`brand.changelog`) |
| FAQ | recipe | 9 s | daily Q&A series | typed question bubble → answer reveal (`brand.faq[i]`) → "more at lanesite.pro" |

"Recipe" means: copy `kit/templates/launch.tsx` as the pattern, put the new file in `components/video/`, register it in `compositions.ts` with `defineComposition`, then expose `index`/copy as props so one composition gives a whole series via campaigns. Full recipes with timings and shot lists: `references/formats.md`.

Aspect ratios: `16x9` 1920×1080, `9x16` 1080×1920, `1x1` 1080×1080, `4x5` 1080×1350. Build every layout with `useVideo()` (`u` = 1px at 1080p short side, plus `portrait`/`landscape`). Size everything as `n * u`. Keep text out of the bottom 20% and top 12% in 9:16 (platform UI).

## 4. Kit API (import from `@/components/video-kit`)

- **Timeline**: `<Sequence from duration enter exit transition>` (transitions: fade, blur, rise, drop, scale, zoom, slide-left/right, wipe-left/right/up, iris), `<Series>`, `useTime()` (local s), `useVideo()`, `interpolate`, `progress`, `spring(t, at)`, `Easing.*`, `seeded()` (never `Math.random`), `useCue(at, fn)`, `<Sfx at sound>`, `emitSound`, `holdReady()` / `useHeldJson()` for async data.
- **Cursor**: `<Cursor script={[...]} glow trail start />`. Steps: `{at, move: target}`, `{at, click: target}` (arrives 0.06 s before `at`), `{at, type: "text", into: target, cps}`, `{at, drag: {from, to}, dur}`, `{at, scroll: container, to|by, dur}`, `{at, press: "Mod+K"}` (shows keycaps), `{at, hide|show}`. Targets: CSS selector, element, `[x, y]`. Arrow, hand and I-beam shapes switch from the CSS `cursor` under it. Ripple + press + sounds are built in.
- **Camera**: `<Camera keys={[{at, dur, zoom, focus, rotateX, rotateY}]} drift>` Screen Studio-style zoom/pan + 3D tilt. `zoomOnClicks(script)` builds keys from the cursor script. Put the Cursor and effects inside the Camera.
- **Effects**: `Spotlight`, `Highlight`, `Callout`, `Confetti`, `Toast`, `ProgressLine` (target-tracking every frame).
- **Text**: `KineticText` (rise, blur, mask, pop, slide, scramble, typewriter; accent words, marker), `WordSwap`, `Counter`, `Typewriter`, `Captions`, `Marquee`.
- **Frames**: `BrowserFrame` (URL can type), `PhoneFrame`, `Float3D`, `PopIn`, `Reveal`, `ScrollShot`.
- **Backgrounds**: `Backdrop variant` aurora, mesh, grid, dots, beams, spotlight, with grain + vignette.
- **Brand UI** (`kit/templates/ui.tsx`): `Logo`, `Eyebrow`, `headline()`, `Button` (shimmer), `Composer`, `BuildLog`, `MiniSite`, `ChatPanel`, `BookingWidget`, `DomainPanel`, `EndCard`. These are real interactive components: clicks change their state.

Drive event-driven components with real clicks. Store the click time with `const now = useClockRef(); onClick={() => setAt(now())}`, then animate from that time.

## 5. Free component libraries

```bash
node scripts/video/find-component.mjs "marquee"          # searches all 7 registries
node scripts/video/find-component.mjs cursor --registry magicui,reactbits
npx shadcn@latest add <printed url>
```

Registries: watermelon.sh (product UI: tabs, pricing, toolbars, feature tours), Magic UI (number-ticker, marquee, border-beam, shimmer-button, safari/iphone mockups, animated-beam, particles), Aceternity (spotlight, hero blocks, 3D cards), React Bits (`*-TS-TW`: BlurText, ClickSpark, SplashCursor, backgrounds, often GSAP/OGL), Animate UI (backgrounds, buttons), Cult UI (mock-browser-window, dynamic-island, texture buttons), Motion Primitives (text-effect, morphing, spotlight).

Rules: read the installed file before using it (props, internal state, deps). Never edit vendor files in place; wrap them or copy them into `components/video/`. Scroll-triggered or in-view components need their trigger forced (`once`/`inView` true, or wrap in a `Sequence` so they mount at the right time). Mouse-reactive components react to the real mirrored mouse. WebGL/canvas components work (rAF is virtual) but render slower. Details and gotchas: `references/components.md`.

## 6. Render CLI

`node scripts/video/render.mjs` with:
`--list` · `--id` · `--format 16x9,9x16|all` · `--props '{"index":2}'|file.json` · `--fps 60` · `--scale 2` (supersampled, crisper, ~3× slower) · `--music bed.mp3 --music-volume 0.2` · `--no-sfx` · `--stills 1,4.5` · `--from 3 --to 7` · `--mode realtime` (screen-recording fallback) · `--url http://localhost:3100/video` · `--no-check` · `--crf 18`.

## 7. Social automation

`node scripts/video/render.mjs --campaign video/campaigns/example.json [--skip-existing]` renders every video × format. Per video it writes `post.md` (captions per platform). Per campaign it writes `manifest.json` (video, poster, caption, schedule per platform post) and `schedule.csv` (date, platform, video, poster, caption) for bulk schedulers (Buffer, Metricool, Later) or an n8n/Make flow. Use one composition with `index`/copy props to produce a whole week of posts (7 testimonials, 6 FAQs). Platform specs, caption rules and scheduling: `references/social.md`. Posting itself goes through the user's scheduler; never post without the user's approval.

## Common mistakes

- Using `Math.random`, `setInterval` math on wall time, or CSS `animation` loops for timing. Use `useTime()`/`seeded()`. Third-party CSS loops are fine (the clock syncs them).
- Cursor click on a selector that is not mounted yet: the cursor waits in place. Check stills at the click time.
- Event times hard-coded after a click: derive them from the click time instead (`useClockRef`).
- Text under 22u in 9:16, or more than about 8 words on screen at once.
- Handing over without opening the contact sheet.
