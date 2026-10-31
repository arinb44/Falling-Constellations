# Plan: Falling Constellations Build

## Project Title
Falling Constellations: build the Deep Field + Atlas upgrades, stage by stage

## Objective
Turn the Canvas 2D prototype (`index.html`) into the piece the research report describes: Atlas-style constellations on a transparent Canvas 2D layer, falling over a dense WebGL2 spiral galaxy with HDR, bloom, dust and nebula, tuned to stay smooth on phones. Work follows the report's 4 stages in order. Each milestone ends working, tested, and ready to commit.

## Requirements
Numbers in brackets are the report's upgrade numbers.

1. **Test setup:** `bun test` runs unit tests with no npm packages; pure logic lives in importable modules.
2. **Dev readout:** a frame-time readout, shown only with `?debug` in the URL (report next step 1).
3. **[1] Atlas restyle:** one cream/gold ink with slight variation replaces `HUES`; 3–4 graded star size classes; lines about 0.75–1 px, pale gold, low opacity, round caps, with a small gap where a line meets a star.
4. **[2] Star sprites:** 3–4 glow sprites pre-rendered once to offscreen canvases; stars drawn with `drawImage`; no `createRadialGradient` per frame.
5. **[3] Typography:** EB Garamond small caps with wide tracking; drawing waits for `document.fonts.load`; `ctx.letterSpacing` with manual spacing fallback; a serif fallback if the font cannot load.
6. **[4] Draw-in and fades:** easeInOutCubic per edge with slight overlap; each star appears just before its line arrives; figures take 2–4 s; eased fade-out near the bottom.
7. **[5] Zero allocation per frame:** projected points, gradients and constellations reused or pooled; `autoCount` fixed with an `isAuto` flag.
8. **[6] Resize and lifecycle:** resize rescales buffers without calling `populate()`; the loop pauses on `visibilitychange`.
9. **[7] WebGL2 galaxy layer:** opaque WebGL2 canvas (`alpha: false`) behind a transparent 2D canvas; star data in one static buffer; instanced quads with a glow sprite; one draw call; 50k+ stars. Replaces `buildGalaxy` / `drawGalaxy`.
10. **[8] Tilted-ellipse orbits:** orbit maths in the vertex shader; tilt grows with radius; view squash ~0.6–0.7; arm pattern does not wind up.
11. **[9] Colour by population:** per-star colour from radius and arm distance (warm core, blue-white arms, warmer inter-arm glow).
12. **[10] HDR + tone map:** RGBA16F target when `EXT_color_buffer_float` works and the framebuffer is complete, else 8-bit; Narkowicz ACES in the final pass.
13. **[11] Bloom:** downsample/upsample chain with a 3×3 tent filter and Karis average on the first step.
14. **[12] Dust and H-II:** darkening dust layer on the inner edge of each arm; pink knots just past the dust.
15. **[13] Nebula:** domain-warped FBM baked once into a low-res texture that rotates with the galaxy.
16. **[14] Grading:** slight brightness and saturation pull on the galaxy after tone mapping.
17. **[15] Phone resolution:** WebGL layer at ~0.5–0.75× DPR on phones; 2D layer at full DPR (capped at 2).
18. **[16] Adaptive quality:** frame time averaged over 1–2 s after startup; steps down resolution → star count → bloom levels; steps back up slowly.
19. **[17] Context loss:** rebuild GPU resources on `webglcontextrestored`; tested with `WEBGL_lose_context`.
20. Starfield and shooting stars keep working on the 2D layer, restyled only as needed to fit the palette and the zero-allocation rule.

## Scope
**In scope:** requirements 1–20; updating `HANDOFF.md` to describe the new architecture; a `.claude/launch.json` entry so the browser pane can serve the page.

**Out of scope:** optional upgrades 18–19 (diffraction spikes, Atlas grid) unless the user asks after Stage 4; audio; UI controls; seeded URLs; hosting; `prefers-reduced-motion`; `LICENSE`; the research folder; any Galaxy-Renderer code.

## Technical Approach
**File layout** (from `HANDOFF.md`'s suggested layout; see Decision Point D1):
```
index.html            page, two stacked canvases, loads src/main.js as a module
src/main.js           loop, resize, input, visibility, debug readout
src/util.js           rand, pick, smooth, gauss, easing (pure)
src/starfield.js      far twinkling stars (2D)
src/constellation.js  generator (pure) + Atlas drawing (2D)
src/sprites.js        pre-rendered glow sprites (offscreen canvases)
src/shooters.js       shooting stars, pooled (2D)
src/galaxy/model.js   star data generation, orbit maths and colours (pure, mirrors the shader)
src/galaxy/gl.js      WebGL2 setup, buffers, render targets, context loss
src/galaxy/shaders.js GLSL sources: stars, dust, nebula bake, bloom, tone map
src/quality.js        adaptive-quality controller (pure state machine)
test/*.test.js        bun tests
```
ES modules mean the page must be served (`python3 -m http.server 8000`, already the documented way to run it in `HANDOFF.md`); opening the file directly would no longer work.

**Two layers.** The WebGL2 canvas draws the galaxy at the back; the transparent 2D canvas draws starfield, constellations, labels and shooting stars on top. Until Stage 2 lands, the existing 2D galaxy keeps running so every milestone stays complete.

**Galaxy pipeline (Stages 2–3).** Per frame: stars (instanced quads, additive) + H-II knots → HDR target; dust multiplies down; baked nebula texture added; bloom chain; final pass applies ACES tone map and grading to the screen. Star data (radius `a`, `θ0`, size, colour) is generated once in `model.js` and uploaded to a static buffer. The vertex shader computes the tilted-ellipse position from time, using the same formula as `model.js`, so the JS copy can be unit-tested.

**Smoothness.** Time-based motion with the existing 0.05 s `dt` clamp; preallocated typed arrays and object pools; quality controller in `quality.js` adjusts the WebGL resolution scale, active instance count and bloom levels.

## Files Affected
| File | Action | Reason |
|---|---|---|
| `index.html` | Modify | Becomes a thin page: style, two canvases, hint, module script |
| `src/*.js`, `src/galaxy/*.js` | Create | Code from the prototype, split so logic is testable, then upgraded |
| `test/*.test.js` | Create | Unit tests for pure logic |
| `package.json` | Create | Only a `"test": "bun test"` script and `"type": "module"`; no dependencies |
| `.claude/launch.json` | Create | Static server config for the browser pane |
| `HANDOFF.md` | Modify | Describe the new architecture and how to run and test it |
| `output/falling-constellations-build/*` | Create/update | Agent docs, progress, decisions, summary |

## Dependencies
- **Bun** (already installed, v1.4.2) for `bun test`. No packages installed.
- **Python 3** (already installed) for the local static server.
- **EB Garamond from Google Fonts** (remote font, chosen by the research). Needs network at runtime; falls back to a local serif. Needs approval (Decision Point D2).

## Testing Strategy
- **Unit (`bun test`):** easing curves (endpoints, monotonic); generator (star count 5–11, min spacing 28 px, edges form a connected tree plus at most 2 extras, no duplicate edges); `isAuto` counting; pool reuse; orbit model (arm phase at fixed radius is the same at t = 0 and t = 600 s, i.e. no winding; positions stay within bounds); colour by population (core warmer than arms); quality controller (steps down after sustained slow frames, ignores startup, steps up slowly, detects a steady rise).
- **In the browser pane** at each milestone: page loads with no console errors; screenshot for the user to judge; `?debug` readout reports frame time; WebGL2 checks (shader compile, framebuffer completeness, fallback path forced on); context loss forced with `WEBGL_lose_context`; mobile viewport emulation for Stage 4.
- **Not covered:** real phones and 120 Hz screens (the report recommends the user tests on one of each); exact visual taste, which the user judges.

## Milestones
Each one ends with tests run, a screenshot, and a proposed commit.

0. **Test and dev setup:** split the prototype into modules with no behaviour change; `package.json`; first tests for util and the generator; `?debug` frame-time readout; launch config. (Req 1, 2, 20)
1. **Stage 1a, Atlas look:** ink palette, graded size classes, sprites, engraved lines with gaps, EB Garamond labels. (Req 3, 4, 5)
2. **Stage 1b, motion and hygiene:** eased draw-in and fades, zero-allocation loop, pooling, `isAuto` fix, resize without repopulating, visibility pause. (Req 6, 7, 8)
3. **Stage 2, WebGL galaxy:** two-layer canvases, static buffer, instanced quads, tilted-ellipse vertex shader, colour by population; remove the 2D galaxy. (Req 9, 10, 11)
4. **Stage 3a, HDR and bloom:** half-float target with fallback, ACES tone map, bloom chain. (Req 12, 13)
5. **Stage 3b, structure and grading:** dust lanes, H-II knots, baked nebula, grading. (Req 14, 15, 16)
6. **Stage 4, device tuning:** phone resolution, adaptive quality, context-loss recovery; `HANDOFF.md` update. (Req 17, 18, 19)
7. **Summary:** `summary.md`; ask about optional upgrades 18–19.

## Decision Points
- **D1 (now): module split vs single file.** Testing needs the logic in importable files. Options and recommendation are in the chat message with this plan.
- **D2 (now): remote font.** Allow EB Garamond from Google Fonts, or use a local serif only.
- **D3 (before the first commit): repository and branch.** `origin` is `https://github.com/arinb44/Falling-Constellations`, branch `main`.
- **Milestone 1:** final ink colour and line-gap size, judged from screenshots.
- **Milestone 3:** star count and squash, judged by eye.
- **Milestones 4–5:** any effect that costs too much: drop, make optional, or desktop-only.
- **Milestone 7:** whether to build the optional upgrades.

## Risks & Limitations
- Moving to ES modules means the page must be served over HTTP; double-clicking `index.html` will show a blank page.
- No physical phone or 120 Hz screen is available to me; mobile behaviour is checked by emulation only, so performance numbers are approximate.
- Half-float support varies on Android; the fallback path is tested by forcing it, not on real failing devices.
- The shader and its JS mirror could drift apart; both are kept in one place (`model.js` holds the constants the shader uses) to reduce this.
- The remote font fails offline; the fallback serif will show instead.
- Visual tuning (colours, gaps, grading) is subjective and may take a few rounds.

## Open Questions
- D1, D2, D3 above.
- `prefers-reduced-motion` stays out of scope unless you add it.

**Decisions at approval:** D1 split into `src/` modules; D2 EB Garamond from Google Fonts with a local serif fallback; D3 commit to `https://github.com/arinb44/Falling-Constellations` on `main`.

**Status:** Approved on 2026-10-31
