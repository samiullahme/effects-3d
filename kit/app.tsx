"use client";
"use no memo"; // frame-driven: per-frame runtime state lives in refs on purpose; keep the React Compiler out
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * /video entry. Reads the URL and renders one composition:
 *   /video                          gallery of every composition and format (preview)
 *   /video?id=launch&format=9x16    one composition
 *   &props=<base64url JSON>         override defaultProps (used by campaigns)
 *   &fps=60                         override fps
 */

import { useEffect, useState } from "react";

import type { AnyComposition } from "./composition";
import { FORMATS, VideoRoot, type FormatId } from "./core";

function decodeProps(s: string | null) {
  if (!s) return {};
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    console.error("[video-kit] bad props param");
    return {};
  }
}

const KIT_CSS = `
html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
* { box-sizing: border-box; }
[data-vk-stage] { -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
[data-vk-stage] button { font: inherit; }
.vk-btn { transition: filter .18s ease, transform .18s ease, box-shadow .18s ease; }
.vk-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
.vk-btn:active { transform: scale(.96); }
.vk-chip:hover { transform: translateY(-2px); }
nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }
`;

export function VideoApp({ compositions }: { compositions: AnyComposition[] }) {
  const [state, setState] = useState<null | { id: string | null; format: FormatId; props: object; fps?: number }>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const format = (q.get("format") as FormatId) || "16x9";
    setState({ id: q.get("id"), format: FORMATS[format] ? format : "16x9", props: decodeProps(q.get("props")), fps: q.get("fps") ? Number(q.get("fps")) : undefined });
    (window as unknown as { __compositions: unknown }).__compositions = compositions.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      formats: c.formats,
      duration: typeof c.duration === "number" ? c.duration : c.duration(c.defaultProps),
      fps: c.fps ?? 30,
    }));
  }, [compositions]);

  if (!state) return <style>{KIT_CSS}</style>;
  const comp = compositions.find((c) => c.id === state.id);

  if (!comp) {
    return (
      <>
        <style>{KIT_CSS + "html,body{overflow:auto;background:#09090b}"}</style>
        <Gallery compositions={compositions} missing={state.id} />
      </>
    );
  }

  const props = { ...comp.defaultProps, ...state.props };
  const duration = typeof comp.duration === "number" ? comp.duration : comp.duration(props);
  const Comp = comp.component;
  return (
    <>
      <style>{KIT_CSS}</style>
      <VideoRoot duration={duration} fps={state.fps ?? comp.fps ?? 30} format={state.format} id={comp.id} poster={comp.poster} background={comp.background ?? "#000"}>
        <Comp {...props} />
      </VideoRoot>
    </>
  );
}

function Gallery({ compositions, missing }: { compositions: AnyComposition[]; missing: string | null }) {
  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px", color: "#e4e4e7", font: "15px/1.5 ui-sans-serif, system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ font: "700 28px/1.2 ui-sans-serif, system-ui", margin: "0 0 6px" }}>Video compositions</h1>
      <p style={{ color: "#a1a1aa", margin: "0 0 28px" }}>
        {missing ? `No composition "${missing}". ` : ""}Open one to preview it in real time (press R to restart). Render with <code>node scripts/video/render.mjs --id &lt;id&gt;</code>.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {compositions.map((c) => (
          <div key={c.id} style={{ padding: 18, borderRadius: 12, background: "#18181b", border: "1px solid #27272a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 650, color: "#fafafa" }}>
                  {c.title} <span style={{ color: "#71717a", fontWeight: 400 }}>· {c.id} · {typeof c.duration === "number" ? c.duration : c.duration(c.defaultProps)}s</span>
                </div>
                <div style={{ color: "#a1a1aa" }}>{c.description}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {c.formats.map((f) => (
                  <a key={f} href={`?id=${c.id}&format=${f}`} style={{ color: "#fafafa", background: "#27272a", padding: "4px 10px", borderRadius: 6, textDecoration: "none", fontSize: 13 }}>
                    {f}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
