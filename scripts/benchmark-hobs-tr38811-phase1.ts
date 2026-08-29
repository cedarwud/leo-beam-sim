import { performance } from 'node:perf_hooks';
import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  propagateOrbitElement,
} from '../src/engine/orbit/index.ts';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { ServingState } from '../src/engine/handover/types.ts';
import { computeLinkBudget } from '../src/engine/signal/link-budget.ts';
import { computeTr38811SlantRangeKm } from '../src/engine/signal/slant-range.ts';
import type { ActiveBeamAssignment, SatelliteSnapshot } from '../src/engine/signal/types.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import { recommendDemoReplayStartOffsetSec } from '../src/scene/replay-recommendation.ts';
import { computeBeamGeometry, generateBeamOffsetsKm } from '../src/scene/beam-layout.ts';
import { scheduleBeamCells } from '../src/scene/beam-scheduler.ts';

const EPOCH_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const BENCHMARK_DELTA_SEC = 0.2;
const BENCHMARK_SPEED = 5;
const WARMUP_FRAMES = 20;
const MEASURED_FRAMES = 120;

const CACHE_ELEVATION_DEG = 10;
const MIN_ELEVATION_DEG = 15;
const SIM_DURATION_SEC = 1200;
const SIM_STEP_SEC = 20;
const MAX_STEERING_EXTRA_RINGS = 3;
const RECENT_HO_LINGER_SEC = 2;

interface CachedSatState {
  id: string;
  shellId: string;
  altitudeKm: number;
  latDeg: number;
  lonDeg: number;
  ecefKm: [number, number, number];
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
}

interface InterpolatedTopo {
  eastKm: number;
  northKm: number;
  upKm: number;
  rangeKm: number;
  azimuthDeg: number;
  elevationDeg: number;
}

interface BenchmarkVisibleSat {
  id: string;
  shellId: string;
  altitudeKm: number;
  topo: InterpolatedTopo;
  latDeg: number;
  lonDeg: number;
}

interface BeamCellState {
  beamId: number;
  offsetEastKm: number;
  offsetNorthKm: number;
  scanAngleDeg: number;
}

interface CandidateBeamCell extends BeamCellState {
  distanceToUeKm: number;
}

interface ShellBeamLayout {
  footprintRadiusKm: number;
  spacingKm: number;
  maxOffsetRadiusKm: number;
  maxSteeringDistanceKm: number;
  maxCoverageRadiusKm: number;
  offsets: ReturnType<typeof generateBeamOffsetsKm>;
}

interface SatBeamHopState {
  satId: string;
  slotIndex: number;
  frameSlotIndex: number;
  activeBeamIds: number[];
  candidateBeamIds: number[];
}

interface RecentHoState {
  sourceSatId: string;
  sourceBeamId: number;
  sourceSinrDb: number | null;
  targetSatId: string;
  targetBeamId: number;
  targetSinrDb: number;
  deltaDb: number | null;
  expiresAtSec: number;
}

interface LatticeSteeringSolution {
  steeringEastKm: number;
  steeringNorthKm: number;
}

interface LinkContext {
  linkSamples: ReturnType<typeof computeLinkBudget>;
  snapshotCount: number;
}

interface BenchmarkRunner {
  profile: Profile;
  observer: ReturnType<typeof createObserverContext>;
  beamLayoutsByShellId: Map<string, ShellBeamLayout>;
  trajectoryCache: CachedSatState[][];
  hoManager: HandoverManager;
  simTimeSec: number;
  recentHo: RecentHoState | null;
  maxTimeSec: number;
}

interface FrameMeasurement {
  frameMs: number;
  visibleSatCount: number;
  linkSatCount: number;
  linkSampleCount: number;
  preContextMs: number;
  decisionMs: number;
  postContextMs: number;
}

interface BenchmarkSummary {
  label: string;
  profileId: string;
  medianFrameMs: number;
  p95FrameMs: number;
  medianPreContextMs: number;
  medianDecisionMs: number;
  medianPostContextMs: number;
  medianVisibleSatCount: number;
  medianLinkSatCount: number;
  medianLinkSampleCount: number;
}

function normalizeReplayOffset(startOffsetSec: number, maxTimeSec: number, loop: boolean): number {
  if (maxTimeSec <= 0) return 0;
  if (!loop) return Math.min(Math.max(startOffsetSec, 0), maxTimeSec);
  const wrapped = startOffsetSec % maxTimeSec;
  return wrapped >= 0 ? wrapped : wrapped + maxTimeSec;
}

function interpolateAngleDeg(a: number, b: number, t: number): number {
  let delta = b - a;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return a + delta * t;
}

function createInterpolatedTopo(
  azimuthDeg: number,
  elevationDeg: number,
  rangeKm: number,
): InterpolatedTopo {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;
  const cosEl = Math.cos(elRad);

  return {
    eastKm: rangeKm * cosEl * Math.sin(azRad),
    northKm: rangeKm * cosEl * Math.cos(azRad),
    upKm: rangeKm * Math.sin(elRad),
    rangeKm,
    azimuthDeg,
    elevationDeg,
  };
}

function beamAssignmentKey(satId: string, beamId: number): string {
  return `${satId}:${beamId}`;
}

function resolveLatticeSteering(
  nadirEastKm: number,
  nadirNorthKm: number,
  layout: ShellBeamLayout,
): LatticeSteeringSolution {
  let bestTargetEastKm = -nadirEastKm;
  let bestTargetNorthKm = -nadirNorthKm;
  let bestTargetDistanceKm = Math.hypot(bestTargetEastKm, bestTargetNorthKm);

  for (const beam of layout.offsets) {
    const targetEastKm = -(nadirEastKm + beam.dEastKm);
    const targetNorthKm = -(nadirNorthKm + beam.dNorthKm);
    const targetDistanceKm = Math.hypot(targetEastKm, targetNorthKm);

    if (targetDistanceKm < bestTargetDistanceKm) {
      bestTargetEastKm = targetEastKm;
      bestTargetNorthKm = targetNorthKm;
      bestTargetDistanceKm = targetDistanceKm;
    }
  }

  if (bestTargetDistanceKm <= 1e-6) {
    return { steeringEastKm: 0, steeringNorthKm: 0 };
  }

  const steeringScale = Math.min(layout.maxSteeringDistanceKm, bestTargetDistanceKm) / bestTargetDistanceKm;
  return {
    steeringEastKm: bestTargetEastKm * steeringScale,
    steeringNorthKm: bestTargetNorthKm * steeringScale,
  };
}

function createBeamLayoutsByShellId(profile: Profile): Map<string, ShellBeamLayout> {
  return new Map(
    profile.orbit.shells.map(shell => {
      const geometry = computeBeamGeometry(shell.altitudeKm, profile.antenna.beamwidth3dBRad);
      const offsets = generateBeamOffsetsKm(geometry.spacingKm, profile.beams.perSatellite);
      const maxOffsetRadiusKm = offsets.reduce(
        (maxRadius, beam) => Math.max(maxRadius, Math.hypot(beam.dEastKm, beam.dNorthKm)),
        0,
      );
      const geometryLimitedSteeringKm = maxOffsetRadiusKm + geometry.spacingKm * MAX_STEERING_EXTRA_RINGS;
      const steeringAngleRad = (profile.antenna.maxSteeringAngleDeg * Math.PI) / 180;
      const angleLimitedSteeringKm = shell.altitudeKm * Math.tan(steeringAngleRad);
      const maxSteeringDistanceKm = Math.min(geometryLimitedSteeringKm, angleLimitedSteeringKm);

      return [
        shell.id,
        {
          footprintRadiusKm: geometry.footprintRadiusKm,
          spacingKm: geometry.spacingKm,
          maxOffsetRadiusKm,
          maxSteeringDistanceKm,
          maxCoverageRadiusKm: maxOffsetRadiusKm + maxSteeringDistanceKm + geometry.footprintRadiusKm,
          offsets,
        } satisfies ShellBeamLayout,
      ];
    }),
  );
}

function createTrajectoryCache(
  profile: Profile,
  observer: ReturnType<typeof createObserverContext>,
): CachedSatState[][] {
  const elements = generateWalkerConstellation({
    shells: profile.orbit.shells,
    epochUtcMs: EPOCH_UTC_MS,
    phaseSeed: profile.orbit.constellationSeed,
  });
  const steps = Math.ceil(SIM_DURATION_SEC / SIM_STEP_SEC) + 1;
  const cache: CachedSatState[][] = new Array(steps);

  for (let step = 0; step < steps; step++) {
    const atUtcMs = EPOCH_UTC_MS + step * SIM_STEP_SEC * 1000;
    const visible: CachedSatState[] = [];

    for (const element of elements) {
      const orbitPoint = propagateOrbitElement(element, atUtcMs);
      const topo = computeTopocentricPoint(observer, orbitPoint.ecefKm);
      if (topo.elevationDeg < CACHE_ELEVATION_DEG) continue;

      visible.push({
        id: element.id,
        shellId: element.shellId,
        altitudeKm: orbitPoint.altKm,
        latDeg: orbitPoint.latDeg,
        lonDeg: orbitPoint.lonDeg,
        ecefKm: orbitPoint.ecefKm,
        elevationDeg: topo.elevationDeg,
        azimuthDeg: topo.azimuthDeg,
        rangeKm: topo.rangeKm,
      });
    }

    cache[step] = visible;
  }

  return cache;
}

function interpolateVisibleSats(
  trajectoryCache: CachedSatState[][],
  simTimeSec: number,
  replayLoop: boolean,
): BenchmarkVisibleSat[] {
  const rawStep = simTimeSec / SIM_STEP_SEC;
  const stepIndex = Math.floor(rawStep);
  const maxStep = trajectoryCache.length - 1;
  const t = rawStep - stepIndex;
  const stepA = replayLoop ? stepIndex % trajectoryCache.length : Math.min(stepIndex, maxStep);
  const stepB = replayLoop
    ? (stepA + 1) % trajectoryCache.length
    : Math.min(stepA + 1, maxStep);

  const cacheA = trajectoryCache[stepA];
  const cacheB = trajectoryCache[stepB];
  const cacheAMap = new Map(cacheA.map(sample => [sample.id, sample]));
  const cacheBMap = new Map(cacheB.map(sample => [sample.id, sample]));
  const satIds = new Set<string>([...cacheAMap.keys(), ...cacheBMap.keys()]);
  const visibleSats: BenchmarkVisibleSat[] = [];

  for (const satId of satIds) {
    const satA = cacheAMap.get(satId);
    const satB = cacheBMap.get(satId);
    const current = satA ?? satB;
    const next = satB ?? satA;
    if (!current || !next) continue;

    const elevationDeg = satA && satB
      ? satA.elevationDeg + (satB.elevationDeg - satA.elevationDeg) * t
      : current.elevationDeg;
    const azimuthDeg = satA && satB
      ? interpolateAngleDeg(satA.azimuthDeg, satB.azimuthDeg, t)
      : current.azimuthDeg;
    const rangeKm = satA && satB
      ? satA.rangeKm + (satB.rangeKm - satA.rangeKm) * t
      : current.rangeKm;
    const latDeg = satA && satB
      ? satA.latDeg + (satB.latDeg - satA.latDeg) * t
      : current.latDeg;
    const lonDeg = satA && satB
      ? interpolateAngleDeg(satA.lonDeg, satB.lonDeg, t)
      : current.lonDeg;

    visibleSats.push({
      id: current.id,
      shellId: current.shellId,
      altitudeKm: current.altitudeKm,
      topo: createInterpolatedTopo(azimuthDeg, elevationDeg, rangeKm),
      latDeg,
      lonDeg,
    });
  }

  return visibleSats;
}

function createServingState(): ServingState {
  return {
    satId: null,
    beamId: null,
    sinrDb: -Infinity,
    triggerTimeSec: 0,
    pendingTarget: null,
  };
}

function createRunner(profileId: string): BenchmarkRunner {
  return createRunnerAtOffset(profileId, 0);
}

function createRunnerAtOffset(profileId: string, startOffsetSec: number): BenchmarkRunner {
  const profile = loadProfile(profileId);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const trajectoryCache = createTrajectoryCache(profile, observer);
  const maxTimeSec = (trajectoryCache.length - 1) * SIM_STEP_SEC;
  const simTimeSec = normalizeReplayOffset(startOffsetSec, maxTimeSec, true);
  const hoManager = new HandoverManager(profile.handover);
  hoManager.state = createServingState();

  return {
    profile,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    hoManager,
    simTimeSec,
    recentHo: null,
    maxTimeSec,
  };
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function summarizeMeasurements(label: string, profileId: string, samples: FrameMeasurement[]): BenchmarkSummary {
  return {
    label,
    profileId,
    medianFrameMs: round(median(samples.map(sample => sample.frameMs))),
    p95FrameMs: round(percentile(samples.map(sample => sample.frameMs), 0.95)),
    medianPreContextMs: round(median(samples.map(sample => sample.preContextMs))),
    medianDecisionMs: round(median(samples.map(sample => sample.decisionMs))),
    medianPostContextMs: round(median(samples.map(sample => sample.postContextMs))),
    medianVisibleSatCount: round(median(samples.map(sample => sample.visibleSatCount))),
    medianLinkSatCount: round(median(samples.map(sample => sample.linkSatCount))),
    medianLinkSampleCount: round(median(samples.map(sample => sample.linkSampleCount))),
  };
}

function buildLinkContext(
  runner: BenchmarkRunner,
  linkSats: BenchmarkVisibleSat[],
  state: Pick<ServingState, 'satId' | 'beamId' | 'pendingTarget'>,
  recentHo: RecentHoState | null,
  beamHopSlotIndex: number,
): LinkContext {
  const { observer, profile, beamLayoutsByShellId } = runner;
  const cosObsLat = Math.cos((observer.latDeg * Math.PI) / 180);
  const beamHopEnabled = profile.beamHopping.enabled;
  const snapshots: SatelliteSnapshot[] = [];

  for (const sat of linkSats) {
    const layout = beamLayoutsByShellId.get(sat.shellId);
    if (!layout) continue;

    const nadirEastKm = (sat.lonDeg - observer.lonDeg) * 111.32 * cosObsLat;
    const nadirNorthKm = (sat.latDeg - observer.latDeg) * 111.32;
    const nadirDistanceKm = Math.hypot(nadirEastKm, nadirNorthKm);
    const { steeringEastKm, steeringNorthKm } = resolveLatticeSteering(
      nadirEastKm,
      nadirNorthKm,
      layout,
    );

    const requiredBeamIds = new Set<number>();
    if (state.satId === sat.id && state.beamId !== null) {
      requiredBeamIds.add(state.beamId);
    }
    if (state.pendingTarget?.satId === sat.id) {
      requiredBeamIds.add(state.pendingTarget.beamId);
    }
    if (recentHo?.sourceSatId === sat.id) {
      requiredBeamIds.add(recentHo.sourceBeamId);
    }
    if (recentHo?.targetSatId === sat.id) {
      requiredBeamIds.add(recentHo.targetBeamId);
    }

    const allBeamCells = layout.offsets
      .map(beam => {
        const scanOffsetEastKm = steeringEastKm + beam.dEastKm;
        const scanOffsetNorthKm = steeringNorthKm + beam.dNorthKm;
        const scanDistanceKm = Math.hypot(scanOffsetEastKm, scanOffsetNorthKm);
        const offsetEastKm = nadirEastKm + steeringEastKm + beam.dEastKm;
        const offsetNorthKm = nadirNorthKm + steeringNorthKm + beam.dNorthKm;
        return {
          beamId: beam.beamId,
          offsetEastKm,
          offsetNorthKm,
          scanAngleDeg: (Math.atan(scanDistanceKm / Math.max(sat.altitudeKm, 1e-6)) * 180) / Math.PI,
          distanceToUeKm: Math.hypot(offsetEastKm, offsetNorthKm),
        } satisfies CandidateBeamCell;
      })
      .filter(beam => beam.scanAngleDeg <= profile.antenna.maxSteeringAngleDeg + 1e-6);

    const beamCellById = new Map(allBeamCells.map(beam => [beam.beamId, beam]));
    const candidateBeamCells = allBeamCells
      .filter(beam => beam.distanceToUeKm <= layout.maxOffsetRadiusKm + layout.footprintRadiusKm * 1.5)
      .sort((a, b) => a.distanceToUeKm - b.distanceToUeKm);
    const requiredBeamCells = [...requiredBeamIds]
      .map(beamId => beamCellById.get(beamId))
      .filter((beam): beam is CandidateBeamCell => beam !== undefined);

    if (nadirDistanceKm > layout.maxCoverageRadiusKm && requiredBeamIds.size === 0) {
      continue;
    }

    let activeBeamCells: BeamCellState[] = [];
    const isProtectedBeamSat = state.satId === sat.id || state.pendingTarget?.satId === sat.id;
    const protectedMinimumActiveBeamCount = isProtectedBeamSat
      ? profile.beamHopping.maxActiveBeamsPerSlot
      : 1;
    if (beamHopEnabled) {
      const scheduled = scheduleBeamCells(
        candidateBeamCells,
        requiredBeamCells,
        sat.id,
        beamHopSlotIndex,
        profile.beamHopping,
        {
          minimumActiveBeamCount: protectedMinimumActiveBeamCount,
          fallbackBeamCells: allBeamCells,
        },
      );
      activeBeamCells = scheduled.activeBeamCells;
    } else {
      const selectedBeamCells = new Map<number, BeamCellState>();

      for (const requiredBeamId of requiredBeamIds) {
        const beam = beamCellById.get(requiredBeamId);
        if (!beam) continue;
        selectedBeamCells.set(beam.beamId, {
          beamId: beam.beamId,
          offsetEastKm: beam.offsetEastKm,
          offsetNorthKm: beam.offsetNorthKm,
          scanAngleDeg: beam.scanAngleDeg,
        });
      }

      for (const beam of candidateBeamCells) {
        if (selectedBeamCells.size >= profile.beams.maxActivePerSat) break;
        if (selectedBeamCells.has(beam.beamId)) continue;
        selectedBeamCells.set(beam.beamId, {
          beamId: beam.beamId,
          offsetEastKm: beam.offsetEastKm,
          offsetNorthKm: beam.offsetNorthKm,
          scanAngleDeg: beam.scanAngleDeg,
        });
      }

      activeBeamCells = [...selectedBeamCells.values()];
    }

    if (activeBeamCells.length === 0) continue;

    const linkRangeKm = profile.formulaFamily === 'hobs-tr38811'
      ? computeTr38811SlantRangeKm(sat.topo.elevationDeg, sat.altitudeKm)
      : sat.topo.rangeKm;

    snapshots.push({
      id: sat.id,
      shellId: sat.shellId,
      altitudeKm: sat.altitudeKm,
      ecefKm: [0, 0, 0],
      rangeKm: linkRangeKm,
      elevationDeg: sat.topo.elevationDeg,
      azimuthDeg: sat.topo.azimuthDeg,
      beamCellsKm: activeBeamCells,
    });
  }

  const availableBeamAssignments = new Set(
    snapshots.flatMap(satellite =>
      satellite.beamCellsKm.map(beam => beamAssignmentKey(satellite.id, beam.beamId)),
    ),
  );
  const trackedAssignments: ActiveBeamAssignment[] = [];
  const pushUniqueAssignment = (satId: string | null, beamId: number | null) => {
    if (!satId || beamId === null) return;
    const key = beamAssignmentKey(satId, beamId);
    if (!availableBeamAssignments.has(key)) return;
    if (trackedAssignments.some(assignment => assignment.satId === satId && assignment.beamId === beamId)) return;
    trackedAssignments.push({ satId, beamId });
  };

  pushUniqueAssignment(state.satId, state.beamId);
  pushUniqueAssignment(state.pendingTarget?.satId ?? null, state.pendingTarget?.beamId ?? null);

  const scheduledAssignments = snapshots.flatMap(satellite =>
    satellite.beamCellsKm.map(beam => ({ satId: satellite.id, beamId: beam.beamId })),
  );
  const activeAssignments = beamHopEnabled ? scheduledAssignments : trackedAssignments;
  const linkSamples = computeLinkBudget({
    latDeg: observer.latDeg,
    lonDeg: observer.lonDeg,
    offsetEastKm: 0,
    offsetNorthKm: 0,
  }, snapshots, {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments,
    simTimeSec: runner.simTimeSec,
  });

  return {
    linkSamples,
    snapshotCount: snapshots.length,
  };
}

function stepRunner(runner: BenchmarkRunner): FrameMeasurement {
  const frameStart = performance.now();
  const previousSimTimeSec = runner.simTimeSec;
  runner.simTimeSec += BENCHMARK_DELTA_SEC * BENCHMARK_SPEED;
  runner.simTimeSec = normalizeReplayOffset(runner.simTimeSec, runner.maxTimeSec, true);

  if (runner.simTimeSec < previousSimTimeSec) {
    runner.hoManager.reset();
    runner.recentHo = null;
  }

  const visibleSats = interpolateVisibleSats(runner.trajectoryCache, runner.simTimeSec, true);
  const linkSats = visibleSats.filter(sat => sat.topo.elevationDeg >= MIN_ELEVATION_DEG);
  const beamHopEnabled = runner.profile.beamHopping.enabled;
  const beamHopSlotSec = beamHopEnabled ? Math.max(runner.profile.beamHopping.slotSec, 1e-6) : 0;
  const beamHopSlotIndex = beamHopEnabled ? Math.floor(runner.simTimeSec / beamHopSlotSec) : -1;
  const currentRecentHo = runner.recentHo && runner.recentHo.expiresAtSec > runner.simTimeSec
    ? runner.recentHo
    : null;

  const preContextStart = performance.now();
  const preDecisionContext = buildLinkContext(runner, linkSats, runner.hoManager.state, currentRecentHo, beamHopSlotIndex);
  const preContextMs = performance.now() - preContextStart;

  if (runner.hoManager.state.satId && !linkSats.some(sat => sat.id === runner.hoManager.state.satId)) {
    runner.hoManager.clearServing();
  }

  const previousServingSatId = runner.hoManager.state.satId;
  const decisionStart = performance.now();
  const decision = runner.hoManager.update(
    preDecisionContext.linkSamples,
    BENCHMARK_DELTA_SEC * BENCHMARK_SPEED,
    EPOCH_UTC_MS + runner.simTimeSec * 1000,
  );
  const decisionMs = performance.now() - decisionStart;
  const lastEvent = runner.hoManager.eventLog[runner.hoManager.eventLog.length - 1];

  if (
    decision.action === 'inter-handover'
    && decision.target
    && previousServingSatId !== null
    && lastEvent?.fromBeamId !== null
    && previousServingSatId !== decision.target.satId
  ) {
    runner.recentHo = {
      sourceSatId: previousServingSatId,
      sourceBeamId: lastEvent.fromBeamId,
      sourceSinrDb: lastEvent.fromSinrDb ?? null,
      targetSatId: decision.target.satId,
      targetBeamId: decision.target.beamId,
      targetSinrDb: lastEvent.toSinrDb,
      deltaDb: lastEvent.deltaDb ?? null,
      expiresAtSec: runner.simTimeSec + RECENT_HO_LINGER_SEC,
    };
  }

  const postDecisionRecentHo = runner.recentHo && runner.recentHo.expiresAtSec > runner.simTimeSec
    ? runner.recentHo
    : null;
  const postContextStart = performance.now();
  const postDecisionContext = buildLinkContext(
    runner,
    linkSats,
    runner.hoManager.state,
    postDecisionRecentHo,
    beamHopSlotIndex,
  );
  const postContextMs = performance.now() - postContextStart;

  return {
    frameMs: performance.now() - frameStart,
    visibleSatCount: visibleSats.length,
    linkSatCount: postDecisionContext.snapshotCount,
    linkSampleCount: postDecisionContext.linkSamples.length,
    preContextMs,
    decisionMs,
    postContextMs,
  };
}

function runBenchmark(label: string, profileId: string): BenchmarkSummary {
  return runBenchmarkAtOffset(label, profileId, 0);
}

function runBenchmarkAtOffset(label: string, profileId: string, startOffsetSec: number): BenchmarkSummary {
  const runner = createRunnerAtOffset(profileId, startOffsetSec);

  for (let i = 0; i < WARMUP_FRAMES; i++) {
    stepRunner(runner);
  }

  const samples: FrameMeasurement[] = [];
  for (let i = 0; i < MEASURED_FRAMES; i++) {
    samples.push(stepRunner(runner));
  }

  return summarizeMeasurements(label, profileId, samples);
}

function percentageDelta(next: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return ((next - baseline) / baseline) * 100;
}

function run(): void {
  const paperDefaultProfile = loadProfile('hobs-2024-paper-default');
  const candidateRichProfile = loadProfile('hobs-2024-candidate-rich');

  const originalConsoleTime = console.time;
  const originalConsoleTimeEnd = console.timeEnd;
  const originalConsoleLog = console.log;
  console.time = () => {};
  console.timeEnd = () => {};
  console.log = () => {};
  let formulaPairStartOffsetSec = 0;
  try {
    formulaPairStartOffsetSec = paperDefaultProfile.demoStartOffsetSec
      ?? recommendDemoReplayStartOffsetSec(paperDefaultProfile, EPOCH_UTC_MS);
  } finally {
    console.time = originalConsoleTime;
    console.timeEnd = originalConsoleTimeEnd;
    console.log = originalConsoleLog;
  }

  const candidateRichStartOffsetSec = candidateRichProfile.demoStartOffsetSec
    ?? recommendDemoReplayStartOffsetSec(candidateRichProfile, EPOCH_UTC_MS);

  const paperLegacy = runBenchmarkAtOffset(
    'Formula baseline',
    'hobs-2024-paper-default',
    formulaPairStartOffsetSec,
  );
  const research = runBenchmarkAtOffset(
    'Research profile',
    'hobs-2024-tr38811-research',
    formulaPairStartOffsetSec,
  );
  const candidateRich = runBenchmarkAtOffset(
    'Operational baseline',
    'hobs-2024-candidate-rich',
    candidateRichStartOffsetSec,
  );

  const formulaDeltaPct = round(percentageDelta(research.medianFrameMs, paperLegacy.medianFrameMs));
  const operationalDeltaPct = round(percentageDelta(research.medianFrameMs, candidateRich.medianFrameMs));

  console.log(JSON.stringify({
    benchmarkConfig: {
      epochUtcMs: EPOCH_UTC_MS,
      benchmarkStartOffsetsSec: {
        formulaPair: formulaPairStartOffsetSec,
        candidateRich: candidateRichStartOffsetSec,
      },
      warmupFrames: WARMUP_FRAMES,
      measuredFrames: MEASURED_FRAMES,
      deltaSec: BENCHMARK_DELTA_SEC,
      speed: BENCHMARK_SPEED,
    },
    summaries: {
      paperLegacy,
      research,
      candidateRich,
    },
    deltas: {
      formulaDeltaPct,
      operationalDeltaPct,
      formulaBudgetPct: 25,
      formulaWithinBudget: formulaDeltaPct <= 25,
    },
  }, null, 2));
}

run();
