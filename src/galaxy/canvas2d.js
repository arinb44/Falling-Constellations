/* ---------- background: density-wave style spiral galaxy (Canvas 2D, replaced in Stage 2) ---------- */
import { gauss } from '../util.js';

const GALAXY_N = 3200;
const galaxy = [];
const BUCKETS = ['rgba(255,214,160,0.55)', 'rgba(220,225,255,0.5)', 'rgba(150,185,255,0.5)', 'rgba(255,150,190,0.35)'];

export function buildGalaxy() {
  galaxy.length = 0;
  const arms = 2, twist = 5.2;
  for (let i = 0; i < GALAXY_N; i++) {
    const r = Math.pow(Math.random(), 1.6);              // dense core
    const arm = i % arms;
    const spread = 0.12 + r * 0.25;
    const theta0 = r * twist + (arm * Math.PI * 2) / arms + gauss() * spread * 3;
    const bucket = r < 0.18 ? 0 : r < 0.5 ? (Math.random() < .7 ? 1 : 0) : (Math.random() < .08 ? 3 : 2);
    galaxy.push({ r, theta0, omega: 0.22 / (r + 0.12), bucket, size: Math.random() < 0.06 ? 2 : 1, jitter: gauss() * 0.02 });
  }
}

export function drawGalaxy(ctx, view, t) {
  const { W, H } = view;
  const cx = W * 0.5, cy = H * 0.5;
  const R = Math.max(W, H) * 0.62;
  const tilt = -0.35, ct = Math.cos(tilt), st = Math.sin(tilt);
  // soft core glow
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.35);
  g.addColorStop(0, 'rgba(255,220,170,0.16)');
  g.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < BUCKETS.length; b++) {
    ctx.fillStyle = BUCKETS[b];
    for (let i = 0; i < galaxy.length; i++) {
      const s = galaxy[i];
      if (s.bucket !== b) continue;
      const a = s.theta0 + t * s.omega * 0.12;
      const x0 = Math.cos(a) * s.r * R + s.jitter * R;
      const y0 = Math.sin(a) * s.r * R * 0.45;
      const x = cx + x0 * ct - y0 * st;
      const y = cy + x0 * st + y0 * ct;
      ctx.fillRect(x, y, s.size, s.size);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
