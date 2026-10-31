/* ---------- WebGL2 back layer: far field, background stars, galaxy ---------- */
// Draw order, far to near: background → nebulae → clusters and distant galaxies →
// background stars → dark dust → galaxy core glow → galaxy stars. Everything is additive
// (premultiplied, ONE/ONE) except the dust, which is black with alpha (ONE/ONE_MINUS_SRC_ALPHA).
import * as S from './shaders.js';
import { G, STRIDE, buildStars as buildGalaxyStars } from './model.js';
import { FIELD_MARGIN, fieldOrigin, pulse } from '../sky/field.js';
import { mulberry32 } from '../sky/noise.js';

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

export function createBackLayer(canvas, field) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return null;

  const progs = {
    bg: compile(gl, S.FULLSCREEN_VS, S.BG_FS),
    core: compile(gl, S.FULLSCREEN_VS, S.CORE_FS),
    rect: compile(gl, S.RECT_VS, S.RECT_FS),
    stars: compile(gl, S.FIELDSTAR_VS, S.FIELDSTAR_FS),
    galaxy: compile(gl, S.GALAXY_VS, S.GALAXY_FS)
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, S.QUAD, gl.STATIC_DRAW);
  const withQuad = () => { gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); };

  // fullscreen + single-rect passes share one VAO
  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao); withQuad();

  // galaxy: static instance buffer, uploaded once
  const galaxyData = buildGalaxyStars(field.seed);
  const galaxyVao = gl.createVertexArray();
  gl.bindVertexArray(galaxyVao); withQuad();
  const gbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gbuf);
  gl.bufferData(gl.ARRAY_BUFFER, galaxyData, gl.STATIC_DRAW);
  const gs = STRIDE * 4;
  for (const [loc, size, off] of [[1, 3, 0], [2, 3, 3], [3, 2, 6], [4, 2, 8]]) {
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, gs, off * 4); gl.vertexAttribDivisor(loc, 1);
  }

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
  let cloudTex = [], dustTex = null, bakedVersion = 0;

  const view = { W: 0, H: 0, DPR: 1 };
  const origin = { x: 0, y: 0 };

  function resize(W, H, DPR) {
    view.W = W; view.H = H; view.DPR = DPR;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    gl.viewport(0, 0, canvas.width, canvas.height);
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

  function draw(t) {
    const { W, H, DPR } = view;
    // the bake is redone after resizes; pick up new images when they change
    if (field.version !== bakedVersion) {
      for (const t of cloudTex) gl.deleteTexture(t);
      if (dustTex) gl.deleteTexture(dustTex);
      cloudTex = field.clouds.map(c => texture(c.image)); dustTex = texture(field.dust);
      bakedVersion = field.version;
    }

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
    // each nebula cloud on its own, brightened by its pulse
    for (let i = 0; i < cloudTex.length; i++) {
      const c = field.clouds[i], r = c.rect;
      rect(o.x + r.u * fw, o.y + r.v * fh, r.uw * fw, r.vh * fh, cloudTex[i], pulse(c, t));
    }
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

    gl.bindVertexArray(galaxyVao);
    gl.useProgram(progs.galaxy.prog);
    gl.uniform2f(progs.galaxy.u.u_view, W, H);
    gl.uniform1f(progs.galaxy.u.u_time, t);
    gl.uniform1f(progs.galaxy.u.u_radius, R);
    gl.uniform1f(progs.galaxy.u.u_dpr, DPR);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, G.N);
    gl.bindVertexArray(null);
  }

  return { gl, resize, draw, starCount: () => starCount };
}
