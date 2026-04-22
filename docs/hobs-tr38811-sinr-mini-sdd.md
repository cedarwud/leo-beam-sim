# HOBS + TR 38.811 SINR Mini-SDD

## 1. Purpose

This note defines the minimum design contract required before upgrading
`leo-beam-sim` from its current HOBS-derived SINR path to a research-grade
`HOBS + TR 38.811` channel path closer to `ntn-sim-core`.

This mini-SDD intentionally advances a local HOBS hardening slice ahead of the
broader phase order in `docs/research-implementation-backlog.md`. That backlog
still describes the long-range build order, but this note is the active
authority for the `HOBS + TR 38.811` channel upgrade because the existing code
surface is already HOBS-shaped and can absorb this work as a local hardening
pass without first introducing a different paper family such as `MCCHO-CORE`.

The current repository already simulates:

- HOBS-style outer SINR aggregation
- Bessel J1/J3 beam gain
- deterministic multi-beam visibility and beam activation
- intra-satellite beam switching and inter-satellite handover
- event-focused 3D visualization driven by simulation truth

What it does **not** yet implement as a first-class research path is:

- `TR 38.811 Eq. (6.6-3)` slant-range closure `d(alpha)`
- table-driven LOS probability
- explicit separation between serving, intra-satellite interference, and inter-satellite interference power assembly
- a profile-level distinction between demo-friendly HOBS-derived behavior and research-grade `HOBS + TR 38.811`

This mini-SDD exists to prevent an ad hoc formula patch that changes front-end
behavior, handover timing, or performance without an explicit contract.

## 2. Scope

### 2.1 Goals

- Add an opt-in research-grade `HOBS + TR 38.811` signal path to `leo-beam-sim`.
- Keep the outer HOBS SINR structure intact while upgrading how link powers are derived.
- Preserve the current demo-oriented profiles unless the user explicitly selects the new research profile.
- Keep the front-end runtime contract stable enough that existing visualization components do not need a rewrite.
- Make the research profile reachable at runtime without requiring a source edit of `App.tsx`.
- Make the source-of-truth order for signal, handover, and visualization explicit.
- Define performance guardrails before adding heavier per-link calculations to the `useFrame` simulation path.

### 2.2 Non-Goals for Phase 1

- No silent replacement of `hobs-2024-paper-default` or `hobs-2024-candidate-rich`.
- No default-profile change for the app entry point.
- No mandatory parity with every `ntn-sim-core` research feature on the first pass.
- No immediate introduction of DPC, Doppler ICI, or full energy-model coupling unless explicitly promoted after the channel baseline lands.
- No front-end redesign beyond additive research/debug disclosure.
- No silent FRF / frequency-reuse retune in the same slice as the first TR 38.811 channel closure.

Phase 1 is a **research-grade channel hardening path**, not a full simulator
platform refactor.

## 3. Problem Statement

The current signal engine already computes useful HOBS-derived SINR, but it does
so through a simplified path:

- path loss uses a deterministic component stack
- link geometry uses the current observer/beam snapshot directly
- interference is derived from active beams and reuse grouping without an explicit
  serving / `I^a` / `I^b` assembly contract

That is acceptable for the current demo and candidate-rich use cases, but it is
not yet strong enough to claim `ntn-sim-core`-level `HOBS + TR 38.811`
completeness.

The main design risk is not the outer SINR ratio itself. The main risk is
changing the meaning of `S`, `I^a`, `I^b`, and `H` without clearly separating:

1. the research-grade channel truth path
2. the existing demo-friendly path
3. the front-end contracts that consume the result

## 4. Design Principles

### 4.1 Outer Formula Target

The current code already flattens all co-channel interference into one sum. The
research profile is the first place where the simulator will make the HOBS-style
split explicit:

`SINR = S / (I^a + I^b + N)`

So the Phase 1 change is not "preserving" an existing explicit `I^a` / `I^b`
split. It is introducing that split in code structure while keeping the final
scalar SINR concept HOBS-shaped.

### 4.2 Profile Separation

Research-grade channel truth must be introduced as a **new explicit profile**
plus a new orthogonal profile field:

- `formulaFamily: 'hobs-legacy' | 'hobs-tr38811'`

Phase 1 does **not** add a new `PresentationMode`. The presentation contract
remains orthogonal to the signal formula family. Existing demo-facing profiles
must keep `formulaFamily = 'hobs-legacy'`.

### 4.3 Front-End Contract Stability

The signal engine may become more complex internally, but the consumer-facing
simulation surfaces should remain stable where possible:

- `LinkSample`
- `SimFrame`
- serving / pending-target / recent-HO SINR fields
- beam-label and panel data flow

The front end must continue to render engine truth, not recompute alternate
SINR values.

### 4.4 Determinism

Given the same profile, replay epoch, replay offset, and runtime config, the
research-grade signal path must remain deterministic unless a future phase
explicitly introduces stochastic fading with seeded control.

For Phase 1, LOS sampling is quantized to a fixed 1-second bucket using
`floor(simTimeSec)`, so replay runs stay deterministic even though simulation
advances inside `requestAnimationFrame`.

### 4.5 Performance First

Because `leo-beam-sim` computes signal and handover inside `useFrame`, every new
channel feature must be evaluated against frame-time cost, not only formula
completeness.

## 5. Source of Truth Order

For `HOBS + TR 38.811` behavior, use this authority order:

1. profile and runtime formula-family selection
2. orbit/topocentric geometry truth for the current frame
3. signal engine per-link power derivation
4. serving / intra / inter interference assembly
5. handover decisions derived from the resulting SINR values
6. visualization and UI explanation of the above

Visualization must never become the source of truth for research-grade signal
state.

## 6. Proposed Profile Strategy

### 6.1 Existing Profiles

The following profiles keep their current meaning during Phase 1:

- `hobs-2024-paper-default`
- `hobs-2024-candidate-rich`

Their runtime behavior continues to use the current simplified HOBS-derived
signal path and sets:

- `profileClass` unchanged
- `formulaFamily = 'hobs-legacy'`

### 6.2 New Research Profile

Add a new explicit profile:

- `hobs-2024-tr38811-research`

Expected positioning:

- `profileClass = 'paper-default'` for broad UI grouping only
- `formulaFamily = 'hobs-tr38811'` as the authoritative signal-path label
- uses the single-shell HOBS-oriented orbit/layout envelope from
  `hobs-2024-paper-default`, not the 5-shell candidate-rich layout
- not the app default
- not a hidden replacement for `paper-default`
- clearly disclosed in the UI/debug panel as `HOBS + TR 38.811`

This means the existing closed `ProfileClass` union does not need to become the
authority for signal-path selection. The new `formulaFamily` field is.

### 6.3 Runtime Reachability

Phase 1 includes an additive profile selector in `ControlBar` wired through
`App.tsx`, so the research profile is reachable at runtime without editing
source. The app default remains `hobs-2024-candidate-rich`.

### 6.4 Candidate-Rich Compatibility

If a later phase wants a `candidate-rich` variant on top of the research-grade
signal path, it must remain explicitly labeled as a sensitivity/readability
variant rather than masquerading as paper-default HOBS reproduction.

## 7. Target Signal-Path Upgrade

### 7.1 Phase 1: Channel Closure

Phase 1 should add the minimum `TR 38.811` closures needed to justify the link
power path:

1. `slant_range_mode = tr38811-elevation`
2. `los_mode = tr38811-probability`
3. explicit per-link geometry inputs for the signal engine

The first implementation may keep output types unchanged while upgrading the
internal derivation path.

Per-UE geometry is **not** part of Phase 1 because `leo-beam-sim` currently runs
a single observer-anchored UE. For this slice, the research profile keeps the
observer-topocentric geometry path and upgrades only the channel closure.

### 7.2 `TR 38.811 Eq. (6.6-3)` Slant Range

The research path should support:

`d(alpha) = sqrt(R_E^2 sin^2(alpha) + h^2 + 2 h R_E) - R_E sin(alpha)`

where `alpha` is the elevation angle of the link, not the HOBS beam off-axis
angle.

This is the clearest first upgrade because it changes the channel term `H`
without changing front-end data flow.

Integration point: the research profile swaps slant range **upstream** of
`computePathLossDb`, in the `useSimulation.ts` snapshot/link-context path. Phase
1 does not add a second slant-range branch inside `path-loss.ts`.

### 7.3 LOS Probability

The research path should replace a simple threshold-style LOS assumption with a
table-driven `TR 38.811` LOS probability lookup keyed by environment and
elevation angle.

Phase 1 fixes the environment to `suburban`, matching the existing HOBS-style
profiles more closely than a dense-urban jump.

The initial implementation uses deterministic seeded sampling with a key shaped
like:

`satId|beamId|floor(simTimeSec)`

LOS sampling lives in `link-budget.ts` during per-beam entry evaluation, and
`computePathLossDb()` gains an additive legacy-safe LOS/NLOS hook so existing
profiles keep their current behavior unless `formulaFamily = 'hobs-tr38811'`.

LOS state must affect SINR through a concrete path-loss branch. For Phase 1, the
minimum acceptable closure is an additive NLOS clutter loss term rather than a
full LOS/NLOS stochastic shadow-fading family split.

Phase 1 fixes that NLOS term to a single suburban Ka-band proxy constant:

`clutterLossNlosDb = 20 dB`

This is an assumption-backed `TR 38.811` suburban clutter proxy for the first
research slice, not yet a full environment/elevation table implementation.

### 7.4 Interference Assembly

The research path should make the following separation explicit:

- `S`: serving beam received power
- `I^a`: same-satellite co-channel beam interference
- `I^b`: other-satellite beam interference

The split is orthogonal to frequency reuse. Phase 1 keeps
`beams.frequencyReuse = 4` for the research profile so channel hardening does
not also retune interference policy. The current reuse-group filter remains the
first co-channel gate; after that gate, the surviving interferers are separated
into `I^a` and `I^b`.

The split is implemented as unconditional code refactoring in the signal path,
but only `formulaFamily = 'hobs-tr38811'` relies on the named `I^a` / `I^b`
research semantics. Legacy profiles should remain numerically equivalent to the
current flat-sum behavior to within floating-point tolerance because
`I^a + I^b` collapses back to the existing linear interference sum.

## 8. Deferred Features

The following are intentionally deferred unless separately promoted:

- Doppler ICI degradation
- full `ntn-sim-core` energy/power coupling
- multi-UE channel truth beyond the current single-UE observer-centered use case
- stochastic small-scale fading families beyond seeded bounded additions

These can be added later, but they must not block the first research-grade
`HOBS + TR 38.811` channel closure.

### 8.1 Promoted Phase 2 Slice: Beam-Level Power Override / DPC

The first promoted Phase 2 slice adds a **research-profile-only**
beam-associated transmit-power override path. It exists to make `P_{n,m}(t)` a
first-class runtime input to the HOBS SINR skeleton without changing the
front-end contract or widening scope into energy coupling, scheduler redesign,
or DAPS.

Minimum contract:

- only `formulaFamily = 'hobs-tr38811'` may opt into beam-level power control
- legacy profiles continue to use uniform `channel.maxTxPowerDbm`
- `computeLinkBudget()` accepts an additive per-beam power-override map keyed by
  `satId:beamId`
- `useSimulation.ts` owns the runtime DPC state and updates it in deterministic
  time buckets before the link budget is evaluated for the next bucket

The first local DPC rule is intentionally simplified but still paper-shaped:

- `P_{n,m}(t) = P_{n,m}(t-Δt) + ξ^P_{n,m}(t)`
- the sign of `ξ^P` flips when the current per-beam EE proxy does not improve
- if the current beam SINR falls below the configured threshold, `ξ^P` is forced
  positive
- beam power is clamped to a bounded local range

Explicit Phase 2 deviations from the paper:

- the current simulator is single-UE observer-centered, so per-beam EE uses the
  local proxy `log2(1 + γ) / P` rather than a multi-user sum-rate term
- the first slice does **not** implement the paper's per-satellite `Pmax`
  normalization; it only enforces bounded per-beam power
- the first slice uses a bounded floor above `0 dBm` to keep the research path
  numerically stable while the rest of the power/energy model remains deferred

These are accepted deviations for this slice as long as they are documented and
kept profile-scoped.

### 8.2 Known Phase 1 Simplifications

The following remain acceptable Phase 1 simplifications as long as the research
profile does not claim full `ntn-sim-core` parity:

- beam off-axis angle may continue to use the current planar approximation
  rather than a full spherical beam-center geometry rewrite
- transmit power remains uniform per active beam unless a later slice promotes
  beam-associated power override or DPC
- noise may continue to use the current PSD-driven closure rather than a fuller
  receiver-noise reconstruction
- the main value of `d(alpha)` in Phase 1 is auditability and paper-backed
  closure; its numeric divergence from the current topocentric slant range may be
  modest for the single-UE observer-anchored path

## 9. Front-End and Runtime Contract

### 9.1 Must Stay Stable

Phase 1 should preserve these surfaces if possible:

- `src/engine/signal/types.ts`
- `src/scene/types.ts`
- `src/scene/useBeamViz.ts`
- `src/scene/MainScene.tsx`
- `src/ui/InfoPanel.tsx`

This means the preferred implementation strategy is:

1. upgrade signal internals first
2. preserve existing field meanings and signatures where possible
3. allow additive optional fields where needed for profile/formula disclosure
4. make UI changes additive, not structural

Preferred disclosure path:

- add optional fields such as `profileId` and `formulaFamilyLabel` to `SimState`
- thread them into `InfoPanel` without changing the meaning of existing fields

### 9.2 Allowed Behavioral Change

Even if the front-end contract stays stable, the following behavioral outputs are
expected to change under the research profile:

- serving-beam selection timing
- pending-target timing
- handover trigger timing
- beam/satellite ranking driven by SINR
- label values and event emphasis

Those changes are acceptable as long as they are profile-scoped and explainable.

## 10. Performance Guardrails

Because `leo-beam-sim` computes signal truth inside `useFrame`, the research path
must not introduce unbounded per-frame work without guardrails.

Phase 1 guardrails:

- keep the existing visible-satellite filtering path
- acknowledge that `useSimulation.ts` already builds link context twice per frame
  (pre/post handover) and treat that 2x path as the baseline cost to beat or
  cache across
- avoid recomputing expensive geometry more than once per link when cached values can be reused
- avoid UI-side recomputation of research-grade SINR
- benchmark the new profile against the current candidate-rich path before making it user-facing
- keep the median frame-time increase within +25% of the current
  `hobs-2024-candidate-rich` profile over the same replay window and visible-sat
  set; if this budget is exceeded, Phase 1 must either add caching or record the
  overrun as a blocker

If research-grade parity requires heavier work later, that should be promoted as
a separate performance slice rather than hidden inside the first channel change.

## 11. Proposed File Impact

Expected first-pass implementation surfaces:

- `src/profiles/types.ts`
- `src/profiles/index.ts`
- `src/profiles/hobs-2024-tr38811-research.json` (new)
- `src/App.tsx`
- `src/ui/ControlBar.tsx`
- `src/engine/signal/slant-range.ts` (new)
- `src/engine/signal/los-probability.ts` (new)
- `src/engine/signal/path-loss.ts`
- `src/engine/signal/link-budget.ts`
- `src/scene/types.ts`
- `src/scene/useSimulation.ts`
- `src/scene/MainScene.tsx`
- `src/ui/InfoPanel.tsx` for additive formula-family disclosure

## 12. Acceptance Criteria

Phase 1 is complete when:

1. a new explicit research-grade HOBS + TR 38.811 profile exists
   Evidence: profile JSON + `profiles/index.ts` registration + runtime selection path in `ControlBar` / `App.tsx`.
2. the existing demo-oriented profiles remain unchanged by default
   Evidence: app default profile remains `hobs-2024-candidate-rich` and a before/after manual validation note confirms unchanged startup behavior.
3. the research profile uses `d(alpha)` slant range and table-driven LOS handling
   Evidence: unit or harness checks for `d(alpha)` at multiple elevations plus a deterministic LOS-seed test using the 1-second bucket key.
4. serving / intra / inter interference assembly is explicit in code structure
   Evidence: code-path review or targeted test clearly naming `S`, `I^a`, and `I^b` surfaces before final SINR aggregation.
5. front-end visualization still consumes engine truth without recomputing SINR
   Evidence: `useBeamViz.ts`, `MainScene.tsx`, and `InfoPanel.tsx` continue to read engine-owned values rather than deriving alternate SINR numbers.
6. handover and beam overlays continue to function without a rendering rewrite
   Evidence: browser-visible screenshot or QA note for serving/pending/recent-HO overlays under the research profile.
7. replay behavior remains deterministic for the same inputs
   Evidence: two runs with the same profile / epoch / replay settings produce identical logged or serialized research-profile snapshots for a fixed timestamp window.
8. performance impact is measured and documented before any default-profile change
   Evidence: benchmark note reporting current candidate-rich median frame time, research-profile median frame time, and the percentage delta against the +25% budget.

### 12.1 Phase 2 Slice: Beam-Level Power Override / DPC

The first Phase 2 slice is complete when:

1. the research profile exposes an explicit beam-power-control config without changing legacy profiles
   Evidence: `src/profiles/hobs-2024-tr38811-research.json` adds a bounded `beamPowerControl` block and legacy profiles remain uniform-power only.
2. the signal engine can consume beam-specific transmit power without changing front-end contracts
   Evidence: `computeLinkBudget()` accepts an additive override map while `LinkSample`, `SimFrame`, selector flow, and info-panel flow remain stable.
3. runtime DPC updates are deterministic for the same bucket sequence
   Evidence: repeated harness runs produce identical per-beam overrides and identical serialized link snapshots.
4. beam-level power override changes both own-link power and peer interference in the research path
   Evidence: targeted validation shows at least one beam power backoff, reduced RSRP on that beam, and improved SINR on at least one affected peer beam.
5. the slice is explicitly documented as a bounded simplification rather than full HOBS-P parity
   Evidence: the mini-SDD and Phase 2 validation note call out the EE proxy and the absence of per-satellite `Pmax` normalization.
