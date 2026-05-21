# Phase 3 — Ground & Cinematic Storytelling

> Part of the [Visual Clarity & Story-Readability SDD](./README.md). For
> the cross-cutting rules this phase obeys, see
> [`contracts.md`](./contracts.md):
> [Validation Tiers](./contracts.md#validation-tiers),
> [Mode & Density Plumbing](./contracts.md#mode--density-plumbing),
> [Three-Tier Visual Contract](./contracts.md#three-tier-visual-contract),
> [Accessibility & Motion](./contracts.md#accessibility--motion),
> [Performance Budget](./contracts.md#performance-budget),
> [Cross-cutting Conventions](./contracts.md#cross-cutting-conventions).
>
> [Phase 1](./phase-1-identity-first.md) +
> [Phase 2](./phase-2-non-text-channels.md) together solve all four
> story questions for any operator who looks up at the air. Phase 3
> makes the *ground* tell the same story so a zenith camera frame still
> reads correctly, and adds optional *cinematic* emphasis cues (ground
> ripple, spotlight fog) for live-demo settings.
>
> Theme: *the floor is also a stage; the room around it can dim on cue.*

Slices:

- [Phase 3A: Hex Grid Paint-by-Numbers](#phase-3a-hex-grid-paint-by-numbers)
- [Phase 3B: Spine Particle Drift (optional, presentation-only)](#phase-3b-spine-particle-drift-optional-presentation-only)
- [Phase 3C: Orbit Trail (optional, presentation-only)](#phase-3c-orbit-trail-optional-presentation-only)
- [Phase 3D: Serving Ground Ripple](#phase-3d-serving-ground-ripple)
- [Phase 3E: Spotlight Fog Mode (optional, presentation-only)](#phase-3e-spotlight-fog-mode-optional-presentation-only)

---

## Phase 3A: Hex Grid Paint-by-Numbers

Repurpose `EarthFixedCells` (currently `served` / `not served`, 4×5 grid)
into a two-channel attribution map. The grid drives `cell.outerBorder`
(T2 satellite), `cell.innerRoleBorder` (T1 role), and `cell.fill` (T3
frequency) per the
[Three-Tier Contract](./contracts.md#three-tier-visual-contract).

Cover algorithm:

- Each cell at world position `(cx, cz)` and hex circumradius `r`
  (currently `cellRadius = 80`) is tested against each cone-beam's
  ground footprint disc. The disc is parameterized by
  `(beam.groundX, beam.groundZ)` (world coordinates from `BeamTarget`)
  and `viz.footprintRadiusWorld`.
- Cover test: a cell is **covered** by a beam iff the cell's center is
  within `(beam.footprintRadius + r * cos(30°))` world units of the
  disc center. This is the conservative inscribed-hex approximation; it
  over-estimates coverage near disc edges by at most 13.4% area, which
  is acceptable for a presentation cue. The exact circle-vs-hex polygon
  intersection is **out of scope** for this slice (see
  [Open Question 8](./README.md#open-questions)).
- A cell may be covered by multiple beams. Resolution priority:
  1. serving > pending > approach > recent-source > otherActive
  2. within the same role, higher SINR wins
  3. tie-break by satellite display order
- Hysteresis to avoid flicker: a cover assignment changes only after
  the same dominant beam holds for two consecutive ticks (`200 ms`
  minimum at 60 fps; longer at lower tick rates).

Complexity budget:

- `cells × cone-beams` per tick. With grid `4×5 = 20` cells and Phase 1B
  `event-only` tier (≤ 4 cone-beams) or `event-plus-1` tier (≤ 6
  cone-beams), the test runs at most `20 × 6 = 120` distance comparisons
  per tick. This is well within the
  [Performance Budget](./contracts.md#performance-budget) for a 60 fps
  target.
- Ambient rings from
  [Phase 1B](./phase-1-identity-first.md#phase-1b-presentation-density-floor)
  do **not** participate in cover assignment; only cone-beams paint
  cells.

Scope:

- For each covered cell:
  - **`cell.outerBorder`** = satellite tint of the dominant beam.
    MUST be drawn from `SATELLITE_TINT_PALETTE`; never a role color or
    frequency color (per
    [Forbidden cross-use #3](./contracts.md#forbidden-cross-uses-validated-as-invariants)).
  - **`cell.fill`** = `frequencyReuseColor(...)` of the dominant beam,
    capped at `0.18` opacity so the cell does not compete visually
    with the cone.
  - **`cell.innerRoleBorder`** = role color, drawn only when the
    dominant role is `serving` or `pending` (per
    [Forbidden cross-use #4](./contracts.md#forbidden-cross-uses-validated-as-invariants)).
- Optional debug label `A2` (sat-tag-letter + beam-id) rendered only
  when `runtime.beamDensity === 'all'` (i.e., tuning / diagnostics).

Non-goals:

- No change to grid generation parameters (`generateHexGrid(rows, cols,
  ...)`).
- No change to `MIN_VISIBLE_SINR_DB` or which beams qualify as
  "covering" a cell.
- No exact circle-vs-hex polygon intersection (deferred; see
  [Open Question 8](./README.md#open-questions)).
- No dynamic recentering of the grid when the UE moves (deferred; see
  [Open Question 4](./README.md#open-questions)).

Implementation guidance:

- Cell ↔ beam cover lookup runs once per simulation tick inside
  `MainScene.tsx`'s existing `useEffect` block (lines 293–654 today).
  The resulting cover map is then stored in a ref consumed by the
  rendering side of `EarthFixedCells`.
- The hysteresis state is a ref keyed by cell id; entries are
  `{ candidateBeamKey, ticksHeld }`.
- For zenith camera renders, `cell.fill` and `cell.outerBorder` together
  must read the four story questions without any cone visible (see
  [Phase Ordering Rationale](./README.md#phase-ordering-rationale)).

Touched files:

- `src/viz/EarthFixedCells.tsx` — extend `CellData` interface with
  `coveringBeam?: { satTintColor; frequencyColor; role; isServingOrPending }`;
  cell color and border resolution given a beam-cover map.
  (`CellData` lives in this file, lines 5–11; **not** in
  `src/scene/types.ts`.)
- `src/scene/MainScene.tsx` — compute per-tick cell-cover map with
  hysteresis; wire into `<EarthFixedCells>`.
- `scripts/validate-vc3a-hex-paint.tsx` — V2 (cover-map computation) +
  V3 (rendered cell color) validation.
- `package.json` — register `validate:vc3a:hex-paint`.

Acceptance:

- V2: forced cover-map fixture asserts dominant-beam selection per cell
  matches the priority-and-SINR order above.
- V3: in a forced fixture with three satellites covering overlapping
  ground regions, sampled cell-pixel colors match the expected
  satellite tint (border, ΔE ≤ 5) and frequency color (fill, ΔE ≤ 5).
- **Forbidden cross-use #3 invariant**: `cell.outerBorder` pixel
  samples are within ΔE ≤ 5 of an entry in `SATELLITE_TINT_PALETTE`
  and ≥ 15 ΔE from every `BEAM_ROLE_TOKENS[*].color` accent and every
  `BEAM_FREQUENCY_COLORS` entry. (V3 assertion.)
- Serving-covered cells have a visibly thicker inner border in the
  serving role color.
- The grid does not flicker on consecutive frames with the same beam
  set: rendering the same SimFrame twice in a row produces identical
  cover-map output (V2 invariant); the hysteresis prevents two-frame
  oscillation between competing dominant beams (V3 timed-screenshot
  test).

---

## Phase 3B: Spine Particle Drift (optional, presentation-only)

Add a slow downward particle drift along each event-role spine line,
tinted to the satellite color. Motion is a strong pre-attentive channel
and makes the data flow legible without any text.

Scope:

- Per event-role beam, spawn 2–4 particles drifting from satellite to
  ground along the spine vector at a speed proportional to a fixed
  visual time scale (no relation to actual data rates).
- Particle color = satellite tint. Particle size scales with the camera
  distance to keep them readable.
- Disabled when `runtime.effectsEnabled.spineParticles === false` (see
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing)).
- Disabled when `paused = true`.
- Disabled when `runtime.reducedMotion === true` (see
  [Accessibility & Motion](./contracts.md#accessibility--motion)).

Non-goals:

- No GPU instancing required for the small particle count expected.
- No tying particle spawn rate to physical link metrics. Particles are
  visual-only.
- No particles for `otherActive` or `inactive` beams.

Implementation guidance:

- `Trail` from `@react-three/drei` can do this with a `Line` + animated
  segment offset. Alternatively a small `BufferGeometry` of 2–4 spheres
  updated in `useFrame` works for the expected particle counts.

Touched files:

- `src/viz/SpineParticles.tsx` — new component.
- `src/scene/MainScene.tsx` — render gated on
  `runtime.effectsEnabled.spineParticles && !paused && !reducedMotion`.
- `scripts/validate-vc3b-spine-particles.tsx` — V3 validation.
- `package.json` — register `validate:vc3b:spine-particles`.

Acceptance:

- In presentation mode running un-paused, every event-role spine shows
  drifting particles in satellite tint color.
- In tuning/diagnostics, paused, or `reducedMotion` state, no particles
  are rendered.

Validation evidence:

- `npm run validate:vc3b:spine-particles` (V3) asserts gating behavior
  with forced state.

---

## Phase 3C: Orbit Trail (optional, presentation-only)

Add a short trailing line behind each visible satellite, tinted to the
satellite color, so the satellite identity persists across motion.

Scope:

- A 5-second trailing line per visible satellite using the satellite's
  recent positions (low resolution: 1 sample/200 ms).
- Trail color = satellite tint. Opacity ramps from `0.6` at the leading
  point to `0` at the tail.
- Disabled when `runtime.effectsEnabled.orbitTrail === false` (see
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing)) or
  `runtime.reducedMotion === true`.

Non-goals:

- No predicted future trail.
- No trail for non-visible satellites.

Implementation guidance:

- Use a small ring buffer per satellite stored in a ref.
- **Pre-allocate one `BufferGeometry` per visible satellite at mount
  time** with `Float32Array(25 * 3)` position attribute and
  `Float32Array(25)` opacity attribute, sized to the trail length.
  Each tick, update the existing attribute arrays in place
  (`attribute.array[i] = ...`) and call
  `attribute.needsUpdate = true`. Do **not** allocate new geometry
  per tick — the
  [Performance Budget](./contracts.md#performance-budget) caps
  `BufferGeometry` allocations at ≤ 4 / frame total, which 12
  satellites × 1 alloc/tick would blow.
- Geometry is disposed only when the satellite leaves the visible set.

Touched files:

- `src/viz/OrbitTrail.tsx` — new component.
- `src/scene/MainScene.tsx` — render gated on presentation mode.
- `scripts/validate-vc3c-orbit-trail.tsx` — V3 validation.
- `package.json` — register `validate:vc3c:orbit-trail`.

Acceptance (quantified, per review feedback):

- Each visible satellite has exactly one trail, colored within ΔE ≤ 5
  of the assigned satellite-tint palette entry.
- Trail length is exactly `25 sample points` (5 s @ 200 ms sampling).
- Opacity is monotonically decreasing along the trail from leading
  point (`0.6`) to tail (`0`). V3 sample at five evenly-spaced points
  asserts monotonicity.
- Trail screen-space opacity floor is `0.06`; below that the segment is
  not rendered (avoids "ghost trails").
- Two trails of different colors may visually overlap in screen space;
  they must not share `BufferGeometry` (regression risk: shared
  geometry caused color bleed in earlier R3F versions).
- In `runtime.reducedMotion === true` state, no trail is rendered for
  any visible satellite (per
  [Accessibility & Motion](./contracts.md#accessibility--motion)).

Validation evidence:

- V3 in `npm run validate:vc3c:orbit-trail`. Forced fixture with three
  visible satellites; sample five points per trail; assert color,
  length, monotonicity.
- A `reducedMotion = true` fixture asserts the trail layer renders
  zero `BufferGeometry` instances.

---

## Phase 3D: Serving Ground Ripple

Add a periodic expanding ring at the ground center of the serving beam,
so a zenith-camera observer can locate the active link instantly without
parsing any cone or callout. This is a strong pre-attentive emphasis
cue that does not compete with role color, satellite tint, or frequency
color because it uses the *radius-over-time* channel.

Scope:

- A new `ServingGroundRipple` component renders one or two concentric
  ring primitives at the serving beam's ground center. Rings expand
  from radius `0` to `1.6 × footprintRadius` over `1.6 s`, fade to
  opacity `0` at the outer radius, and respawn on a `2.0 s` cycle (so
  two rings are in-flight at staggered phases).
- Ring stroke color = `BEAM_ROLE_TOKENS.serving.color` (serving yellow); the
  ripple is thus a "louder" extension of the existing serving role
  channel and reads consistently with the rest of the serving palette.
- Render gated to:
  - `runtime.effectsEnabled.servingRipple === true` (see
    [Mode & Density Plumbing](./contracts.md#mode--density-plumbing)).
  - Disabled when `paused = true`.
  - Disabled when `runtime.reducedMotion === true`.
  - Disabled during recent-HO linger (the ripple would imply the old
    serving is still active; recent-HO uses its own faded source visual).
- A second, smaller ripple variant for `pending`, gated by
  `runtime.effectsEnabled.pendingRipple` (independent flag from
  `servingRipple`; see
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing)
  default mapping — both default to `true` in `presentation` mode and
  `false` elsewhere). Uses `BEAM_ROLE_TOKENS.pending.color` with a
  `3.0 s` cycle and softer amplitude than the serving ripple, so
  pending reads as "preparing" not "active". Independent gating means
  an operator can disable the pending variant alone while keeping the
  serving ripple, or vice versa.

Non-goals:

- No ripple for `approach`, `recentSource`, `otherActive`, or
  `inactive`. The ripple is reserved for the two strongest event roles
  to keep its meaning clean.
- No physical interpretation. The ripple is purely a visual emphasis
  cue. Ripple radius and period have no relationship to data rate,
  packet rate, or any simulator quantity.
- No GPU instancing required; one or two ring meshes per role is cheap.

Implementation guidance:

- Use `ringGeometry(innerRadius, outerRadius, segments)` and animate
  the `scale` of the ring mesh in `useFrame`. Re-creating geometry per
  frame is unnecessary.
- Phase the two in-flight rings by half a cycle so the ground always
  shows at least one visible ring.
- Stop the `useFrame` loop when paused or when serving is `null` so it
  does not consume budget when invisible.

Touched files:

- `src/viz/ServingGroundRipple.tsx` — new component.
- `src/scene/MainScene.tsx` — render gated on presentation mode and
  serving presence.
- `scripts/validate-vc3d-serving-ripple.tsx` — V3 validation.
- `package.json` — register `validate:vc3d:serving-ripple`.

Acceptance:

- In presentation mode running un-paused with a defined serving beam,
  the serving disc center shows a continuously expanding serving-color
  ring.
- In tuning, diagnostics, paused, recent-HO, or `reducedMotion` states,
  no ripple is rendered.
- Ripple does not occlude the serving disc fill, glyph, or callout (use
  additive blending and depth-write disabled).

Validation evidence:

- `npm run validate:vc3d:serving-ripple` asserts gating behavior with
  forced state and confirms ripple radius envelope at three sample
  times.

---

## Phase 3E: Spotlight Fog Mode (optional, presentation-only)

Add a presentation-only "spotlight" mode that drops the entire scene
into a dimmed, lightly fogged baseline and then lifts that fog only
over the serving + pending event regions, so a non-technical audience's
eye is guided to the handover story without any text instruction.

This slice is **explicitly opt-in**, not the default for presentation
mode, because aggressive fog/dimming is a strong stylistic choice that
some operators (and many research demos) will not want. See
[Open Question 7](./README.md#open-questions).

Scope:

- `RuntimeConfig.cinematicMode: 'off' | 'spotlight'` flag, defaulting
  to `'off'` for all profiles. Only togglable from a presentation
  preset or a `ControlBar` switch added in
  [Phase 4C](./phase-4-panel-restructure.md#phase-4c-controlbar-density-slider--camera-preset).
- When `cinematicMode === 'spotlight'`:
  - Apply a global `fog` to the scene with low density and a near-black
    color (re-using `MainScene.tsx`'s existing `radial-gradient`
    background palette).
  - Reduce the intensity of `hemisphereLight`, `ambientLight`, and
    `directionalLight` by `0.6×`.
  - Add two new `pointLight` sources at the serving disc and pending
    disc, each colored with the matching role accent and high
    intensity, that locally restore brightness in the event regions.
  - Apply a **runtime opacity multiplier of `0.5`** to the rendered
    `cone.fill` of `otherActive` and `inactive` beams, so non-event
    beams visually "fade into the fog". The multiplier is applied in
    `SatelliteBeams.tsx` at render time by reading
    `runtime.cinematicMode` and multiplying the resolved cone opacity
    by `0.5` when in spotlight; **the underlying `BEAM_ROLE_TOKENS`
    constants are NOT mutated** (mutating module-level constants
    would corrupt the off-mode brightness-baseline acceptance below
    and is forbidden by the Three-Tier Contract's role-token
    immutability).
- All other modes (`off`, the default) leave lighting and fog untouched
  — the simulator looks exactly as today.

Non-goals:

- No camera change. Spotlight is a lighting/fog effect, not a camera
  effect.
- No post-processing pipeline. Plain Three.js fog and lights only.
- No spotlight on `approach` or `recentSource`. Those remain visible
  but fade into the cinematic dimming because the focus is the active
  duel.
- This mode is not a substitute for Phase 1B density floor. Both can be
  on simultaneously: density floor removes ambient cones; spotlight
  dims whatever remains.

Implementation guidance:

- The two event spotlights' positions update each frame with the
  serving and pending disc world coordinates; light targets stay at the
  disc center.
- Light intensity should be high enough to lift the disc + glyph +
  callout back to "no-fog readability" but not so high that the rest of
  the scene becomes pitch black.
- Validate at `1440x900` and `1366x768` that text in the duel card
  ([Phase 4A](./phase-4-panel-restructure.md#phase-4a-infopanel-duel-card))
  remains readable when spotlight is on; UI is rendered above the WebGL
  canvas so fog should not affect it, but visual contrast may still
  drop.

NTPU model fog policy:

The campus model loaded by `NTPUScene.tsx` converts every existing
`MeshBasicMaterial` to `MeshStandardMaterial` (lines 19–38). Standard
materials respect Three.js scene fog by default, which means the campus
model **will be affected** by `cinematicMode = 'spotlight'`. The
implementing slice must decide whether the campus model fades into fog
along with non-event beams (preferred for storytelling: viewer
attention narrows) or stays unaffected (preserves geographic anchor):

- Decision: **campus model accepts fog**. The two event spotlights
  still illuminate the campus locally near the serving / pending discs,
  so the ground beneath the active link remains crisp. The rest of the
  campus fades along with non-event beams — the cinematic intent is
  "isolate the link", and an over-bright campus contradicts that.
- Implementation: do not set `material.fog = false` on the campus
  meshes. Default behavior is correct.
- Starfield (`src/components/ui/Starfield.tsx`) is HTML CSS, not WebGL,
  so fog does not affect it. No change required there.

Off-mode acceptance (deterministic-screenshot caveat):

The original SDD claimed `cinematicMode = 'off'` matches the
pre-Phase-3E scene "pixel-for-pixel". This is **not achievable**
because `Starfield` uses `Math.random()` per render to place stars
(`Starfield.tsx` lines 17–25), so any two renders differ in star
positions even with no other change.

Replace pixel-for-pixel acceptance with:

- Average scene brightness at sampled non-Starfield regions (campus
  ground, beam disc area, beam cone area) differs by less than `±0.02`
  normalized between off-mode-before-Phase-3E and
  off-mode-after-Phase-3E.
- For deterministic screenshots, V3 validation must seed `Math.random`
  at a stable value before mounting (per
  [Validation Tiers](./contracts.md#validation-tiers) hard rules).

Touched files:

- `src/scene/types.ts` — `RuntimeConfig` gains `cinematicMode` (already
  declared in
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing)).
- `src/scene/MainScene.tsx` — conditional fog, light intensity, and
  event spotlights; passes `runtime.cinematicMode` down to
  `<SatelliteBeams>` (or its render context) so the cone-opacity
  multiplier can read it.
- `src/viz/SatelliteBeams.tsx` — apply the `0.5×` runtime opacity
  multiplier to `cone.fill` for `otherActive` and `inactive` roles
  when `runtime.cinematicMode === 'spotlight'`. **No mutation of
  `BEAM_ROLE_TOKENS`.**
- `src/components/scene/NTPUScene.tsx` — verify no
  `material.fog = false` override exists; add comment that fog is
  intentionally accepted.
- `src/ui/ControlBar.tsx` — toggle (added jointly with Phase 4C).
- `scripts/validate-vc3e-spotlight-fog.tsx` — V3 brightness-region
  validation.
- `package.json` — register `validate:vc3e:spotlight-fog`.

Acceptance:

- With `cinematicMode = 'spotlight'`: average brightness in non-event
  campus regions drops by ≥ `0.4` normalized; sampled brightness at
  serving and pending disc centers stays within ±0.05 of pre-mode
  brightness (event regions remain "lit").
- With `cinematicMode = 'off'`: campus and beam region brightness
  differ by < `±0.02` from the pre-Phase-3E baseline reference
  screenshot (under seeded `Math.random`).
- Toggling between modes does not require reload or restart of
  simulation.

Validation evidence:

- V3 in `npm run validate:vc3e:spotlight-fog` with seeded
  `Math.random`. Browser portion at `1440x900` and `1366x768`. Confirms
  the duel card
  ([Phase 4A](./phase-4-panel-restructure.md#phase-4a-infopanel-duel-card))
  text remains legible (contrast ≥ AA).
