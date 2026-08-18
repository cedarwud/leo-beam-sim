import {
  eciToEcf,
  eciToGeodetic,
  geodeticToEcf,
  gstime,
  radiansToDegrees,
  type EciVec3,
} from 'satellite.js';
import { deriveObserverLinkGeometry, NTPU_TLE_OBSERVER } from '../../simulator/observer';
import { propagateTleSnapshot } from '../../tle/propagation';
import { resolveTleSnapshot } from '../../tle/resolver';
import { utcToAsiaTaipei } from '../../tle/timezone';
import type {
  ResolvedTleSnapshot,
  TleArchiveManifest,
  Vector3,
} from '../../tle/types';
import type { SimulationAnalysisFrame } from '../../simulator/types';

/** The globe intentionally uses a small, stable visual radius. */
export const VISUAL_LAB_EARTH_RADIUS = 2.48;
export const VISUAL_LAB_EARTH_RADIUS_KM = 6_378.137;
export const VISUAL_LAB_GLOBAL_CONTEXT_LIMIT = 96;
const TRAJECTORY_HALF_WINDOW_SEC = 30 * 60;
const TRAJECTORY_STEP_SEC = 5 * 60;

/**
 * The timeline clock advances in 250 ms presentation ticks while the
 * accepted TLE frame changes only on the 30 s anchor axis. Keep the last
 * projection so fractional ticks do not re-run geometry for the full
 * catalogue. This is intentionally a one-entry cache to bound memory.
 */
let lastGlobalProjection: {
  readonly frame: SimulationAnalysisFrame;
  readonly key: string;
  readonly value: VisualLabGlobalSceneFrame;
} | null = null;

export type VisualLabGlobalPoint = readonly [number, number, number];
export type VisualLabGlobalSatelliteRole = 'serving' | 'candidate' | 'visible-context' | 'context';

export interface VisualLabGlobalSatellite {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly role: VisualLabGlobalSatelliteRole;
  readonly visibleFromNtpu: boolean;
  readonly elevationDeg: number;
  readonly positionTemeKm: Vector3;
  /** Earth-fixed display coordinate; the TEME state remains the source truth. */
  readonly positionWorld: VisualLabGlobalPoint;
  readonly tleEpochUtc: string;
  readonly sourcePath: string;
}

export interface VisualLabGlobalTrajectoryPoint {
  readonly instantUtc: string;
  readonly positionTemeKm: Vector3;
  readonly positionWorld: VisualLabGlobalPoint;
}

export interface VisualLabGlobalObserver {
  readonly id: 'NTPU';
  readonly label: string;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly positionWorld: VisualLabGlobalPoint;
}

/**
 * Run-level source identity supplied by the accepted-run owner.  The render
 * frame may be a later timeline anchor, so the current frame instant alone is
 * not enough to explain which requested instant was accepted/published.
 */
export interface VisualLabGlobalSourceIdentity {
  readonly requestedConstellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly requestedInstantUtc: string;
  readonly acceptedConstellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly acceptedInstantUtc: string;
}

export interface VisualLabGlobalSceneAdapterOptions {
  readonly contextLimit?: number;
  readonly sourceIdentity?: VisualLabGlobalSourceIdentity;
}

/**
 * Closed render DTO for the global view.  It deliberately contains no
 * canonical formula values and no generated orbital parameters.  Every
 * satellite/trajectory coordinate is projected from one accepted immutable
 * SimulationAnalysisFrame.
 */
export interface VisualLabGlobalSceneFrame {
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly instantUtc: string;
  readonly instantTaipei: string;
  readonly requestedConstellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly requestedInstantUtc: string;
  readonly acceptedConstellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly acceptedInstantUtc: string;
  readonly acceptedInstantTaipei: string;
  readonly constellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly archiveDate: string;
  readonly archiveId: string;
  readonly selectedTleEpochUtc: string;
  readonly selectedSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly selected: VisualLabGlobalSatellite;
  readonly candidate: VisualLabGlobalSatellite | null;
  readonly satellites: readonly VisualLabGlobalSatellite[];
  readonly visibleContextSatellites: readonly VisualLabGlobalSatellite[];
  readonly selectedTrajectory: readonly VisualLabGlobalTrajectoryPoint[];
  readonly candidateTrajectory: readonly VisualLabGlobalTrajectoryPoint[];
  readonly observer: VisualLabGlobalObserver;
  readonly propagatedSatelliteCount: number;
  readonly ntpuVisibleSatelliteCount: number;
  readonly sourceKind: SimulationAnalysisFrame['provenance']['sourceKind'];
  readonly propagationModel: SimulationAnalysisFrame['provenance']['propagationModel'];
  readonly isMock: false;
}

interface EarthFixedPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
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

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`visual-lab global ${label} must be finite`);
  return value;
}

function validUtc(instantUtc: string, label: string): number {
  const instantMs = Date.parse(instantUtc);
  if (!Number.isFinite(instantMs)) throw new Error(`visual-lab global ${label} is invalid: ${instantUtc}`);
  return instantMs;
}

function earthFixedToWorld(point: EarthFixedPoint): VisualLabGlobalPoint {
  // ECF z is geographic up.  Three.js y is kept as up and the ECF y axis is
  // mirrored into the scene z axis so longitude remains visually readable.
  const scale = VISUAL_LAB_EARTH_RADIUS / VISUAL_LAB_EARTH_RADIUS_KM;
  return freeze([
    finite(point.x, 'ECF x') * scale,
    finite(point.z, 'ECF z') * scale,
    -finite(point.y, 'ECF y') * scale,
  ] as const);
}

function earthFixedPosition(positionTemeKm: Vector3, instantUtc: string): EarthFixedPoint {
  const instantMs = validUtc(instantUtc, 'instantUtc');
  const ecf = eciToEcf(
    positionTemeKm as EciVec3<number>,
    gstime(new Date(instantMs)),
  );
  return { x: ecf.x, y: ecf.y, z: ecf.z };
}

function worldPositionForTeme(positionTemeKm: Vector3, instantUtc: string): VisualLabGlobalPoint {
  return earthFixedToWorld(earthFixedPosition(positionTemeKm, instantUtc));
}

function worldPositionForObserver(): VisualLabGlobalPoint {
  const ecf = geodeticToEcf({
    latitude: NTPU_TLE_OBSERVER.latitudeDeg * Math.PI / 180,
    longitude: NTPU_TLE_OBSERVER.longitudeDeg * Math.PI / 180,
    height: NTPU_TLE_OBSERVER.heightKm,
  });
  return earthFixedToWorld({ x: ecf.x, y: ecf.y, z: ecf.z });
}

function trajectoryForSnapshot(
  snapshot: ResolvedTleSnapshot,
  requestedInstantUtc: string,
  sourceInstants?: readonly string[],
): readonly VisualLabGlobalTrajectoryPoint[] {
  const requestedMs = validUtc(requestedInstantUtc, 'requestedInstantUtc');
  const points: VisualLabGlobalTrajectoryPoint[] = [];
  const instants = sourceInstants ?? Array.from(
    { length: Math.floor((TRAJECTORY_HALF_WINDOW_SEC * 2) / TRAJECTORY_STEP_SEC) + 1 },
    (_unused, index) => new Date(
      requestedMs + (-TRAJECTORY_HALF_WINDOW_SEC + index * TRAJECTORY_STEP_SEC) * 1_000,
    ).toISOString(),
  );
  for (const instantUtc of instants) {
    const propagated = propagateTleSnapshot(snapshot, instantUtc);
    points.push(freeze({
      instantUtc,
      positionTemeKm: propagated.positionTemeKm,
      positionWorld: worldPositionForTeme(propagated.positionTemeKm, instantUtc),
    }));
  }
  return freeze(points);
}

function snapshotManifest(frame: SimulationAnalysisFrame): TleArchiveManifest {
  const tleState = frame.tleState;
  return freeze({
    entries: tleState.archiveSnapshot.entries,
    maxPropagationAgeMs: tleState.catalog.maxPropagationAgeMs,
    archiveId: tleState.catalog.archiveId,
  });
}

function candidateSnapshot(frame: SimulationAnalysisFrame): ResolvedTleSnapshot | null {
  const candidateId = frame.tleState.candidateSatellite?.satelliteId;
  if (candidateId === undefined) return null;
  // Resolve only against the already accepted publication retained by the
  // frame.  This cannot mix another archive publication into the render DTO.
  return resolveTleSnapshot(
    snapshotManifest(frame),
    frame.instantUtc,
    candidateId,
    { maxPropagationAgeMs: frame.tleState.catalog.maxPropagationAgeMs },
  );
}

function roleForSatellite(
  satelliteId: string,
  selectedSatelliteId: string,
  candidateSatelliteId: string | null,
  visible: boolean,
): VisualLabGlobalSatelliteRole {
  if (satelliteId === selectedSatelliteId) return 'serving';
  if (candidateSatelliteId !== null && satelliteId === candidateSatelliteId) return 'candidate';
  return visible ? 'visible-context' : 'context';
}

/**
 * Adapt one complete archived-TLE/SGP4 frame.  This adapter is pure with
 * respect to application state: it never selects a satellite or invents a
 * fallback when the accepted frame is missing.
 */
export function adaptSimulationAnalysisFrameToVisualLabGlobalScene(
  frame: SimulationAnalysisFrame,
  options: VisualLabGlobalSceneAdapterOptions = {},
): VisualLabGlobalSceneFrame {
  if (frame.provenance.sourceKind !== 'ARCHIVED_TLE') {
    throw new Error('visual-lab global view requires an ARCHIVED_TLE frame');
  }
  if (frame.provenance.propagationModel !== 'SGP4') {
    throw new Error('visual-lab global view requires an SGP4 frame');
  }
  const contextLimit = options.contextLimit ?? VISUAL_LAB_GLOBAL_CONTEXT_LIMIT;
  if (!Number.isInteger(contextLimit) || contextLimit < 0) {
    throw new RangeError('visual-lab global contextLimit must be a non-negative integer');
  }
  const tleState = frame.tleState;
  const selectedId = frame.selectedSatelliteId;
  const candidateId = tleState.candidateSatellite?.satelliteId ?? null;
  const instantUtc = frame.instantUtc;
  validUtc(instantUtc, 'frame instantUtc');
  const sourceIdentity = options.sourceIdentity;
  const requestedConstellation = sourceIdentity?.requestedConstellation ?? frame.provenance.constellation;
  const requestedInstantUtc = sourceIdentity?.requestedInstantUtc ?? tleState.requestedInstantUtc;
  const acceptedConstellation = sourceIdentity?.acceptedConstellation ?? frame.provenance.constellation;
  const acceptedInstantUtc = sourceIdentity?.acceptedInstantUtc ?? tleState.requestedInstantUtc;
  const projectionKey = [
    contextLimit,
    requestedConstellation,
    requestedInstantUtc,
    acceptedConstellation,
    acceptedInstantUtc,
  ].join('|');
  if (lastGlobalProjection?.frame === frame && lastGlobalProjection.key === projectionKey) {
    return lastGlobalProjection.value;
  }
  if (acceptedConstellation !== frame.provenance.constellation) {
    throw new Error('visual-lab global accepted constellation does not match the frame');
  }
  validUtc(requestedInstantUtc, 'requested source instantUtc');
  validUtc(acceptedInstantUtc, 'accepted source instantUtc');

  const satellites = tleState.propagationFrame.satellites.map((satellite) => {
    const geometry = deriveObserverLinkGeometry(satellite.positionTemeKm, instantUtc);
    return freeze({
      satelliteId: satellite.satelliteId,
      satelliteName: satellite.satelliteName,
      role: roleForSatellite(satellite.satelliteId, selectedId, candidateId, geometry.visible),
      visibleFromNtpu: geometry.visible,
      elevationDeg: finite(geometry.elevationDeg, `${satellite.satelliteId} elevation`),
      positionTemeKm: satellite.positionTemeKm,
      positionWorld: worldPositionForTeme(satellite.positionTemeKm, instantUtc),
      tleEpochUtc: satellite.tleEpochUtc,
      sourcePath: satellite.sourcePath,
    });
  });
  const selected = satellites.find((satellite) => satellite.satelliteId === selectedId);
  if (selected === undefined) throw new Error(`visual-lab global frame is missing selected satellite ${selectedId}`);
  const candidate = candidateId === null
    ? null
    : satellites.find((satellite) => satellite.satelliteId === candidateId) ?? null;
  if (candidateId !== null && candidate === null) {
    throw new Error(`visual-lab global frame is missing candidate satellite ${candidateId}`);
  }

  const visibleContextSatellites = satellites
    .filter((satellite) => satellite.role === 'visible-context')
    .sort((left, right) => right.elevationDeg - left.elevationDeg || left.satelliteId.localeCompare(right.satelliteId))
    .slice(0, contextLimit);
  const candidateTle = candidateSnapshot(frame);
  const selectedTrajectory = tleState.trajectory.map((point) => freeze({
    instantUtc: point.instantUtc,
    positionTemeKm: point.positionTemeKm,
    positionWorld: worldPositionForTeme(point.positionTemeKm, point.instantUtc),
  }));
  const candidateTrajectory = candidateTle === null
    ? []
    : trajectoryForSnapshot(candidateTle, instantUtc, selectedTrajectory.map((point) => point.instantUtc));
  const observer = freeze({
    id: 'NTPU' as const,
    label: NTPU_TLE_OBSERVER.label,
    latitudeDeg: NTPU_TLE_OBSERVER.latitudeDeg,
    longitudeDeg: NTPU_TLE_OBSERVER.longitudeDeg,
    positionWorld: worldPositionForObserver(),
  });
  const ntpuVisibleSatelliteCount = satellites.filter((satellite) => satellite.visibleFromNtpu).length;

  const projected = deepFreeze({
    frameId: frame.frameId,
    tleFrameId: frame.tleFrameId,
    instantUtc,
    instantTaipei: frame.instantTaipei,
    requestedConstellation,
    requestedInstantUtc,
    acceptedConstellation,
    acceptedInstantUtc,
    acceptedInstantTaipei: utcToAsiaTaipei(acceptedInstantUtc),
    constellation: frame.provenance.constellation,
    archiveDate: tleState.archiveDate,
    archiveId: frame.provenance.archiveId,
    selectedTleEpochUtc: frame.provenance.selectedTleEpochUtc,
    selectedSatelliteId: selectedId,
    candidateSatelliteId: candidateId,
    selected,
    candidate,
    satellites: freeze(satellites),
    visibleContextSatellites: freeze(visibleContextSatellites),
    selectedTrajectory: freeze(selectedTrajectory),
    candidateTrajectory,
    observer,
    propagatedSatelliteCount: satellites.length,
    ntpuVisibleSatelliteCount,
    sourceKind: frame.provenance.sourceKind,
    propagationModel: frame.provenance.propagationModel,
    isMock: false as const,
  });
  lastGlobalProjection = { frame, key: projectionKey, value: projected };
  return projected;
}

export const createVisualLabGlobalSceneFrame = adaptSimulationAnalysisFrameToVisualLabGlobalScene;

/** Useful for tests and provenance labels without exposing satellite.js types. */
export function geodeticForVisualLabGlobalPosition(
  positionTemeKm: Vector3,
  instantUtc: string,
): { readonly latitudeDeg: number; readonly longitudeDeg: number; readonly altitudeKm: number } {
  const instantMs = validUtc(instantUtc, 'instantUtc');
  const geodetic = eciToGeodetic(positionTemeKm as EciVec3<number>, gstime(new Date(instantMs)));
  return freeze({
    latitudeDeg: radiansToDegrees(geodetic.latitude),
    longitudeDeg: radiansToDegrees(geodetic.longitude),
    altitudeKm: geodetic.height,
  });
}
