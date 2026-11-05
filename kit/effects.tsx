"use client";
"use no memo"; // frame-driven: per-frame runtime state lives in refs on purpose; keep the React Compiler out
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect */

/**
 * Attention effects that track a target element every frame. Place them in the same space
 * as the target (inside <Camera> when there is one).
 */

import { useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Easing, SpaceCtx, clamp01, lerp, rectInSpace, resolveElement, resolvePoint, seeded, spring, useTime, useVideo, type Target } from "./core";

type Rect = { x: number; y: number; w: number; h: number };

/** Re-measures `target` inside the current space after every frame. */
export function useTargetRect(target: Target | undefined, active = true): Rect | null {
  const space = useContext(SpaceCtx);
  const [rect, setRect] = useState<Rect | null>(null);
  const t = useTime();
  useLayoutEffect(() => {
    if (!active || !target || !space?.current) return;
    const el = resolveElement(target, space.current);
    if (!el) return;
    const r = rectInSpace(el, space.current);
    setRect((prev) => (prev && Math.abs(prev.x - r.x) < 0.25 && Math.abs(prev.y - r.y) < 0.25 && Math.abs(prev.w - r.w) < 0.25 && Math.abs(prev.h - r.h) < 0.25 ? prev : r));
  }, [t, target, active, space]);
  return rect;
}

function windowOpacity(t: number, from: number, to: number, fade: number) {
  return clamp01((t - from) / fade) * clamp01((to - t) / fade);
}

/** Dim everything except the target. */
export function Spotlight({ target, from, to, padding, radius, dim = 0.62, fade = 0.35 }: { target: Target; from: number; to: number; padding?: number; radius?: number; dim?: number; fade?: number }) {
  const t = useTime();
  const { u } = useVideo();
  const active = t >= from - 0.05 && t <= to + 0.05;
  const r = useTargetRect(target, active);
  if (!active || !r) return null;
  const o = windowOpacity(t, from, to, fade);
  const pad = padding ?? 14 * u;
  const grow = lerp(1.25, 1, Easing.out(clamp01((t - from) / 0.5)));
  const w = (r.w + pad * 2) * grow, h = (r.h + pad * 2) * grow;
  return (
    <div
      style={{
        position: "absolute",
        left: r.x + r.w / 2 - w / 2,
        top: r.y + r.h / 2 - h / 2,
        width: w,
        height: h,
        borderRadius: radius ?? 18 * u,
        boxShadow: `0 0 0 99999px rgba(0,0,0,${dim * o})`,
        pointerEvents: "none",
        zIndex: 900,
      }}
    />
  );
}

/** Glowing ring around the target, optional pulse. */
export function Highlight({ target, from, to, color = "#d4b27a", padding, radius, pulse = true, fade = 0.3 }: { target: Target; from: number; to: number; color?: string; padding?: number; radius?: number; pulse?: boolean; fade?: number }) {
  const t = useTime();
  const { u } = useVideo();
  const active = t >= from - 0.05 && t <= to + 0.05;
  const r = useTargetRect(target, active);
  if (!active || !r) return null;
  const o = windowOpacity(t, from, to, fade);
  const pad = padding ?? 10 * u;
  const pulseK = pulse ? 0.5 + 0.5 * Math.sin((t - from) * Math.PI * 2 * 1.1) : 1;
  const s = spring(t, from, { stiffness: 260, damping: 18 });
  return (
    <div
      style={{
        position: "absolute",
        left: r.x - pad,
        top: r.y - pad,
        width: r.w + pad * 2,
        height: r.h + pad * 2,
        borderRadius: radius ?? 16 * u,
        border: `${3 * u}px solid ${color}`,
        boxShadow: `0 0 ${(18 + 18 * pulseK) * u}px ${color}88, inset 0 0 ${12 * u}px ${color}33`,
        opacity: o,
        transform: `scale(${lerp(1.08, 1, s)})`,
        pointerEvents: "none",
        zIndex: 901,
      }}
    />
  );
}

/** Label bubble pointing at the target. */
export function Callout({
  target,
  at,
  to,
  side = "top",
  gap,
  children,
  background = "#f3efe6",
  color = "#16140f",
  style,
}: {
  target: Target;
  at: number;
  to: number;
  side?: "top" | "bottom" | "left" | "right";
  gap?: number;
  children: ReactNode;
  background?: string;
  color?: string;
  style?: CSSProperties;
}) {
  const t = useTime();
  const { u } = useVideo();
  const active = t >= at - 0.05 && t <= to + 0.05;
  const r = useTargetRect(target, active);
  if (!active || !r) return null;
  const s = spring(t, at, { stiffness: 320, damping: 20 });
  const o = windowOpacity(t, at, to, 0.2);
  const g = gap ?? 22 * u;
  const pos: CSSProperties =
    side === "top"
      ? { left: r.x + r.w / 2, top: r.y - g, transform: `translate(-50%, -100%) scale(${0.7 + 0.3 * s})`, transformOrigin: "50% 100%" }
      : side === "bottom"
        ? { left: r.x + r.w / 2, top: r.y + r.h + g, transform: `translate(-50%, 0) scale(${0.7 + 0.3 * s})`, transformOrigin: "50% 0" }
        : side === "left"
          ? { left: r.x - g, top: r.y + r.h / 2, transform: `translate(-100%, -50%) scale(${0.7 + 0.3 * s})`, transformOrigin: "100% 50%" }
          : { left: r.x + r.w + g, top: r.y + r.h / 2, transform: `translate(0, -50%) scale(${0.7 + 0.3 * s})`, transformOrigin: "0 50%" };
  const tail = 12 * u;
  const tailPos: CSSProperties =
    side === "top"
      ? { left: "50%", bottom: -tail / 2, marginLeft: -tail / 2 }
      : side === "bottom"
        ? { left: "50%", top: -tail / 2, marginLeft: -tail / 2 }
        : side === "left"
          ? { top: "50%", right: -tail / 2, marginTop: -tail / 2 }
          : { top: "50%", left: -tail / 2, marginTop: -tail / 2 };
  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        opacity: o,
        background,
        color,
        padding: `${14 * u}px ${22 * u}px`,
        borderRadius: 14 * u,
        font: `600 ${26 * u}px/1.25 var(--vk-body, system-ui)`,
        whiteSpace: "nowrap",
        boxShadow: `0 ${14 * u}px ${40 * u}px rgba(0,0,0,.45)`,
        zIndex: 950,
        pointerEvents: "none",
        ...style,
      }}
    >
      <span style={{ position: "absolute", width: tail, height: tail, background, transform: "rotate(45deg)", ...tailPos }} />
      <span style={{ position: "relative" }}>{children}</span>
    </div>
  );
}

/** Deterministic confetti burst from a target or point. */
export function Confetti({ at, origin, count = 70, colors = ["#d4b27a", "#f3efe6", "#5bd69a", "#b08d57", "#fff1d2"], spread = 1, seed = 7, dur = 2.2 }: { at: number; origin: Target; count?: number; colors?: string[]; spread?: number; seed?: number; dur?: number }) {
  const t = useTime();
  const { u } = useVideo();
  const space = useContext(SpaceCtx);
  const o = useRef<{ x: number; y: number } | null>(null);
  const parts = useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: count }, () => ({
      a: -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.1 * spread,
      v: (700 + rnd() * 900) * u,
      spin: (rnd() - 0.5) * 900,
      w: (8 + rnd() * 10) * u,
      h: (12 + rnd() * 16) * u,
      c: colors[Math.floor(rnd() * colors.length)],
      drag: 0.6 + rnd() * 0.8,
    }));
  }, [count, colors, spread, seed, u]);
  const local = t - at;
  useLayoutEffect(() => {
    if (local >= 0 && !o.current && space?.current) {
      const p = resolvePoint(origin, space.current);
      if (p) o.current = { x: p.x, y: p.y };
    }
  });
  if (local < 0 || local > dur || !o.current) return null;
  const g = 1800 * u;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 960 }}>
      {parts.map((p, i) => {
        const tt = local;
        const k = Math.exp(-p.drag * tt);
        const x = o.current!.x + Math.cos(p.a) * p.v * (1 - k) / p.drag;
        const y = o.current!.y + Math.sin(p.a) * p.v * (1 - k) / p.drag + 0.5 * g * tt * tt * 0.35;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: p.w,
              height: p.h,
              background: p.c,
              borderRadius: 2 * u,
              opacity: 1 - clamp01((tt - dur * 0.7) / (dur * 0.3)),
              transform: `rotate(${p.spin * tt}deg) rotateX(${p.spin * tt * 0.7}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Notification card that slides in from a corner. */
export function Toast({
  at,
  to,
  title,
  body,
  icon,
  position = "top-right",
  accent = "#5bd69a",
  width,
}: {
  at: number;
  to: number;
  title: ReactNode;
  body?: ReactNode;
  icon?: ReactNode;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top" | "bottom";
  accent?: string;
  width?: number;
}) {
  const t = useTime();
  const { u } = useVideo();
  if (t < at || t > to + 0.4) return null;
  const s = spring(t, at, { stiffness: 260, damping: 24 });
  const out = Easing.in(clamp01((t - to) / 0.35));
  const fromTop = position.startsWith("top");
  const m = 40 * u;
  const pos: CSSProperties = {
    ...(fromTop ? { top: m } : { bottom: m }),
    ...(position.endsWith("right") ? { right: m } : position.endsWith("left") ? { left: m } : { left: "50%", marginLeft: -(width ?? 560 * u) / 2 }),
  };
  const dy = (1 - s) * (fromTop ? -1 : 1) * 120 * u + out * (fromTop ? -1 : 1) * 60 * u;
  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        width: width ?? 560 * u,
        display: "flex",
        gap: 18 * u,
        alignItems: "center",
        padding: `${20 * u}px ${24 * u}px`,
        borderRadius: 22 * u,
        background: "rgba(24,22,17,.94)",
        border: `${1.5 * u}px solid rgba(243,239,230,.14)`,
        boxShadow: `0 ${24 * u}px ${60 * u}px rgba(0,0,0,.55)`,
        color: "#f3efe6",
        transform: `translateY(${dy}px)`,
        opacity: clamp01(s * 1.4) * (1 - out),
        zIndex: 970,
      }}
    >
      {icon && (
        <div style={{ flex: "none", width: 60 * u, height: 60 * u, borderRadius: 16 * u, background: `${accent}22`, color: accent, display: "grid", placeItems: "center" }}>{icon}</div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ font: `700 ${26 * u}px/1.2 var(--vk-body, system-ui)` }}>{title}</div>
        {body && <div style={{ font: `500 ${22 * u}px/1.3 var(--vk-body, system-ui)`, color: "#a39e92", marginTop: 4 * u }}>{body}</div>}
      </div>
    </div>
  );
}

/** Thin progress line across the top: keeps short-form viewers watching. */
export function ProgressLine({ color = "#d4b27a", height, position = "top" }: { color?: string; height?: number; position?: "top" | "bottom" }) {
  const { duration, u } = useVideo();
  const t = useTime();
  return (
    <div style={{ position: "absolute", left: 0, [position]: 0, height: height ?? 6 * u, width: `${clamp01(t / duration) * 100}%`, background: color, zIndex: 990 } as CSSProperties} />
  );
}
