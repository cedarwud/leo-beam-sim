import { createObserverContext, EARTH_KM_PER_DEG } from '../engine/orbit';
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
import type { UeDistributionMode, UePrimaryAnchorMode } from '../engine/ue/multiUeState';
import {
  DEFAULT_UE_MOBILITY_PARAMS,
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
import {
  applyPerTickUeMobility,
  fillPerUeServingSinr as fillPerUeServingSinrImpl,
  resolveProfileRectangleAreaKm,
  stepSecondaryUeHandovers as stepSecondaryUeHandoversImpl,
  type FillPerUeServingSinrParams,
  type RuntimePerUeSinrPosition,
  type StepSecondaryUeHandoversParams,
} from './runtimeUeFrame';

export {
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  interpolateVisibleSats,
} from './trajectoryFrame';
export type { RuntimePerUeSinrPosition } from './runtimeUeFrame';

// MIN_ELEVATION_DEG / CACHE_ELEVATION_DEG / SIM_* are duplicated with
// trajectoryFrame.ts; S3 (one step, one reset) consolidates the runtime step.
// The sky-dome radii are re-exported from their single source (S1).
export const MIN_ELEVATION_DEG = 15;
export const CACHE_ELEVATION_DEG = 10;
export { SKY_DOME_H_RADIUS, SKY_DOME_V_RADIUS } from './sceneScale';
export const SIM_DURATION_SEC = 7200;
export const SIM_STEP_SEC = 20;
export const MAX_STEERING_EXTRA_RINGS = 3;
export const RECENT_HO_LINGER_SEC = 5;
// Showcase Master SDD v2 §8 requires secondary-UE recompute to be decoupled
// from render FPS; §4 fixes the live sampling cadence at 10-15 Hz.
export const SECONDARY_UE_RECOMPUTE_HZ = 12;
// Deprecated: kept for backward compatibility with event records only.
export const INTRA_HANDOVER_ARROW_SEC = 2.4;
const HANDOVER_VISUAL_LATCH_WALLCLOCK_MS = 6000;
const SECONDARY_RECOMPUTE_EPSILON_SEC = 1e-12;

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

export type SecondaryServingSnapshot = Pick<
  RuntimePerUeSinrPosition,
  | 'sinrDb'
  | 'servingSatId'
  | 'servingBeamId'
  | 'pendingTargetSatId'
  | 'pendingTargetBeamId'
  | 'triggerProgressSec'
>;

export interface RuntimeFrameStepState {
  simTimeSec: number;
  recentHo: RuntimeRecentHoState | null;
  intraHandoverEvent: IntraHandoverEvent | null;
  intraHandoverVizLatch: IntraHandoverVizLatch | null;
  interHandoverEvent: InterHandoverEvent | null;
  interHandoverVizLatch: InterHandoverVizLatch | null;
  beamPowerControlRuntime: BeamPowerControlRuntime;
  secondaryRecomputeAccumulatorSec: number;
  secondaryServingCache: SecondaryServingSnapshot[] | null;
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

/**
 * Read the ambient wall clock (display latch timing only — never truth).
 * S3-1: the single source of the triplicated `performance.now()` expression so
 * callers can inject `nowMs` explicitly and the step stays a pure function of
 * (state, dt, nowMs, config). Truth (sim-time, SINR, handover decisions) does
 * NOT read this; only the intra/inter handover viz-latch start/expiry does.
 */
export function readWallClockMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export interface RuntimeFrameStepInput {
  profile: Profile;
  replay: ReplayConfig;
  speed: number;
  paused: boolean;
  deltaSec: number;
  /**
   * Wall-clock ms used ONLY to stamp/expire the display-only handover viz
   * latches (S3-1 clock injection). Optional: when omitted the step falls back
   * to `readWallClockMs()` so existing callers are byte-unchanged; live callers
   * and deterministic harnesses inject it so the step takes no ambient clock
   * read on the driven path. NEVER feeds SINR / handover / serving truth.
   */
  nowMs?: number;
  beamFootprintMultiplier?: number;
  mapKmPerWorldUnit?: number;
  ueCount?: number;
  ueDistributionMode?: UeDistributionMode;
  uePrimaryAnchorMode?: UePrimaryAnchorMode;
  ueDistributionScope?: UeDistributionScope;
  ueDistributionRadiusKm?: number;
  /** Demo intra-handover jog: ENU offset (km) applied to the PRIMARY UE only so it
   *  crosses into an adjacent same-sat beam cell and the engine does a real intra. */
  primaryJogEastKm?: number;
  primaryJogNorthKm?: number;
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
  secondaryRecomputedThisFrame: boolean;
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
    secondaryRecomputeAccumulatorSec: 0,
    secondaryServingCache: null,
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

export function fillPerUeServingSinr(params: FillPerUeServingSinrParams): RuntimePerUeSinrPosition[] {
  return fillPerUeServingSinrImpl(params);
}

export function stepSecondaryUeHandovers(
  params: StepSecondaryUeHandoversParams,
): RuntimePerUeSinrPosition[] {
  return stepSecondaryUeHandoversImpl(params);
}

export function shouldRecomputeSecondary(
  accumulatorSec: number,
  cacheValid: boolean,
  hz = SECONDARY_UE_RECOMPUTE_HZ,
): boolean {
  if (!cacheValid) return true;
  const safeHz = Number.isFinite(hz) && hz > 0 ? hz : SECONDARY_UE_RECOMPUTE_HZ;
  return accumulatorSec + SECONDARY_RECOMPUTE_EPSILON_SEC >= 1 / safeHz;
}

function snapshotSecondaryServing(
  perUePositions: readonly RuntimePerUeSinrPosition[],
): SecondaryServingSnapshot[] {
  return perUePositions.slice(1).map(position => ({
    sinrDb: position.sinrDb,
    servingSatId: position.servingSatId,
    servingBeamId: position.servingBeamId,
    pendingTargetSatId: position.pendingTargetSatId,
    pendingTargetBeamId: position.pendingTargetBeamId,
    triggerProgressSec: position.triggerProgressSec,
  }));
}

function applySecondaryServingCache(
  perUePositions: RuntimePerUeSinrPosition[],
  cache: readonly SecondaryServingSnapshot[],
): void {
  for (let i = 1; i < perUePositions.length; i += 1) {
    const cached = cache[i - 1];
    if (!cached) continue;
    perUePositions[i].sinrDb = cached.sinrDb;
    perUePositions[i].servingSatId = cached.servingSatId;
    perUePositions[i].servingBeamId = cached.servingBeamId;
    perUePositions[i].pendingTargetSatId = cached.pendingTargetSatId;
    perUePositions[i].pendingTargetBeamId = cached.pendingTargetBeamId;
    perUePositions[i].triggerProgressSec = cached.triggerProgressSec;
  }
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
    mapKmPerWorldUnit,
    nowMs,
    ueCount: inputUeCount,
    ueDistributionMode = 'random',
    uePrimaryAnchorMode = 'observer',
    ueDistributionScope = 'beam-footprint',
    ueDistributionRadiusKm: inputUeDistributionRadiusKm,
    primaryJogEastKm = 0,
    primaryJogNorthKm = 0,
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
  // S3-1: resolve the display-latch wall clock ONCE from the injected value
  // (fallback to the ambient read for unchanged callers). Used only by the
  // intra/inter viz-latch stamping below — truth never reads it.
  const resolvedNowMs = nowMs ?? readWallClockMs();

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
    // S3-2: a loop wrap is a TIME-SHIFT, not a cold start. Clock-REBASE the
    // steered HO managers by the (negative) wrap delta — offsetting only their
    // two sim-time timers — instead of reset(), so a serving UE keeps its link
    // across the wrap rather than cold-re-acquiring under the strict
    // (eventLog-empty) re-attach threshold = the served-N/N flicker. The display
    // latches + recompute caches below still clear; they re-derive next frame
    // from the rebased managers. (deltaMs uses the offset delta — epochUtcMs
    // cancels in `epochUtcMs + simTimeSec*1000`, so it equals the managers' clock jump.)
    const wrapDeltaMs = (state.simTimeSec - previousSimTimeSec) * 1000;
    hoManager.rebase(wrapDeltaMs);
    secondaryHoManagers.forEach(manager => manager.rebase(wrapDeltaMs));
    state.recentHo = null;
    state.intraHandoverEvent = null;
    state.intraHandoverVizLatch = null;
    state.interHandoverEvent = null;
    state.interHandoverVizLatch = null;
    state.beamPowerControlRuntime = createEmptyBeamPowerControlRuntime();
    state.secondaryRecomputeAccumulatorSec = 0;
    state.secondaryServingCache = null;
  }

  const nowWallClockMs = resolvedNowMs;
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

  const ueEastKm = (ueObserver.lonDeg - observer.lonDeg) * EARTH_KM_PER_DEG * Math.cos(observer.latDeg * Math.PI / 180);
  const ueNorthKm = (ueObserver.latDeg - observer.latDeg) * EARTH_KM_PER_DEG;
  const primaryShell = profile.orbit.shells[0];
  const primaryGeometry = primaryShell
    ? computeBeamGeometry(primaryShell.altitudeKm, profile.antenna.beamwidth3dBRad)
    : { footprintRadiusKm: 1, spacingKm: 1 };
  const mapWorldScale = mapKmPerWorldUnit !== undefined && Number.isFinite(mapKmPerWorldUnit) && mapKmPerWorldUnit > 0
    ? 1 / mapKmPerWorldUnit
    : null;
  const ueWorldScale = mapWorldScale ?? (primaryGeometry.footprintRadiusKm > 0
    ? (FOOTPRINT_RADIUS_WORLD * beamFootprintMultiplier) / primaryGeometry.footprintRadiusKm
    : 1);
  const explicitUeDistributionRadiusKm = typeof inputUeDistributionRadiusKm === 'number'
    && Number.isFinite(inputUeDistributionRadiusKm)
    && inputUeDistributionRadiusKm > 0
    ? inputUeDistributionRadiusKm
    : null;
  const ueDistributionRadiusKm = explicitUeDistributionRadiusKm ?? resolveUeDistributionRadiusKm(
    ueDistributionScope,
    primaryShell?.id,
    beamLayoutsByShellId,
    primaryGeometry.footprintRadiusKm,
  );
  const rectangleAreaKm = resolveProfileRectangleAreaKm(profile);
  const perUePositions: RuntimePerUeSinrPosition[] = generateUePositions({
    ueCount,
    primaryEastKm: ueEastKm,
    primaryNorthKm: ueNorthKm,
    primaryJogEastKm,
    primaryJogNorthKm,
    primaryFootprintRadiusKm: ueDistributionRadiusKm,
    ueWorldScale,
    // Source: modqn-paper-reproduction/configs/modqn-paper-baseline.resolved-template.yaml
    // resolved_assumptions.seed_and_rng_policy.value.mobility_seed = 7
    // (ASSUME-MODQN-REP-018); profile surfaces it for deterministic playback.
    seed: profile.ueDistribution?.seed,
    rectangleAreaKm,
    mode: ueDistributionMode,
    primaryAnchorMode: uePrimaryAnchorMode,
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
    const interLatchNowWallClockMs = resolvedNowMs;
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
    const nowWallClockMs = resolvedNowMs;
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

  let secondaryRecomputedThisFrame = false;
  const secondaryUeCount = Math.max(0, perUePositions.length - 1);
  if (secondaryUeCount === 0) {
    state.secondaryRecomputeAccumulatorSec = 0;
    state.secondaryServingCache = null;
  } else {
    // Phase 3 S1 CPU gate invariants:
    // - primary UE index 0 is recomputed every frame above and is untouched here.
    // - secondary managers receive accumulated sim-dt on recompute, so timer dt is sampled, not dropped.
    // - skipped frames copy the last real serving sample only; no interpolation or fabricated serving truth.
    state.secondaryRecomputeAccumulatorSec += paused ? 0 : deltaSec * speed;
    const cacheValid =
      state.secondaryServingCache !== null
      && state.secondaryServingCache.length === secondaryUeCount;
    const recomputeSecondary = shouldRecomputeSecondary(
      state.secondaryRecomputeAccumulatorSec,
      cacheValid,
    );

    if (recomputeSecondary) {
      const accumulatedDtSec = paused ? 0 : state.secondaryRecomputeAccumulatorSec;
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
          dtSec: accumulatedDtSec,
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
      state.secondaryServingCache = snapshotSecondaryServing(perUePositions);
      // Reset to zero rather than carrying a fractional remainder: the full
      // accumulated dt has just been paid into secondary managers.
      state.secondaryRecomputeAccumulatorSec = 0;
      secondaryRecomputedThisFrame = true;
    } else if (state.secondaryServingCache) {
      applySecondaryServingCache(perUePositions, state.secondaryServingCache);
    }
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
    secondaryRecomputedThisFrame,
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
