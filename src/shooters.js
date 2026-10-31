/* ---------- shooting stars (occasional) ---------- */
import { rand } from './util.js';

const TRAIL = 0.12;                            // trail length in seconds of travel
const LIFE = 0.9;
// Fixed pool: a shooting star is live while life < LIFE; nothing is allocated per frame.
const POOL = 4;
const shooters = Array.from({ length: POOL }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: LIFE }));
let trail = null;                              // one gradient along +x, unit length, built once

export function maybeShoot(view, dt) {
  if (Math.random() >= dt * 0.12) return;
  const s = shooters.find(s => s.life >= LIFE);
  if (!s) return;
  s.x = rand(0, view.W); s.y = rand(-20, view.H * 0.4);
  s.vx = rand(-500, -250); s.vy = rand(300, 520); s.life = 0;
}

export function drawShooters(ctx, view, dt) {
  if (!trail) {
    trail = ctx.createLinearGradient(0, 0, 1, 0);
    trail.addColorStop(0, 'rgba(255,255,255,1)'); trail.addColorStop(1, 'rgba(255,255,255,0)');
  }
  const D = view.DPR;
  for (let i = 0; i < POOL; i++) {
    const s = shooters[i];
    if (s.life >= LIFE) continue;
    s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    const a = Math.max(0, 1 - s.life / LIFE);
    if (a <= 0) continue;
    // draw the trail in its own frame: x along the trail (scaled to its length), y across it
    const v = Math.hypot(s.vx, s.vy), len = v * TRAIL, ux = -s.vx / v, uy = -s.vy / v;
    ctx.setTransform(D * ux * len, D * uy * len, -D * uy, D * ux, D * s.x, D * s.y);
    ctx.globalAlpha = a;
    ctx.fillStyle = trail;
    ctx.fillRect(0, -0.75, 1, 1.5);
  }
  ctx.setTransform(D, 0, 0, D, 0, 0);
  ctx.globalAlpha = 1;
}
