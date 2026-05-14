# MODQN Baseline Phase 7B Replay Live Adapter Contract

## 1. Status, Date, And Scope

**Date:** 2026-05-14
**Status:** docs-only replay/live-adapter contract
**Scope:** Phase 7B contract boundary for future replay/live composition in
`leo-beam-sim`.

This document contains no runtime implementation, no runtime adoption, no
package/script changes, no fixtures, no source edits, and no source-channel
runtime adoption. It does not mutate, reinterpret, repair, or normalize MODQN
artifact truth. It records how later Phase 7 implementation phases must keep
MODQN replay evidence separate from live HOBS/SINR runtime behavior.

The only accepted baseline MODQN evidence path remains the regenerated
`7`-beam producer artifact lineage. `19` and `37` remain sensitivity/demo only
and must not be described as trained baseline MODQN evidence.

## 2. Purpose

Phase 7B reopens the safe Phase 7 replay mainline after Phase 6 source-channel
adoption deferment. The safe path is replay-first: consume producer-owned
MODQN replay truth immutably, render it in Leo, and keep live runtime controls
and live diagnostics outside the replay truth boundary.

This contract does not claim that source-channel live is adopted. Source-channel
live remains deferred/not adopted until a separate provenance and product
decision explicitly authorizes it.

## 3. Ownership

| Owner | Owns | Does not own here |
| --- | --- | --- |
| `modqn-paper-reproduction` | MODQN artifact truth, actions, rewards, event kinds, masks, diagnostics, provenance, producer satellite/beam IDs, claim boundary, and promoted evidence status. | Leo display/runtime composition or HOBS/SINR live behavior. |
| `ntn-sim-core` | Validated contracts, core truth, visual-showcase validation, and vendored-core source of truth when live simulation needs academic rigor. | Final Leo visual shell or producer MODQN artifact claims. |
| `leo-beam-sim` | Final display/runtime composition, camera, materials, labels, panels, replay controls, live controls, and demo packaging. | MODQN training, producer truth mutation, independent SINR/handover truth rewrites, or unsupported evidence promotion. |

Renderer convenience is display-only. It must never change actions, rewards,
event kinds, SINR/SNR, geometry truth, provenance, masks, diagnostics,
deterministic IDs, or evidence labels.

## 4. Replay Immutable Input Rules

Replay inputs are immutable producer artifacts. A Phase 7 replay adapter must
preserve, pass through, or fail closed for all producer-owned truth fields.

For Phase 7B, immutable producer/source-row truth explicitly includes:

1. `action`
2. selected serving
3. previous serving
4. masks
5. `rewardVector`
6. `scalarReward`
7. event kind
8. event count
9. event timing
10. beam loads
11. throughputs
12. `policyDiagnostics`
13. `userPosition`
14. `decisionUserPosition`
15. `satelliteStates`
16. `beamStates`
17. `kpiOverlay`
18. geometry truth
19. provenance
20. `provenanceMap`
21. full `sourceRow`
22. deterministic IDs

Forbidden replay mutations:

1. Do not rewrite MODQN actions or selected serving references.
2. Do not rewrite scalar rewards, reward vectors, objective weights, or
   candidate diagnostics.
3. Do not rewrite event kinds, event counts, event timing, or event
   from/to identities.
4. Do not rewrite SINR/SNR, signal fields, beam load, throughput, or KPI
   overlay values.
5. Do not rewrite satellite, UE, beam, footprint, coordinate-frame, or geometry
   truth.
6. Do not rewrite provenance, evidence status, claim boundary, source-gap
   fields, masks, diagnostics, deterministic path IDs, slot indexes, or sample
   indexes.
7. Do not infer missing producer truth from Leo labels, colors, colocated
   display cues, screenshots, traffic hex paint, or live HOBS/SINR output.

If required producer truth is absent or contradictory, the adapter must report
the missing or invalid state and fail closed for evidence-capable replay.

## 5. Replay And Live Separation

Replay and live runtime surfaces must remain separate even when they share the
same screen.

1. Right-side replay controls affect replay display state only: pause, play,
   scrub, speed, loop, selected sample, selected user, selected replay event,
   and replay diagnostics presentation.
2. Left-side HOBS/SINR controls affect live runtime only: signal tuning,
   handover thresholds, offset controls, profile/runtime settings, and live KPI
   behavior.
3. Replay scrub must not alter live handover state, live signal history,
   HOBS/SINR counters, or live runtime reset state.
4. Live tuning must not alter replay artifact fields, replay masks, MODQN
   rewards, replay event classification, replay geometry, replay IDs, or
   replay provenance.
5. Shared visual components must carry explicit source tags so MODQN replay,
   HOBS/SINR live, and future deferred source-channel live cannot be merged by
   presentation convenience.

HOBS/SINR live output is not MODQN replay evidence. MODQN replay evidence is
not a live HOBS/SINR runtime trace.

## 6. Event Semantics

Supported Phase 7B MODQN replay event kinds are:

1. `none`
2. `intra-satellite-beam-switch`
3. `inter-satellite-handover`

Producer `previousServing`, producer `selectedServing`, and producer
`handoverEvent.kind` are authoritative. The replay adapter may map these into
Leo display labels only after validation, and the mapped label must keep the
producer event kind available for diagnostics.

Initial attach or first visible serving state in a replay window must not be
counted as a MODQN penalized inter-satellite handover unless producer evidence
explicitly emits and documents that event as a penalized
`inter-satellite-handover`.

If from/to satellite or beam IDs contradict the producer event kind, the row is
invalid for evidence-capable replay. Later validators must fail rather than
repairing the row with local policy rules.

## 7. ID Families

Future adapters must keep identity families explicit instead of collapsing them
into one display ID.

| ID family | Meaning |
| --- | --- |
| Producer satellite/beam IDs | Source-owned IDs emitted by `modqn-paper-reproduction`. |
| Producer local/global beam index | Source-owned candidate/action indexes, including satellite-major/global ordering and local beam index inside a satellite. |
| Core layout beam IDs / reuse groups | `ntn-sim-core` layout IDs and FRF/reuse metadata when a validated core module or artifact supplies them. |
| Leo numeric display IDs | Human-readable display helpers, such as 1-based local or global beam numbers. They are labels only. |
| Scene/runtime satellite IDs | Leo runtime scene object IDs used by live simulation and rendering. |

An explicit bridge may relate these families, but the bridge does not change
the underlying source. A colocated display cue is not geometry truth. Visual
overlap, identical screen position, matching label color, or camera framing
must not be used to prove producer geometry, replay identity, or event truth.

For Phase 7 replay, `7`-beam producer replay identity is the only baseline
MODQN evidence identity path. `19` and `37` identities remain sensitivity/demo
only unless a future producer artifact promotes them with provenance and a new
validation report.

## 8. Mode Labels

Every frame, adapter envelope, diagnostic report, UI label, and screenshot must
carry one explicit mode label.

| Mode | Required label | Boundary |
| --- | --- | --- |
| MODQN replay | `MODQN replay` | Producer artifact truth only; `7`-beam baseline evidence path only unless future producer evidence expands it. |
| HOBS/SINR live | `HOBS/SINR live` | Leo live runtime behavior and live KPI surface only; not MODQN replay evidence. |
| Source-channel live | `source-channel live deferred/not adopted` | Not adopted in Phase 7B. No source-channel runtime adoption or source-channel product claim is made. |

This contract also makes no EE-MODQN, HEA-MODQN, Catfish, Catfish-over-HEA, or
Multi-Catfish effectiveness claim. Those topics remain outside this replay/live
adapter boundary unless the owning evidence repo later promotes them.

## 9. Traffic Hex-Grid Boundary

The traffic hex grid is a demand/coverage overlay only.

Allowed uses:

1. Display producer-owned or validated live-module demand/coverage overlays.
2. Visualize queue pressure, load, coverage, or traffic density when the source
   is disclosed.
3. Help explain spatial context beside beams and users.

Forbidden uses:

1. Do not treat traffic hex cells as the MODQN action space.
2. Do not replace producer satellite/beam actions with hex-cell actions.
3. Do not infer MODQN actions, rewards, handover events, masks, geometry truth,
   SINR/SNR, queue truth, or provenance from hex color.
4. Do not claim earth-fixed-cell truth from display-only hex paint.

## 10. Validation Plan

Required pre-stage checks for this docs-only Phase 7B contract:

1. `git status -sb`
2. `git diff --check`
3. `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase7b-replay-live-adapter-contract.md`
4. `rg -n "runtime implementation|runtime adoption|not adopted|MODQN replay evidence|19|37|trained baseline|HOBS/SINR|source-channel|inter-satellite|EE-MODQN|HEA-MODQN|Catfish" docs/modqn-baseline-phase7b-replay-live-adapter-contract.md`

Required repo validation after the docs change:

1. `npm run validate:modqn:phase7c-replay-state-model`
2. `npm run validate:modqn:phase7d-replay-diagnostics`
3. `npm run validate:modqn:phase7k-replay-scene-layer`
4. `npm run lint`

Required staged checks:

1. `git diff --cached --name-status`
2. `git diff --cached --check`
3. `git diff --cached --stat`

Claim-boundary review must confirm:

1. No runtime implementation is claimed complete.
2. No runtime adoption is claimed.
3. Source-channel live remains deferred/not adopted.
4. No MODQN artifact truth is mutated or reinterpreted.
5. `7` remains the only baseline MODQN evidence path.
6. `19` and `37` remain sensitivity/demo only.
7. HOBS/SINR live is not labeled MODQN replay evidence.
8. The current selected artifact has no observed inter-satellite-handover
   evidence.
9. Current artifact event counts remain:
   - `intra-satellite-beam-switch`: `85`
   - `none`: `915`
   - `inter-satellite-handover`: `0`

## 11. Next Phase Recommendation

Phase 7C, Phase 7D, and later Phase 7 implementation or validator phases may
proceed only after this contract. They should implement and validate the replay
state model, replay diagnostics, scene-layer separation, UI labeling, and
browser evidence in bounded slices.

Later phases must remain implementation/validator phases. They must not adopt
source-channel live behavior unless a separate provenance and product decision
opens that path, defines its mode label, identifies owning truth, captures
baseline validation, and updates the claim boundary before runtime wiring.
