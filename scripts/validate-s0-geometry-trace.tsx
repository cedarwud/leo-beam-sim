/**
 * Consolidation S0 — geometry-trace golden gate (the slice before==after harness).
 *
 * Captures the paired TRUTH (SimFrame) + DISPLAY (VizFrame) geometry trace on
 * the frozen baseline (candidate-rich, 100 UEs, steered sinr-live render) and
 * diffs it against the committed golden fixture at 1e-6. Every consolidation
 * slice re-runs this gate:
 *   - truth-layer slices (S1 coords, S3 step/reset) must diff CLEAN on truth.*
 *   - display-layer slices (S2 identity, S5 render) hold truth.* clean and
 *     declare legitimate display changes via ignorePaths in their own runs.
 *
 * Meta-gates (d6 protocol): run-twice in-process determinism (A==B at 1e-9)
 * and a perturbation positive control (1e-3 bump must FAIL the diff).
 * First run writes the fixture (fixtures/s0-geometry/candidate-rich-baseline.json).
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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
import {
  attachSinrLiveCellFrame,
  createSinrLiveCellModel,
} from '../src/scene/sinrLiveCellRuntime.ts';
import type { RuntimeConfig } from '../src/scene/types.ts';
import {
  diffGeometryTrace,
  serializeGeometryTraceStep,
  type GeometryTrace,
  type GeometryTraceStep,
} from '../src/validation/geometrySnapshot.ts';
import { captureVizFrame } from '../src/validation/vizFrameProbe.tsx';

const GATE = 'validate:s0:geometry-trace';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z
const UE_COUNT = 100;
const STEP_SEC = 5;
const STEP_COUNT = 40; // 200 s of the live window
const FLOAT_TOLERANCE = 1e-6;
const FIXTURE_PATH = path.join('fixtures', 's0-geometry', 'candidate-rich-baseline.json');

function captureTrace(): GeometryTrace {
  clockMs = CLOCK_EPOCH_MS; // rebase the patched clock per run (determinism A/B)
  const profile = loadProfile(PROFILE_ID);
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
    ...deriveRuntimeVisualSettings(false),
    beamDensity: 'all',
    viewport: { width: 1600, height: 1000 },
    ueCount: UE_COUNT,
    uePrimaryAnchorMode: 'observer',
  };

  const steps: GeometryTraceStep[] = [];
  for (let step = 0; step < STEP_COUNT; step += 1) {
    advanceClock();
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
    const viz = captureVizFrame({
      sim: out.frame,
      geometry,
      runtime,
      beamHopping: profile.beamHopping,
    });
    steps.push(serializeGeometryTraceStep({ step, sim: out.frame, viz }));
  }

  return { profileId: PROFILE_ID, ueCount: UE_COUNT, stepSec: STEP_SEC, floatTolerance: FLOAT_TOLERANCE, steps };
}

// ---- Run twice in-process: determinism gate ----
const traceA = captureTrace();
const traceB = captureTrace();
const determinismDiffs = diffGeometryTrace(traceA, traceB, { floatTolerance: 1e-9 });
assert.equal(
  determinismDiffs.length,
  0,
  `engine+viz pipeline is nondeterministic under the fixed-step clock protocol:\n${determinismDiffs.slice(0, 10).join('\n')}`,
);

// ---- Perturbation positive control: the diff must catch a 1e-3 bump ----
const perturbed = JSON.parse(JSON.stringify(traceA)) as { steps: { truth: { ue: { groundX: number | null } } }[] };
const target = perturbed.steps[Math.floor(STEP_COUNT / 2)].truth.ue;
target.groundX = (target.groundX ?? 0) + 1e-3;
const perturbDiffs = diffGeometryTrace(traceA, perturbed, { floatTolerance: FLOAT_TOLERANCE });
assert.ok(
  perturbDiffs.length > 0,
  'perturbation positive control failed: a 1e-3 geometry change was not detected — the diff is not measuring anything',
);

// ---- Golden fixture gate (write-on-first-run, then diff forever) ----
const nonEmptySteps = traceA.steps.filter(
  s => s.truth.serving.satId !== null && s.display.satBeams.length > 0,
).length;
assert.ok(nonEmptySteps > STEP_COUNT / 2, `vacuous trace: only ${nonEmptySteps}/${STEP_COUNT} steps have serving + beams`);

if (!existsSync(FIXTURE_PATH)) {
  mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(traceA, null, 2)}\n`, 'utf8');
  console.log(`[${GATE}] baseline fixture WRITTEN: ${FIXTURE_PATH} (${traceA.steps.length} steps) — commit it; future runs diff against it`);
} else {
  const golden = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as GeometryTrace;
  const ignorePaths = (process.env.S0_TRACE_IGNORE ?? '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
  const goldenDiffs = diffGeometryTrace(golden, traceA, { floatTolerance: FLOAT_TOLERANCE, ignorePaths });
  if (goldenDiffs.length > 0) {
    console.error(`[${GATE}] FAIL — ${goldenDiffs.length} diffs vs ${FIXTURE_PATH} (first 20):`);
    for (const diff of goldenDiffs.slice(0, 20)) console.error(`  ${diff}`);
    console.error('  (a slice declaring legitimate display changes passes ignore prefixes via S0_TRACE_IGNORE, then re-baselines in its own commit)');
    process.exit(1);
  }
  console.log(`[${GATE}] PASS — trace matches golden at ${FLOAT_TOLERANCE}${ignorePaths.length > 0 ? ` (ignored: ${ignorePaths.join(', ')})` : ''}`);
}

console.log(`[${GATE}] determinism A==B verified, perturbation control verified, ${nonEmptySteps}/${STEP_COUNT} active steps`);
