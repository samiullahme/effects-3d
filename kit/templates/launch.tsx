"use client";

import { useState } from "react";
import { ShoppingBasket } from "lucide-react";

import { Backdrop } from "../backgrounds";
import { brand } from "../brand";
import { Camera } from "../camera";
import { defineComposition } from "../composition";
import { Sequence, Sfx, clamp01, useClockRef, useTime, useVideo } from "../core";
import { Cursor, type CursorStep } from "../cursor";
import { Toast } from "../effects";
import { BrowserFrame, Float3D } from "../frames";
import { KineticText } from "../text";
import { BuildLog, Composer, EndCard, Eyebrow, MiniSite, headline } from "./ui";

const C = brand.colors;
const BUILD_EVERY = 0.34;

type Props = { hookA: string; hookB: string; brief: string };

function Hook({ hookA, hookB }: Props) {
  const { u, portrait } = useVideo();
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 * u, padding: 80 * u, textAlign: "center" }}>
      <KineticText text={brand.tagline} at={0.1} mode="blur" style={{ font: `600 ${24 * u}px/1 ${brand.fonts.mono}`, letterSpacing: "0.16em", textTransform: "uppercase", color: C.accent }} />
      <KineticText text={hookA} at={0.3} mode="blur" style={headline(u, portrait ? 112 : 124)} />
      <KineticText text={hookB} at={0.95} mode="blur" accent={hookB.split(" ").slice(-1)} accentColor={C.accent} style={headline(u, portrait ? 112 : 124)} />
    </div>
  );
}

function Demo({ brief }: Props) {
  const { u, w, h, portrait, landscape } = useVideo();
  const now = useClockRef();
  const t = useTime();
  const [buildAt, setBuildAt] = useState<number | null>(null);
  const [orderAt, setOrderAt] = useState<number | null>(null);

  const bw = landscape ? 1540 * u : w - 90 * u;
  const bh = landscape ? 900 * u : Math.min(h - 260 * u, bw * 1.45);
  const liveAt = buildAt === null ? Infinity : buildAt + 0.2 + BUILD_EVERY * brand.demo.buildSteps.length;
  const siteAt = liveAt + 0.55;
  const onSite = t >= siteAt;
  const composerOut = buildAt === null ? 0 : clamp01((t - buildAt) / 0.3);

  const script: CursorStep[] = [
    { at: 1.45, type: brief, into: "#brief", cps: 62 },
    { at: 3.95, click: "#build-btn", dur: 0.55 },
    { at: 4.6, move: "#build-log", anchor: [1.04, 1.06], dur: 0.8 },
    { at: 7.9, click: "#order-btn", dur: 0.7 },
  ];

  return (
    <>
      <Camera
        keys={[
          { at: 0.9, dur: 0.9, zoom: landscape ? 1.42 : 1.28, focus: "#composer" },
          { at: 4.1, dur: 0.8, zoom: 1 },
          { at: 7.3, dur: 0.7, zoom: landscape ? 1.35 : 1.2, focus: "#order-btn" },
          { at: 8.45, dur: 0.7, zoom: 1 },
        ]}
      >
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <Float3D from={{ rx: 26, ry: portrait ? 0 : -12, z: -260 }} at={0} dur={1.2}>
            <div style={{ position: "relative", width: bw, height: bh }}>
              <BrowserFrame url={onSite ? brand.demo.liveUrl : brand.url} width={bw} height={bh}>
                {!onSite && (
                  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(70% 60% at 50% 0%, ${C.forest}, ${C.bg} 70%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 * u, padding: 40 * u }}>
                    {composerOut < 1 && (
                      <div style={{ opacity: 1 - composerOut, transform: `scale(${1 - composerOut * 0.04})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 * u }}>
                        <Eyebrow>{brand.tagline}</Eyebrow>
                        <div style={{ ...headline(u, landscape ? 66 : 60), textAlign: "center" }}>
                          {brand.promise[0]}
                          <br />
                          <span style={{ color: C.accent }}>{brand.promise[1]}</span>
                        </div>
                        <Composer width={Math.min(bw - 120 * u, 1080 * u)} onBuild={() => setBuildAt(now())} />
                      </div>
                    )}
                    {buildAt !== null && (
                      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: clamp01((t - buildAt - 0.15) / 0.35) * (1 - clamp01((t - liveAt - 0.25) / 0.3)) }}>
                        <BuildLog start={buildAt + 0.2} width={Math.min(bw - 120 * u, 880 * u)} every={BUILD_EVERY} />
                      </div>
                    )}
                  </div>
                )}
                {onSite && (
                  <div style={{ position: "absolute", inset: 0, opacity: clamp01((t - siteAt) / 0.35), transform: `scale(${1.03 - 0.03 * clamp01((t - siteAt) / 0.5)})` }}>
                    <MiniSite compact={!landscape} onOrder={() => setOrderAt(now())} />
                  </div>
                )}
              </BrowserFrame>
            </div>
          </Float3D>
        </div>
        <Cursor script={script} glow="rgba(212,178,122,.25)" start={[w * 0.78, h * 0.9]} />
      </Camera>
      {buildAt !== null && <Sfx at={liveAt} sound="success" />}
      {orderAt !== null && (
        <Toast
          at={orderAt + 0.25}
          to={orderAt + 2.3}
          position={portrait ? "top" : "top-right"}
          icon={<ShoppingBasket size={30 * u} />}
          title="New order request"
          body={`${brand.demo.products[0].name} · pickup 4:30`}
        />
      )}
      {orderAt !== null && <Sfx at={orderAt + 0.25} sound="pop" />}
    </>
  );
}

function Launch(props: Props) {
  return (
    <>
      <Backdrop variant="aurora" />
      <Sequence from={0} duration={2.6} exit="blur" transition={0.4} name="hook">
        <Hook {...props} />
      </Sequence>
      <Sfx at={2.35} sound="whoosh" volume={0.7} />
      <Sequence from={2.4} duration={10.4} enter="fade" exit="zoom" transition={0.4} name="demo">
        <Demo {...props} />
      </Sequence>
      <Sfx at={12.6} sound="whoosh" volume={0.7} />
      <Sequence from={12.7} duration={2.3} enter="blur" transition={0.5} name="end">
        <Backdrop variant="spotlight" />
        <EndCard at={0.05} />
      </Sequence>
    </>
  );
}

export const launch = defineComposition<Props>({
  id: "launch",
  title: "Product launch",
  description: "Hook, then the real flow: type a brief, click Build, watch the build log, the site goes live, an order arrives. Ends on the CTA.",
  duration: 15,
  formats: ["16x9", "9x16", "1x1", "4x5"],
  poster: 10.2,
  background: brand.colors.bg,
  defaultProps: { hookA: brand.promise[0], hookB: brand.promise[1], brief: brand.demo.brief },
  component: Launch,
});
