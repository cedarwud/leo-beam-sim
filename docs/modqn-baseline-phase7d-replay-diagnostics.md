# MODQN Baseline Phase 7D Replay Diagnostics

**Date:** 2026-05-12
**Status:** `REPLAY_DIAGNOSTICS_VALIDATOR_IMPLEMENTED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** focused replay diagnostics validator and checkpoint doc

Phase 7D adds a diagnostics-only validator for the Phase 7C non-UI replay
state model. It does not add React UI, Three.js scene/runtime wiring,
HOBS/SINR live behavior, profiles, producer artifact edits, copied artifacts,
vendored donor edits, or Phase 6 source-channel adoption behavior.

## Selected Producer Input

The validator uses the same selected producer bundle as Phase 7C:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

Required evidence surfaces remain:

1. `manifest.json`
2. `provenance-map.json`
3. `timeline/step-trace.jsonl`

The validator also reads the producer root `review.md` to confirm the selected
artifact is newly regenerated and re-promoted, not an exact recovery of the
deleted untracked artifact and not a recovered frozen artifact.

## Validator Surface

Package command:

```bash
npm run validate:modqn:phase7d-replay-diagnostics
```

Script:

`scripts/validate-modqn-phase7d-replay-diagnostics.ts`

The validator loads the Phase 7C replay envelope through
`loadModqnReplayEnvelopeFromSurfaceReader()` and then checks diagnostics,
truth-preservation, fixture-only behavior, fail-closed behavior, and claim
boundaries.

## Coverage

Phase 7D asserts the accepted envelope identity:

| Field | Required value |
| --- | --- |
| `modeKey` | `modqn-replay-7beam` |
| `modeLabel` | `MODQN replay - 7-beam producer artifact` |
| `evidenceStatus` | `accepted-7beam-baseline` |
| `sourceOwner` | `modqn-paper-reproduction` |

Replay shape remains fixed to:

1. `phase-03a-replay-bundle-v1`
2. `PAP-2024-MORL-MULTIBEAM`
3. `4` satellites
4. `7` beams per satellite
5. `28` total beams
6. `1000` timeline rows
7. `10` slots
8. `100` user identities
9. `28` identity bridge records

Producer truth preservation is checked row-by-row for selected serving,
previous serving, beam catalog order, post-step masks, decision-time masks,
beam loads, beam throughputs, reward-vector keys and values, scalar reward,
handover event kind, slot index, time, decision time, producer policy
diagnostics, and the full source row.

Diagnostics namespace separation is explicit:

1. `diagnostics.adapter` must exist.
2. `diagnostics.producerPolicyDiagnostics` must exist when source rows contain
   producer policy diagnostics.
3. Adapter diagnostics must not reuse producer policy-diagnostics keys such as
   `selectedScalarizedQ`, `topCandidates`, or objective values.

Event boundaries remain source-owned. The selected artifact has `915` `none`
rows, `85` `intra-satellite-beam-switch` rows, and `0`
`inter-satellite-handover` rows. Inter-satellite handover remains supported by
the adapter type boundary, but this artifact does not claim an observed
inter-satellite handover.

## Fixture-Only Behavior

Fixture-only output must remain non-evidence:

1. `evidenceStatus: fixture-only`
2. `claimBoundary.baselineModqnEvidence: false`
3. `acceptedEvidenceShape: none-fixture-only`
4. no producer-owned evidence claim in allowed claims
5. no producer beam bridge evidence; bridge status must be
   `skipped-fixture-only-non-evidence`

A `sourceOwner` override on a fixture-only path is checked to ensure it cannot
promote the fixture into producer evidence.

## Fail-Closed Behavior

The validator proves these invalid inputs fail before evidence-capable output:

1. missing selected path or unreadable selected surfaces
2. missing `manifest.json`
3. missing `provenance-map.json`
4. missing `timeline/step-trace.jsonl`
5. non-selected path unless `fixtureOnly: true`
6. evidence-capable `sourceOwner` override away from
   `modqn-paper-reproduction`
7. empty required surface contents

## Claim Boundary

Allowed claim:

1. The selected regenerated and re-promoted `7`-beam producer bundle can emit
   evidence-capable MODQN replay state after Phase 7C and Phase 7D validators
   pass.

Forbidden claims:

1. No recovered frozen artifact claim.
2. No exact restoration claim.
3. No full paper-faithful reproduction claim.
4. No `19` or `37` trained-baseline MODQN evidence claim.
5. No EE, HEA, Catfish, Multi-Catfish, Catfish-over-HEA, or
   Catfish-over-HEA-on-HEA evidence scope.
6. No HOBS/SINR live output as MODQN replay evidence.
7. No observed inter-satellite handover claim for the selected artifact.

Beam-count boundary:

| Beam count | Phase 7D status |
| ---: | --- |
| `7` | Accepted regenerated baseline MODQN evidence path for the selected producer bundle only. |
| `19` | Sensitivity/demo extension only. No trained-baseline claim. |
| `37` | Sensitivity/demo extension only. No trained-baseline claim. |

## Validation Results

Validation results are recorded after the Phase 7D implementation run:

| Check | Result |
| --- | --- |
| Pre-change `npm run validate:modqn:phase2-identity-adapter` | Passed before Phase 7D edits. |
| Pre-change `npm run validate:modqn:phase4b-beam-layout-bridge` | Passed before Phase 7D edits. |
| Pre-change `npm run validate:modqn:phase7c-replay-state-model` | Passed before Phase 7D edits. |
| `npm run validate:modqn:phase2-identity-adapter` | Passed after Phase 7D edits. |
| `npm run validate:modqn:phase4b-beam-layout-bridge` | Passed after Phase 7D edits. |
| `npm run validate:modqn:phase7c-replay-state-model` | Passed after Phase 7D edits. |
| `npm run validate:modqn:phase7d-replay-diagnostics` | Passed. Confirmed selected envelope identity, re-promoted artifact status, required surfaces, shape, truth preservation, diagnostics namespace separation, event boundary, fixture-only non-evidence behavior, fail-closed inputs, and claim boundaries. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed with no output. |
| Unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are negative boundary statements, validation labels, or validator guard strings only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary or separation statements only. |
| Changed-file confirmation | Phase 7D added `scripts/validate-modqn-phase7d-replay-diagnostics.ts`, added this checkpoint doc, and added the package script in `package.json`. The broader worktree already contained unrelated dirty UI/runtime/doc/script/core files before Phase 7D; those were not edited by this phase. |

## Deviations And Blockers

Deviations:

1. None from the requested Phase 7D diagnostics scope.

Blockers:

1. None at implementation time. If the selected producer path disappears or a
   required surface is removed, Phase 7D fails closed instead of using fixture
   data as evidence.
