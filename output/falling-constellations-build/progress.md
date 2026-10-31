# Progress: Falling Constellations Build

- **Current phase:** Phase 4 (implementation), Milestone 0 built and tested
- **Status:** Waiting for user (approve the Milestone 0 commit)

## Completed milestones
- 2026-10-31: Project root confirmed (`/Users/arins/Documents/Projects/FallingConstellations`); prototype `index.html` and `HANDOFF.md` copied in from `~/Downloads`
- 2026-10-31: Phase 1 setup: build every stage of `output/falling-constellations/report.md`, following the research decisions, with a testing setup; slug `falling-constellations-build`
- 2026-10-31: Phase 2 and 3: `programAgent.md` and `plan.md` approved; D1 split into modules, D2 EB Garamond + fallback, D3 `arinb44/Falling-Constellations` on `main`
- 2026-10-31: Milestone 0 built (not yet committed): prototype split into `src/` modules with no behaviour change; `package.json`; `scripts/serve.js` (Bun static server, because python's http.server cannot read the Documents folder from the app's launcher); `.claude/launch.json`; `?debug` frame-time readout; `HANDOFF.md` run/test section; 13 tests pass (`bun test`)

## Next step
Commit Milestone 0 once approved, then Milestone 1 (Stage 1a, Atlas look: one cream/gold ink replacing `HUES`, 3–4 graded star size classes, pre-rendered glow sprites in `src/sprites.js`, engraved lines with gaps at stars, EB Garamond small-caps labels with `document.fonts.load` and fallback).

## Open questions
- Should `.claude/launch.json` be committed? It holds absolute paths for this machine.

**Last updated:** 2026-10-31
