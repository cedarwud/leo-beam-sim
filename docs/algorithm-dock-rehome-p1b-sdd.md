# Mini-SDD — Algorithm Dock Re-home + P1b Live Telemetry

> **Status:** DESIGN / IMPLEMENTATION AUTHORITY for Track-1 (authored 2026-06-03, Opus=architect).
> **Extends:** `docs/showcase-master-sdd-v2.md` §1.1 (2D flowchart as first-class showcase element), §3 (truth planes A/C), §7 (G1–G4), §3.5 (INV-1/2/3). Phase-1 row of the v2 roadmap (P1b live overlay + the dashboard structural re-home agreed in `project_showcase_master_sdd_v2` AGREED SEQUENCING).
> **User decision (2026-06-03):** dashboard re-home form = **bottom landscape dock, co-visible with 3D, collapsible** (chosen over full-overlay focus-mode and wide-right-region).

## 1. Why

The `AlgorithmDashboard` + 2D `AlgorithmFlowchart` are crammed into the ~300–380px `leo-shell-right` artifact-truth sidebar (`App.tsx:1964`, width `--leo-right-drawer-width` `main.scss:55`). The flowchart is an 8-node **left→right pipeline** (`state→qnet→ω→mask→select→serving→handover/reward`) — it wants landscape width, not a narrow vertical column → currently unreadable (memory "DASHBOARD LAYOUT DEBT"). v2 §1.1 wants the flowchart as a **first-class** showcase element.

This phase does two coupled things:
1. **Structural re-home (R1):** relocate the dashboard to a full-app-width collapsible bottom **dock**, co-visible with the 3D scene, so the 3D handover and the pipeline edge-pulse / reward update are visible *simultaneously* = the project's core "absolute MODQN integration proof, not hardcoded animation" story.
2. **P1b live telemetry (P1–P4):** feed the dock with Plane-A live SSE on live lanes (episode-coarse reward means + INV-2 staleness), keeping Plane-C on artifact-replay, INV-1 tagging each tile's plane.

"Where it lives" (this phase) = architecture. "How it looks" (cosmetic typography/spacing/color) = batched to the final holistic `/impeccable` pass.

## 2. Structure (the dock)

`leo-app-shell` is a flex **column**: `[ banner?, ControlBar, leo-shell-row (flex:1 1 auto, grid 3-col) ]` (`main.scss:53-90`, `App.tsx:1743/1803`). The dock is added as the **last flex child of `leo-app-shell`**, after the `leo-shell-row` closing `</div>` (`App.tsx:2051`):

```
leo-app-shell (flex column)
  ├─ (modqn bundle banner, conditional)
  ├─ ControlBar
  ├─ leo-shell-row     flex:1 1 auto   ← left | canvas(3D+TimelineBar) | right ; yields height
  └─ AlgorithmDock     flex:0 0 auto   ← NEW: full app width, collapsible bottom row
```

- Full app width (minus the 12px shell padding) ⇒ flowchart pipeline gets the whole window width.
- `leo-shell-row` keeps `flex:1 1 auto`, so the dock's fixed/clamped height shrinks the 3D row deterministically — **no overlap, no z-index war, no occlusion** (unlike an absolute dock). TimelineBar (z-82, absolute inside `leo-shell-canvas`) stays anchored to the canvas, above the 3D, untouched.
- Collapsed = thin header bar only (title + toggle); expanded = `clamp(180px, 24vh, 280px)`. Collapse state is UI-only `useState` (allowed; not truth).
- No z-index needed (it is a normal flex row, not an overlay).

### 2.1 Internal landscape layout

Inside the dock body:
- **Row 1:** `AlgorithmFlowchart` as a full-width horizontal pipeline strip (it is already a static SVG left→right; just give it width).
- **Row 2:** dashboard metric tiles (`reward scalar+components`, `ω weights`, `top-K action`, `serving`, `handover`, `SINR/throughput`) in a horizontal flex-wrap card row, each with its INV-1 provenance chip.

R1 does *enough* layout to make it landscape-legible; fine cosmetic (typography, spacing, palette) is deferred to the final pass.

## 3. Slice plan

### R1 — Bottom dock re-home (structural; NO data/plane change)

New `src/showcase/dashboard/AlgorithmDock.tsx` — collapsible landscape container, `data-testid="algorithm-dock"`, header (title + collapse toggle `data-testid="algorithm-dock-toggle"`), wraps the **unchanged** `AlgorithmDashboard`. New `src/styles/_algorithm-dock.scss` (`@use './algorithm-dock'` after `main.scss:7`).

- `App.tsx`: mount `<AlgorithmDock>` as the last child of `leo-app-shell` (after `:2051`), gated `sceneSource === 'artifact-replay'` (**same gate as today — do NOT expand lanes in R1**). Remove the `<AlgorithmDashboard>` mount from the `artifact-truth-sidebar` branch (`:1964-1970`). The sidebar 'artifact' tab keeps `ClaimBoundaryBanner` + `handoverEventRail` + source-summary (those are not the dashboard).
- Pass-through props unchanged: `artifact`, `frameIndex`, `currentTimeSecRef`.
- **Validator** `scripts/validate-frontend-scene-lane-governance.ts`: rewrite the location block (`:389-419`) to assert: `<AlgorithmDashboard` mounted exactly once **inside** `data-testid="algorithm-dock"`, gated by `sceneSource === 'artifact-replay'`. Keep `:421-451` (import-clean / provenance chip / `source gap - not shown`) verbatim. Drop the `artifact-truth-source-summary` co-location assertion (`:414-418`) — replace with co-location with the dock title/testid.
- **Governance doc** `docs/frontend-render-governance.md`: update Rule#9 lane note — AlgorithmDashboard now lives in the bottom `AlgorithmDock`, still artifact-replay-gated, import-clean, no `<Canvas>`, co-visible with the 3D via a grid/flex row (no occlusion).
- **Browser smoke** `scripts/validate-phase-d-dashboard-browser.ts`: update selectors (dashboard is now in the dock, not the sidebar tab); assert dock visible + collapse toggle works + nodes/edges/chips/raf-pulse/no-console-errors still pass.

Verify: tsc 0, `validate:frontend:scene-lane-governance`, `validate:phase-d:flowchart-scaffold`, `validate:phase-d:reward-curve`, build, `validate:phase-d:dashboard:browser`.

### P1 — Live telemetry store + INV-2 staleness (pure + store)

New `src/showcase/dashboard/liveTelemetryStore.ts` — a `useSyncExternalStore`-backed module store (v2 §3.4; **not** Zustand) holding, per active job: latest `TrainingProgressEvent`, `lastProgressMs`, `lastHeartbeatMs`. JobsPanel (`JobsPanel.tsx:270-272`, already the single `EventSource` owner) **pushes** each parsed event into the store on `onmessage` — **no second EventSource opened** (avoids double-stream). Pure `resolveTelemetryStatus(lastProgressMs, lastHeartbeatMs, nowMs, jobStatus)` → `'live' | 'stalled' | 'offline'` (INV-2: `running` + heartbeat fresh but no `progress` for N s ⇒ `stalled`; heartbeat loss > 3 s ⇒ `offline`). Tests for the pure resolver (boundary cases). No UI yet.

### P2 — Dock live-lane binding + INV-1 plane tag + fail-closed

Dock consumes the live store on live lanes (`sinr-live` / `modqn-live-cell-preview`); renders Plane-A tiles (`scalarReward`, `r1/r2/r3Mean`, `totalHandovers`, episode progress) **INV-1-tagged "live training"**; keeps Plane-C tiles on `artifact-replay`. Hard producer gaps (loss / Pareto / qValues / LR) render as **source-gap** tiles ("requires producer change"), per INV-3. INV-2 `stalled` ⇒ freeze-grey tiles; `offline` ⇒ degraded badge. Extend the dock visibility gate + the lane-governance validator location assertion to allow live lanes (Rule#9). Bounded re-renders (G4: no per-frame React state; store updates are episode-coarse, not 60 Hz).

### P3 — Live evolving reward curve (**G-A producer gate — CROSS-REPO, ASK USER FIRST**)

The mid-run live reward *curve* needs the producer (`modqn-paper-reproduction` trainer) to print one **JSON progress line per episode** so the existing parser branch (`progress_events.py`) consumes it with **zero consumer change** (verified in Phase-0 plane scoping). G-A is authorized-in-principle but is a cross-repo edit → **confirm with the user before touching `modqn-paper-reproduction`** (session rule). Until G-A lands, the live reward-curve tile = source-gap ("evolving curve requires producer change"). Consumer side: store accumulates `metrics.scalarReward` per episode into an array; `MiniRewardCurve` renders it (Plane-A, live).

### P4 — `validate:phase-d:live-telemetry` + browser smoke

New validator (v2 §6 Phase-1b row): fail-closed badge + INV-2 staleness transitions (live→stalled→offline) + INV-1 plane tags + bounded React re-renders under a synthetic 60 Hz SSE burst. Browser smoke: route-fed synthetic SSE → dock shows live tiles → stalled freeze → offline badge → zero console errors.

## 4. Governance (binding)

- **Rule#1 (one viewport one authoritative scene lane):** the dock is a **2D non-Canvas surface**, not a scene lane → does not contend for viewport proof ownership. It imports no `three`/`scene/`/`viz/` symbols and mounts no `<Canvas>` (G3, validator `:446-451`). Co-visibility with the 3D is a layout row, not a second proof lane.
- **G1 (no fake motion/state):** flowchart edge pulses bind only to real Plane-A/C event ids; unbound edges stay idle (already enforced by `validate:phase-d:flowchart-scaffold`; `reward→qnet` permanently non-animatable).
- **INV-1:** every tile declares its plane; a Plane-C envelope must never back a "live training" tile and vice-versa (validator provenance chip `:421-429`).
- **INV-2 / INV-3:** staleness ≠ disconnect (freeze-grey vs offline); absent producer channels ⇒ source-gap, never fabricated.
- **G4:** no per-frame React state; live store updates are episode-coarse; flowchart pulse stays ref/rAF/CSS-driven.
- **Rule#9:** every slice that changes the dock's mount/lane updates `frontend-render-governance.md` + the lane-governance validator before it ships.

## 5. Proven loop

Per `project_showcase_master_sdd_v2`: codex exec writes → main-thread re-verify (tsc + named validators + browser smoke) → `codex review --base main` gate → Opus fixes findings + re-verify → ff-merge → push. Validator/pure slices Opus-direct. R1 first; P3 pauses for the G-A cross-repo confirmation.
