"use client";
"use no memo"; // frame-driven: per-frame runtime state lives in refs on purpose; keep the React Compiler out

import { type CSSProperties } from "react";

import { useTime, useVideo } from "./core";

export type BackdropVariant = "aurora" | "grid" | "dots" | "beams" | "mesh" | "solid" | "spotlight";

/**
 * Full-frame animated background, driven by time (deterministic).
 * Keep motion slow: backgrounds should never compete with the message.
 */
export function Backdrop({
  variant = "aurora",
  base = "#0d0c09",
  colors = ["rgba(212,178,122,.30)", "rgba(18,62,50,.85)", "rgba(176,141,87,.22)"],
  line = "rgba(243,239,230,.07)",
  grain = 0.06,
  vignette = true,
  speed = 1,
  style,
}: {
  variant?: BackdropVariant;
  base?: string;
  colors?: string[];
  line?: string;
  /** film grain opacity, 0 to disable */
  grain?: number;
  vignette?: boolean;
  speed?: number;
  style?: CSSProperties;
}) {
  const t = useTime() * speed;
  const { u, w, h } = useVideo();
  const layers: CSSProperties[] = [];

  if (variant === "aurora" || variant === "mesh") {
    const blobs = colors.map((c, i) => {
      const a = t * (0.18 + i * 0.07) + i * 2.1;
      const x = 50 + Math.cos(a) * (variant === "mesh" ? 30 : 22);
      const y = 45 + Math.sin(a * 1.3) * (variant === "mesh" ? 28 : 18);
      return `radial-gradient(${(variant === "mesh" ? 55 : 45) + i * 8}% ${(variant === "mesh" ? 60 : 50) + i * 6}% at ${x}% ${y}%, ${c}, transparent 70%)`;
    });
    layers.push({ background: blobs.join(","), filter: `blur(${40 * u}px)` });
  }
  if (variant === "grid" || variant === "spotlight") {
    const cell = 72 * u;
    const off = (t * 10 * u) % cell;
    layers.push({
      backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `${off}px ${off}px`,
      maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, #000 30%, transparent 80%)",
      WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, #000 30%, transparent 80%)",
    });
    layers.push({ background: `radial-gradient(60% 50% at 50% 0%, ${colors[0]}, transparent 70%)` });
  }
  if (variant === "dots") {
    const cell = 34 * u;
    layers.push({
      backgroundImage: `radial-gradient(${line.replace(/[\d.]+\)$/, ".22)")} ${1.6 * u}px, transparent ${1.8 * u}px)`,
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `0 ${(t * 8 * u) % cell}px`,
      maskImage: "radial-gradient(ellipse 65% 60% at 50% 50%, #000 35%, transparent 80%)",
      WebkitMaskImage: "radial-gradient(ellipse 65% 60% at 50% 50%, #000 35%, transparent 80%)",
    });
    layers.push({ background: `radial-gradient(50% 45% at 50% 50%, ${colors[0]}, transparent 75%)` });
  }
  if (variant === "beams") {
    const beams = [0, 1, 2].map((i) => {
      const x = ((t * (18 + i * 6) + i * 37) % 160) - 30;
      return `linear-gradient(105deg, transparent ${x}%, ${colors[i % colors.length]} ${x + 6}%, transparent ${x + 14}%)`;
    });
    layers.push({ background: beams.join(","), filter: `blur(${24 * u}px)` });
  }
  if (variant === "spotlight") {
    layers.push({ background: `conic-gradient(from ${200 + Math.sin(t * 0.5) * 8}deg at 50% -10%, transparent 0deg, ${colors[0]} 18deg, transparent 40deg)`, filter: `blur(${30 * u}px)` });
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: base, overflow: "hidden", ...style }}>
      {layers.map((l, i) => (
        <div key={i} style={{ position: "absolute", inset: -60 * u, ...l }} />
      ))}
      {vignette && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 75% at 50% 50%, transparent 55%, rgba(0,0,0,.55))" }} />}
      {grain > 0 && (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, opacity: grain, mixBlendMode: "overlay" }}>
          <filter id="vk-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#vk-grain)" />
        </svg>
      )}
    </div>
  );
}
