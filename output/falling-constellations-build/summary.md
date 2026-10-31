# Falling Constellations: build the Deep Field + Atlas upgrades: Implementation Summary

**Prepared by:** Falling Constellations Build Agent
**Date:** 2026-10-31
**Status:** Complete (core upgrades 1–17, Milestone 7: optional upgrades 18–19 and live nebulae, Milestone 8: moving galaxies, clusters and knots; Milestone 8 not yet committed)

## 1. Overview
The single-file Canvas 2D prototype is now a two-layer piece. Atlas-style constellations are drawn on a transparent 2D canvas. Behind them, a WebGL2 layer draws a 60k-star spiral galaxy plus the far field: nebulae, dust, distant galaxies and clusters. That layer renders through an HDR pipeline with bloom, an ACES tone map and grading. The galaxy's arms come from tilted elliptical orbits, so they never wind up. Dust lanes, H-II knots and gas are baked once and rotate with the arm pattern. Phones draw the galaxy layer at reduced resolution, an adaptive controller trades quality for frame rate, and a lost WebGL context is rebuilt. Milestone 7 added live field nebulae that billow, form and dissolve on the GPU, faint diffraction spikes on each figure's brightest star, and a faint Atlas coordinate grid. Milestone 8 set the rest of the background in motion: distant galaxies spin in their own planes and shimmer, cluster stars twinkle and swirl, and the pink H-II knots slide along the arms, fade and are reborn elsewhere. All 108 unit tests pass and the page runs at 60 fps in the browser pane, on desktop and in phone emulation.

## 2. Requirements Checklist
| # | Requirement | Status | Note |
|---|---|---|---|
| 1 | Test setup | Done | `bun test`, no packages; 108 tests across 15 files |
| 2 | Dev readout | Done | `?debug`; later extended with HDR/LDR, bloom, quality rung |
| 3 | [1] Atlas restyle | Done | Cream→gold ink, 4 size classes, engraved lines with gaps |
| 4 | [2] Star sprites | Done | Pre-rendered once (`sprites.js`) |
| 5 | [3] Typography | Partial (by decision) | Constellation names removed at the user's request; EB Garamond small caps used for the hint only |
| 6 | [4] Draw-in and fades | Done (changed) | Stars fade in one by one, lines once the figure is on screen (user's choice); eased bottom fade |
| 7 | [5] Zero allocation per frame | Done | Pools, cached gradients, `isAuto` flag |
| 8 | [6] Resize and lifecycle | Done | Rescale without repopulating; pause on `visibilitychange` |
| 9 | [7] WebGL2 galaxy layer | Done | 60k stars, one instanced draw |
| 10 | [8] Tilted-ellipse orbits | Done | Vertex shader mirrors `model.js`; no-winding test over 600 s |
| 11 | [9] Colour by population | Done | Warm bulge, blue young stars at arm crests, warmer disc |
| 12 | [10] HDR + tone map | Done | RGBA16F with completeness probe, RGBA8 fallback (`?ldr`), Narkowicz ACES |
| 13 | [11] Bloom | Done | 13-tap downsample with Karis average on the first step, 3×3 tent upsample |
| 14 | [12] Dust and H-II | Done | Dust on the arms' inner edges, pink knots on the outer edges, from a baked arm map |
| 15 | [13] Nebula/gas | Done | Domain-warped FBM baked once, rotated with the arm pattern |
| 16 | [14] Grading | Done | Saturation 0.88, brightness 0.96 after tone mapping |
| 17 | [15] Phone resolution | Done | 0.65× DPR on phones; 2D at full DPR (cap 2) |
| 18 | [16] Adaptive quality | Done | Resolution → stars → bloom; slow step-up with backoff |
| 19 | [17] Context loss | Done | Rebuild on `webglcontextrestored`; tested with `WEBGL_lose_context` |
| 20 | Starfield and shooting stars kept | Done | Starfield moved to WebGL; shooting stars restyled (see below) |
| 21 | Far field (added) | Done | Pulsing nebula ring, dark dust, distant galaxies, clusters |
| 22 | Dynamic field nebulae (Milestone 7) | Done | Live 3D noise in `CLOUD_FS`; form 20 s, hold 40–90 s, dissolve 20 s, respawn in the same sector with a new shape and colour; pulses kept; 2D fallback keeps baked clouds |
| 23 | [18] Diffraction spikes | Done | One upright 4-point sprite under each figure's brightest star |
| 24 | [19] Atlas grid | Done | Parallels and meridians around an off-screen pole, alpha 0.055, pre-rendered per resize |
| 25 | Distant galaxies spin and shimmer (Milestone 8) | Done | Face-on sprite tilted and spun in `SPIN_VS`; outline fixed, arms turn |
| 26 | Clusters twinkle and swirl (Milestone 8) | Done | One instanced draw over a baked haze; inner stars turn faster |
| 27 | Pink knots live along the arms (Milestone 8) | Done | `knots.js`: clumps fade in, slide along the outer edge, fade out, reborn elsewhere |
| 28–29 | 2D fallback unchanged; negligible cost (Milestone 8) | Done | 60 fps unchanged at 1024×768 @2x and 375×812 |
| — | Shooting stars (added) | Done | Blue streak; the trail stays 1 s and fades from the far end toward the head |

## 3. Changes Made
**Created**
- `src/main.js`: loop, resize, input, visibility pause, device tuning, context loss, readout
- `src/util.js`, `src/debug.js`, `src/sprites.js`, `src/constellation.js`, `src/starfield.js`, `src/shooters.js`: modules split out of the prototype, then upgraded
- `src/quality.js`: phone base scale and adaptive-quality controller
- `src/sky/noise.js`: seeded RNG, gradient noise, FBM, domain warp
- `src/sky/field.js`: far-field bakes and pulses
- `src/galaxy/model.js`: galaxy star data, orbits, colours
- `src/galaxy/structure.js`: arm map, dust, gas, H-II knots
- `src/galaxy/shaders.js`: all GLSL and post-processing constants
- `src/galaxy/post.js`: HDR target, bloom, tone map
- `src/galaxy/gl.js`: WebGL2 back layer
- `src/sky/clouds.js`: live nebula layout and life cycle
- `src/grid.js`: Atlas coordinate grid
- `src/galaxy/knots.js`: H-II knot life cycle and slide along the arms
- `scripts/serve.js`: Bun static server
- `package.json`: test script, no dependencies
- `test/*.test.js` (15 files) and `test/fakes.js`

**Modified**
- `index.html`: thin page with two stacked canvases and a module script
- `HANDOFF.md`: rewritten for the current architecture, dev flags and tunables

**Deleted**
- The inline prototype code in `index.html`, replaced by modules
- `src/galaxy/canvas2d.js`, an interim 2D galaxy removed in Milestone 3

**Not committed**
- `.claude/launch.json`, by the user's choice (machine-specific paths)

## 4. How to Use / Run
```
bun scripts/serve.js 8000     # then open http://localhost:8000
bun test
```
Dev flags:
- `?debug`: frame-time readout
- `?nogl`: the 2D fallback
- `?ldr`: forces the 8-bit render path
- `?burn=ms`: simulates a slow device

The main settings are listed in the Tunables table in `HANDOFF.md`, for example `G.GAIN`, `S.DUST`, `S.GAS` and `POST.BLOOM`.

## 5. Testing
- **Command:** `bun test`
- **Final result:** 108 passed, 0 failed across 15 files.
- **What the tests cover:**
  - easing
  - the constellation generator (connected tree, spacing, edges) and draw-in timing
  - sprites
  - far-field layout and pulses
  - noise
  - the debug stats
  - the galaxy orbit model (arms don't wind up over 600 s; colour by population; gain)
  - the arm-structure bake (dust inside the arms, knots outward and pink, gas within the disc, seeding, shader constants)
  - the tone map, bloom level sizes and grading
  - shooting-star trail timing
  - the quality controller (warm-up, step-down, hitches, slow step-up with backoff, steady rise)
  - the nebula life cycle (starts and ends at zero, continuous, respawn stays in its sector, neighbours differ in colour, pulses)
  - the brightest-star choice and spike sprite
  - distant-galaxy spin (outline kept, arms turn) and shimmer range; cluster swirl (radius kept, inner faster) and twinkle range; seed layout unchanged by motion
  - H-II knots: life cycle, tangent direction, staying on the outer edge while sliding, rebirth of one clump, steady glowing count over 10 minutes
  - the Atlas grid geometry (pole off-screen, every line crosses the screen, even spacing, faint) and its one-time pre-render
- **Checked in the browser pane, not by unit tests:**
  - the shaders and the look
  - frame rate: 60 fps at 711×773 and 900×700 @2x
  - the `?ldr` path
  - forced context loss and restore
  - phone emulation (375×812)
  - Milestone 7: spikes, grid, `?ldr`, `?nogl` and phone emulation render with no console errors; screenshots over ~60 s show clouds forming and thinning. 60 fps with live clouds was measured at 900×700 @2x before the grid was added; the final check ran with the pane hidden, so its frame times were throttled and not meaningful.
  - Milestone 8 (pane visible): 60 fps (16.6 ms avg) at 1024×768 @2x and 60 fps in phone emulation at full quality; no console errors on the default, `?ldr` and `?nogl` paths.
- **Not covered:**
  - Real phones and 120 Hz screens; phone behaviour was checked by emulation only.
  - The browser pane was often throttled or zero-sized, so some checks used a fixed emulated viewport.

## 6. Commits
| Hash | Message |
|---|---|
| `528f5d5` | Split prototype into modules and add test setup |
| `5296567` | Restyle constellations in Atlas ink and draw stars before lines |
| `9d10cf0` | Smooth the loop: eased fades, no per-frame allocation, resize and pause fixes |
| `57de6fa` | Add far-field nebulae, dark dust, distant galaxies and star clusters |
| `cfd0cab` | Move the galaxy and far field to WebGL2 with tilted-ellipse orbits and pulsing nebulae |
| `f0b75d1` | Add HDR rendering, bloom and filmic tone mapping to the galaxy layer |
| `a700805` | Restyle shooting stars as blue streaks with a lingering trail |
| `81fa75e` | Add dust lanes, H-II knots, galaxy gas and grading |
| `bcc2a7a` | Add phone resolution, adaptive quality and WebGL context-loss recovery |
| `bcd0993` | Add live billowing nebulae, diffraction spikes and an Atlas grid |

Milestone 8 is not yet committed. All of the above are pushed to `https://github.com/arinb44/Falling-Constellations` on `main`.

## 7. Decision Log
- **Setup:**
  - Split the code into `src/` modules.
  - Use EB Garamond from Google Fonts with a local serif fallback.
  - Commit to `arinb44/Falling-Constellations` on `main`.
- **Constellations:**
  - Names removed.
  - Stars appear first, and lines draw once the whole figure is on screen.
- **Far field** (added beyond the report):
  - Field nebulae baked now and reused as WebGL textures.
  - Dark dust clouds, distant galaxies and star clusters.
  - Nebula clouds spread on a ring, each pulsing on its own timer.
- **WebGL layer:** the far field and background stars moved to WebGL along with the galaxy.
- **Galaxy brightness:**
  - Centre dimmed to 50%.
  - The galaxy overpowered the constellations, so it was dimmed overall with `G.GAIN` = 0.55.
- **Shooting stars:** a blue streak whose trail stays briefly and fades from the far end toward the head.
- **On resume:** kept and finished the partly built Milestone 4 rather than restarting it.
- **Milestone 5:** the look was approved as built.
- **Milestone 8:** galaxies spin and shimmer, clusters twinkle and swirl, pink knots live along the arms; then sped up to "clearly visible" (first speeds were too slow to see).
- **Milestone 7:** build both optional upgrades; make the field nebulae billow, form and dissolve with live GPU noise, keeping the pulses (field nebulae only).

The full table is in `decisions.md`.

## 8. Known Issues & Next Steps
- **Milestone 7 look** still needs your eye: spike strength, grid visibility (the report says drop it if it clutters), and cloud speed and life-cycle lengths.
- **Milestone 8 speeds** were raised after the first version moved too slowly to see; distant galaxies and clusters are small (5–40 px), so their motion stays subtler than the knots'.
- **Real phone:** frame rate with the live clouds and moving knots is only checked in emulation.
- **Real-device testing:** try a real phone and a 120 Hz screen. The quality thresholds (20 ms / 17.5 ms) assume 60 Hz. A phone in a 30 fps low-power mode would read as slow and step down to the last rung.
- **Wide galaxy on phones:** the galaxy (radius 0.56 × the longer side) is wider than a phone screen and is cropped. It looks fine in emulation.
- **Dimmer galaxy at low rungs:** with fewer stars drawn, the remaining ones are brightened by 1/√share, so the galaxy gets a little dimmer on the lowest rungs.
- **Still out of scope** (from the plan):
  - `prefers-reduced-motion`
  - seeded URLs
  - UI controls
  - hosting
