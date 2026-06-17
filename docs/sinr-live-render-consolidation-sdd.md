# SINR-live Beam-Display Consolidation — Solution SDD

**Status:** DESIGN, awaiting owner review. Pairs with the DIAGNOSIS in
[`docs/handoff/sinr-live-render-consolidation-brief.md`](./handoff/sinr-live-render-consolidation-brief.md)
(read it first — this doc is the SOLUTION to the problems it names). Do NOT big-bang.
Do NOT do another dead-code/CSS hygiene pass.

## 0. The actual goal (owner, 2026-06-17)

Not "fix bug A–K." The goal is to **restructure the frontend beam system so that
(a) a single prompt can reliably control beam behaviour, (b) "done" means the
viewport actually looks right, and (c) a change does not re-introduce mess.**
The A–K bugs are the *vehicle* that proves the pattern works, not the point.

In the brief's terms: this is the structural reversal of the **three reinforcing
loops** (accretion ratchet / inverted governance / false-green). If we only fix
symptoms without reversing the loops, the mess regrows.

## 1. Why prompt-control is impossible today (root, evidenced)

1. **"Done" is defined by MODEL invariants, not the picture.** The gates assert
   model facts (`servingBeams == servedCellCount`, `sinrLiveCellModel.test.ts:356`)
   while no gate guards what the user sees. Proof: a 25-frame live poll on
   `sinr-live` showed `served-cell-count > rendered-cone-count` in **4/25 frames**
   (gap 1–2) — a served UE coloured "connected" with no cone — *under all-green
   gates*. So any agent (me included) can truthfully say "gates pass / done" while
   the viewport is broken.
2. **Beam APPEARANCE is scattered across ~8 files with no single control point.**
   To change "beam colour / width / which-shown" an agent must touch
   `sceneLaneRenderPlan.ts` + `sceneDisplayConfig.ts` + `sinrLiveConeStyle.ts` +
   `sinrServingMosaic.ts` (a *second, different* colour authority) + 5 resolvers in
   `SinrLiveCellBeamCones.tsx` + the wiring in `MainScene.tsx` + `useBeamViz.ts`.
   Miss one → desync. And ~8 render-plan flags (`showSinrLiveCellBeams`,
   `showSinrServingMosaic`, `showSinrLiveHandoverPulse`, `showLiveBeamCones`,
   `showLiveSceneEffects`, …) are **literally the same value** (`= showSinrBeamRender`)
   under different names — one concept split 8 ways.
3. **Inverted governance makes "change" cost more than "add."**
   `validate-frontend-scene-lane-governance.ts` pins ~20 EXACT source strings
   (e.g. `const showSinrServingMosaic = showSinrBeamRender`, `focusSatIds: null`,
   `buildSinrServingUeColorMapFromCells(cellFrame.ues)`, the mount `<CandidateBeamHighlight`,
   `data-claim-kind="sinr-serving"`, the literal copy `live SINR serving · not MODQN`,
   even "the lane gate must be within 260 chars before the mount"). Refactoring =
   repointing 20 text asserts; adding a new flag beside the old = free. So "add" is
   the locally-rational move every time.

## 2. Corrected diagnosis of the two anchor bugs (supersedes the brief)

- **Bug A's count-divergence (served > cones) is a MEASUREMENT ARTIFACT, not a real
  bug — VERIFIED 2026-06-17.** The first gate read `served` and `cones` in two
  separate `getAttribute` awaits; a frame commit between them fabricated a gap of
  1–4 (the `project_browser_gate_drift` read-race, the brief warns of it elsewhere).
  With an ATOMIC single-`evaluate` read the gap is **0 across 30 frames**, and an
  in-page diagnostic (both values from the same `cellFrame` object, 2×28 s) found
  **0 divergence**. Model + render ARE consistent at cell level (test-locked
  `servingBeams == servedCellCount`, `sinrLiveCellModel.test.ts:356`); the resolver
  guards (`SinrLiveCellBeamCones.tsx:238`) drop nothing. The brief's "render drops a
  served cone" was almost certainly the SAME racy read. **There is no count bug to
  fix.** The coverage gate is KEPT (atomic) purely as a regression guard.
- **So the user's "connected, no beam" is the VISUAL layer, not a missing cone:**
  serving cones render at `SINR_LIVE_CONE_AMBIENT_OPACITY = 0.08` + 50° oblique +
  the pulled-back camera → the cone is THERE but near-invisible; compounded by
  cone-colour (freq-reuse) ≠ UE-colour (sat-hash) so even a visible cone can't be
  matched to its UE, and by cell-granularity (the UE sits off the cone's
  cell-centre base). **Fix = colour unify (E) + cone legibility (opacity/width),
  screenshot-verified — NOT a model/render-drop fix.**
- **Bug B "intra invisible" confirmed.** The intra button (`App.tsx:1595`) does
  `armIntra()` (which SEEKs → `rebase()` clears `prevUeServing`) AND a jog toggle;
  the jog-induced cell change is then classified as a cold attach → no pulse → no
  flare. Live capture: clicking intra steps cones `31→33` then freezes with
  `pulse-cone-count = 0` throughout.

## 3. Target architecture

Four layers, one direction. Display can NEVER write upstream.

```
TRUTH (untouchable: SINR + HandoverManager)        sinrLiveCellModel.ts
   frame.sinrLiveCells { ues[], illuminatedBeams[], servedCellCount, recentHandoverEvents }
        │  (read-only)
        ▼
DISPLAY CONTRACT  (the ONE thing a prompt edits)   beamDisplaySpec.ts   ← NEW (generalises SceneDisplayConfig)
        │  pure data, primitives only, no field can name a serving/SINR/HO decision
        ▼
RESOLVERS  (pure: truth + spec → render items)     SinrLiveCellBeamCones.tsx, sinrServingMosaic.ts
        │  cones + UE colours + pulse all read the SAME spec + the SAME colour authority
        ▼
RENDER     MainScene / GroundScene
```

### 3.1 `beamDisplaySpec` — the single control point

Generalise the EXISTING `SceneDisplayConfig` (which already exists for exactly this
reason — its docstring describes the "I change a beam value and nothing re-renders"
bug and the direct-prop seam that fixes it). Flat, primitive, declarative:

```ts
interface BeamDisplaySpec {
  // COLOUR — ONE authority for cone AND UE marker (kills Bug E)
  colorMode: 'serving-identity';        // both cone + UE call colorForServing(satId, cellId)
                                        // future: | 'frequency-reuse' | 'sinr-heat'
  // WHICH beams
  showServingCones: true;               // always — the serving cone IS the connection
  showNonServingCones: boolean;         // existing knob
  showCoverageGap: boolean;             // NEW honest state for a genuinely-unlit cell

  // CONE appearance — DISPLAY ONLY (Rule#6: never the antenna beamwidth → never gain/SINR)
  coneWidthScale: number;               // visual multiplier on placement.radiusWorld ONLY
  servingConeOpacity / nonServingConeOpacity / primaryConeOpacity: number;
  coneSegments: number;

  // PULSE / handover flare
  showHandoverPulse: true;
  pulseIntraStyle / pulseInterStyle;    // honours event.kind (kills Bug H)
  pulseRetentionSec / pulsePeakOpacity: number;

  beamCalloutsEnabled: boolean;         // existing
}
```

Prompt-control then reduces to one declarative edit: "波束窄一點" = `coneWidthScale`;
"顯示所有波束" = `showNonServingCones`; "波束跟 UE 同色" = already the default.

### 3.2 One colour authority (kills Bug E)

Today cone serving colour = `resolveSinrLiveConeColor(freqIndex)` (geographic
frequency-reuse 6-palette) but UE marker = `mosaicColorForServingBeam(satId, cellId)`
(serving-identity hash) → same (sat,cell) renders two colours, can't match
beam↔UE. Unify: **serving cones adopt the serving-identity colour** (same fn as the
UE marker — already a stable hash, satisfies the governance "no frame-churn" rule).
Distinguish two colour kinds:
- **identity colour** (cone base == its UE markers) — the consolidation.
- **role colour** (hero `#facc15`, candidate `#0ea5e9`, pulse) — SEMANTIC highlights,
  KEPT. They mean "focus / pending / just-fired", not "who serves whom".

The freq-reuse palette is retained only as a future `colorMode` (frequency-plan
view), or retired. (Touches `vc1c`, `vc1d`, and the `sinrLiveConeStyle.ts` governance
pin — repointed in P2.)

### 3.3 Width / angle are VISUAL, physics stays locked

`coneWidthScale` multiplies the RENDERED base radius only. The antenna beamwidth
(`cellLayout.ts:76`, `sinrLiveCellRuntime.ts:66`) — which drives gain → SINR — is
NOT a display knob and is never touched. This is how F (display-only knobs) is
satisfied without breaking Rule#6.

## 4. "Done" = end-to-end VISUAL invariant gates (the trust fix — the keystone)

A new browser gate `validate:beam:visual-invariants:browser` defines done by what the
USER sees, asserted over N live frames on real `sinr-live`:

1. **Coverage:** `data-sinr-live-cell-beam-cone-count >= data-sinr-live-cell-served-count`
   every frame — every served cell has a rendered serving cone. *(Currently FAILS
   4/25; this gate is what turns the broken-but-green state honestly RED.)* Kills A + G.
2. **Colour match:** a served UE's marker colour == its serving cone colour for the
   same (satId, cellId). Enforced cheaply as a model invariant (both resolvers call
   one `colorForServing`) + a browser spot-check. Kills E.
3. **Count == render:** ticker / `recentHandoverEvents` count == rendered pulse flares
   over a window. Kills the G count≠render family.

These assert BEHAVIOUR, not source text. After this gate exists, an agent's "done"
is trustworthy — it cannot be green while the viewport is wrong.

## 5. Anti-recurrence: contract-pins, not source-pins

The ~20 source-text pins (§1.3) are the entropy engine. Convert each to a
behaviour/contract pin so moving or deleting code is cheap:
- `const showSinrServingMosaic = showSinrBeamRender` (text) → assert the OUTPUT
  behaviour "mosaic renders on sinr-live, inert on MODQN/artifact".
- `focusSatIds: null` (text) → already implied by gate #1 (every serving sat coned).
- literal copy `live SINR serving · not MODQN` (text) → pin the contract attr
  `data-claim-kind="sinr-serving"`, drop the exact-wording pin.
- the "within 260 chars" structural pin → assert the lane-gate BEHAVIOUR (aggregate
  hidden off-lane), not source proximity.

Done incrementally, as each piece of code moves — not as one big rewrite.

## 6. What collapses, what dies (from the control-surface map)

- **Collapse into `beamDisplaySpec`:** the ~6 redundant render-plan flags that all
  equal `showSinrBeamRender` + the 2 `SceneDisplayConfig` knobs.
- **4 HO-visual layers → 1:** ambient pulse (`MainScene:1206`) is the base and learns
  `kind`; fold or DELETE candidate-highlight (`CandidateBeamHighlight.tsx`), director
  cinema pair (`resolveSinrLiveHandoverPairConeItems`), spotlight (`MainScene:1258`).
- **Delete (verified dead):** `visualBeamDiameter` (`ntpu.config.ts:47,96,120` — written,
  never read); the stale comment graves (`sceneLaneRenderPlan.ts:199-205`,
  `MainScene.tsx:1700-1708`).
- **Brief was STALE — do NOT do these:** the dead `SatelliteBeams` *mount* is ALREADY
  gone (S-cells-4d); `SatelliteBeams.tsx` STAYS (exports the live `BeamPulseClock` +
  vc1c/vc2 fixtures). `HandoverDecisionOverride` is NOT unwired — it has plumbing in
  `useSimulation.ts:195` + `handover-manager.ts:171,396` + `decision-override.ts`
  (engine-adjacent, Rule#5) → leave it, investigate separately. `sinr-offset.ts` =
  engine, leave (Rule#5).

## 7. Hard rules preserved (governance — do not break)

One viewport = one authoritative lane; display never alters SINR/HO/truth (Rule#6);
serving mosaic ≠ MODQN cell overlay (distinct layers, no cross-lane import); colour
stable-hash, never frame-churn; every serving sat has a beam (`focusSatIds: null`
behaviour); pulse always-on ambient, NOT director-gated; sinr-live never renders the
steered `SatelliteBeams` cones. The lane render boundary (pure resolvers, per-lane
flags) STAYS — it is not the problem (`project_frontend_arch_verdict_2026-06-16`).

## 8. Phasing (small steps, screenshot-verify each, one concern per commit)

- **P0 — Keystone (trust first).** ✅ DONE: added `validate:beam:visual-invariants:browser`
  (atomic coverage read) — it both proved the count-divergence was a read-race AND
  now stands as the regression guard ("done == looks right" for coverage). NEXT: the
  REAL connected-no-beam fix — unify serving colour (E: cone == its UE) + lift cone
  legibility (opacity/width) so served UEs visibly sit under their beam,
  screenshot-verified each. Add the colour-match model invariant. (No render-drop
  fix needed — there was no drop.)
- **P1 — Consolidate.** Introduce `beamDisplaySpec`; migrate the redundant flags +
  knobs into it ONE AT A TIME (delete each as it moves). Collapse 4 HO layers → 1
  (pulse honours `kind`). Fix Bug B (jog without the self-defeating seek). Add
  display-only width/opacity knobs. Delete the verified-dead items (§6).
- **P2 — Cheapen change.** Convert the ~20 governance source-pins → contract pins.
  Write the prompt-control reference (`spec field ↔ visible effect ↔ gate`). After
  this, prompt-driven beam changes are cheap + safe.
- **P3 — Extend the pattern** to the rest of the frontend display (UE panels, etc.);
  MODQN inherits via the shared render.
- **Bug D (inter reality)** is a SEPARATE call, non-blocking: sinr-live inter-HO
  never fires (geometry). Recommend honest "intra-only" labelling now; defer inter
  presentation until geometry/offset changes make it actually occur.

## 9. Open decisions for review (answer these in the review)

1. **Colour authority:** unify serving cones onto the serving-identity colour
   (cones recolour to match their UEs; freq-reuse palette demoted to optional)? *(rec: yes)*
2. **Coverage-gap:** for a genuinely-unlit cell, draw an explicit gap glyph, or keep
   the UE grey (current) + only guarantee served⇒cone? *(rec: served⇒cone via P0
   fix + grey for unserved; gap glyph optional later)*
3. **Bug D:** honest intra-only label now? *(rec: yes)*
4. **Confirm** width/angle stay VISUAL-only multipliers (physics beamwidth locked). *(constraint, not really optional)*

## 10. Non-goals

No engine SINR / golden / baseline-KPI changes. No big-bang rewrite. No new MODQN
trainer. No change to the 4-way `SceneLane` enum or the lane render boundary.
