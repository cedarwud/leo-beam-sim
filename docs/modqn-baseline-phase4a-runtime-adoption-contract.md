# MODQN Baseline Phase 4A Runtime Adoption Contract

**Date:** 2026-05-12
**Status:** docs-only contract and boundary inventory
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope anchor:** baseline MODQN for `PAP-2024-MORL-MULTIBEAM`

Phase 4A defines how `leo-beam-sim` may later adopt the vendored
`ntn-sim-core` beam layout truth at runtime without breaking MODQN replay
provenance, beam identity, or the `7` versus `19 / 37` claim boundary.

This phase does not change runtime behavior. It does not wire the vendored
layout into `useSimulation`, does not expose controls, does not replay the
producer bundle, does not copy artifacts, and does not vendor a new module.

## 1. Authority Boundary

The repo roles remain unchanged:

1. `modqn-paper-reproduction` remains the MODQN evidence authority. The
   accepted downstream evidence input is the regenerated 7-beam
   `phase-03a-replay-bundle-v1` recorded in Phase 1.
2. `ntn-sim-core` remains the validated module, contract, and validator
   authority. The Phase 3B layout slice in this repo is a vendored copy of
   `ntn-sim-core/src/core/beam/layout.ts` and `types.ts`, not a new local truth
   source.
3. `leo-beam-sim` remains the final visual-first runtime and demo host under
   ADR-002. It may host live runtime, but rigor-critical truth must come from
   vendored `ntn-sim-core` modules or explicit producer artifacts.

Display-only transforms in `leo-beam-sim` may position labels, smooth visuals,
or stage camera views. They must not alter producer values, SINR/SNR values,
handover events, policy decisions, rewards, deterministic path IDs, candidate
ordering, masks, or provenance.

## 2. Runtime Adoption Boundary

Phase 4A only records the adoption contract. A later runtime phase may adopt
the vendored layout only if it keeps these boundaries:

1. The vendored core layout may define beam geometry, beam IDs, ENU offsets,
   active defaults, and reuse groups for live runtime truth.
2. Producer MODQN replay identity remains canonical for replay and evidence.
   A core layout ID may be a geometry/runtime key, but it is not the producer
   provenance ID.
3. Existing Leo numeric beam IDs may remain as display helpers only. They must
   not become source evidence IDs.
4. Runtime adoption must be validated before any UI control exposes `7 / 19 /
   37` as a simulation option.
5. This phase intentionally leaves the existing HOBS/SINR runtime untouched.

## 3. Identity Bridge Contract

Future adapters must bridge identity explicitly instead of choosing one ID
shape implicitly.

Canonical replay identity:

1. Producer satellite IDs remain canonical for replay, for example `sat-0`.
2. Producer beam IDs remain canonical for replay, for example
   `sat-0-beam-4`.
3. Producer `beamIndex` remains 0-based global satellite-major / beam-minor.
4. Producer `localBeamIndex` remains 0-based per satellite.
5. Producer candidate ordering and action-mask positions use `beamIndex`.

Core layout identity:

1. Core layout beam IDs are `${satId}-b${localIndex}`.
2. For MODQN replay-derived baseline adoption, Phase 4B should generate core
   layouts with `satId` equal to the producer satellite ID unless it introduces
   an explicit satellite bridge table.
3. If a later live scene needs a different scene satellite ID, the adapter must
   keep `producerSatId`, `coreLayoutSatId`, and `leoSceneSatId` as separate
   fields.

Leo display identity:

1. Leo local numeric beam ID is `localBeamIndex + 1`.
2. Leo global numeric beam ID is `beamIndex + 1`.
3. Numeric IDs are derived display IDs only. They are useful for current labels
   such as `B5`, but they are not provenance IDs.

Required mapping fields for every bridged beam:

| Field | Example for producer `sat-0-beam-4` | Source | Rule |
| --- | --- | --- | --- |
| `producerSatId` | `sat-0` | Producer artifact | Canonical replay satellite ID. |
| `producerBeamId` | `sat-0-beam-4` | Producer artifact | Canonical replay beam ID. |
| `producerBeamIndex` | `4` | Producer artifact | `satIndex * beamCountPerSatellite + localBeamIndex`; 0-based. |
| `producerLocalBeamIndex` | `4` | Producer artifact | 0-based per satellite. |
| `coreLayoutSatId` | `sat-0` | Adapter input to core layout | Prefer producer ID for replay-derived baseline adoption. |
| `coreBeamId` | `sat-0-b4` | Vendored layout | `${coreLayoutSatId}-b${producerLocalBeamIndex}`. |
| `leoSceneSatId` | explicit map value | Leo scene/runtime | May differ from producer ID only through a deterministic bridge. |
| `leoLocalBeamNumericId` | `5` | Derived display helper | `producerLocalBeamIndex + 1`; never provenance. |
| `leoGlobalBeamNumericId` | `5` | Derived display helper | `producerBeamIndex + 1`; never provenance. |

For 19/37 live sensitivity modes, `producerBeamIndex` must not be invented as
producer evidence unless a producer artifact supplies it. A live-mode adapter
may compute a runtime global index with the selected live beam count, but it
must label that field as runtime/core identity, not producer replay identity.

## 4. Beam-Count Contract

The beam-count claim boundary is fixed:

| Beam count | Status | Allowed use |
| ---: | --- | --- |
| `7` | Accepted regenerated baseline MODQN evidence path. | May be tied to the selected producer-owned baseline bundle, subject to its regenerated-run limitations. |
| `19` | Live sensitivity/demo extension only. | May affect future simulation truth only after runtime adoption and validation. Must never be labeled trained baseline MODQN evidence. |
| `37` | Live sensitivity/demo extension only. | Same limits as `19`. Must never be labeled trained baseline MODQN evidence. |

Before runtime adoption, current UI density controls and local visual beam
selection are display behavior only. They must not be relabeled as truth-level
`7 / 19 / 37` controls.

If a future `19` or `37` mode reuses a `7`-beam trained policy, masks extra
beams, projects decisions, or falls back to a deterministic/heuristic selector,
that behavior must be disclosed as sensitivity/demo adapter behavior. It is not
trained baseline MODQN evidence unless `modqn-paper-reproduction` later
promotes a matching artifact.

## 5. Runtime Adoption Sequence

Phase 4B should be a pure code adapter and validator phase. It should not add
UI controls or visual behavior.

Recommended sequence:

1. **Phase 4B:** implement a local identity/layout bridge and validator. It
   should map producer IDs, core beam IDs, global/local indexes, Leo numeric
   display IDs, and optional Leo scene satellite IDs. It should prove 7-beam
   parity with Phase 2 identity and Phase 3B layout invariants.
2. **Later runtime truth phase:** switch a narrow runtime path to consume the
   bridged layout for beam geometry/reuse truth. Keep HOBS/SINR and MODQN
   claims labeled separately.
3. **Later controls phase:** expose beam-count controls only after the runtime
   truth path and invalidation/reset behavior are validated.
4. **Later browser validation phase:** run browser/UI validation only after
   runtime wiring and labels exist.

Do not skip straight to UI controls. A control without the adapter/validator
would create a high risk of treating display density, numeric IDs, or HOBS
runtime behavior as MODQN baseline truth.

## 6. Local Conflict Inventory For Phase 4B

Current surfaces that need care before runtime adoption:

| Surface | Current status | Phase 4B risk |
| --- | --- | --- |
| `src/scene/beam-layout.ts` | Defines `MAX_BEAMS_PER_SATELLITE = 7`, returns numeric `beamId`, starts IDs at `1`, and uses polar ring offsets. | Blocks true 19/37 runtime layout and conflicts with core 0-based string IDs and axial hex offsets. |
| `src/core/beam/layout.ts`, `src/core/beam/types.ts` | Vendored Phase 3B layout slice is isolated. It emits string IDs `${satId}-b${index}`, ENU offsets, `isActive`, and `reuseGroup`. | Safe truth candidate, but not currently wired into runtime. The adapter must not mutate it to match Leo numeric IDs. |
| `src/modqn/replay-bundle/identity.ts` | Phase 2 preserves producer IDs, 0-based indexes, and derived 1-based Leo numeric helpers. | Good foundation, but it does not yet define `coreBeamId` or `coreLayoutSatId`. |
| `src/scene/types.ts` | `SimState`, `SimFrame`, `BeamCellState`, `SatBeamHopState`, `SignalSourceState`, and panel state use `beamId: number`. `RuntimeConfig.beamDensity` is display density. | Runtime adoption needs either a narrow bridge layer or a larger typed migration. Do not make `beamDensity` a beam-count preset. |
| `src/scene/useSimulation.ts` | Builds shell layouts from local `generateBeamOffsetsKm()`, keys assignments as `${satId}:${beamId}`, computes link samples, and drives HOBS handover. | Main runtime switch point. It currently inherits the 7-beam cap and numeric beam IDs. |
| `src/scene/beam-scheduler.ts` | Schedules numeric beam IDs, sorts numerically, and returns numeric active/candidate IDs. | Scheduler cannot accept core string IDs without adapter work; authored order must remain numeric-index order, not lexicographic string order. |
| `src/scene/useBeamViz.ts` | Imports `MAX_BEAMS_PER_SATELLITE`, uses numeric beam IDs, caps beam displays, and computes frequency index with local modulo helper. | Visualization can accidentally preserve display-only frequency labels after core `reuseGroup` becomes truth. |
| `src/viz/SatelliteBeams.tsx`, `src/viz/EarthFixedCells.tsx`, `src/viz/HandoverLinks.tsx`, `src/viz/ServingGroundRipple.tsx`, `src/viz/SpineParticles.tsx` | Beam callouts, hex paint, links, ripples, particles, and debug keys use numeric beam IDs or formatted `B#` display labels. | Must consume derived display IDs only, while provenance and core IDs remain available for diagnostics. |
| `src/utils/beamFrequency.ts`, `src/utils/formatSatelliteLabel.ts` | Frequency labels are derived from `(numericBeamId - 1) % frequencyReuse`. | This is not equivalent to vendored axial `reuseGroup`; future truth wiring must use core reuse groups for interference/color diagnostics. |
| `src/engine/signal/types.ts`, `src/engine/signal/link-budget.ts`, `src/engine/signal/power-control.ts` | Signal runtime is SINR/interference oriented, numeric-beam-ID based, and uses local modulo reuse groups. | Baseline MODQN paper evidence is SNR-like/no-interference. Do not present current SINR runtime as paper replay evidence. |
| `src/engine/handover/types.ts`, `src/engine/handover/handover-manager.ts`, `src/engine/handover/policies/sinr-offset.ts` | Handover state/events use numeric beam IDs and HOBS SINR-offset behavior. Initial attach is committed as `inter-handover` in the local manager. | MODQN replay event semantics must come from producer/core adapter, not from HOBS policy logs. Initial attach must not become a penalized MODQN inter-handover unless a source contract says so. |
| `src/App.tsx`, `src/scene/runtimeConfig.ts`, `src/ui/ControlBar.tsx` | Default profile is HOBS candidate-rich demo-readability. ControlBar exposes visual density labels `few / normal / many`, not truth beam count. | Future MODQN mode needs explicit labels and reset/invalidation behavior. Do not expose `7 / 19 / 37` here before Phase 4B passes. |
| `src/profiles/types.ts`, `src/profiles/hobs-2024-*.json` | Profiles are HOBS-focused. Current profiles use `beams.perSatellite: 7` and `frequencyReuse: 3`. | No MODQN profile or beam-count claim discriminator exists. HOBS profiles must not be relabeled as MODQN baseline. |
| Validators in `scripts/` and `package.json` | Phase 2 identity and Phase 3B layout validators exist. Many other validators are visual/HOBS/SINR oriented. | Phase 4B needs a new bridge validator; existing visual validators cannot prove MODQN runtime adoption safety. |

The broad numeric beam ID assumption is the main blocker. Phase 4B should avoid
a global type migration unless explicitly scoped. A safer first step is a
narrow bridge module with tests that proves round-trip mapping before any
runtime surface consumes it.

## 7. Non-Scope

Phase 4A does not include:

1. Runtime behavior changes.
2. UI controls.
3. Replay playback.
4. Artifact copy.
5. Training or retraining.
6. A new vendored module.
7. Scene migration.
8. Signal/SINR migration.
9. Handover migration.
10. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA, or any
    Catfish-family claim.

## 8. Phase 4A Acceptance Status

Phase 4A is complete when this document exists and remains self-contained:

1. `modqn-paper-reproduction` is preserved as MODQN evidence authority.
2. `ntn-sim-core` is preserved as validated module/contract authority.
3. `leo-beam-sim` is preserved as final runtime/demo host.
4. `7` remains the accepted regenerated baseline evidence path.
5. `19 / 37` remain sensitivity/demo extensions only.
6. The ID bridge is defined before runtime implementation.
7. Phase 4B blockers are inventoried.

## 9. Recommended Phase 4B Scope

Recommended Phase 4B changed files should be limited to code adapter and
validator surfaces, for example:

1. A new MODQN/core beam identity bridge module under `src/modqn/` or a narrow
   adjacent adapter path.
2. A new validator script that proves:
   - producer beam ID to core beam ID mapping;
   - producer global/local indexes remain 0-based;
   - Leo numeric IDs remain derived 1-based display helpers;
   - 7-beam producer replay identity matches the vendored 7-beam core layout;
   - 19/37 labels remain sensitivity/demo only;
   - no producer artifact row is mutated.
3. A package script for the validator.
4. Documentation update recording validator output.

Phase 4B should not edit `src/scene/useSimulation.ts`,
`src/scene/useBeamViz.ts`, `src/engine/signal/*`,
`src/engine/handover/*`, UI controls, profile JSON, or producer artifacts
unless a later controller-approved phase explicitly expands the scope.
