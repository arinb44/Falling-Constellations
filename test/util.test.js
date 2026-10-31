import { test, expect } from 'bun:test';
import { rand, randInt, pick, clamp01, smooth, gauss } from '../src/util.js';

test('rand stays in [a, b)', () => {
  for (let i = 0; i < 1000; i++) {
    const v = rand(-3, 7);
    expect(v).toBeGreaterThanOrEqual(-3);
    expect(v).toBeLessThan(7);
  }
});

test('randInt is inclusive and covers both ends', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(randInt(5, 11));
  expect([...seen].sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9, 10, 11]);
});

test('pick returns an element of the array', () => {
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 100; i++) expect(arr).toContain(pick(arr));
});

test('smooth clamps, hits endpoints and rises monotonically', () => {
  expect(smooth(-1)).toBe(0);
  expect(smooth(0)).toBe(0);
  expect(smooth(0.5)).toBeCloseTo(0.5);
  expect(smooth(1)).toBe(1);
  expect(smooth(2)).toBe(1);
  let prev = -1;
  for (let x = 0; x <= 1; x += 0.01) { const v = smooth(x); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  expect(clamp01(1.5)).toBe(1);
});

test('gauss is centred on zero within [-1, 1]', () => {
  let sum = 0;
  for (let i = 0; i < 20000; i++) { const g = gauss(); expect(Math.abs(g)).toBeLessThanOrEqual(1); sum += g; }
  expect(Math.abs(sum / 20000)).toBeLessThan(0.02);
});
