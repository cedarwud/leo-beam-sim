import { createObserverContext } from '../engine/orbit';
import type { ActiveBeamAssignment, SatelliteSnapshot } from '../engine/signal/types';
import { computeLinkBudget } from '../engine/signal/link-budget';
import {
  buildBeamPowerOverrideDbmByKey,
  updateBeamPowerControlStates,
} from '../engine/signal/power-control';
import { computeTr38811SlantRangeKm } from '../engine/signal/slant-range';
import { HandoverManager } from '../engine/handover/handover-manager';
import type { ServingState } from '../engine/handover/types';
import { generateUePositions } from '../engine/ue/multiUeState';
import type { UeDistributionMode } from '../engine/ue/multiUeState';
import {
  DEFAULT_UE_MOBILITY_PARAMS,
  mobilityStep,
  type UeMobilityMode,
  type UeMobilityParams,
  type UePerMobilityState,
} from '../engine/ue/multiUeMobility';
import type { Profile } from '../profiles/types';
import { computeBeamGeometry, FOOTPRINT_RADIUS_WORLD, generateCoreSceneBeamOffsetsKm } from './beam-layout';
import { scheduleBeamCells, type CandidateBeamCell } from './beam-scheduler';
import type {
  BeamCellState,
  InterHandoverEvent,
  IntraHandoverEvent,
  ReplayConfig,
  SatBeamHopState,
  SimFrame,
  UeDistributionScope,
  VisibleSat,
} from './types';
import {
  beamAssignmentKey,
  createEmptyBeamPowerControlRuntime,
  normalizeReplayOffset,
  resolveLatticeSteering,
  toBeamCellState,
  type BeamPowerControlRuntime,
  type CachedSatState,
  type ShellBeamLayout,
} from './simulationHelpers';
import {
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  interpolateVisibleSats,
  resolveWaypointObserver,
  type UeObserverPosition,
} from './trajectoryFrame';

export {
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  interpolateVisibleSats,
} from './trajectoryFrame';

// These constants are duplicated with trajectoryFrame.ts so the runtime
// baseline validator regex can match the literal `export const` declarations.
export const MIN_ELEVATION_DEG = 15;
export const CACHE_ELEVATION_DEG = 10;
export const SKY_DOME_H_RADIUS = 700;
export const SKY_DOME_V_RADIUS = 400;
export const SIM_DURATION_SEC = 1200;
export const SIM_STEP_SEC = 20;
export const MAX_STEERING_EXTRA_RINGS = 3;
export const RECENT_HO_LINGER_SEC = 5;
// Deprecated: kept for backward compatibility with event records only.
export const INTRA_HANDOVER_ARROW_SEC = 2.4;
const HANDOVER_VISUAL_LATCH_WALLCLOCK_MS = 6000;
const EARTH_KM_PER_DEG = 111.32;

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

export interface IntraHandoverVizLatch {
  event: IntraHandoverEvent;
  wallClockStartMs: number;
  wallClockExpiresMs: number;
}

export interface InterHandoverVizLatch {
  event: InterHandoverEvent;
  wallClockStartMs: number;
  wallClockExpiresMs: number;
}

export interface RuntimeFrameStepState {
  simTimeSec: number;
  recentHo: RuntimeRecentHoState | null;
  intraHandoverEvent: IntraHandoverEvent | null;
  intraHandoverVizLatch: IntraHandoverVizLatch | null;
  interHandoverEvent: InterHandoverEvent | null;
  interHandoverVizLatch: InterHandoverVizLatch | null;
  beamPowerControlRuntime: BeamPowerControlRuntime;
}

interface LinkContext {
  linkSamples: ReturnType<typeof computeLinkBudget>;
  snapshots: SatelliteSnapshot[];
  linkBudgetOptions: Parameters<typeof computeLinkBudget>[2];
  beamCellsBySatId: Map<string, BeamCellState[]>;
  steeringBeamCellsBySatId: Map<string, BeamCellState[]>;
  linkRangeKmBySatId: Map<string, number>;
  beamHopStatesBySatId: Map<string, SatBeamHopState>;
  availableBeamAssignments: Set<string>;
  activeAssignments: ActiveBeamAssignment[];
  trackedAssignments: ActiveBeamAssignment[];
}

export interface RuntimePerUeSinrPosition {
  id: string;
  groundX: number;
  groundZ: number;
  eastKm: number;
  northKm: number;
  sinrDb: number | null;
  servingSatId: string | null;
  servingBeamId: number | null;
  pendingTargetSatId: string | null;
  pendingTargetBeamId: number | null;
  triggerProgressSec: number;
}

export interface RuntimeFrameStepInput {
  profile: Profile;
  replay: ReplayConfig;
  speed: number;
  paused: boolean;
  deltaSec: number;
  beamFootprintMultiplier?: number;
  ueCount?: number;
  ueDistributionMode?: UeDistributionMode;
  ueDistributionScope?: UeDistributionScope;
  ueMobilityMode?: UeMobilityMode;
  ueMobilityParams?: UeMobilityParams;
  mobilityStates?: UePerMobilityState[];
  observer: ReturnType<typeof createObserverContext>;
  beamLayoutsByShellId: ReadonlyMap<string, ShellBeamLayout>;
  trajectoryCache: readonly CachedSatState[][];
  hoManager: HandoverManager;
  secondaryHoManagers?: readonly HandoverManager[];
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

export function createRuntimeFrameStepState(simTimeSec: number): RuntimeFrameStepState {
  return {
    simTimeSec,
    recentHo: null,
    intraHandoverEvent: null,
    intraHandoverVizLatch: null,
    interHandoverEvent: null,
    interHandoverVizLatch: null,
    beamPowerControlRuntime: createEmptyBeamPowerControlRuntime(),
  };
}

function resolveUeDistributionRadiusKm(
  scope: UeDistributionScope,
  shellId: string | undefined,
  beamLayoutsByShellId: ReadonlyMap<string, ShellBeamLayout>,
  fallbackRadiusKm: number,
): number {
  if (scope !== 'service-area' || !shellId) return fallbackRadiusKm;
  const layout = beamLayoutsByShellId.get(shellId);
  if (!layout) return fallbackRadiusKm;
  const serviceAreaRadiusKm = layout.maxOffsetRadiusKm + layout.footprintRadiusKm;
  return Number.isFinite(serviceAreaRadiusKm) && serviceAreaRadiusKm > 0
    ? serviceAreaRadiusKm
    : fallbackRadiusKm;
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
  ueObserver: UeObserverPosition,
  beamHopSlotIndex: number,
  beamPowerOverrideDbmByKey?: ReadonlyMap<string, number>,
): LinkContext {
  const { observer, profile, beamLayoutsByShellId } = input;
  const cosObsLat = Math.cos((observer.latDeg * Math.PI) / 180);
  const ueLatDeg = ueObserver.latDeg;
  const ueLonDeg = ueObserver.lonDeg;
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

    const nadirEastKm = (sat.lonDeg - ueLonDeg) * EARTH_KM_PER_DEG * cosObsLat;
    const nadirNorthKm = (sat.latDeg - ueLatDeg) * EARTH_KM_PER_DEG;
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
    latDeg: ueLatDeg,
    lonDeg: ueLonDeg,
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
  const linkBudgetOptions = {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments,
    simTimeSec: input.state.simTimeSec,
    beamPowerOverrideDbmByKey,
  } satisfies Parameters<typeof computeLinkBudget>[2];
  const linkSamples = computeLinkBudget(ue, snapshots, linkBudgetOptions);

  return {
    linkSamples,
    snapshots,
    linkBudgetOptions,
    beamCellsBySatId,
    steeringBeamCellsBySatId,
    linkRangeKmBySatId,
    beamHopStatesBySatId,
    availableBeamAssignments,
    activeAssignments,
    trackedAssignments,
  };
}

export function fillPerUeServingSinr(params: {
  perUePositions: RuntimePerUeSinrPosition[];
  primaryServingSinrDb: number;
  primaryServingSatId: string | null;
  primaryServingBeamId: number | null;
  primaryLatDeg: number;
  primaryLonDeg: number;
  primaryEastKm: number;
  primaryNorthKm: number;
  snapshots: SatelliteSnapshot[];
  linkBudgetOptions: Parameters<typeof computeLinkBudget>[2];
}): RuntimePerUeSinrPosition[] {
  const {
    perUePositions,
    primaryServingSinrDb,
    primaryServingSatId,
    primaryServingBeamId,
    primaryLatDeg,
    primaryLonDeg,
    primaryEastKm,
    primaryNorthKm,
    snapshots,
    linkBudgetOptions,
  } = params;

  if (perUePositions.length === 0) return perUePositions;
  perUePositions[0].sinrDb = primaryServingSinrDb;

  if (primaryServingSatId === null || primaryServingBeamId === null) {
    for (let i = 1; i < perUePositions.length; i += 1) {
      perUePositions[i].sinrDb = null;
    }
    return perUePositions;
  }

  const cosPrimaryLat = Math.cos((primaryLatDeg * Math.PI) / 180);
  const lonKmPerDeg = EARTH_KM_PER_DEG * Math.max(Math.abs(cosPrimaryLat), 1e-6);

  for (let i = 1; i < perUePositions.length; i += 1) {
    const ueSecondary = perUePositions[i];
    const deltaEastKm = ueSecondary.eastKm - primaryEastKm;
    const deltaNorthKm = ueSecondary.northKm - primaryNorthKm;
    const secondarySamples = computeLinkBudget(
      {
        latDeg: primaryLatDeg + deltaNorthKm / EARTH_KM_PER_DEG,
        lonDeg: primaryLonDeg + deltaEastKm / lonKmPerDeg,
        offsetEastKm: deltaEastKm,
        offsetNorthKm: deltaNorthKm,
      },
      snapshots,
      linkBudgetOptions,
    );
    const matchingSample = secondarySamples.find(
      sample => sample.satId === primaryServingSatId && sample.beamId === primaryServingBeamId,
    );
    ueSecondary.sinrDb = matchingSample?.sinrDb ?? null;
  }

  return perUePositions;
}

export function stepSecondaryUeHandovers(params: {
  perUePositions: RuntimePerUeSinrPosition[];
  secondaryHoManagers: readonly HandoverManager[];
  primaryLatDeg: number;
  primaryLonDeg: number;
  primaryEastKm: number;
  primaryNorthKm: number;
  snapshots: SatelliteSnapshot[];
  linkBudgetOptions: Parameters<typeof computeLinkBudget>[2];
  dtSec: number;
  simTimeMs: number;
}): RuntimePerUeSinrPosition[] {
  const {
    perUePositions,
    secondaryHoManagers,
    primaryLatDeg,
    primaryLonDeg,
    primaryEastKm,
    primaryNorthKm,
    snapshots,
    linkBudgetOptions,
    dtSec,
    simTimeMs,
  } = params;

  if (perUePositions.length <= 1 || secondaryHoManagers.length === 0) return perUePositions;

  const cosPrimaryLat = Math.cos((primaryLatDeg * Math.PI) / 180);
  const lonKmPerDeg = EARTH_KM_PER_DEG * Math.max(Math.abs(cosPrimaryLat), 1e-6);

  for (let i = 1; i < perUePositions.length; i += 1) {
    const manager = secondaryHoManagers[i - 1];
    if (!manager) continue;

    const ueSecondary = perUePositions[i];
    const deltaEastKm = ueSecondary.eastKm - primaryEastKm;
    const deltaNorthKm = ueSecondary.northKm - primaryNorthKm;
    const secondarySamples = computeLinkBudget(
      {
        latDeg: primaryLatDeg + deltaNorthKm / EARTH_KM_PER_DEG,
        lonDeg: primaryLonDeg + deltaEastKm / lonKmPerDeg,
        offsetEastKm: deltaEastKm,
        offsetNorthKm: deltaNorthKm,
      },
      snapshots,
      linkBudgetOptions,
    );

    if (manager.state.satId && !secondarySamples.some(sample => sample.satId === manager.state.satId)) {
      manager.clearServing();
    }

    manager.update(secondarySamples, dtSec, simTimeMs);
    ueSecondary.sinrDb = manager.state.sinrDb;
    ueSecondary.servingSatId = manager.state.satId;
    ueSecondary.servingBeamId = manager.state.beamId;
    ueSecondary.pendingTargetSatId = manager.state.pendingTarget?.satId ?? null;
    ueSecondary.pendingTargetBeamId = manager.state.pendingTarget?.beamId ?? null;
    ueSecondary.triggerProgressSec = manager.state.pendingTarget ? manager.state.triggerTimeSec : 0;
  }

  return perUePositions;
}

function applyPerTickUeMobility(params: {
  perUePositions: RuntimePerUeSinrPosition[];
  mobilityStates: UePerMobilityState[];
  ueMobilityMode: UeMobilityMode;
  ueMobilityParams: UeMobilityParams;
  deltaSec: number;
  primaryFootprintRadiusKm: number;
  ueWorldScale: number;
}): RuntimePerUeSinrPosition[] {
  const {
    perUePositions,
    mobilityStates,
    ueMobilityMode,
    ueMobilityParams,
    deltaSec,
    primaryFootprintRadiusKm,
    ueWorldScale,
  } = params;
  if (ueMobilityMode === 'static' || perUePositions.length <= 1) return perUePositions;

  const primary = perUePositions[0];
  for (let i = 1; i < perUePositions.length; i += 1) {
    const previous = perUePositions[i];
    const storedState = mobilityStates[i];
    if (!storedState) continue;
    const currentPosition = storedState.currentPosition ?? previous;
    const next = mobilityStep(
      currentPosition,
      {
        ...storedState,
        originEastKm: primary.eastKm,
        originNorthKm: primary.northKm,
        ueWorldScale,
      },
      ueMobilityMode,
      ueMobilityParams,
      deltaSec,
      primaryFootprintRadiusKm,
    );
    mobilityStates[i] = next.state;
    perUePositions[i] = {
      ...previous,
      groundX: next.position.groundX,
      groundZ: next.position.groundZ,
      eastKm: next.position.eastKm,
      northKm: next.position.northKm,
    };
  }

  return perUePositions;
}

export function stepRuntimeFrame(input: RuntimeFrameStepInput): RuntimeFrameStepOutput {
  const {
    profile,
    replay,
    speed,
    observer,
    beamLayoutsByShellId,
    paused,
    deltaSec,
    beamFootprintMultiplier: inputBeamFootprintMultiplier,
    ueCount: inputUeCount,
    ueDistributionMode = 'random',
    ueDistributionScope = 'beam-footprint',
    ueMobilityMode = 'static',
    ueMobilityParams = DEFAULT_UE_MOBILITY_PARAMS,
    mobilityStates = [],
    trajectoryCache,
    hoManager,
    secondaryHoManagers = [],
    state,
  } = input;
  const beamFootprintMultiplier = inputBeamFootprintMultiplier ?? 1.0;
  const ueCount = inputUeCount ?? 1;
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
    secondaryHoManagers.forEach(manager => manager.reset());
    state.recentHo = null;
    state.intraHandoverEvent = null;
    state.intraHandoverVizLatch = null;
    state.interHandoverEvent = null;
    state.interHandoverVizLatch = null;
    state.beamPowerControlRuntime = createEmptyBeamPowerControlRuntime();
  }

  const nowWallClockMs = typeof performance === 'undefined' ? Date.now() : performance.now();
  if (
    state.intraHandoverVizLatch
    && nowWallClockMs >= state.intraHandoverVizLatch.wallClockExpiresMs
  ) {
    state.intraHandoverVizLatch = null;
  }
  if (
    state.interHandoverVizLatch
    && nowWallClockMs >= state.interHandoverVizLatch.wallClockExpiresMs
  ) {
    state.interHandoverVizLatch = null;
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

  const ueObserver = resolveWaypointObserver(profile.ueMobility, state.simTimeSec, observer.latDeg, observer.lonDeg);

  const ueEastKm = (ueObserver.lonDeg - observer.lonDeg) * 111.32 * Math.cos(observer.latDeg * Math.PI / 180);
  const ueNorthKm = (ueObserver.latDeg - observer.latDeg) * 111.32;
  const primaryShell = profile.orbit.shells[0];
  const primaryGeometry = primaryShell
    ? computeBeamGeometry(primaryShell.altitudeKm, profile.antenna.beamwidth3dBRad)
    : { footprintRadiusKm: 1, spacingKm: 1 };
  const ueWorldScale = primaryGeometry.footprintRadiusKm > 0
    ? (FOOTPRINT_RADIUS_WORLD * beamFootprintMultiplier) / primaryGeometry.footprintRadiusKm
    : 1;
  const ueDistributionRadiusKm = resolveUeDistributionRadiusKm(
    ueDistributionScope,
    primaryShell?.id,
    beamLayoutsByShellId,
    primaryGeometry.footprintRadiusKm,
  );
  const perUePositions: RuntimePerUeSinrPosition[] = generateUePositions({
    ueCount,
    primaryEastKm: ueEastKm,
    primaryNorthKm: ueNorthKm,
    primaryFootprintRadiusKm: ueDistributionRadiusKm,
    ueWorldScale,
    mode: ueDistributionMode,
  }).map(position => ({
    ...position,
    sinrDb: null,
    servingSatId: null,
    servingBeamId: null,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    triggerProgressSec: 0,
  }));
  applyPerTickUeMobility({
    perUePositions,
    mobilityStates,
    ueMobilityMode,
    ueMobilityParams,
    deltaSec: paused ? 0 : deltaSec * speed,
    primaryFootprintRadiusKm: primaryGeometry.footprintRadiusKm,
    ueWorldScale,
  });
  const ueGroundX = perUePositions[0].groundX;
  const ueGroundZ = perUePositions[0].groundZ;
  const preDecisionContext = buildLinkContext(
    input,
    linkSats,
    hoManager.state,
    currentRecentHo,
    ueObserver,
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
    const interLatchNowWallClockMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    state.interHandoverEvent = {
      fromSatId: previousServingSatId,
      fromBeamId: lastEvent.fromBeamId,
      toSatId: decision.target.satId,
      toBeamId: decision.target.beamId,
      triggeredAtSec: state.simTimeSec,
      expiresAtSec: state.simTimeSec + RECENT_HO_LINGER_SEC,
    };
    state.interHandoverVizLatch = {
      event: state.interHandoverEvent,
      wallClockStartMs: interLatchNowWallClockMs,
      wallClockExpiresMs: interLatchNowWallClockMs + HANDOVER_VISUAL_LATCH_WALLCLOCK_MS,
    };
    state.intraHandoverEvent = null;
    state.intraHandoverVizLatch = null;
  }

  if (
    decision.action === 'intra-switch'
    && decision.target
    && lastEvent?.action === 'intra-switch'
    && lastEvent.fromBeamId !== null
  ) {
    state.recentHo = {
      sourceSatId: decision.target.satId,
      sourceBeamId: lastEvent.fromBeamId,
      sourceSinrDb: lastEvent.fromSinrDb ?? null,
      targetSatId: decision.target.satId,
      targetBeamId: decision.target.beamId,
      targetSinrDb: lastEvent.toSinrDb ?? hoManager.state.sinrDb,
      deltaDb: lastEvent.deltaDb ?? null,
      expiresAtSec: state.simTimeSec + RECENT_HO_LINGER_SEC,
    };
    const nowWallClockMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    state.intraHandoverEvent = {
      satId: decision.target.satId,
      fromBeamId: lastEvent.fromBeamId,
      toBeamId: decision.target.beamId,
      triggeredAtSec: state.simTimeSec,
      expiresAtSec: state.simTimeSec + INTRA_HANDOVER_ARROW_SEC,
    };
    state.intraHandoverVizLatch = {
      event: state.intraHandoverEvent,
      wallClockStartMs: nowWallClockMs,
      wallClockExpiresMs: nowWallClockMs + HANDOVER_VISUAL_LATCH_WALLCLOCK_MS,
    };
    state.interHandoverEvent = null;
    state.interHandoverVizLatch = null;
  }

  const recentHoSourceSatId =
    state.recentHo && state.recentHo.expiresAtSec > state.simTimeSec
      ? state.recentHo.sourceSatId
      : null;
  const recentHoTargetSatId =
    state.recentHo && state.recentHo.expiresAtSec > state.simTimeSec
      ? state.recentHo.targetSatId
      : null;
  const activeIntraHandoverEvent = state.intraHandoverVizLatch
    ? state.intraHandoverVizLatch.event
    : null;
  const activeIntraHandoverPreview = activeIntraHandoverEvent
    ? null
    : hoManager.getIntraSwitchPreview();
  const activeIntraHandoverWallClockStartMs = state.intraHandoverVizLatch
    ? state.intraHandoverVizLatch.wallClockStartMs
    : null;
  const activeIntraHandoverWallClockExpiresMs = state.intraHandoverVizLatch
    ? state.intraHandoverVizLatch.wallClockExpiresMs
    : null;
  const activeInterHandoverEvent = state.interHandoverVizLatch
    ? state.interHandoverVizLatch.event
    : null;
  const activeInterHandoverWallClockStartMs = state.interHandoverVizLatch
    ? state.interHandoverVizLatch.wallClockStartMs
    : null;
  const activeInterHandoverWallClockExpiresMs = state.interHandoverVizLatch
    ? state.interHandoverVizLatch.wallClockExpiresMs
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
    ueObserver,
    beamHopSlotIndex,
    beamPowerOverrideDbmByKey,
  );

  if (usesBeamPowerControl) {
    state.beamPowerControlRuntime.lastBucketSamples = postDecisionContext.linkSamples;
  }

  const primaryServingSinrDb = hoManager.state.sinrDb;
  perUePositions[0].sinrDb = primaryServingSinrDb;
  perUePositions[0].servingSatId = hoManager.state.satId;
  perUePositions[0].servingBeamId = hoManager.state.beamId;
  perUePositions[0].pendingTargetSatId = hoManager.state.pendingTarget?.satId ?? null;
  perUePositions[0].pendingTargetBeamId = hoManager.state.pendingTarget?.beamId ?? null;
  perUePositions[0].triggerProgressSec = hoManager.state.pendingTarget ? hoManager.state.triggerTimeSec : 0;

  if (secondaryHoManagers.length > 0) {
    stepSecondaryUeHandovers({
      perUePositions,
      secondaryHoManagers,
      primaryLatDeg: ueObserver.latDeg,
      primaryLonDeg: ueObserver.lonDeg,
      primaryEastKm: perUePositions[0].eastKm,
      primaryNorthKm: perUePositions[0].northKm,
      snapshots: postDecisionContext.snapshots,
      linkBudgetOptions: postDecisionContext.linkBudgetOptions,
      dtSec: paused ? 0 : deltaSec * speed,
      simTimeMs: replay.epochUtcMs + state.simTimeSec * 1000,
    });
  } else {
    fillPerUeServingSinr({
      perUePositions,
      primaryServingSinrDb,
      primaryServingSatId: hoManager.state.satId,
      primaryServingBeamId: hoManager.state.beamId,
      primaryLatDeg: ueObserver.latDeg,
      primaryLonDeg: ueObserver.lonDeg,
      primaryEastKm: perUePositions[0].eastKm,
      primaryNorthKm: perUePositions[0].northKm,
      snapshots: postDecisionContext.snapshots,
      linkBudgetOptions: postDecisionContext.linkBudgetOptions,
    });
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
        sinrDb: primaryServingSinrDb,
      },
      pendingTargetSatId: hoManager.state.pendingTarget?.satId ?? null,
      pendingTargetBeamId: hoManager.state.pendingTarget?.beamId ?? null,
      pendingTargetSinrDb,
      recentHoSourceBeamId: recentHoSourceSatId ? state.recentHo?.sourceBeamId ?? null : null,
      recentHoTargetBeamId: recentHoTargetSatId ? state.recentHo?.targetBeamId ?? null : null,
      recentHoSourceSinrDb: recentHoSourceSatId ? state.recentHo?.sourceSinrDb ?? null : null,
      recentHoTargetSinrDb: recentHoTargetSatId ? state.recentHo?.targetSinrDb ?? null : null,
      recentHoDeltaDb: state.recentHo?.deltaDb ?? null,
      lastHoEvent: hoManager.eventLog[hoManager.eventLog.length - 1] ?? null,
      handoverTriggerProgressSec: hoManager.state.pendingTarget ? hoManager.state.triggerTimeSec : 0,
      hoCount: hoManager.eventLog.length,
      intraHoCount: hoManager.eventLog.filter(e => e.action === 'intra-switch').length,
      lastHoReason: decision.reason,
      simTimeSec: state.simTimeSec,
      recentHoSourceSatId,
      recentHoTargetSatId,
      intraHandoverEvent: activeIntraHandoverEvent,
      intraHandoverPreview: activeIntraHandoverPreview,
      intraHandoverWallClockStartMs: activeIntraHandoverWallClockStartMs,
      intraHandoverWallClockExpiresMs: activeIntraHandoverWallClockExpiresMs,
      interHandoverEvent: activeInterHandoverEvent,
      interHandoverWallClockStartMs: activeInterHandoverWallClockStartMs,
      interHandoverWallClockExpiresMs: activeInterHandoverWallClockExpiresMs,
      ueGroundX,
      ueGroundZ,
      perUePositions,
    },
  };
}
