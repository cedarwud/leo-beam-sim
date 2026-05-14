import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  propagateOrbitElement,
} from '../engine/orbit';
import type { ActiveBeamAssignment, SatelliteSnapshot } from '../engine/signal/types';
import { computeLinkBudget } from '../engine/signal/link-budget';
import {
  buildBeamPowerOverrideDbmByKey,
  updateBeamPowerControlStates,
} from '../engine/signal/power-control';
import { computeTr38811SlantRangeKm } from '../engine/signal/slant-range';
import { HandoverManager } from '../engine/handover/handover-manager';
import type { ServingState } from '../engine/handover/types';
import type { Profile } from '../profiles/types';
import { computeBeamGeometry, generateCoreSceneBeamOffsetsKm } from './beam-layout';
import { scheduleBeamCells, type CandidateBeamCell } from './beam-scheduler';
import type {
  BeamCellState,
  IntraHandoverEvent,
  ReplayConfig,
  SatBeamHopState,
  SimFrame,
  VisibleSat,
} from './types';
import {
  beamAssignmentKey,
  createEmptyBeamPowerControlRuntime,
  createInterpolatedTopo,
  createWorldPosition,
  interpolateAngleDeg,
  normalizeReplayOffset,
  resolveLatticeSteering,
  toBeamCellState,
  type BeamPowerControlRuntime,
  type CachedSatState,
  type ShellBeamLayout,
} from './simulationHelpers';

export const MIN_ELEVATION_DEG = 15;
export const CACHE_ELEVATION_DEG = 10;
export const SKY_DOME_H_RADIUS = 700;
export const SKY_DOME_V_RADIUS = 400;
export const SIM_DURATION_SEC = 1200;
export const SIM_STEP_SEC = 20;
export const MAX_STEERING_EXTRA_RINGS = 3;
export const RECENT_HO_LINGER_SEC = 5;
export const INTRA_HANDOVER_ARROW_SEC = 2.4;

export interface RuntimeRecentHoState {
  sourceSatId: string;
  sourceBeamId: number;
  sourceSinrDb: number | null;
  targetSatId: string;
  targetBeamId: number;
  targetSinrDb: number;
  deltaDb: number | null;
  expiresAtSec: number;
}

export interface RuntimeFrameStepState {
  simTimeSec: number;
  recentHo: RuntimeRecentHoState | null;
  intraHandoverEvent: IntraHandoverEvent | null;
  beamPowerControlRuntime: BeamPowerControlRuntime;
}

interface LinkContext {
  linkSamples: ReturnType<typeof computeLinkBudget>;
  beamCellsBySatId: Map<string, BeamCellState[]>;
  steeringBeamCellsBySatId: Map<string, BeamCellState[]>;
  linkRangeKmBySatId: Map<string, number>;
  beamHopStatesBySatId: Map<string, SatBeamHopState>;
  availableBeamAssignments: Set<string>;
  activeAssignments: ActiveBeamAssignment[];
  trackedAssignments: ActiveBeamAssignment[];
}

export interface RuntimeFrameStepInput {
  profile: Profile;
  replay: ReplayConfig;
  speed: number;
  paused: boolean;
  deltaSec: number;
  observer: ReturnType<typeof createObserverContext>;
  beamLayoutsByShellId: ReadonlyMap<string, ShellBeamLayout>;
  trajectoryCache: readonly CachedSatState[][];
  hoManager: HandoverManager;
  state: RuntimeFrameStepState;
}

export interface RuntimeFrameStepOutput {
  frame: SimFrame;
  previousSimTimeSec: number;
  didLoopWrap: boolean;
}

export function createBeamLayoutsByShellId(profile: Profile): Map<string, ShellBeamLayout> {
  return new Map(
    profile.orbit.shells.map(shell => {
      const geometry = computeBeamGeometry(shell.altitudeKm, profile.antenna.beamwidth3dBRad);
      const beamDiameterKm = geometry.footprintRadiusKm * 2;
      const offsets = generateCoreSceneBeamOffsetsKm({
        coreLayoutSatId: shell.id,
        maxBeams: profile.beams.perSatellite,
        beamDiameterKm,
        altitudeKm: shell.altitudeKm,
        frequencyReuse: profile.beams.frequencyReuse,
      });
      const maxOffsetRadiusKm = offsets.reduce(
        (maxRadius, beam) => Math.max(maxRadius, Math.hypot(beam.dEastKm, beam.dNorthKm)),
        0,
      );
      const geometryLimitedSteeringKm = maxOffsetRadiusKm + geometry.spacingKm * MAX_STEERING_EXTRA_RINGS;
      const steeringAngleRad = (profile.antenna.maxSteeringAngleDeg * Math.PI) / 180;
      const angleLimitedSteeringKm = shell.altitudeKm * Math.tan(steeringAngleRad);
      const maxSteeringDistanceKm = Math.min(geometryLimitedSteeringKm, angleLimitedSteeringKm);

      return [shell.id, {
        footprintRadiusKm: geometry.footprintRadiusKm,
        beamDiameterKm,
        beamCount: offsets.length,
        frequencyReuse: profile.beams.frequencyReuse,
        maxOffsetRadiusKm,
        maxSteeringDistanceKm,
        maxCoverageRadiusKm: maxOffsetRadiusKm + maxSteeringDistanceKm + geometry.footprintRadiusKm,
      } satisfies ShellBeamLayout];
    }),
  );
}

export function createTrajectoryCache(
  profile: Profile,
  observer: ReturnType<typeof createObserverContext>,
  epochUtcMs: number,
): CachedSatState[][] {
  const elements = generateWalkerConstellation({
    shells: profile.orbit.shells,
    epochUtcMs,
  });
  const steps = Math.ceil(SIM_DURATION_SEC / SIM_STEP_SEC) + 1;
  const cache: CachedSatState[][] = new Array(steps);

  for (let step = 0; step < steps; step++) {
    const atUtcMs = epochUtcMs + step * SIM_STEP_SEC * 1000;
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

export function getTrajectoryMaxTimeSec(trajectoryCache: readonly CachedSatState[][]): number {
  return Math.max(0, trajectoryCache.length - 1) * SIM_STEP_SEC;
}

export function createRuntimeFrameStepState(simTimeSec: number): RuntimeFrameStepState {
  return {
    simTimeSec,
    recentHo: null,
    intraHandoverEvent: null,
    beamPowerControlRuntime: createEmptyBeamPowerControlRuntime(),
  };
}

export function interpolateVisibleSats(
  trajectoryCache: readonly CachedSatState[][],
  simTimeSec: number,
  loop: boolean,
): VisibleSat[] {
  const rawStep = simTimeSec / SIM_STEP_SEC;
  const stepIndex = Math.floor(rawStep);
  const maxStep = trajectoryCache.length - 1;
  const t = rawStep - stepIndex;
  const stepA = loop ? stepIndex % trajectoryCache.length : Math.min(stepIndex, maxStep);
  const stepB = loop
    ? (stepA + 1) % trajectoryCache.length
    : Math.min(stepA + 1, maxStep);

  const cacheA = trajectoryCache[stepA];
  const cacheB = trajectoryCache[stepB];
  const cacheAMap = new Map(cacheA.map(sat => [sat.id, sat]));
  const cacheBMap = new Map(cacheB.map(sat => [sat.id, sat]));
  const satIds = new Set<string>([...cacheAMap.keys(), ...cacheBMap.keys()]);
  const visibleSats: VisibleSat[] = [];

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
      world: createWorldPosition(azimuthDeg, elevationDeg, SKY_DOME_H_RADIUS, SKY_DOME_V_RADIUS),
      topo: createInterpolatedTopo(azimuthDeg, elevationDeg, rangeKm),
      latDeg,
      lonDeg,
    });
  }

  return visibleSats;
}

function pushUniqueAssignment(
  assignments: ActiveBeamAssignment[],
  satId: string | null,
  beamId: number | null,
  availableBeamAssignments: Set<string>,
): void {
  if (!satId || beamId === null) return;
  const key = beamAssignmentKey(satId, beamId);
  if (!availableBeamAssignments.has(key)) return;
  if (assignments.some(assignment => assignment.satId === satId && assignment.beamId === beamId)) return;
  assignments.push({ satId, beamId });
}

function buildLinkContext(
  input: RuntimeFrameStepInput,
  linkSats: readonly VisibleSat[],
  state: Pick<ServingState, 'satId' | 'beamId' | 'pendingTarget'>,
  recentHo: RuntimeRecentHoState | null,
  beamHopSlotIndex: number,
  beamPowerOverrideDbmByKey?: ReadonlyMap<string, number>,
): LinkContext {
  const { observer, profile, beamLayoutsByShellId } = input;
  const cosObsLat = Math.cos((observer.latDeg * Math.PI) / 180);
  const beamHopEnabled = profile.beamHopping.enabled;
  const snapshots: SatelliteSnapshot[] = [];
  const beamHopStatesBySatId = new Map<string, SatBeamHopState>();
  const steeringBeamCellsBySatId = new Map<string, BeamCellState[]>();

  for (const sat of linkSats) {
    const layout = beamLayoutsByShellId.get(sat.shellId);
    if (!layout) continue;
    const offsets = generateCoreSceneBeamOffsetsKm({
      coreLayoutSatId: sat.id,
      maxBeams: layout.beamCount,
      beamDiameterKm: layout.beamDiameterKm,
      altitudeKm: sat.altitudeKm,
      frequencyReuse: layout.frequencyReuse,
    });
    if (offsets.length === 0) continue;

    const nadirEastKm = (sat.lonDeg - observer.lonDeg) * 111.32 * cosObsLat;
    const nadirNorthKm = (sat.latDeg - observer.latDeg) * 111.32;
    const nadirDistanceKm = Math.hypot(nadirEastKm, nadirNorthKm);
    const { steeringEastKm, steeringNorthKm } = resolveLatticeSteering(
      nadirEastKm,
      nadirNorthKm,
      layout,
      offsets,
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

    const allBeamCells: CandidateBeamCell[] = offsets
      .map((beam): CandidateBeamCell => {
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
          coreLayoutSatId: beam.coreLayoutSatId,
          coreBeamId: beam.coreBeamId,
          coreLocalBeamIndex: beam.coreLocalBeamIndex,
          reuseGroup: beam.reuseGroup,
          runtimeFrequencyReuse: beam.runtimeFrequencyReuse,
          coreLayoutFrequencyReuse: beam.coreLayoutFrequencyReuse,
          reuseGroupSource: beam.reuseGroupSource,
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

    steeringBeamCellsBySatId.set(
      sat.id,
      allBeamCells.map(toBeamCellState),
    );

    let activeBeamCells: BeamCellState[] = [];
    let activeBeamIds: number[] = [];
    let candidateBeamIds = candidateBeamCells.map(beam => beam.beamId);
    let frameSlotIndex = -1;
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
      activeBeamCells = scheduled.activeBeamCells.map(beam => {
        const source = beamCellById.get(beam.beamId);
        return source ? toBeamCellState(source) : beam;
      });
      activeBeamIds = scheduled.activeBeamIds;
      candidateBeamIds = scheduled.candidateBeamIds;
      frameSlotIndex = scheduled.frameSlotIndex;
    } else {
      const selectedBeamCells = new Map<number, BeamCellState>();

      for (const requiredBeamId of requiredBeamIds) {
        const beam = beamCellById.get(requiredBeamId);
        if (!beam) continue;
        selectedBeamCells.set(beam.beamId, toBeamCellState(beam));
      }

      for (const beam of candidateBeamCells) {
        if (selectedBeamCells.size >= profile.beams.maxActivePerSat) break;
        if (selectedBeamCells.has(beam.beamId)) continue;
        selectedBeamCells.set(beam.beamId, toBeamCellState(beam));
      }

      activeBeamCells = [...selectedBeamCells.values()];
      activeBeamIds = activeBeamCells.map(beam => beam.beamId);
    }

    if (activeBeamCells.length === 0) continue;

    beamHopStatesBySatId.set(sat.id, {
      satId: sat.id,
      slotIndex: beamHopSlotIndex,
      frameSlotIndex,
      activeBeamIds,
      candidateBeamIds,
    });

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

  const ue = {
    latDeg: observer.latDeg,
    lonDeg: observer.lonDeg,
    offsetEastKm: 0,
    offsetNorthKm: 0,
  };
  const availableBeamAssignments = new Set(
    snapshots.flatMap(satellite =>
      satellite.beamCellsKm.map(beam => beamAssignmentKey(satellite.id, beam.beamId)),
    ),
  );
  const trackedAssignments: ActiveBeamAssignment[] = [];
  pushUniqueAssignment(trackedAssignments, state.satId, state.beamId, availableBeamAssignments);
  pushUniqueAssignment(
    trackedAssignments,
    state.pendingTarget?.satId ?? null,
    state.pendingTarget?.beamId ?? null,
    availableBeamAssignments,
  );
  const scheduledAssignments = snapshots.flatMap(satellite =>
    satellite.beamCellsKm.map(beam => ({ satId: satellite.id, beamId: beam.beamId })),
  );
  const activeAssignments = beamHopEnabled ? scheduledAssignments : trackedAssignments;
  const beamCellsBySatId = new Map(
    snapshots.map(satellite => [satellite.id, satellite.beamCellsKm]),
  );
  const linkRangeKmBySatId = new Map(
    snapshots.map(satellite => [satellite.id, satellite.rangeKm]),
  );
  const linkSamples = computeLinkBudget(ue, snapshots, {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments,
    simTimeSec: input.state.simTimeSec,
    beamPowerOverrideDbmByKey,
  });

  return {
    linkSamples,
    beamCellsBySatId,
    steeringBeamCellsBySatId,
    linkRangeKmBySatId,
    beamHopStatesBySatId,
    availableBeamAssignments,
    activeAssignments,
    trackedAssignments,
  };
}

export function stepRuntimeFrame(input: RuntimeFrameStepInput): RuntimeFrameStepOutput {
  const {
    profile,
    replay,
    speed,
    paused,
    deltaSec,
    trajectoryCache,
    hoManager,
    state,
  } = input;
  const previousSimTimeSec = state.simTimeSec;
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);

  if (!paused) {
    state.simTimeSec += deltaSec * speed;
    if (replay.loop) {
      state.simTimeSec = normalizeReplayOffset(state.simTimeSec, maxTimeSec, true);
    } else {
      state.simTimeSec = Math.min(state.simTimeSec, maxTimeSec);
    }
  }

  const didLoopWrap = replay.loop && state.simTimeSec < previousSimTimeSec;
  if (didLoopWrap) {
    hoManager.reset();
    state.recentHo = null;
    state.intraHandoverEvent = null;
    state.beamPowerControlRuntime = createEmptyBeamPowerControlRuntime();
  }

  if (state.intraHandoverEvent && state.simTimeSec >= state.intraHandoverEvent.expiresAtSec) {
    state.intraHandoverEvent = null;
  }

  const visibleSats = interpolateVisibleSats(trajectoryCache, state.simTimeSec, replay.loop);
  const linkSats = visibleSats.filter(sat => sat.topo.elevationDeg >= MIN_ELEVATION_DEG);
  const beamHopEnabled = profile.beamHopping.enabled;
  const beamPowerControl = profile.channel.beamPowerControl;
  const usesBeamPowerControl =
    profile.formulaFamily === 'hobs-tr38811'
    && beamPowerControl !== undefined;
  const beamHopSlotSec = beamHopEnabled ? Math.max(profile.beamHopping.slotSec, 1e-6) : 0;
  const beamHopSlotIndex = beamHopEnabled ? Math.floor(state.simTimeSec / beamHopSlotSec) : -1;
  const beamHopSlotStartSec = beamHopEnabled && beamHopSlotIndex >= 0
    ? beamHopSlotIndex * beamHopSlotSec
    : 0;
  const currentRecentHo =
    state.recentHo && state.recentHo.expiresAtSec > state.simTimeSec
      ? state.recentHo
      : null;

  if (usesBeamPowerControl && beamPowerControl) {
    const bucketIndex = Math.floor(
      state.simTimeSec / Math.max(beamPowerControl.updatePeriodSec, 1e-6),
    );

    if (state.beamPowerControlRuntime.lastBucketIndex === null) {
      state.beamPowerControlRuntime.lastBucketIndex = bucketIndex;
    } else if (bucketIndex !== state.beamPowerControlRuntime.lastBucketIndex) {
      state.beamPowerControlRuntime = {
        statesByKey: updateBeamPowerControlStates(
          state.beamPowerControlRuntime.lastBucketSamples,
          state.beamPowerControlRuntime.statesByKey,
          beamPowerControl,
          profile.channel,
        ),
        lastBucketIndex: bucketIndex,
        lastBucketSamples: state.beamPowerControlRuntime.lastBucketSamples,
      };
    }
  }

  const beamPowerOverrideDbmByKey = usesBeamPowerControl
    ? buildBeamPowerOverrideDbmByKey(state.beamPowerControlRuntime.statesByKey)
    : undefined;

  const preDecisionContext = buildLinkContext(
    input,
    linkSats,
    hoManager.state,
    currentRecentHo,
    beamHopSlotIndex,
    beamPowerOverrideDbmByKey,
  );

  if (hoManager.state.satId && !linkSats.some(sat => sat.id === hoManager.state.satId)) {
    hoManager.clearServing();
  }

  const previousServingSatId = hoManager.state.satId;
  const decision = hoManager.update(
    preDecisionContext.linkSamples,
    paused ? 0 : deltaSec * speed,
    replay.epochUtcMs + state.simTimeSec * 1000,
  );
  const lastEvent = hoManager.eventLog[hoManager.eventLog.length - 1];

  if (
    decision.action === 'inter-handover'
    && decision.target
    && previousServingSatId !== null
    && lastEvent?.fromBeamId !== null
    && previousServingSatId !== decision.target.satId
  ) {
    state.recentHo = {
      sourceSatId: previousServingSatId,
      sourceBeamId: lastEvent.fromBeamId,
      sourceSinrDb: lastEvent.fromSinrDb ?? null,
      targetSatId: decision.target.satId,
      targetBeamId: decision.target.beamId,
      targetSinrDb: lastEvent?.toSinrDb ?? hoManager.state.sinrDb,
      deltaDb: lastEvent.deltaDb ?? null,
      expiresAtSec: state.simTimeSec + RECENT_HO_LINGER_SEC,
    };
  }

  if (
    decision.action === 'intra-switch'
    && decision.target
    && lastEvent?.action === 'intra-switch'
    && lastEvent.fromBeamId !== null
  ) {
    state.intraHandoverEvent = {
      satId: decision.target.satId,
      fromBeamId: lastEvent.fromBeamId,
      toBeamId: decision.target.beamId,
      triggeredAtSec: state.simTimeSec,
      expiresAtSec: state.simTimeSec + INTRA_HANDOVER_ARROW_SEC,
    };
  }

  const recentHoSourceSatId =
    state.recentHo && state.recentHo.expiresAtSec > state.simTimeSec
      ? state.recentHo.sourceSatId
      : null;
  const recentHoTargetSatId =
    state.recentHo && state.recentHo.expiresAtSec > state.simTimeSec
      ? state.recentHo.targetSatId
      : null;
  const postDecisionRecentHo =
    state.recentHo && state.recentHo.expiresAtSec > state.simTimeSec
      ? state.recentHo
      : null;
  const postDecisionContext = buildLinkContext(
    input,
    linkSats,
    hoManager.state,
    postDecisionRecentHo,
    beamHopSlotIndex,
    beamPowerOverrideDbmByKey,
  );

  if (usesBeamPowerControl) {
    state.beamPowerControlRuntime.lastBucketSamples = postDecisionContext.linkSamples;
  }

  const pendingTargetSinrDb = hoManager.getTrackedSinrDb(
    hoManager.state.pendingTarget?.satId ?? null,
    hoManager.state.pendingTarget?.beamId ?? null,
  );
  const frameActiveAssignments: ActiveBeamAssignment[] = [...postDecisionContext.activeAssignments];
  const displayAssignments = [...postDecisionContext.trackedAssignments];
  pushUniqueAssignment(
    displayAssignments,
    recentHoSourceSatId,
    recentHoSourceSatId ? state.recentHo?.sourceBeamId ?? null : null,
    postDecisionContext.availableBeamAssignments,
  );
  pushUniqueAssignment(
    displayAssignments,
    recentHoTargetSatId,
    recentHoTargetSatId ? state.recentHo?.targetBeamId ?? null : null,
    postDecisionContext.availableBeamAssignments,
  );

  return {
    previousSimTimeSec,
    didLoopWrap,
    frame: {
      satellites: visibleSats,
      linkSamples: postDecisionContext.linkSamples,
      activeAssignments: frameActiveAssignments,
      displayAssignments,
      beamCellsBySatId: postDecisionContext.beamCellsBySatId,
      steeringBeamCellsBySatId: postDecisionContext.steeringBeamCellsBySatId,
      linkRangeKmBySatId: postDecisionContext.linkRangeKmBySatId,
      beamHopSlotIndex,
      beamHopSlotStartSec,
      beamHopSlotSec,
      beamHopEnabled,
      beamHopStatesBySatId: postDecisionContext.beamHopStatesBySatId,
      serving: {
        satId: hoManager.state.satId,
        beamId: hoManager.state.beamId,
        sinrDb: hoManager.state.sinrDb,
      },
      pendingTargetSatId: hoManager.state.pendingTarget?.satId ?? null,
      pendingTargetBeamId: hoManager.state.pendingTarget?.beamId ?? null,
      pendingTargetSinrDb,
      recentHoSourceBeamId: recentHoSourceSatId ? state.recentHo?.sourceBeamId ?? null : null,
      recentHoTargetBeamId: recentHoTargetSatId ? state.recentHo?.targetBeamId ?? null : null,
      recentHoSourceSinrDb: recentHoSourceSatId ? state.recentHo?.sourceSinrDb ?? null : null,
      recentHoTargetSinrDb: recentHoTargetSatId ? state.recentHo?.targetSinrDb ?? null : null,
      recentHoDeltaDb: state.recentHo?.deltaDb ?? null,
      handoverTriggerProgressSec: hoManager.state.pendingTarget ? hoManager.state.triggerTimeSec : 0,
      hoCount: hoManager.eventLog.length,
      lastHoReason: decision.reason,
      simTimeSec: state.simTimeSec,
      recentHoSourceSatId,
      recentHoTargetSatId,
      intraHandoverEvent: state.intraHandoverEvent,
    },
  };
}
