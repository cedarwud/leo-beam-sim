# Visual Clarity & Story-Readability SDD

## Status

Proposed (revision 2 — post independent review).

This SDD is a follow-on to `docs/frontend-ux-redesign-sdd.md`. It builds on
the beam-role token contract that landed in **Phase 2C/2D** of that document
and the UI mode architecture defined in **Phase 3A** (planning) and
implemented in **Phase 3B** (runtime). It addresses a class of clarity
problems those phases explicitly did not cover.

This SDD does **not** restate or rewrite Phase 1A through Phase 9H of the
existing UX SDD. It only adds new slices that close gaps after those phases
shipped.

**Revision history:**

- r1 (initial draft): 4 phases, 15 slices, monolithic file (1289 lines).
- r2 (post review): 4 phases, 18 slices, monolithic file (1972 lines).
  Added Validation Tiers, Mode & Density Plumbing, Three-Tier Contract
  sub-channels, Accessibility & Motion, Performance Budget, Cross-cutting
  Conventions. Phase 1A canonical identity reformatted to match existing
  `formatSatelliteLabel()` output. Phase 1B density math resolved against
  existing `MAX_BEAM_SATS = 3` cap. Phase 2D dash rule committed to
  "dash = inactive only" with explicit token flips and existing-script
  update. Phase 4B split into layout-shell prerequisite + drawer slice.
  Phase 4C added camera command bus pattern. Phase 4D declared the
  existing `validate:phase5b` script update mandatory. Phase 3E
  pixel-perfect off-mode acceptance replaced with brightness-delta
  acceptance. All slices map to V1/V2/V3 validation tier.
- r3 (this revision): SDD split into 6 files for navigability.
- r3.1 (post-split review): three small acceptance/validation gaps
  closed — Phase 3C now asserts `reducedMotion` skips trail rendering;
  Phase 2B now asserts the font-fallback fixture; Phase 4C validation
  evidence now includes a `reducedMotion` instant-snap frame.
- r3.2 (second post-split review): three blockers + seven majors +
  two minors closed.
  - Blocker — Phase 1C disc.fill contract: clarified that disc.fill
    remains T3 frequency (with reduced opacity) for event roles; only
    cone.fill / spine.inner / endpoint.color demote frequency.
    Three-Tier Contract is the single source of truth.
  - Blocker — Phase 1D V-tier: pixel-color assertions removed; 1D is
    now strictly V2 SSR (text + structural). Pixel invariants
    delegated to Phase 1C V3.
  - Blocker — Phase 4C density mapping: explicit ControlBar-label ↔
    `runtime.beamDensity` mapping table added (`few=event-only`,
    `normal=event-plus-1`, `many=all`); UiMode defaults reconciled
    with contracts; user-override precedence rules defined; UiMode
    transitions reset to default.
  - Major — Phase 1C validation: V3 wording corrected to Playwright
    pixel sampling; SSR claim removed.
  - Major — Phase 2B inline glyph: registered as part of
    `callout.satChip` (T2) in the channel registry; new `panel.satChip`
    entry added for InfoPanel duel-card mirror.
  - Major — Phase 3A forbidden cross-use #3: explicit citation +
    pixel-sample ΔE assertion added.
  - Major — Phase 3E spotlight: changed from token mutation to runtime
    opacity multiplier in `SatelliteBeams.tsx`; touched files updated.
  - Major — Phase 3C orbit trail: pre-allocated `BufferGeometry` per
    satellite with in-place attribute updates, replacing per-tick
    geometry recreation that violated the Performance Budget.
  - Major — Phase 1A worked example arithmetic: corrected
    `R000-05-11 · F4 B11` to `R000-05-11 · F3 B11` (since
    `(11-1) % 4 = 2 → F3`).
  - Major — Phase 2A `BeamTarget` re-export claim: corrected to
    "imported by `types.ts` for `VizFrame.satBeams` typing; not
    re-exported".
  - Minor — DoD validation script glob: `validate-vc*.tsx` →
    `validate-vc*.{ts,tsx}` to match the V1 vs V2/V3 file-extension
    convention.
  - Minor — Phase 2 / Phase 4 opening contract lists: added missing
    references to Mode & Density Plumbing (Phase 2D consumes
    `reducedMotion`) and Accessibility & Motion (Phase 4C camera
    tween).
- r3.3 (third post-split review): two majors + four minors + four
  registry/wiring gaps closed.
  - Major — README slice summary 3E row drift: added `scene/types`
    and `SatelliteBeams (cone-opacity multiplier)` to match the
    Phase 3E touched files post-r3.2 rewrite. The README now agrees
    with the phase file.
  - Major — `prefers-reduced-motion` listener owner: assigned to
    Phase 1B's App.tsx entry. Phase 1B now explicitly installs
    `matchMedia('(prefers-reduced-motion: reduce)')` and forces every
    `runtime.effectsEnabled.*` to `false` while reducedMotion is
    active. Recovery semantics (when the OS preference returns to
    `no-preference`) are documented in contracts.md. New V2
    invariant assertion added to Phase 1B acceptance.
  - Minor — Phase 2A wrong-direction citation of Forbidden cross-use
    #2: replaced with new **cross-use #6** (T2 satellite-tint MUST
    NOT be written into T1/T3-owned surfaces). Cross-use #6 is the
    source-side mirror of #2 / #3 and codifies the channel-aliasing
    rule that the registry implied but did not enumerate.
  - Minor — DoD `.ts` vs `.tsx` convention: relaxed wording. V2 SSR
    scripts that include JSX use `.tsx`; V1 invariant and V3
    browser-pixel scripts may be either. Phase 2 scripts (which use
    Playwright pixel-sampling without React JSX) keep their `.ts`
    extension; this is now explicitly compliant.
  - Minor — Phase 3A acceptance stricter than cross-use #3: tightened
    cross-use #3 in contracts.md to read "MUST NOT use a role color
    **or a frequency color**", aligning the contract with Phase 3A's
    pixel ΔE assertion.
  - Minor — `reducedMotion` recovery semantics: added to
    contracts.md's Mode & Density Plumbing section. When
    `reducedMotion` returns to `false`, `effectsEnabled.*` is
    recomputed from the current `UiMode` default mapping; the
    forced-`false` override does not persist.
  - Gap — `disc.innerRoleRing` had no implementing slice: assigned to
    Phase 2A scope. The inner role ring is drawn only for event
    roles using a thin `ringGeometry` inside the disc radius,
    sourced from role color, completing the channel that contracts
    declared.
  - Gap — `pendingRipple` not gated: added
    `runtime.effectsEnabled.pendingRipple` as a flag independent of
    `servingRipple`. Default mapping table updated. Phase 3D pending
    variant now reads its own gate.
  - Gap — `callout.identityLine` composition rule: added a
    "Composed-text channel" subsection to contracts.md describing
    how T1 (role label) + T3 (`F# B#` token) substrings compose,
    plus the V2 validation pattern for verifying both substrings
    are present.
  - Gap — Performance Budget mount-time allocation: clarified that
    the "≤ 4 / frame" `BufferGeometry` allocation cap applies to
    steady state only; mount-time pre-allocation (e.g., Phase 3C
    orbit-trail buffers) is explicitly outside the budget.

## Document layout

| File | Contents |
|---|---|
| [`README.md`](./README.md) (this file) | Status, Context, Goals, Non-Goals, Cross-References, Phase Ordering Rationale, Risk Register, Definition Of Done, Open Questions, Implementation Slice Summary |
| [`contracts.md`](./contracts.md) | Validation Tiers, Mode & Density Plumbing, Three-Tier Visual Contract (channel registry + forbidden cross-uses), Accessibility & Motion, Performance Budget, Cross-cutting Conventions |
| [`phase-1-identity-first.md`](./phase-1-identity-first.md) | Phase 1: text-only identity (1A Live Legend, 1B Density Floor, 1C Frequency Demotion, 1D Identity Match Harness) |
| [`phase-2-non-text-channels.md`](./phase-2-non-text-channels.md) | Phase 2: non-text identity (2A Spine Tint, 2B Endpoint Glyph, 2C Satellite Body Tint, 2D Dash & Pulse) |
| [`phase-3-ground-cinematic.md`](./phase-3-ground-cinematic.md) | Phase 3: ground & cinematic (3A Hex Paint, 3B Spine Particles, 3C Orbit Trail, 3D Serving Ripple, 3E Spotlight Fog) |
| [`phase-4-panel-restructure.md`](./phase-4-panel-restructure.md) | Phase 4: panel & UI (4A Duel Card, 4B-pre Layout Shell, 4B Drawer, 4C Density+Camera, 4D Diagnostics Drawer) |

Reading order: README → contracts → phase files in numeric order. Each
phase file is self-contained for the implementing agent of that phase, but
references contracts as the authority on shared rules.

## Context

The beam role tokens shipped (Phase 2D of the existing UX SDD) and gave a
stable visual language for `serving`, `pending`, `approach`, `recentSource`,
`otherActive`, and `inactive` roles. After running the simulator end-to-end,
three residual clarity problems remain:

1. **No satellite identity in the scene.** The beam callout in
   `src/viz/SatelliteBeams.tsx:173` reads `SERVING · F2 B5 · 18.4 dB`. The
   same string is printed by every satellite that owns an `F2 B5` beam.
   When two satellites simultaneously light their `F2 B5`, the scene gives
   the operator no way to tell them apart. Beam IDs (`B1..Bn`) reset to 1
   on every satellite — they are intentionally not globally unique.
2. **Panel ↔ scene identity drift.** The right `InfoPanel` shows
   `R053-01-04 Beam 5`. The 3D callout shows `SERVING · F2 B5`. These
   describe the same beam but use different vocabularies, so the operator
   cannot eye-match the panel row to the scene element.
3. **Frequency color is conflated with satellite identity.** Once a beam
   is classified as `otherActive`, it picks up `frequencyReuseColor()` (one
   of six hues). Two satellites lighting the same frequency draw two beams
   with the same color, in roughly the same area. The frequency-reuse
   contract is correct, but it is loaded with two meanings on screen.

Three parallel proposals were drafted exploring this gap. The first
([`README.md`](../README.md), [`encoding-channels-catalog.md`](../encoding-channels-catalog.md),
[`side-panel-decluttering.md`](../side-panel-decluttering.md),
[`ascii-mockups.md`](../ascii-mockups.md)) explored multi-channel encoding
and panel restructure. The second proposed a text-first / Live Legend
approach prioritizing the cheapest disambiguation. The third proposed
cinematic emphasis cues (ground ripple, spotlight fog, role-specific
pulses, hatch textures). The three converge on the same three-tier
encoding contract but disagree on which channels to prioritize first.

This SDD adopts a phased combination drawn from all three:

- **Text identity first** ([Phase 1](./phase-1-identity-first.md)) —
  cheapest, most disambiguation per unit work, from the second proposal.
- **Non-text channels second** ([Phase 2](./phase-2-non-text-channels.md))
  — raises 1–2-second glance recognition, from the first proposal, with
  the third proposal's pulse-rhythm distinction between pending and
  approach added in 2D.
- **Ground-layer storytelling third**
  ([Phase 3A–3C](./phase-3-ground-cinematic.md)) — raises narrative
  density, from the first proposal.
- **Cinematic emphasis fourth**
  ([Phase 3D, 3E](./phase-3-ground-cinematic.md)) — adds optional
  presentation-mode emphasis, from the third proposal.
- **Panel restructure last** ([Phase 4](./phase-4-panel-restructure.md))
  — from the first proposal.

## Goals

1. **Story-readability.** A first-time viewer should be able to answer
   the following four questions in under five seconds **without reading
   any sentence-length description**:
   1. Which beam is serving the UE right now?
   2. Which beam is the pending handover target?
   3. Which satellite emits each visible beam?
   4. What frequency reuse class does each visible beam use?
2. **Identity consistency.** Every beam shown in the 3D scene and every
   row shown in the right panel must use the same identity string so the
   eye can match scene to panel and back.
3. **Channel orthogonality.** Each piece of information has a single
   primary channel; no channel is forced to encode two competing
   meanings. The current conflation between role color and frequency
   color must end.
4. **Phase-1 must be cheap.** The first executable slice must be
   implementable with no new geometry, no new material, no new constants
   palette beyond what already exists in `BEAM_ROLE_TOKENS` and
   `BEAM_FREQUENCY_COLORS`, and no simulation-truth changes.
5. **Phase-2+ must be additive.** Subsequent slices must not undo
   Phase-1 identity strings. Adding glyphs, spine tints, and ground-cell
   repaints must preserve the text identity established in Phase 1.

## Non-Goals

- No changes to orbit propagation, handover policy (`HandoverManager`),
  beam hopping scheduler (`scheduleBeamCells`), or SINR formula math
  (`computeLinkBudget`).
- No new satellite synthesis, fabricated handover candidates, or fake
  density in the shipped runtime path. Validation harnesses may force
  role/density states; production may not.
- No replacement of the Phase 2C/2D `BEAM_ROLE_TOKENS` or
  `BEAM_FREQUENCY_COLORS` palettes. New encoding fields layer on top.
- No removal of frequency reuse semantics. `F#` remains the canonical
  frequency label and stays present in every beam callout.
- No new full-screen redesign. Existing right `InfoPanel`, left
  `SignalTuningPanel`, and `ControlBar` keep their slots; their internals
  may change.
- No new dependency on Three.js shaders or GPU instancing in Phase 1–2.
  Phase 3 may opt in to instanced primitives only where the geometry
  already permits.

## Cross-References

- `docs/frontend-ux-redesign-sdd.md` Phase 2C/2D (lines 467–632) —
  defines `BEAM_ROLE_TOKENS`, the role encoding matrix, and the
  frequency-vs-role conflict rules. This SDD layers on top, and Phase 2D
  of this SDD (Dash Channel Reassignment) **deliberately changes** the
  dash assignments documented there. Existing
  `validate-phase2d-forced-role-state-visuals.ts` assertions must be
  updated as part of that slice.
- `docs/frontend-ux-redesign-sdd.md` Phase 3A (planning, lines 710–848)
  and Phase 3B (runtime implementation, lines 850–927) — define
  `UiMode = 'presentation' | 'tuning' | 'diagnostics'` and its persistence
  (`src/ui/uiMode.ts`). The
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing) section
  derives `RuntimeConfig.beamDensity`, `effectsEnabled.*`, and
  `cinematicMode` from `UiMode` at the App boundary.
- `docs/sinr-runtime-parameter-contract.md` — left-tuning-panel parameter
  authority. Phase 4B drawer-ization must not break that authority.

---

## Phase Ordering Rationale

| If we ship | We get | We do not yet have |
|---|---|---|
| Phase 1 only | Operator can read every beam's owner; panel matches scene; presentation density is sane | No 1-second visual identity; ground layer still wasted |
| Phase 1 + 2 | Operator can identify owners by spine/glyph/body color without reading text; pending and approach distinguished by pulse rhythm | Ground still says "served / not served" only |
| Phase 1 + 2 + 3A | Zenith camera frame still tells the full story | No motion identity |
| Phase 1 + 2 + 3A + 3D | Serving location is locatable in 1 frame at any zoom | No motion-cued identity for non-event satellites |
| Phase 1 + 2 + 3A + 3B/3C/3D | Story holds at any camera angle and any pause state | Panel restructure not done |
| Phase 1 + 2 + 3 + 3E (opt-in) | Cinematic focus available for live-demo settings | Panel restructure still optional |
| All phases | The full visual contract |  |

The ordering is chosen so each phase is shippable and reversible. If
Phase 2 is later judged unnecessary, removing it leaves Phase 1 intact.
If Phase 4 ships before Phase 2/3, the duel card still works because
identity strings come from Phase 1.

## Risk Register

| Risk | Mitigation |
|---|---|
| Spine tint palette collides with new `BEAM_ROLE_TOKENS` accent in some future phase | Keep palette explicitly off-white / low-saturation; reserve saturated yellow/green/blue role colors strictly for roles |
| Glyph at endpoint becomes unreadable at distant camera | Glyph size scales with camera distance; fallback to circle when below `8 px`; inline Unicode glyph in callout text remains as text fallback |
| Particle drift causes WebGL frame drops on low-end hardware | Particle count capped at 4 per spine; gated by presentation mode; can be disabled by a `RuntimeConfig.disableParticles` flag |
| Hex paint causes flicker as best-cover beam alternates per tick | Smooth cover assignment over 200 ms windows; cover only changes when a different beam dominates for two consecutive ticks |
| Drawer layout reflow breaks `OrbitControls` mouse hit-testing | Canvas wrapper must own `pointerEvents`, drawers use their own event layers |
| Phase 1 owner-tag chip lengthens callout beyond fitting on small viewports | At `390x844` the chip uses single-line wrapping; SINR readout drops to a third line; never push beam layout |
| Ambient ring (Phase 1B) goes invisible against bright NTPU model | Ring stroke uses additive blend with a minimum opacity floor of `0.32` |
| Phase 2D pulse on `pending` reads as instability rather than "preparing" | Period is set to `2.4 s` (slow breathe), not a flashing strobe; amplitude is small (`0.06`); A/B test against static pending in validation harness |
| Phase 3D ripple at serving disc creates motion fatigue in long demos | Ripple is gated to presentation mode only; auto-disables when `paused` to give the viewer rest periods; can be further gated by a `RuntimeConfig.disableRipple` follow-up flag if needed |
| Phase 3E spotlight fog makes 3D NTPU model unreadable | Fog density tuned to dim, not occlude; event spotlights restore brightness over discs; opt-in only |
| Phase 3D ripple, Phase 3B particles, and Phase 2D pulse running simultaneously feel "busy" | Each animation has a different period and channel (radius / particle position / opacity), so they read as orthogonal cues; if validation finds the combination distracting, Phase 3D ripple can be downgraded to "first 2 seconds after handover" only |

## Definition Of Done

The SDD is complete when, on a `1440x900` browser at the
`hobs-2024-candidate-rich` profile in presentation mode and at simulation
time after the first handover has occurred:

1. The serving, pending, approach, and recent-HO source beams are visible
   simultaneously, each with its own role color and own satellite tint.
2. Every visible beam callout starts with a satellite owner-tag chip whose
   string is character-equal to the matching `InfoPanel` row.
3. A grayscale screenshot of the same frame still distinguishes role
   (line/dash/fill) and satellite (glyph/spine outer line) without color.
4. The hex grid below the beams reflects beam ownership and frequency at
   each cell.
5. No `BEAM_ROLE_TOKENS` accent is ever drawn into the cone fill of an
   `otherActive` beam, and no `BEAM_FREQUENCY_COLORS` value is ever drawn
   into the cone fill of a serving / pending / approach / recent-HO beam.
6. Pressing density `few` / `normal` / `many` immediately changes the
   visible beam set without restarting simulation.
7. All validation scripts in `scripts/validate-vc*.{ts,tsx}` pass;
   existing `validate-phase*` scripts still pass. **Extension
   convention**: V2 SSR scripts that include JSX (`renderToStaticMarkup
   <Component />`) use `.tsx`; V1 unit-invariant scripts and V3
   browser-pixel scripts that drive Playwright without JSX may use
   either `.ts` or `.tsx`. Each slice's "Touched files" block declares
   the actual extension chosen.

## Open Questions

1. Should the satellite-tint palette be derivable from the
   `BEAM_FREQUENCY_COLORS` palette by lightness shift, so the project's
   color system is single-rooted? Tradeoff: simpler color system vs less
   visual headroom for low-saturation tints.
2. Should the orbit trail (Phase 3C) render in `tuning` mode for research
   contexts where the orbit shape is the question? Currently scoped to
   presentation only.
3. Is there a need for a `colorblind-mode` runtime flag that swaps the
   role palette to a deuteranopia-safe variant, or is the existing
   secondary-encoding policy from Phase 2D's grayscale validation
   sufficient?
4. The hex grid is centered at `(0,0)` in world space (the NTPU site).
   For demos that cover broader ground (e.g. when the UE moves), should
   the grid recenter or extend? Current scope keeps the grid fixed; a
   follow-up SDD should cover dynamic recentering if UE mobility is
   added.
5. **Hatch / dot texture per satellite as an alternative to spine-tint +
   glyph.** A third proposal advocated giving each satellite a unique
   *texture* on the disc fill (solid / hatch / dot). Texture is a viable
   pre-attentive channel and would be additive on top of frequency fill,
   but on additive-blended translucent material the texture readability
   is uncertain. Keep this as a fallback plan: if Phase 2A spine tint
   plus Phase 2B glyph turn out to be insufficient on screenshots taken
   at `1366x768` with three+ overlapping discs, a follow-up slice can add
   `satelliteHatchPattern` to the disc material and downgrade either
   spine tint or glyph correspondingly. Do not implement texture and
   glyph and spine tint simultaneously without a re-evaluation of
   channel orthogonality.
6. **Should Phase 3D ground ripple also activate in tuning mode for
   demonstrations within research sessions?** Currently scoped to
   presentation only because researchers may find continuous animation
   distracting; revisit after Phase 3D ships.
7. **Should Phase 3E spotlight fog be the default for the
   `demo-readability` profile, or always opt-in?** Currently always
   opt-in because cinematic dimming is a strong stylistic choice that
   may hurt research-flavored demos.
8. **Hex grid: exact circle-vs-hex polygon intersection vs the
   conservative inscribed approximation in Phase 3A.** Current SDD uses
   the inscribed approximation (over-estimates by ≤ 13.4% area). If the
   approximation produces visibly wrong cell-cover assignments at the
   `1366x768` zenith view, a follow-up slice should add Sutherland–Hodgman
   clipping. Defer until visual evidence demands it.
9. **`BeamTarget` and `CellData` interface migration to
   `src/scene/types.ts`.** Both interfaces currently live in their
   respective viz components (`SatelliteBeams.tsx`,
   `EarthFixedCells.tsx`). Migrating them to `types.ts` would let new
   slices reference them without circular imports, but is mechanically
   invasive. This SDD elects to **not migrate**; new fields are added in
   their existing locations. A migration slice is a candidate follow-up
   if many future SDDs depend on these types.
10. **`prefers-reduced-motion` granularity.** Current policy is
    all-or-nothing: any animation collapses to its static state. A more
    nuanced policy (allow slow tweens, disable strobing) is a follow-up.

---

## Implementation Slice Summary

V-tier abbreviations: V1 = unit invariant, V2 = React SSR text, V3 =
browser canvas. See [Validation Tiers](./contracts.md#validation-tiers)
for the rules. Every slice's `Touched files` includes its
`scripts/validate-vc{slice}-{name}.{ts,tsx}` and `package.json`; the
table omits these for brevity.

| Slice | V-tier | Touches (additional) | New tokens / types | Validation script | Effort |
|---|---|---|---|---|---|
| [1A Live Legend](./phase-1-identity-first.md#phase-1a-live-legend-identity) | V2 | utils/formatSatelliteLabel, SatelliteBeams, HandoverLinks, SatelliteMarker, InfoPanel | `formatBeamIdentity`, `formatBeamIdentityByIndex` | `validate:vc1a:live-legend` | XS |
| [1B Density Floor](./phase-1-identity-first.md#phase-1b-presentation-density-floor) | V2+V3 | scene/types, useBeamViz, new AmbientFootprintRings, MainScene, App (also: install `prefers-reduced-motion` listener, force `effectsEnabled.*` when reducedMotion) | `RuntimeConfig.beamDensity`, `VizFrame.ambientRings`, `AmbientRing` | `validate:vc1b:presentation-density` | S |
| [1C Freq Demotion](./phase-1-identity-first.md#phase-1c-frequency-color-demotion) | V3 | beamRoleTokens, SatelliteBeams | `BeamVisualEncoding.frequencySwatchColor` | `validate:vc1c:freq-color-demotion` | S |
| [1D Identity Match](./phase-1-identity-first.md#phase-1d-identity-match-harness) | V2 | (validation only) | — | `validate:vc1d:identity-match` | S |
| [2A Spine Tint](./phase-2-non-text-channels.md#phase-2a-satellite-spine-tint) | V1+V3 | beamRoleTokens, SatelliteBeams (BeamTarget+spine+ring), useBeamViz | `SATELLITE_TINT_PALETTE`, `satelliteTintColor` | `validate:vc2a:spine-tint` | M |
| [2B Endpoint Glyph](./phase-2-non-text-channels.md#phase-2b-endpoint-glyph-shapes) | V1+V3 | new viz/glyphs, SatelliteBeams (BeamTarget+endpoint+inline glyph), useBeamViz, InfoPanel | `SATELLITE_GLYPH_LIBRARY`, `satelliteGlyph: GlyphKind` | `validate:vc2b:endpoint-glyph` | M |
| [2C Body Tint](./phase-2-non-text-channels.md#phase-2c-satellite-body-tint) | V3 | SatelliteMarker, scene/types (VisibleSat), useBeamViz, MainScene | `VisibleSat.satelliteTintColor` | `validate:vc2c:satellite-tint` | S |
| [2D Dash & Pulse](./phase-2-non-text-channels.md#phase-2d-dash-channel-reassignment--role-pulses) | V1+V3 | beamRoleTokens (flip dashed; add pulse), SatelliteBeams (`useFrame`), update existing `validate-phase2d-...` | `BeamRoleToken.pulse: 'none'\|'breathe'\|'pulse'\|'fade'` | `validate:phase2d:...` (updated) + `validate:vc2d:role-pulse-envelopes` | S |
| [3A Hex Paint](./phase-3-ground-cinematic.md#phase-3a-hex-grid-paint-by-numbers) | V2+V3 | EarthFixedCells (CellData extended), MainScene (cell-cover map + hysteresis) | `CellData.coveringBeam` | `validate:vc3a:hex-paint` | M |
| [3B Spine Particles](./phase-3-ground-cinematic.md#phase-3b-spine-particle-drift-optional-presentation-only) | V3 | new SpineParticles, MainScene | `RuntimeConfig.effectsEnabled.spineParticles` | `validate:vc3b:spine-particles` | M |
| [3C Orbit Trail](./phase-3-ground-cinematic.md#phase-3c-orbit-trail-optional-presentation-only) | V3 | new OrbitTrail, MainScene | `RuntimeConfig.effectsEnabled.orbitTrail` | `validate:vc3c:orbit-trail` | M |
| [3D Serving Ripple](./phase-3-ground-cinematic.md#phase-3d-serving-ground-ripple) | V3 | new ServingGroundRipple, MainScene | `RuntimeConfig.effectsEnabled.servingRipple` | `validate:vc3d:serving-ripple` | S |
| [3E Spotlight Fog](./phase-3-ground-cinematic.md#phase-3e-spotlight-fog-mode-optional-presentation-only) | V3 | scene/types (`cinematicMode`), MainScene (fog + spotlights), SatelliteBeams (cone-opacity multiplier; **no token mutation**), NTPUScene comment, ControlBar toggle | `RuntimeConfig.cinematicMode` | `validate:vc3e:spotlight-fog` | M |
| [4A Duel Card](./phase-4-panel-restructure.md#phase-4a-infopanel-duel-card) | V2+V3 | InfoPanel | — | `validate:vc4a:duel-card` | S |
| **[4B-pre Layout Shell](./phase-4-panel-restructure.md#phase-4b-pre-layout-shell-migration)** | V3 | App, MainScene, SignalTuningPanel, InfoPanel, styles/main.scss | — | `validate:vc4b-pre:layout-shell` | M |
| [4B Tuning Drawer](./phase-4-panel-restructure.md#phase-4b-proper-drawer-behavior) | V3 | App, SignalTuningPanel | — | `validate:vc4b:tuning-drawer` | S |
| [4C Density+Camera](./phase-4-panel-restructure.md#phase-4c-controlbar-density-slider--camera-preset) | V3 | scene/types (`cameraCommand`), MainScene (OrbitControls ref + tween), App, ControlBar | `RuntimeConfig.cameraCommand` | `validate:vc4c:controlbar-density-camera` | M |
| [4D Diagnostics Drawer](./phase-4-panel-restructure.md#phase-4d-diagnostics-drawer) | V2+V3 | new DiagnosticsDrawer, InfoPanel, App, **update** `validate-phase5b-...` | — | updated `validate:phase5b:...` + new `validate:vc4d:diagnostics-drawer` | S |

Total: 4 phases, **18 slices** (Phase 4B split into 4B-pre + 4B). Phases
1 and 2 are mandatory. Phase 4B-pre is mandatory before Phase 4B and
strongly recommended before any other Phase 4 slice. Phases 3 and 4D
are strongly recommended but each individual slice can be deferred
without blocking the rest. Phase 3D and 3E are cinematic emphasis
slices: 3D is recommended for any presentation-mode use; 3E is opt-in
for demo settings where dramatic focus is desired.
