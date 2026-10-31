/* ---------- Falling Constellations: loop, resize, input ---------- */
import { rand } from './util.js';
import { buildGalaxy, drawGalaxy } from './galaxy/canvas2d.js';
import { buildStars, drawStars } from './starfield.js';
import { makeConstellation, targetCount, drawConstellation } from './constellation.js';
import { maybeShoot, drawShooters } from './shooters.js';
import { createFrameStats, mountReadout } from './debug.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');
const view = { W: 0, H: 0, DPR: 1 };

let cons = [];
function populate() {
  cons = [];
  for (let i = 0; i < targetCount(view); i++) cons.push(makeConstellation(rand(80, view.W - 80), rand(-100, view.H), false));
}

/* ---------- input / resize ---------- */
const mouse = { px: 0 };
addEventListener('mousemove', e => { mouse.px = (e.clientX / view.W - 0.5) * 2; });
canvas.addEventListener('pointerdown', e => {
  const c = makeConstellation(e.clientX, e.clientY, false);
  c.born = performance.now() / 1000;
  cons.push(c);
  hint.style.opacity = 0;
});
function resize() {
  view.DPR = Math.min(2, devicePixelRatio || 1);
  view.W = innerWidth; view.H = innerHeight;
  canvas.width = view.W * view.DPR; canvas.height = view.H * view.DPR;
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
  buildStars(view); populate();
}
addEventListener('resize', resize);

/* ---------- debug readout ---------- */
const debug = new URLSearchParams(location.search).has('debug');
const stats = debug ? createFrameStats() : null;
const readout = debug ? mountReadout() : null;

/* ---------- main loop (infinite) ---------- */
let last = performance.now() / 1000;
function frame() {
  const t = performance.now() / 1000;
  const raw = t - last;
  const dt = Math.min(0.05, raw); last = t;
  const { W, H } = view;

  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(20,12,50,0.45)'); bg.addColorStop(1, 'rgba(2,3,10,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  drawGalaxy(ctx, view, t);
  drawStars(ctx, view, t, dt);

  // recycle: remove those that have fallen off, spawn new ones at the top
  cons = cons.filter(c => c.y < H + 200);
  const autoCount = cons.filter(c => c.vy).length;
  if (autoCount < targetCount(view) && Math.random() < dt * 2.2) cons.push(makeConstellation(rand(80, W - 80), 0, true));

  for (const c of cons) drawConstellation(ctx, view, c, t, dt, mouse);
  maybeShoot(view, dt); drawShooters(ctx, dt);

  if (stats && stats.add(raw)) {
    const o = stats.out;
    readout.textContent = `${o.fps.toFixed(0)} fps  avg ${o.avgMs.toFixed(1)} ms  worst ${o.worstMs.toFixed(1)} ms\n${cons.length} constellations  ${W}×${H} @${view.DPR}x`;
  }
  requestAnimationFrame(frame);
}

buildGalaxy(); resize();
setTimeout(() => { hint.style.opacity = 0; }, 8000);
requestAnimationFrame(frame);
