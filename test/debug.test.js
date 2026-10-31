import { test, expect } from 'bun:test';
import { createFrameStats } from '../src/debug.js';

test('frame stats report average, worst and fps once per window', () => {
  const s = createFrameStats(0.5);
  let reports = 0;
  for (let i = 0; i < 29; i++) if (s.add(1 / 60)) reports++;
  expect(reports).toBe(0);
  expect(s.add(1 / 20)).toBe(true);           // one slow frame closes the window
  expect(s.out.worstMs).toBeCloseTo(50);
  expect(s.out.avgMs).toBeGreaterThan(1000 / 60);
  expect(s.out.fps).toBeGreaterThan(50);
  expect(s.out.fps).toBeLessThan(60);
});

test('frame stats reset between windows', () => {
  const s = createFrameStats(0.1);
  for (let i = 0; i < 10; i++) s.add(0.02);   // first window, closes at 0.1 s
  for (let i = 0; i < 20; i++) s.add(0.005);
  expect(s.out.worstMs).toBeCloseTo(5);
});
