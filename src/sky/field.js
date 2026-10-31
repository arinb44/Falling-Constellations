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
export const NEBULA_PEAK = 115;                // brightest channel value of one cloud; keeps them faint
const PEAK_SCALE = NEBULA_PEAK / Math.max(...NEBULA_COLOURS.flat());

export function makeClouds(rng, aspect, count = 3) {
  const clouds = [];
  for (let i = 0; i < count; i++) {
    let u, v, guard = 0;
    do { u = rng(); v = rng(); } while (Math.hypot((u - 0.5) * aspect, v - 0.5) < 0.28 && guard++ < 50);
    clouds.push({ u, v, r: 0.22 + rng() * 0.22, colour: NEBULA_COLOURS[Math.floor(rng() * NEBULA_COLOURS.length)], strength: 0.6 + rng() * 0.4, ox: rng() * 100, oy: rng() * 100 });
  }
  return clouds;
}

// RGBA bytes for a w×h image, drawn additively over the background (black adds nothing).
export function nebulaPixels(w, h, clouds, noise) {
  const out = new Uint8ClampedArray(w * h * 4), aspect = w / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, i = (y * w + x) * 4;
    let r = 0, g = 0, b = 0;
    for (const c of clouds) {
      const d = Math.hypot((u - c.u) * aspect, v - c.v) / c.r;
      if (d >= 1) continue;
      const fall = (1 - d * d) * (1 - d * d);
      const n = warped(noise, u * aspect * 2.2 + c.ox, v * 2.2 + c.oy, 3.2, 4);
      const fine = 0.75 + 0.25 * fbm(noise, u * aspect * 9 + c.oy, v * 9 + c.ox, 3);
      const k = fall * smoothstep(-0.15, 0.55, n) * fine * c.strength;
      r += c.colour[0] * k; g += c.colour[1] * k; b += c.colour[2] * k;
    }
    out[i] = r * PEAK_SCALE; out[i + 1] = g * PEAK_SCALE; out[i + 2] = b * PEAK_SCALE; out[i + 3] = 255;
  }
  return out;
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
  const field = { seed, lanes, galaxies, clusters, clouds: null, nebula: null, dust: null, nebulaRGBA: null, w: 0, h: 0, bakeMs: 0 };

  // Re-bakes the nebula and dust images for a viewport size (startup and resize only).
  field.bake = (W, H) => {
    const t0 = performance.now();
    const fw = W * (1 + 2 * FIELD_MARGIN), fh = H * (1 + 2 * FIELD_MARGIN);
    const w = Math.max(16, Math.round(fw * BAKE_SCALE)), h = Math.max(16, Math.round(fh * BAKE_SCALE));
    // clouds depend on the aspect, so derive them from their own seeded stream each time
    field.clouds = makeClouds(mulberry32(seed ^ 0x9e3779b9), w / h);
    field.nebulaRGBA = nebulaPixels(w, h, field.clouds, noise);
    field.nebula = imageCanvas(w, h, field.nebulaRGBA, makeCanvas);
    const a = dustAlpha(w, h, lanes, noise), rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < a.length; i++) rgba[i * 4 + 3] = a[i];            // black with alpha
    field.dust = imageCanvas(w, h, rgba, makeCanvas);
    field.w = w; field.h = h;
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
  ctx.drawImage(field.nebula, o.x, o.y, fw, fh);
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
