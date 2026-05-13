# MODQN Baseline Phase 1 Evidence Lock

**Date:** 2026-05-11
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Phase:** Phase 1R, evidence-lock reconciliation after producer Phase 1C
**Scope anchor:** `PAP-2024-MORL-MULTIBEAM` baseline MODQN only

This document records the Phase 1 decision for the first baseline MODQN
artifact input to `leo-beam-sim`. It is docs-only. No producer artifacts are
copied into this repo, no runtime code is implemented, and no `ntn-sim-core`
modules are vendored.

## 1. Phase 1 Decision Status

**Decision status:** `ACCEPTED_REGENERATED_7_BEAM_BASELINE_ARTIFACT`

Phase 1 accepts the producer-owned regenerated 7-beam baseline bundle named
below as the first baseline MODQN evidence input for future `leo-beam-sim`
schema and identity adapter work.

This acceptance is narrow:

1. it selects one exact `phase-03a-replay-bundle-v1` path;
2. it keeps `modqn-paper-reproduction` as the MODQN evidence authority;
3. it treats the artifact as immutable downstream input;
4. it accepts a newly regenerated engineering/disclosed baseline export, not a
   recovered old frozen artifact; and
5. it does not authorize runtime implementation, artifact copying, training,
   19/37-beam trained evidence claims, or EE / HEA / Catfish-family claims.

## 2. Selected Artifact

| Field | Value |
| --- | --- |
| Bundle path | `/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1` |
| Artifact root | `/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11` |
| Repo owner | `modqn-paper-reproduction` |
| Producer status | `PRODUCED_REGENERATED_7_BEAM_BASELINE_BUNDLE` |
| Schema/version | `phase-03a-replay-bundle-v1` |
| Paper | `PAP-2024-MORL-MULTIBEAM` |
| Source config | `configs/modqn-paper-baseline.resolved-template.yaml` |
| Source run path | `artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/run/` |
| Checkpoint summary | `best-weighted-reward-on-eval` checkpoint exported for `selected-checkpoint-greedy-replay`; manifest `policyEpisode` is `0`. |
| Training episode count | bounded `1` episode, with `episodesRequested: 1` and `episodesCompleted: 1`; not `500` and not `9000`. |
| Beam topology | `7` beams per satellite, `4` satellites, `28` total beams. |
| Timeline | `1000` rows, `10` slots, `100` users. |
| Current event coverage | `85` `intra-satellite-beam-switch` rows and `915` `none` rows were observed; no `inter-satellite-handover` row is present in the current timeline. |
| Validation status | Producer review states that the exporter produced a valid Phase 03A replay bundle. This reconciliation also confirmed the bundle directory exists, the manifest is readable, and the timeline row/event counts match the selected artifact boundary. No broad producer validation, training, browser validation, or `ntn-sim-core` validator was run here. |
| Artifact type | Newly regenerated 7-beam baseline MODQN engineering/disclosed baseline export. |

The selected path is the bundle directory. The artifact root is retained for
review notes, the source run directory, and future provenance lookup.

## 3. Prior Blocked State And Recovery Decision

The earlier Phase 1 evidence-lock state was
`BLOCKED_NO_SAFE_ARTIFACT`. That state remains historically accurate for the
old inspection: no old frozen production replay bundle was recoverable on disk,
and the only concrete `phase-03a-replay-bundle-v1` bundle found at that time was
`/home/u24/papers/modqn-paper-reproduction/tests/fixtures/sample-bundle-v1/`.

That fixture was schema-compatible and useful for contract alignment, but it
was a trimmed, path-normalized fixture and was not safe to promote as production
baseline MODQN evidence.

The recovery decision is to accept the later producer Phase 1C regenerated
bundle listed in Section 2. This does not rewrite history and does not claim
the new bundle is the previously missing frozen production artifact. It is a
newly regenerated, producer-owned, disclosed baseline export with strict claim
limits.

## 4. Authority And Provenance Boundary

Authority remains split as follows:

1. `modqn-paper-reproduction` owns baseline MODQN evidence, the selected
   artifact, training/evaluation provenance, and claim boundaries.
2. `ntn-sim-core` remains the contract, module, replay-consumer, and validator
   authority. It does not replace the producer repo as MODQN evidence
   authority.
3. `leo-beam-sim` is the final visual-first showcase and live-demo host under
   ADR-002. It may later consume or adapt the selected artifact, but it must
   not train MODQN, alter producer truth values, or independently reimplement
   research truth.

Primary producer evidence for this reconciliation:

1. `/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/review.md`
2. `/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1/manifest.json`
3. `/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1/provenance-map.json`
4. `/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1/timeline/step-trace.jsonl`

## 5. Claim Boundary

Allowed claims after Phase 1R:

1. `modqn-paper-reproduction` produced a regenerated 7-beam baseline MODQN
   replay bundle for `PAP-2024-MORL-MULTIBEAM`.
2. The selected artifact is the only accepted baseline MODQN evidence input for
   this Phase 1 downstream path.
3. `7` beams per satellite is the only baseline MODQN evidence path for this
   artifact, subject to regenerated-run assumptions and limitations.
4. `leo-beam-sim` may proceed to future schema and identity adapter work
   against the selected immutable bundle.
5. `ntn-sim-core` remains the authority for reusable contracts, validators, and
   future vendored runtime modules.

Forbidden claims:

1. Do not claim this artifact is a recovered old frozen artifact.
2. Do not claim this artifact establishes full paper-faithful reproduction.
3. Do not claim this artifact establishes paper-like method separation.
4. Do not claim this artifact is 19-beam or 37-beam trained baseline MODQN
   evidence.
5. Do not claim this artifact is EE-MODQN, HEA-MODQN, Catfish,
   Multi-Catfish, Catfish-over-HEA, or any other energy/intervention variant
   evidence.
6. Do not claim `leo-beam-sim` may train MODQN or modify imported producer
   truth values.
7. Do not claim the current timeline demonstrates inter-satellite handover.

Beam-count distinction:

| Beam count | Label | Claim limit |
| --- | --- | --- |
| `7` | Regenerated baseline MODQN evidence path | The only beam-count path accepted for this artifact, tied to `PAP-2024-MORL-MULTIBEAM` subject to regenerated-run assumptions. |
| `19` | Live sensitivity or demo extension only | Not trained baseline MODQN evidence unless a future producer artifact explicitly proves and promotes it. |
| `37` | Live sensitivity or demo extension only | Not trained baseline MODQN evidence unless a future producer artifact explicitly proves and promotes it. |

If future 19/37 modes reuse, project, mask, or extend the 7-beam artifact, that
behavior must be labelled as a live sensitivity/demo extension or adapter
behavior, not as trained baseline MODQN evidence.

## 6. Limitations

The selected artifact has the following limitations:

1. It is a bounded 1-episode regenerated export.
2. It is not a recovered frozen artifact.
3. It does not establish full paper-faithful reproduction.
4. It does not establish paper-like method separation.
5. It does not provide 19-beam or 37-beam trained evidence.
6. It does not provide EE / HEA / Catfish / Multi-Catfish /
   Catfish-over-HEA evidence.
7. The current timeline contains intra-satellite beam switches and no-event
   rows only; no inter-satellite handover event is observed in this artifact.
8. A downstream demo may show intra-satellite handover from this artifact, but
   it must not promise inter-satellite handover unless another promoted
   artifact or source supplies it.

## 7. Artifact Immutability Rule

Future `leo-beam-sim` work may consume, display, re-index, or visually adapt
the selected producer artifact, but it must not edit producer truth values.

Immutable producer truth includes:

1. serving satellite and beam decisions;
2. candidate ordering;
3. visibility and action-validity masks;
4. SNR/SINR or signal values as exported;
5. reward vectors and scalar rewards;
6. handover event classifications;
7. policy diagnostics;
8. timestamps, slot indexes, and deterministic path IDs; and
9. provenance and assumption metadata.

Any future copy into `leo-beam-sim/public/`, fixtures, or runtime assets
requires a separately scoped phase with provenance-preserving validation.
Copying a fixture for tests must be labelled fixture-only and must not create a
baseline evidence claim.

## 8. Contract Fit

The selected artifact is fit for future schema and identity adapter work, with
the following adapter questions still open for Phase 2:

1. **Beam IDs:** producer rows use string IDs such as `sat-0-beam-4`; current
   `leo-beam-sim` beam IDs are numeric. Phase 2 must define an explicit
   identity map.
2. **Beam indexes:** producer/core indexes are 0-based and satellite-major /
   beam-minor; current scene IDs may be 1-based. Phase 2 must preserve ordering
   and convert bases explicitly.
3. **Action ordering:** the bundle declares `satellite-major-beam-minor`;
   Phase 2 must preserve masks and ordering instead of dropping invalid
   actions.
4. **SNR/SINR:** the paper catalog is SNR/no-interference, while current
   `leo-beam-sim` surfaces are SINR-aware. Any future display must label this
   difference and avoid converting paper SNR into a live SINR claim.
5. **Handover events:** Phase 2 must preserve initial attach and intra/inter
   semantics. The current selected timeline only demonstrates intra-satellite
   beam switches and no-event rows.
6. **Reward fields:** producer replay rows expose throughput, handover, and
   load-balance reward terms. Phase 2 must not reinterpret HOBS policy rewards
   as MODQN rewards.
7. **Policy diagnostics:** optional diagnostics are producer-owned. If later
   artifacts omit them, `leo-beam-sim` must disclose absence rather than invent
   Q-values.

## 9. Future Phase 2 Handoff

Phase 2 may proceed to schema and identity adapter work against the selected
bundle path:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

Phase 2 must:

1. preserve artifact immutability and producer truth;
2. keep `modqn-paper-reproduction` as MODQN evidence authority;
3. keep `ntn-sim-core` as contract/module/validator authority;
4. preserve candidate ordering, action masks, reward vectors, handover event
   kinds, policy diagnostics, timestamps, and provenance;
5. map producer satellite, beam, user, action, and handover identities into
   `leo-beam-sim` deterministically;
6. document 0-based to any 1-based visual index conversion explicitly;
7. label 7 beams as the accepted regenerated baseline path and 19/37 as live
   sensitivity/demo extension only; and
8. keep replay/training semantics separate from any later live adapter
   semantics.

Phase 2 must not:

1. copy the producer bundle into `leo-beam-sim` unless explicitly scoped;
2. implement runtime controls or UI behavior as part of this evidence lock;
3. start MODQN training or retraining;
4. vendor `ntn-sim-core` modules;
5. implement 19/37 as trained baseline evidence; or
6. promise inter-satellite handover from the current selected timeline.

Suggested Phase 2 validation gates remain narrow:

1. a docs/provenance gate confirming the selected artifact path and manifest;
2. a schema guard for `phase-03a-replay-bundle-v1`;
3. an identity adapter round-trip check for satellite, beam, user, action, and
   handover IDs;
4. a candidate ordering and action-mask preservation check;
5. a reward vector preservation check; and
6. a claim-boundary check that rejects recovered-frozen, full paper-faithful,
   19/37 trained-baseline, EE / HEA / Catfish-family, and inter-satellite
   handover wording unless future evidence supports it.
