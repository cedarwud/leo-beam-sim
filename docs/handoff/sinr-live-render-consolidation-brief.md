# SINR-live Serving↔Render Consolidation — Handoff Brief

**Status:** diagnosis DONE (2026-06-17, context-hot session); EXECUTION is for a fresh
conversation, starting from this brief. Do NOT big-bang. Do NOT do another dead-code/CSS
hygiene pass — that is not the problem.

## Why this exists

User (2026-06-17): after many "整頓" rounds the basics are still broken — a UE shows
**connected to a satellite but no beam serves it**, the **intra-HO effect is invisible**,
and "每次改越疊越亂" (each change piles more code on, never improves). This is the brief for
a DIFFERENT kind of consolidation: **semantic / truth-model**, not hygiene.

## Why it got this way — and preventing recurrence (read this first)

**Root cause = structural INCENTIVES, not carelessness.** Three reinforcing loops:
1. **Accretion ratchet** — slice-by-slice dev (S1/S2/S-cells-…/G1-3) + a `park-not-delete` default →
   every feature adds a flag + a layer + a validator and NOTHING leaves. Result: ~25 render-plan flags,
   4 HO-visual layers, 3 serving notions, dead mounts (`SatelliteBeams`), dead config
   (`visualBeamDiameter`), dead policy (`sinr-offset.ts`), an unwired hook (`HandoverDecisionOverride`).
2. **Inverted governance (the keystone)** — validators source-PIN names / call-counts / body-strings
   (e.g. `applyDirectorFocusCommand >= 2`, `cameraPresets` position-count). So DELETING or UNIFYING
   costs repointing N validators (expensive + risky), while ADDING a flag beside the old is cheap. The
   governance meant to protect correctness actively **punishes simplification** → "add, never refactor"
   is the locally rational move. (Proof this is an INCENTIVE problem, not a discipline problem: this very
   session's work added a new flag `LIVE_CINEMATIC_CAMERA_ENABLED` and PARKED spotlight rather than
   removing — the pull to accrete is structural, it catches even an agent that just named the anti-pattern.)
3. **False-green** — gates test MODEL invariants, not END-TO-END VISUAL truth. `s0:connected-sat-has-beam`
   PASSES while the user sees connected-with-no-beam. Brokenness (Bugs A/E/G) accumulated UNDER all-green,
   so there was never pressure to fix it.
Amplifiers: no single source of truth (serving / colour / next-HO each forked), blind screenshot-less
iteration (the S-cells "~10 blind iterations" + park→un-park→stale-comment loop), comments that rot into
lies (the "parked" comment that's actually live), and the `App.tsx` god-file where independent mechanisms
collide (seek vs jog = Bug B).

**Preventing recurrence = change the INCENTIVES structurally (willpower will NOT hold — see the proof above):**
- **Validators pin INVARIANTS / CONTRACTS, not source text.** Then refactoring & deleting become cheap +
  safe → removal is as cheap as adding. This reverses loop 2 and is the KEYSTONE — without it, every
  other rule erodes.
- **DELETE-not-park default;** parking requires a dated un-park trigger + owner. Reverses loop 1.
- **End-to-end VISUAL invariant gates** (every-served-UE-has-a-rendered-cone; ticker-count == rendered
  flares; cone-colour == UE-colour for same serving). Tests what the USER sees; would have caught A/E/G.
  Reverses loop 3.
- **One ENFORCED truth source** per concept (serving / colour / next-HO) — a gate fails if a 2nd appears.
- **A flag/layer BUDGET** (adding one requires removing/justifying) + root-cause-first + screenshot-verify.

The Method rules + Targets below are the application of this. If only the symptoms (Bugs A–K) are fixed
without reversing loops 1–3, the mess regrows.

## Verified diagnosis (file:line)

### Bug A — "connected sat, no beam" = the serving truth is internally inconsistent
The cell model emits **THREE unreconciled serving notions** (`src/scene/sinrLiveCellModel.ts`):
1. `ues[].servingSatId` (HandoverManager decision) → UE marker colour / "connected"
   (`src/scene/sinrServingMosaic.ts:386-401`, `src/scene/MainScene.tsx:939-948`)
2. `illuminatedBeams[].serving` (built from beam-hopping-**capped** candidates) → beam cones
   (`src/viz/SinrLiveCellBeamCones.tsx:233-234`, `src/scene/MainScene.tsx:1102-1119`)
3. `cells[].servingSatId` (pre-hopping) → telemetry (`sinrLiveCellModel.ts:848`)

**Divergence:** `applyBeamHoppingCap` (7 beams/sat, `sinrLiveCellModel.ts:597-645,672`) filters
`candidatesByCell` BEFORE `illuminatedBeams` is built (748-762). But the UE's `servingSatId`
(819-833) can keep a sat that was capped OUT of the illuminated set → UE coloured "served by A"
while `(A, cell)` is absent from `illuminatedBeams` → **connected, no cone**. Reconciled nowhere.
→ **Decide in P0:** is this a TRUTH bug (a served UE MUST have an illuminated serving beam) or
faithful beam-hopping (the beam genuinely hopped away this slot) that the render fails to EXPLAIN
(no "beam hopped / coverage gap" visual)? Either way the fix is model-side reconciliation.

### Bug B — intra-HO invisible = the trigger fights itself
Intra-HO button (`src/App.tsx:1595-1601`) does `armIntra()` (which SEEKs the timeline) AND toggles
the primary-UE jog `{east:0}↔{east:28}`. The seek → `sinrLiveCellModel.rebase()` (574-578) CLEARS
`prevUeServing` + `recentHandovers` (by design — Rule#2 anti-fabrication: a sim-time jump is a
teleport, not a handover). So the jog-induced cell change is classified as a COLD ATTACH
(`prevServing=null`) → not intra → no `recentHandoverEvents` entry → the ambient pulse has nothing
to flare → **no render**. The orange dot swaps between 2 points (the jog toggle) but no handover
shows. PRE-EXISTING; NOT caused by the 運鏡-park done this session.

### Finding C — beam-activation is loose + illegible ("many sats, large-angle, 沒由來")
A satellite renders a beam cone to a cell IFF (full pipeline):
1. sat above **15° elevation** mask (`SINR_LIVE_CELL_MIN_ELEVATION_DEG`, `cellLayout.ts:51`)
2. AND within **50° off-nadir steering** to the cell — `SINR_LIVE_CELL_MAX_STEERING_DEG = 50°`
   (`sinrLiveCellRuntime.ts:95`), which **OVERRIDES the profile's physical 12° limit**. In-code
   rationale: 12° let only 1–3 of ~46 above-mask sats reach the 200×90 area → coverage dropouts;
   50° lets 6–8 serve continuously. (`listCellCandidateSats`, `sinrLiveCellModel.ts:400-415`.)
3. survives the **per-SAT** beam-hopping cap (7 beams/sat, NOT a global per-cell cap;
   `SINR_LIVE_BEAMS_PER_SAT=7`, `applyBeamHoppingCap` 597-645) — served cells locked, spare beams rotate.
4. is the SINR-chosen serving sat for that cell (HandoverManager).
5. render: ONLY serving cones by default (`if(!beam.serving)continue`, `SinrLiveCellBeamCones.tsx:234`);
   the non-serving "Other beams" toggle is DEFAULT OFF (`sceneDisplayConfig.ts:44`, opacity 0.04).

- **Why "many sats":** 50° override + per-sat (not per-cell) cap → 6–8 sats each serve 1–3 cells →
  ~4–8 serving cones by default (one per served cell). Rule-based (SINR-driven), NOT random — but the
  loose 50° gate + multi-sat reuse makes it LOOK arbitrary.
- **Why "large-angle":** 50° steering lets sats illuminate cells up to 50° off-nadir → wide oblique
  cones (apex angle ≈ scan angle). Geometrically correct for the 50° override; the WIDENESS (not the
  count) dominates the viewport and reads as "看不懂".
- **NOT a bug — a DESIGN TRADEOFF + LEGIBILITY gap:** 50° steering trades physical fidelity (profile
  12°) + visual legibility for coverage. Cones were parked 2026-06-08 (`be60db2`, "washed the
  viewport") then UN-PARKED 2026-06-11 (`b12ffef`) — the `sceneLaneRenderPlan.ts:199-205` "parked"
  comment is STALE (same comments-lie pattern, now with the un-park commit pinned).
- Key constants: 50° steering / 15° elev / 7 beams-per-sat / 3.32° beamwidth (~16 km cell) / 2.5 s hop slot.

### Structural — why it "feels like a mess"
- **park-not-delete + governance-tax = an entropy engine.** Every change must repoint N
  source-pin validators, so adding a flag/layer is CHEAPER than deleting/unifying. The local
  incentive always says "add"; the mess grows each change. This is the root of "越疊越亂".
- **4 overlapping HO-visual layers** (ambient pulse / candidate highlight / director cinema /
  spotlight), each a "slice" with its own render-plan flag + validator.
- **Stale comments lie.** `src/scene/sceneLaneRenderPlan.ts:199-205` says the cell cones are
  PARKED and the lane "renders the ORIGINAL steered `SatelliteBeams` again" — the OPPOSITE of
  reality: `showSinrLiveCellBeams` is TRUE, the cell cones ARE what render, and the `SatelliteBeams`
  mount is DEAD (`showLiveBeamCones && !showSinrLiveCellBeams` = `X && !X`, `MainScene.tsx:1700-1708`).
  The reset was reverted, the comment never updated, the dead mount left behind.
- **Gates test MODEL invariants while the END-TO-END VISUAL is broken.** `s0:connected-sat-has-beam`
  PASSES, yet the user sees connected-with-no-beam → no gate guards what the user actually sees.

## Full sat/beam/HO render audit (findings D–K, 2026-06-17, 3 parallel readers)

### Handover CONDITIONS (intra/inter trigger)
- ✅ All 8 thresholds are TUNABLE via `src/ui/HandoverPolicyControls.tsx` (sliders): `offsetDb`(3dB),
  `triggerTimeSec`(3.5s), `pingPongGuardSec`(5s), `intraSwitchTimeSec`(0.75–1.0s),
  `maxIntraSwitchesPerServingEpoch`, `sinrThresholdDb`(−5dB), `sinrSmoothingSec`, `pendingTargetHoldSec`.
  Applied via `handoverPolicyTuning.ts` → `HandoverManager`. NOT hardcoded — the user CAN tune "what
  counts as a handover".
- intra fires: same-sat better beam (`sinrDb>current`, **NO hysteresis**) + dwell ≥ `intraSwitchTimeSec`
  + beam-reuse quota left + no inter qualifies (`handover-manager.ts:335-379`).
- inter fires: a different sat beats serving by ≥ `offsetDb` for ≥ `triggerTimeSec` + ping-pong guard
  expired (`:252-333`). Continuity-rescue (`:234-250`): serving beam leaving the cone (`sinr=-Inf`) →
  immediate same-sat sibling switch bypassing guard/dwell/ban.
- **🔴 D (HIGH) — inter-HO effectively NEVER fires on sinr-live; root = GEOMETRY, not a bug.** One sat
  dominates the 200×90 km area @550 km → the 2nd-best never clears the 3 dB offset (often below the
  −5 dB floor). baseline `inter-satellite-handover: 0`. **You cannot "present" an inter HO that never
  happens — this is a TRUTH-GENERATION gap UPSTREAM of render.** To make inter HO real: lower `offsetDb`
  / add UE mobility / denser+tighter constellation (the parked multi-sat cell-truth model w/ 37 cells +
  50° steering DID produce continuous intra+inter).
- Dead: `engine/handover/policies/sinr-offset.ts` (legacy, not in active path); `HandoverDecisionOverride`
  hook is typed + threaded but **no caller invokes it**.

### Beam VISUAL control (angle / color / width)
- **🔴 E (HIGH) — cone colour ≠ UE-marker colour for the SAME serving relationship.** Cone = geographic
  frequency-reuse 6-palette `cellId % reuse` (`sinrLiveConeStyle.ts:181`, `beamRoleTokens.ts:233`); UE
  marker = sat-id hash + cellId HSL jitter (`sinrServingMosaic.ts:214`). Same (sat,cell) renders in two
  different colours → **you cannot match "beam ↔ the UE it serves" by colour.** Plus hard overrides:
  primary serving `#facc15`, candidate `#0ea5e9`.
- **F (MED) — none of angle/color/width is a clean DISPLAY knob today:**
  - ANGLE = pure geometry (apex=sat world pos → base=cell centre). The **50° steering is NOT in the
    visual angle** — wideness = sat distance/off-nadir, no tunable term (`SinrLiveCellBeamCones.tsx:241,564`).
  - WIDTH = `altitude × tan(beamwidth/2)` ≈16 km, `beamwidth` LOCKED to the antenna → **changing width
    changes gain → SINR** (`cellLayout.ts:76`, `sinrLiveCellRuntime.ts:66`). No display-only width knob.
  - COLOR = one resolver (good) but the dual-palette mismatch (E).
- Dead: `visualBeamDiameter` (`ntpu.config.ts`) never read by sinr-live (MODQN-lane leftover).

### intra/inter PRESENTATION layers
- **🔴 G (HIGH) — pulse cones VANISH if the serving sat falls out of the ~12-sat display cap** → the
  event is counted in the ticker + `recentHandoverEvents` but NO flare renders (`SinrLiveCellBeamCones.tsx:470`).
  "every HO is visible" breaks; ticker count ≠ on-screen flares (same count≠render family as Bug A).
- **H (MED) — the ambient pulse IGNORES `event.kind` (intra vs inter)** — renders both identically; the
  `kind` field exists but is unused (`SinrLiveCellBeamCones.tsx:451-489`). Toast/arcs DO differentiate.
  So on the MAIN sinr-live ambient layer you currently CANNOT show intra vs inter differently — directly
  blocks the "intra/inter 呈現不同" goal.
- **I (MED) — intra cinema framing is HARDCODED** (`directorFocusPose.ts:103-117`): inter frames the
  sat-pair dynamically, intra is locked to a legacy offset; no config to make intra framing dynamic.
- **J (MED) — two "next handover" signals can diverge:** the pending-candidate cone reads live
  `pendingTargetSatId` (`MainScene.tsx:1128`); the director highlight reads `runtime.candidateHighlight`
  (command). Out of sync → bright pending cone with no highlight rings, or vice versa.
- **K (MED) — the 運鏡-park (this session) left a partial-cinema state:** with
  `LIVE_CINEMATIC_CAMERA_ENABLED=false` the candidate/pair cones still render (director-gated) while the
  camera does not move. For "see the intra effect without camera" that is the DESIRED decoupling — but
  it is currently an accidental Rule#8 loophole, not an intentional split. Make the visual/camera
  decoupling explicit in P1.

## Target model
1. **ONE authoritative serving truth** per UE/cell, CONSISTENT with illuminated beams: served ⇒
   its serving beam is illuminated; otherwise an explicit "coverage gap this slot" state rendered
   honestly. UE colour + beam cone + telemetry all read the SAME reconciled value.
2. **Collapse the 4 HO-visual layers → 1** (ambient pulse as the base; fold in or DELETE the rest).
3. **Fix the intra trigger**: jog WITHOUT the self-defeating seek (or make jog+seek cooperate).
4. The lane render boundary (pure resolvers, per-lane flags) STAYS — it is not the problem
   (see `.agent-memory/project_frontend_arch_verdict_2026-06-16`). The problem is the serving
   truth + the HO-visual layering, not the lane split.
5. **Make beam-activation legible + decide the 50° steering tradeoff** (Finding C): either tighten
   toward the physical 12° (fewer/narrower cones; fix coverage another way) or keep 50° but render it
   so the user can SEE why each beam is on. The viewport must answer "why is THIS satellite beaming
   HERE?" at a glance — today the activation rule is correct but invisible.
6. **Unify serving COLOUR** (kills E): the cone and the UE marker for the SAME (sat,cell) serving render
   the SAME colour from ONE tunable palette, so "this beam serves these UEs" reads by colour.
7. **Add display-only beam knobs** (kills F): decouple visual angle / width / colour from the SINR
   physics so presentation is tunable without moving truth; delete the dead `visualBeamDiameter`.
8. **Pulse honours `kind` + a count=render invariant** (kills G, H): the ambient layer styles intra vs
   inter distinctly, and every COUNTED handover RENDERS (never vanishes under the ~12-sat display cap).
9. **Decide the inter-HO reality** (Bug D): inter HO never fires on sinr-live today. If inter
   presentation is a goal, make inter actually OCCUR (lower offset / UE mobility / denser constellation);
   otherwise state honestly that sinr-live is intra-only. Presentation work on inter is moot until then.

## Method rules (the anti-entropy change — REQUIRED, this is the point)
- Fix the **MODEL**, never add another patch/layer.
- **DELETE, don't park** (reverse the campaign default for this work).
- Add an **END-TO-END visual invariant gate**: "every UE rendered as served has a rendered
  illuminated serving cone." Browser/scene-level — fills the gate↔UX gap; would have caught Bug A.
- **Small steps; screenshot-verify each** (lesson: `.agent-memory/project_sinr_render_reset_2026-06-08`).
- One concern per commit. Do NOT touch the engine SINR / golden truth.

## Suggested phasing
- **P0** — reconcile serving↔illuminated in the cell model (kill Bug A + G count=render) + add the
  end-to-end visual gate. Decide truth-bug vs explain-hopping. Also DECIDE the inter-HO reality (Bug D):
  is sinr-live intra-only, or do we change geometry/offset to make inter fire? (Settles whether any
  inter PRESENTATION work is even meaningful.)
- **P1** — collapse the 4 HO-visual layers to one (resolves H pulse-kind, J pending-vs-highlight,
  K camera/visual split); fix the intra trigger (kill Bug B — small early win, intra finally visible);
  unify serving colour (E) + add display-only beam knobs angle/width/colour (F); make intra framing
  configurable (I); delete dead `SatelliteBeams` mount + `visualBeamDiameter` + `sinr-offset.ts` +
  the unwired `HandoverDecisionOverride` + stale comments; address Finding C (50° vs 12° + legibility).
- **P2** — thin the live-lane render-plan flags / App.tsx wiring (ONLY after the model is unified).

## Entry point for the new conversation
1. Read this brief.
2. Read `src/scene/sinrLiveCellModel.ts:597-833` (the cap → illuminated → ues-serving chain).
3. Screenshot the current sinr-live state FIRST (run vite, capture connected-no-beam + intra).
4. Decide P0 (truth-bug vs explain-hopping), then execute small + verify.

## State at handoff (originating session)
- Uncommitted, all gated green (`validate:governance` + `camera-preset` 78/0):
  camera pull-back (`src/config/ntpu.config.ts`, `MainScene.tsx` oblique) + 運鏡-park
  (`src/app/appRuntimeConfig.ts` flag `LIVE_CINEMATIC_CAMERA_ENABLED`, `MainScene.tsx` guard,
  `SinrLiveQuickControls.tsx` spotlight hide). The 運鏡-park aligns with collapsing the cinema
  layer (reasonable baseline) but P1 may supersede it.
- `main` is ahead of origin by 1 (`1315173`, the dead director-intra-gating drop).
- `docs/handoff/modqn-baseline-collapse-diagnosis-brief.md` was already dirty before this session
  (unrelated, untouched).
