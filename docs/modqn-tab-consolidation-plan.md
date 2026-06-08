# MODQN Tab Consolidation Plan (4 lanes → 2 nav tabs)

**Status:** Active blueprint. Supersedes `ADR-002-nav-surface-vs-lane-authority.md`
**D1** (4→3) with a **4→2** decision. SceneLane enum stays 4 (Rule#4 unbroken).
**Date:** 2026-06-08. **Branch:** `feat/showcase-phase-0`.
**Authority:** this doc + [decisions/ADR-002-nav-surface-vs-lane-authority.md](./decisions/ADR-002-nav-surface-vs-lane-authority.md)
+ [frontend-render-governance.md](./frontend-render-governance.md)
+ [handover-cinema-sdd.md](./handover-cinema-sdd.md) §5/§7-S7.

## 1. Decision

The top **`LaneExperienceBar`** collapses from **4 segments → 2: `SINR` / `MODQN`**.

- Underlying `appMode` has only 2 values (`sinr-experiment` / `modqn-demo`). The 4
  tabs were `2 appMode × (sceneSource + replayProof)`. The 3 non-SINR tabs
  (`MODQN Live` / `MODQN Proof` / `Artifact Showcase`) are all "MODQN, seen
  differently" and fold into ONE `MODQN` tab.
- **Governance-legal:** Rule#4 binds the `SceneLane` enum (4 lanes), NOT the nav
  buttons (ADR-002 keystone: nav ≠ lane, non-injective map). All 4 SceneLanes stay;
  `modqn-replay-proof` + `artifact-replay` become **in-MODQN toggles**, not top tabs.
- **SINR is untouched** — its lane / sidebars (`signal`+`handover`) / controls /
  render are unchanged. The SINR render reset (steered baseline + non-serving
  beam-hopping, see `project_sinr_render_reset_2026-06-08`) is independent of this.
- The 2-button nav component **already exists**: `src/ui/AppModeRail.tsx` (orphaned
  SINR/MODQN rail, never mounted since `LaneExperienceBar` superseded it) → revive/reuse.

### Why 2 and not ADR-002's 3
ADR-002 D1 kept `Artifact Showcase` as a 3rd story. But artifact-replay is just
"MODQN replayed from a frozen producer file", and `modqn-replay-proof` + `artifact-replay`
**ride the same degenerate baseline run** (see the defects report). Folding both under
MODQN matches the mental model and the data reality. When the producer ships a
non-degenerate run, light up the MODQN internals — the top bar stays 2 buttons, zero rework.

## 2. Keep / Park / Delete classification

Three buckets, NOT keep/delete binary. Most MODQN machinery is **PARK** (logic correct,
data degenerate, revives when the producer fixes the artifact — see the defects report).
Only confirmed dead/empty/orphan code is DELETE.

### 🟢 KEEP-ACTIVE (works today, meaningful)
| Component | Why | Home in new MODQN tab |
|---|---|---|
| `TrainingForm` | really launches training (postTrain live) | Advanced/Setup |
| `JobsPanel` | really polls backend, loads results | Advanced/Setup |
| `ArtifactPicker` | gateway to load user-trained bundles | Advanced/Setup |
| `TrainingTelemetryFeed` + `LiveTelemetryPanel` + `liveTelemetryStore` + `selectActiveTelemetryJob` + `MiniRewardCurve` | real live SSE training telemetry (no producer dep) | Advanced/Setup |
| `ArtifactSatelliteCompass` | generic, non-MODQN, real sat azimuths | MODQN replay view |
| `ClaimBoundaryBanner` / `ArtifactSourceBadge` / `HandoverEventRail` | governance honesty + generic rail (SINR uses too) | shared, keep |
| `HeuristicNotPaperBanner` | mandatory disclosure when omega-heuristic active | unchanged |

### 🟡 PARK (sound but degenerate → dormant + honesty banner; revives on producer fix; DO NOT delete)
| Component | State | Home |
|---|---|---|
| `ModqnSceneHud` | degenerate (1 sat / 100 UE on 1 beam) | MODQN default view |
| `CellOverlay` / `CellBeamCones` / `CellHandoverArcs` / `BeamLoadCylinder` / `BeamLoadUploadParticles` | degenerate (1 cell lit, arcs static) | MODQN default view |
| `ModqnReplaySceneLayer` (2D board) | degenerate (7 beams identical SINR) | "Evidence/Replay" toggle |
| `ModqnObjectiveTab` (ω sliders) | works but inert (982× reward dominance) | Advanced (paper-core; banner notes inert on current data) |
| `RewardCurvePanel` / `DecisionVizPanel` | degenerate (flat reward, always action-1) | MODQN evidence sidebar |
| `ModqnEvidenceTab` | hybrid: metadata/source-gap meaningful, trace degenerate | MODQN evidence sidebar |
| `AlgorithmDashboard` (metrics tiles) | degenerate (9000 frames flat) | MODQN evidence sidebar |
| `AlgorithmFlowchart` + `AlgorithmDock` + `flowchartModel` + `flowchartAnimation` | **intentionally retained unmounted** (C4+C5: future data-flow-diagram project) — NOT dead code, do NOT delete | parked |
| `ModqnReplayCuePanel` | trace degenerate, **but holds the Proof toggle** | trace parked; toggle promoted to "Evidence/Replay" entry |

### 🔴 DELETE (verified dead/empty/orphan; deleting touches neither SINR runtime nor the 4-lane enum)
| Component | Verification |
|---|---|
| `ViewModeToggle` (`src/ui/ViewModeToggle.tsx`) | grep: **not mounted** (Dashboard view removed C5); orphan with stale tab labels. Governance validator already asserts `<ViewModeToggle` count == 0 → stays green |
| `Tier2PreviewSection` (`src/ui/modqn-training/Tier2PreviewSection.tsx`) | intentional empty stub ("requires retrain, not wired", noop). nav-exposure §6 flagged it as a consolidation keep/delete decision → delete chosen |
| `HyperparamChip` (`src/ui/modqn-controls/HyperparamChip.tsx`) | only consumer is Tier2PreviewSection → orphan after Tier2 removal |
| `NetworkParamInput` (`src/ui/modqn-controls/NetworkParamInput.tsx`) | only consumer is Tier2PreviewSection → orphan after Tier2 removal |

**DEFERRED from DELETE (entangled — handle later, not in S1):**
- `LiveKpiStrip` — orphan (superseded by `SinrServingAggregate`, grep: no mount) BUT
  `validate-modqn-visual-showcase-p1e-snr-surface-audit.ts` reads the file as an
  SNR-display surface → deleting breaks SNR-surface governance. SNR-adjacent → defer.

**DO-NOT-TOUCH traps:**
- `tier2Clutter` (in `src/core/channel/*`, many `scripts/validate-modqn-phase6*`) is an
  UNRELATED TR38811 clutter-loss physics flag — NOT the Tier2 UI. Never touch it.

## 3. Target MODQN tab shape

```
[ SINR ]  [ MODQN ]                          ← AppModeRail revived; SINR untouched
              │
   ┌──────────┴───────────────────────────┐
   │ default: live cell preview (PARK viz) │
   │   + 🟡 "degenerate data — do not cite" banner
   │   + 🟢 ArtifactSatelliteCompass        │
   ├────────────────────────────────────────┤
   │ toggle: Evidence / Replay              │
   │   → modqn-replay-proof + artifact-replay (both lanes, one entry, PARK)
   │   right sidebar: 🟡 RewardCurve / DecisionViz / Evidence / Dashboard-metrics
   ├────────────────────────────────────────┤
   │ Advanced ⚙:                            │
   │   🟢 TrainingForm / JobsPanel / ArtifactPicker / LiveTelemetryPanel
   │   🟡 ω-objective editor / presets / decision-policy (+ HeuristicBanner)
   └────────────────────────────────────────┘
```

## 4. Slice plan

| Slice | Scope | Risk | Validator work |
|---|---|---|---|
| **S1** | DELETE 🔴: `ViewModeToggle` + `Tier2PreviewSection` (+`HyperparamChip`/`NetworkParamInput`); remove App.tsx import+mount; remove the Tier-2 governance block (`validate-frontend-scene-lane-governance.ts` §S5, ~2730-2758) | low | drop Tier-2 assertions; ViewModeToggle absence-assert stays |
| **S2** | nav 4→2: revive `AppModeRail` (or trim `LaneExperienceBar`); artifact-replay becomes an in-MODQN toggle (gate `sceneSource='artifact-replay'` to the MODQN tab); promote the existing Proof toggle | low–med | `LANE_EXPERIENCE_OPTIONS` count 4→2; nav≠lane non-injective assertion; lane-experience-bar + omega-s3 browser gates re-point |
| **S3** | MODQN sidebar purpose-merge (ADR-002 D3): `training`+`jobs`+`objective`→Setup; `replay`→Evidence/Replay; artifact metadata folded in. `SidebarTabShell` compound-tab UX + `appRuntimeModel.ts` rewrite | high | per-lane tab-set assertions rewritten |
| **S4** | MODQN-tab honesty banner ("degenerate — do not cite, awaiting producer fix") on the default + evidence views; Advanced ⚙ drawer for the power toggles | low | banner-presence assertion |
| later | revive PARK internals when the producer ships a non-degenerate run + dense per-objective-Q export (defects report). Top bar stays 2 buttons. | — | — |

Each slice: edit → run `validate:frontend:scene-lane-governance` + typecheck → cavecrew-reviewer
→ (for nav/sidebar) browser-verify real :3001 → commit (push deferred). **Screenshot :3001
before/after any visible change** (S2/S4) per the reset lesson.

## 5. Governance invariants (every slice)
- `SceneLane` enum stays 4; `resolveSceneLaneRenderPlan` keeps 4 cases; Rule#4/#8 verbatim.
- SINR lane (render / sidebars / controls) untouched.
- PARK components stay mounted-but-dormant under honest labels; never deleted while
  the producer fix is the stated path.
- Heuristic disclosure mandatory; only the toggle relocates.
