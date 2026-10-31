import { test, expect } from 'bun:test';
import { makeConstellation, targetCount, brightestIndex, makeInk, INK_CREAM, INK_GOLD, lineWidthFor, gapFor,
  starIn, fullyOnScreen, edgeProgress, STAR_STAGGER, STAR_FADE, SCREEN_MARGIN } from '../src/constellation.js';
import { SIZE_CLASSES } from '../src/sprites.js';

const RUNS = 300;
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Union-find over the edges: true when every star is reachable from star 0.
function connected(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const [a, b] of edges) parent[find(a)] = find(b);
  return new Set(parent.map((_, i) => find(i))).size === 1;
}

test('star count is 5–11 and stars keep at least 28 px apart', () => {
  for (let r = 0; r < RUNS; r++) {
    const { pts } = makeConstellation(0, 0, false);
    expect(pts.length).toBeGreaterThanOrEqual(5);
    expect(pts.length).toBeLessThanOrEqual(11);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
      expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(28);
  }
});

test('stars are centred on their centroid', () => {
  for (let r = 0; r < RUNS; r++) {
    const { pts } = makeConstellation(0, 0, false);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    expect(Math.abs(cx)).toBeLessThan(1e-9);
    expect(Math.abs(cy)).toBeLessThan(1e-9);
  }
});

test('edges form a connected spanning tree plus at most 2 unique extra edges', () => {
  for (let r = 0; r < RUNS; r++) {
    const { pts, edges } = makeConstellation(0, 0, false);
    expect(edges.length).toBeGreaterThanOrEqual(pts.length - 1);
    expect(edges.length).toBeLessThanOrEqual(pts.length + 1);
    expect(connected(pts.length, edges)).toBe(true);
    const keys = edges.map(([a, b]) => key(a, b));
    expect(new Set(keys).size).toBe(keys.length);
    for (const [a, b] of edges) expect(a).not.toBe(b);
  }
});

test('depth, speed and spawn position follow the prototype rules', () => {
  for (let r = 0; r < RUNS; r++) {
    const c = makeConstellation(100, 200, true);
    expect(c.depth).toBeGreaterThanOrEqual(0.55);
    expect(c.depth).toBeLessThan(1.35);
    expect(c.vy).toBeGreaterThanOrEqual(16 + 30 * c.depth - 4);
    expect(c.vy).toBeLessThan(16 + 30 * c.depth + 4);
    expect(c.y).toBeCloseTo(-160 * c.depth);
    expect(makeConstellation(100, 200, false).y).toBe(200);
  }
});

test('targetCount scales with width with a floor of 5', () => {
  expect(targetCount({ W: 300 })).toBe(5);
  expect(targetCount({ W: 1280 })).toBe(10);
});

test('every star has a size class and each figure has a bright anchor star', () => {
  for (let r = 0; r < RUNS; r++) {
    const { pts } = makeConstellation(0, 0, false);
    for (const p of pts) { expect(p.cls).toBeGreaterThanOrEqual(0); expect(p.cls).toBeLessThan(SIZE_CLASSES.length); }
    expect(pts.some(p => p.cls <= 1)).toBe(true);
  }
});

test('ink is one cream/gold colour between the two endpoints', () => {
  const rgb = s => s.match(/\d+/g).map(Number);
  expect(rgb(makeInk(0))).toEqual(INK_CREAM);
  expect(rgb(makeInk(1))).toEqual(INK_GOLD);
  for (let r = 0; r < RUNS; r++) {
    const c = rgb(makeConstellation(0, 0, false).ink);
    c.forEach((v, i) => {
      expect(v).toBeGreaterThanOrEqual(Math.min(INK_CREAM[i], INK_GOLD[i]));
      expect(v).toBeLessThanOrEqual(Math.max(INK_CREAM[i], INK_GOLD[i]));
    });
  }
});

test('lines are ~0.7–1 px across the depth range and gaps clear the star core', () => {
  expect(lineWidthFor(0.55)).toBeCloseTo(0.7);
  expect(lineWidthFor(1.35)).toBeCloseTo(1.0);
  expect(lineWidthFor(0.1)).toBeCloseTo(0.7);
  SIZE_CLASSES.forEach((c, i) => expect(gapFor(i, 1)).toBeGreaterThan(c.core));
  expect(gapFor(0, 1)).toBeGreaterThan(gapFor(3, 1));
});

test('constellations carry no name label', () => {
  expect(makeConstellation(0, 0, false).name).toBeUndefined();
});

test('stars fade in one at a time, in order', () => {
  expect(starIn(0, 0)).toBe(0);
  expect(starIn(STAR_FADE, 0)).toBe(1);
  expect(starIn(STAR_STAGGER * 3, 3)).toBe(0);          // star 3 has not started yet
  expect(starIn(STAR_STAGGER * 3 + STAR_FADE, 3)).toBe(1);
  for (let age = 0; age < 3; age += 0.05) expect(starIn(age, 2)).toBeLessThanOrEqual(starIn(age, 1));
});

test('lines start only when the whole figure is inside the viewport', () => {
  const H = 800;
  expect(fullyOnScreen(SCREEN_MARGIN, H - SCREEN_MARGIN, H)).toBe(true);
  expect(fullyOnScreen(-10, 300, H)).toBe(false);        // top star still above the screen
  expect(fullyOnScreen(100, H + 5, H)).toBe(false);      // bottom star below the screen
});

test('edges ease in one after another with overlap and all finish by prog = 1', () => {
  for (const n of [4, 7, 12]) {
    for (let i = 0; i < n; i++) {
      expect(edgeProgress(0, i, n)).toBe(0);
      expect(edgeProgress(1, i, n)).toBeCloseTo(1);
    }
    for (let p = 0; p <= 1; p += 0.02)
      for (let i = 1; i < n; i++) expect(edgeProgress(p, i, n)).toBeLessThanOrEqual(edgeProgress(p, i - 1, n));
    // overlap: the next edge has begun before the previous one finishes
    const step = 1 / (n - 1 + 1.6);
    expect(edgeProgress(step * 1.2, 1, n)).toBeGreaterThan(0);
    expect(edgeProgress(step * 1.2, 0, n)).toBeLessThan(1);
  }
});

test('draw-in lasts 2–4 s and lines have not started at birth', () => {
  for (let r = 0; r < RUNS; r++) {
    const c = makeConstellation(0, 0, false);
    expect(c.drawIn).toBeGreaterThanOrEqual(2);
    expect(c.drawIn).toBeLessThan(4);
    expect(c.linesAt).toBe(-1);
  }
});

test('each figure puts its diffraction spike on its brightest star', () => {
  for (let i = 0; i < 100; i++) {
    const c = makeConstellation(0, 0, false);
    const min = Math.min(...c.pts.map(p => p.cls));
    expect(c.pts[c.spike].cls).toBe(min);
    expect(c.pts[c.spike].cls).toBeLessThanOrEqual(1);
  }
  expect(brightestIndex([{ cls: 2 }, { cls: 0 }, { cls: 0 }])).toBe(1);   // first on a tie
});
