/* ---------- galaxy structure: arm map, dust, gas and H-II knots (pure) ---------- */
// The ellipses are fixed in a frame that turns at G.PATTERN, so where the arms sit in that
// frame never changes. Everything here is baked once in that frame (galaxy plane, t = 0)
// and the GPU only rotates it. Grids are n × n over [-EXT, EXT]², row 0 at y = -EXT.
import { G, STRIDE, orbit, armness } from './model.js';
import { mulberry32, makeNoise, fbm, warped } from '../sky/noise.js';

export const S = {
  N: 256,                // bake resolution (soft layers: about quarter screen resolution)
  EXT: 1.12,             // half-size of the baked square, in disc radii
  DUST: 0.55,            // peak darkening of the dust lanes
  EDGE: 0.04,            // width of the edge test that finds an arm's inner/outer side (disc radii)
  GAS: 0.12,             // peak gas brightness in scene units, before G.GAIN
  KNOTS: 140,
  KNOT_STRIDE: 6         // x, y, size, r, g, b
};

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = x => Math.min(1, Math.max(0, x));

// grid cell ↔ galaxy plane
const toPlane = (i, n) => ((i + 0.5) / n * 2 - 1) * S.EXT;
const toCell = (x, n) => (x / S.EXT + 1) / 2 * n - 0.5;

export function bilinear(map, n, x, y) {
  const fx = toCell(x, n), fy = toCell(y, n);
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  const at = (a, b) => (a < 0 || b < 0 || a >= n || b >= n ? 0 : map[b * n + a]);
  return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
}

// value of the map at the same angle but radius r + dr
export function radial(map, n, x, y, dr) {
  const r = Math.hypot(x, y);
  if (r < 1e-6) return 0;
  const k = Math.max(0, r + dr) / r;
  return bilinear(map, n, x * k, y * k);
}

// Arms are bands about 0.1 disc radii wide. Their inner edge is where the map rises going
// outward, their outer edge where it falls: compare just outside with just inside. 0..1.
export const innerEdge = (map, n, x, y) => clamp01(radial(map, n, x, y, S.EDGE) - radial(map, n, x, y, -S.EDGE * 0.5));
export const outerEdge = (map, n, x, y) => clamp01(radial(map, n, x, y, -S.EDGE) - radial(map, n, x, y, S.EDGE * 0.5));

function blur(map, n, sigma) {
  const rad = Math.ceil(sigma * 3), w = [];
  let sum = 0;
  for (let k = -rad; k <= rad; k++) { w.push(Math.exp(-k * k / (2 * sigma * sigma))); sum += w[w.length - 1]; }
  for (let k = 0; k < w.length; k++) w[k] /= sum;
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -rad; k <= rad; k++) { const a = i + k; if (a >= 0 && a < n) s += map[j * n + a] * w[k + rad]; }
    tmp[j * n + i] = s;
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -rad; k <= rad; k++) { const b = j + k; if (b >= 0 && b < n) s += tmp[b * n + i] * w[k + rad]; }
    out[j * n + i] = s;
  }
  return out;
}

// 0..1 map of the arm crests: star density weighted by how close each star is to a crest,
// divided by the mean at that radius so outer arms count as much as inner ones.
export function armMap(stars, n = S.N, sigma = 1.5) {
  const map = new Float32Array(n * n), p = { x: 0, y: 0, theta: 0 };
  for (let o = 0; o < stars.length; o += STRIDE) {
    const a = stars[o];
    const w = armness(stars[o + 1]) * smoothstep(0.08, 0.2, a);   // t = 0: theta = theta0
    if (w <= 0) continue;
    orbit(a, stars[o + 1], 0, p, stars[o + 8], stars[o + 9]);
    const fx = toCell(p.x, n), fy = toCell(p.y, n), i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) continue;
    const u = fx - i, v = fy - j;
    map[j * n + i] += w * (1 - u) * (1 - v); map[j * n + i + 1] += w * u * (1 - v);
    map[(j + 1) * n + i] += w * (1 - u) * v; map[(j + 1) * n + i + 1] += w * u * v;
  }
  const b = blur(map, n, sigma);
  // ring means over 64 radial bins
  const BINS = 64, sum = new Float64Array(BINS), cnt = new Float64Array(BINS);
  const bin = r => Math.min(BINS - 1, Math.floor(r / S.EXT * BINS));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.hypot(toPlane(i, n), toPlane(j, n));
    if (r > S.EXT) continue;
    sum[bin(r)] += b[j * n + i]; cnt[bin(r)]++;
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.hypot(toPlane(i, n), toPlane(j, n));
    const mean = r > S.EXT ? 0 : sum[bin(r)] / Math.max(1, cnt[bin(r)]);
    b[j * n + i] = mean > 0 ? smoothstep(1.2, 3.0, b[j * n + i] / mean) : 0;
  }
  return b;
}

const discEdge = r => 1 - smoothstep(0.78, 1.0, r);

// dust: RGBA (premultiplied black), alpha = darkening. Along each arm's inner edge, mottled, none in the bulge.
export function bakeDust(arms, n = S.N, seed = 1) {
  const noise = makeNoise(mulberry32(seed ^ 0x2545f491)), out = new Float32Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = toPlane(i, n), y = toPlane(j, n), r = Math.hypot(x, y);
    const env = smoothstep(0.12, 0.26, r) * discEdge(r);
    if (env <= 0) continue;
    const lane = innerEdge(arms, n, x, y);
    const mottle = clamp01(0.55 + 0.9 * fbm(noise, x * 7, y * 7, 4));
    out[(j * n + i) * 4 + 3] = S.DUST * lane * env * mottle;
  }
  return out;
}

// gas: RGBA (premultiplied colour, alpha 0, drawn additively). Wispy domain-warped FBM,
// a faint disc glow plus more along the arms; warm inside, blue-violet out, pink in the arms.
export function bakeGas(arms, n = S.N, seed = 1) {
  const noise = makeNoise(mulberry32(seed ^ 0x68e31da4)), out = new Float32Array(n * n * 4);
  const broad = blur(arms, n, 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = toPlane(i, n), y = toPlane(j, n), r = Math.hypot(x, y);
    if (r > 1.05) continue;
    const disc = Math.exp(-r / 0.35) * discEdge(r * 0.95);
    const arm = broad[j * n + i] * discEdge(r);
    const wisp = clamp01(0.45 + 0.75 * warped(noise, x * 2.6, y * 2.6, 3, 4));
    const k = S.GAS * G.GAIN * wisp * (0.35 * disc + 0.9 * arm);
    const cool = smoothstep(0.1, 0.7, r), pink = clamp01(arm * 1.5);
    const o = (j * n + i) * 4;
    out[o] = k * ((1.0 - 0.55 * cool) * (1 - pink) + 0.95 * pink);
    out[o + 1] = k * ((0.75 - 0.2 * cool) * (1 - pink) + 0.45 * pink);
    out[o + 2] = k * ((0.55 + 0.45 * cool) * (1 - pink) + 0.7 * pink);
  }
  return out;
}

// A random spot on an arm's outer edge (rejection sampling, weighted by outerEdge²).
export function pickKnotSpot(arms, n, rng, out = { x: 0, y: 0 }, maxTries = 200000) {
  for (let tries = 0; tries < maxTries; tries++) {
    const r = 0.22 + rng() * 0.72, ang = rng() * Math.PI * 2;
    const x = r * Math.cos(ang), y = r * Math.sin(ang);
    const p = outerEdge(arms, n, x, y) * discEdge(r);
    if (rng() > p * p) continue;
    out.x = x; out.y = y;
    return out;
  }
  return null;
}

// H-II knots: small pink points strung along each arm's outer edge, in clumps of 1–3.
export function placeKnots(arms, n = S.N, seed = 1, count = S.KNOTS) {
  const rng = mulberry32(seed ^ 0x1b873593), out = new Float32Array(count * S.KNOT_STRIDE), spot = { x: 0, y: 0 };
  let k = 0;
  while (k < count && pickKnotSpot(arms, n, rng, spot)) {
    const x = spot.x, y = spot.y;
    const clump = 1 + Math.floor(rng() * 3);
    for (let c = 0; c < clump && k < count; c++, k++) {
      const o = k * S.KNOT_STRIDE, b = (0.4 + 0.5 * rng()) * G.GAIN;
      out[o] = x + (c ? (rng() - 0.5) * 0.02 : 0);
      out[o + 1] = y + (c ? (rng() - 0.5) * 0.02 : 0);
      out[o + 2] = 1.6 + rng() * 1.8;                      // CSS px
      out[o + 3] = b * 1.0; out[o + 4] = b * (0.38 + 0.1 * rng()); out[o + 5] = b * (0.6 + 0.1 * rng());
    }
  }
  return k < count ? out.subarray(0, k * S.KNOT_STRIDE) : out;
}

export function bakeStructure(stars, seed = 1, n = S.N) {
  const arms = armMap(stars, n);
  return { n, arms, dust: bakeDust(arms, n, seed), gas: bakeGas(arms, n, seed), knots: placeKnots(arms, n, seed) };
}
