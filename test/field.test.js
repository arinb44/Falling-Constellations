import { test, expect } from 'bun:test';
import { mulberry32, makeNoise } from '../src/sky/noise.js';
import {
  makeClouds, CLOUD_COUNT, cloudPixels, NEBULA_PEAK, PULSE, pulseShape, pulse, makeLanes, dustAlpha, DUST_MAX_ALPHA,
  makeDistantGalaxies, makeClusters, fieldOrigin, FIELD_MARGIN, createField
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

function fakeCtx(w, h) {
  const grad = { addColorStop() {} };
  return {
    translate() {}, rotate() {}, scale() {}, beginPath() {}, arc() {}, fill() {}, fillRect() {},
    moveTo() {}, lineTo() {}, stroke() {}, putImageData() {},
    createRadialGradient: () => grad,
    createImageData: (iw, ih) => ({ data: new Uint8ClampedArray(iw * ih * 4) })
  };
}
