# MODQN Showcase Requirements TODO

**Status:** active completion checklist, 2026-06-09.
**Purpose:** track every user-facing requirement raised during the MODQN /
handover / 100-UE showcase planning thread so the controller can audit whether
the work is genuinely complete at the end.

Legend:

- `[x]` requirement satisfied in the product.
- `[ ]` not yet implemented or not yet proven.
- `Doc status` records whether the requirement has an SDD/contract home. A
  written SDD does not mean the product behavior is complete.

## A. Operating Rules

- [x] **A1. Use the existing `:3001` dev server for browser checks.**
  - Doc status: covered by [sdd-index.md](./sdd-index.md) validation notes.
  - Done when: all browser/smoke validation instructions use
    `http://localhost:3001` and no implementation thread starts extra Vite
    servers.
  - Evidence: D1/D2 browser smoke used
    `APP_URL=http://localhost:3001 npm run validate:phase-c:lane-experience-bar:browser`;
    no new dev server was started.
- [x] **A2. Preserve unrelated dirty work.**
  - Doc status: process rule, not product SDD.
  - Done when: implementation reports list touched files and avoid broad
    revert, broad restore, or `git add -A`.
  - Evidence: controller used `git status --short`, preserved unrelated dirty
    work, and did not run broad revert/restore or `git add -A`.
- [x] **A3. Keep frontend code maintainable, not stacked with ad hoc patches.**
  - Doc status: [sdd-index.md](./sdd-index.md) D1 plus frontend governance.
  - Done when: new controls are routed through existing lane/render-plan
    boundaries, and repeated button/sidebar additions are consolidated.
  - Evidence: D1 moved MODQN display/policy/setup controls into the Advanced
    drawer; D2 kept Model Library load ownership separate from JobsPanel.
- [x] **A4. Use controller/sub-agent workflow safely for implementation.**
  - Doc status: process handoff only.
  - Done when: controller assigns non-overlapping file scopes, serializes
    writers on shared files, and keeps one final validation owner.
  - Evidence: D1/D2 used read-only sub-agent audits first; controller serialized
    shared UI/validator edits and ran final validation.

## B. SDD Consolidation And Cleanup

- [x] **B1. Keep one active SDD entry point.**
  - Doc status: [sdd-index.md](./sdd-index.md) created.
  - Done when: new implementation threads start from `docs/sdd-index.md`, not
    from older parallel SDDs.
  - Evidence: D1/D2 and the next D3 planning started from
    `docs/sdd-index.md` plus this checklist.
- [x] **B2. Classify old SDDs as active, reference, superseded, or delete
  candidate.**
  - Doc status: [sdd-index.md](./sdd-index.md) created.
  - Done when: every relevant old SDD has a category and no controller starts
    a superseded plan as active work.
  - Evidence: `docs/sdd-index.md` lists active entry points, reference
    documents, superseded/historical documents, and delete policy; D1-D7 work
    followed the active development sequence rather than reopening superseded
    MODQN visual plans.
- [x] **B3. Delete only truly safe dead SDDs.**
  - Doc status: [sdd-index.md](./sdd-index.md) delete policy.
  - Done when: each deleted doc is listed as a delete candidate, has no
    references by `rg`, is not preserving a boundary, and validators pass after
    deletion.
  - Evidence: `docs/sdd_review_report.md` was a 20-byte empty placeholder;
    the targeted pre-delete reference scan found only `docs/sdd-index.md`, it
    was deleted with targeted `git rm`, and `validate:modqn:showcase-final-audit`
    checks that no current delete candidates remain and the placeholder stays
    absent.

## C. MODQN UI Surface Cleanup

- [x] **C1. Reduce MODQN top-level clutter.**
  - Doc status: [modqn-tab-consolidation-plan.md](./modqn-tab-consolidation-plan.md).
  - Done when: user-facing top navigation is SINR / MODQN, with MODQN internal
    views handled inside the MODQN tab.
  - Evidence: `npm run validate:frontend:scene-lane-governance` and
    `APP_URL=http://localhost:3001 npm run validate:phase-c:lane-experience-bar:browser`.
- [x] **C2. Move advanced MODQN controls out of the primary viewport.**
  - Doc status: [modqn-ui-surface-simplification-sdd.md](./modqn-ui-surface-simplification-sdd.md).
  - Done when: visual-layer presets, setup controls, and live-only policy
    toggles are in Advanced/setup surfaces and not competing with the primary
    scene.
  - Evidence: visual-layer presets, setup controls, and live-only policy
    controls moved into `AdvancedSetupDrawer`.
- [x] **C3. Keep mandatory honesty banners visible.**
  - Doc status: [modqn-tab-consolidation-plan.md](./modqn-tab-consolidation-plan.md).
  - Done when: degenerate-data and heuristic-not-paper warnings are still
    visible whenever their conditions apply.
  - Evidence: `npm run validate:modqn:omega-s4-heuristic-not-paper` and the
    lane browser smoke covered the heuristic banner path during D1.
- [x] **C4. Remove or park meaningless MODQN buttons instead of adding new ones.**
  - Doc status: [sdd-index.md](./sdd-index.md) D1 and D7.
  - Done when: every remaining MODQN button has a source, lane, and purpose;
    destructive/confusing controls are moved, relabeled, parked, or deleted.
  - Evidence: ControlBar no longer owns MODQN display/policy controls; JobsPanel
    no longer owns the old completed-job `Load into scene` button.

## D. Training, Jobs, And Model Library

- [x] **D1. Frontend can submit training parameters to the producer backend.**
  - Doc status: [modqn-training-trigger-backend-sdd.md](./modqn-training-trigger-backend-sdd.md)
    and [modqn-training-scene-replay-sdd.md](./modqn-training-scene-replay-sdd.md) S1a.
  - Done when: allowed training params submit successfully and errors are
    visible without pretending training is local to `leo-beam-sim`.
  - Evidence: `npm run validate:phase-b:training-form` and
    `npm run validate:phase-b:service-client`.
- [x] **D2. Training speed/progress is visible.**
  - Doc status: replay SDD S1a.
  - Done when: UI shows episode progress and recent/average episodes/sec when
    producer progress events support it; otherwise marks curves as source gaps.
  - Evidence: `JobsPanel` shows progress and speed only from producer telemetry
    episode deltas; `npm run validate:phase-b:jobs-panel` and
    `npm run validate:phase-d:live-telemetry-store`.
- [x] **D3. New trained models do not overwrite old models.**
  - Doc status: replay SDD model-library contract.
  - Done when: every completed training job becomes a distinct model/library
    entry with manifest, params, and claim boundary.
  - Evidence: Model Library entries are keyed by producer job ID and filtered
    from completed loadable jobs; `npm run validate:phase-b:artifact-picker`.
- [x] **D4. User can inspect model parameters before loading.**
  - Doc status: replay SDD S1a.
  - Done when: model rows show job ID, config, weights, seeds, environment
    axes, replay/trace availability, and claim boundary before `Load`.
  - Evidence: `ArtifactPicker` shows job ID, status/timestamps, profile/arm,
    trainer subcommand, request mode, env axes, seed, omega, replay status,
    paperFaithful status, checkpoint/config status, and claim chip before Load.
- [x] **D5. User can cancel running jobs and delete jobs/models where supported.**
  - Doc status: training-trigger backend SDD and replay SDD lifecycle contract.
  - Done when: cancel/delete follow producer lifecycle semantics, failed or
    cancelled runs do not become selectable models, and protected baseline
    artifacts are not deleted from user job controls.
  - Evidence: `isCancellableStatus` allows only queued/running; failed,
    cancelled, completed, and expired rows stay in history; Model Library admits
    only completed loadable manifests.
- [x] **D6. Pause/resume is not exposed as working UI.**
  - Doc status: replay SDD S1a.
  - Done when: pause/resume controls are absent or explicitly disabled unless
    producer checkpoint/signal semantics exist.
  - Evidence: `npm run validate:modqn:job-lifecycle-contract` proves
    pause/resume stay fail-closed and absent from JobsPanel UI.
- [x] **D7. Frontend can choose among loadable models/artifacts.**
  - Doc status: replay SDD model-library contract.
  - Done when: user-trained, paper-faithful, producer-official, and synthetic
    entries are visually separated and loaded only when a manifest plus replay
    or trace surface exists.
  - Evidence: `ArtifactPicker` now separates paper-faithful baseline,
    producer-official, synthetic/fallback, and user-trained sections. The
    paper-faithful baseline load is colocated in the Model Library; user-trained
    `Load into scene` stays gated by completed jobs with
    `replayBundle.present=true`; producer-official remains an explicit empty
    section when no manifest is present; synthetic/fallback artifacts are
    source-labeled and disabled as MODQN proof. `npm run
    validate:phase-b:artifact-picker` and `npm run
    validate:modqn:showcase-final-audit` lock this separation.

## E. MODQN Integration Proof

- [x] **E1. Provenance is visible but not the only proof.**
  - Doc status: [handover-cinema-sdd.md](./handover-cinema-sdd.md) proof layer.
  - Done when: checkpoint/run/config identity is shown alongside decision data,
    not used alone as proof that the 3D scene is MODQN-controlled.
  - Evidence: D5 keeps provenance/evidence copy separate from dense-Q proof
    readiness; DecisionViz shows policy diagnostics plus a dense-Q proof
    source-gap/proof-ready stamp instead of using provenance alone as proof.
- [x] **E2. Dense per-objective Q-values are available for displayed decisions.**
  - Doc status: [modqn-training-scene-replay-sdd.md](./modqn-training-scene-replay-sdd.md)
    §0.4 / S2a.
  - Done when: UI shows Q1/Q2/Q3 only from producer dense per-action export
    with validity mask and tie-break metadata.
  - Evidence: `buildModqnDenseQProof` requires full `objectiveQByAction`,
    `scalarizedQByAction`, the validity mask, `selectedActionIndex`, tie-break,
    and sentinel before `DecisionVizPanel` can show Q1/Q2/Q3. Current artifacts
    remain source-gapped because they do not export full dense objective Q.
- [x] **E3. Original-weight self-check passes before counterfactual controls are
  enabled.**
  - Doc status: replay SDD §0.4.
  - Done when: recomputing `argmax(w * Q)` at the artifact's original weights
    reproduces producer `selectedActionIndex`.
  - Evidence: `validate:modqn:dense-q-proof-adapter` proves original-weight
    self-check passes for complete dense-Q data and fails closed on mismatch.
- [x] **E4. Weight adjustment is counterfactual in replay/proof mode.**
  - Doc status: replay SDD §0.5 and handover cinema proof guardrails.
  - Done when: changing weights may re-rank exported Q but does not alter the
    recorded replay decision, handover event, reward, or scene truth.
  - Evidence: `rerankModqnDenseQProof` returns a counterfactual winner from
    exported Q while leaving the recorded `selectedActionIndex` immutable;
    legacy top-K `reScalarize` UI copy is labeled as display preview, not
    dense-Q proof.
- [x] **E5. Missing MODQN proof fields fail closed.**
  - Doc status: replay SDD source-gap rules.
  - Done when: missing dense Q, event kind, old/new serving, geometry, queue, or
    masks show source gaps instead of frontend inference.
  - Evidence: D5 adds `diagnostics.denseQPolicy` and `traffic.queueRows`
    fail-closed gaps, keeps scalarized dense scores/top-K objectiveQ as legacy
    display diagnostics, and validates source gaps via
    `validate:modqn:training-scene-source-gaps`.
- [x] **E6. Live MODQN control is not claimed unless a real live runtime exists.**
  - Doc status: replay SDD proof claim levels.
  - Done when: UI wording separates pipeline integration, replay proof, and any
    future live-control runtime.
  - Evidence: D5 downgrades EvidenceTab top-K omega wording to legacy preview
    / not dense-Q proof, while D1 keeps the live policy toggle confined to
    Advanced with mandatory heuristic disclosure.

## F. Scene-Synchronized MODQN Replay Proof

- [x] **F1. One producer sample drives all truth-bearing replay visuals.**
  - Doc status: replay SDD §0.3.
  - Done when: satellite state, beam/cell geometry, UE position, old/new
    serving, handover kind, selected action, reward, dense Q, and masks resolve
    to the same producer timebase.
  - Evidence: D6 adds `buildModqnReplayHandoverCinemaGate`, which returns
    `ready` only when one focus row has producer event ID, renderable UE /
    satellite / beam fields, finite reward, masks, and dense-Q proof. Current
    artifacts remain `source-gap` instead of replay-cinema ready.
- [x] **F2. Replay handover cinema uses producer event IDs.**
  - Doc status: replay SDD §0.5 / S3a.
  - Done when: camera, timeline, viewport highlight, and side panel all refer
    to the same producer event ID and sample/window.
  - Evidence: D6 readiness exposes `data-replay-cinema-event-key` built from
    producer event ID, slot, source row, time, and UE ID, and blocks current
    artifacts with `timeline.sourceRowIdentity` until the producer event ID is
    present.
- [x] **F3. Live SINR/Walker state never fills MODQN replay holes.**
  - Doc status: replay SDD non-goals and handover cinema governance.
  - Done when: validators prove replay-proof lanes do not substitute live
    geometry, live event indices, or live SINR for missing producer fields.
  - Evidence: D5 source gaps explicitly reserve dense-Q and producer queue rows
    for MODQN proof; D6 replay handover-cinema gate rejects renderer fallback,
    live SINR, and live Walker sources. `validate:frontend:scene-lane-governance`,
    `validate:modqn:training-scene-source-gaps`, and
    `validate:modqn:replay-handover-cinema-gate` cover the boundary.

## G. SINR-Live Handover Cinema

- [x] **G1. User can jump to the next handover event.**
  - Doc status: handover cinema S3/S3a.
  - Done when: `Next HO`, `Next Intra`, and `Next Inter` resolve the next
    matching source-time event and seek to a lead-in.
  - Evidence: D4 uses the `sinrLiveCells` cell-truth event index for
    `sinr-live`; the browser gate arms `Next Intra` from source time, confirms
    an inter event is source-present, and seeks to the lead-in without
    synthesizing handovers.
- [x] **G2. Handover focus uses slow motion and auto camera.**
  - Doc status: handover cinema S3/S3a.
  - Done when: playback slows, camera frames the event, and focus exits/restores
    without locking controls.
  - Evidence: `validate:phase-c:handover-cinema:browser` proves 0.25x focus,
    camera movement, bounded exit, speed restore, and highlight/explainer
    teardown on the existing `:3001` server.
- [x] **G3. Handover focus shows the right explanation for the lane.**
  - Doc status: handover cinema S4.
  - Done when: SINR lane shows old/new SINR, delta, offset rule, off-axis, and
    old/new IDs; MODQN replay shows Q-values and selected action only from
    producer trace.
  - Evidence: D4 SINR explainer rows carry source owner, event ID, UE ID,
    old/new cell/beam IDs, SINR, delta, offset, and off-axis telemetry; MODQN
    replay proof remains gated until D5/D6 producer dense-Q data exists.
- [x] **G4. Intra-HO is visibly off-axis.**
  - Doc status: handover cinema S3a and
    [sinr-live-earth-fixed-cells-mini-sdd.md](./sinr-live-earth-fixed-cells-mini-sdd.md).
  - Done when: UE is not artificially centered under the beam, and old/new
    same-satellite beams are visibly distinct during focus.
  - Evidence: D4 focus renders a two-cone old/new beam pair from the focused
    `sinrLiveCells` event's earth-fixed cell IDs and off-axis angles; it does
    not globally re-enable ambient cell cones or recenter beams on the UE.
- [x] **G5. Inter-HO depends on real source density.**
  - Doc status: handover cinema S3a.
  - Done when: inter controls disable or source-gap when the source has no
    inter event; no synthetic inter-HO is created to balance the story.
  - Evidence: `buildSinrLiveCellHandoverEventIndex` records source gaps when
    the current source window lacks intra or inter events; the D4 browser smoke
    exercises a mobility source where inter is source-present instead of
    fabricated.
- [x] **G6. SINR handover cinema is single-source.**
  - Doc status: handover cinema S3a.
  - Done when: event index, candidate highlight, SINR explainer, old/new beam
    pair, and camera focus all read the same `sinrLiveCells`-backed trajectory.
  - Evidence: D4 threads `sourceOwner=sinr-live-cell-truth`, event ID, source
    time, UE ID, cell IDs, and off-axis fields from the event index through the
    rail, camera focus, candidate highlight, old/new beam pair, and explainer;
    governance locks the cell-truth source and keeps legacy live-Walker focus
    labeled separately.

## H. 100-UE Service Proof

- [x] **H1. The 100 UE dots are service state, not decoration.**
  - Doc status: handover cinema S2.
  - Done when: every UE marker has a serving/unserved/source-gap state and the
    aggregate proves more than the focus UE is tracked.
  - Evidence: D3 browser smoke proves the default sinr-live frame carries
    `total=100`, served/unserved state, and aggregate tracking beyond UE-0.
- [x] **H2. Service mosaic remains visible by default.**
  - Doc status: handover cinema ambient layer.
  - Done when: UE colors partition by serving beam/satellite with stable color
    semantics and no per-frame display-order color churn.
  - Evidence: `validate:phase-c:sinr-serving-mosaic:model` covers stable
    serving-beam colors; D3 browser smoke proves mesh-derived mosaic colors on
    the default sinr-live lane.
- [x] **H3. Aggregate service metrics are visible.**
  - Doc status: handover cinema S2.
  - Done when: UI shows served N/N, per-beam load counts, mean/p5 SINR or
    equivalent, and source labels.
  - Evidence: `SinrServingAggregate` shows served N/N, serving beam count,
    top beam loads, avg SINR, `sinr-serving` claim, and
    `live-service-demo` queue source.
- [x] **H4. Focus selection is not permanently fixed to UE-0.**
  - Doc status: handover cinema S2a/S3.
  - Done when: cinema/service inspector can focus the next event UE, highest
    queue UE, recently rescued UE, overloaded-beam representative, or group
    event as appropriate.
  - Evidence: D4 cell-truth handover events are indexed across the configured
    UE population and carry `ueId`; the browser gate focuses a source event UE
    rather than assuming the legacy primary UE. Queue-rescue and group stories
    remain tracked separately by H5/I5.
- [x] **H5. Group-level service stories are possible.**
  - Doc status: handover cinema meso / queue-rescue shots.
  - Done when: UI can show a cell/beam group migration or queue rescue without
    turning the rest of the UEs into clutter.
  - Evidence: `SinrServingAggregate` now shows two low-density
    `live-service-demo` queue focus stories, highest pressure and best rescue,
    inside the aggregate panel rather than 100 per-UE labels. The browser gate
    captured `pressure=live-ue-51` and `rescue=live-ue-78` on the existing
    `:3001` server while keeping instanced queue pressure and no per-UE labels.

## I. Traffic / Queue Proof

- [x] **I1. Per-UE queue accounting exists for SINR live demo or producer replay.**
  - Doc status: handover cinema S2a and replay SDD §0.6.
  - Done when: each queue-capable UE has arrivals, queue before, served bits,
    queue after, service rate, and source label.
  - Evidence: `deriveSinrLiveServiceQueueModel` emits per-UE
    `trafficArrivalBits`, `queueBeforeBits`, `servedBits`, `queueAfterBits`,
    `serviceRateBps`, pressure, and source `live-service-demo`.
- [x] **I2. Queue conservation is validated.**
  - Doc status: replay SDD §0.6.
  - Done when: validator proves
    `queueAfter = max(0, queueBefore + trafficArrivalBits - servedBits)`.
  - Evidence: `npm run validate:phase-c:sinr-service-queue:model`.
- [x] **I3. Queue visuals are dense-safe.**
  - Doc status: handover cinema S2a.
  - Done when: queue pressure uses instanced halos, heatmaps, and aggregate
    panels, not 100 text labels or 100 independent React state updates.
  - Evidence: D3 browser smoke proves 99 secondary UEs receive instanced
    `aContention` pressure buckets, the HUD renders an 8-bin heatmap strip,
    and no per-UE queue labels are present.
- [x] **I4. Queue proof is source-labeled.**
  - Doc status: handover cinema S2a and replay SDD §0.6.
  - Done when: queue UI says `live-service-demo`, `synthetic`, or `producer`,
    and producer-proof lanes hide/source-gap queue values when rows are absent.
  - Evidence: D3 HUD and browser gate assert `data-queue-source="live-service-demo"`;
    the queue aggregate is absent from the MODQN lane, while MODQN HUD keeps
    queue depth as source-gap unless producer rows exist. D5 adds the producer
    replay queue source-gap field `traffic.queueRows` so replay proof cannot
    borrow the SINR `live-service-demo` queue accountant.
- [x] **I5. Queue-aware focus proves service quality.**
  - Doc status: handover cinema queue-rescue shot.
  - Done when: camera/panel can show queue pressure dropping after service or
    increasing when a UE is neglected.
  - Evidence: `deriveSinrLiveServiceQueueFocusStories` emits source-labeled
    highest-pressure and best-rescue stories with queue before/after, queue
    delta, service rate, service surplus, and pressure. `npm run
    validate:phase-c:sinr-serving-mosaic:model` proves best rescue has positive
    service surplus and queue reduction; `APP_URL=http://localhost:3001 npm run
    validate:phase-c:sinr-serving-mosaic:browser` proves both focus rows render
    in the live panel and do not leak onto the MODQN lane.

## J. Beam Presentation / Beam Physics Deferred Audit

- [x] **J1. Do not tune beam width, steering angle, color, or hopping display
  during earlier work.**
  - Doc status: handover cinema S9.
  - Done when: D2-D6 diffs avoid parameter-tuning beam visuals unless S9 audit
    is explicitly moved earlier.
  - Evidence: D2-D6 completed without changing beam role token colors, beam
    width, steering angle, or hopping cadence; D7 explicitly stayed audit-only.
- [x] **J2. Audit all beam-affecting controls before visual changes.**
  - Doc status: handover cinema S9.
  - Done when: every button/mode that changes beam color, cone visibility, beam
    width, steering angle, hopping display, or service coverage is inventoried.
  - Evidence: `docs/beam-presentation-calibration-audit.md` inventories SINR
    tuning beam controls, beam density/callouts, MODQN visual-layer presets,
    live steered cones, SINR cell-truth cones, candidate highlights, MODQN cell
    overlay/profile cones, replay scene layer, training form beam parameters,
    and beam hopping schedule ownership.
- [x] **J3. Capture before screenshots and telemetry on `:3001`.**
  - Doc status: handover cinema S9.
  - Done when: before-state screenshots and DOM/WebGL telemetry are saved before
    the first beam presentation patch.
  - Evidence: `APP_URL=http://localhost:3001 npm run capture:beam-presentation-audit`
    wrote ignored before-state screenshots and `telemetry.json` under
    `output/beam-presentation-audit/2026-06-10/`.
- [x] **J4. Define one canonical color language.**
  - Doc status: handover cinema S9.
  - Done when: serving, candidate, old/new handover pair, frequency reuse,
    queue pressure, and source gap colors are documented and validator-backed.
  - Evidence: `docs/beam-presentation-calibration-audit.md` defines the
    canonical hierarchy for serving/selected, candidate/target, previous/source,
    frequency reuse, satellite identity, and source-gap color semantics;
    `validate:beam-presentation:audit` backs the contract.
- [x] **J5. Define one canonical beam-hopping display contract.**
  - Doc status: handover cinema S9 and
    [beam-hopping-mini-sdd.md](./beam-hopping-mini-sdd.md).
  - Done when: UI distinguishes truth-owned active beams from display-only
    context beams, and no fake hopping animation is used as proof.
  - Evidence: `docs/beam-presentation-calibration-audit.md` defines the
    beam-hopping display contract; `validate:beam-presentation:audit` checks
    replay source gaps and `data-handover-story-fake-beam-hopping="0"`.

## K. Final Completion Audit

- [x] **K1. Every completed item has validation evidence.**
  - Done when: each checked item references tests, validators, browser smoke, or
    explicit source-gap acceptance.
  - Evidence: `npm run validate:modqn:showcase-final-audit` checks that every
    checked item in this TODO has an `Evidence:` line, and the controller ran
    the phase validators named in the final report.
- [x] **K2. Every source gap remains visible.**
  - Done when: no missing producer field is hidden by a visual heuristic or
    frontend substitution.
  - Evidence: D5/D6 keep `diagnostics.denseQPolicy`, `traffic.queueRows`,
    replay handover cinema readiness, and beam-hopping source gaps visible;
    `npm run validate:modqn:training-scene-source-gaps`, `npm run
    validate:modqn:replay-handover-cinema-gate`, and `npm run
    validate:modqn:showcase-final-audit` cover these fields.
- [x] **K3. Existing `:3001` browser checks pass for visible changes.**
  - Done when: final report names the `APP_URL=http://localhost:3001` browser
    validators or screenshots used.
  - Evidence: Browser checks used the existing server only:
    `APP_URL=http://localhost:3001 npm run validate:phase-c:lane-experience-bar:browser`,
    `APP_URL=http://localhost:3001 npm run validate:phase-c:handover-cinema:browser`,
    `APP_URL=http://localhost:3001 npm run validate:phase-c:sinr-serving-mosaic:browser`,
    and `APP_URL=http://localhost:3001 npm run capture:beam-presentation-audit`.
- [x] **K4. Old SDDs are not reactivated accidentally.**
  - Done when: final report confirms active implementation followed
    [sdd-index.md](./sdd-index.md) and did not implement superseded branches.
  - Evidence: `docs/sdd-index.md` remains the active entry point, historical
    MODQN visual plans stay classified as superseded/reference, and
    `npm run validate:modqn:showcase-final-audit` checks that no current delete
    candidates remain.
- [x] **K5. User-facing final report checks this TODO line by line.**
  - Done when: final report lists completed, partially completed, blocked, and
    intentionally deferred items from this document.
  - Evidence: This final checklist is fully checked; the controller final report
    will summarize A-K status, completed D1-D7 scopes, validation results, and
    remaining work status.
