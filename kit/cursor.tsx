"use client";
"use no memo"; // frame-driven: per-frame runtime state lives in refs on purpose; keep the React Compiler out
/* eslint-disable react-hooks/refs */

/**
 * <Cursor script={[...]} /> : a scripted mouse that moves on curved paths, hovers, clicks
 * (with press + ripple + sound), types, drags, scrolls and presses shortcuts.
 *
 * Put it inside the same space as the UI it drives (inside <Camera> if you use one) so it
 * zooms with the scene. Targets are CSS selectors (resolved inside the stage), elements,
 * or points in space px. Positions are re-measured every frame, so moving or animating
 * targets are tracked.
 *
 * When rendered by scripts/render.mjs the real Playwright mouse mirrors this cursor, so
 * CSS :hover, focus, pointer events and motion's whileHover/whileTap all fire for real.
 * In the browser preview it falls back to synthetic events.
 */

import { useContext, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";

import {
  Easing,
  SpaceCtx,
  clamp01,
  emitSound,
  lerp,
  resolveElement,
  resolvePoint,
  spaceToClient,
  useSequence,
  useTime,
  useVideo,
  type Target,
} from "./core";

type Anchor = [number, number];
export type CursorStep =
  | { at: number; move: Target; dur?: number; arc?: number; anchor?: Anchor }
  | { at: number; click: Target | true; dur?: number; arc?: number; anchor?: Anchor; sound?: boolean }
  | { at: number; type: string; into?: Target; cps?: number; clear?: boolean; anchor?: Anchor }
  | { at: number; drag: { from?: Target; to: Target }; dur?: number; anchor?: Anchor }
  | { at: number; scroll: Target; to?: Target | number; by?: number; dur?: number }
  | { at: number; press: string }
  | { at: number; hide: true }
  | { at: number; show: true };

type Move = { start: number; end: number; to: Target; anchor: Anchor; arc: number; from?: Pt; last?: Pt };
type Pt = { x: number; y: number };
type Action =
  | { at: number; kind: "down" | "up"; sound: boolean }
  | { at: number; kind: "type"; text: string; into?: Target; cps: number; clear: boolean }
  | { at: number; kind: "scroll"; target: Target; to?: Target | number; by?: number; dur: number }
  | { at: number; kind: "press"; combo: string }
  | { at: number; kind: "visible"; on: boolean };

const PRESS = 0.1; // seconds the button stays down on a click
const ARRIVE = 0.06; // cursor lands this long before the press

export function compileCursorScript(script: CursorStep[]) {
  const moves: Move[] = [];
  const actions: Action[] = [];
  const sorted = [...script].sort((a, b) => a.at - b.at);
  for (const s of sorted) {
    if ("move" in s) {
      const dur = s.dur ?? 0.6;
      moves.push({ start: s.at, end: s.at + dur, to: s.move, anchor: s.anchor ?? [0.5, 0.5], arc: s.arc ?? 0.12 });
    } else if ("click" in s) {
      if (s.click !== true) {
        const dur = s.dur ?? 0.55;
        moves.push({ start: s.at - ARRIVE - dur, end: s.at - ARRIVE, to: s.click, anchor: s.anchor ?? [0.5, 0.5], arc: s.arc ?? 0.12 });
      }
      actions.push({ at: s.at, kind: "down", sound: s.sound ?? true });
      actions.push({ at: s.at + PRESS, kind: "up", sound: false });
    } else if ("type" in s) {
      let start = s.at;
      if (s.into) {
        moves.push({ start: s.at - ARRIVE - 0.55, end: s.at - ARRIVE, to: s.into, anchor: s.anchor ?? [0.5, 0.5], arc: 0.1 });
        actions.push({ at: s.at, kind: "down", sound: true });
        actions.push({ at: s.at + PRESS, kind: "up", sound: false });
        start = s.at + 0.3;
      }
      actions.push({ at: start, kind: "type", text: s.type, into: s.into, cps: s.cps ?? 22, clear: s.clear ?? true });
    } else if ("drag" in s) {
      const dur = s.dur ?? 0.9;
      if (s.drag.from) moves.push({ start: s.at - ARRIVE - 0.5, end: s.at - ARRIVE, to: s.drag.from, anchor: s.anchor ?? [0.5, 0.5], arc: 0.1 });
      actions.push({ at: s.at, kind: "down", sound: false });
      moves.push({ start: s.at + 0.08, end: s.at + 0.08 + dur, to: s.drag.to, anchor: [0.5, 0.5], arc: 0.04 });
      actions.push({ at: s.at + 0.12 + dur, kind: "up", sound: false });
    } else if ("scroll" in s) {
      actions.push({ at: s.at, kind: "scroll", target: s.scroll, to: s.to, by: s.by, dur: s.dur ?? 1 });
    } else if ("press" in s) {
      actions.push({ at: s.at, kind: "press", combo: s.press });
    } else if ("hide" in s) {
      actions.push({ at: s.at, kind: "visible", on: false });
    } else if ("show" in s) {
      actions.push({ at: s.at, kind: "visible", on: true });
    }
  }
  moves.sort((a, b) => a.start - b.start);
  actions.sort((a, b) => a.at - b.at);
  return { moves, actions };
}

/** Times (local seconds) at which the script presses the mouse. Handy for camera zooms. */
export function clickTimes(script: CursorStep[]) {
  return script.filter((s) => "click" in s || ("type" in s && s.into)).map((s) => ({ at: s.at, target: "click" in s ? s.click : (s as { into?: Target }).into }));
}

function bezier(a: Pt, b: Pt, p: number, arc: number): Pt {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (a.x + b.x) / 2 + (dy / len) * arc * len;
  const cy = (a.y + b.y) / 2 - (dx / len) * arc * len;
  const q = 1 - p;
  return { x: q * q * a.x + 2 * q * p * cx + p * p * b.x, y: q * q * a.y + 2 * q * p * cy + p * p * b.y };
}

function setNativeValue(el: Element, value: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    try {
      el.setSelectionRange(value.length, value.length);
    } catch {}
  } else {
    el.textContent = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
function readValue(el: Element) {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.textContent ?? "";
}

function synthPointer(type: "down" | "up" | "move", x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  if (!el) return;
  const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window, button: 0 };
  const pointer = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true };
  if (type === "down") {
    el.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
    (el.closest("input,textarea,select,button,a,[tabindex],[contenteditable]") as HTMLElement | null)?.focus?.();
  } else if (type === "up") {
    el.dispatchEvent(new PointerEvent("pointerup", { ...pointer, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("click", { ...base, buttons: 0 }));
  } else {
    el.dispatchEvent(new PointerEvent("pointermove", { ...pointer, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mousemove", { ...base, buttons: 1 }));
  }
}

function parseCombo(combo: string) {
  const parts = combo.split("+").map((p) => p.trim());
  const key = parts.pop() ?? "";
  const mods = parts.map((p) => p.toLowerCase());
  const mac = true;
  return {
    key: key.length === 1 ? key.toLowerCase() : key,
    metaKey: mods.includes("cmd") || mods.includes("meta") || (mac && mods.includes("mod")),
    ctrlKey: mods.includes("ctrl") || (!mac && mods.includes("mod")),
    shiftKey: mods.includes("shift"),
    altKey: mods.includes("alt") || mods.includes("option"),
  };
}

export type CursorProps = {
  script: CursorStep[];
  /** where the cursor waits before the first move (space px or target) */
  start?: Target;
  /** px in space units; default 34u */
  size?: number;
  /** ripple / glow colour */
  color?: string;
  ripple?: boolean;
  /** soft light around the cursor, e.g. "rgba(212,178,122,.35)" */
  glow?: string;
  /** number of ghost trail points */
  trail?: number;
  /** show keycaps for press steps */
  showKeys?: boolean;
  /** start hidden until a { show: true } step */
  hidden?: boolean;
  style?: CSSProperties;
};

export function Cursor({ script, start, size, color = "#ffffff", ripple = true, glow, trail = 0, showKeys = true, hidden = false, style }: CursorProps) {
  const t = useTime();
  const { offset } = useSequence();
  const { u, w, h } = useVideo();
  const space = useContext(SpaceCtx);
  const S = size ?? 34 * u;

  const compiled = useMemo(() => compileCursorScript(script), [script]);
  const rt = useRef({
    moves: compiled.moves.map((m) => ({ ...m })),
    fired: 0,
    pos: null as Pt | null,
    down: false,
    visible: !hidden,
    visibleSince: -10,
    clicks: [] as { t: number; x: number; y: number }[],
    typing: new Map<number, { el: Element | null; base: string; applied: number }>(),
    scrolls: new Map<number, { el: Element | null; from: number; to: number }>(),
    keys: [] as { t: number; combo: string }[],
    history: [] as Pt[],
    lastT: -1,
  });
  const elRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const handRef = useRef<SVGSVGElement>(null);
  const beamRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const sp = space?.current;
    const el = elRef.current;
    if (!sp || !el) return;
    const r = rt.current;
    const realInput = !!window.__vkRender?.realInput;

    // restart (preview loop) -> reset runtime state
    if (t < r.lastT) {
      r.moves = compiled.moves.map((m) => ({ ...m }));
      r.fired = 0;
      r.pos = null;
      r.clicks = [];
      r.typing.clear();
      r.scrolls.clear();
      r.keys = [];
      r.history = [];
      r.visible = !hidden;
    }
    r.lastT = t;

    // ---- position
    if (!r.pos) {
      const s = start ? resolvePoint(start, sp) : null;
      r.pos = s ? { x: s.x, y: s.y } : { x: (sp.offsetWidth || w) * 0.66, y: (sp.offsetHeight || h) * 0.82 };
    }
    let active: Move | undefined;
    for (const m of r.moves) if (m.start <= t) active = m;
    if (active) {
      if (!active.from) active.from = { ...r.pos };
      const target = resolvePoint(active.to, sp, active.anchor);
      const to = target ? { x: target.x, y: target.y } : active.last ?? r.pos;
      active.last = to;
      const p = Easing.cursor(clamp01((t - active.start) / Math.max(0.001, active.end - active.start)));
      r.pos = bezier(active.from, to, p, active.arc);
    }
    const pos = r.pos;
    const client = spaceToClient(sp, pos.x, pos.y);

    // ---- actions (fire in order, exactly once)
    while (r.fired < compiled.actions.length && compiled.actions[r.fired].at <= t) {
      const a = compiled.actions[r.fired++];
      const gt = offset + a.at;
      if (a.kind === "down") {
        r.down = true;
        r.clicks.push({ t: a.at, x: pos.x, y: pos.y });
        if (a.sound) emitSound("click", gt, 0.9);
        if (!realInput) synthPointer("down", client.x, client.y);
      } else if (a.kind === "up") {
        r.down = false;
        if (!realInput) synthPointer("up", client.x, client.y);
      } else if (a.kind === "press") {
        const k = parseCombo(a.combo);
        const target = document.activeElement ?? document.body;
        target.dispatchEvent(new KeyboardEvent("keydown", { ...k, bubbles: true, cancelable: true }));
        target.dispatchEvent(new KeyboardEvent("keyup", { ...k, bubbles: true, cancelable: true }));
        r.keys.push({ t: a.at, combo: a.combo });
        emitSound("key", gt, 0.8);
      } else if (a.kind === "visible") {
        r.visible = a.on;
        r.visibleSince = a.at;
      }
    }

    // ---- time-driven actions: typing and scrolling
    compiled.actions.forEach((a, i) => {
      if (a.kind === "type" && t >= a.at) {
        let st = r.typing.get(i);
        if (!st) {
          const target = a.into ? resolveElement(a.into, sp) : document.activeElement;
          const input = target?.matches?.("input,textarea,[contenteditable]") ? target : target?.querySelector?.("input,textarea,[contenteditable]") ?? target;
          st = { el: input ?? null, base: input && !a.clear ? readValue(input) : "", applied: -1 };
          r.typing.set(i, st);
        }
        const n = Math.min(a.text.length, Math.floor((t - a.at) * a.cps) + 1);
        if (st.el && n !== st.applied) {
          for (let c = Math.max(0, st.applied); c < n; c++) if (a.text[c] !== " ") emitSound("key", offset + a.at + c / a.cps, 0.35);
          setNativeValue(st.el, st.base + a.text.slice(0, n));
          st.applied = n;
        }
      }
      if (a.kind === "scroll" && t >= a.at) {
        let st = r.scrolls.get(i);
        if (!st) {
          const el = resolveElement(a.target, sp);
          const from = el?.scrollTop ?? 0;
          let to = from + (a.by ?? 0);
          if (typeof a.to === "number") to = a.to;
          else if (a.to && el) {
            const dest = resolveElement(a.to, sp);
            if (dest) to = from + (dest.getBoundingClientRect().top - el.getBoundingClientRect().top) / (sp.getBoundingClientRect().width / sp.offsetWidth) - 24 * u;
          }
          st = { el, from, to };
          r.scrolls.set(i, st);
        }
        if (st.el) st.el.scrollTop = lerp(st.from, st.to, Easing.inOut(clamp01((t - a.at) / a.dur)));
      }
    });

    if (!realInput && r.down) synthPointer("move", client.x, client.y);

    // ---- cursor shape from what is under it
    let shape: "arrow" | "hand" | "beam" = "arrow";
    const under = document.elementFromPoint(client.x, client.y);
    if (under) {
      const c = getComputedStyle(under).cursor;
      if (c === "pointer") shape = "hand";
      else if (c === "text") shape = "beam";
    }
    arrowRef.current?.style.setProperty("display", shape === "arrow" ? "block" : "none");
    handRef.current?.style.setProperty("display", shape === "hand" ? "block" : "none");
    beamRef.current?.style.setProperty("display", shape === "beam" ? "block" : "none");

    const vis = clamp01((t - r.visibleSince) / 0.2);
    const opacity = r.visible ? vis : 1 - vis;
    const press = r.down ? 0.82 : 1;
    el.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${press})`;
    el.style.opacity = String(opacity);

    if (trail) {
      r.history.unshift({ ...pos });
      r.history.length = Math.min(r.history.length, trail);
    }

    if (realInput) window.__cursorState = { x: client.x, y: client.y, down: r.down, visible: opacity > 0.01 };
  });

  const r = rt.current;
  const ripples = ripple ? r.clicks.filter((c) => t - c.t >= 0 && t - c.t < 0.6) : [];
  const keys = showKeys ? r.keys.filter((k) => t - k.t >= 0 && t - k.t < 1.1) : [];

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1000, ...style }} data-vk-cursor="">
      {r.history.slice(1).map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x - 5 * u,
            top: p.y - 5 * u,
            width: 10 * u,
            height: 10 * u,
            borderRadius: 99,
            background: color,
            opacity: 0.35 * (1 - i / trail),
          }}
        />
      ))}
      {ripples.map((c, i) => {
        const p = Easing.out(clamp01((t - c.t) / 0.55));
        const R = lerp(6, 46, p) * u;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x - R,
              top: c.y - R,
              width: R * 2,
              height: R * 2,
              borderRadius: 999,
              border: `${3 * u}px solid ${color}`,
              background: `${color}22`,
              opacity: 0.85 * (1 - p),
            }}
          />
        );
      })}
      <div ref={elRef} style={{ position: "absolute", left: 0, top: 0, width: S, height: S, transformOrigin: "0 0", willChange: "transform" }}>
        {glow && (
          <div style={{ position: "absolute", left: -S * 1.6, top: -S * 1.6, width: S * 3.2, height: S * 3.2, borderRadius: 999, background: `radial-gradient(circle, ${glow} 0%, transparent 65%)` }} />
        )}
        {/* arrow, hotspot at the tip (0,0) */}
        <svg ref={arrowRef} width={S} height={S} viewBox="0 0 32 32" style={{ position: "absolute", left: -S * 0.09, top: -S * 0.06, filter: `drop-shadow(0 ${2 * u}px ${4 * u}px rgba(0,0,0,.45))` }}>
          <path d="M5 3.5 L5 26 L11 20.5 L15 29 L19 27.2 L15.1 18.9 L23 18.9 Z" fill="#111" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        {/* pointing hand, hotspot at the fingertip */}
        <svg ref={handRef} width={S} height={S} viewBox="0 0 32 32" style={{ display: "none", position: "absolute", left: -S * 0.36, top: -S * 0.08, filter: `drop-shadow(0 ${2 * u}px ${4 * u}px rgba(0,0,0,.45))` }}>
          <path
            d="M11.5 3.5c1.4 0 2.5 1.1 2.5 2.5v7.2c.4-.4 1-.6 1.6-.6 1 0 1.8.6 2.2 1.4.4-.3 1-.5 1.5-.5 1.1 0 2 .7 2.3 1.7.3-.2.8-.3 1.2-.3 1.4 0 2.4 1.1 2.4 2.5v5.8c0 4-3 7.3-7.2 7.3h-2.6c-2.4 0-4.4-1-5.8-2.9l-4.6-6.4c-.7-1-.5-2.4.5-3.1.9-.7 2.2-.6 3 .2l1 1.1V6c0-1.4 1.1-2.5 2.5-2.5z"
            fill="#fff"
            stroke="#111"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        {/* text I-beam */}
        <svg ref={beamRef} width={S} height={S} viewBox="0 0 32 32" style={{ display: "none", position: "absolute", left: -S * 0.5, top: -S * 0.5 }}>
          <path d="M12 5h3l1 1 1-1h3M16 6v20M12 27h3l1-1 1 1h3" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M12 5h3l1 1 1-1h3M16 6v20M12 27h3l1-1 1 1h3" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      {keys.map((k, i) => (
        <Keycaps key={i} combo={k.combo} p={t - k.t} />
      ))}
    </div>
  );
}

const KEY_LABEL: Record<string, string> = { mod: "⌘", cmd: "⌘", meta: "⌘", ctrl: "Ctrl", shift: "⇧", alt: "⌥", option: "⌥", enter: "↵", Enter: "↵", backspace: "⌫", tab: "Tab", escape: "Esc" };

function Keycaps({ combo, p }: { combo: string; p: number }) {
  const { u } = useVideo();
  const inP = Easing.back(clamp01(p / 0.25));
  const outP = clamp01((p - 0.85) / 0.25);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 90 * u, display: "flex", justifyContent: "center", gap: 10 * u, opacity: (1 - outP) * clamp01(p / 0.12), transform: `translateY(${(1 - inP) * 20 * u}px) scale(${0.9 + 0.1 * inP})` }}>
      {combo.split("+").map((k, i) => (
        <span
          key={i}
          style={{
            minWidth: 64 * u,
            padding: `${12 * u}px ${18 * u}px`,
            borderRadius: 14 * u,
            background: "rgba(20,20,22,.88)",
            border: `${1.5 * u}px solid rgba(255,255,255,.18)`,
            boxShadow: `0 ${6 * u}px 0 rgba(0,0,0,.5)`,
            color: "#fff",
            font: `600 ${30 * u}px/1 ui-sans-serif, system-ui`,
            textAlign: "center",
          }}
        >
          {KEY_LABEL[k.trim()] ?? KEY_LABEL[k.trim().toLowerCase()] ?? k.trim().toUpperCase()}
        </span>
      ))}
    </div>
  );
}
