/**
 * Consolidation S0 — connected-sat-has-beam invariant gate (headless).
 *
 * Drives the REAL sinr-live runtime (stepRuntimeFrame, 100 UEs, candidate-rich
 * profile) plus the REAL display pipeline (liveSimToScene -> useBeamViz via a
 * renderToStaticMarkup probe — the proven vc1d pattern), then evaluates
 * src/validation/connectedSatBeamInvariant.ts per step:
 *
 *   every satellite the UI calls connected must have a visible steered beam.
 *
 *   - must-hold violations FAIL the gate (regression vs the frozen baseline
 *     render: primary serving sat is priority-injected, so it must be beamed).
 *   - KNOWN-GAP violations (audit defects: population beyond the display cap,
 *     cell-vs-steered dual oracle, stale latched serving) are MEASURED and
 *     reported each run — documented evidence, never a silent pass. Their
 *     retiring slices flip them to must-hold (see KNOWN_GAPS).
 *
 * Meta-gates: (1) non-vacuous — the run must produce connected claims and
 * visible beams; (2) positive control — removing the primary serving sat from
 * a real captured VizFrame must produce a must-hold violation.
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
  createSinrLiveCellModel,
} from '../src/scene/sinrLiveCellRuntime.ts';
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

const runtime: RuntimeConfig = {
  appMode: 'sinr-experiment',
  presentationMode: 'demo-readability',
  replay,
  ...deriveRuntimeVisualSettings('tuning', false),
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
  const report = evaluateConnectedSatBeamInvariant({ frame: out.frame, viz, plan });

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

  // Positive control on the first frame with a beamed primary serving sat:
  // delete that sat's beams from a shallow viz copy -> must-hold violation.
  if (!positiveControlDone && out.frame.serving.satId !== null
    && report.visibleBeamSatIds.has(out.frame.serving.satId)) {
    const servingSatId = out.frame.serving.satId;
    const crippled: VizFrame = {
      ...viz,
      beamSatIds: new Set([...viz.beamSatIds].filter(id => id !== servingSatId)),
      satBeams: new Map([...viz.satBeams].filter(([id]) => id !== servingSatId)),
    };
    const controlReport = evaluateConnectedSatBeamInvariant({ frame: out.frame, viz: crippled, plan });
    assert.ok(
      controlReport.mustHoldViolations.some(v => v.claim.satId === servingSatId),
      'positive control failed: removing the primary serving beam did not produce a must-hold violation — the invariant is not measuring the mount',
    );
    positiveControlDone = true;
  }
}

// Non-vacuous meta-gates.
assert.ok(stepsWithClaims > STEP_COUNT / 2, `vacuous run: only ${stepsWithClaims}/${STEP_COUNT} steps had connected claims`);
assert.ok(stepsWithBeams > STEP_COUNT / 2, `vacuous run: only ${stepsWithBeams}/${STEP_COUNT} steps had visible beams`);
assert.ok(positiveControlDone, 'positive control never armed (no step had a beamed primary serving sat)');

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
