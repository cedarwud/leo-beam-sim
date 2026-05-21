# Phase 2 — Non-Text Identity Channels

> Part of the [Visual Clarity & Story-Readability SDD](./README.md). For
> the cross-cutting rules this phase obeys, see
> [`contracts.md`](./contracts.md):
> [Validation Tiers](./contracts.md#validation-tiers),
> [Mode & Density Plumbing](./contracts.md#mode--density-plumbing)
> (Phase 2D consumes `runtime.reducedMotion` and the `ControlBar`
> override surface),
> [Three-Tier Visual Contract](./contracts.md#three-tier-visual-contract),
> [Accessibility & Motion](./contracts.md#accessibility--motion),
> [Performance Budget](./contracts.md#performance-budget),
> [Cross-cutting Conventions](./contracts.md#cross-cutting-conventions).
>
> [Phase 1](./phase-1-identity-first.md) closes the *can the operator
> read it* gap. Phase 2 closes the *can the operator see it without
> reading* gap. The four channels in this phase are designed to be
> additive on top of Phase 1; if a future agent disables them, the text
> identity from Phase 1 still answers all four story questions, just more
> slowly.
>
> Theme: *make the eye trace beam → satellite without reading text.*

Slices:

- [Phase 2A: Satellite Spine Tint](#phase-2a-satellite-spine-tint)
- [Phase 2B: Endpoint Glyph Shapes](#phase-2b-endpoint-glyph-shapes)
- [Phase 2C: Satellite Body Tint](#phase-2c-satellite-body-tint)
- [Phase 2D: Dash Channel Reassignment & Role Pulses](#phase-2d-dash-channel-reassignment--role-pulses)

---

## Phase 2A: Satellite Spine Tint

Make the spine line from each satellite to its beam endpoint visually
anchored to the satellite, not to the role or frequency. The disc gains a
satellite-tinted **outer ring** (per the Three-Tier Contract channel
registry: `disc.outerRing` belongs to T2; see
[Channel registry](./contracts.md#channel-registry)).

Palette contrast budget:

The four palette entries below are anchors. The implementing slice must
verify (V1 unit invariant) that on the existing `MainScene` background
(`radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)`) the
following hold:

1. Pairwise CIE76 ΔE between any two palette entries ≥ `12`.
2. Relative luminance contrast ratio against background ≥ `3.0` (WCAG AA
   non-text minimum).
3. Pairwise CIE76 ΔE between any palette entry and any of the role
   accents (`serving #facc15`, `pending/target #38bdf8`, `approach #34d399`,
   `recent-source #fde68a`) ≥ `15`.
4. Pairwise CIE76 ΔE between any palette entry and any of the
   `BEAM_FREQUENCY_COLORS` entries ≥ `15`.

Anchor palette (the implementing slice must adjust if invariants 1–4
fail):

- `'#FFFFFF'` pure white
- `'#F2D7A0'` warm sand (replaces previous `#F2EFE5` which was too close
  to the warm white range; `#F2D7A0` is a low-saturation amber-adjacent
  that pulls clearly away from serving yellow)
- `'#D9B6E8'` muted lilac (replaces `#D6CCFF` which is too saturated for
  the low-emphasis satellite-tint channel; `#D9B6E8` shifts toward
  magenta-grey)
- `'#86C7B6'` mint-grey (replaces `#A4D9FF` which sits too near the
  high-emphasis role palette; `#86C7B6` is a desaturated cyan-green kept
  away from the role-dominant channels)

The `#FFFFFF` entry is reserved for the serving satellite when satellite
counts ≤ 4, because pure white plus the serving-yellow role ring reads as
the strongest "active link" cue.

If invariants 1–4 still cannot be satisfied at four colors, the SDD's
fallback ([Open Question 5](./README.md#open-questions)) downgrades
spine-tint to a secondary channel and promotes glyph (Phase 2B) to be
the primary satellite identity channel. Phase 2A's V1 invariant test is
the gate that triggers fallback.

Scope:

- Add `SATELLITE_TINT_PALETTE: readonly string[]` to
  `src/constants/beamRoleTokens.ts` with the four anchor colors.
- Add `satelliteTint(satId: string, displayOrder: number): string` helper
  that returns a palette entry; the mapping reuses the existing
  `previousDisplayIdsRef` pattern in `useBeamViz` for stability.
- Extend `BeamTarget` (defined in `src/viz/SatelliteBeams.tsx:11-24`;
  imported into `src/scene/types.ts:5` for `VizFrame.satBeams` typing
  but **not** re-exported — type ownership stays in
  `SatelliteBeams.tsx`) with `satelliteTintColor: string`.
- Split `cone.spine` in `SatelliteBeams.tsx` into two co-linear `<Line>`s
  per the
  [Three-Tier Contract](./contracts.md#three-tier-visual-contract):
  - `spine.outer`: satellite tint, width = `style.lineWidth + 1`.
  - `spine.inner`: role color (or frequency color for non-event roles),
    width = `style.lineWidth - 1`.
- Add `disc.outerRing` ring outside the existing disc radius using
  `ringGeometry(footprintRadius, footprintRadius + 2px-equivalent,
  segments)`. Color = satellite tint. Render order above disc fill but
  below endpoint.
- Add `disc.innerRoleRing` ring **inside** the disc radius, **drawn
  only for event-role beams** (serving / pending / approach /
  recentSource), using `ringGeometry(footprintRadius - 3px-equivalent,
  footprintRadius - 1px-equivalent, segments)`. Color = role color.
  This T1 ring closes the `disc.innerRoleRing` channel registered at
  [contracts.md Channel registry](./contracts.md#channel-registry);
  prior drafts declared the channel but no slice owned it. The ring
  reinforces role identity on the disc surface without polluting
  `disc.fill` (which remains T3 frequency at low opacity per Phase 1C).
  For non-event roles, the inner role ring is **not** rendered.

Non-goals:

- No tinting of the satellite GLB model (Phase 2C).
- No glyph at the endpoint (Phase 2B).
- Satellite tint is **never** applied to `cone.fill`, `disc.fill`,
  `cell.fill`, `endpoint.color`, or any other T1/T3 surface. (See
  [Forbidden cross-use #6](./contracts.md#forbidden-cross-uses-validated-as-invariants),
  the source-side restriction added to enumerate this rule.)
- Palette is fixed at four entries. If the visible satellite set exceeds
  four, the lowest-priority surviving satellites share an index and the
  spine-tint identity becomes ambiguous;
  [Phase 1](./phase-1-identity-first.md) text identity and Phase 2B
  glyph remain authoritative.

Implementation guidance:

- The dual-line spine is two `<Line>` instances at the same world
  coordinates; depth-sort puts outer behind inner via `renderOrder`.
- Compute the satellite-to-tint mapping inside `useBeamViz` and surface
  it on each `BeamTarget`.

Touched files:

- `src/constants/beamRoleTokens.ts` — `SATELLITE_TINT_PALETTE`, helper
  `satelliteTint(...)`.
- `src/viz/SatelliteBeams.tsx` — `BeamTarget` interface gains
  `satelliteTintColor`; dual spine line; disc outer ring.
- `src/scene/types.ts` — no change required. The existing
  `import type { BeamTarget } from '../viz/SatelliteBeams'` line at
  line 5 imports `BeamTarget` for use in `VizFrame.satBeams` typing;
  it does not re-export, and this slice does not need to. Type
  ownership remains in `SatelliteBeams.tsx`.
- `src/scene/useBeamViz.ts` — assign palette index per visible satellite;
  populate `satelliteTintColor`.
- `scripts/validate-vc2a-spine-tint.ts` — V1 palette invariant test
  + V3 browser pixel test.
- `package.json` — register `validate:vc2a:spine-tint`.

Acceptance:

- V1 (palette invariants 1–4): pass without any color drift.
- V3 (browser): in a forced fixture with three visible satellites, the
  rendered spine line at sampled coordinates contains a band whose color
  is within ΔE ≤ 5 of the expected palette entry; inner-spine band
  matches the role color band within ΔE ≤ 5.
- The disc outer-ring color matches the spine outer color for the same
  beam (V3 pixel sample).
- Palette assignment is stable across consecutive frames when the
  visible-sat set is unchanged (V1 invariant on the assignment helper).

Validation evidence:

- V1 + V3 in `npm run validate:vc2a:spine-tint`. Browser portion at
  `1440x900` and `1366x768`. Screenshots include reduced-motion mode
  fixed.

---

## Phase 2B: Endpoint Glyph Shapes

Add a small geometric glyph at the ground end of each beam that varies by
satellite, so the operator can identify ownership in grayscale and at
small zoom levels where text is unreadable.

Scope:

- Add a `SATELLITE_GLYPH_LIBRARY` of four glyphs to a new
  `src/viz/glyphs.ts`:
  - `'triangle'` — `triangleGeometry` shape, base side `r/2`
  - `'diamond'` — rotated square shape
  - `'circle'` — keeps the existing `sphereGeometry`-derived appearance
    for backward compatibility
  - `'star'` — five-pointed star shape
- Glyph assignment uses the same satellite → palette index mapping as
  Phase 2A so the spine tint, disc ring, and glyph share a satellite
  identity.
- Replace the existing endpoint sphere in `SatelliteBeams.tsx` with the
  satellite-specific glyph; preserve `style.endpointRadius`,
  `style.endpointFilled`, `style.endpointOpacity`.
- The role-determined `endpointFilled` flag still controls solid vs
  hollow rendering. A hollow glyph is rendered as a stroke-only outline
  of the glyph shape with no fill.

Non-goals:

- Glyphs are drawn flat on the ground plane (`y ≈ 5`); they are not 3D
  extrusions.
- No glyph on the satellite body (that is Phase 2C tinting).
- Glyph shape never encodes role; it only encodes satellite. Role still
  uses size, fill, and opacity.

Implementation guidance:

- Each glyph geometry should be cached by satellite-tint index, not by
  satId, so the geometry pool stays at four entries.
- Glyph fill color reads from the existing `style.color` (role color),
  so a hollow ▲ in serving yellow reads as "serving + sat A".
- A small Unicode glyph copy (▲ ◆ ● ★) is also placed inline inside the
  callout text from Phase 1A, immediately after the satellite chip.
  This echo lets the operator match scene-glyph to callout-glyph
  without moving their gaze. The inline glyph is text, not a 3D
  primitive, so it does not affect rendering cost. See
  [Cross-cutting Conventions / Unicode glyph font](./contracts.md#cross-cutting-conventions)
  for the font fallback policy.

Touched files:

- `src/viz/glyphs.ts` — new file, glyph geometry factory.
- `src/viz/SatelliteBeams.tsx` — `BeamTarget` interface gains
  `satelliteGlyph: GlyphKind`; endpoint render swaps sphere for glyph;
  callout text prepends the inline Unicode glyph.
- `src/scene/useBeamViz.ts` — populates glyph kind from the same palette
  assignment used in Phase 2A.
- `src/ui/InfoPanel.tsx` — duel card identity rows also prepend the
  inline glyph so panel ↔ scene matching works on glyph alone.
- `scripts/validate-vc2b-endpoint-glyph.ts` — V1 (glyph mapping) + V3
  (silhouette) validation script.
- `package.json` — register `validate:vc2b:endpoint-glyph`.

Inline Unicode glyph fallback:

- Browsers render `▲ ◆ ● ★` from system fonts; rendering varies. SDD
  requires the implementing slice to bundle the glyph as text inside an
  inline-block span with `font-family` falling back to a known-stable
  monospace and `font-feature-settings` disabling color emoji
  substitution. Validation must include an i18n fallback case where the
  primary font fails to load.

Acceptance:

- For each of four satellites in a forced fixture, the endpoint glyph is
  visually distinct in a grayscale screenshot.
- For event-role beams, glyph fill follows role color; for hollow roles
  (e.g. approach), glyph appears as outline only.
- Glyph size at `1440x900` is at least `12 px` on screen at the default
  camera distance.
- A V3 text fallback fixture (`font-display: block` with the primary
  font deliberately failed) still renders distinct inline glyph
  silhouettes for `▲ ◆ ● ★`, per
  [Cross-cutting Conventions / Unicode glyph font](./contracts.md#cross-cutting-conventions).

Validation evidence:

- `npm run validate:vc2b:endpoint-glyph` asserts glyph kind matches the
  satellite-tint index assigned by Phase 2A's palette logic.
- Grayscale screenshot capture: a per-glyph perceptual diff threshold
  >= 8% pixel difference between any two glyphs for the same role.
- Font-fallback fixture screenshot at `1440x900` confirms the four
  inline Unicode glyphs remain pairwise distinguishable when the
  primary font is unavailable.

---

## Phase 2C: Satellite Body Tint

Tint the satellite GLB body so the apex of every beam visually anchors
to a satellite identity, completing the visual chain spine-color →
disc-ring-color → glyph-color → satellite-body-color.

Scope:

- Update `SatelliteMarker.tsx` to clone the GLB scene per visible
  satellite and override the `MeshStandardMaterial` color with the
  satellite-tint palette color from Phase 2A.
- Adjust the existing `pointLight` color so the marker's local glow
  matches the satellite tint (currently it uses role color).

Non-goals:

- No new GLB models, no new model variants per satellite.
- The role-driven `markerScale` and `markerLightIntensity` still apply.
- Satellites outside the four-tint palette window keep the default
  `meshStandardMaterial` color (untinted).

Implementation guidance:

- Cache the cloned and tinted scene by satellite-tint index (same
  caching shape as glyph cache). Re-cloning per frame is too expensive.
- Tint must use a low alpha-blend so the GLB's existing material detail
  remains readable; satellite tints are off-whites by design (Phase 2A)
  so the tint should not visually overpower the model.

Touched files:

- `src/viz/SatelliteMarker.tsx` — accept new `satelliteTintColor` prop;
  material override based on tint.
- `src/scene/types.ts` — `VisibleSat` exposes the tint color from the
  Phase 2A assignment for marker reading.
- `src/scene/useBeamViz.ts` — tint is part of `displaySats` payload.
- `src/scene/MainScene.tsx` — pass `satelliteTintColor` to
  `<SatelliteMarker>`; current call site at lines 698–704 only passes
  `position`/`label`/`eventRole`, so the prop must be threaded through.
- `scripts/validate-vc2c-satellite-tint.ts` — V3 perceptual diff script.
- `package.json` — register `validate:vc2c:satellite-tint`.

Acceptance:

- For four visible satellites, each GLB body has a visibly different
  overall tint in a screenshot.
- Marker text label color (already from `tokenForEventRole(...)`) is
  unchanged.
- `pointLight` color shifts to satellite tint without changing intensity
  rules.

Validation evidence:

- `npm run validate:vc2c:satellite-tint` performs perceptual comparison
  between GLB rendered images for two consecutive satellite tint palette
  entries.

---

## Phase 2D: Dash Channel Reassignment & Role Pulses

The existing `BEAM_ROLE_TOKENS` (current state at
`src/constants/beamRoleTokens.ts:50-165`) sets `dashed = true` on
`pending`, `approach`, `recentSource`, and `inactive`. Dash thus encodes
"any non-static role" plus "off-slot", which violates the Three-Tier
Contract's channel ownership (dash is currently shared across multiple
T1 states; see
[Forbidden cross-use #5](./contracts.md#forbidden-cross-uses-validated-as-invariants)).

This slice **commits to a single meaning for dash**: `dash = inactive
role`. All other currently-dashed roles flip to `dashed = false` and
gain a role-specific pulse pattern instead.

This is a token-level breaking change. The existing
`scripts/validate-phase2d-forced-role-state-visuals.ts` asserts
`pending.dashed === true` and `recentSource.dashed === true` (lines
175–190); those assertions must be updated as part of this slice.

Scope:

- Update `BEAM_ROLE_TOKENS` token table:
  - `serving`: `dashed = false` (unchanged), `pulse = 'none'`.
  - `pending`: **`dashed = false`** (changed), `pulse = 'breathe'`
    (period `2.4 s`, amplitude `0.06`).
  - `approach`: **`dashed = false`** (changed), `pulse = 'pulse'`
    (period `1.4 s`, amplitude `0.05`).
  - `recentSource`: **`dashed = false`** (changed), `pulse = 'fade'`
    (monotonic linger fade over the recent-HO window, not periodic).
  - `otherActive`: `dashed = false` (unchanged), `pulse = 'none'`.
  - `inactive`: `dashed = true` (unchanged) — sole owner of dash channel.
- Off-slot variants (when a serving or pending beam is not active in the
  current beam-hopping slot) **keep dashed = true** as a temporary state
  override; this is a *state-level* dash, not a *role-level* dash, and
  the Three-Tier Contract permits it because the off-slot dashing has no
  steady-state meaning to compete with.
- Add `pulse: 'none' | 'breathe' | 'pulse' | 'fade'` field to the role
  token interface.
- Implement pulse animation in `SatelliteBeams.tsx` via a single
  `useFrame` clock that all beams read; avoid per-beam state updates.

Non-goals:

- No new role.
- `serving` does not pulse. The serving channel must remain visually
  stable to avoid implying instability of the live link.
  ([Phase 3D](./phase-3-ground-cinematic.md#phase-3d-serving-ground-ripple)
  adds a *separate* ground-ripple cue that is not on the cone material.)
- No change to color, opacity static value, or line width of any role.
  Pulse is purely an opacity-modulation overlay.
- No change to off-slot dash logic.

Implementation guidance:

- Pulse uses `useFrame` in `BeamCone` to nudge a
  `meshBasicMaterial.opacity` ref. Avoid React state updates per-frame.
- All beams of the same role share phase, so pending beams across
  multiple satellites breathe in unison; this reads as a coordinated cue
  rather than chaotic flicker.
- `prefers-reduced-motion` (see
  [Accessibility & Motion](./contracts.md#accessibility--motion))
  collapses every pulse to its static opacity; pulse is purely additive
  and removable without any other behavior change.

Touched files:

- `src/constants/beamRoleTokens.ts` — flip `dashed` for pending /
  approach / recentSource; add `pulse` field; update token table.
- `src/viz/SatelliteBeams.tsx` — `useFrame` pulse hook reading
  `runtime.reducedMotion` to skip animation when set.
- `scripts/validate-phase2d-forced-role-state-visuals.ts` — **update
  existing harness**: change assertions from
  `pending.dashed === true` to `pending.dashed === false`; add new
  pulse-pattern assertions on the token table; the V3 pulse-envelope
  visual portion is added under a new
  `validate:vc2d:role-pulse-envelopes` script.
- `scripts/validate-vc2d-role-pulse-envelopes.ts` — new V3 browser
  validation: capture screenshots at three time offsets per role and
  assert the opacity envelope follows the declared pulse pattern within
  ±0.02 absolute opacity.
- `package.json` — register `validate:vc2d:role-pulse-envelopes`.

Acceptance:

- `pending`-role beam renders **solid** (not dashed) in a forced fixture
  and exhibits a 2.4 s breathing opacity cycle.
- `approach`-role beam renders solid and exhibits a 1.4 s pulse cycle.
- `recentSource` beam renders solid and fades monotonically over the
  recent-HO linger window.
- `inactive` beam still renders dashed; no pulse.
- Existing `validate:phase2d:forced-role-state-visuals` script (with
  updated assertions) continues to pass.
- New `validate:vc2d:role-pulse-envelopes` browser script passes.
- Setting `runtime.reducedMotion = true` collapses all pulses to static
  opacity; assertion: pixel sampling at three different time offsets
  yields the same color value.

Validation evidence:

- V1 + V3 across both scripts.
