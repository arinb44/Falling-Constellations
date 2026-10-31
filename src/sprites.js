/* ---------- pre-rendered star sprites (Atlas graded sizes) ---------- */
// Atlases mark brightness with a small fixed set of dot sizes. Each class gets one
// glow sprite, drawn once to an offscreen canvas and stamped with drawImage per star.
// Radii are CSS px at depth 1; class 0 is the brightest.
export const SIZE_CLASSES = [
  { core: 2.6, glow: 11 },
  { core: 1.9, glow: 8 },
  { core: 1.35, glow: 5.5 },
  { core: 0.95, glow: 3.8 }
];
export const CLASS_WEIGHTS = [0.12, 0.26, 0.34, 0.28];

// Sprites are drawn big enough for the largest depth (1.35) at the max DPR (2),
// so drawImage only ever scales them down.
export const SPRITE_SCALE = 1.35 * 2;

export function pickClass(r = Math.random()) {
  for (let i = 0; i < CLASS_WEIGHTS.length; i++) { r -= CLASS_WEIGHTS[i]; if (r < 0) return i; }
  return CLASS_WEIGHTS.length - 1;
}

const defaultCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

// Returns one { canvas, size } per class; `size` is the sprite's width in CSS px at depth 1.
export function buildSprites(makeCanvas = defaultCanvas) {
  return SIZE_CLASSES.map(({ core, glow }) => {
    const px = Math.ceil(glow * 2 * SPRITE_SCALE);
    const canvas = makeCanvas(px, px);
    const g = canvas.getContext('2d');
    const m = px / 2, k = core / glow;
    const grad = g.createRadialGradient(m, m, 0, m, m, m);
    // crisp cream core, then a tight warm falloff
    grad.addColorStop(0, 'rgba(255,251,238,1)');
    grad.addColorStop(k * 0.7, 'rgba(255,248,230,1)');
    grad.addColorStop(k, 'rgba(250,236,205,0.55)');
    grad.addColorStop(Math.min(1, k * 2.2), 'rgba(236,212,165,0.14)');
    grad.addColorStop(1, 'rgba(236,212,165,0)');
    g.fillStyle = grad; g.fillRect(0, 0, px, px);
    return { canvas, size: glow * 2 };
  });
}

/* ---------- diffraction spikes (brightest star of each figure) ---------- */
// Faint 4-point cross, as a telescope's support vanes make; one fixed orientation for every star.
export const SPIKE = {
  LEN: 34,             // tip to tip, CSS px at depth 1
  WIDTH: 1.1,          // CSS px
  ALPHA: 0.42          // at the centre; fades to 0 at the tips
};

export function buildSpike(makeCanvas = defaultCanvas) {
  const px = Math.ceil(SPIKE.LEN * SPRITE_SCALE), m = px / 2, w = SPIKE.WIDTH * SPRITE_SCALE;
  const canvas = makeCanvas(px, px);
  const g = canvas.getContext('2d');
  for (const vertical of [false, true]) {
    const grad = vertical ? g.createLinearGradient(0, 0, 0, px) : g.createLinearGradient(0, 0, px, 0);
    grad.addColorStop(0, 'rgba(250,236,205,0)');
    grad.addColorStop(0.5, `rgba(255,248,230,${SPIKE.ALPHA})`);
    grad.addColorStop(1, 'rgba(250,236,205,0)');
    g.fillStyle = grad;
    if (vertical) g.fillRect(m - w / 2, 0, w, px); else g.fillRect(0, m - w / 2, px, w);
  }
  return { canvas, size: SPIKE.LEN };
}
