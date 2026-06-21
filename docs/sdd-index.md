# SDD Index And Development Order

**Status:** active index, 2026-06-09.
**Purpose:** make the current MODQN / handover / 100-UE showcase work
developable without reopening every historical SDD as a parallel workstream.

This file is an index and routing document. It does not delete historical
evidence. A document listed as `Reference` or `Superseded` may still be read by
validators or preserve a boundary decision.

## Current Active Development Entry Points

| Order | Document | Role | Next use |
|---|---|---|---|
| - | [modqn-showcase-requirements-todo.md](./modqn-showcase-requirements-todo.md) | End-to-end user requirement checklist | Use at the start and end of each controller run to audit completion |
| 0 | [frontend-render-governance.md](./frontend-render-governance.md) + [frontend-mode-lane-separation-sdd.md](./frontend-mode-lane-separation-sdd.md) | Non-negotiable lane/render guardrails | Read before any `scene/`, `viz/`, `ui/`, or render-plan change |
| 1 | [modqn-tab-consolidation-plan.md](./modqn-tab-consolidation-plan.md) + [modqn-ui-surface-simplification-sdd.md](./modqn-ui-surface-simplification-sdd.md) | Reduce MODQN tab/button/sidebar clutter | D1 / S5a complete; keep as the guardrail before adding visible controls |
| 2 | [modqn-training-scene-replay-sdd.md](./modqn-training-scene-replay-sdd.md) | MODQN producer trace, dense Q, model library, job lifecycle, queue proof contract | Source of truth for replay/proof data requirements |
| 3 | [handover-cinema-sdd.md](./handover-cinema-sdd.md) | Handover cinema, 100-UE service proof, queue visuals, deferred beam audit | Main visual/interaction roadmap |
| 4 | [modqn-training-trigger-backend-sdd.md](./modqn-training-trigger-backend-sdd.md) | Training service API and lifecycle contract | Use when changing training submit/job/model-library flows |

Only these documents should define the next implementation sequence. Other
SDDs below provide background or guardrails unless this index is updated.

## Development Sequence

### D0: Finish SDD Consolidation

- Keep this index current.
- Do not delete historical SDDs until they are listed as delete candidates,
  verified by `rg`, and validators pass after removal.
- Required checks after index-only edits:
  - `npm run validate:frontend:scene-lane-governance`
  - `npm run validate:modqn:training-scene-trace-contract`
  - `npm run validate:modqn:training-scene-trace-inventory`

### D1: MODQN UI Surface Cleanup

**Status:** complete for S5a on 2026-06-09. Keep this section as a regression
guard before adding D2-D7 proof controls.

Goal: stop the frontend from accumulating more visible buttons, modes, and
sidebars before adding proof features.

Source docs:

- [modqn-tab-consolidation-plan.md](./modqn-tab-consolidation-plan.md) S5a / S7
- [modqn-ui-surface-simplification-sdd.md](./modqn-ui-surface-simplification-sdd.md)
- [handover-cinema-sdd.md](./handover-cinema-sdd.md) §5 / §7

Expected outcome:

- MODQN top navigation remains collapsed under the single MODQN tab.
- Advanced / setup controls hold training, job, artifact, and visual-layer
  preset controls. Live decision-policy controls live there only on
  `modqn-live-cell-preview`; replay-proof and artifact lanes do not expose a
  live handover-policy selector.
- Primary viewport keeps only the current story surface and required honesty
  banners.

Validation:

- `npm run validate:frontend:scene-lane-governance`
- `npm run validate:phase-c:lane-experience-bar:browser` or the current lane
  browser gate named in `package.json`
- Screenshot check against the existing `:3001` server before/after visible
  changes.

Completed S5a checks:

- `npm run lint`
- `npm run validate:frontend:scene-lane-governance`
- `APP_URL=http://localhost:3001 npm run validate:phase-c:lane-experience-bar:browser`

### D2: Model Library And Job Lifecycle Cleanup

**Status:** complete on 2026-06-09. Keep this section as the regression guard
for user-trained model selection and producer lifecycle controls before adding
queue/dense-Q proof surfaces.

Goal: make frontend training/model selection real without overwriting old
artifacts.

Source docs:

- [modqn-training-scene-replay-sdd.md](./modqn-training-scene-replay-sdd.md)
  Slice S1a
- [modqn-training-trigger-backend-sdd.md](./modqn-training-trigger-backend-sdd.md)

Expected outcome:

- Completed loadable artifacts appear as a model library.
- Failed/cancelled/running jobs stay in job history.
- Parameters and claim boundary are visible before loading.
- Cancel/delete follow producer lifecycle semantics; pause/resume stay absent
  unless the producer implements them.

Validation:

- `npm run validate:modqn:training-scene-trace-inventory`
- `npm run validate:modqn:job-lifecycle-contract`
- `npm run validate:phase-b:artifact-picker`
- `npm run validate:phase-b:jobs-panel`
- Existing browser smoke on `:3001` only; do not start another dev server.

Completed D2 checks:

- `npm run lint`
- `npm run validate:modqn:training-scene-trace-inventory`
- `npm run validate:modqn:job-lifecycle-contract`
- `npm run validate:phase-b:artifact-picker`
- `npm run validate:phase-b:jobs-panel`
- `npm run validate:phase-b:service-client`
- `npm run validate:phase-d:live-telemetry-store`
- `npm run validate:frontend:scene-lane-governance`
- `APP_URL=http://localhost:3001 npm run validate:phase-c:lane-experience-bar:browser`

### D3: SINR-Live 100-UE Service Proof

> **⚠️ QUEUE LAYER RETIRED 2026-06-21 (`3ee4368`).** The S2a `live-service-demo`
> queue proof (per-UE backlog from an FNV hash of the UE id — synthetic, NOT
> producer truth) was removed: overlay queue panel `562e398`, then the in-scene
> queue glow + the `deriveSinrLiveServiceQueue*` model + the
> `validate:phase-c:sinr-service-queue:*` aliases `3ee4368`. The S2 serving
> MOSAIC + aggregate (served N/N, per-beam load, mean SINR) STAY. The queue
> bullets below are the as-built record at completion.

**Status:** complete on 2026-06-10 for S2/S2a live-service-demo proof,
including H5/I5 queue focus stories (the queue half RETIRED `3ee4368` — see
above). This slice does not claim producer queue proof.

Goal: prove the other 99 UEs are not decoration before tying the story to MODQN
replay.

Source docs:

- [handover-cinema-sdd.md](./handover-cinema-sdd.md) S2 / S2a
- [sinr-live-earth-fixed-cells-mini-sdd.md](./sinr-live-earth-fixed-cells-mini-sdd.md)
- [phase-f-live-multi-ue-generator-mini-sdd.md](./phase-f-live-multi-ue-generator-mini-sdd.md)

Expected outcome:

- Service mosaic and aggregate readouts remain visible by default.
- Queue halo / heatmap / sidebar metrics show backlog pressure without 100 text
  labels.
- Queue focus stories identify highest pressure and best rescue in the aggregate
  panel without introducing 100 per-UE labels.
- Queue source is labeled `live-service-demo` unless backed by a validated
  traffic generator.

Validation:

- Queue conservation model test:
  `queueAfter = max(0, queueBefore + arrivals - servedBits)`.
- Browser smoke proves queue visuals use instanced/buffer data rather than 100
  React state updates.
- `npm run validate:frontend:scene-lane-governance`

Completed D3 checks:

- `npm run lint`
- `npm run validate:phase-c:sinr-serving-mosaic:model`
- `npm run validate:frontend:scene-lane-governance`
- `APP_URL=http://localhost:3001 npm run validate:phase-c:sinr-serving-mosaic:browser`

### D4: SINR-Live Handover Cinema Sync

**Status:** complete on 2026-06-09 for SINR `sinrLiveCells` cell-truth
focus sync. Keep MODQN replay cinema blocked behind D5/D6 producer proof.

Goal: make next-HO focus, slow motion, auto camera, and old/new off-axis beams
synchronized to one source.

Source docs:

- [handover-cinema-sdd.md](./handover-cinema-sdd.md) S3 / S3a
- [sinr-live-earth-fixed-cells-mini-sdd.md](./sinr-live-earth-fixed-cells-mini-sdd.md)
- [live-walker-handover-event-map-sdd.md](./live-walker-handover-event-map-sdd.md)

Expected outcome:

- `Next HO`, `Next Intra`, and `Next Inter` resolve source-time events.
- Candidate highlight, SINR explainer, old/new beam pair, and camera focus all
  read the same cell-truth trajectory.
- Intra-HO uses off-axis old/new beams; inter-HO disables or source-gaps if
  the current source has no inter event.

Validation:

- `npm run validate:phase-c:handover-cinema:model`
- `npm run validate:frontend:scene-lane-governance`
- Browser smoke on existing `:3001`; no new dev server.

Completed D4 checks:

- `npm run lint`
- `npm run validate:phase-c:handover-cinema:model`
- `npm run validate:live-walker:handover-event-index-7200`
- `npm run validate:live-walker:handover-event-focus`
- `npm run validate:phase-c:sinr-live-cells:model`
- `npm run validate:phase-c:sinr-live-cells:runtime`
- `npm run validate:phase-c:sinr-live-cells:render`
- `npm run validate:frontend:scene-lane-governance`
- `APP_URL=http://localhost:3001 npm run validate:phase-c:handover-cinema:browser`

### D5: MODQN Dense-Q / Replay Proof Adapter

**Status:** complete on 2026-06-09 for the consumer dense-Q proof adapter,
original-weight self-check, source-gap gating, and producer queue-row gap. D6
scene-synchronized replay cinema remains blocked until producer samples export
the required fields.

Goal: prove trained MODQN decisions only when producer data is complete.

Source docs:

- [modqn-training-scene-replay-sdd.md](./modqn-training-scene-replay-sdd.md)
  S2 / S2a / S2b / S3 / S3a
- [handover-cinema-sdd.md](./handover-cinema-sdd.md) MODQN proof clauses

Expected outcome:

- Dense Q adapter consumes full per-action Q1/Q2/Q3, validity mask, original
  weights, selected action, and tie-break order.
- Original-weight self-check reproduces the producer selected action before
  any counterfactual weight slider is enabled.
- Queue proof only appears when producer per-UE queue rows exist.
- Missing old/new geometry, event kind, dense Q, or queue truth becomes source
  gap, not frontend inference.

Validation:

- `npm run validate:modqn:training-scene-trace-contract`
- `npm run validate:modqn:training-scene-trace-inventory`
- New dense-Q and queue-proof validators before UI proof claims are enabled.

Completed D5 checks:

- `npm run lint`
- `npm run validate:modqn:dense-q-proof-adapter`
- `npm run validate:phase-d:decision-viz`
- `npm run validate:modqn:training-scene-source-gaps`
- `npm run validate:modqn:training-scene-trace-contract`
- `npm run validate:modqn:training-scene-trace-inventory`
- `npm run validate:modqn:training-scene-producer-handoff`
- `npm run validate:modqn:omega-s4-heuristic-not-paper`
- `node --import tsx/esm scripts/validate-modqn-omega-s3-replay-mode-wiring.tsx`
- `npm run validate:frontend:scene-lane-governance`

### D6: MODQN Replay Handover Cinema

**Status:** complete on 2026-06-09 for the consumer readiness/source-gap gate.
The actual replay handover cinema remains blocked for current artifacts until
the producer exports event IDs, renderable geometry, reward, masks, and full
dense-Q proof fields in one sample.

Goal: reuse the handover cinema shell for producer-backed MODQN replay only
after D5 has a complete source.

Source docs:

- [handover-cinema-sdd.md](./handover-cinema-sdd.md)
- [modqn-training-scene-replay-sdd.md](./modqn-training-scene-replay-sdd.md)

Expected outcome:

- Camera, timeline, side panel, Q-value overlay, selected action, reward, and
  handover event all refer to one producer event/sample.
- Weight changes are counterfactual re-ranks only and do not alter replayed
  decisions.

Validation:

- Producer trace validator plus browser smoke.
- Governance must prove no live SINR/Walker state fills replay-proof holes.

Completed D6 gate checks:

- `npm run lint`
- `npm run validate:modqn:replay-handover-cinema-gate`
- `npm run validate:modqn:dense-q-proof-adapter`
- `npm run validate:phase-d:decision-viz`
- `npm run validate:modqn:training-scene-source-gaps`
- `npm run validate:modqn:phase7k-replay-scene-layer`
- `npm run validate:frontend:scene-lane-governance`

### D7: Deferred Beam Presentation / Beam-Physics Calibration Audit

**Status:** complete on 2026-06-10 for the audit/report gate. No beam color,
beam hopping display, beam width, steering angle, or cadence was changed.

Goal: fix beam colors, beam-hopping display, beam width, and steering angle
without repeating the prior visual regressions.

Source docs:

- [handover-cinema-sdd.md](./handover-cinema-sdd.md) S9
- [beam-presentation-calibration-audit.md](./beam-presentation-calibration-audit.md)
- [beam-hopping-mini-sdd.md](./beam-hopping-mini-sdd.md)
- [modqn-realistic-beam-geometry-cross-repo-sdd.md](./modqn-realistic-beam-geometry-cross-repo-sdd.md)
- [sinr-live-earth-fixed-cells-mini-sdd.md](./sinr-live-earth-fixed-cells-mini-sdd.md)

Expected outcome:

- Audit every button/mode that changes beam colors, cone visibility, beam
  width, steering angle, or hopping display.
- Capture before screenshots and telemetry on existing `:3001`.
- Propose one canonical color language and one canonical hopping display
  contract before changing visuals.

Stop rule: do not widen beams, increase steering angle, or change hopping
cadence just to make handover, queue draining, or coverage look better.

Completed D7 audit checks:

- `npm run lint`
- `npm run validate:beam-presentation:audit`
- `APP_URL=http://localhost:3001 npm run capture:beam-presentation-audit`
- `npm run validate:frontend:scene-lane-governance`
- `npm run validate:phase-h:s4-beam-hopping-toggle`
- `npm run validate:phase-h:s7-beam-material`
- `npm run validate:phase-i:s3-beam-geometry`
- `npm run validate:phase-i:s5b-cell-beam-cones`
- `git diff --check`

## Reference Documents

These files are still useful but are not active development entry points.

| Document | Current status |
|---|---|
| [sinr-live-earth-fixed-cells-mini-sdd.md](./sinr-live-earth-fixed-cells-mini-sdd.md) | Reference for SINR cell-truth/off-axis work; active logic is routed through handover cinema S3a |
| [beam-hopping-mini-sdd.md](./beam-hopping-mini-sdd.md) | Reference for beam-hopping truth; implementation deferred to D7/S9 audit |
| [beam-presentation-calibration-audit.md](./beam-presentation-calibration-audit.md) | D7 audit artifact and guardrail before future beam visual changes |
| [modqn-handover-story-layer-sdd.md](./modqn-handover-story-layer-sdd.md) | Reference for lane-owned story-layer truth; do not start a separate story-layer implementation |
| [modqn-realistic-beam-geometry-cross-repo-sdd.md](./modqn-realistic-beam-geometry-cross-repo-sdd.md) | Cross-repo geometry background and producer-track context; high-risk for frontend direct adoption |
| [phase-f-live-multi-ue-generator-mini-sdd.md](./phase-f-live-multi-ue-generator-mini-sdd.md) | Reference for live multi-UE runtime; queue proof is routed through handover cinema S2a |
| [phase-g-ue-mobility-mini-sdd.md](./phase-g-ue-mobility-mini-sdd.md) | Future mobility background; not required before D3/D4 unless source motion blocks the focus story |
| [showcase-master-sdd-v2.md](./showcase-master-sdd-v2.md) | High-level reconciled vision; current implementation order is this index |
| [showcase-phase0-plane-scoping.md](./showcase-phase0-plane-scoping.md) | Evidence appendix for source planes and gaps |
| [phase-d-training-visualization-mini-sdd.md](./phase-d-training-visualization-mini-sdd.md) | Reference for user-trained artifact loading; active model-library work is in replay SDD S1a |
| [phase-b-training-pipeline-mini-sdd.md](./phase-b-training-pipeline-mini-sdd.md) | Historical frontend training UI plan; active backend lifecycle is in training-trigger SDD |
| [modqn-omega-handover-sdd.md](./modqn-omega-handover-sdd.md) | Historical omega/control design; dense-Q counterfactual proof is now in replay SDD |

## Superseded Or Historical Documents

Do not use these as implementation entry points unless this index is updated.

| Document | Superseded by / reason |
|---|---|
| [showcase-master-sdd.md](./showcase-master-sdd.md) | Superseded by v2 and this index |
| [showcase-master-sdd-review.md](./showcase-master-sdd-review.md) | Review record only |
| [director-cinematic-replay-sdd.md](./director-cinematic-replay-sdd.md) | Merged into handover cinema director flow |
| [intra-handover-visibility-sdd.md](./intra-handover-visibility-sdd.md) | Historical visibility work; use handover cinema S3/S3a now |
| [intra-handover-visual-strengthening-sdd.md](./intra-handover-visual-strengthening-sdd.md) | Historical intra-HO cue work; do not add separate cue layers |
| [modqn-visual-handover-clarity-sdd.md](./modqn-visual-handover-clarity-sdd.md) | Historical MODQN replay visual clarity; use replay SDD + handover cinema |
| [modqn-demo-controls-extension-sdd.md](./modqn-demo-controls-extension-sdd.md) | Superseded by MODQN tab consolidation and UI surface simplification |
| [modqn-demo-readability-redesign-mini-sdd.md](./modqn-demo-readability-redesign-mini-sdd.md) | Historical readability work; current UI route is consolidation |
| [modqn-demo-simplify-mini-sdd.md](./modqn-demo-simplify-mini-sdd.md) | Historical simplification work; current UI route is consolidation |
| [modqn-demo-renderer-decoupling-sdd.md](./modqn-demo-renderer-decoupling-sdd.md) | Historical decoupling record; current guardrails are frontend governance |
| [modqn-visibility-fix-mini-sdd.md](./modqn-visibility-fix-mini-sdd.md) | Historical visibility fix; beam/geometry work is deferred to D7 |
| [modqn-visual-showcase-integration-sdd.md](./modqn-visual-showcase-integration-sdd.md) | Historical integration plan; replay SDD is the active contract |
| [modqn-baseline-live-integration-mini-sdd.md](./modqn-baseline-live-integration-mini-sdd.md) | Historical live integration framing; live MODQN control is not claimable now |
| [showcase-navigation-exposure-sdd.md](./showcase-navigation-exposure-sdd.md) | Historical orphan-feature exposure campaign; current MODQN surface route is consolidation + UI simplification |

## Delete Candidate Policy

Deletion is a separate cleanup step, not part of feature implementation.

A document can be deleted only when all are true:

1. It is listed as a delete candidate in this index.
2. `rg` finds no references from `src/`, `scripts/`, `docs/decisions/`,
   `AGENTS.md`, `CLAUDE.md`, `README.md`, or validator scripts.
3. It is not preserving a negative boundary or historical rejection that future
   agents need.
4. `npm run validate:frontend:scene-lane-governance` and relevant MODQN trace
   validators pass after deletion.

Current delete candidates: none.

Deleted in this pass:

| Document | Reason | Action |
|---|---|---|
| `sdd_review_report.md` | Empty placeholder at audit time; pre-delete reference scan found only this index entry | Deleted on 2026-06-10; final audit validator checks the placeholder stays absent |

No other SDD should be deleted in the current development pass.
