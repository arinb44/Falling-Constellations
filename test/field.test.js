import { test, expect } from 'bun:test';
import { mulberry32, makeNoise } from '../src/sky/noise.js';
import {
  makeClouds, CLOUD_COUNT, cloudPixels, NEBULA_PEAK, PULSE, pulseShape, pulse, makeLanes, dustAlpha, DUST_MAX_ALPHA,
  makeDistantGalaxies, makeClusters, fieldOrigin, FIELD_MARGIN, createField,
  MOTION, addMotion, galaxyShimmer, galaxyMatrix, clusterStar, clusterStarData, swirlOmega
} from '../src/sky/field.js';

test('clouds avoid the galaxy core and use the nebula palette', () => {
  for (let s = 0; s < 50; s++) {
    for (const c of makeClouds(mulberry32(s), 1.6)) {
      expect(Math.hypot((c.u - 0.5) * 1.6, c.v - 0.5)).toBeGreaterThanOrEqual(0.28);
      expect(c.r).toBeGreaterThan(0.2);
    }
  }
});

test('clouds spread around the whole sky instead of bunching on one side', () => {
  for (let s = 0; s < 200; s++) {
    for (const aspect of [0.5, 1, 1.8]) {
      const cs = makeClouds(mulberry32(s), aspect);
      expect(cs.length).toBe(CLOUD_COUNT);
      const quads = new Set(cs.map(c => (c.u < 0.5 ? 0 : 1) + (c.v < 0.5 ? 0 : 2)));
      expect(quads.size).toBeGreaterThanOrEqual(3);
      const cu = cs.reduce((a, c) => a + c.u, 0) / cs.length, cv = cs.reduce((a, c) => a + c.v, 0) / cs.length;
      expect(Math.hypot(cu - 0.5, cv - 0.5)).toBeLessThan(0.15);    // balanced around the centre
      for (let i = 0; i < cs.length; i++) expect(cs[i].colour).not.toBe(cs[(i + 1) % cs.length].colour);
    }
  }
});

test('each cloud bakes on its own, cropped to its bounding box, faint and partly filled', () => {
  const rng = mulberry32(3), noise = makeNoise(rng);
  const w = 120, h = 80;
  for (const c of makeClouds(rng, w / h)) {
    const img = cloudPixels(w, h, c, noise);
    expect(img.rgba.length).toBe(img.cw * img.ch * 4);
    expect(img.x0).toBeGreaterThanOrEqual(0); expect(img.x0 + img.cw).toBeLessThanOrEqual(w);
    expect(img.cw).toBeLessThan(w);                                // cropped, not the whole field
    let lit = 0, max = 0;
    for (let i = 0; i < img.rgba.length; i += 4) {
      expect(img.rgba[i + 3]).toBe(255);
      const m = Math.max(img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]);
      if (m > 2) lit++; max = Math.max(max, m);
    }
    expect(lit).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(NEBULA_PEAK + 1);
  }
});

test('pulse shape swells, peaks, then settles back to rest', () => {
  expect(pulseShape(-1)).toBe(0);
  expect(pulseShape(0)).toBe(0);
  expect(pulseShape(PULSE.RISE)).toBeCloseTo(1);
  expect(pulseShape(PULSE.RISE + PULSE.FALL)).toBeLessThan(0.06);
  expect(pulseShape(PULSE.RISE + PULSE.FALL * 2)).toBe(0);
  let prev = 2;
  for (let x = PULSE.RISE; x < PULSE.RISE + PULSE.FALL * 1.5; x += 0.1) { const v = pulseShape(x); expect(v).toBeLessThanOrEqual(prev); prev = v; }
});

test('each cloud pulses at random intervals, peaking at 2.2x and never cut short', () => {
  const rng = mulberry32(11), clouds = makeClouds(rng, 1.5);
  const starts = clouds.map(() => []), peak = clouds.map(() => 1);
  for (let t = 0; t < 600; t += 1 / 30) clouds.forEach((c, i) => {
    const before = c.pulseAt, b = pulse(c, t, rng);
    if (c.pulseAt !== before) starts[i].push(t);
    expect(b).toBeGreaterThanOrEqual(1); expect(b).toBeLessThanOrEqual(1 + PULSE.GAIN + 1e-9);
    peak[i] = Math.max(peak[i], b);
  });
  for (let i = 0; i < clouds.length; i++) {
    expect(peak[i]).toBeCloseTo(1 + PULSE.GAIN, 1);
    expect(starts[i].length).toBeGreaterThan(600 / PULSE.MAX_GAP - 2);
    const gaps = starts[i].slice(1).map((s, k) => s - starts[i][k]);
    for (const g of gaps) { expect(g).toBeGreaterThanOrEqual(PULSE.MIN_GAP - 0.05); expect(g).toBeLessThanOrEqual(PULSE.MAX_GAP + 0.05); }
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(2);   // intervals vary
  }
  // clouds don't pulse in lockstep
  expect(new Set(starts.map(s => s[0].toFixed(1))).size).toBeGreaterThan(1);
});

test('dust is a partial black mask capped at its max alpha', () => {
  const rng = mulberry32(5), noise = makeNoise(rng);
  const w = 120, h = 80, a = dustAlpha(w, h, makeLanes(rng, 2), noise);
  expect(a.length).toBe(w * h);
  let covered = 0, max = 0;
  for (const v of a) { if (v > 5) covered++; max = Math.max(max, v); }
  expect(max).toBeLessThanOrEqual(Math.ceil(DUST_MAX_ALPHA * 255));
  expect(max).toBeGreaterThan(40);
  expect(covered / a.length).toBeGreaterThan(0.01);
  expect(covered / a.length).toBeLessThan(0.5);
});

test('distant galaxies are few, small and faint', () => {
  for (let s = 0; s < 50; s++) {
    const gs = makeDistantGalaxies(mulberry32(s));
    expect(gs.length).toBeGreaterThanOrEqual(4); expect(gs.length).toBeLessThanOrEqual(7);
    for (const g of gs) {
      expect(g.size).toBeGreaterThanOrEqual(5); expect(g.size).toBeLessThanOrEqual(20);
      expect(g.alpha).toBeLessThanOrEqual(0.5);
      expect(g.ratio).toBeGreaterThan(0.2); expect(g.ratio).toBeLessThanOrEqual(0.85);
    }
  }
});

test('clusters are small and dense, with stars inside their radius', () => {
  for (let s = 0; s < 50; s++) {
    const cs = makeClusters(mulberry32(s));
    expect(cs.length).toBeGreaterThanOrEqual(2); expect(cs.length).toBeLessThanOrEqual(4);
    for (const c of cs) {
      expect(c.stars.length).toBeGreaterThanOrEqual(30);
      for (const st of c.stars) expect(Math.hypot(st.dx, st.dy)).toBeLessThanOrEqual(c.radius);
      const inner = c.stars.filter(st => Math.hypot(st.dx, st.dy) < c.radius / 2).length;
      expect(inner / c.stars.length).toBeGreaterThan(0.5);        // concentrated toward the middle
    }
  }
});

test('the field drifts slowly and never shows its edge', () => {
  const W = 1200, H = 800, o = { x: 0, y: 0 };
  let prev = fieldOrigin(0, W, H, { x: 0, y: 0 });
  for (let t = 0; t < 3000; t += 0.5) {
    fieldOrigin(t, W, H, o);
    expect(o.x).toBeLessThanOrEqual(0); expect(o.y).toBeLessThanOrEqual(0);
    expect(o.x + W * (1 + 2 * FIELD_MARGIN)).toBeGreaterThanOrEqual(W);
    expect(o.y + H * (1 + 2 * FIELD_MARGIN)).toBeGreaterThanOrEqual(H);
    expect(Math.hypot(o.x - prev.x, o.y - prev.y)).toBeLessThan(3);   // < 6 px/s
    prev = { ...o };
  }
});

test('createField bakes from a seed and the same seed gives the same sky', () => {
  const fake = (w, h) => ({ width: w, height: h, getContext: () => fakeCtx(w, h) });
  const a = createField(1234, fake), b = createField(1234, fake);
  a.bake(300, 200); b.bake(300, 200);
  expect(a.w).toBe(Math.round(300 * 1.2 / 3));
  expect(a.clouds.map(c => c.rgba)).toEqual(b.clouds.map(c => c.rgba));
  expect(a.galaxies.map(g => g.u)).toEqual(b.galaxies.map(g => g.u));
  a.clouds[0].next = 123;
  a.bake(600, 200);                                              // resize keeps the same objects
  expect(a.galaxies.map(g => g.u)).toEqual(b.galaxies.map(g => g.u));
  expect(a.clouds[0].next).toBe(123);                            // ...and each cloud's pulse timer
  expect(a.version).toBe(2);
});

/* ---------- motion ---------- */
const moving = seed => {
  const rng = mulberry32(seed), galaxies = makeDistantGalaxies(rng), clusters = makeClusters(rng);
  addMotion(galaxies, clusters, mulberry32(seed ^ 7));
  return { galaxies, clusters };
};

test('motion leaves the layout of a seed unchanged', () => {
  const fake = (w, h) => ({ width: w, height: h, getContext: () => fakeCtx(w, h) });
  const f = createField(99, fake), rng = mulberry32(99);
  makeNoise(rng); makeLanes(rng);
  expect(f.galaxies.map(g => [g.u, g.v, g.size])).toEqual(makeDistantGalaxies(rng).map(g => [g.u, g.v, g.size]));
  for (const g of f.galaxies) { expect(g.face.size).toBe(g.sprite.size); expect(g.spin).not.toBe(0); }
  for (const c of f.clusters) expect(c.glow.size).toBe(c.sprite.size);
});

test('distant galaxies spin slowly in their own plane and shimmer gently', () => {
  for (let s = 0; s < 30; s++) for (const g of moving(s).galaxies) {
    const period = 2 * Math.PI / Math.abs(g.spin);
    expect(period).toBeGreaterThanOrEqual(MOTION.SPIN_PERIOD[0]); expect(period).toBeLessThanOrEqual(MOTION.SPIN_PERIOD[1]);
    for (let t = 0; t < 60; t += 0.37) {
      const b = galaxyShimmer(g, t);
      expect(b).toBeGreaterThanOrEqual(1 - MOTION.SHIMMER - 1e-9); expect(b).toBeLessThanOrEqual(1 + MOTION.SHIMMER + 1e-9);
      expect(Math.abs(galaxyShimmer(g, t + 0.016) - b)).toBeLessThan(0.01);   // smooth
    }
  }
});

test('the spin turns the arms but keeps the oval outline', () => {
  const M = new Float32Array(4);
  for (const g of moving(3).galaxies) {
    // points on the on-screen outline (an ellipse: tilt, ratio) always map to the sprite's unit circle
    for (const t of [0, 17, 95, 400]) {
      galaxyMatrix(g, t, M);
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * 2 * Math.PI, ex = Math.cos(a), ey = g.ratio * Math.sin(a);
        const x = ex * Math.cos(g.tilt) - ey * Math.sin(g.tilt), y = ex * Math.sin(g.tilt) + ey * Math.cos(g.tilt);
        const u = M[0] * x + M[2] * y, v = M[1] * x + M[3] * y;
        expect(Math.hypot(u, v)).toBeCloseTo(1, 5);
      }
    }
    // ...while a fixed screen point lands on a different part of the sprite as time passes
    const p0 = galaxyMatrix(g, 0, new Float32Array(4)), p1 = galaxyMatrix(g, 30, new Float32Array(4));
    expect(Math.hypot(p0[0] - p1[0], p0[1] - p1[1])).toBeGreaterThan(0.05);
  }
});

test('cluster stars swirl around the centre without drifting apart, inner ones faster', () => {
  for (let s = 0; s < 20; s++) for (const cl of moving(s).clusters) {
    const core = 2 * Math.PI / Math.abs(cl.omega);
    expect(core).toBeGreaterThanOrEqual(MOTION.SWIRL_PERIOD[0]); expect(core).toBeLessThanOrEqual(MOTION.SWIRL_PERIOD[1]);
    const p = { x: 0, y: 0, a: 0 };
    for (const st of cl.stars) {
      const r = Math.hypot(st.dx, st.dy);
      for (const t of [0, 13, 200]) { clusterStar(cl, st, t, p); expect(Math.hypot(p.x, p.y)).toBeCloseTo(r, 6); }
    }
    const sorted = [...cl.stars].sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
    expect(Math.abs(swirlOmega(cl, sorted[0]))).toBeGreaterThanOrEqual(Math.abs(swirlOmega(cl, sorted[sorted.length - 1])));
  }
});

test('cluster stars twinkle within range, each on its own timer', () => {
  const [mid, amp] = MOTION.TWINKLE, p = { x: 0, y: 0, a: 0 };
  for (const cl of moving(5).clusters) {
    for (const st of cl.stars) {
      expect(st.period).toBeGreaterThanOrEqual(MOTION.TWINKLE_PERIOD[0]); expect(st.period).toBeLessThanOrEqual(MOTION.TWINKLE_PERIOD[1]);
      for (let t = 0; t < 20; t += 0.23) {
        const k = clusterStar(cl, st, t, p).a / st.a;
        expect(k).toBeGreaterThanOrEqual(mid - amp - 1e-9); expect(k).toBeLessThanOrEqual(mid + amp + 1e-9);
      }
    }
    expect(new Set(cl.stars.map(st => st.phase)).size).toBe(cl.stars.length);
  }
});

test('clusterStarData packs one instance per cluster star', () => {
  const { clusters } = moving(8), d = clusterStarData(clusters), S = MOTION.CLUSTER_STRIDE;
  expect(d.length).toBe(clusters.reduce((k, c) => k + c.stars.length, 0) * S);
  const cl = clusters[0], st = cl.stars[0];
  expect([...d.slice(0, S)].map(v => +v.toFixed(4))).toEqual(
    [cl.u, cl.v, st.dx, st.dy, st.s * 0.6, st.a, swirlOmega(cl, st), st.period, st.phase, cl.blue ? 1 : 0].map(v => +Math.fround(v).toFixed(4)));
});

function fakeCtx(w, h) {
  const grad = { addColorStop() {} };
  return {
    translate() {}, rotate() {}, scale() {}, beginPath() {}, arc() {}, fill() {}, fillRect() {},
    moveTo() {}, lineTo() {}, stroke() {}, putImageData() {},
    createRadialGradient: () => grad,
    createImageData: (iw, ih) => ({ data: new Uint8ClampedArray(iw * ih * 4) })
  };
}
