# SINR-live Beam Consolidation — Execution Roadmap

**Status:** planning DONE (2026-06-17). Execute from here. Pairs with the SOLUTION
design [`docs/sinr-live-render-consolidation-sdd.md`](../sinr-live-render-consolidation-sdd.md)
and the DIAGNOSIS [`docs/handoff/sinr-live-render-consolidation-brief.md`](./sinr-live-render-consolidation-brief.md).
Branch: `refactor/beam-display-contract` (P0 keystone already committed: `26f46d2`).

Produced by a 5-way decompose + adversarial-critic workflow; the critic's corrections
are baked in below (merges, dedupes, missed repoints, the arg-name bug, the governance
bottleneck). ~22 commits, ~3–4 focused sessions.

## Execution model (HYBRID — mostly sequential-solo)

The 5-cluster split is an ANALYTICAL convenience, NOT a parallel map. **Four of five
clusters write the SAME files** (`sinrLiveConeStyle.ts`, `SinrLiveCellBeamCones.tsx`,
`MainScene.tsx`, `sceneLaneRenderPlan.ts`, and the governance script) → they cannot run
concurrently.

- **ONE parallel fan-out batch** (subagents in isolated worktrees) — the only truly
  disjoint, no-governance-pin, no-screenshot, no-shared-file commits: F1–F5 below.
- **Then ONE sequential solo lane** (driver + screenshot verification): Session A → B → C → D.
  Subagents do NOT help here — the bottleneck is the shared governance file + visual
  verification, both inherently serial.

> 🔴 **THE GLOBAL BOTTLENECK = `scripts/validate-frontend-scene-lane-governance.ts`.**
> ~8 commits edit it; it is the pre-commit-hook gate; one bad edit RED-blocks every
> later commit. Never touch it in parallel. Re-run `validate:governance` + (before
> handoff) `validate:static:all` after each edit.

## Parallel fan-out batch (subagents / worktrees — safe, do anytime)

| id | commit | files | notes |
|----|--------|-------|-------|
| F1 | `chore(config): delete dead visualBeamDiameter` | `ntpu.config.ts` | written-never-read; grep first |
| F2 | `chore(scene): delete stale comment graves` | `sceneLaneRenderPlan.ts:199-205`, `MainScene.tsx:1700-1708` | pure comments; the "PARKED/steered" lie + the SatelliteBeams tombstone |
| F3 | `feat(scene): add beamDisplaySpec.ts contract (no consumers yet)` | `beamDisplaySpec.ts` (new) | shape = SDD §3.1; `DEFAULT_BEAM_DISPLAY_SPEC` |
| F4 | `feat(bugD): SinrHandoverTicker intra-only honest label + data-attr` | `SinrHandoverTicker.tsx` | say "not reached by current geometry", NOT "never" |
| F5 | `feat(bugD): inter-HO==0 geometry gate + beam-control prompt-ref doc` | new gate + `docs/beam-control-prompt-reference.md` | gate uses the chunked-golden epoch (NOT live time) → deterministic |

## Sequential solo lane

### Session A — P0 colour + legibility (→ new-convo BOUNDARY 1; resolves "connected no beam")
- **A1** `feat(sinr-live): serving-identity colour authority + wire cones + repoint colour validators`
  — **MERGE the old commit-1+2** (a signature change alone is tsc-RED = forbidden). Create
  `src/constants/servingColour.ts` exporting `colorForServingBeam(satId, beamId)` (the DEFAULT,
  not a fallback — avoids `constants/`→`scene/` layering inversion). Both the cone resolver
  (`SinrLiveCellBeamCones.tsx`) and the UE mosaic (`sinrServingMosaic.ts`) call it.
  ⚠️ **ARG NAME: `mosaicColorForServingBeam(satId, beamId:number)` — the cone's key is `cellId`
  used AS `beamId`. Pass the SAME value on both sides or the colour-match gate false-greens.**
  Repoint: `validate:phase-c:sinr-live-cells:render` (lines 174/241/361/516) **AND `vc1c`
  (freq-color-demotion) + `vc1d` (identity-match) + `vc2c` (satellite-tint)** — the critic
  caught these 3 as a MISSED repoint; colour-unify WILL red them. Keep role colours (hero
  `#facc15`, candidate `#0ea5e9`, pulse) on top — identity colour is for ambient serving cones.
  Screenshot.
- **A2** `feat(sinr-live): lift serving cone legibility (opacity 0.08 → ~0.18)` — screenshot at
  0.14 / 0.18 / 0.22, pick the value where served UEs sit visibly under their beam without
  washing terrain (user rejected 0.22 for the STEERED look in 2026-06-08; cell cones differ —
  verify). Update the `0.08` test pin. Screenshot.
- **A3** `feat(sinr-live): colour-match model invariant gate` — new non-browser validator: on a
  synthetic frame assert cone.color == UE marker colour for the same (satId, beamId). Contract
  pin (one-authority), not source-text. Add npm script.

### Session B — P1 beamDisplaySpec migration (→ BOUNDARY 2; control surface becomes ONE file)

> ✅ **DONE 2026-06-18 — 4 commits on `refactor/beam-display-contract` (NOT pushed),
> all gated.** F3 `62639a7` (contract, no consumers) → B1 `d105720` (migrate +
> delete) → B2 `d835d20` (pin→value asserts) → B3 `912cb8d` (width/opacity knobs).
> Gates green: tsc; cone-render model 28/0; validate:governance per-commit;
> **governance:full** (S0–S5 + warm-start 14 + chunked-golden + trajectory-memo);
> **static:all 137 green / 1 quarantined** (post-B2 AND post-B3, unchanged);
> **cone-render browser gate PASS** (cones==served, pulse decoupled, live SINR
> engine); sinr-live screenshots (default identical to A; bumped width 2.2 /
> opacity 0.45 rendered visibly wider+brighter = knobs live).
> **Deviations from this plan (deliberate):**
> 1. F3 was done as its own commit (it had been skipped in the fan-out batch).
> 2. **B2 is pin-conversion ONLY — the renderPlan alias consts are NOT inlined.**
>    Only 3 `const X = showSinrBeamRender` *source-text* pins existed (mosaic 1718,
>    pulse 1987, sceneEffects 2828); deleted them, relying on the existing renderPlan
>    VALUE asserts (added the one missing `artifact.showLiveSceneEffects==false` to
>    complete the matrix). The consts themselves are documented semantic layer names,
>    not mess — the mess was the governance pins freezing them. The critic's
>    "1718/1987/2828 collision" was real but only 3 pins, all retired cleanly.
> 3. coneWidthScale scales geometry in `ObliqueConeMesh` only (item + userData keep
>    truth radius); both knobs wired at the MOUNT props, so NO resolver/memo dep
>    changes were needed (the direct-prop seam re-renders the mounts).

- **B1** `refactor: migrate showNonServingCones + beamCalloutsEnabled into beamDisplaySpec; delete SceneDisplayConfig`
  — App holds spec in `useState`, direct prop to MainScene; `sceneLaneRenderPlan` reads
  `beamCalloutsEnabled` from spec. Repoint the governance `beamCalloutsEnabled` threading.
- **B2** `refactor: collapse showSinrBeamRender aliases + convert their source-text pins → value asserts`
  — **HIGH risk; FOLD the old P2 pin-wrapping IN HERE** (the critic: P2 and this commit collide on
  the same governance lines 1718/1987/2828). GOOD NEWS verified: equivalent output-value asserts
  already exist (governance ~lines 311-400) — delete the text-pin, confirm the value-assert covers
  it. Do NOT touch `focusSatIds: null` or `buildSinrServingUeColorMapFromCells` (permanent wiring
  locks, SDD §6/§7). Run `validate:governance` + `validate:static:all` after.
- **B3** `feat: display-only coneWidthScale + servingConeOpacity knobs in beamDisplaySpec` — width
  multiplies RENDERED base radius ONLY (never `cellLayout.ts`/`sinrLiveCellRuntime.ts` beamwidth →
  physics locked, SDD §3.3). Screenshot.

### Session C — P1 collapse 4 HO layers → 1 + fix intra (→ BOUNDARY 3)

> ✅ **DONE 2026-06-18 — 5 commits on `main` (NOT pushed), all gated.** C1 `c8523aa`
> (split the intra button: `director-intra-trigger` = jog/seek-free → pulse vs
> `director-intra-focus` = `armIntra` cinema; Bug B fixed) → C2 `8fcaad9` (pulse
> tags `event.kind` → intra emerald `#34d399` / inter rose `#f472b6` via the pure
> `resolveSinrLiveConeRenderColor`, colours in `beamDisplaySpec`) → C3a `cff70b2`
> (delete the pending-candidate cone + orphaned candidate tokens) → C3b `5c2a3f9`
> (collapse the cinema PAIR cone + `CandidateBeamHighlight` + the
> `showCandidateHandoverHighlight` flag/`candidateHighlight` command/`runtimeWithCinema`
> plumbing + their governance pins + the `'pair'` cone-layer enum/opacity; rename
> `buildPairConeItem`→`buildCellConeItem`; rewrite the handover-cinema browser gate;
> the cinema-arm Focus button + SINR explainer STAY) → C4 `63e4efd`
> (`validate:phase-c:handover-pulse:render:browser`, count==render via a paused
> settle, wired into `validate:live-render`).
> Gates green: tsc; cone-render model 29; handoverCinema model 3; `validate:governance`
> per-commit; **governance:full** (warm-start 14 + chunked-golden + trajectory-memo);
> **static:all**; **handover-cinema browser PASS** (explainer + 0.25x slow-mo + exit;
> camera-move SOFT) + **sinr-live-cells render browser PASS** + **C4 PASS** (count==render
> 26 cones); `/tmp/sinr-C` screenshots (jog→pulse on a static UE; pulse-only story legible).
> **Deviations (deliberate):**
> 1. **C3 split into C3a (pending, independent) + C3b (pair+highlight, coupled +
>    governance-heavy) — 5 commits not 4**, for safety/reviewability under the
>    governance serial-bottleneck (DELETE-not-park + one-concern justify it).
> 2. The handover-cinema gate's CAMERA-move check is now BEST-EFFORT (the explainer +
>    slow-mo + exit are the hard proof; camera-move is owned by the director-cinematic
>    gates and load-flaked under heavy external CPU).
> 3. **C4 reads the pulse count==render with the sim PAUSED** (the resolver count vs
>    the mesh count are written at different React lifecycle points → skew a frame
>    under churn; pause freezes + converges them). It measures recorded handovers via
>    the pulse's own truth-derived count, NOT the ticker (see #4).
> 4. **FINDING (pre-existing, follow-up):** `SinrHandoverTicker` reads the THROTTLED
>    published `simState.recentHandoverEvents`, which lags/empties under 20x while the
>    pulse reads the live sim directly → the "一直有換手" HUD can read 0 while the pulse
>    renders. Not a C3 regression; a `useSimStatePublisher`/throttle fix for Session D.

- **C1** `fix(intra): jog without the self-defeating armIntra seek (Bug B)` — remove the
  `armIntra()` (seek→rebase clears prevUeServing) from the intra button; jog alone fires the real
  intra; ambient pulse displays it. Keep the cinema arm as a SEPARATE optional Focus button only.
  Screenshot: intra click → a pulse flare appears.
- **C2** `feat(pulse): honour event.kind — intra vs inter rendered distinctly (Bug H)` — add
  optional `kind` to the render item + intra/inter pulse colours; render distinctly; fall back to
  base colour when absent. Screenshot.
- **C3** `refactor(layers): collapse to ambient pulse only` — ⚠️ **SCREENSHOT-VERIFY the pulse-only
  story is legible BEFORE deleting** (the deletes remove the only proof of distinct old/new cells).
  Then delete in order: pending-candidate cone → cinema pair cone → `CandidateBeamHighlight` (+ its
  file). Each removes governance pins + telemetry attrs (`sinrLiveCellHandoverPairCone*`,
  `candidateHandoverHighlightRenderedCount`, the `<CandidateBeamHighlight` mount pin, the 5
  `showCandidateHandoverHighlight` matrix asserts) — repoint/remove each. Delete the dead
  `_diag-paircone.ts` / `_diag-highlight.ts`. Screenshot after each.
- **C4** `feat(gate): pulse count==render browser gate` — assert ≥1 pulse cone renders per recorded
  handover within the retention window (atomic read, like the coverage gate).

### Session C5 — ticker throttle-lag fix (cumulative scoreboard)

> ✅ **DONE 2026-06-18 — 3 commits on `main` (NOT pushed), all gated.** Fixes the
> Session-C FINDING #4 above (the ticker read the THROTTLED published
> `recentHandoverEvents` window → 0 under 20x while the pulse rendered). C5a
> `075bdbc` (model `cumulativeIntra/InterHandoverCount`, monotonic, reset on
> reset+rebase; published; additive) → C5b `6a8f3a5` (ticker renders the cumulative
> totals "Handovers · this run"; delete `summarizeRecentHandovers` + the dead
> `SimState.recentHandoverEvents` feed + its publish; rename `data-ho-window-*` →
> `data-ho-*`; repoint the 2 governance wiring pins onto the cumulative source — the
> MainScene PULSE pin is UNCHANGED; rewrite the ticker model gate) → C5c `a0ec6f2`
> (`validate:phase-c:handover-ticker:render:browser`, monotonic + rises while the
> pulse fires, wired into `validate:live-render`).
>
> **Design decision (owner picked B):** a CUMULATIVE scoreboard, NOT a
> windowed-lossless force-publish. A naive "force-publish on every HO change" would
> STORM (~13 events / 0.2s wall at 20x = ~65Hz full-SimState publishes vs the 1.4Hz
> baseline). A monotonic cumulative total is throttle-PROOF: the throttle batches
> increments instead of dropping events, so even the 700ms publish never under-counts.
> Reset on reset+rebase mirrors `recentHandovers` (a seek opens a fresh epoch; avoids
> double-counting a replayed span). The model frame's `recentHandoverEvents` STAYS —
> the PULSE reads it live off the frame in MainScene, unthrottled (untouched).
>
> **Folds in D1's ticker portion** (the ticker source-text pins are repointed onto the
> cumulative contract). Gates: tsc; handover-ticker:model 4; sinr-live-cells:model 24
> (+cumulative monotonic/reset test); colour-match 5; cone-render 29; governance +
> **governance:full**. Live capture: ticker 191→2055 monotonic, pulse-lit-but-ticker-zero
> 0/36 frames; the new render gate PASS (rose 49→108 while the pulse fired).
>
> **`validate:live-render` (9 gates): 7 PASS** incl the new ticker gate; **2
> PRE-EXISTING reds** — `director-cinematic:live` (the known FIRE-OVERSHOOT tail) and
> `sinr-serving-mosaic`. BOTH fail IDENTICALLY on the parent `2f9caa8` (verified by
> parent-commit checkout) → not C5.

### Mosaic lane-bleed red — FIXED (2026-06-17, `8745ed2`, follow-up to the C5 finding)

> ✅ **The `sinr-serving-mosaic` OFF-half red is FIXED — 1 commit `8745ed2` on
> `main` (ahead origin 1, NOT pushed), gated.** Diagnosis (corrects the earlier
> "stale-frame" label): the OFF-half is a FULL reload onto the MODQN lane, so the
> lingering telemetry attrs (color-count=13/bucket=7/instance=99) were an ACTIVE
> write — a render-plan-FLAG lane-bleed. The GroundScene telemetry attr props were
> gated on `showSinrServingMosaic` (= `showSinrLiveViewport || showCellOverlay`),
> which is **governance-LOCKED true on `modqn-live-cell-preview`** (governance
> L298-302, "consolidation: MODQN renders like SINR"). The mosaic COLOUR render is
> legitimately shared with modqn; the sinr-serving TELEMETRY (a sinr-live lane
> PROOF) leaked with it. Fix: gate the 3 attr props on
> `sinrServingTelemetryActive = showSinrServingMosaic && !showCellOverlay`
> (sinr-live-only); modqn keeps the mosaic colours (`showSinrServingMosaic`
> unchanged — P2-pinned). Repaired 3 stale "mosaic inert on MODQN" comments
> (renderPlan docstring, MainScene colour-map comment, the self-contradictory
> governance comment). Gates: governance (tsc + lane-governance + s0 goldens),
> `validate:phase-c:sinr-serving-mosaic:browser` (ON sinr-live mesh=20/buckets=7/
> instances=99; OFF absent on MODQN), governance:full, static:all — all PASS.
> NEXT: director-cinematic still deferred; then the frontend visual overhaul.

### Session D — P3 + governance hardening (→ BOUNDARY 4; independent, anytime after A)
- **D1** convert remaining governance source-text pins (ticker, SinrServingAggregate wording) →
  contract/behaviour pins (the deeper `validate:phase-c:handover-ticker:model` already covers them).
  ⚠️ The TICKER half is DONE (C5b folded it in); only the SinrServingAggregate wording remains.
- **D2** UE-panel contract gate (lane-gate behaviour + one colour-authority import check); ≤80 lines.
- **D3** extend the contract+visual-gate pattern to the rest of the frontend display (open-ended);
  MODQN inherits via shared render.

## Hard rules / gotchas (from the critic — do not skip)
1. **Governance file is serial + fragile** — one driver, re-gate after every edit.
2. **Merge P0 A1** (no tsc-red intermediate). **Fold P2 pins into B2** (line collision).
3. **vc1c / vc1d / vc2c WILL red on colour-unify** — repoint them IN A1 (was a missed repoint).
4. **Arg-name: `beamId` not `cellId`** — same key both sides or the colour-match gate false-greens.
5. **Screenshot the pulse-only story BEFORE the C3 deletes**, not after.
6. **Never touch** engine SINR, goldens, the 4 baseline-KPIs, `focusSatIds: null`,
   `buildSinrServingUeColorMapFromCells`, or the antenna beamwidth (physics).
7. Every visual commit: screenshot before/after. Every governance-touching commit: `validate:governance`
   then `validate:static:all` before handoff. One concern per commit. DELETE-not-park.

## New-conversation boundaries
After **A** (colour+legibility — the "connected no beam" fix), after **B** (one control file),
after **C** (HO layers collapsed + intra fixed), **D** anytime after A. Each boundary: SDD + this
roadmap + the commit SHAs + the memory topic = cold-start handoff.
