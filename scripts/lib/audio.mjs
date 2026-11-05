// Sound effects (synthesised with ffmpeg, no licensing issues) and the final audio mix.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const SR = 48000;

// name -> [lavfi source, extra filters]
const SOUNDS = {
  click: ["aevalsrc='0.55*sin(2*PI*2100*t)*exp(-t*120)+0.35*(random(0)*2-1)*exp(-t*700)':s=48000:d=0.08", "highpass=f=300"],
  key: ["aevalsrc='0.28*sin(2*PI*3300*t)*exp(-t*240)+0.22*(random(0)*2-1)*exp(-t*950)':s=48000:d=0.05", "highpass=f=900"],
  tick: ["aevalsrc='0.4*sin(2*PI*1600*t)*exp(-t*320)':s=48000:d=0.04", "anull"],
  pop: ["aevalsrc='0.6*sin(2*PI*(380+1500*t)*t)*exp(-t*26)':s=48000:d=0.18", "anull"],
  whoosh: ["anoisesrc=d=0.6:c=pink:a=0.7:r=48000", "afade=t=in:d=0.32,afade=t=out:st=0.32:d=0.28,bandpass=f=900:width_type=o:w=2.2,volume=2.2"],
  "swoosh-up": ["anoisesrc=d=0.45:c=pink:a=0.6:r=48000", "afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.25,highpass=f=1500,lowpass=f=7000,volume=1.8"],
  success: [
    "aevalsrc='0.32*sin(2*PI*880*t)*exp(-t*5)+0.3*sin(2*PI*1318.5*t)*exp(-(t-0.1)*5)*gte(t,0.1)+0.22*sin(2*PI*1760*t)*exp(-(t-0.2)*5)*gte(t,0.2)':s=48000:d=1.0",
    "afade=t=out:st=0.7:d=0.3",
  ],
};

export function ensureSounds(dir) {
  mkdirSync(dir, { recursive: true });
  const out = {};
  for (const [name, [src, filters]] of Object.entries(SOUNDS)) {
    const file = path.join(dir, `${name}.wav`);
    if (!existsSync(file)) {
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", src, "-af", `${filters},aformat=sample_rates=${SR}:channel_layouts=stereo`, file]);
    }
    out[name] = file;
  }
  return out;
}

function decodePcm(file) {
  // f32le stereo interleaved
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "2", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

/** Sum all sound events into one stereo PCM track (fast for hundreds of events). */
function mixEvents({ events, sounds, duration, sfxVolume }) {
  const total = Math.ceil(duration * SR) * 2;
  const mix = new Float32Array(total);
  const cache = {};
  for (const e of events) {
    const file = sounds[e.type];
    if (!file || e.t < 0 || e.t >= duration) continue;
    const pcm = (cache[e.type] ??= decodePcm(file));
    const gain = (e.volume ?? 1) * sfxVolume;
    const off = Math.round(e.t * SR) * 2;
    const n = Math.min(pcm.length, total - off);
    for (let i = 0; i < n; i++) mix[off + i] += pcm[i] * gain;
  }
  for (let i = 0; i < total; i++) mix[i] = Math.tanh(mix[i]); // soft clip
  return Buffer.from(mix.buffer);
}

/**
 * Mux `videoIn` (silent) with sound events and optional music into `out`.
 * events: [{ t: seconds, type, volume }]
 */
export function muxAudio({ videoIn, out, duration, events = [], sounds, music, musicVolume = 0.22, sfxVolume = 1 }) {
  const sfx = out.replace(/\.mp4$/, ".sfx.f32");
  writeFileSync(sfx, mixEvents({ events, sounds, duration, sfxVolume }));
  const args = ["-y", "-v", "error", "-i", videoIn, "-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", sfx];
  let filter = "[1:a]anull[mix]";
  if (music) {
    args.push("-stream_loop", "-1", "-i", music);
    const fadeOut = Math.max(0, duration - 1.4);
    filter = `[2:a]atrim=0:${duration},asetpts=N/SR/TB,afade=t=in:d=0.5,afade=t=out:st=${fadeOut}:d=1.4,volume=${musicVolume},aformat=sample_rates=${SR}:channel_layouts=stereo[mus];[1:a][mus]amix=inputs=2:normalize=0:duration=first[mix]`;
  }
  filter += `;[mix]alimiter=limit=0.9:level=disabled,atrim=0:${duration}[aout]`;
  args.push("-filter_complex", filter, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(duration), "-movflags", "+faststart", out);
  try {
    execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
  } finally {
    rmSync(sfx, { force: true });
  }
}
