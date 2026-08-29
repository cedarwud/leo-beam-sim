import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  geodeticToEcefKm,
  normalizeLongitudeDeg,
  projectGeodeticToLocalEnuKm,
  projectLocalEnuKmToGeodetic,
  propagateOrbitElement,
  type OrbitElement,
  type OrbitPoint,
  type ObserverContext,
  type TopocentricPoint,
} from '../orbit';
import {
  mobilityStep,
  type UeMobilityMode,
  type UeMobilityParams,
  type UePerMobilityState,
} from '../ue/multiUeMobility';
import type { UePosition } from '../ue/multiUeState';
import type { CanonicalEeConfig } from '../../analysis/canonicalEe';
import type { Shell } from '../../profiles/types';
import { computeBoresightAxisEcefKm } from '../signal/beam-pointing';
import {
  candidateLinkKeyString,
  validateCandidateLinkKey,
  type CandidateLinkKey,
} from './candidateDecisionContract';
import { buildCanonicalForecastConfigHash } from './canonicalForecastEeEvaluator';

/** The geometry bundle currently accepted by the Walker canonical lane. */
export interface WalkerForecastGeometryModels {
  readonly orbitTopocentric: 'wgs84-orbit-topocentric-v1';
  readonly beamLink: 'spherical-6371-beam-link-v1';
  readonly localEnuProjection: 'flat-111.32-local-projection-v1';
  readonly geometryModelHash: string;
}

export const WALKER_FORECAST_GEOMETRY_MODELS: WalkerForecastGeometryModels = Object.freeze({
  orbitTopocentric: 'wgs84-orbit-topocentric-v1',
  beamLink: 'spherical-6371-beam-link-v1',
  localEnuProjection: 'flat-111.32-local-projection-v1',
  geometryModelHash: 'walker-geometry:wgs84-orbit-topocentric-v1|spherical-6371-beam-link-v1|flat-111.32-local-projection-v1',
});

export type WalkerForecastMotionSource =
  | 'protagonist-waypoints'
  | 'secondary-integrator'
  | 'frozen-former-protagonist';

/** A profile waypoint expressed in the authoritative geodetic frame. */
export interface WalkerScenarioWaypoint {
  readonly timeSec: number;
  readonly latDeg: number;
  readonly lonDeg: number;
}

/**
 * One accepted UE state at the forecast anchor.
 *
 * `eastKm` and `northKm` are observer-relative ENU values. They are the source
 * of truth for the first/frozen position; `groundX`/`groundZ` are deliberately
 * not accepted because they are render coordinates.
 */
export interface WalkerScenarioUeState {
  readonly ueId: string;
  readonly eastKm: number;
  readonly northKm: number;
  readonly motionSource: WalkerForecastMotionSource;
  readonly waypoints?: readonly WalkerScenarioWaypoint[];
  readonly mobilityMode?: UeMobilityMode;
  readonly mobilityParams?: UeMobilityParams;
  readonly mobilityState?: UePerMobilityState;
  readonly footprintRadiusKm?: number;
}

/** A beam seed captured from the accepted frame before future propagation. */
export type WalkerScenarioBeamAxis =
  | {
      readonly axisSource: 'earth-fixed-target';
      readonly targetLatDeg: number;
      readonly targetLonDeg: number;
    }
  | {
      readonly axisSource: 'accepted-sampled-axis';
      readonly axisEcefUnit: readonly [number, number, number];
      readonly axisSourceFrameId: string;
      readonly axisSampleBucketId: string;
    };

export interface WalkerScenarioBeamState {
  readonly key: CandidateLinkKey;
  readonly cellId: number | null;
  readonly axis: WalkerScenarioBeamAxis;
  readonly scheduled: boolean;
  readonly active: boolean;
  readonly load: number;
  readonly reuseColorIndex: number;
  /** Optional only for layouts whose slot is the deterministic beam index. */
  readonly scheduleSlotIndex?: number;
}

export interface WalkerScenarioObserver {
  readonly latDeg: number;
  readonly lonDeg: number;
  readonly altKm?: number;
}

export interface WalkerScenarioBeamConfiguration {
  readonly perSatellite: number;
  readonly maxActivePerSat: number;
  readonly frequencyReuse: number;
}

export interface WalkerScenarioBeamHoppingConfiguration {
  readonly enabled: boolean;
  readonly slotSec: number;
  readonly maxActiveBeamsPerSlot: number;
  readonly scheduler: 'round-robin' | 'distance-priority';
  readonly frameLengthSlots: number;
  /** Phase at the epoch, in schedule slots. */
  readonly phaseSlotIndex?: number;
}

/** Explicit formal channel inputs used by the canonical Walker adapter. */
export interface WalkerScenarioCanonicalChannel {
  readonly receiveGainModel: 'fixed-boresight-gain-v1';
  readonly carrierFrequencyGHz: number;
  readonly atmosphericCoefficientDbPerKm: number;
  readonly ricianKDb: number;
  readonly receiveGainDbi: number;
}

/**
 * Immutable scenario facts required to reproduce one accepted Walker frame.
 *
 * This is intentionally data-only. It does not accept `Profile` as an opaque
 * object, render-world coordinates, a trajectory cache, React state, or Three
 * objects. Profile/antenna/channel settings are retained as JSON-like values
 * so the future canonical builder can hash the complete source configuration.
 */
export interface WalkerScenarioState {
  readonly profileId: string;
  readonly profileVersion?: string;
  readonly constellationSeed: number;
  readonly shells: readonly Shell[];
  readonly observer: WalkerScenarioObserver;
  readonly antenna: Readonly<Record<string, unknown>>;
  readonly channel: Readonly<Record<string, unknown>>;
  readonly canonicalChannel: WalkerScenarioCanonicalChannel;
  readonly beamConfiguration: WalkerScenarioBeamConfiguration;
  readonly beamHopping: WalkerScenarioBeamHoppingConfiguration;
  readonly geometryModels: WalkerForecastGeometryModels;
  /** Full canonical model configuration consumed by the future builder. */
  readonly canonicalConfig: CanonicalEeConfig;
  readonly protagonistUeId: string;
  readonly ues: readonly WalkerScenarioUeState[];
  readonly beams: readonly WalkerScenarioBeamState[];
  /** Beam index per UE; -1 means no assigned service beam. */
  readonly servingBeamIndexByUe: readonly number[];
  readonly laggedInterferenceWByUe: readonly number[];
  /** Declared forecast request bounds, measured from anchor.simTimeMs. */
  readonly forecastHorizonSec: number;
  readonly forecastSampleStepSec: number;
}

export interface WalkerForecastAnchor {
  readonly sourceFrameId: string;
  readonly epochToken: string;
  readonly epochUtcMs: number;
  /** Absolute UTC milliseconds at which the accepted frame was captured. */
  readonly simTimeMs: number;
  readonly immutableScenarioState: WalkerScenarioState;
  readonly policyConfigHash: string;
}

export interface WalkerForecastSatState {
  readonly satelliteId: string;
  readonly shellId: string;
  readonly orbitPoint: OrbitPoint;
  readonly topocentric: TopocentricPoint;
}

export interface WalkerForecastUeState {
  readonly ueId: string;
  readonly eastKm: number;
  readonly northKm: number;
  readonly latDeg: number;
  readonly lonDeg: number;
  readonly ecefKm: readonly [number, number, number];
  readonly motionSource: WalkerForecastMotionSource;
  readonly motionStateDigest: string;
}

export type WalkerForecastBeamAxis =
  | {
      readonly axisSource: 'earth-fixed-target';
      readonly targetLatDeg: number;
      readonly targetLonDeg: number;
      /** Unit direction from the satellite to the beam centre in ECEF axes. */
      readonly axisEcefUnit: readonly [number, number, number];
    }
  | {
      readonly axisSource: 'accepted-sampled-axis';
      /** Unit direction from the satellite to the beam centre in ECEF axes. */
      readonly axisEcefUnit: readonly [number, number, number];
      readonly axisSourceFrameId: string;
      readonly axisSampleBucketId: string;
    };

export interface WalkerForecastBeamState {
  readonly key: CandidateLinkKey;
  readonly cellId: number | null;
  readonly axis: WalkerForecastBeamAxis;
  readonly scheduled: boolean;
  readonly active: boolean;
  readonly load: number;
  readonly satelliteIndex: number;
  readonly reuseColorIndex: number;
}

export interface WalkerForecastFrame {
  readonly sourceFrameId: string;
  readonly epochUtcMs: number;
  readonly absoluteUtcMs: number;
  readonly observer: ObserverContext;
  readonly geometryModels: WalkerForecastGeometryModels;
  readonly beamConfiguration: WalkerScenarioBeamConfiguration;
  readonly beamHopping: WalkerScenarioBeamHoppingConfiguration;
  readonly protagonistUeId: string;
  readonly satellites: readonly WalkerForecastSatState[];
  readonly ues: readonly WalkerForecastUeState[];
  readonly beams: readonly WalkerForecastBeamState[];
  readonly servingBeamIndexByUe: readonly number[];
  readonly laggedInterferenceWByUe: readonly number[];
  readonly canonicalPowerStateHash: string;
  readonly scheduleStateHash: string;
  readonly assignmentStateHash: string;
  readonly scenarioStateHash: string;
  readonly policyConfigHash: string;
  readonly canonicalConfig: CanonicalEeConfig;
  readonly canonicalChannel: WalkerScenarioCanonicalChannel;
  readonly canonicalConfigHash: string;
}

export type WalkerForecastValidationCode =
  | 'INVALID_ANCHOR'
  | 'INVALID_SCENARIO'
  | 'INVALID_REQUEST_TIME'
  | 'INVALID_GEOMETRY'
  | 'UNSUPPORTED_BEAM_HOPPING';

export class WalkerForecastValidationError extends RangeError {
  readonly code: WalkerForecastValidationCode;

  constructor(code: WalkerForecastValidationCode, message: string) {
    super(message);
    this.name = 'WalkerForecastValidationError';
    this.code = code;
  }
}

type JsonRecord = Record<string, unknown>;

const EPSILON = 1e-6;
const EARTH_LAT_MIN = -90;
const EARTH_LAT_MAX = 90;
const EARTH_LON_MIN = -180;
const EARTH_LON_MAX = 180;

function fail(code: WalkerForecastValidationCode, message: string): never {
  throw new WalkerForecastValidationError(code, message);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string, code: WalkerForecastValidationCode): JsonRecord {
  if (!isRecord(value)) fail(code, `${label} must be an object`);
  return value;
}

function nonEmpty(value: unknown, label: string, code: WalkerForecastValidationCode): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(code, `${label} must be non-empty`);
  return value;
}

function finite(value: unknown, label: string, code: WalkerForecastValidationCode): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(code, `${label} must be finite`);
  return value;
}

function integer(value: unknown, label: string, code: WalkerForecastValidationCode): number {
  const number = finite(value, label, code);
  if (!Number.isSafeInteger(number)) fail(code, `${label} must be a safe integer`);
  return number;
}

function positive(value: unknown, label: string, code: WalkerForecastValidationCode): number {
  const number = finite(value, label, code);
  if (number <= 0) fail(code, `${label} must be positive`);
  return number;
}

function nonNegative(value: unknown, label: string, code: WalkerForecastValidationCode): number {
  const number = finite(value, label, code);
  if (number < 0) fail(code, `${label} must be non-negative`);
  return number;
}

function booleanValue(value: unknown, label: string, code: WalkerForecastValidationCode): boolean {
  if (typeof value !== 'boolean') fail(code, `${label} must be boolean`);
  return value;
}

function finiteArray(value: unknown, label: string, code: WalkerForecastValidationCode): readonly number[] {
  if (!Array.isArray(value)) fail(code, `${label} must be an array`);
  return value.map((item, index) => finite(item, `${label}[${index}]`, code));
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => deepClone(item)) as T;
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepClone(child)])) as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as JsonRecord)) deepFreeze(child);
  }
  return value;
}

function stableJson(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return `number:${String(value)}`;
    return `number:${value}`;
  }
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return `unsupported:${Object.prototype.toString.call(value)}`;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function digest(label: string, value: unknown): string {
  return `${label}:fnv1a32-${fnv1a32(stableJson(value))}`;
}

function validateLatitudeLongitude(
  latDeg: unknown,
  lonDeg: unknown,
  label: string,
  code: WalkerForecastValidationCode,
): { readonly latDeg: number; readonly lonDeg: number } {
  const lat = finite(latDeg, `${label}.latDeg`, code);
  const lon = finite(lonDeg, `${label}.lonDeg`, code);
  if (lat < EARTH_LAT_MIN || lat > EARTH_LAT_MAX) fail(code, `${label}.latDeg is outside [-90, 90]`);
  if (lon < EARTH_LON_MIN || lon > EARTH_LON_MAX) fail(code, `${label}.lonDeg is outside [-180, 180]`);
  return { latDeg: lat, lonDeg: lon };
}

function validateJsonLike(value: unknown, label: string, code: WalkerForecastValidationCode): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    finite(value, label, code);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => validateJsonLike(child, `${label}[${index}]`, code));
    return;
  }
  if (!isRecord(value)) fail(code, `${label} must contain only JSON-like values`);
  Object.entries(value).forEach(([key, child]) => validateJsonLike(child, `${label}.${key}`, code));
}

function validateGeometryModels(
  models: WalkerForecastGeometryModels,
  code: WalkerForecastValidationCode,
): WalkerForecastGeometryModels {
  requireRecord(models, 'geometryModels', code);
  if (models.orbitTopocentric !== WALKER_FORECAST_GEOMETRY_MODELS.orbitTopocentric) {
    fail(code, 'geometryModels.orbitTopocentric is not the accepted WGS84 model');
  }
  if (models.beamLink !== WALKER_FORECAST_GEOMETRY_MODELS.beamLink) {
    fail(code, 'geometryModels.beamLink is not the accepted spherical-6371 model');
  }
  if (models.localEnuProjection !== WALKER_FORECAST_GEOMETRY_MODELS.localEnuProjection) {
    fail(code, 'geometryModels.localEnuProjection is not the accepted flat-111.32 model');
  }
  if (models.geometryModelHash !== WALKER_FORECAST_GEOMETRY_MODELS.geometryModelHash) {
    fail(code, 'geometryModels.geometryModelHash does not match the declared geometry bundle');
  }
  return Object.freeze({ ...models });
}

function validateCanonicalConfig(
  config: CanonicalEeConfig,
  code: WalkerForecastValidationCode,
): CanonicalEeConfig {
  requireRecord(config, 'canonicalConfig', code);
  positive(config.noisePowerW, 'canonicalConfig.noisePowerW', code);
  positive(config.beamBandwidthHz, 'canonicalConfig.beamBandwidthHz', code);
  nonNegative(config.minimumRateBps, 'canonicalConfig.minimumRateBps', code);
  const beamCaps = typeof config.beamPowerCapW === 'number'
    ? [positive(config.beamPowerCapW, 'canonicalConfig.beamPowerCapW', code)]
    : finiteArray(config.beamPowerCapW, 'canonicalConfig.beamPowerCapW', code);
  if (beamCaps.length === 0 || beamCaps.some(value => value <= 0)) {
    fail(code, 'canonicalConfig.beamPowerCapW must contain positive values');
  }
  positive(config.satellitePowerCapW, 'canonicalConfig.satellitePowerCapW', code);
  positive(config.g0Linear, 'canonicalConfig.g0Linear', code);
  positive(config.theta3dbRad, 'canonicalConfig.theta3dbRad', code);
  nonNegative(config.rfcPowerW, 'canonicalConfig.rfcPowerW', code);
  nonNegative(config.basebandPerSatelliteW, 'canonicalConfig.basebandPerSatelliteW', code);
  positive(config.frameDurationS, 'canonicalConfig.frameDurationS', code);
  if (config.backoffDb !== undefined) nonNegative(config.backoffDb, 'canonicalConfig.backoffDb', code);
  if (config.etaMax !== undefined) positive(config.etaMax, 'canonicalConfig.etaMax', code);
  if (config.trainingEnergyJByBeam !== undefined) {
    if (typeof config.trainingEnergyJByBeam === 'number') {
      nonNegative(config.trainingEnergyJByBeam, 'canonicalConfig.trainingEnergyJByBeam', code);
    } else {
      finiteArray(config.trainingEnergyJByBeam, 'canonicalConfig.trainingEnergyJByBeam', code)
        .forEach((value, index) => {
          if (value < 0) fail(code, `canonicalConfig.trainingEnergyJByBeam[${index}] must be non-negative`);
        });
    }
  }
  if (config.trainingIndicatorByBeam !== undefined) {
    const indicators = typeof config.trainingIndicatorByBeam === 'number'
      ? [config.trainingIndicatorByBeam]
      : finiteArray(config.trainingIndicatorByBeam, 'canonicalConfig.trainingIndicatorByBeam', code);
    indicators.forEach((value, index) => {
      if (value !== 0 && value !== 1) fail(code, `canonicalConfig.trainingIndicatorByBeam[${index}] must be binary`);
    });
  }
  if (config.switchEnergyJ !== undefined) nonNegative(config.switchEnergyJ, 'canonicalConfig.switchEnergyJ', code);
  if (config.switchIndicatorByBeam !== undefined) {
    const indicators = typeof config.switchIndicatorByBeam === 'number'
      ? [config.switchIndicatorByBeam]
      : finiteArray(config.switchIndicatorByBeam, 'canonicalConfig.switchIndicatorByBeam', code);
    indicators.forEach((value, index) => {
      if (value !== 0 && value !== 1) fail(code, `canonicalConfig.switchIndicatorByBeam[${index}] must be binary`);
    });
  }
  // Keep the clone independent from caller-owned arrays/objects.
  return deepFreeze(deepClone({ ...config, beamPowerCapW: typeof config.beamPowerCapW === 'number' ? config.beamPowerCapW : beamCaps })) as CanonicalEeConfig;
}

function validateMobilityState(
  state: UePerMobilityState,
  label: string,
  code: WalkerForecastValidationCode,
): UePerMobilityState {
  requireRecord(state, label, code);
  integer(state.ueIndex, `${label}.ueIndex`, code);
  integer(state.rngState, `${label}.rngState`, code);
  finite(state.lastDirectionRad, `${label}.lastDirectionRad`, code);
  integer(state.waypointIndex, `${label}.waypointIndex`, code);
  if (state.waypointIndex < 0) fail(code, `${label}.waypointIndex must be non-negative`);
  if (!Array.isArray(state.waypoints)) fail(code, `${label}.waypoints must be an array`);
  state.waypoints.forEach((waypoint, index) => {
    finite(waypoint.eastRatio, `${label}.waypoints[${index}].eastRatio`, code);
    finite(waypoint.northRatio, `${label}.waypoints[${index}].northRatio`, code);
  });
  if (!['east', 'west', 'north', 'south'].includes(state.manhattanHeading)) {
    fail(code, `${label}.manhattanHeading is invalid`);
  }
  booleanValue(state.manhattanInitialized, `${label}.manhattanInitialized`, code);
  if (state.currentPosition !== null) {
    requireRecord(state.currentPosition, `${label}.currentPosition`, code);
    nonEmpty(state.currentPosition.id, `${label}.currentPosition.id`, code);
    finite(state.currentPosition.eastKm, `${label}.currentPosition.eastKm`, code);
    finite(state.currentPosition.northKm, `${label}.currentPosition.northKm`, code);
    finite(state.currentPosition.groundX, `${label}.currentPosition.groundX`, code);
    finite(state.currentPosition.groundZ, `${label}.currentPosition.groundZ`, code);
  }
  if (state.originEastKm !== undefined) finite(state.originEastKm, `${label}.originEastKm`, code);
  if (state.originNorthKm !== undefined) finite(state.originNorthKm, `${label}.originNorthKm`, code);
  if (state.ueWorldScale !== undefined) positive(state.ueWorldScale, `${label}.ueWorldScale`, code);
  return deepFreeze(deepClone(state));
}

function validateScenarioWaypoint(
  waypoint: WalkerScenarioWaypoint,
  label: string,
  code: WalkerForecastValidationCode,
): WalkerScenarioWaypoint {
  const timeSec = nonNegative(waypoint.timeSec, `${label}.timeSec`, code);
  const { latDeg, lonDeg } = validateLatitudeLongitude(waypoint.latDeg, waypoint.lonDeg, label, code);
  return Object.freeze({ timeSec, latDeg, lonDeg });
}

function validateScenarioUe(
  input: WalkerScenarioUeState,
  index: number,
  code: WalkerForecastValidationCode,
): WalkerScenarioUeState {
  const label = `ues[${index}]`;
  const ueId = nonEmpty(input.ueId, `${label}.ueId`, code);
  const eastKm = finite(input.eastKm, `${label}.eastKm`, code);
  const northKm = finite(input.northKm, `${label}.northKm`, code);
  if (!['protagonist-waypoints', 'secondary-integrator', 'frozen-former-protagonist'].includes(input.motionSource)) {
    fail(code, `${label}.motionSource is invalid`);
  }
  const waypoints = input.waypoints === undefined
    ? undefined
    : input.waypoints.map((waypoint, waypointIndex) => validateScenarioWaypoint(
      waypoint,
      `${label}.waypoints[${waypointIndex}]`,
      code,
    ));
  if (waypoints !== undefined) {
    for (let waypointIndex = 1; waypointIndex < waypoints.length; waypointIndex += 1) {
      if (waypoints[waypointIndex]!.timeSec <= waypoints[waypointIndex - 1]!.timeSec) {
        fail(code, `${label}.waypoints must be strictly increasing in timeSec`);
      }
    }
  }
  if (input.motionSource === 'protagonist-waypoints' && (!waypoints || waypoints.length === 0)) {
    fail(code, `${label}.protagonist-waypoints requires a non-empty waypoint path`);
  }
  if (input.motionSource === 'secondary-integrator') {
    if (input.mobilityMode === undefined || input.mobilityParams === undefined || input.mobilityState === undefined) {
      fail(code, `${label}.secondary-integrator requires mobilityMode, mobilityParams, and mobilityState`);
    }
    if (!['static', 'random-walk', 'waypoints', 'manhattan'].includes(input.mobilityMode)) {
      fail(code, `${label}.mobilityMode is invalid`);
    }
    nonNegative(input.mobilityParams.speedKmPerSec, `${label}.mobilityParams.speedKmPerSec`, code);
    integer(input.mobilityParams.waypointCount, `${label}.mobilityParams.waypointCount`, code);
    positive(input.mobilityParams.manhattanGridSpacingKm, `${label}.mobilityParams.manhattanGridSpacingKm`, code);
    const mobilityState = validateMobilityState(input.mobilityState, `${label}.mobilityState`, code);
    if (mobilityState.ueIndex !== index) fail(code, `${label}.mobilityState.ueIndex must match the accepted UE index`);
    if (mobilityState.currentPosition !== null
      && (Math.abs(mobilityState.currentPosition.eastKm - eastKm) > EPSILON
        || Math.abs(mobilityState.currentPosition.northKm - northKm) > EPSILON)) {
      fail(code, `${label}.mobilityState.currentPosition must match the accepted ENU position`);
    }
  }
  if (input.footprintRadiusKm !== undefined) positive(input.footprintRadiusKm, `${label}.footprintRadiusKm`, code);
  return deepFreeze(deepClone({
    ...input,
    ueId,
    eastKm,
    northKm,
    waypoints,
    mobilityParams: input.mobilityParams === undefined ? undefined : deepClone(input.mobilityParams),
    mobilityState: input.mobilityState === undefined ? undefined : deepClone(input.mobilityState),
  }));
}

function validateScenarioAxis(
  axis: WalkerScenarioBeamAxis,
  label: string,
  code: WalkerForecastValidationCode,
): WalkerScenarioBeamAxis {
  requireRecord(axis, label, code);
  if (axis.axisSource === 'earth-fixed-target') {
    const { latDeg, lonDeg } = validateLatitudeLongitude(axis.targetLatDeg, axis.targetLonDeg, label, code);
    return Object.freeze({ axisSource: axis.axisSource, targetLatDeg: latDeg, targetLonDeg: lonDeg });
  }
  if (axis.axisSource === 'accepted-sampled-axis') {
    if (!Array.isArray(axis.axisEcefUnit) || axis.axisEcefUnit.length !== 3) {
      fail(code, `${label}.axisEcefUnit must have exactly three values`);
    }
    const vector = axis.axisEcefUnit.map((value, index) => finite(value, `${label}.axisEcefUnit[${index}]`, code)) as [number, number, number];
    const norm = Math.hypot(...vector);
    if (Math.abs(norm - 1) > EPSILON) fail(code, `${label}.axisEcefUnit must be normalized`);
    const axisSourceFrameId = nonEmpty(axis.axisSourceFrameId, `${label}.axisSourceFrameId`, code);
    const axisSampleBucketId = nonEmpty(axis.axisSampleBucketId, `${label}.axisSampleBucketId`, code);
    return Object.freeze({
      axisSource: axis.axisSource,
      axisEcefUnit: vector,
      axisSourceFrameId,
      axisSampleBucketId,
    });
  }
  fail(code, `${label}.axisSource is invalid`);
}

function validateScenarioBeam(
  input: WalkerScenarioBeamState,
  index: number,
  frameLengthSlots: number,
  code: WalkerForecastValidationCode,
): WalkerScenarioBeamState {
  const label = `beams[${index}]`;
  try {
    validateCandidateLinkKey(input.key);
  } catch (error) {
    fail(code, `${label}.key is invalid: ${error instanceof Error ? error.message : 'unknown candidate key error'}`);
  }
  const key = Object.freeze({ satelliteId: input.key.satelliteId, beamId: input.key.beamId });
  const cellId = input.cellId === null ? null : integer(input.cellId, `${label}.cellId`, code);
  if (cellId !== null && cellId < 0) fail(code, `${label}.cellId must be non-negative or null`);
  const axis = validateScenarioAxis(input.axis, `${label}.axis`, code);
  const scheduled = booleanValue(input.scheduled, `${label}.scheduled`, code);
  const active = booleanValue(input.active, `${label}.active`, code);
  const load = nonNegative(input.load, `${label}.load`, code);
  if (!Number.isInteger(load)) fail(code, `${label}.load must be an integer user count`);
  if (active !== (load > 0)) fail(code, `${label}.active must equal load > 0`);
  if (active && !scheduled) fail(code, `${label}.active beam must be scheduled at the accepted anchor`);
  const reuseColorIndex = integer(input.reuseColorIndex, `${label}.reuseColorIndex`, code);
  if (reuseColorIndex < 0) fail(code, `${label}.reuseColorIndex must be non-negative`);
  const scheduleSlotIndex = input.scheduleSlotIndex === undefined
    ? ((input.key.beamId % frameLengthSlots) + frameLengthSlots) % frameLengthSlots
    : integer(input.scheduleSlotIndex, `${label}.scheduleSlotIndex`, code);
  if (scheduleSlotIndex < 0 || scheduleSlotIndex >= frameLengthSlots) {
    fail(code, `${label}.scheduleSlotIndex must be inside the frame length`);
  }
  return deepFreeze({
    key,
    cellId,
    axis,
    scheduled,
    active,
    load,
    reuseColorIndex,
    scheduleSlotIndex,
  });
}

function normalizeScenarioState(input: WalkerScenarioState): WalkerScenarioState {
  const code: WalkerForecastValidationCode = 'INVALID_SCENARIO';
  requireRecord(input, 'immutableScenarioState', code);
  const profileId = nonEmpty(input.profileId, 'profileId', code);
  if (input.profileVersion !== undefined) nonEmpty(input.profileVersion, 'profileVersion', code);
  integer(input.constellationSeed, 'constellationSeed', code);
  if (!Array.isArray(input.shells) || input.shells.length === 0) fail(code, 'shells must be a non-empty array');
  const shells = input.shells.map((shell, index) => {
    requireRecord(shell, `shells[${index}]`, code);
    const id = nonEmpty(shell.id, `shells[${index}].id`, code);
    positive(shell.altitudeKm, `shells[${index}].altitudeKm`, code);
    finite(shell.inclinationDeg, `shells[${index}].inclinationDeg`, code);
    if (shell.inclinationDeg < 0 || shell.inclinationDeg > 180) fail(code, `shells[${index}].inclinationDeg is outside [0, 180]`);
    const planes = integer(shell.planes, `shells[${index}].planes`, code);
    const satsPerPlane = integer(shell.satsPerPlane, `shells[${index}].satsPerPlane`, code);
    if (planes <= 0 || satsPerPlane <= 0) fail(code, `shells[${index}] must have positive planes and satsPerPlane`);
    if (shell.serviceAreaPassTargetsSec !== undefined) {
      if (!Array.isArray(shell.serviceAreaPassTargetsSec)) fail(code, `shells[${index}].serviceAreaPassTargetsSec must be an array`);
      shell.serviceAreaPassTargetsSec.forEach((value: number, targetIndex: number) => nonNegative(
        value,
        `shells[${index}].serviceAreaPassTargetsSec[${targetIndex}]`,
        code,
      ));
    }
    if (shell.phasePerturbation !== undefined) booleanValue(shell.phasePerturbation, `shells[${index}].phasePerturbation`, code);
    return deepFreeze(deepClone({ ...shell, id, altitudeKm: shell.altitudeKm, inclinationDeg: shell.inclinationDeg, planes, satsPerPlane }));
  });
  const observerInput = requireRecord(input.observer, 'observer', code);
  const observerGeo = validateLatitudeLongitude(observerInput.latDeg, observerInput.lonDeg, 'observer', code);
  const observerAltKm = input.observer.altKm === undefined ? 0 : nonNegative(input.observer.altKm, 'observer.altKm', code);
  validateJsonLike(input.antenna, 'antenna', code);
  validateJsonLike(input.channel, 'channel', code);
  const antenna = deepFreeze(deepClone(input.antenna));
  const channel = deepFreeze(deepClone(input.channel));
  const canonicalChannelInput = requireRecord(input.canonicalChannel, 'canonicalChannel', code);
  if (canonicalChannelInput.receiveGainModel !== 'fixed-boresight-gain-v1') {
    fail(code, 'canonicalChannel.receiveGainModel is not implemented by the Walker validation lane');
  }
  const canonicalChannel: WalkerScenarioCanonicalChannel = Object.freeze({
    receiveGainModel: 'fixed-boresight-gain-v1',
    carrierFrequencyGHz: positive(
      canonicalChannelInput.carrierFrequencyGHz,
      'canonicalChannel.carrierFrequencyGHz',
      code,
    ),
    atmosphericCoefficientDbPerKm: nonNegative(
      canonicalChannelInput.atmosphericCoefficientDbPerKm,
      'canonicalChannel.atmosphericCoefficientDbPerKm',
      code,
    ),
    ricianKDb: nonNegative(canonicalChannelInput.ricianKDb, 'canonicalChannel.ricianKDb', code),
    receiveGainDbi: finite(canonicalChannelInput.receiveGainDbi, 'canonicalChannel.receiveGainDbi', code),
  });

  const beamConfiguration = requireRecord(input.beamConfiguration, 'beamConfiguration', code);
  const perSatellite = integer(beamConfiguration.perSatellite, 'beamConfiguration.perSatellite', code);
  const maxActivePerSat = integer(beamConfiguration.maxActivePerSat, 'beamConfiguration.maxActivePerSat', code);
  const frequencyReuse = integer(beamConfiguration.frequencyReuse, 'beamConfiguration.frequencyReuse', code);
  if (perSatellite <= 0 || maxActivePerSat <= 0 || frequencyReuse <= 0) fail(code, 'beamConfiguration values must be positive');
  if (maxActivePerSat > perSatellite) fail(code, 'beamConfiguration.maxActivePerSat cannot exceed perSatellite');

  const hopping = requireRecord(input.beamHopping, 'beamHopping', code);
  const enabled = booleanValue(hopping.enabled, 'beamHopping.enabled', code);
  const slotSec = positive(hopping.slotSec, 'beamHopping.slotSec', code);
  const maxActiveBeamsPerSlot = integer(hopping.maxActiveBeamsPerSlot, 'beamHopping.maxActiveBeamsPerSlot', code);
  const frameLengthSlots = integer(hopping.frameLengthSlots, 'beamHopping.frameLengthSlots', code);
  if (maxActiveBeamsPerSlot <= 0 || frameLengthSlots <= 0) fail(code, 'beamHopping limits must be positive');
  const phaseSlotIndex = hopping.phaseSlotIndex === undefined
    ? 0
    : integer(hopping.phaseSlotIndex, 'beamHopping.phaseSlotIndex', code);
  const scheduler = hopping.scheduler;
  if (scheduler !== 'round-robin' && scheduler !== 'distance-priority') fail(code, 'beamHopping.scheduler is invalid');
  if (enabled && scheduler !== 'round-robin') {
    fail(code, 'enabled Walker forecast currently supports only the declared round-robin scheduler');
  }
  if (phaseSlotIndex < 0 || phaseSlotIndex >= frameLengthSlots) {
    fail(code, 'beamHopping.phaseSlotIndex must be inside the frame length');
  }
  if (maxActiveBeamsPerSlot > perSatellite) {
    fail(code, 'beamHopping.maxActiveBeamsPerSlot cannot exceed beamConfiguration.perSatellite');
  }
  if (enabled && maxActiveBeamsPerSlot > maxActivePerSat) {
    fail(code, 'beamHopping.maxActiveBeamsPerSlot cannot exceed beamConfiguration.maxActivePerSat');
  }
  if (enabled) {
    fail(
      'UNSUPPORTED_BEAM_HOPPING',
      'enabled beam-hopping forecast semantics are not implemented in the validation-only provider',
    );
  }
  const beamHopping = Object.freeze({
    enabled,
    slotSec,
    maxActiveBeamsPerSlot,
    scheduler,
    frameLengthSlots,
    phaseSlotIndex,
  });
  const geometryModels = validateGeometryModels(input.geometryModels, code);
  const canonicalConfig = validateCanonicalConfig(input.canonicalConfig, code);

  if (!Array.isArray(input.ues) || input.ues.length === 0) fail(code, 'ues must be a non-empty array');
  const ues = input.ues.map((ue, index) => validateScenarioUe(ue, index, code));
  const ueIds = new Set<string>();
  for (const ue of ues) {
    if (ueIds.has(ue.ueId)) fail(code, `duplicate UE identity ${ue.ueId}`);
    ueIds.add(ue.ueId);
  }
  const protagonistUeId = nonEmpty(input.protagonistUeId, 'protagonistUeId', code);
  if (!ueIds.has(protagonistUeId)) fail(code, 'protagonistUeId must identify one accepted UE');

  const expectedElements = generateWalkerConstellation({
    shells: shells as Shell[],
    epochUtcMs: 0,
    observerLatDeg: observerGeo.latDeg,
    observerLonDeg: observerGeo.lonDeg,
    phaseSeed: input.constellationSeed,
  });
  const elementIds = new Set(expectedElements.map(element => element.id));
  const duplicateElementIds = expectedElements.length !== elementIds.size;
  if (duplicateElementIds) fail(code, 'generated Walker satellite identities are not unique');
  if (!Array.isArray(input.beams) || input.beams.length === 0) fail(code, 'beams must be a non-empty array');
  const beams = input.beams.map((beam, index) => validateScenarioBeam(beam, index, frameLengthSlots, code));
  const beamIds = new Set<string>();
  for (const beam of beams) {
    const key = candidateLinkKeyString(beam.key);
    if (beamIds.has(key)) fail(code, `duplicate beam identity ${key}`);
    beamIds.add(key);
    if (!elementIds.has(beam.key.satelliteId)) fail(code, `beam ${key} names an unknown Walker satellite`);
    if (beam.reuseColorIndex >= frequencyReuse) {
      fail(code, `beam ${key} reuseColorIndex must be less than beamConfiguration.frequencyReuse`);
    }
  }
  const beamsBySatellite = new Map<string, WalkerScenarioBeamState[]>();
  for (const beam of beams) {
    const group = beamsBySatellite.get(beam.key.satelliteId) ?? [];
    group.push(beam);
    beamsBySatellite.set(beam.key.satelliteId, group);
  }
  for (const [satelliteId, satelliteBeams] of beamsBySatellite) {
    if (satelliteBeams.length > perSatellite) {
      fail(code, `satellite ${satelliteId} exceeds beamConfiguration.perSatellite`);
    }
    if (satelliteBeams.filter(beam => beam.active).length > maxActivePerSat) {
      fail(code, `satellite ${satelliteId} exceeds beamConfiguration.maxActivePerSat`);
    }
  }

  if (!Array.isArray(input.servingBeamIndexByUe) || input.servingBeamIndexByUe.length !== ues.length) {
    fail(code, 'servingBeamIndexByUe must cover every UE');
  }
  const servingBeamIndexByUe = input.servingBeamIndexByUe.map((beamIndex, index) => {
    const value = integer(beamIndex, `servingBeamIndexByUe[${index}]`, code);
    if (value < -1 || value >= beams.length) fail(code, `servingBeamIndexByUe[${index}] is outside the beam set`);
    return value;
  });
  const beamAssignmentCounts = beams.map(() => 0);
  servingBeamIndexByUe.forEach(beamIndex => {
    if (beamIndex >= 0) beamAssignmentCounts[beamIndex] += 1;
  });
  beams.forEach((beam, index) => {
    if (beam.load !== beamAssignmentCounts[index]) {
      fail(code, `beams[${index}].load must equal its accepted assignment count`);
    }
  });
  if (!Array.isArray(input.laggedInterferenceWByUe) || input.laggedInterferenceWByUe.length !== ues.length) {
    fail(code, 'laggedInterferenceWByUe must cover every UE');
  }
  const laggedInterferenceWByUe = input.laggedInterferenceWByUe.map((value, index) => nonNegative(
    value,
    `laggedInterferenceWByUe[${index}]`,
    code,
  ));
  const forecastHorizonSec = positive(input.forecastHorizonSec, 'forecastHorizonSec', code);
  const forecastSampleStepSec = positive(input.forecastSampleStepSec, 'forecastSampleStepSec', code);
  const sampleCount = forecastHorizonSec / forecastSampleStepSec;
  if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
    fail(code, 'forecastHorizonSec must be a positive integer multiple of forecastSampleStepSec');
  }
  if (Math.abs(canonicalConfig.frameDurationS - forecastSampleStepSec) > 1e-9) {
    fail(code, 'canonicalConfig.frameDurationS must equal forecastSampleStepSec');
  }
  const vectorConfigFields: readonly (keyof Pick<CanonicalEeConfig,
    'beamPowerCapW' | 'trainingEnergyJByBeam' | 'trainingIndicatorByBeam' | 'switchIndicatorByBeam'>)[] = [
    'beamPowerCapW',
    'trainingEnergyJByBeam',
    'trainingIndicatorByBeam',
    'switchIndicatorByBeam',
  ];
  for (const field of vectorConfigFields) {
    const value = canonicalConfig[field];
    if (Array.isArray(value) && value.length !== beams.length) {
      fail(code, `canonicalConfig.${field} must cover every scenario beam`);
    }
  }
  const baseSwitchIndicators = canonicalConfig.switchIndicatorByBeam;
  if (baseSwitchIndicators !== undefined) {
    const values = typeof baseSwitchIndicators === 'number' ? [baseSwitchIndicators] : baseSwitchIndicators;
    if (values.some(value => value !== 0)) {
      fail(code, 'canonicalConfig.switchIndicatorByBeam must be zero at the accepted forecast anchor');
    }
  }
  // Canonical hashing must not distinguish equivalent "no event" spellings
  // (omitted, scalar 0, or a full zero vector). The downstream builder always
  // materializes the per-beam vector before inserting the one candidate event.
  const normalizedCanonicalConfig = deepFreeze({
    ...deepClone(canonicalConfig),
    switchIndicatorByBeam: Array.from({ length: beams.length }, () => 0),
  }) as CanonicalEeConfig;

  return deepFreeze({
    profileId,
    ...(input.profileVersion === undefined ? {} : { profileVersion: input.profileVersion }),
    constellationSeed: input.constellationSeed,
    shells,
    observer: Object.freeze({ ...observerGeo, altKm: observerAltKm }),
    antenna,
    channel,
    canonicalChannel,
    beamConfiguration: Object.freeze({ perSatellite, maxActivePerSat, frequencyReuse }),
    beamHopping,
    geometryModels,
    canonicalConfig: normalizedCanonicalConfig,
    protagonistUeId,
    ues,
    beams,
    servingBeamIndexByUe: Object.freeze(servingBeamIndexByUe),
    laggedInterferenceWByUe: Object.freeze(laggedInterferenceWByUe),
    forecastHorizonSec,
    forecastSampleStepSec,
  });
}

/**
 * Validate, detach, and deeply freeze one accepted Walker forecast anchor.
 *
 * Runtime capture uses this strict constructor before an anchor can reach the
 * forecast provider. It intentionally throws for malformed scientific facts;
 * the validation-only capture envelope converts that failure into typed
 * unavailable evidence for live publication.
 */
export function createWalkerForecastAnchor(input: WalkerForecastAnchor): WalkerForecastAnchor {
  const code: WalkerForecastValidationCode = 'INVALID_ANCHOR';
  requireRecord(input, 'anchor', code);
  const sourceFrameId = nonEmpty(input.sourceFrameId, 'anchor.sourceFrameId', code);
  const epochToken = nonEmpty(input.epochToken, 'anchor.epochToken', code);
  const epochUtcMs = integer(input.epochUtcMs, 'anchor.epochUtcMs', code);
  const simTimeMs = integer(input.simTimeMs, 'anchor.simTimeMs', code);
  if (epochUtcMs < 0 || simTimeMs < 0) fail(code, 'anchor UTC timestamps must be non-negative');
  if (simTimeMs < epochUtcMs) fail(code, 'anchor.simTimeMs must not precede anchor.epochUtcMs');
  const policyConfigHash = nonEmpty(input.policyConfigHash, 'anchor.policyConfigHash', code);
  const immutableScenarioState = normalizeScenarioState(input.immutableScenarioState);
  immutableScenarioState.beams.forEach((beam, index) => {
    if (beam.axis.axisSource === 'accepted-sampled-axis'
      && beam.axis.axisSourceFrameId !== sourceFrameId) {
      fail(code, `beams[${index}].axisSourceFrameId must match anchor.sourceFrameId`);
    }
  });
  const protagonist = immutableScenarioState.ues.find(ue => ue.ueId === immutableScenarioState.protagonistUeId)!;
  if (protagonist.motionSource === 'protagonist-waypoints') {
    const replayTimeSec = (simTimeMs - epochUtcMs) / 1000;
    const expectedWaypoint = resolveWaypoint(protagonist.waypoints!, replayTimeSec);
    const expectedLocal = projectGeodeticToLocalEnuKm(immutableScenarioState.observer, expectedWaypoint);
    if (Math.abs(expectedLocal.eastKm - protagonist.eastKm) > EPSILON
      || Math.abs(expectedLocal.northKm - protagonist.northKm) > EPSILON) {
      fail(code, 'accepted protagonist ENU position must match waypoint replay at anchor.simTimeMs');
    }
  }
  return deepFreeze({
    sourceFrameId,
    epochToken,
    epochUtcMs,
    simTimeMs,
    immutableScenarioState,
    policyConfigHash,
  });
}

function validateRequestedTimes(
  anchor: WalkerForecastAnchor,
  sampleStartTimesUtcMs: readonly number[],
): readonly number[] {
  const code: WalkerForecastValidationCode = 'INVALID_REQUEST_TIME';
  if (!Array.isArray(sampleStartTimesUtcMs)) fail(code, 'sampleStartTimesUtcMs must be an array');
  if (sampleStartTimesUtcMs.length === 0) fail(code, 'sampleStartTimesUtcMs must not be empty');
  const maxUtcMs = anchor.simTimeMs + anchor.immutableScenarioState.forecastHorizonSec * 1000;
  const stepMs = anchor.immutableScenarioState.forecastSampleStepSec * 1000;
  const expectedSampleCount = anchor.immutableScenarioState.forecastHorizonSec
    / anchor.immutableScenarioState.forecastSampleStepSec;
  if (sampleStartTimesUtcMs.length !== expectedSampleCount) {
    fail(code, `sampleStartTimesUtcMs must contain exactly ${expectedSampleCount} full-horizon samples`);
  }
  let previous: number | null = null;
  return sampleStartTimesUtcMs.map((value, index) => {
    const atUtcMs = integer(value, `sampleStartTimesUtcMs[${index}]`, code);
    const expectedUtcMs = anchor.simTimeMs + index * stepMs;
    if (atUtcMs !== expectedUtcMs) {
      fail(code, `sampleStartTimesUtcMs[${index}] must equal the declared ${anchor.immutableScenarioState.forecastSampleStepSec} s grid`);
    }
    if (atUtcMs < anchor.simTimeMs) fail(code, `sampleStartTimesUtcMs[${index}] precedes anchor.simTimeMs`);
    if (atUtcMs + stepMs > maxUtcMs) fail(code, `sampleStartTimesUtcMs[${index}] exceeds the declared forecast horizon`);
    if (previous !== null && atUtcMs - previous !== stepMs) {
      fail(code, 'sampleStartTimesUtcMs must use the declared forecast sample step');
    }
    previous = atUtcMs;
    return atUtcMs;
  });
}

function earthFixedAxis(
  axis: Extract<WalkerScenarioBeamAxis, { axisSource: 'earth-fixed-target' }>,
  satellite: WalkerForecastSatState,
): WalkerForecastBeamAxis {
  const axisEcefUnit = computeBoresightAxisEcefKm({
    satLatDeg: satellite.orbitPoint.latDeg,
    satLonDeg: satellite.orbitPoint.lonDeg,
    satAltitudeKm: satellite.orbitPoint.altKm,
    targetLatDeg: axis.targetLatDeg,
    targetLonDeg: axis.targetLonDeg,
  });
  const norm = Math.hypot(...axisEcefUnit);
  if (!Number.isFinite(norm) || Math.abs(norm - 1) > EPSILON) {
    fail('INVALID_GEOMETRY', 'earth-fixed beam axis must be finite and normalized');
  }
  return Object.freeze({
    axisSource: axis.axisSource,
    targetLatDeg: axis.targetLatDeg,
    targetLonDeg: axis.targetLonDeg,
    axisEcefUnit: Object.freeze([...axisEcefUnit]) as readonly [number, number, number],
  });
}

function sampledAxis(axis: Extract<WalkerScenarioBeamAxis, { axisSource: 'accepted-sampled-axis' }>): WalkerForecastBeamAxis {
  const norm = Math.hypot(...axis.axisEcefUnit);
  if (!Number.isFinite(norm) || Math.abs(norm - 1) > EPSILON) {
    fail('INVALID_GEOMETRY', 'accepted sampled beam axis must remain normalized');
  }
  return Object.freeze({
    axisSource: axis.axisSource,
    axisEcefUnit: Object.freeze([...axis.axisEcefUnit]) as readonly [number, number, number],
    axisSourceFrameId: axis.axisSourceFrameId,
    axisSampleBucketId: axis.axisSampleBucketId,
  });
}

function resolveWaypoint(
  waypoints: readonly WalkerScenarioWaypoint[],
  replayTimeSec: number,
): { readonly latDeg: number; readonly lonDeg: number } {
  if (replayTimeSec <= waypoints[0]!.timeSec) {
    return { latDeg: waypoints[0]!.latDeg, lonDeg: waypoints[0]!.lonDeg };
  }
  const last = waypoints[waypoints.length - 1]!;
  if (replayTimeSec >= last.timeSec) return { latDeg: last.latDeg, lonDeg: last.lonDeg };
  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1]!;
    const next = waypoints[index]!;
    if (replayTimeSec > next.timeSec) continue;
    const ratio = (replayTimeSec - previous.timeSec) / (next.timeSec - previous.timeSec);
    const longitudeDeltaDeg = normalizeLongitudeDeg(next.lonDeg - previous.lonDeg);
    return {
      latDeg: previous.latDeg + (next.latDeg - previous.latDeg) * ratio,
      lonDeg: normalizeLongitudeDeg(previous.lonDeg + longitudeDeltaDeg * ratio),
    };
  }
  return { latDeg: last.latDeg, lonDeg: last.lonDeg };
}

function positionFromLocal(
  observer: WalkerScenarioObserver,
  eastKm: number,
  northKm: number,
): { readonly eastKm: number; readonly northKm: number; readonly latDeg: number; readonly lonDeg: number; readonly ecefKm: readonly [number, number, number] } {
  const geodetic = projectLocalEnuKmToGeodetic(observer, { eastKm, northKm });
  const ecef = geodeticToEcefKm(geodetic.latDeg, geodetic.lonDeg, 0);
  return {
    eastKm,
    northKm,
    ...geodetic,
    ecefKm: Object.freeze([...ecef]) as readonly [number, number, number],
  };
}

interface SecondaryMotionCursor {
  position: UePosition;
  state: UePerMobilityState;
}

function futureUePosition(
  scenario: WalkerScenarioState,
  ue: WalkerScenarioUeState,
  replayTimeSec: number,
  secondaryCursor: SecondaryMotionCursor | null,
  deltaSec: number,
): WalkerForecastUeState {
  let eastKm = ue.eastKm;
  let northKm = ue.northKm;
  if (ue.motionSource === 'protagonist-waypoints') {
    const waypoint = resolveWaypoint(ue.waypoints!, replayTimeSec);
    const local = projectGeodeticToLocalEnuKm(scenario.observer, waypoint);
    eastKm = local.eastKm;
    northKm = local.northKm;
  } else if (ue.motionSource === 'secondary-integrator') {
    if (secondaryCursor === null) fail('INVALID_SCENARIO', `UE ${ue.ueId} is missing its secondary mobility cursor`);
    if (deltaSec > 0) {
      const result = mobilityStep(
        secondaryCursor.position,
        secondaryCursor.state,
        ue.mobilityMode!,
        ue.mobilityParams!,
        deltaSec,
        ue.footprintRadiusKm ?? 0,
      );
      secondaryCursor.position = result.position;
      secondaryCursor.state = result.state;
    }
    eastKm = secondaryCursor.position.eastKm;
    northKm = secondaryCursor.position.northKm;
  }
  const position = positionFromLocal(scenario.observer, eastKm, northKm);
  const motionStateDigest = digest('walker-motion-state', {
    ueId: ue.ueId,
    motionSource: ue.motionSource,
    replayTimeSec,
    eastKm,
    northKm,
    waypoints: ue.waypoints,
    mobilityMode: ue.mobilityMode,
    mobilityParams: ue.mobilityParams,
    mobilityState: secondaryCursor?.state ?? ue.mobilityState,
  });
  return deepFreeze({
    ueId: ue.ueId,
    eastKm: position.eastKm,
    northKm: position.northKm,
    latDeg: position.latDeg,
    lonDeg: position.lonDeg,
    ecefKm: position.ecefKm,
    motionSource: ue.motionSource,
    motionStateDigest,
  });
}

function stateHashProjection(scenario: WalkerScenarioState): unknown {
  return {
    profileId: scenario.profileId,
    profileVersion: scenario.profileVersion,
    constellationSeed: scenario.constellationSeed,
    shells: scenario.shells,
    observer: scenario.observer,
    antenna: scenario.antenna,
    channel: scenario.channel,
    canonicalChannel: scenario.canonicalChannel,
    beamConfiguration: scenario.beamConfiguration,
    beamHopping: scenario.beamHopping,
    geometryModels: scenario.geometryModels,
    canonicalConfig: scenario.canonicalConfig,
    protagonistUeId: scenario.protagonistUeId,
    ues: scenario.ues,
    beams: scenario.beams,
    servingBeamIndexByUe: scenario.servingBeamIndexByUe,
    laggedInterferenceWByUe: scenario.laggedInterferenceWByUe,
    forecastHorizonSec: scenario.forecastHorizonSec,
    forecastSampleStepSec: scenario.forecastSampleStepSec,
  };
}

function futureSchedule(
  scenario: WalkerScenarioState,
  beam: WalkerScenarioBeamState,
  absoluteUtcMs: number,
  epochUtcMs: number,
): boolean {
  if (!scenario.beamHopping.enabled) return beam.scheduled;
  const elapsedSlot = Math.floor((absoluteUtcMs - epochUtcMs) / (scenario.beamHopping.slotSec * 1000));
  const slot = (scenario.beamHopping.phaseSlotIndex! + elapsedSlot) % scenario.beamHopping.frameLengthSlots;
  return beam.scheduleSlotIndex === slot;
}

function buildSatelliteStates(
  elements: readonly OrbitElement[],
  observer: ObserverContext,
  absoluteUtcMs: number,
): readonly WalkerForecastSatState[] {
  return Object.freeze(elements.map(element => {
    const orbitPoint = propagateOrbitElement(element, absoluteUtcMs);
    const topocentric = computeTopocentricPoint(observer, orbitPoint.ecefKm);
    return deepFreeze({
      satelliteId: element.id,
      shellId: element.shellId,
      orbitPoint: deepFreeze({
        ecefKm: Object.freeze([...orbitPoint.ecefKm]) as [number, number, number],
        latDeg: orbitPoint.latDeg,
        lonDeg: orbitPoint.lonDeg,
        altKm: orbitPoint.altKm,
      }),
      topocentric: deepFreeze({ ...topocentric }),
    });
  }));
}

function buildBeamStates(
  scenario: WalkerScenarioState,
  satellites: readonly WalkerForecastSatState[],
  absoluteUtcMs: number,
  epochUtcMs: number,
): readonly WalkerForecastBeamState[] {
  const satelliteIndexById = new Map(satellites.map((satellite, index) => [satellite.satelliteId, index]));
  const scheduledCountBySatellite = new Map<string, number>();
  const activeCountBySatellite = new Map<string, number>();
  const output = scenario.beams.map(beam => {
    const satelliteIndex = satelliteIndexById.get(beam.key.satelliteId);
    if (satelliteIndex === undefined) fail('INVALID_GEOMETRY', `beam ${candidateLinkKeyString(beam.key)} has no propagated satellite`);
    const satellite = satellites[satelliteIndex];
    const scheduled = futureSchedule(scenario, beam, absoluteUtcMs, epochUtcMs);
    if (scheduled) {
      scheduledCountBySatellite.set(
        beam.key.satelliteId,
        (scheduledCountBySatellite.get(beam.key.satelliteId) ?? 0) + 1,
      );
    }
    if (beam.active && !scheduled) {
      fail('INVALID_SCENARIO', `active beam ${candidateLinkKeyString(beam.key)} leaves its declared hopping schedule`);
    }
    if (beam.active) {
      activeCountBySatellite.set(
        beam.key.satelliteId,
        (activeCountBySatellite.get(beam.key.satelliteId) ?? 0) + 1,
      );
    }
    const axis = beam.axis.axisSource === 'earth-fixed-target'
      ? earthFixedAxis(beam.axis, satellite)
      : sampledAxis(beam.axis);
    return deepFreeze({
      key: deepFreeze({ ...beam.key }),
      cellId: beam.cellId,
      axis,
      scheduled,
      active: beam.active,
      load: beam.load,
      satelliteIndex,
      reuseColorIndex: beam.reuseColorIndex,
    });
  });
  if (scenario.beamHopping.enabled) {
    for (const [satelliteId, scheduledCount] of scheduledCountBySatellite) {
      if (scheduledCount > scenario.beamHopping.maxActiveBeamsPerSlot) {
        fail('INVALID_SCENARIO', `future hopping schedule for ${satelliteId} exceeds maxActiveBeamsPerSlot`);
      }
    }
  }
  for (const [satelliteId, activeCount] of activeCountBySatellite) {
    if (activeCount > scenario.beamConfiguration.maxActivePerSat) {
      fail('INVALID_SCENARIO', `future active beams for ${satelliteId} exceed maxActivePerSat`);
    }
  }
  return Object.freeze(output);
}

function buildFrame(
  anchor: WalkerForecastAnchor,
  scenario: WalkerScenarioState,
  elements: readonly OrbitElement[],
  observer: ObserverContext,
  scenarioStateHash: string,
  absoluteUtcMs: number,
  ues: readonly WalkerForecastUeState[],
): WalkerForecastFrame {
  const satellites = buildSatelliteStates(elements, observer, absoluteUtcMs);
  const beams = buildBeamStates(scenario, satellites, absoluteUtcMs, anchor.epochUtcMs);
  const scheduleStateHash = digest('walker-schedule-state', {
    absoluteUtcMs,
    beams: beams.map(beam => ({
      key: candidateLinkKeyString(beam.key),
      scheduled: beam.scheduled,
      active: beam.active,
      load: beam.load,
    })),
  });
  const assignmentStateHash = digest('walker-assignment-state', {
    servingBeamIndexByUe: scenario.servingBeamIndexByUe,
    beams: beams.map(beam => ({ key: candidateLinkKeyString(beam.key), load: beam.load, active: beam.active })),
  });
  const canonicalPowerStateHash = digest('walker-canonical-power-state', {
    canonicalConfig: scenario.canonicalConfig,
    assignmentStateHash,
    scheduleStateHash,
  });
  const canonicalConfigHash = buildCanonicalForecastConfigHash(scenario.canonicalConfig);
  return deepFreeze({
    sourceFrameId: `${anchor.sourceFrameId}:forecast:${absoluteUtcMs}`,
    epochUtcMs: anchor.epochUtcMs,
    absoluteUtcMs,
    observer: deepFreeze({
      ...observer,
      ecefKm: Object.freeze([...observer.ecefKm]) as [number, number, number],
    }),
    geometryModels: scenario.geometryModels,
    beamConfiguration: scenario.beamConfiguration,
    beamHopping: scenario.beamHopping,
    protagonistUeId: scenario.protagonistUeId,
    satellites,
    ues,
    beams,
    servingBeamIndexByUe: Object.freeze([...scenario.servingBeamIndexByUe]),
    laggedInterferenceWByUe: Object.freeze([...scenario.laggedInterferenceWByUe]),
    canonicalPowerStateHash,
    scheduleStateHash,
    assignmentStateHash,
    scenarioStateHash,
    policyConfigHash: anchor.policyConfigHash,
    canonicalConfig: scenario.canonicalConfig,
    canonicalChannel: scenario.canonicalChannel,
    canonicalConfigHash,
  });
}

function buildForecastUeSequence(
  anchor: WalkerForecastAnchor,
  scenario: WalkerScenarioState,
  sampleTimes: readonly number[],
): readonly (readonly WalkerForecastUeState[])[] {
  const cursors = new Map<string, SecondaryMotionCursor>();
  for (const ue of scenario.ues) {
    if (ue.motionSource !== 'secondary-integrator') continue;
    const worldScale = ue.mobilityState?.ueWorldScale ?? 1;
    cursors.set(ue.ueId, {
      position: {
        id: ue.ueId,
        eastKm: ue.eastKm,
        northKm: ue.northKm,
        groundX: ue.eastKm * worldScale,
        groundZ: -ue.northKm * worldScale,
      },
      state: deepClone(ue.mobilityState!),
    });
  }
  let previousUtcMs = anchor.simTimeMs;
  return Object.freeze(sampleTimes.map(absoluteUtcMs => {
    const deltaSec = (absoluteUtcMs - previousUtcMs) / 1000;
    const replayTimeSec = (absoluteUtcMs - anchor.epochUtcMs) / 1000;
    const states = Object.freeze(scenario.ues.map(ue => futureUePosition(
      scenario,
      ue,
      replayTimeSec,
      cursors.get(ue.ueId) ?? null,
      deltaSec,
    )));
    previousUtcMs = absoluteUtcMs;
    return states;
  }));
}

/**
 * Build authoritative future Walker frames from one immutable accepted anchor.
 *
 * `sampleStartTimesUtcMs` is an ordered list on the same absolute UTC
 * millisecond axis as `anchor.simTimeMs`. The provider deliberately propagates
 * each requested instant directly; it never reads the 20-second render
 * trajectory cache and never advances live runtime state.
 */
export function buildWalkerForecastFrames(
  anchorInput: WalkerForecastAnchor,
  sampleStartTimesUtcMs: readonly number[],
): readonly WalkerForecastFrame[] {
  const anchor = createWalkerForecastAnchor(anchorInput);
  const sampleTimes = validateRequestedTimes(anchor, sampleStartTimesUtcMs);
  const scenario = anchor.immutableScenarioState;
  if (sampleTimes.length > 1 && scenario.beams.some(beam => beam.axis.axisSource === 'accepted-sampled-axis')) {
    fail(
      'INVALID_GEOMETRY',
      'accepted-sampled-axis cannot be extrapolated across a multi-sample forecast; provide earth-fixed targets or per-sample axis provenance',
    );
  }
  const observer = createObserverContext(
    scenario.observer.latDeg,
    scenario.observer.lonDeg,
    scenario.observer.altKm ?? 0,
  );
  const elements = generateWalkerConstellation({
    shells: scenario.shells as Shell[],
    epochUtcMs: anchor.epochUtcMs,
    observerLatDeg: observer.latDeg,
    observerLonDeg: observer.lonDeg,
    phaseSeed: scenario.constellationSeed,
  });
  const scenarioStateHash = digest('walker-scenario-state', {
    epochToken: anchor.epochToken,
    epochUtcMs: anchor.epochUtcMs,
    policyConfigHash: anchor.policyConfigHash,
    state: stateHashProjection(scenario),
  });
  const ueSequence = buildForecastUeSequence(anchor, scenario, sampleTimes);
  const frames = sampleTimes.map((absoluteUtcMs, index) => buildFrame(
    anchor,
    scenario,
    elements,
    observer,
    scenarioStateHash,
    absoluteUtcMs,
    ueSequence[index]!,
  ));
  frames[0]!.beams.forEach((beam, index) => {
    if (beam.scheduled !== scenario.beams[index]!.scheduled) {
      fail('INVALID_SCENARIO', `beams[${index}].scheduled does not match the declared anchor hopping phase`);
    }
  });
  return Object.freeze(frames);
}
