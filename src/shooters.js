/* ---------- shooting stars (occasional) ---------- */
import { rand } from './util.js';

export const FLIGHT = 0.8;                     // seconds the head is moving
export const LINGER = 1.0;                     // seconds a point of the trail stays after the head passes it
const LIFE = FLIGHT + LINGER;
// Fixed pool: a shooting star is live while life < LIFE; nothing is allocated per frame.
const POOL = 4;
const shooters = Array.from({ length: POOL }, () => ({ x0: 0, y0: 0, vx: 0, vy: 0, life: LIFE }));
const span = { head: 0, tail: 0, aHead: 0, aTail: 0 };
let glow = null, core = null, headSprite = null;   // built once on the first draw

export function maybeShoot(view, dt) {
  if (Math.random() >= dt * 0.12) return;
  const s = shooters.find(s => s.life >= LIFE);
  if (!s) return;
  s.x0 = rand(0, view.W); s.y0 = rand(-20, view.H * 0.4);
  s.vx = rand(-500, -250); s.vy = rand(300, 520); s.life = 0;
}

// Which part of the path is still visible at `life`, as flight times (head ≥ tail), and the
// trail's opacity at each end. A point drawn at flight time τ has faded by (life - τ) / LINGER,
// so the far end always goes first and the fade sweeps toward the head.
export function trailSpan(life, out = span) {
  out.head = Math.min(life, FLIGHT);
  out.tail = Math.max(0, life - LINGER);
  out.aHead = Math.max(0, 1 - (life - out.head) / LINGER);
  out.aTail = Math.max(0, 1 - (life - out.tail) / LINGER);
  return out;
}

function build(ctx) {
  // unit gradients along +x: opaque at the head (x = 0), clear at x = 1
  glow = ctx.createLinearGradient(0, 0, 1, 0);
  glow.addColorStop(0, 'rgba(60,140,255,0.6)'); glow.addColorStop(1, 'rgba(60,140,255,0)');
  core = ctx.createLinearGradient(0, 0, 1, 0);
  core.addColorStop(0, 'rgba(225,242,255,1)'); core.addColorStop(1, 'rgba(120,185,255,0)');
  headSprite = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  headSprite.addColorStop(0, 'rgba(240,248,255,1)');
  headSprite.addColorStop(0.3, 'rgba(110,175,255,0.75)');
  headSprite.addColorStop(1, 'rgba(60,140,255,0)');
}

// Opacity along the trail is linear from aHead to aTail: a flat band at aTail plus the
// unit gradient at (aHead - aTail), so no gradient is built per frame.
function band(ctx, grad, solid, halfWidth, aHead, aTail) {
  ctx.globalAlpha = aHead - aTail;
  ctx.fillStyle = grad;
  ctx.fillRect(0, -halfWidth, 1, halfWidth * 2);
  if (aTail <= 0) return;
  ctx.globalAlpha = aTail;
  ctx.fillStyle = solid;
  ctx.fillRect(0, -halfWidth, 1, halfWidth * 2);
}

export function drawShooters(ctx, view, dt) {
  if (!glow) build(ctx);
  const D = view.DPR;
  for (let i = 0; i < POOL; i++) {
    const s = shooters[i];
    if (s.life >= LIFE) continue;
    s.life += dt;
    const t = trailSpan(s.life);
    if (t.aHead <= 0) continue;
    const v = Math.hypot(s.vx, s.vy), ux = -s.vx / v, uy = -s.vy / v;
    const hx = s.x0 + s.vx * t.head, hy = s.y0 + s.vy * t.head;
    const len = Math.max(1e-3, v * (t.head - t.tail));
    // trail frame: x from the head back along the path (scaled to its length), y across it in px
    ctx.setTransform(D * ux * len, D * uy * len, -D * uy, D * ux, D * hx, D * hy);
    band(ctx, glow, 'rgba(60,140,255,0.6)', 3.5, t.aHead, t.aTail);
    band(ctx, core, 'rgba(120,185,255,1)', 0.8, t.aHead, t.aTail);
    // bright head while it is still flying, burning out over the last fifth of the flight
    if (s.life < FLIGHT) {
      const k = Math.min(1, (FLIGHT - s.life) / (FLIGHT * 0.2));
      ctx.setTransform(D * 4, 0, 0, D * 4, D * hx, D * hy);
      ctx.globalAlpha = k;
      ctx.fillStyle = headSprite;
      ctx.fillRect(-1, -1, 2, 2);
    }
  }
  ctx.setTransform(D, 0, 0, D, 0, 0);
  ctx.globalAlpha = 1;
}
