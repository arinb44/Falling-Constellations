# Progress: Falling Constellations Build

- **Current phase:** Phase 5 (summary)
- **Status:** Milestone 8 committed (2026-10-31)

## Completed milestones
- 2026-10-31: Project root confirmed (`/Users/arins/Documents/Projects/FallingConstellations`); prototype `index.html` and `HANDOFF.md` copied in from `~/Downloads`
- 2026-10-31: Phase 1 setup: build every stage of `output/falling-constellations/report.md`, following the research decisions, with a testing setup; slug `falling-constellations-build`
- 2026-10-31: Phase 2 and 3: `programAgent.md` and `plan.md` approved; D1 split into modules, D2 EB Garamond + fallback, D3 `arinb44/Falling-Constellations` on `main`
- 2026-10-31: Milestone 0 complete, committed as 528f5d5 and pushed to origin/main: prototype split into `src/` modules with no behaviour change; `package.json`; `scripts/serve.js` (Bun static server, because python's http.server cannot read the Documents folder from the app's launcher); `.claude/launch.json`; `?debug` frame-time readout; `HANDOFF.md` run/test section; 13 tests pass (`bun test`)
- 2026-10-31: Milestone 1 complete, committed as 5296567 and pushed: Atlas ink (`makeInk`, cream→gold) replaces `HUES`; 4 graded size classes with pre-rendered sprites (`src/sprites.js`); engraved lines ~0.7–1 px with gaps at stars; constellation names removed at user's request; hint in EB Garamond small caps; stars-first draw-in (stars fade in one by one, lines ease in once the figure is fully on screen, 2–4 s); 24 tests pass; 60 fps / 16.7 ms avg in the browser pane
- 2026-10-31: Milestone 2 complete, committed as 9d10cf0 and pushed: eased bottom fade (`fadeOutBottom`); per-constellation projected points allocated once; for-loops instead of per-frame closures; `recycle` compacts in place; `isAuto` flag + `countAuto`; background, galaxy core and shooter-trail gradients cached; starfield uses `globalAlpha` not per-star colour strings; shooting stars from a fixed pool of 4; resize keeps and rescales stars and constellations (`fitStars`, no `populate()`); sim clock + pause on `visibilitychange` (fixed a double-loop bug found in the pane); 31 tests pass; 60 fps; JS heap grew ~18 KB/s over 8 s (debug readout and spawns, not per-frame drawing; not profiled further)
- 2026-10-31: Milestone 2b complete (added at user's request), committed and pushed: `src/sky/noise.js` (mulberry32, gradient noise, FBM, domain warp); `src/sky/field.js` (field nebulae baked once at 1/3 res and re-baked 250 ms after resize, dark dust lanes over the starfield, 4–7 distant galaxy sprites, 2–4 star-cluster sprites, whole field drifts within a 10% margin); layer order bg → nebulae/galaxies/clusters → starfield → dust → galaxy → constellations; nebula peak raised 70 → 115 after first look; 41 tests pass; bake 32–35 ms at 711×773; 60 fps on first visible load
- 2026-10-31: Milestone 3 complete, committed as cfd0cab and pushed: WebGL2 back layer (`src/galaxy/gl.js`, `shaders.js`, `model.js`) behind a transparent 2D canvas; 60k galaxy stars in one instanced draw, tilted-ellipse orbits in the vertex shader (constants pasted from `model.js`), per-star scatter so crowded arms don't collapse into a line, young blue stars lit near arm crests, warm bulge; far field + background stars moved to WebGL (user decision); `src/galaxy/canvas2d.js` removed; no-WebGL2 fallback draws far field + starfield in 2D with no galaxy; dev flag `?nogl`; tuned E_MAX 0.36, SCATTER 0.02, brightness halved (core clipping until HDR in M4); per user feedback: nebula clouds spread evenly on a ring (5 clouds), galaxy centre dimmed 50% (`centreDim`, core glow ×0.5; first tried 20%); nebula clouds baked separately (`cloudPixels`) and pulse independently (`PULSE`, `pulse`); 54 tests pass incl. no-winding over 600 s; 60 fps at 711×773 and 390×760 @2x

## Next step
Milestone 5 (Stage 3b) is built, uncommitted: `src/galaxy/structure.js` (pure) bakes, once at startup in the frame that turns with the arm pattern, an arm map from the real star data, dust along each arm's inner edge (`innerEdge`), domain-warped gas (warm core, blue-violet outer, pink in arms) and 140 H-II knots along each arm's outer edge (`outerEdge`); `shaders.js` adds `DISC_VS/FS` (baked layer on the rotating plane), `KNOT_VS`, and grading after ACES (`POST.SATURATION` 0.88, `POST.BRIGHTNESS` 0.96, JS `grade`); `gl.js` draws core glow → gas → stars → dust → knots, gas/dust as RGBA16F textures. Tuned after first look: gas 0.05 → 0.12, knots ~2× brighter and larger. 73 tests pass (`test/structure.test.js`, grading test); 60 fps at 711×773 @2x; bake ~37 ms; `?ldr` loads with no errors. User approved the look; committed as "Add dust lanes, H-II knots, galaxy gas and grading". Committed as 81fa75e and pushed 2026-10-31. Next: Milestone 6 (Stage 4 device tuning).

Milestone 6 (Stage 4) built, uncommitted: `src/quality.js` (phone base scale 0.65× DPR for coarse pointer + short side < 768; adaptive controller: 2 s warm-up, 1.5 s windows, > 20 ms steps down resolution → stars → bloom, < 17.5 ms for 10 s steps up, wait doubles after a failed step up, hitches > 0.25 s ignored); `gl.js` `setQuality`, star share with 1/√share boost (`u_boost`), bloom cap, lost-context guard, per-seed CPU data cache; `main.js` phone scale, controller, `?burn=ms`, context lost/restored rebuild, quality in readout; `#gl` dark CSS background; `HANDOFF.md` rewritten for the current architecture. 82 tests pass. Pane checks: `?burn=24` stepped down to rung 2 (gl 1.30×) with no errors; forced `WEBGL_lose_context` → restore rebuilt the layer (HDR, bloom×6, 60 fps); mobile emulation: 2D 750×1624, WebGL 488×1056 (0.65×). Committed as bcc2a7a and pushed 2026-10-31.

Phase 5: `summary.md` written 2026-10-31. User asked for upgrades 18–19 plus dynamic field nebulae (billow, form and dissolve, keep pulses; field nebulae only; live GPU noise). Milestone 7 addendum written at the end of `plan.md`. Next: get approval, then build Milestone 7; update `summary.md` afterwards.

- 2026-10-31: Milestone 7 committed as bcd0993 and pushed: live nebulae, diffraction spikes, Atlas grid.

**Milestone 8 built (uncommitted, 108 tests pass, 2026-10-31):**
- `field.js`: `MOTION`, `addMotion` (own seeded stream), face-on galaxy sprite (`face`), glow-only cluster sprite (`glow`), `galaxyMatrix`, `galaxyShimmer`, `clusterStar`, `clusterStarData`.
- `shaders.js`: `SPIN_VS/FS`, `CLUSTER_VS/FS`; `KNOT_VS` slides and fades knots.
- `src/galaxy/knots.js` (new): `KNOT`, `knotLife`, `armTangent`, `createKnots` (clumps, staggered lives, rebirth with `update`), `knotAt`; `structure.js` gains `pickKnotSpot`.
- `gl.js`: cluster instanced draw, spinning galaxy draw, dynamic knot buffer with `bufferSubData` on rebirth; knot state kept on `field.knots`.
- Tests: `test/knots.test.js` (new), motion tests in `test/field.test.js`.
- Pane (visible): 60 fps at 1024×768 @2x and in phone emulation; no errors on default, `?ldr`, `?nogl`.
- Docs: `HANDOFF.md`, `summary.md` updated.
- Speed pass (user: motion not visible): galaxies 20–60 s/turn ±30% shimmer; clusters 30–60 s/turn, twinkle 0.25–1.25×; knots fade 2.5 s, glow 8–20 s, slide 3–5 px/s along the arm spiral (`armSlide`, dθ/dr = TWIST; replaced the map-gradient tangent, which drifted off the edge). Verified GPU uniforms change per frame and knots visibly change over 3 s in the pane; 60 fps.
- Next: user looks at the motion, then approve the Milestone 8 commit and push.

## Open questions
- On phones the galaxy (radius 0.56 × the longer side) is wider than the screen and is cropped; looks fine in emulation, revisit in Stage 4 if wanted.
- `.claude/launch.json` left uncommitted by user choice (machine-specific paths).

**Last updated:** 2026-10-31
