# Progress: Falling Constellations Build

- **Current phase:** Phase 4 (implementation), Milestone 1 built and tested
- **Status:** Waiting for user (approve Milestone 1 commit; judge ink and gap size)

## Completed milestones
- 2026-10-31: Project root confirmed (`/Users/arins/Documents/Projects/FallingConstellations`); prototype `index.html` and `HANDOFF.md` copied in from `~/Downloads`
- 2026-10-31: Phase 1 setup: build every stage of `output/falling-constellations/report.md`, following the research decisions, with a testing setup; slug `falling-constellations-build`
- 2026-10-31: Phase 2 and 3: `programAgent.md` and `plan.md` approved; D1 split into modules, D2 EB Garamond + fallback, D3 `arinb44/Falling-Constellations` on `main`
- 2026-10-31: Milestone 0 complete, committed as 528f5d5 and pushed to origin/main: prototype split into `src/` modules with no behaviour change; `package.json`; `scripts/serve.js` (Bun static server, because python's http.server cannot read the Documents folder from the app's launcher); `.claude/launch.json`; `?debug` frame-time readout; `HANDOFF.md` run/test section; 13 tests pass (`bun test`)
- 2026-10-31: Milestone 1 built (not yet committed): Atlas ink (`makeInk`, cream→gold) replaces `HUES`; 4 graded size classes with pre-rendered sprites (`src/sprites.js`); engraved lines ~0.7–1 px with gaps at stars; constellation names removed at user's request; hint in EB Garamond small caps; stars-first draw-in (stars fade in one by one, lines ease in once the figure is fully on screen, 2–4 s); 24 tests pass; 60 fps / 16.7 ms avg in the browser pane

## Next step
Commit Milestone 1 once approved, then Milestone 2 (Stage 1b; draw-in already done): eased fade-out near the bottom; zero allocation per frame (reuse projected points, pool constellations, cache background and shooter gradients); `isAuto` flag; resize without `populate()`; pause on `visibilitychange`.

## Open questions
- `.claude/launch.json` left uncommitted by user choice (machine-specific paths).

**Last updated:** 2026-10-31
