# SINR-live Right-Sidebar OLD-Tuning Restore + Beam-Duel / Hex / Controls — mini-SDD

> Status: DRAFT for a fresh dev conversation. Authored 2026-06-20 after a multi-workflow
> audit. Supersedes nothing; additive restore of UI that the steered→cell-cone migration
> orphaned. Companion memory: `.agent-memory/project_right_sidebar_oldtuning_restore_2026-06-20.md`
> + `.agent-memory/project_beam_grid_data_driven_audit_2026-06-20.md`.

---

## §0. Operating conditions — INHERIT these into the new conversation

This SDD is written to be handed to a new session. That session MUST operate under the
same conditions as the originating one:

1. **Role.** leo-beam-sim FRONTEND dev = the MODQN visual-showcase CONSUMER / final renderer.
   Reply in **Traditional Chinese (繁體中文)**, every turn. effort high.
2. **CHECK before act.** Read existing architecture + align with producer env state before
   editing. Don't rewrite rigor-critical truth locally (vendor/validate from `ntn-sim-core`).
3. **Required reads at start:** this repo `CLAUDE.md` / `AGENTS.md` / `.agent-memory/MEMORY.md`
   + every matching `feedback_*`/`project_*` entry; `docs/frontend-change-contract.md` (BEFORE
   any `scene/`,`viz/`,`ui/`,`app/`,render-plan edit); `docs/frontend-render-governance.md`;
   `docs/governance-lock-strategy.md`.
4. **Producer status (grounded 2026-06-20, internalise — DON'T hardcode floating params).**
   Producer (`modqn-paper-reproduction`) env is NOT finalised (Stage-1 collapse diagnosis,
   R0/R1/R2 rungs). **STABLE** = physics core (SINR Eq.1, link-budget, cell/beam model,
   hex grid, reuse-3, off-axis ITU-R S.1528, **altitude h=780km**, V=7). **FLOATING** =
   constellation (Walker-180=180/9/1 + toy variants), planes, scale, hard cap k_cap=3,
   reward mode, demand. Treat any "final env" as HYPOTHESIS. Don't use family_b as a showcase
   (it's the collapse battleground). cell-radius is DERIVED `r = altitude·tan(θ3dB/2)`; beam
   count = `L_W × 7`. Producer repo = READ-ONLY.
5. **All work in this SDD is DISPLAY-ONLY / sinr-live-lane-scoped.** It must not alter SINR,
   handover events, serving decisions, rewards, geometry truth, evidence/provenance. Display
   knobs live in `src/scene/beamDisplaySpec.ts` / style tokens; truth stays in the engine +
   cell model. The one exception that touches a truth-source FILE (comparison, W7) only
   SURFACES an already-computed value — it adds no physics — and is gated by a deliberate
   `s0:geometry-trace` golden rebase that must prove serving/SINR truth is byte-identical.
6. **ENV.** vite ALWAYS on port **3000** (kill others by-port-pid, never `pkill -f` broad).
   Screenshot before AND after every visual change (repo rule #1 — never iterate blind).
   Throwaway harnesses: `scripts/_shot-url.ts` (env `SHOT_URL` + optional `SHOT_LS_KEY`/`SHOT_LS_VAL`
   to set localStorage), `scripts/_shot-sinr-live.ts` (`APP_URL`=localhost:3000). Crop with
   python PIL for legibility. Old reference UI was served by the user at
   `http://120.126.151.102:3000` (commit-switchable; treat its live measurements as unreliable
   — use the repo's git history as source of truth instead).
7. **Gates.** Pre-commit `validate:governance` (~16s). Before handoff/PR `validate:governance:full`
   + `validate:static:all`. Before declaring render work done `validate:ready` (browser visual,
   needs vite + APP_URL). One concern per commit. DELETE-not-park. Comments must not lie. Do NOT
   normalise `git commit --no-verify`.

---

## §1. Goal

Restore the sinr-live scene + right sidebar toward commit **49db65d** (2026-05-08, the oldest
"good" reference, 0 console errors) and **ab861c4** (2026-05-21) — the look/behaviour the user
endorsed. Method = **use the OLD code as reference to REWRITE the current code, wired to the
CURRENT earth-fixed cell-cone data** (NOT `git restore`/`git revert`; the steered-beam path the
old code rode is retired). Reference commits had: clean BEAM-DUEL right sidebar (serving vs
contender + decision), SINR FORMULA TERMS, a double-layer hex cell render, and working
Beam-Info / HO-Slow / Spotlight controls.

---

## §2. Current state (already DONE this session — UNCOMMITTED on `main` working tree)

The OLD-tuning right-sidebar shell is already restored (screenshot-verified, tsc 0 errors,
NOT committed). Changes:

- `src/App.tsx` live tab: removed `handoverEventRail` (intra/inter timeline + Focus/jog
  buttons — non-functional, user will rebuild later); added `showFormulaTerms` to `<InfoPanel>`;
  removed the live `<ClaimBoundaryBanner>` (the modqn-tab one at ~1968 stays); removed the now
  orphan `LIVE_SIM_CLAIM_BOUNDARY_INPUT` import.
- `src/ui/InfoPanel.tsx`: removed SIGNAL PROFILE + HANDOVER MODE cards + `profileId`/
  `formulaFamilyLabel` destructure + the `contextDetail` duel prose.
- `src/styles/main.scss`: duel container-query breakpoint **380→260px** (serving|comparison
  now side-by-side; the `.leo-duel-card` content-box is ~273px); `--leo-left-drawer-width: 520px`
  + `--leo-right-drawer-width: 460px` (match OLD); scoped
  `.leo-shell-right .leo-sidebar-tab-panel, .leo-shell-right .leo-live-status-stack { scrollbar-gutter: auto }`
  (fixed the right black strip = two stacked 15px scrollbar gutters).
- `src/ui/SinrLiveQuickControls.tsx`: un-gated the Spotlight checkbox (removed the
  `LIVE_CINEMATIC_CAMERA_ENABLED` gate + import). Spotlight EFFECT (scene fog + dim + target
  point-lights, in `BaseSceneLayout`) is flag-independent; the parked camera stays parked.

**⚠️ Governance debt these created (must clear in Step 0 before commit):**
- `scripts/validate-modqn-omega-s3-replay-mode-wiring.tsx:489` source-pins
  `'live-status-handover-mode'` — removed with the HANDOVER MODE card → repoint or retire.
- `scripts/validate-hobs-tr38811-phase2-browser.ts:194-195,288-323` reads `'SIGNAL PROFILE'`
  to assert formula-family display — removed → repoint (read family from the LEFT tuning panel /
  selector) or retire. (Orphan: no npm script references it; not in any aggregate — confirm.)
- 3 browser cinema/focus gates drove the removed `DirectorControls`/`HandoverEventRail` buttons:
  `validate-phase-c-handover-cinema-browser.ts`, `validate-live-walker-handover-event-focus.tsx`,
  `validate-phase-c-director-cinematic-browser.ts` (last one was already a pre-existing fail).
  → retire/quarantine with a dated note (the features are removed; user will rebuild later).

---

## §3. The BEAM DUEL design intent (confirmed — restore, don't replace)

`InfoPanel` → `DuelCard` = a "why did/will the handover happen" explainer:
- LEFT `DuelSignalColumn` = **ACTIVE SERVING** (current serving link: identity, SINR, El, Range).
- RIGHT `DuelSignalColumn` = the **CONTENDER**, dynamic role (`panelComparison.role`,
  `InfoPanel.tsx`): `pending`→"PENDING TARGET", `ho-target`→"HO TARGET", `candidate`→
  "BEST CANDIDATE", else "COMPARISON".
- MIDDLE/below `DuelDecisionColumn` = **Δ SINR (serving − contender), Need Offset (hysteresis
  margin), Trigger Time (time-to-trigger)** = the switch logic.

This is exactly the user's intent ("the other column should hold the beam about to be handed
over to, so you can compare why it switches"). **The design is correct.** It is blank on the
cell lane only because the contender is computed-then-discarded (see W7). Restore it; do not
redesign it away.

---

## §4. Work items

Each: symptom → root cause (file:line) → fix approach → files → risk → gates. All sinr-live-only,
display-only unless noted.

### W1 — P0a: Γ-result vs duel-SINR label disambiguation (LOW)
- **Symptom:** FORMULA TERMS `Γ RESULT` (e.g. −3.2 dB) ≠ BEAM DUEL serving SINR (e.g. −6.1 dB),
  both labelled "serving SINR" → looks like a bug.
- **Root cause (NOT a bug):** two physical models, both live per-frame. Duel serving =
  cell-truth off-axis (50° steer / 33.5 dBi). Γ = steered `physicalServing` (12° / 40 dBi),
  deliberately not repointed (`useSimStatePublisher.ts:531-538`). Off-axis penalty ⇒
  −6.1 < −3.2 (physically consistent). `FormulaTermsReadout` source = `physicalServing`
  (`InfoPanel.tsx` `source={physicalServing}`).
- **Fix:** label only — mark the Γ/FORMULA-TERMS card as "steered diagnostic" and the duel
  serving as "cell-truth" (or a one-line caption clarifying the two surfaces). No data path
  change.
- **Files:** `src/ui/info-panel/FormulaTermsReadout.tsx`, `src/ui/info-panel/DuelCard.tsx` (copy).
- **Gates:** `validate:governance`. No golden impact.

### W2 — P0b: σ² noise colour + colour-token unification (LOW; P3 tail)
- **Symptom/root cause:** left formula-tab accents (`getFormulaTabAccent`,
  `src/ui/signal-tuning/tuningConfig.tsx:100-117`) and right term tiles
  (`src/ui/info-panel/FormulaTermsReadout.tsx:85-102`) are TWO independent colour maps. Only
  `G^R` shares a token. **σ² MISMATCH** (left `semantic.noise #8ebaff` / right `semantic.info
  #7ba7ff`); **G^T mismatch**; loss/interference are equal only by duplicated hardcoded hex
  (drift risk).
- **Fix P0b:** `FormulaTermsReadout.tsx` σ²/noise tone → `semantic.noise` (align left tab).
- **Fix P3 (tail, optional):** add `semantic.interference` + use `semantic.loss` token on the
  right; make G^T grouping match (or accept the right's signal/loss/interference grouping and
  document it). Single per-term colour authority.
- **Gates:** touches `viz/ui` colour → `validate:governance` incl. `beam:colour-match`. Confirm
  `beam:colour-match` scope (it locks serving cone↔UE marker colour, not these term tiles, but
  run it).

### W3 — HO Slow: restore the readout + Resume button (LOW)
- **Symptom:** HO Slow "seems to do nothing", can't tell it slowed, can't cancel.
- **Root cause (engine WORKS):** the steered `HandoverManager` (`useSimulation.ts:629`, ungated)
  still writes `pendingTargetSatId` (`runtimeFrameStep.ts:972-974`) + `intraHandoverEvent`
  (`:802-808`) → SimState; `autoSlowActive = pendingTargetSatId!==null || intraHandoverEvent!==null`
  (`usePlaybackControls.ts:37-39`) → `effectiveSpeed` drops 5x→1x and `MainScene speed=
  {playback.effectiveSpeed}` applies. Broken = FEEDBACK: the "Scene: Xx (HO Slow)" readout +
  the "Resume Normal Speed" button were deleted in `8e32c37` (2026-06-06) and never re-homed;
  `playback.dismissAutoSlow` (`usePlaybackControls.ts:51`) is orphaned.
- **Fix (restore-old-wired-to-current; no data re-wire):**
  - `src/ui/SinrLiveQuickControls.tsx`: add props `effectiveSpeed`, `autoSlowActive`,
    `autoSlowApplied`, `onDismissAutoSlow`; after the HO-Slow checkbox add (a) a status span
    `Scene: ${effectiveSpeed.toFixed(1)}x (HO Slow)/(HO Slow Off)` (alert colour when firing,
    via `data-auto-slow-applied`); (b) `{autoSlowApplied && <button onClick={onDismissAutoSlow}>
    Resume Normal Speed</button>}`. Testids `ho-slow-status` / `ho-slow-dismiss`. Styles in scss
    (not inline).
  - `src/App.tsx`: pass the 4 props at the `<SinrLiveQuickControls>` mount (un-orphans
    `dismissAutoSlow`). Only App change.
  - `usePlaybackControls.ts`: no change (fields already exported).
  - `src/styles/_sinr.scss` (or main.scss `.leo-sinr-quick-controls` family): readout/button
    classes (keep `_scss-equiv` multiset balanced).
- **Scope:** HO Slow is **GLOBAL** (the quick-controls row mounts ungated on every lane) — do
  NOT lane-gate the readout; show on SINR + MODQN-live. Do NOT re-add to ControlBar. Do NOT
  touch the TimelineBar preset highlight (governance-pinned to raw `speed`).
- **Gates:** `validate:governance`; extend the `validate-frontend-scene-lane-governance.ts`
  QUAR-S6-BUS pin group to pin `ho-slow-status`/Resume in `SinrLiveQuickControls` (atomic, Rule#9).
- **Caveat:** the single-UE steered manager's ACTUAL handover firing is intermittent (known,
  upstream, out of scope) — HO Slow fires when a real HO is pending; that cadence is a separate
  problem.

### W4 — Hex double-layer cell render (MEDIUM; user-loved)
- **Want (from 49db65d):** double-layer hexagon (outer + inner nested hex band), inner coloured
  by serving SATELLITE identity, and cells shown ONLY when served (no persistent background grid).
- **Old impl:** `src/viz/EarthFixedCells.tsx` `CellComponent` (intact, just unmounted since
  `f2a7bab` 2026-06-07). `createHexRingGeometry(outer,inner)` (`EarthFixedCells.tsx:197-220`);
  outer band `r*0.96..1.04` (sat-identity `satTintColor`), inner band `r*0.78..0.84`
  (`roleColor`, served/pending only); unserved cells = dim dashed line only.
- **The thing to REMOVE:** the persistent background grid `SinrLiveCellGrid` (added `f0adf3c`
  2026-06-18) — `src/scene/MainScene.tsx` mount (~1697-1702) + import (~41) + the
  `SinrLiveCellGrid`/`SinrLiveCellGridProps` export in `src/viz/SinrLiveCellFootprintRings.tsx`
  (~100-142). No validator pins it (2 days old). Keep `sinrLiveCellPlacementById` (cone resolver
  uses it).
- **Fix (Option A — recommended, no governance unlock):** upgrade `SinrLiveCellFootprintRings`
  from the single 6-seg `ringGeometry` to TWO nested hex bands per served item: outer band +
  inner band coloured by `item.color` (= `colorForServingBeam(satId,cellId)`, serving identity —
  the items at `src/viz/SinrLiveCellBeamCones.tsx:84-125` already carry `color`/`baseCenter`/
  `baseRadiusWorld`/`satId`/`cellId`). Port `createHexRingGeometry` into a shared helper. New
  band radius factors + Y-lifts in `src/constants/sinrLiveConeStyle.ts`.
- **Do NOT** re-mount `<EarthFixedCells>` (Option B) — `validate-frontend-scene-lane-governance.ts:2029-2033`
  forbids `<EarthFixedCells` in MainScene and pins `showEarthFixedCells:false`.
- **MUST keep:** the `SinrLiveCellFootprintRings` name + the `{showSinrLiveCellBeams && (` gate
  (`scene-lane-governance.ts:2808` pins the exact JSX); `validate-phase-i-s5b-cell-beam-cones.tsx:396-399`
  asserts MainScene includes `<SinrLiveCellFootprintRings` and not `AmbientFootprintRings rings=`.
- **Colour invariant:** inner hex MUST equal `colorForServingBeam(satId,cellId)` so the
  served UE dot + cone + inner hex share one hue (`beam:colour-match` pre-commit gate).
- **Gates:** `validate:governance` (incl colour-match) + `validate:ready` (browser render).

### W5 — Beam Info scene labels (MEDIUM)
- **Symptom:** the Beam Info checkbox toggles nothing.
- **Root cause:** the callout component `BeamCalloutContent` only ever mounted inside the RETIRED
  steered `SatelliteBeams`; the cell-cone lane never re-implemented callouts. The toggle
  (`beamCalloutsEnabled` → `showBeamCallouts = beamCalloutsEnabled && showLiveBeamCones`,
  `sceneLaneRenderPlan.ts:207`, true on the live lane) flips a flag with no renderer behind it.
  Broke `c8d211d` (2026-06-07) + `b64cd9a` (2026-06-14).
- **Fix (reimplement on cell cones — do NOT fake a steered `BeamTarget`):** new
  `src/viz/SinrLiveCellBeamCallouts.tsx`, dumb, mirroring `SinrLiveCellFootprintRings`. Props =
  `items: SinrLiveCellBeamConeRenderItem[]`, `servingSinrByCellId`, `primaryServingSatId/CellId`,
  `widthScale`, `telemetryCountDatasetKey`. Per item a drei `<Html>` 3-line chip: SAT line
  (coloured by `item.color`) + `Cell ${cellId}·F${frequencyIndex}` + SINR line
  (`servingSinrByCellId.get(cellId)`); emphasise when `(satId,cellId)` is primary. Keep
  `data-testid="beam-callout"`/`data-satellite-label`/`data-beam-identity`; publish a render-count
  dataset via `useLayoutEffect`.
- **Mount:** `src/scene/MainScene.tsx`, beside `SinrLiveCellFootprintRings`, gated by
  `showBeamCallouts` (NOT `showSinrLiveCellBeams`). Build `servingSinrByCellId` memo from
  `sim.sinrLiveCells.cells` (`cellId → servingSinrDb`). `showBeamCallouts` already in scope.
- **Caveat:** up to ~37 `<Html>` overlays — consider hero + top-N only if perf bites. Label the
  SINR as cell/beam serving SINR (boresight), not a per-UE reading.
- **Gates:** UPDATE `scripts/validate-phase-h-s3-live-sim-callouts.ts` (it currently encodes the
  inert state) + `validate-frontend-scene-lane-governance.ts` (declare the new layer
  sinr-live-cell-lane-owned, display-only), ATOMIC with the code. `validate:ready` browser smoke.

### W6 — serving El / Range wire-in (P1, MEDIUM)
- **Symptom:** even the serving column shows El `—` / Range `—`.
- **Root cause:** the cell branch of `buildPublishedPrimaryServing` hardcodes null
  (`useSimStatePublisher.ts:209` El, `:210` Range); the cell-truth serving record carries no topo.
- **Fix:** in the cell branch, look up El/Range for the serving satId from the same `topoBySatId`
  / `linkRangeKmBySatId` the steered path uses (`:544-545`) and replace the two nulls. Display
  补洞, no SINR/HO change.
- **Gates:** `validate:s0:geometry-trace` golden — confirm truth zero-diff (this only fills two
  display fields; if the golden snapshots them, a legit rebase that shows serving/SINR unchanged).

### W7 — comparison column restore (MEDIUM — corrected down from "high/P2")
- **Symptom:** COMPARISON column always blank (no colour, no number) on the cell lane.
- **Root cause (3 layers):**
  1. DATA: `SUPPRESSED_COMPARISON` all-null constant is spread on the cell branch
     (`useSimStatePublisher.ts:149-166`, `:194` unserved, `:220` served).
  2. DISPLAY GATE: `hasComparisonSignal = comparisonSatId!==null && comparisonBeamId!==null`
     (`InfoPanel.tsx:132`) has NO cell fallback (serving got `servingCellId` at `:131`).
  3. The contender IS computed but DISCARDED: `measureCellCandidates` (`sinrLiveCellModel.ts:742`)
     builds per-cell candidate `{satId, sinrDb}` samples and each cell's `HandoverManager`
     (`managerForCell`) picks serving + tracks the alternative — but `CellServingRecord`
     (`:124-138`) keeps only `servingSatId`/`servingSinrDb`/`candidateCount`, and
     `UeCellServingRecord` (`:140-161`) carries only the serving side.
- **Why this is MEDIUM, not high-risk:** the contender is an ALREADY-COMPUTED value (the
  runner-up in `candidateSamples`, i.e. best non-serving candidate at the cell; or the per-cell
  manager's pending target). Surfacing it = RETAIN an existing value, NO new physics. The only
  governance weight = it changes the cell-model OUTPUT record → the `s0:geometry-trace` golden
  snapshot gains a field → a deliberate golden REBASE (same kind as W6) that must prove
  serving/SINR truth is byte-identical. The "touches truth boundary / SDD" label was
  over-conservative.
- **Fix (use the SAME cell-truth model — do NOT borrow the steered candidate, or you re-create
  the W1 γ-mismatch):**
  1. `sinrLiveCellModel.ts`: in the per-cell loop, retain the best NON-serving candidate
     (2nd-highest of `candidateSamples`) — add `comparisonSatId`/`comparisonSinrDb` to
     `CellServingRecord`, and thread the protagonist UE's cell contender into `UeCellServingRecord`.
     (Optionally also surface the manager's pending-target when a HO is mid-trigger, to drive the
     PENDING TARGET / Trigger-Time role.)
  2. `useSimStatePublisher.ts`: replace `SUPPRESSED_COMPARISON` on the cell branch with the
     retained contender (comparisonSatId/Beam(cell)Id/SinrDb; Δ SINR = serving − contender).
  3. `InfoPanel.tsx:132`: add a cell fallback to `hasComparisonSignal` (accept a comparison
     CELL id, mirroring the serving `:131` fallback).
- **Result:** the DECISION column (Δ SINR / Need Offset / Trigger Time) becomes meaningful again
  — the "why switch" story the panel was designed for.
- **Gates:** `validate:s0:geometry-trace` (golden rebase, prove truth zero-diff for SINR/serving),
  `validate:governance`, `validate:ready`. Likely also `validate-phase-i-s5b` (cone layer
  unaffected — confirm). Consider a 1-paragraph note in this SDD's changelog rather than a
  separate full SDD, since it only surfaces a computed value.

### W8 — Spotlight visual fidelity (DECISION REQUIRED — do not implement blind)
- **State:** Spotlight checkbox is restored (§2) and the EFFECT works (scene fog + dim + target
  point-lights via `BaseSceneLayout`; effect math is byte-equivalent to old). It LOOKS different
  from 49db65d because the BEAMS moved: 49db65d beams were UE-ANCHORED (a tight light pool under
  the protagonist UE); HEAD beams are EARTH-FIXED (spread), since `c8d211d` zeroed the UE-anchor
  (`disableUeAnchor`). So the point-lights now sit at spread earth-fixed positions.
- **Decision for the user:** (a) ACCEPT the current spread spotlight (no work); or (b) re-anchor
  the spotlight targets / beams to the protagonist UE for the old tight-pool look — which
  conflicts with the earth-fixed cell model the rest of the lane now uses. **Do not change beam
  anchoring to fix a cosmetic spotlight** without an explicit decision: it touches geometry the
  whole lane depends on.

---

## §5. Step 0 — clear the existing governance debt + commit the done restore

Before any new work, make the §2 done-work green + committed (one concern per commit):
1. Repoint/retire `validate-modqn-omega-s3-replay-mode-wiring` (`live-status-handover-mode`).
2. Repoint/retire `validate-hobs-tr38811-phase2-browser` (`SIGNAL PROFILE`).
3. Retire/quarantine the 3 cinema/focus browser gates (removed buttons), dated note.
4. `validate:governance` green → commit the right-sidebar restore (split into coherent commits:
   right-sidebar shell; widths; scrollbar-gutter fix; spotlight un-gate). Then `validate:ready`.

> **EXECUTED 2026-06-20 (a precheck workflow re-verified every file:line first; two premises
> drifted):**
> - **Item 1 (omega-s3):** REPOINTED, not just for `live-status-handover-mode`. The validator
>   was multiply-rotted: it also `fs.readFileSync`'d the now-DELETED `src/ui/DiagnosticsDrawer.tsx`
>   and crashed (ENOENT) before any assert. Fix = dropped the dead `live-status-handover-mode` +
>   `HANDOVER MODE` conjuncts (kept the 4 still-live mode-copy pins) AND removed the whole
>   crashing `(h) DiagnosticsDrawer` section (no successor component to pin). Now PASS (52 checks).
>   It is orphaned (in no npm aggregate) — fixed to keep the manual invariant honest, not gated.
> - **Item 2 (hobs-phase2-browser):** RETIRED (deleted). Orphaned (no npm script, no aggregate),
>   it asserted the deliberately-removed `SIGNAL PROFILE` card with strings (`HOBS Legacy` /
>   `HOBS + TR 38.811`) no longer rendered in the DOM; `validate:hobs-tr38811-phase2:dpc` still
>   covers phase-2.
> - **Item 3 (cinema gates): NO-OP — premise was FALSE.** `DirectorControls` + `HandoverEventRail`
>   + the focus-jog buttons are STILL mounted (the `handoverEventRail` JSX is rendered at
>   `App.tsx:1972`, artifact tab). The restore only removed the live-tab *duplicate*
>   (`{sceneLane === 'sinr-live' ? handoverEventRail : null}`), not the components. So the 3 gates
>   are intact; nothing to retire. Re-verified by `validate:ready`.
> - **Item 4:** `validate:governance` was already GREEN on the uncommitted tree (the broken
>   validators above are orphaned, outside the gate), so commits are unblocked.

---

## §6. Implementation order + gates

1. **Step 0** (governance debt + commit done work) — unblock a clean tree.
2. **W1** Γ/duel label (instant) → **W2** σ² colour.
3. **W3** HO Slow readout/Resume.
4. **W4** Hex double-layer (Option A) + remove persistent grid.
5. **W5** Beam Info callouts.
6. **W6** serving El/Range.
7. **W7** comparison restore (golden rebase).
8. **W8** Spotlight — only after the user's (a)/(b) decision.

Per item: screenshot :3000 before → change one concern → screenshot after → compare →
`validate:governance` → commit. Run `validate:ready` after each render-affecting item; run
`validate:governance:full` + `validate:static:all` before a handoff/PR. Follow
`docs/frontend-change-contract.md`; if dispatching a sub-agent, isolate in a git worktree, paste
the contract's dispatch template, require `validate:ready` proof, review the diff.

---

## §7. Open decisions (ask the user)

- **W8 Spotlight:** accept spread earth-fixed spotlight, or re-anchor to UE (geometry change)?
- **W7 comparison semantics:** show BEST CANDIDATE (steady-state runner-up, always present) vs
  PENDING TARGET (only during a trigger countdown) — or both via the dynamic role? Default:
  best non-serving candidate, upgrade to pending-target when a HO is mid-trigger.

---

## §8. References

- Memory: `.agent-memory/project_right_sidebar_oldtuning_restore_2026-06-20.md` (full session
  ledger + file:line) + `project_beam_grid_data_driven_audit_2026-06-20.md` (data-driven /
  producer boundary).
- Reference commits: `49db65d` (2026-05-08), `ab861c4` (2026-05-21). Change/removal commits:
  `c8d211d` (cell migration, callout+spotlight-anchor), `b64cd9a` (delete dead SatelliteBeams),
  `8e32c37` (kill HO-Slow readout/Resume), `f2a7bab` (unmount EarthFixedCells double-hex),
  `f0adf3c`/`5795815`/`131a71a` (add+tune the persistent background grid).
- Audit workflows (this session): right-sidebar data truth `w460rllw6`; 3-control archaeology
  `wf7ye9mo5`; hex archaeology agent `a177cb3eb`.
- Key files: `src/ui/InfoPanel.tsx`, `src/ui/info-panel/{DuelCard,DuelSignalColumn,DuelDecisionColumn,FormulaTermsReadout}.tsx`,
  `src/ui/SinrLiveQuickControls.tsx`, `src/scene/{MainScene,sceneLaneRenderPlan,sinrLiveCellModel,sinrLiveCellRuntime,useSimStatePublisher,usePlaybackControls,BaseSceneLayout}.tsx/ts`,
  `src/viz/{SinrLiveCellFootprintRings,SinrLiveCellBeamCones,EarthFixedCells,BeamCalloutContent}.tsx`,
  `src/constants/{sinrLiveConeStyle,servingColour}.ts`, `src/styles/main.scss`.
- Governance pins to respect: `scripts/validate-frontend-scene-lane-governance.ts` (2029-2033
  EarthFixedCells ban, 2808 footprint-rings JSX, QUAR-S6-BUS group), `validate-phase-i-s5b-cell-beam-cones.tsx`
  (243-289, 396-399), `validate-phase-h-s3-live-sim-callouts.ts`, `beam:colour-match`,
  `s0:geometry-trace`, `s0:connected-sat-has-beam`.
</content>
