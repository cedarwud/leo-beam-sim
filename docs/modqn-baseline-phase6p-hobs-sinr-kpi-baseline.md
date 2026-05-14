# MODQN Baseline Phase 6P HOBS/SINR KPI Baseline

**Date:** 2026-05-12
**Status:** `PASS`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** read-only KPI baseline capture for the current HOBS/SINR live runtime path

Phase 6P adds a validator and fixture for the current
`leo-beam-sim` HOBS/SINR path before any future vendored channel runtime
adoption. It does not change signal, handover, scene, profile, UI, replay,
producer-artifact, or MODQN policy behavior.

Phase 6Q, completed after the original Phase 6P capture, extracted the shared
non-React runtime frame-step helper used by both `useSimulation.ts` and this
validator. The KPI values did not drift; only the script-addressability status
changed from `PARTIAL_BASELINE_CAPTURED` to `PASS`.

## Added Surface

1. `scripts/validate-modqn-phase6p-hobs-sinr-kpi-baseline.ts`
2. `scripts/fixtures/modqn-phase6p-hobs-sinr-kpi-baseline.json`
3. `src/scene/runtimeFrameStep.ts`
4. `package.json` script
   `validate:modqn:phase6p-hobs-sinr-kpi-baseline`

The validator is read-only. It loads the fixture, recomputes the current KPI
baseline through the shared runtime frame-step helper, then compares the
recomputed summary with the fixture.

## Script Addressability Status

Phase 6P is now `PASS`.

The current runtime can be deterministically stepped by script without a
browser, React hooks, UI state, wall-clock randomness, or runtime behavior
changes. `src/scene/useSimulation.ts` remains the React hook/orchestrator, but
the reusable HOBS/SINR frame-step path now lives in
`src/scene/runtimeFrameStep.ts` and is imported by both the hook and the
validator.

There is no remaining Phase 6P script-addressability blocker.

## Fixed Capture Settings

All baselines use:

| Setting | Value |
| --- | --- |
| Epoch | `Date.UTC(2026, 0, 1, 0, 0, 0)` |
| Loop | `true` |
| Frame dt | `0.2 s` |
| Runtime speed | `5x` |
| Sim step per frame | `1 s` |
| Frame count | `60` |
| Beam count | `7` |
| Frequency reuse K | `3` |

Profile windows:

| Profile | Start offset | First frame | Last frame |
| --- | ---: | ---: | ---: |
| `hobs-2024-paper-default` | `1065 s` | `1066 s` | `1125 s` |
| `hobs-2024-candidate-rich` | `450 s` | `451 s` | `510 s` |
| `hobs-2024-tr38811-research` | `1065 s` | `1066 s` | `1125 s` |

## KPI Fixture Summary

| Profile | Finite SINR samples | SINR p50 dB | Low below HO threshold | Events | Intra | Inter excluding attach | Initial attach | DPC |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `hobs-2024-paper-default` | `308` | `-1.686948` | `53` | `4` | `3` | `0` | `1` | disabled |
| `hobs-2024-candidate-rich` | `130` | `-25.535500` | `106` | `11` | `10` | `0` | `1` | disabled |
| `hobs-2024-tr38811-research` | `308` | `-3.058240` | `88` | `4` | `3` | `0` | `1` | enabled |

The fixture also records serving timeline segments, pending-target timeline
segments, recent-HO latch segments, active-assignment counts, active beam-cell
counts, reuse-group distributions, and DPC TX-power distribution where DPC is
enabled.

Initial attach is explicitly separated from inter-satellite handover count.
`HandoverManager` records initial attach as `inter-handover`; Phase 6P reports
that raw event while also reporting `interHandoverCountExcludingInitialAttach`.

## Claim Boundary

This baseline is current HOBS/SINR live-runtime evidence only. It is not MODQN
replay evidence.

The existing claim boundaries remain active:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only and must not be described as
   trained baseline MODQN evidence.
3. Channel KPI parity does not create MODQN policy, reward, training, replay,
   or producer evidence.
4. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-family effectiveness, and physical energy-saving claims are
   non-scope.

## Non-Adoption Evidence

The validator scans these runtime surfaces for Phase 6P/6Q validator tokens
and vendored `src/core/channel` imports:

1. `src/engine/signal`
2. `src/engine/handover`
3. `src/scene`
4. `src/profiles`
5. `src/ui`
6. `src/modqn`
7. `src/App.tsx`
8. `src/signalTuning.ts`
9. `src/handoverPolicyTuning.ts`

The expected scan result is `PASS`, proving the shared frame-step extraction did
not adopt vendored channel behavior into live runtime and did not couple runtime
surfaces to the Phase 6P validator.

## Recommended Phase 6R Scope

Phase 6R should remain read-only unless a separate adoption gate is explicitly
opened. Recommended scope: add a focused guard validator for the shared helper
boundary, document allowed imports, and keep runtime channel adoption as a later
phase with explicit before/after KPI drift gates and UI/replay claim labels.
