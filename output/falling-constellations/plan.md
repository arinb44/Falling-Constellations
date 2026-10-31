# Plan: Falling Constellations

## Project Title
Falling Constellations: a visual upgrade guide for a smooth, beautiful generative art piece

## Objective
Work out how to turn the current Canvas 2D prototype into a piece of generative art that is beautiful to watch and runs smoothly. First find an aesthetic direction the user chooses, then research the techniques that best serve it (a realistic spiral galaxy, glow, dust, constellation polish, WebGL rendering). Deliver a ranked list of upgrades with implementation notes and performance costs.

## Key Research Questions
1. **Aesthetic direction:** What moods, palettes and compositions work best for generative space art, and which 2–3 directions suit this piece?
2. **Galaxy structure:** How are real spiral galaxies shaped (density waves, elliptical orbits, dust lanes, star-forming regions), and how can that be simulated cheaply in real time?
3. **Rendering beauty:** Which techniques (additive blending, glow sprites, bloom, tone mapping, color grading, dust and nebula layers) give the biggest visual gain?
4. **WebGL:** How do you render 50k+ glowing particles in WebGL, and what is the simplest path from the current Canvas 2D code?
5. **Constellation polish:** How can the constellations' stars, lines, fades and labels be made more elegant and fit the chosen direction?
6. **Smoothness:** What keeps motion smooth across laptops and phones (frame pacing, device-pixel-ratio handling, avoiding per-frame allocation, adaptive quality)?
7. **Order:** In what order should the upgrades be done for the best result at each step?

## Scope
**In scope:** aesthetics and reference work; galaxy astrophysics as it applies to rendering; Canvas 2D and WebGL rendering techniques; constellation visuals; performance and smoothness; the existing `index.html` and `HANDOFF.md`.

**Out of scope:** audio; UI controls and sliders; seeded URLs; hosting; refactoring for its own sake; writing the final implementation. Galaxy-Renderer is inspiration only: not cited, code not copied. Reduced-motion accessibility is not included unless the user adds it.

## Methodology
- **Source types:** official docs (MDN, Khronos WebGL), established graphics references (The Book of Shaders, Inigo Quilez, GPU Gems, LearnOpenGL for bloom and tone mapping), astronomy references (NASA/ESA material, textbooks and review articles on density-wave theory), and artists' write-ups and portfolios for the aesthetic study.
- **Search strategy:** one milestone per question group; standard web searches first, deeper searches for niche topics (e.g. real-time density-wave approximations).
- **Evaluating sources:** prefer primary docs and recognized experts; check dates (WebGL advice older than ~2018 is checked for staleness); performance claims must have benchmarks or be marked unverified; every source logged in `notes.md` with a reliability note.
- **Review of the prototype:** read the current code to tie each recommendation to a specific function (`drawGalaxy`, `drawConstellation`, etc.).

## Planned Report Structure
1. Executive Summary
2. Objective & Scope
3. Methodology
4. Findings
   - 4.1 Aesthetic directions (and the chosen one)
   - 4.2 Building a convincing spiral galaxy
   - 4.3 Glow, dust, nebulae and color
   - 4.4 Moving to WebGL
   - 4.5 Constellation polish
   - 4.6 Keeping it smooth
5. Analysis: trade-offs between beauty, complexity and performance
6. Conclusions & Recommendations: the ranked upgrade list, each with visual effect, how to build it, performance cost, and the prototype function it touches
7. Limitations & Open Questions
8. Decision Log
9. Sources

## Milestones
1. **Prototype review:** note what the current code does well and where it falls short visually and in performance.
2. **Aesthetic study:** gather references and write up 2–3 aesthetic directions (mood, palette, motion, composition).
3. **User picks a direction** (decision point).
4. **Galaxy structure:** density-wave theory and real-time approximations.
5. **Rendering beauty:** glow, bloom, tone mapping, dust and nebula layers, color.
6. **WebGL path:** particle rendering at scale and the migration path from Canvas 2D.
7. **Constellation polish:** star sprites, line styles, fades, typography.
8. **Smoothness:** frame pacing, device scaling, adaptive quality.
9. **Synthesis:** rank the upgrades and write `report.md`.

## Decision Points
- After milestone 2: which aesthetic direction to follow.
- After milestone 6: whether to go fully WebGL or use a hybrid (WebGL galaxy, Canvas 2D constellations), if the research shows a real trade-off.
- Any time a technique looks too heavy for phones: whether to drop it, make it optional, or keep it desktop-only.
- If WebGPU looks clearly better for a technique: whether to consider it.

## Risks & Limitations
- Beauty is subjective: the aesthetic study gives options, but the final judgment is the user's.
- Performance varies widely across devices; without testing on real hardware, some cost estimates will be approximate and marked as such.
- Some good graphics material lives in books or paywalled articles; I will ask before relying on anything that needs payment or login.
- Real-time galaxy models are approximations of the physics; the report will say where looks were favored over accuracy.

## Open Questions
- Should reduced-motion accessibility be included? (Currently out of scope.)

**Status:** Approved on 2026-10-31
