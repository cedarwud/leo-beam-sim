# Live-SINR + MODQN Shared Beam Stage — Mini-SDD

**Date:** 2026-06-17
**Status:** Design — written in a hot-context discussion session. EXECUTE in a fresh conversation.
**Scope:** `leo-beam-sim` beam/cell RENDER (the "stage") + the live-vs-replay decision boundary, across the SINR-live and MODQN lanes. Does **NOT** touch the SINR engine math, the producer artifacts, or MODQN training.
**Author:** Claude controller, 2026-06-17 architecture discussion with the owner.
**Related:** `docs/sinr-live-earth-fixed-cells-mini-sdd.md` (the earth-fixed-cell model + the free-beam-reverted history), `docs/sinr-live-render-consolidation-sdd.md` (Sessions A–C5, DONE), `docs/frontend-render-governance.md` (the lane redline). Memory: `[[project_beam_stage_shared_render_arch_2026-06-17]]`.

## 0. The conclusion (owner intent, verbatim)

> "live sinr 跟 modqn replay 都要可以動，用各自的換手決策"
> — both the live SINR lane and the MODQN replay must be functional/animated, each driven by its OWN handover-decision logic.

Restated as the architecture: **ONE shared beam "stage" (render primitive + geometry); the decision core diverges per lane.** This IS the governance redline (`docs/frontend-render-governance.md`): *share primitives, diverge proof/source ownership.*

- **Stage (shared):** how a beam is drawn — oblique cone, footprint circle, colour scheme, UE markers. Developed ONCE; `sinr-live` / `modqn-live-cell-preview` / `modqn-replay` all inherit it.
- **Decision core (divergent):**
  - **live SINR** → handover by the live SINR-offset `HandoverManager` (`src/scene/sinrLiveCellModel.ts`).
  - **MODQN replay** → handover by the RECORDED MODQN policy (producer artifact; Q-values → decision). leo REPLAYS, never re-decides (CLAUDE.md #1: leo ≠ a 2nd trainer).

**A layperson must NOT distinguish the two by beam look — and that is correct.** The MODQN difference is the DECISION (Q-values + the ω-counterfactual), surfaced in the proof panel, NOT in the beams. If MODQN were only "beams look different," it would be fake.

## 1. Root diagnosis (this session, file:line-verified)

Original symptom: triggered intra-HO invisible; "波束一定打在 UE 正中央，完全不合理."

The protagonist UE sits dead-centre in its beam — THREE converging facts:
1. The hex cell lattice is generated from axial (0,0) (`cellLayout.ts:187` `[{q:0,r:0}]`), anchored on the observer (`buildCellLayout` ← `observerLatDeg/Lon`), so **cellId 0's centre = ENU (0,0)**. Cell radius = `alt·tan(θ/2)` = 550·tan(0.058/2) ≈ **15.95 km** (`cellLayout.ts:76`).
2. The protagonist UE = observer = ENU (0,0) (`runtimeFrameStep.ts:669-670` `ueEastKm/ueNorthKm`; observer-anchored primary).
3. The intra jog = **+28 km east** (`App.tsx:1594`); the east-neighbour cell centre is at `15.95·√3 ≈ 27.63 km` (`cellLayout.ts:230`). So the protagonist lands ~0.37 km off the NEXT cell centre → **dead-centre before AND after**.

So the intra HO looks like "the beam jumped with the UE," not a handover. The "off-centre milestone" (`SinrLiveCellBeamCones.tsx:5-11`) holds for the 100 SECONDARY UEs (off-axis p95 ≈ 2°, see `sinr-live-earth-fixed-cells-mini-sdd.md` §2/§4) but NOT for the observer-anchored protagonist.

Contributing render defects (same session, measured): intra pulse from/to cones are BOTH `kind:'intra'` → both emerald (`SinrLiveCellBeamCones.tsx:442/451`) → no directional read; the pulse is faint (peak 0.32 fading) + ~250 ms (one 0→2 sample) + drowned by ~26 ambient pulses on the 100-UE scene.

## 2. Architecture verdict (do NOT relitigate)

**Earth-fixed cells STAY. The "free steered beam" alternative is the REVERTED degenerate model — going back is regression.**
- The OLD `resolveLatticeSteering` / `anchorToUe` re-snapped the beam onto the UE (UE centred = the bug), couldn't serve 100 scattered UEs with one beam, and made "intra" a lattice teleport (`sinr-live-earth-fixed-cells-mini-sdd.md` §2.2/2.3). Earth-fixed cells were adopted to ESCAPE it.
- SINR is REAL (`sinrLiveCellModel.ts:16/29/40` `computeLinkBudget`; UE SINR at true off-axis `:149`). The 37 fixed cells are a 3GPP-style earth-fixed reporting grid, NOT an arbitrary snap.
- Beams technically CAN point anywhere (`buildObliqueBeamConePositions(apex, baseCenter, radius)` takes any point) — but "where to point" needs a placement POLICY. Fixed cells = a principled, deterministic, validated answer. Free placement = a beam-placement subsystem (research-grade; that is MODQN's job; CLAUDE.md forbids leo becoming a 2nd optimizer).

→ The fix is NOT a beam-system rewrite. It is a demo/render fix on the leo-owned stage.

## 3. The three pieces (priority order — NOT parallel/big-bang)

### ① Stage fix (live beam geometry) — DO FIRST. leo-owned, low-risk.
Simultaneously (a) solves the original intra-HO-invisible pain and (b) makes the sinr-live + modqn-live stage reasonable (both inherit via the shared `showSinrBeamRender = showSinrLiveViewport || showCellOverlay`, `sceneLaneRenderPlan.ts:163`).
- **Lattice phase:** offset all cell centres so the ORIGIN is a hex vertex/edge, not a cell centre → nothing sits dead-centre at (0,0) → the observer/protagonist sits off-centre. Touch: `axialToLocalKm` (`cellLayout.ts:230-231`) add a phase offset, or a phase param in `buildCellLayout`. OPEN: exact offset (half-cell, direction) — probe.
- **Densify (optional):** raise `SINR_LIVE_CELL_COUNT` (`sinrLiveCellRuntime.ts:53`, now 37) so beams visually hit "anywhere" (fine grid, quantisation invisible) while keeping deterministic placement + clean handover. OPEN: amount vs clutter/perf — probe.
- **Legible footprint circles:** draw the cell footprint disc/ring clearly so the audience SEES UEs scattered off-centre inside the beam circle (already TRUE for the population; make it visible). Touch: a ground-ring layer / cone mount in `MainScene.tsx` + `SinrLiveCellBeamCones.tsx`.
- **Protagonist crosses a REAL boundary:** start the protagonist off-centre near a cell boundary and jog it ACROSS (off-centre both sides), NOT centre→centre. Touch: jog magnitude (`App.tsx:1594`) + possibly decouple the protagonist UE from the exact observer origin (`runtimeFrameStep.ts:669` / `multiUeState.ts:385`). Keep the secondary cloud unmoved (protagonist-only). OPEN: jog distance + protagonist base offset — probe.
- **Intra effect on top (the original v1):** tag the TRIGGERED intra distinct from ambient; from/to colour-split (not both emerald) + sustained ~2–3 s + optional slow-mo. Touch: the pulse resolver + `beamDisplaySpec`.

⚠️ **Truth/golden:** cell positions + protagonist position feed the SINR model → phasing/jog changes will move the `s0:geometry-trace` golden + the UE→cell mosaic membership. This is a LEGIT truth change (deliberate modelling choice) — re-baseline the truth-zero-diff golden carefully + gated (as the beam-floor fix did). It is NOT the frozen Rule#4 baseline-KPIs.

### ② Proof layer (the MODQN differentiator) — the "decision core."
What makes MODQN legible — NOT the beams.
- Q-value panel + decision trace + the **ω-counterfactual slider** (drag 3 weights → decision flips live from RECORDED Q via argmax(ω·Q)) — the ONE genuine MODQN interaction that works NOW (`[[project_modqn_omega_counterfactual_2026-06-15]]`; built ~half).
- For MODQN replay, the handover decisions are the RECORDED policy's (producer artifact). The current artifact is the degenerate baseline (1 sat / 1 beam / 0 HO) → the full proof is producer-blocked (dense-Q export + 4 baseline-defect fixes). The ω-counterfactual works off the staged dense-Q artifact.
- Do NOT fabricate MODQN live decisions (CLAUDE.md #1).

### ③ Universal beam primitive — unify the replay render. SECOND priority.
Make replay reuse the SAME oblique-cone primitive so all lanes share ONE beam look.
- Today: live uses `buildObliqueBeamConePositions` (only `SinrLiveCellBeamCones.tsx:134`); replay uses `modqnReplaySceneVisuals.ts` (`producer-beam-state` / `producer-display-proxy`). SEPARATE render paths.
- Shared foundation already exists: `NormalizedSceneFrame` (both `liveSimToScene` + `showcaseArtifactToScene` produce it, `SceneGeometry.ts`) + `beam-geometry-pure.ts` (shared live+replay formula).
- Target: ONE cone primitive + thin per-lane adapters (live cell engine / producer beam-state). Placement TRUTH stays per-source — leo's phasing/densify does NOT apply to the producer's replay geometry (immutable, Rule#2/#3). Preserve source-backed vs honest display-proxy.
- DEFER: replay CONTENT is producer-blocked (degenerate) → unifying the look has limited payoff until dense-Q ships. Don't invest now.

## 4. Gates (per piece, before declaring done)
- `validate:governance` (pre-commit hook) + `validate:governance:full` (S0–S5 + warm-start + goldens).
- `validate:static:all` after any source-location / cell-layout change.
- Cone/cell render gates: `validate:phase-c:sinr-live-cells:render(:browser)`, `:handover-pulse:render:browser`, `validate:beam:colour-match`, mosaic model.
- `s0:geometry-trace` golden — re-baseline IFF phasing/jog is a deliberate truth change; document the re-baseline.
- Before/after screenshots (repo hard rule): `scripts/_c-capture.ts` (CLICK=director-intra-trigger, UECOUNT=1 to isolate) — sinr-live AND modqn-live (prove "one fix, both inherit").
- `validate:ready` (browser/render smoke) before declaring render work done.

## 5. New-conversation entry point
1. Read this SDD + `docs/sinr-live-earth-fixed-cells-mini-sdd.md` §1/§2 (the free-beam-reverted history) + `docs/frontend-render-governance.md`.
2. Read memory `[[project_beam_stage_shared_render_arch_2026-06-17]]` + the linked arch memories.
3. START with piece ① — a THROWAWAY probe: phase the lattice (+ optional densify), capture sinr-live AND modqn-live, eyeball "protagonist off-centre / beam off (0,0) / one fix both lanes." Show the owner BEFORE any real change (the "10 blind iterations" lesson, `[[project_sinr_render_reset_2026-06-08]]`).
4. Then mini-SDD the real ①, one commit per step, gated, before/after screenshots.

**OPEN questions for the new convo:** exact phase offset; densify amount; protagonist base-offset vs jog-only; golden re-baseline blast radius; intra colour palette + sustain duration; whether to animate protagonist drift vs a jog toggle.
