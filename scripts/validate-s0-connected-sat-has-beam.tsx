/**
 * Consolidation S0 — connected-sat-has-beam invariant gate (headless).
 *
 * Drives the REAL sinr-live runtime (stepRuntimeFrame, 100 UEs, candidate-rich
 * profile) plus the REAL display pipeline (liveSimToScene -> useBeamViz via a
 * renderToStaticMarkup probe — the proven vc1d pattern), then evaluates
 * src/validation/connectedSatBeamInvariant.ts per step:
 *
 *   every satellite the UI calls connected must have a visible beam.
 *
 *   On the sinr-live lane the visible beams are the earth-fixed CELL CONES (S5-2:
 *   `showSinrLiveCellBeams` flipped true, the steered render retired) and the
 *   connected claims read the ONE cell oracle (primary + population + cell-truth,
 *   D-ORACLE A). S5-3 retired the two render-coupled KNOWN_GAPS, so:
 *
 *   - must-hold violations FAIL the gate. The cones now beam EVERY serving sat
 *     (focus cap retired → draw-all; serving-sat-complete cone-apex map for sats
 *     beyond the top-12 display slice), so a connected sat with no cone is a real
 *     regression — primary, population, AND cell-truth all must hold.
 *   - the only remaining KNOWN-GAP is 'stale-serving-absent-from-truth-set'
 *     (S2/S3): a sat the truth no longer carries; measured + reported, never a
 *     silent pass.
 *
 * Meta-gates: (1) non-vacuous — the run must produce connected claims and
 * visible beams; (2) positive controls — removing the PRIMARY serving sat from
 * the cone set must produce a must-hold violation (the invariant measures the
 * cone render), and removing a NON-PRIMARY serving sat must ALSO produce a
 * must-hold violation (the S5-3 cell-truth/population flip is live).
 *
 * Determinism: d6 monotonic-clock protocol (performance.now/Date.now patched
 * before stepping; no RNG on this engine path).
 */
import assert from 'node:assert/strict';

// ---- Monotonic-clock patch (d6 protocol) ----
const CLOCK_EPOCH_MS = 1_700_000_000_000;
const CLOCK_TICK_MS = 50;
let clockMs = CLOCK_EPOCH_MS;
function advanceClock(): void {
  clockMs += CLOCK_TICK_MS;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).performance = {
  ...((globalThis as any).performance ?? {}),
  now: () => clockMs - CLOCK_EPOCH_MS,
};
Date.now = () => clockMs;

import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';
import { deriveRuntimeVisualSettings } from '../src/scene/runtimeConfig.ts';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry.ts';
import { resolveSceneLaneRenderPlan } from '../src/scene/sceneLaneRenderPlan.ts';
import {
  attachSinrLiveCellFrame,
  buildSinrLiveCellLayout,
  createSinrLiveCellModel,
} from '../src/scene/sinrLiveCellRuntime.ts';
import {
  resolveSinrLiveCellBeamConeItems,
  type SinrLiveCellPlacement,
} from '../src/viz/SinrLiveCellBeamCones.tsx';
import { resolvePrimaryCellServingSatId } from '../src/scene/sinrLiveCellModel.ts';
import { captureVizFrame } from '../src/validation/vizFrameProbe.tsx';
import type { RuntimeConfig, SimFrame, VizFrame } from '../src/scene/types.ts';
import {
  evaluateConnectedSatBeamInvariant,
  KNOWN_GAPS,
  type InvariantViolation,
} from '../src/validation/connectedSatBeamInvariant.ts';

const APP_EPOCH_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z, fixed (no Date.UTC on patched clock needed)
const UE_COUNT = 100;
const STEP_SEC = 5;
const STEP_COUNT = 120; // 600 s of the live window
const GATE = 'validate:s0:connected-sat-has-beam';

const profile = loadProfile('hobs-2024-candidate-rich');
const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
const hoManager = new HandoverManager(profile.handover);
const secondaryHoManagers = Array.from(
  { length: UE_COUNT - 1 },
  () => new HandoverManager(profile.handover),
);
const state = createRuntimeFrameStepState(0);
const replay = { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: false, windowLengthSec: 7200 };
const cellModel = createSinrLiveCellModel(profile, true, APP_EPOCH_MS);
assert.ok(cellModel !== null, 'cell model must build under the sinr-live gate');

const geometry = sceneGeometryFromProfile({
  shell: { altitudeKm: profile.orbit.shells[0]?.altitudeKm },
  antenna: { beamwidth3dBRad: profile.antenna.beamwidth3dBRad },
  handover: { triggerTimeSec: profile.handover.triggerTimeSec },
  orbit: { shells: profile.orbit.shells.map(s => ({ id: s.id, altitudeKm: s.altitudeKm })) },
  beams: { frequencyReuse: profile.beams.frequencyReuse },
});

// S5-2: the cell-cone ground placements, built exactly as MainScene does
// (same `buildSinrLiveCellLayout(profile)` + `worldUnitsPerKm`), so the cone
// resolver here produces the SAME cone set the lane renders. The cone APEX is the
// serving-sat-complete `viz.coneApexWorldById` (all projected sats, not the
// top-12 display slice) so a serving sat beyond the display cap still cones.
// TYPE-HONESTY (SN-5): geometry.kmPerWorldUnit is optional and this profile stub
// does NOT set it, so at runtime this has always been 1/undefined = NaN — the
// `?? NaN` is value-identical and makes it explicit. (MainScene falls back to
// paperUserArea.kmPerWorldUnit; here the NaN placements are inert because the
// invariant consumes only the resolver's satId set, never the coordinates.)
const worldUnitsPerKm = 1 / (geometry.kmPerWorldUnit ?? NaN);
const cellLayout = buildSinrLiveCellLayout(profile);
const placementByCellId = new Map<number, SinrLiveCellPlacement>(
  cellLayout.centers.map(center => [center.cellId, {
    cellId: center.cellId,
    worldX: center.localXKm * worldUnitsPerKm,
    worldZ: -center.localYKm * worldUnitsPerKm,
    radiusWorld: cellLayout.cellRadiusKm * worldUnitsPerKm,
  }]),
);

const runtime: RuntimeConfig = {
  appMode: 'sinr-experiment',
  presentationMode: 'demo-readability',
  replay,
  ...deriveRuntimeVisualSettings(false),
  beamDensity: 'all',
  viewport: { width: 1600, height: 1000 },
  ueCount: UE_COUNT,
  uePrimaryAnchorMode: 'observer',
};

// Lane flags from the REAL render-plan resolver (sinr-live, live source).
const plan = resolveSceneLaneRenderPlan({
  sceneLane: 'sinr-live',
  sceneSource: 'live-sim',
  beamCalloutsEnabled: true,
  beamDensity: 'all',
  cinematicMode: 'off',
  effectsEnabled: { servingRipple: true, pendingRipple: true, orbitTrail: true, spineParticles: true },
  paused: false,
  reducedMotion: false,
  recentHoActive: false,
});

function captureViz(sim: SimFrame): VizFrame {
  return captureVizFrame({ sim, geometry, runtime, beamHopping: profile.beamHopping });
}

function violationKey(violation: InvariantViolation): string {
  return `${violation.claim.surface}:${violation.claim.satId}`;
}

let stepsWithClaims = 0;
let stepsWithBeams = 0;
let totalClaims = 0;
const mustHoldFailures: { step: number; tSec: number; violations: InvariantViolation[] }[] = [];
const knownGapCounts = new Map<string, number>();
const knownGapExamples = new Map<string, string>();
let positiveControlDone = false;
let nonPrimaryControlDone = false;
// Screen-always-has-beams invariant bookkeeping (see the in-loop block).
let stepsWithServedCells = 0;
let stepsHeroUnservedWhileFieldServed = 0;
let beamlessControlDone = false;
const beamlessScreenFailures: { step: number; tSec: number; arm: string; servedCellCount: number }[] = [];

for (let step = 0; step < STEP_COUNT; step += 1) {
  advanceClock();
  const tSec = step * STEP_SEC;
  const out = stepRuntimeFrame({
    profile,
    replay,
    speed: 1,
    paused: step === 0,
    deltaSec: step === 0 ? 0 : STEP_SEC,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    hoManager,
    state,
    ueCount: UE_COUNT,
    secondaryHoManagers,
    uePrimaryAnchorMode: 'observer',
  });
  attachSinrLiveCellFrame(out.frame, cellModel, step === 0 ? 0 : STEP_SEC);

  const viz = captureViz(out.frame);
  // The satIds the cell-cone render mounts a cone for this frame — the SAME
  // resolver + APEX map MainScene uses (focusSatIds null = draw every serving
  // sat, D-STYLE A). With showSinrLiveCellBeams flipped true, this is the lane's
  // visible-beam set (the steered branch is gone).
  const coneItems = resolveSinrLiveCellBeamConeItems({
    cellFrame: out.frame.sinrLiveCells,
    placementByCellId,
    satelliteWorldById: viz.coneApexWorldById,
    focusSatIds: null,
  });
  const coneSatIds = new Set(coneItems.map(item => item.satId));
  const report = evaluateConnectedSatBeamInvariant({ frame: out.frame, viz, plan, coneSatIds });

  // ── SCREEN-ALWAYS-HAS-BEAMS invariant ──────────────────────────────────────
  // "As long as ANY cell is served, the renderable serving-cone count must be > 0."
  // Two arms, because the lane resolves cones twice over:
  //   (a) DRAW-ALL (focusSatIds null) — truth→render completeness: a frame whose
  //       truth says N cells are served must not resolve to an empty cone set.
  //   (b) HERO-ONLY FOCUS — the sharp end. The protagonist's serving sat is the
  //       focus set; when the protagonist is UNSERVED that set is EMPTY, and the
  //       resolver's `focusSatIds.size > 0 ? … : null` fallback must widen back to
  //       draw-all. Without that fallback an unserved protagonist blanks every cone
  //       on screen while the field is still serving 30+ cells — the regression this
  //       arm exists to catch.
  const servedCellCount = out.frame.sinrLiveCells?.servedCellCount ?? 0;
  const primaryServingSatId = out.frame.sinrLiveCells
    ? resolvePrimaryCellServingSatId(out.frame.sinrLiveCells, out.frame.perUePositions)
    : null;
  const heroFocusSatIds = new Set(primaryServingSatId === null ? [] : [primaryServingSatId]);
  const heroFocusConeItems = resolveSinrLiveCellBeamConeItems({
    cellFrame: out.frame.sinrLiveCells,
    placementByCellId,
    satelliteWorldById: viz.coneApexWorldById,
    focusSatIds: heroFocusSatIds,
  });
  if (servedCellCount > 0) {
    stepsWithServedCells += 1;
    if (primaryServingSatId === null) stepsHeroUnservedWhileFieldServed += 1;
    if (coneItems.length === 0) {
      beamlessScreenFailures.push({ step, tSec, arm: 'draw-all', servedCellCount });
    }
    if (heroFocusConeItems.length === 0) {
      beamlessScreenFailures.push({ step, tSec, arm: 'hero-only-focus', servedCellCount });
    }
  }

  // Positive control for the arms above: narrowing the focus onto a satellite that
  // serves NOTHING must collapse the cone set to empty — proving these assertions
  // measure the resolver's cone output and would fire on a real blank-screen bug.
  if (!beamlessControlDone && servedCellCount > 0 && coneItems.length > 0) {
    const bogusFocusItems = resolveSinrLiveCellBeamConeItems({
      cellFrame: out.frame.sinrLiveCells,
      placementByCellId,
      satelliteWorldById: viz.coneApexWorldById,
      focusSatIds: new Set(['__no-such-satellite__']),
    });
    assert.equal(
      bogusFocusItems.length, 0,
      'beamless-screen positive control failed: a focus set naming no serving satellite still resolved cones — the screen-always-has-beams assertions are not measuring the cone resolver',
    );
    beamlessControlDone = true;
  }

  totalClaims += report.claims.length;
  if (report.claims.length > 0) stepsWithClaims += 1;
  if (report.visibleBeamSatIds.size > 0) stepsWithBeams += 1;

  if (report.mustHoldViolations.length > 0) {
    mustHoldFailures.push({ step, tSec, violations: [...report.mustHoldViolations] });
  }
  for (const violation of report.knownGapViolations) {
    const id = violation.classification;
    knownGapCounts.set(id, (knownGapCounts.get(id) ?? 0) + 1);
    if (!knownGapExamples.has(id)) {
      knownGapExamples.set(id, `t=${tSec}s ${violationKey(violation)}`);
    }
  }

  // Positive control (S5-2 cone path): on the first frame with a beamed primary
  // serving sat, remove that sat from the cone set -> must-hold violation. This
  // proves the invariant measures the CELL-CONE render (the new visible-beam
  // oracle), not the retired steered mount. The primary serving sat is a real
  // visible sat (in frame.satellites) so its primary-serving claim is must-hold.
  const primaryClaim = report.claims.find(claim => claim.surface === 'primary-serving');
  if (!positiveControlDone && primaryClaim !== undefined && coneSatIds.has(primaryClaim.satId)) {
    const crippledCones = new Set([...coneSatIds].filter(id => id !== primaryClaim.satId));
    const controlReport = evaluateConnectedSatBeamInvariant({
      frame: out.frame, viz, plan, coneSatIds: crippledCones,
    });
    assert.ok(
      controlReport.mustHoldViolations.some(v => v.claim.satId === primaryClaim.satId),
      'positive control failed: removing the primary serving sat from the cone set did not produce a must-hold violation — the invariant is not measuring the cone render',
    );
    positiveControlDone = true;
  }

  // Positive control #2 (S5-3 flip): crippling a NON-primary serving sat must
  // ALSO produce a must-hold violation — proving the cell-truth/population
  // classification flipped from KNOWN-GAP to must-hold. RED if classifyViolation
  // reverts those surfaces to a known-gap.
  const primarySatId = primaryClaim?.satId;
  const nonPrimaryConeSatId = [...coneSatIds].find(id => id !== primarySatId);
  if (!nonPrimaryControlDone && nonPrimaryConeSatId !== undefined) {
    const crippledCones = new Set([...coneSatIds].filter(id => id !== nonPrimaryConeSatId));
    const controlReport = evaluateConnectedSatBeamInvariant({
      frame: out.frame, viz, plan, coneSatIds: crippledCones,
    });
    assert.ok(
      controlReport.mustHoldViolations.some(v => v.claim.satId === nonPrimaryConeSatId),
      'positive control failed: removing a non-primary serving sat from the cone set did not produce a must-hold violation — the S5-3 cell-truth/population must-hold flip is not live',
    );
    nonPrimaryControlDone = true;
  }
}

// Non-vacuous meta-gates.
assert.ok(stepsWithClaims > STEP_COUNT / 2, `vacuous run: only ${stepsWithClaims}/${STEP_COUNT} steps had connected claims`);
assert.ok(stepsWithBeams > STEP_COUNT / 2, `vacuous run: only ${stepsWithBeams}/${STEP_COUNT} steps had visible beams`);
assert.ok(positiveControlDone, 'positive control never armed (no step had a beamed primary serving sat)');
assert.ok(nonPrimaryControlDone, 'non-primary positive control never armed (no step had a second beamed serving sat)');
assert.ok(
  stepsWithServedCells > STEP_COUNT / 2,
  `vacuous screen-always-has-beams check: only ${stepsWithServedCells}/${STEP_COUNT} steps had a served cell at all`,
);
assert.ok(beamlessControlDone, 'beamless-screen positive control never armed (no step had both a served cell and a cone)');

console.log(`[${GATE}] ${STEP_COUNT} steps x ${STEP_SEC}s, ${UE_COUNT} UEs, ${totalClaims} connected claims checked`);
for (const [id, count] of [...knownGapCounts.entries()].sort()) {
  const contract = KNOWN_GAPS[id];
  console.log(`  KNOWN-GAP ${id}: ${count} claim-steps unbeamed (first: ${knownGapExamples.get(id)}) — retires with ${contract.retiringSlice}`);
}
if (knownGapCounts.size === 0) {
  console.log('  KNOWN-GAP: none observed in this window (gaps are lane/window dependent — informational)');
}

console.log(
  `  SCREEN-ALWAYS-HAS-BEAMS: ${stepsWithServedCells}/${STEP_COUNT} steps had a served cell; `
  + `all of them resolved >0 serving cones under BOTH draw-all and hero-only focus. `
  + `${stepsHeroUnservedWhileFieldServed} of those steps had an UNSERVED protagonist while the field was still served `
  + `(the empty-focus fallback arm; 0 means this window never exercised it).`,
);

if (beamlessScreenFailures.length > 0) {
  for (const failure of beamlessScreenFailures.slice(0, 5)) {
    console.error(
      `  BEAMLESS-SCREEN violation at step ${failure.step} (t=${failure.tSec}s), arm=${failure.arm}: `
      + `${failure.servedCellCount} cell(s) served but 0 serving cones resolved`,
    );
  }
  console.error(`[${GATE}] FAIL — ${beamlessScreenFailures.length} beamless-screen violation(s): served cells with zero renderable serving cones`);
  process.exit(1);
}

if (mustHoldFailures.length > 0) {
  for (const failure of mustHoldFailures.slice(0, 5)) {
    console.error(`  MUST-HOLD violation at step ${failure.step} (t=${failure.tSec}s): ${failure.violations.map(violationKey).join(', ')}`);
  }
  console.error(`[${GATE}] FAIL — ${mustHoldFailures.length} step(s) with must-hold violations`);
  process.exit(1);
}

console.log(`[${GATE}] PASS — invariant holds for every must-hold claim (positive control verified)`);
