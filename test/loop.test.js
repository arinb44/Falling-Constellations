import { test, expect } from 'bun:test';
import { makeConstellation, drawConstellation, countAuto, recycle, fadeOutBottom, STAR_STAGGER, STAR_FADE } from '../src/constellation.js';
import { fitStars, starCountFor } from '../src/starfield.js';
import { fakeCtx, fakeSprites } from './fakes.js';

const view = { W: 1000, H: 800, DPR: 1 };
const mouse = { px: 0 };
const look = { sprites: fakeSprites() };

test('projected points are allocated once and reused every frame', () => {
  const c = makeConstellation(500, 300, false, 0);
  const P = c.P, first = P[0];
  const ctx = fakeCtx();
  for (let f = 1; f <= 30; f++) drawConstellation(ctx, view, c, f / 60, 1 / 60, mouse, look);
  expect(c.P).toBe(P);
  expect(c.P[0]).toBe(first);
  expect(P.length).toBe(c.pts.length);
});

test('stars draw first; lines start only once all stars are in and the figure is on screen', () => {
  const c = makeConstellation(500, 400, false, 0);
  c.vy = 0; c.rotSpeed = 0;                       // hold still to isolate the timing
  const ctx = fakeCtx();
  const starsDone = (c.pts.length - 1) * STAR_STAGGER + STAR_FADE;
  drawConstellation(ctx, view, c, starsDone * 0.5, 0, mouse, look);
  expect(ctx.calls.stroke).toBe(0);
  expect(ctx.calls.drawImage).toBeGreaterThan(0);
  drawConstellation(ctx, view, c, starsDone + 0.01, 0, mouse, look);
  expect(c.linesAt).toBeCloseTo(starsDone + 0.01);
  drawConstellation(ctx, view, c, starsDone + 0.01 + c.drawIn, 0, mouse, look);
  expect(ctx.calls.stroke).toBeGreaterThanOrEqual(c.edges.length - 2);   // very short edges may be skipped
});

test('a figure still above the screen waits for its lines', () => {
  const c = makeConstellation(500, 0, true, 0);
  c.vy = 0;
  const ctx = fakeCtx();
  drawConstellation(ctx, view, c, 10, 0, mouse, look);
  expect(c.linesAt).toBe(-1);
  expect(ctx.calls.stroke).toBe(0);
});

test('isAuto separates spawner figures from clicked ones', () => {
  const cons = [makeConstellation(0, 0, true, 0), makeConstellation(0, 0, false, 0, false), makeConstellation(0, 0, false, 0)];
  expect(countAuto(cons)).toBe(2);
});

test('recycle drops fallen figures in place and keeps order', () => {
  const H = 800;
  const cons = [{ y: 100 }, { y: H + 250 }, { y: 500 }, { y: H + 999 }];
  const keep = [cons[0], cons[2]];
  const same = recycle(cons, H);
  expect(same).toBe(cons);
  expect(cons).toEqual(keep);
});

test('fade-out near the bottom is eased and complete below the edge', () => {
  const H = 800;
  expect(fadeOutBottom(H - 200, H)).toBe(1);
  expect(fadeOutBottom(H - 50, H)).toBeCloseTo(0.5);
  expect(fadeOutBottom(H + 60, H)).toBe(0);
  let prev = 2;
  for (let y = H - 200; y <= H + 80; y += 5) { const v = fadeOutBottom(y, H); expect(v).toBeLessThanOrEqual(prev); prev = v; }
});

test('resize keeps existing stars, scales them, and matches the density', () => {
  const list = [];
  fitStars({ W: 1000, H: 800 }, 0, 0, list);
  expect(list.length).toBe(starCountFor(1000, 800));
  const keep = list[0], x0 = keep.x, y0 = keep.y;
  fitStars({ W: 2000, H: 800 }, 1000, 800, list);
  expect(list[0]).toBe(keep);
  expect(keep.x).toBeCloseTo(x0 * 2);
  expect(keep.y).toBeCloseTo(y0);
  expect(list.length).toBe(starCountFor(2000, 800));
  fitStars({ W: 500, H: 400 }, 2000, 800, list);
  expect(list.length).toBe(starCountFor(500, 400));
});
