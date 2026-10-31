/* ---------- Atlas grid: faint coordinate arcs, pre-rendered once per resize ---------- */
// Curved parallels and converging meridians, as on a star chart, around a celestial pole
// that sits off-screen above the sky. Drawn in the cream ink at a barely visible alpha.
export const GRID = {
  POLE_X: 0.62,        // × W
  POLE_Y: -1.4,        // × H (above the screen)
  PARALLEL_STEP: 0.26, // × H between parallels
  MERIDIAN_DEG: 6,     // degrees between meridians
  ALPHA: 0.055,
  WIDTH: 0.6,          // CSS px
  INK: '250,236,205'
};

const DEG = Math.PI / 180;

// Pure geometry: the pole, the parallel radii and meridian angles that cross the W×H screen,
// and the radius/angle span the screen covers as seen from the pole.
export function gridLines(W, H) {
  const px = GRID.POLE_X * W, py = GRID.POLE_Y * H;
  const corners = [[0, 0], [W, 0], [0, H], [W, H]];
  let aMin = Infinity, aMax = -Infinity, rMax = 0;
  for (const [x, y] of corners) {
    const a = Math.atan2(y - py, x - px);
    aMin = Math.min(aMin, a); aMax = Math.max(aMax, a);
    rMax = Math.max(rMax, Math.hypot(x - px, y - py));
  }
  // nearest screen point to the pole (the pole is above the screen, so on the top edge)
  const rMin = Math.hypot(Math.min(W, Math.max(0, px)) - px, Math.min(H, Math.max(0, py)) - py);
  const step = GRID.PARALLEL_STEP * H, parallels = [], meridians = [];
  for (let r = Math.ceil(rMin / step) * step; r <= rMax; r += step) parallels.push(r);
  const m = GRID.MERIDIAN_DEG * DEG;
  for (let a = Math.ceil(aMin / m) * m; a <= aMax; a += m) meridians.push(a);
  return { px, py, rMin, rMax, aMin, aMax, parallels, meridians };
}

const defaultCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

export function createGrid(makeCanvas = defaultCanvas) {
  let canvas = null, W = 0, H = 0;
  return {
    resize(w, h, dpr) {
      W = w; H = h;
      canvas = makeCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr));
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.strokeStyle = `rgba(${GRID.INK},${GRID.ALPHA})`;
      g.lineWidth = GRID.WIDTH;
      const L = gridLines(w, h);
      g.beginPath();
      for (const r of L.parallels) { g.moveTo(L.px + r * Math.cos(L.aMin), L.py + r * Math.sin(L.aMin)); g.arc(L.px, L.py, r, L.aMin, L.aMax); }
      for (const a of L.meridians) {
        const c = Math.cos(a), s = Math.sin(a);
        g.moveTo(L.px + L.rMin * c, L.py + L.rMin * s); g.lineTo(L.px + L.rMax * c, L.py + L.rMax * s);
      }
      g.stroke();
    },
    draw(ctx) { if (canvas) ctx.drawImage(canvas, 0, 0, W, H); }
  };
}
