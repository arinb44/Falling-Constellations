# Notes: Falling Constellations

## Milestone 1: Prototype review (2026-10-31)

Source reviewed: `/Users/arins/Downloads/index.html` and `/Users/arins/Downloads/HANDOFF.md` (the user's own prototype; primary source for current behaviour).

### What works well
- **Constellation shapes** (`makeConstellation`): Prim's MST plus 0–2 loop edges always gives connected, untangled figures that read as constellations.
- **Draw-in animation** (`drawConstellation`): edges grow one after another; the label fades in with progress. This is the most "alive" part of the piece.
- **Depth cue:** `depth` scales size, speed and parallax together, which gives a believable sense of layers.
- **Robust loop:** `dt` clamped to 0.05 s; canvas scaled by DPR (capped at 2).
- **Additive blending** (`globalCompositeOperation = 'lighter'`) for the galaxy already gives some glow where points overlap.

### Visual shortcomings
- **Galaxy reads as a thin S-ribbon**, not a spiral: `twist = 5.2`, y squashed to 0.45, small `jitter` (HANDOFF known issue).
- **Galaxy is sparse:** 3,200 one- or two-pixel squares (`fillRect`), drawn with no per-star brightness variation, so it looks grainy, not luminous.
- **No dust, no nebula, no bloom:** the only soft light is one radial gradient at the core.
- **Colour:** four fixed RGBA buckets for the galaxy; constellation hues drawn from a 7-hue palette with no relation to the galaxy palette, so the two layers don't share a colour story.
- **Star glows** are linear radial gradients: soft but flat; there is no bright core falloff that reads like a real point of light.
- **Background:** flat `#02030a` plus a purple top gradient; no depth or vignette.
- **Label typography:** monospace with spaced letters; functional, but a typographic choice that should follow the chosen aesthetic.

### Smoothness and performance issues
- `createRadialGradient` called per constellation star per frame (≈ 9 constellations × 5–11 stars) plus one for the galaxy core; gradients are built anew every frame (HANDOFF notes this).
- `createLinearGradient` built every frame for the background and each shooting star.
- `c.pts.map(...)` allocates new objects per constellation per frame → garbage-collection pressure, a common cause of occasional stutter.
- Galaxy: 3,200 `fillRect` calls looped 4 times (once per colour bucket, skipping others) = 12,800 iterations per frame. Fine at this count; will not scale to 50k+ in Canvas 2D.
- Spawning is random per frame (`Math.random() < dt*2.2`), so density can bunch up; `autoCount` bug counts click-spawned constellations too.
- `resize()` calls `populate()`, so every window resize wipes and regenerates all constellations (a visible jump).
- No `visibilitychange` handling; relies on the `dt` clamp alone.

### Mapping to research questions
| Area | Prototype function | Research question |
|---|---|---|
| Galaxy shape | `buildGalaxy`, `drawGalaxy` | Q2 |
| Glow / colour / dust | `drawGalaxy`, `drawConstellation`, `frame` background | Q3 |
| Scale to 50k+ | `drawGalaxy` | Q4 |
| Constellation visuals | `drawConstellation` | Q5 |
| Smoothness | `frame`, `drawConstellation`, `resize` | Q6 |

---

## Milestone 2: Aesthetic study (2026-10-31)

### Sources
| # | Title | Author / publisher | Date | URL | Summary | Reliability |
|---|---|---|---|---|---|---|
| S1 | Processing Color in Astronomical Imagery | Arcand, Watzke, Rector, Levay, DePasquale, Smarr; *Studies in Media and Communication* 1(2) | 2013 | https://arxiv.org/abs/1308.5237 | Colour is one of the most basic choices in telescope imagery; images from invisible light are a "translation"; palette choice affects how the public reads and trusts the image. | High (peer-reviewed; authors are Chandra/Hubble/NOIRLab image specialists). Abstract only read. |
| S2 | Are the Colors in Astronomical Images 'Real'? | Scientific American | n.d. (checked 2026-10-31) | https://scientificamerican.com/article/are-the-colors-in-space-real | Telescope images are false-colour composites of single-filter exposures. | Medium-high (reputable science press). Seen via search summary. |
| S3 | JWST sees light invisible to the eye. These scientists decide how to color it | Astronomy magazine | n.d. | https://www.astronomy.com/science/jwst-sees-light-invisible-to-the-eye-these-scientists-decide-how-to-color-it | Colour mapping is a deliberate, judgment-based job; Hubble palette maps S/H/O narrowband to R/G/B. | Medium-high. Seen via search summary. |
| S4 | Are James Webb Space Telescope images really so colorful? | Space.com | n.d. | https://space.com/what-are-true-colors-image-james-webb-space-telescope-jwst | JWST colours represent infrared light much longer than visible; mapped to visible hues. | Medium. Seen via search summary. |
| S5 | Re:Cycle: A Computationally Generative Ambient Video System | ELMCIP Knowledge Base (Bizzocchi et al.) | 2012 | https://elmcip.net/node/4501 | Ambient video, after Brian Eno's ambient music, should never demand attention but reward it; slow natural motion; must survive repeated viewing; balance aesthetic control vs system variability. | Medium-high (academic knowledge base entry on a published research project). Seen via search summary; full GA2021 PDF unreadable. |
| S6 | Star Atlas demo | amCharts | n.d. | https://www.amcharts.com/demos/star-atlas/ | Describes classic atlas look: faded ink on grainy parchment, ecliptic and celestial equator lines, zodiac highlighted in red. | Medium (vendor demo, but a clear description of the convention). |
| S7 | Historical constellation maps | SuperStock | n.d. | https://acp.superstock.com/story/historical-constellation-maps | Vintage maps overlay mythological figures on the star field; Bayer's *Uranometria* (1603) is the classic source. | Medium (stock-image library editorial). |
| S8 | Antique celestial charts of the northern and southern hemispheres, 1884 | Chairish (listing) | n.d. | https://www.chairish.com/product/28724771/antique-celestial-charts-of-the-northern-and-southern-hemispheres-1884 | Pale blue shading and engraved figures; decorative restraint. | Low-medium (product listing; useful only as a visual description). |
| S9 | Ambient animations in web design: principles and implementation guide (Andy Clarke, via aggregator) | feedbagel.com | n.d. | https://feedbagel.com/post/ambient-animations-in-web-design-principles-and-implementation-guide | Ambient animations are subtle, slow details that add atmosphere without stealing focus; keep interaction feedback immediate. | Medium (known designer; read via an aggregator). |
| S10 | Calm & Relaxation animation principles | playbooks.com (community skill file) | n.d. | https://playbooks.com/skills/dylantarre/animation-principles/calm-relaxation | Slow timing (400–800 ms+), 4–6 s "breathing" cycles, minimal exaggeration. | Low (community-written; use as a rule of thumb only). |
| S11 | Night-sky p5.js sketches (NYU IMA documentation; Goldsmiths Computational Arts) | NYU Shanghai; Goldsmiths | various | https://wp.nyu.edu/shanghai-ima-documentation/?p=25439 ; https://compartsblog.doc.gold.ac.uk/index.php/work/long-nights/ | Common creative-coding pattern: deep blue/indigo base, warm or metallic accents, noise-driven twinkle. | Low-medium (student work; shows common practice, not authority). |

### Synthesis: three candidate directions
Built from the sources above and the prototype review. Each direction is a coherent set of choices across palette, motion, galaxy, and constellations.

**A. Nocturne (calm and meditative).** Based on ambient-art principles (S5, S9, S10): never demands attention, rewards it; slow, breathing motion; restrained palette (S11 pattern). Galaxy dim and soft, far away. Constellations slower, fewer, longer fades. Shooting stars rare. Cheapest of the three.

**B. Deep Field (rich and cinematic).** Based on telescope-image colour practice (S1–S4): saturated false-colour, warm golden core, blue arms, pink star-forming knots, dark dust lanes, bloom. Galaxy is the star of the piece. Most expensive; needs WebGL for density and bloom.

**C. Atlas (minimal, star-chart).** Based on the historical celestial-atlas look (S6–S8): fine engraved lines, ink-like palette (cream / pale gold on deep navy, or the inverse), elegant serif labels, possibly coordinate grid lines. Galaxy faint and secondary, almost a watermark. Constellations become the focus. Moderate cost.

A blend is possible (e.g. Deep Field galaxy + Atlas constellations) but each direction above is a starting point, not a final spec.

---

## Milestone 3: Direction chosen (2026-10-31)
User chose **Deep Field + Atlas**: a rich, telescope-coloured galaxy in the background; fine-line, star-chart-style constellations in front. See decisions.md.

---

## Milestone 4: Galaxy structure (2026-10-31)

### Sources
| # | Title | Author / publisher | Date | URL | Summary | Reliability |
|---|---|---|---|---|---|---|
| S12 | The spiral arms of galaxies | arXiv review | 2022 | https://arxiv.org/pdf/2210.13632 | History of density-wave theory: Lindblad; Lin & Shu (1964) slightly elliptical precessing orbits, arms are density patterns not material; Kalnajs (1973) diagram of nested ellipses whose orientation shifts with radius produces a spiral; stars pass through two arms per orbit; fixed-material arms would wind up ("winding problem"). | High (review article). Seen via search summary; dates of Lindblad's work differ between sources. |
| S13 | Dawes Review 4: Spiral Structures in Disc Galaxies | Dobbs & Baba, *PASA* | 2014 | https://arxiv.org/abs/1407.5062 | Modern view: in most unbarred galaxies arms are transient and recurrent (swing amplification), not long-lived density waves; barred galaxies are the possible exception. | High (peer-reviewed review). Abstract read. |
| S14 | A test of arm-induced star formation in spiral galaxies from near-IR and Hα imaging | arXiv astro-ph/0208401 | 2002 | https://arxiv.org/pdf/astro-ph/0208401 | In density-wave models a shock forms on the trailing (inner, concave) edge of arms inside corotation; dust lanes mark it; star formation lags, so H-II regions sit just downstream of the dust; arms gather H-II regions into lines. Some authors favour stochastic star formation instead. | High (peer-reviewed). Seen via search summary. |
| S15 | Global morphology and physical relations between stars, gas and dust in M100 | Instituto de Astrofísica de Canarias (Knapen et al.) | n.d. | https://iac.edu.es/es/ciencia-y-tecnologia/publicaciones/global-morphology-and-physical-relations-between-stars-gas-and-dust-disc-and-arms-m100 | In M100, Hα and young-star emission is offset from the dust lanes, consistent with a density-wave shock. | High (research institute publication record). Seen via search summary. |
| S16 | Spiral galaxy | Wikipedia | checked 2026-10-31 | https://en.wikipedia.org/wiki/Spiral_galaxy | Bulge of mainly older (yellower/redder) stars; arms bright with young blue stars from high star-formation rate. | Medium (tertiary, but consistent with S17). |
| S17 | Colours of the Lost Galaxy (NGC 4535) | NASA / ESA Hubble | n.d. | https://science.nasa.gov/image-detail/colours-of-the-lost-galaxy-2 | Yellower bulge tones = cooler, older stars; blue in arms = more young, hot stars. | High (official mission caption). |
| S18 | Procedural galaxies (Gaia Sky docs, since 3.7.1) | Gaia Sky / ARI Heidelberg | 2025 | https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/Procedural-galaxies.html | Production galaxy generator built from "channels": stars, gas, dust, H-II, bulge. Density-wave spiral mode (2 or 4 arms, base angle, arm width, eccentricity) and log-spiral mode. Stars/H-II additive at high resolution; gas additive at ~¼ resolution; **dust subtractive** at low resolution so it darkens what is behind; billboard sprites; FBM noise for clumpiness. | High (official docs of an ESA-affiliated astronomy visualisation tool). Read directly. |
| S19 | Stellar Galaxy (course showcase) | U. Toronto CSC317 | 2025 | https://www.dgp.toronto.edu/~joonho/courses/csc317-2025-09/showcase/51 | ~20k particles on trig spiral equations with radial/angular offsets, denser core; credits Bruno Simon's Three.js Journey. | Low-medium (student project). |
| S20 | Particle Galaxy shader design | OpenDesign | n.d. | https://open-design.ai/showcase/particle-galaxy-shader-design/ | 50k-point WebGL2 demo with soft point sprites + additive blending runs as a visual (not physical) galaxy. | Low-medium (demo; useful as feasibility evidence only). |
| S21 | Volumetric Cosmic Dust (Godot shader) | godotshaders.com | n.d. | https://godotshaders.com/shader/volumetric-cosmic-dust/ | Fragment-shader galaxy: log-spiral UV warp + multi-octave noise (FBM) for arms and dust; MIT-licensed. | Medium (open-source example). |

### Findings
1. **Arms as patterns made of tilted ellipses** (S12, S18). Each star moves on a slightly elliptical orbit; each orbit's long axis is rotated a little more than the one inside it. The stacked ellipses crowd together into arms. Because the arms are a crowding pattern, not fixed stars, they never wind up.
2. **The prototype has the winding problem.** `drawGalaxy` places stars on a fixed spiral and spins inner stars faster (`omega = 0.22/(r+0.12)`, × 0.12). Worked out: at r = 0.1 the angle advances ~0.12 rad/s, at r = 1 ~0.024 rad/s, a difference of ~0.096 rad/s. So the inner galaxy gains one full turn on the outer edge about every **65 s**. After a few minutes the arms are wound tight and smear toward a featureless disc. *Derived from the prototype code, not from a source; should be checked by watching it for several minutes.*
3. **Physics caveat** (S13): modern research says most real arms are transient, not permanent density waves. For an art piece that loops forever, the stable tilted-ellipse pattern is the better *visual* choice; the report should say it is a stylised model.
4. **Where things sit in an arm** (S14, S15): dust lane on the inner (concave) edge, then the bright band of young blue stars, with pink H-II knots strung along it just downstream of the dust. Some research disputes how strong this ordering is, but it is the classic look in telescope images.
5. **Colour by population** (S16, S17): warm yellow-white old-star bulge; blue-white arms; pink H-II knots; the space between arms has a fainter, warmer old-disc glow.
6. **Build it in layers** (S18): separate passes for (a) bulge glow, (b) disc stars, (c) arm stars, (d) H-II knots (all additive), and (e) dust (darkening). Gas and dust can render at reduced resolution because they are soft, which saves a lot of work.
7. **Clumpiness from noise** (S18, S21): FBM noise on size and brightness breaks up the too-regular look.
8. **Scale is feasible in WebGL** (S19, S20): 20k–50k soft additive sprites are common in browser demos. To be checked against real frame budgets in milestone 8.

### Implications for the Deep Field + Atlas direction
- The galaxy should be rich but sit **behind** the constellations: dimmer overall and lower in contrast than a telescope photo, so the fine Atlas lines stay readable.
- Rotation should stay very slow (Nocturne pacing) and use the tilted-ellipse model so the look holds over hours.

---

## Milestone 5: Rendering beauty (2026-10-31)

### Sources
| # | Title | Author / publisher | Date | URL | Summary | Reliability |
|---|---|---|---|---|---|---|
| S22 | Bloom | LearnOpenGL (Joey de Vries) | n.d. | https://learnopengl.com/Advanced-Lighting/Bloom | Bloom pipeline: extract bright regions, blur with a separable two-pass Gaussian (ping-pong buffers, ~2N samples instead of N²), add back, then tone-map and gamma-correct. HDR is not required but makes bloom far better. Most of the quality comes from the blur. | High (widely used reference). Seen via search summary. |
| S23 | PV227 Lesson 06 (HDR / tone mapping slides) | Masaryk University | 2018 | https://is.muni.cz/el/fi/podzim2018/PV227/um/lectures/Lesson_06.pdf | Exposure tone map `1 - exp2(-hdr * exposure)`. | Medium-high (university course). Seen via search summary. |
| S24 | Next Generation Post Processing in Call of Duty: Advanced Warfare | Jorge Jimenez, SIGGRAPH 2014 Advances in Real-Time Rendering | 2014 | https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/ | Wide, stable bloom from a chain of downsamples (mip levels) then upsamples with a 3×3 tent filter; a "Karis average" on the first downsample stops bright single pixels from flickering ("fireflies"). | High (industry-standard talk). Details seen via secondary implementations (Blender, fgdata, Monogame BloomFilter); slides not read directly. |
| S25 | ACES filmic tone mapping curve | Krzysztof Narkowicz (via Lygia GLSL library and Rust ports) | 2015 | https://git.gay/kaneraZh/lygia/src/branch/main/color/tonemap/aces.glsl | Cheap one-line filmic curve: `clamp((x*(2.51x+0.03))/(x*(2.43x+0.59)+0.14), 0, 1)`. Rolls bright values off gently instead of clipping; slightly more contrast than full ACES. | Medium-high (constants consistent across several independent implementations; original blog not read). |
| S26 | EXT_color_buffer_float | MDN | checked 2026-10-31 | https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float | In WebGL 2 this extension makes RGBA16F (half-float) render targets usable, which HDR needs. | High (official docs). |
| S27 | EXT_color_buffer_float survey | web3dsurvey.com | checked 2026-10-31 | https://web3dsurvey.com/webgl2/extensions/EXT_color_buffer_float | Reported support ~99.8% Android, 100% iOS. | Medium (crowd-sourced telemetry). |
| S28 | WebKit bug 216010; three.js PR #33114 | WebKit; three.js | 2020; n.d. | https://bugs.webkit.org/show_bug.cgi?id=216010 ; https://gh.r-mj.com/mrdoob/three.js/pull/33114 | iOS supports 16-bit but not 32-bit float targets; on some Android devices half-float targets fail silently, so check the extension and framebuffer completeness. | Medium-high (browser bug tracker / library discussion). |
| S29 | Domain warping | Inigo Quilez | n.d. | https://iquilezles.org/articles/warp | Distort the input of an FBM noise with another FBM (`fbm(p + 4*fbm(p))`) to get swirling, cloud-like shapes. | High (the standard reference). Seen via search summary. |
| S30 | darkly WGSL fbm library | docs.rs | n.d. | https://docs.rs/crate/darkly/latest/source/shaders/lib/fbm.wgsl | Domain-warped clouds cost about 4× plain FBM per pixel. | Medium (code library comment). |
| S31 | godot-starlight | tiffany352 (GitHub, MIT) | n.d. | https://www.github.com/tiffany352/godot-starlight | Realistic stars use a point-spread-function (PSF) image rather than a simple glow; brightness changes how much of the PSF is visible, not just its size; crop sprites to their visible size to limit overdraw. | Medium (open-source project with clear write-up). |
| S32 | SpaceEngine forum: diffraction spikes | SpaceEngine community | n.d. | https://forum.spaceengine.org/viewtopic.php%3Fp=8222.html | Spike count follows telescope support struts (e.g. 4 spikes for a reflector with 4 vanes). | Low-medium (forum). |

### Findings
1. **Glow needs headroom (HDR).** With normal 8-bit colour, overlapping additive stars hit pure white and lose their colour; that is part of why the prototype's core looks flat. Render the galaxy into a half-float (RGBA16F) buffer so brightness can go above 1, then compress it at the end (S22, S26). Supported on almost all phones, but check for it and fall back to 8-bit if missing (S27, S28).
2. **Tone mapping is the "photographic" step.** A filmic curve (Narkowicz ACES fit) rolls highlights off gently so the bright core glows instead of clipping, and keeps the colour of bright stars (S25). One line of shader code.
3. **Bloom: use the downsample/upsample chain.** It gives a wide, soft halo cheaply and doesn't flicker as stars move (S24). Simpler two-pass Gaussian is fine for a first version (S22).
4. **Stars as light, not dots.** Use one pre-made glow sprite (a bright core with a soft wide falloff; optionally faint 4-point spikes for the brightest few) and draw every star with it, scaled by brightness (S31, S32). Replaces the per-frame `createRadialGradient` calls in `drawConstellation`.
5. **Dust darkens.** Draw dust as a separate soft layer that multiplies/subtracts light, placed along the inner edge of each arm (S18 from milestone 4; S14).
6. **Nebula / gas from warped noise.** Domain-warped FBM gives organic pink H-II glow and soft gas (S29). It is about 4× the cost of plain noise per pixel (S30). *Design inference (no source):* because the galaxy turns very slowly, the noise layers can be rendered once into a low-resolution texture and rotated with the galaxy, instead of being recomputed every frame.
7. **Colour grading for Deep Field + Atlas.** Telescope images use deliberate colour mappings (S1–S4): warm core, blue arms, pink knots. For this piece, apply grading after tone mapping: slightly lower the galaxy's overall brightness and saturation so the cream/gold Atlas constellation lines read clearly on top. *Design inference.*
8. **Layer order (proposed).** (1) background gradient → (2) galaxy into HDR buffer: gas/nebula texture, disc + arm stars, H-II knots (all additive), dust (darkening) → (3) bloom → (4) tone map + grade → (5) far starfield → (6) constellations drawn on top, crisp, with their own subtle glow → (7) shooting stars. Constellations go after tone mapping so their fine lines aren't blurred by bloom. *Design inference built on S22, S24, S18.*

---

## Milestone 6: WebGL path (2026-10-31)

### Sources
| # | Title | Author / publisher | Date | URL | Summary | Reliability |
|---|---|---|---|---|---|---|
| S33 | WebGL best practices | MDN | checked 2026-10-31 | https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices | Batch into few large draw calls (e.g. 1000 sprites in one call); draw from static, unchanging VAOs; move work from the fragment to the vertex shader; avoid blocking read-backs. | High (official docs). Seen via search summary. |
| S34 | WebKit bug 230749: poor WebGL point performance in Safari 15 | WebKit Bugzilla | 2021 | https://bugs.webkit.org/show_bug.cgi?id=230749 | Points can be emulated with an instanced unit quad: no size limit and consistent off-screen clipping across devices (gl.POINTS has a device-dependent max size and pops at screen edges). Regression turned out not to be points-specific. | Medium-high (browser bug tracker with engineer comments). |
| S35 | WebGL and Alpha | WebGL2 Fundamentals (Gregg Tavares) | n.d. | https://webgl2fundamentals.org/webgl/lessons/webgl-and-alpha.html | WebGL canvases are composited with the page using premultiplied alpha; if the WebGL layer is opaque, `alpha: false` lets the browser composite it more cheaply. | High (well-known reference by a WebGL spec contributor). |
| S36 | Firefox bug 1446550; WebKit bug 278926 | Mozilla; WebKit | 2018; 2024 | https://bugzilla.mozilla.org/show_bug.cgi?id=1446550 ; https://bugs.webkit.org/show_bug.cgi?id=278926 | Transparent (alpha) WebGL canvases with additive colours composite inconsistently across browsers (Safari/macOS especially). Opaque WebGL avoids this. | Medium-high (open bug reports). |
| S37 | Thick line rendering (pythreejs docs; xeokit; "Rendering thick lines in WebGL") | pythreejs; xeokit; Level Up Coding | n.d. | https://pythreejs.readthedocs.io/en/stable/examples/ThickLines.html ; https://xeokit.github.io/sdk/docs/api/interfaces/model.scene.ThickLinesTechniqueParams.html ; https://levelup.gitconnected.com/rendering-thick-lines-in-webgl-a-practical-approach-from-a-real-engine-0611f6eb88db | WebGL does not guarantee line widths above 1 px; good lines need each segment expanded into a quad with edge antialiasing in the shader, and joins handled separately. | Medium (docs and engineering blog; consistent with each other). |
| S38 | UnrealBloomPass / BloomPass docs | three.js | checked 2026-10-31 | https://threejs.org/docs/pages/UnrealBloomPass.html | three.js ships a ready mip-chain bloom (strength, radius, threshold) used through EffectComposer; heavier than its simpler BloomPass. | High (official docs). |
| S39 | webgl-libs-comparison; OGL README | jsulpis (GitHub); OGL | n.d. | https://awesome.ecosyste.ms/projects/github.com%2Fjsulpis%2Fwebgl-libs-comparison ; https://github.com/luruke/ogl | Small WebGL helpers: twgl.js ~7 kB gzipped, OGL ~20 kB total gzipped (README, alpha-stage); regl ~42 kB. Not like-for-like. | Medium (benchmark repo; README figures may be outdated). |

### Findings
1. **Draw the whole galaxy in one call** (S33). Upload all star data once (radius, orbit tilt, phase, size, colour) into a static buffer; the vertex shader computes each star's position from time. The CPU does nothing per star per frame. This is what makes 50k–100k stars cheap.
2. **Instanced quads over gl.POINTS** (S34). Points have a device-dependent maximum size and vanish abruptly at screen edges; a small quad drawn per instance has neither problem. For tiny galaxy stars points would work, but quads keep the glow sprite consistent everywhere.
3. **The tilted-ellipse model fits the vertex shader well.** Each star needs only a few numbers; position = ellipse(r, eccentricity, tilt(r), angle(t)). *Design inference combining S12/S18 with S33.*
4. **Fine lines and text are where WebGL is weak** (S37). WebGL lines are often clamped to 1 px and need custom quad expansion plus antialiasing; text needs a texture atlas. Canvas 2D does both natively and beautifully, which matters for the Atlas look.
5. **Two stacked canvases work best when the WebGL one is opaque** (S35, S36). Put the WebGL galaxy at the back with `alpha: false`, and a transparent Canvas 2D layer on top for constellations, labels and shooting stars. Transparent WebGL over other content has open cross-browser bugs; this arrangement avoids them.
6. **Constellations are cheap in Canvas 2D** once glow sprites are pre-rendered: ~9 constellations × ~11 stars ≈ 100 sprites + ~120 line segments per frame. *Derived from prototype numbers; to be confirmed in milestone 8.*
7. **Library or not** (S38, S39). three.js gives bloom, render targets and tone mapping out of the box but is a large dependency; tiny helpers (twgl.js, OGL) only remove boilerplate; raw WebGL2 keeps the current no-dependency single file but means writing the bloom chain by hand (a few hundred lines).

### Decision point (milestone 6): presented to user 2026-10-31
(a) Full WebGL vs hybrid (WebGL galaxy + Canvas 2D constellations). (b) Raw WebGL2 vs three.js vs a small helper library.

### Decisions at milestone 6
User chose **hybrid** (WebGL galaxy behind, Canvas 2D constellations on top) and **raw WebGL2** (no library). See decisions.md.

---

## Milestone 7: Constellation polish (2026-10-31)

### Sources
| # | Title | Author / publisher | Date | URL | Summary | Reliability |
|---|---|---|---|---|---|---|
| S40 | Book review: Sky Atlas 2000.0 (Tirion & Sinnott) | amazings.com review | n.d. | https://xn--astronomawww-zfb.amazings.com/sbb/reviews/review0334.html | Modern atlases grade star brightness with a fixed set of dot sizes (ten sizes in Sky Atlas 2000.0); doubles shown with short side lines. | Medium (review). Another listing describes one-magnitude steps, so the exact count is uncertain. |
| S41 | Bayer's Uranometria (essay and print listings) | Barry Lawrence Ruderman Antique Maps (raremaps.com) | n.d. | https://raremaps.com/essay/47/bayers-uranometria ; https://raremaps.com/gallery/print/27276 | 1603 atlas, 51 copper-engraved plates (Alexander Mair); labels engraved on the charts; engraved coordinate grid; Greek letters for brighter stars in rough order of brightness. | Medium-high (specialist antique-map dealer essays). |
| S42 | Uranometria | Wikipedia | checked 2026-10-31 | https://en.wikipedia.org/wiki/Uranometria | First edition's star tables printed on the back showed through and spoiled the charts; later moved to a separate catalogue. A lesson in keeping the chart uncluttered. | Medium (tertiary; consistent with S41). |
| S43 | Easing equations | Robert Penner (via Qt source, Chart.js, js-easing-functions) | 2001 | https://code.qt.io/cgit/qt/qtbase.git/tree/src/3rdparty/easing/easing.cpp | Standard easing curves (BSD-licensed): easeInOutCubic speeds up then slows down; easeOutQuart starts fast and settles. | High (canonical, widely implemented). |
| S44 | Curves.easeOutQuart | Flutter API docs | checked 2026-10-31 | https://api.flutter.dev/flutter/animation/Curves/easeOutQuart-constant.html | Steeper curves need longer durations or they look unnatural. | High (official docs). |
| S45 | Cormorant Garamond; EB Garamond | madegooddesigns.com; fontspace.com; fontpair | n.d. | https://madegooddesigns.com/?p=679 ; https://www.fontspace.com/eb-garamond-font-f32676 | Both free on Google Fonts (SIL OFL). EB Garamond: a revival of Claude Garamond's 16th-century type with real small caps, readable at small sizes. Cormorant: high contrast, best at display sizes; Cormorant SC is a dedicated small-caps cut. | Medium (design blogs; font facts are verifiable on Google Fonts). |
| S46 | CanvasRenderingContext2D.letterSpacing | MDN; caniuse | checked 2026-10-31 | https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/letterSpacing ; https://caniuse.com/mdn-api_canvasrenderingcontext2d_letterspacing | Native canvas letter spacing is Baseline 2025 (Chrome 99, Firefox 115, Safari 18.4); older Safari lacks it, so keep a fallback. | High (official docs). |
| S47 | CSS Font Loading API; FontFace.load() | MDN | checked 2026-10-31 | https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API | Canvas text only uses a web font after it has loaded; wait on `document.fonts.load(...)` before drawing labels. | High (official docs). |

### Findings
1. **Graded star symbols, not twinkling blobs.** Atlases show brightness with a small fixed set of dot sizes (S40). For the Atlas look: 3–4 size classes of crisp cream dots, each with a small, tight glow sprite (pre-rendered once). The brightest star of each constellation could get faint 4-point spikes to tie it to the Deep Field galaxy (S31, S32). Replaces the prototype's continuous random `mag` and per-frame gradients.
2. **Engraved-style lines.** Thin (≈0.75–1 px), cream/pale-gold, low opacity, round caps, with a small gap where a line meets a star so the dot sits "inside" the line, as on printed charts. *Design inference from the atlas convention (S6, S41); gap trick not sourced.* Canvas 2D draws these antialiased natively (S37).
3. **One colour story.** Drop the 7-hue random palette for constellations; use a single cream/gold ink with very slight warm/cool variation, so constellations read as one "chart" layer on top of the colourful galaxy. *Design inference from milestone 2 direction C.*
4. **Typography.** A Garamond-style serif in small caps with wide tracking fits the engraved-atlas feel (S41, S45). EB Garamond is safer at the small label size; Cormorant is more dramatic but thin at small sizes. Load via Google Fonts and wait for it before drawing (S47); use `ctx.letterSpacing` where available, else fall back to the prototype's manual spacing (S46).
5. **Keep it uncluttered.** Bayer's tables showing through the plates is a historical example of clutter spoiling a chart (S42). Optional Atlas extras (faint coordinate arcs, Greek-letter star tags) should be very faint or left out so the galaxy stays visible.
6. **Graceful draw-in.** Ease each edge with easeInOutCubic and overlap edges slightly instead of strict one-after-another linear growth (S43). Stars appear just before the line reaches them. Keep durations long (2–4 s per figure) because steep curves need time (S44). Fade-out near the bottom should also be eased, not linear.
7. **Cheaper per frame.** Pre-render the 3–4 star sprites once to offscreen canvases and draw them with `drawImage`; reuse arrays instead of `c.pts.map(...)` each frame (prototype review, M1).

---

## Milestone 8: Smoothness (2026-10-31)

### Sources
| # | Title | Author / publisher | Date | URL | Summary | Reliability |
|---|---|---|---|---|---|---|
| S48 | WebKit bug 173434: support for 120 Hz requestAnimationFrame | WebKit mailing list | 2021–2022 | https://lists.webkit.org/pipermail/webkit-unassigned/2022-August/1051007.html | Animations that assume 60 Hz and ignore the time delta run at double speed on 120 Hz screens. | Medium-high (browser engineers). |
| S49 | requestAnimationFrame explained | DEV Community | n.d. | https://dev.to/tawe/requestanimationframe-explained-why-your-ui-feels-laggy-and-how-to-fix-it-3ep2 | At 120 Hz the frame budget is ~8 ms; going over drops frames and causes visible stutter; rAF adapts to the display, timers don't. | Medium (developer blog). |
| S50 | Pixel-art camera jitter on 120 Hz | Kirupa forum | n.d. | https://forum.kirupa.com/t/why-does-my-pixel-art-camera-drift-and-jitter-on-120hz-monitors/681222 | Rounding positions to whole pixels each frame causes hold-then-jump micro-stutter for slow movement. | Low-medium (forum; reasoning is sound). |
| S51 | Houdini discussion on animation frame rate | W3C public-houdini archive | 2018 | https://lists.w3.org/Archives/Public/public-houdini-archive/2018Aug/0078.html | If an animation doesn't need 120 Hz, running at 60 Hz saves power. | Medium (standards discussion). |
| S52 | Runtime devicePixelRatio | PlayCanvas user manual | checked 2026-10-31 | https://developer.playcanvas.com/user-manual/optimization/runtime-devicepixelratio/ | Rendering at full DPR on low/mid phones is limited by fill rate; lower the render resolution at runtime. | High (engine docs). |
| S53 | WebGL mobile performance | abratabia.com | n.d. | https://abratabia.com/mobile-browser-performance/webgl-mobile-performance.php | Frame-time control loop: lower scale when frames stay over budget, raise when there's headroom; steady frame-time climb with no scene change suggests thermal throttling; start at ~0.5–0.7× DPR on phones. | Low-medium (unattributed blog; heuristics only). |
| S54 | Low fps on iOS with pixel ratio = devicePixelRatio | three.js forum | n.d. | https://discourse.threejs.org/t/low-fps-on-ios-mobile-with-pixel-ration-set-as-window-devicepixelratio/4963 | Capping pixel ratio on mobile helps; measure only after shader compile / texture upload spikes settle. | Medium (community, consistent with S52). |
| S55 | Mobile GPU power consumption reduction via dynamic resolution and frame rate scaling | UCL (HotPower 2014) | 2014 | https://solar.cs.ucl.ac.uk/appoptimization.github.io/publications/NCZ2014 | Resolution scaling and refresh-rate scaling cut mobile GPU power by up to 33% and 38%. | High (peer-reviewed workshop paper; older hardware). |
| S56 | JavaScript GC pauses, allocation rate and frontend jank | DEV Community | n.d. | https://dev.to/helloashish99/javascript-gc-pauses-allocation-rate-frontend-jank-3jig | GC pauses of ~1–5 ms are a big share of a 16.7 ms (or 8 ms) frame; high allocation rates make them frequent. Reuse objects instead. | Medium (developer article; numbers are typical, not measured here). |
| S57 | Make your JavaScript apps smoother | Creative Bloq | n.d. | https://www.creativebloq.com/javascript/make-your-javascript-apps-smoother-12125879 | Pool particles and short-lived sprites; mutate in place. | Medium. |
| S58 | WEBGL_lose_context | MDN | checked 2026-10-31 | https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context | Lets you simulate WebGL context loss/restore to test recovery. | High (official docs). |
| S59 | Khronos public_webgl thread on context restore polling | Khronos mailing list | 2010 | https://www.khronos.org/webgl/public-mailing-list/public_webgl/1004/msg00074.php | Don't poll with timers while the screen is off; it keeps the CPU awake. | Medium (old but from spec authors). |
| S60 | Textastic: WebGL2 context lost after backgrounding (iOS) | Textastic feedback | n.d. | https://feedback.textasticapp.com/communities/1/topics/4001-webgl2-graphics-context-is-sometimes-lost-in-the-built-in-html-viewer-after-backgrounding-the-app | iOS may lose the WebGL context after the app is backgrounded; canvas goes blank unless restored. | Low-medium (single user report). |

### Findings
1. **Time-based motion, clamped.** Move everything by elapsed time from the rAF timestamp, not per frame, so it runs the same at 60 or 120 Hz (S48, S49). Keep the prototype's clamp on large steps (it already caps `dt` at 0.05 s). Better: compute the galaxy angle directly from total time (it already does), so it never drifts.
2. **No pixel snapping.** Keep positions fractional; slow drift looks jerky if rounded (S50). The prototype already uses fractional positions; keep it that way when porting.
3. **Render the galaxy below full resolution.** It is soft, glowy, and slow, so it can render at roughly 0.5–0.75× DPR on phones and be scaled up without visible loss, while the Canvas 2D constellation layer stays sharp at full DPR (S52, S53, S54). This is the biggest single win on phones. *The hybrid split from milestone 6 makes this easy.*
4. **Adaptive quality loop.** Measure average frame time over ~1–2 s (after startup spikes settle); if it stays over budget, step down galaxy resolution, then star count, then bloom levels; step back up slowly when there's headroom (S53, S54). Rising frame time with nothing changing = thermal throttling; respond the same way (S53).
5. **Consider 60 Hz on phones.** This piece is slow; halving work on 120 Hz phones saves power (S51, S55). *Option: render the galaxy every other frame on high-refresh screens while constellations update every frame; design inference, needs testing.*
6. **Zero garbage per frame** (S56, S57). Replace `c.pts.map(...)`, per-frame gradients, and `cons.filter(...)` with reused arrays and in-place updates; pool constellations and shooting stars.
7. **Pause when hidden; survive context loss.** Stop the loop on `visibilitychange` (rAF already throttles hidden tabs, but explicitly pausing avoids the time jump and keeps state clean). Handle `webglcontextlost` / `webglcontextrestored` by rebuilding buffers and textures; test with WEBGL_lose_context (S58, S59, S60).
8. **Resize without resetting.** The prototype's `resize()` calls `populate()`, wiping all constellations; instead, only resize buffers and keep the sky (M1 review).
9. **Uncertainty:** none of these cost figures were measured on the user's devices. The report should recommend a quick frame-time readout during development to confirm.
