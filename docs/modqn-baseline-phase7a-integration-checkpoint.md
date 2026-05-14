# MODQN Baseline Phase 7A Integration Checkpoint

**Date:** 2026-05-12
**Status:** `REPLAY_MAINLINE_READY_CHANNEL_ADOPTION_DEFERRED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** docs-only integration checkpoint

Phase 7A closes the Phase 6 source-channel adoption branch for now and
reopens the safe baseline MODQN replay/live-adapter mainline. It does not
change source code, validators, package scripts, runtime wiring, UI controls,
profiles, replay artifacts, producer artifacts, vendored files, or
`ntn-sim-core` source.

Runtime source-channel adoption status after Phase 7A: **deferred**.

## Phase 7A Status

Phase 7A status:

`REPLAY_MAINLINE_READY_CHANNEL_ADOPTION_DEFERRED`

Meaning:

1. The replay/live-adapter mainline is ready for a docs-only Phase 7B contract
   design pass.
2. The status does not authorize runtime implementation yet.
3. The Phase 6 source-channel adoption branch remains frozen until a separate
   source-side provenance decision or explicit product decision reopens it.
4. The first safe MODQN path remains replay-first, bounded to the accepted
   regenerated 7-beam producer artifact.

Rejected Phase 7A statuses:

| Status | Reason not selected |
|---|---|
| `NEEDS_REPLAY_MAINLINE_DESIGN` | Phase 0 through Phase 6X provide enough boundary, artifact, identity, layout, and claim evidence to begin Phase 7B replay/live-adapter contract design. Runtime implementation is still not authorized. |
| `BLOCKED_BY_BOUNDARY_CONFLICT` | No cross-repo ownership conflict blocks docs-only replay/live-adapter design. The conflict is limited to source-channel runtime adoption, which is deferred and separated from the replay mainline. |

## Accepted State Through Phase 6X

The accepted baseline MODQN state is:

1. The Phase 0 Mini-SDD exists as
   `docs/modqn-baseline-live-integration-mini-sdd.md`. It defines the
   baseline MODQN scope, repo ownership, 7 versus 19/37 claim boundary,
   replay/live-adapter semantics, handover event semantics, and traffic
   hex-grid role.
2. Phase 1 accepts the producer-owned regenerated 7-beam baseline bundle as
   the bounded downstream evidence input:
   `/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`.
   The bundle remains immutable and remains owned by
   `modqn-paper-reproduction`.
3. Phase 2 adds the narrow identity adapter for the accepted
   `phase-03a-replay-bundle-v1` shape. It preserves producer satellite IDs,
   producer beam IDs, 0-based satellite-major beam indexes, action-mask
   positions, reward vectors, policy diagnostics, and explicit
   `none` / `intra-satellite-beam-switch` /
   `inter-satellite-handover` event kinds.
4. Phase 3B vendors the `ntn-sim-core` beam-layout truth slice. Phase 4B adds
   the replay-to-core beam-layout identity bridge. Phase 5A partially adopts
   the vendored layout for current 7-beam runtime geometry and reuse metadata.
   Phase 5B through Phase 5D consume that reuse metadata for visual and
   diagnostic frequency labels, including browser validation of the diagnostic
   readout.
5. Phase 6B and Phase 6D through Phase 6L vendor frequency-reuse and channel
   helper slices from `ntn-sim-core`, including FSPL, SINR combination,
   beam-gain, small-scale fading, LOS probability, Doppler, shadow fading,
   link-budget composition, and the channel barrel. These helpers are present
   for provenance, validation, and future planning only; they are not adopted
   into live runtime behavior.
6. Phase 6M through Phase 6S create readiness, adapter, parity, KPI, and
   runtime-frame-step guard surfaces for a possible source-channel adoption
   branch. Phase 6T then finds source-channel shadow KPI drift over the gate.
   Phase 6U isolates a beam-gain model difference. Phase 6V narrows the
   residual to a J1+J3 antenna-pattern convention mismatch. Phase 6W defers
   channel adoption pending provenance. Phase 6X records that local evidence is
   insufficient to choose or patch the source antenna-pattern convention.

Therefore the accepted integration state is replay-ready for contract design
and channel-adoption-deferred for runtime behavior.

## Frozen Phase 6 Decision

Phase 7A freezes the Phase 6 source-channel adoption branch with these
decisions:

1. No source-channel runtime adoption.
2. No adapter-only beam-gain fix.
3. No source patch design from local Leo evidence alone.
4. No non-parity experimental source-channel mode unless separately
   authorized as an explicit product decision with labels, diagnostics, and
   validation scope.
5. HOBS/SINR live output remains separate from MODQN replay evidence.
6. Source-channel shadow diagnostics, channel parity, KPI comparisons, and
   antenna-pattern packets do not create MODQN policy, reward, replay,
   training, or producer evidence.

This freeze does not delete or invalidate the Phase 6 vendored helper work.
Those files remain available as audited source slices. The freeze only blocks
behavior-changing adoption of the source-channel path in the current mainline.

## Safe Phase 7 Mainline

The safe Phase 7 mainline is replay/live-adapter readiness, not source-channel
runtime adoption.

Allowed Phase 7 direction:

1. Define the MODQN replay/live-adapter contract before runtime work.
2. Start with the accepted 7-beam replay path and preserve producer truth:
   selected serving beam, candidate ordering, action masks, rewards, event
   kinds, signal values, timestamps, diagnostics, evidence status, and
   provenance.
3. Keep replay event semantics source-owned. `none` is not a penalized
   handover, same-satellite different-beam changes are intra-satellite beam
   handovers, and different-satellite changes are inter-satellite handovers.
4. Keep live-runtime handover semantics separate from replay semantics. The
   current HOBS/SINR handover manager may provide live-demo events, but those
   events must not be relabeled as MODQN replay policy or MODQN reward
   evidence.
5. Treat the traffic hex grid as a traffic demand, queue, or coverage overlay
   only. It must not become the MODQN action space and must not replace
   earth-moving multibeam truth.
6. Use 7 beams as the replay-first baseline path.
7. Treat 19 and 37 beams as sensitivity/demo modes only. They may be explored
   later as live or adapter behavior, but they have no trained-baseline claim
   unless `modqn-paper-reproduction` later promotes matching evidence.

Non-goals for the safe Phase 7 mainline:

1. No MODQN training or retraining in `leo-beam-sim`.
2. No mutation of producer replay artifacts.
3. No source-channel runtime adoption.
4. No beam-count UI or truth expansion before a replay/live-adapter contract
   and reset/invalidation rules exist.
5. No EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA, or
   Catfish-family scope.

## Claim Boundary

The repo ownership boundary remains:

1. `modqn-paper-reproduction` remains the MODQN evidence authority.
2. `ntn-sim-core` remains the validated module, contract, and validator
   authority.
3. `leo-beam-sim` remains the final visual-first runtime and demo host.

Beam-count claim boundary:

| Beam count | Phase 7A claim |
|---:|---|
| `7` | Accepted regenerated baseline MODQN evidence path for the selected producer bundle, subject to that artifact's regenerated-run limitations. |
| `19` | Live sensitivity/demo extension only. No trained-baseline claim. |
| `37` | Live sensitivity/demo extension only. No trained-baseline claim. |

HOBS/SINR live output, source-channel shadow output, and source-backed channel
helper diagnostics are not MODQN replay evidence.

## Recommended Phase 7B Scope

Recommended next phase:

`Phase 7B docs-only replay/live-adapter contract`

Phase 7B should define:

1. replay input surfaces and immutable producer-field preservation rules;
2. live-runtime event surfaces and how they remain separate from replay
   evidence;
3. intra-satellite beam handover, inter-satellite handover, and initial attach
   semantics for replay and live runtime;
4. ID mapping among producer IDs, core layout IDs, Leo numeric display IDs,
   and any future scene satellite IDs;
5. mode labels for `MODQN replay`, `HOBS/SINR live`, and any later
   source-backed live mode;
6. traffic hex-grid demand/queue overlay boundaries;
7. validation gates for a later runtime implementation phase.

Phase 7B should not implement runtime behavior, add UI controls, copy producer
artifacts, alter replay fixtures, change source-channel behavior, or run
browser smoke unless its scope is separately expanded.

## Validation Plan

Required validation for Phase 7A:

1. `git diff --check`
2. no-index whitespace check for this new doc
3. unsupported 19/37 trained-baseline claim scan
4. HOBS/SINR-as-MODQN-replay-evidence claim scan
5. Phase 6M stale adapter/parity token scan
6. confirm only this Phase 7A doc was changed in this task, aside from
   pre-existing dirty files

Browser smoke, training, long validation, source-channel runtime adoption, and
`ntn-sim-core` source validation are intentionally not run because Phase 7A is
docs-only.

## Validation Results

Validation results are recorded after running the Phase 7A checks:

| Check | Result |
|---|---|
| `git diff --check` | Passed with no output. |
| `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase7a-integration-checkpoint.md` | No whitespace findings. The command exits nonzero because `/dev/null` and the new file differ. |
| Unsupported 19/37 trained-baseline claim scan | Passed by inspection. Hits are negative boundary or validation-scope statements only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary statements or source-channel freeze text only. |
| Phase 6M stale adapter/parity token scan | Passed with no hits for stale Phase 6M parity-token strings. |
| Changed-file confirmation | Passed by status comparison. This task added only `docs/modqn-baseline-phase7a-integration-checkpoint.md`; the broader worktree already contained modified and untracked files before Phase 7A. |

## Deviations And Blockers

Deviations:

1. None from the requested Phase 7A scope. This checkpoint is docs-only.

Blockers:

1. None block Phase 7B docs-only replay/live-adapter contract work.
2. Source-channel runtime adoption remains blocked by insufficient
   antenna-pattern convention provenance and Phase 6T shadow KPI drift.
