# MODQN Baseline Phase 6V Antenna-Pattern Convention

**Date:** 2026-05-12
**Status:** `BLOCKED_BY_PATTERN_CONVENTION`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** validator-only antenna-pattern convention resolution

Phase 6V resolves the Phase 6U beam-gain mismatch as far as the current
provenance allows. It adds a validator that compares the current Leo HOBS/SINR
beam-gain helper, the vendored `src/core/channel/beam-gain.ts` helper, and the
Phase 6U diameter/beamwidth adapter candidate.

Runtime adoption status after Phase 6V: **not adopted**.

## Added Surface

1. `scripts/validate-modqn-phase6v-antenna-pattern-convention.ts`
2. `scripts/fixtures/modqn-phase6v-antenna-pattern-convention.json`
3. `docs/modqn-baseline-phase6v-antenna-pattern-convention.md`
4. `package.json` script
   `validate:modqn:phase6v-antenna-pattern-convention`

The validator does not change live runtime behavior, source formulas, profiles,
UI, scene wiring, handover behavior, MODQN replay inputs, producer artifacts,
or vendored `ntn-sim-core` source files.

## Compared Conventions

Phase 6V admits these provenance-backed comparisons:

1. `leo-current-hobs-itu-normalized-j1j3`: current
   `src/engine/signal/beam-gain.ts`, documented in-code as
   `PAP-2024-HOBS Eq.(3)` / `ITU-R S.672-4`. It uses the Leo profile
   `beamwidth3dBRad` directly, `alphaScale=1.835239914925094`,
   boresight-envelope normalization `1.75`, and a `-40 dB` floor.
2. `vendored-ntn-sim-core-j1j3-raw-diameter`: current
   `src/core/channel/beam-gain.ts`, vendored in Phase 6F after source-side
   validation. It derives `theta3db=atan(D/(2h))`, uses `u=2.07123`, and
   evaluates `(J1(u)/(2u)+36*J3(u)/u^3)^2`.
3. `phase6u-diameter-beamwidth-adapter-candidate`: validator-only candidate
   that passes `D=2h*tan(theta3dB)` so the vendored helper sees the same
   `theta3dB` as the Leo profile. This is provenance-backed by the
   `ntn-sim-core` HOBS source map note deriving `D=63.87 km` from
   `theta3dB=0.058 rad` and `h=550 km`.

No extra curve-fit candidate is admitted. A calibrated `u` scale or alternate
envelope could reduce residuals, but Phase 6V found no source-map, paper, or
vendored-code authority for treating that as an adapter-only fix.

## Result

Phase 6V status: `BLOCKED_BY_PATTERN_CONVENTION`.

Phase 6U full-window mismatch metrics remain the governing integration
evidence:

| Metric | Raw core vs engine | Diameter-adapted core vs engine |
| --- | ---: | ---: |
| max absolute beam-gain difference | `49.212753 dB` | `51.839327 dB` |
| mean absolute beam-gain difference | `17.250813 dB` | `2.427126 dB` |
| p50 absolute beam-gain difference | `8.495537 dB` | `2.490353 dB` |
| mean absolute link-impact estimate | `17.250813 dB` | `2.427126 dB` |
| p50 absolute link-impact estimate | `8.495537 dB` | `2.490353 dB` |

The diameter adapter fixes the dominant diameter/beamwidth mapping issue, but
the residual remains above the Phase 6V `0.25 dB` adapter tolerance.

The Phase 6V same-theta convention sweep covers the three required profiles at
ten off-axis ratios from boresight through `3x` profile beamwidth:

| Metric | Raw source diameter | Phase 6U diameter-adapted |
| --- | ---: | ---: |
| cases | `30` | `30` |
| max absolute mismatch | `39.145584 dB` | `11.983848 dB` |
| mean absolute mismatch | `15.456815 dB` | `2.764619 dB` |
| p50 absolute mismatch | `10.768916 dB` | `1.785050 dB` |

Representative same-theta samples:

| Off-axis ratio | Leo current | Source raw | Source adapted | Adapted residual |
| --- | ---: | ---: | ---: | ---: |
| `0x` | `0.000000 dB` | `0.000000 dB` | `0.000000 dB` | `0.000000 dB` |
| `0.5x` | `-0.726336 dB` | `-5.235732 dB` | `-2.511385 dB` | `-1.785050 dB` |
| `1x` | `-3.000000 dB` | `-13.768916 dB` | `-5.235732 dB` | `-2.235732 dB` |
| `1.5x` | `-7.184602 dB` | `-39.710605 dB` | `-7.137610 dB` | `0.046992 dB` |
| `2.5x` | `-31.201285 dB` | `-52.328069 dB` | `-25.284628 dB` | `5.916657 dB` |

## Residual Cause

The remaining residual is explainable by J1+J3 pattern convention, not by
off-axis mapping, scan-loss mapping, peak-gain placement, or implementation
loss placement.

The key same-theta difference is:

1. Leo current helper: profile `theta3dB` is direct input; J1+J3 uses the Leo
   calibrated alpha scale plus envelope normalization and clamps at `-40 dB`.
2. Vendored source helper: source `theta3dB` is derived from diameter; J1+J3
   uses the source `u=2.07123` convention and no `-40 dB` floor in the helper.

After the Phase 6U adapter maps diameter to the same `theta3dB`, those
formula-family differences are the residual. Therefore an adapter-only fix is
**not defensible** unless a later phase explicitly chooses a provenance-backed
J1+J3 convention.

## Runtime Non-Adoption Evidence

The Phase 6V validator scans these live/runtime surfaces:

1. `src/engine/signal`
2. `src/engine/handover`
3. `src/scene`
4. `src/profiles`
5. `src/ui`
6. `src/modqn`
7. `src/App.tsx`
8. `src/signalTuning.ts`
9. `src/handoverPolicyTuning.ts`

Expected scan result: `PASS`. No live runtime surface imports the Phase 6V
validator, and no live runtime surface switches to `src/core/channel`.

## Claim Boundary

Phase 6V establishes no new MODQN evidence.

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only and must not be described as
   trained baseline MODQN evidence.
3. HOBS/SINR live output remains separate from MODQN replay evidence.
4. Phase 6V diagnostics are not MODQN policy, reward, replay, training, or
   producer evidence.
5. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-family effectiveness, and physical energy-saving claims remain
   non-scope.

## Validation

Required validation for Phase 6V:

1. `git diff --check`
2. `npm run validate:modqn:phase6u-beam-gain-mismatch`
3. `npm run validate:modqn:phase6t-source-channel-shadow-kpi`
4. `npm run validate:modqn:phase6v-antenna-pattern-convention`
5. `npm run lint`
6. runtime non-adoption scan
7. unsupported `19` / `37` trained-baseline claim scan
8. stale Phase 6M adapter-parity token scan

The Phase 6T validator is expected to remain guarded while drift exceeds the
Phase 6S gate.

Browser smoke is intentionally not run because Phase 6V has no
browser-visible runtime, scene, label, panel, control, or UI behavior change.

## Recommended Phase 6W Scope

Phase 6W should not implement runtime adoption or UI controls.

Valid next steps are:

1. choose and document a provenance-backed J1+J3 convention, then test a
   validator-only shadow adapter; or
2. keep the source-channel shadow path blocked by pattern convention.

Do not promote source-backed channel runtime adoption until the Phase 6S drift
gate passes.
