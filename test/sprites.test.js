import { test, expect } from 'bun:test';
import { SIZE_CLASSES, CLASS_WEIGHTS, SPRITE_SCALE, pickClass, buildSprites } from '../src/sprites.js';

test('there are 3–4 graded size classes, brightest first', () => {
  expect(SIZE_CLASSES.length).toBeGreaterThanOrEqual(3);
  expect(SIZE_CLASSES.length).toBeLessThanOrEqual(4);
  for (let i = 1; i < SIZE_CLASSES.length; i++) {
    expect(SIZE_CLASSES[i].core).toBeLessThan(SIZE_CLASSES[i - 1].core);
    expect(SIZE_CLASSES[i].glow).toBeLessThan(SIZE_CLASSES[i - 1].glow);
  }
  for (const c of SIZE_CLASSES) expect(c.glow).toBeGreaterThan(c.core);
});

test('class weights sum to 1 and pickClass follows them', () => {
  expect(CLASS_WEIGHTS.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  expect(CLASS_WEIGHTS.length).toBe(SIZE_CLASSES.length);
  expect(pickClass(0)).toBe(0);
  expect(pickClass(0.999999)).toBe(SIZE_CLASSES.length - 1);
  const counts = SIZE_CLASSES.map(() => 0);
  for (let i = 0; i < 40000; i++) counts[pickClass()]++;
  counts.forEach((n, i) => expect(n / 40000).toBeCloseTo(CLASS_WEIGHTS[i], 1));
});

test('buildSprites draws one sprite per class, once, sized for max depth and DPR', () => {
  const made = [];
  const fakeCanvas = (w, h) => {
    const calls = { gradients: 0, fills: 0 };
    const canvas = {
      width: w, height: h, calls,
      getContext: () => ({
        createRadialGradient: () => { calls.gradients++; return { addColorStop() {} }; },
        fillRect: () => { calls.fills++; },
        set fillStyle(_) {}
      })
    };
    made.push(canvas);
    return canvas;
  };
  const sprites = buildSprites(fakeCanvas);
  expect(sprites.length).toBe(SIZE_CLASSES.length);
  sprites.forEach((sp, i) => {
    expect(sp.size).toBe(SIZE_CLASSES[i].glow * 2);
    expect(sp.canvas.width).toBeGreaterThanOrEqual(sp.size * SPRITE_SCALE);
    expect(sp.canvas.calls.gradients).toBe(1);
    expect(sp.canvas.calls.fills).toBe(1);
  });
  expect(made.length).toBe(SIZE_CLASSES.length);
});
