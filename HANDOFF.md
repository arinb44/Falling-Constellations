# Falling Constellations: Handoff

A single-page site. Randomly generated constellations, drawn in the style of an antique star atlas, fall down the screen forever over a slowly turning spiral galaxy. Inspired by [beltoforion/Galaxy-Renderer](https://github.com/beltoforion/Galaxy-Renderer) (inspiration only; no code taken from it).

Vanilla JS ES modules, Canvas 2D and raw WebGL2, no dependencies, no build step.

## Run it

The code is split into ES modules under `src/`, so the folder must be served over HTTP (opening `index.html` directly shows a blank page):

```
bun scripts/serve.js 8000
```

`python3 -m http.server 8000` works too where it can read the folder.

**Dev flags** (add to the URL):

| Flag | Effect |
|---|---|
| `?debug` | Frame-time readout: fps, average and worst frame, view size, field bake time, HDR or LDR, bloom levels, quality rung, WebGL resolution, share of galaxy stars |
| `?nogl` | Skip WebGL2 and use the 2D fallback (far field and starfield, no galaxy) |
| `?ldr` | Force the 8-bit render path (as on devices without half-float targets) |
| `?burn=ms` | Waste that many ms per frame, to watch the quality controller step down |

To test context loss, in the console: `document.getElementById('gl').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`, then `.restoreContext()` on the same extension.

## Test it

```
bun test
```

Unit tests live in `test/` and use Bun's built-in runner. They cover the pure logic: easing, the constellation generator, sprites, the far field, the galaxy orbit model (including that the arms never wind up), the arm structure bake, the tone map and bloom sizes, grading, shooting-star trails, and the quality controller. Shaders and the look are checked by eye in a browser.

## Layout

```
index.html              page: style, two stacked canvases (#gl behind, #c on top), hint, module script
scripts/serve.js        Bun static server for local runs
src/main.js             loop, resize, input, visibility pause, device tuning, context loss, debug readout
src/util.js             rand, pick, smooth, gauss, easing
src/debug.js            frame-time stats and readout (?debug)
src/quality.js          phone base scale and adaptive-quality controller (pure)
src/sprites.js          pre-rendered star glow sprites, 4 size classes
src/constellation.js    generator (pure) and Atlas drawing
src/shooters.js         shooting stars: pooled, blue streaks with a lingering trail
src/starfield.js        far stars, 2D fallback only
src/sky/noise.js        seeded RNG (mulberry32), gradient noise, FBM, domain warp
src/sky/field.js        far field: nebula clouds (pulsing), dark dust, distant galaxies, star clusters
src/galaxy/model.js     galaxy star data, tilted-ellipse orbits, colours (pure; mirrors the shader)
src/galaxy/structure.js arm map, dust lanes, gas, H-II knots, baked once (pure)
src/galaxy/shaders.js   all GLSL sources and post-processing constants
src/galaxy/post.js      HDR target, bloom chain, tone map and grade
src/galaxy/gl.js        WebGL2 back layer: setup, buffers, textures, draw order, quality hooks
test/*.test.js          bun tests
```

## Architecture

Two layers. The WebGL2 canvas (`#gl`, opaque) draws everything in the background. The transparent 2D canvas (`#c`) on top draws the constellations, shooting stars and nothing else, so the Atlas ink always stays crisp. Without WebGL2 the far field and starfield are drawn on the 2D canvas instead, with no galaxy.

One `requestAnimationFrame` loop. Motion runs on a sim clock that advances by `dt`, clamped to 0.05 s, and the loop stops while the tab is hidden, so nothing jumps on return. Nothing is allocated per frame in the render loop.

**Back layer, far to near** (all drawn into an HDR target):

1. Background gradient.
2. Far field: nebula clouds (each pulses on its own timer), distant galaxies, star clusters. All drift slowly together.
3. Background stars (fall and wrap entirely on the GPU).
4. Far-field dust, which dims the stars behind it.
5. Galaxy core glow, then galaxy gas.
6. Galaxy stars: 60k in one instanced draw.
7. Galaxy dust lanes, which darken the stars, then pink H-II knots.

Then bloom (13-tap downsample with a Karis average on the first step, 3×3 tent upsample), Narkowicz ACES tone map, and a slight saturation and brightness pull so the constellations read on top.

**Render targets.** RGBA16F when `EXT_color_buffer_float` is available and a test framebuffer completes; otherwise RGBA8.

**Galaxy model.** Every star moves on an ellipse whose long axis turns a little more with radius. Arms appear where neighbouring ellipses crowd together, and because the arm pattern depends only on that tilt, it never winds up. The vertex shader runs the same maths as `model.js`; the constants are pasted into the GLSL from JS so the two cannot drift apart. `G.GAIN` (0.55) sets overall galaxy brightness so it doesn't overpower the constellations.

**Arm structure.** The ellipses are fixed in a frame that turns at `G.PATTERN`. `structure.js` bakes, once at startup and in that frame:
- an arm map from the real star data
- dust along each arm's inner edge
- domain-warped gas
- 140 H-II knots along the outer edges

The GPU only rotates them.

**Constellations.** 5–11 stars placed by rejection sampling. A minimum spanning tree plus 0–2 loop edges keeps every figure connected without tangles. One cream/gold ink and 4 graded size classes come from pre-rendered sprites. Lines are thin, engraved-style, with gaps at the stars. Stars fade in one by one; lines ease in once the whole figure is on screen. `targetCount = max(5, round(W / 130))`; click-spawned ones don't count toward it.

## Device tuning

- **Phones** (coarse pointer and short side under 768 px) draw the WebGL layer at 0.65× DPR. The 2D layer stays at full DPR, capped at 2.
- **Adaptive quality** (`quality.js`):
  - **Measuring:** it ignores the first 2 s and averages frame time over 1.5 s windows. Single frames over 0.25 s (tab switches, GC pauses) are ignored.
  - **Stepping down:** a window slower than 20 ms steps down one rung. The order is resolution (1 → 0.8 → 0.65), then galaxy stars (100% → 60% → 35%, with the remaining stars brightened by 1/√share), then bloom levels (6 → 3 → 0).
  - **Stepping up:** after 10 s of windows under 17.5 ms it tries one rung up. If that step immediately fails, the wait doubles.
- **Context loss**: the page keeps running the 2D layer, and on `webglcontextrestored` the back layer is rebuilt. Star data and the structure bake are cached per seed, so the rebuild doesn't recompute them.

## Tunables

| What | Where | Current |
|---|---|---|
| Galaxy brightness | `G.GAIN` in `galaxy/model.js` | 0.55 |
| Galaxy shape | `G.TWIST`, `G.E_MAX`, `G.SQUASH`, `G.SCATTER` | 4.2, 0.36, 0.64, 0.02 |
| Centre dimming | `G.CORE_DIM`, `G.CORE_DIM_R` | 50% inside 0.22 |
| Dust, gas, knots | `S.DUST`, `S.GAS`, `S.KNOTS` in `galaxy/structure.js` | 0.55, 0.12, 140 |
| Bloom strength | `POST.BLOOM` in `galaxy/shaders.js` | 0.05 |
| Grading | `POST.SATURATION`, `POST.BRIGHTNESS` | 0.88, 0.96 |
| Nebula brightness | `NEBULA_PEAK` in `sky/field.js` | 85 |
| Nebula pulses | `PULSE` in `sky/field.js` | 2.2× swell, every 7–18 s |
| Shooting-star trail | `FLIGHT`, `LINGER` in `shooters.js` | 0.8 s, 1.0 s |
| Fall speed | `vy = 16 + 30*depth` in `constellation.js` | 16 to 60 px/s |
| Density | `targetCount` (`W/130`) | about 9 |
| Quality thresholds | `Q` in `quality.js` | 20 ms down, 17.5 ms up |

## Ideas for next steps

- Optional Atlas touches from the research: faint diffraction spikes on each figure's brightest star, a faint coordinate grid.
- Seeded URLs, e.g. `?seed=1234` to reproduce a sky (the RNG is already seeded internally).
- Respect `prefers-reduced-motion`.
- Test on a real phone and a 120 Hz screen. Tuning so far used desktop and emulation only.

## Sharing and hosting limits

If you republish it as a Claude artifact, only inline scripts and a few CDNs load, and `fetch` to other hosts is blocked. The page needs none of that apart from the EB Garamond font from Google Fonts, which falls back to a local serif. For your own hosting, any static host works (GitHub Pages, Netlify, Vercel).
