/* ---------- seeded RNG, 2D gradient noise, FBM and domain warp (pure) ---------- */

// mulberry32: small, fast, good enough for visuals; same seed → same sky
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Perlin-style gradient noise in roughly [-1, 1], built from a shuffled permutation table.
export function makeNoise(rng) {
  const perm = new Uint8Array(512), gx = new Float32Array(256), gy = new Float32Array(256);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) { const a = rng() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const g = (ix, iy, dx, dy) => { const h = perm[perm[ix] + iy]; return gx[h] * dx + gy[h] * dy; };
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const n00 = g(X, Y, xf, yf), n10 = g(X + 1, Y, xf - 1, yf);
    const n01 = g(X, Y + 1, xf, yf - 1), n11 = g(X + 1, Y + 1, xf - 1, yf - 1);
    const u = fade(xf), v = fade(yf);
    const a = n00 + (n10 - n00) * u, b = n01 + (n11 - n01) * u;
    return (a + (b - a) * v) * 1.414;           // stretch the ~±0.707 range toward ±1
  };
}

// Fractal sum of octaves, normalised back to roughly [-1, 1].
export function fbm(noise, x, y, octaves = 5, lacunarity = 2.02, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x, y); norm += amp;
    x = x * lacunarity + 17.3; y = y * lacunarity - 9.1;
    amp *= gain;
  }
  return sum / norm;
}

// Domain warp, fbm(p + k·fbm(p)): turns round blobs into wisps and filaments.
export function warped(noise, x, y, k = 4, octaves = 5) {
  const qx = fbm(noise, x, y, octaves), qy = fbm(noise, x + 5.2, y + 1.3, octaves);
  return fbm(noise, x + k * qx, y + k * qy, octaves);
}
