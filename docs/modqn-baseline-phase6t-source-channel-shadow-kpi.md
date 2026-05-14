# MODQN Baseline Phase 6T Source Channel Shadow KPI

**Date:** 2026-05-12
**Status:** `SHADOW_COMPARISON_DRIFT_EXCEEDS_GATE`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** validator-only source-backed channel shadow KPI comparison

Phase 6T adds a validator-only comparison that computes vendored
`src/core/channel` output beside the current HOBS/SINR live-runtime frames. It
does not change live runtime behavior, does not add a runtime flag, does not
change UI, does not change handover policy, does not change DPC, does not
change beam-count controls, and does not touch replay or producer artifacts.

Runtime adoption status after Phase 6T: **not adopted**.

## Added Surface

1. `scripts/validate-modqn-phase6t-source-channel-shadow-kpi.ts`
2. `scripts/fixtures/modqn-phase6t-source-channel-shadow-kpi.json`
3. `docs/modqn-baseline-phase6t-source-channel-shadow-kpi.md`
4. `package.json` script
   `validate:modqn:phase6t-source-channel-shadow-kpi`

The validator intentionally imports the vendored channel helpers only from the
script. The shared live helper `src/scene/runtimeFrameStep.ts` remains on the
current HOBS/SINR engine path.

## Method

The validator:

1. loads the Phase 6P HOBS/SINR KPI fixture;
2. uses the shared Phase 6Q `stepRuntimeFrame()` path to produce the same
   baseline frames for the three Phase 6P profiles;
3. computes a shadow `LinkSample` set from vendored `src/core/channel`
   `computeLinkBudget()`, `computeSinr()`, and LOS helper output;
4. keeps the HOBS/SINR baseline as the authoritative runtime path;
5. feeds the shadow samples only into a validator-local shadow
   `HandoverManager`;
6. compares Phase 6P baseline KPIs against the shadow KPIs using the Phase 6S
   drift thresholds; and
7. scans runtime surfaces to prove Phase 6T is not adopted by live code.

The Phase 6T fixture records the drift-gate values and the adapter policy:
`implementationLoss = phase6n-local-pathloss-minus-core-fspl`, shadow
handover is validator-only, and DPC consumes baseline effective TX power with
no shadow feedback adoption.

## Result

Phase 6T status: `SHADOW_COMPARISON_DRIFT_EXCEEDS_GATE`.

The validator completed the shadow comparison and found no structural adoption
leak, but the source-backed shadow channel KPIs exceed the Phase 6S drift
gate. The largest link-level differences are beam-gain driven:

| Profile | Phase 6P p50 finite SINR | Shadow p50 finite SINR | p50 drift | Failed thresholds |
| --- | ---: | ---: | ---: | ---: |
| `hobs-2024-paper-default` | `-1.686948 dB` | `-7.986139 dB` | `6.299191 dB` | `3` |
| `hobs-2024-candidate-rich` | `-25.535500 dB` | `-45.640235 dB` | `20.104735 dB` | `5` |
| `hobs-2024-tr38811-research` | `-3.058240 dB` | `-10.867030 dB` | `7.808790 dB` | `5` |

The failed Phase 6S thresholds are:

1. p50 finite SINR drift for all three profiles;
2. low-SINR count below the handover threshold for all three profiles;
3. low-SINR count below `0 dB` for all three profiles;
4. total handover count for `hobs-2024-candidate-rich` and
   `hobs-2024-tr38811-research`; and
5. intra-switch count for `hobs-2024-candidate-rich` and
   `hobs-2024-tr38811-research`.

Sample counts, finite/non-finite SINR counts, raw inter-handover count, initial
attach count, inter-handover count excluding initial attach, DPC state, active
assignment summaries, active beam-cell summaries, and reuse distributions pass
their Phase 6S checks.

## K Semantics

The Phase 6T profiles use K=`3`. The validator confirms all encountered K=`3`
samples are core-backed with `reuseGroupSource === "core-layout"`.

K=`1`, K=`3`, and K=`7` remain the only core-backed FRF values. If future
fixtures encounter K=`2`, K=`4`, K=`5`, or K=`6`, they must remain labeled
`INTENTIONAL_NON_CORE_PARITY` and must not emit source-backed FRF claims.

## Runtime Non-Adoption Evidence

The Phase 6T validator scans:

1. `src/engine/signal`
2. `src/engine/handover`
3. `src/scene`
4. `src/profiles`
5. `src/ui`
6. `src/modqn`
7. `src/App.tsx`
8. `src/signalTuning.ts`
9. `src/handoverPolicyTuning.ts`

The expected result is `PASS`: no live runtime surface imports the Phase 6T
validator and no live runtime surface switches to `src/core/channel`.

## Claim Boundary

Phase 6T establishes no new MODQN evidence.

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only and must not be described as
   trained baseline MODQN evidence.
3. HOBS/SINR live output remains separate from MODQN replay evidence.
4. Source-backed channel shadow output is not MODQN policy, reward, replay,
   training, or producer evidence.
5. Channel parity, shadow KPI comparison, and runtime frame-step guards do not
   create MODQN policy, reward, training, replay, or producer evidence.
6. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-family effectiveness, and physical energy-saving claims remain
   non-scope.

## Validation

Required validation for Phase 6T:

1. `git diff --check`
2. `npm run validate:modqn:phase6t-source-channel-shadow-kpi`
3. `npm run validate:modqn:phase6p-hobs-sinr-kpi-baseline`
4. `npm run validate:modqn:phase6o-channel-adapter-parity`
5. `npm run validate:modqn:phase6r-runtime-frame-step-boundary`
6. `npm run lint`
7. unsupported `19` / `37` trained-baseline claim scan
8. HOBS/SINR-live-as-MODQN-replay-evidence claim scan
9. runtime non-adoption scan

The Phase 6T validator exits nonzero while the drift gate is exceeded. That is
the intended guard behavior: the comparison was computed, but runtime adoption
is not authorized.

Browser smoke is intentionally not run because Phase 6T has no browser-visible
runtime, scene, label, panel, control, or UI behavior change.

## Recommended Phase 6U Scope

Phase 6U should remain validator-only or adapter-only. Recommended scope:
isolate the beam-gain mismatch between the current HOBS/SINR engine helper and
the vendored `src/core/channel/beam-gain.ts`, then rerun the Phase 6T shadow
KPI comparison. Do not add a live runtime flag, UI mode, handover behavior
change, browser-visible control, producer-artifact change, or claim promotion
until the Phase 6S drift gate passes.
