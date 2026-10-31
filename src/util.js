/* ---------- small shared helpers (pure) ---------- */
export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
