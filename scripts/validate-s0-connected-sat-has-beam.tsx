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
const worldUnitsPerKm = 1 / geometry.kmPerWorldUnit;
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
  replayProofLayerRequested: false,
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
  const coneSatIds = new Set(
    resolveSinrLiveCellBeamConeItems({
      cellFrame: out.frame.sinrLiveCells,
      placementByCellId,
      satelliteWorldById: viz.coneApexWorldById,
      focusSatIds: null,
    }).map(item => item.satId),
  );
  const report = evaluateConnectedSatBeamInvariant({ frame: out.frame, viz, plan, coneSatIds });

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

console.log(`[${GATE}] ${STEP_COUNT} steps x ${STEP_SEC}s, ${UE_COUNT} UEs, ${totalClaims} connected claims checked`);
for (const [id, count] of [...knownGapCounts.entries()].sort()) {
  const contract = KNOWN_GAPS[id];
  console.log(`  KNOWN-GAP ${id}: ${count} claim-steps unbeamed (first: ${knownGapExamples.get(id)}) — retires with ${contract.retiringSlice}`);
}
if (knownGapCounts.size === 0) {
  console.log('  KNOWN-GAP: none observed in this window (gaps are lane/window dependent — informational)');
}

if (mustHoldFailures.length > 0) {
  for (const failure of mustHoldFailures.slice(0, 5)) {
    console.error(`  MUST-HOLD violation at step ${failure.step} (t=${failure.tSec}s): ${failure.violations.map(violationKey).join(', ')}`);
  }
  console.error(`[${GATE}] FAIL — ${mustHoldFailures.length} step(s) with must-hold violations`);
  process.exit(1);
}

console.log(`[${GATE}] PASS — invariant holds for every must-hold claim (positive control verified)`);
