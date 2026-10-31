/* ---------- Falling Constellations: loop, resize, input ---------- */
import { rand } from './util.js';
import { fitStars, drawStars } from './starfield.js';
import { makeConstellation, targetCount, countAuto, recycle, drawConstellation } from './constellation.js';
import { maybeShoot, drawShooters } from './shooters.js';
import { buildSprites } from './sprites.js';
import { createField, drawFieldBack, drawFieldDust } from './sky/field.js';
import { createBackLayer } from './galaxy/gl.js';
import { createFrameStats, mountReadout } from './debug.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');
const view = { W: 0, H: 0, DPR: 1 };

/* ---------- Atlas look: star sprites drawn once ---------- */
const look = { sprites: buildSprites() };

/* ---------- far field: nebulae, dust, distant galaxies, clusters (one seed per visit) ---------- */
const field = createField();
let rebakeTimer = 0;

/* ---------- WebGL2 back layer (galaxy, far field, background stars) ---------- */
// Without WebGL2 the far field and starfield fall back to the 2D canvas, with no galaxy.
let back = null;
const params = new URLSearchParams(location.search);
try { if (!params.has('nogl')) back = createBackLayer(document.getElementById('gl'), field); }   // ?nogl: test the fallback
catch (err) { console.error(err); }

// Sim clock: advances by the clamped dt, so a paused or backgrounded tab
// resumes exactly where it left off instead of jumping ahead.
let clock = 0;

const cons = [];
function populate() {
  cons.length = 0;
  for (let i = 0; i < targetCount(view); i++) cons.push(makeConstellation(rand(80, view.W - 80), rand(-100, view.H), false, clock));
}

/* ---------- input / resize ---------- */
const mouse = { px: 0 };
addEventListener('mousemove', e => { mouse.px = (e.clientX / view.W - 0.5) * 2; });
canvas.addEventListener('pointerdown', e => {
  cons.push(makeConstellation(e.clientX, e.clientY, false, clock, false));
  hint.style.opacity = 0;
});
function resize() {
  const prevW = view.W, prevH = view.H;
  view.DPR = Math.min(2, devicePixelRatio || 1);
  view.W = innerWidth; view.H = innerHeight;
  canvas.width = view.W * view.DPR; canvas.height = view.H * view.DPR;
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
  if (back) back.resize(view.W, view.H, view.DPR);
  else fitStars(view, prevW, prevH);
  // keep the sky: constellations slide to the same relative x instead of regenerating
  if (prevW > 0) for (const c of cons) c.baseX *= view.W / prevW;
  // the nebula/dust images are re-baked once the window stops changing size
  if (!field.version) field.bake(view.W, view.H);
  else { clearTimeout(rebakeTimer); rebakeTimer = setTimeout(() => field.bake(view.W, view.H), 250); }
}
addEventListener('resize', resize);

/* ---------- 2D background (fallback only), rebuilt only on resize ---------- */
let bg = null, bgH = 0;
function background(W, H) {
  if (bgH !== H) {
    bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(20,12,50,0.45)'); bg.addColorStop(1, 'rgba(2,3,10,0)');
    bgH = H;
  }
  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
}

/* ---------- debug readout ---------- */
const debug = params.has('debug');
const stats = debug ? createFrameStats() : null;
const readout = debug ? mountReadout() : null;

/* ---------- main loop (infinite), paused while the tab is hidden ---------- */
let last = 0, rafId = 0;
function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, Math.max(0, raw)); last = now;
  clock += dt;
  const t = clock, { W, H } = view;

  // far to near: background, nebulae and distant objects, starfield, dust, galaxy
  if (back) {
    back.draw(t);
    ctx.clearRect(0, 0, W, H);
  } else {
    background(W, H);
    drawFieldBack(ctx, view, field, t);
    drawStars(ctx, view, t, dt);
    drawFieldDust(ctx, view, field);
  }

  // recycle: remove those that have fallen off, spawn new ones at the top
  recycle(cons, H);
  if (countAuto(cons) < targetCount(view) && Math.random() < dt * 2.2) cons.push(makeConstellation(rand(80, W - 80), 0, true, t));

  for (let i = 0; i < cons.length; i++) drawConstellation(ctx, view, cons[i], t, dt, mouse, look);
  maybeShoot(view, dt); drawShooters(ctx, view, dt);

  if (stats && stats.add(Math.max(0, raw))) {
    const o = stats.out;
    readout.textContent = `${o.fps.toFixed(0)} fps  avg ${o.avgMs.toFixed(1)} ms  worst ${o.worstMs.toFixed(1)} ms\n${cons.length} constellations  ${W}×${H} @${view.DPR}x\nfield bake ${field.w}×${field.h} in ${field.bakeMs.toFixed(0)} ms  ${back ? 'WebGL2' : '2D fallback'}`;
  }
  rafId = requestAnimationFrame(frame);
}
// visibilitychange can report "visible" while the loop is already running; never run two loops
function start() { cancelAnimationFrame(rafId); last = performance.now(); rafId = requestAnimationFrame(frame); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelAnimationFrame(rafId);
  else start();
});

resize(); populate();
setTimeout(() => { hint.style.opacity = 0; }, 8000);
start();
