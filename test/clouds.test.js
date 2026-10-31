import { test, expect } from 'bun:test';
import { createSky, updateClouds, lifeAt, lifespan, LIFE, CLOUDS } from '../src/sky/clouds.js';
import { CLOUD_COUNT, NEBULA_PEAK, PULSE } from '../src/sky/field.js';
import { mulberry32 } from '../src/sky/noise.js';

const out = () => ({ life: new Float32Array(CLOUD_COUNT), pulse: new Float32Array(CLOUD_COUNT) });

test('a cloud forms from nothing, holds, then dissolves back to nothing, smoothly', () => {
  const c = { born: 10, hold: 50 };
  expect(lifeAt(c, 10)).toBe(0);
  expect(lifeAt(c, 10 + LIFE.FORM / 2)).toBeCloseTo(0.5, 1);
  expect(lifeAt(c, 10 + LIFE.FORM + 1)).toBe(1);
  expect(lifeAt(c, 10 + LIFE.FORM + 50 + LIFE.DISSOLVE)).toBe(0);
  let prev = 0;
  for (let t = 10; t < 10 + lifespan(c); t += 0.05) {
    const v = lifeAt(c, t);
    expect(Math.abs(v - prev)).toBeLessThan(0.01);      // no jumps
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
    prev = v;
  }
});

test('the sky is not empty on load', () => {
  const sky = createSky(3), o = updateClouds(sky, 0, out(), () => 0.5);
  expect(o.life.filter(v => v > 0.2).length).toBeGreaterThanOrEqual(3);
});

test('each cloud is replaced in its own sector, with a new shape and a colour unlike its neighbours', () => {
  const sky = createSky(9), o = out(), rand = mulberry32(1);
  const sectorAngle = c => (Math.atan2(c.v - 0.5, c.u - 0.5) - sky.start + 8 * Math.PI) % (2 * Math.PI) / (2 * Math.PI / CLOUD_COUNT);
  let replaced = 0;
  for (let t = 0; t < 1200; t += 0.25) {
    const before = sky.clouds.map(c => c.born);
    updateClouds(sky, t, o, rand);
    sky.clouds.forEach((c, i) => {
      if (c.born === before[i]) return;
      replaced++;
      // within ±0.3 of a sector of its own slot (the jitter used by the layout)
      const s = sectorAngle(c);
      const d = Math.min(Math.abs(s - c.sector), CLOUD_COUNT - Math.abs(s - c.sector));
      expect(d).toBeLessThan(0.35);
      const dist = Math.hypot(c.u - 0.5, c.v - 0.5);
      expect(dist).toBeGreaterThan(0.25);                // clear of the galaxy core
      const n = sky.clouds.length;
      expect(c.ci).not.toBe(sky.clouds[(i + 1) % n].ci);
      expect(c.ci).not.toBe(sky.clouds[(i + n - 1) % n].ci);
    });
  }
  expect(replaced).toBeGreaterThan(CLOUD_COUNT * 3);
});

test('pulses still brighten clouds on their own timers, on top of the life cycle', () => {
  const sky = createSky(5), o = out(), rand = mulberry32(2);
  let peak = 1;
  for (let t = 0; t < 120; t += 1 / 30) { updateClouds(sky, t, o, rand); peak = Math.max(peak, ...o.pulse); }
  expect(peak).toBeGreaterThan(1 + PULSE.GAIN * 0.9);
});

test('cloud colours stay faint', () => {
  const sky = createSky(1);
  for (const c of sky.clouds) for (const v of c.colour) expect(v).toBeLessThanOrEqual(NEBULA_PEAK / 255 + 1e-9);
});

test('clouds refresh often enough to look smooth but far less than every frame', () => {
  expect(CLOUDS.REFRESH_HZ).toBeGreaterThanOrEqual(10);
  expect(CLOUDS.REFRESH_HZ).toBeLessThanOrEqual(30);
});
