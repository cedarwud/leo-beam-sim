# Phase 0 — Telemetry Plane Scoping (Contract Reconciliation)

> **Status:** RESULT APPENDIX to `docs/showcase-master-sdd-v2.md` §3 + §6 Phase 0.
> **Date:** 2026-06-02.
> **Authority:** v2 SDD is the implementation authority; this doc fills the v2 §6
> Phase 0 deliverable: "the exact channel list the dashboard may show now vs must
> source-gap", reconciled against the shipped code and the producer.
> **Method:** `validate:modqn:training-scene-trace-inventory` (PASS, 40 fields) +
> direct read of every plane's source code, including a cross-repo read-only audit
> of the producer (`modqn-paper-reproduction`). Every claim below is anchored to
> `file:line`. Three discovery sub-agents returned stub output and were re-done by
> hand (verify-subagent-claims rule); the producer + cleanup findings were
> independently re-verified against source.

---

## 0. TL;DR (the one decision this unblocks)

- **Offline-first against Plane C (`visual-showcase-v1`) is the right Phase 1a
  spine.** Nearly every channel the user wants for the 2D algorithm dashboard +
  flowchart is **already producer-backed** in `visual-showcase-v1` today:
  reward scalar + components, objective weights, per-decision action scores /
  top-K, serving timeline, handover phase/events, SINR/throughput. No producer
  change needed to build the offline dashboard.
- **"Live training" (Plane A SSE) is, today, almost entirely a source gap for
  mid-run dynamics.** The live stream emits, during a run, only: `episode` /
  `episodeBudget` progress + a 10 s content-free heartbeat. The five reward
  scalars (`scalarReward`, `r1/r2/r3Mean`, `totalHandovers`) appear **once, at
  the terminal `final:` line** — not per episode. A live, evolving reward curve
  therefore needs a **small, gated producer change**, not new renderer code.
- **Loss / Pareto-front / Q-values / learning-rate / epsilon / replay-buffer are
  hard producer gaps on every plane** (not in SSE, not in `visual-showcase-v1`).
  They belong to the future Plane B trace (`modqn-training-scene-trace-v1`,
  `future-lane`) and are gated cross-repo work (v2 §10).

---

## 1. The Three Planes — cadence & emission reality

| Plane | Source | Cadence | What it actually carries **today** | Owner |
|---|---|---|---|---|
| **A — Live SSE** | `GET /jobs/{id}/stream` (`JobsPanel.tsx:265-289`) | event-driven, **episode-coarse**, terminal-heavy | `episode`/`episodeBudget` (live), lifecycle `queued/heartbeat/progress/done/failed/cancelled`, and the 5 reward scalars **only on the terminal `final:` event** | `modqn-paper-reproduction` service |
| **B — Trace v1** | `modqn-training-scene-trace-v1` (`contract.ts`, 40-field) | post-hoc producer artifact | **does not exist as an emitted artifact yet** — `sceneLane:'future-lane'`. Defines the producer target for per-step loss/Q/Pareto/schedules/comparison | `modqn-paper-reproduction` (gated) |
| **C — visual-showcase-v1** | validated display artifact (`loadShowcaseArtifact.ts`, `ShowcaseReplayController.ts`) | offline replay window (60–120 s) | **the richest available source**: 17/40 producer-backed (inventory). Full `series`, `diagnostics`, per-frame `modqnDecision`/`metrics`/`handoverState`, typed `events[]` | `modqn-paper-reproduction` → validated by `ntn-sim-core` |

INV-1/INV-2/INV-3 (v2 §3.5) bind across all three: a Plane-C value must never
back a "live training" tile, a Plane-A value must never persist into a replay
reward channel, and the renderer must never synthesize a gap.

### 1.1 Inventory validator counts (`validate:modqn:training-scene-trace-inventory`, PASS)

| Source | producer-backed | partial | display-derived | source-gap |
|---|---|---|---|---|
| `visual-showcase-v1` (Plane C) | **17** | 10 | 1 | 12 |
| `phase03a-replay-bundle` | 6 | 9 | 2 | 23 |
| `user-trained-manifest` | 2 | 11 | 1 | 26 |

Plane C is the only source that backs a full decision/reward story offline.

---

## 2. Plane A (Live SSE) — verified emission truth

The live stream is produced by tee-parsing the trainer subprocess stdout. The
**only** metric vocabulary the parser recognises is 5 keys
(`progress_events.py:147-159 metrics_from_mapping`):

```
scalar_reward -> scalarReward
r1_mean       -> r1Mean
r2_mean       -> r2Mean
r3_mean       -> r3Mean
total_handovers -> totalHandovers
```

`parse_progress_line` (`progress_events.py:87-134`) emits a `progress` event on
exactly **3** stdout shapes:
1. a **JSON** line carrying `episode`/`episode_count` (+ optional reward keys),
2. the literal `done: N episodes` (→ episode count, **empty metrics**),
3. the single terminal `final: scalar=…, r1=…, r2=…, r3=…, ho=…` line (→ 5 metrics).

**The trainer never prints shape (1).** Its per-episode output is a plain-text
line `[ep … ] eps=… scalar=… r1=… r2=… r3=… ho=… buf=…`
(`modqn.py:1334-1344`) and an eval line `[eval … ] best-mean-scalar=… std=…`
(`modqn.py:1326-1332`). Neither is JSON (`parse_json_line` requires `{…}`,
`progress_events.py:137-144`) nor matches `done:`/`final:`. They are dropped.
(The two `"episode"` keys at `train_main.py:218` / `modqn.py:1075` are
**checkpoint-resume metadata**, not stdout emission — verified.)

**Net live-plane reality during a run:** episode progress bar advances; one SSE
metrics line (`JobsPanel.tsx:451`, shows `scalar/r1/ho` only) appears **at the
end** when `final:` fires; heartbeats every 10 s carry zero metrics
(`HEARTBEAT_INTERVAL_S=10.0`, `worker.py:58`; `api.py:829`).

| Live channel | Status | Note |
|---|---|---|
| `episode` / `episodeBudget` | **producer-backed (live)** | the only genuinely-live numeric channel; drives the progress bar |
| lifecycle `type`/`status` | **producer-backed (live)** | enables INV-2 staleness (`nowMs=Date.now()`, `JobsPanel.tsx:293`) with no producer change |
| `scalarReward, r1/r2/r3Mean, totalHandovers` | **producer-backed but terminal-only** | present only on `final:`; **not a mid-run curve** |
| per-episode reward curve (live, evolving) | **source-gap** | needs producer stdout-format change (see G-A) |
| `epsilon`, `replayBufferSize` | **source-gap** | printed (`eps=`,`buf=`) but unparsed; cheap parser change |
| `loss`, `paretoFront`, `qValue`, `learningRate`, live `weights` | **source-gap (hard)** | never printed at all; Plane B work |

---

## 3. Core deliverable — Dashboard channel → plane scoping

For each channel the v2 dashboard + 2D flowchart wants, where the truth lives
**now**, and what (if anything) it needs. "Show now" = a panel can bind it this
phase with no producer change.

| # | Dashboard channel | Plane A (live) | Plane C (`visual-showcase-v1`) offline | Verdict |
|---|---|---|---|---|
| 1 | Reward scalar **curve** | terminal point only | `series.reward` (full curve) ✅ | **Show now (C).** Live curve = source-gap → G-A |
| 2 | Reward components r1/r2/r3 | terminal means only | `diagnostics.rewardComponents` + `timeline[].metrics.rewardVector` ✅ | **Show now (C).** Live = G-A |
| 3 | Objective weights ω | input-only, not streamed | `diagnostics.objectiveWeights` ✅ | **Show now (C).** Live ω = display-from-request (config), label as input |
| 4 | Selected action / label | gap | `timeline[].modqnDecision.actionIndex/actionLabel`, `diagnostics.selectedAction` ✅ | **Show now (C)** |
| 5 | Policy diagnostics (top-K / action scores) | gap | `diagnostics.actionScores`, `decisionFrames` ✅ (panel exists, §4) | **Show now (C)** |
| 6 | Serving sat/beam timeline | gap | `series.servingSatellite`, `timeline[].ues[].serving*` ✅ | **Show now (C)** |
| 7 | Handover events (intra/inter, phase) | only terminal count | `series.handoverPhase`, `timeline[].handoverState`, `events[]` ✅ (kind/phase; **penalty attribution = gap**) | **Show now (C);** penalty attribution stays source-gap (INV-3) |
| 8 | Handover total count | `totalHandovers` (terminal) | derivable from events | **Live (terminal) + offline** |
| 9 | SINR / throughput per frame | gap | `series.sinrDb`, `timeline[].metrics.servingSinrDb/throughputMbps` ✅ | **Show now (C)** |
| 10 | Episode progress | `episode`/`episodeBudget` ✅ | n/a (offline is time-based) | **Live now (A)** |
| 11 | Flowchart node/edge activation | episode tick (boundary) | bind to `events[]` real ids + `decisionFrames` ✅ | **Show now (C events);** idle edges where no source id (G1) |
| 12 | Loss curve (per-step) | gap | absent | **Source-gap (hard) → Plane B, G-B (gated)** |
| 13 | Pareto front | gap | absent | **Source-gap (hard) → G-B (gated)** |
| 14 | Q-values (raw per-action) | gap | `actionScores` are **scalarized**, not raw Q (partial) | **Partial offline (scalarized);** raw Q = G-B (gated) |
| 15 | LR / epsilon schedule | `eps=` printed, unparsed | absent | **Source-gap;** epsilon = cheap parser change (G-A2) |
| 16 | Replay-buffer fill | `buf=` printed, unparsed | absent | **Source-gap;** cheap parser change (G-A2) |
| 17 | Per-UE queue / traffic depth | gap | absent | **Source-gap** — source-owned only (vendored traffic gen / producer trace); **Phase 3 decision**, never display-invented (v2 §4.3, ADR-002) |

**Reading of the table:** rows 1–11 (the whole offline dashboard + flowchart) are
buildable now on Plane C with zero cross-repo change. Rows 12–17 are gaps; 12–14
and 17 are genuine producer/architecture work, 15–16 are trivial producer parser
changes. Live versions of 1–7 all reduce to one producer change (G-A).

---

## 4. Existing UI surface inventory (Phase 1a is delta, not greenfield)

| Surface | Path | Shows | Bound to | Reuse for Phase 1a |
|---|---|---|---|---|
| `RewardCurvePanel` | `src/ui/modqn-training/RewardCurvePanel.tsx:183` | 4 SVG reward curves (scalar + r1/r2/r3), slot highlight | **`ModqnReplayEnvelope` (phase-03a bundle)** | re-point/extend to Plane-C `series` |
| `DecisionVizPanel` | `src/ui/modqn-training/DecisionVizPanel.tsx:296` | top-K scalarized Q bars + dense action scores | **`ModqnReplayEnvelope`** | re-point to Plane-C `diagnostics.decisionFrames` |
| `MiniRewardCurve` | `src/ui/modqn-controls/MiniRewardCurve.tsx` | sparkline; **generic `rewards: number[]` prop** | plane-agnostic | reuse directly (feed any plane) |
| `ModqnObjectiveTab` | `src/ui/ModqnObjectiveTab.tsx` | ω sliders (not a chart) | bundle `policyDiagnostics.objectiveWeights` | source for ω readout |
| **2D algorithm flowchart** | — | — | **does not exist** | **net-new (P1a-S3/S4)** |

The chart primitives exist but bind to the phase-03a replay bundle, not
`visual-showcase-v1`. Phase 1a's real work is (a) a Plane-C series adapter, (b)
pointing the panels at it on an offline-first surface, (c) the brand-new
flowchart. The flowchart is the only genuinely-new visual component.

---

## 5. Cross-repo producer gaps (GATED — need explicit user go)

Per CLAUDE.md §4 + v2 §10, none of these start without sign-off.

- **G-A — Live per-episode reward curve (small, high-value).** Make the live
  stream emit reward means *per episode*, not only at `final:`. Cheapest path:
  have the trainer also print a **JSON** progress line per `progress_every`
  episode (`{"episode":N,"scalar_reward":…,"r1_mean":…,…}`) — the existing
  parser branch (1) already consumes it, **no consumer change at all**. This is
  the single change that turns "live training" from a progress bar into a live
  reward story. *Repo: `modqn-paper-reproduction` (`modqn.py` print site +
  optionally `progress_events.py`).* **heavy? No** — tiny edit.
- **G-A2 — epsilon / replay-buffer live channels.** Add `epsilon`/`buf` keys to
  the JSON progress line + `metrics_from_mapping`. Trivial, bundle with G-A.
- **G-B — Plane B per-step trace (`modqn-training-scene-trace-v1`).** Emit
  loss / Pareto / Q-values / LR / active+next beam schedule / comparison streams
  as the producer trace the 40-field contract already scaffolds. Larger; this is
  the "real live training internals" plane. Validate in `ntn-sim-core` first.
- **G-C — Frozen multi-catfish `visual-showcase-v1` bundle.** Phase 4 gate; no
  validated multi-catfish replay bundle exists yet.

Everything in Phases 0–3 is in-repo and needs **none** of the above.

---

## 6. Opportunistic-cleanup reconciliation (from this sweep)

- **Target 1 (route `appMode` reads through `resolveSceneLaneRenderPlan`) —
  DROP.** Verified: the lane decision is **already centralized**
  (`resolveSceneLane` `sceneLane.ts:16` called at `App.tsx:455` →
  `resolveSceneLaneRenderPlan` consumed at `MainScene.tsx:478`, `show*` flags
  destructured `490-510`). No `appMode` read bypasses the resolver for a
  lane/visibility-proof decision. The remaining `appMode` reads are **non-lane**:
  scene-config sizing (`MainScene.tsx:193-194,296-297`), telemetry/DOM
  passthrough (`:210,701,925`), and beam-cone count/density/slice tuning
  (`:585,802`; `useBeamViz.ts:103,123,275,289,513,861`). Routing those through
  the plan would be a **semantic refactor** needing new `SceneLaneRenderPlan`
  fields + a governance mini-SDD (Frontend Render Governance Rule) — **not** a
  like-for-like cleanup. Removed from scope. (Note: the file is
  `src/scene/useBeamViz.ts`; the brief's `src/viz/useBeamViz*` path does not
  exist.)
- **Target 2 (`EARTH_KM_PER_DEG` inline at `runtimeFrameStep.ts:572-573`) —
  CONFIRMED trivial, DEFERRED to the slice that touches the file.** Both lines
  use bare `111.32` while `const EARTH_KM_PER_DEG = 111.32` already exists in the
  **same file** at `:79` (used at `:261-262`). Value-identical swap, no new
  import. Per the "only when you touch that file" rule, Phase 1a does not touch
  `runtimeFrameStep.ts`; fold this into **Phase 2** (Director tier edits
  `usePlaybackControls.ts` + `runtimeFrameStep.ts:494`). (Same-name duplicates at
  `runtimeUeFrame.ts:12`, `modqnReplaySceneVisuals.ts:21`; related `KM_PER_DEG`
  at `showcaseArtifactToScene.ts:239`, `cellLayout.ts:52` — future shared-const
  consolidation, out of scope.)

---

## 7. Phase 1a slice plan (offline-first dashboard + flowchart scaffold)

Goal (v2 §6): build the 2D dashboard + flowchart against Plane C so UI dev is
unblocked with no live backend. Each slice ff-merges to `main`; **Codex writes,
Opus reviews** (`/codex review` + main-thread re-verify). Per-phase validator is
necessary-but-not-sufficient alongside a browser smoke.

| Slice | Scope | New/changed | Validator | Lane |
|---|---|---|---|---|
| **P1a-S1** | **Plane-C series adapter** (pure, no React/3D): `VisualShowcaseArtifact → DashboardSeriesModel` extracting `series.{reward,sinrDb,actionIndex,servingSatellite,handoverPhase}`, `diagnostics.{objectiveWeights,rewardComponents,actionScores,decisionFrames}`, `events[]`. **Every channel tagged with its plane + provenance** (INV-1). | new `src/showcase/dashboard/seriesModel.ts` + tests | extend `validate:phase-d:reward-curve` → assert per-channel plane provenance (INV-1) | n/a (pure) |
| **P1a-S2** | **Offline dashboard shell + reward/decision panels on Plane C.** New non-3D `AlgorithmDashboard` (imports **no** `three`/`scene/` symbols, mounts no `<Canvas>` — G3). Reuse `MiniRewardCurve` (generic prop); adapt `RewardCurvePanel`/`DecisionVizPanel` to the S1 model. Mount in the **artifact-replay** lane sidebar (lane-owned). | new dashboard surface; thin adapters | G3: extend `validate:frontend:scene-lane-governance` → dashboard imports no 3D, fails closed | `artifact-replay` |
| **P1a-S3** | **2D algorithm flowchart scaffold — static + idle.** SVG MODQN pipeline (state → Q-net → action-mask → selected action → serving → reward). Static prebaked layout (no runtime extrusion — that's Phase 4 3D). Nodes/edges render **idle**; each edge declares the Plane-C source id (`events[]`/`decisionFrames`) that may drive it; edges with no source are **permanently idle** (G1). | new `src/showcase/dashboard/AlgorithmFlowchart.tsx` | new — assert every animatable edge has a bound source id; unbound edges static | `artifact-replay` |
| **P1a-S4** | **Flowchart edge animation bound to event boundaries.** On scrub/replay, pulse an edge **only** when the current frame crosses a real `events[]` id / decisionFrame boundary, via **ref + rAF/CSS** (no per-frame React; G4). Label cadence "episode-paced". | edge-pulse binding | new — synthetic artifact with known event tSec → edges pulse only there, idle elsewhere (G1 no-fake-motion) | `artifact-replay` |

**Sequencing & dependencies:** S1 → S2 → S3 → S4 (linear; S3 may start after S1).
P1b (live Plane-A SSE overlay + INV-2 staleness, new
`validate:phase-d:live-telemetry`) layers on top after P1a, and is independent of
the gated G-A producer change — the staleness/fail-closed badge works on the
existing episode/heartbeat channels alone.

**Continuous-dev note:** dispatch S1→S4 back-to-back (feedback:
continuous-dev-no-mid-merge); stop only for context limit, a genuine decision, or
the G-A cross-repo gate.
