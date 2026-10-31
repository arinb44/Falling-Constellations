/* ---------- far starfield (twinkling) ---------- */
import { rand } from './util.js';

let stars = [];

export function buildStars(view) {
  const { W, H } = view;
  const n = Math.floor(W * H / 5500);
  stars = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: Math.random() < 0.1 ? 1.6 : rand(0.4, 1.1),
    speed: rand(2, 8), ph: Math.random() * 6.28, tw: rand(0.6, 2.2)
  }));
}

export function drawStars(ctx, view, t, dt) {
  const { W, H } = view;
  for (const s of stars) {
    s.y += s.speed * dt;
    if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
    const a = 0.35 + 0.35 * Math.sin(t * s.tw + s.ph);
    ctx.fillStyle = `rgba(210,225,255,${a})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
}
