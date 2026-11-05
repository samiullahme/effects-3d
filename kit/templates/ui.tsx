"use client";

/**
 * Brand-styled UI pieces shared by the templates. They are real interactive components:
 * the scripted cursor clicks them and their onClick handlers drive the story, exactly as a
 * real product would. Swap them for your own app components or library components freely.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Loader2, Lock, Send, Sparkles } from "lucide-react";

import { brand } from "../brand";
import { Easing, clamp01, lerp, spring, useTime, useVideo } from "../core";

const C = brand.colors;
const F = brand.fonts;

export function Logo({ size = 44, word = true, color = C.fg }: { size?: number; word?: boolean; color?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32, color }}>
      <span style={{ width: size, height: size, borderRadius: size * 0.28, background: C.accent, color: C.accentInk, display: "grid", placeItems: "center", boxShadow: `0 0 ${size * 0.6}px ${C.accentGlow}` }}>
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          {brand.logoPaths.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </span>
      {word && <span style={{ font: `700 ${size * 0.72}px/1 ${F.display}`, letterSpacing: "-0.02em" }}>{brand.name}</span>}
    </div>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const { u } = useVideo();
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12 * u, font: `600 ${22 * u}px/1 ${F.mono}`, letterSpacing: "0.16em", textTransform: "uppercase", color: C.accent, ...style }}>
      <span style={{ width: 10 * u, height: 10 * u, borderRadius: 99, background: C.accent, boxShadow: `0 0 ${12 * u}px ${C.accentGlow}` }} />
      {children}
    </div>
  );
}

export function headline(u: number, size = 92): CSSProperties {
  return { font: `700 ${size * u}px/1.02 ${F.display}`, letterSpacing: "-0.035em", color: C.fg, margin: 0 };
}

export function Button({ id, children, onClick, size = 1, ghost = false, shimmerAt, style }: { id?: string; children: ReactNode; onClick?: () => void; size?: number; ghost?: boolean; shimmerAt?: number; style?: CSSProperties }) {
  const { u } = useVideo();
  const t = useTime();
  const sh = shimmerAt !== undefined ? clamp01((t - shimmerAt) / 0.9) : 0;
  return (
    <button
      id={id}
      className="vk-btn"
      onClick={onClick}
      style={{
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        border: ghost ? `${1.5 * u}px solid ${C.line2}` : 0,
        background: ghost ? "transparent" : `linear-gradient(180deg, #e2c48f, ${C.accent})`,
        color: ghost ? C.fg : C.accentInk,
        font: `700 ${24 * size * u}px/1 ${F.body}`,
        padding: `${20 * size * u}px ${34 * size * u}px`,
        borderRadius: 999,
        boxShadow: ghost ? "none" : `0 ${10 * u}px ${30 * u}px rgba(212,178,122,.28), inset 0 ${1 * u}px 0 rgba(255,255,255,.45)`,
        display: "inline-flex",
        alignItems: "center",
        gap: 12 * u,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {sh > 0 && sh < 1 && (
        <span style={{ position: "absolute", top: 0, bottom: 0, width: "40%", left: `${lerp(-50, 120, Easing.inOut(sh))}%`, background: "linear-gradient(100deg, transparent, rgba(255,255,255,.65), transparent)", transform: "skewX(-20deg)" }} />
      )}
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 12 * u }}>{children}</span>
    </button>
  );
}

/* --------------------------------------------------------------- composer */

export function Composer({ width, onBuild, chipsActive = 0 }: { width: number; onBuild?: () => void; chipsActive?: number }) {
  const { u } = useVideo();
  return (
    <div id="composer" style={{ width, padding: 28 * u, borderRadius: 28 * u, background: "rgba(26,24,18,.82)", border: `${1.5 * u}px solid ${C.line2}`, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.5)` }}>
      <div style={{ font: `600 ${20 * u}px/1 ${F.mono}`, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 16 * u }}>Describe your shop</div>
      <textarea
        id="brief"
        rows={3}
        placeholder="e.g. a bakery in Brooklyn, open 7am to 10pm"
        style={{
          width: "100%",
          resize: "none",
          border: 0,
          outline: "none",
          background: "transparent",
          color: C.fg,
          font: `500 ${30 * u}px/1.4 ${F.body}`,
          caretColor: C.accent,
          minHeight: 130 * u,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 * u, marginTop: 14 * u, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10 * u }}>
          {brand.shopTypes.slice(0, 4).map((s, i) => (
            <span key={s} style={{ padding: `${10 * u}px ${18 * u}px`, borderRadius: 99, border: `${1.5 * u}px solid ${i === chipsActive ? C.accent : C.line2}`, color: i === chipsActive ? C.accent : C.fg2, background: i === chipsActive ? C.accentSoft : "transparent", font: `600 ${19 * u}px/1 ${F.body}` }}>
              {s}
            </span>
          ))}
        </div>
        <Button id="build-btn" onClick={onBuild}>
          <Sparkles size={24 * u} /> Build my site
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- build log */

export function BuildLog({ start, width, every = 0.42 }: { start: number; width: number; every?: number }) {
  const { u } = useVideo();
  const t = useTime() - start;
  const steps = brand.demo.buildSteps;
  const doneCount = Math.max(0, Math.min(steps.length, Math.floor(t / every)));
  const pct = clamp01(t / (every * steps.length));
  const live = doneCount >= steps.length;
  return (
    <div id="build-log" style={{ width, padding: 30 * u, borderRadius: 28 * u, background: "rgba(22,20,15,.92)", border: `${1.5 * u}px solid ${C.line2}`, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.5)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 * u }}>
        <span style={{ font: `700 ${28 * u}px/1 ${F.display}`, color: C.fg }}>Build log</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 * u, padding: `${8 * u}px ${16 * u}px`, borderRadius: 99, font: `700 ${18 * u}px/1 ${F.mono}`, color: live ? C.live : C.muted, background: live ? "rgba(91,214,154,.12)" : "rgba(243,239,230,.06)" }}>
          <span style={{ width: 10 * u, height: 10 * u, borderRadius: 99, background: live ? C.live : C.muted }} /> {live ? "LIVE" : `${Math.round(pct * 100)}%`}
        </span>
      </div>
      <div style={{ display: "grid", gap: 14 * u }}>
        {steps.map((s, i) => {
          const state = i < doneCount ? "done" : i === doneCount ? "run" : "todo";
          const p = Easing.out(clamp01((t - i * every) / 0.3));
          return (
            <div key={s.title} style={{ display: "flex", alignItems: "center", gap: 18 * u, opacity: state === "todo" ? 0.38 : 1, transform: `translateX(${(1 - (state === "todo" ? 0 : p)) * 8 * u}px)` }}>
              <span style={{ flex: "none", width: 34 * u, height: 34 * u, borderRadius: 99, display: "grid", placeItems: "center", background: state === "done" ? C.live : "rgba(243,239,230,.08)", color: C.accentInk }}>
                {state === "done" ? <Check size={20 * u} strokeWidth={3} /> : state === "run" ? <Loader2 size={20 * u} color={C.accent} style={{ transform: `rotate(${t * 360}deg)` }} /> : null}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 ${24 * u}px/1.2 ${F.body}`, color: C.fg }}>{s.title}</div>
                <div style={{ font: `500 ${18 * u}px/1.3 ${F.mono}`, color: C.muted, marginTop: 3 * u }}>{s.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 6 * u, borderRadius: 99, background: "rgba(243,239,230,.08)", marginTop: 24 * u, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: `linear-gradient(90deg, ${C.accent2}, ${C.accent})` }} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- mini site */

export function MiniSite({ fridayHours = "7am to 10pm", hoursId = "hours-row", onOrder, compact = false }: { fridayHours?: string; hoursId?: string; onOrder?: () => void; compact?: boolean }) {
  const { u } = useVideo();
  const d = brand.demo;
  const ink = "#2b2116";
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#fbf6ee,#f4ead9)", color: ink, font: `500 ${20 * u}px/1.4 ${F.body}`, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${22 * u}px ${36 * u}px`, borderBottom: `${1 * u}px solid rgba(43,33,22,.08)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 * u, font: `700 ${26 * u}px/1 ${F.display}` }}>
          <span style={{ width: 40 * u, height: 40 * u, borderRadius: 12 * u, background: "#7a4b25", color: "#fbf6ee", display: "grid", placeItems: "center", font: `700 ${22 * u}px/1 ${F.display}` }}>M</span>
          {d.shop}
        </div>
        {!compact && (
          <div style={{ display: "flex", gap: 26 * u, font: `600 ${19 * u}px/1 ${F.body}`, color: "#6b5844" }}>
            <span>Home</span>
            <span>Menu</span>
            <span>Gallery</span>
            <span>Contact</span>
          </div>
        )}
        <button id="order-btn" className="vk-btn" onClick={onOrder} style={{ cursor: "pointer", border: 0, borderRadius: 99, padding: `${12 * u}px ${22 * u}px`, background: "#7a4b25", color: "#fbf6ee", font: `700 ${19 * u}px/1 ${F.body}` }}>
          Order now
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1.25fr 1fr", gap: 34 * u, padding: `${40 * u}px ${36 * u}px` }}>
        <div>
          <div style={{ font: `700 ${16 * u}px/1 ${F.mono}`, letterSpacing: "0.14em", color: "#a0703f" }}>{d.area.toUpperCase()}</div>
          <div style={{ font: `700 ${compact ? 50 * u : 56 * u}px/1.02 ${F.display}`, letterSpacing: "-0.03em", margin: `${16 * u}px 0` }}>{d.heroTitle}</div>
          <div style={{ color: "#6b5844", fontSize: 22 * u }}>{d.heroBody}</div>
          <div id={hoursId} style={{ display: "inline-flex", gap: 14 * u, alignItems: "center", marginTop: 22 * u, padding: `${12 * u}px ${18 * u}px`, borderRadius: 14 * u, background: "rgba(122,75,37,.08)", font: `600 ${20 * u}px/1 ${F.body}` }}>
            <span style={{ width: 10 * u, height: 10 * u, borderRadius: 99, background: "#3f9b62" }} /> Friday: {fridayHours}
          </div>
        </div>
        <div style={{ display: "grid", gap: 14 * u, alignContent: "start" }}>
          {d.products.map((p, i) => (
            <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${18 * u}px ${20 * u}px`, borderRadius: 18 * u, background: "#fff", boxShadow: `0 ${6 * u}px ${20 * u}px rgba(43,33,22,.08)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 * u }}>
                <span style={{ width: 52 * u, height: 52 * u, borderRadius: 14 * u, background: ["#e9c99c", "#5a3a26", "#d99a52"][i], flex: "none" }} />
                <span style={{ font: `600 ${21 * u}px/1.2 ${F.body}` }}>{p.name}</span>
              </div>
              <span style={{ font: `700 ${22 * u}px/1 ${F.display}`, color: "#7a4b25" }}>{p.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- chat edit */

export function ChatPanel({ width, sentAt, replyAt, onSend }: { width: number; sentAt: number | null; replyAt: number | null; onSend?: () => void }) {
  const { u } = useVideo();
  const t = useTime();
  const sent = sentAt !== null && t >= sentAt;
  const typing = sent && replyAt !== null && t < replyAt;
  const replied = replyAt !== null && t >= replyAt;
  const bubble = (p: number): CSSProperties => ({ opacity: clamp01(p * 1.6), transform: `translateY(${(1 - p) * 16 * u}px) scale(${lerp(0.94, 1, p)})` });
  return (
    <div id="chat" style={{ width, display: "flex", flexDirection: "column", gap: 16 * u, padding: 26 * u, borderRadius: 28 * u, background: "rgba(22,20,15,.94)", border: `${1.5 * u}px solid ${C.line2}`, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.5)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 * u, font: `700 ${24 * u}px/1 ${F.display}`, color: C.fg }}>
        <Sparkles size={24 * u} color={C.accent} /> Edit your site
      </div>
      <div style={{ minHeight: 210 * u, display: "flex", flexDirection: "column", gap: 12 * u, justifyContent: "flex-end" }}>
        {sent && (
          <div style={{ alignSelf: "flex-end", maxWidth: "85%", padding: `${14 * u}px ${18 * u}px`, borderRadius: `${20 * u}px ${20 * u}px ${6 * u}px ${20 * u}px`, background: C.accent, color: C.accentInk, font: `600 ${22 * u}px/1.35 ${F.body}`, ...bubble(spring(t, sentAt!, { stiffness: 300, damping: 24 })) }}>
            {brand.demo.editRequest}
          </div>
        )}
        {typing && (
          <div style={{ alignSelf: "flex-start", display: "flex", gap: 8 * u, padding: `${16 * u}px ${18 * u}px`, borderRadius: 20 * u, background: C.surface2 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 11 * u, height: 11 * u, borderRadius: 99, background: C.muted, opacity: 0.35 + 0.65 * Math.max(0, Math.sin((t - i * 0.15) * 9)) }} />
            ))}
          </div>
        )}
        {replied && (
          <div style={{ alignSelf: "flex-start", maxWidth: "88%", padding: `${14 * u}px ${18 * u}px`, borderRadius: `${20 * u}px ${20 * u}px ${20 * u}px ${6 * u}px`, background: C.surface2, color: C.fg, font: `500 ${22 * u}px/1.35 ${F.body}`, display: "flex", gap: 10 * u, alignItems: "center", ...bubble(spring(t, replyAt!, { stiffness: 300, damping: 24 })) }}>
            <Check size={22 * u} color={C.live} strokeWidth={3} /> Done. Friday hours updated on every page.
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 12 * u, alignItems: "center", padding: `${10 * u}px ${10 * u}px ${10 * u}px ${20 * u}px`, borderRadius: 999, background: "rgba(0,0,0,.3)", border: `${1.5 * u}px solid ${C.line}` }}>
        <input id="chat-input" placeholder="Ask for a change…" style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: C.fg, font: `500 ${22 * u}px/1 ${F.body}`, caretColor: C.accent }} />
        <button id="chat-send" className="vk-btn" onClick={onSend} style={{ cursor: "pointer", flex: "none", width: 56 * u, height: 56 * u, borderRadius: 99, border: 0, background: C.accent, color: C.accentInk, display: "grid", placeItems: "center" }}>
          <Send size={24 * u} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- booking */

export function BookingWidget({ width, onSubmit }: { width: number; onSubmit?: (day: string, time: string) => void }) {
  const { u } = useVideo();
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const chip = (on: boolean): CSSProperties => ({
    cursor: "pointer",
    border: `${1.5 * u}px solid ${on ? "#7a4b25" : "rgba(43,33,22,.14)"}`,
    background: on ? "#7a4b25" : "#fff",
    color: on ? "#fbf6ee" : "#2b2116",
    borderRadius: 14 * u,
    padding: `${14 * u}px 0`,
    font: `700 ${21 * u}px/1 ${F.body}`,
    transition: "background-color .18s, color .18s, transform .18s",
  });
  return (
    <div id="booking" style={{ width, padding: 28 * u, borderRadius: 26 * u, background: "#fbf6ee", color: "#2b2116", boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.45)` }}>
      <div style={{ font: `700 ${30 * u}px/1.1 ${F.display}` }}>Order for pickup</div>
      <div style={{ font: `500 ${19 * u}px/1.3 ${F.body}`, color: "#6b5844", margin: `${6 * u}px 0 ${18 * u}px` }}>{brand.demo.shop} · pick a day and time</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 * u }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
          <button key={d} data-day={d} className="vk-chip" style={chip(day === d)} onClick={() => setDay(d)}>
            {d}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 * u, marginTop: 12 * u }}>
        {["11:00", "1:30", "4:30", "6:00"].map((tm) => (
          <button key={tm} data-time={tm} className="vk-chip" style={chip(time === tm)} onClick={() => setTime(tm)}>
            {tm}
          </button>
        ))}
      </div>
      <button
        id="booking-submit"
        className="vk-btn"
        onClick={() => {
          setSent(true);
          onSubmit?.(day ?? "", time ?? "");
        }}
        style={{ cursor: "pointer", width: "100%", marginTop: 18 * u, border: 0, borderRadius: 999, padding: `${20 * u}px 0`, background: sent ? "#3f9b62" : "#2b2116", color: "#fbf6ee", font: `700 ${22 * u}px/1 ${F.body}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 * u, transition: "background-color .25s" }}
      >
        {sent ? (
          <>
            <Check size={24 * u} strokeWidth={3} /> Request sent
          </>
        ) : (
          "Send booking request"
        )}
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- domain */

export function DomainPanel({ width, onConnect, connectedAt }: { width: number; onConnect?: () => void; connectedAt: number | null }) {
  const { u } = useVideo();
  const t = useTime();
  const rows = ["Checking DNS records", "Issuing HTTPS certificate", "Domain connected"];
  return (
    <div id="domain" style={{ width, padding: 28 * u, borderRadius: 26 * u, background: "rgba(22,20,15,.94)", border: `${1.5 * u}px solid ${C.line2}`, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.5)`, color: C.fg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 * u, font: `700 ${26 * u}px/1 ${F.display}` }}>
        Your own domain <span style={{ font: `700 ${15 * u}px/1 ${F.mono}`, padding: `${6 * u}px ${10 * u}px`, borderRadius: 8 * u, background: C.accentSoft, color: C.accent }}>PRO</span>
      </div>
      <div style={{ display: "flex", gap: 12 * u, marginTop: 20 * u }}>
        <input id="domain-input" placeholder="yourshop.com" style={{ flex: 1, minWidth: 0, padding: `${16 * u}px ${18 * u}px`, borderRadius: 14 * u, border: `${1.5 * u}px solid ${C.line2}`, background: "rgba(0,0,0,.3)", color: C.fg, outline: "none", font: `500 ${24 * u}px/1 ${F.mono}`, caretColor: C.accent }} />
        <Button id="domain-connect" onClick={onConnect} size={0.9}>
          Connect
        </Button>
      </div>
      <div style={{ display: "grid", gap: 12 * u, marginTop: 20 * u }}>
        {rows.map((r, i) => {
          const at = connectedAt === null ? Infinity : connectedAt + i * 0.55;
          const done = t >= at + 0.45;
          const run = t >= at && !done;
          return (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 14 * u, opacity: t >= at ? 1 : 0.35, font: `600 ${21 * u}px/1.2 ${F.body}` }}>
              <span style={{ width: 30 * u, height: 30 * u, borderRadius: 99, display: "grid", placeItems: "center", background: done ? C.live : "rgba(243,239,230,.08)", color: C.accentInk }}>
                {done ? <Check size={18 * u} strokeWidth={3} /> : run ? <Loader2 size={18 * u} color={C.accent} style={{ transform: `rotate(${t * 360}deg)` }} /> : null}
              </span>
              {r}
              {i === 1 && done && <Lock size={20 * u} color={C.live} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- end card */

export function EndCard({ at = 0, line = brand.cta }: { at?: number; line?: string }) {
  const { u, portrait } = useVideo();
  const t = useTime();
  const s = spring(t, at, { stiffness: 200, damping: 20 });
  const p2 = Easing.out(clamp01((t - at - 0.35) / 0.6));
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 * u, textAlign: "center" }}>
      <div style={{ transform: `scale(${lerp(0.85, 1, s)})`, opacity: clamp01(s * 1.5) }}>
        <Logo size={(portrait ? 84 : 72) * u} />
      </div>
      <div style={{ ...headline(u, portrait ? 104 : 120), opacity: p2, transform: `translateY(${(1 - p2) * 30 * u}px)` }}>{brand.url}</div>
      <div style={{ opacity: Easing.out(clamp01((t - at - 0.6) / 0.5)) }}>
        <Button size={1.25} shimmerAt={at + 1.1}>
          {line}
        </Button>
      </div>
      <div style={{ display: "flex", gap: 26 * u, font: `500 ${22 * u}px/1 ${F.body}`, color: C.muted, opacity: Easing.out(clamp01((t - at - 0.9) / 0.5)) }}>
        {brand.trust.map((x) => (
          <span key={x} style={{ display: "inline-flex", alignItems: "center", gap: 8 * u }}>
            <Check size={20 * u} color={C.live} strokeWidth={3} /> {x}
          </span>
        ))}
      </div>
    </div>
  );
}
