import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { computeLinkBudget } from '../src/engine/signal/link-budget.ts';
import {
  buildBeamPowerOverrideDbmByKey,
  updateBeamPowerControlStates,
  type BeamPowerControlState,
} from '../src/engine/signal/power-control.ts';
import { computeTr38811SlantRangeKm } from '../src/engine/signal/slant-range.ts';
import type {
  ActiveBeamAssignment,
  LinkSample,
  SatelliteSnapshot,
  UEPosition,
} from '../src/engine/signal/types.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { BeamPowerControlConfig, Profile } from '../src/profiles/types.ts';

const RESEARCH_PROFILE_ID = 'hobs-2024-tr38811-research';
const FRAME_DELTA_SEC = 0.2;
const FRAME_SPEED = 5;
const SIM_DELTA_SEC = FRAME_DELTA_SEC * FRAME_SPEED;
const WARMUP_BATCHES = 40;
const MEASURED_BATCHES = 200;
const FRAMES_PER_BATCH = 40;
const INITIAL_SIM_TIME_SEC = 60.2;

interface BatchMeasurement {
  frameMs: number;
  linkSampleCount: number;
  overrideCount: number;
}

interface BenchmarkSummary {
  label: string;
  medianFrameMs: number;
  p95FrameMs: number;
  medianLinkSampleCount: number;
  medianOverrideCount: number;
}

interface BenchmarkRunnerState {
  simTimeSec: number;
  lastBucketIndex: number | null;
  lastBucketSamples: LinkSample[];
  statesByKey: Map<string, BeamPowerControlState>;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function percentageDelta(next: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return ((next - baseline) / baseline) * 100;
}

function buildResearchFixtureSnapshots(): SatelliteSnapshot[] {
  return [
    {
      id: 'sat-a',
      shellId: 'hobs-baseline',
      altitudeKm: 550,
      ecefKm: [0, 0, 0],
      rangeKm: computeTr38811SlantRangeKm(30, 550),
      elevationDeg: 30,
      azimuthDeg: 0,
      beamCellsKm: [
        { beamId: 1, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 },
        { beamId: 5, offsetEastKm: 40, offsetNorthKm: 0, scanAngleDeg: 4 },
      ],
    },
    {
      id: 'sat-b',
      shellId: 'hobs-baseline',
      altitudeKm: 550,
      ecefKm: [0, 0, 0],
      rangeKm: computeTr38811SlantRangeKm(28, 550),
      elevationDeg: 28,
      azimuthDeg: 110,
      beamCellsKm: [
        { beamId: 1, offsetEastKm: 18, offsetNorthKm: 15, scanAngleDeg: 3 },
      ],
    },
    {
      id: 'sat-z',
      shellId: 'hobs-baseline',
      altitudeKm: 550,
      ecefKm: [0, 0, 0],
      rangeKm: computeTr38811SlantRangeKm(10, 550),
      elevationDeg: 10,
      azimuthDeg: 220,
      beamCellsKm: [
        { beamId: 1, offsetEastKm: -15, offsetNorthKm: -10, scanAngleDeg: 5 },
      ],
    },
  ];
}

function buildResearchFixtureAssignments(): ActiveBeamAssignment[] {
  return [
    { satId: 'sat-a', beamId: 1 },
    { satId: 'sat-a', beamId: 5 },
    { satId: 'sat-b', beamId: 1 },
    { satId: 'sat-z', beamId: 1 },
  ];
}

function cloneResearchProfileWithoutDpc(profile: Profile): Profile {
  const { beamPowerControl: _beamPowerControl, ...channelWithoutDpc } = profile.channel;
  return {
    ...profile,
    channel: channelWithoutDpc,
  };
}

function computeFixtureSamples(
  profile: Profile,
  simTimeSec: number,
  beamPowerOverrideDbmByKey?: ReadonlyMap<string, number>,
): LinkSample[] {
  const ue: UEPosition = {
    latDeg: profile.orbit.observerLatDeg,
    lonDeg: profile.orbit.observerLonDeg,
    offsetEastKm: 0,
    offsetNorthKm: 0,
  };

  return computeLinkBudget(ue, buildResearchFixtureSnapshots(), {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments: buildResearchFixtureAssignments(),
    simTimeSec,
    beamPowerOverrideDbmByKey,
  });
}

function createBaselineRunner(profile: Profile): () => BatchMeasurement {
  let simTimeSec = INITIAL_SIM_TIME_SEC;
  return () => {
    simTimeSec += SIM_DELTA_SEC;
    const samples = computeFixtureSamples(profile, simTimeSec);
    return {
      frameMs: 0,
      linkSampleCount: samples.length,
      overrideCount: 0,
    };
  };
}

function createDpcRunner(
  profile: Profile,
  powerControl: BeamPowerControlConfig,
): () => BatchMeasurement {
  const state: BenchmarkRunnerState = {
    simTimeSec: INITIAL_SIM_TIME_SEC,
    lastBucketIndex: null,
    lastBucketSamples: [],
    statesByKey: new Map(),
  };

  return () => {
    state.simTimeSec += SIM_DELTA_SEC;
    const bucketIndex = Math.floor(
      state.simTimeSec / Math.max(powerControl.updatePeriodSec, 1e-6),
    );

    if (state.lastBucketIndex === null) {
      state.lastBucketIndex = bucketIndex;
    } else if (bucketIndex !== state.lastBucketIndex) {
      state.statesByKey = updateBeamPowerControlStates(
        state.lastBucketSamples,
        state.statesByKey,
        powerControl,
        profile.channel,
      );
      state.lastBucketIndex = bucketIndex;
    }

    const beamPowerOverrideDbmByKey = buildBeamPowerOverrideDbmByKey(state.statesByKey);
    const samples = computeFixtureSamples(
      profile,
      state.simTimeSec,
      beamPowerOverrideDbmByKey,
    );
    state.lastBucketSamples = samples;

    return {
      frameMs: 0,
      linkSampleCount: samples.length,
      overrideCount: beamPowerOverrideDbmByKey.size,
    };
  };
}

function measureBatch(step: () => BatchMeasurement): BatchMeasurement {
  let linkSampleCount = 0;
  let overrideCount = 0;
  const startedAt = performance.now();

  for (let i = 0; i < FRAMES_PER_BATCH; i++) {
    const measurement = step();
    linkSampleCount = measurement.linkSampleCount;
    overrideCount = measurement.overrideCount;
  }

  return {
    frameMs: (performance.now() - startedAt) / FRAMES_PER_BATCH,
    linkSampleCount,
    overrideCount,
  };
}

function summarizeMeasurements(label: string, measurements: BatchMeasurement[]): BenchmarkSummary {
  return {
    label,
    medianFrameMs: round(median(measurements.map(sample => sample.frameMs))),
    p95FrameMs: round(percentile(measurements.map(sample => sample.frameMs), 0.95)),
    medianLinkSampleCount: round(median(measurements.map(sample => sample.linkSampleCount))),
    medianOverrideCount: round(median(measurements.map(sample => sample.overrideCount))),
  };
}

function runBenchmark(label: string, step: () => BatchMeasurement): BenchmarkSummary {
  for (let i = 0; i < WARMUP_BATCHES; i++) {
    measureBatch(step);
  }

  const measurements: BatchMeasurement[] = [];
  for (let i = 0; i < MEASURED_BATCHES; i++) {
    measurements.push(measureBatch(step));
  }

  return summarizeMeasurements(label, measurements);
}

function run(): void {
  const researchProfile = loadProfile(RESEARCH_PROFILE_ID);
  const baselineProfile = cloneResearchProfileWithoutDpc(researchProfile);
  const powerControl = researchProfile.channel.beamPowerControl;
  assert.ok(powerControl, 'research profile should enable beamPowerControl');

  const dpcDisabled = runBenchmark(
    'Research profile without DPC overrides',
    createBaselineRunner(baselineProfile),
  );
  const dpcEnabled = runBenchmark(
    'Research profile with DPC overrides',
    createDpcRunner(researchProfile, powerControl),
  );
  const dpcDeltaPct = round(percentageDelta(dpcEnabled.medianFrameMs, dpcDisabled.medianFrameMs));

  console.log(JSON.stringify({
    benchmarkConfig: {
      profileId: researchProfile.id,
      formulaFamily: researchProfile.formulaFamily,
      warmupBatches: WARMUP_BATCHES,
      measuredBatches: MEASURED_BATCHES,
      framesPerBatch: FRAMES_PER_BATCH,
      frameDeltaSec: FRAME_DELTA_SEC,
      frameSpeed: FRAME_SPEED,
      simulatedFrameAdvanceSec: SIM_DELTA_SEC,
      initialSimTimeSec: INITIAL_SIM_TIME_SEC,
      dpcUpdatePeriodSec: powerControl.updatePeriodSec,
    },
    summaries: {
      dpcDisabled,
      dpcEnabled,
    },
    deltas: {
      dpcDeltaPct,
    },
  }, null, 2));
}

run();
