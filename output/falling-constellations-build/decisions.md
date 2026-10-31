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
| 2026-10-31 | Milestone 2 commit | Committed as `9d10cf0` and pushed |
| 2026-10-31 | Nebula timing. Options: bake now on the CPU and reuse the image as the WebGL texture later, or keep nebulae in M5. Recommended: bake now. | **Bake now, reuse later** |
| 2026-10-31 | Nebula look. Options: field nebulae, galaxy gas only (report), both. Recommended: field nebulae. | **Field nebulae** (faint coloured clouds behind everything); galaxy gas stays in M5 as planned |
| 2026-10-31 | Extra background structures (new scope beyond the report) | **Dark dust clouds, distant galaxies, star clusters** |
| 2026-10-31 | Milestone 2b commit | Committed as `57de6fa` and pushed |
| 2026-10-31 | Layer split for M3. Options: far field + background stars to WebGL; far field only (dust can't dim stars); dust stays 2D (would dim the galaxy). Recommended: far field + stars to WebGL. | **Far field and background stars move to WebGL** (bg → nebulae → galaxies/clusters → stars → dust → galaxy); 2D canvas keeps constellations, shooting stars and hint |
| 2026-10-31 | Nebula placement (feedback: "only at the top left") | Clouds now placed one per equal sector on a ring around the galaxy (5 clouds, neighbours differ in colour) |
| 2026-10-31 | Galaxy centre brightness (feedback: "tone it down once it reaches the center by 20%") | Stars ease down to 80% brightness inside radius 0.22; core glow cut by the same 20% |
| 2026-10-31 | Galaxy centre, second pass (feedback: "still too bright, make it 50%") | **50%**: stars ease down to half brightness at the centre; core glow halved |
| 2026-10-31 | Nebula pulses (request: "pulse, so it becomes bright in random intervals") | Each cloud baked separately and pulsed on its own timer: swells to 2.2× over 1.2 s, settles over ~3.5 s, every 7–18 s at random; first pulses staggered |
| 2026-10-31 | Milestone 3 commit | Committed as `cfd0cab` and pushed |
| 2026-10-31 | Resume: partial Milestone 4 found uncommitted. Options: keep and finish, or discard and restart. | **Keep and finish it** |
| 2026-10-31 | Galaxy vs constellations (feedback: "the galaxy overpowers the constellations"). Options: dim the galaxy only, brighten the constellations, both a little, dim the galaxy just behind each figure. Recommended: dim the galaxy. | **Dim the galaxy**: new `G.GAIN` = 0.55 scales every galaxy star and the core glow; far field and constellations unchanged |
| 2026-10-31 | Shooting stars (request: "bright blue streak and make the trail last for a little bit before fading out directionally"; new scope beyond the report) | Blue glow + pale-blue core + bright head; head flies 0.8 s, each point of the trail stays 1.0 s after the head passes, so the trail fades from its far end toward the head and outlives the head (`trailSpan` in `src/shooters.js`) |
| 2026-10-31 | Milestone 4 and shooting-star commits | Two commits: `f0b75d1` (Milestone 4) and `a700805` (shooting stars) |
| 2026-10-31 | Milestone 5 look (dust on inner arm edges, pink H-II knots on outer edges, gas 0.12, grading 0.88 sat / 0.96 brightness) | **Looks good, commit** |
