/* ---------- far field: nebulae, dark dust, distant galaxies, star clusters ---------- */
// Everything here is generated once from a seed (and the nebula/dust images again only on
// resize), then drawn each frame with a few drawImage calls. Positions are in field units:
// u, v in [0, 1] across a field that covers the viewport plus a FIELD_MARGIN on each side,
// so the whole layer can drift slowly without showing an edge.
import { mulberry32, makeNoise, fbm, warped } from './noise.js';

export const FIELD_MARGIN = 0.1;               // fraction of the viewport on each side
export const BAKE_SCALE = 1 / 3;               // nebula/dust images are 1/3 of CSS resolution
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- field nebulae: a few faint coloured clouds, kept away from the galaxy core ---------- */
export const NEBULA_COLOURS = [
  [46, 70, 160],     // deep blue
  [96, 54, 140],     // violet
  [150, 72, 104],    // dusty rose
  [40, 104, 128]     // teal
];
export const NEBULA_PEAK = 85;                 // brightest channel value of one cloud; keeps them faint
const PEAK_SCALE = NEBULA_PEAK / Math.max(...NEBULA_COLOURS.flat());

// Clouds sit on a ring around the galaxy, one per equal sector (with some jitter), so they
// spread around the whole sky instead of bunching on one side. Neighbours get different colours.
export const CLOUD_COUNT = 5;
export function makeClouds(rng, aspect, count = CLOUD_COUNT) {
  const clouds = [], start = rng() * Math.PI * 2, c0 = Math.floor(rng() * NEBULA_COLOURS.length);
  for (let i = 0; i < count; i++) {
    const ang = start + (i + (rng() - 0.5) * 0.6) * (Math.PI * 2 / count);
    const dist = 0.34 + rng() * 0.1;               // in field units, clear of the galaxy core
    const u = Math.min(0.95, Math.max(0.05, 0.5 + Math.cos(ang) * dist));
    const v = Math.min(0.95, Math.max(0.05, 0.5 + Math.sin(ang) * dist));
    // cycle colours; the last cloud also neighbours the first, so step past its colour
    let ci = (c0 + i) % NEBULA_COLOURS.length;
    if (i === count - 1 && i > 0 && ci === c0) ci = (ci + 1) % NEBULA_COLOURS.length;
    clouds.push({ u, v, r: 0.2 + rng() * 0.12, colour: NEBULA_COLOURS[ci], strength: 0.6 + rng() * 0.4, ox: rng() * 100, oy: rng() * 100,
      pulseAt: -1e9, next: rng() * PULSE.MAX_GAP });   // first pulses are staggered
  }
  return clouds;
}

// One cloud's brightness factor at field position (u, v); 0 outside its radius.
function cloudAt(c, u, v, aspect, noise) {
  const d = Math.hypot((u - c.u) * aspect, v - c.v) / c.r;
  if (d >= 1) return 0;
  const fall = (1 - d * d) * (1 - d * d);
  const n = warped(noise, u * aspect * 2.2 + c.ox, v * 2.2 + c.oy, 3.2, 4);
  const fine = 0.75 + 0.25 * fbm(noise, u * aspect * 9 + c.oy, v * 9 + c.ox, 3);
  return fall * smoothstep(-0.15, 0.55, n) * fine * c.strength;
}

// One cloud baked on its own, cropped to its bounding box inside a w×h field image, so each
// cloud can be drawn (and pulsed) separately. RGBA bytes, drawn additively (black adds nothing).
export function cloudPixels(w, h, c, noise) {
  const aspect = w / h;
  const x0 = Math.max(0, Math.floor((c.u - c.r / aspect) * w)), x1 = Math.min(w, Math.ceil((c.u + c.r / aspect) * w));
  const y0 = Math.max(0, Math.floor((c.v - c.r) * h)), y1 = Math.min(h, Math.ceil((c.v + c.r) * h));
  const cw = Math.max(1, x1 - x0), ch = Math.max(1, y1 - y0), rgba = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const k = cloudAt(c, (x0 + x) / w, (y0 + y) / h, aspect, noise) * PEAK_SCALE, i = (y * cw + x) * 4;
    rgba[i] = c.colour[0] * k; rgba[i + 1] = c.colour[1] * k; rgba[i + 2] = c.colour[2] * k; rgba[i + 3] = 255;
  }
  return { x0, y0, cw, ch, rgba };
}

/* ---------- pulses: each cloud brightens now and then, on its own random timer ---------- */
export const PULSE = {
  GAIN: 1.2,         // extra brightness at the peak (2.2× the resting cloud)
  RISE: 1.2,         // seconds to swell
  FALL: 3.5,         // seconds to settle back
  MIN_GAP: 7,        // seconds between pulse starts; longer than a whole pulse, so they never cut off
  MAX_GAP: 18
};
const PULSE_END = PULSE.RISE + PULSE.FALL * 1.5;

export const pulseShape = x => {
  if (x <= 0 || x >= PULSE_END) return 0;
  return x < PULSE.RISE ? smoothstep(0, PULSE.RISE, x) : Math.exp(-3 * (x - PULSE.RISE) / PULSE.FALL);
};

// Advances one cloud's timer and returns its brightness factor (1 at rest).
export function pulse(c, t, rand = Math.random) {
  if (t >= c.next) { c.pulseAt = t; c.next = t + PULSE.MIN_GAP + rand() * (PULSE.MAX_GAP - PULSE.MIN_GAP); }
  return 1 + PULSE.GAIN * pulseShape(t - c.pulseAt);
}

/* ---------- dark dust: one or two wispy lanes that dim the stars behind them ---------- */
export const DUST_MAX_ALPHA = 0.62;

export function makeLanes(rng, count = 1 + Math.floor(rng() * 2)) {
  const lanes = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI;
    lanes.push({ u: 0.15 + rng() * 0.7, v: 0.15 + rng() * 0.7, dx: Math.cos(a), dy: Math.sin(a), len: 0.25 + rng() * 0.3, width: 0.05 + rng() * 0.06, ox: rng() * 100, oy: rng() * 100 });
  }
  return lanes;
}

// Alpha bytes (0–255) for a black overlay; 0 means no dust.
export function dustAlpha(w, h, lanes, noise) {
  const out = new Uint8ClampedArray(w * h), aspect = w / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    let a = 0;
    for (const L of lanes) {
      // distance to the lane's centre segment, in field units with the aspect applied
      const px = (u - L.u) * aspect, py = v - L.v;
      const along = px * L.dx + py * L.dy, across = -px * L.dy + py * L.dx;
      const ends = Math.max(0, Math.abs(along) - L.len / 2);
      const wob = fbm(noise, along * 3 + L.ox, L.oy, 3) * L.width * 0.9;   // lanes meander
      const d = Math.hypot(ends * 1.6, (across - wob) / L.width);
      if (d >= 1.6) continue;
      const n = warped(noise, u * aspect * 5 + L.ox, v * 5 + L.oy, 2.5, 4);
      a = Math.max(a, smoothstep(1.6, 0.2, d) * smoothstep(-0.25, 0.35, n));
    }
    out[y * w + x] = a * DUST_MAX_ALPHA * 255;
  }
  return out;
}

/* ---------- distant galaxies: tiny, faint smudges ---------- */
export function makeDistantGalaxies(rng, count = 4 + Math.floor(rng() * 4)) {
  return Array.from({ length: count }, () => ({
    u: rng(), v: rng(),
    size: 5 + rng() * 15,                       // CSS px across the long axis
    ratio: 0.25 + rng() * 0.6,                  // short axis / long axis (viewing angle)
    tilt: rng() * Math.PI,
    spiral: rng() < 0.55,
    alpha: 0.22 + rng() * 0.25,
    warm: rng() < 0.5
  }));
}

/* ---------- star clusters: small dense knots of faint stars ---------- */
export function makeClusters(rng, count = 2 + Math.floor(rng() * 3)) {
  return Array.from({ length: count }, () => {
    const radius = 14 + rng() * 26, n = 30 + Math.floor(rng() * 70), stars = [];
    for (let i = 0; i < n; i++) {
      // a gaussian-ish core: concentrated in the middle, thinning outward
      const r = radius * Math.pow(rng(), 1.8), a = rng() * Math.PI * 2;
      stars.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, s: rng() < 0.08 ? 1.3 : 0.5 + rng() * 0.5, a: 0.35 + rng() * 0.5 });
    }
    return { u: rng(), v: rng(), radius, stars, blue: rng() < 0.6 };
  });
}

/* ---------- painting (needs a canvas) ---------- */
const defaultCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};
const SPRITE_DPR = 2;

function paintGalaxy(g, makeCanvas) {
  const px = Math.ceil(g.size * 1.6 * SPRITE_DPR), c = makeCanvas(px, px), x = c.getContext('2d'), m = px / 2;
  x.translate(m, m); x.rotate(g.tilt); x.scale(1, g.ratio);
  const rad = (g.size / 2) * SPRITE_DPR, col = g.warm ? '255,226,190' : '214,224,255';
  const halo = x.createRadialGradient(0, 0, 0, 0, 0, rad);
  halo.addColorStop(0, `rgba(${col},1)`); halo.addColorStop(0.18, `rgba(${col},0.55)`); halo.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = halo; x.beginPath(); x.arc(0, 0, rad, 0, Math.PI * 2); x.fill();
  if (g.spiral) {
    // two faint arms, just enough to read as a spiral at this size
    x.strokeStyle = `rgba(${col},0.35)`; x.lineWidth = Math.max(0.6, rad * 0.12);
    for (let arm = 0; arm < 2; arm++) {
      x.beginPath();
      for (let k = 0; k <= 20; k++) {
        const t = k / 20, a = arm * Math.PI + t * 3.4, r = rad * (0.15 + 0.75 * t);
        const X = Math.cos(a) * r, Y = Math.sin(a) * r;
        k ? x.lineTo(X, Y) : x.moveTo(X, Y);
      }
      x.stroke();
    }
  }
  return { canvas: c, size: px / SPRITE_DPR };
}

function paintCluster(cl, makeCanvas) {
  const px = Math.ceil(cl.radius * 2.4 * SPRITE_DPR), c = makeCanvas(px, px), x = c.getContext('2d'), m = px / 2;
  const col = cl.blue ? '214,228,255' : '255,240,214';
  const glow = x.createRadialGradient(m, m, 0, m, m, cl.radius * SPRITE_DPR);
  glow.addColorStop(0, `rgba(${col},0.10)`); glow.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = glow; x.fillRect(0, 0, px, px);
  for (const s of cl.stars) {
    x.fillStyle = `rgba(${col},${s.a})`;
    x.beginPath(); x.arc(m + s.dx * SPRITE_DPR, m + s.dy * SPRITE_DPR, s.s * SPRITE_DPR * 0.6, 0, Math.PI * 2); x.fill();
  }
  return { canvas: c, size: px / SPRITE_DPR };
}

// Turns RGBA bytes (or a dust alpha mask) into a canvas that drawImage can stretch over the field.
function imageCanvas(w, h, rgba, makeCanvas) {
  const c = makeCanvas(w, h), x = c.getContext('2d');
  const img = x.createImageData(w, h);
  img.data.set(rgba);
  x.putImageData(img, 0, 0);
  return c;
}

/* ---------- the far-field layer ---------- */
export function createField(seed = Math.floor(Math.random() * 2 ** 31), makeCanvas = defaultCanvas) {
  const rng = mulberry32(seed), noise = makeNoise(rng);
  const lanes = makeLanes(rng);
  const galaxies = makeDistantGalaxies(rng).map(g => ({ ...g, sprite: paintGalaxy(g, makeCanvas) }));
  const clusters = makeClusters(rng).map(cl => ({ ...cl, sprite: paintCluster(cl, makeCanvas) }));
  const field = { seed, lanes, galaxies, clusters, clouds: null, dust: null, w: 0, h: 0, bakeMs: 0, version: 0 };

  // Re-bakes the nebula and dust images for a viewport size (startup and resize only).
  field.bake = (W, H) => {
    const t0 = performance.now();
    const fw = W * (1 + 2 * FIELD_MARGIN), fh = H * (1 + 2 * FIELD_MARGIN);
    const w = Math.max(16, Math.round(fw * BAKE_SCALE)), h = Math.max(16, Math.round(fh * BAKE_SCALE));
    // clouds depend on the aspect, so derive them from their own seeded stream each time,
    // keeping each cloud's pulse timer across resizes
    const prev = field.clouds;
    field.clouds = makeClouds(mulberry32(seed ^ 0x9e3779b9), w / h);
    field.clouds.forEach((c, i) => {
      if (prev) { c.pulseAt = prev[i].pulseAt; c.next = prev[i].next; }
      const img = cloudPixels(w, h, c, noise);
      c.rgba = img.rgba;
      c.image = imageCanvas(img.cw, img.ch, img.rgba, makeCanvas);
      c.rect = { u: img.x0 / w, v: img.y0 / h, uw: img.cw / w, vh: img.ch / h };   // in field units
    });
    const a = dustAlpha(w, h, lanes, noise), rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < a.length; i++) rgba[i * 4 + 3] = a[i];            // black with alpha
    field.dust = imageCanvas(w, h, rgba, makeCanvas);
    field.w = w; field.h = h; field.version++;
    field.bakeMs = performance.now() - t0;
  };
  return field;
}

// Very slow drift of the whole far field, within its margin. Returns the field's top-left.
export function fieldOrigin(t, W, H, out) {
  out.x = -W * FIELD_MARGIN + Math.sin(t * 0.011) * W * FIELD_MARGIN * 0.6;
  out.y = -H * FIELD_MARGIN + Math.sin(t * 0.008 + 1.3) * H * FIELD_MARGIN * 0.6;
  return out;
}

const origin = { x: 0, y: 0 };

// Behind the starfield: nebulae (additive), then distant galaxies and clusters.
export function drawFieldBack(ctx, view, field, t) {
  const { W, H } = view, o = fieldOrigin(t, W, H, origin);
  const fw = W * (1 + 2 * FIELD_MARGIN), fh = H * (1 + 2 * FIELD_MARGIN);
  ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < field.clouds.length; i++) {
    const c = field.clouds[i], r = c.rect, x = o.x + r.u * fw, y = o.y + r.v * fh, w = r.uw * fw, h = r.vh * fh;
    // globalAlpha stops at 1, so the bright part of a pulse is a second additive pass
    const b = pulse(c, t);
    ctx.globalAlpha = 1; ctx.drawImage(c.image, x, y, w, h);
    if (b > 1.001) { ctx.globalAlpha = Math.min(1, b - 1); ctx.drawImage(c.image, x, y, w, h); }
    if (b > 2.001) { ctx.globalAlpha = b - 2; ctx.drawImage(c.image, x, y, w, h); }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < field.clusters.length; i++) {
    const c = field.clusters[i], d = c.sprite.size;
    ctx.drawImage(c.sprite.canvas, o.x + c.u * fw - d / 2, o.y + c.v * fh - d / 2, d, d);
  }
  for (let i = 0; i < field.galaxies.length; i++) {
    const g = field.galaxies[i], d = g.sprite.size;
    ctx.globalAlpha = g.alpha;
    ctx.drawImage(g.sprite.canvas, o.x + g.u * fw - d / 2, o.y + g.v * fh - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// After the starfield: dark dust dims everything drawn so far.
export function drawFieldDust(ctx, view, field) {
  const { W, H } = view;
  ctx.drawImage(field.dust, origin.x, origin.y, W * (1 + 2 * FIELD_MARGIN), H * (1 + 2 * FIELD_MARGIN));
}
