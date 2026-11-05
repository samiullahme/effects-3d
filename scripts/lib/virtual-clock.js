// Virtual clock injected into the page before any page script runs (Playwright addInitScript).
//
// Until freeze() is called everything runs on real time, so the app boots normally.
// After freeze() time only moves when the renderer calls advance(ms): timers, rAF,
// performance.now, Date, CSS animations/transitions, WAAPI animations (motion), <video>
// and SVG SMIL are all stepped to the exact frame time. That makes every frame
// deterministic no matter how slow the screenshot is.
(() => {
  if (window.__vclock) return;

  const realPerfNow = performance.now.bind(performance);
  const RealDate = Date;
  const realDateNow = Date.now.bind(Date);
  const realSetTimeout = window.setTimeout.bind(window);
  const realClearTimeout = window.clearTimeout.bind(window);
  const realSetInterval = window.setInterval.bind(window);
  const realClearInterval = window.clearInterval.bind(window);
  const realRAF = window.requestAnimationFrame.bind(window);

  let frozen = false;
  let vt = 0; // virtual performance.now() in ms
  let dateOffset = 0; // Date.now() - performance.now() at freeze time

  const now = () => (frozen ? vt : realPerfNow());
  const dateNow = () => (frozen ? Math.floor(vt + dateOffset) : realDateNow());

  // ---- performance.now / Date -------------------------------------------------
  try {
    performance.now = now;
  } catch {}
  function VDate(...args) {
    if (!new.target) return new RealDate(dateNow()).toString();
    return args.length === 0 ? new RealDate(dateNow()) : new RealDate(...args);
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = dateNow;
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  Object.defineProperty(VDate, Symbol.hasInstance, { value: (x) => x instanceof RealDate });
  window.Date = VDate;

  // ---- timers -----------------------------------------------------------------
  const timers = new Map();
  let timerSeq = 1;
  const VIRTUAL_ID_BASE = 1e9;
  let nextTimerId = VIRTUAL_ID_BASE;

  function addTimer(fn, ms, args, repeat) {
    const id = nextTimerId++;
    const delay = Math.max(0, Number(ms) || 0);
    timers.set(id, { id, fn, args, at: vt + delay, interval: repeat ? Math.max(1, delay) : null, seq: timerSeq++ });
    return id;
  }
  window.setTimeout = function (fn, ms, ...args) {
    if (!frozen) return realSetTimeout(fn, ms, ...args);
    return addTimer(fn, ms, args, false);
  };
  window.setInterval = function (fn, ms, ...args) {
    if (!frozen) return realSetInterval(fn, ms, ...args);
    return addTimer(fn, ms, args, true);
  };
  window.clearTimeout = function (id) {
    if (timers.has(id)) timers.delete(id);
    else realClearTimeout(id);
  };
  window.clearInterval = function (id) {
    if (timers.has(id)) timers.delete(id);
    else realClearInterval(id);
  };

  // ---- requestAnimationFrame ----------------------------------------------------
  // One queue for both modes. Unfrozen: a real rAF pumps it. Frozen: advance() flushes it.
  const rafQueue = new Map();
  let rafSeq = 1;
  let pumping = false;
  function flushRaf(ts) {
    const cbs = [...rafQueue.values()];
    rafQueue.clear();
    for (const cb of cbs) {
      try {
        cb(ts);
      } catch (e) {
        console.error(e);
      }
    }
  }
  function pump() {
    if (pumping || frozen) return;
    pumping = true;
    realRAF((ts) => {
      pumping = false;
      if (frozen) return; // the renderer owns the queue now
      flushRaf(ts);
    });
  }
  window.requestAnimationFrame = function (cb) {
    const id = rafSeq++;
    rafQueue.set(id, cb);
    pump();
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    rafQueue.delete(id);
  };

  // ---- CSS / WAAPI animations ----------------------------------------------------
  const tracked = new WeakMap();
  function syncAnimations() {
    let list = [];
    try {
      list = document.getAnimations();
    } catch {
      return;
    }
    for (const a of list) {
      let s = tracked.get(a);
      if (!s) {
        const ct = Number(a.currentTime) || 0;
        s = { base: vt - ct / (a.playbackRate || 1), done: false };
        tracked.set(a, s);
      }
      if (s.done || a.playState === 'finished' || a.playState === 'idle') continue;
      const local = (vt - s.base) * (a.playbackRate || 1);
      let end = Infinity;
      try {
        end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      } catch {}
      if (Number.isFinite(end) && local >= end) {
        s.done = true;
        try {
          a.finish(); // resolves .finished and fires onfinish (motion relies on it)
        } catch {
          try {
            a.currentTime = end;
          } catch {}
        }
        continue;
      }
      try {
        if (a.playState !== 'paused') a.pause();
        a.currentTime = Math.max(0, local);
      } catch {}
    }
  }

  // ---- <video> ---------------------------------------------------------------------
  const videoBase = new WeakMap();
  async function syncVideos() {
    const vids = document.querySelectorAll('video');
    const waits = [];
    for (const v of vids) {
      if (!videoBase.has(v)) {
        videoBase.set(v, vt - (v.currentTime || 0) * 1000);
        v.dataset.vkWasPlaying = v.paused ? '0' : '1';
      }
      if (v.dataset.vkWasPlaying !== '1' && !v.autoplay) continue;
      try {
        v.pause();
      } catch {}
      if (!v.duration || !Number.isFinite(v.duration)) continue;
      let t = (vt - videoBase.get(v)) / 1000;
      t = v.loop ? t % v.duration : Math.min(t, v.duration);
      if (Math.abs(v.currentTime - t) < 0.0005) continue;
      waits.push(
        new Promise((res) => {
          const done = () => res();
          v.addEventListener('seeked', done, { once: true });
          realSetTimeout(done, 400);
          v.currentTime = t;
        }),
      );
    }
    await Promise.all(waits);
  }

  // ---- SVG SMIL ----------------------------------------------------------------------
  const smilBase = new WeakMap();
  function syncSmil() {
    const nodes = document.querySelectorAll('svg animate, svg animateTransform, svg animateMotion, svg set');
    const roots = new Set();
    nodes.forEach((n) => n.ownerSVGElement && roots.add(n.ownerSVGElement));
    roots.forEach((svg) => {
      if (!smilBase.has(svg)) smilBase.set(svg, vt - (svg.getCurrentTime?.() || 0) * 1000);
      try {
        svg.pauseAnimations();
        svg.setCurrentTime((vt - smilBase.get(svg)) / 1000);
      } catch {}
    });
  }

  // Let React (MessageChannel scheduler), promises and effects settle on the real loop.
  const yieldTask = () =>
    new Promise((res) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => res();
      ch.port2.postMessage(0);
    });

  function nextTimer(limit) {
    let best = null;
    for (const t of timers.values()) {
      if (t.at > limit) continue;
      if (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq)) best = t;
    }
    return best;
  }

  async function runTimersUntil(target) {
    let guard = 0;
    for (let t = nextTimer(target); t; t = nextTimer(target)) {
      if (++guard > 20000) {
        console.warn('[vclock] timer storm, giving up this frame');
        break;
      }
      vt = Math.max(vt, t.at);
      if (t.interval != null) {
        t.at += t.interval;
        t.seq = timerSeq++;
      } else timers.delete(t.id);
      try {
        typeof t.fn === 'function' ? t.fn(...(t.args || [])) : (0, eval)(String(t.fn));
      } catch (e) {
        console.error(e);
      }
      if (guard % 50 === 0) await yieldTask();
    }
  }

  window.__vclock = {
    get frozen() {
      return frozen;
    },
    now,
    freeze() {
      if (frozen) return vt;
      dateOffset = realDateNow() - realPerfNow();
      vt = realPerfNow();
      frozen = true;
      return vt;
    },
    async advance(ms) {
      if (!frozen) throw new Error('vclock not frozen');
      const target = vt + Math.max(0, ms);
      await runTimersUntil(target);
      vt = target;
      await yieldTask();
      flushRaf(vt); // one animation frame per advance
      await yieldTask();
      await runTimersUntil(vt); // zero-delay timers queued by rAF callbacks / effects
      await yieldTask();
      syncAnimations();
      syncSmil();
      await syncVideos();
      return vt;
    },
    // Used once right after __startVideo() so frame 0 already reflects mounted state.
    async settle() {
      await yieldTask();
      await yieldTask();
      flushRaf(vt);
      await yieldTask();
      await runTimersUntil(vt);
      syncAnimations();
      syncSmil();
      await syncVideos();
    },
  };
})();
