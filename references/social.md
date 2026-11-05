# Social media specs and automation

| Platform | Format | Length sweet spot | Notes |
|---|---|---|---|
| Instagram Reels / Stories, TikTok, YouTube Shorts | 9x16 | 7-15 s | keep text in the middle 70%: avoid the top 12% and bottom 20% (UI). Burn in captions (`Captions`), many watch muted |
| Instagram / Facebook feed | 4x5 | 8-15 s | 4:5 takes the most feed space |
| LinkedIn | 1x1 or 16x9 | 10-30 s | plain caption, 2-3 hashtags, first line is the hook |
| X | 16x9 or 1x1 | 6-15 s | short caption, 0-2 hashtags |
| YouTube / site hero | 16x9 | 15-60 s | `--scale 2` for crisper text |

All renders: H.264 high profile, yuv420p, BT.709, 30 fps (60 with `--fps 60`), AAC 48 kHz stereo (silent track if no audio), `+faststart`. That's accepted by every platform above.

Captions: lead with the outcome ("Describe your shop. Get a website."), one line about how, then the CTA "lanesite.pro". Use real claims only (free plan, $5 Pro, 7-day trial, HTTPS, bookings, tested in a real browser).

Music: royalty-free tracks the user has rights to (YouTube Audio Library, Pixabay Music, their own). Pass `--music file --music-volume 0.15-0.25`. TikTok/Instagram trending sounds must be added in the app, not baked in.

Campaign file (`video/campaigns/*.json`): `videos[]` with `id`, `name`, `formats`, `props`, and `post.caption`, `post.hashtags`, `post.schedule` (ISO time), `post.platforms.{instagram,tiktok,youtube-shorts,linkedin,x}` with an optional `format`/`caption`/`hashtags` override. Output: `<out>/<name>/<name>-<format>.mp4`, `-poster.jpg`, `-check.jpg`, `post.md`; `<out>/manifest.json` and `schedule.csv`.

Automation options (posting needs the user's accounts and approval):
- Bulk-upload `schedule.csv` into Buffer, Metricool or Later.
- An n8n / Make workflow reading `manifest.json` (upload the video, then create the post at `schedule`).
- Weekly regeneration with Claude Code `/schedule` (cloud routine) or cron: rebuild the campaign from a template list, render with `--skip-existing`, notify for review.
