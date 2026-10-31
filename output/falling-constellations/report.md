# Falling Constellations: A Visual Upgrade Guide

**Prepared by:** Falling Constellations Research Agent
**Date:** 2026-10-31
**Status:** Final

---

## 1. Executive Summary

- **Direction chosen:** *Deep Field + Atlas*. A rich, telescope-coloured spiral galaxy glows in the background; fine-line, cream-and-gold constellations in the style of an old star atlas fall in front of it. Pacing stays calm.
- **The galaxy's arms probably wind themselves up.** The prototype spins inner stars faster on a fixed spiral, so by my calculation the centre gains a full turn on the edge about every 65 seconds and the arms smear out within minutes. Building the galaxy from nested, slightly tilted ellipses (the density-wave picture) gives arms that hold their shape forever [12][18].
- **Real galaxies are layered:** a warm core of old stars, blue-white arms of young stars, dark dust on the inner edge of each arm, and pink star-forming knots just past the dust [14][15][16][17]. Drawing these as separate layers is how professional tools do it [18].
- **Most of the "glow" comes from three steps:** let brightness go above white (HDR), soften it back with a filmic curve, and add a wide bloom halo [22][24][25]. Without HDR, overlapping stars clip to flat white.
- **Rendering split:** WebGL2 draws the galaxy (one draw call, positions computed on the GPU, 50k+ stars) at the back; Canvas 2D draws constellations, labels and shooting stars on top, where fine lines and text come for free [33][35][37].
- **Atlas constellations:** one ink colour, 3–4 graded star sizes, thin engraved-style lines, Garamond small caps, and a slower, eased draw-in [40][41][43][45].
- **Smoothness:** time-based motion, zero new objects per frame, the galaxy rendered below full resolution on phones, and an automatic quality step-down when frames run long [48][52][53][56].
- **Recommended order:** fix and restyle the constellations first (no WebGL needed), then move the galaxy to WebGL, then add effects, then tune for phones. Each step looks better than the last on its own.

---

## 2. Objective & Scope

**Objective.** Find how to turn the Falling Constellations Canvas 2D prototype into a generative art piece that is beautiful to watch and runs smoothly, and set out the upgrades in a ranked, buildable order.

**In scope:** aesthetic direction; galaxy astrophysics as it applies to rendering; Canvas 2D and WebGL2 techniques; constellation visuals; smoothness and performance; the existing `index.html` and `HANDOFF.md`.

**Out of scope:** audio; UI controls and sliders; seeded URLs; hosting; refactoring for its own sake; writing the final implementation; reduced-motion accessibility (left as an open question). Galaxy-Renderer (beltoforion) served as visual inspiration only; it is not cited and its code was not used.

---

## 3. Methodology

- **Prototype review** of `index.html` to tie each recommendation to a specific function.
- **Web research** across eight milestones, 60 sources logged in `notes.md`, each with date, summary and reliability note.
- **Source types:** official documentation (MDN, Khronos-related, engine docs), peer-reviewed astronomy (PASA, arXiv), industry talks (SIGGRAPH), established graphics references (LearnOpenGL, Inigo Quilez), browser bug trackers, and, for aesthetics, mission image captions, antique-map specialists and design writing.
- **Evaluation:** primary and expert sources preferred; forum and blog material used only where consistent with stronger sources and marked as heuristics. Several sources were read through search summaries rather than in full; this is noted in `notes.md`.
- **User decisions** at three points (aesthetic direction, rendering split, WebGL approach) shaped the later research.
- Statements marked *design inference* are my own reasoning from the sources, not claims a source makes.

---

## 4. Findings

### 4.1 Aesthetic direction

Three directions were developed from the research:

| | Basis | Character |
|---|---|---|
| A. Nocturne | Ambient-art principles: never demand attention, reward it; slow, natural motion; survive repeated viewing [5][9][10] | Calm, dim, restrained |
| B. Deep Field | Telescope colour practice: deliberate false-colour, warm core, blue arms, pink knots [1][2][3][4] | Rich, glowing, cinematic |
| C. Atlas | Historical star atlases: engraved lines, ink palette, serif labels, coordinate grid [6][7][8] | Minimal, elegant, chart-like |

**Chosen: Deep Field + Atlas**, with Nocturne pacing. The galaxy provides depth and colour; the Atlas constellations stay crisp and readable on top. Telescope imagery treats colour as an interpretive choice rather than a record of what the eye sees [1][3], which gives the piece licence to grade the galaxy for art rather than accuracy.

### 4.2 Building a convincing spiral galaxy

**Arms are a crowding pattern.** In density-wave theory, each star follows a slightly elliptical orbit, and each orbit's long axis is rotated a little more than the one inside it. Where the ellipses crowd together, arms appear. The stars move through the arms, so the arms never wind up [12][18].

**The prototype's problem.** `drawGalaxy` sets each star's angle as `theta0 + t * omega * 0.12` with `omega = 0.22 / (r + 0.12)`. At r = 0.1 the angle advances about 0.12 rad/s; at r = 1, about 0.024 rad/s. The centre therefore gains a full turn on the rim roughly every 65 s. *This is derived from the code, not measured; leaving the prototype open for five minutes will confirm it.* Combined with the 0.45 vertical squash and `twist = 5.2`, this explains the thin S-ribbon noted in the handoff.

**Physics caveat.** Current research holds that most real spiral arms are transient and recurrent rather than permanent density waves [13]. For an art piece that loops forever, the stable tilted-ellipse pattern is the better visual model; it is a stylisation.

**Anatomy of an arm** [14][15]: dust lane on the inner (concave) edge → bright band of young blue-white stars → pink H-II knots strung along it just downstream. Some studies dispute how strict this ordering is [14], but it is the classic look in telescope images.

**Colour by population** [16][17]: yellow-white bulge of old stars; blue-white arms; pink knots; a fainter, warmer glow between the arms.

**Layers** [18]: Gaia Sky, a professional astronomy visualiser, builds galaxies from separate channels (bulge, disc stars, arm stars, gas, H-II, dust). Light layers are additive; dust is subtractive so it darkens what is behind it. Soft layers (gas, dust) render at about a quarter resolution. Noise (FBM) on size and brightness breaks up regularity [18][21].

### 4.3 Glow, dust, nebulae and colour

- **HDR headroom.** With 8-bit colour, overlapping additive stars clip to white and lose colour. Render the galaxy into a half-float (RGBA16F) buffer so brightness can exceed 1 [22][26]. Support is near-universal on phones [27], but some Android devices fail silently, so check the extension and framebuffer completeness and fall back to 8-bit [28].
- **Filmic tone mapping.** The Narkowicz ACES fit rolls highlights off gently so the core glows instead of clipping [25]:
  `color = clamp((x*(2.51*x + 0.03)) / (x*(2.43*x + 0.59) + 0.14), 0.0, 1.0)`
- **Bloom.** A chain of downsamples then upsamples (3×3 tent filter) gives a wide, stable halo; a "Karis average" on the first step prevents single bright pixels from flickering [24]. A two-pass Gaussian blur is a simpler first version [22].
- **Star sprites.** Draw every star from one pre-made glow texture (bright core, soft wide falloff) scaled by brightness, rather than building gradients per star [31]. Faint 4-point spikes on the brightest few add a telescope feel [31][32].
- **Dust.** A soft darkening layer along the inner edge of each arm [14][18].
- **Nebula and gas.** Domain-warped FBM noise (`fbm(p + 4*fbm(p))`) gives organic, cloud-like shapes [29], at about 4× the cost of plain noise [30]. *Design inference:* because the galaxy rotates very slowly, bake these noise layers once into a low-resolution texture and rotate it with the galaxy instead of recomputing per frame.
- **Grading.** After tone mapping, pull the galaxy's overall brightness and saturation down slightly so the Atlas lines read clearly on top (*design inference*).

### 4.4 Moving to WebGL

- **One draw call for the whole galaxy.** Upload star data once to a static buffer; the vertex shader computes each position from time. Few large draws and static buffers are MDN's core advice [33].
- **Instanced quads rather than `gl.POINTS`.** Points have a device-dependent maximum size and pop at screen edges; a small instanced quad avoids both [34].
- **Tilted-ellipse orbit in the vertex shader** (*design inference from [12][18][33]*). Per star: radius `a`, starting angle `θ0`, size, colour. Then:
  ```
  tilt  = a * TWIST                    // orientation grows with radius → arms
  e     = eccentricity(a)              // small in core, larger mid-disc; tune by eye
  θ     = θ0 + omega(a) * time         // stars still orbit; pattern stays put
  p     = vec2(a*cos(θ), a*(1.0-e)*sin(θ))
  p     = rotate(p, tilt)
  p.y  *= VIEW_SQUASH                  // ~0.6–0.7 for a gentler viewing angle
  ```
  The arm pattern depends only on `tilt(a)`, so it never winds up, however fast inner stars move.
- **Hybrid layering (chosen).** WebGL canvas at the back with `alpha: false`; transparent Canvas 2D canvas on top. Opaque WebGL composites cheaply and avoids open cross-browser bugs with transparent WebGL canvases [35][36]. Canvas 2D gives antialiased fine lines and text natively; WebGL lines are often clamped to 1 px and text needs an atlas [37].
- **Raw WebGL2 (chosen).** Keeps the single-file, no-dependency nature. The cost is writing the render targets, bloom chain and tone map by hand (a few hundred lines). For comparison, three.js would provide these ready-made [38]; small helpers like twgl.js (~7 kB) only remove boilerplate [39].

### 4.5 Constellation polish (Atlas style)

- **Graded star symbols.** Atlases use a small fixed set of dot sizes for brightness [40]. Use 3–4 size classes of crisp cream dots with tight glow sprites, pre-rendered once to offscreen canvases. The brightest star in each figure may get faint spikes to echo the galaxy.
- **Engraved lines.** About 0.75–1 px, pale gold, low opacity, round caps; leave a small gap where a line meets a star (*design inference from atlas convention [6][41]; the gap is not sourced*).
- **One ink colour.** Replace the 7 random hues (`HUES`) with one cream/gold ink and very slight variation, so constellations read as a single chart layer.
- **Typography.** Garamond-style serif in small caps with wide tracking, fitting the engraved atlas [41][45]. EB Garamond reads better at small sizes; Cormorant is more dramatic but thin. Load from Google Fonts and wait for `document.fonts.load(...)` before drawing [47]. Use `ctx.letterSpacing` where supported (Chrome 99, Firefox 115, Safari 18.4), else keep the prototype's manual spacing [46].
- **Restraint.** Bayer's first-edition tables showing through the plates is an old lesson in clutter [42]. Coordinate arcs or Greek-letter tags, if used at all, should be barely visible.
- **Draw-in.** Ease each edge with easeInOutCubic, overlap edges slightly, and pop each star in just before its line arrives [43]. Keep figures at 2–4 s; steep curves need time to look natural [44]. Ease the fade-out near the bottom too.

### 4.6 Keeping it smooth

- **Time-based, clamped motion** so it runs the same at 60 and 120 Hz [48][49]; keep the existing `dt` clamp. Keep positions fractional to avoid micro-stutter [50].
- **Galaxy below full resolution.** Render the WebGL layer at about 0.5–0.75× device pixel ratio on phones and let the browser scale it; the constellation layer stays at full sharpness [52][53][54]. Fill rate is the usual phone bottleneck [52].
- **Adaptive quality.** Average frame time over 1–2 s (after startup spikes); if it stays over budget, step down galaxy resolution, then star count, then bloom levels; step back up slowly [53][54]. Treat a steady rise with no scene change as thermal throttling [53].
- **Power.** A slow piece doesn't need 120 Hz; dynamic resolution and frame-rate scaling cut mobile GPU power by up to 33% and 38% in one study [51][55].
- **Zero allocation per frame.** GC pauses of 1–5 ms are a large share of an 8–17 ms frame [56]. Reuse arrays and pool objects [57].
- **Lifecycle.** Pause on `visibilitychange`; handle `webglcontextlost` / `webglcontextrestored` by rebuilding buffers and textures, and test with `WEBGL_lose_context` [58][59]. iOS may drop the context after backgrounding [60].

---

## 5. Analysis

**Beauty versus cost.** The single largest visual change (a dense, layered, non-winding galaxy with HDR and bloom) is also the largest build effort, but its runtime cost is modest once positions are computed on the GPU and soft layers are baked or rendered at low resolution. The constellation restyle is the opposite: small effort, large perceived gain, and almost no runtime cost.

**Why the hybrid split pays off twice.** It keeps the constellation code you already have and Canvas 2D's native line and text quality, and it lets the galaxy run at reduced resolution on phones without blurring the constellations. The trade-off is that constellations don't receive the galaxy's bloom; they need their own small glow sprites (already recommended).

**Independence of the work.** Because the constellations stay in Canvas 2D, all constellation and smoothness fixes can land before any WebGL exists. That makes the upgrade low-risk: every stage is a working, better-looking piece.

**Where accuracy yields to art.** The tilted-ellipse model, colour grading, and dimming the galaxy behind the constellations are stylisations. They follow how real galaxies and telescope images look, not exact physics [1][13].

---

## 6. Conclusions & Recommendations

### Ranked upgrade list

Ranked for the best result at each stage. Effort and runtime cost are rough estimates (Low / Medium / High), not measurements.

| # | Upgrade | Visual effect | How | Effort | Runtime cost | Prototype function |
|---|---|---|---|---|---|---|
| **Stage 1: constellations and hygiene (Canvas 2D only)** |||||||
| 1 | Atlas restyle | Cohesive, elegant chart look | One cream/gold ink; 3–4 graded star sizes; thin lines with gaps at stars | Low | Lower than now | `makeConstellation`, `drawConstellation`, `HUES` |
| 2 | Pre-rendered star sprites | Softer, truer points of light | Draw 3–4 glow sprites once to offscreen canvases; `drawImage` per star | Low | Much lower | `drawConstellation` |
| 3 | Typography | Engraved-atlas labels | EB Garamond small caps, wide tracking; wait for font load | Low | None | `drawConstellation` (label) |
| 4 | Eased draw-in and fades | Graceful, unhurried motion | easeInOutCubic per edge with overlap; stars pop before lines arrive; eased fade-out | Low | None | `drawConstellation` |
| 5 | Zero-allocation loop | Removes stutter | Reuse projected-point arrays; cache gradients; pool constellations; fix `autoCount` with an `isAuto` flag | Low | Lower | `drawConstellation`, `frame`, `drawShooters` |
| 6 | Resize and lifecycle | No visible jumps | Resize buffers without `populate()`; pause on `visibilitychange` | Low | None | `resize`, `frame` |
| **Stage 2: WebGL galaxy foundation** |||||||
| 7 | WebGL2 galaxy layer | Dense, luminous galaxy (50k+ stars) | Opaque WebGL canvas behind a transparent 2D canvas; static buffer; instanced quads with a glow sprite; one draw call | High | Low (GPU) | replaces `buildGalaxy`, `drawGalaxy` |
| 8 | Tilted-ellipse orbits | Full spiral that never winds up | Orbit maths in vertex shader; tilt grows with radius; squash ~0.6–0.7 | Medium | None extra | (new vertex shader) |
| 9 | Colour by population | Warm core, blue arms | Per-star colour from radius and arm distance | Low | None | (star data) |
| **Stage 3: Deep Field effects** |||||||
| 10 | HDR + filmic tone map | Core glows instead of clipping; colours survive | RGBA16F target with fallback; Narkowicz ACES in final pass | Medium | Low | (new passes) |
| 11 | Bloom | Soft, wide halo | Downsample/upsample chain; Karis average on first step; Gaussian as a first version | Medium | Medium | (new passes) |
| 12 | Dust lanes and H-II knots | Depth and structure in the arms | Darkening dust layer on arms' inner edges; pink knots just past the dust | Medium | Low–Medium | (new layers) |
| 13 | Nebula and gas | Organic, cloudy glow | Domain-warped FBM baked into a low-res texture, rotated with the galaxy | Medium | Low (baked) | (new layer) |
| 14 | Grading | Constellations read clearly on top | Slight brightness and saturation pull on the galaxy after tone mapping | Low | None | (final pass) |
| **Stage 4: tuning for every device** |||||||
| 15 | Reduced galaxy resolution on phones | Smooth on phones, no visible loss | Render WebGL at ~0.5–0.75× DPR; 2D layer at full DPR | Low | Much lower | `resize` |
| 16 | Adaptive quality | Stays smooth under load and heat | Frame-time loop stepping resolution → star count → bloom | Medium | None | `frame` |
| 17 | Context-loss recovery | No blank screen after backgrounding | Rebuild GPU resources on restore; test with `WEBGL_lose_context` | Low | None | (WebGL setup) |
| **Optional touches** |||||||
| 18 | Diffraction spikes | Telescope sparkle | Faint 4-point spikes on the brightest few stars | Low | Low | sprites |
| 19 | Faint Atlas grid | Chart character | Barely visible coordinate arcs; drop if cluttered | Low | Low | (2D layer) |

### Next steps
1. Add a small on-screen frame-time readout for development, so each change can be checked against the budget.
2. Implement Stage 1 in the existing file; confirm the winding behaviour by watching the current galaxy for five minutes.
3. Build Stage 2 as a separate WebGL canvas behind the existing one.
4. Add Stage 3 effects one at a time, judging each by eye.
5. Test on at least one mid-range phone and one 120 Hz screen before Stage 4 tuning.

---

## 7. Limitations & Open Questions

- **No measurements.** Effort and cost ratings are estimates from sources and reasoning; nothing was profiled on the user's devices.
- **Winding claim is derived from code,** not observed. Confirm by watching.
- **Partial reads.** Several sources (e.g. LearnOpenGL [22], Jimenez slides [24], Narkowicz's original post [25], Quilez [29]) were read through search summaries or secondary implementations; formulas were cross-checked across independent implementations.
- **Physics is stylised.** The density-wave model is a visual choice; current research favours transient arms [13].
- **Aesthetic judgments** (line gaps, grading, font choice) are design inferences and should be tuned by eye.
- **Mobile behaviour varies.** Half-float support and context loss differ by device [27][28][60].
- **Open question:** should `prefers-reduced-motion` be supported (e.g. slower fall, no shooting stars)? Currently out of scope.

---

## 8. Decision Log

| Date | Decision | Choice |
|---|---|---|
| 2026-10-31 | Project name | Falling Constellations (`falling-constellations`) |
| 2026-10-31 | Research output | Visual upgrade guide |
| 2026-10-31 | Technology limit | WebGL allowed |
| 2026-10-31 | Galaxy-Renderer's role | Inspiration only, not a source |
| 2026-10-31 | Aesthetic direction | Deep Field + Atlas |
| 2026-10-31 | Rendering split | Hybrid: WebGL galaxy, Canvas 2D constellations |
| 2026-10-31 | WebGL approach | Raw WebGL2, no library |

---

## 9. Sources

1. Arcand, K. K., Watzke, M., Rector, T., Levay, Z. G., DePasquale, J., Smarr, O. "Processing Color in Astronomical Imagery." *Studies in Media and Communication* 1(2), 2013. https://arxiv.org/abs/1308.5237
2. "Are the Colors in Astronomical Images 'Real'?" *Scientific American*. https://scientificamerican.com/article/are-the-colors-in-space-real
3. "JWST sees light invisible to the eye. These scientists decide how to color it." *Astronomy*. https://www.astronomy.com/science/jwst-sees-light-invisible-to-the-eye-these-scientists-decide-how-to-color-it
4. "Are James Webb Space Telescope images really so colorful?" Space.com. https://space.com/what-are-true-colors-image-james-webb-space-telescope-jwst
5. "Re:Cycle: A Computationally Generative Ambient Video System." ELMCIP Knowledge Base, 2012. https://elmcip.net/node/4501
6. "Star Atlas" demo. amCharts. https://www.amcharts.com/demos/star-atlas/
7. "Historical constellation maps." SuperStock. https://acp.superstock.com/story/historical-constellation-maps
8. "Antique celestial charts of the northern and southern hemispheres, 1884." Chairish listing. https://www.chairish.com/product/28724771/antique-celestial-charts-of-the-northern-and-southern-hemispheres-1884
9. Clarke, A. "Ambient animations in web design: principles and implementation guide" (via feedbagel). https://feedbagel.com/post/ambient-animations-in-web-design-principles-and-implementation-guide
10. "Calm & Relaxation animation principles." playbooks.com (community skill file). https://playbooks.com/skills/dylantarre/animation-principles/calm-relaxation
11. Night-sky p5.js sketches. NYU Shanghai IMA; Goldsmiths Computational Arts. https://wp.nyu.edu/shanghai-ima-documentation/?p=25439 ; https://compartsblog.doc.gold.ac.uk/index.php/work/long-nights/
12. "The spiral arms of galaxies." arXiv:2210.13632, 2022. https://arxiv.org/pdf/2210.13632
13. Dobbs, C., Baba, J. "Dawes Review 4: Spiral Structures in Disc Galaxies." *PASA*, 2014. https://arxiv.org/abs/1407.5062
14. "A test of arm-induced star formation in spiral galaxies from near-IR and Hα imaging." arXiv:astro-ph/0208401, 2002. https://arxiv.org/pdf/astro-ph/0208401
15. "Global morphology and physical relations between stars, gas and dust in M100." Instituto de Astrofísica de Canarias. https://iac.edu.es/es/ciencia-y-tecnologia/publicaciones/global-morphology-and-physical-relations-between-stars-gas-and-dust-disc-and-arms-m100
16. "Spiral galaxy." Wikipedia (accessed 2026-10-31). https://en.wikipedia.org/wiki/Spiral_galaxy
17. "Colours of the Lost Galaxy" (NGC 4535). NASA / ESA Hubble. https://science.nasa.gov/image-detail/colours-of-the-lost-galaxy-2
18. "Procedural galaxies." Gaia Sky documentation (since 3.7.1), ARI Heidelberg, 2025. https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/Procedural-galaxies.html
19. "Stellar Galaxy." University of Toronto CSC317 showcase, 2025. https://www.dgp.toronto.edu/~joonho/courses/csc317-2025-09/showcase/51
20. "Particle Galaxy shader design." OpenDesign. https://open-design.ai/showcase/particle-galaxy-shader-design/
21. "Volumetric Cosmic Dust." godotshaders.com (MIT). https://godotshaders.com/shader/volumetric-cosmic-dust/
22. de Vries, J. "Bloom." LearnOpenGL. https://learnopengl.com/Advanced-Lighting/Bloom
23. PV227 Lesson 06 (HDR and tone mapping). Masaryk University, 2018. https://is.muni.cz/el/fi/podzim2018/PV227/um/lectures/Lesson_06.pdf
24. Jimenez, J. "Next Generation Post Processing in Call of Duty: Advanced Warfare." SIGGRAPH 2014, Advances in Real-Time Rendering. https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/
25. Narkowicz, K. "ACES Filmic Tone Mapping Curve," 2015 (via Lygia GLSL library). https://git.gay/kaneraZh/lygia/src/branch/main/color/tonemap/aces.glsl
26. "EXT_color_buffer_float." MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float
27. "EXT_color_buffer_float." web3dsurvey.com. https://web3dsurvey.com/webgl2/extensions/EXT_color_buffer_float
28. WebKit bug 216010; three.js PR #33114. https://bugs.webkit.org/show_bug.cgi?id=216010 ; https://gh.r-mj.com/mrdoob/three.js/pull/33114
29. Quilez, I. "Domain warping." https://iquilezles.org/articles/warp
30. darkly WGSL fbm library. docs.rs. https://docs.rs/crate/darkly/latest/source/shaders/lib/fbm.wgsl
31. tiffany352. godot-starlight (MIT). https://www.github.com/tiffany352/godot-starlight
32. SpaceEngine forum: diffraction spikes. https://forum.spaceengine.org/viewtopic.php%3Fp=8222.html
33. "WebGL best practices." MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
34. WebKit bug 230749: poor WebGL point performance in Safari 15. https://bugs.webkit.org/show_bug.cgi?id=230749
35. Tavares, G. "WebGL and Alpha." WebGL2 Fundamentals. https://webgl2fundamentals.org/webgl/lessons/webgl-and-alpha.html
36. Firefox bug 1446550; WebKit bug 278926. https://bugzilla.mozilla.org/show_bug.cgi?id=1446550 ; https://bugs.webkit.org/show_bug.cgi?id=278926
37. Thick line rendering: pythreejs docs; xeokit; "Rendering thick lines in WebGL" (Level Up Coding). https://pythreejs.readthedocs.io/en/stable/examples/ThickLines.html ; https://xeokit.github.io/sdk/docs/api/interfaces/model.scene.ThickLinesTechniqueParams.html ; https://levelup.gitconnected.com/rendering-thick-lines-in-webgl-a-practical-approach-from-a-real-engine-0611f6eb88db
38. "UnrealBloomPass." three.js documentation. https://threejs.org/docs/pages/UnrealBloomPass.html
39. webgl-libs-comparison (jsulpis); OGL README. https://awesome.ecosyste.ms/projects/github.com%2Fjsulpis%2Fwebgl-libs-comparison ; https://github.com/luruke/ogl
40. Book review: *Sky Atlas 2000.0* (Tirion & Sinnott). https://xn--astronomawww-zfb.amazings.com/sbb/reviews/review0334.html
41. "Bayer's Uranometria." Barry Lawrence Ruderman Antique Maps. https://raremaps.com/essay/47/bayers-uranometria ; https://raremaps.com/gallery/print/27276
42. "Uranometria." Wikipedia (accessed 2026-10-31). https://en.wikipedia.org/wiki/Uranometria
43. Penner, R. Easing equations, 2001 (via Qt source). https://code.qt.io/cgit/qt/qtbase.git/tree/src/3rdparty/easing/easing.cpp
44. "Curves.easeOutQuart." Flutter API documentation. https://api.flutter.dev/flutter/animation/Curves/easeOutQuart-constant.html
45. Cormorant Garamond (madegooddesigns.com); EB Garamond (fontspace.com). https://madegooddesigns.com/?p=679 ; https://www.fontspace.com/eb-garamond-font-f32676
46. "CanvasRenderingContext2D: letterSpacing." MDN; caniuse. https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/letterSpacing ; https://caniuse.com/mdn-api_canvasrenderingcontext2d_letterspacing
47. "CSS Font Loading API." MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API
48. WebKit bug 173434: support for 120 Hz requestAnimationFrame. https://lists.webkit.org/pipermail/webkit-unassigned/2022-August/1051007.html
49. "requestAnimationFrame explained." DEV Community. https://dev.to/tawe/requestanimationframe-explained-why-your-ui-feels-laggy-and-how-to-fix-it-3ep2
50. "Why does my pixel-art camera drift and jitter on 120hz monitors?" Kirupa forum. https://forum.kirupa.com/t/why-does-my-pixel-art-camera-drift-and-jitter-on-120hz-monitors/681222
51. W3C public-houdini archive, August 2018. https://lists.w3.org/Archives/Public/public-houdini-archive/2018Aug/0078.html
52. "Runtime devicePixelRatio." PlayCanvas user manual. https://developer.playcanvas.com/user-manual/optimization/runtime-devicepixelratio/
53. "WebGL mobile performance." abratabia.com. https://abratabia.com/mobile-browser-performance/webgl-mobile-performance.php
54. "Low fps on iOS mobile with pixel ratio set as window.devicePixelRatio." three.js forum. https://discourse.threejs.org/t/low-fps-on-ios-mobile-with-pixel-ration-set-as-window-devicepixelratio/4963
55. "Mobile GPU Power Consumption Reduction via Dynamic Resolution and Frame Rate Scaling." UCL, HotPower 2014. https://solar.cs.ucl.ac.uk/appoptimization.github.io/publications/NCZ2014
56. "JavaScript GC pauses, allocation rate and frontend jank." DEV Community. https://dev.to/helloashish99/javascript-gc-pauses-allocation-rate-frontend-jank-3jig
57. "Make your JavaScript apps smoother." Creative Bloq. https://www.creativebloq.com/javascript/make-your-javascript-apps-smoother-12125879
58. "WEBGL_lose_context." MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context
59. Khronos public_webgl mailing list, April 2010. https://www.khronos.org/webgl/public-mailing-list/public_webgl/1004/msg00074.php
60. "WebGL2 graphics context is sometimes lost after backgrounding the app." Textastic feedback. https://feedback.textasticapp.com/communities/1/topics/4001-webgl2-graphics-context-is-sometimes-lost-in-the-built-in-html-viewer-after-backgrounding-the-app
