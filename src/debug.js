/* ---------- dev-only frame-time readout (?debug) ---------- */
// Averages raw frame times over ~0.5 s windows and tracks the worst frame,
// so each upgrade can be checked against the 16.7 ms (60 fps) budget.
export function createFrameStats(windowSec = 0.5) {
  let sum = 0, n = 0, worst = 0, elapsed = 0;
  const out = { avgMs: 0, worstMs: 0, fps: 0, ready: false };
  return {
    out,
    add(frameSec) {
      sum += frameSec; n++; elapsed += frameSec;
      if (frameSec > worst) worst = frameSec;
      if (elapsed < windowSec) return false;
      out.avgMs = (sum / n) * 1000;
      out.worstMs = worst * 1000;
      out.fps = n / elapsed;
      out.ready = true;
      sum = 0; n = 0; worst = 0; elapsed = 0;
      return true;
    }
  };
}

export function mountReadout() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:10;font:11px/1.4 ui-monospace,Menlo,monospace;' +
    'color:#9fe;background:rgba(0,0,0,.55);padding:4px 7px;border-radius:3px;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  return el;
}
