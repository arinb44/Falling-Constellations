/* ---------- WebGL2 back layer: far field, background stars, galaxy ---------- */
// Everything below is drawn into an HDR target (post.js), then bloomed and tone mapped.
// Draw order, far to near: background → live nebulae → clusters and distant galaxies →
// background stars → dark dust → galaxy core glow → galaxy gas → galaxy stars → galaxy dust →
// H-II knots. Everything is additive (premultiplied, ONE/ONE) except the two dust layers,
// which are black with alpha (ONE/ONE_MINUS_SRC_ALPHA).
import * as S from './shaders.js';
import { G, STRIDE, buildStars as buildGalaxyStars } from './model.js';
import { FIELD_MARGIN, fieldOrigin } from '../sky/field.js';
import { createSky, updateClouds, CLOUDS } from '../sky/clouds.js';
import { mulberry32 } from '../sky/noise.js';
import { createPost, makeTarget, freeTarget } from './post.js';
import { S as SX, bakeStructure } from './structure.js';

const STAR_STRIDE = 7;   // background stars: u, v0, size, speed, phase, twinkle, (pad)

function compile(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
  const u = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(prog, i).name; u[name] = gl.getUniformLocation(prog, name); }
  return { prog, u };
}

// Background-star instance data in normalised coords, so a resize only changes the count.
export function fieldStarData(count, seed) {
  const rng = mulberry32(seed), d = new Float32Array(count * STAR_STRIDE);
  for (let i = 0; i < count; i++) {
    const o = i * STAR_STRIDE;
    d[o] = rng(); d[o + 1] = rng();
    d[o + 2] = rng() < 0.1 ? 1.6 : 0.4 + rng() * 0.7;
    d[o + 3] = 2 + rng() * 6;
    d[o + 4] = rng() * 6.28; d[o + 5] = 0.6 + rng() * 1.6;
  }
  return d;
}

// CPU-side data depends only on the seed; kept so a restored context rebuilds without re-baking
const cache = new Map();
function cpuData(seed) {
  if (!cache.has(seed)) {
    const stars = buildGalaxyStars(seed);
    cache.set(seed, { stars, structure: bakeStructure(stars, seed) });
  }
  return cache.get(seed);
}

export function createBackLayer(canvas, field, { forceLDR = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl || gl.isContextLost()) return null;

  const progs = {
    bg: compile(gl, S.FULLSCREEN_VS, S.BG_FS),
    core: compile(gl, S.FULLSCREEN_VS, S.CORE_FS),
    rect: compile(gl, S.RECT_VS, S.RECT_FS),
    stars: compile(gl, S.FIELDSTAR_VS, S.FIELDSTAR_FS),
    galaxy: compile(gl, S.GALAXY_VS, S.GALAXY_FS),
    disc: compile(gl, S.DISC_VS, S.DISC_FS),
    knots: compile(gl, S.KNOT_VS, S.GALAXY_FS),
    clouds: compile(gl, S.POST_VS, S.CLOUD_FS)
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, S.QUAD, gl.STATIC_DRAW);
  const withQuad = () => { gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); };

  // fullscreen + single-rect passes share one VAO
  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao); withQuad();
  const drawQuad = () => { gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLES, 0, 6); };
  const post = createPost(gl, compile, drawQuad, forceLDR);

  // galaxy: static instance buffer, uploaded once
  const { stars: galaxyData, structure } = cpuData(field.seed);
  const galaxyVao = gl.createVertexArray();
  gl.bindVertexArray(galaxyVao); withQuad();
  const gbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gbuf);
  gl.bufferData(gl.ARRAY_BUFFER, galaxyData, gl.STATIC_DRAW);
  const gs = STRIDE * 4;
  for (const [loc, size, off] of [[1, 3, 0], [2, 3, 3], [3, 2, 6], [4, 2, 8]]) {
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, gs, off * 4); gl.vertexAttribDivisor(loc, 1);
  }

  // arm structure: baked once in the pattern frame (structure.js), only rotated per frame
  const knotCount = structure.knots.length / SX.KNOT_STRIDE;
  const knotVao = gl.createVertexArray();
  gl.bindVertexArray(knotVao); withQuad();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, structure.knots, gl.STATIC_DRAW);
  for (const [loc, off] of [[1, 0], [2, 3]]) {
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, SX.KNOT_STRIDE * 4, off * 4); gl.vertexAttribDivisor(loc, 1);
  }
  // half-float so the faint gas doesn't band; float data must not be premultiplied on upload
  const floatTexture = data => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, structure.n, structure.n, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const gasTex = floatTexture(structure.gas), galaxyDustTex = floatTexture(structure.dust);

  // background stars: instance buffer rebuilt when the window size changes the count
  const starVao = gl.createVertexArray();
  gl.bindVertexArray(starVao); withQuad();
  const sbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
  const ss = STAR_STRIDE * 4;
  for (const [loc, size, off] of [[1, 2, 0], [2, 1, 2], [3, 1, 3], [4, 2, 4]]) {
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, ss, off * 4); gl.vertexAttribDivisor(loc, 1);
  }
  let starCount = 0;
  gl.bindVertexArray(null);

  // textures: canvases from the far-field bake, premultiplied on upload
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const texture = src => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return t;
  };
  const sprites = [...field.clusters.map(c => ({ obj: c, alpha: 1 })), ...field.galaxies.map(g => ({ obj: g, alpha: g.alpha }))]
    .map(s => ({ ...s, tex: texture(s.obj.sprite.canvas) }));
  let dustTex = null, bakedVersion = 0;

  // live nebulae: the sky state lives on the field so it survives a context restore
  const sky = field.sky || (field.sky = createSky(field.seed));
  const cloudState = { life: new Float32Array(S.CLOUD_MAX), pulse: new Float32Array(S.CLOUD_MAX) };
  const cl = new Float32Array(S.CLOUD_MAX * 4), cs = new Float32Array(S.CLOUD_MAX * 4), cc = new Float32Array(S.CLOUD_MAX * 3);
  let cloudTarget = null, cloudAt = -1e9;

  const view = { W: 0, H: 0, DPR: 1 };
  // quality: resolution scale (on top of the phone base scale), share of galaxy stars, bloom levels
  const quality = { scale: 1, stars: 1, bloom: 6, cloudHz: CLOUDS.REFRESH_HZ };
  const origin = { x: 0, y: 0 };

  // DPR here is the layer's own: device DPR × phone base scale; quality.scale is applied on top
  function resize(W, H, DPR) {
    view.W = W; view.H = H; view.DPR = DPR;
    const d = DPR * quality.scale;
    canvas.width = Math.max(1, Math.round(W * d)); canvas.height = Math.max(1, Math.round(H * d));
    post.resize(canvas.width, canvas.height, quality.bloom);
    // the cloud texture covers the whole field (viewport plus margin) at CLOUDS.RES
    freeTarget(gl, cloudTarget);
    const m = 1 + 2 * FIELD_MARGIN;
    cloudTarget = makeTarget(gl, Math.max(8, Math.round(canvas.width * m * CLOUDS.RES)), Math.max(8, Math.round(canvas.height * m * CLOUDS.RES)), post.hdr);
    cloudAt = -1e9;
    const n = Math.floor(W * H / 5500);
    if (n !== starCount) {
      gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
      gl.bufferData(gl.ARRAY_BUFFER, fieldStarData(n, field.seed ^ 0x5bd1e995), gl.STATIC_DRAW);
      starCount = n;
    }
  }

  function rect(x, y, w, h, tex, alpha) {
    const p = progs.rect;
    gl.uniform4f(p.u.u_rect, x, y, w, h);
    gl.uniform1f(p.u.u_alpha, alpha);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function drawClouds(t) {
    updateClouds(sky, t, cloudState);
    const n = Math.min(S.CLOUD_MAX, sky.clouds.length);
    for (let i = 0; i < n; i++) {
      const c = sky.clouds[i];
      cl[i * 4] = c.u; cl[i * 4 + 1] = c.v; cl[i * 4 + 2] = c.r; cl[i * 4 + 3] = c.strength;
      cs[i * 4] = c.ox; cs[i * 4 + 1] = c.oy; cs[i * 4 + 2] = cloudState.life[i]; cs[i * 4 + 3] = cloudState.pulse[i];
      cc[i * 3] = c.colour[0]; cc[i * 3 + 1] = c.colour[1]; cc[i * 3 + 2] = c.colour[2];
    }
    const p = progs.clouds;
    gl.bindFramebuffer(gl.FRAMEBUFFER, cloudTarget.fb);
    gl.viewport(0, 0, cloudTarget.w, cloudTarget.h);
    gl.disable(gl.BLEND);
    gl.useProgram(p.prog);
    gl.uniform1f(p.u.u_aspect, (view.W / view.H) || 1);
    gl.uniform1f(p.u.u_time, t * CLOUDS.SPEED);
    gl.uniform4fv(p.u['u_cl[0]'], cl);
    gl.uniform4fv(p.u['u_cs[0]'], cs);
    gl.uniform3fv(p.u['u_cc[0]'], cc);
    gl.uniform1i(p.u.u_count, n);
    drawQuad();
  }

  // one baked layer on the rotating galaxy plane
  function disc(tex, t, R) {
    const p = progs.disc;
    gl.bindVertexArray(quadVao);
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_view, view.W, view.H);
    gl.uniform1f(p.u.u_time, t);
    gl.uniform1f(p.u.u_radius, R);
    gl.uniform1f(p.u.u_ext, SX.EXT);
    gl.uniform1f(p.u.u_gain, 1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function setQuality(rung) {
    Object.assign(quality, rung);
    if (view.W) resize(view.W, view.H, view.DPR);
  }

  function draw(t) {
    if (gl.isContextLost()) return;
    const { W, H } = view, DPR = view.DPR * quality.scale;
    // the bake is redone after resizes; pick up new images when they change
    if (field.version !== bakedVersion) {
      if (dustTex) gl.deleteTexture(dustTex);
      dustTex = texture(field.dust);
      bakedVersion = field.version;
    }

    // the clouds move slowly, so their texture is redrawn only a few times a second
    if (t - cloudAt >= 1 / quality.cloudHz || t < cloudAt) { drawClouds(t); cloudAt = t; }

    post.begin();
    gl.disable(gl.BLEND);
    gl.bindVertexArray(quadVao);
    gl.useProgram(progs.bg.prog);
    gl.uniform2f(progs.bg.u.u_view, W, H);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const o = fieldOrigin(t, W, H, origin);
    const fw = W * (1 + 2 * FIELD_MARGIN), fh = H * (1 + 2 * FIELD_MARGIN);
    gl.useProgram(progs.rect.prog);
    gl.uniform2f(progs.rect.u.u_view, W, H);
    rect(o.x, o.y, fw, fh, cloudTarget.tex, 1);
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i], d = s.obj.sprite.size;
      rect(o.x + s.obj.u * fw - d / 2, o.y + s.obj.v * fh - d / 2, d, d, s.tex, s.alpha);
    }

    gl.bindVertexArray(starVao);
    gl.useProgram(progs.stars.prog);
    gl.uniform2f(progs.stars.u.u_view, W, H);
    gl.uniform1f(progs.stars.u.u_time, t);
    gl.uniform1f(progs.stars.u.u_dpr, DPR);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, starCount);

    if (dustTex) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(quadVao);
      gl.useProgram(progs.rect.prog);
      rect(o.x, o.y, fw, fh, dustTex, 1);
      gl.blendFunc(gl.ONE, gl.ONE);
    }

    const R = Math.max(W, H) * G.RADIUS;
    gl.bindVertexArray(quadVao);
    gl.useProgram(progs.core.prog);
    gl.uniform2f(progs.core.u.u_view, W, H);
    gl.uniform1f(progs.core.u.u_radius, R);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    disc(gasTex, t, R);

    gl.bindVertexArray(galaxyVao);
    gl.useProgram(progs.galaxy.prog);
    gl.uniform2f(progs.galaxy.u.u_view, W, H);
    gl.uniform1f(progs.galaxy.u.u_time, t);
    gl.uniform1f(progs.galaxy.u.u_radius, R);
    gl.uniform1f(progs.galaxy.u.u_dpr, DPR);
    // fewer stars: the remaining ones get brighter by 1/√share, so the galaxy dims only a little
    gl.uniform1f(progs.galaxy.u.u_boost, 1 / Math.sqrt(quality.stars));
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.round(G.N * quality.stars));

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    disc(galaxyDustTex, t, R);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.bindVertexArray(knotVao);
    gl.useProgram(progs.knots.prog);
    gl.uniform2f(progs.knots.u.u_view, W, H);
    gl.uniform1f(progs.knots.u.u_time, t);
    gl.uniform1f(progs.knots.u.u_radius, R);
    gl.uniform1f(progs.knots.u.u_dpr, DPR);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, knotCount);

    post.finish(canvas.width, canvas.height);
    gl.bindVertexArray(null);
  }

  return { gl, resize, draw, setQuality, quality, starCount: () => starCount, hdr: post.hdr, bloomLevels: post.levelCount };
}
