/* ---------- constellation generator ---------- */
import { rand, randInt, pick, smooth, clamp01, easeInOutCubic } from './util.js';
import { SIZE_CLASSES, pickClass } from './sprites.js';

/* ---------- Atlas ink: one cream/gold ink with a slight per-figure shift ---------- */
export const INK_CREAM = [238, 226, 198];
export const INK_GOLD = [222, 194, 138];
export function makeInk(m = rand(0.25, 0.65)) {
  const c = INK_CREAM.map((v, i) => Math.round(v + (INK_GOLD[i] - v) * m));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

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
  pts.forEach(p => { p.x -= cx; p.y -= cy; p.cls = pickClass(); p.ph = Math.random() * 6.28; });

  // every figure gets at least one bright star to anchor it
  if (!pts.some(p => p.cls <= 1)) pick(pts).cls = 0;

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
    pts, edges, ink: makeInk(),
    x, y: atTop ? -160 * depth : y,
    depth, vy: 16 + 30 * depth + rand(-4, 4),
    swayAmp: rand(8, 28), swayFreq: rand(0.15, 0.4), swayPh: Math.random() * 6.28, baseX: x,
    rot: rand(0, 6.283), rotSpeed: rand(-0.05, 0.05),
    born: performance.now() / 1000, drawIn: rand(2, 4), linesAt: -1
  };
}

export const targetCount = view => Math.max(5, Math.round(view.W / 130));

/* ---------- draw-in: stars first, then lines once the figure is on screen ---------- */
export const STAR_STAGGER = 0.14, STAR_FADE = 0.7, EDGE_OVERLAP = 1.6, SCREEN_MARGIN = 24;

// Each star fades in on its own, in the order the generator placed them.
export const starIn = (age, i) => smooth((age - i * STAR_STAGGER) / STAR_FADE);

// Lines start only when every star is inside the viewport (top and bottom margin).
export const fullyOnScreen = (minY, maxY, H) => minY >= SCREEN_MARGIN && maxY <= H - SCREEN_MARGIN;

// Edge i of n eases in over a window that overlaps the next edge's start.
export function edgeProgress(prog, i, n) {
  const step = 1 / (n - 1 + EDGE_OVERLAP);
  return easeInOutCubic((prog - i * step) / (EDGE_OVERLAP * step));
}

/* ---------- constellation drawing (Atlas style) ---------- */
// lines: ~0.7–1 px by depth, stopping short of each star
export const lineWidthFor = depth => 0.7 + 0.3 * clamp01((depth - 0.55) / 0.8);
export const gapFor = (cls, depth) => SIZE_CLASSES[cls].core * depth + 2.5;

// `look` carries shared drawing state from main (the pre-rendered sprites).
export function drawConstellation(ctx, view, c, t, dt, mouse, look) {
  const { H } = view;
  c.y += c.vy * dt;
  c.rot += c.rotSpeed * dt;
  c.x = c.baseX + Math.sin(t * c.swayFreq + c.swayPh) * c.swayAmp + mouse.px * 14 * c.depth;

  const span = 150 * c.depth;
  const fadeTop = smooth((c.y + span) / 140);
  const fadeBot = 1 - smooth((c.y - (H - 160)) / 200);
  const age = t - c.born;
  const alpha = Math.min(fadeTop, fadeBot);
  if (alpha <= 0.002) return;

  const cos = Math.cos(c.rot), sin = Math.sin(c.rot), s = c.depth;
  const P = c.pts.map(p => ({ x: c.x + (p.x * cos - p.y * sin) * s, y: c.y + (p.x * sin + p.y * cos) * s, cls: p.cls, ph: p.ph }));

  // lines wait until all the stars are in and the whole figure is on screen
  if (c.linesAt < 0 && age >= (P.length - 1) * STAR_STAGGER + STAR_FADE) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of P) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    if (fullyOnScreen(minY, maxY, H)) c.linesAt = t;
  }

  // engraved lines grow in one after another
  ctx.lineCap = 'round';
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = lineWidthFor(s);
  ctx.globalAlpha = 0.34 * alpha;
  const prog = c.linesAt < 0 ? 0 : (t - c.linesAt) / c.drawIn;
  if (prog > 0) c.edges.forEach(([a, b], i) => {
    const e = edgeProgress(prog, i, c.edges.length);
    if (e <= 0) return;
    const A = P[a], B = P[b];
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
    const ga = gapFor(A.cls, s), gb = gapFor(B.cls, s);
    if (L <= ga + gb) return;
    const ux = dx / L, uy = dy / L, run = (L - ga - gb) * e;
    const x0 = A.x + ux * ga, y0 = A.y + uy * ga;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + ux * run, y0 + uy * run); ctx.stroke();
  });

  // graded stars from pre-rendered sprites, with a gentle twinkle
  for (let i = 0; i < P.length; i++) {
    const p = P[i], a = alpha * starIn(age, i);
    if (a <= 0.002) continue;
    const tw = Math.sin(t * 1.6 + p.ph);
    const sp = look.sprites[p.cls];
    const d = sp.size * s * (0.96 + 0.04 * tw);
    ctx.globalAlpha = a * (0.86 + 0.14 * tw);
    ctx.drawImage(sp.canvas, p.x - d / 2, p.y - d / 2, d, d);
  }

  ctx.globalAlpha = 1;
}
