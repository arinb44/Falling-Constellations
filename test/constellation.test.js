import { test, expect } from 'bun:test';
import { makeConstellation, makeName, targetCount } from '../src/constellation.js';

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

test('names are non-empty words', () => {
  for (let r = 0; r < 100; r++) expect(makeName()).toMatch(/^([A-Z][a-z]+ )?[A-Z][a-z]+$/);
});

test('targetCount scales with width with a floor of 5', () => {
  expect(targetCount({ W: 300 })).toBe(5);
  expect(targetCount({ W: 1280 })).toBe(10);
});
