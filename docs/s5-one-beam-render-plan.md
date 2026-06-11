# S5 — One Beam Render (plan) · the consolidation FINISH-LINE

**Parent:** [frontend-consolidation-program.md](./frontend-consolidation-program.md) §3 S5 ·
[governance-lock-strategy.md](./governance-lock-strategy.md) (QUAR-S5-BEAMRENDER + QUAR-RENDER-RESET) ·
[sinr-live-render-reset-decision.md](./sinr-live-render-reset-decision.md) (the render-STYLE screenshot loop) ·
[frontend-render-governance.md](./frontend-render-governance.md) + [decisions/ADR-001](./decisions/ADR-001-scene-lane-render-boundary.md).
**Slice before:** S4 one serving truth per lane (`16e7207`, COMPLETE, not pushed). **Branch:** `feat/showcase-phase-0`.
**Method:** 6-dimension read-only recon (workflow `wf_d8d3c658-2d7`, 7 agents incl. synthesis, all file:line-cited)
+ controller re-verification of every load-bearing cite against source (the flag cascade, the empty-set
short-circuit, the cap chain, the mount predicates, the focus cap). This doc is the authority for the S5 cut
sequence; write it before touching any render code.

---

## 0. Locked scope (read before deciding anything)

**S5 is the consolidation FINISH-LINE** ([[project_frontend_consolidation_audit_2026-06-10]] user-locked
strategy): once S5 lands, "safe to resume render dev" is reached. S6 (App-bus split) + C1–C3
(camera/timeline/HUD) are demand-driven / deferred — OFF the render-correctness path.

**S5 is the sinr-live RENDER FLIP that S4 explicitly deferred (D1).** S4 unified all the cell-side DATA (one
cell serving record, pun retired, equivalence gated) but left the rendered beam as the STEERED
`<SatelliteBeams>` with the cell cones PARKED. S5 un-parks the cell-truth cones, retires the steered render on
sinr-live, makes the connected-sat-has-beam invariant measure the cone render, flips the two S5-tagged
KNOWN_GAPS to must-hold, and retires BOTH remaining tangle-lock groups (QUAR-RENDER-RESET 4 blocks +
QUAR-S5-BEAMRENDER 11 blocks).

**The render STYLE is decided by a screenshot loop on :3001, NOT by spec** (the user rejected a washed
viewport twice over ~10 blind rounds — `sceneLaneRenderPlan.ts:126-131`, `MainScene.tsx:145-151`). Do NOT
iterate render style blind. A working browser capture loop is a HARD prerequisite for the flip commit.

**S5 changes NO truth.** The cell model already self-overrides 50° steering / 33.5 dBi / 3.32° beamwidth / 37
cells internally (`sinrLiveCellRuntime.ts:85-97,166-178`); the profile JSON, the runtime SINR/handover truth,
and `sim.sinrLiveCells` are untouched. `truth.*` geometry-trace stays ZERO-diff throughout; the rendered-beam
geometry change is display-layer (declared via `S0_TRACE_IGNORE` + re-baselined in the flip commit).

---

## 1. The disease, precisely (what the recon established and the controller re-verified)

### 1.1 The flip is one flag + one anchor, and it cascades

The single load-bearing switch is `sceneLaneRenderPlan.ts:132` — a hard literal
`const showSinrLiveCellBeams = false;`. Three MainScene JSX gates are ALREADY wired to it (verified):

- `MainScene.tsx:1529` ambient cone mount: `{showSinrLiveCellBeams && <SinrLiveCellBeamCones items={sinrLiveCellBeamConeItems} />}` — dead today (flag false).
- `MainScene.tsx:1542` steered mount: `{SHOW_BEAMS && showLiveBeamCones && !showCellOverlay && !showSinrLiveCellBeams && viz.displaySats…}` — the `&& !showSinrLiveCellBeams` term auto-suppresses the steered render the instant the flag flips.
- `MainScene.tsx:1532` D4 focus-pair mount: independent of the flag (fires on `sinrLiveCellHandoverPairConeItems.length > 0` during cinema) — so after un-park it can DOUBLE-DRAW a focused cone already in the ambient set (open render-composition question, screenshot it).

The companion edit the flag does NOT cover: `MainScene.tsx:797` passes `false` (disableUeAnchor, last positional
arg to `useBeamViz`) under the comment "restore the UE-anchor (false = anchor ON)". With cones live the anchor
must be retired (`true`) so beams keep true earth-fixed positions and UEs render off-centre (the
reset-decision doc §LOCKED.2). `useBeamViz.ts:650` already implements `!disableUeAnchor`.

**Both edits MUST be lane-gated** (`= showSinrLiveViewport` / `sceneLane === 'sinr-live'`), NOT bare literals —
a bare `true` would un-park cones / retire the anchor on `modqn-live-cell-preview` (which still renders steered
beams). The sibling lanes (`modqn-live-cell-preview`, `modqn-replay-proof`, `artifact-replay`) are otherwise
structurally isolated (every relevant flag derives from `showSinrLiveViewport === 'sinr-live' && isLiveScene`).

The cone DATA/geometry path is fully built and pure (ZERO new geometry code): `sinrLiveCellPlacementById`
(`buildSinrLiveCellLayout(profile)`, the cone BASE) + `satelliteWorldById` (the cone APEX) feed
`resolveSinrLiveCellBeamConeItems` (`SinrLiveCellBeamCones.tsx:180`), which draws one cone per `beam.serving`.

### 1.2 The must-hold flip is coupled to the flip — and breaks the gate if done naively

`connectedSatBeamInvariant.resolveSteeredVisibleBeamSatIds` (`:126-139`) **hard-returns an EMPTY set whenever
`plan.showSinrLiveCellBeams` is true** (the `|| plan.showSinrLiveCellBeams` short-circuit at `:130`,
controller-verified). So the moment S5 flips the flag, the invariant's `visibleBeamSatIds` collapses to `{}` →
EVERY connected claim — including the always-green `primary-serving` must-hold — has no visible beam and the
gate goes fully RED.

⟹ **The flip is causally inseparable from re-pointing the invariant's visible-beam oracle to the CELL-CONE
set.** `classifyViolation` (`:141-158`) maps every `cell-truth-serving` claim unconditionally to the known-gap
(`:155-156`); both S5-tagged gaps live in `KNOWN_GAPS` (`:42-62`).

### 1.3 The display cap gates which truth cones can draw (the load-bearing dependency)

`satelliteWorldById` (the cone APEX source, `MainScene.tsx:838`) is built ONLY from `viz.displaySats`, which
`useBeamViz.ts:448` slices to `MAX_DISPLAY_SATS = 12` (`beamVizModel.ts:7`), with a `-500` penalty below 35°
elevation (`useBeamViz.ts:440`) while the cell model admits sats down to 15°. `resolveSinrLiveCellBeamConeItems`
**silently drops any serving beam whose sat is absent from that map** (`SinrLiveCellBeamCones.tsx:193:
if (!placement || !satWorld) continue`). On top of that the ambient layer is narrowed to ONE sat by
`SINR_LIVE_CONE_MAX_FOCUS_SATS = 1` (`MainScene.tsx:151`, force-includes the primary-UE serving sat).

So **two caps gate cone draw**: the top-12 display cap (truth-cap risk) and the focus=1 cap (the dominant
visible cap — 5–7 of the 6–8 serving sats get no cone today). Both must lift before the must-hold flip, or the
gate goes RED for legitimately-capped serving sats.

**Constraint (controller-verified):** `satelliteWorldById`, `satelliteTintById`, and `cellSchedule` are ALL
built from `viz.displaySats`, and `CellOverlay`/`CellHandoverArcs`/`CellBeamCones`/handover-story (MODQN lane)
also consume `satelliteWorldById`. **Widening `MAX_DISPLAY_SATS` would churn satellite tint + cell schedule +
MODQN-lane cones → a real `geometry-trace` truth/tint diff.** The cap fix MUST be a SEPARATE cone-only,
serving-sat-complete apex map (union the cell-frame serving sats' world positions), leaving `displaySats`
untouched. (The cone BASE map `sinrLiveCellPlacementById` is already independent of `displaySats` — only the
APEX needs the complete map.)

### 1.4 The primary/population claims use a different (steered) oracle

`frame.serving.satId` (the `primary-serving` claim) is the STEERED primary HandoverManager
(`runtimeFrameStep.ts:960-964`), and `population-aggregate` reads `perUePositions` secondary managers — a
THIRD oracle. After the steered render retires, the steered primary sat may serve no cell → its always-green
must-hold goes RED unless the claim is re-sourced to the cell-truth primary UE (`sim.sinrLiveCells.ues[0]`).
This is **Decision D-ORACLE** (§4) — forced by honesty + the must-hold (the alternative, force-drawing a cone
for a sat the cell model does not serve, fabricates a serving beam).

### 1.5 The two oracles the render currently splits

| Oracle | Today | Drives | After S5 |
|---|---|---|---|
| Steered `<SatelliteBeams>` (`MainScene:1542`, profile 40 dBi / 12°) | the sinr-live RENDER | InfoPanel ACTIVE SERVING, the steered cones | RETIRED on sinr-live (gate auto-suppresses); stays the `modqn-live-cell-preview` render |
| Cell-truth cones (`SinrLiveCellBeamCones`, 33.5 dBi / 50° / 37 cells) | PARKED (flag false) + D4 focus pair | mosaic dots, served-N/N, perUePositions, cone DATA, cinema events (all S4-unified) | the sinr-live RENDER (un-parked) |

S5 collapses these two physical oracles on the ONE sinr-live viewport into ONE cone renderer + ONE shared
selection resolver. `CellBeamCones` (MODQN lane) and `CandidateBeamHighlight` (sinr-live director overlay) are
legitimately separate and stay.

---

## 2. The target shape

```
   sim.sinrLiveCells  (the ONE cell serving record — S4-unified, pun retired)
        │
        ▼
   resolveSinrLiveCellBeamConeItems  ── ONE shared pure selector ──┬──► MainScene cone mount (the sinr-live RENDER)
   (+ serving-sat-complete cone-apex map, display cap at DRAW)     └──► connectedSatBeamInvariant visible-beam set
        │                                                                 (replica retired — same output, divergence impossible)
        ▼
   ONE style token module (src/constants/sinrLiveConeStyle.ts): opacity / blending / colour-mode / focus cap
        │
        ▼
   connected-sat-has-beam: cell-truth-serving + population → MUST-HOLD (cones beam every serving sat)
```

- **ONE pure beam selector** consumed by BOTH the MainScene mount AND the invariant (retiring the
  `resolveSteeredVisibleBeamSatIds` REPLICA, `connectedSatBeamInvariant.ts:115-139`).
- **ONE cone renderer per lane** (sinr-live = `SinrLiveCellBeamCones`; the steered render leaves the lane).
- **ONE style token module** absorbing `SINR_LIVE_CELL_CONE_OPACITY`, `OBLIQUE_CONE_SEGMENTS`, the
  `NormalBlending` choice, the freq-reuse-vs-tint colour selector, and `SINR_LIVE_CONE_MAX_FOCUS_SATS`.
- **The steered primary `frame.serving` stays the truth** (it still feeds satellite identity/tint, the mosaic
  fallback, event roles) — only the steered cone MOUNT leaves the lane, and only the invariant's primary CLAIM
  is re-sourced to cell-truth (D-ORACLE).

---

## 3. Cut sequence

Discipline (unchanged from S0–S4): each sub-slice = its own non-vacuous BEHAVIOR gate; `truth.*`
geometry-trace ZERO-diff (display-layer changes declared via `S0_TRACE_IGNORE` + re-baselined same commit);
Workflow 3-lens adversarial review + positive-control mutation (RED) before commit; `lint = npm run lint`; no
push without asking. **Before the flip commit, the browser screenshot loop MUST be confirmed working (§7).**

### S5-1 · Shared visible-beam resolver + invariant delegation + disposition checklist (PREP — ZERO-diff, no flip, no governance retire)

Extract the keystone replacement (the ONE shared visible-beam resolver) and prove it byte-identical while the
cones are still parked, **without touching any QUAR-pinned source text and without flipping the flag** (truth +
display BYTE-IDENTICAL):

1. **Empirical baseline** (closes the recon's #1 completeness gap): `validate:s0:connected-sat-has-beam` →
   confirmed **760** `two-serving-oracles-cell-vs-steered` (first t=0 `shell-polar-P22-S2`) + **1**
   `population-beyond-display-cap` (t=275s `shell-retro-125-P0-S5`), primary must-hold green, PASS. The 760 is
   dominated by the focus=1 cap; the 1 is the only top-12 overflow.
2. **ONE shared visible-beam resolver** `src/scene/sinrLiveBeamSelection.ts`:
   `resolveSinrLiveVisibleBeamSatIds({ viz, plan, coneSatIds? })` — when `plan.showSinrLiveCellBeams` is true it
   returns the cone-rendered set (`coneSatIds`), else the steered set (`displaySats ∩ beamSatIds ∩ satBeams>0`,
   the exact current `resolveSteeredVisibleBeamSatIds` logic). Move `SteeredMountPlanFlags` here.
3. **`connectedSatBeamInvariant` delegates** its `resolveSteeredVisibleBeamSatIds` to the shared resolver (thin
   wrapper, `coneSatIds` undefined) — BYTE-IDENTICAL for all inputs while cones parked (the cone branch is dead
   until S5-2 passes `coneSatIds`). `connectedSatBeamInvariant` is NOT QUAR-pinned, so this is free; the
   `MainScene` inline mount predicate (QUAR-RENDER-RESET-pinned) is NOT touched yet — it consumes the shared
   resolver only in S5-2 when the group retires.
4. **Per-assert disposition checklist of all 15 governance blocks** (§9 appendix, authored here) — the line-by-
   line map confirming each needle's surviving replacement BEFORE any wholesale deletion. Resolves the R2/R5
   contested block 2626 (replay-host/doc-prose re-homing vs matrix coverage).
5. **Gate `validate:s5:shared-cone-selector`** (net-new): (a) the shared resolver's steered branch == the
   documented steered logic on the real candidate-rich frame across the window (non-vacuous, set non-empty) AND
   `connectedSatBeamInvariant.resolveSteeredVisibleBeamSatIds` delegates identically; (b) the cone branch —
   `plan.showSinrLiveCellBeams=true` + a `coneSatIds` set → returns exactly those satIds; crippling a cone satId
   drops it (the NEW positive control that replaces the steered-cripple one post-flip); (c) A==B determinism.

ZERO-diff (truth + display): cones still parked, flag still false, no MainScene render change, no QUAR-pinned
text touched. No group retires. **Risk: LOW** — the resolver is provably behavior-invariant (the cone branch is
only reachable with an explicit `coneSatIds`, which nothing passes until S5-2). The serving-sat-complete cone-
apex map (cap fix) + the style-token module land in S5-2, where they go LIVE and are wired into MainScene.

### S5-2 · The render flip (DISPLAY change — un-park cones, retire steered render, anchor flip, retire BOTH governance groups, screenshot-driven style)

The irreducible atomic core (see §3.1 below for why it cannot split):

1. `sceneLaneRenderPlan.ts:132` `false` → `= showSinrLiveViewport` (mirrors `showSinrServingMosaic:125` —
   inert on modqn/artifact lanes).
2. `MainScene.tsx:797` anchor `false` → sinr-live-gated `true`.
3. Raise the focus cap per D-STYLE (focusSatIds → null draws all serving sats — handles ~759/760) and build the
   **serving-sat-complete cone-apex map** (the cap fix for the residual ~1): a SEPARATE cone-only map (reuse
   `satelliteRenderProjection.ts` to project any cell-serving sat absent from `viz.displaySats`), NOT a widening
   of `displaySats` (which would churn tint/cellSchedule → truth diff, §1.3). Build only if the empirical
   residual > 0 after the focus-cap raise. The steered mount auto-suppresses (`&& !showSinrLiveCellBeams`).
4. Wire the `MainScene` cone mount + the `connectedSatBeamInvariant` visible-beam oracle to BOTH consume the
   S5-1 shared resolver (now passing `coneSatIds` live) + re-source the primary/population claims to cell-truth
   (D-ORACLE). Leave the `cell-truth-serving`/`population` CLASSIFICATION as known-gap for now (count drops to
   ~0 because cones now beam every serving sat → gate GREEN); S5-3 enforces it as must-hold.
5. Build the **style-token module** `src/constants/sinrLiveConeStyle.ts` (absorb `SINR_LIVE_CELL_CONE_OPACITY`,
   `OBLIQUE_CONE_SEGMENTS`, the `NormalBlending` choice, the freq-reuse colour selector, `SINR_LIVE_CONE_MAX_FOCUS_SATS`)
   and import it into `SinrLiveCellBeamCones`/`MainScene`; **tune opacity + focus cap by the screenshot loop on
   :3001** (§7) until 好看 + handovers visible (→ hybrid: faint all-serving + bright handover pair).
6. **Retire BOTH groups wholesale + their registry entries** (the per-block map, §5): the flip changes text
   pinned by RENDER-RESET (`= false`, steered-restore wiring) AND S5-BEAMRENDER (cone JSX/selector/style text).
   Land all replacement behavior gates: flipped render-plan matrix (cones true on sinr-live, false on the 3
   siblings), re-added `validate:phase-c:sinr-live-cells:render:browser`, the cone-base==cell-centre geometry
   invariant, the style-token VALUE asserts, and the confirmed dispositions for the MODQN/effects/replay blocks.
7. `geometry-trace`: declare the display-layer file prefixes via `S0_TRACE_IGNORE`
   (`sceneLaneRenderPlan.ts`, `MainScene.tsx`, `SinrLiveCellBeamCones.tsx`, `useBeamViz.ts`) + RE-BASELINE the
   golden in this commit. `truth.*` ZERO-diff.

**Risk: HIGH** — the slice the user rejected twice; STYLE is taste; a working :3001 capture loop is mandatory.
Resolve the ambient-vs-D4-pair double-draw and the CandidateBeamHighlight composition by screenshot.

#### 3.1 Why S5-2 is one atomic commit (not splittable)

The flag flip → empties the steered visible oracle (`:130`) → forces the cone oracle re-point in the SAME
commit (else primary-serving must-hold goes RED). The cone oracle needs the cap-complete apex (from S5-1) AND a
raised focus cap (changes `:1823`-pinned text) → S5-BEAMRENDER must retire here. The un-park changes
`:132`/`:1712`/`:1750`-pinned text → RENDER-RESET must retire here. A group retires ONLY wholesale + only with
its replacement (rule 1) and a needle may NOT be patched before its slice (rule 2). There is no green
intermediate tree between "flag flipped" and "oracle re-pointed + groups retired", so they are one commit. S5-1
pre-builds the heavy pieces so S5-2's NEW code is small (2 flag/anchor edits + wiring the prebuilt selector +
deleting 15 wrapper bodies + flipping matrix asserts).

### S5-3 · Must-hold enforcement (tiny — classification flip + KNOWN_GAPS deletion)

After S5-2 proves the count is 0 in the working tree:

1. `classifyViolation`: `cell-truth-serving` → `must-hold`; `population-aggregate` non-primary → `must-hold`.
2. Delete the two `KNOWN_GAPS` entries (`two-serving-oracles-cell-vs-steered`, `population-beyond-display-cap`).
3. Gate: `validate:s0:connected-sat-has-beam` stays GREEN but now ENFORCES 0 cell/population must-hold;
   positive control = cripple a cell cone → must-hold RED.

`truth.*` ZERO-diff (invariant-only change). **Decision D-MUSTHOLD-SCOPE** (§4) — flip both vs one — is decided
EMPIRICALLY by the S5-2 count (flip both iff 0/0; else flip only the oracle gap and bump the population-cap
retiringSlice rather than leave it mislabeled).

> **S5-2 + S5-3 may be merged into one commit** if the empirical 0/0 is clean and a reviewer prefers retiring
> S5-BEAMRENDER together with its full "connected-sat per lane" must-hold replacement. Kept separate here so the
> must-hold gets its own positive-control gate and a reviewable diff; controller decides at impl.

### S5-4 · Dead-code deletions (DEFERRED — demand-driven, off the render-correctness path)

The program §3 S5 lists deletions that are NOT on the flip critical path; defer unless a later task forces them:
`SinrOffsetPolicy` class (verified dead, 69 lines not 486 — never instantiated/imported), `EarthFixedCells`
component (mounted only in a test fixture; flag pinned false), the dead `CellFootprints` component (relocate its
`WorldPoint` type to a non-component module FIRST — 4 live importers), `SHOW_BEAMS` const (no-op gate). The
"fabricated modqn candidate fan" (`showModqnCandidateBeams`) is **NOT dead** — it is live on `modqn-demo`, off
the sinr-live flip; its removal is a separate modqn-lane honesty cleanup with its own gate, NOT S5 scope.

---

## 4. Genuine decisions (USER-LOCKED 2026-06-11)

**Outcome: D-STYLE = A (start) → converge to HYBRID (faint all-serving cones + bright handover pair); fall to
C if it washes. D-ORACLE = A (unify onto cell-truth).** Both confirmed by the user after the controller surfaced
the load-bearing coupling below.

**🔴 KEY COUPLING (the reason B is off the table): the must-hold flip requires EVERY cell-serving sat to be
beamed.** `connected-sat-has-beam` collects one `cell-truth-serving` claim per serving illuminated beam (6–8
sats); flipping the 760 gap to must-hold means every one must be in the cone-visible set. So **B (only 1–2
cones) is INCOMPATIBLE with the must-hold flip** — 5–7 serving sats would be must-hold RED, and S5 would not be
the finish-line. The dominant cause of the 760 today is the focus=1 cap (5–7 of 6–8 serving sats uncone'd), NOT
the top-12 display cap (only the 1 population-cap claim-step actually exceeds display reach). So: raising the
focus cap to draw all serving sats handles ~759 of the 760; the serving-sat-complete apex map (§1.3) handles the
residual ~1. The breadth is therefore NOT a free style choice if the gap is to flip; only the
opacity/blend/emphasis is the screenshot-loop STYLE lever (→ hybrid: faint all + bright pair).

- **D-STYLE (LOCKED = A → hybrid) — render-style start point for the un-parked cones.**
  - **A (recommended):** all serving sats, NormalBlending, freq-reuse colour, opacity ~0.18–0.22; raise
    `SINR_LIVE_CONE_MAX_FOCUS_SATS` above 1 so multiple serving sats show; tune opacity/cap DOWN by screenshot.
  - **B:** focus-subset — keep the cap low (1–2), always force-include the primary-UE serving sat, breadth stays
    in the mosaic dots.
  - **C:** ground footprint discs + thin sat→cell lines (least washout, loses the sky-beam look).

  All three primitives already exist (config choice, not code; reversible per screenshot). A matches the
  reset-decision doc default; the user rejected full-ambient additive cones before, so the screenshot loop is
  mandatory. **This is taste (好看) with no spec answer — must be user-chosen.**

- **D-ORACLE (LOCKED = A) — primary/population serving on sinr-live follows the CELL-truth model.**
  Recommended **A: re-source `primary-serving` (`frame.serving`) and `population-aggregate` to `sim.sinrLiveCells.ues`
  on the cone lane** — one oracle for all three claim surfaces (matches the S4 mosaic re-point). Forced by
  honesty + the must-hold: keeping the steered primary risks its must-hold going RED on a sat the cell model
  doesn't serve, and force-drawing its cone would fabricate a serving beam. **This changes what the InfoPanel
  "ACTIVE SERVING" primary sat resolves against on sinr-live** — surfaced for awareness/confirmation.

- **D-MUSTHOLD-SCOPE (non-blocking, decided empirically at S5-2) — flip both gaps or one.** Recommended flip
  BOTH (they share the `satelliteWorldById` root cause) iff the S5-2 working-tree count is 0/0; else flip only
  the oracle gap and explicitly bump the population-cap `retiringSlice`.

- **D-STEERED-DELETE (non-blocking, default = re-gate) — keep `SatelliteBeams` mountable.** Re-gate off on
  sinr-live (the existing `&& !showSinrLiveCellBeams` term does this automatically); do NOT delete the component
  (still the `modqn-live-cell-preview` render; a prior 1-line flip broke the scene — keep the proven-good look
  in tree for one slice). Deletion is S5-4 / a later cleanup.

- **D-TOKEN (default chosen, not asked) — new `src/constants/sinrLiveConeStyle.ts`** rather than extending the
  479-line shared `beamRoleTokens.ts` (smaller blast radius during a frozen-beam slice; cleaner VALUE asserts).

---

## 5. Governance retirement map (15 blocks — load-bearing; delete by EXACT line span)

⚠️ **The 11 + 4 wrapper blocks are NON-contiguous and INTERLEAVED with PERMANENT asserts that MUST NOT be
deleted.** Delete only the `tangleLockGroup('…', () => { … })` wrapper bodies, by exact line span, verified
against this inventory. Misdeleting an adjacent permanent assert silently re-opens a truth/render-discipline
regression.

**PERMANENT asserts inside the QUAR-S5 source region — KEEP (do NOT delete with the group):** effective-steering
filter (`gov:1961-1965`), profile-mutation ban (`:1969-1973`), gain↔beamwidth self-consistency (`:1977-1981`),
BLOCK-3 scheduler-import bans (`:1772-1786`), FIX-7 anti-regression `deriveBeamLoadContention(sim.perUePositions`
(`:2130-2134`), R3F discipline no-useFrame/no-new-Mesh/no-dispose (`:2177-2191`), mesh-telemetry observables
(`:2204-2227`), additive cell-truth import-boundary/optional-field asserts (`:1634-1690`), the sibling-lane
matrix asserts adjacent to block 291 (`:304-317`).

### QUAR-RENDER-RESET (4 blocks — retire in S5-2)

| Block | Pins (parked state) | Replacement |
|---|---|---|
| `291` | render-plan matrix: `showSinrLiveCellBeams===false` on sinr-live (default + director) | FLIP the matrix to expect TRUE on sinr-live; the 3 sibling asserts at `304-317` (false on modqn/artifact) STAY |
| `1712` | literal `const showSinrLiveCellBeams = false;` | deleted by the `:132` edit; covered by the flipped matrix |
| `1750` | steered-restore wiring `&& !showSinrLiveCellBeams && viz.displaySats` + `disableUeAnchor?:boolean`/`!disableUeAnchor` | the steered-retirement point — covered by the shared selector + cone-mounted matrix |
| `1812` | package.json negative lock banning `render:browser` from `validate:live-render` | RE-ADD `validate:phase-c:sinr-live-cells:render:browser` to the suite (script `package.json:136` already exists) |

### QUAR-S5-BEAMRENDER (11 blocks — retire in S5-2/S5-3)

| Block | Pins | Replacement | Pin type |
|---|---|---|---|
| `1559` | mosaic colour-oracle selection (the 2 S4-3 re-wrapped needles: `if (!showSinrServingMosaic) return null;` + `buildSinrServingUeColorMapFromCells(cellFrame.ues)`) | EXTEND `validate:s4:serving-equivalence` + the shared selector (re-point to steered → RED) | layer-wiring text lock |
| `1721` | D4 focus-pair cone JSX + `…PairConeRenderedCount` telemetry key + `sourceOwner !== 'sinr-live-cell-truth'` guard | the per-lane cone render:browser mesh-telemetry gate | JSX mount-string + mesh micro-pin |
| `1791` | `buildSinrLiveCellLayout(profile)` (cone placement from the truth layout) | NET-NEW geometry invariant: cone base == `sim.sinrLiveCells` cell centre | layer-wiring text lock |
| `1823` | serving-only cone `if (!beam.serving) continue;`, `resolveTopServingFocusSatIds`, `color: frequencyReuseColor(...)`, `blending={THREE.NormalBlending}`, focus-scoping call | the must-hold FLIP (the block's own comment names connected-sat-has-beam as its intent) + the style-token VALUE asserts | layer-wiring + style token pins |
| `1897` | EarthFixedCells retired: `showEarthFixedCells: false,` + no `<EarthFixedCells` | fold "one cell layout per viewport" into the per-lane cone-renderer matrix assert | parked-state pin |
| `2025` | LARGEST — MODQN-lane cell render wiring (`deriveProfileHandoverStoryModel`, `deriveModqnServiceMap`, `markerColor: mosaic?.markerColor ?? service?.markerColor` fallback, CellOverlay/HandoverStoryLayer/CellBeamCones mounts) | shared selector owns the markerColor merge; MODQN lane gating already in the permanent matrix (`gov:2609-2622`) — **per-assert disposition required** | JSX mount-string + layer-wiring |
| `2123` | FIX-7 contention source `deriveBeamLoadContention([...modqnServiceMap...])` | shared selector certifies the source; the anti-regression ban at `2130-2134` is OUTSIDE the wrapper → STAYS | layer-wiring text lock |
| `2135` | focused beam-load cylinder wiring + mesh micro-pins (`mesh.visible`, `mesh.scale.set`) | permanent mesh-telemetry `beamLoadCylinderRendered` (`2204-2208`); R3F discipline `2177-2191` OUTSIDE → STAYS | JSX mount-string + mesh micro-pin |
| `2192` | single import-presence pin `import { BeamLoadUploadParticles }` | permanent `uploadParticleRenderedCount` observable (`2209-2218`) | import-presence micro-pin |
| `2229` | upload-particle mount + props wiring (`explain-handover` preset, `focus-satellite` scope) | the upload-particle observable + cap-helper asserts `2290-2334` (OUTSIDE → STAY); fold the preset gate into the cone-renderer lane/preset matrix | JSX mount-string + layer-wiring |
| `2626` | BROADEST — whitespace-exact live-effects/cinematic JSX (`AmbientFootprintRings`, `HandoverLinks`, `IntraHandoverArrow`, `fogExp2`, point lights) **and (R2) replay-layer host / `useReplaySceneTelemetry` / 4 doc-prose asserts** | **CONTESTED (R2 vs R5): REQUIRED per-assert disposition.** Confirm each maps to a permanent gate (showLiveSceneEffects matrix `2614-2618` / showCinematicSpotlight) OR re-home the replay-host/doc-prose asserts to a permanent gate BEFORE deleting | JSX mount-string (whitespace-exact) + (contested) replay/doc locks |

**Three named deliverables (tangle-locks.ts:66-70 contract):** ONE pure beam selector under invariant tests
(incl. connected-sat-has-beam per lane) · ONE cone renderer per lane with mesh-derived telemetry gates · ONE
style token module. **Atomic retirement:** delete the registry entries (`tangle-locks.ts:39-44` RENDER-RESET +
`:66-70` S5-BEAMRENDER) AND all wrapper blocks in the retiring commit (else `assertAndSummarizeTangleLockGroups`
throws), and mark the `governance-lock-strategy.md:34/37` rows RETIRED.

---

## 6. Explicitly OUT of S5 scope

- **App-bus split / runtime memo identity** (`runtime` object re-render churn) → S6 (deferred).
- **Camera/cinema content-aware framing** (uses S4 event geometry) → C1 (deferred).
- **`SinrOffsetPolicy` / `EarthFixedCells` / `CellFootprints` / `SHOW_BEAMS` deletions** → S5-4 (demand-driven).
- **`showModqnCandidateBeams` fabricated fan** → NOT dead (live on modqn-demo); separate modqn-lane cleanup.
- **S1c cos-lat / "satellites above nadir"** → blocked on producer data (separate fork).
- **Producer dense-Q MODQN proof** → PARALLEL track, HEAVY/Ubuntu, not blocked on S5
  (`docs/handoff/producer-dense-q-export-request.md`).

---

## 7. Verification protocol (every sub-slice)

1. `npm run lint` (tsc --noEmit; there is no `typecheck` script).
2. **Browser FIRST for S5-2** (HARD prerequisite): confirm a fresh Vite dev server on :3001 (the WSL2 browse
   daemon was stuck on `about:blank` — kill + restart; fallback `--port 3000`, gates use
   `APP_URL=http://localhost:3000`). Confirm `scripts/p2-capture-sinr-live.ts` writes a NON-BLANK PNG
   (`output/p2/sinr-live-canvas.png`) — a blank canvas IS the about:blank symptom. **Do NOT touch render code
   until the capture loop works.**
3. `validate:s0:geometry-trace` — `truth.*` ZERO-diff. S5-2 is the only sub-slice touching display geometry →
   declare the file prefixes via `S0_TRACE_IGNORE` + re-baseline in that commit.
4. `validate:s0:connected-sat-has-beam` — S5-1 captures the baseline; S5-2 must show the cell/population
   known-gap counts → 0 in the working tree BEFORE S5-3 flips the classification; S5-3 enforces it as must-hold
   with a cone-cripple positive control.
5. The sub-slice's own new `validate:s5:*` gate (non-vacuous + A==B + positive-control mutation RED).
6. `validate:phase-c:sinr-live-cells:model/render/render:browser` + `:sinr-serving-mosaic:model/browser` —
   green; `render:browser` re-added to `validate:live-render` in S5-2.
7. `validate:frontend:scene-lane-governance` — the flipped matrix + retired groups + preserved permanent
   asserts; `assertAndSummarizeTangleLockGroups` no longer expects the 2 retired groups.
8. **Screenshot loop on :3001** (S5-2): capture before (steered) / after (cones), show the user, react, tune
   knobs / switch A↔B↔C, re-shoot until 好看 + handover visible. The steered baseline screenshot is the
   before-anchor.
9. Workflow 3-lens adversarial review before each commit (codex exec times out here) + positive-control
   mutation verify each new gate goes RED on the inverted change.
10. Restore validator side-effect PNGs; confirm clean tree. Do not push without asking.

**Recommended order:** S5-1 (prep, ZERO-diff, de-risks) → S5-2 (the flip, screenshot-driven, retire both
groups) → S5-3 (must-hold enforcement). S5-4 deferred.

---

## 8. Recon contradictions resolved + completeness gaps to close at impl

**Contradictions (controller-resolved):**
- `S0_TRACE_IGNORE` IS the literal env var (`validate-s0-geometry-trace.tsx` reads `process.env.S0_TRACE_IGNORE`)
  — R6 over-corrected; use the literal mechanism.
- `satelliteWorldById` is NOT isolated from MODQN lanes (R1's "isolated" understates it) — verified shared with
  tint/cellSchedule/CellOverlay/CellHandoverArcs/CellBeamCones → the cap fix MUST be a separate cone-only apex
  map (§1.3), confirmed.
- Block 2626 scope (R2 broad/needs-re-homing vs R5 covered-by-matrix) → REQUIRED per-assert disposition in S5-1.
- Focus-cap framing (R3 "latent style" vs R4 "hard must-hold blocker") → the cap MUST rise enough that every
  SERVING sat draws (must-hold); breadth/opacity beyond that is the screenshot-loop STYLE choice.
- `SinrOffsetPolicy` is 69 lines, not the program's "486" — doc error, deadness holds.

**Completeness gaps to close at impl (NOT in the read-only recon):**
- The empirical 760+1 → 0/0-vs-residual is UNVERIFIABLE read-only → S5-1 step 1 measures it (gate run).
- FPS/mesh-perf at full cone population (6–8 sats × ≤7 hopping beams ≈ 40–56 cones) → screenshot-loop perf check.
- The ambient-vs-D4-pair double-draw opacity + CandidateBeamHighlight composition → screenshot questions in S5-2.
- The geometry-trace golden file path + re-baseline command → locate before S5-2.
- Browser readiness was NOT tested by the read-only recon → task #4, before S5-2.

---

## 9. Per-assert disposition ledger (authored in S5-1; the pre-deletion verification for S5-2)

Before S5-2 deletes the 15 wrapper blocks WHOLESALE, every needle must have a surviving replacement. This ledger
is the checklist. **Status legend:** `EXIST` = already covered by a live permanent/behavior gate · `EXTEND` =
extend an existing gate · `NEW` = author in the retiring commit · `MATRIX` = the permanent renderPlan behavioral
matrix already asserts the lane-gating property · `✅verified` = controller read the exact wrapper span in S5-1.

### QUAR-RENDER-RESET (4) — retire in S5-2

| Block | Disposition | Status |
|---|---|---|
| `291` parked matrix `showSinrLiveCellBeams===false` (sinr-live) | FLIP the matrix to expect TRUE on sinr-live; siblings `304-317` (false on modqn/artifact) are OUTSIDE the wrapper → survive | EXTEND |
| `1712` literal `const showSinrLiveCellBeams = false;` | deleted by the `:132` edit; the flipped `291` matrix is the behavior | MATRIX |
| `1750` steered-restore `&& !showSinrLiveCellBeams && viz.displaySats` + `disableUeAnchor` | the shared resolver (S5-1) + the cone-mounted matrix | EXIST(S5-1)+EXTEND |
| `1812` package.json ban of `render:browser` from `validate:live-render` | RE-ADD `validate:phase-c:sinr-live-cells:render:browser` (script `package.json:136` exists) | NEW(suite) |

### QUAR-S5-BEAMRENDER (11) — retire in S5-2/S5-3

| Block | Disposition | Status |
|---|---|---|
| `1559` mosaic colour-oracle (the 2 S4-3 re-wrapped needles) | EXTEND `validate:s4:serving-equivalence` + the shared selector (re-point to steered → red) | EXTEND |
| `1721` D4 focus-pair cone JSX + telemetry key + sourceOwner guard | the per-lane cone `render:browser` mesh-telemetry gate (re-added per `1812`) | EXIST/NEW(suite) |
| `1791` `buildSinrLiveCellLayout(profile)` cone placement | NEW cone-base==cell-centre geometry invariant | NEW |
| `1823` serving-only cone + `resolveTopServingFocusSatIds` + `frequencyReuseColor`/`NormalBlending` | the must-hold FLIP (S5-3) + the style-token VALUE asserts (S5-2) | NEW |
| `1897` EarthFixedCells retired (`showEarthFixedCells:false` + no `<EarthFixedCells`) | fold "one cell layout per viewport" into the per-lane cone-renderer matrix | EXTEND |
| `2025` MODQN-lane cell render wiring (`deriveModqnServiceMap`, `markerColor` fallback, CellOverlay/HandoverStoryLayer/CellBeamCones) | MODQN lane gating already in the permanent matrix (`gov:2609-2622`); the markerColor merge → the shared selector | MATRIX+EXTEND |
| `2123` FIX-7 contention source `deriveBeamLoadContention([...modqnServiceMap...])` | shared selector certifies; the anti-regression ban `2130-2134` is OUTSIDE → survives | MATRIX |
| `2135` focused beam-load cylinder + mesh micro-pins | permanent `beamLoadCylinderRendered` telemetry `2204-2208`; R3F discipline `2177-2191` OUTSIDE → survives | EXIST |
| `2192` `import { BeamLoadUploadParticles }` presence | permanent `uploadParticleRenderedCount` `2209-2218` | EXIST |
| `2229` upload-particle mount/props (`explain-handover`/`focus-satellite`) | the upload-particle observable + cap-helper asserts `2290-2334` (OUTSIDE → survive); fold preset gate into the cone-renderer matrix | EXIST+EXTEND |
| `2626` **✅verified — wrapper is ONLY lines 2627-2642** (5 `showLiveSceneEffects`/toast MainScene gates + 2 `cinematicSpotlight` BaseSceneLayout gates). The replay-layer host / `useReplaySceneTelemetry` / `removeReplayCanvasAttributes` / doc-prose / AGENTS-CLAUDE / LaneExperienceBar asserts R2 worried about are **lines 2644+, OUTSIDE the wrapper → they survive deletion automatically.** The 7 wrapped gates' lane-gating PROPERTY (`showLiveSceneEffects`, `showCinematicSpotlight`) is covered by the permanent renderPlan matrix. | MATRIX |

**2626 contradiction RESOLVED (R5 correct, R2 unfounded):** R2 conflated the wrapper with the surrounding
source region. The `tangleLockGroup` body closes at `gov:2643`; everything from `2644` (replay host, telemetry,
doc prose) is permanent and untouched by the wholesale delete. No re-homing needed.

**Pre-deletion checklist for the S5-2 commit:** (1) re-read each wrapper's exact `tangleLockGroup(...) { … }`
span immediately before deleting (line numbers shift as edits land); (2) confirm each `EXIST`/`MATRIX` gate is
still green in the working tree; (3) land each `NEW`/`EXTEND` gate in the SAME commit; (4) delete both registry
entries (`tangle-locks.ts:39-44` + `:66-70`) so `assertAndSummarizeTangleLockGroups` no longer expects the
groups; (5) verify the PERMANENT asserts in §5 (effective-steering, profile-mutation ban, BLOCK-3, FIX-7
anti-regression, R3F discipline, mesh-telemetry, cell-truth import-boundary) are all still present and green.
