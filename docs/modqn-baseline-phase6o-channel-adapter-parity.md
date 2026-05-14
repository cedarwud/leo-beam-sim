# MODQN Baseline Phase 6O Channel Adapter Parity

**Date:** 2026-05-12
**Status:** read-only validator and literal fixture set
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Decision:** `READ_ONLY_PARITY_VALIDATOR_ADDED`

Phase 6O implements a script-only parity validator for the Phase 6N
`LeoChannelCoreAdapter` contract. It does not switch live runtime behavior and
does not add UI, handover, profile, replay, producer-artifact, or MODQN policy
adoption.

## Scope

Added surfaces:

1. `scripts/fixtures/modqn-phase6o-channel-adapter-parity.json`
2. `scripts/validate-modqn-phase6o-channel-adapter-parity.ts`
3. `package.json` script
   `validate:modqn:phase6o-channel-adapter-parity`

The adapter implementation is local to the validator script. The fixture file
stores literal snapshot inputs and expected numeric outputs. The validator
loads that fixture, calls the vendored `src/core/channel` helpers for
`ChannelResult` and `SinrResult`, and compares the mapped Leo-compatible
output.

## Fixture Coverage

The literal fixture matrix covers:

| Case | Coverage |
| --- | --- |
| `single-sat-center-no-interference` | center beam, no denominator contribution beyond noise |
| `single-sat-offaxis-no-interference` | off-axis beam gain plus scan loss |
| `same-sat-same-reuse-intra` | intra-satellite co-channel subtotal |
| `same-sat-different-reuse-excluded` | active same-satellite different-reuse beam excluded |
| `dual-sat-same-reuse-inter` | inter-satellite co-channel subtotal |
| `dual-sat-mixed-intra-inter` | simultaneous intra and inter subtotals |
| `inactive-same-reuse-excluded` | inactive same-reuse geometry excluded |
| `tr38811-nlos-dpc-fixed` | NLOS TR 38.811 fixture with fixed DPC power override |
| `frf-k3-core-backed` | K=3 core-layout reuse metadata |
| `frf-k7-core-backed` | K=7 core-layout reuse metadata |
| `compat-k2-non-core-parity` | K=2 compatibility metadata |
| `compat-k4-non-core-parity` | K=4 compatibility metadata |
| `compat-k5-non-core-parity` | K=5 compatibility metadata |
| `compat-k6-non-core-parity` | K=6 compatibility metadata |

K=`1`, K=`3`, and K=`7` fixtures are marked `coreParityEligible` only when
`reuseGroupSource` is `core-layout`. K=`2`, K=`4`, K=`5`, and K=`6` fixtures
are marked `INTENTIONAL_NON_CORE_PARITY`; they protect current Leo
compatibility behavior and are not source-backed FRF truth.

## Validator Checks

The validator checks:

1. exact identity fields for Leo numeric IDs, core string IDs, beam-index base
   conversion, profile/time/tuning metadata, LOS seed metadata, tier flags, DPC
   source metadata, and intended parity status;
2. core-layout reuse metadata against `generateHexagonalBeamLayout()` for
   K=`1/3/7`;
3. compatibility reuse metadata for K=`2/4/5/6` without core-backed FRF claims;
4. active assignment membership, co-channel sets, and intra/inter interferer
   identity sets;
5. numeric tolerance fields for core channel results, core SINR results, Leo
   link-sample mapping, denominator, and intra/inter subtotals;
6. runtime non-adoption by scanning signal, handover, scene, profile, UI, and
   MODQN runtime surfaces for Phase 6O adapter or `src/core/channel` imports;
7. unsupported 19/37 trained-baseline claim scan over changed files and MODQN
   phase docs; and
8. HOBS/SINR live-output-as-MODQN-replay-evidence claim scan.

The validator emits the Phase 6N summary keys with
`schemaVersion: phase6o-channel-adapter-parity-summary-v1`.

## Claim Boundary

The Phase 6O validator establishes only channel-adapter parity coverage:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only.
3. HOBS/SINR live output is not MODQN replay evidence.
4. Channel parity does not create MODQN policy, reward, training, or replay
   evidence.
5. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-over-HEA effectiveness, Catfish-family effectiveness, and physical
   energy-saving claims remain non-scope.

## Non-Adoption

Phase 6O does not change:

1. `src/engine/signal`;
2. `src/engine/handover`;
3. `src/scene`;
4. `src/profiles`;
5. `src/ui`;
6. `src/modqn`;
7. replay artifacts; or
8. MODQN policy behavior.

Browser smoke is intentionally not run because no browser-visible runtime,
scene, label, panel, or control behavior changes in this phase.

## Recommended Phase 6P Scope

Phase 6P should remain read-only unless a separate runtime-adoption plan is
approved. Recommended next scope is KPI baseline capture for the current
HOBS/SINR path using fixed profile, epoch, replay window, tuning state, DPC
state, serving timeline, pending-target timeline, recent-HO latch state,
finite-SINR distribution, outage counts, active-beam summary, and reuse summary.
Runtime channel adoption should wait for a later phase with explicit
before/after KPI drift gates and UI/replay claim labels.
