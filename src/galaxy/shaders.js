/* ---------- GLSL sources (WebGL2 / GLSL ES 3.00) ---------- */
// All positions are worked out in CSS pixels and converted to clip space with u_view (W, H).
import { G } from './model.js';

const f = x => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const toClip = `
vec4 toClip(vec2 px) { return vec4(px.x / u_view.x * 2.0 - 1.0, 1.0 - px.y / u_view.y * 2.0, 0.0, 1.0); }`;

// A unit quad (two triangles) shared by every instanced pass: corners in [-1, 1].
export const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

/* ---------- background gradient and galaxy core glow (fullscreen) ---------- */
export const FULLSCREEN_VS = `#version 300 es
layout(location = 0) in vec2 corner;
out vec2 v_px;
uniform vec2 u_view;
void main() {
  v_px = (corner * vec2(0.5, -0.5) + 0.5) * u_view;
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

export const BG_FS = `#version 300 es
precision highp float;
in vec2 v_px;
uniform vec2 u_view;
out vec4 o;
void main() {
  // #02030a with a faint purple wash from the top (as the 2D version)
  vec3 base = vec3(2.0, 3.0, 10.0) / 255.0;
  float k = 0.45 * (1.0 - v_px.y / u_view.y);
  vec3 top = vec3(20.0, 12.0, 50.0) / 255.0;
  o = vec4(mix(base, top, k), 1.0);
}`;

export const CORE_FS = `#version 300 es
precision highp float;
in vec2 v_px;
uniform vec2 u_view;
uniform float u_radius;
out vec4 o;
void main() {
  float d = length(v_px - u_view * 0.5) / (u_radius * 0.38);
  float g = (exp(-d * d * 2.2) * 0.12 + exp(-d * d * 18.0) * 0.1) * ${f(G.CORE_DIM * G.GAIN)};   // same cut and gain as the stars
  o = vec4(vec3(1.0, 0.86, 0.66) * g, 0.0);   // premultiplied, additive
}`;

/* ---------- one textured rectangle: nebula, dust, distant galaxies, clusters ---------- */
export const RECT_VS = `#version 300 es
layout(location = 0) in vec2 corner;
uniform vec2 u_view;
uniform vec4 u_rect;          // x, y, w, h in CSS px
out vec2 v_uv;
${toClip}
void main() {
  v_uv = corner * 0.5 + 0.5;
  // v = 0 is the rect's top edge and the image's first row, so no flip is needed
  gl_Position = toClip(u_rect.xy + v_uv * u_rect.zw);
}`;

export const RECT_FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_alpha;
out vec4 o;
void main() { o = texture(u_tex, v_uv) * u_alpha; }`;

/* ---------- background stars: fall and wrap entirely on the GPU ---------- */
// per instance: u, v0, size, speed (px/s), phase, twinkle rate
export const FIELDSTAR_VS = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec2 uv0;
layout(location = 2) in float size;
layout(location = 3) in float speed;
layout(location = 4) in vec2 tw;
uniform vec2 u_view;
uniform float u_time;
uniform float u_dpr;
out vec2 v_c;
out float v_a;
${toClip}
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float span = u_view.y + 4.0;
  float travel = uv0.y * u_view.y + speed * u_time;
  float cycle = floor(travel / span);
  float y = mod(travel, span) - 2.0;
  // each time a star wraps to the top it reappears at a new x, as in the 2D version
  float x = (cycle < 0.5 ? uv0.x : hash(uv0.x * 91.7 + cycle * 12.9898)) * u_view.x;
  float r = max(size, 1.0 / u_dpr) * 0.9;
  v_c = corner;
  v_a = 0.35 + 0.35 * sin(u_time * tw.y + tw.x);
  gl_Position = toClip(vec2(x, y) + corner * r);
}`;

export const FIELDSTAR_FS = `#version 300 es
precision mediump float;
in vec2 v_c;
in float v_a;
out vec4 o;
void main() {
  float d = dot(v_c, v_c);
  float k = exp(-d * 3.0) * v_a;
  o = vec4(vec3(210.0, 225.0, 255.0) / 255.0 * k, 0.0);
}`;

/* ---------- the galaxy: one instanced draw, orbits computed here ---------- */
// per instance: a, theta0, size, colour (rgb), brightness, young
export const GALAXY_VS = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec3 orb;        // a, theta0, size
layout(location = 2) in vec3 colour;
layout(location = 3) in vec2 lum;        // brightness, young
layout(location = 4) in vec2 scatter;    // offset from the ideal ellipse, in the disc plane
uniform vec2 u_view;
uniform float u_time;
uniform float u_radius;                  // disc radius in CSS px
uniform float u_dpr;
uniform float u_boost;                   // > 1 when the quality controller draws fewer stars
out vec2 v_c;
out vec3 v_col;
${toClip}
const float TWIST = ${f(G.TWIST)}, E_MAX = ${f(G.E_MAX)}, OMEGA = ${f(G.OMEGA)}, PATTERN = ${f(G.PATTERN)};
const float VIEW_ROT = ${f(G.VIEW_ROT)}, SQUASH = ${f(G.SQUASH)}, ARM_SHARP = ${f(G.ARM_SHARP)};
const float CORE_DIM = ${f(G.CORE_DIM)}, CORE_DIM_R = ${f(G.CORE_DIM_R)};
float ecc(float a) { return E_MAX * smoothstep(0.0, 0.25, a) * (1.0 - 0.55 * smoothstep(0.6, 1.0, a)); }
void main() {
  float a = orb.x;
  float theta = orb.y + OMEGA / (a + 0.06) * u_time;
  float phi = a * TWIST + PATTERN * u_time;
  vec2 e = vec2(a * cos(theta), a * (1.0 - ecc(a)) * sin(theta));
  vec2 p = vec2(e.x * cos(phi) - e.y * sin(phi), e.x * sin(phi) + e.y * cos(phi)) + scatter;
  // stars dim as they reach the centre, so the bulge doesn't pile up into a white blob
  float dim = CORE_DIM + (1.0 - CORE_DIM) * smoothstep(0.0, CORE_DIM_R, length(p));
  p.y *= SQUASH;
  p = vec2(p.x * cos(VIEW_ROT) - p.y * sin(VIEW_ROT), p.x * sin(VIEW_ROT) + p.y * cos(VIEW_ROT));
  // young stars only shine near the arm crests, where the ellipses crowd
  float arm = pow(max(0.0, -sin(2.0 * theta)), ARM_SHARP);
  float b = lum.x * mix(1.0, 0.15 + 1.6 * arm, lum.y) * dim * u_boost;
  float r = max(orb.z, 1.2 / u_dpr) * 1.6;   // quad half-size: room for the soft edge
  v_c = corner;
  v_col = colour * b;
  gl_Position = toClip(u_view * 0.5 + p * u_radius + corner * r);
}`;

export const GALAXY_FS = `#version 300 es
precision mediump float;
in vec2 v_c;
in vec3 v_col;
out vec4 o;
void main() {
  float d = dot(v_c, v_c);
  if (d > 1.0) discard;
  // bright gaussian core plus a faint wide halo (the report's glow sprite, procedurally)
  float k = exp(-d * 9.0) + 0.12 * exp(-d * 2.5);
  o = vec4(v_col * k, 0.0);
}`;

/* ---------- galaxy structure: baked gas and dust, H-II knots ---------- */
// Baked in the frame that turns with the arm pattern, so here they only rotate by PATTERN·t
// and then get the same squash and view rotation as the stars.
const planeToScreen = `
const float PATTERN = ${f(G.PATTERN)}, VIEW_ROT = ${f(G.VIEW_ROT)}, SQUASH = ${f(G.SQUASH)};
vec2 planeToScreen(vec2 q) {
  float a = PATTERN * u_time;
  vec2 p = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  p.y *= SQUASH;
  p = vec2(p.x * cos(VIEW_ROT) - p.y * sin(VIEW_ROT), p.x * sin(VIEW_ROT) + p.y * cos(VIEW_ROT));
  return u_view * 0.5 + p * u_radius;
}`;

export const DISC_VS = `#version 300 es
layout(location = 0) in vec2 corner;
uniform vec2 u_view;
uniform float u_time;
uniform float u_radius;
uniform float u_ext;          // half-size of the baked square, in disc radii
out vec2 v_uv;
${toClip}
${planeToScreen}
void main() {
  v_uv = corner * 0.5 + 0.5;   // row 0 of the bake is y = -ext
  gl_Position = toClip(planeToScreen(corner * u_ext));
}`;

export const DISC_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_gain;
out vec4 o;
void main() { o = texture(u_tex, v_uv) * u_gain; }`;

// per instance: plane position, size (CSS px), colour
export const KNOT_VS = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec3 pos;        // x, y, size
layout(location = 2) in vec3 colour;
uniform vec2 u_view;
uniform float u_time;
uniform float u_radius;
uniform float u_dpr;
out vec2 v_c;
out vec3 v_col;
${toClip}
${planeToScreen}
void main() {
  float r = max(pos.z, 1.2 / u_dpr) * 1.6;
  v_c = corner;
  v_col = colour;
  gl_Position = toClip(planeToScreen(pos.xy) + corner * r);
}`;

/* ---------- post: bloom chain and filmic tone map ---------- */
// Narkowicz's ACES fit, applied straight to the scene values at exposure 1: faint values stay
// close to where they were authored (0.08 → 0.09), highlights roll off (1 → 0.80, 6 → 0.99).
export const POST = {
  EXPOSURE: 1.0,
  BLOOM: 0.05,           // share of the bloom chain added before tone mapping (the chain sums ~6 levels)
  BLOOM_RADIUS: 1.0,     // tent-filter radius in texels when upsampling
  MIN_LEVEL: 8,          // stop halving once a level's short side would drop below this
  SATURATION: 0.88,      // grading after the tone map, so the Atlas ink reads on top
  BRIGHTNESS: 0.96
};
const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';
// the same grade in JS, for tests: c is a tone-mapped [r, g, b]
export const grade = c => {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return c.map(v => (l + (v - l) * POST.SATURATION) * POST.BRIGHTNESS);
};
export const aces = x => Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));

const POST_VS = `#version 300 es
layout(location = 0) in vec2 corner;
out vec2 v_uv;
void main() { v_uv = corner * 0.5 + 0.5; gl_Position = vec4(corner, 0.0, 1.0); }`;
export { POST_VS };

// 13-tap downsample (Jimenez, SIGGRAPH 2014). On the first step each 2×2 group is weighted by
// 1 / (1 + luma) (Karis average), so a single very bright pixel can't flicker the bloom.
export const DOWN_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform bool u_karis;
out vec4 o;
vec3 s(vec2 off) { return texture(u_src, v_uv + off * u_texel).rgb; }
float w(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 g0 = (j + k + l + m) * 0.25;
  vec3 g1 = (a + b + d + e) * 0.25, g2 = (b + c + e + f) * 0.25;
  vec3 g3 = (d + e + g + h) * 0.25, g4 = (e + f + h + i) * 0.25;
  vec4 wt = vec4(0.125);
  float w0 = 0.5;
  if (u_karis) { w0 *= w(g0); wt *= vec4(w(g1), w(g2), w(g3), w(g4)); }
  vec3 sum = g0 * w0 + g1 * wt.x + g2 * wt.y + g3 * wt.z + g4 * wt.w;
  o = vec4(sum / (w0 + wt.x + wt.y + wt.z + wt.w), 1.0);
}`;

// 3×3 tent upsample, added onto the next larger level.
export const UP_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_radius;
out vec4 o;
vec3 s(vec2 off) { return texture(u_src, v_uv + off * u_texel * u_radius).rgb; }
void main() {
  vec3 sum = s(vec2(0, 0)) * 4.0
    + (s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1)) + s(vec2(0, 1))) * 2.0
    + s(vec2(-1, -1)) + s(vec2(1, -1)) + s(vec2(-1, 1)) + s(vec2(1, 1));
  o = vec4(sum / 16.0, 1.0);
}`;

export const FINAL_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomStrength;
uniform float u_exposure;
out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = texture(u_scene, v_uv).rgb + texture(u_bloom, v_uv).rgb * u_bloomStrength;
  vec3 m = aces(c * u_exposure);
  float l = dot(m, ${LUMA});
  o = vec4((vec3(l) + (m - vec3(l)) * ${f(POST.SATURATION)}) * ${f(POST.BRIGHTNESS)}, 1.0);
}`;

// Bloom level sizes: halve from the scene size until the short side would drop below MIN_LEVEL.
export function bloomLevels(w, h, min = POST.MIN_LEVEL, max = 6) {
  const out = [];
  let lw = w, lh = h;
  while (out.length < max) {
    lw = Math.max(1, Math.floor(lw / 2)); lh = Math.max(1, Math.floor(lh / 2));
    if (Math.min(lw, lh) < min) break;
    out.push([lw, lh]);
  }
  return out;
}
