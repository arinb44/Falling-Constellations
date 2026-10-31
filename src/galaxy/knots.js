/* ---------- H-II knots that live along the arms (pure) ---------- */
// Each clump of 1–3 knots is born on an arm's outer edge, fades in, glows while it slides
// slowly along the arm (in the direction the stars orbit, stored as a change in radius and
// angle so it curves with the arm),
// then fades out and is reborn somewhere else on an outer edge. Positions are in the galaxy
// plane's pattern frame, as in structure.js; KNOT_VS moves and fades them from u_time, and
// the CPU only rewrites a clump's slots when it is reborn.
import { mulberry32 } from '../sky/noise.js';
import { G } from './model.js';
import { S, pickKnotSpot } from './structure.js';

export const KNOT = {
  FADE: 2.5,             // seconds to fade in, and again to fade out
  GLOW: [8, 20],         // seconds at full brightness
  SPEED: [0.005, 0.009], // slide along the arm, disc radii per second (about 3–5 px/s on a laptop)
  STRIDE: 10             // x, y, size, r, g, b, slide dr, slide dθ, born, total
};

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const span = (rng, [a, b]) => a + rng() * (b - a);

// 0 → 1 over FADE, 1 while glowing, 1 → 0 over the last FADE; 0 outside the life
export function knotLife(age, total) {
  if (age <= 0 || age >= total) return 0;
  return smoothstep(0, KNOT.FADE, age) * (1 - smoothstep(total - KNOT.FADE, total, age));
}

// Arm crests sit where neighbouring ellipses crowd, at a polar angle of tilt(r) + const, so
// along an arm dθ/dr = TWIST. Returns the change in radius and angle for a slide of length L
// (disc radii) starting at radius r, heading the way the stars orbit (θ increasing).
export function armSlide(r, L, out = { dr: 0, dth: 0 }) {
  out.dr = L / Math.hypot(1, G.TWIST * r);
  out.dth = G.TWIST * out.dr;
  return out;
}

export function createKnots(structure, seed = 1, t0 = 0, count = S.KNOTS) {
  const { arms, n } = structure, rng = mulberry32(seed ^ 0x68e31da4);
  const data = new Float32Array(count * KNOT.STRIDE);
  // slots are grouped into clumps once; a clump is always reborn together
  const groups = [];
  for (let k = 0; k < count;) { const c = Math.min(count - k, 1 + Math.floor(rng() * 3)); groups.push({ start: k, count: c }); k += c; }
  const spot = { x: 0, y: 0 }, step = { dr: 0, dth: 0 };

  function spawn(g, born) {
    if (!pickKnotSpot(arms, n, rng, spot)) return;
    const total = 2 * KNOT.FADE + span(rng, KNOT.GLOW), slide = span(rng, KNOT.SPEED) * total;
    armSlide(Math.hypot(spot.x, spot.y), slide, step);
    for (let c = 0; c < g.count; c++) {
      const o = (g.start + c) * KNOT.STRIDE, b = (0.4 + 0.5 * rng()) * G.GAIN;
      data[o] = spot.x + (c ? (rng() - 0.5) * 0.02 : 0);
      data[o + 1] = spot.y + (c ? (rng() - 0.5) * 0.02 : 0);
      data[o + 2] = 1.6 + rng() * 1.8;                      // CSS px
      data[o + 3] = b; data[o + 4] = b * (0.38 + 0.1 * rng()); data[o + 5] = b * (0.6 + 0.1 * rng());
      data[o + 6] = step.dr; data[o + 7] = step.dth;
      data[o + 8] = born; data[o + 9] = total;
    }
  }

  // stagger the first lives so about the same number glows from the start
  for (const g of groups) {
    spawn(g, t0);
    const o = g.start * KNOT.STRIDE, born = t0 - rng() * data[o + 9];
    for (let c = 0; c < g.count; c++) data[(g.start + c) * KNOT.STRIDE + 8] = born;
  }

  // Rebirths since the last call. Returns how many clumps changed; their indices are in dirty.
  const dirty = new Int32Array(groups.length);
  function update(t) {
    let m = 0;
    for (let i = 0; i < groups.length; i++) {
      const o = groups[i].start * KNOT.STRIDE;
      if (t >= data[o + 8] + data[o + 9]) { spawn(groups[i], t); dirty[m++] = i; }
    }
    return m;
  }
  return { data, groups, dirty, update, count };
}

// position (pattern frame) and brightness factor of knot slot k at time t; mirrors KNOT_VS
export function knotAt(data, k, t, out = { x: 0, y: 0, life: 0 }) {
  const o = k * KNOT.STRIDE, total = data[o + 9], age = t - data[o + 8];
  const f = Math.min(1, Math.max(0, age / total)), x = data[o], y = data[o + 1];
  const r = Math.hypot(x, y) + data[o + 6] * f, a = Math.atan2(y, x) + data[o + 7] * f;
  out.x = r * Math.cos(a); out.y = r * Math.sin(a);
  out.life = knotLife(age, total);
  return out;
}
