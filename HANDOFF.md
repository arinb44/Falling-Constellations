# Falling Constellations: Handoff

A single-page canvas site. Randomly generated constellations fall down the screen forever over a slowly rotating spiral galaxy. Inspired by [beltoforion/Galaxy-Renderer](https://github.com/beltoforion/Galaxy-Renderer).

Current state: a working prototype in one file, `index.html` (vanilla JS, Canvas 2D, no dependencies, no build step). Live preview: https://claude.ai/artifact/SRPqbZqi1V3LD2NQSjr7Qu

## Run it

The code is split into ES modules under `src/`, so the folder must be served over HTTP (opening `index.html` directly shows a blank page):

```
bun scripts/serve.js 8000
```

`python3 -m http.server 8000` works too. Add `?debug` to the URL for a frame-time readout.

## Test it

```
bun test
```

Unit tests live in `test/` and use Bun's built-in runner; there are no npm dependencies.

## Suggested project layout (when you split it up)

```
constellations/
  index.html
  style.css
  src/
    main.js            # loop, resize, input
    galaxy.js          # background spiral
    starfield.js       # far twinkling stars
    constellation.js   # generator + draw
    shooters.js        # shooting stars
    util.js            # rand, pick, smooth, gauss
```

Suggested commit stages: (1) canvas + loop + resize, (2) starfield, (3) galaxy, (4) constellation generator, (5) constellation rendering + recycling, (6) input + polish.

## Architecture

One `requestAnimationFrame` loop. Each frame:

1. Clear to `#02030a`, add a faint top-down purple gradient.
2. `drawGalaxy(t)`
3. `drawStars(t, dt)`
4. Remove constellations that have fallen past `H + 200`. Spawn a new one at the top if the count is below target.
5. `drawConstellation` for each one (also advances its position).
6. Shooting stars.

`dt` is clamped to 0.05 s so a backgrounded tab doesn't cause a jump. The canvas is scaled by `devicePixelRatio` (capped at 2) and everything is drawn in CSS pixels.

## Module notes

### Galaxy (`buildGalaxy`, `drawGalaxy`)
- 3,200 points. Each stores radius `r = random^1.6` (dense core), an arm index, and a starting angle `theta0 = r*twist + armOffset + gaussianNoise`.
- Differential rotation: angular speed `omega = 0.22 / (r + 0.12)`, so the inner stars orbit faster. The current angle is `theta0 + t*omega*0.12`.
- Each star is projected to an ellipse (y squashed by 0.45), then rotated by `tilt = -0.35` rad.
- Points are bucketed into 4 colours (core warm, mid white, outer blue, rare pink). `fillStyle` is set once per bucket, and `globalCompositeOperation = 'lighter'` gives the additive glow.
- **Known issue:** the galaxy reads as a narrow S-ribbon, not a full spiral. Likely causes are `twist` and the 0.45 squash being too aggressive, plus a small `jitter`. Try `twist` 3 to 4, a squash of 0.6 to 0.7, and more arm spread.
- **Closer to the real Galaxy-Renderer:** replace the log-spiral with elliptical orbits whose major axis rotates with radius (density-wave theory), add dust particles, and add pink H-II blobs along the arms. That is the main thing the original does that this doesn't.

### Starfield (`buildStars`, `drawStars`)
- Count is `W*H/5500`. Stars fall at 2 to 8 px/s, wrap from the bottom to a random x at the top, and twinkle via a per-star sine phase.

### Constellation generator (`makeConstellation`)
1. Pick `n` in 5 to 11. Start with a star at (0,0).
2. Repeatedly pick an existing star, then a random angle and distance (34 to 86 px). Accept if every other star is more than 28 px away (rejection sampling, 400-try guard).
3. Re-centre on the centroid. Give each star a magnitude (20% bright) and a twinkle phase.
4. Edges: **Prim's minimum spanning tree**, so it is always connected and never looks tangled. Then add 0 to 2 extra edges between stars under 110 px apart, to make loops.
5. Per-constellation properties: `depth` (0.55 to 1.35, scales size and speed), `vy = 16 + 30*depth`, sway amplitude, frequency and phase, rotation speed, hue (from a fixed palette), draw-in time, and a generated name.
6. Name: an optional title (Ursa, Canis, ...) plus a prefix, a vowel cluster and a suffix.

### Constellation rendering (`drawConstellation`)
- Position: `y += vy*dt`, `x = baseX + sin(t*freq + phase)*amp + mouseParallax*depth`.
- Alpha is the minimum of a fade-in at the top, a fade-out near the bottom (`H-160` onward), and a fade-in after birth.
- Edges grow in sequentially. Edge `i` draws with `e = clamp(progress*numEdges - i, 0, 1)`.
- Stars are a radial-gradient glow plus a white core, with a sine twinkle.
- The label is spaced uppercase monospace under the lowest star.

### Spawning and the infinite loop
- `targetCount = max(5, round(W/130))`, which is about 9 on a 1280 px screen.
- On load, `populate()` scatters constellations at random heights so the screen is never empty.
- Each frame there is a `dt*2.2` chance of spawning one at `y = -160*depth` while under the target.
- Click-spawned ones are tracked the same way, so they also get recycled.
- **Quirk to fix:** the "auto" count is `cons.filter(c => c.vy)`, which matches every constellation, because `vy` is always truthy. Click-spawned ones therefore count toward the target and temporarily suppress auto-spawning. Add an `isAuto` flag if you want them separate.

### Input
- `mousemove` sets `mouse.px` in -1..1 for horizontal parallax.
- `pointerdown` spawns a constellation at the cursor.
- The hint text fades after the first click or 8 seconds.

## Tunables worth exposing in a UI

| What | Where | Current |
|---|---|---|
| Fall speed | `vy = 16 + 30*depth` | 16 to 60 px/s |
| Density | `targetCount` (`W/130`) | about 9 |
| Stars per constellation | `randInt(5, 11)` | 5 to 11 |
| Extra loop edges | `randInt(0, 2)` | 0 to 2 |
| Galaxy star count | `GALAXY_N` | 3200 |
| Galaxy rotation | `t*s.omega*0.12` | slow |
| Hue palette | `HUES` | 7 hues |
| Sway | `swayAmp`, `swayFreq` | 8 to 28 px |

## Ideas for next steps

- Real density-wave galaxy (see above), plus a dust layer using an offscreen canvas with blur.
- Seeded RNG, so a URL like `?seed=1234` reproduces a sky. Replace `Math.random` with mulberry32.
- Pause and speed controls, a density slider, and a "calm" mode with fewer shooting stars.
- Hover a constellation to brighten it and show its name.
- Performance: pre-render star glow sprites to an offscreen canvas instead of building a `createRadialGradient` per star per frame. Pre-render the galaxy in layers.
- Optional WebGL or a particle shader if you want 50k or more galaxy stars (this is what makes the original look so dense).
- Respect `prefers-reduced-motion`.
- Audio: a soft chime when a constellation finishes drawing in.

## Sharing and hosting limits

If you republish it as a Claude artifact, only inline scripts and a few CDNs load, and `fetch` to other hosts is blocked. The current page needs none of that. For your own hosting, any static host works (GitHub Pages, Netlify, Vercel).
