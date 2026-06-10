# MODQN UI Surface Simplification SDD

**Status:** S5a complete; S5b/S5c deferred.
**Date:** 2026-06-09.
**Authority:** extends [modqn-tab-consolidation-plan.md](./modqn-tab-consolidation-plan.md),
[frontend-render-governance.md](./frontend-render-governance.md), and
[handover-cinema-sdd.md](./handover-cinema-sdd.md). It does not replace their
truth-boundary rules.

## 1. Problem

The MODQN experience is functionally reachable but still feels crowded. The
current surface mixes four distinct jobs in one visual band:

1. choose the MODQN view (`Live`, `Proof`, `Artifact`);
2. change live-preview visual depth (`Baseline`, `Service`, `Explain`, `Debug`);
3. switch the live decision policy (`Paper overlay`, `Heuristic omega`);
4. inspect or operate setup/evidence tools (`TrainingForm`, `JobsPanel`,
   `ArtifactPicker`, `ModqnObjectiveTab`, reward/decision panels).

The confusion is not a lack of source documentation. It is a surface ownership
problem after several exposure and consolidation passes: some controls are
active, some are parked behind a degenerate producer artifact, and some are
truth/provenance guardrails. Continuing to add visible controls to `App.tsx` or
the top `ControlBar` would make the frontend harder to change.

## 2. Goals

- Keep the default MODQN page as one readable story: live cell-preview plus the
  mandatory degenerate-data disclosure.
- Move non-default MODQN display and policy controls out of the top `ControlBar`
  and into the existing `Advanced setup` drawer.
- Preserve all truth boundaries: no changes to `SceneLane`, producer artifacts,
  replay values, rewards, actions, handover events, SINR/SNR, or provenance.
- Avoid another shallow layer in `App.tsx`: new UI groups must live in focused
  presentational components, with `App.tsx` only passing existing state and
  callbacks.
- Keep SINR lane controls untouched.

## 3. Non-Goals

- No deletion of KEEP-ACTIVE producer/training controls.
- No revival of PARK internals until the producer ships a non-degenerate run and
  dense per-objective Q export.
- No dashboard/flowchart revival.
- No renderer, scene, replay-contract, or training-service behavior change.
- No broad frontend refactor before the cleanup proves the smaller seam.

## 4. Target Shape

```
[ SINR ] [ MODQN ]
            |
            +-- MODQN view: Live / Proof / Artifact
            |
            +-- default canvas: live cell-preview or selected proof/artifact view
            |
            +-- left rail: Evidence / Replay only
            |
            +-- Advanced setup:
                - Display depth: Baseline / Service / Explain / Debug
                - Decision policy on live cell preview only:
                  Paper overlay / Heuristic omega
                - TrainingForm / JobsPanel / ModqnObjectiveTab
```

The `HeuristicNotPaperBanner` stays outside the drawer and remains mandatory
whenever `omega-heuristic` is active on `modqn-live-cell-preview`.

## 5. Frontend Architecture Rule

`App.tsx` may remain the orchestrator for existing top-level state, but cleanup
slices must not add large conditional UI blocks there. Each new control group
must satisfy one of these patterns:

- a focused presentational component under `src/ui/`;
- a pure resolver/model under `src/app/` when branching rules become non-trivial;
- a validator update that locks the ownership boundary.

This SDD intentionally starts with a small presentational extraction instead of
moving all MODQN orchestration out of `App.tsx`. A larger App split is deferred
until a later slice proves a stable seam.

## 6. Slice Plan

| Slice | Scope | Validation |
|---|---|---|
| **S5a** | COMPLETE 2026-06-09. Moved MODQN visual-layer preset and live-cell decision-policy controls from `ControlBar` into `AdvancedSetupDrawer` via a focused presentational component. Replay-proof and artifact lanes keep display controls but do not expose the live decision-policy toggle. | `npm run lint`, `validate:frontend:scene-lane-governance`, `validate:phase-c:lane-experience-bar:browser` on `APP_URL=http://localhost:3001`; focused browser check that the controls work from the drawer and that artifact Advanced omits the live decision-policy toggle. |
| **S5b** | Revisit right-sidebar MODQN evidence density: keep default right rail on live status; move reward/decision diagnostics behind one evidence affordance if still crowded. | Governance validator plus before/after screenshot on 3001. |
| **S5c** | If `App.tsx` remains the bottleneck after S5a/S5b, extract a `ModqnSurfaceShell` or pure `modqnSurfaceModel` seam. | Characterization tests for lane/sidebar/control ownership before moving JSX. |

## 7. Invariants

- `SceneLane` stays four-valued.
- `ModqnViewToggle` remains the only in-MODQN sub-lane selector.
- `ControlBar` remains lane-owned and must not regain MODQN setup/debug
  controls after S5a.
- Advanced controls may change display depth on MODQN sub-lanes; live decision
  policy controls are exposed only on `modqn-live-cell-preview` and must not
  claim producer proof.
- Heuristic mode is never exposed without `HeuristicNotPaperBanner`, and it
  must not remain active when entering replay-proof or artifact lanes.
- Browser checks must reuse the existing port `3001`.
