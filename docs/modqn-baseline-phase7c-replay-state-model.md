# MODQN Baseline Phase 7C Replay State Model

**Date:** 2026-05-12
**Status:** `NON_UI_REPLAY_STATE_MODEL_IMPLEMENTED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** non-UI replay state model and focused validator

Phase 7C implements the non-UI replay state model for the restored and
re-promoted `7`-beam producer bundle. It does not add React UI, Three.js scene
runtime wiring, HOBS/SINR live behavior, profiles, copied artifacts, producer
artifact edits, vendored donor edits, or Phase 6 source-channel adoption.

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
12. per-row `28`-entry masks, loads, throughputs, and beam action catalog
13. per-row handover kind matches producer previous and selected serving truth
14. producer policy diagnostics are preserved when the manifest says they are
    present

No producer truth is inferred from display needs.

## Replay Envelope Shape

Rows are grouped by producer `slotIndex` while preserving source row order.
Each slot contains `100` rows in the current artifact. Each row carries:

1. producer timestamps: `slotIndex`, `timeSec`, and `decisionTimeSec`;
2. producer user identity and deterministic user key;
3. selected and previous serving beam references;
4. candidate/action order from the producer beam catalog;
5. post-step and decision-time masks;
6. reward vector and scalar reward;
7. producer handover event and adapter handover semantic;
8. producer policy diagnostics exactly as supplied; and
9. the full source row for absence-honest downstream replay consumers.

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
6. selected serving, previous serving, candidate order, masks, rewards,
   events, policy diagnostics, timestamps, source rows, replay summary, and
   provenance map are preserved exactly;
7. adapter diagnostics and producer policy diagnostics remain separate;
8. non-selected paths fail closed unless fixture-only mode is explicit;
9. evidence-capable source-owner overrides fail closed;
10. fixture-only output is non-evidence and does not carry producer-artifact
    status; and
11. missing required surfaces and a 19-beam shape mutation fail before
    evidence-capable output.

## Validation Results

| Check | Result |
| --- | --- |
| `npm run validate:modqn:phase2-identity-adapter` | Passed. Confirmed selected bundle schema, paper ID, 7-beam / 28-beam shape, 1000 rows, producer identity preservation, 1000 producer diagnostics rows, and no observed inter-satellite handover rows. |
| `npm run validate:modqn:phase4b-beam-layout-bridge` | Passed. Confirmed Phase 2 parse, 28 producer/core/Leo bridge records per row, 28000 bridged beam references, no row mutation, and 19/37 producer identity derivation guards. |
| `npm run validate:modqn:phase7c-replay-state-model` | Passed. Emitted `10` replay slots, `1000` rows, `28` identity bridge records, `100` user identities, `85` intra-satellite beam switches, `915` no-event rows, and `0` inter-satellite handover rows. |
| `git diff --check` | Passed with no output. |
| Unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are negative boundary statements, validator guard strings, or validation-scope text only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary statements only. |
| Changed-file confirmation | Passed for Phase 7C scope. This phase changed only `src/modqn/replay-bundle/replay-state.ts`, `src/modqn/replay-bundle/index.ts`, `scripts/validate-modqn-phase7c-replay-state-model.ts`, `package.json`, and this checkpoint doc. The broader worktree already contained unrelated dirty UI/runtime/doc/script/core files before Phase 7C; those were not edited by this phase. Producer artifact status for the selected bundle path had no git-status output. |

## Deviations And Blockers

Deviations:

1. None from the requested Phase 7C scope.

Blockers:

1. None for the restored selected path at the time this checkpoint was written.
2. If the selected producer path disappears again, Phase 7C must fail closed
   instead of using fixture data as evidence.
