/* ---------- live field nebulae: layout and life cycle (pure) ---------- */
// The WebGL layer draws these clouds from time-evolving noise (CLOUD_FS), so their wisps
// billow on their own. This module decides where each cloud is and how "alive" it is: each
// ring sector holds one cloud that forms out of wisps, holds, thins away, and is replaced
// by a new one in the same sector. Positions are in field units, as in field.js.
import { mulberry32 } from './noise.js';
import { NEBULA_COLOURS, NEBULA_PEAK, CLOUD_COUNT, PULSE, pulse } from './field.js';

export const LIFE = {
  FORM: 20,              // seconds to grow out of thin wisps
  HOLD_MIN: 40,          // seconds at full shape (random in [HOLD_MIN, HOLD_MAX])
  HOLD_MAX: 90,
  DISSOLVE: 20,          // seconds to thin away
  GAP: 4                 // seconds the sector stays empty before the next cloud forms
};
export const CLOUDS = {
  SPEED: 0.02,           // how fast the noise evolves (noise units per second); sets the billowing
  REFRESH_HZ: 15,        // cloud texture refreshes per second (they move slowly)
  RES: 0.25              // cloud texture size relative to the WebGL canvas
};
// colours as 0..1 multipliers, scaled so the brightest channel of any cloud is NEBULA_PEAK/255
const PEAK = NEBULA_PEAK / Math.max(...NEBULA_COLOURS.flat());
export const cloudColour = ci => NEBULA_COLOURS[ci].map(v => v * PEAK / 255);

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lifespan = c => LIFE.FORM + c.hold + LIFE.DISSOLVE + LIFE.GAP;

// 0 → 1 while forming, 1 while holding, 1 → 0 while dissolving, 0 in the gap.
export function lifeAt(c, t) {
  const age = t - c.born;
  if (age <= 0) return 0;
  if (age < LIFE.FORM) return smoothstep(0, LIFE.FORM, age);
  const end = LIFE.FORM + c.hold;
  if (age < end) return 1;
  return 1 - smoothstep(end, end + LIFE.DISSOLVE, age);
}

// A new cloud in sector i: same ring as field.js (clear of the galaxy core), new shape.
function place(c, rng, start) {
  const ang = start + (c.sector + (rng() - 0.5) * 0.6) * (Math.PI * 2 / c.count);
  const dist = 0.34 + rng() * 0.1;
  c.u = Math.min(0.95, Math.max(0.05, 0.5 + Math.cos(ang) * dist));
  c.v = Math.min(0.95, Math.max(0.05, 0.5 + Math.sin(ang) * dist));
  c.r = 0.2 + rng() * 0.12;
  c.strength = 0.6 + rng() * 0.4;
  c.ox = rng() * 100; c.oy = rng() * 100;     // where in the noise this cloud's shape comes from
  c.hold = LIFE.HOLD_MIN + rng() * (LIFE.HOLD_MAX - LIFE.HOLD_MIN);
}

// a colour unlike both ring neighbours
function recolour(sky, c, rng) {
  const n = sky.clouds.length, a = sky.clouds[(c.sector + n - 1) % n].ci, b = sky.clouds[(c.sector + 1) % n].ci;
  const free = NEBULA_COLOURS.map((_, i) => i).filter(i => i !== a && i !== b && i !== c.ci);
  c.ci = free[Math.floor(rng() * free.length)];
  c.colour = cloudColour(c.ci);
}

export function createSky(seed, count = CLOUD_COUNT) {
  const rng = mulberry32(seed ^ 0x7f4a7c15), start = rng() * Math.PI * 2, c0 = Math.floor(rng() * NEBULA_COLOURS.length);
  const sky = { rng, start, clouds: [] };
  for (let i = 0; i < count; i++) {
    let ci = (c0 + i) % NEBULA_COLOURS.length;
    if (i === count - 1 && i > 0 && ci === c0) ci = (ci + 1) % NEBULA_COLOURS.length;
    const c = { sector: i, count, ci, colour: cloudColour(ci), born: 0, pulseAt: -1e9, next: rng() * PULSE.MAX_GAP };
    place(c, rng, start);
    // start each cloud somewhere in its form/hold phase, so the sky isn't empty on load
    c.born = -rng() * (LIFE.FORM + c.hold * 0.8);
    sky.clouds.push(c);
  }
  return sky;
}

// Replaces clouds whose life is over and returns each cloud's brightness (life × pulse) in out.
export function updateClouds(sky, t, out, rand = Math.random) {
  for (let i = 0; i < sky.clouds.length; i++) {
    const c = sky.clouds[i];
    if (t - c.born >= lifespan(c)) {
      place(c, sky.rng, sky.start);
      recolour(sky, c, sky.rng);
      c.born = t;
    }
    out.life[i] = lifeAt(c, t);
    out.pulse[i] = pulse(c, t, rand);
  }
  return out;
}
