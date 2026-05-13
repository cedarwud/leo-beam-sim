# Baseline MODQN Live Integration Mini-SDD

**Status:** Phase 0 boundary inventory, docs only
**Date:** 2026-05-11
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope anchor:** `PAP-2024-MORL-MULTIBEAM` baseline MODQN only

This Mini-SDD defines the repo-local boundary for integrating baseline MODQN
from `/home/u24/papers/modqn-paper-reproduction` into
`/home/u24/papers/project/leo-beam-sim`.

Phase 1R note, 2026-05-11: Phase 1 accepted the producer-owned regenerated
7-beam bundle as the baseline MODQN evidence input for future adapter work; see
`docs/modqn-baseline-phase1-evidence-lock.md`.

Phase 4A note, 2026-05-12: the runtime-adoption ID bridge, 7 versus 19/37
boundary, and Phase 4B blocker inventory are recorded in
`docs/modqn-baseline-phase4a-runtime-adoption-contract.md`.

Phase 0 does not implement runtime code, vendor modules, add controls, train
policies, or run long validation. It records source ownership, claim limits,
current local boundaries, and the future implementation sequence.

## 1. Scope and Non-Scope

In scope:

1. Baseline MODQN from `PAP-2024-MORL-MULTIBEAM`.
2. A future live-demo path hosted by `leo-beam-sim`, under ADR-002.
3. A paper-faithful 7-beam baseline replay/training claim boundary.
4. A future live runtime adapter that maps validated MODQN contracts into
   `leo-beam-sim` without making this repo a second trainer.
5. Safe beam-count presets `7 / 19 / 37`, where only `7` is paper-faithful
   baseline MODQN evidence and `19 / 37` are live sensitivity/demo extensions.
6. Stable satellite and beam identity mapping across producer artifacts,
   `ntn-sim-core` contracts, and `leo-beam-sim` scene/runtime surfaces.
7. Intra-satellite beam handover and inter-satellite handover as first-class,
   separate event semantics.

Non-scope:

1. No EE-MODQN implementation.
2. No HEA-MODQN implementation.
3. No Catfish, Multi-Catfish, Catfish-over-HEA, or Catfish EE-MODQN
   implementation.
4. No MODQN training or retraining in `leo-beam-sim`.
5. No independent rewrite of rigor-critical orbit, beam, channel, handover,
   traffic, or MODQN policy truth in `leo-beam-sim`.
6. No replacement of the main model with pure earth-fixed-cell truth.
7. No claim that 19-beam or 37-beam behavior is trained baseline MODQN
   evidence.

## 2. Authority and Source Ownership

Current authority:

1. ADR-002, `ntn-showcase-stack/docs/decisions/ADR-002-leo-beam-sim-final-runtime-host.md`,
   is the current authority for `leo-beam-sim` runtime hosting.
2. Older wording that says `leo-beam-sim` is only a visual consumer, or must
   never host runtime behavior, is superseded for this track.
3. `leo-beam-sim` is the final visual-first showcase and live-demo platform.
4. `leo-beam-sim` may host live runtime, but rigor-critical truth must come
   from validated and vendored `ntn-sim-core/src/core` modules or explicit
   provenance artifacts.

Ownership:

| Repo | Owns | Does not own for this track |
| --- | --- | --- |
| `modqn-paper-reproduction` | Baseline MODQN evidence, paper reproduction artifacts, training/evaluation provenance, artifact bundles, assumption disclosures, and claim boundaries. | Final frontend runtime, browser scene composition, or validated TypeScript simulator modules. |
| `ntn-sim-core` | Validated contracts, reusable `src/core` modules, MODQN contract surfaces, beam/channel/orbit/handover/traffic modules, profile defaults, fixtures, and validators. | Replacement authority for MODQN evidence or paper-reproduction claims. |
| `leo-beam-sim` | Final runtime composition, controls, visualization, browser validation, and integration of artifacts or vendored validated truth. | MODQN training, independent research-truth rewrites, or changing imported truth values for presentation. |

`ntn-sim-core` is the validated contract/module/validator authority. It does
not replace `modqn-paper-reproduction` as the MODQN evidence authority.

## 3. Paper-Faithful Baseline Replay/Training Semantics

The paper-faithful baseline path is evidence-bound to
`PAP-2024-MORL-MULTIBEAM` and the producer repo.

Required semantics:

1. `7` beams per satellite is the paper-faithful baseline MODQN path.
2. State is `s_i(t) = (u_i(t), G_i(t), Gamma(t), N(t))`:
   access vector, channel gains to all beams, beam locations, and users per
   beam.
3. Action is one selected beam from the action catalog.
4. Reward vector has throughput, handover penalty, and load-balance terms.
5. Intra-satellite handover cost is lower than inter-satellite handover cost.
6. Baseline training protocol is producer-owned: three DQN objective networks,
   hidden layers `[100, 50, 50]`, `tanh`, Adam, epsilon-greedy, learning rate
   `0.01`, discount `0.9`, batch size `128`, 1 s slots, 10 s episodes, 9000
   episodes, weights `[0.5, 0.3, 0.2]`.
7. Paper signal evidence is SNR-like, with no interference term in the paper
   formula. If a future `leo-beam-sim` view displays SINR because the live
   platform computes interference, the UI and docs must distinguish that from
   paper-faithful baseline SNR evidence.

Replay/training artifacts must remain immutable inputs. `leo-beam-sim` may
display or adapt them, but must not edit consumed values.

## 4. Live Runtime Adapter Semantics

The live adapter is a runtime bridge, not a trainer.

Required semantics:

1. Runtime is hosted in `leo-beam-sim` under ADR-002.
2. The adapter consumes producer-owned MODQN evidence and/or validated
   `ntn-sim-core` contracts.
3. Rigor-critical live truth must be vendored from `ntn-sim-core/src/core`,
   one module per future change set, after kill-switch audit and source-side
   validation.
4. The main truth model is earth-moving multibeam plus UE-centric beam
   association.
5. Do not replace the main model with pure earth-fixed-cell truth.
6. Display-only transforms may place labels, smooth visuals, or stage camera
   views, but must not alter SNR/SINR, handover events, policy decisions,
   rewards, deterministic path IDs, or provenance.
7. If 19 or 37 beams are exposed, beam-count changes must affect simulation
   truth, action candidates, beam layout, handover inputs, and validation. They
   cannot be visual-only cone duplication.

## 5. Baseline MODQN Data Contract

The validated TypeScript contract candidate is
`ntn-sim-core/src/core/contracts/modqn-contracts.ts`.

Future `leo-beam-sim` integration should preserve these logical fields:

| Contract surface | Required fields/semantics |
| --- | --- |
| `ModqnBeamTruth` | `satId`, `beamId`, `beamIndex`, `channelGainLinear`, `snrLinear`, beam center east/north km, `userCount`, optional beam throughput. |
| `ModqnBaselineObservation` | `tick`, `timeSec`, `userId`, current sat/beam, and ordered candidate beams. |
| `ModqnPaperState` | Access vector, channel gains, beam locations, users per beam. |
| `ModqnObjectiveQValue` | Throughput, handover, and load-balance Q components per candidate beam. |
| `ModqnActionVector` | Selected candidate index, selected sat/beam, one-hot action vector. |
| `ModqnRewardInput` and `ModqnRewardVector` | Previous and selected sat/beam, user throughput, beam throughputs, total users, intra/inter penalties, and three reward components. |
| `ModqnTrainingProtocol` | Frozen baseline training protocol and weights. |

Adapter requirements:

1. Preserve producer provenance and field-level claim boundaries.
2. Preserve candidate ordering. Producer docs describe satellite-major,
   beam-minor action ordering.
3. Preserve access/action masks instead of silently dropping invalid actions.
4. Convert identity shapes explicitly. Current `leo-beam-sim` uses numeric
   beam IDs; `ntn-sim-core` MODQN contract surfaces use string beam IDs and
   beam indexes.
5. Keep replay/training semantics separate from live runtime semantics.

## 6. Beam Layout and Beam-Count Runtime Parameter Contract

Required future runtime beam-count contract:

1. Presets: `7`, `19`, `37`.
2. `7` is the paper-faithful baseline MODQN preset.
3. `19` and `37` are live sensitivity/demo extensions only.
4. Beam count must change:
   - generated beam layout;
   - candidate beam catalog;
   - active/eligible beam sets;
   - policy observation/action mapping;
   - handover candidate inputs;
   - traffic/load aggregation;
   - validation expectations.
5. Beam count must not be represented by UI display density alone.

Candidate truth source:

`ntn-sim-core/src/core/beam/layout.ts` already defines hexagonal ring counts
with cumulative sizes `1, 7, 19, 37, 61, ...` and a deterministic frequency
reuse grouping. This is the likely vendored truth source for future 19/37 live
sensitivity modes.

Current `leo-beam-sim` conflict:

`src/scene/beam-layout.ts` hard-caps `MAX_BEAMS_PER_SATELLITE = 7` and
`generateBeamOffsetsKm()` truncates to that cap. That is compatible with the
paper-faithful 7-beam baseline but blocks true 19/37 runtime presets until a
future vendored beam-layout phase lands.

## 7. 7-Beam Provenance vs 19/37 Sensitivity/Demo Claim Boundary

Claim boundary:

| Beam count | Allowed label | Claim limit |
| --- | --- | --- |
| `7` | Paper-faithful / baseline MODQN path. | May be tied to `PAP-2024-MORL-MULTIBEAM` baseline evidence when the producer artifact and assumptions support the run. |
| `19` | Live sensitivity or demo extension. | Must not be described as trained baseline MODQN evidence. Policy behavior must be labeled as extension, adapter behavior, heuristic fallback, or future trained artifact, depending on actual source. |
| `37` | Live sensitivity or demo extension. | Must not be described as trained baseline MODQN evidence. Same policy and claim limits as 19 beams. |

If future 19/37 modes reuse a 7-beam trained policy, they must disclose the
projection or action-mask rule. If they use deterministic or heuristic policy
behavior, they must not be labeled MODQN-trained baseline behavior. If they
later use trained 19/37 evidence, that evidence must first be promoted by
`modqn-paper-reproduction`.

## 8. Stable Satellite/Beam Identity Contract

Current source shapes:

| Surface | Current shape | Phase 0 status |
| --- | --- | --- |
| `modqn-paper-reproduction` beam geometry | Stable local beam indices `0..6`, satellite-major then beam-minor action catalog. | Compatible with 7-beam provenance; needs adapter for local runtime IDs. |
| `ntn-sim-core` MODQN contract | `satId: string`, `beamId: string`, `beamIndex: number`; beam IDs commonly shaped like `${satId}-b${index}`. | Needs adapter to `leo-beam-sim`. |
| `ntn-sim-core` beam layout | `beamId: ${satId}-b${index}`, offsets in km, deterministic reuse group. | Needs vendored truth for 19/37. |
| `leo-beam-sim` satellites | `${shell.id}-P${p}-S${s}` from `src/engine/orbit/walker-constellation.ts`. | Compatible as a stable scene ID if preserved through adapters. |
| `leo-beam-sim` beams | Numeric `beamId`, currently starts at `1` in `src/scene/beam-layout.ts`. | Needs adapter because producer/core surfaces are 0-based or string IDs. |

Future integration must define a single identity adapter with:

1. stable producer ID;
2. stable core ID;
3. stable scene ID;
4. explicit beam-index base conversion;
5. deterministic serialization for replay and browser validation.

Do not make beam labels globally unique only by visible text. The action space
must remain satellite plus beam.

## 9. Intra/Inter Handover Event Semantics

Required semantics:

1. Same satellite plus different beam is intra-satellite beam handover.
2. Different satellite is inter-satellite handover.
3. Initial attach is not a penalized handover unless a future source contract
   explicitly says otherwise.
4. Event records must carry from/to satellite IDs, from/to beam IDs, signal
   values, delta if available, time, and classification.
5. Rewards must use the producer/core intra/inter penalty semantics.

Current local status:

`src/engine/handover/types.ts` has `HandoverAction` values
`stay | intra-switch | inter-handover`, and `HandoverEvent` carries from/to
satellite and beam IDs. This is directionally compatible with the required
semantics, but the future MODQN adapter must map action/reward terms explicitly
and must not rely on HOBS SINR-offset policy semantics as if they were MODQN.

## 10. Traffic Hex Grid Role

The hex grid is traffic demand / queue overlay, not the primary handover action
space.

Rules:

1. The action space remains satellite plus beam association.
2. Hex cells may visualize demand, queue pressure, or coverage state.
3. Hex cells must not replace earth-moving multibeam truth.
4. If future traffic demand or queue state affects MODQN inputs, the traffic
   truth must come from a validated `ntn-sim-core` traffic module or producer
   artifact, not from visual-only cell paint.

Current local status:

`src/viz/EarthFixedCells.tsx` paints hex cells using beam coverage candidates
and visual roles. It is a useful overlay surface, but it is not currently a
traffic demand or queue truth model.

## 11. Current leo-beam-sim Boundary Inventory

| Current surface | Evidence path | Phase 0 label | Boundary note |
| --- | --- | --- | --- |
| Beam layout cap | `src/scene/beam-layout.ts` | needs vendored truth | Hard cap `MAX_BEAMS_PER_SATELLITE = 7`; compatible with baseline but blocks true 19/37 presets. Future should vendor or align with `ntn-sim-core/src/core/beam/layout.ts`. |
| Beam geometry shape | `src/scene/beam-layout.ts` | needs adapter | Current offsets are circular/ring by angle and numeric IDs starting at 1. Producer/core use hex-7 or axial hex layouts with 0-based/string IDs. |
| Profile beam fields | `src/profiles/types.ts`, `src/profiles/*.json` | needs adapter | Fields `perSatellite`, `maxActivePerSat`, `frequencyReuse` exist, all current profiles use 7. No preset discriminator or claim label exists for MODQN 7 vs 19/37. |
| Beam hopping fields | `src/profiles/types.ts`, `src/scene/beam-scheduler.ts` | compatible | Has active-beam scheduling fields and per-slot active IDs. Future beam-count changes must update scheduler frame length and action candidates. |
| Runtime config | `src/scene/types.ts`, `src/App.tsx` | needs adapter | Runtime has presentation mode and visual beam density, but no truth-level beam-count control. `beamDensity` is display density only. |
| Current profiles | `src/profiles/hobs-2024-*.json` | docs/claim risk | Existing profiles are HOBS-focused, not MODQN. Reusing them as MODQN baseline would be a claim error. |
| Default runtime | `src/App.tsx` | docs/claim risk | Defaults to `hobs-2024-candidate-rich` and `demo-readability`. Future MODQN mode needs explicit labeling and default policy. |
| Satellite IDs | `src/engine/orbit/walker-constellation.ts` | compatible | IDs are deterministic `${shell.id}-P${p}-S${s}` and can be adapted if preserved. |
| Beam IDs | `src/scene/beam-layout.ts`, `src/engine/signal/types.ts` | needs adapter | Numeric `beamId` does not match `ntn-sim-core` string IDs or producer local indices. |
| Signal samples | `src/engine/signal/types.ts`, `src/engine/signal/link-budget.ts` | needs vendored truth | Current local surface is SINR-centric with interference terms. Baseline MODQN paper evidence is SNR/no interference. |
| Handover state/events | `src/engine/handover/types.ts`, `src/engine/handover/handover-manager.ts` | needs adapter | Intra/inter event vocabulary exists, but current policy is SINR-offset HOBS behavior, not MODQN policy selection/reward. |
| Recent-HO visual state | `src/scene/useSimulation.ts`, `src/scene/useBeamViz.ts` | needs adapter | Recent-HO source/target latching emphasizes inter-HO. Future intra-switch presentation and event logging need explicit support. |
| Hex-cell visualization | `src/viz/EarthFixedCells.tsx` | compatible | Useful overlay for coverage/demand, but must remain overlay until traffic truth is vendored or artifact-backed. |
| UI beam density | `src/ui/ControlBar.tsx`, `src/scene/types.ts` | docs/claim risk | Controls visual cone density (`event-only`, `event-plus-1`, `all`), not truth beam count. Must not be relabeled as 7/19/37 simulation control. |
| Validators | `package.json`, `scripts/` | open question | Existing validators cover HOBS, visual clarity, beam floor, and UI behavior. No repo-local MODQN adapter, MODQN fixture sync, beam-count preset, or KPI-drift validator exists yet. |

## 12. Source Module / Artifact Candidates

Candidate `ntn-sim-core` sources:

| Candidate | Path | Future use |
| --- | --- | --- |
| MODQN contracts | `src/core/contracts/modqn-contracts.ts` | Stable observation/action/reward/training protocol contract. |
| MODQN defaults | `src/core/profiles/defaults-modqn.ts` | Paper-backed and assumption-backed baseline runtime profile defaults. |
| Hex beam layout | `src/core/beam/layout.ts` | Truth source for 7/19/37 hex layouts and frequency reuse groups. |
| Beam module | `src/core/beam/` | Active beam, scheduler, frequency reuse, and selection behavior, if needed. |
| Channel module | `src/core/channel/` | Validated channel/SNR/SINR calculations, if live MODQN requires core truth instead of artifact replay. |
| Handover module | `src/core/handover/` | Validated handover event semantics and baseline policies, if needed. |
| Traffic/UE modules | `src/core/traffic/`, `src/core/ue/` | Future demand/queue and UE mobility truth. |
| MODQN adapter | `src/core/algorithms/modqn-baseline-adapter.ts` | Paper-shaped policy bridge and reward vector logic. Needs claim review because M1 may include heuristic Q values when objective-specific Q-values are absent. |
| Runtime bridge | `src/core/experiments/modqn-runtime-bridge.ts` | Runtime observation encoding, beam catalog, and reward/KPI helpers. |
| Visual exporter | `src/core/exporters/visual-showcase-v1-modqn*.ts` | Replay/offline path candidate and source-gap reporting. |
| Validators | `package.json` scripts `validate:modqn`, `validate:modqn:m2`, `validate:modqn:m3`, `validate:modqn:parity`, `validate:modqn:fixture-sync`, `validate:modqn:bundle`, `validate:modqn:bundle-ui`, `validate:visual-showcase`, `validate:core-purity` | Source-side validation gates for future phases. |
| KPI baselines | `baseline-kpi-*.json` | Frozen KPI comparison for vendored live modules where applicable. |

Candidate `modqn-paper-reproduction` sources:

| Candidate | Path | Future use |
| --- | --- | --- |
| Paper catalog | `paper-source/catalog/PAP-2024-MORL-MULTIBEAM.json` | Evidence boundary for baseline parameters and claims. |
| Producer authority | `AGENTS.md` | Ownership and training/artifact rules. |
| Baseline config template | `configs/modqn-paper-baseline.resolved-template.yaml` | Resolved assumptions, action masking, orbit proxy, hex-7 geometry, penalties, and seeds. |
| Beam geometry | `src/modqn_paper_reproduction/env/beam.py` | Producer-side hex-7 beam ordering and stable local indices. |
| Artifact bridge SDD | `docs/phases/phase-02-artifact-bridge-sdd.md` | Bundle layout, timeline truth, and field-level provenance expectations. |
| Export script | `scripts/export_ntn_sim_core_bundle.py` | Producer-to-consumer artifact export path. |
| Sample bundle | `tests/fixtures/sample-bundle-v1/` | Canonical fixture candidate for schema shape, not necessarily final evidence. |
| Training artifacts | `artifacts/` | Generated evidence candidates. Future implementation must select a specific frozen baseline artifact instead of scanning broadly. |

## 13. Implementation Phase Breakdown After Phase 0

Future phases must be small enough for separate execution conversations.

1. Phase 1: Evidence and artifact lock
   - Select the exact baseline MODQN artifact or bundle to consume.
   - Record producer commit, artifact path, schema, run metadata, and claim
     boundary.
   - Do not add live controls yet.
2. Phase 2: Contract and identity adapter
   - Add a local adapter design/implementation that maps producer/core MODQN
     observation/action/reward identity into `leo-beam-sim` scene/runtime IDs.
   - Resolve string vs numeric beam IDs and 0-based vs 1-based indexes.
3. Phase 3: Vendor beam-layout truth
   - Kill-switch audit `ntn-sim-core/src/core/beam/`.
   - Run source-side validator and record baseline KPI/contract evidence.
   - Vendor only the needed beam layout module and tests.
   - Preserve 7 as baseline and gate 19/37 as sensitivity/demo.
4. Phase 4: Baseline MODQN live adapter
   - Consume the selected MODQN contract surface.
   - Produce live observations over earth-moving multibeam and UE-centric beam
     association.
   - Map MODQN action to handover state without training.
5. Phase 5: Traffic demand / queue overlay
   - Introduce artifact-backed or vendored traffic truth if needed.
   - Keep hex grid as demand/queue visualization, not action-space truth.
6. Phase 6: Runtime controls and labels
   - Add explicit controls for mode and safe beam-count presets.
   - Label `7` as baseline/paper-faithful and `19/37` as sensitivity/demo.
7. Phase 7: Browser demo validation and disclosure hardening
   - Add repo-local validators and browser smoke only after the runtime path is
     implemented.
   - Verify visual labels, artifact immutability, nonblank rendering, and no
     truth mutation.

## 14. Acceptance Criteria Per Future Phase

Phase 1 acceptance:

1. Exact producer artifact path and provenance are named.
2. Artifact is immutable input to `leo-beam-sim`.
3. Producer remains MODQN evidence authority.
4. No 19/37 baseline claim is introduced.

Phase 2 acceptance:

1. Identity adapter round-trips sat/beam IDs deterministically.
2. Beam-index base conversion is tested.
3. Candidate ordering is preserved.
4. Replay/training semantics remain separate from live adapter semantics.

Phase 3 acceptance:

1. `ntn-sim-core` beam module passes kill-switch audit.
2. Source-side validator and baseline KPI/contract evidence are recorded.
3. Destination-side equivalent validator passes.
4. 7/19/37 beam layout truth changes simulation candidates, not only visuals.

Phase 4 acceptance:

1. MODQN observation/action/reward contract is consumed without training.
2. Same-satellite different-beam action emits intra-satellite beam handover.
3. Different-satellite action emits inter-satellite handover.
4. Paper SNR vs live SINR labeling is explicit.
5. HOBS SINR-offset policy is not mislabeled as MODQN.

Phase 5 acceptance:

1. Hex grid displays traffic demand/queue state only from artifact-backed or
   vendored truth.
2. Hex grid does not become the primary action space.
3. Queue/demand fields do not mutate MODQN evidence.

Phase 6 acceptance:

1. UI exposes 7/19/37 with claim labels.
2. 7-beam path is visibly paper-faithful/baseline.
3. 19/37 paths are visibly sensitivity/demo extensions.
4. Beam-count change resets or invalidates runtime state safely.

Phase 7 acceptance:

1. Repo-local MODQN validators exist.
2. Browser smoke proves the integrated story renders and labels correctly.
3. Artifact and vendored truth checks pass without KPI drift.
4. No forbidden EE/Catfish/Multi-Catfish claims are present.

## 15. Validation Plan

Phase 0 validation:

1. Run `git diff --check`.
2. Manual Markdown inspection for headings, tables, and obvious path mistakes.
3. Do not run build, lint, tests, dev server, Playwright/browser smoke,
   MODQN training, or `ntn-sim-core` long validators.

Future source-side validation candidates in `ntn-sim-core`:

1. `npm run validate:core-purity`
2. `npm run validate:modqn`
3. `npm run validate:modqn:m2`
4. `npm run validate:modqn:m3`
5. `npm run validate:modqn:parity`
6. `npm run validate:modqn:fixture-sync`
7. `npm run validate:modqn:bundle`
8. `npm run validate:modqn:bundle-ui`
9. `npm run validate:visual-showcase`
10. Relevant `baseline-kpi-*.json` comparison for any vendored live module.

Future destination-side validation candidates in `leo-beam-sim`:

1. A new MODQN contract/fixture validator.
2. A new identity adapter round-trip validator.
3. A new beam-count preset validator proving 7/19/37 affect simulation truth.
4. Existing `npm run lint` and `npm run build`.
5. Browser smoke only after runtime implementation exists.

## 16. Risks and Open Questions

Risks:

1. Claim drift: existing HOBS profiles and SINR wording could accidentally be
   presented as MODQN baseline evidence.
2. Beam-count drift: current local layout hard-caps beams at 7, so 19/37
   cannot be safely exposed until truth-level layout changes land.
3. Identity drift: producer, `ntn-sim-core`, and `leo-beam-sim` currently use
   different beam ID shapes and index bases.
4. Policy drift: `ntn-sim-core` M1 MODQN adapter can derive heuristic Q-values
   if objective-specific Q-values are absent. That must be disclosed and must
   not be sold as trained-policy evidence.
5. Signal metric drift: paper baseline is SNR/no interference, while the
   current visual runtime is SINR/interference-aware.
6. Orbit proxy drift: producer baseline assumptions, paper catalog, and
   `ntn-sim-core` MODQN defaults each disclose related but not identical orbit
   proxy choices. Future implementation must select the source artifact and
   carry its assumptions explicitly.

Open questions that materially affect future implementation:

1. Which exact `modqn-paper-reproduction` artifact is the frozen baseline
   input for the first demo path?
2. Should the first `leo-beam-sim` MODQN path be replay/artifact-first,
   live-adapter-first, or a staged replay-then-live path?
3. For 19/37 sensitivity, what policy behavior is acceptable before a producer
   repo trains and promotes 19/37 evidence?
4. Should the canonical runtime beam ID in `leo-beam-sim` become the
   `ntn-sim-core` string ID, or should a scene-local numeric ID remain with a
   required adapter map?
5. Which `ntn-sim-core` validator is the minimum source-side gate for the first
   vendored beam/layout module?
6. How should initial attach be represented in MODQN event logs and UI panels
   so it is not confused with penalized inter-satellite handover?
