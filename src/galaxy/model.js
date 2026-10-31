/* ---------- galaxy model: tilted-ellipse orbits, colour by population (pure) ---------- */
// Density-wave picture: every star moves on an ellipse whose long axis is rotated a little
// more than the one inside it (tilt grows with radius). Where neighbouring ellipses crowd
// together, arms appear. Stars move along their ellipses, but the arm pattern depends only
// on tilt(a), so it never winds up. The vertex shader runs the same maths as orbit() below;
// the constants here are pasted into the GLSL so the two cannot drift apart.
import { mulberry32 } from '../sky/noise.js';

export const G = {
  N: 60000,              // stars
  TWIST: 4.2,            // radians of long-axis rotation from centre to rim
  E_MAX: 0.36,           // peak eccentricity, reached mid-disc
  OMEGA: 0.012,          // orbital speed scale: omega(a) = OMEGA / (a + 0.06) rad/s
  PATTERN: 0.0035,       // the whole pattern turns slowly (rad/s), about one turn per 30 min
  VIEW_ROT: -0.35,       // on-screen rotation of the disc
  SQUASH: 0.64,          // viewing angle: vertical squash of the disc (report: ~0.6–0.7)
  RADIUS: 0.56,          // disc radius as a fraction of max(W, H)
  ARM_SHARP: 3.0,        // how tightly young stars hug the arm crests
  BULGE: 0.14,           // fraction of stars in the central bulge
  SCATTER: 0.02,         // per-star offset from its ideal ellipse (disc units); softens the arms
  CORE_DIM: 0.5,         // stars dim to 50% of their brightness as they reach the centre
  CORE_DIM_R: 0.22,      // ...starting from this radius (disc units)
  GAIN: 0.55             // overall galaxy brightness (stars and core glow), so the constellations stay on top
};

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const tilt = a => a * G.TWIST;
// round in the core, most elongated mid-disc, relaxing toward the rim
export const eccentricity = a => G.E_MAX * smoothstep(0.0, 0.25, a) * (1 - 0.55 * smoothstep(0.6, 1.0, a));
export const omega = a => G.OMEGA / (a + 0.06);
// brightness factor by distance from the centre: 1 outside CORE_DIM_R, easing down to CORE_DIM at 0
export const centreDim = r => G.CORE_DIM + (1 - G.CORE_DIM) * smoothstep(0, G.CORE_DIM_R, r);

// Neighbouring ellipses crowd where sin(2θ) = -1 in the ellipse's own frame
// (θ ≈ -45° and 135°): that is where the arm crests sit. Returns 0..1.
export const armness = theta => Math.pow(Math.max(0, -Math.sin(2 * theta)), G.ARM_SHARP);

// Galaxy-plane position (unit disc) of a star at time t, before the view squash/rotation.
export function orbit(a, theta0, t, out = { x: 0, y: 0, theta: 0 }, sx = 0, sy = 0) {
  const theta = theta0 + omega(a) * t;
  const e = eccentricity(a), phi = tilt(a) + G.PATTERN * t;
  const ex = a * Math.cos(theta), ey = a * (1 - e) * Math.sin(theta);
  const c = Math.cos(phi), s = Math.sin(phi);
  out.x = ex * c - ey * s + sx; out.y = ex * s + ey * c + sy; out.theta = theta;
  return out;
}

// Galaxy plane → screen offset from the centre, in units of the disc radius.
export function project(p, out = { x: 0, y: 0 }) {
  const y = p.y * G.SQUASH, c = Math.cos(G.VIEW_ROT), s = Math.sin(G.VIEW_ROT);
  out.x = p.x * c - y * s; out.y = p.x * s + y * c;
  return out;
}

/* ---------- populations ---------- */
// colours are linear-ish RGB multipliers; the shader adds the stars together
export const COLOURS = {
  bulge: [1.0, 0.82, 0.6],      // old, warm yellow-white
  disc: [0.95, 0.9, 0.86],      // mixed field between the arms
  young: [0.62, 0.78, 1.0]      // hot blue-white, lit only near arm crests
};

// Per-star layout of the instance buffer.
export const STRIDE = 10;       // a, theta0, size, r, g, b, brightness, young, scatter x, scatter y
export function buildStars(seed = 1, n = G.N) {
  const rng = mulberry32(seed), data = new Float32Array(n * STRIDE);
  for (let i = 0; i < n; i++) {
    const bulge = rng() < G.BULGE;
    // bulge: tight, concentrated; disc: exponential fall-off out to the rim
    const a = bulge ? Math.abs(gaussian(rng)) * 0.09 : Math.min(1, 0.03 - Math.log(1 - rng() * 0.985) * 0.24);
    const young = !bulge && a > 0.08 && rng() < 0.32 ? 1 : 0;   // no star formation in the bulge
    const base = bulge ? COLOURS.bulge : mix(COLOURS.bulge, COLOURS.disc, smoothstep(0.08, 0.35, a));
    const col = young ? COLOURS.young : base;
    const big = rng() < 0.012;
    const o = i * STRIDE;
    data[o] = a;
    data[o + 1] = rng() * Math.PI * 2;
    data[o + 2] = big ? 2.2 + rng() * 1.4 : 0.7 + rng() * 1.1;            // CSS px
    data[o + 3] = col[0]; data[o + 4] = col[1]; data[o + 5] = col[2];
    // full brightness: overlapping stars add up past 1 in the HDR target and ACES rolls them off
    data[o + 6] = (bulge ? 0.14 : young ? 0.64 : 0.30) * (0.5 + rng()) * (big ? 1.6 : 1) * G.GAIN;
    data[o + 7] = young;
    // without scatter every star sits exactly on its ellipse and crowded arms collapse into a hard line
    const sc = G.SCATTER * (0.4 + a);
    data[o + 8] = gaussian(rng) * sc; data[o + 9] = gaussian(rng) * sc;
  }
  return data;
}

function gaussian(rng) {
  // Box–Muller
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const mix = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
