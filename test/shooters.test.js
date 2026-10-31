import { test, expect } from 'bun:test';
import { trailSpan, FLIGHT, LINGER } from '../src/shooters.js';

const at = life => ({ ...trailSpan(life, {}) });

test('while the head flies the trail runs back to the start and the head end is opaque', () => {
  const t = at(FLIGHT * 0.5);
  expect(t.head).toBeCloseTo(FLIGHT * 0.5);
  expect(t.tail).toBe(0);
  expect(t.aHead).toBe(1);
  expect(t.aTail).toBeLessThan(1);
});

test('the far end fades first and the fade sweeps toward the head', () => {
  for (let life = 0.05; life < FLIGHT + LINGER; life += 0.05) {
    const t = at(life);
    expect(t.aTail).toBeLessThanOrEqual(t.aHead);
    expect(t.tail).toBeLessThanOrEqual(t.head);
  }
  // once the trail is longer than LINGER, its far end is fully gone
  expect(at(LINGER + 0.1).aTail).toBe(0);
});

test('the trail outlives the head, then disappears completely', () => {
  const after = at(FLIGHT + LINGER * 0.5);
  expect(after.head).toBe(FLIGHT);                      // head has stopped
  expect(after.aHead).toBeCloseTo(0.5);                 // but the trail is still there
  expect(at(FLIGHT + LINGER).aHead).toBe(0);
});

test('opacity at the head end never rises after the flight ends', () => {
  let prev = 1;
  for (let life = FLIGHT; life <= FLIGHT + LINGER; life += 0.02) {
    const a = at(life).aHead;
    expect(a).toBeLessThanOrEqual(prev + 1e-12);
    prev = a;
  }
});
