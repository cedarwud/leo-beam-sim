# MODQN Baseline Phase 7A-R1 Evidence Input Invalidation

**Date:** 2026-05-12
**Status:** `EVIDENCE_INPUT_INVALIDATED_UPSTREAM_DELETION`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** docs-only evidence-input invalidation checkpoint

## Current Supersession Note

This checkpoint is a historical record of the 2026-05-12 upstream deletion
state. It is no longer the current blocker state for Phase 7 replay work.

As of the later Phase 7C / Phase 7C-R1 validation path, the selected producer
bundle path is present again and the evidence-capable replay state validator
passes against the restored / re-promoted `7`-beam producer input. Use
`docs/modqn-baseline-phase7c-replay-state-model.md` and
`docs/modqn-baseline-phase7b-replay-live-adapter-contract.md` for the current
replay-state and replay/live-adapter contract status.

The fail-closed rules below remain valid if the selected producer path or any
required surface disappears again. Do not use this historical invalidation note
to claim that Phase 7C is currently blocked while the Phase 7C validator is
passing against the selected producer input.

Phase 7A-R1 records that the previously accepted regenerated 7-beam baseline
MODQN replay bundle is no longer available in the upstream producer checkout.
This checkpoint does not edit source code, validators, package scripts,
runtime behavior, UI, profiles, copied artifacts, producer artifacts, vendored
files, or `ntn-sim-core` source.

It also does not regenerate the bundle, promote fixture data as evidence,
reopen Phase 6 source-channel adoption, or weaken the Phase 7B fail-closed
replay/live-adapter contract.

## 1. Status

`EVIDENCE_INPUT_INVALIDATED_UPSTREAM_DELETION`

Meaning:

1. Phase 1's selected artifact decision remains historically accurate, but the
   selected artifact is currently unavailable on disk.
2. The current Phase 1 state must be treated as
   accepted-then-invalidated, not currently available.
3. Evidence-capable Phase 7C replay/runtime-state implementation is blocked
   until a producer-owned bundle is restored or re-promoted.
4. Fixture-only implementation work remains allowed only under explicit
   non-evidence labels.

## 2. Evidence

The selected Phase 1 path is missing:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

Required missing surfaces beneath that selected path:

| Required surface | Current availability |
| --- | --- |
| `manifest.json` | Missing. |
| `provenance-map.json` | Missing. |
| `timeline/step-trace.jsonl` | Missing. |

The upstream cleanup manifest
`/home/u24/papers/modqn-paper-reproduction/artifacts/cleanup-manifest-2026-05-12.md`
records removal of bulky ignored or untracked generated outputs and lists the
untracked regenerated Phase 01C baseline bundle under its remove section. This
matches the missing selected Phase 1 bundle path above.

No fixture data was used as evidence for this checkpoint.

## 3. Impact

Phase 1 impact:

1. The Phase 1 status should now be read as
   accepted-then-invalidated.
2. The selected 7-beam artifact was accepted as a regenerated producer-owned
   evidence input, but it is not currently available for downstream
   re-execution.

Phase 2 and Phase 4B impact:

1. `scripts/validate-modqn-phase2-identity-adapter.ts` hardcodes the selected
   bundle path as its default input and reads `manifest.json`,
   `provenance-map.json`, and `timeline/step-trace.jsonl` from that path.
2. `scripts/validate-modqn-phase4b-beam-layout-bridge.ts` hardcodes the same
   selected bundle path as its default input and reads the same required
   surfaces.
3. Those validators are re-execution blocked against the selected evidence
   path until the artifact is restored or a producer-owned replacement is
   explicitly re-promoted.

Phase 7B impact:

1. The Phase 7B replay/live-adapter contract remains valid.
2. Its fail-closed artifact gate already requires Phase 7C to fail closed when
   the selected evidence path is missing.
3. The missing input strengthens the need to keep fixture-only and
   evidence-capable replay states separate.

Phase 7C impact:

1. Phase 7C runtime/replay-state implementation is blocked for
   evidence-capable MODQN replay.
2. Evidence-capable replay may resume only after
   `modqn-paper-reproduction` restores the selected bundle or promotes a new
   producer-owned 7-beam `phase-03a-replay-bundle-v1` input with equivalent
   provenance and claim boundaries.

## 4. Allowed Fallback

Fixture-only work may proceed only when it is explicitly scoped as
fixture-only.

Any fixture-only output must:

1. use `evidenceStatus: fixture-only`;
2. disclose the fixture or non-evidence source path;
3. avoid baseline MODQN evidence wording;
4. avoid claiming the selected regenerated 7-beam producer bundle is present;
5. avoid claiming the fixture is a restored, frozen, or promoted producer
   artifact.

Fixture-only work may exercise parser shape, envelope plumbing, state-model
stepping, and failure behavior. It must not claim baseline MODQN replay
evidence.

## 5. Claim Boundaries

Allowed boundary:

1. `7` beams remains the only baseline MODQN evidence shape in the accepted
   Phase 1/Phase 7B lineage.
2. The selected `7`-beam artifact is currently unavailable.
3. A future restored or re-promoted producer-owned 7-beam bundle can re-enable
   evidence-capable replay only after its path, required surfaces, provenance,
   and claim boundary are checked again.

Forbidden claims:

1. No recovered frozen artifact claim.
2. No full paper-faithful reproduction claim.
3. No `19` or `37` trained-baseline claim.
4. No claim that `19` or `37` are more than sensitivity/demo modes in the
   current evidence state.
5. No claim that HOBS/SINR live output is MODQN replay evidence.
6. No claim that local source-channel diagnostics, HOBS/SINR output, or
   vendored channel helpers recover MODQN policy, reward, replay, training, or
   producer evidence.
7. No EE, HEA, Catfish, Multi-Catfish, Catfish-over-HEA, or
   Catfish-over-HEA-on-HEA scope for this baseline replay checkpoint.

## 6. Recommended Next Decision

Option A:

Ask `modqn-paper-reproduction` to restore or re-promote a producer-owned
7-beam `phase-03a-replay-bundle-v1` bundle with `manifest.json`,
`provenance-map.json`, and `timeline/step-trace.jsonl`.

Option B:

Proceed with Phase 7C fixture-only replay state model work, explicitly
non-evidence, using `evidenceStatus: fixture-only` and no baseline MODQN
evidence claims.

Recommended decision:

Choose Option A unless product or demo pressure requires fixture-only plumbing
first. Option A is the only route that can unblock evidence-capable Phase 7C
replay against a producer-owned MODQN baseline input.

## 7. Validation Plan

Required validation for this docs-only Phase 7A-R1 checkpoint:

1. `git diff --check`
2. `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase7a-r1-evidence-input-invalidation.md`
3. unsupported `19` / `37` trained-baseline claim scan
4. HOBS/SINR-as-MODQN-replay-evidence claim scan
5. confirm no source, package, UI, profile, artifact, validator, runtime, or
   vendored files were edited by this checkpoint
6. confirm the missing selected bundle path still does not exist

Browser smoke, package validation, runtime validation, artifact validation,
producer validation, and `ntn-sim-core` validation are intentionally out of
scope because this checkpoint is docs-only and records a missing input.

## 8. Validation Results

Validation results after creating this checkpoint:

| Check | Result |
| --- | --- |
| `git diff --check` | Passed with no output. |
| `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase7a-r1-evidence-input-invalidation.md` | No whitespace findings. The command exits nonzero because `/dev/null` and the new file differ. |
| Unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are negative boundary statements, validator guard strings, or validation-scope text only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary statements, validator guard strings, or separation-risk notes only. |
| Missing selected bundle path confirmation | Passed. The selected bundle path, `manifest.json`, `provenance-map.json`, and `timeline/step-trace.jsonl` are all missing. |
| Changed-file confirmation | This checkpoint added only `docs/modqn-baseline-phase7a-r1-evidence-input-invalidation.md`. The broader worktree already contained modified and untracked source, package, script, UI, and doc files before this checkpoint; those were not edited by Phase 7A-R1. |

## 9. Deviations And Blockers

Deviations:

1. None from the requested docs-only checkpoint scope.

Blockers:

1. Phase 7C evidence-capable replay state implementation is blocked until a
   producer-owned 7-beam bundle is restored or re-promoted.
2. Phase 2 and Phase 4B validator re-execution against their default selected
   path is blocked while the selected bundle remains missing.
