# Progress: Falling Constellations Build

- **Current phase:** Phase 4 (implementation), Milestone 2 built and tested
- **Status:** Waiting for user (approve Milestone 2 commit)

## Completed milestones
- 2026-10-31: Project root confirmed (`/Users/arins/Documents/Projects/FallingConstellations`); prototype `index.html` and `HANDOFF.md` copied in from `~/Downloads`
- 2026-10-31: Phase 1 setup: build every stage of `output/falling-constellations/report.md`, following the research decisions, with a testing setup; slug `falling-constellations-build`
- 2026-10-31: Phase 2 and 3: `programAgent.md` and `plan.md` approved; D1 split into modules, D2 EB Garamond + fallback, D3 `arinb44/Falling-Constellations` on `main`
- 2026-10-31: Milestone 0 complete, committed as 528f5d5 and pushed to origin/main: prototype split into `src/` modules with no behaviour change; `package.json`; `scripts/serve.js` (Bun static server, because python's http.server cannot read the Documents folder from the app's launcher); `.claude/launch.json`; `?debug` frame-time readout; `HANDOFF.md` run/test section; 13 tests pass (`bun test`)
- 2026-10-31: Milestone 1 complete, committed as 5296567 and pushed: Atlas ink (`makeInk`, cream→gold) replaces `HUES`; 4 graded size classes with pre-rendered sprites (`src/sprites.js`); engraved lines ~0.7–1 px with gaps at stars; constellation names removed at user's request; hint in EB Garamond small caps; stars-first draw-in (stars fade in one by one, lines ease in once the figure is fully on screen, 2–4 s); 24 tests pass; 60 fps / 16.7 ms avg in the browser pane
- 2026-10-31: Milestone 2 built (not yet committed): eased bottom fade (`fadeOutBottom`); per-constellation projected points allocated once; for-loops instead of per-frame closures; `recycle` compacts in place; `isAuto` flag + `countAuto`; background, galaxy core and shooter-trail gradients cached; starfield uses `globalAlpha` not per-star colour strings; shooting stars from a fixed pool of 4; resize keeps and rescales stars and constellations (`fitStars`, no `populate()`); sim clock + pause on `visibilitychange` (fixed a double-loop bug found in the pane); 31 tests pass; 60 fps; JS heap grew ~18 KB/s over 8 s (debug readout and spawns, not per-frame drawing; not profiled further)

## Next step
Commit Milestone 2 once approved, then Milestone 3 (Stage 2, WebGL galaxy): second canvas (`alpha: false`) behind a transparent 2D canvas; `src/galaxy/model.js` star data + tilted-ellipse orbit maths + colour by population (unit-tested, including a no-winding test); `src/galaxy/gl.js` + `shaders.js` with one instanced draw of 50k+ glow-sprite quads; remove `src/galaxy/canvas2d.js`.

## Open questions
- `.claude/launch.json` left uncommitted by user choice (machine-specific paths).

**Last updated:** 2026-10-31
