/* ---------- shooting stars (occasional) ---------- */
import { rand } from './util.js';

const shooters = [];

export function maybeShoot(view, dt) {
  const { W, H } = view;
  if (Math.random() < dt * 0.12) shooters.push({ x: rand(0, W), y: rand(-20, H * 0.4), vx: rand(-500, -250), vy: rand(300, 520), life: 0 });
}

export function drawShooters(ctx, dt) {
  for (let i = shooters.length - 1; i >= 0; i--) {
    const s = shooters[i]; s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    const a = Math.max(0, 1 - s.life / 0.9);
    if (a <= 0) { shooters.splice(i, 1); continue; }
    const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.12, s.y - s.vy * 0.12);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.12, s.y - s.vy * 0.12); ctx.stroke();
  }
}
