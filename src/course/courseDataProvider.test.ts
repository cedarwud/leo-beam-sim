#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type {
  CourseDataProvider,
  CourseManifest,
  CourseIdentity,
  CourseSceneFrame,
  E1Experiment,
  E1Arm,
  E2Experiment,
  IoTChallenge,
  LearningBundle,
  LearningBundleInput,
  ScenarioIdentity,
  TleJourney,
  TleTrajectoryFrame,
} from './contract';
import {
  C90_FIXTURE_PROVIDER,
  C90_SCENARIO,
} from './fixtures/e1-fixture';
import {
  assertCourseDataProvider,
  CourseContractError,
  C90_FRAME_UNITS,
  C90_TLE_STAGE_ORDER,
  createValidatedCourseDataProvider,
} from './contract';
import { createInitialCourseSession, startE1Arm } from './session';

function providerWith(overrides: Partial<CourseDataProvider>): CourseDataProvider {
  const fixture = C90_FIXTURE_PROVIDER;
  return {
    kind: fixture.kind,
    providerId: fixture.providerId,
    getManifest: () => fixture.getManifest(),
    getTleJourney: () => fixture.getTleJourney(),
    getE1Experiment: () => fixture.getE1Experiment(),
    getE2Experiment: () => fixture.getE2Experiment(),
    getIoTChallenge: () => fixture.getIoTChallenge(),
    buildLearningBundle: (input: LearningBundleInput) => fixture.buildLearningBundle(input),
    ...overrides,
  };
}

function e1WithArm(mutator: (arm: E1Arm) => E1Arm): CourseDataProvider {
  const fixture = C90_FIXTURE_PROVIDER;
  const e1 = fixture.getE1Experiment();
  const firstArm = e1.arms[0];
  if (firstArm === undefined) throw new Error('fixture test requires the first E1 arm');
  return providerWith({
    getE1Experiment: (): E1Experiment => ({
      ...e1,
      arms: [mutator(firstArm), ...e1.arms.slice(1)],
    }),
  });
}

function assertRejected(provider: CourseDataProvider, message: RegExp): void {
  assert.throws(
    () => assertCourseDataProvider(provider),
    error => error instanceof CourseContractError && message.test(error.message),
  );
}

const STUB_PROVIDER_ID = 'test-stub-provider';
const STUB_FIXTURE_ID = 'test-stub-fixture';
const STUB_SCENARIO_ID = 'test-stub-scenario';

function stubScenario(base: ScenarioIdentity): ScenarioIdentity {
  return {
    ...base,
    providerKind: 'stub',
    providerId: STUB_PROVIDER_ID,
    fixtureId: STUB_FIXTURE_ID,
    scenarioId: STUB_SCENARIO_ID,
  };
}

function stubFrame(frame: CourseSceneFrame): CourseSceneFrame {
  const identity: CourseIdentity = {
    ...frame.identity,
    providerKind: 'stub',
    providerId: STUB_PROVIDER_ID,
    fixtureId: STUB_FIXTURE_ID,
    scenarioId: STUB_SCENARIO_ID,
  };
  return { ...frame, identity };
}

function stubE1(experiment: E1Experiment, scenario: ScenarioIdentity): E1Experiment {
  return {
    ...experiment,
    scenario,
    arms: experiment.arms.map(arm => ({ ...arm, frames: arm.frames.map(stubFrame) })),
  };
}

function stubE2(experiment: E2Experiment, scenario: ScenarioIdentity): E2Experiment {
  const retagTrace = (trace: E2Experiment['traceA']): E2Experiment['traceA'] => ({
    ...trace,
    branches: trace.branches.map(branch => ({ ...branch, frames: branch.frames.map(stubFrame) })),
  });
  return { ...experiment, scenario, traceA: retagTrace(experiment.traceA), traceB: retagTrace(experiment.traceB) };
}

function stubIoT(challenge: IoTChallenge, scenario: ScenarioIdentity): IoTChallenge {
  return {
    ...challenge,
    scenario,
    runs: challenge.runs.map(run => ({ ...run, frame: stubFrame(run.frame) })),
  };
}

test('fixture provider exposes one coherent, versioned scenario identity', () => {
  const manifest = C90_FIXTURE_PROVIDER.getManifest();
  const e1 = C90_FIXTURE_PROVIDER.getE1Experiment();

  assert.equal(manifest.courseId, 'C-90-ENERGY-1');
  assert.match(manifest.claimBoundary, /SIMULATED TEACHING DATA/);
  assert.equal(manifest.scenario.scenarioId, 'ntpu-pass-01');
  assert.equal(manifest.contractVersion, 'c90-energy-1-fixture-v1');
  assert.equal(e1.arms.length, 3);
  assert.equal(new Set(e1.arms.map(arm => arm.outcome.serviceStatus)).size, 2);
  assert.ok(new Set(e1.arms.map(arm => arm.outcome.completionSec)).size >= 3);
  assert.ok(new Set(e1.arms.map(arm => arm.outcome.powerW)).size >= 3);
  assert.ok(new Set(e1.arms.map(arm => arm.outcome.energyJ)).size >= 3);
  assert.ok(new Set(e1.arms.map(arm => arm.outcome.deliveredDataMbit)).size >= 2);
  assert.ok(new Set(e1.arms.map(arm => arm.outcome.eeMbitPerJ)).size >= 3);

  for (const arm of e1.arms) {
    const finalFrame = arm.frames[arm.frames.length - 1];
    assert.equal(finalFrame?.identity.scenarioId, manifest.scenario.scenarioId);
    assert.equal(finalFrame?.service.deliveredDataMbit, arm.outcome.deliveredDataMbit);
    assert.equal(finalFrame?.energy.energyJ, arm.outcome.energyJ);
  }
});

test('fixture exposes versioned archive sources, trajectory bundles, and declared frame units', () => {
  const journey = C90_FIXTURE_PROVIDER.getTleJourney();

  assert.equal(journey.source.provenance, 'SOURCE');
  assert.match(journey.source.note, /離線|offline/i);
  assert.equal(journey.source.sourceId, C90_SCENARIO.tleSourceId);
  assert.equal(journey.targetUtc, C90_SCENARIO.targetUtc);
  assert.equal(journey.sources.length, 3);
  assert.equal(journey.windows.length, 3);
  assert.equal(journey.trajectoryBundles.length, 9);
  assert.equal(journey.source.objectName, 'ONEWEB-0314');
  assert.equal(journey.source.noradCatalogId, 49100);
  assert.equal(journey.source.epochUtc, '2026-08-08T02:21:56.292480Z');
  assert.equal(journey.trajectoryBundles.find(bundle => bundle.sourceId === journey.courseSourceId && bundle.windowId === 'course-10m')?.frames.length, 601);
  assert.deepEqual(journey.stages.map(stage => stage.id), C90_TLE_STAGE_ORDER);
  assert.equal(journey.stages[0]?.provenance, 'SOURCE');
  assert.equal(journey.stages[1]?.provenance, 'COURSE-ASSUMPTION');
  assert.equal(C90_FRAME_UNITS.energyJ, 'J');
  assert.equal(C90_FRAME_UNITS.eeMbitPerJ, 'Mbit/J');
});

test('course experiment geometry is selected from the same course TLE clock', () => {
  const journey = C90_FIXTURE_PROVIDER.getTleJourney();
  const bundle = journey.trajectoryBundles.find(candidate => candidate.sourceId === journey.courseSourceId && candidate.windowId === journey.defaultWindowId);
  assert.ok(bundle);
  const courseFrames = [
    ...C90_FIXTURE_PROVIDER.getE1Experiment().arms.flatMap(arm => arm.frames),
    ...C90_FIXTURE_PROVIDER.getE2Experiment().traceA.branches.flatMap(branch => branch.frames),
    ...C90_FIXTURE_PROVIDER.getE2Experiment().traceB.branches.flatMap(branch => branch.frames),
    ...C90_FIXTURE_PROVIDER.getIoTChallenge().runs.map(run => run.frame),
  ];
  for (const frame of courseFrames) {
    const trajectory: TleTrajectoryFrame | undefined = bundle.frames.find(candidate => candidate.elapsedSec === frame.elapsedSec);
    assert.ok(trajectory, `missing TLE frame at ${frame.elapsedSec} s`);
    assert.deepEqual(frame.satellite.position, trajectory.scene.satellitePosition);
    assert.equal(frame.satellite.altitudeKm, trajectory.geodetic.altitudeKm);
    assert.equal(frame.link.azimuthDeg, trajectory.look.azimuthDeg);
    assert.equal(frame.link.elevationDeg, trajectory.look.elevationDeg);
    assert.equal(frame.link.rangeKm, trajectory.look.rangeKm);
    assert.equal(frame.link.visible, trajectory.look.visible);
  }
});

test('TLE bundle identity and missing producer fields fail closed', () => {
  const journey = C90_FIXTURE_PROVIDER.getTleJourney();
  const firstBundle = journey.trajectoryBundles[0];
  assert.ok(firstBundle);
  assertRejected(
    providerWith({
      getTleJourney: () => ({
        ...journey,
        trajectoryBundles: [{ ...firstBundle, sourceRecordSha256: '0'.repeat(64) }, ...journey.trajectoryBundles.slice(1)],
      }),
    }),
    /identity disagrees/,
  );
  const firstFrame = firstBundle.frames[0];
  assert.ok(firstFrame);
  assertRejected(
    providerWith({
      getTleJourney: () => ({
        ...journey,
        trajectoryBundles: [{
          ...firstBundle,
          frames: [{ ...firstFrame, look: { ...firstFrame.look, rangeKm: Number.NaN } }, ...firstBundle.frames.slice(1)],
        }, ...journey.trajectoryBundles.slice(1)],
      }),
    }),
    /look\.rangeKm/,
  );
});

test('provider seam fails closed on missing, mismatched, invalid, and incoherent frames', () => {
  const fixture = C90_FIXTURE_PROVIDER;
  const firstArm = fixture.getE1Experiment().arms[0];
  if (firstArm === undefined) throw new Error('fixture test requires the first E1 arm');

  assertRejected(
    e1WithArm(arm => ({
      ...arm,
      frames: [] as readonly CourseSceneFrame[],
    })),
    /missing frames/,
  );

  assertRejected(
    e1WithArm(arm => ({
      ...arm,
      frames: [
        {
          ...arm.frames[0],
          identity: { ...arm.frames[0].identity, scenarioId: 'wrong-scenario' },
        },
        ...arm.frames.slice(1),
      ],
    })),
    /identity.*manifest scenario|scenario.*identity/,
  );

  assertRejected(
    e1WithArm(arm => ({
      ...arm,
      frames: [
        {
          ...arm.frames[0],
          energy: { ...arm.frames[0].energy, energyJ: -1 },
        },
        ...arm.frames.slice(1),
      ],
    })),
    /energy\.energyJ must be finite and >= 0/,
  );

  assertRejected(
    e1WithArm(arm => ({
      ...arm,
      frames: [
        {
          ...arm.frames[0],
          service: { ...arm.frames[0].service, rateMbps: Number.NaN },
        },
        ...arm.frames.slice(1),
      ],
    })),
    /service\.rateMbps must be finite/,
  );

  assertRejected(
    e1WithArm(arm => ({
      ...arm,
      frames: [
        {
          ...arm.frames[0],
          link: { ...arm.frames[0].link, azimuthDeg: 360 },
        },
        ...arm.frames.slice(1),
      ],
    })),
    /azimuthDeg is outside/,
  );

  assertRejected(
    e1WithArm(arm => ({
      ...arm,
      outcome: { ...arm.outcome, energyJ: arm.outcome.energyJ + 1 },
    })),
    /disagrees with its fixture-provided outcome/,
  );

  assert.equal(firstArm.frames[0]?.energy.energyJ, 0.1);
});

test('provider seam fails closed on incomplete branch and task coverage', () => {
  const fixture = C90_FIXTURE_PROVIDER;
  const e2 = fixture.getE2Experiment();
  assertRejected(
    providerWith({
      getE2Experiment: () => ({
        ...e2,
        traceB: { ...e2.traceB, id: 'trace-a' },
      }),
    }),
    /distinct trace-a then trace-b/,
  );

  const iot = fixture.getIoTChallenge();
  const learnerRun = iot.runs.find(run => run.version === 'learner');
  if (learnerRun === undefined) throw new Error('fixture test requires the learner IoT run');
  const incompleteLearnerRun = {
    ...learnerRun,
    taskResults: learnerRun.taskResults.filter(result => result.taskId !== 'bulk'),
    deliveredDataMbit: 56,
    freshCount: 2,
    eeMbitPerJ: 0.257,
    frame: {
      ...learnerRun.frame,
      service: { ...learnerRun.frame.service, deliveredDataMbit: 56 },
      energy: { ...learnerRun.frame.energy, eeMbitPerJ: 0.257 },
    },
  };
  assertRejected(
    providerWith({
      getIoTChallenge: () => ({
        ...iot,
        runs: iot.runs.map(run => run.version === 'learner' ? incompleteLearnerRun : run),
      }),
    }),
    /must report every task card exactly once/,
  );
});

test('session and state machine accept a second provider with the same schema', () => {
  const fixture = C90_FIXTURE_PROVIDER;
  const baseManifest = fixture.getManifest();
  const scenario = stubScenario(baseManifest.scenario);
  const e1 = stubE1(fixture.getE1Experiment(), scenario);
  const e2 = stubE2(fixture.getE2Experiment(), scenario);
  const iot = stubIoT(fixture.getIoTChallenge(), scenario);
  const stubManifest: CourseManifest = {
    ...baseManifest,
    providerKind: 'stub',
    providerId: STUB_PROVIDER_ID,
    scenario,
  };
  const stub = createValidatedCourseDataProvider({
    kind: 'stub',
    providerId: STUB_PROVIDER_ID,
    getManifest: () => stubManifest,
    getTleJourney: (): TleJourney => {
      const journey = fixture.getTleJourney();
      return {
        ...journey,
        scenario,
        stages: journey.stages.map(stage => stage.id === 'scenario' ? { ...stage, output: scenario.scenarioId } : stage),
      };
    },
    getE1Experiment: (): E1Experiment => e1,
    getE2Experiment: (): E2Experiment => e2,
    getIoTChallenge: (): IoTChallenge => iot,
    buildLearningBundle: (input: LearningBundleInput): LearningBundle => {
      const bundle = fixture.buildLearningBundle(input);
      return {
        ...bundle,
        course: stubManifest,
        scenario,
        provenance: { ...bundle.provenance, providerId: STUB_PROVIDER_ID, fixtureId: STUB_FIXTURE_ID },
        e1: { ...bundle.e1, arms: e1.arms },
        e2: { ...bundle.e2, traceA: e2.traceA, traceB: e2.traceB },
        iot: { ...bundle.iot, tasks: iot.tasks, runs: iot.runs },
      };
    },
  });

  const initial = createInitialCourseSession(stub.getManifest());
  const started = startE1Arm(initial, 'low-power');

  assert.equal(initial.sessionId, 'c90-test-stub-provider-session-0');
  assert.equal(started.e1ActiveArmId, 'low-power');
  assert.deepEqual(started.e1ArmOrder, ['low-power']);
  assert.equal(stub.getE1Experiment().arms[1].id, 'low-power');
});

test('learning bundle keeps fixture provenance and the same scenario identity', () => {
  const journey = C90_FIXTURE_PROVIDER.getTleJourney();
  const input: LearningBundleInput = {
    exportedAt: '2026-08-09T00:00:00.000Z',
    sessionId: 'test-session',
    readyCheckCompleted: true,
    tle: {
      explanation: 'TLE gives source elements; the program derives position; the course adds energy policy.',
      selectedSourceId: journey.courseSourceId,
      selectedWindowId: journey.defaultWindowId,
      selectedFrameIndex: 0,
      sourceMode: 'bundled',
      sourceConfirmed: true,
      importedFilename: null,
      fallbackUsed: false,
    },
    e1: { prediction: 'balanced', checkpointUpdate: 'the first frame confirms the lower-W arm is slower', armOrder: ['balanced'], completedArmIds: ['balanced'], selectedArm: 'balanced', verdict: 'qualify', explanation: 'time and J both matter' },
    e2: { prediction: 'wait', traceAAction: 'wait', traceAReplayAction: 'switch-now', traceBAction: 'wait', frozenRule: 'wait for stable improvement', verdict: 'qualify', explanation: 'trend changed' },
    iot: { prediction: 'alarm now', selectedRule: 'alarm now', revisedRule: 'batch routine', verdict: 'qualify', explanation: 'freshness matters' },
    ideaCard: { sensedData: 'temperature', stateToPredict: 'occupancy', baseline: 'always on', controlAction: 'sleep', powerTimePathway: 'less active time', energyIndicator: 'J', serviceConstraint: 'comfort', falsifier: 'same J' },
  };
  const bundle = C90_FIXTURE_PROVIDER.buildLearningBundle(input);

  assert.equal(bundle.claimBoundary, C90_FIXTURE_PROVIDER.getManifest().claimBoundary);
  assert.equal(bundle.sessionId, 'test-session');
  assert.equal(bundle.readyCheckCompleted, true);
  assert.equal(bundle.exportedAt, '2026-08-09T00:00:00.000Z');
  assert.equal(bundle.provenance.deterministicReplay, true);
  assert.equal(bundle.tle.source.sourceId, bundle.scenario.tleSourceId);
  assert.equal(bundle.tle.trajectory.frame.targetUtc, bundle.scenario.targetUtc);
  assert.equal(bundle.tle.comparisonsAtTarget.length, 3);
  assert.equal(bundle.scenario.scenarioId, bundle.e1.arms[0].frames[0].identity.scenarioId);
  assert.equal(bundle.e1.arms.length, 3);
  assert.equal(bundle.e2.traceB.id, 'trace-b');
  assert.equal(bundle.iot.runs.length, 3);
});
