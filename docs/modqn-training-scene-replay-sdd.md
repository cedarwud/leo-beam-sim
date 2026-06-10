# MODQN Training Scene Replay SDD

## Status

Draft SDD plan on 2026-05-30. Revised on 2026-06-09 to integrate the
training-trigger, model-library, dense-Q proof, and scene-synchronized handover
discussion. This document defines requirements and slices only. It does not
authorize implementation by itself.

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
8. `docs/phase-d-training-visualization-mini-sdd.md`
9. `docs/modqn-training-trigger-backend-sdd.md`
10. `docs/handover-cinema-sdd.md`
11. `/home/u24/papers/ntn-showcase-stack/docs/artifact-contract-v1.md`
12. `/home/u24/papers/ntn-sim-core/docs/modqn-paper-reproduction-to-leo-beam-sim-handoff.md`

## Non-Goals

- Do not implement a trainer in `leo-beam-sim`.
- Do not run live policy inference in the browser.
- Do not use frontend controls to "drive" proof handovers. Replay proof is
  timeline-driven from producer trace rows; live control is a separate future
  runtime problem.
- Do not use SINR live scene state as replay-proof truth.
- Do not promote user-trained model replay to baseline evidence.
- Do not treat a checkpoint-only directory as a loadable model. A selectable
  frontend model requires a manifest, model/checkpoint identity, claim status,
  and replay or trace surface.
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

ADR-002 selects a dedicated producer trace target:
`modqn-training-scene-trace-v1`. `visual-showcase-v1` remains the
display/offline replay artifact. A validated training-scene trace may later
derive a `visual-showcase-v1` window, but the reverse direction must not be
used to infer training-run truth. The typed target decision lives in
`src/modqn/training-scene-trace/artifactTarget.ts`.

The producer-facing export packet lives in
`docs/modqn-training-scene-producer-handoff-packet.md` and
`src/modqn/training-scene-trace/producerHandoff.ts`. It classifies the
40-field checklist into P0 required, P1 source-gap-allowed, and P2
comparison-only fields so `modqn-paper-reproduction` can implement the trace
exporter incrementally without weakening frontend truth boundaries.

The current consumer coverage inventory lives in
`src/modqn/training-scene-trace/inventory.ts`. It compares the contract
against the fields available today from:

- `phase-03a-replay-bundle`: focused-row replay proof; enough for selected
  serving, previous serving, masks, rewards, and optional policy diagnostics,
  but not a scene-complete training trace;
- `user-trained-manifest`: user-trained claim boundary, job identity,
  seed/config/objective context, and artifact pointers, but not per-step
  replay truth;
- `visual-showcase-v1`: strongest current scene source, with provenance,
  truth ownership, timebase, entities, per-frame samples, decisions, metrics,
  and diagnostics, but still no active/next beam schedule or per-step
  handover penalty attribution unless the producer adds those fields.

The inventory is deliberately conservative: `selectedServing`,
`previousServing`, `actionValidityMask`, and `decisionActionValidityMask` may
cover decision context, but never cover `step.activeBeamSchedule` or
`step.nextBeamSchedule`.

### 0. Proof Claim Levels

The MODQN frontend can make three different claims. They must remain visually
and technically separate:

| Claim level | What it proves | Required source | Current allowed UI wording |
|---|---|---|---|
| Pipeline integration | The browser can submit training, monitor jobs, list artifacts, and load a user-trained replay bundle. | Training service job rows, user-trained manifest, replay bundle fetch. | "User-trained artifact loaded" |
| Scene-synchronized MODQN replay proof | The displayed satellite, beam, UE, handover event, selected action, reward, and Q-values are all from the same producer timestep. | `modqn-training-scene-trace-v1` or a validated `visual-showcase-v1` window derived from it. | "Producer MODQN replay proof" |
| Live MODQN control | A running simulator recomputes state, Q-values, action selection, handover state, reward, and next frame after every interactive parameter change. | Future live runtime backed by producer/vendored truth modules. | Not claimable in this SDD |

The first level is useful for demo operability. The second level is the target
for proving that trained MODQN is actually represented in the 3D scene. The
third level is explicitly out of scope until a separate live-runtime design
defines inference, simulator state ownership, and validation.

### 0.1 Current Local Artifact Snapshot

Local audit on 2026-06-09 found multiple training outputs, but only a subset
are currently frontend-loadable replay models:

- `artifacts/user-trained/` contained six job directories.
- Two had both a training-service `manifest.json` and `replay-bundle/manifest.json`.
- Three were failed runs and one was cancelled.
- `artifacts/sdd11-retrain-2026-06-09/` contained trained checkpoints, but no
  training-service manifest, replay bundle, `visual-showcase-v1`, or
  scene-trace artifact, so those checkpoints are not yet selectable frontend
  models.

This snapshot is not a runtime invariant. It records the current reason the
frontend may show only a small model library even though more checkpoints
exist on disk.

### 0.2 Model Library And Job Lifecycle Contract

The frontend should expose a `Model Library`, not a single mutable model slot.
Every `POST /train` result remains under a new producer job ID and must not
overwrite existing user-trained artifacts.

The model library entry for a completed job should show, at minimum:

- job ID, submission time, finish time, status, and artifact tag;
- training profile, arm, trainer subcommand, and request mode;
- resolved hyperparameters, objective weights, seed triplet, and environment
  axes from `trainingTruth` or `run_metadata`;
- checkpoint paths and hashes when the producer exposes them;
- config path and config hash;
- replay/trace availability: `replay-bundle`, `visual-showcase-v1`,
  `modqn-training-scene-trace-v1`, dense-Q export, and validation status;
- claim boundary: user-trained, paper-faithful, producer-official, synthetic,
  source-gap, or non-evidence.

Lifecycle behavior:

- `queued` and `running` jobs may be cancelled.
- `cancelled` means the training run is abandoned; it is not resumable.
- `failed` and `cancelled` runs may keep logs for debugging, but they are not
  selectable models unless a producer manifest explicitly marks a usable
  artifact surface.
- `DELETE /jobs/<id>` removes the job row and artifact directory and should
  remove the model-library entry.
- `pause` and `resume` are not supported. The UI must not expose them as
  working controls until the producer defines checkpoint/signal semantics.
- Protected baseline or producer-official artifacts must be visually separated
  from user-trained artifacts and must not be deleted through the user-trained
  job controls.

Training speed is a job-monitoring metric, not scene truth. The frontend may
derive:

- current episode / episode budget from `TrainingProgressEvent`;
- elapsed wall time from job timestamps or progress event timestamps;
- recent and average episodes/sec from event deltas;
- estimated remaining time from recent episodes/sec.

If the producer does not emit per-episode metrics, the frontend may show
heartbeat/status only and must mark reward/loss curves as source gaps.

### 0.3 Replay Synchronization Principle

Scene-synchronized proof is frame-locked replay, not live control. At render
time `t`, every truth-bearing visual in the viewport must be selected from the
same producer sample:

```text
trace timeline sample
  -> timeSec / slotIndex / source row id
  -> satellite state
  -> beam/cell geometry and validity
  -> UE position and current serving
  -> previousServing and selectedServing
  -> handoverEvent.kind
  -> reward and policy diagnostics
  -> dense per-objective Q and scalarization metadata
  -> renderer projection and camera/story window
```

The frontend may add camera lead-in, highlight easing, labels, and an event
window around the sample time. It must not move the committed decision time,
change old/new identities, reclassify an event, or switch serving before the
producer timestep says the handover is committed.

For an intra/inter handover visual to be claimable:

- `previousServing` and `selectedServing` must resolve to known producer beam
  and satellite entities in the same sample or adjacent explicitly-linked
  samples.
- `handoverEvent.kind` must come from the producer trace. The frontend may
  run a consistency check against old/new satellite IDs, but a mismatch must
  become a validation/source-gap error, not a frontend reclassification.
- satellite positions, beam footprints, and UE positions must come from the
  same timebase or from a documented interpolation policy over adjacent
  producer samples.
- the handover event should carry a stable event ID so the timeline, camera,
  side panel, and viewport highlight all refer to the same event.
- if the producer emits no handover window with both intra and inter events,
  the UI may show only the events present and must not fabricate a balanced
  story.

### 0.4 Dense Q-Value Proof Contract

Top-K diagnostics are not enough for arbitrary weight inspection. A
scene-synchronized MODQN decision proof requires dense Q export for every
action in the producer action order:

```json
{
  "decisionId": "episode-12-slot-120-ue-017",
  "actionOrder": ["sat-0-beam-0", "sat-0-beam-1"],
  "decisionActionValidityMask": [true, true],
  "objectiveQByAction": [
    { "q1Throughput": 223.8, "q2Handover": -0.51, "q3LoadBalance": -3.18 },
    { "q1Throughput": 222.2, "q2Handover": -0.64, "q3LoadBalance": -3.23 }
  ],
  "objectiveWeights": { "throughput": 0.4, "handover": 0.3, "loadBalance": 0.3 },
  "scalarizedQByAction": [88.813, 88.108],
  "selectedActionIndex": 0,
  "tieBreak": "scalarizedQ-desc-actionOrder-asc",
  "invalidActionSentinel": "-inf"
}
```

The frontend may compute `w * Q` for a labeled counterfactual weight slider
only from this dense export and validity mask. It must never fabricate missing
Q-values from scalar scores, beam labels, geometry, or display heuristics. At
the artifact's original weights, the recomputed argmax must reproduce
`selectedActionIndex`; failure is a proof blocker.

### 0.5 Handover Cinema Proof Overlay Contract

The MODQN handover cinema shares the visual shell from
`docs/handover-cinema-sdd.md`, but every proof-bearing value must come from the
producer trace:

- The cinema event key is `eventId + timeSec/slotIndex + ueId`. Camera lead-in,
  slow motion, labels, and easing may surround that event, but old/new serving,
  event kind, selected action, reward, and Q-values stay fixed to the producer
  sample or explicitly linked producer window.
- For every displayed candidate beam/action, show the three objective Q-values
  only when `objectiveQByAction` covers the full producer action order and the
  validity mask marks the action valid. If the beam has no dense Q entry, show a
  source gap instead of interpolating from scalar scores, SINR, geometry, or
  top-K rows.
- The weight control in a replay/proof context is a counterfactual re-ranker
  over exported Q, not a live controller. It may change the highlighted
  counterfactual winner, but it must not change the recorded selected action or
  handover event.
- Do not fill missing MODQN replay fields from `sinr-live`, the live Walker
  event index, or the SINR cell-truth cinema. Those are separate lane-owned
  truth sources.

### 0.6 Per-UE Traffic Queue Proof Contract

Queue/backlog is the preferred way to prove that 100 UEs are being serviced,
but it is also research truth. A replay/proof artifact must provide queue data
per UE and per step before the renderer may claim MODQN served the full
population.

Required per-UE fields for a queue-capable step:

```json
{
  "ueId": "ue-017",
  "trafficArrivalBits": 12000,
  "queueBeforeBits": 48000,
  "servedBits": 9000,
  "queueAfterBits": 51000,
  "serviceRateBps": 900000,
  "servedBy": { "satId": "sat-04", "beamId": "beam-02", "cellId": "cell-11" },
  "queueSource": "producer-trace"
}
```

Validation rule:

```text
queueAfterBits = max(0, queueBeforeBits + trafficArrivalBits - servedBits)
```

The producer may also export aggregate queue metrics, but the renderer must be
able to recompute display aggregates from the per-UE rows for consistency:
`avgQueueBits`, `p95QueueBits`, `maxQueueBits`, `starvedUeCount`,
`perBeamBacklogBits`, `perCellBacklogBits`, and fairness/load-balance metrics.

If a replay artifact lacks queue rows, the UI may still show serving mosaic,
handover events, and dense-Q proof, but queue halo/heatmap/sidebar values must
be hidden or shown as source gaps. Do not derive queue from serving identity,
throughput labels, dot color, or camera focus.

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
- traffic model: arrival process, queue cap/drop policy, initial queue
  distribution, starvation threshold, and whether queue fields are producer
  truth, validated live-sim truth, or display-demo only
- multi-catfish or angle-aware feature flags and model hyperparameters

### 3. Entities

Required:

- `satellites[]`: stable ID, source ID, shell/plane/slot identity, orbital
  source, and display label
- `cells[]`: stable ID, geometry/center, area or polygon, and source frame
- `beams[]`: stable ID, satellite ID, local beam index, global beam index,
  cell binding when scheduled, angle/footprint convention, and reuse group
- `ues[]`: stable ID, initial location, trajectory reference, traffic demand
  profile, initial queue/backlog when queue proof is enabled, and focus
  eligibility
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
- all UE positions, current serving, candidate set, traffic/load, queue
  before/arrival/served/after, and SINR or channel metrics when shown
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
- policy diagnostics, including dense per-objective Q by action, scalarized
  scores, top candidates, tie-break order, and invalid-action sentinel if
  shown
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
| Q values and top candidates | sorting/display only | producer dense policy diagnostics | yes |
| Counterfactual weight slider | yes, as labeled `w * Q` re-ranking only | dense Q, validity mask, original weights, tie-break order | yes |
| Queue halo / heatmap / backlog panel | aggregation and color scaling only | producer per-UE queue rows, or labeled live-service-demo source | yes |
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
- handover-cinema focus only when the event ID, old/new entities, UE position,
  beam geometry, and decision diagnostics resolve to the same trace timebase;
- queue halo/heatmap only when queue source rows exist for the same UE/timebase;
- source-gap badge in the scene when a visible surface is blocked.

### Focus UE Panel

The focus panel should show:

- UE ID, source row, slot, episode, and focus reason;
- location and serving history for the current step;
- old serving and selected serving;
- candidate/action set summary;
- per-candidate Q1/Q2/Q3, scalarized score, validity, and original-weight
  selection self-check when dense Q export exists;
- queue before/after, traffic arrival, served bits, and whether the current
  service decision drained or grew the queue when queue rows exist;
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
cell state, missing all-UE serving history, missing handover penalty
attribution, missing dense-Q proof diagnostics, and missing producer queue
rows. The renderer must not treat `selectedServing`,
`previousServing`, `actionValidityMask`, or `decisionActionValidityMask` as
replacements for these schedules.

Canonical trace-specific source-gap fields are:

- `timeline.sourceRowIdentity`
- `timeline.focusUeSelection`
- `timeline.activeCellState`
- `timeline.allUeServingHistory`
- `timeline.handoverPenaltyAttribution`
- `diagnostics.denseQPolicy`
- `traffic.queueRows`
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
- no frontend code classifies intra/inter handover for proof except as a
  consistency check against producer `handoverEvent.kind`.
- dense-Q proof surfaces require full action coverage, validity masks, and
  original-weight self-checks before showing counterfactual controls.
- queue proof surfaces require source rows plus the queue conservation
  self-check before showing backlog values as producer proof.
- model-library entries disable `Load into scene` unless a manifest and replay
  or trace surface are present.
- job lifecycle controls expose cancel/delete only where supported, and do not
  expose pause/resume as implemented controls.
- the typed consumer registry keeps all proof/comparison training-trace
  requirements mapped to producer-owned paths or canonical source gaps.
- the current coverage inventory keeps `phase-03a-replay-bundle`,
  user-trained manifest, and `visual-showcase-v1` coverage explicit, with
  active/next beam schedule still reported as source gaps until a producer
  exports scheduler truth.
- the producer handoff packet assigns every trace requirement exactly one
  priority: P0 required, P1 source-gap-allowed, or P2 comparison-only.

Browser smoke should verify:

- lane data attributes match the selected mode/source;
- proof lane shows replay evidence and source gaps, not live SINR controls;
- handover cinema seeks and highlights an event by producer event ID and
  sample time, not by a live recomputation;
- queue halo/heatmap/panel values disappear or source-gap when queue rows are
  absent, and match producer rows when present;
- the model library can show parameters before loading a model and can keep
  multiple completed models side by side;
- cancelling a running job changes job state but does not create a selectable
  model;
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

### Slice S1a: Model Library And Job Monitor Cleanup

Status (2026-06-09): D2 frontend cleanup complete. `ArtifactPicker` is now the
Model Library load surface and admits only completed jobs whose
training-service manifest exposes `replayBundle.present === true`. `JobsPanel`
is the job monitor/history surface: active jobs stay visible, failed/cancelled
runs remain in history, completed jobs can be deleted but are loaded only from
the Model Library, and pause/resume remain absent as implemented controls.
Training speed is display-only and appears only when producer progress-event
deltas are available.

- Rehome user-trained artifacts into a model-library surface with one row per
  completed, loadable artifact.
- Show model parameters and claim boundary before `Load into scene`.
- Keep failed/cancelled runs in a separate job-history surface.
- Compute training speed from progress event deltas when available.
- Expose cancel/delete only according to the producer lifecycle contract.
- Add a CORS/readiness check for the selected training-service base URL,
  including the current frontend dev origin.

### Slice S2: Producer-Backed Training Scene Trace Adapter

- Add an adapter for a producer-owned `modqn-training-scene-trace-v1` or
  equivalent artifact.
- Map run, environment, entities, and per-step fields read-only.
- Reject or degrade non-renderable geometry instead of approximating truth.

### Slice S2a: Dense Q And Decision Proof Adapter

- Add a consumer adapter for producer dense-Q diagnostics when the trace or
  replay bundle exports them.
- Require full action coverage, validity mask, original weights, selected
  action, and tie-break metadata.
- Add the original-weight self-check before any counterfactual slider is
  enabled.
- Display per-beam three-objective Q values only from producer export.

**D5 complete (2026-06-09):** `src/modqn/replay-bundle/denseQProof.ts`
implements the consumer-side dense-Q proof gate. It requires full
`objectiveQByAction` coverage over the producer action order, matching validity
mask length, original objective weights, `selectedActionIndex`, tie-break
metadata, and invalid-action sentinel. At original weights it recomputes
`argmax(w * Q)` and only returns `proof-ready` when that self-check reproduces
the producer selected action. Top-K `objectiveQ` and scalarized-only dense
scores remain legacy display diagnostics and surface
`diagnostics.denseQPolicy` as a source gap. The DecisionViz panel displays
Q1/Q2/Q3 only for a proof-ready dense export; current replay artifacts remain
source-gapped until the producer exports the full contract.

### Slice S2b: Per-UE Queue Proof Adapter

- Add a typed adapter for producer per-UE traffic/queue rows.
- Require queue conservation self-checks before enabling queue halo, heatmap,
  or backlog panels as producer proof.
- Add source-gap behavior when a replay has service truth but no queue truth.
- Keep queue proof visually separate from a `sinr-live` demo traffic
  accountant or synthetic showcase artifact.

**D5 source-gap gate complete (2026-06-09):** the trace contract now reserves
`step.queueState` and maps absent producer queue rows to `traffic.queueRows`.
The source-gap registry labels missing replay queue proof separately from the
SINR `live-service-demo` queue accountant. A future producer queue adapter must
still add conservation self-checks before enabling producer queue halo/heatmap
or backlog panels.

### Slice S3: Replay-Proof UI Upgrade

- Add focus UE, old/new sat+beam identity, event narrative, reward, and source
  gap panels for source-backed replay.
- Keep beam hopping inactive unless the producer schedule is present.
- Keep SINR live visuals out of the proof lane.

### Slice S3a: Scene-Synchronized Handover Cinema

Status on 2026-06-09: consumer readiness gate implemented. Current artifacts
remain fail-closed because they do not yet export all producer-owned fields
required for a proof-bearing replay cinema.

- Drive camera focus, old/new beam highlights, service link, and side-panel
  narrative from producer event ID plus sample time.
- Treat intra/inter kind as producer-owned and validate frontend consistency
  against old/new satellite IDs.
- Reuse the visual handover cinema shell, but source MODQN Q-value overlay,
  selected action, reward, and validity mask only from the producer trace.
- Show source gaps when old/new entities, geometry, UE position, or event kind
  cannot be resolved from the same trace timebase.
- Do not use live Walker/SINR state to fill proof-mode holes.

Implemented consumer gate:

- `buildModqnReplayHandoverCinemaGate` returns `ready` only when the active
  focus row has producer handover event ID, non-`none` event kind consistent
  with old/new serving, renderable UE position, renderable old/new satellite
  trajectory, renderable old/new beam footprints, finite reward vector/scalar,
  masks, and `buildModqnDenseQProof` passes.
- The cue panel exposes `data-testid="modqn-replay-cinema-readiness"`,
  `data-replay-cinema-status`, `data-source-gap-fields`, and
  `data-replay-cinema-event-key` so current artifacts visibly stay blocked.
- The gate does not import scene renderer fallbacks, live Walker state, or live
  SINR state.

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

1. Will the producer emit `modqn-training-scene-trace-v1` directly, derive a
   `visual-showcase-v1` window from it, or ship both?
2. Will beam hopping schedule be emitted per step as active tuples, masks, or
   cell schedule references?
3. Are angle-aware and energy-efficiency terms available per UE/step, per
   selected action only, or summary-only?
4. Does comparison use one shared environment/timebase across models, or does
   each model own a separate run that needs alignment metadata?
5. Which producer field chooses the focus UE for story playback, if any?
6. Which producer field is the stable model identity: checkpoint hash, policy
   ID, job ID, config hash, or a composite?
7. Will dense per-objective Q be emitted for all actions at every decision
   frame, or only for selected focus events?
8. Does the producer want cancelled/failed run logs retained indefinitely,
   LRU-expired, or deleted only by explicit user action?
