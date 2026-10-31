# Decisions: Falling Constellations Build

| Date | Decision | User's answer |
|---|---|---|
| 2026-10-31 | Project root | `/Users/arins/Documents/Projects/FallingConstellations`; copy `index.html` and `HANDOFF.md` in from Downloads |
| 2026-10-31 | Goals and approach | Follow the research plan and build stage by stage; follow the research decisions (Deep Field + Atlas, hybrid rendering, raw WebGL2); add a testing setup |
| 2026-10-31 | Agent definition and plan | Approved as written |
| 2026-10-31 | D1 code layout. Options: split into `src/` modules (testable, needs a local server) or single file (visual checks only). Recommended: split. | **Split into `src/` modules** |
| 2026-10-31 | D2 label font. Options: EB Garamond from Google Fonts with serif fallback, or local serif only. Recommended: Google Fonts + fallback. | **EB Garamond from Google Fonts, local serif fallback** |
| 2026-10-31 | D3 repository and branch | **`https://github.com/arinb44/Falling-Constellations`, branch `main`** (still asked before each commit and push) |
