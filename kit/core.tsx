"use client";
"use no memo"; // frame-driven: per-frame runtime state lives in refs on purpose; keep the React Compiler out

/**
 * video-kit core: one clock, sequences, easing, springs, cues and the render contract.
 *
 * Everything time-driven reads `useTime()` (seconds, local to the nearest <Sequence>).
 * Third-party components that animate themselves (motion, GSAP, CSS keyframes) also stay
 * frame-exact because the renderer freezes the page clock (scripts/lib/virtual-clock.js).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

/* ------------------------------------------------------------------ formats */

export const FORMATS = {
  "16x9": { w: 1920, h: 1080, label: "Landscape 16:9 (YouTube, X, LinkedIn, site hero)" },
  "9x16": { w: 1080, h: 1920, label: "Vertical 9:16 (Reels, Shorts, TikTok, Stories)" },
  "1x1": { w: 1080, h: 1080, label: "Square 1:1 (feeds, LinkedIn, X)" },
  "4x5": { w: 1080, h: 1350, label: "Portrait 4:5 (Instagram / Facebook feed)" },
} as const;
export type FormatId = keyof typeof FORMATS;

export type VideoInfo = {
  w: number;
  h: number;
  /** 1 unit = 1px on the short side of a 1080p canvas. Size everything as n * u. */
  u: number;
  format: FormatId;
  portrait: boolean;
  square: boolean;
  landscape: boolean;
  fps: number;
  duration: number;
  rendering: boolean;
};

declare global {
  interface Window {
    __videoReady?: boolean;
    __videoDone?: boolean;
    __startVideo?: () => void;
    __videoMeta?: { duration: number; fps: number; w: number; h: number; format: string; id?: string; poster?: number };
    __videoEvents?: { t: number; type: string; volume?: number }[];
    __vkRender?: { mode: "deterministic" | "realtime"; realInput: boolean };
    __cursorState?: { x: number; y: number; down: boolean; visible: boolean };
    __vclock?: { frozen: boolean; now: () => number };
  }
}

/* -------------------------------------------------------------------- clock */

type Listener = () => void;
function createClock() {
  let t = 0;
  const listeners = new Set<Listener>();
  return {
    get: () => t,
    set(next: number) {
      if (next === t) return;
      t = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
type Clock = ReturnType<typeof createClock>;

const ClockCtx = createContext<Clock | null>(null);
const VideoCtx = createContext<VideoInfo | null>(null);
const OffsetCtx = createContext<{ offset: number; duration: number }>({ offset: 0, duration: Infinity });
export const SpaceCtx = createContext<RefObject<HTMLElement | null> | null>(null);

/** Global timeline time in seconds. Re-renders every frame. */
export function useGlobalTime() {
  const clock = useContext(ClockCtx);
  if (!clock) throw new Error("useGlobalTime must be used inside <VideoRoot>");
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get);
}

/** Time in seconds local to the nearest <Sequence>. */
export function useTime() {
  const t = useGlobalTime();
  const { offset } = useContext(OffsetCtx);
  return t - offset;
}

export function useSequence() {
  return useContext(OffsetCtx);
}

export function useVideo(): VideoInfo {
  const v = useContext(VideoCtx);
  if (!v) throw new Error("useVideo must be used inside <VideoRoot>");
  return v;
}

/** Imperative access for effects (cursor, camera) that need time outside render. */
export function useClockRef() {
  const clock = useContext(ClockCtx);
  const { offset } = useContext(OffsetCtx);
  return useCallback(() => (clock ? clock.get() - offset : 0), [clock, offset]);
}

/* ------------------------------------------------------------------- easing */

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    for (let i = 0; i < 20 && Math.abs(sx(t) - x) > 1e-6; i++) {
      if (sx(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export type EaseFn = (x: number) => number;
export const Easing = {
  linear: (x: number) => x,
  /** default for text, opacity and UI entering */
  out: cubicBezier(0.22, 1, 0.36, 1),
  in: cubicBezier(0.55, 0, 0.75, 0.06),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  /** cursor travel: quick start, soft landing like a hand */
  cursor: cubicBezier(0.33, 0.05, 0.2, 1),
  /** small overshoot, use for pops and badges */
  back: cubicBezier(0.34, 1.56, 0.64, 1),
  /** camera moves */
  camera: cubicBezier(0.45, 0, 0.15, 1),
} satisfies Record<string, EaseFn>;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Progress 0..1 of a window that starts at `at` and lasts `dur` seconds. */
export function progress(t: number, at: number, dur: number, ease: EaseFn = Easing.out) {
  if (dur <= 0) return t >= at ? 1 : 0;
  return ease(clamp01((t - at) / dur));
}

/**
 * Map t through input/output ranges (multi-segment). Like Remotion's interpolate.
 * interpolate(t, [0, 0.5, 2], [0, 1, 0.4], { easing: Easing.out })
 */
export function interpolate(
  t: number,
  input: number[],
  output: number[],
  opts: { easing?: EaseFn; clamp?: boolean } = {},
) {
  const { easing = Easing.linear, clamp = true } = opts;
  if (t <= input[0]) return clamp ? output[0] : output[0] + ((t - input[0]) / (input[1] - input[0])) * (output[1] - output[0]);
  const last = input.length - 1;
  if (t >= input[last]) return clamp ? output[last] : output[last];
  let i = 0;
  while (i < last - 1 && t > input[i + 1]) i++;
  const p = easing((t - input[i]) / (input[i + 1] - input[i]));
  return lerp(output[i], output[i + 1], p);
}

/** Closed-form damped spring from 0 to 1 starting at `at`. Deterministic, no state. */
export function spring(
  t: number,
  at = 0,
  { stiffness = 220, damping = 22, mass = 1 }: { stiffness?: number; damping?: number; mass?: number } = {},
) {
  const x = t - at;
  if (x <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * x) * (Math.cos(wd * x) + ((zeta * w0) / wd) * Math.sin(wd * x));
  }
  return 1 - Math.exp(-w0 * x) * (1 + w0 * x);
}

/** Deterministic PRNG (mulberry32). Never use Math.random in a composition. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ events / sfx */

export type SoundName = "click" | "key" | "whoosh" | "pop" | "success" | "swoosh-up" | "tick";

/** Log a sound cue at global time `t` (seconds). The renderer mixes it into the audio track. */
export function emitSound(type: SoundName, t: number, volume = 1) {
  if (typeof window === "undefined") return;
  (window.__videoEvents ??= []).push({ t, type, volume });
}

/** Run `fn` once when local time crosses `at`. Use it to drive event-driven components. */
export function useCue(at: number, fn: () => void) {
  const clock = useContext(ClockCtx);
  const { offset } = useContext(OffsetCtx);
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    if (!clock) return;
    let fired = false;
    const check = () => {
      const local = clock.get() - offset;
      if (!fired && local >= at) {
        fired = true;
        fnRef.current();
      }
    };
    check();
    return clock.subscribe(check);
  }, [clock, offset, at]);
}

/** <Sfx at={1.2} sound="whoosh" /> : sound cue at a local time. Renders nothing. */
export function Sfx({ at, sound, volume = 1 }: { at: number; sound: SoundName; volume?: number }) {
  const { offset } = useContext(OffsetCtx);
  useCue(at, () => emitSound(sound, offset + at, volume));
  return null;
}

/* ------------------------------------------------------------ ready holds */

let holdCount = 0;
const holdListeners = new Set<Listener>();
/** Delay __videoReady until async work (data, images, fonts) is done. Returns release(). */
export function holdReady() {
  holdCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holdCount--;
    holdListeners.forEach((l) => l());
  };
}

/** Fetch JSON and hold the render until it arrives. */
export function useHeldJson<T>(url: string | undefined, fallback: T): T {
  const [data, setData] = useState<T>(fallback);
  const [release] = useState(() => (url ? holdReady() : () => {}));
  useEffect(() => {
    if (!url) return;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => setData(j as T))
      .catch(() => console.warn("[video-kit] could not load", url))
      .finally(() => requestAnimationFrame(() => release()));
  }, [url, release]);
  return data;
}

async function waitAssets(root: HTMLElement) {
  await document.fonts?.ready;
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) return img.decode?.().catch(() => {});
      return new Promise<void>((r) => {
        img.addEventListener("load", () => r(), { once: true });
        img.addEventListener("error", () => r(), { once: true });
      });
    }),
  );
  if (holdCount > 0) await new Promise<void>((res) => {
    const l = () => {
      if (holdCount <= 0) {
        holdListeners.delete(l);
        res();
      }
    };
    holdListeners.add(l);
  });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/* --------------------------------------------------------------- VideoRoot */

export type VideoRootProps = {
  duration: number;
  fps?: number;
  format?: FormatId;
  id?: string;
  /** seconds; poster frame used for thumbnails */
  poster?: number;
  background?: string;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
};

export function VideoRoot({ duration, fps = 30, format = "16x9", id, poster, background = "#000", style, className, children }: VideoRootProps) {
  const { w, h } = FORMATS[format] ?? FORMATS["16x9"];
  const [clock] = useState(createClock);
  const stageRef = useRef<HTMLDivElement>(null);
  const [rendering] = useState(() => typeof window !== "undefined" && !!window.__vkRender);
  const [fit, setFit] = useState(1);
  const [run, setRun] = useState(0); // preview restarts remount the tree

  const info = useMemo<VideoInfo>(
    () => ({
      w,
      h,
      u: Math.min(w, h) / 1080,
      format,
      portrait: h > w,
      square: h === w,
      landscape: w > h,
      fps,
      duration,
      rendering,
    }),
    [w, h, format, fps, duration, rendering],
  );

  // preview: scale the stage to fit the window
  useLayoutEffect(() => {
    if (rendering) return;
    const onResize = () => setFit(Math.min((window.innerWidth - 32) / w, (window.innerHeight - 72) / h, 1));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [rendering, w, h]);

  useEffect(() => {
    window.__videoMeta = { duration, fps, w, h, format, id, poster };
    window.__videoEvents = [];
    window.__videoDone = false;
    window.__videoReady = false;
    let raf = 0;
    let cancelled = false;
    let startAt = 0;
    clock.set(0);

    const tick = () => {
      const t = (performance.now() - startAt) / 1000;
      if (t >= duration) {
        clock.set(duration);
        window.__videoDone = true;
        if (!rendering) window.setTimeout(() => !cancelled && setRun((r) => r + 1), 1200);
        return;
      }
      clock.set(t);
      raf = requestAnimationFrame(tick);
    };
    window.__startVideo = () => {
      startAt = performance.now();
      window.__videoEvents = [];
      clock.set(0);
      raf = requestAnimationFrame(tick);
    };
    waitAssets(stageRef.current!).then(() => {
      if (cancelled) return;
      window.__videoReady = true;
      if (!rendering) window.__startVideo?.();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [clock, duration, fps, w, h, format, id, poster, rendering, run]);

  // preview controls: R restarts
  useEffect(() => {
    if (rendering) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") setRun((r) => r + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rendering]);

  const stage = (
    <div
      ref={stageRef}
      data-vk-space="root"
      data-vk-stage=""
      className={className}
      style={{
        position: "relative",
        width: w,
        height: h,
        overflow: "hidden",
        background,
        transform: rendering ? undefined : `scale(${fit})`,
        transformOrigin: "0 0",
        ...style,
      }}
    >
      <SpaceCtx.Provider value={stageRef}>{children}</SpaceCtx.Provider>
    </div>
  );

  return (
    <ClockCtx.Provider value={clock}>
      <VideoCtx.Provider value={info}>
        {rendering ? (
          <div key={run} style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
            {stage}
          </div>
        ) : (
          <div style={{ position: "fixed", inset: 0, background: "#09090b", display: "grid", placeItems: "center", overflow: "hidden" }}>
            <div key={run} style={{ width: w * fit, height: h * fit, boxShadow: "0 20px 80px rgba(0,0,0,.6)" }}>
              {stage}
            </div>
            <PreviewBar duration={duration} format={format} onRestart={() => setRun((r) => r + 1)} />
          </div>
        )}
      </VideoCtx.Provider>
    </ClockCtx.Provider>
  );
}

function PreviewBar({ duration, format, onRestart }: { duration: number; format: string; onRestart: () => void }) {
  const t = useGlobalTime();
  return (
    <div style={{ position: "fixed", left: 16, right: 16, bottom: 12, display: "flex", alignItems: "center", gap: 12, font: "12px ui-monospace, monospace", color: "#a1a1aa" }}>
      <button onClick={onRestart} style={{ color: "#fafafa", background: "#27272a", border: 0, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
        Restart (R)
      </button>
      <span>
        {t.toFixed(2)}s / {duration}s · {format}
      </span>
      <div style={{ flex: 1, height: 3, background: "#27272a", borderRadius: 2 }}>
        <div style={{ width: `${(t / duration) * 100}%`, height: 3, background: "#fafafa", borderRadius: 2 }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Sequence */

export type TransitionName =
  | "none"
  | "fade"
  | "blur"
  | "rise"
  | "drop"
  | "scale"
  | "zoom"
  | "slide-left"
  | "slide-right"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "iris";

function transitionStyle(name: TransitionName, p: number, u: number, entering: boolean): CSSProperties {
  // p: 0 = hidden, 1 = fully shown
  const q = 1 - p;
  const dir = entering ? 1 : -1;
  switch (name) {
    case "none":
      return {};
    case "fade":
      return { opacity: p };
    case "blur":
      return { opacity: p, filter: q > 0.001 ? `blur(${q * 18 * u}px)` : undefined };
    case "rise":
      return { opacity: p, transform: `translateY(${q * 60 * u * dir}px)` };
    case "drop":
      return { opacity: p, transform: `translateY(${-q * 60 * u * dir}px)` };
    case "scale":
      return { opacity: p, transform: `scale(${0.9 + 0.1 * p})` };
    case "zoom":
      return { opacity: p, transform: `scale(${entering ? 1.12 - 0.12 * p : 1 - 0.08 * q})`, filter: q > 0.001 ? `blur(${q * 10 * u}px)` : undefined };
    case "slide-left":
      return { opacity: Math.min(1, p * 1.5), transform: `translateX(${q * 120 * u * dir}px)` };
    case "slide-right":
      return { opacity: Math.min(1, p * 1.5), transform: `translateX(${-q * 120 * u * dir}px)` };
    case "wipe-left":
      return { clipPath: `inset(0 ${q * 100}% 0 0)` };
    case "wipe-right":
      return { clipPath: `inset(0 0 0 ${q * 100}%)` };
    case "wipe-up":
      return { clipPath: `inset(${q * 100}% 0 0 0)` };
    case "iris":
      return { clipPath: `circle(${p * 75}% at 50% 50%)` };
  }
}

export type SequenceProps = {
  from: number;
  duration: number;
  enter?: TransitionName;
  exit?: TransitionName;
  /** transition length in seconds (enter and exit) */
  transition?: number;
  name?: string;
  /** absolute fill (default) or flow layout */
  layout?: "fill" | "none";
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
};

/** Mounts children while from <= t < from + duration and gives them local time. */
export function Sequence({ from, duration, enter = "none", exit = "none", transition = 0.5, name, layout = "fill", style, className, children }: SequenceProps) {
  const parent = useContext(OffsetCtx);
  const t = useGlobalTime() - parent.offset;
  const { u } = useVideo();
  const local = t - from;
  const ctx = useMemo(() => ({ offset: parent.offset + from, duration }), [parent.offset, from, duration]);
  if (local < 0 || local >= duration) return null;

  let ts: CSSProperties = {};
  const pin = Easing.out(clamp01(local / transition));
  const pout = Easing.in(clamp01((duration - local) / transition));
  if (enter !== "none" && local < transition) ts = transitionStyle(enter, pin, u, true);
  else if (exit !== "none" && duration - local < transition) ts = transitionStyle(exit, pout, u, false);

  return (
    <OffsetCtx.Provider value={ctx}>
      <div
        data-vk-seq={name}
        className={className}
        style={{ ...(layout === "fill" ? { position: "absolute", inset: 0 } : null), ...style, ...ts }}
      >
        {children}
      </div>
    </OffsetCtx.Provider>
  );
}

/** Chain sequences back to back: <Series><Series.Item duration={2}>…</Series.Item>…</Series> */
export function Series({ children, overlap = 0 }: { children: ReactNode; overlap?: number }) {
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean) as React.ReactElement<SeriesItemProps>[];
  const starts = items.reduce<number[]>((acc, el, i) => [...acc, i === 0 ? 0 : acc[i - 1] + items[i - 1].props.duration - overlap], []);
  return (
    <>
      {items.map((el, i) => (
        <Sequence key={i} from={starts[i]} {...el.props}>
          {el.props.children}
        </Sequence>
      ))}
    </>
  );
}
type SeriesItemProps = Omit<SequenceProps, "from">;
/** Marker element read by <Series>; renders nothing by itself. */
Series.Item = function SeriesItem(props: SeriesItemProps) {
  void props;
  return null;
};

/* ---------------------------------------------------- coordinate spaces */

/** Position of an element inside a space element, in the space's own (untransformed) px. */
export function rectInSpace(el: Element, space: HTMLElement) {
  const r = el.getBoundingClientRect();
  const s = space.getBoundingClientRect();
  const k = s.width / (space.offsetWidth || s.width || 1);
  const x = (r.left - s.left) / k;
  const y = (r.top - s.top) / k;
  const w = r.width / k;
  const h = r.height / k;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** Space px -> client (viewport) px. */
export function spaceToClient(space: HTMLElement, x: number, y: number) {
  const s = space.getBoundingClientRect();
  const k = s.width / (space.offsetWidth || s.width || 1);
  return { x: s.left + x * k, y: s.top + y * k };
}

export type Target = string | Element | { x: number; y: number } | [number, number] | (() => Element | null);

/** Resolve a target to its centre (or anchor) in space px. null if not in the DOM yet. */
export function resolvePoint(
  target: Target,
  space: HTMLElement,
  anchor: [number, number] = [0.5, 0.5],
): { x: number; y: number; rect?: ReturnType<typeof rectInSpace> } | null {
  if (Array.isArray(target)) return { x: target[0], y: target[1] };
  if (typeof target === "object" && target && "x" in target && !(target instanceof Element)) return { x: target.x, y: target.y };
  const el = resolveElement(target, space);
  if (!el) return null;
  const rect = rectInSpace(el, space);
  return { x: rect.x + rect.w * anchor[0], y: rect.y + rect.h * anchor[1], rect };
}

export function resolveElement(target: Target, space?: HTMLElement | null): Element | null {
  if (typeof target === "string") {
    const root = space?.closest("[data-vk-stage]") ?? document;
    return root.querySelector(target);
  }
  if (typeof target === "function") return target();
  if (target instanceof Element) return target;
  return null;
}

/** A positioned element whose children (cursor, spotlight, callouts) use its coordinates. */
export function useSpace() {
  return useContext(SpaceCtx);
}

/** Fill helper */
export const fill: CSSProperties = { position: "absolute", inset: 0 };
