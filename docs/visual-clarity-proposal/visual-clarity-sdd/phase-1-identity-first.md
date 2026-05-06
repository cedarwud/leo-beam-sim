# Phase 1 — Identity-First (Text)

> Part of the [Visual Clarity & Story-Readability SDD](./README.md). For
> the cross-cutting rules this phase obeys, see
> [`contracts.md`](./contracts.md):
> [Validation Tiers](./contracts.md#validation-tiers),
> [Mode & Density Plumbing](./contracts.md#mode--density-plumbing),
> [Three-Tier Visual Contract](./contracts.md#three-tier-visual-contract),
> [Cross-cutting Conventions](./contracts.md#cross-cutting-conventions).
>
> Phase 1 fixes the satellite-attribution gap with **only text changes**
> and **density reductions**. It introduces no new color, no new geometry,
> no new material. It is the cheapest, lowest-risk slice and is required
> for [Phase 2](./phase-2-non-text-channels.md) to build on.
>
> Theme: *the operator can already read it; they just can't see it yet.*

Slices:

- [Phase 1A: Live Legend Identity](#phase-1a-live-legend-identity)
- [Phase 1B: Presentation Density Floor](#phase-1b-presentation-density-floor)
- [Phase 1C: Frequency Color Demotion](#phase-1c-frequency-color-demotion)
- [Phase 1D: Identity Match Harness](#phase-1d-identity-match-harness)

---

## Phase 1A: Live Legend Identity

Lock down a single satellite-identity string that scene callouts and right
panel rows both use, so the operator can eye-match between them.

Canonical identity format:

The canonical string format reuses `formatSatelliteLabel()`'s **existing**
output (with `-` as the satellite-segment separator and the existing shell
prefix dispatch: `G` for prograde, `R` for retrograde, `P` for polar, etc.,
defined at `src/utils/formatSatelliteLabel.ts:1-30`). Only the joiner
between the satellite tag and the beam tag is new, using `·`:

```
{shellCode}-{plane2digit}-{sat2digit} · F{freqIndex+1} B{beamId}
```

Worked examples:

- prograde shell `pro53`, plane 0, sat 3, beamId 5, freqReuse 3 →
  `G53-01-04 · F2 B5`
- retrograde shell `retro000`, plane 4, sat 10, beamId 11, freqReuse 4 →
  `R000-05-11 · F3 B11` (because
  `getBeamFrequencyIndex(11, 4) = (11 - 1) % 4 = 2` → label `F3`; see
  `src/utils/beamFrequency.ts:6-17`)
- polar shell, plane 0, sat 3, beamId 5, freqReuse 3 →
  `P090-01-04 · F2 B5`

The third proposal's earlier example (`R053·01·04 · F2 B5`) used dots
inside the satellite tag; that was incorrect and is rejected. **The
satellite tag keeps `-` as its internal separator.** Only the satellite
↔ beam joiner is `·`.

Scope:

- Add a helper `formatBeamIdentity({ satId, beamId, frequencyReuse })` to
  `src/utils/formatSatelliteLabel.ts`. The helper computes
  `frequencyIndex` via existing `getBeamFrequencyIndex(beamId, frequencyReuse)`
  in `src/utils/beamFrequency.ts`, then composes the canonical string.
  `frequencyReuse` is read from `profile.beams.frequencyReuse`. Callers
  that already have `frequencyIndex` may use the
  `formatBeamIdentityByIndex({ satId, beamId, frequencyIndex })` overload.
- Update `src/viz/SatelliteBeams.tsx` so every beam callout renders the
  satellite owner-tag chip on its first line and the role+identity string
  on its second line:
  - Line 1 (chip): `G53-01-04` in role accent color
  - Line 2: `SERVING · F2 B5` (or the role-appropriate banner) when role
    is set; `F2 B5` only when role is absent.
  - Line 3 (existing): SINR readout `18.4 dB`.
- Update `src/viz/HandoverLinks.tsx` so handover-link text uses the same
  canonical identity string instead of the current
  `[role.operatorLabel] [F# B#]` mash-up.
- Update `src/viz/SatelliteMarker.tsx` so the satellite text label uses
  the same short-form satellite tag (already produced by
  `formatSatelliteLabel`).
- Update `src/ui/InfoPanel.tsx` `ACTIVE SERVING` and `PENDING TARGET`
  blocks so the satellite + beam line uses `formatBeamIdentity(...)` with
  the active `profile.beams.frequencyReuse`, and reads identical to what
  the scene shows. The current
  `${formatSatelliteLabel(servingSatId)} ${formatBeamLabel(servingBeamId)}` →
  `G53-01-04 Beam 5` line becomes `G53-01-04 · F2 B5`.
- Add the same canonical identity string to handover trigger and recent-HO
  copy in `InfoPanel`.

Non-goals:

- No color changes to callout, satellite marker, panel cards, or hex grid.
- No geometry changes (no glyphs, no spine tinting, no GLB tinting).
- No `BEAM_ROLE_TOKENS` field additions; rendering keeps reading from the
  existing tokens.
- No density change to the displayed beam set; that is Phase 1B.
- No changes to `useBeamViz` selection, ranking, or approach lookahead.
- No change to `formatSatelliteLabel`'s output format. The satellite tag
  must remain `-`-separated to avoid breaking existing screenshots,
  validations, and documentation that quote `R053-01-04` form.

Implementation guidance:

- The owner-tag chip is a short text element rendered inside the existing
  `Html` callout container. Reuse the existing role border color so the
  chip remains visually anchored to the role.
- `formatBeamIdentity` must accept a `null` satId and return `'— · F# B#'`
  for non-event-role beams that lack a stable satellite reference, so the
  helper is safe to call from every code path that already builds a beam
  label.
- `InfoPanel` does not currently have access to `frequencyReuse`. The
  slice must thread `profile` (already passed; see
  `InfoPanel.tsx:472-516`) into the identity rendering call site.

Touched files:

- `src/utils/formatSatelliteLabel.ts` — add `formatBeamIdentity` and
  `formatBeamIdentityByIndex`.
- `src/utils/beamFrequency.ts` — no change; consumed by the helper.
- `src/viz/SatelliteBeams.tsx` — callout three-line layout.
- `src/viz/HandoverLinks.tsx` — link text uses canonical identity.
- `src/viz/SatelliteMarker.tsx` — text label uses short-form tag (likely
  already correct; verify).
- `src/ui/InfoPanel.tsx` — serving / pending / recent-HO copy uses
  canonical identity; thread `frequencyReuse` from `profile.beams`.
- `scripts/validate-vc1a-live-legend.tsx` — new V2 SSR validation script.
- `package.json` — register `validate:vc1a:live-legend`.

Acceptance:

- Every event-role beam callout in the 3D scene starts with a satellite
  owner-tag chip whose string equals the output of
  `formatSatelliteLabel(satId)`.
- Every right-panel row referring to a beam emits a string equal to
  `formatBeamIdentity({ satId, beamId, frequencyReuse })` (string equality
  via `assert.equal`, not paraphrase).
- For a forced fixture with three event roles plus one ambient beam, the
  V2 SSR harness asserts every event-role callout's identity line and
  every panel row referring to a beam emit identical strings to the
  helper's output.
- The Phase 2D forced-role-state harness remains green:
  `npm run validate:phase2d:forced-role-state-visuals` passes.
- `npm run lint` and `npm run build` pass.

Validation evidence (V2 SSR):

- `npm run validate:vc1a:live-legend` (V2) renders fixtures via
  `renderToStaticMarkup` for both `<SatelliteBeams .../>` (in a test
  scaffold that bypasses R3F by stubbing the cone/disc and just exposing
  the `Html` callout) and `<InfoPanel .../>`, decodes HTML to text, and
  asserts pairwise string equality.
- No browser validation required for this slice.

---

## Phase 1B: Presentation Density Floor

Aggressively reduce the number of simultaneously rendered beams in
`event-only` / `event-plus-1` density tiers so the four story questions
can be answered without the operator having to filter the scene by eye.

This slice respects the existing `MAX_BEAM_SATS = 3` cap on cone-rendering
satellites (`src/scene/useBeamViz.ts:11`); it does **not** raise it.
Cones remain on at most 3 satellites. Ambient *rings* are the cheaper
render path that may extend beyond `beamSatIds`.

Definitions:

- A **cone-beam** renders the full apex→ground cone, spine line, disc
  fill, endpoint, and callout. Cone-beams live only on `beamSatIds`.
- An **ambient ring** renders only a thin outline at the ground footprint
  position. No cone, no spine, no callout. Ambient rings are cheap and
  may exist for any visible satellite, not just `beamSatIds`.
- A **viewport-aware hard cap** limits total cone-beam callouts on screen
  (because callouts use `Html` overlays which layout-cost is non-trivial).

Density tiers (driven by `RuntimeConfig.beamDensity`, see
[Mode & Density Plumbing](./contracts.md#mode--density-plumbing)):

| Tier | Cone-beams (within `beamSatIds`) | Ambient rings (visible sats outside `beamSatIds`) | Cone-beam callout cap |
|---|---|---|---|
| `event-only` | event-role primary beams only (serving, pending, approach, recent-HO source) | none | 4 |
| `event-plus-1` | event-role primaries + at most 1 highest-SINR active ambient beam per satellite still inside `beamSatIds` | one ring per remaining visible satellite | 6 at `1440x900`, 4 at `1366x768` and below |
| `all` | existing behavior; up to `MAX_BEAMS_PER_SATELLITE` per satellite in `beamSatIds` | none | uncapped |

Scope:

- Add `RuntimeConfig.beamDensity` per
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing).
- Add `useViewport()` hook (or read `window.innerWidth` in `MainScene`)
  and pass a viewport descriptor through `runtime` so `useBeamViz` can
  pick the cone-beam callout cap.
- Update `useBeamViz` to:
  1. Compute the existing `beamSatIds` set as today (capped at
     `MAX_BEAM_SATS = 3`).
  2. For each cone-beam satellite, choose beams to render per the density
     tier above.
  3. Emit a parallel `ambientRings: AmbientRing[]` payload for every
     visible satellite that is **not** in `beamSatIds` (only when tier is
     `event-plus-1`). Each ring carries `(groundX, groundZ,
     footprintRadiusKm, satelliteId, frequencyIndex)`. No ring for
     satellites already in `beamSatIds`; their cone disc serves the same
     visual function.
- Render `ambientRings` from `MainScene.tsx` via a new
  `AmbientFootprintRings` component that draws only `ringGeometry`
  strokes.
- The viewport hard cap is applied **after** event roles are guaranteed.
  Order of preservation when capping: serving > pending > approach >
  recent-HO source > best-SINR active ambient. Exceeding-cap entries
  downgrade to ambient rings (still visible, but no cone or callout).

Non-goals:

- No raising of `MAX_BEAM_SATS` or `MAX_DISPLAY_SATS`. If a density tier
  cannot fit, beams downgrade to rings, never the other way around.
- No changes to `useSimulation`, `engine/`, scheduler, or simulation
  truth. Filtering happens at the viz layer only.
- No new beam roles or token entries.
- No re-ranking of satellites for the central-pass selection. That stays
  driven by `PresentationMode` per existing `centralBiasWeight` logic.

Implementation guidance:

- Phase 1B must not regress Phase 1A. After filtering, all cone-beams
  must still emit the canonical identity callout from Phase 1A. Ambient
  rings have no callout (intentional).
- The ambient ring path is a new component rendering only `ringGeometry`
  strokes — no `Line`, no `mesh` cone, no `Html` callout. Ring color uses
  `BEAM_ROLE_TOKENS.otherActive.color` at opacity floor `0.32` (per the
  Risk Register entry on NTPU model contrast in
  [README](./README.md#risk-register)).
- When the density tier caps ambient ambient-beam count to one per
  satellite, the choice (highest-SINR active beam) must be deterministic
  given the same simulation frame so screenshots are reproducible.

Touched files:

- `src/scene/types.ts` — `RuntimeConfig` gains `beamDensity` (per
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing));
  `VizFrame` gains `ambientRings: AmbientRing[]` and the new
  `AmbientRing` type.
- `src/scene/useBeamViz.ts` — density-tier-aware beam selection; ambient
  ring emission; viewport-aware hard cap.
- `src/viz/AmbientFootprintRings.tsx` — new component, `ringGeometry`
  strokes only.
- `src/scene/MainScene.tsx` — render `AmbientFootprintRings`; pass
  viewport to runtime.
- `src/App.tsx` — derive `beamDensity` from `UiMode` per the
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing)
  default mapping. **Also installs the
  [`prefers-reduced-motion`](./contracts.md#accessibility--motion)
  media-query listener** that writes `runtime.reducedMotion`. When
  `runtime.reducedMotion === true`, App.tsx forces every
  `runtime.effectsEnabled.*` flag to `false` (overriding the UiMode
  default mapping); the override is recomputed on every UiMode change
  and on every `prefers-reduced-motion` media-query event. This is the
  **single source-side wiring** for `reducedMotion`; every animation
  slice (Phase 2D / 3B / 3C / 3D / 4C) consumes the resulting
  `runtime.reducedMotion` and `runtime.effectsEnabled.*` values, but
  none of them install the listener.
- `scripts/validate-vc1b-presentation-density.tsx` — new V2 + V3
  validation script.
- `package.json` — register `validate:vc1b:presentation-density`.

Acceptance:

- `event-only` tier: forced fixture with 6 visible satellites yields at
  most 4 cone-beam callouts (one per active event role).
- `event-plus-1` tier at simulated `1440x900`: forced fixture yields at
  most 6 cone-beam callouts and `n_visible_sats - n_cone_sats` ambient
  rings.
- `event-plus-1` tier at `1366x768`: cap drops to 4 cone-beam callouts;
  excess event-role beams (e.g., recent-HO source) downgrade to ambient
  rings, deterministically by the priority order above.
- `all` tier: behavior is byte-identical to pre-Phase-1B output
  (regression guard).
- **Reduced-motion listener invariant** (V2): App.tsx registers a
  `matchMedia('(prefers-reduced-motion: reduce)')` listener at mount;
  the harness asserts the listener exists, that toggling the mocked
  media query writes `runtime.reducedMotion`, and that
  `runtime.effectsEnabled.{spineParticles,orbitTrail,servingRipple,
  pendingRipple}` are all `false` whenever
  `runtime.reducedMotion === true`, regardless of UiMode.
- **Reduced-motion recovery semantics**: when the media query returns
  to `no-preference` (user toggles OS preference off mid-session),
  `runtime.effectsEnabled.*` is recomputed from the current UiMode
  default mapping (does not stay forced-`false`).

Validation evidence:

- V2 SSR portion: `npm run validate:vc1b:presentation-density` (V2) runs
  `useBeamViz` against forced fixtures and asserts
  `viz.satBeams.size + viz.ambientRings.length` matches expectations per
  tier × viewport combination. This is V2 because `useBeamViz` is a pure
  hook; no rendering required.
- V3 browser portion: a Playwright test loads
  `hobs-2024-candidate-rich` at `1440x900` and `1366x768`, captures
  screenshots in each tier, and asserts the visible callout count via
  DOM query (`Html` overlays produce DOM elements). Screenshots are
  gated by `Math.random` seeding from
  [Validation Tiers](./contracts.md#validation-tiers).

---

## Phase 1C: Frequency Color Demotion

Decouple frequency from the **role-owned** surfaces of event-role beams.
Frequency stays primary on non-event beams; on event beams (serving /
pending / approach / recent-HO source) frequency demotes to a small
swatch and a text token in the callout, while still owning `disc.fill`
per the
[Three-Tier Contract](./contracts.md#three-tier-visual-contract).

Surface ownership for **event-role beams** (per the channel registry):

- `cone.fill`, `spine.inner`, `endpoint.color`: T1 role color.
  Frequency MUST NOT appear on these surfaces. (Forbidden cross-use #1.)
- `disc.fill`: T3 frequency color, **at reduced opacity** so the role's
  spine/endpoint/inner-ring dominate visually. The frequency hue stays
  visible; it just does not compete with role color for first-glance
  attention.
- `callout.freqSwatch`: T3 frequency color (the 8×8 px swatch added by
  this slice).

Scope:

- For event-role beams: enforce that `cone.fill`, `spine.inner`, and
  `endpoint.color` pull exclusively from `BEAM_ROLE_TOKENS[visualRole].color`.
  `disc.fill` continues to use `frequencyReuseColor(...)` but with
  opacity capped at `0.18` (consistent with the disc-fill cap used by
  Phase 3A's `cell.fill`) so role surfaces remain the dominant cue.
- For event-role beams, the callout layout becomes:
  - Line 1 (owner-tag chip): role-accented satellite tag.
  - Line 2: `SERVING · F2 B5` with a small `F2` swatch positioned next
    to the `F2` token using `frequencyReuseColor(2)`. Swatch is `8×8 px`.
  - Line 3: SINR readout.
- For `otherActive` beams (the surviving ambient beams in Phase 1B),
  frequency-reuse color stays as the cone/disc/spine primary color
  exactly as today.
- For `inactive` beams (only reachable in `tuning` / `diagnostics`),
  frequency color is desaturated to slate; behavior unchanged from
  Phase 2D.

Non-goals:

- No new role tokens. No new BEAM_FREQUENCY_COLORS palette entries.
- No changes to `getBeamFrequencyIndex` or the contract that beam id →
  freq.
- No changes to `EarthFixedCells` (that is Phase 3A).
- **No removal of `disc.fill`-T3-frequency for event roles.** This was
  briefly proposed but rejected because contracts.md owns the channel
  table; `disc.fill` is T3 unconditionally.

Implementation guidance:

- The `resolveBeamVisualEncoding()` helper in
  `src/constants/beamRoleTokens.ts` already centralizes role vs
  frequency. Extend it with a `frequencySwatchColor` field that
  callers can render inside the callout. Do not push frequency into
  `color` on event roles.
- The 8×8 swatch is a `<span>` inside the existing `Html` callout
  container. No 3D primitive change needed.

Touched files:

- `src/constants/beamRoleTokens.ts` — `BeamVisualEncoding` adds
  `frequencySwatchColor: string`.
- `src/viz/SatelliteBeams.tsx` — callout renders the swatch span;
  event-role disc-fill opacity capped at `0.18`.
- `scripts/validate-vc1c-freq-color-demotion.tsx` — V3 browser
  validation.
- `package.json` — register `validate:vc1c:freq-color-demotion`.

Acceptance:

- For a forced serving fixture, the **cone, spine, and endpoint** pixels
  sampled from a browser screenshot pull only from
  `BEAM_ROLE_TOKENS.serving.color` (ΔE ≤ 5 vs role color; ΔE ≥ 15 vs
  every `BEAM_FREQUENCY_COLORS` entry).
- The disc area sampled at the disc center carries the matching
  `frequencyReuseColor(...)` hue at low opacity (luminance < `0.4` of
  the role's serving cyan luminance), confirming `disc.fill` retains
  its T3 ownership without overpowering role.
- The callout still shows `F2 B5` text and a visible `F2` swatch.
- For a forced `otherActive` fixture, the cone/disc/spine all use
  `frequencyReuseColor(...)`.

Validation evidence:

- V3: `npm run validate:vc1c:freq-color-demotion` boots the Vite dev
  server in headless Chrome, renders one Playwright fixture per role,
  samples cone/spine/endpoint/disc pixel regions on the rendered
  canvas, and asserts the channel-ownership rules above
  ([Forbidden cross-use #1](./contracts.md#forbidden-cross-uses-validated-as-invariants)
  for event-role cone/spine/endpoint; T3 retention for `disc.fill`).
  This is a browser-canvas sample, not a server-render — `renderToString`
  cannot read WebGL output.

---

## Phase 1D: Identity Match Harness

Add a deterministic V2 SSR harness that proves the **text and
structural** invariants of Phase 1A and 1B together. Pixel-color
invariants for Phase 1C are covered by Phase 1C's V3 script and are
**not** re-asserted here, because SSR cannot read WebGL output (per
[Validation Tiers hard rules](./contracts.md#validation-tiers)).

Scope:

- A new validation script
  `scripts/validate-vc1d-identity-match.tsx` (V2) that:
  - Forces simulation state where serving (Sat-A, Beam 5, F2), pending
    (Sat-B, Beam 3, F1), approach (Sat-C, Beam 11, F3 — see
    [Phase 1A worked example](#phase-1a-live-legend-identity)), and one
    ambient per remaining visible satellite are present
    simultaneously.
  - Renders scene callouts (via the Phase 1A `Html`-callout test
    scaffold that bypasses R3F) and right `InfoPanel` blocks via
    `renderToStaticMarkup`.
  - Asserts:
    - Every event-role callout starts with the satellite owner-tag
      chip text.
    - The right panel and the scene callout for the same beam emit
      character-equal identity strings.
    - In `event-plus-1` density at simulated `1440x900`, exactly the
      expected number of event-role callouts plus the ambient floor
      are present, no more (string/DOM count, not pixel).
    - The `useBeamViz` ambient-ring payload count matches the
      Phase 1B expectation per density tier × viewport combination.
- A make-target `validate:vc1d:identity-match` runs the script.

Non-goals:

- No pixel-color assertions. Frequency-color demotion at the
  cone/spine/endpoint level is verified exclusively in Phase 1C V3.
- No browser validation; this slice is server-render-only to keep CI
  cheap.
- No tests of approach lookahead correctness (covered elsewhere).

Touched files:

- `scripts/validate-vc1d-identity-match.tsx` — new file.
- `package.json` — register `validate:vc1d:identity-match`.

Acceptance:

- The harness fails if any Phase 1A or 1B text/structural invariant
  regresses.
- `npm run validate:vc1d:identity-match` is added to the project script
  manifest and runs in CI.
- Phase 1C pixel invariants are explicitly delegated to
  `validate:vc1c:freq-color-demotion`; the 1D acceptance does **not**
  duplicate them.

Validation evidence:

- A green run of `npm run validate:vc1d:identity-match` (V2) recorded
  in this document when the slice ships.
