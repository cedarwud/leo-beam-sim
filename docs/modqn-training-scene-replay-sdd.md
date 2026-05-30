# MODQN Training Scene Replay SDD

## Status

Draft SDD plan on 2026-05-30. This document defines requirements and slices
only. It does not authorize implementation by itself.

## Purpose

The frontend MODQN experience should eventually replay the real
multi-catfish, angle-aware EE-MODQN training scene with full provenance. The
goal is not just to make the viewport look plausible. The viewer should be
able to inspect the exact environment, focus UE, candidate beams, selected
action, reward, energy-efficiency terms, and inter/intra handover events that
the producer training run used.

For replay/proof lanes, `leo-beam-sim` is a renderer and interaction shell.
It must not infer or rewrite SINR, handover events, MODQN actions, rewards,
beam hopping, active beam schedules, geometry truth, evidence status, or
provenance. Missing truth is a source gap.

## Read Order

Read these before changing this SDD or implementing a slice:

1. `AGENTS.md` and `CLAUDE.md`
2. `docs/frontend-render-governance.md`
3. `docs/frontend-mode-lane-separation-sdd.md`
4. `docs/decisions/ADR-001-scene-lane-render-boundary.md`
5. `docs/modqn-handover-story-layer-sdd.md`
6. `docs/modqn-training-truth-visualization-sdd.md`
7. `docs/modqn-realistic-beam-geometry-cross-repo-sdd.md`
8. `/home/u24/papers/ntn-showcase-stack/docs/artifact-contract-v1.md`
9. `/home/u24/papers/ntn-sim-core/docs/modqn-paper-reproduction-to-leo-beam-sim-handoff.md`

## Non-Goals

- Do not implement a trainer in `leo-beam-sim`.
- Do not run live policy inference in the browser.
- Do not use SINR live scene state as replay-proof truth.
- Do not promote user-trained model replay to baseline evidence.
- Do not infer beam hopping from `selectedServing`, `previousServing`,
  `actionValidityMask`, `decisionActionValidityMask`, or handover events.
- Do not route `modqn-replay-proof` through profile-derived overlays.
- Do not add a new replay lane without updating scene-lane governance
  validators.

## Definition: 100 Percent Training Scene Replay

The phrase "100 percent replay" means the displayed state for a sampled
training step can be traced back to producer-owned data for every
research-truth field shown as truth:

- environment axes and paper/config variant;
- deterministic run identity, commits, seeds, and artifact hashes;
- satellites, beams/cells, UEs, and their stable producer IDs;
- per-step satellite/beam/cell/UE state in the producer coordinate frame;
- active/inactive/next beam schedule when beam hopping is shown;
- selected action, old/new serving identity, and validity masks;
- handover kind and penalty source;
- angle-aware features and energy-efficiency terms;
- reward vector, scalar reward, policy diagnostics, and objective weights;
- model identity and comparison baseline when multiple policies are shown.

If any of the above is missing, the frontend may still show display-only
context, but the missing truth must be presented as a source gap.

## Scene Lanes

| Lane | Intended use | Truth source | Beam hopping behavior | Claim boundary |
|---|---|---|---|---|
| `modqn-live-cell-preview` | Live demo and profile-derived preview | live/profile runtime plus Phase I cell schedule | may show active/inactive/next only as profile-derived demo | not baseline proof |
| `modqn-replay-proof` | Baseline replay proof | immutable producer replay bundle or producer `visual-showcase-v1` | source gap unless producer exports active beam schedule | source-backed baseline proof only |
| user-trained model replay | Explicit replay of a backend training artifact | immutable user-trained bundle and manifest | source gap unless that bundle exports active beam schedule | user-trained artifact, not paper-faithful evidence |
| training run replay | Replay a full training run, episode, or checkpoint evolution | producer training-run trace | producer schedule only; no interpolation of truth states | training-run evidence, not final-policy baseline unless promoted |
| model comparison replay | Compare multiple policies on a shared timeline | producer comparison artifact with aligned seeds/timebase | per-model schedule only if exported per model/run | comparative evidence scoped to artifact |
| `artifact-replay` | Offline `visual-showcase-v1` replay | validated artifact | artifact-owned roles only | artifact claim boundary only |

Implementation note: user-trained model replay, training run replay, and model
comparison replay may be modeled as sub-lanes or explicit source modes, but
they must not reuse `modqn-live-cell-preview` proof ownership. If they mount
new viewport proof layers, `SceneLane`, `sceneLaneRenderPlan`, governance docs,
and validators must change together.

## Producer-Backed Trace Contract

This SDD is mirrored by the consumer-side registry in
`src/modqn/training-scene-trace/contract.ts`. The registry is intentionally a
read-only contract map, not an artifact parser. It records:

- the currently recognized display lanes and whether each lane may claim
  proof, mount profile-derived overlays, or use SINR live visuals;
- every required training-scene trace field and the producer path that must
  own it;
- whether display-derived projection is allowed for that field;
- which canonical source-gap field must appear when producer truth is absent.

Adapters for `visual-showcase-v1`, user-trained bundles, training-run traces,
or comparison artifacts must consume this registry instead of adding local UI
booleans. If a producer chooses to extend `visual-showcase-v1`, validation
must land in `ntn-sim-core` first; `leo-beam-sim` only adds fail-closed
consumer checks.

### 1. Run And Provenance

Required:

- `schemaVersion`
- `runId`, `artifactId`, `modelId`, `policyId`
- producer repo, commit, branch, dirty state, and command
- producer config path and config `sha256`
- source artifact paths and hashes
- validation results and validator versions
- claim boundary and evidence status
- RNG seeds and implementation notes
- paper/config family, such as baseline MODQN, angle-aware EE-MODQN, or
  multi-catfish comparison arm

### 2. Environment Axes

Required:

- satellite pool size, serving satellite count, altitude, inclination, shell,
  epoch, observer, and coordinate frame
- beam count per satellite, cell count, cell layout, active beam capacity,
  scheduler settings, and beam hopping enabled/disabled
- UE count, UE distribution, UE mobility trace or static coordinates, and
  mobility seed
- antenna pattern, angle convention, frequency, bandwidth, transmit power,
  noise, path-loss/fading model, and frequency reuse
- objective weights and reward-term definitions
- handover penalty definition, inter/intra penalty split, and any dwell/timer
  settings
- multi-catfish or angle-aware feature flags and model hyperparameters

### 3. Entities

Required:

- `satellites[]`: stable ID, source ID, shell/plane/slot identity, orbital
  source, and display label
- `cells[]`: stable ID, geometry/center, area or polygon, and source frame
- `beams[]`: stable ID, satellite ID, local beam index, global beam index,
  cell binding when scheduled, angle/footprint convention, and reuse group
- `ues[]`: stable ID, initial location, trajectory reference, traffic demand
  profile, and focus eligibility
- `models[]` for comparisons: model ID, algorithm family, checkpoint ID,
  training run ID, objective weights, and allowed claim status

### 4. Step Trace

Each replay step should include:

- `episodeIndex`, `slotIndex`, `stepIndex`, `timeSec`, and source row ID
- visible/eligible satellites and beams
- per-satellite position/elevation/azimuth/range in a renderable producer
  coordinate frame
- per-cell active/inactive state
- active beam schedule as producer tuples such as
  `(cellId, satId, beamId, localBeamIndex)`
- next-slot and optional lookahead schedule if the UI shows "next"
- all UE positions, current serving, candidate set, traffic/load, and SINR or
  channel metrics when shown
- focus UE ID and focus reason
- previous serving and selected serving with stable old/new satellite and
  beam IDs
- selected action index and action identity
- `visibilityMask`, `actionValidityMask`, `decisionVisibilityMask`, and
  `decisionActionValidityMask` as masks only, not schedule truth
- handover event kind, source, target, and penalty attribution
- reward vector, scalar reward, and objective weights
- angle-aware terms, such as off-axis angle, antenna gain, steering loss, and
  elevation/azimuth when the UI labels them as truth
- energy-efficiency terms, such as transmit power, consumed power, throughput,
  Joule/bit, and objective contribution
- policy diagnostics, including Q values/top candidates if shown
- `sourceGaps[]` for fields absent at that step

### 5. Comparison Trace

For model comparison, the producer must provide an aligned comparison artifact:

- shared environment, seeds, timebase, UE trace, and cell/beam schedule;
- one decision/reward/diagnostic stream per model;
- per-model old/new serving identity and handover event stream;
- per-model source gaps;
- aggregate metrics computed by the producer, not by the renderer.

The frontend may compute display deltas, sort rows, and highlight differences,
but it must not recompute research metrics or invent counterfactual actions.

## Display-Derived, Producer-Backed, Source-Gap

| Surface | Display-derived allowed | Producer-backed required | Source gap when absent |
|---|---|---|---|
| Camera, zoom, label placement, opacity, animation easing | yes | no | no |
| Focus UE highlight and trail styling | yes, from producer focus UE or selected row | focus UE ID or row selection source | yes if focus is claimed as producer-selected |
| Old/new sat and beam labels | formatting only | `previousServing`, `selectedServing`, handover event | yes if missing identity |
| Inter/intra handover kind | no | producer `handoverEvent.kind` or equivalent event trace | yes |
| Active/inactive beam state | no | producer active beam schedule/mask | yes |
| Next beam preview | no | producer lookahead schedule | yes |
| Beam hopping animation | no | producer schedule across steps | yes |
| UE positions and mobility | display projection only | producer UE trace or static coordinates | yes |
| Satellite positions and paths | display projection only | producer renderable ephemeris/topocentric samples | yes |
| Beam footprints/contours | display projection only | producer footprint/angle convention or contour | yes |
| Angle-aware metrics | formatting and chart scaling | producer angle/gain/feature terms | yes |
| Energy-efficiency terms | chart scaling | producer energy/power/throughput terms | yes |
| Reward vector and scalar reward | formatting and axis scaling | producer reward trace | yes |
| Handover penalty | formatting only | producer penalty term/definition | yes |
| Q values and top candidates | sorting/display only | producer policy diagnostics | yes |
| Multi-model delta highlight | yes, if computed from producer per-model values | per-model producer values | yes |
| Claim boundary/evidence chips | no | artifact provenance/evidence status | yes |

## UI Information Architecture

### Main Viewport

The viewport should carry one story at a time:

- focus UE, with old/new serving relation;
- old satellite/beam and new satellite/beam identity;
- active beam set and inactive cells only when schedule truth exists;
- next beam preview only when producer lookahead exists;
- inter-HO transfer ribbon or intra-HO beam-switch arc only when the event
  trace supports that kind;
- source-gap badge in the scene when a visible surface is blocked.

### Focus UE Panel

The focus panel should show:

- UE ID, source row, slot, episode, and focus reason;
- location and serving history for the current step;
- old serving and selected serving;
- candidate/action set summary;
- current event narrative, such as:
  `UE-017 switched Sat-04/B2 -> Sat-07/B5; inter-HO penalty applied`.

If the current artifact does not identify a producer focus UE, the UI may use
display focus selection, but it must label it as display-selected.

### Angle And Energy Panel

This panel should be source-backed only. It should show:

- off-axis angle, elevation/azimuth, antenna gain, and steering loss;
- throughput, transmit power, consumed power, Joule/bit, and EE objective;
- reward vector and scalar reward;
- handover penalty and whether it is inter or intra.

If the producer artifact has rewards but no energy terms, display rewards and
show an energy-source gap. If it has energy summary but no per-step terms,
show summary-only and avoid per-step visual claims.

### Timeline Narrative

The timeline should be event-first, not raw-row-first:

- episode/slot scrubber;
- event chips: no event, intra, inter, penalty spike, energy dip, reward peak;
- narrative row for the focused event;
- source-gap markers aligned to the timebase;
- comparison markers when models diverge.

Narrative text is display-derived from producer fields, but it may not change
event kind, old/new identity, reward, or penalty attribution.

### Model Comparison

The comparison view should separate shared context from per-model decisions:

- one shared environment/timebase strip;
- per-model lanes with selected old/new serving, reward, EE term, and penalty;
- divergence markers where policies choose different beams or HO types;
- aggregate metrics from producer comparison output;
- claim chips per model/run.

The main 3D viewport should not render all model paths as equal-strength
overlays. Prefer one selected model in the viewport plus a comparison table or
small multiples. If multiple paths are shown, use explicit model labels and
avoid visual ambiguity about the active selected model.

## Source Gap Requirements

Every source gap should include:

- `field`: stable field ID, such as `beamHopping.activeSchedule`
- `surface`: viewport, focus panel, angle panel, timeline, or comparison
- `reason`: missing, non-renderable frame, display-only provenance, or
  incompatible lane/source
- `requiredProducerField`: suggested producer field or artifact path
- `claimImpact`: what the UI is not allowed to claim

Mandatory source gaps for current replay-proof artifacts include missing
producer active beam schedule, missing producer lookahead schedule, missing
stable source-row identity, missing producer focus UE selection, missing active
cell state, missing all-UE serving history, and missing handover penalty
attribution. The renderer must not treat `selectedServing`,
`previousServing`, `actionValidityMask`, or `decisionActionValidityMask` as
replacements for these schedules.

Canonical trace-specific source-gap fields are:

- `timeline.sourceRowIdentity`
- `timeline.focusUeSelection`
- `timeline.activeCellState`
- `timeline.allUeServingHistory`
- `timeline.handoverPenaltyAttribution`
- `comparison.alignedTimebase`

## Validation Plan

Static validators should enforce:

- no scene lane mounts a proof layer from `appMode` alone;
- `modqn-live-cell-preview` keeps profile-derived story copy and does not
  expose baseline-proof claims;
- `modqn-replay-proof` does not mount live/profile-derived handover story
  overlays;
- active/inactive/next beam UI requires producer schedule truth outside live
  preview;
- replay-proof source gaps are visible when schedule truth is missing;
- SINR live visual systems do not mount in MODQN replay-proof or artifact
  replay;
- new comparison/training-run lanes update `SceneLane`, render plan, docs, and
  validator expectations together;
- no frontend code derives beam hopping from serving identity or validity masks.
- the typed consumer registry keeps all proof/comparison training-trace
  requirements mapped to producer-owned paths or canonical source gaps.

Browser smoke should verify:

- lane data attributes match the selected mode/source;
- proof lane shows replay evidence and source gaps, not live SINR controls;
- live preview clearly says it is not baseline proof;
- artifact replay stays artifact-only;
- comparison surfaces do not overlap or obscure source-gap messages on desktop
  and narrow viewports.

Producer/artifact validation should run before consumer rendering:

```bash
cd /home/u24/papers/ntn-sim-core
npm run validate:visual-showcase:artifact -- /path/to/visual-showcase-v1.json
```

For future training-run or comparison contracts, the producer repo should own
schema validation first. `leo-beam-sim` validators should only check read-only
mapping, fail-closed behavior, and UI ownership.

## Phased Implementation Slices

### Slice S0: SDD And Contract Inventory

- Land this SDD.
- Inventory current replay bundle, user-trained bundle, training manifest,
  and `visual-showcase-v1` fields against the required trace contract.
- Produce a source-gap map for the current baseline and user-trained paths.
- No viewport implementation.

### Slice S1: Source-Gap Model And UI Contract

- Add a typed source-gap model shared by proof, user-trained replay, and
  future comparison views.
- Surface gaps in the replay proof cue panel and timeline.
- Add validators proving missing active schedule stays a gap.

### Slice S2: Producer-Backed Training Scene Trace Adapter

- Add an adapter for a producer-owned `modqn-training-scene-trace-v1` or
  equivalent artifact.
- Map run, environment, entities, and per-step fields read-only.
- Reject or degrade non-renderable geometry instead of approximating truth.

### Slice S3: Replay-Proof UI Upgrade

- Add focus UE, old/new sat+beam identity, event narrative, reward, and source
  gap panels for source-backed replay.
- Keep beam hopping inactive unless the producer schedule is present.
- Keep SINR live visuals out of the proof lane.

### Slice S4: Training Run Replay

- Add training-run source mode for episode/checkpoint replay.
- Show learning progress only from producer training trace.
- Keep final-policy replay and training-run replay visually distinct.

### Slice S5: Model Comparison Replay

- Add comparison source mode and aligned per-model timeline.
- Show per-model decisions, rewards, EE terms, and handover penalties from a
  producer comparison artifact.
- Add divergence markers and selected-model viewport ownership.

### Slice S6: Producer Contract Promotion

- Once `modqn-paper-reproduction` exports the needed trace fields, promote the
  contract into `ntn-showcase-stack` and `ntn-sim-core` validation.
- Update `visual-showcase-v1` or define a new dedicated contract if the trace
  is too training-specific for the showcase artifact.
- Only after validation, remove corresponding source gaps from proof lanes.

## Open Producer Questions

1. What is the canonical artifact name: extend `visual-showcase-v1` or add
   `modqn-training-scene-trace-v1`?
2. Will beam hopping schedule be emitted per step as active tuples, masks, or
   cell schedule references?
3. Are angle-aware and energy-efficiency terms available per UE/step, per
   selected action only, or summary-only?
4. Does comparison use one shared environment/timebase across models, or does
   each model own a separate run that needs alignment metadata?
5. Which producer field chooses the focus UE for story playback, if any?
