"use client";
"use no memo"; // frame-driven: per-frame runtime state lives in refs on purpose; keep the React Compiler out

import { type CSSProperties, type ReactNode } from "react";

import { Easing, clamp01, interpolate, lerp, spring, useTime, useVideo } from "./core";

/** Browser window with traffic lights and a URL pill. Optionally types the URL. */
export function BrowserFrame({
  url,
  width,
  height,
  children,
  theme = "dark",
  typeUrlAt,
  radius,
  accent = "#5bd69a",
  style,
  bodyStyle,
}: {
  url: string;
  width: number;
  height: number;
  children: ReactNode;
  theme?: "dark" | "light";
  /** local seconds at which the URL starts typing (otherwise shown at once) */
  typeUrlAt?: number;
  radius?: number;
  accent?: string;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}) {
  const t = useTime();
  const { u } = useVideo();
  const bar = 58 * u;
  const dark = theme === "dark";
  const shown = typeUrlAt === undefined ? url : url.slice(0, Math.max(0, Math.floor((t - typeUrlAt) * 30)));
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius ?? 20 * u,
        overflow: "hidden",
        background: dark ? "#16140f" : "#fff",
        border: `${1.5 * u}px solid ${dark ? "rgba(243,239,230,.12)" : "rgba(0,0,0,.08)"}`,
        boxShadow: `0 ${40 * u}px ${120 * u}px rgba(0,0,0,.55), 0 0 0 ${1 * u}px rgba(0,0,0,.4)`,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div style={{ height: bar, flex: "none", display: "flex", alignItems: "center", gap: 16 * u, padding: `0 ${20 * u}px`, background: dark ? "#1e1c16" : "#f3f3f1", borderBottom: `${1 * u}px solid ${dark ? "rgba(243,239,230,.08)" : "rgba(0,0,0,.06)"}` }}>
        <div style={{ display: "flex", gap: 9 * u }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 14 * u, height: 14 * u, borderRadius: 99, background: c }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 720 * u,
            margin: "0 auto",
            height: 36 * u,
            borderRadius: 10 * u,
            background: dark ? "rgba(0,0,0,.32)" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10 * u,
            color: dark ? "#cfc9bb" : "#3f3f46",
            font: `500 ${19 * u}px/1 var(--vk-mono, ui-monospace)`,
          }}
        >
          <svg width={16 * u} height={16 * u} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span>{shown}</span>
        </div>
        <div style={{ width: 60 * u }} />
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden", ...bodyStyle }}>{children}</div>
    </div>
  );
}

/** Generic modern phone (no brand). */
export function PhoneFrame({ width, children, style, screenStyle }: { width: number; children: ReactNode; style?: CSSProperties; screenStyle?: CSSProperties }) {
  const { u } = useVideo();
  const height = width * 2.05;
  const bezel = width * 0.035;
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: width * 0.16,
        background: "linear-gradient(145deg,#2b2a27,#121110)",
        padding: bezel,
        boxShadow: `0 ${40 * u}px ${110 * u}px rgba(0,0,0,.6), inset 0 0 0 ${2 * u}px rgba(255,255,255,.08)`,
        ...style,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: width * 0.13, overflow: "hidden", background: "#000", ...screenStyle }}>
        {children}
        <div style={{ position: "absolute", top: width * 0.03, left: "50%", width: width * 0.3, height: width * 0.085, marginLeft: -width * 0.15, borderRadius: 99, background: "#000", zIndex: 50 }} />
      </div>
    </div>
  );
}

/**
 * 3D tilt that settles flat (or any rotation). Pure CSS perspective; looks great on frames.
 *   <Float3D from={{ rx: 22, ry: -18, z: -200 }} at={0} dur={1.4}>…</Float3D>
 */
export function Float3D({
  children,
  from = { rx: 20, ry: -16, rz: 0, z: -160 },
  to = { rx: 0, ry: 0, rz: 0, z: 0 },
  at = 0,
  dur = 1.3,
  bob = 0,
  perspective = 2400,
  style,
}: {
  children: ReactNode;
  from?: { rx?: number; ry?: number; rz?: number; z?: number };
  to?: { rx?: number; ry?: number; rz?: number; z?: number };
  at?: number;
  dur?: number;
  /** idle floating amplitude in degrees after settling */
  bob?: number;
  perspective?: number;
  style?: CSSProperties;
}) {
  const t = useTime();
  const { u } = useVideo();
  const p = Easing.out(clamp01((t - at) / dur));
  const g = (k: "rx" | "ry" | "rz" | "z") => lerp(from[k] ?? 0, to[k] ?? 0, p);
  const b = bob * Math.sin(t * 1.1);
  return (
    <div style={{ perspective: perspective * u, ...style }}>
      <div
        style={{
          transformStyle: "preserve-3d",
          transform: `translateZ(${g("z") * u}px) rotateX(${g("rx") + b * 0.6}deg) rotateY(${g("ry") + b}deg) rotateZ(${g("rz")}deg)`,
          opacity: clamp01((t - at) / 0.25),
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Spring pop-in for any block. */
export function PopIn({ at = 0, children, from = 0.85, y = 30, style }: { at?: number; children: ReactNode; from?: number; y?: number; style?: CSSProperties }) {
  const t = useTime();
  const { u } = useVideo();
  const s = spring(t, at, { stiffness: 260, damping: 22 });
  return <div style={{ opacity: clamp01(s * 1.6), transform: `translateY(${(1 - s) * y * u}px) scale(${lerp(from, 1, s)})`, ...style }}>{children}</div>;
}

/** Fade + rise for any block. */
export function Reveal({ at = 0, dur = 0.6, children, y = 40, blur = 0, style }: { at?: number; dur?: number; children: ReactNode; y?: number; blur?: number; style?: CSSProperties }) {
  const t = useTime();
  const { u } = useVideo();
  const p = Easing.out(clamp01((t - at) / dur));
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y * u}px)`, filter: blur && p < 1 ? `blur(${(1 - p) * blur * u}px)` : undefined, ...style }}>{children}</div>;
}

/**
 * Tall screenshot scrolling inside a viewport (site tours).
 * stops: [{ at, y }] where y is the image pixel row at the top of the viewport.
 */
export function ScrollShot({ src, width, imageWidth, stops, style }: { src: string; width: number; imageWidth: number; stops: { at: number; y: number }[]; style?: CSSProperties }) {
  const t = useTime();
  const k = width / imageWidth;
  const times: number[] = [];
  const ys: number[] = [];
  stops.forEach((s, i) => {
    if (i > 0) {
      times.push(s.at - Math.min(0.9, (s.at - stops[i - 1].at) * 0.6));
      ys.push(stops[i - 1].y);
    }
    times.push(s.at);
    ys.push(s.y);
  });
  const y = interpolate(t, times, ys, { easing: Easing.inOut });
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ position: "absolute", left: 0, top: 0, width, transform: `translateY(${-y * k}px)`, ...style }} />;
}
