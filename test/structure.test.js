import { test, expect } from 'bun:test';
import { buildStars, G } from '../src/galaxy/model.js';
import { S, bakeStructure, radial, bilinear } from '../src/galaxy/structure.js';
import { DISC_VS, KNOT_VS } from '../src/galaxy/shaders.js';

const s = bakeStructure(buildStars(1), 1);
const n = s.n;

// the first arm band along a ray within [lo, hi]: where the map is above 0.5, and its middle
function band(ang, lo, hi) {
  let start = -1, end = -1;
  for (let r = lo; r < hi; r += 0.002) {
    const on = radial(s.arms, n, r * Math.cos(ang), r * Math.sin(ang), 0) > 0.5;
    if (on && start < 0) start = r;
    if (!on && start >= 0) { end = r; break; }
  }
  return start < 0 || end < 0 ? null : { start, end, mid: (start + end) / 2 };
}

test('the arm map picks out narrow crests, not the whole disc', () => {
  let on = 0;
  for (let i = 0; i < n * n; i++) { expect(s.arms[i]).toBeGreaterThanOrEqual(0); expect(s.arms[i]).toBeLessThanOrEqual(1); if (s.arms[i] > 0.5) on++; }
  expect(on / (n * n)).toBeGreaterThan(0.03);
  expect(on / (n * n)).toBeLessThan(0.2);
});

test('dust lies on the inner edge of each arm, outside the bulge, and fades at the rim', () => {
  const alpha = new Float32Array(n * n); for (let i = 0; i < n * n; i++) alpha[i] = s.dust[i * 4 + 3];
  let rays = 0, inner = 0;
  for (let a = 0; a < 48; a++) {
    const ang = a / 48 * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang);
    const b = band(ang, 0.3, 0.8);
    if (!b) continue;
    // dust within 0.08 inside the band's middle vs within 0.08 outside it
    let inside = 0, outside = 0;
    for (let d = 0.002; d <= 0.08; d += 0.002) {
      inside += bilinear(alpha, n, (b.mid - d) * c, (b.mid - d) * sn);
      outside += bilinear(alpha, n, (b.mid + d) * c, (b.mid + d) * sn);
    }
    rays++; if (inside > outside) inner++;
  }
  expect(rays).toBeGreaterThan(20);
  expect(inner / rays).toBeGreaterThan(0.9);
  expect(bilinear(alpha, n, 0.05, 0.03)).toBe(0);       // bulge
  expect(bilinear(alpha, n, 1.05, 0)).toBe(0);          // past the rim
  for (let i = 0; i < n * n; i++) expect(alpha[i]).toBeLessThanOrEqual(S.DUST + 1e-6);
});

test('H-II knots sit just outside the crests, inside the disc, and are pink', () => {
  const k = s.knots, m = k.length / S.KNOT_STRIDE;
  expect(m).toBe(S.KNOTS);
  let outside = 0, inSum = 0, outSum = 0;
  for (let i = 0; i < m; i++) {
    const o = i * S.KNOT_STRIDE, x = k[o], y = k[o + 1], r = Math.hypot(x, y);
    expect(r).toBeLessThan(1.0);
    expect(k[o + 3]).toBeGreaterThan(k[o + 4]);         // red > green
    expect(k[o + 5]).toBeGreaterThan(k[o + 4]);         // blue > green: pink
    // the arm is just inward of the knot, not just outward
    const inward = radial(s.arms, n, x, y, -S.EDGE), outward = radial(s.arms, n, x, y, S.EDGE);
    if (inward > outward) outside++;
    inSum += inward; outSum += outward;
  }
  // clumps spread a little, so not every knot clears the crest, but they clearly lean outward
  expect(outside / m).toBeGreaterThan(0.65);
  expect(inSum).toBeGreaterThan(outSum * 2);
});

test('gas is faint, additive and stays within the disc', () => {
  let max = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const o = (j * n + i) * 4;
    expect(s.gas[o + 3]).toBe(0);
    max = Math.max(max, s.gas[o], s.gas[o + 1], s.gas[o + 2]);
  }
  expect(max).toBeGreaterThan(0);
  expect(max).toBeLessThanOrEqual(S.GAS * G.GAIN);
  const corner = ((n - 1) * n + (n - 1)) * 4;
  expect(s.gas[corner]).toBe(0);
});

test('the bake is seeded', () => {
  const a = bakeStructure(buildStars(4, 3000), 4, 64), b = bakeStructure(buildStars(4, 3000), 4, 64);
  expect(a.dust).toEqual(b.dust);
  expect(a.knots).toEqual(b.knots);
});

test('structure shaders rotate with the pattern using the model constants', () => {
  for (const src of [DISC_VS, KNOT_VS]) {
    expect(src).toContain(`PATTERN = ${G.PATTERN}`);
    expect(src).toContain(`SQUASH = ${G.SQUASH}`);
  }
});
