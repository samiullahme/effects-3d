# Format recipes

Times are seconds. Every format ends on `<EndCard>` (about 2.3 s) unless noted. Build each as `components/video/<name>.tsx`, export it via `defineComposition`, and add it to `compositions.ts`. `kit/templates/launch.tsx` is the reference implementation: Backdrop + Sequences + Camera + Cursor + brand UI + Sfx.

Pacing rules: hold every readable state at least 1.2 s; at most two things move at once; one idea per scene; first meaningful frame by 0.3 s (the hook decides retention); whoosh on scene changes, click on presses, pop on toasts/badges, success on completion.

## launch (template, 15 s)
0-2.6 hook (KineticText blur, accent last word) · 2.4-12.8 demo: Float3D browser, zoom on composer, `type` into `#brief`, click `#build-btn` → BuildLog (7 steps × 0.34 s) → MiniSite, click `#order-btn` → Toast · 12.7-15 end card.
Props: `hookA`, `hookB`, `brief`. Good A/B test: change only `hookA`.

## feature spotlight (10 s)
0.2 Eyebrow (feature name) · 0.35 title KineticText (`brand.features[k].title`) · 0.9 body Reveal · 0.6 demo PopIn/Float3D.
- chat: ChatPanel + small BrowserFrame(MiniSite). `type` editRequest into `#chat-input` at 1.8 (cps 30) → click `#chat-send` at 3.6 → `onSend` stores sentAt; reply at sentAt+1.1 → MiniSite `fridayHours="9am to 6pm"` → Highlight `#hours-row` + Callout "Every page updated". Camera: zoom 1.35 on input, then 1.4 on `#hours-row`.
- booking: BookingWidget. Click `[data-day="Thu"]` 1.6, `[data-time="4:30"]` 2.5, `#booking-submit` 3.6 → Toast "New booking request · Thu 4:30" + Confetti.
- domain: DomainPanel. `type` "maplebakery.com" into `#domain-input` 1.6 → click `#domain-connect` 3.2 → rows check (0.55 s apart) → BrowserFrame url becomes the domain.
Layout: landscape = title row on top, demo row below; portrait = title top (2 lines), demo stacked.

## how it works (12 s)
3 scenes of 3.1 s from `brand.steps`: big mono number "01", title, body, plus a visual (Composer with typing; BuildLog; BrowserFrame + live pill). A rail of 3 segments at the top fills with `progress()`. Transition `slide-left` between steps.

## proof / stats (9 s)
Headline 0.2 → 4 tiles PopIn 0.4 s apart with `Counter`: "$0 to start", "$5 a month for Pro", "5 websites on Pro", "100 AI edits a month" (real plan facts only) → `Marquee` of `brand.shopTypes` → URL.

## testimonial (8 s) props `{ index }`
Backdrop aurora · huge quote mark · `KineticText` quote by word (stagger 0.05, blur) · 2.6 avatar initials circle + name + `shop · place` · 6.4 small Logo + URL. Quotes are verbatim; never shorten them into something the person did not say.

## pricing (10 s)
Headline `brand.pricing.headline` · Free and Pro cards (portrait: stacked) · price Counter 0→5 on Pro · items check with 0.12 s stagger · cursor `move` over Free 2.0 → `click` Pro "Start free trial" 4.2 → Pro border glow (Highlight) + "7 days free" badge pop + Confetti · `brand.pricing.note` · end card 7.6.

## before / after (8 s)
Title "From missed calls to online orders." · compare slider: before = phone with missed calls, after = dashboard of order requests. Slider handles pointer down/move; cursor `drag` from 80% to 20% (dur 1.6) and back to 50%. Quote from James C. (verbatim).

## site tour (12-14 s)
Capture the real site first: full-page screenshot of lanesite.pro at 1440 px wide, dark scheme, after animations settle, plus the y offset of each `h2` section (write a JSON manifest next to the PNG in `public/video/shots/`). Composition: `useHeldJson(manifest)` → BrowserFrame + `ScrollShot` with a stop per section every ~2.2 s → `Captions` with the section heading → camera push 1.15 at each stop.

## kinetic hook (6 s)
Beats: 0-1.4 "Your shop needs a website." (pop) · 1.4-2.8 "No time to build one?" (mask) · 2.8-4.3 "Describe your" + WordSwap(bakery, salon, pharmacy, auto shop) · 4.3-6 Logo + URL + "Free to start". Backdrop beams, whoosh per beat, 120u type in portrait.

## what's new (10 s)
Eyebrow "What's new · {brand.changelog.date}" · cards spring in 0.6 s apart: tag pill (New/Builder), title, body · Toast for the headline item · end card.

## FAQ (9 s) props `{ index }`
Question bubble typed with Typewriter (cps 30) at 0.4 · answer KineticText by word at 2.4 (stagger 0.045) · "More answers at lanesite.pro/faq" at 7.2.
