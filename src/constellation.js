/* ---------- constellation generator ---------- */
import { rand, randInt, pick, smooth } from './util.js';

const PRE = ['Aur', 'Vel', 'Cas', 'Lyr', 'Ori', 'Dra', 'Pav', 'Ser', 'Cor', 'Hyd', 'Tau', 'Nor', 'Eri', 'Zel', 'Kae', 'Mir', 'Thal', 'Sol'];
const MID = ['a', 'e', 'i', 'o', 'u', 'ae', 'io', 'ia'];
const SUF = ['nis', 'rix', 'lum', 'dra', 'ris', 'vae', 'tus', 'nae', 'phos', 'lis', 'gon', 'mara'];
const TITLE = ['Ursa', 'Canis', 'Corvus', 'Lepus', 'Aquila', 'Vulpes', 'Cetus', 'Lynx', 'Pyxis', 'Ara'];
export const makeName = () => (Math.random() < 0.55 ? pick(TITLE) + ' ' : '') + pick(PRE) + pick(MID) + pick(SUF);
const HUES = [210, 220, 195, 270, 340, 45, 170];

export function makeConstellation(x, y, atTop) {
  const n = randInt(5, 11);
  const pts = [{ x: 0, y: 0 }];
  let guard = 0;
  while (pts.length < n && guard++ < 400) {
    const base = pick(pts);
    const ang = rand(0, 6.283), d = rand(34, 86);
    const p = { x: base.x + Math.cos(ang) * d, y: base.y + Math.sin(ang) * d };
    if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) > 28)) pts.push(p);
  }
  // centre on centroid
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  pts.forEach(p => { p.x -= cx; p.y -= cy; p.mag = Math.random() < 0.2 ? rand(3.2, 4.6) : rand(1.6, 3); p.ph = Math.random() * 6.28; });

  // minimum spanning tree (Prim) + a couple of loop-closing edges
  const edges = [], inT = new Set([0]);
  const dist = (a, b) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
  while (inT.size < pts.length) {
    let best = null;
    for (const a of inT) for (let b = 0; b < pts.length; b++) {
      if (inT.has(b)) continue;
      const d = dist(a, b);
      if (!best || d < best.d) best = { a, b, d };
    }
    edges.push([best.a, best.b]); inT.add(best.b);
  }
  for (let k = 0; k < randInt(0, 2); k++) {
    const a = randInt(0, pts.length - 1), b = randInt(0, pts.length - 1);
    if (a !== b && dist(a, b) < 110 && !edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) edges.push([a, b]);
  }

  const depth = rand(0.55, 1.35);
  return {
    pts, edges, name: makeName(), hue: pick(HUES),
    x, y: atTop ? -160 * depth : y,
    depth, vy: 16 + 30 * depth + rand(-4, 4),
    swayAmp: rand(8, 28), swayFreq: rand(0.15, 0.4), swayPh: Math.random() * 6.28, baseX: x,
    rot: rand(0, 6.283), rotSpeed: rand(-0.05, 0.05),
    born: performance.now() / 1000, drawIn: rand(1.6, 3)
  };
}

export const targetCount = view => Math.max(5, Math.round(view.W / 130));

/* ---------- constellation drawing ---------- */
export function drawConstellation(ctx, view, c, t, dt, mouse) {
  const { H } = view;
  c.y += c.vy * dt;
  c.rot += c.rotSpeed * dt;
  c.x = c.baseX + Math.sin(t * c.swayFreq + c.swayPh) * c.swayAmp + mouse.px * 14 * c.depth;

  const span = 150 * c.depth;
  const fadeTop = smooth((c.y + span) / 140);
  const fadeBot = 1 - smooth((c.y - (H - 160)) / 200);
  const age = t - c.born;
  const alpha = Math.min(fadeTop, fadeBot) * smooth(age / 1.2);
  if (alpha <= 0.002) return;

  const cos = Math.cos(c.rot), sin = Math.sin(c.rot), s = c.depth;
  const P = c.pts.map(p => ({ x: c.x + (p.x * cos - p.y * sin) * s, y: c.y + (p.x * sin + p.y * cos) * s, mag: p.mag * s, ph: p.ph }));

  // edges grow in one after another
  ctx.lineCap = 'round';
  const prog = Math.min(1, (age - 0.4) / c.drawIn);
  c.edges.forEach(([a, b], i) => {
    const e = Math.min(1, Math.max(0, prog * c.edges.length - i));
    if (e <= 0) return;
    const A = P[a], B = P[b];
    ctx.strokeStyle = `hsla(${c.hue},70%,78%,${0.38 * alpha})`;
    ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(A.x + (B.x - A.x) * e, A.y + (B.y - A.y) * e); ctx.stroke();
  });

  // stars with glow
  for (const p of P) {
    const tw = 0.8 + 0.2 * Math.sin(t * 2.2 + p.ph);
    const r = p.mag * tw;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
    g.addColorStop(0, `hsla(${c.hue},90%,92%,${0.55 * alpha})`);
    g.addColorStop(1, `hsla(${c.hue},90%,70%,0)`);
    ctx.fillStyle = g; ctx.fillRect(p.x - r * 6, p.y - r * 6, r * 12, r * 12);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
  }

  // label
  const maxY = Math.max(...P.map(p => p.y)), midX = P.reduce((a, p) => a + p.x, 0) / P.length;
  ctx.font = `${Math.round(10 + 3 * s)}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = `hsla(${c.hue},60%,85%,${0.5 * alpha * smooth(prog)})`;
  ctx.fillText(c.name.toUpperCase().split('').join(' '), midX, maxY + 22 * s);
}
