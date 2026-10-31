import { test, expect } from 'bun:test';
import { GRID, gridLines, createGrid } from '../src/grid.js';
import { fakeCtx } from './fakes.js';

const SIZES = [[711, 773], [1440, 900], [390, 760], [2560, 1080]];

test('the pole is off-screen above the sky', () => {
  for (const [W, H] of SIZES) {
    const L = gridLines(W, H);
    expect(L.py).toBeLessThan(0);
    expect(L.rMin).toBeGreaterThan(0);
  }
});

test('parallels and meridians all cross the screen, and there are a few of each', () => {
  for (const [W, H] of SIZES) {
    const L = gridLines(W, H);
    expect(L.parallels.length).toBeGreaterThanOrEqual(2);
    expect(L.meridians.length).toBeGreaterThanOrEqual(2);
    for (const r of L.parallels) { expect(r).toBeGreaterThanOrEqual(L.rMin); expect(r).toBeLessThanOrEqual(L.rMax); }
    for (const a of L.meridians) { expect(a).toBeGreaterThanOrEqual(L.aMin); expect(a).toBeLessThanOrEqual(L.aMax); }
    // evenly spaced
    for (let i = 1; i < L.parallels.length; i++) expect(L.parallels[i] - L.parallels[i - 1]).toBeCloseTo(GRID.PARALLEL_STEP * H);
    for (let i = 1; i < L.meridians.length; i++) expect(L.meridians[i] - L.meridians[i - 1]).toBeCloseTo(GRID.MERIDIAN_DEG * Math.PI / 180);
  }
});

test('every meridian passes through the screen', () => {
  for (const [W, H] of SIZES) {
    const L = gridLines(W, H);
    for (const a of L.meridians) {
      // sample along the ray; some sample must land inside the screen
      let inside = false;
      for (let k = 0; k <= 200 && !inside; k++) {
        const r = L.rMin + (L.rMax - L.rMin) * k / 200;
        const x = L.px + r * Math.cos(a), y = L.py + r * Math.sin(a);
        inside = x >= -1e-6 && x <= W + 1e-6 && y >= -1e-6 && y <= H + 1e-6;
      }
      expect(inside).toBe(true);
    }
  }
});

test('the grid is barely visible', () => {
  expect(GRID.ALPHA).toBeLessThanOrEqual(0.08);
  expect(GRID.WIDTH).toBeLessThanOrEqual(1);
});

test('createGrid pre-renders once per resize and draws with one drawImage', () => {
  let made = 0, strokes = 0, arcs = 0;
  const fakeCanvas = (w, h) => {
    made++;
    return {
      width: w, height: h,
      getContext: () => ({
        setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {},
        arc() { arcs++; }, stroke() { strokes++; },
        strokeStyle: '', lineWidth: 1
      })
    };
  };
  const grid = createGrid(fakeCanvas);
  const ctx = fakeCtx();
  grid.draw(ctx);
  expect(ctx.calls.drawImage).toBe(0);   // nothing before the first resize
  grid.resize(711, 773, 2);
  expect(made).toBe(1);
  expect(strokes).toBe(1);
  expect(arcs).toBe(gridLines(711, 773).parallels.length);
  for (let i = 0; i < 5; i++) grid.draw(ctx);
  expect(ctx.calls.drawImage).toBe(5);
  expect(made).toBe(1);
});
