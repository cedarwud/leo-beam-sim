# MODQN Baseline Phase 6U Beam-Gain Mismatch

**Date:** 2026-05-12
**Status:** `BLOCKED_BY_MODEL_DIFFERENCE`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** validator-only beam-gain mismatch characterization

Phase 6U adds a diagnostic validator that isolates why the Phase 6T
source-channel shadow path drifts from the current HOBS/SINR live-runtime
path. It does not change live runtime behavior, source formulas, profiles, UI,
handover policy, DPC, replay inputs, producer artifacts, MODQN policy, or
beam-count controls.

Runtime adoption status after Phase 6U: **not adopted**.

## Added Surface

1. `scripts/validate-modqn-phase6u-beam-gain-mismatch.ts`
2. `scripts/fixtures/modqn-phase6u-beam-gain-mismatch.json`
3. `docs/modqn-baseline-phase6u-beam-gain-mismatch.md`
4. `package.json` script
   `validate:modqn:phase6u-beam-gain-mismatch`

## Method

The validator compares the current engine helper
`src/engine/signal/beam-gain.ts` against the vendored helper
`src/core/channel/beam-gain.ts`.

Coverage includes:

1. analytic center-beam, off-axis beam, and scan-loss cases;
2. the Phase 6T deterministic windows for
   `hobs-2024-paper-default`, `hobs-2024-candidate-rich`, and
   `hobs-2024-tr38811-research`;
3. candidate-rich samples from the Phase 6T shadow geometry; and
4. TR 38.811-like samples from the Phase 6T shadow geometry.

For each sample, the validator computes:

1. current engine beam gain;
2. vendored core beam gain with the raw Phase 6T beam diameter;
3. vendored core beam gain with a diameter-adapted mapping that makes the
   core helper's `atan(diameter / (2 * altitude))` angle match the engine
   profile's full `beamwidth3dBRad`; and
4. an RSRP/link-level impact estimate using the same implementation-loss
   placement policy as Phase 6T.

## Result

Phase 6U status: `BLOCKED_BY_MODEL_DIFFERENCE`.

Across `750` covered cases:

| Metric | Raw core vs engine | Diameter-adapted core vs engine |
| --- | ---: | ---: |
| max absolute beam-gain difference | `49.212753 dB` | `51.839327 dB` |
| mean absolute beam-gain difference | `17.250813 dB` | `2.427126 dB` |
| p50 absolute beam-gain difference | `8.495537 dB` | `2.490353 dB` |
| mean absolute link-impact estimate | `17.250813 dB` | `2.427126 dB` |
| p50 absolute link-impact estimate | `8.495537 dB` | `2.490353 dB` |

Representative cases:

| Case | Engine gain | Raw core gain | Diameter-adapted core gain | Raw diff |
| --- | ---: | ---: | ---: | ---: |
| center beam | `0.000000 dB` | `0.000000 dB` | `0.000000 dB` | `0.000000 dB` |
| off-axis at engine 3 dB width | `-3.000000 dB` | `-13.768916 dB` | `-5.235732 dB` | `-10.768916 dB` |
| scan-loss fixture | `-0.726336 dB` | `-5.235732 dB` | `-2.511385 dB` | `-4.509396 dB` |
| candidate-rich sample | `-14.331257 dB` | `-63.544010 dB` | `-13.685869 dB` | `-49.212753 dB` |
| TR 38.811-like sample | `-6.875225 dB` | `-40.017272 dB` | `-6.840589 dB` | `-33.142047 dB` |

## Root Cause

The mismatch is characterized, but an adapter-only fix is **not ready**.

Observed causes:

1. `beam-diameter-beamwidth-conversion`: root cause. Phase 6T passes the
   runtime layout diameter into the core helper. For `bessel-j1j3`, the core
   helper interprets that diameter as `theta3db = atan(diameter / (2 *
   altitude))`, while the engine helper uses the profile's full
   `beamwidth3dBRad` directly. Diameter adaptation reduces mean absolute drift
   from `17.250813 dB` to `2.427126 dB`.
2. `antenna-model-mismatch`: root cause. After the diameter mapping is adapted,
   the residual p50 difference remains `2.490353 dB`, above the Phase 6U
   `1 dB` model-difference threshold. This comes from the different J1+J3
   pattern conventions and constants used by the two helpers.

Not observed as root causes:

1. `off-axis-angle-mapping`: engine sample recompute max absolute difference
   is `0 dB`.
2. `peak-gain-convention`: both Bessel helpers emit relative beam-pattern
   gain; antenna max gain is applied outside the helper.
3. `scan-loss-mapping`: max absolute scan-loss difference is `0 dB`.
4. `implementation-loss-placement`: max absolute implementation-loss placement
   difference is `0 dB`.
5. `beam-gain-floor-convention`: no covered Phase 6U case reached the engine
   `-40 dB` beam-gain floor while core remained below that floor.

## Runtime Non-Adoption Evidence

The validator scans these live/runtime surfaces:

1. `src/engine/signal`
2. `src/engine/handover`
3. `src/scene`
4. `src/profiles`
5. `src/ui`
6. `src/modqn`
7. `src/App.tsx`
8. `src/signalTuning.ts`
9. `src/handoverPolicyTuning.ts`

Expected scan result: `PASS`. No live runtime surface imports the Phase 6U
validator, and no live runtime surface switches to `src/core/channel`.

## Claim Boundary

Phase 6U establishes no new MODQN evidence.

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only and must not be described as
   trained baseline MODQN evidence.
3. HOBS/SINR live output remains separate from MODQN replay evidence.
4. Source-channel shadow and Phase 6U beam-gain diagnostics are not MODQN
   policy, reward, replay, training, or producer evidence.
5. Channel parity, shadow KPI comparison, and beam-gain mismatch
   characterization do not create MODQN policy, reward, training, replay, or
   producer evidence.
6. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-family effectiveness, and physical energy-saving claims remain
   non-scope.

## Validation

Required validation for Phase 6U:

1. `git diff --check`
2. `npm run validate:modqn:phase6u-beam-gain-mismatch`
3. `npm run validate:modqn:phase6t-source-channel-shadow-kpi`
4. `npm run validate:modqn:phase6p-hobs-sinr-kpi-baseline`
5. `npm run lint`
6. unsupported `19` / `37` trained-baseline claim scan
7. HOBS/SINR-live-as-MODQN-replay-evidence claim scan

Browser smoke is intentionally not run because Phase 6U has no
browser-visible runtime, scene, label, panel, control, or UI behavior change.

## Recommended Phase 6V Scope

Phase 6V should stay validator-only or adapter-design-only. Recommended scope:
resolve the J1+J3 antenna-pattern convention first, then test a narrow
adapter mapping for beam diameter/beamwidth in the Phase 6T shadow validator.

Do not add a live runtime flag, UI control, handover behavior change, replay
mutation, producer-artifact change, browser-visible mode, or claim promotion
until the Phase 6S drift gate passes.
