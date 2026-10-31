import { test, expect } from 'bun:test';
import { mulberry32, makeNoise } from '../src/sky/noise.js';
import {
  makeClouds, nebulaPixels, NEBULA_PEAK, makeLanes, dustAlpha, DUST_MAX_ALPHA,
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

test('nebula pixels are faint, opaque-black elsewhere, and actually contain cloud', () => {
  const rng = mulberry32(3), noise = makeNoise(rng);
  const w = 120, h = 80, clouds = makeClouds(rng, w / h);
  const px = nebulaPixels(w, h, clouds, noise);
  expect(px.length).toBe(w * h * 4);
  let lit = 0, max = 0;
  for (let i = 0; i < px.length; i += 4) {
    expect(px[i + 3]).toBe(255);
    const m = Math.max(px[i], px[i + 1], px[i + 2]);
    if (m > 2) lit++;
    max = Math.max(max, m);
  }
  expect(lit / (w * h)).toBeGreaterThan(0.03);   // some sky has cloud
  expect(lit / (w * h)).toBeLessThan(0.8);       // but not all of it
  expect(max).toBeLessThanOrEqual(NEBULA_PEAK * 2);   // overlapping clouds may add, still faint
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
  expect(a.nebulaRGBA).toEqual(b.nebulaRGBA);
  expect(a.galaxies.map(g => g.u)).toEqual(b.galaxies.map(g => g.u));
  a.bake(600, 200);                                              // resize keeps the same objects
  expect(a.galaxies.map(g => g.u)).toEqual(b.galaxies.map(g => g.u));
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
