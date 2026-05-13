# MODQN Baseline Phase 7B Replay Live Adapter Contract

**Date:** 2026-05-12
**Status:** `CONTRACT_COMPLETE_PHASE7C_READY_WITH_FAIL_CLOSED_ARTIFACT_GATE`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** docs-only replay/live-adapter contract

Phase 7B defines how `leo-beam-sim` may later host baseline MODQN replay and
live-adapter surfaces without confusing them with current HOBS/SINR live
runtime output. It does not implement replay playback, runtime behavior, UI
mode switches, validators, package scripts, profile changes, source wiring,
artifact copies, producer exports, or vendored donor changes.

The first safe implementation path remains replay-first and bounded to the
accepted regenerated 7-beam producer bundle recorded in Phase 1 and Phase 7A.
HOBS/SINR live output remains a separate live simulator path and is not MODQN
replay evidence.

## 1. Mode Labels And Claim Boundaries

Every future state model, adapter, UI panel, log, screenshot, and validator
report must carry one explicit runtime/display mode. A frame must not be
interpretable as both MODQN replay evidence and HOBS/SINR live output.

| Mode key | Required user-facing label | Primary input | Allowed claim | Forbidden claim |
| --- | --- | --- | --- | --- |
| `modqn-replay-7beam` | `MODQN replay - 7-beam producer artifact` | Selected `phase-03a-replay-bundle-v1` producer bundle. | Evidence-capable replay of the selected regenerated 7-beam baseline artifact, subject to the artifact's disclosed limits. | No live SINR, HOBS policy, retraining, full paper-faithful reproduction, EE/HEA/Catfish-family, 19/37 trained-baseline, or inter-satellite handover claim unless source evidence supplies it. |
| `hobs-sinr-live` | `HOBS/SINR live` | Current Leo live runtime frame step, HOBS/SINR signal path, HandoverManager events, and HOBS profiles. | Live simulator behavior and current Phase 6P-style KPI evidence for the selected profile and tuning state. | No MODQN replay, MODQN action, MODQN reward, trained policy, or producer replay evidence claim. |
| `sensitivity-demo` | `Sensitivity/demo` | Future explicit adapter output, vendored modules, or fixture-only data. | Demo or sensitivity behavior with its source, policy rule, and validation scope disclosed. | No trained baseline claim for `19` or `37`; no producer replay identity derivation unless future producer evidence exists. |

Mode labels are part of the data contract, not only UI copy. They must survive
serialization into diagnostics and test fixtures so screenshots cannot be used
out of context.

## 2. Selected Replay Bundle Contract

The selected 7-beam replay bundle path is:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

This path is an external immutable producer input, not a file to copy or edit
inside `leo-beam-sim` during Phase 7B. A later adapter may accept a configured
path override for tests, but any non-selected path must be labeled explicitly as
fixture-only or non-evidence unless `modqn-paper-reproduction` promotes it.

Required bundle surfaces:

| Surface | Contract |
| --- | --- |
| `manifest.json` | Declares `paperId`, `bundleSchemaVersion`, `replayTruthMode`, `timelineFormatVersion`, coordinate frame, replay summary, beam catalog order, optional diagnostics disclosure, claim boundary, and evidence status. |
| `provenance-map.json` | Declares field-level provenance and classification. Consumers must preserve the difference between artifact-derived truth and visualization-only convenience fields. |
| `timeline/step-trace.jsonl` | Canonical ordered slot-row source. Replay truth comes from these rows, not from live runtime recomputation. |
| `evaluation/summary.json` | Optional summary surface for producer-owned evaluation metadata. Missing optional summaries must remain absence-honest. |
| `config-resolved.json`, `assumptions.json`, training summaries | Provenance support surfaces. A replay adapter may read them for diagnostics, but display needs must not mutate timeline truth. |

Current workspace availability note: docs in this repo select the path above,
but Phase 7B inspection of the producer checkout found that the directory is
not currently present under `modqn-paper-reproduction/artifacts/`. A Phase 7C
implementation must fail closed when the selected evidence path is missing,
or must use an explicitly labeled fixture/non-evidence path.

## 3. Timeline Row Inputs

For `modqn-replay-7beam`, a replay state model consumes producer timeline rows
with these logical fields. All fields are producer truth unless the bundle's
provenance map classifies them otherwise.

| Row field | Required handling |
| --- | --- |
| `slotIndex` | Source slot index. Current bundle semantics use first exported index `1`; slot `0` is reset state and has no exported row. |
| `timeSec` | Post-step replay time for the row. The renderer may interpolate motion between times, but may not invent intermediate decisions, rewards, or events. |
| `decisionTimeSec` | Decision-time timestamp for the selected action. If absent in a future source, the adapter must disclose absence rather than infer policy timing. |
| `userId`, `userIndex` | Producer user identity. Deterministic display key is `userId|userIndex`. |
| `userPosition`, `decisionUserPosition` | Source-owned user geometry in the declared coordinate frame. Display transforms may project it visually but must not rewrite it. |
| `previousServing`, `selectedServing` | Producer serving references before and after the decision. These are the MODQN action and event basis. |
| `handoverEvent` | Producer event object. Supported Phase 7B kinds are `none`, `intra-satellite-beam-switch`, and `inter-satellite-handover`. |
| `beamCatalogOrder` | Must remain `satellite-major-beam-minor` for the selected bundle. Candidate order and action indexes follow this order. |
| `visibilityMask`, `actionValidityMask` | Post-step masks. The adapter must preserve length, index alignment, and false entries. |
| `decisionVisibilityMask`, `decisionActionValidityMask` | Decision-time masks. The adapter must preserve them separately from post-step masks. |
| `beamLoads`, `beamThroughputs` | Producer load and throughput arrays aligned to beam indexes. They may feed diagnostics and overlays, not HOBS reward math. |
| `rewardVector`, `scalarReward` | Producer reward fields. Current producer rows use keys such as `r1Throughput`, `r2Handover`, and `r3LoadBalance`; consumers must preserve keys and values. |
| `satelliteStates` | Source satellite geometry and IDs for the row. |
| `beamStates` | Source beam geometry, IDs, local/global indexes, and center positions for the row. |
| `kpiOverlay` | Producer overlay metrics such as user throughput, selected beam load, selected beam throughput, and handover-occurrence flag. |
| `policyDiagnostics` | Optional producer-owned diagnostics. Missing diagnostics must remain missing; Leo must not invent Q-values or candidate scores. |

The selected artifact is documented as `1000` timeline rows over `10` slots and
`100` users, with `4` satellites, `7` beams per satellite, and `28` total
beams. Phase 7C must validate these values against the selected artifact before
treating output as evidence-capable.

## 4. Identity Mapping Contract

Replay identity remains producer-canonical. Core and Leo identities are
derived bridge fields, not replacements.

| Identity family | Field/rule |
| --- | --- |
| Producer satellite | `sat-<satIndex>`, for example `sat-0`. |
| Producer beam | `sat-<satIndex>-beam-<localBeamIndex>`, for example `sat-0-beam-4`. |
| Producer global beam index | 0-based satellite-major / beam-minor index: `satIndex * beamCountPerSatellite + localBeamIndex`. |
| Producer local beam index | 0-based beam index inside one satellite. |
| Selected action index | `selectedServing.beamIndex`; masks and candidate arrays are indexed by this value. |
| Core layout satellite | `coreLayoutSatId`; defaults to producer satellite ID for replay-derived 7-beam mapping unless an explicit bridge table is supplied. |
| Core beam | `${coreLayoutSatId}-b${producerLocalBeamIndex}`. |
| Leo scene satellite | `leoSceneSatId`; may differ only through an explicit deterministic bridge. |
| Leo display beam IDs | `leoLocalBeamNumericId = producerLocalBeamIndex + 1`; `leoGlobalBeamNumericId = producerBeamIndex + 1`. These are display helpers only. |
| User | `user-<userIndex>` plus deterministic key `userId|userIndex`. |

For replay-derived producer identity, Phase 7B authorizes derivation only for
the accepted `7`-beam path. `19` and `37` may use runtime/core identity in a
future live or sensitivity mode, but they must not synthesize `producer*`
replay identity from the 7-beam bundle.

## 5. Reward And Diagnostics Contract

MODQN reward and diagnostics surfaces remain producer-owned.

Required preservation rules:

1. Preserve `rewardVector` keys and numeric values exactly as read.
2. Preserve `scalarReward` exactly as read.
3. Preserve `manifest.replaySummary.rewardWeights` and
   `policyDiagnostics.objectiveWeights` when present.
4. Preserve `policyDiagnostics.selectedScalarizedQ`,
   `runnerUpScalarizedQ`, `scalarizedMarginToRunnerUp`,
   `availableActionCount`, and `topCandidates` when present.
5. Preserve candidate diagnostics fields: candidate `beamId`, `beamIndex`,
   `satId`, `satIndex`, `localBeamIndex`, `validUnderDecisionMask`,
   `objectiveQ`, and `scalarizedQ`.
6. Keep optional diagnostics absence-honest. If a row has no diagnostics, the
   adapter may emit `diagnosticsStatus: missing-from-producer`, but must not
   compute replacement Q-values.
7. Do not map HOBS/SINR handover penalties, SINR thresholds, DPC power changes,
   or live KPI counters into MODQN reward fields.

Diagnostics may add adapter-owned metadata such as parse status, bridge status,
row count, and claim-boundary checks, but those metadata must be separated from
producer-owned policy diagnostics.

## 6. Handover Event Semantics

For MODQN replay, handover classification is determined by producer
`previousServing`, producer `selectedServing`, and producer `handoverEvent`.

| Case | Replay semantic | Required handling |
| --- | --- | --- |
| Same satellite and same beam, `handoverEvent.kind === 'none'` | No event. | Display as continuation/stay. Do not count as a handover penalty. |
| Same satellite and different beam | Intra-satellite beam handover. | Require `handoverEvent.kind === 'intra-satellite-beam-switch'` for evidence-capable replay rows. Map to Leo semantic `intra-satellite-beam-handover` only after validation. |
| Different satellite | Inter-satellite handover. | Require `handoverEvent.kind === 'inter-satellite-handover'` for evidence-capable replay rows. |
| First visible serving state in a replay window | Initial attach / window entry. | Do not treat as a penalized inter-satellite handover unless the producer explicitly emits and documents that event. |
| Event kind contradicts from/to IDs | Invalid replay row. | Phase 7C/7D must fail validation instead of silently repairing the event. |

Event records exposed by a future adapter should carry:

1. source `eventId` and `kind`;
2. source `slotIndex`, `timeSec`, and `decisionTimeSec`;
3. from/to producer satellite and beam IDs;
4. from/to local and global beam indexes;
5. semantic classification;
6. source signal or delta fields only when the producer artifact supplies them;
7. adapter validation status.

The current selected artifact is documented as demonstrating
`intra-satellite-beam-switch` and `none` rows only. It must not be used to
promise observed inter-satellite handover until a future promoted artifact or
source supplies such rows.

## 7. Replay Events Versus HOBS/SINR Live Events

Replay events and live events have different sources and meanings.

| Surface | Event source | Policy meaning | Evidence status |
| --- | --- | --- | --- |
| MODQN replay | Producer `timeline/step-trace.jsonl` rows. | Selected checkpoint greedy replay action over the producer candidate catalog and masks. | Evidence-capable only for the selected 7-beam bundle after validation. |
| HOBS/SINR live | Leo runtime HandoverManager over current SINR samples and HOBS policy settings. | Runtime threshold/offset handover behavior. | Live simulator evidence only; not MODQN replay evidence. |
| Sensitivity/demo | Future explicitly labeled adapter or vendored module output. | Depends on the disclosed source and rule. | Demo/sensitivity only unless promoted by producer evidence. |

The HOBS/SINR manager may log initial attach using an inter-handover-shaped raw
event. Phase 6P already separates raw inter-handover count from
inter-handover excluding initial attach. A MODQN replay adapter must preserve
the same distinction and must not import HOBS initial-attach accounting into
MODQN rewards or event claims.

## 8. Replay Time And Slot Stepping

The replay state model should group timeline rows by `slotIndex`, then expose a
deterministic sequence of replay frames ordered by `slotIndex` and `timeSec`.

Required stepping rules:

1. Slot stepping uses producer `slotIndex` and `timeSec`.
2. Within each slot, rows remain keyed by producer `userId` / `userIndex`.
3. The selected action for a row is `selectedServing.beamIndex`.
4. Playback speed, pause, scrub, and loop controls are display controls only.
5. Interpolation may smooth geometry between source samples, but the active
   serving choice, masks, rewards, diagnostics, and handover event state may
   change only on source rows.
6. Looping from the final slot to the first slot must reset transient display
   latches and must not create an extra handover event.
7. A replay adapter must expose whether it is showing a source row, an
   interpolated display pose, or an out-of-window placeholder.

If a future visual-showcase artifact adds `timebase.sourceSlotIndexBySample`,
the replay state model should preserve that map and treat it as the canonical
sample-to-slot bridge for the artifact path. It must not derive new source slot
indexes from display frame rate.

## 9. Traffic Hex Grid Role

The traffic hex grid is an overlay surface only for this Phase 7B contract.

Allowed uses:

1. Visualize producer or vendored traffic demand.
2. Visualize queue pressure, load, or coverage overlays.
3. Aggregate display color from source-owned `beamLoads`, queue fields, or
   future traffic-module output.
4. Help explain where demand is located relative to beams.

Forbidden uses:

1. Do not treat hex cells as the primary MODQN handover action space.
2. Do not replace the satellite plus beam action catalog with cells.
3. Do not claim earth-fixed-cell truth from current visual hex paint.
4. Do not infer traffic demand, queue length, user association, handover
   events, rewards, or provenance from cell color.

If future MODQN inputs include demand or queue state, the source must be a
producer artifact or a validated vendored `ntn-sim-core` traffic module. The
Leo hex grid may display that truth, but must not author it.

## 10. Beam Count Behavior

Beam count is a claim boundary, not a visual density setting.

| Beam count | Phase 7B behavior |
| ---: | --- |
| `7` | Evidence-capable replay path only for the selected producer-owned regenerated baseline bundle, after path and row validation. Producer replay identity may be derived for this path. |
| `19` | Sensitivity/demo only. No trained-baseline claim. No producer replay identity derivation. Any policy behavior must be labeled as adapter, heuristic, source-backed live, or fixture-only according to its real source. |
| `37` | Sensitivity/demo only. No trained-baseline claim. No producer replay identity derivation. Same limits as `19`. |

The current replay action catalog for the selected artifact is `4` satellites x
`7` beams = `28` action positions. A future live `19` or `37` mode may have a
larger runtime/core candidate catalog, but it must not project those additional
beams back into the selected producer replay bundle.

No trained-baseline claim for `19` or `37` is allowed unless
`modqn-paper-reproduction` later produces and promotes matching evidence. If
that happens, a future phase must add a new artifact path, new claim boundary,
new identity-derivation rule, and new validation report before UI promotion.

## 11. Adapter Envelope

Future replay and live adapters should produce a common envelope with explicit
source separation:

| Envelope field | Required value |
| --- | --- |
| `modeKey` | One of the approved mode keys or a future documented extension. |
| `modeLabel` | Required display label from Section 1. |
| `evidenceStatus` | `accepted-7beam-baseline`, `live-hobs-sinr-not-replay`, `sensitivity-demo`, `fixture-only`, or a future documented value. |
| `sourcePath` | Producer bundle path, live profile ID, or fixture path. |
| `sourceOwner` | `modqn-paper-reproduction`, `leo-beam-sim`, `ntn-sim-core`, or explicitly documented source. |
| `claimBoundary` | Allowed and forbidden claims for the frame/model. |
| `time` | Source slot/time fields for replay, or live simulation time for HOBS/SINR. |
| `identityMap` | Producer/core/Leo identity fields where applicable. |
| `events` | Replay events or live events, never merged without source tags. |
| `diagnostics` | Producer diagnostics and adapter diagnostics in separate namespaces. |

Shared display components may consume the envelope, but they must preserve the
mode label and source tags. If a component cannot display the active mode
without ambiguity, it is not ready for Phase 7E UI promotion.

## 12. Next Implementation Slices

### Phase 7C - Replay State Model / Non-UI Adapter

Recommended scope if this contract is accepted:

1. Add a non-UI replay state model that loads a configured bundle path and
   fails closed when the selected evidence path is missing.
2. Group `timeline/step-trace.jsonl` rows by `slotIndex`.
3. Build producer/core/Leo identity bridge records for the accepted `7`-beam
   path only.
4. Validate candidate ordering, masks, reward fields, diagnostics pass-through,
   event semantics, row counts, and beam-count claim labels.
5. Emit a serializable adapter envelope with `modeKey:
   modqn-replay-7beam`.
6. Avoid React, Three.js, UI controls, browser smoke, source-channel adoption,
   HOBS policy rewrites, artifact copies, and producer changes.

If the selected producer artifact is unavailable, Phase 7C may use the producer
sample fixture only for fixture-only parser tests, with `evidenceStatus:
fixture-only`.

### Phase 7D - Replay Diagnostics Validator

Recommended scope:

1. Add a focused validator for the Phase 7C replay state model.
2. Check path availability or fixture-only status.
3. Check immutable field preservation for IDs, masks, rewards, diagnostics,
   events, slot indexes, and provenance.
4. Check unsupported `19`/`37` trained-baseline claim wording.
5. Check HOBS/SINR-as-MODQN-replay-evidence wording.
6. Check no HOBS live event stream is merged into replay event evidence.

### Phase 7E - UI Mode Labeling

Recommended scope only after Phase 7C and Phase 7D pass:

1. Add visible mode labels for `MODQN replay - 7-beam producer artifact` and
   `HOBS/SINR live`.
2. Keep replay and live controls separate unless a validated envelope switch
   proves reset/invalidation behavior.
3. Show 7-beam evidence status and 19/37 sensitivity/demo status clearly.
4. Add browser validation only after UI labels and adapter validation exist.

Phase 7E must not promote UI labels before the non-UI adapter and diagnostics
validator prove the data boundaries.

## 13. Validation Plan

Required validation for this docs-only Phase 7B slice:

1. `git diff --check`
2. `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase7b-replay-live-adapter-contract.md`
3. unsupported `19` / `37` trained-baseline claim scan
4. HOBS/SINR-as-MODQN-replay-evidence claim scan
5. confirm no source, runtime, package, profile, replay artifact, producer
   artifact, validator, or vendored donor file was changed by Phase 7B

Browser smoke, lint, package validation, replay artifact validation, producer
validation, and `ntn-sim-core` validation are intentionally out of scope
because Phase 7B is docs-only and introduces no runnable behavior.

## 14. Validation Results

Validation results after creating this document:

| Check | Result |
| --- | --- |
| `git diff --check` | Passed with no output. |
| `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase7b-replay-live-adapter-contract.md` | No whitespace findings. The command exits nonzero because `/dev/null` and the new file differ. |
| Unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are negative boundary statements or stop/validation language only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary statements only. |
| Changed-file confirmation | Phase 7B added only `docs/modqn-baseline-phase7b-replay-live-adapter-contract.md`. The broader worktree already contained modified and untracked source, package, script, and doc files before Phase 7B. |

## 15. Deviations And Blockers

Deviations:

1. None from the docs-only implementation scope.

Blockers for later phases:

1. Phase 7C evidence-capable adapter work is blocked until the selected
   producer bundle path exists again or the implementation is explicitly
   fixture-only.
2. UI mode promotion is blocked until Phase 7C and Phase 7D validate the replay
   envelope and diagnostics boundaries.
3. `19` and `37` remain sensitivity/demo only until future producer evidence
   exists and a new contract phase promotes it.
