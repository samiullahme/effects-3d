# lanesite-video: a SaaS video studio skill for Claude Code

Make promo and social videos for [lanesite.pro](https://lanesite.pro) from real, clickable React UI and free animated component libraries. Each video is a React composition rendered frame-exact to MP4 with a scripted mouse (curved moves, hover, clicks with ripple, typing, drag, scroll, shortcuts), Screen Studio-style zooms, 3D tilt, kinetic text, sound effects, and 16:9 / 9:16 / 1:1 / 4:5 output plus batch campaigns for social scheduling.

## Install

```bash
git clone https://github.com/samiullahme/effects-3d ~/.claude/skills/lanesite-video
```

Then ask Claude Code to "make a LaneSite launch video for Reels". The skill runs `scripts/setup.mjs` in your Next.js project.

## Layout

```
SKILL.md                 workflow, formats, kit API, CLI (what Claude reads)
references/              format recipes, component library guide, social specs
kit/                     copied to components/video-kit/ (timeline, cursor, camera, effects, text, frames, backgrounds, brand, templates)
templates/next/          /video route + project-owned registry files
scripts/
  setup.mjs              install the kit into a project
  render.mjs             deterministic renderer (+ realtime fallback, stills, campaigns)
  find-component.mjs     search 7 free shadcn registries
  lib/virtual-clock.js   page clock freeze/step
  lib/audio.mjs          synthesised SFX + mix
campaigns/example.json   batch render + captions + schedule
```

## Requirements

Node 20+, a Next.js App Router project with the `@/*` alias, ffmpeg, and Playwright chromium (setup installs it).
