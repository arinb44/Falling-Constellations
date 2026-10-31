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
  float g = (exp(-d * d * 2.2) * 0.12 + exp(-d * d * 18.0) * 0.1) * ${f(G.CORE_DIM)};   // same cut as the stars
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
  float b = lum.x * mix(1.0, 0.15 + 1.6 * arm, lum.y) * dim;
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
