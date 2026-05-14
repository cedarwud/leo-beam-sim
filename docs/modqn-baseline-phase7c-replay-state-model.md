# MODQN Baseline Phase 7C Replay State Model

**Date:** 2026-05-14
**Status:** `R1_REPLAY_STATE_CONTRACT_HARDENED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** non-UI replay state model, producer truth projections, and focused validator

Phase 7C implements the non-UI replay state model for the restored and
re-promoted `7`-beam producer bundle. It does not add React UI, Three.js scene
runtime wiring, HOBS/SINR live behavior, profiles, copied artifacts, producer
artifact edits, vendored donor edits, or Phase 6 source-channel adoption.

Phase 7C-R1 hardens the state model against the Phase 7B immutable
producer/source-row truth contract. The adapter keeps the full `sourceRow`
unchanged and exposes named `producerTruth` projections for display consumers
without rewriting producer values.

## Selected Producer Input

Default selected bundle path:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

Required surfaces:

1. `manifest.json`
2. `provenance-map.json`
3. `timeline/step-trace.jsonl`

The adapter is fail-closed for evidence-capable output. A non-selected path is
rejected unless `fixtureOnly: true` is explicitly configured. Empty or missing
required surface contents are rejected before an envelope is emitted.

## Adapter Surface

Source file:

`src/modqn/replay-bundle/replay-state.ts`

Public entry points:

1. `createModqnReplayBundleLoadPlan()` resolves the selected path by default
   and returns the required surface paths.
2. `loadModqnReplayEnvelopeFromSurfaceReader()` loads the selected path by
   default through an injected file/surface reader and fails closed on missing
   required surfaces.
3. `createModqnReplayEnvelopeFromContents()` parses the required surfaces,
   validates the selected artifact shape, and emits the serializable envelope.
4. `createModqnReplayEnvelopeFromBundle()` builds the envelope from an already
   parsed bundle while applying the same selected-path and evidence gates.
5. `getModqnPhase7cExpectedShape()` exposes the narrow expected producer
   shape for validators.

The accepted envelope carries:

| Field | Value |
| --- | --- |
| `modeKey` | `modqn-replay-7beam` |
| `modeLabel` | `MODQN replay - 7-beam producer artifact` |
| `evidenceStatus` | `accepted-7beam-baseline` |
| `sourceOwner` | `modqn-paper-reproduction` |
| `sourcePath` | The selected producer bundle path above. |

Fixture-only paths are supported only when explicitly configured. They emit
`evidenceStatus: fixture-only`, use `modeKey: sensitivity-demo`, skip producer
beam bridge derivation, set `baselineModqnEvidence: false`, and carry
`artifactStatus: fixture-only-non-evidence-not-producer-artifact`.

For accepted evidence-capable replay, `sourceOwner` is forced to
`modqn-paper-reproduction`. Caller overrides to any other owner fail closed.

## Shape Gate

Evidence-capable output requires all of the following:

1. `bundleSchemaVersion === phase-03a-replay-bundle-v1`
2. `paperId === PAP-2024-MORL-MULTIBEAM`
3. `satelliteCount === 4`
4. `beamCountPerSatellite === 7`
5. `totalBeamCount === 28`
6. `timelineRows.length === 1000`
7. exactly `10` producer `slotIndex` groups
8. `baselineSurface.beamCountPerSatellite === 7`
9. `baselineSurface.totalBeamCount === 28`
10. `claimBoundary.notFullPaperFaithfulReproduction === true`
11. `claimBoundary.not19Or37BeamTrainedEvidence === true`
12. per-row producer-owned `userPosition`, `decisionUserPosition`, and
    `kpiOverlay` objects are present
13. per-row `28`-entry masks, loads, throughputs, and beam action catalog
14. per-row named `satelliteStates` and `beamStates` projections preserve the
    producer arrays
15. per-row handover kind matches producer previous and selected serving truth
16. producer policy diagnostics are preserved when the manifest says they are
    present

No producer truth is inferred from display needs.

## Replay Envelope Shape

Rows are grouped by producer `slotIndex` while preserving source row order.
Each slot contains `100` rows in the current artifact. Each row carries:

1. producer timestamps: `slotIndex`, `timeSec`, and `decisionTimeSec`;
2. producer user identity and deterministic user key;
3. producer `userPosition` and `decisionUserPosition`;
4. selected and previous serving beam references;
5. explicit action truth when `sourceRow.action` exists, or the selected
   serving display-identity alias when it does not;
6. candidate/action order from the producer beam catalog;
7. post-step and decision-time masks;
8. beam loads, beam throughputs, reward vector, and scalar reward;
9. `satelliteStates`, `beamStates`, and `kpiOverlay` exactly as supplied;
10. producer handover event and adapter handover semantic;
11. producer policy diagnostics exactly as supplied; and
12. the full source row for absence-honest downstream replay consumers.

The current selected producer rows do not contain an explicit `action` field.
Phase 7C-R1 therefore marks `producerTruth.actionTruth.kind` as
`selected-serving-display-identity-alias`: `selectedActionIdentity` derives
from producer `selectedServing.beamIndex` only to identify the selected serving
beam for display. It is not new MODQN replay truth. If a future source row
contains explicit `action`, the adapter preserves it under
`producerTruth.actionTruth.action` and the validator compares it directly to
`sourceRow.action`.

`adaptModqnHandoverEvent` remains a display/semantic bridge. It emits Leo
handover labels from producer `handoverEvent`, `previousServing`, and
`selectedServing`, while `producerTruth.handoverEvent` and full `sourceRow`
remain the producer event truth.

The top-level `identityMap` contains the accepted 7-beam producer/core/Leo
beam bridge records only for the selected path. `19` and `37` remain
sensitivity/demo extensions only and do not derive producer replay identity.

Diagnostics are separated:

1. `diagnostics.adapter` reports parse, shape, bridge, event-count, row-count,
   slot-count, and required-surface status.
2. `diagnostics.producerPolicyDiagnostics` reports producer policy-diagnostics
   presence only. It does not compute or invent Q-values.

## Claim Boundary

Allowed claims:

1. `modqn-paper-reproduction` produced a re-promoted regenerated 7-beam
   baseline MODQN replay bundle for `PAP-2024-MORL-MULTIBEAM`.
2. Phase 7C can emit evidence-capable replay state for that selected path after
   the shape gate passes.
3. `7` beams per satellite remains the only accepted baseline MODQN evidence
   shape for this path.

Forbidden claims:

1. No recovered frozen artifact claim.
2. No full paper-faithful reproduction claim.
3. No 19-beam or 37-beam trained baseline MODQN evidence claim.
4. No EE/HEA/Catfish/Multi-Catfish/Catfish-over-HEA scope claim.
5. No HOBS/SINR live output as MODQN replay evidence claim.
6. No inter-satellite handover observation claim for the current artifact.

The current artifact has `85` `intra-satellite-beam-switch` rows and `915`
`none` rows. It has `0` `inter-satellite-handover` rows.

## Validation

Focused validator:

```bash
npm run validate:modqn:phase7c-replay-state-model
```

The validator checks:

1. default selected-path load plan and required surface presence;
2. accepted envelope header, mode, source owner, and evidence status;
3. schema, paper ID, 4-satellite / 7-beam / 28-beam shape;
4. 1000 rows grouped into 10 slots while preserving source row order;
5. 28 producer/core/Leo beam bridge records and 100 user identities;
6. selected serving, previous serving, candidate order, masks, beam loads,
   throughputs, rewards, events, policy diagnostics, timestamps, source rows,
   replay summary, and provenance map are preserved exactly;
7. `producerTruth.userPosition`, `producerTruth.decisionUserPosition`,
   `producerTruth.satelliteStates`, `producerTruth.beamStates`,
   `producerTruth.kpiOverlay`, `producerTruth.beamLoads`, and
   `producerTruth.beamThroughputs` deep-equal the same fields on `sourceRow`;
8. explicit `sourceRow.action`, when present, is preserved and validated; when
   absent, selected action display identity is validated as a
   `selectedServing.beamIndex` alias only;
9. adapter handover semantics remain separate from producer event truth;
10. adapter diagnostics and producer policy diagnostics remain separate;
11. non-selected paths fail closed unless fixture-only mode is explicit;
12. evidence-capable source-owner overrides fail closed;
13. fixture-only output is non-evidence and does not carry producer-artifact
    status; and
14. missing required surfaces and a 19-beam shape mutation fail before
    evidence-capable output.

## Validation Results

| Check | Result |
| --- | --- |
| `git status -sb` | Passed. Worktree changes are limited to Phase 7C-R1 replay state, type, validator, and documentation files. |
| `git diff --check` | Passed with no output. |
| `npm run validate:modqn:phase7c-replay-state-model` | Passed. Emitted `10` replay slots, `1000` rows, `28` identity bridge records, `100` user identities, `0` explicit source action rows, `1000` selected-serving display alias rows, `85` intra-satellite beam switches, `915` no-event rows, and `0` inter-satellite handover rows. |
| `npm run validate:modqn:phase7d-replay-diagnostics` | Passed. Confirmed the same 7-beam accepted replay shape, fixture-only non-evidence behavior, and 85 / 915 / 0 event counts. |
| `npm run validate:modqn:phase7k-replay-scene-layer` | Passed. |
| `npm run lint` | Passed. |
| Phase 7C-R1 claim scan | Passed by inspection. Hits are producer-truth fields, validator guards, negative boundary statements, or sensitivity/demo-only `19` / `37` language. |
| Changed-file confirmation | Passed. Phase 7C-R1 changed only `src/modqn/replay-bundle/types.ts`, `src/modqn/replay-bundle/replay-state.ts`, `scripts/validate-modqn-phase7c-replay-state-model.ts`, and this checkpoint doc. No artifacts, package files, fixtures, or unrelated UI/scene/runtime files were edited. |

## Deviations And Blockers

Deviations:

1. None from the requested Phase 7C scope.

Blockers:

1. None for the restored selected path at the time this checkpoint was written.
2. If the selected producer path disappears again, Phase 7C must fail closed
   instead of using fixture data as evidence.
