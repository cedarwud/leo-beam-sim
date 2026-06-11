# S4 — One Serving Truth Per Lane (plan)

**Parent:** [frontend-consolidation-program.md](./frontend-consolidation-program.md) §3 S4 ·
[governance-lock-strategy.md](./governance-lock-strategy.md) (QUAR-S4-SERVING).
**Slice before:** S3 one step / one reset (`b6f8e3b`, COMPLETE, not pushed). **Branch:** `feat/showcase-phase-0`.
**Method:** 6-dimension read-only recon (workflow `wf_de0a047d-43f`, 6 agents, all file:line-cited)
+ controller re-verification of every headline claim against source (the C-dimension agent returned a
thin result; its 760-gap mechanism was re-derived directly from `connectedSatBeamInvariant.ts`). This
doc is the authority for the S4 cut sequence; write it before touching the serving consumers.

---

## 0. Locked scope (2026-06-11, read before deciding anything)

**Consolidation finish-line = S5; `S3 → S4 → S5` is the render critical path.** Per the user-locked
strategy ([[project_frontend_consolidation_audit_2026-06-10]]): **beam visuals are FROZEN during the
core program — the current STEERED look is the baseline.** S5 ("one beam render") is where the rendered
beam layer is unified and the look is re-decided via a screenshot loop. S6 + C1–C3 are deferred.

**The single most important fact this recon established — and it reframes the whole slice:**

> On sinr-live the rendered beam layer is the **steered** `<SatelliteBeams>` (cones PARKED:
> `sceneLaneRenderPlan.ts:132` hard-codes `const showSinrLiveCellBeams = false`), while the UE dot
> colours, the served-N/N aggregate, the published `perUePositions`, the cone *data*, and the cinema
> event index all read the **earth-fixed cell model** (`sim.sinrLiveCells`). The steered beams use the
> profile antenna (40 dBi / 12° steering); the cell model uses a sinr-live-only OVERRIDE
> (33.5 dBi / 50° steering / 3.32° beamwidth / 37 cells). **The two are physically distinct oracles, so
> they pick different serving sats. This is the shipping `two-serving-oracles-cell-vs-steered` divergence.**

⟹ **S4 is a DATA / serving-truth unification, NOT a render flip.** It makes every **cell-side** consumer
read ONE cell serving record, kills the `servingBeamId↔cellId` pun, gives the cell model the clock-rebase
S3-2 deferred (D5), and replaces the antenna literal-text locks with VALUE asserts. **It does NOT touch
the steered primary `frame.serving`, the steered `<SatelliteBeams>` render, or `showSinrLiveCellBeams`**
— those stay the frozen baseline. The **`connected-sat-has-beam` must-hold flip for `cell-truth-serving`
claims is RENDER-coupled** (a cell-serving sat only has a *visible* beam once the cone layer is the lane's
mounted render) and therefore lands in **S5**, not S4. See **Decision D1** — this is the one place the
plan deviates from the "760 → S4" shorthand in memory, and it is forced by the frozen-render rule
(you cannot honestly call a cell beam "visible" while the rendered layer is steered and cones are parked).

**S4 scoped MINIMAL** (honors the no-gold-plating rule): 4 sub-slices, each ZERO-diff on the truth golden,
each its own non-vacuous gate. Core impl = controller + Workflow adversarial review (NOT codex — exec
timeouts + no-memory agents re-break governance locks). Pausable one-sub-slice-per-session.

---

## 1. The disease, precisely (what the recon established)

The audit member #5 said *"19 layers / 4 cone systems / 5 serving oracles."* The recon pinned the five
serving-truth computations on the sinr-live path and which surface each drives:

| # | Oracle | Lane role | Output | Reads | Drives |
|---|---|---|---|---|---|
| 1 | Steered **primary** HandoverManager (`runtimeFrameStep.ts:736,960`) | TRUTH | `frame.serving.{satId,beamId}` | steered link samples (profile antenna) | InfoPanel ACTIVE SERVING, steered `<SatelliteBeams>` render |
| 2 | Steered **secondary** HandoverManagers (`runtimeUeFrame.ts:155`, 12 Hz, cached) | TRUTH | per-UE `servingSatId/servingBeamId` | steered snapshots | (currently OVERRIDDEN by the publisher on sinr-live — computed but discarded) |
| 3 | **Earth-fixed cell model** (`sinrLiveCellModel.ts:593,668`, per-cell HandoverManager) | TRUTH (the S4 canonical) | per-cell `servingSatId`, per-UE `{servingSatId,cellId}`, `illuminatedBeams[].serving` | OVERRIDDEN antenna (33.5/50/3.32°) | mosaic dot colour, served-N/N aggregate, published `perUePositions`, cone *data* |
| 4 | `fillPerUeServingSinr` inherit-primary fallback (`runtimeUeFrame.ts:84`) | TRUTH | copies primary serving onto every UE (N≤1 path) | — | a 4th way a secondary's serving is set |
| 5 | Offline cinema event-index (`sinrLiveCellHandoverEventIndex.ts:318`) | TRUTH (re-derived) | handover events for cinema/timeline | re-runs the cell model at a COARSE dt | cinema-clicked handover events |

**Five precise problems:**

1. **The displayed divergence is render-vs-data, not data-vs-data.** Oracle 1 (steered) is the *rendered*
   beam and the *primary* InfoPanel serving; oracle 3 (cell) is everything else displayed. Same UE → dot
   coloured for cell-serving sat X while the only beam near it is steered sat Y's
   (`MainScene.tsx:1538,918`; `sceneLaneRenderPlan.ts:132,137`).
2. **The `servingBeamId↔cellId` pun.** On sinr-live the published per-UE record sets
   `servingBeamId := ue.cellId` (`useSimStatePublisher.ts:349`) — a cellId masquerading as a beamId — so
   the aggregate's "serving beams" count and the InfoPanel's steered serving beam are incomparable
   quantities. The pun is at **THREE** sites (`useSimStatePublisher.ts:349`, `MainScene.tsx:931` queue
   model, `sinrLiveCellHandoverEventIndex.ts:216,218` `from/toBeamId`), only the first is governance-pinned.
3. **The cell model still RESETS on every time-shift (D5, deferred from S3-2).**
   `transitionHoManagers` (`useSimulation.ts:291`) fires `sinrLiveCellModel?.reset()` UNCONDITIONALLY —
   in the `rebase` (seek/wrap) branch too — so a seek/wrap wipes each per-cell HandoverManager's
   serving + eventLog (the cell flavour of the served-N/N crash). The cell model holds NO clock-absolute
   state of its own beyond its per-cell `HandoverManager` instances (`epochUtcMs` is `readonly`,
   `simTimeMs`/`slotIndex` recompute each step, `prevUeServing` is serving content) — so the fix is a pure
   fan-out, and those managers ALREADY have `rebase(deltaMs)` from S3-2.
4. **The antenna self-consistency is pinned by LITERAL TEXT.** `SINR_LIVE_CELL_MAX_GAIN_DBI = 33.5` and
   `SINR_LIVE_CELL_MAX_STEERING_DEG = 50` are frozen as source-text needles
   (`validate-frontend-scene-lane-governance.ts:2003,2008`), exactly the tangle the program targets —
   editing the value breaks the gate. `consistentPeakGainDbi(beamwidth, efficiency)` already exists
   (`beam-gain.ts:96`) and the runtime test already asserts `|maxGainDbi − consistentPeakGainDbi| < 0.5`.
5. **The decision/ω override is PRIMARY-ONLY but unlabelled, and the event-index dt is coarse.** The
   override is installed only on the primary `hoManager` (`useSimulation.ts:265`); secondaries and the
   cell managers take no override param. On sinr-live the override is structurally unreachable
   (policy picker gated to `modqn-live-cell-preview`, `App.tsx:2018`) and the lane has no live MODQN. The
   offline event-index re-runs the cell model at a fixed step (≠ the live variable frame dt), so a clicked
   cinema event can name a serving transition the live scene never displayed.

---

## 2. The target shape (one cell serving record → every cell-side consumer)

```
   stepRuntimeFrame (god-step, FROZEN by S3-3)
     ├─ frame.serving  ── steered primary ─────────────► InfoPanel + steered <SatelliteBeams>  [FROZEN baseline, untouched by S4]
     └─ frame.sinrLiveCells  ── the ONE cell serving record ──┐
                                                              ▼
        ┌──────────────── single typed read: ue.{servingSatId, servingCellId} ────────────────┐
        ▼                    ▼                       ▼                         ▼
   mosaic dot colour   served-N/N aggregate   cone render data        cinema event index
   (buildSinr…Cells)   (deriveSinrServing…)   (SinrLiveCellBeamCones) (sinrLiveCellHandover…)
        └──────────── serving-equivalence invariant: all four agree with sim.sinrLiveCells.ues ─┘
```

- **One canonical cell serving record** = `sim.sinrLiveCells.ues[i].{servingSatId, cellId}` (+ the per-cell
  `illuminatedBeams[].serving`). Every sinr-live **cell-side** consumer reads it through a typed field;
  no consumer re-derives serving and none reads a punned id.
- **The steered primary stays frozen.** `frame.serving` (oracle 1) remains the InfoPanel/steered-render
  primary serving. S4 does not unify it onto the cell model — that is the S5 render unification (Decision D1).
- **The cell model rebases like the steered managers** on seek/wrap; resets only on cold-start.

---

## 3. Cut sequence — 4 sub-slices (1 commit each)

Every sub-slice is **ZERO-diff** on the existing truth golden (`fixtures/s0-geometry/candidate-rich-baseline.json`,
`loop:false`, static, no seek) on `truth.*` and lands its own **non-vacuous** gate (S0 §3 discipline:
退行為必附 gate; run-twice A==B; perturbation positive control). `truth.*` ZERO-diff is mandatory and may NOT
be `S0_TRACE_IGNORE`'d. Beam visuals FROZEN throughout (steered render unchanged; cones stay parked).

### S4-1 · Cell-model clock-rebase (D5 — the deferred served-N/N cell fix) — ✅ DONE
**⚠️ A 3-lens review (workflow `wf_2472517e-790`) caught a BLOCKER in the first cut and a phantom-HO major;
both folded before commit. The corrected as-built differs from the original plan as noted.**

- `SinrLiveCellModel.rebase(deltaMs)`: a pure fan-out — `for (const m of this.cellManagers.values())
  m.rebase(deltaMs)`. No new clamp logic: `HandoverManager.rebase` already clamps `guardUntilMs ≥ 0` and
  retracts a pre-epoch `pendingSinceMs`. **CORRECTION (was "KEEP prevUeServing"): rebase CLEARS `prevUeServing`**
  (`this.prevUeServing = new Map()`, like `reset()`). prevUeServing drives ONLY the per-UE intra/inter
  classification; a sim-time jump is a TELEPORT, not a handover, so keeping the pre-jump entry across a
  sat-set-changing seek/wrap fabricates a **phantom inter-HO** at the seam (review-measured: +60 s seek →
  inter-HO 28 vs reset 0). The served-continuity benefit lives in the per-cell `HandoverManager` eventLog
  (−3 dB relax), NOT in prevUeServing, so clearing it loses no continuity (D5 decision reversed — see §4).
- **Wiring — TWO production time-shift paths (the BLOCKER fix):** the original cut wired the cell rebase ONLY
  into `transitionHoManagers`, but **the live LOOP WRAP never routes through it.** Production sets
  `windowLengthSec = LIVE_SIM_TIMELINE_DURATION_SEC = 7200 = maxTimeSec` (`appRuntimeConfig.ts:66`), so the
  in-hook window-reloop guard (`useSimulation.ts:488`, fires at `startOffset+window ≈ 7650`) is **UNREACHABLE**
  — `simTimeSec` wraps at `maxTimeSec=7200` first via the **in-step `didLoopWrap`** inside `stepRuntimeFrame`
  (`runtimeFrameStep.ts:583`). The step rebases the STEERED managers in-step but NOT the externally-attached
  cell model. (The S3 recon's "default window 180 s" was the `?? 180` *fallback*, never the live value — the
  error this slice corrects.) So the wiring is in **two** places:
  1. `useSimulation.ts` useFrame: when `out.didLoopWrap`, `sinrLiveCellModel?.rebase((frame.simTimeSec −
     previousSimTimeSec) * 1000)` **before** the attach (the live loop-wrap path).
  2. `transitionHoManagers` rebase branch: `sinrLiveCellModel?.rebase(transition.deltaMs)` (the SEEK +
     window-reloop path); cold-start branch keeps `sinrLiveCellModel?.reset()`.
- **Gate `validate:s4:cell-served-survives-wrap` (rewritten to be production-faithful):** **D** wiring (both
  sites, source-structural); **A** unit (`rebase(0)` is a pure no-op); **W** the REAL live wrap — drives the
  production `didLoopWrap` and reaches the per-cell managers' private `guardUntilMs` (`as unknown` cast): the
  CONTROL arm (no wrap rebase = the bug) leaves **19/37 managers with a stale ~7215 s-future guard**; the FIX
  arm leaves **0** (max 30 s, the legit ping-pong guard) — directly asserts the timer offset + recovery; **B**
  small backward seek continuity (rebase keeps served 89 vs reset 13); **P** phantom-HO (a sat-changing seek's
  seam inter-HO == the reset reference, 0 — locks the cleared-prevUeServing decision). Run-twice determinism.
  All three positive-control mutations verified RED: remove the useFrame wrap rebase → D; wrong-sign rebase → W;
  keep prevUeServing → P.
- **ZERO-diff:** golden is `loop:false` → never wraps → `truth.*` unchanged (verified). **QUAR-safe:** model
  method + two call-site rebases; no QUAR-S4-SERVING needle touched. Group stays executing (5 blocks).
- **Open check DISCHARGED (recon D openQ → now gate section P):** the phantom intra/inter-at-the-seam risk is
  resolved by CLEARING `prevUeServing` on rebase (above) and LOCKED by gate section P (seam inter-HO == reset
  reference). The original "keep prevUeServing" hypothesis was the bug, not the fix.

### S4-2 · Kill the `servingBeamId↔cellId` pun (typed `servingCellId`, ADDITIVE) — ✅ DONE
**As-built deltas vs the plan below (all verified at impl):**
- **Cell-side consumer surface was larger than the 3 sites + mosaic keying:** the published record is
  ALSO read by `DiagnosticsDrawer.tsx` (per-UE table renders `servingBeamId` raw — nulling it would
  blank the column) and `SinrOffsetExplainer.tsx` (row key + `data-beam-id` + `data-logical-beam-id`
  read `row.beamId`). Both re-pointed to the typed unit (`servingCellId ?? servingBeamId` /
  `cellId ?? beamId`) — rendered values byte-identical (cell rows always displayed the cell id).
- **Site 3 took the "null them" arm:** `LiveWalkerHandoverEvent.from/toBeamId` (and the downstream
  `CinemaCandidateDetail`, `RuntimeCandidateHighlightCommand`, `SinrCandidateRow.beamId`) widened to
  `number | null`; cell-truth rows carry null + the typed `from/toCellId`. Every cell-event consumer
  already preferred the cell id (cinema `beamLabel`, rail adapter, `CandidateBeamHighlight` cell
  placement), so the de-pun is display-invariant; steered rows keep real beam numbers.
- **QUAR-S4-SERVING block #3 needle UPDATE (same-commit replacement):** the block's
  `servingBeamId: ue.servingSatId === null ? null : ue.cellId,` pin froze the pun itself and HAD to
  break with the de-pun. Per binding rule 1's spirit (needle dies in the SAME commit as its
  replacement), the needle was updated in place to pin the de-punned publish shape (typed
  `servingCellId` + `servingBeamId: null`), and the replacement gate `validate:s4:pun-retired`
  landed in the same commit. The group keeps executing (5 blocks); WHOLESALE retirement stays S4-3.
  ⚠️ The needle update shifted governance line numbers — the §3 S4-3 retirement table's
  `1529/1561/1884/1940/1990` refs are pre-S4-2 identifiers; S4-3 must locate the 5 blocks by the
  `tangleLockGroup('QUAR-S4-SERVING'` occurrences, not by line number.
- **Gate `validate:s4:pun-retired`:** S = comment-stripped structural sweep of src/ + scripts/
  (480 files, zero `*BeamId: …cellId` assignments) + typed markers at all 3 sites (incl. the
  formerly-unpinned MainScene queue model); B = behavior: cell-lane records (`servingBeamId` null) count as served,
  key `${satId}:${cellId}`, HUD beam-load colour == 3D `buildSinrServingUeColorMapFromCells` colour,
  queue accountant keyed, steered + legacy (field-absent) shapes byte-identical, run-twice A==B;
  E = event builder emits null beam ids + typed cell ids (inter + intra). All 3 positive-control
  mutations verified RED (publisher re-pun → S; aggregate ignores typed field → B; event re-pun → S).
- **ZERO-diff stronger than planned:** the geometry-trace golden matched in FULL (truth + display,
  no `S0_TRACE_IGNORE`, no re-baseline) — the published record/HUD are not in the golden path.
  Browser gates green on real :3001 (mosaic served-N/N + queue; cell-truth cinema focus + explainer).
- **3-lens adversarial review (all 3 lenses converged, execution-verified) — 1 major + 2 minors, ALL
  folded pre-commit:** (major) `validate:phase-f:per-ue-diagnostics` §(a) pinned the OLD compact
  `perUePositions` type with a whitespace-only regex → green→red under the cut; rewritten to
  comment-tolerant per-field asserts incl. `servingCellId` (its remaining red — `undefined;` check
  (b) — is PRE-EXISTING at HEAD, stash-verified). (minor) the pun gate's sweep now covers scripts/
  too (480 files), matching its header claim. (minor, S4-3 NOTE) the structural sweep cannot catch
  an alias-laundered re-pun (`const cid = ue.cellId; servingBeamId: cid`); today the publisher-shape
  governance needle + gate section B are the redundant layers — **when QUAR-S4-SERVING retires in
  S4-3, the serving-equivalence gate MUST keep a behavioural publisher-shape assert.**

- Add a typed `servingCellId: number | null` to the sinr-live published per-UE serving record; populate it
  from `ue.cellId` and set `servingBeamId = null` on the cell lane (there is no steered beam under the cell
  model). Re-point the cell-side consumers to the typed field: the mosaic aggregate / service-queue keying
  (`sinrServingMosaic.ts:227,250,400-414` — key by `(satId, cellId)` via the typed field on the cell lane),
  the publisher (`useSimStatePublisher.ts:343-352`), the queue model (`MainScene.tsx:925-933`), and the event
  index (`sinrLiveCellHandoverEventIndex.ts:216,218` — these already carry typed `fromCellId/toCellId` at
  220-221, so drop the punned `from/toBeamId := cellId` or null them on the cell lane).
- **ADDITIVE, not a rename** (Decision D2): `servingBeamId` is consumed in ~35 files, but those are STEERED-lane
  consumers where it legitimately holds a beamId — they are UNAFFECTED (off the cell lane `servingBeamId` keeps
  its steered meaning). The de-pun surface is contained to the cell-side consumers above.
- **ATOMICITY HAZARD (codex-flagged, MUST hold):** the typed `servingCellId` field, ALL cell-side consumer
  re-points (aggregate / queue / event-index), and `servingBeamId = null` on the cell lane must land in ONE
  commit. Nulling `servingBeamId` on the cell lane BEFORE a consumer reads `servingCellId` collapses the
  served-N/N count / erases beam-load rows mid-migration. No partial-migration intermediate state.
- **New pun-retirement STRUCTURAL gate** (folds into S4-3's retirement): assert NO source assigns
  `servingBeamId` from a `cellId` on the cell path (scan ALL THREE sites, incl. the currently-unpinned
  `MainScene.tsx:931`), and that the cell-side serving record exposes a typed `servingCellId`. Distinguish
  "beam IS cell (pun)" from "cell drives display (legitimate)" — the cellId still legitimately places the cone.
- **ZERO-diff:** `truth.*` unchanged (this is a published DISPLAY-record reshape; `frame.sinrLiveCells` truth
  is untouched). If the geometry-trace display golden captures the renamed published field, declare it via
  `S0_TRACE_IGNORE` and re-baseline in this commit (display-layer rule). Verify against the golden at impl.

### S4-3 · Antenna VALUE asserts + serving-equivalence gate + QUAR-S4-SERVING wholesale retirement (the structural cut)
Per governance rule 1, QUAR-S4-SERVING deletes **wholesale** in the SAME commit that lands ALL its
replacements. The group is registered once (`tangle-locks.ts:50-54`) and wraps exactly **5** `tangleLockGroup`
blocks (`validate-frontend-scene-lane-governance.ts:1529, 1561, 1884, 1940, 1990` — 19 text needles).

**Retirement table (needle block → protected value → replacement gate):**

| Block (file:line) | Protected value | Replacement |
|---|---|---|
| #1 `1529-1555` (mosaic module ownership: `buildSinrServingUeColorMap`, `deriveSinrServingMosaicAggregate`, `SINR_LIVE_SERVICE_QUEUE_SOURCE`, queue-conservation) | the mosaic owns serving-colour + served-N/N + queue accounting, distinct from MODQN | **EXTEND** `validate:phase-c:sinr-serving-mosaic:model` with the serving-equivalence assertion (aggregate derived from `sim.sinrLiveCells`) |
| #2 `1561-1582` (MainScene mosaic gate + mesh/queue telemetry attrs) | mosaic colours + telemetry threaded only under the sinr-live render-plan gate | **EXTEND** `validate:phase-c:sinr-serving-mosaic:browser` (read mesh telemetry, assert cell==mosaic colour) |
| #3 `1884-1907` (cell-truth re-point + the `servingBeamId := ue.cellId` PUN at 1904) | serving displays read cell truth; the pun freezes the cell→beam alias | **NET-NEW** pun-retirement structural assert (S4-2, all 3 sites) + the cross-consumer equivalence invariant |
| #4 `1940-1973` (beam-hopping cap + serving-continuity `cellManagers.get(cellId)?.state.satId === satId`) | a connected beam stays locked on its cell (no per-hop blink-off); illumination is a cap, not a serving oracle | **EXTEND** `validate:phase-c:sinr-live-cells:model` (already drives `applyBeamHoppingCap` + cellManagers) |
| #5 `1990-2016` (antenna override wiring + LITERAL `MAX_GAIN_DBI = 33.5` / `MAX_STEERING_DEG = 50` pins) | self-consistent gain↔beamwidth, decoupled override | **NET-NEW** in-gate VALUE asserts importing the consts + `consistentPeakGainDbi` (below); the runtime test already asserts the relation |

- **KEYSTONE replacement — `validate:s4:serving-equivalence` (NET-NEW):** drive one sinr-live frame; assert the
  per-UE serving `(satId, cellId)` read by the mosaic colour map, the cone resolver's serving field, the
  served-N/N aggregate, and the published `perUePositions` are byte-identical to `sim.sinrLiveCells.ues`.
  No existing gate asserts cross-consumer agreement — this is the registry's "cell == mosaic == cones == HUD"
  promise, render-agnostic (a DATA equivalence; needs no cone layer mounted).
- **Antenna VALUE asserts** (S3-3 imported-constant pattern; assert on the imported const, never source text):
  import `{ SINR_LIVE_CELL_MAX_GAIN_DBI, …_BEAMWIDTH_RAD, …_ANTENNA_EFFICIENCY, …_MAX_STEERING_DEG,
  …_SCAN_LOSS_DB, …_COUNT }` from `sinrLiveCellRuntime.ts` + `{ consistentPeakGainDbi }` from `beam-gain.ts`,
  then assert: (1) `MAX_GAIN_DBI === 33.5`; (2) `MAX_STEERING_DEG === 50`; (3) `SCAN_LOSS_DB === 4.5`;
  (4) `BEAMWIDTH_RAD === 0.058`; (5) `ANTENNA_EFFICIENCY === 0.6`; (6) `CELL_COUNT === 37`;
  (7) `|MAX_GAIN_DBI − consistentPeakGainDbi(BEAMWIDTH_RAD, ANTENNA_EFFICIENCY)| < 0.5` (self-consistency);
  (8) `MAX_STEERING_DEG > profile.antenna.maxSteeringAngleDeg (12)` AND `MAX_GAIN_DBI < profile.antenna.maxGainDbi − 3`
  (de-bias the 40 dBi profile).
- **KEEP as PERMANENT** (move OUT of any tangleLockGroup, do not delete): the `assertNotContains
  'profile.antenna.maxGainDbi ='` decoupling lock (`:2020-2024`) and the effective-steering behaviour assert
  (`:2011-2015`) — these are structure/behaviour, not text pins.
- **🔴 RETIREMENT PRECONDITIONS (codex-flagged — the 3 headline gates do NOT alone cover all 5 blocks):** the
  serving-equivalence + pun-retirement + antenna VALUE asserts replace blocks #3 and #5, but blocks #1/#2/#4
  ALSO protect values the headline gates do not touch — **queue ownership / source / conservation** (#1),
  **browser mesh + queue-pressure telemetry threading** (#2), and **beam-hopping cap + serving-continuity**
  (#4). S4-3 must EXPLICITLY extend the existing gates (`validate:phase-c:sinr-serving-mosaic:model/browser`,
  `validate:phase-c:sinr-live-cells:model`) to carry those protections as live behaviour asserts BEFORE
  deleting their blocks — do not pretend the new serving-equivalence gate subsumes them. Wholesale retirement
  is only safe once EVERY one of the 5 blocks' protected values has a live replacement.
- **Atomic retirement:** delete the registry entry (`tangle-locks.ts:50-54`) AND all 5 wrapper blocks in this
  commit (else `assertAndSummarizeTangleLockGroups` throws "registered but never executed"); mark the
  `governance-lock-strategy.md:36` row RETIRED — mirroring the QUAR-S3-STEP precedent.
- **ZERO-diff:** no truth change (gates + display-consumer re-points only).

### S4-4 · Honest labels — decision-override primary-only + event-index coarse-dt (no retirement dependency)
- **Decision-override label (Decision D3 = honestly LABEL, NOT extend):** extend `HEURISTIC_NOT_PAPER_BANNER_TEXT`
  (`HeuristicNotPaperBanner.tsx`) and the InfoPanel decision-overlay copy (`InfoPanel.tsx:44-57`) to state the
  override drives the **primary UE only**; the secondary population follows live SINR-offset. This lives in the
  `modqn-live-cell-preview` lane (where ω is reachable), NOT sinr-live. Behaviour gate: the label string is
  present when `handoverMode` is an override mode in that lane.
- **Event-index dt label (Decision D4 = LABEL, do not align):** the offline cell event-index re-runs the cell
  model at a fixed coarse step ≠ the live variable frame dt; running it at ~16 ms over a 7200 s × 100-UE window
  is build-cost-prohibitive. Label the index as a **coarse offline forecast** distinct from the live trajectory
  (claim-kind / disclosure assert), so a clicked cinema event is honestly a forecast, not a live-displayed transition.
  *(Recon F flagged this sub-goal has NO QUAR needle — it cannot be discharged by retirement; it needs this
  net-new label assert. Do not let S4-3's retirement imply it is covered.)*

---

## 4. Genuine decisions (surfaced; defaults chosen, confirm D1)

- **D1 — the 760 `two-serving-oracles-cell-vs-steered` must-hold flip → DEFER to S5 (render-coupled).**
  `connectedSatBeamInvariant.classifyViolation` returns this gap UNCONDITIONALLY for every `cell-truth-serving`
  claim (`:152`), because cell claims are measured against the STEERED visible-beam set
  (`resolveSteeredVisibleBeamSatIds` reads `viz.satBeams`). With cones parked and the steered layer frozen, a
  cell-serving sat genuinely has no *visible* beam → the flip to must-hold REQUIRES the cone render to be the
  lane's mounted layer = S5's "one beam render". **S4 unifies the DATA (cell-side single oracle, pun killed,
  equivalence gated); the must-hold flip lands in S5.** Mechanically: S4 re-tags the `KNOWN_GAPS` entry's
  `retiringSlice` from S4 → S5 and re-words it as a RENDER-layer divergence (one-line edit in
  `connectedSatBeamInvariant.ts:48-52`). *This is the ONE deviation from the "760 → S4" memory shorthand —
  surfaced for confirmation; it is forced by the frozen-render rule (cannot claim a cell beam visible while the
  rendered layer is steered).* **Default chosen: DATA-unify in S4, must-hold flip in S5.** *(codex consult
  independently confirmed D1: flipping it render-frozen would "fail immediately or weaken the invariant into a lie".)*
- **D2 — pun retirement is ADDITIVE (`servingCellId` typed), not a `servingBeamId` rename.** Contains the blast
  radius to the cell-side consumers; the ~35 steered consumers keep `servingBeamId`'s beam meaning. *Default chosen.*
- **D3 — decision override: LABEL primary-only, do NOT extend to all populations.** Extending would thread the
  override into the god-step's secondary + cell paths (a truth-path change, gold-plating); ω is unreachable on
  sinr-live and the cell model is a "not MODQN" lane. *Default chosen.*
- **D4 — event-index dt: LABEL as a coarse offline forecast, do NOT align to live dt.** Aligning is
  build-cost-prohibitive (~450 k frames × 100 UEs). *Default chosen.*
- **D5 — cell-model rebase: fan-out to per-cell `HandoverManager.rebase`, CLEAR `prevUeServing`.** No new clamp
  logic (inherited from `HandoverManager.rebase`). **REVERSED from "keep prevUeServing"** after the 3-lens
  review proved keeping it fabricates a phantom inter-HO at the seam (a teleport ≠ a handover); the
  served-continuity benefit lives in the per-cell manager eventLog, not prevUeServing, so clearing is free.
  Wired in TWO places: the useFrame in-step `didLoopWrap` (the live loop wrap) AND `transitionHoManagers` (seek/
  reloop) — the first cut missed the live-wrap path (a blocker; the live window == maxTime so the in-hook reloop
  is unreachable). *(this was the S3-2 deferred D5).*

These are leo-OWNED live-sim truth (CLAUDE.md Rule#2/#6 satisfied: no producer SINR/handover/provenance is
rewritten; the cell model is leo's own SINR-offset oracle, explicitly "not MODQN").

---

## 5. Explicitly OUT of S4 scope (do not let it sprawl)

- **The render flip** (un-park cones / retire steered `<SatelliteBeams>` on sinr-live / `showSinrLiveCellBeams`)
  and the `connected-sat-has-beam` must-hold flip → **S5** (one beam render; screenshot-driven look decision per
  the user's render-reset track, [[project_showcase_render_modqn_plan_2026-06-10]]).
- **`frame.serving` / InfoPanel / steered primary** unification onto the cell model → S5 (it would break the
  steered-render must-hold baseline if changed while the render is frozen — see D1).
- **`satelliteWorldById` display-top-12 truth-cone gating** + `population-beyond-display-cap` gap → S5 (deferred
  from S2; a distinct display-cap mechanism, not the cell-vs-steered one — keep them separate).
- **App-bus split / runtime memo identity** (`runtime` object re-render churn) → S6.
- **S1c cos-lat / "satellites above nadir"** → blocked on producer data (separate fork).
- **Producer dense-Q MODQN proof** → PARALLEL track, HEAVY/Ubuntu, blocked on producer not on S4
  (`docs/handoff/producer-dense-q-export-request.md`).

---

## 6. Verification protocol (every sub-slice)

1. `npm run lint` (tsc --noEmit; there is no `typecheck` script).
2. `validate:s0:geometry-trace` — `truth.*` ZERO-diff, NO `S0_TRACE_IGNORE` (truth-layer). S4-2 is the only
   sub-slice that may touch a display record → declare + re-baseline if the golden captures the renamed field.
3. `validate:s0:connected-sat-has-beam` — regression guard. The `cell-truth-serving` gap COUNT may shift
   (cell-side single oracle), but no NEW must-hold violation may appear and the primary-serving must-hold
   baseline must stay green. Re-tag the gap's retiring slice to S5 in S4-3 (D1).
4. The sub-slice's own new `validate:s4:*` gate (non-vacuous + A==B + perturbation/positive control).
5. `validate:phase-c:sinr-serving-mosaic:*` + `:sinr-live-cells:*` — extended in S4-3, green throughout.
6. `validate:modqn:phase-3…` / `phase6r…` boundary — other-lane ZERO drift (the override + event-index labels
   touch the modqn lane copy only, behaviour-gated).
7. Browser gate where a surface moves (`APP_URL=http://localhost:3001`); :3001 before/after screenshots —
   **the steered beam look must be byte-identical** (S4 is data-only; the only intended visual delta is the
   served-N/N HUD recovering faster across a wrap in S4-1, and honest label text in S4-4).
8. Adversarial review before commit (Workflow 3-lens; codex exec times out here) + positive-control mutation
   verify each new gate (the gate must go red on the inverted change).
9. Restore validator side-effect PNGs; confirm clean tree.

**Recommended order:** S4-1 (cell rebase, lowest risk, mirrors S3-2) → S4-2 (kill the pun) → S4-3 (antenna VALUE
asserts + serving-equivalence gate + QUAR-S4-SERVING wholesale retirement; needs S4-2 landed) → S4-4 (honest
labels). Then **S5 (one beam render)** = consolidation finish-line, where the render flips, the cones un-park,
and the 760 + population-cap gaps become must-hold. Do not push without asking.
