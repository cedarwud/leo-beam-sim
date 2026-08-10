import * as satellite from 'satellite.js';

import {
  C120RealDataError,
  type C120CelestrakOrbitRecord,
  type C120OrbitSourceReceipt,
} from './orbitSource';

/** Versioned model identity; no browser or course fixture owns this calculation. */
export const C120_SGP4_MODEL_VERSION = 'satellite.js@6.0.2-sgp4-omm-v1' as const;
export const C120_ORBIT_PROPAGATION_KIND = 'MODEL_DERIVED_ORBIT' as const;
export const C120_MAX_ORBIT_SEARCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const C120_MAX_PROPAGATION_EPOCH_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;
/** Date/ISO UTC output has millisecond resolution; smaller steps could repeat UTCs. */
export const C120_MIN_ORBIT_SAMPLE_STEP_SEC = 0.001;
export const C120_MAX_ORBIT_SAMPLE_STEP_SEC = 60 * 60;
export const C120_MAX_ORBIT_SAMPLES = 100_000;

export interface C120OrbitObserver {
  /** Geodetic latitude in degrees, WGS84-compatible satellite.js input. */
  readonly latitudeDeg: number;
  /** Geodetic longitude in degrees, east-positive. */
  readonly longitudeDeg: number;
  /** Observer height above the Earth ellipsoid in kilometres. */
  readonly heightKm: number;
}

export interface C120OrbitPropagationRequest {
  readonly observer: C120OrbitObserver;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly sampleStepSec: number;
  readonly minimumElevationDeg: number;
  /** Optional explicit source binding; orchestration always supplies these. */
  readonly expectedSourceSha256?: string;
  readonly expectedCatalogId?: number;
  readonly expectedObjectName?: string;
}

export interface C120OrbitSearchPolicy {
  readonly startUtc: string;
  readonly endUtc: string;
  readonly sampleStepSec: number;
  readonly minimumElevationDeg: number;
  readonly sampleCount: number;
}

export interface C120OrbitLookPoint {
  readonly utc: string;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
}

/**
 * Inclusive, ordered AOS-to-LOS model trace.  The enclosing propagation
 * receipt carries the `MODEL_DERIVED_ORBIT`, model-version, and `measured:false`
 * provenance for every point in this array; points are never live telemetry.
 */
export type C120OrbitTrajectory = readonly C120OrbitLookPoint[];

export interface C120OrbitPass {
  readonly aos: C120OrbitLookPoint;
  /** Highest point on the declared sampling grid; not a refined orbital extremum. */
  readonly peak: C120OrbitLookPoint;
  readonly los: C120OrbitLookPoint;
  /** Inclusive AOS-to-LOS trace: exact boundaries plus in-pass grid samples. */
  readonly trajectory: C120OrbitTrajectory;
  readonly durationSec: number;
  readonly clippedAtWindowStart: boolean;
  readonly clippedAtWindowEnd: boolean;
}

export interface C120OrbitPropagationReceipt {
  readonly kind: typeof C120_ORBIT_PROPAGATION_KIND;
  readonly model: typeof C120_SGP4_MODEL_VERSION;
  readonly measured: false;
  readonly source: Readonly<{
    readonly catalogId: number;
    readonly objectName: string;
    readonly sourceEpoch: string;
    readonly rawContentSha256: string;
  }>;
  readonly observer: C120OrbitObserver;
  readonly search: C120OrbitSearchPolicy;
  readonly pass: C120OrbitPass;
}

interface Sample extends C120OrbitLookPoint {
  readonly atMs: number;
}

function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  return value;
}

function fail(code: ConstructorParameters<typeof C120RealDataError>[0], message: string): never {
  throw new C120RealDataError(code, message);
}

function finite(
  value: unknown,
  label: string,
  code: ConstructorParameters<typeof C120RealDataError>[0] = 'ORBIT_REQUEST_INVALID',
): number {
  if (typeof value !== 'number') return fail(code, `${label} must be a number`);
  if (!Number.isFinite(value)) return fail(code, `${label} must be finite`);
  return value;
}

function parseUtc(value: unknown, label: string): { readonly text: string; readonly ms: number } {
  if (typeof value !== 'string' || value.trim() === '' || !value.endsWith('Z')) {
    return fail('ORBIT_REQUEST_INVALID', `${label} must be a UTC timestamp ending in Z`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return fail('ORBIT_REQUEST_INVALID', `${label} is not parseable UTC`);
  return { text: new Date(ms).toISOString(), ms };
}

function validateSourceBinding(source: C120OrbitSourceReceipt, request: C120OrbitPropagationRequest): void {
  if (!/^[0-9a-f]{64}$/.test(source.rawContentSha256)) return fail('ORBIT_IDENTITY_MISMATCH', 'source raw SHA-256 is malformed');
  if (request.expectedSourceSha256 !== undefined && request.expectedSourceSha256 !== source.rawContentSha256) {
    return fail('ORBIT_IDENTITY_MISMATCH', 'propagation source hash does not match source receipt');
  }
  if (request.expectedCatalogId !== undefined && request.expectedCatalogId !== source.catalogId) {
    return fail('ORBIT_IDENTITY_MISMATCH', 'propagation catalog id does not match source receipt');
  }
  if (request.expectedObjectName !== undefined && request.expectedObjectName !== source.objectName) {
    return fail('ORBIT_IDENTITY_MISMATCH', 'propagation object name does not match source receipt');
  }
  const recordCatalog = typeof source.record.NORAD_CAT_ID === 'number'
    ? source.record.NORAD_CAT_ID
    : Number(source.record.NORAD_CAT_ID);
  if (!Number.isFinite(recordCatalog)) return fail('ORBIT_IDENTITY_MISMATCH', 'source record catalog id is not finite');
  if (!Number.isInteger(recordCatalog) || recordCatalog !== source.catalogId) {
    return fail('ORBIT_IDENTITY_MISMATCH', 'source record catalog id does not match source receipt');
  }
  if (source.record.OBJECT_NAME !== source.objectName) {
    return fail('ORBIT_IDENTITY_MISMATCH', 'source record object name does not match source receipt');
  }
}

function normalizeRequest(source: C120OrbitSourceReceipt, request: C120OrbitPropagationRequest): {
  readonly observer: C120OrbitObserver;
  readonly search: C120OrbitSearchPolicy;
} {
  if (typeof request !== 'object' || request === null) return fail('ORBIT_REQUEST_INVALID', 'propagation request must be an object');
  validateSourceBinding(source, request);
  const latitudeDeg = finite(request.observer?.latitudeDeg, 'observer.latitudeDeg');
  const longitudeDeg = finite(request.observer?.longitudeDeg, 'observer.longitudeDeg');
  const heightKm = finite(request.observer?.heightKm, 'observer.heightKm');
  if (latitudeDeg < -90 || latitudeDeg > 90) return fail('ORBIT_REQUEST_INVALID', 'observer.latitudeDeg must be in [-90, 90]');
  if (longitudeDeg < -180 || longitudeDeg > 180) return fail('ORBIT_REQUEST_INVALID', 'observer.longitudeDeg must be in [-180, 180]');
  if (heightKm < -1 || heightKm > 100) return fail('ORBIT_REQUEST_INVALID', 'observer.heightKm must be in [-1, 100] km');

  const start = parseUtc(request.startUtc, 'startUtc');
  const end = parseUtc(request.endUtc, 'endUtc');
  const sourceEpochMs = Date.parse(source.sourceEpoch);
  if (!Number.isFinite(sourceEpochMs)) return fail('ORBIT_IDENTITY_MISMATCH', 'source epoch is not parseable UTC');
  if (Math.abs(start.ms - sourceEpochMs) > C120_MAX_PROPAGATION_EPOCH_OFFSET_MS
    || Math.abs(end.ms - sourceEpochMs) > C120_MAX_PROPAGATION_EPOCH_OFFSET_MS) {
    return fail('ORBIT_REQUEST_INVALID', 'search window is too far from the source epoch');
  }
  const durationMs = end.ms - start.ms;
  if (durationMs <= 0) return fail('ORBIT_REQUEST_INVALID', 'search window must be forward and non-empty');
  if (durationMs > C120_MAX_ORBIT_SEARCH_WINDOW_MS) return fail('ORBIT_REQUEST_INVALID', 'search window exceeds bounded maximum');
  const sampleStepSec = finite(request.sampleStepSec, 'sampleStepSec');
  if (sampleStepSec < C120_MIN_ORBIT_SAMPLE_STEP_SEC || sampleStepSec > C120_MAX_ORBIT_SAMPLE_STEP_SEC) {
    return fail(
      'ORBIT_REQUEST_INVALID',
      `sampleStepSec must be in [${C120_MIN_ORBIT_SAMPLE_STEP_SEC}, ${C120_MAX_ORBIT_SAMPLE_STEP_SEC}]`,
    );
  }
  const minimumElevationDeg = finite(request.minimumElevationDeg, 'minimumElevationDeg');
  if (minimumElevationDeg < -90 || minimumElevationDeg > 90) {
    return fail('ORBIT_REQUEST_INVALID', 'minimumElevationDeg must be in [-90, 90]');
  }
  const sampleCount = Math.ceil(durationMs / (sampleStepSec * 1000)) + 1;
  if (!Number.isSafeInteger(sampleCount) || sampleCount > C120_MAX_ORBIT_SAMPLES) {
    return fail('ORBIT_REQUEST_INVALID', 'search window and sample step exceed bounded sample count');
  }
  return {
    observer: Object.freeze({ latitudeDeg, longitudeDeg, heightKm }),
    search: Object.freeze({
      startUtc: start.text,
      endUtc: end.text,
      sampleStepSec,
      minimumElevationDeg,
      sampleCount,
    }),
  };
}

function requiredOmmRecord(record: C120CelestrakOrbitRecord): satellite.OMMJsonObject {
  const objectId = record.OBJECT_ID;
  const elementSetNo = record.ELEMENT_SET_NO;
  const revAtEpoch = record.REV_AT_EPOCH;
  const bstar = record.BSTAR;
  const meanMotionDot = record.MEAN_MOTION_DOT;
  const meanMotionDdot = record.MEAN_MOTION_DDOT;
  if (objectId === undefined) return fail('ORBIT_PROPAGATION_FAILED', 'OMM field OBJECT_ID is missing');
  if (elementSetNo === undefined) return fail('ORBIT_PROPAGATION_FAILED', 'OMM field ELEMENT_SET_NO is missing');
  if (bstar === undefined) return fail('ORBIT_PROPAGATION_FAILED', 'OMM field BSTAR is missing');
  if (meanMotionDot === undefined) return fail('ORBIT_PROPAGATION_FAILED', 'OMM field MEAN_MOTION_DOT is missing');
  if (meanMotionDdot === undefined) return fail('ORBIT_PROPAGATION_FAILED', 'OMM field MEAN_MOTION_DDOT is missing');
  if (record.EPHEMERIS_TYPE !== undefined && record.EPHEMERIS_TYPE !== 0 && record.EPHEMERIS_TYPE !== '0') {
    return fail('ORBIT_PROPAGATION_FAILED', 'OMM EPHEMERIS_TYPE must be 0');
  }
  if (typeof objectId !== 'string' || objectId.trim() === '') return fail('ORBIT_PROPAGATION_FAILED', 'OMM OBJECT_ID is missing');
  const classification = record.CLASSIFICATION_TYPE;
  if (classification !== undefined && classification !== 'U' && classification !== 'C') {
    return fail('ORBIT_PROPAGATION_FAILED', 'OMM CLASSIFICATION_TYPE is unsupported');
  }
  return {
    OBJECT_NAME: record.OBJECT_NAME,
    OBJECT_ID: objectId,
    EPOCH: record.EPOCH,
    MEAN_MOTION: record.MEAN_MOTION,
    ECCENTRICITY: record.ECCENTRICITY,
    INCLINATION: record.INCLINATION,
    RA_OF_ASC_NODE: record.RA_OF_ASC_NODE,
    ARG_OF_PERICENTER: record.ARG_OF_PERICENTER,
    MEAN_ANOMALY: record.MEAN_ANOMALY,
    EPHEMERIS_TYPE: record.EPHEMERIS_TYPE as 0 | '0' | undefined,
    CLASSIFICATION_TYPE: classification as 'U' | 'C' | undefined,
    NORAD_CAT_ID: record.NORAD_CAT_ID,
    ELEMENT_SET_NO: elementSetNo,
    REV_AT_EPOCH: revAtEpoch,
    BSTAR: bstar,
    MEAN_MOTION_DOT: meanMotionDot,
    MEAN_MOTION_DDOT: meanMotionDdot,
  };
}

function assertFiniteVector(value: unknown, label: string): { readonly x: number; readonly y: number; readonly z: number } {
  if (typeof value !== 'object' || value === null) return fail('ORBIT_PROPAGATION_FAILED', `${label} is missing`);
  const candidate = value as Record<string, unknown>;
  const x = finite(candidate.x, `${label}.x`, 'ORBIT_PROPAGATION_FAILED');
  const y = finite(candidate.y, `${label}.y`, 'ORBIT_PROPAGATION_FAILED');
  const z = finite(candidate.z, `${label}.z`, 'ORBIT_PROPAGATION_FAILED');
  return { x, y, z };
}

function toPoint(sample: Sample): C120OrbitLookPoint {
  return {
    utc: sample.utc,
    azimuthDeg: sample.azimuthDeg,
    elevationDeg: sample.elevationDeg,
    rangeKm: sample.rangeKm,
  };
}

/**
 * Propagate one validated CelesTrak OMM source and find its first bounded pass.
 * All coordinates and times are model-derived; this module never labels them
 * measured or live telemetry.
 */
export function deriveC120OrbitPass(
  source: C120OrbitSourceReceipt,
  request: C120OrbitPropagationRequest,
): C120OrbitPropagationReceipt {
  const normalized = normalizeRequest(source, request);
  const omm = requiredOmmRecord(source.record);
  let satrec: satellite.SatRec;
  try {
    satrec = satellite.json2satrec(omm);
  } catch (error) {
    return fail('ORBIT_PROPAGATION_FAILED', error instanceof Error ? error.message : String(error));
  }
  if (!satrec || satrec.error !== 0) return fail('ORBIT_PROPAGATION_FAILED', `json2satrec returned error ${String(satrec?.error)}`);

  const observer = {
    latitude: satellite.degreesToRadians(normalized.observer.latitudeDeg),
    longitude: satellite.degreesToRadians(normalized.observer.longitudeDeg),
    height: normalized.observer.heightKm,
  };
  const threshold = normalized.search.minimumElevationDeg;
  const sampleAt = (atMs: number): Sample => {
    const date = new Date(atMs);
    let propagated: unknown;
    try {
      propagated = satellite.propagate(satrec, date);
    } catch (error) {
      return fail('ORBIT_PROPAGATION_FAILED', error instanceof Error ? error.message : String(error));
    }
    if (satrec.error !== 0) return fail('ORBIT_PROPAGATION_FAILED', `propagation returned error ${String(satrec.error)}`);
    if (typeof propagated !== 'object' || propagated === null) return fail('ORBIT_PROPAGATION_FAILED', 'propagation returned no state');
    const position = assertFiniteVector((propagated as Record<string, unknown>).position, 'propagation.position');
    let look: satellite.LookAngles;
    try {
      const ecf = satellite.eciToEcf(position, satellite.gstime(date));
      look = satellite.ecfToLookAngles(observer, ecf);
    } catch (error) {
      return fail('ORBIT_PROPAGATION_FAILED', error instanceof Error ? error.message : String(error));
    }
    const azimuthRad = finite(look.azimuth, 'look.azimuth', 'ORBIT_PROPAGATION_FAILED');
    const elevationRad = finite(look.elevation, 'look.elevation', 'ORBIT_PROPAGATION_FAILED');
    const rangeKm = finite(look.rangeSat, 'look.rangeSat', 'ORBIT_PROPAGATION_FAILED');
    const azimuthDeg = ((satellite.radiansToDegrees(azimuthRad) % 360) + 360) % 360;
    const elevationDeg = satellite.radiansToDegrees(elevationRad);
    if (!Number.isFinite(azimuthDeg) || !Number.isFinite(elevationDeg) || !Number.isFinite(rangeKm) || rangeKm <= 0) {
      return fail('ORBIT_PROPAGATION_FAILED', 'look-angle state is non-finite or range is not positive');
    }
    return {
      atMs,
      utc: date.toISOString(),
      azimuthDeg,
      elevationDeg,
      rangeKm,
    };
  };

  const interpolateCrossing = (previous: Sample, current: Sample): Sample => {
    const denominator = current.elevationDeg - previous.elevationDeg;
    const fraction = denominator === 0 ? 0.5 : (threshold - previous.elevationDeg) / denominator;
    const boundedFraction = Math.max(0, Math.min(1, fraction));
    const atMs = Math.round(previous.atMs + (current.atMs - previous.atMs) * boundedFraction);
    return sampleAt(atMs);
  };

  let previous: Sample | undefined;
  let active = false;
  let passStart: Sample | undefined;
  let passPeak: Sample | undefined;
  let passEnd: Sample | undefined;
  const passSamples: Sample[] = [];
  let clippedAtWindowStart = false;
  let clippedAtWindowEnd = false;
  const startMs = Date.parse(normalized.search.startUtc);
  const endMs = Date.parse(normalized.search.endUtc);
  const stepMs = normalized.search.sampleStepSec * 1000;
  for (let index = 0; index < normalized.search.sampleCount; index += 1) {
    const atMs = Math.min(endMs, startMs + index * stepMs);
    const current = sampleAt(atMs);
    const currentAbove = current.elevationDeg >= threshold;
    const previousAbove = previous !== undefined && previous.elevationDeg >= threshold;
    if (!active && currentAbove) {
      active = true;
      clippedAtWindowStart = previous === undefined;
      passStart = previous !== undefined && !previousAbove ? interpolateCrossing(previous, current) : current;
      passPeak = current;
      passSamples.push(current);
    } else if (active) {
      if (currentAbove) {
        if (passPeak === undefined || current.elevationDeg > passPeak.elevationDeg) passPeak = current;
        passSamples.push(current);
      } else {
        passEnd = previous !== undefined && previousAbove ? interpolateCrossing(previous, current) : current;
        break;
      }
    }
    previous = current;
    if (atMs >= endMs) break;
  }
  if (!active || passStart === undefined || passPeak === undefined) {
    return fail('ORBIT_NO_PASS', `no pass reaches minimum elevation ${threshold} deg in search window`);
  }
  if (passEnd === undefined) {
    if (previous === undefined) return fail('ORBIT_NO_PASS', 'search window produced no terminal sample');
    passEnd = previous;
    clippedAtWindowEnd = true;
  }
  const durationSec = (passEnd.atMs - passStart.atMs) / 1000;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return fail('ORBIT_PROPAGATION_FAILED', 'derived pass duration is invalid');

  // Construct the inclusive trace from the same samples used to derive the
  // legacy AOS/peak/LOS fields.  Boundary interpolation can coincide with a
  // grid sample, so de-duplicate by canonical UTC while preserving order.
  const trajectoryPoints: C120OrbitLookPoint[] = [];
  const pointsByUtc = new Map<string, C120OrbitLookPoint>();
  const appendPoint = (sample: Sample): C120OrbitLookPoint => {
    const existing = pointsByUtc.get(sample.utc);
    if (existing !== undefined) return existing;
    const point = toPoint(sample);
    const pointMs = Date.parse(point.utc);
    if (!Number.isFinite(pointMs)) return fail('ORBIT_PROPAGATION_FAILED', 'trajectory point UTC is not parseable');
    if (!Number.isFinite(point.azimuthDeg) || !Number.isFinite(point.elevationDeg) || !Number.isFinite(point.rangeKm)
      || point.rangeKm <= 0) {
      return fail('ORBIT_PROPAGATION_FAILED', 'trajectory point is non-finite or range is not positive');
    }
    const previousPoint = trajectoryPoints[trajectoryPoints.length - 1];
    if (previousPoint !== undefined && pointMs <= Date.parse(previousPoint.utc)) {
      return fail('ORBIT_PROPAGATION_FAILED', 'trajectory UTCs are not strictly increasing');
    }
    trajectoryPoints.push(point);
    pointsByUtc.set(point.utc, point);
    return point;
  };
  const aos = appendPoint(passStart);
  for (const sample of passSamples) appendPoint(sample);
  const peak = pointsByUtc.get(passPeak.utc);
  if (peak === undefined) return fail('ORBIT_PROPAGATION_FAILED', 'trajectory does not include the sampled peak');
  const los = appendPoint(passEnd);
  if (trajectoryPoints.length > normalized.search.sampleCount || trajectoryPoints.length > C120_MAX_ORBIT_SAMPLES) {
    return fail('ORBIT_PROPAGATION_FAILED', 'trajectory exceeds bounded sample count');
  }
  const trajectory = Object.freeze(trajectoryPoints) as C120OrbitTrajectory;

  return freezeDeep({
    kind: C120_ORBIT_PROPAGATION_KIND,
    model: C120_SGP4_MODEL_VERSION,
    measured: false as const,
    source: Object.freeze({
      catalogId: source.catalogId,
      objectName: source.objectName,
      sourceEpoch: source.sourceEpoch,
      rawContentSha256: source.rawContentSha256,
    }),
    observer: normalized.observer,
    search: normalized.search,
    pass: Object.freeze({
      aos,
      peak,
      los,
      trajectory,
      durationSec,
      clippedAtWindowStart,
      clippedAtWindowEnd,
    }),
  });
}

export const propagateC120Orbit = deriveC120OrbitPass;
