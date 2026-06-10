# ADR-002: Decouple the Navigation Surface from Scene-Lane Authority

## Status

Superseded by [../modqn-tab-consolidation-plan.md](../modqn-tab-consolidation-plan.md).
This ADR preserves the keystone rule that navigation surface and `SceneLane`
authority are not required to be 1:1, but its 3-story selector and ControlBar
inventory were superseded by the later 2-tab MODQN consolidation and D1/S5a
Advanced-drawer cleanup.

## Date

2026-06-06

## Context

The showcase-navigation exposure campaign (S1–S7, then C1, C3) made every built
feature reachable in-app. The user then inventoried the result in-browser and
asked for the opposite force: **fewer buttons, intuitive, zero learning** ("少按鈕、
直覺、零學習"), with many features becoming default-on instead of toggle-per-feature.

The top-level control surface at the time of the 2026-06-06 survey (see
`docs/showcase-navigation-exposure-sdd.md` and the 2026-06-06 survey):

- `LaneExperienceBar` — **4 segments**: SINR Live / MODQN Live / MODQN Proof /
  Artifact Showcase (`src/ui/LaneExperienceBar.tsx:23-28`).
- `ViewModeToggle` — Scene / Dashboard (`src/ui/ViewModeToggle.tsx`).
- `ControlBar` — UI-mode dropdown (all lanes) + SINR presentation group
  (sinr-live only) + MODQN visual-layer presets + MODQN decision-policy toggle
  (modqn-live only) + Active-UEs filter (artifact only). This is historical:
  D1/S5a later moved MODQN visual-layer controls and the live-cell
  decision-policy toggle into `AdvancedSetupDrawer`.
  (`src/ui/ControlBar.tsx:104-279`).
- `DirectorControls` (Intra/Inter/Exit cinematic) above the bottom `TimelineBar`.
- Per-lane left/right sidebar tab sets (`src/app/appRuntimeModel.ts:42-74`).

### The governance tension

Option A as originally framed — "4 lanes → 3, MODQN Proof becomes a *see
evidence* toggle inside MODQN" — reads as a **Rule#4 violation**.
`docs/frontend-render-governance.md` Rule#4 (line 34): *"MODQN live cell preview
and MODQN replay proof are separate lanes."* The survey's governance auditor
flagged a literal lane-merge as **outright forbidden**: it would delete a lane
matrix row (Rule#9), collapse `resolveSceneLaneRenderPlan` from 4 cases to 3,
rewrite per-lane sidebar routing, and force `modqn-replay-source-backed` and
`profile-derived-demo` handover-story policies to coexist in one lane (semantics
drift). All four reviewers independently surfaced this.

### The resolving observation

Rule#4 constrains the **`SceneLane` enum** (the viewport-proof authority), not
the **navigation surface** (the buttons). Today they are accidentally 1:1, so
"3 buttons" was read as "3 lanes". They are separable:

- `SceneLane` stays **4** — `sinr-live`, `modqn-live-cell-preview`,
  `modqn-replay-proof`, `artifact-replay`. Render-plan authority, lane matrix,
  and every per-lane validator assertion on the *enum* are untouched. Rule#4 and
  ADR-001 hold verbatim.
- The nav surface presents **3** primary stories. `modqn-replay-proof` is
  reached by a Proof/Evidence toggle *within the MODQN story*, exactly the
  mechanism that already exists (`modqnReplayProofRequested`, set by
  `ModqnReplayCuePanel`, `App.tsx:1958`). S1 *added* the 4th top-level segment
  for the inventory pass; the consolidation removes that segment and relies on
  (and promotes) the still-present in-MODQN toggle.

This is the keystone decision. Everything else (advanced drawer, sidebar
purpose-merge, camera/director co-location) is subordinate and independently
scoped below.

## Decision

### D1 — Navigation surface is a 3-story selector; SceneLane authority stays 4 (keystone)

`LaneExperienceBar` becomes a 3-segment story selector:

| Nav segment | Resolves to SceneLane | Notes |
|---|---|---|
| **SINR Live** | `sinr-live` | unchanged |
| **MODQN** | `modqn-live-cell-preview` (default) **or** `modqn-replay-proof` (when Proof on) | one story, two lanes via the Proof toggle |
| **Showcase Replay** | `artifact-replay` | renamed from "Artifact Showcase" for plainness |

- `modqnReplayProofRequested` remains the *only* gate to the
  `modqn-replay-proof` enum value (`src/app/sceneLane.ts:18`); the lane resolver,
  render plan, and lane matrix are unchanged → **Rule#4 preserved**.
- The Proof entry is promoted to a clearly-labeled "See the evidence (proof
  viewport)" affordance in the MODQN context. It is already the first element of
  the default MODQN left tab (`replay`), so it is ≤1 click. It stays gated by
  `canToggleModqnReplayProof` (live-sim + modqn-demo + decision-overlay), and the
  governance-safe transition (`handleExperienceChange`, `App.tsx:1630-1664`:
  Director-focus cancel, artifact teardown, fail-closed re-key) is preserved.
- When Proof is on (`modqn-replay-proof`), the Scene/Dashboard toggle and
  Director cinematic stay disabled exactly as today (Rule#8 inert proof lane).
- The governance doc's "Lane Experience Switcher" section is rewritten to state
  explicitly: **nav surface = 3 stories, SceneLane authority = 4 lanes, the map
  between them is non-injective by design.** `validate:frontend:scene-lane-governance`
  and `validate:modqn:omega-s3-replay-mode-wiring` are updated: the
  `LANE_EXPERIENCE_OPTIONS`-count assertion moves from 4→3, and a new assertion
  locks "3 nav segments map onto 4 lanes; `modqn-replay-proof` reachable only via
  the in-MODQN Proof toggle, never a top segment."

### D2 — Advanced drawer for power-user toggles (the former "C2")

UI-mode (Presentation/Tuning/Diagnostics) and the MODQN decision-policy toggle
(paper overlay ↔ heuristic ω) move from the top `ControlBar` into a collapsible
**Advanced ⚙** drawer. Constraints:

- The **`HeuristicNotPaperBanner` does NOT move** — it stays the mandatory,
  non-dismissable disclosure at `App.tsx:2000`, gated by `handoverMode ===
  'omega-heuristic' && sceneLane === 'modqn-live-cell-preview'`
  (`docs/modqn-omega-handover-sdd.md` §4.4). Only the *toggle* relocates.
- To prevent a disclosure/control split, when `omega-heuristic` is active the
  drawer auto-expands (or the banner carries an inline "switch back to paper"
  action). Heuristic ω stays non-persistable and on-screen-only.
- UI-mode keeps driving `ModqnSceneHud` visibility (`uiMode !== 'presentation'`)
  and `effectiveCinematicMode`; only its DOM location changes.
- The `?modqnReplayProofRequested` / UI-mode persistence and deep-link paths are
  preserved; drawer open/closed is local UI state, not truth.

### D3 — Sidebar tabs merged by purpose (heavier; recommend deferring to a follow-up)

SINR `signal`+`handover` → **Tuning**; MODQN `training`+`jobs`+`objective(ω)` →
**Setup**; MODQN `replay` → **Now**. This needs a compound/section tab UX
(`SidebarTabShell` currently assumes a flat `LeftSidebarTab[]` union), an
`appRuntimeModel.ts` rewrite, and the validator's per-lane tab-set assertions
(`scripts/validate-frontend-scene-lane-governance.ts:175-244`) rewritten. It does
**not** touch the SceneLane enum or Rule#4. Highest effort / highest validator
churn → scoped as a separate later slice, not part of the keystone.

### D4 — Camera preset + Director co-location (optional; tightly scoped)

Co-locate the SINR camera presets and the Director focus buttons into one
"Camera / Cinematic" group, and fix the existing papercut where exiting Director
focus resets the camera to `manual` and loses the active preset
(`MainScene.tsx:1033-1041`). This is a **UI co-location + one bug fix**, NOT a
camera-FSM rewrite and NOT extending presets to MODQN lanes (that would be a new
surface). `showDirectorFocus` lane-gating (Rule#8, replay-proof inert) is
unchanged. Optional; defer unless explicitly wanted.

## Alternatives Considered

### Literally merge `modqn-replay-proof` into `modqn-live-cell-preview`

Rejected. Direct Rule#4 violation; deletes a lane matrix row (Rule#9); forces
incompatible handover-story/timeline-authority policies to coexist; ~79
validator assertions on the 4-lane enum would need rework. D1 achieves the same
user-visible "3 buttons" with zero enum change.

### Keep 4 top-level segments, just restyle

Rejected. Does not address "fewer buttons / zero learning"; the 4th
(Proof) segment is the least self-explanatory and duplicates an existing in-MODQN
toggle.

### Hide Proof entirely (live demo only)

Rejected. The producer evidence/proof lane is a real showcase asset; it should be
reachable, just not as a co-equal top story. Folding it under MODQN matches the
mental model ("MODQN, and here's the evidence").

### Do the full Option A (D1–D4) in one PR

Rejected. D3 (sidebar) and D4 (camera) carry the most validator churn and UX
risk. Ship the keystone (D1) + safe drawer (D2) first, re-inventory, then decide
D3/D4. Matches the repo's one-concern-per-slice rule and the
`feedback_continuous_dev_no_mid_merge` cadence.

## Consequences

- Top bar drops from 4 story buttons to 3; the least-clear button (Proof)
  becomes a contextual MODQN affordance.
- `SceneLane`, `sceneLaneRenderPlan`, the lane matrix, ADR-001, and all enum-level
  validators are unchanged — Rule#4/#8 hold verbatim.
- The control bar sheds two always-visible toggles into Advanced ⚙; the
  mandatory heuristic disclosure remains prominent.
- A new governance concept is introduced and must be documented + validated:
  **navigation surface ≠ scene-lane authority** (non-injective nav→lane map).
- Deep links (`?sceneSource`, `?view`, `?modqnReplayProofRequested`) keep working.
- D3/D4 remain available as scoped follow-ups without blocking the keystone.

## Validation

- `validate:frontend:scene-lane-governance` — update the
  `LANE_EXPERIENCE_OPTIONS` count (4→3) and add the nav≠lane non-injective-map
  assertion; keep every enum-level lane/sidebar/render-plan assertion green.
- `validate:modqn:omega-s3-replay-mode-wiring` — update for the 3-segment bar +
  in-MODQN Proof toggle as the sole `modqn-replay-proof` entry.
- `validate:modqn:omega-s4-heuristic-not-paper` — must still pass with the toggle
  in the Advanced drawer and the banner unmoved (disclosure mandatory).
- `validate:phase-c:lane-experience-bar:browser` — re-point to 3 segments;
  assert all 4 lanes still reachable (Proof via the in-MODQN toggle).
- No-regression browser gates (real producer artifact): director-cinematic,
  artifact satellite compass, phase-3 contention/overlay, camera-preset,
  app-wire.
- Browser smoke: 3-segment nav reaches all 4 lanes; Advanced drawer opens/closes;
  omega-heuristic shows the banner with the toggle in the drawer; Proof toggle
  enters/leaves `modqn-replay-proof` and disables Scene/Dashboard + Director.

## Slice plan (for the chosen scope)

| Slice | Scope | Risk | Governance/validator work |
|---|---|---|---|
| **A1** | D1 nav 4→3 + promote in-MODQN Proof toggle | low | governance "Lane Experience Switcher" rewrite; lane-experience-bar + omega-s3 validators; nav≠lane assertion |
| **A2** | D2 Advanced ⚙ drawer (UI-mode + decision-policy) | low–med | omega-s4 banner-unmoved assertion; drawer auto-expand-on-heuristic |
| **A3** | D3 sidebar purpose-merge (Tuning/Setup/Now) | high | `appRuntimeModel` + `SidebarTabShell` rework; tab-set validator rewrite |
| **A4** | D4 camera/director co-location + restore-preset fix | med | camera-preset validator extension |

Recommended first cut: **A1 + A2** (biggest "fewer buttons" win, lowest risk),
re-inventory, then decide A3/A4.
