# Decisions: Falling Constellations Build

| Date | Decision | User's answer |
|---|---|---|
| 2026-10-31 | Project root | `/Users/arins/Documents/Projects/FallingConstellations`; copy `index.html` and `HANDOFF.md` in from Downloads |
| 2026-10-31 | Goals and approach | Follow the research plan and build stage by stage; follow the research decisions (Deep Field + Atlas, hybrid rendering, raw WebGL2); add a testing setup |
| 2026-10-31 | Agent definition and plan | Approved as written |
| 2026-10-31 | D1 code layout. Options: split into `src/` modules (testable, needs a local server) or single file (visual checks only). Recommended: split. | **Split into `src/` modules** |
| 2026-10-31 | D2 label font. Options: EB Garamond from Google Fonts with serif fallback, or local serif only. Recommended: Google Fonts + fallback. | **EB Garamond from Google Fonts, local serif fallback** |
| 2026-10-31 | D3 repository and branch | **`https://github.com/arinb44/Falling-Constellations`, branch `main`** (still asked before each commit and push) |
| 2026-10-31 | Milestone 0 commit | Committed as `528f5d5`; `.claude/` left out |
| 2026-10-31 | Constellation names (report upgrade 3, plan req 5) | **Removed: "we don't need the names".** No labels or name generator; EB Garamond is now used only by the hint text |
| 2026-10-31 | Draw-in behaviour (report upgrade 4, plan req 6, brought forward from M2) | **Stars appear first, one by one; lines draw only once the whole figure is on screen**, eased one after another with overlap over 2–4 s |
| 2026-10-31 | Milestone 1 commit | Committed as `5296567` and pushed |
