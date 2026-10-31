import { test, expect } from 'bun:test';
import { createQuality, LADDER, Q, baseScale, PHONE_SCALE } from '../src/quality.js';

// feed `secs` seconds of frames at `ms` each; returns how many rung changes happened
function run(q, ms, secs) {
  let changes = 0;
  for (let t = 0; t < secs; t += ms / 1000) if (q.update(ms / 1000)) changes++;
  return changes;
}

test('phones draw the WebGL layer below full DPR, desktops and tablets do not', () => {
  expect(baseScale({ coarse: true, minSide: 390 })).toBe(PHONE_SCALE);
  expect(PHONE_SCALE).toBeGreaterThanOrEqual(0.5); expect(PHONE_SCALE).toBeLessThanOrEqual(0.75);
  expect(baseScale({ coarse: false, minSide: 390 })).toBe(1);
  expect(baseScale({ coarse: true, minSide: 1024 })).toBe(1);
});

test('the ladder gives up resolution first, then stars, then bloom', () => {
  for (let i = 1; i < LADDER.length; i++) {
    const a = LADDER[i - 1], b = LADDER[i];
    expect(b.scale <= a.scale && b.stars <= a.stars && b.bloom <= a.bloom).toBe(true);
    if (b.stars < a.stars) expect(a.scale).toBe(LADDER[LADDER.length - 2].scale);   // resolution already down
    if (b.bloom < a.bloom) expect(a.stars).toBe(Math.min(...LADDER.map(r => r.stars)));
  }
});

test('slow frames during start-up are ignored', () => {
  const q = createQuality();
  run(q, 40, Q.WARMUP - 0.1);
  expect(q.level).toBe(0);
});

test('sustained slow frames step down one rung per window', () => {
  const q = createQuality();
  run(q, 16.7, Q.WARMUP);
  run(q, 30, Q.WINDOW * 1.01);
  expect(q.level).toBe(1);
  run(q, 30, Q.WINDOW * 2.01);
  expect(q.level).toBe(3);
  run(q, 30, 60);
  expect(q.level).toBe(LADDER.length - 1);             // never past the last rung
});

test('a smooth 60 fps never steps down', () => {
  const q = createQuality();
  expect(run(q, 16.7, 60)).toBe(0);
});

test('single long hitches (tab switch, GC) do not count', () => {
  const q = createQuality();
  run(q, 16.7, Q.WARMUP + 1);
  for (let i = 0; i < 10; i++) { q.update(0.5); run(q, 16.7, 0.2); }
  expect(q.level).toBe(0);
});

test('steps back up slowly once frames are fast again', () => {
  const q = createQuality();
  run(q, 16.7, Q.WARMUP);
  run(q, 30, Q.WINDOW * 2.01);
  expect(q.level).toBe(2);
  run(q, 16.7, Q.UP_AFTER - Q.WINDOW);
  expect(q.level).toBe(2);                             // not yet
  run(q, 16.7, Q.WINDOW * 1.5);
  expect(q.level).toBe(1);
});

test('a step up that fails straight away doubles the wait before the next try', () => {
  const q = createQuality();
  run(q, 16.7, Q.WARMUP);
  run(q, 30, Q.WINDOW * 1.01);                         // down to 1
  // fast frames until it steps back up to 0, and not a frame more
  for (let t = 0; t < Q.UP_AFTER + 2 * Q.WINDOW && !q.update(0.0167); t += 0.0167);
  expect(q.level).toBe(0);
  run(q, 30, Q.WINDOW * 1.01);                         // immediately slow again
  expect(q.level).toBe(1);
  expect(q.upWait).toBe(Q.UP_AFTER * 2);
});

test('a steady rise in frame time is caught once it crosses the budget', () => {
  const q = createQuality();
  run(q, 12, Q.WARMUP);
  let ms = 12, crossedAt = -1, steppedAt = -1, t = 0;
  while (t < 40) {
    ms = 12 + t * 0.4;                                 // +0.4 ms per second, e.g. thermal throttling
    if (ms > Q.SLOW_MS && crossedAt < 0) crossedAt = t;
    if (q.update(ms / 1000) && steppedAt < 0) steppedAt = t;
    t += ms / 1000;
  }
  expect(steppedAt).toBeGreaterThan(crossedAt);
  expect(steppedAt - crossedAt).toBeLessThan(Q.WINDOW * 2 + 0.1);
});
