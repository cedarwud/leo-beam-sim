/**
 * Consolidation S3-3 — one-reset recipe + QUAR-S3-STEP retirement gate.
 *
 * Two jobs:
 *
 *  I. THE ONE-RESET CONTRACT. Every reset/seek/wrap reseat is the SAME recipe:
 *     construct a fresh RuntimeFrameStepState at the target sim-time and take ONE
 *     paused dt=0 step. cold-start reset()s the HO managers; seek/wrap clock-REBASE
 *     (S3-2). Positions cold-reseat at the target (D1). The reseat publishes a REAL
 *     populated frame — never the old createEmptyFrame flicker.
 *       (A) behavior: the reseat primitive (createRuntimeFrameStepState + one paused
 *           dt=0 step — the exact sequence buildRuntimeStateAt runs inline) yields a
 *           NON-BLANK frame at T, run-twice byte-stable, and its intent dispatch is
 *           cold-start → reset() (eventLog cleared) vs seek/wrap → rebase() (eventLog
 *           preserved).
 *       (B) structural single-path: the hook collapses the cold-start reset, the
 *           loop/window wrap, and the timeline seek into ONE `buildRuntimeStateAt`;
 *           resetToReplayStartFrame + seekToTimelineFrame + the signalReset effect all
 *           delegate to it (was three hand-rolled ~40-line blocks), and NO reseat path
 *           publishes a blank createEmptyFrame.
 *
 * II. QUAR-S3-STEP RETIREMENT replacements (the group deletes wholesale in this same
 *     commit; these are its named replacement gates):
 *       - block #3 (15° literal triple-pin) -> imported-constant VALUE asserts:
 *         MIN_ELEVATION_DEG === DEFAULT_MIN_ELEVATION_DEG === SINR_LIVE_CELL_MIN_ELEVATION_DEG === 15.
 *       - block #2 (runtimeFrameStep FROZEN "no sinrLiveCell symbol" text pin) ->
 *         structural import-boundary: the runtime step imports neither the cell
 *         adapter nor the cell model and produces no `sinrLiveCells` field (cell
 *         truth ∉ step callee set; the additive boundary holds until S4 folds it).
 *       - block #1 (MainScene/useSimulation cell-gate source-text pins) -> behavior:
 *         the cell-truth factory returns null off the sinr-live lane and a model on
 *         it, a null attach is a no-op (additive zero-drift); plus a robust MainScene
 *         lane-ownership assert (the gate line, not the brittle multi-line call-shape).
 *
 * Run: `npm run validate:s3:one-reset`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import { normalizeReplayOffset } from '../src/scene/simulationHelpers';
import {
  MIN_ELEVATION_DEG,
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';
import { DEFAULT_MIN_ELEVATION_DEG } from '../src/engine/cells/cellLayout';
import {
  SINR_LIVE_CELL_MIN_ELEVATION_DEG,
  attachSinrLiveCellFrame,
  createSinrLiveCellModel,
  type CellTruthFrame,
} from '../src/scene/sinrLiveCellRuntime';

const GATE = 'validate:s3:one-reset';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z
const UE_COUNT = 100;
const NOW_MS = 1_000_000; // injected display clock (S3-1) — irrelevant to reseat truth
const DEMO_SEC = 60; // a sim-time with sats overhead (candidate-rich serves here)

let passed = 0;
function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(`FAIL: ${label}`);
  passed += 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness — the reseat primitive buildRuntimeStateAt runs inline (fresh state at T
// + one paused dt=0 step). The intent's HO transition is applied to the managers by
// the caller BEFORE the reseat (cold-start reset() / seek-wrap rebase()), exactly as
// the hook does.
// ─────────────────────────────────────────────────────────────────────────────

interface Harness {
  profile: ReturnType<typeof loadProfile>;
  observer: ReturnType<typeof createObserverContext>;
  trajectoryCache: ReturnType<typeof createTrajectoryCache>;
  maxTimeSec: number;
  beamLayoutsByShellId: ReturnType<typeof createBeamLayoutsByShellId>;
}
function makeHarness(): Harness {
  const profile = loadProfile(PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
  return {
    profile,
    observer,
    trajectoryCache,
    maxTimeSec: getTrajectoryMaxTimeSec(trajectoryCache),
    beamLayoutsByShellId: createBeamLayoutsByShellId(profile),
  };
}
function makeManagers(h: Harness): { primary: HandoverManager; secondaries: HandoverManager[] } {
  return {
    primary: new HandoverManager(h.profile.handover),
    secondaries: Array.from({ length: UE_COUNT - 1 }, () => new HandoverManager(h.profile.handover)),
  };
}
function stepAt(
  h: Harness,
  state: ReturnType<typeof createRuntimeFrameStepState>,
  managers: { primary: HandoverManager; secondaries: HandoverManager[] },
  paused: boolean,
  dt: number,
) {
  return stepRuntimeFrame({
    profile: h.profile,
    replay: { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: true, windowLengthSec: 7200 },
    speed: 1,
    paused,
    deltaSec: paused ? 0 : dt,
    nowMs: NOW_MS,
    observer: h.observer,
    beamLayoutsByShellId: h.beamLayoutsByShellId,
    trajectoryCache: h.trajectoryCache,
    hoManager: managers.primary,
    secondaryHoManagers: managers.secondaries,
    ueCount: UE_COUNT,
    uePrimaryAnchorMode: 'observer',
    state,
  });
}
// The reseat primitive: fresh state at the normalized target + one paused dt=0 step.
function reseatFrame(
  h: Harness,
  toSec: number,
  managers: { primary: HandoverManager; secondaries: HandoverManager[] },
) {
  const targetOffset = normalizeReplayOffset(toSec, h.maxTimeSec, true);
  const state = createRuntimeFrameStepState(targetOffset);
  return stepAt(h, state, managers, true, 0).frame;
}
function countServed(frame: { perUePositions: ReadonlyArray<{ servingSatId: string | null }> }): number {
  return frame.perUePositions.filter(ue => ue.servingSatId !== null).length;
}
function servingIdentity(frame: {
  perUePositions: ReadonlyArray<{ id: string; servingSatId: string | null; servingBeamId: number | null }>;
}): string {
  return frame.perUePositions
    .filter(ue => ue.servingSatId !== null && ue.servingBeamId !== null)
    .map(ue => `${ue.id}>${ue.servingSatId}:${ue.servingBeamId}`)
    .sort()
    .join('|');
}

const h = makeHarness();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION I.A — the one-reset behavior contract
// ═══════════════════════════════════════════════════════════════════════════════

// (1) NON-BLANK: a cold reseat at DEMO_SEC publishes a real populated frame (this is
// exactly the app's startup / signal-reset reseat — if it were blank the viewport
// would show nothing). The OLD signalReset path published a createEmptyFrame here.
const coldFrame = reseatFrame(h, DEMO_SEC, makeManagers(h));
ok(coldFrame.satellites.length > 0, `non-blank VACUOUS: no sats visible at t=${DEMO_SEC}`);
const coldServed = countServed(coldFrame);
ok(
  coldServed >= 1,
  `NON-BLANK FAILED: cold reseat at t=${DEMO_SEC} served 0/${UE_COUNT} UEs — the recipe published a blank frame`,
);

// (2) RUN-TWICE BYTE-STABLE: the reseat is a pure function of the target sim-time.
const repeatFrame = reseatFrame(h, DEMO_SEC, makeManagers(h));
ok(
  servingIdentity(repeatFrame) === servingIdentity(coldFrame),
  'DETERMINISM FAILED: two cold reseats at the same target diverged on serving identity',
);
ok(
  repeatFrame.serving.satId === coldFrame.serving.satId
    && repeatFrame.serving.beamId === coldFrame.serving.beamId,
  'DETERMINISM FAILED: primary serving diverged across two cold reseats at the same target',
);

// (3) INTENT DISPATCH: cold-start reset() clears the manager eventLog; seek/wrap
// rebase() preserves it (the served-count consequence is validate:s3:served-survives-wrap).
function warmManagers(): { primary: HandoverManager; secondaries: HandoverManager[] } {
  const managers = makeManagers(h);
  const state = createRuntimeFrameStepState(0);
  stepAt(h, state, managers, true, 0); // cold attach
  for (let i = 0; i < 6; i += 1) stepAt(h, state, managers, false, 10); // accrue events
  return managers;
}
const coldArm = warmManagers();
ok(coldArm.primary.eventLog.length > 0, 'INTENT VACUOUS: warm primary has no logged events to clear');
coldArm.primary.reset();
coldArm.secondaries.forEach(m => m.reset());
ok(coldArm.primary.eventLog.length === 0, "INTENT FAILED: cold-start did NOT clear the manager eventLog");

const rebaseArm = warmManagers();
const rebaseEventsBefore = rebaseArm.primary.eventLog.length;
ok(rebaseEventsBefore > 0, 'INTENT VACUOUS: warm primary has no logged events to preserve');
rebaseArm.primary.rebase(-12_345);
rebaseArm.secondaries.forEach(m => m.rebase(-12_345));
ok(
  rebaseArm.primary.eventLog.length === rebaseEventsBefore,
  'INTENT FAILED: seek/wrap rebase did NOT preserve the manager eventLog',
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION I.B — structural single-path (the hook collapses every reseat into ONE recipe)
// ═══════════════════════════════════════════════════════════════════════════════

const useSimSrc = readFileSync(new URL('../src/scene/useSimulation.ts', import.meta.url), 'utf8');

ok(
  useSimSrc.includes('const buildRuntimeStateAt = useCallback('),
  'SINGLE-PATH FAILED: the one-reset recipe buildRuntimeStateAt is missing',
);
ok(
  useSimSrc.includes("intent: 'cold-start' | 'seek' | 'wrap'"),
  'SINGLE-PATH FAILED: the recipe does not expose the cold-start|seek|wrap intent',
);
// every entry point delegates to the recipe
ok(
  useSimSrc.includes("intent: options?.timeShift ? 'wrap' : 'cold-start'"),
  'SINGLE-PATH FAILED: resetToReplayStartFrame does not delegate to the recipe (cold-start / wrap)',
);
ok(
  useSimSrc.includes("buildRuntimeStateAt({ toSec: targetSec, intent: 'seek' });"),
  'SINGLE-PATH FAILED: seekToTimelineFrame does not delegate to the recipe (seek)',
);
ok(
  useSimSrc.includes("buildRuntimeStateAt({ toSec: runtimeStateRef.current.simTimeSec, intent: 'cold-start' });"),
  'SINGLE-PATH FAILED: the signalReset effect does not delegate to the recipe (cold-start)',
);
// the reseat collapsed to ONE site (was three hand-rolled blocks)
const reseatSites = useSimSrc.split('createRuntimeFrameStepState(targetOffset)').length - 1;
ok(
  reseatSites === 1,
  `SINGLE-PATH FAILED: expected exactly ONE reseat (createRuntimeFrameStepState(targetOffset)), found ${reseatSites}`,
);
const stepCalls = useSimSrc.split('stepRuntimeFrame({').length - 1;
ok(
  // THREE call sites: the recipe's paused dt=0 reseat, the G2-WARMSTART run-through
  // loop inside the SAME recipe (advances the cold-attached managers past the
  // ping-pong guard, sinr-live cold-start only), and the useFrame play loop. The
  // warm-up is part of the one recipe — it adds NO new reseat site
  // (createRuntimeFrameStepState(targetOffset) is still exactly once, asserted above).
  stepCalls === 3,
  `SINGLE-PATH FAILED: expected exactly THREE stepRuntimeFrame calls (recipe reseat + G2-WARMSTART run-through + useFrame play), found ${stepCalls}`,
);
// no reseat path publishes a blank frame (the signalReset createEmptyFrame flicker is gone)
ok(
  !useSimSrc.includes('frameRef.current = createEmptyFrame'),
  'SINGLE-PATH FAILED: a reseat path still publishes a blank createEmptyFrame frame',
);
// INTENT DISPATCH — scope to the recipe BODY (decl -> its resetMobilityStates()) so the
// transitionHoManagers type signature / comments elsewhere cannot satisfy it. This pins
// the real hook dispatch: cold-start RESETs, seek/wrap REBASE (the S3-2 serving-survives
// mechanism). Without this scoping a `kind: 'rebase'` whole-source match is vacuous
// (the type sig `{ kind: 'cold-start' } | { kind: 'rebase'; … }` already contains it).
const recipeBodyStart = useSimSrc.indexOf('const buildRuntimeStateAt = useCallback(');
ok(recipeBodyStart !== -1, 'SINGLE-PATH FAILED: buildRuntimeStateAt recipe body not found');
const recipeBody = useSimSrc.slice(recipeBodyStart, useSimSrc.indexOf('resetMobilityStates();', recipeBodyStart));
ok(
  /if \(params\.intent === 'cold-start'\) \{\s*resetAllHoManagers\(\);/.test(recipeBody),
  'INTENT DISPATCH FAILED: the cold-start branch does not reset() the HO managers',
);
ok(
  recipeBody.includes('transitionHoManagers({') && recipeBody.includes("kind: 'rebase'"),
  'INTENT DISPATCH FAILED: the seek/wrap branch does not REBASE the HO managers (S3-2 serving-survives)',
);
// the signalReset cold-reseat fires ONLY on signalResetKey — NOT on the recipe's wide
// identity (a live `speed` change must not cold-reset serving). [signalResetKey] deps.
ok(
  useSimSrc.includes('}, [signalResetKey]);'),
  'SIGNAL-RESET DEPS FAILED: the signalReset effect must depend on signalResetKey ONLY (not buildRuntimeStateAt/speed)',
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION II — QUAR-S3-STEP retirement replacements
// ═══════════════════════════════════════════════════════════════════════════════

// block #3 -> imported-constant VALUE asserts (was the 15° literal triple-pin).
ok(MIN_ELEVATION_DEG === 15, `VALUE FAILED: runtime MIN_ELEVATION_DEG is ${MIN_ELEVATION_DEG}, not 15`);
ok(DEFAULT_MIN_ELEVATION_DEG === 15, `VALUE FAILED: cell-layout DEFAULT_MIN_ELEVATION_DEG is ${DEFAULT_MIN_ELEVATION_DEG}, not 15`);
ok(
  SINR_LIVE_CELL_MIN_ELEVATION_DEG === 15,
  `VALUE FAILED: cell-adapter SINR_LIVE_CELL_MIN_ELEVATION_DEG is ${SINR_LIVE_CELL_MIN_ELEVATION_DEG}, not 15`,
);
ok(
  MIN_ELEVATION_DEG === DEFAULT_MIN_ELEVATION_DEG
    && DEFAULT_MIN_ELEVATION_DEG === SINR_LIVE_CELL_MIN_ELEVATION_DEG,
  'VALUE FAILED: elevation-mask parity broke (runtime != cell-layout != cell-adapter)',
);

// block #2 -> structural import-boundary: the runtime step does not pull the cell
// adapter/model and produces no cell-truth field (cell truth ∉ step callee set).
const stepSrc = readFileSync(new URL('../src/scene/runtimeFrameStep.ts', import.meta.url), 'utf8');
ok(
  !stepSrc.includes("from './sinrLiveCellRuntime'") && !stepSrc.includes("from './sinrLiveCellModel'"),
  'STRUCTURAL FAILED: runtimeFrameStep imports a cell module (cell truth must stay ∉ step callee set)',
);
ok(
  // broad substring (≥ the retired QUAR-S3-STEP block #2 `assertNotContains 'sinrLiveCell'`):
  // catches the additive `sinrLiveCells` field AND any bare/side-effect/comment cell reference.
  !stepSrc.includes('sinrLiveCell'),
  'STRUCTURAL FAILED: runtimeFrameStep references a cell-truth symbol (the step must stay free of cell truth — at least as strong as the retired text pin)',
);

// block #1 -> behavior: the cell-truth factory is lane-gated, a null attach is a no-op.
ok(
  createSinrLiveCellModel(h.profile, false, APP_EPOCH_MS) === null,
  'LANE-GATE FAILED: the cell-truth factory did not return null off the sinr-live lane',
);
ok(
  createSinrLiveCellModel(h.profile, true, APP_EPOCH_MS) !== null,
  'LANE-GATE FAILED: the cell-truth factory returned null ON the sinr-live lane',
);
const additiveProbe = {} as CellTruthFrame;
attachSinrLiveCellFrame(additiveProbe, null, 1);
ok(
  additiveProbe.sinrLiveCells === undefined,
  'ADDITIVE FAILED: a null-model attach added a sinrLiveCells field (off-lane frames must be byte-identical)',
);
// lane ownership: MainScene gates the cell truth to sinr-live (robust line, not the
// brittle multi-line call-shape pin the retired block held).
const mainSceneSrc = readFileSync(new URL('../src/scene/MainScene.tsx', import.meta.url), 'utf8');
ok(
  mainSceneSrc.includes("const useEarthFixedCellTruth = sceneLane === 'sinr-live';"),
  'LANE-OWNERSHIP FAILED: MainScene no longer gates the earth-fixed cell truth to the sinr-live lane',
);
// thread: MainScene must PASS useEarthFixedCellTruth into the useSimulation hook (not
// just declare it) — the retired block #1 pinned this; without it the cell truth could
// be silently mis-gated (e.g. the arg swapped to a literal `false`). Scope FORWARD from
// the hook call so the declaration line (which precedes it) cannot satisfy the check.
const hookCallStart = mainSceneSrc.indexOf('const sim = useSimulation(');
ok(hookCallStart !== -1, 'LANE-OWNERSHIP FAILED: MainScene useSimulation hook call not found');
ok(
  mainSceneSrc.slice(hookCallStart, hookCallStart + 1200).includes('useEarthFixedCellTruth'),
  'LANE-OWNERSHIP FAILED: MainScene does not thread useEarthFixedCellTruth into the useSimulation hook call (cell truth could be silently mis-gated)',
);

console.log(
  `[${GATE}] PASS — ${passed} checks\n`
  + `  I.A one-reset behavior: cold reseat @t=${DEMO_SEC} non-blank (served ${coldServed}/${UE_COUNT}), `
  + `run-twice byte-stable, intent dispatch (cold-start clears eventLog / seek-wrap preserves it).\n`
  + '  I.B single-path: buildRuntimeStateAt recipe + 3 delegating entry points, ONE reseat site, no blank-frame reseat.\n'
  + `  II QUAR-S3-STEP retired: 15° VALUE parity (all ${MIN_ELEVATION_DEG}), step ∉ cell callee set, lane-gated factory + additive null-attach + MainScene lane ownership.`,
);
