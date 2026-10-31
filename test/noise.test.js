import { test, expect } from 'bun:test';
import { mulberry32, makeNoise, fbm, warped } from '../src/sky/noise.js';

test('mulberry32 is deterministic per seed and uniform-ish in [0, 1)', () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b), sc = Array.from({ length: 5 }, c);
  expect(sa).toEqual(sb);
  expect(sa).not.toEqual(sc);
  const r = mulberry32(7); let sum = 0;
  for (let i = 0; i < 20000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); sum += v; }
  expect(sum / 20000).toBeCloseTo(0.5, 1);
});

test('noise is deterministic, continuous and roughly within [-1, 1]', () => {
  const n1 = makeNoise(mulberry32(1)), n2 = makeNoise(mulberry32(1));
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 5000; i++) {
    const x = i * 0.137, y = i * 0.071;
    const v = n1(x, y);
    expect(v).toBe(n2(x, y));
    lo = Math.min(lo, v); hi = Math.max(hi, v);
    expect(Math.abs(n1(x + 1e-4, y) - v)).toBeLessThan(0.01);   // no jumps between neighbours
  }
  expect(lo).toBeGreaterThanOrEqual(-1.05); expect(hi).toBeLessThanOrEqual(1.05);
  expect(hi - lo).toBeGreaterThan(1);                             // actually varies
  expect(n1(3, 7)).toBeCloseTo(0);                                // zero on lattice points
});

test('fbm and domain warp stay bounded and differ from plain noise', () => {
  const n = makeNoise(mulberry32(9));
  let diff = 0;
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.31, y = i * 0.17;
    const f = fbm(n, x, y), w = warped(n, x, y);
    expect(Math.abs(f)).toBeLessThanOrEqual(1.05);
    expect(Math.abs(w)).toBeLessThanOrEqual(1.05);
    diff += Math.abs(w - f);
  }
  expect(diff / 2000).toBeGreaterThan(0.05);
});
