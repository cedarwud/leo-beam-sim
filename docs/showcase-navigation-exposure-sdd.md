# Showcase Navigation + Orphan-Feature Exposure SDD

**Status:** S1–S6 shipped on `feat/showcase-phase-0` (commits `4e56e0a` → `5ed4074`),
codex-reviewed CLEAN, all validators + browser gates green on real producer data.
**Date:** 2026-06-06. **Authority:** this doc + `docs/frontend-render-governance.md`.

## 1. Problem

Many features were fully built but had **no in-app button/route** to reach them
("orphan features"). A read-only 7-agent reachability audit (2026-06-06)
confirmed one root cause dominated, plus a cluster of standalone orphans.

### 1.1 Orphan ledger (audit result)

**Root cause — `sceneSource` was URL-only.** `App.tsx` held `sceneSource` as a
value-only `useState(() => readSceneSourceFromUrl())` with **no setter anywhere
in `src/`**. The entire `artifact-replay` lane — the MODQN pipeline **flowchart**,
the Plane-C `AlgorithmDashboard`, the satellite azimuth compass, the real-artifact
Director cinematic, the UE display-count / focus controls, the artifact sidebars —
was reachable **only** via `?sceneSource=artifact-replay`. The `modqn-replay-proof`
lane was three sidebar clicks deep.

**Standalone true orphans (built, zero mounts):**
- `AppModeRail` — purpose-built SINR/MODQN nav, fully styled + accessible, never mounted (superseded by the new `LaneExperienceBar`).
- `ModqnObjectiveTab` — the **only** runtime ω-weight EDIT surface (3 sliders + apply + reset). The ω engine path stayed live but the UI could no longer change it.
- `omega-heuristic` handover mode + `HeuristicNotPaperBanner` — the heuristic ω-scoring policy was live in the engine, but its UI entry and its mandatory "NOT paper MODQN" disclosure banner had been stripped.
- `LiveKpiStrip` — serving/handover/policy KPI strip.
- `HyperparamChip` + `NetworkParamInput` — built Tier-2 hyperparameter UI.

**Deep but reachable:** the SINR↔MODQN switch (buried + mislabeled in ControlBar,
the only `appMode` entry), MODQN visual presets (2 steps), the proof toggle
(3 steps), the Director focus buttons (1 sidebar-tab deep; inter silently disabled
on the 0-inter baseline).

**Dead registry / fragile code:** the `'objective'` left tab (no render branch),
the unused `getRightSidebarTabsForMode` MODQN branch, the catch-all `else`, the
dead `onDismissAutoSlow` ControlBar prop.

## 2. User direction

Not a minimal nav. The user wanted **every built feature surfaced first for an
in-browser inventory**, then a later consolidation pass that makes many features
**default-on** rather than a toggle-per-feature ("不要一堆切換鈕"). Nav form
chosen: a **top segmented "Experience" bar**. Dead code: cleaned in this PR.

## 3. Design

### 3.1 Lane Experience Switcher (S1, keystone)

`src/ui/LaneExperienceBar.tsx` — one top segmented control over the four scene
lanes: **SINR Live / MODQN Live / MODQN Proof / Artifact Showcase**. Its value is
the resolved `SceneLane`; `App.handleExperienceChange` maps a segment back to the
combination of `sceneSource` + `appMode` + `modqnReplayProofRequested`.

`sceneSource` is now runtime state. The transition is **governance-safe**, not a
naive setter (see `docs/frontend-render-governance.md` "Lane Experience Switcher"):
- cancels any armed/active Director focus on every switch (no cross-lane sat-pair leak);
- tears down stale artifact-replay state on leave so a re-entry re-fetches and the FIX-1 honesty badge cannot show stale provenance;
- the artifact fetch effect gained a `cancelled` guard so an in-flight 46 MB fetch can't repopulate after the user left the lane (codex S1 [P2]);
- re-keys the lane through existing `sceneSource`-dependent effects (fails closed while the artifact streams);
- `syncSceneSourceToUrl` keeps the lane deep-linkable / reload-stable (display-only).

### 3.2 Per-lane default exposure (S2–S5)

No per-feature toggles — orphans are **default-mounted** within their lane:

| Lane | Default-exposed |
|---|---|
| SINR Live | `LiveKpiStrip` (live-status tab) |
| MODQN Live | revived **`objective` tab → ω-weight editor**; **MODQN evidence tab** co-visible on the right rail (opt-in, `live` stays default); `LiveKpiStrip`; "MODQN layers:" preset heading; **decision-policy toggle** (paper overlay ↔ heuristic ω) |
| MODQN Proof | top-level segment (was 3 clicks deep) |
| Artifact Showcase | flowchart + Plane-C dashboard + compass + cinematic (all auto-mount on the lane) |
| Cross-lane | Director focus buttons gained disabled-reason tooltips; `omega-heuristic` surfaced WITH the mandatory `HeuristicNotPaperBanner`; Tier-2 chips in a training-tab "Tier-2 preview" section |

### 3.3 Governance treatment

- `omega-heuristic` is NOT a 3rd top-level handover mode; it is a contained
  decision-policy toggle on the MODQN live lane. App co-mounts
  `HeuristicNotPaperBanner` gated on `handoverMode==='omega-heuristic' &&
  sceneLane==='modqn-live-cell-preview'` — the disclosure is mandatory and the
  live heuristic warning never leaks onto the producer artifact / other lanes
  (codex S2–S6 [P2]). It stays non-persistable.
- The MODQN-live right rail now offers `live` (default) + opt-in `modqn` evidence;
  lane matrix + `validate:frontend:scene-lane-governance` updated.
- Tier-2 preview is honest: chips locked ("requires retrain"), input disabled,
  header states it is not wired to the trainer.

## 4. Slices shipped

| Slice | Commit | Summary |
|---|---|---|
| S1 | `4e56e0a` | LaneExperienceBar + runtime `sceneSource` switch + governance-safe transition + fetch cancel-guard |
| S2+S3 | `0013bc4` | Director-focus tooltips; revive ω-objective tab; evidence co-visible; LiveKpiStrip; preset heading |
| S4 | `4b68a4c` | omega-heuristic decision-policy toggle + mandatory banner; revived `validate:modqn:omega-s4` |
| S5 | `3134c74` | Tier-2 hyperparameter preview section |
| S6 | `99d58d2` | remove dead `onDismissAutoSlow` prop; explicit left-tab else |
| fix | `5ed4074` | gate NOT-paper banner to the modqn-live lane (codex [P2]) |

## 5. Validators

- New `validate:phase-c:lane-experience-bar:browser` — all 4 lanes navigate in-app, artifact dock mounts + tears down, FIX-1 attr stamped, 0 page errors.
- Revived + wired `validate:modqn:omega-s4-heuristic-not-paper` (37/37) — banner co-mount + non-persist + no shortcut/URL entry.
- `validate:frontend:scene-lane-governance` extended (Rule#9) for: the LaneExperienceBar single lane-owned no-3D mount + safe transition; the MODQN-live left/right tab sets; the ω editor; the decision-policy toggle + gated banner; the Tier-2 preview.
- No regression: director-cinematic + compass on REAL producer artifact, phase-3 contention/overlay on the live modqn-cell engine, camera-preset 92/0, app-wire 41/0.

## 6. Deferred (later consolidation pass)

The user's stated next phase: after the in-browser inventory, **consolidate** —
make chosen features default-on, prune the rest. Not done here:
- The ControlBar handover-mode group is now redundant with the LaneExperienceBar (kept during inventory; remove in consolidation).
- Dual-source `HANDOVER_MODE_STORAGE_KEY` (handoverMode re-derived from `APP_MODE_STORAGE_KEY` at init) — pre-existing, left for consolidation.
- Scene-topology overrides silently no-op outside `sinr-experiment` — add a hint or disable the editor off-lane.
- Decide keep/delete on the now-visible orphans (LiveKpiStrip vs InfoPanel overlap; Tier-2; omega-heuristic).
