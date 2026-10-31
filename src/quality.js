/* ---------- device tuning: phone resolution and adaptive quality (pure) ---------- */

// Phones draw the WebGL layer below full DPR (the 2D layer stays sharp at full DPR, capped at 2).
export const PHONE_SCALE = 0.65;
export const isPhone = ({ coarse, minSide }) => coarse && minSide < 768;
export const baseScale = env => (isPhone(env) ? PHONE_SCALE : 1);

// Rungs, best first: give up resolution, then galaxy stars, then bloom levels.
// scale multiplies the base scale; stars is the share of galaxy stars drawn.
export const LADDER = [
  { scale: 1, stars: 1, bloom: 6 },
  { scale: 0.8, stars: 1, bloom: 6 },
  { scale: 0.65, stars: 1, bloom: 6 },
  { scale: 0.65, stars: 0.6, bloom: 6 },
  { scale: 0.65, stars: 0.35, bloom: 6 },
  { scale: 0.65, stars: 0.35, bloom: 3 },
  { scale: 0.5, stars: 0.35, bloom: 0 }
];

export const Q = {
  WARMUP: 2,             // seconds ignored after start (shader compile, bakes, first uploads)
  WINDOW: 1.5,           // frame times are averaged over this many seconds
  SLOW_MS: 20,           // a window slower than this steps down one rung
  FAST_MS: 17.5,         // windows faster than this count toward stepping back up
  UP_AFTER: 10,          // seconds of fast windows before trying one rung up
  HITCH: 0.25            // single frames longer than this (tab switch, GC pause) are ignored
};

export function createQuality(opts = {}) {
  const o = { ...Q, ...opts };
  let t = 0, sum = 0, n = 0, elapsed = 0, good = 0, upWait = o.UP_AFTER, justUp = false;
  const q = {
    level: 0,
    get rung() { return LADDER[q.level]; },
    // feed one frame's raw duration in seconds; true when the rung changed
    update(sec) {
      if (sec <= 0 || sec > o.HITCH) return false;
      t += sec;
      if (t < o.WARMUP) return false;
      sum += sec; n++; elapsed += sec;
      if (elapsed < o.WINDOW) return false;
      const avg = sum / n * 1000;
      sum = 0; n = 0; elapsed = 0;
      if (avg > o.SLOW_MS) {
        good = 0;
        // a step up that failed straight away: wait twice as long before the next try
        if (justUp) upWait *= 2;
        justUp = false;
        if (q.level < LADDER.length - 1) { q.level++; return true; }
        return false;
      }
      justUp = false;
      if (avg < o.FAST_MS) good += o.WINDOW; else good = 0;
      if (good >= upWait && q.level > 0) { q.level--; good = 0; justUp = true; return true; }
      return false;
    },
    get upWait() { return upWait; }
  };
  return q;
}
