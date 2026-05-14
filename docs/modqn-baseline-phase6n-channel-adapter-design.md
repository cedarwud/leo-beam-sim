# MODQN Baseline Phase 6N Channel Adapter Design

**Date:** 2026-05-12
**Status:** docs-only adapter design and parity-fixture specification
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Decision:** `READY_FOR_PARITY_VALIDATOR`

Phase 6N defines the proposed `LeoChannelCoreAdapter` contract and the fixture
shape that a later Phase 6O read-only parity validator should implement before
any vendored channel or link-budget helper is adopted into live runtime
behavior.

This phase does not implement adapter code, add validators, change package
scripts, vendor files, mutate producer artifacts, change UI labels, run browser
smoke, or change signal, handover, scene, profile, replay, or MODQN policy
behavior.

## 1. Phase 6N Decision Status

**Decision status: `READY_FOR_PARITY_VALIDATOR`.**

Rationale:

1. Phase 6M concluded that the pure channel and link-budget helper surfaces are
   already present locally and that the remaining blocker is an explicit adapter
   contract.
2. This document defines the required identity, geometry, profile, LOS,
   fading, shadowing, Doppler, DPC, tier-flag, reuse-group, interference-set,
   and output mappings.
3. It also defines the Phase 6O fixture matrix, tolerance policy, intentional
   non-parity fields, and JSON report shape.
4. A read-only validator can now be written against this contract without
   switching runtime behavior.

This status means only that Phase 6O may build a parity validator. It does not
mean runtime adoption is ready, does not authorize a behavior switch, and does
not promote HOBS/SINR live output to MODQN replay evidence.

## 2. Adapter Role

`LeoChannelCoreAdapter` should be a pure mapping layer between the current Leo
runtime snapshot and the vendored channel/link-budget helpers:

```text
Leo frame/profile/tuning snapshot
  -> LeoChannelCoreAdapter input
  -> src/core/channel computeLinkBudget() per link
  -> src/core/channel computeSinr() per candidate
  -> Leo LinkSample-compatible output plus parity metadata
```

The adapter must not own orbit propagation, beam layout generation, handover
policy decisions, DPC feedback updates, MODQN replay truth, or UI latching. It
should consume those values as snapshot inputs and return deterministic channel
terms for validation or future runtime composition.

## 3. Proposed `LeoChannelCoreAdapter` Contract

The adapter input should be serializable JSON so a parity validator can snapshot
it without React, Three.js, browser state, or wall-clock dependence.

### 3.1 Input Identity Fields

Each adapted link must carry all identity families side by side:

| Field | Requirement |
| --- | --- |
| `adapterVersion` | Literal contract version, initially `phase6n-leo-channel-core-adapter-v1`. |
| `caseId` | Stable fixture case ID. |
| `profileId` | Leo profile ID, for example `hobs-2024-paper-default`. |
| `formulaFamily` | Leo formula family, currently `hobs-legacy` or `hobs-tr38811`. |
| `signalTuningKey` | Stable key from the tuning state used to build the fixture. |
| `handoverTuningKey` | Stable key for handover tuning when the frame depends on current serving/pending state. |
| `epochUtcMs` | Replay epoch used to generate the snapshot, if orbit-derived. |
| `simTimeSec` | Simulation time of the frozen frame. |
| `frameSlotIndex` | Beam-hopping frame slot index, or `-1` when disabled. |
| `leoSatId` | Current Leo scene/runtime satellite ID. |
| `leoBeamId` | Current Leo numeric beam ID, 1-based local compatibility ID. |
| `leoAssignmentKey` | `${leoSatId}:${leoBeamId}` for DPC and current runtime compatibility. |
| `coreLayoutSatId` | Satellite ID supplied to `generateHexagonalBeamLayout()`. |
| `coreBeamId` | Core string beam ID, shaped as `${coreLayoutSatId}-b${coreLocalBeamIndex}`. |
| `coreLocalBeamIndex` | Core 0-based local beam index. |
| `runtimeFrequencyReuse` | Leo runtime K requested by the profile or tuning state. |
| `coreLayoutFrequencyReuse` | Core FRF passed to the layout generator; must be `1`, `3`, or `7`. |
| `reuseGroup` | Effective reuse group emitted by the scene beam metadata. |
| `reuseGroupSource` | `core-layout` or `runtime-frequency-reuse-compatibility`. |
| `producerSatId` | Optional producer satellite ID when the sample is replay-bound. |
| `producerBeamId` | Optional producer beam ID when the sample is replay-bound. |
| `producerBeamIndex` | Optional 0-based global producer beam index. |
| `producerLocalBeamIndex` | Optional 0-based local producer beam index. |
| `producerEvidenceStatus` | `not-replay`, `accepted-7beam-baseline`, or a later explicit value. |
| `serializationKey` | Deterministic key over profile, tuning, frame, Leo ID, and core ID. |

The adapter must preserve Leo numeric IDs for existing panels, DPC keys, and
handover readouts, but it must never treat numeric IDs as the source identity.
Core and producer IDs remain separate fields.

### 3.2 Geometry, Range, Elevation, and Scan Inputs

Each link input must provide geometry that is already detached from display
world coordinates:

| Field | Requirement |
| --- | --- |
| `rangeKm` | Slant range used by the channel calculation. |
| `rangeSource` | `topocentric`, `tr38811-slant`, or `fixture-literal`. |
| `elevationDeg` | Link elevation in degrees. |
| `azimuthDeg` | Snapshot azimuth for traceability; not required by core channel math. |
| `satAltitudeKm` | Satellite altitude used for beamwidth/off-axis mapping. |
| `satEcefKm` | Optional source ECEF vector for traceability only. |
| `ueLatDeg`, `ueLonDeg` | UE geodetic position from the Leo snapshot. |
| `ueOffsetEastKm`, `ueOffsetNorthKm` | UE ENU offset relative to observer. |
| `beamCenterOffsetEastKm`, `beamCenterOffsetNorthKm` | Beam-center ENU offset relative to observer. |
| `ueDistanceToBeamCenterKm` | `hypot(ueOffset - beamCenterOffset)` for Leo-compatible off-axis mapping. |
| `offAxisAngleDeg` | Adapter-computed value used in `BeamGainInput.offAxisAngleDeg`. |
| `offAxisSource` | `leo-ground-distance-over-altitude`, `core-geodetic`, or `fixture-literal`. |
| `beamDiameterKm` | Diameter passed to core `BeamGainInput`. |
| `beamwidth3dBDeg` | Leo profile beamwidth for traceability. |
| `scanAngleDeg` | Runtime scan angle from the scene beam cell. |
| `scanMaxAngleDeg` | Leo antenna max steering angle. |
| `scanLossMaxDb` | Leo scan loss at max steering angle. |

For Phase 6O parity, `offAxisSource` should be
`leo-ground-distance-over-altitude` because that is the current Leo runtime
behavior. `core-geodetic` may be introduced later as a source-backed mode, but
it must be reported as a distinct mode if it changes beam gain.

### 3.3 Channel, Noise, EIRP, Bandwidth, and Profile Inputs

The adapter must map Leo profile and signal-tuning fields into explicit core
channel options:

| Leo/profile value | Adapter/core value |
| --- | --- |
| `channel.frequencyGHz` | `LinkBudgetOptions.frequencyGhz`. |
| `channel.bandwidthMHz` | `bandwidthHz = bandwidthMHz * 1e6`. |
| `channel.noisePsdDbmHz` | `noisePowerDbm = noisePsdDbmHz + 10 * log10(bandwidthHz)`. |
| `channel.maxTxPowerDbm` | Fallback `txPowerDbm` when no DPC override exists. |
| DPC override map | Effective `txPowerDbm` for the Leo assignment key. |
| `antenna.maxGainDbi` | Fold into `txEirpDbm = txPowerDbm + antenna.maxGainDbi`. |
| `ueAntenna.maxGainDbi` | `LinkBudgetOptions.rxAntennaGainDb`. |
| `antenna.model` | `bessel-j1-j3 -> bessel-j1j3`, `bessel-j1 -> bessel-j1`, `flat -> flat-debug`. |
| `antenna.beamwidth3dBRad` | Traceability plus beam diameter/off-axis derivation. |
| `channel.pathLossComponents` | Adapter tier policy, not implicit core defaults. |
| `channel.lossOverrides` | Leo-compatible fixed implementation losses for Phase 6O. |
| `channel.tr38811.environment` | Core `environment`; current Leo profile type allows `suburban`. |
| `channel.tr38811.nlosClutterLossDb` | Leo-compatible NLOS implementation loss in Phase 6O. |

For Phase 6O Leo-compatible parity, core `implementationLossDb` should equal
the deterministic non-FSPL propagation loss from the current Leo path:

```text
implementationLossDb =
  localPathLossDb - coreFsplDb
```

This keeps current Leo deterministic atmospheric, scintillation, shadow-margin,
and optional NLOS clutter behavior comparable without pretending those local
terms are the same as source-backed stochastic core tiers.

### 3.4 LOS, Fading, Shadowing, Doppler, DPC, and Tier-Flag Policy

The adapter must expose policy choices instead of hiding them in defaults:

| Policy surface | Phase 6O Leo-compatible parity rule | Source-backed future rule |
| --- | --- | --- |
| LOS | `hobs-legacy` forces `isLos=true`; `hobs-tr38811` snapshots `isLos` from a deterministic seed key. | May use vendored `sampleLosStateTr38811()` with recorded seed key and environment. |
| LOS seed | Record `${leoSatId}|${leoBeamId}|floor(simTimeSec)` for current Leo parity. | If the seed policy changes, record `losSeedPolicy` and mark old fixtures stale. |
| Shadowing | Keep core `tier1LargeScale=false`; carry Leo fixed shadow margin through `implementationLossDb`. | Enable `tier1LargeScale=true` only with seeded `rngNext`; report as source-tier non-parity against current Leo. |
| Clutter | Keep core `tier2Clutter=false`; carry Leo NLOS clutter through `implementationLossDb`. | Enable `tier2Clutter=true` for source-backed NLOS core mode. |
| Atmospheric | Keep core `tier4Atmospheric=false`; carry Leo atmospheric/scintillation values through `implementationLossDb`. | Enable `tier4Atmospheric=true` with `largeScaleModel='3gpp-extended'` only as source-backed non-parity. |
| Beam gain | `tier3BeamGain=true`; use Leo-compatible off-axis and beam diameter mapping. | Same, unless a future source-backed geometry mode is explicitly selected. |
| Scan loss | `tier35ScanLoss=true` when frequency is Ka-band and Leo scan loss inputs are finite; otherwise false. | Same policy unless core source contract changes. |
| Small-scale fading | `tier5Fading=false`. | May enable `shadowed-rician` or `loo` only with seeded RNG and explicit non-parity reporting. |
| Doppler | Disabled for `LinkSample` parity; optional diagnostic only. | May compute `dopplerHz` and `dopplerLossDb`, but no current `LinkSample` field may hide the loss. |
| DPC | Adapter consumes a fixed `beamPowerOverrideDbmByKey` snapshot and does not update DPC state. | DPC feedback updates remain owned by `src/engine/signal/power-control.ts` or a later explicit core module. |

Minimum tier flags for the Phase 6O parity validator:

```json
{
  "tier1LargeScale": false,
  "tier2Clutter": false,
  "tier3BeamGain": true,
  "tier35ScanLoss": true,
  "tier4Atmospheric": false,
  "tier5Fading": false,
  "largeScaleModel": "3gpp-baseline"
}
```

Fixtures may set `tier35ScanLoss=false` for a no-scan control case.

### 3.5 Frequency-Reuse and Interference-Set Mapping

The adapter must build interference sets from active assignments and beam
metadata, not from visible labels.

Core-backed FRF cases:

1. `runtimeFrequencyReuse` must be `1`, `3`, or `7`.
2. `reuseGroupSource` must be `core-layout`.
3. `coreLayoutFrequencyReuse` must equal `runtimeFrequencyReuse`.
4. Co-channel interferers are active beams with the same `reuseGroup` as the
   candidate link, excluding the candidate link itself.
5. Same satellite interferers feed `intraInterferingRxPowersDbm`.
6. Different satellite interferers feed `interInterferingRxPowersDbm`.
7. Inactive beams must not contribute interference even when their reuse group
   matches.

Compatibility K cases:

1. `runtimeFrequencyReuse` may be `2`, `4`, `5`, or `6`.
2. `reuseGroupSource` must be `runtime-frequency-reuse-compatibility`.
3. `coreLayoutFrequencyReuse` is expected to be `1` because the core layout
   does not support those FRF values.
4. These cases are valid Leo compatibility fixtures, but they are intentional
   non-core parity cases.
5. The Phase 6O report must set `coreParityEligible=false` for these cases.

If reuse metadata is missing in a core-backed case, the validator should fail
the case instead of falling back to numeric modulo. Numeric modulo is allowed
only in explicitly labeled compatibility cases.

### 3.6 Output Mapping to Leo `LinkSample`

The adapter output should include raw core results and a Leo-compatible sample:

| Output field | Mapping |
| --- | --- |
| `channelResult` | Vendored `ChannelResult` returned by core `computeLinkBudget()`. |
| `sinrResult` | Vendored `SinrResult` returned by core `computeSinr()`. |
| `linkSample.satId` | `leoSatId`. |
| `linkSample.beamId` | `leoBeamId`. |
| `linkSample.rsrpDbm` | `channelResult.rxPowerDbm`. |
| `linkSample.signalDbm` | `sinrResult.signalDbm`; must equal serving `rxPowerDbm` for active association. |
| `linkSample.sinrDb` | `sinrResult.sinrDb`. |
| `linkSample.intraInterferenceDbm` | Linear sum of intra-satellite interferer received powers; `-Infinity` when empty for Leo compatibility. |
| `linkSample.interInterferenceDbm` | Linear sum of inter-satellite interferer received powers; `-Infinity` when empty for Leo compatibility. |
| `linkSample.noiseDbm` | `sinrResult.noiseDbm`. |
| `linkSample.denominatorDbm` | Linear sum of intra + inter + noise. |
| `linkSample.txPowerDbm` | Effective DPC-overridden or profile max TX power before satellite antenna gain. |
| `linkSample.pathLossDb` | `fsplDb + implementationLossDb + shadowFadingDb + clutterLossDb + atmosphericDb`. |
| `linkSample.beamGainDb` | `channelResult.beamGainDb`. |
| `linkSample.steeringLossDb` | `channelResult.scanLossDb`. |
| `linkSample.receiverGainDbi` | Adapter input `rxAntennaGainDb`. |

`SinrResult.interferenceDbm` is a total interference value. Leo still needs
separate intra/inter readouts, so the adapter must compute and preserve the two
subtotals before calling or while calling `computeSinr()`.

Small-scale fading and Doppler have no current Leo `LinkSample` fields. If a
future source-backed mode enables them, the adapter must carry them in metadata
and list them as intentionally non-parity until the runtime contract is
expanded.

## 4. Phase 6O Fixture Specification

Phase 6O should add read-only fixtures and a validator only. It should not
switch live runtime behavior.

### 4.1 Fixed Leo Profiles and Tuning States

Snapshot these profiles with default signal tuning from
`createSignalTuningState()` and default handover tuning from
`createHandoverPolicyTuningState()`:

| Fixture group | Profile | Purpose |
| --- | --- | --- |
| `paper-default-k3-no-bh` | `hobs-2024-paper-default` | Deterministic HOBS legacy profile with beam hopping disabled, K=`3`, no DPC. |
| `candidate-rich-k3-bh` | `hobs-2024-candidate-rich` | Current default demo profile with beam hopping enabled, K=`3`, and richer satellite set. |
| `tr38811-k3-dpc` | `hobs-2024-tr38811-research` | TR 38.811 live path with fixed LOS seed policy and DPC override snapshots. |

Then derive explicit frequency-reuse tuning variants:

1. Core-backed FRF variants: K=`1`, K=`3`, and K=`7`.
2. Compatibility variants: K=`2`, K=`4`, K=`5`, and K=`6`.

For DPC fixtures, the fixture must store the exact
`beamPowerOverrideDbmByKey` map. It must not rely on running DPC feedback
inside the validator.

### 4.2 Deterministic Frame, UE, Satellite, and Beam Samples

Every fixture frame should store literal snapshot data:

1. `epochUtcMs`, `simTimeSec`, `profileId`, `signalTuningKey`, and
   `handoverTuningKey`;
2. UE `latDeg`, `lonDeg`, `offsetEastKm`, and `offsetNorthKm`;
3. satellite `id`, `shellId`, `altitudeKm`, `rangeKm`, `rangeSource`,
   `elevationDeg`, and `azimuthDeg`;
4. beam cells with Leo numeric ID, core ID, core local index, ENU offsets,
   scan angle, reuse group, runtime K, core FRF, and reuse source;
5. active assignments and display assignments as separate lists; and
6. optional serving/pending/recent-HO state only as context, not as a handover
   validator.

Recommended deterministic link cases:

| Case ID | Required shape |
| --- | --- |
| `single-sat-center-no-interference` | One satellite, center beam, UE at beam center, no active interferer. |
| `single-sat-offaxis-no-interference` | One satellite, non-center beam, finite off-axis gain and scan loss. |
| `same-sat-same-reuse-intra` | Serving/candidate beam plus one same-satellite active co-channel interferer. |
| `same-sat-different-reuse-excluded` | Same-satellite active beam in a different reuse group, excluded from interference. |
| `dual-sat-same-reuse-inter` | One different-satellite active co-channel interferer. |
| `dual-sat-mixed-intra-inter` | At least one intra and one inter interferer in the same candidate denominator. |
| `inactive-same-reuse-excluded` | Same-reuse beam present in geometry but absent from active assignments. |
| `tr38811-nlos-dpc-fixed` | TR 38.811 profile with `isLos=false` and a fixed TX-power override. |

The validator may generate these from a captured Leo frame or from a small
literal fixture builder, but the checked fixture file should store final
numbers so parity is deterministic and reviewable.

### 4.3 Serving and Interferer Cases

For each candidate link, the fixture should state:

1. whether the candidate is the serving link for SINR association;
2. whether `associationActive` is true;
3. the candidate's active status;
4. the full active-assignment set for the frame;
5. the expected co-channel set by identity;
6. the expected intra-satellite interferer IDs; and
7. the expected inter-satellite interferer IDs.

The candidate link itself must never be counted as its own interferer.

### 4.4 Intra/Inter Interference Cases

The Phase 6O fixture matrix must cover:

1. no interference: denominator equals noise only;
2. intra-only interference: finite `intraInterferenceDbm`,
   `interInterferenceDbm=-Infinity`;
3. inter-only interference: finite `interInterferenceDbm`,
   `intraInterferenceDbm=-Infinity`;
4. mixed interference: both subtotals finite;
5. inactive same-reuse geometry excluded; and
6. different-reuse active geometry excluded.

The report should compare both subtotal fields and the total denominator.

### 4.5 K=`1/3/7` Core-Backed FRF Cases

Core-backed FRF fixtures must include K=`1`, K=`3`, and K=`7`.

Required assertions:

1. `reuseGroupSource === 'core-layout'`;
2. `coreLayoutFrequencyReuse === runtimeFrequencyReuse`;
3. co-channel sets are same-`reuseGroup` sets from vendored layout metadata;
4. no numeric-modulo fallback was used;
5. `coreParityEligible === true`; and
6. K=`1` includes all other active beams as co-channel interferers.

For 19/37 layouts, any fixture is a live sensitivity/demo layout fixture only.
It must not be described as trained baseline MODQN evidence.

### 4.6 K=`2/4/5/6` Compatibility Cases

Compatibility fixtures must include K=`2`, K=`4`, K=`5`, and K=`6`.

Required assertions:

1. `reuseGroupSource === 'runtime-frequency-reuse-compatibility'`;
2. `coreLayoutFrequencyReuse === 1`;
3. compatibility grouping is derived from Leo runtime compatibility metadata;
4. `coreParityEligible === false`;
5. report status is `INTENTIONAL_NON_CORE_PARITY`; and
6. no source-backed FRF claim is emitted for those cases.

These fixtures are still useful because they protect current Leo HOBS/SINR
behavior while making clear that K=`2/4/5/6` are not core-backed FRF truth.

## 5. Tolerance and Report Shape

### 5.1 Exact-Match Fields

The validator should require exact matches for:

1. profile ID, formula family, tuning keys, epoch, and frame time;
2. Leo, core, and optional producer identity fields;
3. beam index base conversions;
4. runtime K, core FRF, reuse group, and reuse source;
5. active-assignment membership;
6. intra/inter interferer identity sets;
7. LOS source, LOS seed key, and `isLos`;
8. tier flags and tier mode;
9. DPC override key and selected TX-power source;
10. association-active status; and
11. intentional non-parity labels.

### 5.2 Numeric Tolerance Fields

Recommended hard tolerances for Phase 6O:

| Field group | Tolerance |
| --- | --- |
| `noiseDbm`, `txPowerDbm`, `receiverGainDbi` | exact after JSON number parse, or absolute <= `1e-9`. |
| `fsplDb`, `implementationLossDb`, `scanLossDb` | absolute <= `1e-6` dB. |
| `beamGainDb` | absolute <= `0.25` dB; report warning above `0.05` dB. |
| `pathLossDb`, `rsrpDbm`, `signalDbm` | absolute <= `0.25` dB. |
| `intraInterferenceDbm`, `interInterferenceDbm`, `denominatorDbm` | absolute <= `0.25` dB for finite values; exact sentinel handling for empty sets. |
| `sinrDb` | absolute <= `0.25` dB for finite values. |
| finite/sentinel fields | `-Infinity` and core `-300` must be normalized by declared field policy before comparison. |

The validator should compute and report maximum absolute difference per field
even when the case passes.

### 5.3 Intentionally Non-Parity Fields

The report must identify these as intentional non-parity unless a later SDD
changes the contract:

1. K=`2/4/5/6` frequency-reuse compatibility cases;
2. source-backed stochastic shadow fading versus Leo fixed shadow margin;
3. source-backed clutter tables versus Leo fixed NLOS clutter override;
4. source-backed atmospheric tier versus Leo deterministic atmospheric and
   scintillation overrides;
5. small-scale fading;
6. Doppler shift or Doppler SINR degradation;
7. DPC feedback next-state updates;
8. handover smoothing, timers, event timing, and UI recent-HO latches;
9. MODQN replay action, reward, mask, and policy diagnostics;
10. 19/37 trained-baseline claims, which remain unsupported; and
11. UI labels, camera, visual density, and panel latching.

### 5.4 Required Validator JSON Summary Keys

The Phase 6O validator should write a JSON summary with at least:

```json
{
  "schemaVersion": "phase6o-channel-adapter-parity-summary-v1",
  "phase": "6O",
  "phase6NDecisionStatus": "READY_FOR_PARITY_VALIDATOR",
  "adapterVersion": "phase6n-leo-channel-core-adapter-v1",
  "generatedAt": "ISO-8601 timestamp",
  "repo": "leo-beam-sim",
  "gitHead": "string-or-null",
  "runtimeBehaviorChanged": false,
  "browserSmokeRun": false,
  "overallStatus": "PASS | FAIL",
  "caseCount": 0,
  "coreParityEligibleCaseCount": 0,
  "compatibilityCaseCount": 0,
  "intentionalNonParityCaseCount": 0,
  "exactMismatchCount": 0,
  "numericToleranceFailureCount": 0,
  "maxAbsDiffByField": {},
  "unsupported1937TrainedBaselineClaimScan": "PASS | FAIL",
  "modqnReplayEvidenceClaimScan": "PASS | FAIL",
  "cases": [],
  "nonParityFields": [],
  "failures": []
}
```

Each `cases[]` entry should include:

1. `caseId`;
2. `profileId`;
3. `formulaFamily`;
4. `runtimeFrequencyReuse`;
5. `coreLayoutFrequencyReuse`;
6. `beamCountPerSatellite`;
7. `reuseGroupSource`;
8. `coreParityEligible`;
9. `status`;
10. `exactMismatches`;
11. `numericDiffs`;
12. `interferenceSetDiffs`;
13. `nonParityFields`; and
14. `notes`.

## 6. Claim and Ownership Boundaries

The following boundaries remain active:

1. `modqn-paper-reproduction` remains the MODQN evidence authority for
   baseline training/evaluation artifacts, action/reward/policy diagnostics,
   provenance, and claim boundaries.
2. `ntn-sim-core` remains the validated module, contract, fixture, and
   validator authority for vendored core modules and source-side validation.
3. `leo-beam-sim` remains the final runtime/demo host for live composition,
   rendering, camera, UI, and future validated runtime integration.
4. `7` beams remains the accepted regenerated baseline MODQN evidence path.
5. `19` and `37` remain sensitivity/demo only unless a future producer-owned
   artifact is explicitly promoted by `modqn-paper-reproduction`.
6. HOBS/SINR live output is not MODQN replay evidence.
7. Channel parity does not create MODQN policy, reward, training, or replay
   evidence.
8. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA, Catfish EE,
   physical energy-saving, and Catfish-family effectiveness claims remain
   non-scope.

## 7. Recommended Phase 6O Scope

Phase 6O should implement only a read-only adapter parity validator and fixture
set:

1. add literal parity fixtures for the profile, tuning, frame, reuse, and
   interference cases defined above;
2. implement `LeoChannelCoreAdapter` only inside the validator or a narrow
   non-runtime helper path;
3. compare current Leo-compatible channel terms against vendored core
   `ChannelResult` and `SinrResult` mappings;
4. emit the required JSON summary;
5. run lint/type checks only if TypeScript validator code is added;
6. run the unsupported 19/37 trained-baseline claim scan; and
7. keep browser smoke, runtime adoption, UI labels, package-script promotion,
   producer artifacts, and handover behavior out of scope unless a later phase
   explicitly authorizes them.
