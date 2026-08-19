import type {
  CanonicalTleHandoverAnchorTrace,
  CanonicalTleHandoverEvent,
  CanonicalTleHandoverState,
} from '../../simulator/canonicalTleHandover';
import { NTPU_TLE_OBSERVER } from '../../simulator/observer';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  type SimulationAnalysisFrame,
} from '../../simulator/types';
import {
  buildArchivedTleSevenCellPlacement,
  remapArchivedTleUePosition,
} from '../../scene/archivedTleSevenCellPlacement';
import {
  adaptSimulationAnalysisFrameToHomepageTleScene,
  projectHomepageTleLook,
  type HomepageTleSceneFrame,
  type HomepageTleSceneSatellite,
  type HomepageTleSceneTrajectoryPoint,
} from '../../scene/homepageTleSceneAdapter';
import { interpolateHomepageTleSceneFrame } from '../../scene/homepageTleVisualInterpolation';
import { createInterpolatedTopo } from '../../scene/simulationHelpers';
import type { PropagatedSatelliteState, Vector3 } from '../../tle/types';

/**
 * Pure read-model boundary for the Visual Lab's near/NTPU scene.
 *
 * Satellite identity and geometry are projected from an accepted archived-TLE
 * `SimulationAnalysisFrame`.  The canonical seven-cell/100-UE map is exposed
 * only as an explicitly labelled display substrate; it does not produce TLE,
 * handover, SINR, or link-budget truth.  A consumer may render this plan,
 * while another adapter supplies the metrics from the same frame.
 */
export const VISUAL_LAB_LOCAL_SCENE_SCHEMA = 'visual-lab-local-scene-v1' as const;
/**
 * Closed, display-only state projected beside the local scene geometry.
 *
 * The values in this DTO are not a second link-budget implementation.  The
 * canonical frame already contains the authoritative power, interference,
 * and parameter values; the adapter only normalizes those values for visual
 * affordances such as cone width, opacity, and the reuse palette.
 */
export const VISUAL_LAB_LOCAL_RENDER_SCHEMA = 'visual-lab-local-render-v1' as const;
export const VISUAL_LAB_LOCAL_DEFAULT_CONTEXT_LIMIT = 24;
export const VISUAL_LAB_LOCAL_DEFAULT_GROUND_WORLD_UNITS_PER_KM = 0.04;
/**
 * One common display scale for every archived-TLE constellation and role.
 *
 * This is a visual unit conversion only: the source geometry remains the
 * accepted NTPU topocentric ENU vector in kilometres.  The local projection
 * uses the vector direction and its source range, so a higher shell/range is
 * not collapsed onto the fixed homepage sky dome.  No Starlink/OneWeb branch
 * or constellation-specific height is applied here.
 */
export const VISUAL_LAB_LOCAL_TOPOCENTRIC_WORLD_UNITS_PER_KM = 0.0125;
/**
 * Smooth display-only radial bound for the near scene.  The monotonic tanh
 * compression keeps any finite accepted range inside the camera-readable
 * stage while preserving ordering between comparable ranges.
 */
export const VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD = 15;

export type VisualLabLocalPoint = readonly [number, number, number];
export type VisualLabLocalAvailability = 'available' | 'unavailable';
export type VisualLabLocalSatelliteRole = 'serving' | 'candidate' | 'context';

export interface VisualLabLocalLook {
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
  readonly visible: boolean;
}

export interface VisualLabLocalTopocentric {
  readonly eastKm: number;
  readonly northKm: number;
  readonly upKm: number;
  readonly rangeKm: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
}

export interface VisualLabLocalSatellite {
  readonly availability: 'available';
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly role: VisualLabLocalSatelliteRole;
  /** Bounded NTPU ENU projection: east → +X, up → +Y, north → −Z. */
  readonly positionWorld: VisualLabLocalPoint;
  /** Unmodified physical SGP4 state, retained beside the display projection. */
  readonly positionTemeKm: Vector3;
  readonly velocityTemeKmPerSec: Vector3;
  /** Observer-relative ENU/topocentric geometry derived by the shared helper. */
  readonly topocentric: VisualLabLocalTopocentric;
  readonly look: VisualLabLocalLook;
  readonly visibleFromNtpu: boolean;
  readonly tleEpochUtc: string;
  readonly sourcePath: string;
}

export interface VisualLabLocalUnavailableCandidate {
  readonly availability: 'unavailable';
  readonly role: 'candidate';
  /** Retained when the accepted frame knows an identity but no pose. */
  readonly satelliteId: string | null;
  readonly reason: string;
}

export type VisualLabLocalCandidate = VisualLabLocalSatellite | VisualLabLocalUnavailableCandidate;

export interface VisualLabLocalTrajectoryPoint {
  readonly instantUtc: string;
  readonly positionTemeKm: Vector3;
  /** Bounded NTPU ENU projection; local Y is apparent up, not orbital altitude. */
  readonly positionWorld: VisualLabLocalPoint;
  readonly topocentric: VisualLabLocalTopocentric;
  readonly look: VisualLabLocalLook;
}

export interface VisualLabLocalServingTrajectory {
  readonly availability: 'available';
  readonly role: 'serving';
  readonly satelliteId: string;
  readonly points: readonly VisualLabLocalTrajectoryPoint[];
  readonly source: {
    readonly kind: 'frame.tleState.trajectory';
    readonly frameId: string;
    readonly tleFrameId: string;
    /** The selected path is retained by the source frame; pose tweening is separate. */
    readonly visualPoseInterpolation: boolean;
  };
}

export interface VisualLabLocalUnavailableTrajectory {
  readonly availability: 'unavailable';
  readonly role: 'candidate' | 'context';
  readonly satelliteId: string | null;
  readonly points: readonly [];
  readonly reason: string;
}

export interface VisualLabLocalInterpolationSource {
  readonly mode: 'single-accepted-frame' | 'between-accepted-frames';
  readonly source: 'accepted-frame' | 'homepageTleVisualInterpolation';
  readonly currentFrameId: string;
  readonly currentTleFrameId: string;
  readonly nextFrameId: string | null;
  readonly nextTleFrameId: string | null;
  readonly visualOffsetSec: number | null;
  readonly reason: string | null;
}

export interface VisualLabLocalCell {
  readonly index: number;
  readonly q: number;
  readonly r: number;
  readonly centerKm: readonly [number, number];
  /** Display-only NTPU local ENU projection: east → +X, north → −Z. */
  readonly positionWorld: VisualLabLocalPoint;
  readonly color: number;
  readonly userCount: number;
}

export interface VisualLabLocalUser {
  readonly index: number;
  readonly cellIndex: number;
  readonly cellLocalIndex: number;
  readonly positionKm: readonly [number, number];
  /** Display-only NTPU local ENU projection: east → +X, north → −Z. */
  readonly positionWorld: VisualLabLocalPoint;
}

export interface VisualLabLocalSubstrate {
  readonly availability: VisualLabLocalAvailability;
  readonly kind: 'canonical-seven-cell-experimental-display-substrate';
  readonly coordinateFrame: 'NTPU-local-ENU-km';
  /** Source topology value; renderers must not choose a second cell radius. */
  readonly cellRadiusKm: number;
  readonly worldUnitsPerKm: number;
  readonly cells: readonly VisualLabLocalCell[];
  readonly users: readonly VisualLabLocalUser[];
  readonly sourceScenarioId: SimulationAnalysisFrame['scenario']['scenarioId'] | null;
  readonly reason: string | null;
}

export interface VisualLabLocalRepresentativeProjection {
  readonly availability: 'available';
  readonly user: {
    readonly index: number;
    readonly userId: string;
    readonly cellIndex: number;
    readonly positionKm: readonly [number, number];
    readonly positionWorld: VisualLabLocalPoint;
  };
  readonly cell: {
    readonly index: number;
    readonly centerKm: readonly [number, number];
    readonly positionWorld: VisualLabLocalPoint;
    readonly color: number;
    readonly userCount: number;
  };
  readonly servingBeam: {
    readonly beamId: number;
    readonly satelliteId: string;
    readonly cellIndex: number;
    readonly targetPositionWorld: VisualLabLocalPoint;
    readonly source: 'frame.links[0]';
  };
  readonly source: 'frame.links[0] + frame.scenario.users + frame.scenario.cells';
  readonly reason: null;
}

export interface VisualLabLocalUnavailableRepresentativeProjection {
  readonly availability: 'unavailable';
  readonly user: null;
  readonly cell: null;
  readonly servingBeam: null;
  readonly source: 'frame.links[0] + frame.scenario.users + frame.scenario.cells';
  readonly reason: string;
}

export type VisualLabLocalRepresentativeProjectionView =
  | VisualLabLocalRepresentativeProjection
  | VisualLabLocalUnavailableRepresentativeProjection;

export interface VisualLabLocalActiveBeamTarget {
  readonly beamId: number;
  readonly satelliteId: string;
  readonly cellIndex: number;
  readonly targetPositionWorld: VisualLabLocalPoint;
  readonly source: 'frame.inputs.frame.beamActiveB + frame.scenario.cells';
  /**
   * Optional read-only beam aggregate from the same accepted canonical frame.
   * The scene may show this beside the footprint; it must never be rebuilt by
   * the renderer.  `sinrDb` is the mean of the served UE links in this beam,
   * while power/rate remain beam-level canonical values.
   */
  readonly metric: VisualLabLocalBeamMetric | null;
}

export interface VisualLabLocalBeamMetric {
  readonly beamId: number;
  readonly satelliteId: string;
  readonly userCount: number;
  readonly sinrDb: number | null;
  readonly actualPowerW: number | null;
  readonly totalRateBps: number | null;
  readonly totalPowerW: number | null;
  readonly source: 'frame.canonical.throughput/power';
}

export interface VisualLabLocalActiveBeamTargets {
  readonly availability: VisualLabLocalAvailability;
  /** Targets are the accepted canonical active mask resolved through the accepted scenario geometry. */
  readonly targets: readonly VisualLabLocalActiveBeamTarget[];
  readonly source: 'frame.inputs.frame.beamActiveB + frame.scenario.cells' | 'unavailable';
  readonly reason: string | null;
}

export interface VisualLabLocalConfiguredBeamTarget {
  readonly beamId: number;
  readonly satelliteId: string;
  readonly cellIndex: number;
  readonly targetPositionWorld: VisualLabLocalPoint;
  /** True when the accepted canonical frame assigns positive load to this configured beam. */
  readonly isLoaded: boolean;
  readonly source:
    | 'frame.scenario.beamLayout + frame.inputs.frame.beamActiveB + frame.scenario.cells'
    | 'frame.candidateScenario.beamLayout + frame.candidateScenario.beamActiveB + frame.candidateScenario.cells';
  readonly metric: VisualLabLocalBeamMetric | null;
}

export interface VisualLabLocalConfiguredBeamTargets {
  readonly availability: VisualLabLocalAvailability;
  /** All beams in the accepted layout, including configured beams with no UE load. */
  readonly targets: readonly VisualLabLocalConfiguredBeamTarget[];
  readonly source:
    | 'frame.scenario.beamLayout + frame.inputs.frame.beamActiveB + frame.scenario.cells'
    | 'unavailable';
  readonly reason: string | null;
}

export interface VisualLabLocalCandidateBeamTarget {
  readonly beamId: number;
  readonly satelliteId: string;
  readonly cellIndex: number;
  readonly targetPositionWorld: VisualLabLocalPoint;
  readonly source: 'frame.candidateScenario.beamActiveB + frame.candidateScenario.cells';
  /** Candidate data is available only for the selected comparison beam. */
  readonly metric: VisualLabLocalBeamMetric | null;
}

/**
 * Counterfactual candidate layout preview.  These beams never join the
 * serving-frame interference sum; they only expose the accepted candidate
 * scenario so the scene can compare heterogeneous 1/7/19 layouts honestly.
 */
export interface VisualLabLocalCandidateBeamLayout {
  readonly availability: VisualLabLocalAvailability;
  readonly layoutCount: number | null;
  readonly selectedBeamId: number | null;
  readonly targets: readonly VisualLabLocalCandidateBeamTarget[];
  /** Complete configured candidate layout used only by the display projection. */
  readonly displayTargets: readonly VisualLabLocalConfiguredBeamTarget[];
  readonly contributesToServingInterference: false;
  readonly source: 'frame.candidateScenario.beamActiveB + frame.candidateScenario.cells' | 'unavailable';
  readonly reason: string | null;
}

export interface VisualLabLocalRenderDto {
  readonly schemaVersion: typeof VISUAL_LAB_LOCAL_RENDER_SCHEMA;
  readonly sourceFrameId: string;
  readonly sourceTleFrameId: string;
  readonly beam: {
    /** Canonical full 3 dB beam width retained for provenance. */
    readonly theta3dbRad: number;
    /** Canonical representative-link off-axis angle; the renderer does not recompute it. */
    readonly offAxisAngleRad: number;
    /** Display-only cone scale; no physical angle is recomputed in the scene. */
    readonly coneWidthScale: number;
    /** Canonical serving-beam output retained for the visual intensity mapping. */
    readonly actualPowerW: number;
    readonly powerCapW: number;
    readonly powerUtilization: number;
    /** Display-only envelope for showing the selected power cap boundary. */
    readonly capBoundaryScale: number;
    readonly intensity: number;
    readonly powerLimited: boolean;
  };
  readonly interference: {
    /** Canonical values; the renderer never reconstructs interference. */
    readonly interferenceW: number;
    readonly noiseW: number;
    /** Display-only share used for a subtle interference halo. */
    readonly fraction: number;
    readonly intensity: number;
  };
  readonly energy: {
    /** Canonical system denominator for the accepted frame. */
    readonly systemPowerW: number;
    /** Canonical service-set throughput for the accepted frame. */
    readonly totalRateBps: number;
    /** Canonical instantaneous system EE for the accepted frame. */
    readonly instantaneousEeBitsPerJ: number;
    /** Monotonic display mappings only; exact values above remain authoritative. */
    readonly dataFlowIntensity: number;
    readonly efficiencyIntensity: number;
  };
  readonly reuse: {
    /** Canonical K_FR input. */
    readonly groups: number;
    /** Display palette group for each canonical cell, in cell order. */
    readonly groupByCell: readonly number[];
  };
}

export interface VisualLabLocalContext {
  readonly availability: VisualLabLocalAvailability;
  readonly satellites: readonly VisualLabLocalSatellite[];
  readonly limit: number;
  readonly reason: string | null;
}

export interface VisualLabLocalHandover {
  readonly availability: VisualLabLocalAvailability;
  readonly state: CanonicalTleHandoverState | null;
  readonly event: CanonicalTleHandoverEvent | null;
  /** Presentation-only latch for the first accepted frame after a commit. */
  readonly presentationPhase?: 'switch' | 'settled';
  readonly anchorIndex: number | null;
  readonly progressSec: number | null;
  readonly tttSec: number | null;
  readonly ratio: number | null;
  readonly servingSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly eventFromSatelliteId: string | null;
  readonly eventToSatelliteId: string | null;
  readonly reason: string | null;
}

export interface VisualLabLocalObserver {
  readonly id: 'NTPU';
  readonly label: string;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly heightKm: number;
  readonly coordinateFrame: 'NTPU-local-ENU';
}

export interface VisualLabLocalSourceIdentity {
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly instantUtc: string;
  readonly instantTaipei: string;
  readonly tleEpochUtc: string;
  readonly constellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly archiveId: string;
  readonly archiveDate: string;
  readonly selectedSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly selectedTlePath: string;
  readonly sourceKind: SimulationAnalysisFrame['provenance']['sourceKind'];
  readonly propagationModel: SimulationAnalysisFrame['provenance']['propagationModel'];
}

export interface VisualLabLocalScenePlan {
  readonly schemaVersion: typeof VISUAL_LAB_LOCAL_SCENE_SCHEMA;
  readonly isMock: false;
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly instantUtc: string;
  readonly instantTaipei: string;
  readonly constellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly source: VisualLabLocalSourceIdentity;
  readonly interpolation: VisualLabLocalInterpolationSource;
  readonly observer: VisualLabLocalObserver;
  readonly serving: VisualLabLocalSatellite;
  readonly candidate: VisualLabLocalCandidate;
  readonly context: VisualLabLocalContext;
  readonly satellites: readonly VisualLabLocalSatellite[];
  readonly trajectory: {
    readonly serving: VisualLabLocalServingTrajectory;
    readonly candidate: VisualLabLocalUnavailableTrajectory;
    readonly context: readonly VisualLabLocalUnavailableTrajectory[];
  };
  readonly substrate: VisualLabLocalSubstrate;
  readonly representative: VisualLabLocalRepresentativeProjectionView;
  readonly activeBeamTargets: VisualLabLocalActiveBeamTargets;
  readonly configuredBeamTargets: VisualLabLocalConfiguredBeamTargets;
  readonly candidateBeamLayout: VisualLabLocalCandidateBeamLayout;
  readonly render: VisualLabLocalRenderDto;
  readonly handover: VisualLabLocalHandover;
}

export interface VisualLabLocalSceneAdapterOptions {
  /** Number of visible non-serving/non-candidate states retained for display. */
  readonly contextLimit?: number;
  /** Display-only conversion for canonical local ENU ground coordinates. */
  readonly groundWorldUnitsPerKm?: number;
  /** Optional next completed accepted frame for bounded visual interpolation. */
  readonly visualNextFrame?: SimulationAnalysisFrame | null;
  /** Previous accepted frame, used only to keep a just-committed target blue for one anchor. */
  readonly visualPreviousFrame?: SimulationAnalysisFrame | null;
  /** Offset into current→next accepted-frame interval, in seconds. */
  readonly visualOffsetSec?: number;
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
  if (!Number.isFinite(value)) throw new RangeError(`visual-lab local ${label} must be finite`);
  return value;
}

function nonNegativeFinite(value: number, label: string): number {
  const next = finite(value, label);
  if (next < 0) throw new RangeError(`visual-lab local ${label} must be non-negative`);
  return next;
}

function positiveFinite(value: number, label: string): number {
  const next = finite(value, label);
  if (next <= 0) throw new RangeError(`visual-lab local ${label} must be positive`);
  return next;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Display-only ratio.  It deliberately consumes already-produced canonical
 * values and is not used by any scientific result or control path.
 */
function displayFraction(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return clampUnit(numerator / denominator);
}

function displayScale(value: number, reference: number, min: number, max: number): number {
  if (reference <= 0) return min;
  return Math.max(min, Math.min(max, value / reference));
}

function validUtc(value: string, label: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new RangeError(`visual-lab local ${label} is invalid: ${value}`);
  return milliseconds;
}

function contextLimit(value: number | undefined): number {
  const limit = value ?? VISUAL_LAB_LOCAL_DEFAULT_CONTEXT_LIMIT;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('visual-lab local contextLimit must be a non-negative integer');
  }
  return limit;
}

function groundWorldUnitsPerKm(value: number | undefined): number {
  const scale = value ?? VISUAL_LAB_LOCAL_DEFAULT_GROUND_WORLD_UNITS_PER_KM;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('visual-lab local groundWorldUnitsPerKm must be positive');
  }
  return scale;
}

function visualOffset(value: number | undefined): number {
  const offset = value ?? 0;
  if (!Number.isFinite(offset) || offset < 0) {
    throw new RangeError('visual-lab local visualOffsetSec must be non-negative and finite');
  }
  return offset;
}

function copyVector(value: Vector3): Vector3 {
  return freeze({
    x: finite(value.x, 'TEME x'),
    y: finite(value.y, 'TEME y'),
    z: finite(value.z, 'TEME z'),
  });
}

function localGroundWorldPosition(
  positionKm: readonly [number, number],
  scale: number,
): VisualLabLocalPoint {
  return freeze([
    finite(positionKm[0], 'ground east') * scale,
    0,
    -finite(positionKm[1], 'ground north') * scale,
  ] as const);
}

function localLook(
  satellite: HomepageTleSceneSatellite,
): VisualLabLocalLook {
  return freeze({
    azimuthDeg: finite(satellite.look.azimuthDeg, `${satellite.satelliteId} azimuth`),
    elevationDeg: finite(satellite.look.elevationDeg, `${satellite.satelliteId} elevation`),
    rangeKm: finite(satellite.look.rangeKm, `${satellite.satelliteId} range`),
    visible: satellite.look.visible,
  });
}

function localTopocentric(
  look: VisualLabLocalLook,
): VisualLabLocalTopocentric {
  const topo = createInterpolatedTopo(look.azimuthDeg, look.elevationDeg, look.rangeKm);
  return freeze({
    eastKm: finite(topo.eastKm, 'topocentric east'),
    northKm: finite(topo.northKm, 'topocentric north'),
    upKm: finite(topo.upKm, 'topocentric up'),
    rangeKm: finite(topo.rangeKm, 'topocentric range'),
    azimuthDeg: finite(topo.azimuthDeg, 'topocentric azimuth'),
    elevationDeg: finite(topo.elevationDeg, 'topocentric elevation'),
  });
}

/**
 * Map one accepted NTPU topocentric vector to the bounded local scene.
 *
 * The source range fixes the radial magnitude and the ENU components fix the
 * direction.  Thus a matched azimuth/elevation pair at a higher shell remains
 * visibly farther away, while local Y still means apparent vertical position:
 * `upKm = rangeKm * sin(elevationDeg)`.  That Y value depends on elevation as
 * well as range; it is deliberately not presented as orbital altitude.
 *
 * A single scale is applied to both Starlink and OneWeb.  A shared smooth
 * radial compression then bounds the display without making all shells share
 * one fixed dome radius or inventing a constellation-specific height.
 */
export function mapVisualLabLocalTopocentricToWorld(
  topocentric: Pick<VisualLabLocalTopocentric, 'eastKm' | 'northKm' | 'upKm' | 'rangeKm'>,
): VisualLabLocalPoint {
  const eastKm = finite(topocentric.eastKm, 'topocentric east');
  const northKm = finite(topocentric.northKm, 'topocentric north');
  const upKm = finite(topocentric.upKm, 'topocentric up');
  const rangeKm = positiveFinite(topocentric.rangeKm, 'topocentric range');
  const directionLengthKm = Math.hypot(eastKm, northKm, upKm);
  if (!Number.isFinite(directionLengthKm) || directionLengthKm <= 0) {
    throw new RangeError('visual-lab local topocentric direction must be non-zero');
  }

  const rawRadiusWorld = rangeKm * VISUAL_LAB_LOCAL_TOPOCENTRIC_WORLD_UNITS_PER_KM;
  if (!Number.isFinite(rawRadiusWorld)) {
    throw new RangeError('visual-lab local topocentric display radius must be finite');
  }
  const boundedRadiusWorld = VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD
    * Math.tanh(rawRadiusWorld / VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD);
  const directionScale = boundedRadiusWorld / directionLengthKm;
  return freeze([
    eastKm * directionScale,
    upKm * directionScale,
    -northKm * directionScale,
  ] as const);
}

function localSatellite(
  satellite: HomepageTleSceneSatellite,
  role: VisualLabLocalSatelliteRole,
): VisualLabLocalSatellite {
  const look = localLook(satellite);
  const topocentric = localTopocentric(look);
  return freeze({
    availability: 'available',
    satelliteId: satellite.satelliteId,
    satelliteName: satellite.satelliteName,
    role,
    positionWorld: mapVisualLabLocalTopocentricToWorld(topocentric),
    positionTemeKm: copyVector(satellite.positionTemeKm),
    velocityTemeKmPerSec: copyVector(satellite.velocityTemeKmPerSec),
    topocentric,
    look,
    visibleFromNtpu: look.visible,
    tleEpochUtc: satellite.tleEpochUtc,
    sourcePath: satellite.sourcePath,
  });
}

function localPropagatedSatellite(
  satellite: PropagatedSatelliteState,
  role: VisualLabLocalSatelliteRole,
  instantUtc: string,
): VisualLabLocalSatellite {
  const projected = projectHomepageTleLook(satellite.positionTemeKm, instantUtc);
  return localSatellite({
    satelliteId: satellite.satelliteId,
    satelliteName: satellite.satelliteName,
    role: 'context',
    worldPosition: projected.worldPosition,
    positionTemeKm: satellite.positionTemeKm,
    velocityTemeKmPerSec: satellite.velocityTemeKmPerSec,
    look: projected.look,
    tleEpochUtc: satellite.tleEpochUtc,
    sourcePath: satellite.sourcePath,
  }, role);
}

function localTrajectoryPoint(
  point: HomepageTleSceneTrajectoryPoint,
): VisualLabLocalTrajectoryPoint {
  const look = freeze({
    azimuthDeg: finite(point.look.azimuthDeg, `trajectory ${point.instantUtc} azimuth`),
    elevationDeg: finite(point.look.elevationDeg, `trajectory ${point.instantUtc} elevation`),
    rangeKm: finite(point.look.rangeKm, `trajectory ${point.instantUtc} range`),
    visible: point.look.visible,
  });
  const topocentric = localTopocentric(look);
  return freeze({
    instantUtc: point.instantUtc,
    positionTemeKm: copyVector(point.positionTemeKm),
    positionWorld: mapVisualLabLocalTopocentricToWorld(topocentric),
    topocentric,
    look,
  });
}

function candidateIdentity(frame: SimulationAnalysisFrame): string | null {
  return frame.tleState.candidateSatellite?.satelliteId
    ?? frame.candidateComparison.satelliteId;
}

function frameForHomepageProjection(
  frame: SimulationAnalysisFrame,
): { readonly frame: SimulationAnalysisFrame; readonly candidateMissingFromPropagation: boolean } {
  const candidateId = frame.tleState.candidateSatellite?.satelliteId;
  const candidateMissingFromPropagation = candidateId !== undefined
    && !frame.tleState.propagationFrame.satellites.some(item => item.satelliteId === candidateId);
  if (!candidateMissingFromPropagation) return { frame, candidateMissingFromPropagation: false };

  // A malformed/incomplete accepted frame must not make the visual adapter
  // invent a candidate pose.  Let the shared homepage adapter build the
  // serving/context projection, while this adapter exposes the candidate as
  // explicitly unavailable below.
  return {
    frame: {
      ...frame,
      tleState: {
        ...frame.tleState,
        candidateSatellite: null,
      },
    },
    candidateMissingFromPropagation: true,
  };
}

function assertArchivedTleFrame(frame: SimulationAnalysisFrame, label: string): void {
  if (frame.provenance.sourceKind !== 'ARCHIVED_TLE' || frame.provenance.propagationModel !== 'SGP4') {
    throw new Error(`visual-lab local ${label} requires an ARCHIVED_TLE/SGP4 frame`);
  }
  validUtc(frame.instantUtc, `${label} instantUtc`);
}

function visualSceneFrame(
  frame: SimulationAnalysisFrame,
  limit: number,
): { readonly scene: HomepageTleSceneFrame; readonly candidateMissingFromPropagation: boolean } {
  const projected = frameForHomepageProjection(frame);
  return {
    scene: adaptSimulationAnalysisFrameToHomepageTleScene(projected.frame, { contextLimit: limit }),
    candidateMissingFromPropagation: projected.candidateMissingFromPropagation,
  };
}

function mapInterpolation(
  frame: SimulationAnalysisFrame,
  current: HomepageTleSceneFrame,
  nextFrame: SimulationAnalysisFrame | null | undefined,
  limit: number,
  offsetSec: number,
): { readonly scene: HomepageTleSceneFrame; readonly source: VisualLabLocalInterpolationSource } {
  if (nextFrame === undefined || nextFrame === null) {
    return {
      scene: current,
      source: freeze({
        mode: 'single-accepted-frame',
        source: 'accepted-frame',
        currentFrameId: frame.frameId,
        currentTleFrameId: frame.tleFrameId,
        nextFrameId: null,
        nextTleFrameId: null,
        visualOffsetSec: null,
        reason: null,
      }),
    };
  }
  assertArchivedTleFrame(nextFrame, 'visualNextFrame');
  if (nextFrame.provenance.constellation !== frame.provenance.constellation) {
    throw new Error('visual-lab local visualNextFrame constellation must match the current frame');
  }
  const currentMs = validUtc(frame.instantUtc, 'frame instantUtc');
  const nextMs = validUtc(nextFrame.instantUtc, 'visualNextFrame instantUtc');
  if (nextMs < currentMs) {
    throw new Error('visual-lab local visualNextFrame must not precede the current frame');
  }
  if (nextMs === currentMs) {
    return {
      scene: current,
      source: freeze({
        mode: 'single-accepted-frame',
        source: 'accepted-frame',
        currentFrameId: frame.frameId,
        currentTleFrameId: frame.tleFrameId,
        nextFrameId: nextFrame.frameId,
        nextTleFrameId: nextFrame.tleFrameId,
        visualOffsetSec: null,
        reason: 'visualNextFrame has the same instant; no interpolation was needed',
      }),
    };
  }
  const nextProjected = visualSceneFrame(nextFrame, limit).scene;
  return {
    scene: interpolateHomepageTleSceneFrame(current, nextProjected, offsetSec),
    source: freeze({
      mode: 'between-accepted-frames',
      source: 'homepageTleVisualInterpolation',
      currentFrameId: frame.frameId,
      currentTleFrameId: frame.tleFrameId,
      nextFrameId: nextFrame.frameId,
      nextTleFrameId: nextFrame.tleFrameId,
      visualOffsetSec: offsetSec,
      reason: null,
    }),
  };
}

function mapSubstrate(
  frame: SimulationAnalysisFrame,
  scale: number,
): VisualLabLocalSubstrate {
  const placement = frame.scenario.cells.length === 7
    ? buildArchivedTleSevenCellPlacement({
        cells: frame.scenario.cells,
        sourceCellRadiusKm: finite(frame.scenario.topology.cellRadiusKm, 'scenario cell radius'),
      })
    : null;
  const cells = frame.scenario.cells.map(cell => {
    const displayed = placement?.cellByCanonicalId.get(cell.index);
    const centerKm = displayed?.centerKm ?? cell.centerKm;
    return freeze({
    index: cell.index,
    q: cell.q,
    r: cell.r,
    centerKm: freeze([centerKm[0], centerKm[1]] as [number, number]),
    positionWorld: localGroundWorldPosition(centerKm, scale),
    color: cell.color,
    userCount: cell.userCount,
  });
  });
  const users = frame.scenario.users.map(user => {
    const positionKm = placement === null
      ? user.positionKm
      : remapArchivedTleUePosition(placement, user);
    return freeze({
    index: user.index,
    cellIndex: user.cellIndex,
    cellLocalIndex: user.cellLocalIndex,
    positionKm: freeze([positionKm[0], positionKm[1]] as [number, number]),
    positionWorld: localGroundWorldPosition(positionKm, scale),
  });
  });
  const available = cells.length > 0 && users.length > 0;
  return freeze({
    availability: available ? 'available' : 'unavailable',
    kind: 'canonical-seven-cell-experimental-display-substrate',
    coordinateFrame: 'NTPU-local-ENU-km',
    cellRadiusKm: placement?.cells[0]?.radiusKm
      ?? finite(frame.scenario.topology.cellRadiusKm, 'scenario cell radius'),
    worldUnitsPerKm: scale,
    cells: freeze(cells),
    users: freeze(users),
    sourceScenarioId: frame.scenario?.scenarioId ?? null,
    reason: available ? null : 'accepted frame has no complete canonical cell/UE display substrate',
  });
}

function mapRepresentative(
  frame: SimulationAnalysisFrame,
  substrate: VisualLabLocalSubstrate,
): VisualLabLocalRepresentativeProjectionView {
  const link = frame.links[0];
  const source = 'frame.links[0] + frame.scenario.users + frame.scenario.cells' as const;
  if (link === undefined) {
    return freeze({
      availability: 'unavailable',
      user: null,
      cell: null,
      servingBeam: null,
      source,
      reason: 'accepted frame has no serving representative link',
    });
  }
  const user = substrate.users.find(item => item.index === link.userIndex);
  if (user === undefined) {
    return freeze({
      availability: 'unavailable',
      user: null,
      cell: null,
      servingBeam: null,
      source,
      reason: `frame.links[0] user ${link.userIndex} is absent from frame.scenario.users`,
    });
  }
  const cell = substrate.cells.find(item => item.index === user.cellIndex);
  if (cell === undefined) {
    return freeze({
      availability: 'unavailable',
      user: null,
      cell: null,
      servingBeam: null,
      source,
      reason: `representative UE cell ${user.cellIndex} is absent from frame.scenario.cells`,
    });
  }
  if (!Number.isInteger(link.beamId) || link.beamId !== cell.index) {
    return freeze({
      availability: 'unavailable',
      user: null,
      cell: null,
      servingBeam: null,
      source,
      reason: `frame.links[0] beam ${link.beamId} does not resolve to representative cell ${cell.index}`,
    });
  }
  return freeze({
    availability: 'available',
    user: {
      index: user.index,
      userId: link.userId,
      cellIndex: user.cellIndex,
      positionKm: user.positionKm,
      positionWorld: user.positionWorld,
    },
    cell: {
      index: cell.index,
      centerKm: cell.centerKm,
      positionWorld: cell.positionWorld,
      color: cell.color,
      userCount: cell.userCount,
    },
    servingBeam: {
      beamId: link.beamId,
      satelliteId: link.satelliteId,
      cellIndex: cell.index,
      targetPositionWorld: cell.positionWorld,
      source: 'frame.links[0]',
    },
    source,
    reason: null,
  });
}

function mapActiveBeamTargets(
  frame: SimulationAnalysisFrame,
  substrate: VisualLabLocalSubstrate,
): VisualLabLocalActiveBeamTargets {
  const activeMask = frame.inputs.frame.beamActiveB;
  if (activeMask.length !== frame.scenario.cells.length) {
    return freeze({
      availability: 'unavailable',
      targets: freeze([]),
      source: 'unavailable',
      reason: 'canonical active-beam mask does not match the accepted scenario layout',
    });
  }
  const targets: VisualLabLocalActiveBeamTarget[] = [];
  for (let beamId = 0; beamId < activeMask.length; beamId += 1) {
    if (activeMask[beamId] !== true) continue;
    const cell = substrate.cells.find(item => item.index === beamId);
    if (cell === undefined) {
      return freeze({
        availability: 'unavailable',
        targets: freeze([]),
        source: 'unavailable',
        reason: `canonical active beam ${beamId} has no accepted scenario target`,
      });
    }
    targets.push(freeze({
      beamId,
      satelliteId: frame.selectedSatelliteId,
      cellIndex: cell.index,
      targetPositionWorld: cell.positionWorld,
      source: 'frame.inputs.frame.beamActiveB + frame.scenario.cells',
      metric: mapBeamMetric(frame, frame.selectedSatelliteId, beamId),
    }));
  }
  if (targets.length === 0) {
    return freeze({
      availability: 'unavailable',
      targets: freeze([]),
      source: 'unavailable',
      reason: 'accepted canonical frame has no active beam target',
    });
  }
  return freeze({
    availability: 'available',
    targets: freeze(targets),
    source: 'frame.inputs.frame.beamActiveB + frame.scenario.cells',
    reason: null,
  });
}

function mapConfiguredBeamTargets(
  frame: SimulationAnalysisFrame,
  substrate: VisualLabLocalSubstrate,
): VisualLabLocalConfiguredBeamTargets {
  const activeMask = frame.inputs.frame.beamActiveB;
  const source = 'frame.scenario.beamLayout + frame.inputs.frame.beamActiveB + frame.scenario.cells' as const;
  if (activeMask.length !== frame.scenario.cells.length) {
    return freeze({
      availability: 'unavailable',
      targets: freeze([]),
      source: 'unavailable',
      reason: 'canonical active-beam mask does not match the accepted scenario layout',
    });
  }
  const targets: VisualLabLocalConfiguredBeamTarget[] = [];
  for (const scenarioCell of frame.scenario.cells) {
    const beamId = scenarioCell.index;
    if (!Number.isInteger(beamId) || beamId < 0 || beamId >= activeMask.length) {
      return freeze({
        availability: 'unavailable',
        targets: freeze([]),
        source: 'unavailable',
        reason: `configured beam ${beamId} is outside the accepted active-beam mask`,
      });
    }
    const cell = substrate.cells.find(item => item.index === beamId);
    if (cell === undefined) {
      return freeze({
        availability: 'unavailable',
        targets: freeze([]),
        source: 'unavailable',
        reason: `configured beam ${beamId} has no accepted scenario target`,
      });
    }
    const isLoaded = activeMask[beamId] === true;
    targets.push(freeze({
      beamId,
      satelliteId: frame.selectedSatelliteId,
      cellIndex: cell.index,
      targetPositionWorld: cell.positionWorld,
      isLoaded,
      source,
      metric: isLoaded ? mapBeamMetric(frame, frame.selectedSatelliteId, beamId) : null,
    }));
  }
  return freeze({
    availability: targets.length > 0 ? 'available' : 'unavailable',
    targets: freeze(targets),
    source: targets.length > 0 ? source : 'unavailable',
    reason: targets.length > 0 ? null : 'accepted scenario has no configured beam target',
  });
}

function meanFinite(values: readonly number[]): number | null {
  const finiteValues = values.filter(value => Number.isFinite(value));
  return finiteValues.length === 0
    ? null
    : finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function sumFinite(values: readonly number[]): number | null {
  const finiteValues = values.filter(value => Number.isFinite(value));
  return finiteValues.length === 0
    ? null
    : finiteValues.reduce((sum, value) => sum + value, 0);
}

/**
 * Build the per-beam badge payload without introducing a second calculation.
 * `sinrU`/`rateUBps` are user vectors, so the visible beam badge reports their
 * mean/sum for that beam; RF power is already published per beam by the
 * canonical power ledger.
 */
function mapBeamMetric(
  frame: SimulationAnalysisFrame,
  satelliteId: string,
  beamId: number,
): VisualLabLocalBeamMetric | null {
  const userIndices = frame.inputs.frame.servingBeamU
    .map((servingBeam, userIndex) => servingBeam === beamId ? userIndex : -1)
    .filter(userIndex => userIndex >= 0);
  const sinrLinear = userIndices
    .map(userIndex => frame.canonical.throughput.sinrU[userIndex] ?? NaN)
    .filter(value => Number.isFinite(value) && value >= 0)
    .map(value => 10 * Math.log10(Math.max(value, 1e-30)));
  const totalRateBps = userIndices.length === 0
    ? 0
    : sumFinite(userIndices.map(userIndex => frame.canonical.throughput.rateUBps[userIndex] ?? NaN));
  const actualPowerW = frame.canonical.power.pDlActualBW[beamId];
  const totalPowerW = frame.canonical.power.pTotBW[beamId];
  return freeze({
    beamId,
    satelliteId,
    userCount: userIndices.length,
    sinrDb: meanFinite(sinrLinear),
    actualPowerW: Number.isFinite(actualPowerW) ? actualPowerW : null,
    totalRateBps,
    totalPowerW: Number.isFinite(totalPowerW) ? totalPowerW : null,
    source: 'frame.canonical.throughput/power',
  });
}

function mapCandidateBeamLayout(
  frame: SimulationAnalysisFrame,
  substrate: VisualLabLocalSubstrate,
  scale: number,
): VisualLabLocalCandidateBeamLayout {
  const scenario = frame.candidateScenario;
  const link = frame.candidateLink;
  if (scenario === null || link === null || frame.candidateComparison.status !== 'available') {
    const reason = frame.candidateComparison.status === 'unavailable'
      ? frame.candidateComparison.reason
      : 'accepted frame has no candidate layout preview';
    return freeze({
      availability: 'unavailable',
      layoutCount: scenario?.beamLayout.beamCount ?? null,
      selectedBeamId: link?.beamId ?? null,
      targets: freeze([]),
      displayTargets: freeze([]),
      contributesToServingInterference: false,
      source: 'unavailable',
      reason,
    });
  }
  const source = 'frame.candidateScenario.beamActiveB + frame.candidateScenario.cells' as const;
  if (scenario.beamActiveB.length !== scenario.cells.length) {
    return freeze({
      availability: 'unavailable',
      layoutCount: scenario.beamLayout.beamCount,
      selectedBeamId: link.beamId,
      targets: freeze([]),
      displayTargets: freeze([]),
      contributesToServingInterference: false,
      source: 'unavailable',
      reason: 'candidate active-beam mask does not match its accepted scenario layout',
    });
  }
  const targets: VisualLabLocalCandidateBeamTarget[] = [];
  const displayTargets: VisualLabLocalConfiguredBeamTarget[] = [];
  const candidateDisplaySource = 'frame.candidateScenario.beamLayout + frame.candidateScenario.beamActiveB + frame.candidateScenario.cells' as const;
  for (const scenarioCell of scenario.cells) {
    const beamId = scenarioCell.index;
    if (!Number.isInteger(beamId) || beamId < 0 || beamId >= scenario.beamActiveB.length) {
      return freeze({
        availability: 'unavailable',
        layoutCount: scenario.beamLayout.beamCount,
        selectedBeamId: link.beamId,
        targets: freeze([]),
        displayTargets: freeze([]),
        contributesToServingInterference: false,
        source: 'unavailable',
        reason: `candidate beam ${beamId} is outside its accepted active-beam mask`,
      });
    }
    const cell = scenario.cells.find(item => item.index === beamId);
    if (cell === undefined) {
      return freeze({
        availability: 'unavailable',
        layoutCount: scenario.beamLayout.beamCount,
        selectedBeamId: link.beamId,
        targets: freeze([]),
        displayTargets: freeze([]),
        contributesToServingInterference: false,
        source: 'unavailable',
        reason: `candidate beam ${beamId} has no accepted scenario target`,
      });
    }
    const displayCell = substrate.cells.find(item => item.index === cell.index);
    const targetPositionWorld = displayCell?.positionWorld
      ?? localGroundWorldPosition(cell.centerKm, scale);
    const isLoaded = scenario.beamActiveB[beamId] === true;
    displayTargets.push(freeze({
      beamId,
      satelliteId: link.satelliteId,
      cellIndex: cell.index,
      targetPositionWorld,
      isLoaded,
      source: candidateDisplaySource,
      metric: isLoaded ? beamMetricFromCandidateLink(link, beamId) : null,
    }));
    if (isLoaded) {
      targets.push(freeze({
        beamId,
        satelliteId: link.satelliteId,
        cellIndex: cell.index,
        targetPositionWorld,
        source,
        metric: beamMetricFromCandidateLink(link, beamId),
      }));
    }
  }
  return freeze({
    availability: displayTargets.length > 0 ? 'available' : 'unavailable',
    layoutCount: scenario.beamLayout.beamCount,
    selectedBeamId: link.beamId,
    targets: freeze(targets),
    displayTargets: freeze(displayTargets),
    contributesToServingInterference: false,
    source: displayTargets.length > 0 ? source : 'unavailable',
    reason: displayTargets.length > 0 ? null : 'accepted candidate scenario has no configured beam target',
  });
}

function beamMetricFromCandidateLink(
  link: NonNullable<SimulationAnalysisFrame['candidateLink']>,
  beamId: number,
): VisualLabLocalBeamMetric | null {
  if (link.beamId !== beamId) return null;
  return freeze({
    beamId,
    satelliteId: link.satelliteId,
    userCount: 1,
    sinrDb: Number.isFinite(link.sinrDb) ? link.sinrDb : null,
    actualPowerW: Number.isFinite(link.actualPowerW) ? link.actualPowerW : null,
    totalRateBps: Number.isFinite(link.rateBps) ? link.rateBps : null,
    totalPowerW: Number.isFinite(link.actualPowerW) ? link.actualPowerW : null,
    source: 'frame.canonical.throughput/power',
  });
}

function mapRenderDto(
  frame: SimulationAnalysisFrame,
): VisualLabLocalRenderDto {
  const serving = frame.links[0];
  const theta3dbRad = finite(frame.parameters.theta3dbRad, 'parameters theta3dbRad');
  const offAxisAngleRad = nonNegativeFinite(serving?.offAxisAngleRad ?? 0, 'serving offAxisAngleRad');
  const powerCapW = finite(frame.parameters.beamPowerCapW, 'parameters beamPowerCapW');
  const frequencyReuse = finite(frame.parameters.frequencyReuse, 'parameters frequencyReuse');
  if (theta3dbRad <= 0 || powerCapW <= 0 || frequencyReuse < 1) {
    throw new RangeError('visual-lab local render parameters are outside the positive display domain');
  }

  const actualPowerW = nonNegativeFinite(serving?.actualPowerW ?? 0, 'serving actualPowerW');
  const signalW = nonNegativeFinite(serving?.signalW ?? 0, 'serving signalW');
  const interferenceW = nonNegativeFinite(serving?.interferenceW ?? 0, 'serving interferenceW');
  const noiseW = nonNegativeFinite(serving?.noiseW ?? 0, 'serving noiseW');
  const totalReceivedW = signalW + interferenceW + noiseW;
  const powerUtilization = displayFraction(actualPowerW, powerCapW);
  const capBoundaryScale = displayScale(
    powerCapW,
    DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW,
    .7,
    1.35,
  );
  const capPosition = clampUnit((capBoundaryScale - .7) / .65);
  const intensity = clampUnit(.28 + .58 * powerUtilization + .14 * capPosition);
  const interferenceFraction = displayFraction(interferenceW, totalReceivedW);
  const interferenceIntensity = interferenceFraction === 0
    ? 0
    : clampUnit(.12 + .88 * interferenceFraction);
  const systemPowerW = nonNegativeFinite(frame.power.systemPowerW, 'power systemPowerW');
  const totalRateBps = nonNegativeFinite(frame.throughput.totalRateBps, 'throughput totalRateBps');
  const instantaneousEeBitsPerJ = nonNegativeFinite(frame.ee.instantaneousBitsPerJ, 'EE instantaneousBitsPerJ');
  const groups = Math.max(1, Math.round(frequencyReuse));

  return deepFreeze({
    schemaVersion: VISUAL_LAB_LOCAL_RENDER_SCHEMA,
    sourceFrameId: frame.frameId,
    sourceTleFrameId: frame.tleFrameId,
    beam: {
      theta3dbRad,
      offAxisAngleRad,
      coneWidthScale: displayScale(
        theta3dbRad,
        DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad,
        .65,
        1.9,
      ),
      actualPowerW,
      powerCapW,
      powerUtilization,
      capBoundaryScale,
      intensity,
      powerLimited: serving?.powerLimited ?? false,
    },
    interference: {
      interferenceW,
      noiseW,
      fraction: interferenceFraction,
      intensity: interferenceIntensity,
    },
    energy: {
      systemPowerW,
      totalRateBps,
      instantaneousEeBitsPerJ,
      dataFlowIntensity: displayFraction(totalRateBps, totalRateBps + 5_000_000),
      efficiencyIntensity: displayFraction(instantaneousEeBitsPerJ, instantaneousEeBitsPerJ + 5_000_000),
    },
    reuse: {
      groups,
      groupByCell: frame.scenario.cells.map(cell => ((cell.color % groups) + groups) % groups),
    },
  } satisfies VisualLabLocalRenderDto);
}

function mapHandover(
  trace: CanonicalTleHandoverAnchorTrace | undefined,
  candidateId: string | null,
  presentationPhase: 'switch' | 'settled' = 'switch',
): VisualLabLocalHandover {
  if (trace === undefined) {
    return freeze({
      availability: 'unavailable',
      state: null,
      event: null,
      presentationPhase,
      anchorIndex: null,
      progressSec: null,
      tttSec: null,
      ratio: null,
      servingSatelliteId: null,
      candidateSatelliteId: candidateId,
      eventFromSatelliteId: null,
      eventToSatelliteId: null,
      reason: 'accepted frame has no canonical TLE handover trace at this anchor',
    });
  }
  return freeze({
    availability: 'available',
    state: trace.state,
    event: trace.event,
    presentationPhase,
    anchorIndex: trace.anchorIndex,
    progressSec: trace.progressSec,
    tttSec: trace.tttSec,
    ratio: trace.ratio,
    servingSatelliteId: trace.servingSatelliteId,
    candidateSatelliteId: trace.candidateSatelliteId,
    eventFromSatelliteId: trace.eventFromSatelliteId,
    eventToSatelliteId: trace.eventToSatelliteId,
    reason: trace.reason,
  });
}

function candidateUnavailableReason(
  frame: SimulationAnalysisFrame,
  missingFromPropagation: boolean,
): string {
  if (missingFromPropagation) {
    return 'candidate identity exists, but its propagated state is absent from the accepted frame';
  }
  if (frame.candidateComparison.status === 'unavailable') return frame.candidateComparison.reason;
  return 'accepted frame does not retain a candidate propagation state';
}

/**
 * Adapt one accepted archived-TLE frame to a bounded near/NTPU scene plan.
 *
 * The optional next frame is never propagated here.  It is already completed
 * input, and the shared homepage interpolation helper only interpolates the
 * display pose between those accepted SGP4 states.  The retained selected
 * trajectory remains explicitly labelled as `frame.tleState.trajectory`.
 */
export function adaptSimulationAnalysisFrameToVisualLabLocalScene(
  frame: SimulationAnalysisFrame,
  options: VisualLabLocalSceneAdapterOptions = {},
): VisualLabLocalScenePlan {
  assertArchivedTleFrame(frame, 'frame');
  const limit = contextLimit(options.contextLimit);
  const scale = groundWorldUnitsPerKm(options.groundWorldUnitsPerKm);
  const offsetSec = visualOffset(options.visualOffsetSec);
  const currentProjection = visualSceneFrame(frame, limit);
  const mapped = mapInterpolation(frame, currentProjection.scene, options.visualNextFrame, limit, offsetSec);
  const scene = mapped.scene;
  const previousTrace = options.visualPreviousFrame?.handover;
  const currentAnchorIndex = frame.runAnchor?.anchorIndex ?? frame.tleState.runAnchor?.anchorIndex ?? null;
  const settledContinuation = frame.handover?.event === 'none'
    && previousTrace !== undefined
    && (previousTrace.event === 'inter-handover' || previousTrace.event === 'forced-continuity')
    && previousTrace.eventToSatelliteId !== null
    && frame.selectedSatelliteId === previousTrace.eventToSatelliteId
    && currentAnchorIndex === (previousTrace.anchorIndex ?? -2) + 1;
  const handoverTrace = frame.handover ?? (settledContinuation ? previousTrace : undefined);
  const currentCandidateId = candidateIdentity(frame);
  const serving = localSatellite(scene.selected, 'serving');
  const candidate: VisualLabLocalCandidate = scene.candidate === null
    ? freeze({
        availability: 'unavailable',
        role: 'candidate',
        satelliteId: currentCandidateId,
        reason: candidateUnavailableReason(frame, currentProjection.candidateMissingFromPropagation),
      } satisfies VisualLabLocalUnavailableCandidate)
    : localSatellite(scene.candidate, 'candidate');
  const contextSatellites = freeze(scene.contextSatellites.map(satellite => localSatellite(satellite, 'context')));
  const substrate = mapSubstrate(frame, scale);
  const selectedTrajectory = freeze(scene.selectedTrajectory.map(localTrajectoryPoint));
  const candidateTrajectory: VisualLabLocalUnavailableTrajectory = freeze({
    availability: 'unavailable',
    role: 'candidate',
    satelliteId: candidate.satelliteId,
    points: freeze([]) as readonly [],
    reason: 'accepted SimulatorTleState retains a trajectory only for the selected satellite',
  } satisfies VisualLabLocalUnavailableTrajectory);
  const contextTrajectories = freeze([] as VisualLabLocalUnavailableTrajectory[]);
  const alreadyProjectedIds = new Set([
    serving.satelliteId,
    ...(candidate.availability === 'available' ? [candidate.satelliteId] : []),
    ...contextSatellites.map(satellite => satellite.satelliteId),
  ]);
  const handoverEvidenceIds = [...new Set([
    handoverTrace?.eventFromSatelliteId,
    handoverTrace?.eventToSatelliteId,
  ].filter((satelliteId): satelliteId is string => (
    typeof satelliteId === 'string'
    && satelliteId.length > 0
    && !alreadyProjectedIds.has(satelliteId)
  )))];
  const handoverEvidenceSatellites = freeze(handoverEvidenceIds.flatMap(satelliteId => {
    const propagated = frame.tleState.propagationFrame.satellites.find(
      satellite => satellite.satelliteId === satelliteId,
    ) ?? options.visualPreviousFrame?.tleState.propagationFrame.satellites.find(
      satellite => satellite.satelliteId === satelliteId,
    );
    if (propagated === undefined) return [];
    alreadyProjectedIds.add(satelliteId);
    return [localPropagatedSatellite(propagated, 'context', frame.instantUtc)];
  }));
  const satellites = freeze([
    serving,
    ...(candidate.availability === 'available' ? [candidate] : []),
    ...handoverEvidenceSatellites,
    ...contextSatellites,
  ]);

  return deepFreeze({
    schemaVersion: VISUAL_LAB_LOCAL_SCENE_SCHEMA,
    isMock: false,
    frameId: frame.frameId,
    tleFrameId: frame.tleFrameId,
    instantUtc: scene.instantUtc,
    instantTaipei: scene.identity.instantTaipei,
    constellation: frame.provenance.constellation,
    source: {
      frameId: frame.frameId,
      tleFrameId: frame.tleFrameId,
      instantUtc: frame.instantUtc,
      instantTaipei: frame.instantTaipei,
      tleEpochUtc: frame.tleEpochUtc,
      constellation: frame.provenance.constellation,
      archiveId: frame.provenance.archiveId,
      archiveDate: frame.provenance.archiveDate,
      selectedSatelliteId: serving.satelliteId,
      candidateSatelliteId: currentCandidateId,
      selectedTlePath: frame.provenance.selectedTlePath,
      sourceKind: frame.provenance.sourceKind,
      propagationModel: frame.provenance.propagationModel,
    },
    interpolation: mapped.source,
    observer: {
      id: 'NTPU',
      label: NTPU_TLE_OBSERVER.label,
      latitudeDeg: NTPU_TLE_OBSERVER.latitudeDeg,
      longitudeDeg: NTPU_TLE_OBSERVER.longitudeDeg,
      heightKm: NTPU_TLE_OBSERVER.heightKm,
      coordinateFrame: 'NTPU-local-ENU',
    },
    serving,
    candidate,
    context: {
      availability: contextSatellites.length > 0 ? 'available' : 'unavailable',
      satellites: contextSatellites,
      limit,
      reason: contextSatellites.length > 0
        ? null
        : limit === 0
          ? 'contextLimit is zero'
          : 'accepted frame has no visible non-serving/non-candidate context satellites',
    },
    satellites,
    trajectory: {
      serving: {
        availability: 'available',
        role: 'serving',
        satelliteId: serving.satelliteId,
        points: selectedTrajectory,
        source: {
          kind: 'frame.tleState.trajectory',
          frameId: frame.frameId,
          tleFrameId: frame.tleFrameId,
          visualPoseInterpolation: mapped.source.mode === 'between-accepted-frames',
        },
      },
      candidate: candidateTrajectory,
      context: contextTrajectories,
    },
    substrate,
    representative: mapRepresentative(frame, substrate),
    activeBeamTargets: mapActiveBeamTargets(frame, substrate),
    configuredBeamTargets: mapConfiguredBeamTargets(frame, substrate),
    candidateBeamLayout: mapCandidateBeamLayout(frame, substrate, scale),
    render: mapRenderDto(frame),
    handover: mapHandover(handoverTrace, currentCandidateId, settledContinuation ? 'settled' : 'switch'),
  });
}

export const createVisualLabLocalScenePlan = adaptSimulationAnalysisFrameToVisualLabLocalScene;
