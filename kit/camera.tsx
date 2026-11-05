"use client";
"use no memo"; // frame-driven: per-frame runtime state lives in refs on purpose; keep the React Compiler out
/* eslint-disable react-hooks/refs, react-hooks/exhaustive-deps */

/**
 * <Camera keys={[...]}> : Screen-Studio style zoom/pan plus 3D tilt over a scene.
 *
 * Each key starts a move at `at` lasting `dur` seconds towards a new state:
 *   { at: 2, dur: 0.8, zoom: 1.8, focus: "#build-btn" }   zoom in on an element
 *   { at: 4, zoom: 1 }                                       back out (focus defaults to centre)
 *   { at: 0, rotateX: 18, rotateY: -14 }, { at: 0.2, dur: 1.2, rotateX: 0, rotateY: 0 }   3D settle
 *
 * Children are laid out in an untransformed box the size of the camera; put <Cursor>,
 * <Spotlight>, <Callout> inside so they move with the scene.
 */

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Easing, SpaceCtx, clamp01, lerp, rectInSpace, resolveElement, useTime, useVideo, type EaseFn, type Target } from "./core";
import type { CursorStep } from "./cursor";

export type CameraKey = {
  at: number;
  dur?: number;
  zoom?: number;
  /** element or point (camera px) to centre on */
  focus?: Target;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  /** extra pan in camera px */
  x?: number;
  y?: number;
  ease?: EaseFn;
};

type CamState = { zoom: number; fx: number; fy: number; rx: number; ry: number; rz: number; px: number; py: number };

export type CameraProps = {
  keys?: CameraKey[];
  /** slow continuous push-in over the whole sequence, e.g. 0.04 */
  drift?: number;
  perspective?: number;
  /** keep the zoomed scene covering the frame (no empty edges) */
  clampEdges?: boolean;
  width?: number;
  height?: number;
  style?: CSSProperties;
  children: ReactNode;
};

export function Camera({ keys = [], drift = 0, perspective, clampEdges = true, width, height, style, children }: CameraProps) {
  const t = useTime();
  const { w: W, h: H, duration } = useVideo();
  const w = width ?? W;
  const h = height ?? H;
  const inner = useRef<HTMLDivElement>(null);
  const focusCache = useRef(new Map<number, { x: number; y: number }>());
  const [, force] = useState(0);

  const sorted = [...keys].sort((a, b) => a.at - b.at);
  const base: CamState = { zoom: 1, fx: w / 2, fy: h / 2, rx: 0, ry: 0, rz: 0, px: 0, py: 0 };

  const targetOf = (k: CameraKey, i: number, prev: CamState): CamState => {
    let fx = prev.fx, fy = prev.fy;
    if (k.focus !== undefined) {
      const cached = focusCache.current.get(i);
      if (cached) ({ x: fx, y: fy } = cached);
      else if (Array.isArray(k.focus)) [fx, fy] = k.focus;
      else if (typeof k.focus === "object" && "x" in k.focus && !(k.focus instanceof Element)) ({ x: fx, y: fy } = k.focus);
      else if (inner.current) {
        const el = resolveElement(k.focus, inner.current);
        if (el) {
          const r = rectInSpace(el, inner.current);
          fx = r.cx;
          fy = r.cy;
          // measure once when the move begins so the target is not chased while zooming
          if (t >= k.at) focusCache.current.set(i, { x: fx, y: fy });
        }
      }
    } else if (k.zoom !== undefined && k.zoom <= 1.0001) {
      fx = w / 2;
      fy = h / 2;
    }
    return {
      zoom: k.zoom ?? prev.zoom,
      fx,
      fy,
      rx: k.rotateX ?? prev.rx,
      ry: k.rotateY ?? prev.ry,
      rz: k.rotateZ ?? prev.rz,
      px: k.x ?? prev.px,
      py: k.y ?? prev.py,
    };
  };

  // state after keys[0..n] evaluated at time `time`
  const stateAt = (time: number, n: number): CamState => {
    if (n < 0) return base;
    const k = sorted[n];
    const before = stateAt(k.at, n - 1);
    const target = targetOf(k, n, before);
    const dur = k.dur ?? 0.8;
    const p = dur <= 0 ? (time >= k.at ? 1 : 0) : (k.ease ?? Easing.camera)(clamp01((time - k.at) / dur));
    const mix = (key: keyof CamState) => lerp(before[key], target[key], p);
    return { zoom: mix("zoom"), fx: mix("fx"), fy: mix("fy"), rx: mix("rx"), ry: mix("ry"), rz: mix("rz"), px: mix("px"), py: mix("py") };
  };

  let n = -1;
  sorted.forEach((k, i) => {
    if (k.at <= t) n = i;
  });
  const s = stateAt(t, n);
  const zoom = s.zoom * (1 + drift * clamp01(t / duration));

  let tx = w / 2 - s.fx * zoom + s.px;
  let ty = h / 2 - s.fy * zoom + s.py;
  if (clampEdges && zoom >= 1) {
    tx = Math.min(0, Math.max(w - w * zoom, tx));
    ty = Math.min(0, Math.max(h - h * zoom, ty));
  } else if (clampEdges && zoom < 1) {
    tx = (w - w * zoom) / 2;
    ty = (h - h * zoom) / 2;
  }

  // first frame of a selector focus can not be measured before mount; re-render once
  useLayoutEffect(() => {
    if (sorted.some((k, i) => typeof k.focus === "string" && k.at <= t && !focusCache.current.has(i))) force((x) => x + 1);
  });

  const rotating = s.rx || s.ry || s.rz;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", perspective: rotating ? perspective ?? 2200 : undefined, ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: rotating ? `rotateX(${s.rx}deg) rotateY(${s.ry}deg) rotateZ(${s.rz}deg)` : undefined,
        }}
      >
        <div
          ref={inner}
          data-vk-space="camera"
          style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${zoom})` }}
        >
          <SpaceCtx.Provider value={inner}>{children}</SpaceCtx.Provider>
        </div>
      </div>
    </div>
  );
}

/**
 * Auto zoom keys from a cursor script: zoom in shortly before each click and out after.
 *   <Camera keys={zoomOnClicks(script, { zoom: 1.7 })}>
 */
export function zoomOnClicks(
  script: CursorStep[],
  { zoom = 1.6, lead = 0.7, hold = 0.9, dur = 0.7 }: { zoom?: number; lead?: number; hold?: number; dur?: number } = {},
): CameraKey[] {
  const keys: CameraKey[] = [];
  const clicks = script.filter((s) => ("click" in s && s.click !== true) || ("type" in s && s.into)) as (CursorStep & { at: number })[];
  clicks.forEach((c, i) => {
    const target = "click" in c ? (c.click as Target) : (c as { into: Target }).into;
    keys.push({ at: c.at - lead, dur, zoom, focus: target });
    const next = clicks[i + 1];
    const outAt = c.at + hold + ("type" in c ? (c as { type: string; cps?: number }).type.length / ((c as { cps?: number }).cps ?? 22) : 0);
    if (!next || next.at - lead > outAt + dur) keys.push({ at: outAt, dur, zoom: 1 });
  });
  return keys;
}
