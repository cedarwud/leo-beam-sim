# MODQN Baseline Phase 6A Signal/Handover Reuse Readiness

**Date:** 2026-05-12
**Status:** docs-only readiness audit
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Phase 6B readiness:** `NEEDS_SOURCE_VENDORING`

Phase 6A inventories the current signal, handover, association, KPI, profile,
and tuning surfaces before any future attempt to let Phase 5A/5B frequency
reuse metadata affect live signal or handover behavior.

This phase does not change runtime behavior, source code, package scripts,
tests, profile JSON, producer artifacts, or `ntn-sim-core`. It does not vendor
modules, run browser smoke, or run long validation.

## 1. Authority And Claim Boundaries

The boundaries from Phase 1 through Phase 5D remain active:

1. `modqn-paper-reproduction` remains the MODQN evidence authority.
2. `ntn-sim-core` remains the validated module, contract, and validator
   authority.
3. `leo-beam-sim` remains the final runtime/demo host under ADR-002.
4. `7` beams remains the accepted regenerated baseline MODQN evidence path.
5. `19` and `37` remain live sensitivity/demo extensions only.
6. `19` and `37` must not be described as trained baseline MODQN evidence.
7. HOBS/SINR live simulator behavior must not be labeled MODQN replay evidence.
8. Display-only transforms must not alter SINR/SNR, interference terms,
   handover events, policy decisions, rewards, deterministic IDs, masks, or
   provenance.

## 2. Phase 5A/5B Metadata Inventory

Phase 5A/5B reuse metadata currently exists in these local surfaces:

| Local path | Metadata present | Current role |
| --- | --- | --- |
| `src/scene/beam-layout.ts` | `reuseGroup`, `reuseGroupSource`, `runtimeFrequencyReuse`, `coreLayoutFrequencyReuse`, `coreBeamId`, `coreLocalBeamIndex` on `CoreSceneBeamOffsetKm` | Runtime beam geometry adapter. It maps vendored core layout reuse for K=`1/3/7` and compatibility reuse labels for K=`2/4/5/6`. It remains capped to current 7-beam runtime. |
| `src/scene/types.ts` | Same metadata on `BeamCellState`; frequency-source metadata on `AmbientRing`, `VisualBeamTarget`, `VisualFrequencyDiagnosticsEntry`, and `VizFrame.visualFrequencyByBeamKey` | Shared scene/viz type surface. Metadata is available to visual consumers and diagnostics. |
| `src/scene/useSimulation.ts` | Copies Phase 5A metadata into `CandidateBeamCell`, `BeamCellState`, `beamCellsBySatId`, and `steeringBeamCellsBySatId` | Runtime geometry propagation only. It does not pass metadata into signal behavior. |
| `src/utils/beamFrequency.ts` | `resolveBeamFrequencyIndex()` prefers `reuseGroup` metadata, with source labels `core-layout` or `runtime-frequency-reuse-compatibility`; fallback is numeric modulo | Visual frequency-label resolver. |
| `src/scene/useBeamViz.ts` | Consumes metadata through `resolveVisualFrequency()` for beam cones, ambient rings, and `visualFrequencyByBeamKey` | Display and diagnostics only. |
| `src/scene/MainScene.tsx` | Builds `visualFrequencyDiagnostics` from `VizFrame.visualFrequencyByBeamKey` | Diagnostics payload only. |
| `src/ui/DiagnosticsDrawer.tsx` | Displays primary/comparison F source, runtime K, and core FRF | Diagnostics only. |
| `scripts/validate-modqn-phase5a-runtime-beam-layout.ts` | Validates Phase 5A metadata propagation and claim boundaries | Local validator only. |
| `scripts/validate-modqn-phase5b-visual-reuse-metadata.ts` | Validates visual metadata preference over numeric modulo | Local validator only. |
| `scripts/validate-modqn-phase5c-frequency-diagnostics.ts` | Validates diagnostics drawer payload/readout | Local validator only. |
| `scripts/validate-modqn-phase5d-frequency-diagnostics-browser.mjs` | Browser-smokes diagnostics visibility | Browser validation only; not run in Phase 6A. |

Important distinction: `reuseGroupSource: core-layout` is core layout reuse
metadata for K=`1/3/7`. `reuseGroupSource:
runtime-frequency-reuse-compatibility` is a Leo compatibility label for current
HOBS/SINR runtime K=`2/4/5/6`; it is not core-backed reuse truth.

## 3. Behavior-Affecting Surface Inventory

These surfaces currently depend on numeric `beamId`, `frequencyReuse`,
SINR/SNR or interference logic, HOBS thresholds, or intra/inter handover
semantics.

| Local path | Current dependency | Behavior risk before source vendoring |
| --- | --- | --- |
| `src/engine/signal/types.ts` | `LinkSample.beamId: number`, `ActiveBeamAssignment.beamId: number`, `SatelliteSnapshot.beamCellsKm[].beamId: number`, SINR/interference fields | Signal truth is numeric-beam-ID based. The type has no `reuseGroup`, `coreBeamId`, or producer/core identity field. |
| `src/engine/signal/link-budget.ts` | Computes HOBS-shaped SINR; groups co-channel interference with `getBeamFrequencyIndex(entry.sample.beamId, beamConfig.frequencyReuse)` | This is the main blocker. Live interference still uses numeric modulo, not Phase 5A `reuseGroup`. Changing it would change SINR and handover inputs. |
| `src/engine/signal/power-control.ts` | Keys DPC state by `${satId}:${beamId}` and uses `sample.sinrDb` plus `powerControl.sinrThresholdDb` | Any SINR grouping change changes DPC behavior and effective transmit power. |
| `src/engine/handover/types.ts` | `ServingState`, `HandoverDecision`, and `HandoverEvent` use numeric beam IDs; actions are `stay`, `intra-switch`, `inter-handover` | Event shape is compatible with intra/inter concepts, but not with core string beam IDs or MODQN replay IDs. |
| `src/engine/handover/handover-manager.ts` | Sorts `LinkSample[]` by SINR; uses `sinrThresholdDb`, `offsetDb`, `triggerTimeSec`, `pingPongGuardSec`, `pendingTargetHoldSec`, `intraSwitchTimeSec`, `sinrSmoothingSec`; commits initial attach as `inter-handover` | Behavior is HOBS SINR-offset live policy. It must not be reclassified as MODQN replay behavior. Initial attach semantics differ from MODQN replay boundary. |
| `src/engine/handover/policies/sinr-offset.ts` | Legacy HOBS Algorithm 2 policy using SINR offset, trigger threshold, and numeric beam IDs | Existing but not the active manager path. Still part of the HOBS behavior surface. |
| `src/scene/beam-scheduler.ts` | Schedules, sorts, and returns numeric beam IDs; `toBeamState()` drops reuse metadata before `useSimulation` rehydrates it from `beamCellById` | Scheduler behavior remains numeric-ID ordered. A core string-ID switch would be a larger migration. |
| `src/scene/useSimulation.ts` | Builds beam cells, candidate beam sets, active assignments, link samples, HOBS manager inputs, recent-HO state, and KPI-facing `hoCount` | Association truth lives here. It propagates metadata for visuals, but signal behavior still receives numeric beam IDs and profile `frequencyReuse`. |
| `src/scene/useBeamViz.ts` | Uses SINR ranking for display selection and visual beam labeling; consumes metadata only for visual frequency labels | Display selection is not signal truth, but it can create claim confusion if visual reuse colors are treated as behavior evidence. |
| `src/scene/MainScene.tsx` | Builds panel primary/comparison state, latched SINR, budget readouts, visible beam keys, and visual diagnostics | UI state depends on HOBS live SINR and numeric beam IDs. Diagnostics read metadata but do not change behavior. |
| `src/viz/EarthFixedCells.tsx` | Chooses dominant cell cover by role priority, SINR, display order, and beam key `${satelliteId}:B${beamId}` | Hex-cell association is display overlay only. It must not become traffic/action truth without source-backed data. |
| `src/utils/beamFrequency.ts` | `getBeamFrequencyIndex()` uses `(beamId - 1) % frequencyReuse`; `resolveBeamFrequencyIndex()` uses metadata only when present | Safe for display. Unsafe as a signal source unless adopted through a validated channel/interference module. |
| `src/utils/formatSatelliteLabel.ts` | Formats numeric beam labels and handover reasons using `frequencyReuse` and `getBeamFrequencyIndex()` | Label-only, but can mislead if used as proof of signal grouping. |
| `src/ui/InfoPanel.tsx` | Displays HOBS live SINR, delta SINR, formula terms, and handover trigger progress using numeric beam identities | Operational readout only. It must not be labeled MODQN replay evidence. |
| `src/ui/DiagnosticsDrawer.tsx` | Displays effective handover policy, active numeric IDs, last HO reason, visual frequency source | Diagnostics only. |
| `src/ui/SignalTuningPanel.tsx` | Exposes K=`1..7` frequency reuse as a SINR formula control and Handover Policy controls | Tuning directly affects live HOBS/SINR behavior. K=`2/4/5/6` are compatibility labels, not core reuse truth. |
| `src/ui/HandoverPolicyControls.tsx` | Exposes HOBS handover thresholds/timers | Tuning directly affects live handover behavior. |
| `src/signalTuning.ts` | Applies `frequencyReuse` into `profile.beams.frequencyReuse` and reset/evidence keys | Direct signal-behavior input. |
| `src/handoverPolicyTuning.ts` | Applies handover policy fields into `profile.handover` and reset keys | Direct handover-behavior input. |
| `src/profiles/types.ts` | Defines profile `beams.frequencyReuse`, `beams.perSatellite`, `handover.*`, channel and DPC SINR thresholds | Profile truth is HOBS-oriented, not MODQN baseline replay truth. |
| `src/profiles/hobs-2024-candidate-rich.json` | `beams.perSatellite: 7`, `frequencyReuse: 3`, HOBS `sinr-offset` thresholds, beam hopping enabled | Demo HOBS profile; not MODQN evidence. |
| `src/profiles/hobs-2024-paper-default.json` | `beams.perSatellite: 7`, `frequencyReuse: 3`, HOBS `sinr-offset` thresholds | HOBS paper-default profile; not MODQN evidence. |
| `src/profiles/hobs-2024-tr38811-research.json` | `beams.perSatellite: 7`, `frequencyReuse: 3`, HOBS `sinr-offset` thresholds, DPC `sinrThresholdDb` | Research HOBS/TR 38.811 profile; not MODQN evidence. |
| `src/App.tsx` | Default profile is `hobs-2024-candidate-rich`; applies signal and handover tuning into the effective profile | Runtime mode remains HOBS/SINR live demo. |
| `package.json` | Registers HOBS validators and MODQN Phase 2 through Phase 5D validators | No validator currently proves behavior-changing reuse adoption in signal/handover. |

## 4. KPI And Validation Surface Inventory

Local KPI-like or validation surfaces that would be affected by signal/handover
reuse adoption:

| Local path | Current coverage | Gap for Phase 6B behavior adoption |
| --- | --- | --- |
| `scripts/validate-hobs-tr38811-phase1.ts` | HOBS/TR 38.811 signal-path validation | Does not prove core-layout `reuseGroup` can replace numeric modulo in live interference. |
| `scripts/validate-hobs-tr38811-phase2-dpc.ts` | DPC validation using current `computeLinkBudget()` and numeric beam IDs | Would need updates only after a validated source-backed signal behavior port. |
| `scripts/benchmark-hobs-tr38811-phase1.ts` | HOBS signal benchmark | Contextual only. |
| `scripts/benchmark-hobs-tr38811-phase2-dpc.ts` | HOBS DPC benchmark | Contextual only. |
| `scripts/validate-phase7b-sinr-display-ownership.tsx` | UI ownership for SINR readouts and formula terms | UI/readout validator, not behavior truth. |
| `scripts/validate-phase6b-handover-policy-controls.tsx` | Handover policy controls validation | UI/control validator, not source-backed handover truth. |
| `scripts/validate-modqn-phase5a-runtime-beam-layout.ts` | Current 7-beam runtime geometry and metadata validation | Stops before signal/handover behavior. |
| `scripts/validate-modqn-phase5b-visual-reuse-metadata.ts` | Visual reuse metadata validation | Display only. |
| `scripts/validate-modqn-phase5c-frequency-diagnostics.ts` | Diagnostics readout validation | Display only. |
| `docs/hobs-tr38811-sinr-mini-sdd.md` | Local HOBS + TR 38.811 signal/handover hardening plan | HOBS path, not MODQN replay evidence and not a substitute for vendored core behavior. |
| `docs/sinr-runtime-parameter-contract.md` | SINR tuning parameter ownership | Confirms K changes live co-channel grouping but does not authorize reuse metadata behavior adoption. |

No current local validator compares signal/handover KPIs against
`ntn-sim-core` frozen baselines after replacing numeric modulo interference
with `reuseGroup`.

## 5. Display-Only Vs Behavior Truth

Display-only reuse metadata currently includes:

1. visual beam cone and ambient ring frequency labels in `src/scene/useBeamViz.ts`;
2. `VizFrame.visualFrequencyByBeamKey` and the diagnostics payload in
   `src/scene/MainScene.tsx`;
3. `VISUAL FREQUENCY SOURCE` rows in `src/ui/DiagnosticsDrawer.tsx`;
4. hex-cell color selection in `src/viz/EarthFixedCells.tsx` through visual
   beam frequency colors;
5. formatting helpers in `src/utils/beamFrequency.ts` and
   `src/utils/formatSatelliteLabel.ts`.

Behavior-affecting signal/handover truth currently includes:

1. active beam assignment and candidate construction in `src/scene/useSimulation.ts`;
2. co-channel interference grouping in `src/engine/signal/link-budget.ts`;
3. DPC state updates in `src/engine/signal/power-control.ts`;
4. HOBS SINR-offset association and events in
   `src/engine/handover/handover-manager.ts`;
5. profile and tuning parameters in `src/profiles/*`, `src/signalTuning.ts`,
   and `src/handoverPolicyTuning.ts`.

Phase 5A/5B metadata is not currently behavior truth for live SINR or
handover. Treating it as behavior truth without source vendoring would change
the simulator's SINR, DPC, association, handover, and KPI semantics locally.

## 6. Required Source Before Behavior Adoption

Any Phase 6B that changes signal, handover, association, or KPI behavior must
first use validated `ntn-sim-core` sources and validators. The likely source
set is:

| Required source | Path in `/home/u24/papers/ntn-sim-core` | Why required |
| --- | --- | --- |
| Core purity rule | `src/core/README.md` and `scripts/validate-core-purity.mjs` | Confirms vendored source stays free of React, Three.js, browser, `viz/`, and `app/` dependencies. |
| Frequency reuse behavior | `src/core/beam/frequency-reuse.ts` plus already-vendored `src/core/beam/layout.ts` / `types.ts` | Provides source-owned co-channel grouping semantics instead of local numeric modulo. |
| Channel/SINR behavior | `src/core/channel/sinr.ts`, `src/core/channel/link-budget.ts`, `src/core/channel/types.ts`, and dependent channel modules | Required before changing `computeLinkBudget()` interference or SINR behavior. |
| Engine channel integration | `src/core/engine/channel-step.ts` and `src/core/engine/channel-sinr-helpers.ts` | Shows how core beam selection, reuse group, interference caps, UE geometry, and SINR are combined. |
| Handover behavior | `src/core/handover/types.ts`, `src/core/handover/sinr-offset.ts`, `src/core/handover/manager.ts`, and related baseline modules as scoped | Required before changing HOBS thresholds, intra/inter event semantics, attach/release handling, or string beam IDs. |
| Engine handover integration | `src/core/engine/handover-step.ts` | Publishes same-satellite beam-switch and inter-satellite handover transitions from core serving endpoints. |
| KPI behavior | `src/core/kpi/*` and `src/core/engine/kpi-step.ts` | Required before claiming no KPI drift after behavior changes. |
| Runtime profiles/contracts | `src/core/profiles/defaults-hobs.ts`, `src/core/profiles/defaults-modqn.ts`, `src/core/contracts/modqn-contracts.ts`, `src/core/contracts/kpi-v1.ts`, `src/core/contracts/runtime-v1.ts` | Required to keep HOBS live behavior, MODQN replay evidence, and KPI contracts distinct. |

Minimum source-side validation candidates before any behavior-changing Phase
6B:

1. `npm run validate:core-purity` in `/home/u24/papers/ntn-sim-core`;
2. `npm run validate:multibeam-gating` in `/home/u24/papers/ntn-sim-core`;
3. `npm run validate:golden-channel` in `/home/u24/papers/ntn-sim-core`;
4. the relevant MODQN validator set if replay or MODQN bridge semantics are
   touched: `validate:modqn`, `validate:modqn:m2`, `validate:modqn:m3`,
   `validate:modqn:parity`, `validate:modqn:bundle`;
5. matching frozen KPI comparison against:
   - `/home/u24/papers/ntn-sim-core/baseline-kpi-hobs-multibeam-baseline.json`;
   - `/home/u24/papers/ntn-sim-core/baseline-kpi-bh-resource-baseline.json`;
   - `/home/u24/papers/ntn-sim-core/baseline-kpi-case9-access-baseline.json`;
   - `/home/u24/papers/ntn-sim-core/baseline-kpi-real-trace-validation.json`.

Destination-side Phase 6B would also need a new `leo-beam-sim` validator that
proves no KPI drift after the port. No such local validator exists today.

## 7. Narrowest Safe Phase 6B Boundary

**Recommended Phase 6B status:** `NEEDS_SOURCE_VENDORING`.

The narrowest safe behavior-changing Phase 6B would be:

1. vendor one source-owned behavior slice only, starting with
   `ntn-sim-core/src/core/beam/frequency-reuse.ts` plus the exact tests or a
   local equivalent validator;
2. do a kill-switch audit before copying;
3. run source-side validators and record relevant frozen KPI files;
4. add a destination-side validator proving the local behavior matches the
   vendored semantics;
5. only then consider a separate later change that lets live signal
   interference use `reuseGroup` instead of numeric modulo.

Phase 6B is **not ready** to change `src/engine/signal/link-budget.ts`,
`src/engine/handover/*`, `src/scene/useSimulation.ts`, `src/profiles/*`, or
tuning behavior from the Phase 5 metadata alone.

A docs/test-only Phase 6B could be ready if it is limited to a guard validator
that asserts reuse metadata remains display-only. That is not behavior
adoption and must not be described as signal/handover integration.

## 8. Blockers, Risks, And Kill-Switch Criteria

Blockers:

1. `src/engine/signal/link-budget.ts` still computes co-channel interference
   from numeric beam ID modulo `frequencyReuse`.
2. `src/engine/signal/types.ts` has no behavior-level `reuseGroup` or
   `coreBeamId` fields.
3. `src/engine/handover/handover-manager.ts` is HOBS SINR-offset behavior and
   uses numeric beam IDs.
4. K=`2/4/5/6` metadata is compatibility labeling, not core reuse truth.
5. No local Phase 6 validator proves no KPI drift for behavior adoption.
6. No source-side `ntn-sim-core` behavior module has been vendored for signal
   or handover in this phase.

Risks:

1. Claim drift: visual reuse metadata could be mistaken for MODQN replay
   evidence.
2. Signal drift: replacing numeric modulo with `reuseGroup` changes SINR,
   interference, DPC, and handover decisions.
3. Identity drift: local runtime uses numeric beam IDs while core handover and
   channel modules use string beam IDs.
4. Event drift: local initial attach is logged as `inter-handover`; MODQN
   replay initial attach must not become a penalized inter-handover without
   source authority.
5. Beam-count drift: current runtime remains 7-beam capped; `19/37` are not
   trained baseline MODQN evidence.
6. KPI drift: there is no no-drift comparison against `ntn-sim-core` frozen KPI
   files for this behavior change.

Kill-switch criteria for any future Phase 6B behavior adoption:

1. Stop if the source module imports React, Three.js, browser APIs, `viz/`, or
   `app/`.
2. Stop if source-side `ntn-sim-core` validators fail.
3. Stop if a required frozen KPI baseline is missing or drifts after porting.
4. Stop if implementation requires batching channel, handover, KPI, profile,
   and UI behavior in one PR.
5. Stop if K=`2/4/5/6` compatibility labels are treated as core-backed reuse
   truth.
6. Stop if wording claims `19/37` trained baseline MODQN evidence.
7. Stop if HOBS/SINR live simulator behavior is labeled MODQN replay evidence.
8. Stop if display code becomes the source of signal, handover, policy,
   reward, deterministic ID, mask, or provenance truth.

## 9. Phase 6A Validation Plan

Phase 6A validation is intentionally narrow:

1. run `git diff --check`;
2. run a text scan over this new document proving no unsupported `19/37`
   trained-baseline claim was introduced;
3. report `git status --short`.

No browser smoke, long validation, module vendoring, package-script edit,
source-code edit, profile edit, producer artifact edit, or `ntn-sim-core` edit
is part of Phase 6A.
