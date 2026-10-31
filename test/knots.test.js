import { test, expect } from 'bun:test';
import { buildStars } from '../src/galaxy/model.js';
import { S, bakeStructure, radial, outerEdge } from '../src/galaxy/structure.js';
import { KNOT, knotLife, armSlide, createKnots, knotAt } from '../src/galaxy/knots.js';
import { G } from '../src/galaxy/model.js';
import { KNOT_VS } from '../src/galaxy/shaders.js';

const s = bakeStructure(buildStars(1), 1);
const n = s.n;

test('a knot fades in, glows, fades out, and is dark outside its life', () => {
  const total = 2 * KNOT.FADE + 12;
  expect(knotLife(-1, total)).toBe(0);
  expect(knotLife(0, total)).toBe(0);
  expect(knotLife(KNOT.FADE, total)).toBeCloseTo(1);
  expect(knotLife(total / 2, total)).toBe(1);
  expect(knotLife(total, total)).toBe(0);
  expect(knotLife(total + 3, total)).toBe(0);
  for (let a = 0; a < total; a += 0.05) expect(Math.abs(knotLife(a + 0.05, total) - knotLife(a, total))).toBeLessThan(0.04);
});

test('the slide follows the arm spiral (dθ/dr = TWIST), the way the stars orbit', () => {
  const st = { dr: 0, dth: 0 };
  for (const r of [0.3, 0.5, 0.8]) {
    armSlide(r, 0.1, st);
    expect(st.dr).toBeGreaterThan(0); expect(st.dth).toBeGreaterThan(0);
    expect(st.dth / st.dr).toBeCloseTo(G.TWIST);
    expect(Math.hypot(st.dr, r * st.dth)).toBeCloseTo(0.1, 2);   // length along the arm
  }
});

test('knots slide slowly along their arm and stay on its outer edge', () => {
  const k = createKnots(s, 1, 0), p = { x: 0, y: 0, life: 0 };
  let startEdge = 0, endEdge = 0, onArmSide = 0;
  for (let i = 0; i < k.count; i++) {
    const o = i * KNOT.STRIDE, born = k.data[o + 8], total = k.data[o + 9];
    const r0 = Math.hypot(k.data[o], k.data[o + 1]);
    const speed = Math.hypot(k.data[o + 6], k.data[o + 7] * r0) / total;   // |(dr, r·dθ)| per second
    // clump members sit a little off the clump centre, so their radius (and speed) differs slightly
    expect(speed).toBeGreaterThanOrEqual(KNOT.SPEED[0] * 0.95); expect(speed).toBeLessThanOrEqual(KNOT.SPEED[1] * 1.05);
    knotAt(k.data, i, born, p); startEdge += outerEdge(s.arms, n, p.x, p.y);
    knotAt(k.data, i, born + total, p); endEdge += outerEdge(s.arms, n, p.x, p.y);
    // at the end of the slide the arm is still just inward of the knot
    if (radial(s.arms, n, p.x, p.y, -S.EDGE) > radial(s.arms, n, p.x, p.y, S.EDGE)) onArmSide++;
    expect(Math.hypot(p.x, p.y)).toBeLessThan(1.0);
  }
  expect(endEdge).toBeGreaterThan(startEdge * 0.6);              // most of the edge is kept
  expect(onArmSide / k.count).toBeGreaterThan(0.6);
});

test('a knot is reborn somewhere new when its life ends, and only its clump is rewritten', () => {
  const k = createKnots(s, 2, 0);
  const g0 = k.groups[0], o = g0.start * KNOT.STRIDE;
  const end = k.data[o + 8] + k.data[o + 9], x0 = k.data[o], y0 = k.data[o + 1];
  // just before: nothing reborn at the earliest death
  const earliest = Math.min(...k.groups.map(g => k.data[g.start * KNOT.STRIDE + 8] + k.data[g.start * KNOT.STRIDE + 9]));
  expect(k.update(earliest - 0.01)).toBe(0);
  const m = k.update(end);
  expect(m).toBeGreaterThanOrEqual(1);
  const changed = [...k.dirty.slice(0, m)];
  expect(changed).toContain(0);
  expect(k.data[o + 8]).toBe(end);
  expect(Math.hypot(k.data[o] - x0, k.data[o + 1] - y0)).toBeGreaterThan(0);
  expect(outerEdge(s.arms, n, k.data[o], k.data[o + 1])).toBeGreaterThan(0);
  // clump members share birth and life
  for (let c = 1; c < g0.count; c++) {
    expect(k.data[(g0.start + c) * KNOT.STRIDE + 8]).toBe(k.data[o + 8]);
    expect(k.data[(g0.start + c) * KNOT.STRIDE + 9]).toBe(k.data[o + 9]);
  }
});

test('about the same number of knots glows over ten minutes', () => {
  const k = createKnots(s, 3, 0), p = { x: 0, y: 0, life: 0 }, sums = [];
  for (let t = 0; t <= 600; t += 0.5) {
    k.update(t);
    if (t % 10 === 0) {
      let sum = 0;
      for (let i = 0; i < k.count; i++) sum += knotAt(k.data, i, t, p).life;
      sums.push(sum);
    }
  }
  const mean = sums.reduce((a, b) => a + b, 0) / sums.length;
  expect(mean).toBeGreaterThan(k.count * 0.55);
  for (const v of sums) { expect(v).toBeGreaterThan(mean * 0.6); expect(v).toBeLessThan(mean * 1.4); }
});

test('140 knots in clumps of 1–3, and the shader fades with the same constants', () => {
  const k = createKnots(s, 4, 0);
  expect(k.count).toBe(S.KNOTS);
  expect(k.groups.reduce((a, g) => a + g.count, 0)).toBe(S.KNOTS);
  for (const g of k.groups) { expect(g.count).toBeGreaterThanOrEqual(1); expect(g.count).toBeLessThanOrEqual(3); }
  expect(KNOT_VS).toContain(`smoothstep(0.0, ${KNOT.FADE.toFixed(1)}, age)`);
  expect(KNOT_VS).toContain('in vec2 slide');
});
