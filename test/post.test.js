import { test, expect } from 'bun:test';
import { aces, bloomLevels, POST, FINAL_FS, DOWN_FS } from '../src/galaxy/shaders.js';

test('aces maps 0 to 0, stays in [0, 1] and never decreases', () => {
  expect(aces(0)).toBe(0);
  let prev = 0;
  for (let x = 0; x <= 50; x += 0.01) {
    const y = aces(x);
    expect(y).toBeGreaterThanOrEqual(prev - 1e-12);
    expect(y).toBeLessThanOrEqual(1);
    prev = y;
  }
});

test('aces keeps faint values near where they were authored and rolls off highlights', () => {
  expect(aces(0.08)).toBeCloseTo(0.09, 2);
  expect(aces(1)).toBeCloseTo(0.80, 2);
  expect(aces(6)).toBeGreaterThan(0.98);
});

test('the shader tone map uses the same curve as the JS copy', () => {
  expect(FINAL_FS).toContain('(x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)');
});

test('the first downsample step can switch on the Karis average', () => {
  expect(DOWN_FS).toContain('u_karis');
  expect(DOWN_FS).toContain('1.0 / (1.0 + dot(c');
});

test('bloom levels halve from the scene size', () => {
  expect(bloomLevels(1422, 1546)).toEqual([[711, 773], [355, 386], [177, 193], [88, 96], [44, 48], [22, 24]]);
});

test('bloom levels stop before the short side drops below the minimum', () => {
  const lv = bloomLevels(200, 60);
  expect(lv).toEqual([[100, 30], [50, 15]]);
  for (const [w, h] of bloomLevels(3000, 37)) expect(Math.min(w, h)).toBeGreaterThanOrEqual(POST.MIN_LEVEL);
});

test('bloom levels are capped and empty for a tiny scene', () => {
  expect(bloomLevels(8000, 8000).length).toBe(6);
  expect(bloomLevels(12, 12)).toEqual([]);
});
