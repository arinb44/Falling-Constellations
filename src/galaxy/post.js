/* ---------- HDR scene target, bloom chain, tone map ---------- */
// The back layer draws into an RGBA16F target so overlapping stars can add up past white
// without clipping; bloom is built from that, then ACES maps it back to the screen.
// Half-float render targets need EXT_color_buffer_float, and some Android devices report it
// but still fail, so the framebuffer is checked for completeness and RGBA8 is the fallback.
import { POST, POST_VS, DOWN_FS, UP_FS, FINAL_FS, bloomLevels } from './shaders.js';

export function createPost(gl, compile, drawQuad, forceLDR = false) {
  const progs = {
    down: compile(gl, POST_VS, DOWN_FS),
    up: compile(gl, POST_VS, UP_FS),
    final: compile(gl, POST_VS, FINAL_FS)
  };

  function target(w, h, hdr) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h, ok };
  }
  const free = t => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };

  // Decide HDR once: extension present and a small half-float target actually completes.
  let hdr = false;
  if (!forceLDR && gl.getExtension('EXT_color_buffer_float')) {
    const probe = target(4, 4, true);
    hdr = probe.ok;
    free(probe);
  }

  let scene = null, levels = [];
  // maxLevels comes from the quality controller; 0 turns bloom off
  function resize(w, h, maxLevels = 6) {
    free(scene); levels.forEach(free);
    scene = target(w, h, hdr);
    levels = bloomLevels(w, h, POST.MIN_LEVEL, maxLevels).map(([lw, lh]) => target(lw, lh, hdr));
  }

  // Everything drawn between begin() and finish() lands in the HDR scene target.
  function begin() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
    gl.viewport(0, 0, scene.w, scene.h);
  }

  function pass(prog, dst, src) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null);
    gl.viewport(0, 0, dst ? dst.w : scene.w, dst ? dst.h : scene.h);
    gl.useProgram(prog.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(prog.u.u_src, 0);
    gl.uniform2f(prog.u.u_texel, 1 / src.w, 1 / src.h);
  }

  function finish(screenW, screenH) {
    gl.disable(gl.BLEND);
    // down: scene → level 0 → level 1 → ...
    for (let i = 0; i < levels.length; i++) {
      pass(progs.down, levels[i], i ? levels[i - 1] : scene);
      gl.uniform1i(progs.down.u.u_karis, i === 0 ? 1 : 0);
      drawQuad();
    }
    // up: add each level onto the next larger one
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = levels.length - 1; i > 0; i--) {
      pass(progs.up, levels[i - 1], levels[i]);
      gl.uniform1f(progs.up.u.u_radius, POST.BLOOM_RADIUS);
      drawQuad();
    }
    gl.disable(gl.BLEND);

    // final: scene + bloom, tone mapped, to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, screenW, screenH);
    const f = progs.final;
    gl.useProgram(f.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex); gl.uniform1i(f.u.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, levels.length ? levels[0].tex : scene.tex); gl.uniform1i(f.u.u_bloom, 1);
    gl.uniform1f(f.u.u_bloomStrength, levels.length ? POST.BLOOM : 0);
    gl.uniform1f(f.u.u_exposure, POST.EXPOSURE);
    drawQuad();
    gl.activeTexture(gl.TEXTURE0);
  }

  return { hdr, resize, begin, finish, levelCount: () => levels.length };
}
