"use client";
"use no memo"; // frame-driven: per-frame runtime state lives in refs on purpose; keep the React Compiler out

import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

import { Easing, clamp01, lerp, seeded, spring, useTime, useVideo } from "./core";

export type KineticMode = "rise" | "blur" | "mask" | "pop" | "typewriter" | "scramble" | "slide";

/**
 * Animated headline. Splits by word (or char) and reveals each unit on the timeline.
 *   <KineticText text="Describe your shop." at={0.2} mode="blur" />
 *   <KineticText text="We build the website." at={0.9} accent={["website."]} accentColor="#d4b27a" />
 */
export function KineticText({
  text,
  at = 0,
  mode = "rise",
  by,
  stagger,
  dur = 0.6,
  exitAt,
  accent = [],
  accentColor = "#d4b27a",
  marker,
  cps = 26,
  as: Tag = "div",
  style,
  className,
}: {
  text: string;
  at?: number;
  mode?: KineticMode;
  by?: "word" | "char";
  stagger?: number;
  dur?: number;
  /** when to animate out (local seconds) */
  exitAt?: number;
  /** words (exact tokens) to colour */
  accent?: string[];
  accentColor?: string;
  /** draw a highlighter stroke behind accent words, colour */
  marker?: string;
  cps?: number;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
}) {
  const t = useTime();
  const { u, fps } = useVideo();
  const exitP = exitAt !== undefined ? Easing.in(clamp01((t - exitAt) / 0.35)) : 0;
  const wrapStyle: CSSProperties = { ...style, opacity: (style?.opacity as number | undefined ?? 1) * (1 - exitP), transform: exitP ? `translateY(${-exitP * 30 * u}px)` : style?.transform, filter: exitP ? `blur(${exitP * 8 * u}px)` : undefined };

  if (mode === "typewriter") {
    const n = Math.max(0, Math.min(text.length, Math.floor((t - at) * cps)));
    const caretOn = t < at || n < text.length || Math.floor((t - at) * 2) % 2 === 0;
    return (
      <Tag className={className} style={wrapStyle}>
        {text.slice(0, n)}
        <span style={{ display: "inline-block", width: "0.06em", height: "0.95em", marginLeft: "0.04em", verticalAlign: "-0.1em", background: "currentColor", opacity: caretOn ? 1 : 0 }} />
      </Tag>
    );
  }

  const unit = by ?? (mode === "scramble" ? "char" : "word");
  const tokens = unit === "word" ? text.split(/(\s+)/) : [...text];
  const st = stagger ?? (unit === "word" ? 0.07 : 0.025);
  let idx = 0;
  const frame = Math.floor(t * fps);

  return (
    <Tag className={className} style={wrapStyle}>
      {tokens.map((tok, i) => {
        if (/^\s+$/.test(tok)) return <Fragment key={i}>{tok}</Fragment>;
        const k = idx++;
        const start = at + k * st;
        const p = Easing.out(clamp01((t - start) / dur));
        const isAccent = accent.includes(tok);
        const color = isAccent ? accentColor : undefined;
        let s: CSSProperties = { display: "inline-block", whiteSpace: "pre", color };
        let content: ReactNode = tok;
        switch (mode) {
          case "rise":
            s = { ...s, opacity: p, transform: `translateY(${(1 - p) * 0.45}em)` };
            break;
          case "blur":
            s = { ...s, opacity: p, transform: `translateY(${(1 - p) * 0.3}em)`, filter: p < 1 ? `blur(${(1 - p) * 0.25}em)` : undefined };
            break;
          case "slide":
            s = { ...s, opacity: p, transform: `translateX(${(1 - p) * 0.6}em)` };
            break;
          case "pop": {
            const sp = spring(t, start, { stiffness: 380, damping: 18 });
            s = { ...s, opacity: clamp01(sp * 2), transform: `scale(${lerp(0.4, 1, sp)})` };
            break;
          }
          case "mask":
            return (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
                <span style={{ ...s, transform: `translateY(${(1 - p) * 110}%)` }}>{tok}</span>
              </span>
            );
          case "scramble": {
            const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=?";
            const rnd = seeded(k * 131 + frame);
            const revealed = t >= start + dur * 0.6;
            content = revealed ? tok : t < start ? " " : GLYPHS[Math.floor(rnd() * GLYPHS.length)];
            s = { ...s, opacity: t < start ? 0 : 1, color: revealed ? color : accentColor };
            break;
          }
        }
        if (marker && isAccent) {
          const mp = Easing.inOut(clamp01((t - start - dur * 0.5) / 0.5));
          return (
            <span key={i} style={{ position: "relative", display: "inline-block" }}>
              <span style={{ position: "absolute", left: "-0.06em", right: "-0.06em", bottom: "0.06em", height: "0.42em", background: marker, transformOrigin: "0 50%", transform: `scaleX(${mp})`, borderRadius: "0.08em", zIndex: 0 }} />
              <span style={{ ...s, position: "relative" }}>{content}</span>
            </span>
          );
        }
        return (
          <span key={i} style={s}>
            {content}
          </span>
        );
      })}
    </Tag>
  );
}

/** Rotating word that keeps the width of the longest word. */
export function WordSwap({ words, at = 0, every = 0.9, color, style }: { words: string[]; at?: number; every?: number; color?: string; style?: CSSProperties }) {
  const t = useTime();
  const local = Math.max(0, t - at);
  const i = Math.min(words.length - 1, Math.floor(local / every));
  const p = Easing.out(clamp01((local - i * every) / 0.35));
  return (
    <span style={{ display: "inline-grid", verticalAlign: "bottom", overflow: "hidden", paddingBottom: "0.1em", marginBottom: "-0.1em", color, ...style }}>
      {words.map((wd, k) => {
        const shown = k === i;
        const leaving = k === i - 1 && p < 1;
        const y = shown ? (i === 0 ? 0 : (1 - p) * 100) : leaving ? -p * 100 : 100;
        return (
          <span key={k} style={{ gridArea: "1 / 1", transform: `translateY(${y}%)`, opacity: shown || leaving ? 1 : 0, whiteSpace: "nowrap" }}>
            {wd}
          </span>
        );
      })}
    </span>
  );
}

/** Number ticker. */
export function Counter({ to, from = 0, at = 0, dur = 1.3, decimals = 0, prefix = "", suffix = "", locale = "en-US", style }: { to: number; from?: number; at?: number; dur?: number; decimals?: number; prefix?: string; suffix?: string; locale?: string; style?: CSSProperties }) {
  const t = useTime();
  const p = Easing.out(clamp01((t - at) / dur));
  const v = lerp(from, to, p);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Text that types itself out, with a blinking caret. */
export function Typewriter(props: { text: string; at?: number; cps?: number; style?: CSSProperties; className?: string; as?: ElementType }) {
  return <KineticText {...props} mode="typewriter" />;
}

/**
 * Social-style captions. Lines appear at their time, the current word is highlighted.
 *   <Captions lines={[{ at: 0.3, to: 2, text: "Describe your shop" }]} />
 */
export function Captions({
  lines,
  position = "bottom",
  color = "#fff",
  highlight = "#d4b27a",
  background = "rgba(0,0,0,.55)",
  size,
}: {
  lines: { at: number; to: number; text: string }[];
  position?: "bottom" | "center" | "top";
  color?: string;
  highlight?: string;
  background?: string;
  size?: number;
}) {
  const t = useTime();
  const { u, portrait } = useVideo();
  const line = lines.find((l) => t >= l.at && t < l.to);
  if (!line) return null;
  const words = line.text.split(" ");
  const per = (line.to - line.at) / words.length;
  const pop = spring(t, line.at, { stiffness: 420, damping: 22 });
  const fs = size ?? (portrait ? 58 : 46) * u;
  const pos: CSSProperties = position === "bottom" ? { bottom: (portrait ? 360 : 90) * u } : position === "top" ? { top: (portrait ? 260 : 80) * u } : { top: "50%", transform: "translateY(-50%)" };
  return (
    <div style={{ position: "absolute", left: 60 * u, right: 60 * u, display: "flex", justifyContent: "center", zIndex: 980, ...pos }}>
      <div style={{ background, padding: `${10 * u}px ${22 * u}px`, borderRadius: 16 * u, font: `800 ${fs}px/1.2 var(--vk-display, system-ui)`, color, textAlign: "center", transform: `scale(${lerp(0.85, 1, pop)})` }}>
        {words.map((wd, i) => (
          <span key={i} style={{ color: t >= line.at + i * per && t < line.at + (i + 1) * per ? highlight : color }}>
            {wd}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Endless horizontal ticker driven by time (deterministic, no CSS loop). */
export function Marquee({ children, speed = 120, gap, reverse = false, fade = true, style }: { children: ReactNode; speed?: number; gap?: number; reverse?: boolean; fade?: boolean; style?: CSSProperties }) {
  const t = useTime();
  const { u } = useVideo();
  const g = gap ?? 48 * u;
  const first = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(0);
  useLayoutEffect(() => {
    if (first.current) setSpan(first.current.offsetWidth + g);
  }, [g]);
  const travel = span ? (t * speed * u) % span : 0;
  const shift = reverse ? travel - span : -travel;
  const mask = fade ? "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" : undefined;
  return (
    <div style={{ overflow: "hidden", maskImage: mask, WebkitMaskImage: mask, ...style }}>
      <div style={{ display: "flex", gap: g, width: "max-content", transform: `translateX(${shift}px)` }}>
        {[0, 1, 2, 3].map((k) => (
          <div key={k} ref={k === 0 ? first : undefined} style={{ display: "flex", gap: g, flex: "none" }}>
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
