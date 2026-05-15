# MODQN ω-Weighted Handover Mini-SDD

**Date:** 2026-05-15
**Status:** DRAFT SDD — planning authority, not implementation evidence
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope anchor:** `PAP-2024-MORL-MULTIBEAM` baseline MODQN, with forward-compatibility hooks for `angle-aware-ee-multicatfish` and `multi-catfish` follow-ons.

## 0. Reading Order

Read before changing this SDD or starting any slice:

1. `CLAUDE.md` (this repo) — vendor-on-demand rule, replay-first authority, boundaries §5.
2. `docs/modqn-baseline-phase7k-frontend-integration-control-plane.md` — current replay / live control-plane separation.
3. `docs/modqn-baseline-phase7b-replay-live-adapter-contract.md` — replay / live adapter contract.
4. `docs/modqn-baseline-live-integration-mini-sdd.md` — supersession note + Phase 6W deferral history.
5. `/home/u24/papers/modqn-paper-reproduction/src/modqn_paper_reproduction/algorithms/modqn.py` lines 113–115, 501–545 — proof that MODQN inference uses three independent Q-networks with post-hoc scalarization.
6. `/home/u24/papers/modqn-paper-reproduction/docs/research/angle-aware-ee-multicatfish/00-architecture-sdd.md` lines 111–117, 142–144, 198 — confirmation that ee-MODQN and Multi-Catfish keep the 3-objective inference structure.
7. Memory entry `modqn-vendor-deferred` (Phase 6W channel-adoption decision).

Companion SDD:

- `docs/modqn-training-trigger-backend-sdd.md` — backend service that user-triggers Python training and writes new bundle artifacts. Slice S5 of this SDD depends on the backend SDD.

## 1. Purpose

The left-side MODQN sidebar in `leo-beam-sim` is currently a stub
(`src/ui/useModqnDemoStub.ts`). Sliding the three objective weights ω =
(ω_throughput, ω_handover, ω_loadBalance) has no effect on the 3D scene, on
the live handover decisions, on the MODQN replay board, or on any artifact.
The "retrain" button is a setInterval that draws a fake reward curve.

This SDD defines how to wire those three ω weights to a real handover
criterion that the operator can apply and toggle on/off, while preserving
the existing sinr-offset live behavior as the default.

It also defines the multi-mode design that lets the same simulator serve:

1. The paper-faithful research demo, where ω is post-hoc applied to MODQN
   producer artifacts and the main scene is constrained to the training
   environment.
2. The general-audience demo, where ω drives a closed-form scoring rule
   over any profile, with an unmissable banner stating it is not the paper
   MODQN.

The motivating constraint is that ω is **not a training input that is then
baked into a single scalar Q-network**. The MODQN policy uses three
independent Q-networks (one per objective) and applies the scalarization
`argmax_a Σ_k ω_k · Q_k(s, a)` at inference time
(`modqn.py:501-545`, `objective_weights` parameter). This means ω can be
adjusted at consumption time without retraining, provided either (a) the
producer artifact stores `objectiveQ` per candidate, which the current
bundle schema already does, or (b) the consumer has direct access to the
trained Q-networks.

## 2. Scope

### 2.1 Goals

- Replace `src/ui/useModqnDemoStub.ts` with a sidebar that reads the
  loaded MODQN replay bundle's `policyDiagnostics.objectiveWeights` and
  `topCandidates[*].objectiveQ` and applies ω via post-hoc scalarization.
- Provide three handover-criterion modes selectable at runtime:
  `sinr-offset` (default), `modqn-replay`, and `omega-heuristic`.
- Replace the hard-coded `MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL`
  (defined at `src/modqn/replay-bundle/playback-shell.ts:269`, currently
  imported and consumed at `src/App.tsx:13`) with a runtime fetch of the
  selected baseline bundle artifact.
- Add a new profile `modqn-1sat-7beam` that matches the bundle training
  environment so `modqn-replay` mode has a coherent scene to render.
- Add an unmissable `Heuristic ω-scoring — NOT paper MODQN` banner whenever
  `omega-heuristic` mode is active, plus matching `data-*` capture
  metadata for screenshots and any future capture pipeline.
- Make the MODQN replay board (currently mounted invisible at
  `MainScene.tsx:328`) toggleable in all three modes.
- Preserve all existing live simulator behavior, scene rendering, camera
  presets, and intra/inter handover visuals.
- Keep the design forward-compatible with ee-MODQN, Multi-Catfish, and
  future bundle schema variants by encoding the mode contract in a
  separate slice from the artifact-loading slice.

### 2.2 Non-Goals

- No live inference of trained Q-networks in `leo-beam-sim` (no ONNX
  vendor, no `onnxruntime-web`). Phase 6W antenna-pattern provenance
  remains unresolved and continues to gate that path.
- No MODQN retraining inside `leo-beam-sim`. Real training stays in
  `modqn-paper-reproduction`; this repo only consumes bundles. Slice S5
  triggers backend training via a separate service whose design lives in
  `docs/modqn-training-trigger-backend-sdd.md`.
- No change to `HandoverManager` truth-side rules. The sinr-offset
  policy code at `src/engine/handover/handover-manager.ts:110-132` is
  untouched. New modes are layered above as alternate decision sources.
- No new HOBS variant, no new SINR formula, no change to
  `BEAM_GAIN_FLOOR_DB`, no change to TR 38.811 parameters, no change to
  beam-pattern roll-off, no change to fading or shadow models. See §4.1.
- No change to the four `baseline-kpi-*.json` files in `ntn-sim-core`.
- No change to MODQN bundle schema. Producer side stays
  `phase-03a-replay-bundle-v1`. Future schema upgrades (e.g.
  `phase-03a-replay-bundle-v2` for ee-MODQN diagnostics) are handled by
  the parser via a discriminated union, not by mutating the existing
  schema.
- No "EE", "HEA", "Catfish", "Multi-Catfish", or "Catfish-over-HEA"
  claim in this SDD. The forward-compatibility hook for those tracks is
  schema discipline only; effectiveness claims remain producer-owned.

## 3. Core Definitions

### 3.1 Three Objective Weights (ω)

`ω = (ω_throughput, ω_handover, ω_loadBalance)`, each in `[0, 1]`.

Bundle storage:
`ModqnPolicyDiagnostics.objectiveWeights: ModqnRewardVector` records the
training-time ω used to produce the bundle's selected actions
(`src/modqn/replay-bundle/types.ts:95`).

Inference-time semantics:
`Q_scalar(s, a) = ω_throughput · Q_throughput(s, a) + ω_handover ·
Q_handover(s, a) + ω_loadBalance · Q_loadBalance(s, a)`. The selected
beam at state `s` is `argmax_a Q_scalar(s, a)` restricted to the
visibility / validity mask. Source: `modqn.py:501-545`.

### 3.2 Handover Mode

A user-selectable runtime setting that controls **which decision source
the simulator's serving beam follows**. Three values:

| Mode | ID | Decision source | Profile constraint |
|---|---|---|---|
| Sinr Offset | `sinr-offset` | `HandoverManager` sinr-offset rule (current) | none |
| MODQN Replay | `modqn-replay` | Bundle-derived `selectedServing`, recomputable via ω re-scalarization over `topCandidates[*].objectiveQ` | `modqn-1sat-7beam` required |
| ω Heuristic | `omega-heuristic` | Closed-form score `s(a) = ω_t · normSINR(a) − ω_h · isSwitch(a) − ω_l · normLoad(a)`, argmax over current beams | none |

Mode is a runtime control-plane state, not a profile field. Profile
selection and mode selection are independent except for the constraint
that `modqn-replay` requires `modqn-1sat-7beam`.

### 3.3 Re-Scalarization

Given a bundle row with `policyDiagnostics.topCandidates`, each carrying
`objectiveQ = (Q1, Q2, Q3)`, the consumer can compute, for a user-chosen
ω, the new `argmax` among the recorded top-K. This is **bounded** to the
K candidates the producer exported (current `k = 3`). If the user-chosen
ω would select an action outside the recorded top-K, the bundle has no
Q-value for that action and the re-scalarization **falls back to the
top-K winner only**. This is a faithful limitation, not a bug, and must
be surfaced in the sidebar.

### 3.4 ω-Heuristic Score

The `omega-heuristic` mode uses a hand-written linear score function
that is **not** the paper's MODQN. It is a demo affordance. The
specific form is:

```
normSINR(a)    = sinrLinear(a) / max_b sinrLinear(b)         in [0, 1]
isSwitch(a)    = 1 if a ≠ currentServing else 0
normLoad(a)    = activeUesOnBeam(a) / max_b activeUesOnBeam(b)
                  if any beam loaded else 0                  in [0, 1]

score(a) = ω_throughput · normSINR(a)
         − ω_handover   · isSwitch(a)
         − ω_loadBalance · normLoad(a)

selectedBeam = argmax_a score(a) over beams in current candidate set
```

The selected beam still flows through `HandoverManager` for trigger-time
and ping-pong-guard timing, so the rest of the engine stays untouched.
Only the `argmax` choice is overridden when `omega-heuristic` is the
active mode.

This is not learned from data. Anyone reading the sidebar, looking at
screenshots, or replaying captured traces must be able to tell at a
glance that this is not paper MODQN. The four-line warning rule in §4.4
covers that.

### 3.5 ω Apply Semantics

Sidebar ω changes are **draft** until the user clicks `Apply`. On apply:

- `sinr-offset` mode: no effect on the live engine. Apply still works
  but only changes future re-scalarization on the MODQN replay board (if
  visible).
- `modqn-replay` mode: triggers re-scalarization of the current bundle.
  Serving beam may change on next bundle slot. No retrain. No artifact
  mutation.
- `omega-heuristic` mode: the score function picks up the new ω on the
  next handover-decision tick. No retrain.

A `Reset` button restores ω to the bundle's
`policyDiagnostics.objectiveWeights` (in `modqn-replay`) or to the
heuristic mode's last-applied value (in `omega-heuristic`).

## 4. Rigor Boundaries

This is the single most important section. Any agent picking up this work
must obey it.

### 4.1 Frozen — must not be touched

The following are part of paper fidelity or research truth and are off
limits to this initiative:

1. `HandoverManager` sinr-offset rule code at
   `src/engine/handover/handover-manager.ts:110-132`.
2. SINR numerator, denominator, noise power, fading, shadow, scintillation.
3. Beam-pattern roll-off and `BEAM_GAIN_FLOOR_DB`.
4. TR 38.811 baseline parameters defined in
   `docs/hobs-tr38811-sinr-mini-sdd.md` and
   `docs/sinr-runtime-parameter-contract.md`.
5. The four `baseline-kpi-*.json` files in `ntn-sim-core`. If a slice
   here makes one of these fail, fix the slice, not the baseline.
6. MODQN bundle JSON content. The consumer parser is allowed to add
   schema-version branches; the bundle bytes are immutable.
7. Producer training pipeline in `modqn-paper-reproduction`. Slice S5
   triggers it via subprocess, but does not modify its code.
8. The `selectedServing` field of any bundle row. Re-scalarization picks
   an alternative among the recorded `topCandidates`; the original
   `selectedServing` remains visible in the diagnostics drawer as the
   producer-recorded ground truth for the bundle's training-time ω.

### 4.2 Tunable as policy / scenario

The following are policy or scenario parameters and may be tuned for demo
quality. Each must remain a profile-level or runtime-level knob (not a
hidden hardcode) so the change is auditable:

1. The active handover mode (`sinr-offset` / `modqn-replay` /
   `omega-heuristic`). Runtime control-plane only. Default
   `sinr-offset`.
2. The applied ω values, with bundle-`objectiveWeights` as the reset
   target. Persisted to `localStorage` only for `sinr-offset` and
   `modqn-replay` modes. **Never persisted for `omega-heuristic`** (see
   §4.4.2).
3. Bundle artifact selection. Slice S2 wires this to a runtime selector;
   the default remains the Phase 7C selected baseline at
   `SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH`.
4. MODQN board visibility (`showBoard` prop). Available in all modes.

### 4.3 Pure presentation — fully free

Anything that does not change which events the engine emits, which beams
the engine considers, or how SINR is computed:

- Sidebar layout, labels, tooltip text, colors, slider styling.
- MODQN board materials, geometry, label fonts, switch-arc animation.
- Banner styling for the heuristic warning (within the §4.4 strictness
  rule).
- Diagnostics drawer rows that surface ω, mode, bundle path, training-time
  ω, re-scalarization fallback events.

### 4.4 Heuristic-mode disclosure rules

The `omega-heuristic` mode is a demo affordance only. To prevent it from
being mistaken for paper MODQN in screenshots, captures, or
demonstrations, the following are binding:

1. **Persistent banner.** When `omega-heuristic` is the active mode, a
   non-dismissable banner anchored to the top of the main scene reads
   `Heuristic ω-scoring — NOT paper MODQN`. Background is the warning
   color (orange / amber, contrast ratio ≥ 4.5:1 against text). The
   banner must be present whenever the mode is active, regardless of
   sidebar visibility, fullscreen state, or cinematic-mode dimming.
2. **No persistence to localStorage.** App startup always resets to
   `sinr-offset` mode. Selecting `omega-heuristic` is intentional
   per-session.
3. **Code naming.** The scoring function is named
   `computeHeuristicNotPaperScore`. The mode label in
   `RuntimeHandoverMode` enum is `omega-heuristic`. The bundle parser
   must never produce this mode.
4. **Capture metadata.** Top-level scene container carries
   `data-handover-criterion="omega-heuristic-not-paper"`. Diagnostics
   drawer always shows the current mode value.
5. **Default off.** No keyboard shortcut, URL query string, or saved
   profile may launch `omega-heuristic` mode without going through the
   sidebar's explicit selector.

These rules are joint preconditions for the mode being implemented. If
any one is dropped, S4 is incomplete.

## 5. Architecture Overview

### 5.1 Component diagram

```
                                                        ┌────────────────────────────┐
                                                        │  modqn-paper-reproduction  │
                                                        │  (producer, Python)        │
                                                        │  ├─ bundle/schema.py       │
                                                        │  ├─ algorithms/modqn.py    │
                                                        │  └─ artifacts/             │
                                                        └────────────┬───────────────┘
                                                                     │ writes
                                                                     ▼
                                                        ┌────────────────────────────┐
                                                        │ phase-03a-replay-bundle-v1 │
                                                        │ JSON / JSONL artifact      │
                                                        │ + objectiveQ per candidate │
                                                        └────────────┬───────────────┘
                                                                     │ HTTP fetch (Slice S2)
                                                                     │ or backend serve (S5)
                                                                     ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────────────┐
│   src/ui                        │         │   src/modqn/replay-bundle               │
│   ├─ ModqnObjectiveTab          │◀────────│   ├─ loader.ts (parse)                  │
│   ├─ ModqnEvidenceTab           │  reads  │   ├─ replay-state.ts (envelope)         │
│   └─ useModqnHandoverState ↔────┼─────────│   └─ playback-shell.ts (display state)  │
│     (replaces useModqnDemoStub) │         │                                         │
└────────────────┬────────────────┘         └─────────────────────────────────────────┘
                 │ω, mode, applyKey                                       ▲
                 ▼                                                        │
┌─────────────────────────────────────────────────────────────────────────┴───────────┐
│   src/App.tsx (runtime control plane)                                               │
│   ┌─────────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────┐ │
│   │ profile (any)           │ │ handoverMode         │ │ replayDisplayState        │ │
│   └─────────────────────────┘ │ (RuntimeMode)        │ │ (from runtime fetch)      │ │
│                               └──────────────────────┘ └──────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────────────────────────┘
                      │ runtime: profile + mode + ω + displayState
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│   src/scene/MainScene + scene/useSimulation                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │ HandoverManager (sinr-offset truth, unchanged)                              │   │
│   │   ↑                                                                          │   │
│   │   │ in `modqn-replay`/`omega-heuristic`, an override hook replaces the      │   │
│   │   │ `argmax` step. Trigger timing / dwell / ping-pong guard stay engine-side │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │ ModqnReplaySceneLayer (board, showBoard toggle in all modes)                │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │ HeuristicNotPaperBanner (mounted iff mode === 'omega-heuristic')            │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 New runtime types

```ts
// src/scene/types.ts (extended)
export type RuntimeHandoverMode =
  | 'sinr-offset'
  | 'modqn-replay'
  | 'omega-heuristic';

export interface RuntimeOmegaState {
  readonly throughput: number;     // [0, 1]
  readonly handover: number;       // [0, 1]
  readonly loadBalance: number;    // [0, 1]
  readonly appliedAtMs: number;    // monotonic clock at last Apply
  readonly source:
    | 'bundle-objective-weights'   // mode = modqn-replay
    | 'user-applied'               // mode = modqn-replay after user edit
    | 'heuristic-default'          // mode = omega-heuristic at session start
    | 'user-applied-heuristic';    // mode = omega-heuristic after user edit
}

// added to RuntimeConfig
export interface RuntimeConfig {
  // ... existing fields ...
  readonly handoverMode: RuntimeHandoverMode;
  readonly omega: RuntimeOmegaState;
  readonly modqnReplayBoardVisible: boolean;
}
```

### 5.3 HandoverManager override hook

`HandoverManager` exposes a new optional `decisionOverride` parameter on
the existing decision entry point. Override receives the same inputs
(candidate beams, current serving, masks, ΔSINR vs serving) and returns
either `null` (defer to sinr-offset) or a chosen `beamId`. Trigger timing
(`triggerTimeSec`), dwell (`intraSwitchTimeSec`), and ping-pong-guard
(`pingPongGuardSec`) **remain engine-side**. The override only replaces
the `argmax` step.

When `handoverMode === 'sinr-offset'`, no override is installed.
When `handoverMode === 'modqn-replay'`, the override consults the current
bundle row's re-scalarized top-K. The trigger timing of the resulting
swap is still governed by the engine's HOBS Eq. (24)–(25) timing, so
intra-handover viz, auto-slow, and inter-handover viz continue to work.
When `handoverMode === 'omega-heuristic'`, the override evaluates
`computeHeuristicNotPaperScore` over the live candidate set.

This hook is the **only** edit to engine-truth code. It must be
behavior-preserving when the override is null; baseline KPI parity
verifies this in S0.

## 6. Mode Behavior Matrix

### 6.1 Detailed mode × control behavior

| Behavior | `sinr-offset` | `modqn-replay` | `omega-heuristic` |
|---|---|---|---|
| Required profile | any | `modqn-1sat-7beam` (forced) | any |
| Engine decision source | `HandoverManager` sinr-offset rule | bundle ω re-scalarization via override hook | `computeHeuristicNotPaperScore` via override hook |
| ω slider visible | yes (read-only) | yes (read-write) | yes (read-write) |
| ω Apply effect | none on engine; updates MODQN board re-scalarization only | re-scalarizes bundle on next slot, may change serving beam | recomputes score on next decision tick |
| ω Reset target | `bundle.policyDiagnostics.objectiveWeights` | same | last user-set value or `(0.4, 0.3, 0.3)` if never set this session |
| MODQN replay board | toggleable | toggleable, defaults on | toggleable, defaults off |
| Live HUD banner | none | `Paper-faithful: MODQN baseline replay` (info) | `Heuristic ω-scoring — NOT paper MODQN` (warn) |
| `data-handover-criterion` attribute | `sinr-offset` | `modqn-replay` | `omega-heuristic-not-paper` |
| Mode persistence | `localStorage` | `localStorage` | never persisted |
| Profile lock | profile selector free | profile selector locked to `modqn-1sat-7beam` while mode active | profile selector free |
| Live SINR / fading / channel | unchanged | unchanged | unchanged |
| Intra-handover viz | unchanged | unchanged | unchanged (override replaces argmax, not the event) |

### 6.2 Mode transitions

- `sinr-offset` → `modqn-replay`: if current profile is not
  `modqn-1sat-7beam`, the mode change requires the user to confirm a
  profile switch. After confirm: profile reset to `modqn-1sat-7beam`,
  sim reset via existing `createInitialSimState`, ω reset to bundle
  `objectiveWeights`, MODQN board defaults on.
- `modqn-replay` → `sinr-offset`: profile selector unlocks. ω draft
  retained but no longer affects engine. Board state preserved.
- `* → omega-heuristic`: heuristic banner mounts. ω reset to last
  heuristic-session value or `(0.4, 0.3, 0.3)` default.
- `omega-heuristic → *`: heuristic banner unmounts. Heuristic ω is
  forgotten on next page load.

## 7. Profile: `modqn-1sat-7beam`

### 7.1 Purpose

The bundle artifact at
`SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH` was produced by training MODQN
in an environment with a single satellite (`sat-0`) and seven beams
(`sat-0-beam-0` … `sat-0-beam-6`). Re-scalarizing `objectiveQ` is only
faithful to the trained Q-networks if the scene shows the same scenario.

A new profile is added to reuse all the existing scene infrastructure
(camera, ground, UE, ambient rings, intra/inter handover viz) on top of a
constrained 1-sat 7-beam orbit/beam config.

### 7.2 Authoring rules

- Filename `src/profiles/modqn-1sat-7beam.json`.
- `id: "modqn-1sat-7beam"`.
- `profileClass: "candidate-rich"` (so the existing presentation tier
  is reused).
- `formulaFamily: "hobs-legacy"` (matches producer bundle's SINR family;
  do not switch to `hobs-tr38811` here without a separate provenance
  decision).
- `orbit`: single shell, single plane, single satellite. Use the same
  observer lat/lon as `hobs-2024-candidate-rich`. The shell altitude is
  550 km and the sat is anchored above the observer at the bundle's
  start epoch so all seven beams are visible.
- `antenna`: identical to baseline (`bessel-j1-j3`, 40 dBi, 0.058 rad
  3 dB beamwidth, 12° max steering, 4 dB scan loss at max steering).
- `channel`: identical to `hobs-2024-candidate-rich`.
- `handover`: identical fields (sinr-offset, offset 3 dB, TTT 3.5 s,
  intra 0.75 s, sinrSmoothing 0.5 s, pingPongGuard 5 s). The override
  hook reuses these timings.
- `beams.perSatellite: 7`, `beams.maxActivePerSat: 7`,
  `beams.frequencyReuse: 3`.
- `beamHopping`: disabled (`enabled: false`) for the first cut. The
  bundle's slot timeline drives the cadence in `modqn-replay` mode and
  there is no operator value in introducing a second slot scheduler.
- `demoStartOffsetSec`: chosen so that the sat is well above the horizon
  for the bundle duration (~1000 s); concrete value finalized in S2 by
  the existing `recommendDemoReplayStartOffsetSec` helper.

### 7.3 Non-claims

- This profile is **not** a "single-satellite paper-default". It is a
  consumer-side scene configuration that matches the bundle's training
  env. The training env, the bundle's identity contract, and the paper's
  baseline claim all remain producer-owned.
- The profile is **not** a replacement for `hobs-2024-paper-default`. It
  is added; existing paper-faithful profiles are not touched.

## 8. Slice Plan

One slice = one PR. No batched merges.

| Slice | Tracks | Touches | Risk |
|---|---|---|---|
| **S0** | engine override hook | `engine/handover/handover-manager.ts` (new optional param), KPI parity tests | medium — engine-side, must prove null-override is behavior-preserving |
| **S1** | sidebar truth-up | `ui/ModqnObjectiveTab.tsx`, `ui/ModqnEvidenceTab.tsx`, `ui/useModqnDemoStub.ts` → `ui/useModqnHandoverState.ts`, `handoverPolicyTuning.ts` | low — sidebar only |
| **S2** | runtime bundle fetch + `modqn-1sat-7beam` profile | `App.tsx`, `modqn/replay-bundle/replay-state.ts`, new `profiles/modqn-1sat-7beam.json`, `profiles/index.ts` | medium — replaces hard-coded shell model |
| **S3** | `modqn-replay` mode wiring | `ui/ControlBar.tsx` (mode selector), `App.tsx` (mode state), `scene/useSimulation.ts` (consumes override) | medium — first time override fires |
| **S4** | `omega-heuristic` mode + four-line disclosure | `engine/handover/decision-override.ts` (new), `ui/HeuristicNotPaperBanner.tsx` (new), mode selector entry | medium — heuristic correctness + disclosure must both pass |
| **S5** | backend training trigger (consumer side) | `ui/modqn-training/*` (new), `App.tsx` artifact picker, backend integration glue | medium-high — pairs with backend SDD |

### 8.1 Recommended order

1. **S0 first.** The override hook is the integration seam for S3 and
   S4. Writing it first with a null-override KPI parity test protects
   the engine.
2. **S1 second.** Sidebar truth-up removes the stub so subsequent slices
   are not competing with fake state.
3. **S2 third.** Runtime fetch + new profile unblocks `modqn-replay`
   mode by providing both the artifact and the matching scene.
4. **S3 fourth.** Wires `modqn-replay` to the override hook; first slice
   where ω actually changes the main scene's serving beam.
5. **S4 fifth.** Adds `omega-heuristic` mode and the four-line
   disclosure (banner + naming + capture metadata + non-persistence).
6. **S5 last.** Depends on the backend service from
   `docs/modqn-training-trigger-backend-sdd.md`. Can begin frontend
   stubbing once that SDD lands.

### 8.2 Inter-slice dependencies

```
S0 ─┬─> S3
    └─> S4
S1 (independent)
S2 ─┬─> S3
    └─> S5
S3 ─> S4? (no; S4 mounts on the same override hook from S0)
S5 depends on backend SDD landing first
```

S0 and S1 can be done in parallel. S2 depends on neither. S3 and S4
depend on S0; S3 also depends on S2 (needs the bundle in scene).

## 9. Acceptance Criteria

### 9.1 S0 — Override hook

- The hook is opt-in. With no override registered, every existing test
  passes, including beam-hopping and intra-handover tests.
- A new unit test confirms that when the override returns `null`,
  `HandoverManager` selects the same beam as the prior implementation
  across at least 1000 simulated decision steps from the
  `hobs-2024-candidate-rich` profile.
- Validator `validate-modqn-phase7k-r1-control-plane-hardening` (if it
  fires in this repo) still passes; if not present, document the parity
  test path in the PR.

### 9.2 S1 — Sidebar truth-up

- `useModqnDemoStub.ts` is removed.
- New `useModqnHandoverState.ts` exposes `omegaDraft`, `omegaActive`,
  `omegaSource`, `bundlePolicyDiagnostics`, `applyOmega`, `resetOmega`,
  `mode`, `setMode`.
- `ModqnObjectiveTab` reads bundle `objectiveWeights` and shows it as
  the reset target with a `from bundle` label.
- `ModqnEvidenceTab` displays the bundle manifest fields
  (`baselineSurface.episodesCompleted`, `baselineSurface.totalBeamCount`,
  `paperId`, `bundleSchemaVersion`) and the active ω.
- "Retrain" button is removed in this slice. The fake reward curve is
  removed. The fake `effectiveOffsetDb` / `effectiveTriggerTimeSec`
  derivations in `useModqnDemoStub` are removed.
- `tsc --noEmit` is clean and a new validator
  `scripts/validate-modqn-omega-s1-sidebar-truth-up.tsx` exits 0. (The
  repo has no `vitest`; tests are validator scripts invoked via
  `node --import tsx/esm scripts/validate-*.{ts,tsx}`. This convention
  carries through every subsequent slice.)

### 9.3 S2 — Runtime fetch + new profile

- `MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL` is no longer imported by
  `App.tsx`. It may remain in `playback-shell.ts` as a typed reference
  for tests, but it is not the runtime source.
- The S1 hook `useModqnHandoverState` currently synthesizes a
  paper-default `bundlePolicyDiagnostics` snapshot. S2 replaces the
  synthesis with envelope reads — envelope-level diagnostics live at
  `ModqnReplayEnvelopeProducerTruth.policyDiagnostics`
  (`src/modqn/replay-bundle/replay-state.ts:167`) and per-row
  diagnostics live at `ModqnReplayTimelineRow.policyDiagnostics`
  (`src/modqn/replay-bundle/types.ts:128`). S2 surfaces at least the
  current-slot row's `policyDiagnostics` through the existing
  `getBundleSidebarSnapshot()` accessor **without changing the hook's
  return shape** (S3/S4 depend on shape stability).
- `App.tsx` fetches the baseline bundle at startup. The fetch path is
  configurable but defaults to `SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH`
  via the dev server's static-file route.
- Fetch failure surfaces a banner and falls back to the typed reference.
- `modqn-1sat-7beam.json` profile lands and appears in the profile
  selector, labeled `MODQN 1-sat 7-beam (replay)`.
- The profile loads without breaking any existing test or visual
  regression in `hobs-2024-candidate-rich`.

### 9.4 S3 — `modqn-replay` mode

- A new `ControlBar` segmented control offers
  `sinr-offset` / `modqn-replay` / `omega-heuristic`. (The `omega-heuristic`
  entry may render with a `coming in S4` disabled state until S4 lands.)
- Selecting `modqn-replay` from any profile prompts the user to switch
  to `modqn-1sat-7beam`. On confirm: profile resets, sim reset, ω reset
  to bundle weights.
- Sliding ω in `modqn-replay` mode and clicking `Apply` changes the
  serving beam at the next bundle slot, provided the user-chosen ω
  prefers a beam in the bundle's `topCandidates` over the
  training-time choice.
- A re-scalarization fallback row in `DiagnosticsDrawer` shows when the
  user's ω would prefer an out-of-top-K beam and the system fell back to
  the recorded top-K winner.
- Intra-handover viz, inter-handover viz, auto-slow, camera presets,
  and ground ripple all continue to work.
- `data-handover-criterion="modqn-replay"` on the scene container.

### 9.5 S4 — `omega-heuristic` mode + disclosure

- Selecting `omega-heuristic` mounts the persistent banner reading
  `Heuristic ω-scoring — NOT paper MODQN` at the top of the main scene,
  warning color, non-dismissable, present in fullscreen and cinematic
  modes.
- The score function `computeHeuristicNotPaperScore` is implemented in
  `engine/handover/decision-override.ts` with this exact name and inline
  comment block citing this SDD.
- ω changes apply on the next decision tick.
- Capture metadata: `data-handover-criterion="omega-heuristic-not-paper"`
  on the scene container.
- Refreshing the page resets mode to `sinr-offset`. `localStorage`
  contains no key for the heuristic mode.
- No keyboard shortcut or URL flag may launch the heuristic mode.
- A diagnostics-drawer row shows the current mode, ω, score function
  formula in human-readable form, and a "not paper MODQN" warning.

### 9.6 S5 — Backend training trigger (consumer side)

Depends on `docs/modqn-training-trigger-backend-sdd.md`. Consumer-side
acceptance:

- Sidebar exposes a training form with ω + hyperparam fields.
- `Start training` posts to backend, receives `jobId`, shows pending
  state.
- The `Jobs` panel polls backend every 10 s and lists user-trained
  bundles when done.
- Selecting a user-trained bundle updates `App.tsx` artifact selection;
  consumer code does not need a new schema branch unless producer ships
  one.
- User-trained bundle's manifest carries `userTrained: true,
  paperFaithful: false` and the UI tags it explicitly in the picker.
- Closing the browser does not interrupt training.

### 9.7 Truth invariance

For a fixed replay seed and a fixed profile in `sinr-offset` mode,
before-and-after every slice:

- Identical `HandoverEvent` log (same actions, same fromBeamId, same
  toBeamId, same triggeredAtSec to within float tolerance).
- Identical per-beam SINR samples.
- Identical `baseline-kpi-*.json` cross-checks when run against
  `ntn-sim-core`.

Truth invariance does not extend to `modqn-replay` or `omega-heuristic`
modes (which by design change the decision source), but it must hold for
`sinr-offset` regardless of slice landings.

## 10. Telemetry and Diagnostics

`DiagnosticsDrawer` adds, in this order:

1. `Mode` row: `sinr-offset` / `modqn-replay` / `omega-heuristic`, with
   the `data-*` attribute.
2. `Profile` row: profile id + whether locked by mode.
3. `ω applied` row: `(ω_t, ω_h, ω_l)` with source label
   (`bundle-objective-weights` / `user-applied` /
   `heuristic-default` / `user-applied-heuristic`).
4. `Bundle` row: schema version, paper id, baseline beams count,
   episodes completed, source path.
5. `Re-scalarization fallback` row (modqn-replay only): count of decision
   ticks where user ω preferred an out-of-top-K action and the system
   defaulted to recorded top-K winner.
6. `Decision source` row: in `sinr-offset`, `HandoverManager`; in
   `modqn-replay`, `bundle.topCandidates re-argmax`; in
   `omega-heuristic`, `computeHeuristicNotPaperScore`.

Each row is read-only.

## 11. Rollback

- S0 reverts by removing the override parameter from `HandoverManager`.
  Tests still pass.
- S1 reverts by reinstating `useModqnDemoStub.ts` and the old tabs (file
  history). The reverted state is no worse than today.
- S2 reverts by reinstating the `MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL`
  import. `modqn-1sat-7beam.json` may stay (no harm in keeping the
  profile) or revert with the same commit.
- S3 reverts by removing the mode selector entry and the `modqn-replay`
  override registration. `sinr-offset` is the default.
- S4 reverts by removing the banner mount and the override registration
  for `omega-heuristic`. Even if the score function file remains, the
  mode is unreachable.
- S5 reverts on the consumer side by removing the training form +
  artifact picker, leaving the bundle fetch from S2 in place.

No slice introduces a state that requires migration on rollback.

## 12. Resolved Decisions

These were open questions during the design conversation on 2026-05-15
and have been settled.

### 12.1 Three-mode design

Adopt all three modes (`sinr-offset` / `modqn-replay` /
`omega-heuristic`). Rationale: the simulator must serve a paper-faithful
research demo (modqn-replay) and a general-audience visual demo
(omega-heuristic), and the sinr-offset default must remain untouched as
the live truth path. Conditional restrictions (heuristic-mode
disclosure §4.4) prevent misuse.

### 12.2 ω is post-hoc, not retrained

Rationale: MODQN's policy is `argmax_a Σ_k ω_k · Q_k(s, a)` with three
independent Q-networks (`modqn.py:113-115`, `501-545`). `objectiveQ` per
candidate is stored in the bundle. Re-scalarizing at consumer time is a
linear combination, not a retraining op.

### 12.3 Heuristic mode is not paper MODQN

Heuristic is a closed-form rule, not a learned policy. UI labels must
say so. The four-line disclosure in §4.4 is binding.

### 12.4 Profile is locked in `modqn-replay`

The bundle is faithful to its training env. Re-scalarizing
`objectiveQ` against a different scene env would produce semantically
empty numbers and would mislead in screenshots. The profile lock
explicitly tells the user "to switch the scene, switch the mode first".

### 12.5 Engine override is opt-in, behavior-preserving when null

S0's null-override unit test enforces this. `HandoverManager` timing
logic is unchanged in all modes.

### 12.6 No live Q-network inference

Phase 6W antenna-pattern provenance is unresolved. Live Q-network
inference would require either solving Phase 6W or accepting state-
distribution mismatch. Neither is in scope. If the user wants `ω
affecting any profile`, the path is `omega-heuristic` with its banner;
the `modqn-replay` path requires the bundle env.

### 12.7 No bundle schema mutation

Producer owns schema. Consumer parser is allowed a discriminated union
on `bundleSchemaVersion`. Future ee-MODQN and Multi-Catfish bundles
may bump schema to `v2`; the consumer adds a branch and continues.

### 12.8 Heuristic mode default ω

`(0.4, 0.3, 0.3)` to match the paper's training-time ω. Rationale:
"heuristic default = paper default ω" prevents demos accidentally
showing a wildly different ω than the paper. A user explicitly sliding
elsewhere is intentional.

### 12.9 Re-scalarization fallback policy

When user ω would prefer a beam outside the bundle's `topCandidates[K]`
(K = 3 producer-side), fall back to the recorded top-K winner and log
the fallback in `DiagnosticsDrawer`. Do **not** synthesize Q-values for
unseen actions. Do not silently expand to a wider top-K — producer
controls K.

## 13. Forward-Compatibility Notes

Three preconditions keep ee-MODQN and Multi-Catfish from breaking this
SDD:

1. Producer continues to emit three-objective Q-values in
   `policyDiagnostics.topCandidates[*].objectiveQ`. The
   `00-architecture-sdd.md` for angle-aware ee-multicatfish confirms
   three-objective inference (lines 111, 198). If a future track adds a
   fourth objective, this SDD's ω state and re-scalarization both expand
   from `(ω_t, ω_h, ω_l)` to a vector field; ~80 LOC delta.
2. Producer emits a `bundleSchemaVersion` that the consumer parser
   recognises. New versions branch in the parser; existing versions
   keep working.
3. Producer bundle's `userTrained: false / paperFaithful: true` defaults
   stay set on official artifacts. User-trained artifacts ship with the
   opposite labels (Slice S5).

If any of these slip, this SDD must be revised; do not silently expand
the consumer to cover producer drift.

## 14. Immediate Next Implementation Tasks

Recommended order:

1. **S0** — engine override hook + null-override parity test.
2. **S1** — sidebar truth-up.
3. **S2** — runtime bundle fetch + `modqn-1sat-7beam` profile.
4. **S3** — `modqn-replay` mode wiring.
5. **S4** — `omega-heuristic` mode + four-line disclosure.
6. **S5** — backend training trigger (consumer side); pair with
   `docs/modqn-training-trigger-backend-sdd.md`.

S0 and S1 may begin in separate conversations; they share no files.
