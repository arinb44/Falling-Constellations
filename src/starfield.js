/* ---------- far starfield (twinkling) ---------- */
import { rand } from './util.js';

const stars = [];
const DENSITY = 5500;                          // CSS px² per star

const makeStar = (W, H) => ({
  x: Math.random() * W, y: Math.random() * H,
  s: Math.random() < 0.1 ? 1.6 : rand(0.4, 1.1),
  speed: rand(2, 8), ph: Math.random() * 6.28, tw: rand(0.6, 2.2)
});

export const starCountFor = (W, H) => Math.floor(W * H / DENSITY);

// Keeps existing stars on resize: positions scale with the window, and stars are
// added or dropped to keep the density, so the sky never visibly regenerates.
export function fitStars(view, prevW = 0, prevH = 0, list = stars) {
  const { W, H } = view;
  if (prevW > 0 && prevH > 0) {
    const sx = W / prevW, sy = H / prevH;
    for (const s of list) { s.x *= sx; s.y *= sy; }
  }
  const n = starCountFor(W, H);
  while (list.length < n) list.push(makeStar(W, H));
  list.length = n;
  return list;
}

export function drawStars(ctx, view, t, dt) {
  const { W, H } = view;
  ctx.fillStyle = 'rgb(210,225,255)';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.y += s.speed * dt;
    if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * s.tw + s.ph);
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
}
