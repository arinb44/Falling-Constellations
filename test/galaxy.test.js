import { test, expect } from 'bun:test';
import { G, orbit, project, eccentricity, tilt, omega, armness, centreDim, buildStars, STRIDE, COLOURS } from '../src/galaxy/model.js';
import { GALAXY_VS } from '../src/galaxy/shaders.js';
import { fieldStarData } from '../src/galaxy/gl.js';

const N = 120000;
const data = buildStars(3, N);

// angular density of disc stars in a thin ring of radius R, smoothed over 3 bins
function ring(t, R, bins = 36) {
  const h = new Array(bins).fill(0), p = {};
  for (let i = 0; i < N; i++) {
    const o = i * STRIDE;
    if (data[o] < 0.1) continue;
    orbit(data[o], data[o + 1], t, p, data[o + 8], data[o + 9]);
    if (Math.abs(Math.hypot(p.x, p.y) - R) > 0.03) continue;
    let ang = Math.atan2(p.y, p.x) - G.PATTERN * t;
    ang = ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    h[Math.floor(ang / (2 * Math.PI) * bins) % bins]++;
  }
  return h.map((_, i) => (h[(i + bins - 1) % bins] + h[i] + h[(i + 1) % bins]) / 3);
}
const peakBin = h => h.indexOf(Math.max(...h));
// distance between two bins on a circle, treating the two arms (180° apart) as the same
const armDist = (a, b, bins = 36) => { const d = Math.abs(a - b) % (bins / 2); return Math.min(d, bins / 2 - d); };

test('the arm pattern does not wind up: crests stay put for 10 minutes', () => {
  for (const R of [0.3, 0.5, 0.7]) {
    const a = peakBin(ring(0, R)), b = peakBin(ring(600, R));
    expect(armDist(a, b)).toBeLessThanOrEqual(2);              // within 20°
  }
});

test('the disc has real arms: crest density well above the median', () => {
  for (const R of [0.3, 0.5, 0.7]) {
    const h = ring(0, R), sorted = [...h].sort((x, y) => x - y);
    expect(sorted[35] / sorted[18]).toBeGreaterThan(2.5);
  }
});

test('stars still move along their orbits (inner ones faster)', () => {
  const p0 = orbit(0.2, 1, 0), p1 = orbit(0.2, 1, 60);
  expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeGreaterThan(0.05);
  expect(omega(0.1)).toBeGreaterThan(omega(0.8));
});

test('orbit shape: round core, elongated mid-disc, tilt grows with radius', () => {
  expect(eccentricity(0)).toBe(0);
  expect(eccentricity(0.4)).toBeCloseTo(G.E_MAX);
  expect(eccentricity(1)).toBeLessThan(G.E_MAX);
  expect(tilt(1)).toBeCloseTo(G.TWIST);
  expect(tilt(0.5)).toBeGreaterThan(tilt(0.2));
});

test('armness peaks where the ellipses crowd (sin 2θ = -1) and is 0 opposite', () => {
  expect(armness(-Math.PI / 4)).toBeCloseTo(1);
  expect(armness(3 * Math.PI / 4)).toBeCloseTo(1);
  expect(armness(Math.PI / 4)).toBe(0);
  for (let th = 0; th < 6.28; th += 0.1) { expect(armness(th)).toBeGreaterThanOrEqual(0); expect(armness(th)).toBeLessThanOrEqual(1); }
});

test('projection squashes and rotates the disc for the viewing angle', () => {
  const q = project({ x: 0, y: 1 });
  expect(Math.hypot(q.x, q.y)).toBeCloseTo(G.SQUASH);
  const r = project({ x: 1, y: 0 });
  expect(Math.hypot(r.x, r.y)).toBeCloseTo(1);
});

test('star data: 50k+ stars, sane ranges, warm bulge and blue young stars', () => {
  expect(G.N).toBeGreaterThanOrEqual(50000);
  const d = buildStars(1);
  expect(d.length).toBe(G.N * STRIDE);
  let young = 0, bulgeWarm = 0, bulge = 0;
  for (let i = 0; i < G.N; i++) {
    const o = i * STRIDE, a = d[o];
    expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(1);
    expect(d[o + 2]).toBeGreaterThan(0.5); expect(d[o + 2]).toBeLessThan(4);
    expect(d[o + 6]).toBeGreaterThan(0);
    if (d[o + 7]) { young++; expect(d[o + 5]).toBeGreaterThan(d[o + 3]); }   // blue > red
    if (a < 0.05) { bulge++; if (d[o + 3] > d[o + 5]) bulgeWarm++; }        // red > blue
  }
  expect(young / G.N).toBeGreaterThan(0.15); expect(young / G.N).toBeLessThan(0.4);
  expect(bulgeWarm / bulge).toBeGreaterThan(0.9);
  expect(buildStars(7, 100)).toEqual(buildStars(7, 100));                  // seeded
});

test('the vertex shader uses the same constants as the JS model', () => {
  for (const k of ['TWIST', 'E_MAX', 'OMEGA', 'PATTERN', 'VIEW_ROT', 'SQUASH', 'ARM_SHARP', 'CORE_DIM', 'CORE_DIM_R'])
    expect(GALAXY_VS).toContain(`${k} = ${Number.isInteger(G[k]) ? G[k].toFixed(1) : G[k]}`);
  expect(COLOURS.young[2]).toBeGreaterThan(COLOURS.young[0]);
});

test('background-star data is normalised so resizing only changes the count', () => {
  const d = fieldStarData(200, 5);
  expect(d.length).toBe(200 * 7);
  for (let i = 0; i < 200; i++) {
    expect(d[i * 7]).toBeLessThan(1); expect(d[i * 7 + 1]).toBeLessThan(1);
    expect(d[i * 7 + 3]).toBeGreaterThanOrEqual(2); expect(d[i * 7 + 3]).toBeLessThanOrEqual(8);
  }
  expect(fieldStarData(50, 5)).toEqual(fieldStarData(50, 5));
});

test('stars dim by 50% as they reach the centre, and not at all outside it', () => {
  expect(G.CORE_DIM).toBeCloseTo(0.5);
  expect(centreDim(0)).toBeCloseTo(0.5);
  expect(centreDim(G.CORE_DIM_R)).toBe(1);
  expect(centreDim(0.6)).toBe(1);
  let prev = 0;
  for (let r = 0; r <= 0.3; r += 0.01) { const v = centreDim(r); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
});
