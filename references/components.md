# Using library components in videos

Search: `node scripts/video/find-component.mjs <words> [--registry a,b] [--limit n]`. Install with the printed `npx shadcn@latest add <url>`.

| Need | Good picks |
|---|---|
| numbers | magicui `number-ticker`, cult-ui `rolling-number` (or kit `Counter`) |
| logo / item ticker | magicui `marquee`, reactbits `LogoLoop-TS-TW` (or kit `Marquee`) |
| CTA buttons | magicui `shimmer-button`, `rainbow-button`, `pulsating-button`; cult-ui `texture-button` |
| borders / glow | magicui `border-beam`, `shine-border`, `neon-gradient-card` |
| text effects | magicui `text-animate`, `aurora-text`, `hyper-text`; reactbits `BlurText-TS-TW`, `SplitText-TS-TW`; motion-primitives `text-effect` |
| device mockups | magicui `safari`, `iphone`; cult-ui `mock-browser-window` |
| product UI to click | watermelon `feature-tour`, `changeable-pricing-section`, `continuous-tabs`, `command-search`, `card-split-accordian`, `dock` |
| click/mouse flair | reactbits `ClickSpark-TS-TW`, `SplashCursor-TS-TW`, `TargetCursor-TS-TW`; magicui `smooth-cursor`, `cool-mode` |
| backgrounds | animate-ui `backgrounds-*`, magicui `retro-grid`, `flickering-grid`, `particles`; reactbits backgrounds (WebGL) |
| flows / diagrams | magicui `animated-beam`, `orbiting-circles`, `animated-list` |

Integration checklist:
1. Read the file: props, `"use client"`, internal state, deps (gsap, three, ogl), and whether it starts on mount, on hover, or when scrolled into view.
2. Mount it with `<Sequence from>` so its own intro animation starts on the beat you want.
3. In-view triggers (`whileInView`, IntersectionObserver, `useInView`): pass `once`/`inView` props, or copy the file to `components/video/` and start on mount. They also work if the element is in the viewport when mounted.
4. Uncontrolled components (accordions, tabs): drive them with cursor `click` steps on their real buttons. Add `data-*` attributes or `id`s through props or a wrapper so selectors are stable.
5. Small components (about 360 px wide) need a `transform: scale(1.8-2.2)` wrapper on a 1920 px canvas. The cursor and effects measure the scaled boxes correctly.
6. Theme: many components use shadcn CSS variables (`--primary`, `--background`). Set them on a wrapper so they match `brand.colors`.
7. Never edit files in place in `components/<library>/`.

Why vendor animations stay in sync: the renderer freezes `requestAnimationFrame`, timers, `performance.now`, `Date` and every `document.getAnimations()` entry (CSS keyframes, transitions, motion WAAPI), pausing them and seeking them each frame, finishing them at their end so `onfinish` fires. GSAP, motion springs, canvas and WebGL loops all read the virtual clock. Limits: `animationend`/`transitionend` events don't fire for seeked CSS animations (`finished` promises do), and a native text caret is hidden.
