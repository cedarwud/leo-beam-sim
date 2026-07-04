# P3 slice-3 mini-SDD — replay-proof nav-polish + cue-panel→window + board clean-delete

Status: DRAFT (controller-scoped 2026-07-04, post `b41929c`). Follows the P3 spine
slice-2 (`b41929c`: toggle-slam + coverage/Gini/Lorenz + honesty/provenance chips).
This slice finishes the D1 transition of the `modqn-replay-proof` lane: the P2 stage
(`7d76199`) rebuilt the lane's SCENE as the recorded red/green window field, but left
three legacy tails that this slice removes.

Read `docs/frontend-change-contract.md` FIRST. All three commits are pure-frontend /
display-only. No engine SINR / `s0:geometry-trace` golden / link-budget physics is
touched. This is a governance-heavy cleanup, not a feature.

---

## 0. Why this is NOT three trivial UI edits (the finding)

Investigation (controller, codegraph + reads) found the "board clean-delete" is the
**inverted-governance trap** the contract Rule#4 warns about: the old board is pinned
by a source-text-heavy validator and shares files with a live consumer.

- **Board is already dead.** `MainScene.tsx:1687` mounts `<ModqnReplaySceneLayer showBoard={showReplayProofLayer} …>`.
  `showReplayProofLayer` (`sceneLaneRenderPlan.ts:179-182`) requires `isLiveScene`, but P2
  made the `modqn-replay-proof` lane `artifact-replay`-sourced ⇒ `isLiveScene===false` ⇒
  `showReplayProofLayer` is **always false** ⇒ the board renders nothing. Confirmed by
  `handover-story:156-172` which already asserts `showReplayProofLayer===false`.
- **But it is heavily source-pinned.** `validate-modqn-phase7k-replay-scene-layer.ts`
  (`assertSceneBridgeSource`) pins ~30 board render strings (`modqn-replay-scene-beam-discs`,
  `useReplaySceneTelemetry(visualState, showBoard)`, `<circleGeometry`, `<Line`, the App→
  MainScene→board bridge, …). `validate-modqn-omega-s3-replay-mode-wiring.tsx:487` also pins
  `useReplaySceneTelemetry(visualState, showBoard)`. Deleting the board breaks these.
- **The cue panel still shows the WRONG source.** `ModqnReplayCuePanel` renders
  `renderedModqnReplayDisplayState` — the baseline JSONL bundle (single decision, `sat-0`),
  which has nothing to do with the window the scene shows (`sat-97/98`). This is the
  P2-flagged "cue-panel 決策未接 window" gap.
- **Shared tendrils.** `SceneTelemetry.tsx:5` imports `REPLAY_CANVAS_ATTRIBUTES` from the
  board dir's `constants.ts` (used at :154-158 to clear stale replay attrs on lane-leave —
  a LIVE path). The plain-data helper `src/scene/modqnReplaySceneVisuals.ts` is used by the
  board AND the cue panel (live lane).

Consequence: the delete is a coordinated dead-code cascade + validator surgery, sequenced
across 3 atomic commits (Rule#2/#9). The design **shrinks phase7k to its real invariants**
(helper purity, no live-identity leak, cue-panel truth hooks) rather than deleting it —
avoiding the false-green trap. It does **not** retire the live-lane baseline cue (that is a
separate D1 "舊 live-skin 檢視 clean-delete" item, out of scope here).

---

## 1. Commit 1 — nav-polish: decouple replay-proof entry from decision-overlay

**Problem.** Entering the stage needs 3 nav hops: modqn button → Advanced → toggle
`decision-overlay-on-live-sinr` → then the proof toggle un-disables. Because
`canToggleModqnReplayProof` (`App.tsx:281-284`) requires
`handoverMode === 'decision-overlay-on-live-sinr'`.

**Change (App.tsx:281-284).** Drop the handover-mode condition; keep the lane preconditions:
```ts
const canToggleModqnReplayProof =
  sceneSource === 'live-sim'
  && appMode === 'modqn-demo';
```
Rationale: the recorded stage plays an artifact — it does not need the live decision-overlay
policy. `handleExperienceChange` already restores decision-overlay when entering modqn-demo
from omega-heuristic (`App.tsx:1639-1643`), so the live cue keeps working; we only remove the
manual REQUIREMENT that made the proof entry dead until the user dug into Advanced.

**Change (ModqnViewToggle.tsx:37-43).** Un-park the `Proof` sub-nav segment so it is a
first-class entry (keep `artifact-replay` parked):
```ts
function isOptionDisabled(lane: SceneLane, _proofEnabled: boolean): boolean {
  return lane === 'artifact-replay';
}
```
With `proofEnabled` (`= canToggleModqnReplayProof`, App.tsx:1931) now true in modqn-demo,
`visibleOptions = [Live, Proof]` (length 2 ⇒ renders). Update the stale block comment at
:38-42 to say Proof is un-parked (comments-must-not-lie, Rule#6). The `Proof` segment
disabled-state / `proofEnabled` gate is unchanged in wiring — only the hide guard drops it.

**phase7k safety.** phase7k pins `if (handoverMode !== 'decision-overlay-on-live-sinr')`
(App.tsx:597, a DIFFERENT line inside `renderedModqnReplayDisplayState`) — not touched.
`canToggleModqnReplayProof`'s body is not pinned. No validator edit needed here.

**Classification.** Changes lane REACHABILITY (not lane resolution / the lane set). Treat as
structural → covered by the bundle's `validate:ready`.

---

## 2. Commit 2 — cue-panel → window decision (proof lane only)

**Problem.** On `modqn-replay-proof` the cue panel shows the baseline JSONL decision
(`sat-0`, `renderedModqnReplayDisplayState`) while the scene shows the window (`sat-97/98`).
Inconsistent + dishonest (the cue implies a decision unrelated to what's on screen).

**Design — focus-UE window lens.** On the proof lane, derive the cue from the SAME window
frame the scene renders, for a focus UE:
- Focus UE selection: `elevatedUeId` if set (App.tsx:1950) → else the UE handing over at the
  current slot → else primary `ues[0]`.
- Fields (all producer truth, read not derived): serving beamId, target beamId (if handover),
  event kind (`intra`/`inter`/`hold` from serving-vs-target + serving-sat change), served /
  starved status, current slot / frame index.
- Source: the window scene frame already memoised in App
  (`showcaseArtifactToSceneInterpolated(showcaseArtifact, currentTimeSec)`, App.tsx:1742-1744)
  → its `ues[]` carry `servingBeamId/targetBeamId/servingSatelliteId/decisionRef` (loader-verify
  confirmed). No new fetch, no engine import.

**Implementation.**
- New pure adapter `src/showcase/windowReplayCue.ts` (no React/Three/engine import):
  `deriveWindowReplayCue(frame, focusUeId): WindowReplayCue | null`. Reads producer served /
  serving / target only — DISPLAY-ONLY, derives no SINR / reward / policy.
- `ModqnReplayCuePanel`: add optional `windowCue?: WindowReplayCue | null` prop. When
  `proofViewportActive` (proof lane) AND `windowCue` present → render the window cue
  (`data-cue-source="window"`). Else → render the EXISTING baseline cue
  (`deriveModqnReplaySceneVisualState(displayState)`, `data-cue-source="baseline"`).
- App: compute `windowCue` from the window frame + focus UE, pass it in. Keep
  `displayState={renderedModqnReplayDisplayState}` for the live-lane branch.
- Preserve the browser-smoke testid `data-testid="modqn-replay-cue-panel"` and emit honest
  window hooks: `data-cue-source`, `data-handover-event-kind`, `data-focus-ue`, serving/target
  beam, served status.

**phase7k safety.** The live-lane branch still calls `deriveModqnReplaySceneVisualState(displayState)`
⇒ phase7k's cue pins (680-729) survive UNCHANGED. The window path is additive-conditional and
justified (it removes the `sat-0` lie on the proof lane; not accretion of a parallel dead flag).

**New invariant pin (Rule#4 — invariant not source-text).** Extend the existing
`validate:modqn:coverage-fairness` gate (or add a tiny sibling) with a behavioural assert:
`deriveWindowReplayCue` on the a2 window's focus UE returns a served (green) cue with a
serving beam that matches the frame's `servingBeamId`, and is pure (no `../engine`, no `sinr`,
no `reward` substring). Self-discovering into `static:all`.

**Classification.** DOM-only sidebar panel + a pure TS adapter — mounts no mesh (contract
fast-path table: "DOM-only sidebar / panel layout"). NON-structural on its own; still ridden by
the bundle's `validate:ready`.

---

## 3. Commit 3 — board `ModqnReplaySceneLayer` clean-delete

**Delete (verify board-only first with grep):**
- `src/scene/modqn-replay-visuals/index.tsx` (the board), `ReplaySwitchArc.tsx`,
  `geometry.ts`, `useReplaySceneTelemetry.tsx`.
- `src/scene/ModqnReplaySceneLayer.tsx` (re-export shim).

**Relocate (do NOT lose — live path):**
- `REPLAY_CANVAS_ATTRIBUTES` from `modqn-replay-visuals/constants.ts` → new neutral module
  `src/scene/replayCanvasAttributes.ts`; repoint `SceneTelemetry.tsx:5`. Delete the rest of
  `constants.ts` (board-only: `BOARD_DEPTH_WORLD/DISC_Y_WORLD/LAYER_ORIGIN/ROLE_COLORS/roleLabel`).

**Preserve (still live):**
- `src/scene/modqnReplaySceneVisuals.ts` (helper) — used by the live-lane cue.
- `modqnReplayDisplayState` / `renderedModqnReplayDisplayState` + the baseline JSONL fetch
  effects (App) — feed the live-lane cue.
- `SceneTelemetry`'s own `data-handover-story-*` writes (from props, independent of the board).

**MainScene.tsx.** Remove the import (:35) + the `<ModqnReplaySceneLayer …>` mount (:1687-1693)
+ its `displayState={modqnReplayDisplayState}` prop threading (:1688) if unused elsewhere in
MainScene. Remove `showBoard`. Remove `replayProofLayerRequested`/`showModqnReplayScene`
threading (:653/874/1860/1881/1957) IFF they only fed the dead flag.

**sceneLaneRenderPlan.ts.** Remove `showReplayProofLayer` (:130,:179-182) +
`replayProofLayerRequested` input — dead flags. Update the `isSceneLaneSourceCompatible`
comment (:134-142) — drop "clean-delete deferred to P3" (now done).

**App.tsx.** Remove `showModqnReplayScene` (:294/2090) + `shouldRenderModqnReplayScene` import
IFF only feeding the dead flag. (Keep `modqnReplayProofRequested` / `sceneLane` resolution.)

**Validator surgery (atomic in THIS commit, Rule#9):**
- `validate-modqn-phase7k-replay-scene-layer.ts` — **shrink to real invariants**, do NOT
  delete: KEEP the helper behaviour tests (`assertFirstSlotVisualState` …
  `assertOmegaRescalarizedDisplayState`), the claim-boundary counts, the cue-panel truth
  hooks (680-729), the no-live-identity-leak assert. REMOVE the board block in
  `assertSceneBridgeSource` (the `readReplaySceneLayerSources()` reads + every board
  `sceneLayerSource`/MainScene `<ModqnReplaySceneLayer`/`useReplaySceneTelemetry(...)` pin,
  lines ~416-609). Leave a one-line comment: board retired in P3 slice-3, helper+cue invariants
  retained.
- `validate-modqn-omega-s3-replay-mode-wiring.tsx:487` — remove the
  `useReplaySceneTelemetry(visualState, showBoard)` source-pin (board deleted). If the file's
  intent survives via other asserts, keep them; else narrow honestly.
- `validate-modqn-handover-story-layer.ts:156-172` — the `showReplayProofLayer===false` asserts
  reference a removed flag. REPOINT them to the equivalent post-delete invariant: the
  `modqn-replay-proof` lane is source-compatible ONLY with `artifact-replay` and mounts NO
  board (i.e. assert `isSceneLaneSourceCompatible({lane:'modqn-replay-proof', source:'live-sim'})===false`
  negative control stays, and the render plan no longer exposes a board flag). PRESERVE every
  fail-closed negative control; do not weaken.

**Guard — SACRED invariants stay green:** `s0:connected-sat-has-beam`, `beam:colour-match`,
`s0:geometry-trace`, `scene-lane-governance`, handover-pulse/ticker. None depend on the board.

**Classification.** Structural (removes a scene layer + render-plan flags) → full `validate:ready`.

---

## 4. Ordering & atomicity

1 (nav) → 2 (cue→window) → 3 (board delete). Each commit passes the pre-commit gate on its
own. Commit 2 before 3 so the cue panel is verified on the window BEFORE the board tail is
removed (they are independent, but this order keeps review legible). Every validator edit is
in the SAME commit as the code change it tracks (Rule#9). DELETE-not-park throughout (Rule#3);
any residual must carry a dated un-park trigger + owner (there should be none).

## 5. Acceptance (controller re-runs, rule-3 — not agent's word)

- `tsc --noEmit` 0; `npm run validate:governance:full` exit-0; `npm run validate:static:all`
  green (expect run-count +1 for the new cue invariant, minus none — phase7k shrinks but stays;
  1 quarantined = phase6t).
- `npm run validate:ready` — the 6-serial browser smoke green; frameloop / live lanes not
  regressed.
- **Pixel-verify (:3000):** proof lane (a2) = all-green field + the cue panel now shows the
  window focus-UE decision consistent with the scene (NOT `sat-0`); toggle b1 = red sea + its
  cue; live lane (modqn-live-cell-preview) cue UNCHANGED. before/after PNG paths listed.
- **Diff review:** board files deleted (no zombie); `REPLAY_CANVAS_ATTRIBUTES` relocated;
  helper + live-lane cue preserved; phase7k SHRUNK not weakened; negative controls intact;
  no protected/truth/SACRED/geometry/beamDisplaySpec/vite file touched.
- No push; leave in worktree for controller ff-merge.
