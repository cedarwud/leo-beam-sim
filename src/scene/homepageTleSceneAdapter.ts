import type { PropagatedSatelliteState, Vector3 } from '../tle/types';
import type { CanonicalTleHandoverState } from '../simulator/canonicalTleHandover';
import type { SimulationAnalysisFrame } from '../simulator/types';
import { deriveObserverLinkGeometry, NTPU_TLE_OBSERVER } from '../simulator/observer';
import { SKY_DOME_H_RADIUS, SKY_DOME_V_RADIUS } from './sceneScale';
import { createWorldPosition } from './simulationHelpers';

/** Compatibility export; the one authority lives in simulator/observer. */
export const HOMEPAGE_TLE_OBSERVER = NTPU_TLE_OBSERVER;

/** Keep the existing dome readable without drawing the whole constellation. */
export const HOMEPAGE_TLE_DEFAULT_CONTEXT_LIMIT = 24;

export type HomepageTleSceneSatelliteRole = 'selected' | 'candidate' | 'context';

export interface HomepageTleLookAngles {
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
  readonly visible: boolean;
}

export interface HomepageTleSceneSatellite {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly role: HomepageTleSceneSatelliteRole;
  /** Existing campus convention: east → +X, up → +Y, north → −Z. */
  readonly worldPosition: readonly [number, number, number];
  /** Unmodified SGP4 TEME state retained beside the display projection. */
  readonly positionTemeKm: Vector3;
  /** Unmodified SGP4 TEME velocity used by bounded visual orbit interpolation. */
  readonly velocityTemeKmPerSec: Vector3;
  readonly look: HomepageTleLookAngles;
  readonly tleEpochUtc: string;
  readonly sourcePath: string;
}

export interface HomepageTleSceneTrajectoryPoint {
  readonly instantUtc: string;
  readonly positionTemeKm: Vector3;
  readonly worldPosition: readonly [number, number, number];
  readonly look: HomepageTleLookAngles;
}

export interface HomepageTleSceneIdentity {
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly requestedInstantUtc: string;
  readonly instantTaipei: string;
  readonly constellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly archiveDate: string;
  readonly selectedSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly sourceKind: SimulationAnalysisFrame['provenance']['sourceKind'];
  readonly propagationModel: SimulationAnalysisFrame['provenance']['propagationModel'];
}

export interface HomepageTleSceneTelemetry {
  readonly propagatedSatelliteCount: number;
  readonly renderedSatelliteCount: number;
  readonly visibleContextSatelliteCount: number;
  readonly selectedTrajectoryPointCount: number;
  readonly selectedElevationDeg: number;
  readonly selectedAzimuthDeg: number;
  readonly selectedRangeKm: number;
  readonly candidateElevationDeg: number | null;
}

export interface HomepageTleSceneFrame {
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly instantUtc: string;
  readonly constellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly identity: HomepageTleSceneIdentity;
  readonly selected: HomepageTleSceneSatellite;
  readonly candidate: HomepageTleSceneSatellite | null;
  readonly contextSatellites: readonly HomepageTleSceneSatellite[];
  readonly satellites: readonly HomepageTleSceneSatellite[];
  readonly selectedTrajectory: readonly HomepageTleSceneTrajectoryPoint[];
  readonly telemetry: HomepageTleSceneTelemetry;
  /** This projection is the campus sky-dome, not the Earth/orbit renderer. */
  readonly earthSphere: false;
  /** Decision state from the same completed TLE run, when available. */
  readonly handoverDecision: CanonicalTleHandoverState | 'not-in-frame';
}

export interface HomepageTleSceneAdapterOptions {
  /** Number of above-horizon non-selected/non-candidate satellites to retain. */
  readonly contextLimit?: number;
  /**
   * Additional source identities that must remain in the bounded display
   * projection even when they are below the horizon or outside contextLimit.
   * This is display retention only; it never changes the selected/candidate
   * producer roles or any canonical decision.
   */
  readonly retainSatelliteIds?: readonly string[];
}

interface ProjectedLook {
  readonly look: HomepageTleLookAngles;
  readonly worldPosition: readonly [number, number, number];
}

/**
 * Timeline playback changes the fractional display offset every 250 ms while
 * the accepted TLE anchor remains the same.  The accepted frame is immutable,
 * so re-projecting every one of the retained candidate-pool satellites on
 * every clock tick is redundant.  Keep a small deterministic LRU of the
 * bounded scene projection; interpolation still runs per tick, but the
 * expensive TEME → look-angle pass is paid once per accepted frame/limit.
 */
const HOMEPAGE_SCENE_PROJECTION_CACHE_LIMIT = 96;
const homepageSceneProjectionCache = new Map<string, HomepageTleSceneFrame>();
const homepageSceneFrameObjectIds = new WeakMap<object, number>();
let nextHomepageSceneFrameObjectId = 1;

function normalizedRetainSatelliteIds(value: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((value ?? []).filter(id => typeof id === 'string' && id.length > 0))].sort());
}

function homepageSceneProjectionKey(
  frame: SimulationAnalysisFrame,
  contextLimit: number,
  retainSatelliteIds: readonly string[],
): string {
  // frameId is a scientific identity, not a JavaScript object identity. Test
  // fixtures and pending wrappers may intentionally reuse it while changing
  // the candidate payload, so the cache must never cross-contaminate those
  // immutable frame objects.
  let objectId = homepageSceneFrameObjectIds.get(frame);
  if (objectId === undefined) {
    objectId = nextHomepageSceneFrameObjectId;
    nextHomepageSceneFrameObjectId += 1;
    homepageSceneFrameObjectIds.set(frame, objectId);
  }
  return `${objectId}|context=${contextLimit}|retain=${retainSatelliteIds.join(',')}`;
}

function cachedSceneProjection(
  frame: SimulationAnalysisFrame,
  contextLimit: number,
  retainSatelliteIds: readonly string[],
): HomepageTleSceneFrame | null {
  const key = homepageSceneProjectionKey(frame, contextLimit, retainSatelliteIds);
  const cached = homepageSceneProjectionCache.get(key);
  if (cached !== undefined) {
    homepageSceneProjectionCache.delete(key);
    homepageSceneProjectionCache.set(key, cached);
    return cached;
  }
  return null;
}

function rememberSceneProjection(
  frame: SimulationAnalysisFrame,
  contextLimit: number,
  retainSatelliteIds: readonly string[],
  projected: HomepageTleSceneFrame,
): HomepageTleSceneFrame {
  const key = homepageSceneProjectionKey(frame, contextLimit, retainSatelliteIds);
  homepageSceneProjectionCache.delete(key);
  homepageSceneProjectionCache.set(key, projected);
  while (homepageSceneProjectionCache.size > HOMEPAGE_SCENE_PROJECTION_CACHE_LIMIT) {
    const oldest = homepageSceneProjectionCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    homepageSceneProjectionCache.delete(oldest);
  }
  return projected;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`homepage TLE scene ${label} is not finite`);
  return value;
}

function positive(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) throw new Error(`homepage TLE scene ${label} must be positive`);
  return value;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

/**
 * Convert an SGP4 TEME position to a look-angle and the existing campus dome.
 *
 * TEME is first rotated to Earth-fixed coordinates at the point's own UTC
 * instant.  Only then are observer-relative look angles calculated.  The
 * resulting azimuth/elevation is passed through the established dome helper;
 * TEME axes are never treated as east/north/up axes.
 */
export function projectHomepageTleLook(
  positionTemeKm: Vector3,
  instantUtc: string,
): ProjectedLook {
  const instantMs = Date.parse(instantUtc);
  if (!Number.isFinite(instantMs)) throw new Error(`homepage TLE scene instantUtc is invalid: ${instantUtc}`);
  const observerGeometry = deriveObserverLinkGeometry(positionTemeKm, instantUtc);
  const azimuthDeg = observerGeometry.azimuthDeg;
  const elevationDeg = observerGeometry.elevationDeg;
  const rangeKm = positive(observerGeometry.rangeKm, 'rangeKm');
  const worldPosition = createWorldPosition(
    azimuthDeg,
    elevationDeg,
    SKY_DOME_H_RADIUS,
    SKY_DOME_V_RADIUS,
  );
  const world = freeze([worldPosition.x, worldPosition.y, worldPosition.z] as const);
  return {
    look: freeze({ azimuthDeg, elevationDeg, rangeKm, visible: elevationDeg >= 0 }),
    worldPosition: world,
  };
}

function projectSatellite(
  satellite: PropagatedSatelliteState,
  role: HomepageTleSceneSatelliteRole,
  instantUtc = satellite.requestedInstantUtc,
): HomepageTleSceneSatellite {
  const projected = projectHomepageTleLook(satellite.positionTemeKm, instantUtc);
  return freeze({
    satelliteId: satellite.satelliteId,
    satelliteName: satellite.satelliteName,
    role,
    worldPosition: projected.worldPosition,
    positionTemeKm: satellite.positionTemeKm,
    velocityTemeKmPerSec: satellite.velocityTemeKmPerSec,
    look: projected.look,
    tleEpochUtc: satellite.tleEpochUtc,
    sourcePath: satellite.sourcePath,
  });
}

function contextLimit(value: number | undefined): number {
  const limit = value ?? HOMEPAGE_TLE_DEFAULT_CONTEXT_LIMIT;
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError('homepage TLE scene contextLimit must be a non-negative integer');
  return limit;
}

/** Build the bounded campus projection from one accepted immutable analysis frame. */
export function adaptSimulationAnalysisFrameToHomepageTleScene(
  frame: SimulationAnalysisFrame,
  options: HomepageTleSceneAdapterOptions = {},
): HomepageTleSceneFrame {
  const limit = contextLimit(options.contextLimit);
  const retainSatelliteIds = normalizedRetainSatelliteIds(options.retainSatelliteIds);
  const retained = new Set(retainSatelliteIds);
  const cached = cachedSceneProjection(frame, limit, retainSatelliteIds);
  if (cached !== null) return cached;
  const tleState = frame.tleState;
  const selectedId = tleState.selectedSatelliteId;
  const candidateId = tleState.candidateSatellite?.satelliteId ?? null;
  const propagated = tleState.propagationFrame.satellites;
  const projectedById = new Map<string, HomepageTleSceneSatellite>();

  for (const satellite of propagated) {
    const role = satellite.satelliteId === selectedId
      ? 'selected'
      : satellite.satelliteId === candidateId
        ? 'candidate'
        : 'context';
    projectedById.set(satellite.satelliteId, projectSatellite(satellite, role));
  }

  const selected = projectedById.get(selectedId);
  if (selected === undefined) throw new Error(`homepage TLE scene missing selected satellite ${selectedId}`);
  const candidate = candidateId === null ? null : projectedById.get(candidateId) ?? null;
  if (candidateId !== null && candidate === null) {
    throw new Error(`homepage TLE scene missing candidate satellite ${candidateId}`);
  }

  const contextSatellites = [...projectedById.values()]
    .filter(satellite => (
      satellite.role === 'context'
      && (satellite.look.visible || retained.has(satellite.satelliteId))
    ))
    .sort((left, right) => (
      Number(retained.has(right.satelliteId)) - Number(retained.has(left.satelliteId))
      || right.look.elevationDeg - left.look.elevationDeg
      || left.satelliteId.localeCompare(right.satelliteId)
    ))
    .filter((satellite, index) => retained.has(satellite.satelliteId) || index < limit);
  const selectedTrajectory = tleState.trajectory.map(point => {
    const projected = projectHomepageTleLook(point.positionTemeKm, point.instantUtc);
    return freeze({
      instantUtc: point.instantUtc,
      positionTemeKm: point.positionTemeKm,
      worldPosition: projected.worldPosition,
      look: projected.look,
    });
  });
  const satellites = freeze([
    selected,
    ...(candidate === null ? [] : [candidate]),
    ...contextSatellites,
  ]);
  const identity = freeze({
    frameId: frame.frameId,
    tleFrameId: frame.tleFrameId,
    requestedInstantUtc: frame.instantUtc,
    instantTaipei: frame.instantTaipei,
    constellation: frame.provenance.constellation,
    archiveDate: tleState.archiveDate,
    selectedSatelliteId: selected.satelliteId,
    candidateSatelliteId: candidate?.satelliteId ?? null,
    sourceKind: frame.provenance.sourceKind,
    propagationModel: frame.provenance.propagationModel,
  });
  const telemetry = freeze({
    propagatedSatelliteCount: propagated.length,
    renderedSatelliteCount: satellites.length,
    visibleContextSatelliteCount: contextSatellites.length,
    selectedTrajectoryPointCount: selectedTrajectory.length,
    selectedElevationDeg: selected.look.elevationDeg,
    selectedAzimuthDeg: selected.look.azimuthDeg,
    selectedRangeKm: selected.look.rangeKm,
    candidateElevationDeg: candidate?.look.elevationDeg ?? null,
  });
  return rememberSceneProjection(frame, limit, retainSatelliteIds, deepFreeze({
    frameId: frame.frameId,
    tleFrameId: frame.tleFrameId,
    instantUtc: frame.instantUtc,
    constellation: frame.provenance.constellation,
    identity,
    selected,
    candidate: candidate ?? null,
    contextSatellites,
    satellites,
    selectedTrajectory: freeze(selectedTrajectory),
    telemetry,
    earthSphere: false,
    handoverDecision: frame.handover?.state ?? 'not-in-frame',
  }));
}

export const createHomepageTleSceneFrame = adaptSimulationAnalysisFrameToHomepageTleScene;
