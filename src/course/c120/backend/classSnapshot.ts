import { createHash } from 'node:crypto';

import {
  C120_CONTRACT_VERSION,
  C120_COURSE_ID,
  C120_UNITS,
  type C120UnitContract,
} from '../contract';
import {
  C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND,
  C120_MODEL_DERIVED_ORBIT_KIND,
  C120_REAL_DATA_ARTIFACT_VERSION,
  verifyC120RealDataArtifactContentAddress,
  type C120RealDataArtifact,
} from './realDataArtifact';
import {
  CELESTRAK_ONEWEB_GP_URL,
  C120_ORBIT_SOURCE_KIND,
  C120RealDataError,
} from './orbitSource';
import {
  C120_MAX_ORBIT_SAMPLES,
  C120_SGP4_MODEL_VERSION,
} from './orbitPropagation';
import {
  C120_MAX_SCENE_RANGE_KM,
  C120_MAX_VISUAL_TRAJECTORY_POINTS,
} from './orbitSceneProjection';

/** A pre-class bundle is opt-in and never changes the default course provider. */
export const C120_CLASS_SNAPSHOT_VERSION = 'c120-pre-class-snapshot-v2' as const;
export const C120_CLASS_SNAPSHOT_KIND = 'C120_PRE_CLASS_SNAPSHOT' as const;
export const C120_BUNDLED_FALLBACK_RECEIPT_VERSION = 'c120-bundled-fallback-receipt-v1' as const;
export const C120_BUNDLED_FALLBACK_RECEIPT_KIND = 'BUNDLED_FALLBACK_RECEIPT' as const;

export type C120ClassSnapshotSourceMode = 'bundled';
export type C120ClassFallbackSourceMode = 'fallback';
export type C120ClassTruthKind =
  | typeof C120_ORBIT_SOURCE_KIND
  | typeof C120_MODEL_DERIVED_ORBIT_KIND
  | typeof C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND
  | 'COURSE_ASSUMPTION'
  | typeof C120_BUNDLED_FALLBACK_RECEIPT_KIND;

export interface C120ClassScenarioBinding {
  readonly courseId: typeof C120_COURSE_ID;
  readonly courseContractVersion: typeof C120_CONTRACT_VERSION;
  readonly providerId: string;
  readonly scenarioId: string;
  readonly units: C120UnitContract;
  readonly sourceMode: C120ClassSnapshotSourceMode;
  readonly measured: false;
  readonly wholeSatelliteCanonical: false;
}

export interface C120BundledFallbackDescriptor {
  /** Stable bundle identity, not a filename or a timestamp. */
  readonly bundleId: string;
  readonly bundleVersion: string;
  /** SHA-256 of the bytes shipped with the fallback bundle. */
  readonly bundleContentSha256: string;
  /** Content address of the fallback artifact represented by the bundle. */
  readonly fallbackArtifactId: string;
  readonly fallbackArtifactContentSha256: string;
}

export interface C120BundledFallbackReceipt extends C120BundledFallbackDescriptor {
  readonly schemaVersion: typeof C120_BUNDLED_FALLBACK_RECEIPT_VERSION;
  readonly kind: typeof C120_BUNDLED_FALLBACK_RECEIPT_KIND;
  readonly sourceMode: C120ClassFallbackSourceMode;
  readonly courseId: typeof C120_COURSE_ID;
  readonly courseContractVersion: typeof C120_CONTRACT_VERSION;
  readonly providerId: string;
  readonly scenarioId: string;
  readonly units: C120UnitContract;
  readonly measured: false;
  readonly wholeSatelliteCanonical: false;
  readonly receiptId: string;
  readonly contentSha256: string;
}

export interface C120ClassTruthLayer {
  readonly kind: C120ClassTruthKind;
  readonly scenarioId: string;
  readonly measured: false;
  readonly wholeSatelliteCanonical: false;
  readonly note: string;
}

export interface C120ClassSnapshot {
  readonly schemaVersion: typeof C120_CLASS_SNAPSHOT_VERSION;
  readonly kind: typeof C120_CLASS_SNAPSHOT_KIND;
  readonly snapshotId: string;
  readonly contentSha256: string;
  /** Materialization time supplied by the caller; never source retrieval time. */
  readonly generatedAt: string;
  readonly sourceRetrievedAt: string;
  readonly sourceEpoch: string;
  readonly scenarioId: string;
  readonly sourceMode: C120ClassSnapshotSourceMode;
  readonly scenarioBinding: C120ClassScenarioBinding;
  readonly artifactRef: Readonly<{
    readonly artifactId: string;
    readonly contentSha256: string;
  }>;
  /** The already verified source/model/canonical-parity artifact, JSON-safe. */
  readonly artifact: C120RealDataArtifact;
  readonly truthLayers: readonly C120ClassTruthLayer[];
  readonly claims: readonly C120ClassTruthKind[];
  /** Receipt only; it carries no invented course replay energy. */
  readonly fallbackReceipt: C120BundledFallbackReceipt;
  readonly measured: false;
  readonly wholeSatelliteCanonical: false;
}

export interface C120ClassSnapshotMaterializerRequest {
  readonly artifact: C120RealDataArtifact;
  /** Required to keep snapshot hashes reproducible and avoid Date.now(). */
  readonly generatedAt: string;
  readonly fallbackReceipt: C120BundledFallbackReceipt;
}

const SNAPSHOT_KEYS = Object.freeze([
  'schemaVersion', 'kind', 'snapshotId', 'contentSha256', 'generatedAt', 'sourceRetrievedAt', 'sourceEpoch',
  'scenarioId', 'sourceMode', 'scenarioBinding', 'artifactRef', 'artifact', 'truthLayers', 'claims',
  'fallbackReceipt', 'measured', 'wholeSatelliteCanonical',
]);
const FALLBACK_KEYS = Object.freeze([
  'schemaVersion', 'kind', 'sourceMode', 'courseId', 'courseContractVersion', 'providerId', 'scenarioId',
  'units', 'bundleId', 'bundleVersion', 'bundleContentSha256', 'fallbackArtifactId',
  'fallbackArtifactContentSha256', 'measured', 'wholeSatelliteCanonical', 'receiptId', 'contentSha256',
]);
const TRUTH_LAYER_KEYS = Object.freeze(['kind', 'scenarioId', 'measured', 'wholeSatelliteCanonical', 'note']);
const TRUTH_LAYER_ORDER: readonly C120ClassTruthKind[] = Object.freeze([
  C120_ORBIT_SOURCE_KIND,
  C120_MODEL_DERIVED_ORBIT_KIND,
  C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND,
  'COURSE_ASSUMPTION',
  C120_BUNDLED_FALLBACK_RECEIPT_KIND,
]);
const ARTIFACT_KEYS = Object.freeze([
  'artifactVersion', 'artifactId', 'contentSha256', 'courseId', 'courseContractVersion', 'providerId', 'scenarioId',
  'units', 'measured', 'wholeSatelliteCanonical', 'source', 'orbit', 'energy', 'assumptions', 'provenance', 'claims',
]);
const SOURCE_KEYS = Object.freeze([
  'kind', 'catalogId', 'objectName', 'sourceEpoch', 'retrievedAt', 'url', 'rawContentSha256', 'responseBytes',
  'record', 'numericFields', 'stringFields', 'tle',
]);
const SOURCE_RECORD_KEYS = Object.freeze([
  'OBJECT_NAME', 'OBJECT_ID', 'EPOCH', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'EPHEMERIS_TYPE', 'CLASSIFICATION_TYPE', 'NORAD_CAT_ID',
  'ELEMENT_SET_NO', 'REV_AT_EPOCH', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT', 'TLE_LINE0', 'TLE_LINE1', 'TLE_LINE2',
]);
const SOURCE_NUMERIC_KEYS = Object.freeze([
  'NORAD_CAT_ID', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY',
  'EPHEMERIS_TYPE', 'ELEMENT_SET_NO', 'REV_AT_EPOCH', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT',
]);
const SOURCE_STRING_KEYS = Object.freeze(['OBJECT_NAME', 'OBJECT_ID', 'CLASSIFICATION_TYPE', 'TLE_LINE0', 'TLE_LINE1', 'TLE_LINE2']);
const TLE_KEYS = Object.freeze(['line0', 'line1', 'line2']);
const ORBIT_KEYS = Object.freeze(['kind', 'model', 'measured', 'source', 'observer', 'search', 'pass', 'status']);
const ORBIT_SOURCE_KEYS = Object.freeze(['catalogId', 'objectName', 'sourceEpoch', 'rawContentSha256']);
const OBSERVER_KEYS = Object.freeze(['latitudeDeg', 'longitudeDeg', 'heightKm']);
const SEARCH_KEYS = Object.freeze(['startUtc', 'endUtc', 'sampleStepSec', 'minimumElevationDeg', 'sampleCount']);
const PASS_KEYS = Object.freeze([
  'aos', 'peak', 'los', 'trajectory', 'durationSec', 'clippedAtWindowStart', 'clippedAtWindowEnd',
]);
const LOOK_POINT_KEYS = Object.freeze(['utc', 'azimuthDeg', 'elevationDeg', 'rangeKm']);
const ENERGY_KEYS = Object.freeze([
  'kind', 'scope', 'measured', 'contractVersion', 'runtimeSha256', 'goldenFixtureSha256', 'numericTolerance', 'cases', 'evaluation',
]);
const TOLERANCE_KEYS = Object.freeze(['rtol', 'atol']);
const CASE_KEYS = Object.freeze(['id', 'mode', 'output']);
const EVALUATION_KEYS = Object.freeze(['id', 'mode', 'output']);
const CLOSURE_OUTPUT_KEYS = Object.freeze([
  'composite_gain_ub', 'contract_version', 'eta_pa_b', 'gamma_req_b', 'interference_u_w', 'p_dl_b_w',
  'p_dl_before_sat_cap_b_w', 'p_req_b_w', 'p_req_u_w', 'p_tot_b_w', 'power_limited_u', 'qos_met_u',
  'r1_u_bits_per_j', 'rate_u_bps', 'received_power_ub_w', 'satellite_scale_b', 'signal_u_w', 'sinr_u',
  'system_accounting', 'system_consumed_power_w', 'system_ee_bits_per_j', 'system_throughput_bps', 'transmit_gain_ub',
]);
const ACCOUNTING_KEYS = Object.freeze([
  'per_user_contributions_bits_per_j', 'system_consumed_power_w', 'system_ee_bits_per_j', 'system_throughput_bps', 'zero_over_zero',
]);
const EVALUATION_OUTPUT_KEYS = Object.freeze(['consumed_energy_j', 'delivered_bits', 'energy_efficiency_bits_per_j', 'zero_over_zero']);
const ASSUMPTION_KEYS = Object.freeze(['kind', 'measured', 'values']);
const PROVENANCE_KEYS = Object.freeze(['kind', 'measured', 'note']);

function fail(message: string): never {
  throw new C120RealDataError('ARTIFACT_INVALID', `class snapshot violation: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) return fail(`${label} must be a plain object`);
  return value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) return fail(`${label} has unknown or missing fields`);
}

function keysWithin(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length > 0) return fail(`${label} has unknown fields: ${unknown.join(',')}`);
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') return fail(`${label} must be non-empty text`);
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`${label} must be finite numeric data`);
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') return fail(`${label} must be boolean`);
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isContentAddress(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

/** Canonical JSON is the only addressable representation of this module. */
function canonicalize(value: unknown, path = 'value', inArray = false): unknown {
  if (value === undefined) {
    if (inArray) return fail(`${path} must not be undefined`);
    return undefined;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fail(`${path} must be finite`);
    return value;
  }
  if (Array.isArray(value)) return value.map((child, index) => canonicalize(child, `${path}[${index}]`, true));
  if (!isRecord(value)) return fail(`${path} contains an unsupported value`);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const child = canonicalize(value[key], `${path}.${key}`);
    if (child !== undefined) result[key] = child;
  }
  return result;
}

function canonicalJson(value: unknown): string {
  const json = JSON.stringify(canonicalize(value));
  if (json === undefined) return fail('value cannot be serialized as JSON');
  return json;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  if (Array.isArray(value)) {
    value.forEach(item => freezeDeep(item));
  } else {
    Object.values(value as Record<string, unknown>).forEach(child => freezeDeep(child));
  }
  return value;
}

function parseUtc(value: unknown, label: string): string {
  const text = nonEmptyString(value, label);
  if (!text.endsWith('Z') || !Number.isFinite(Date.parse(text))) return fail(`${label} must be parseable UTC ending in Z`);
  return text;
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function validateUnits(value: unknown, label: string): C120UnitContract {
  const units = record(value, label);
  exactKeys(units, Object.keys(C120_UNITS), label);
  if (!sameJson(units, C120_UNITS)) return fail(`${label} mismatch`);
  return cloneJson(C120_UNITS);
}

function validateScenarioBinding(value: unknown, artifact: C120RealDataArtifact): C120ClassScenarioBinding {
  const binding = record(value, 'scenarioBinding');
  exactKeys(binding, [
    'courseId', 'courseContractVersion', 'providerId', 'scenarioId', 'units', 'sourceMode', 'measured', 'wholeSatelliteCanonical',
  ], 'scenarioBinding');
  if (binding.courseId !== C120_COURSE_ID || binding.courseContractVersion !== C120_CONTRACT_VERSION) {
    return fail('scenario binding course identity mismatch');
  }
  if (binding.providerId !== artifact.providerId || binding.scenarioId !== artifact.scenarioId) {
    return fail('scenario binding provider/scenario mismatch');
  }
  if (binding.sourceMode !== 'bundled' || binding.measured !== false || binding.wholeSatelliteCanonical !== false) {
    return fail('scenario binding truth boundary mismatch');
  }
  const units = validateUnits(binding.units, 'scenarioBinding.units');
  if (!sameJson(units, artifact.units)) return fail('scenario binding units do not match artifact units');
  return {
    courseId: C120_COURSE_ID,
    courseContractVersion: C120_CONTRACT_VERSION,
    providerId: artifact.providerId,
    scenarioId: artifact.scenarioId,
    units,
    sourceMode: 'bundled',
    measured: false,
    wholeSatelliteCanonical: false,
  };
}

function validateNumericArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) return fail(`${label} must be an array`);
  const visit = (item: unknown, path: string): void => {
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    finiteNumber(item, path);
  };
  visit(value, label);
}

function validateBooleanArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) return fail(`${label} must be an array`);
  const visit = (item: unknown, path: string): void => {
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    booleanValue(item, path);
  };
  visit(value, label);
}

function validateLookPoint(value: unknown, label: string): void {
  const point = record(value, label);
  exactKeys(point, LOOK_POINT_KEYS, label);
  parseUtc(point.utc, `${label}.utc`);
  finiteNumber(point.azimuthDeg, `${label}.azimuthDeg`);
  finiteNumber(point.elevationDeg, `${label}.elevationDeg`);
  if (finiteNumber(point.azimuthDeg, `${label}.azimuthDeg`) < 0 || finiteNumber(point.azimuthDeg, `${label}.azimuthDeg`) >= 360) {
    return fail(`${label}.azimuthDeg is outside [0,360)`);
  }
  if (finiteNumber(point.elevationDeg, `${label}.elevationDeg`) < -90 || finiteNumber(point.elevationDeg, `${label}.elevationDeg`) > 90) {
    return fail(`${label}.elevationDeg is outside [-90,90]`);
  }
  const rangeKm = finiteNumber(point.rangeKm, `${label}.rangeKm`);
  if (rangeKm <= 0 || rangeKm > C120_MAX_SCENE_RANGE_KM) {
    return fail(`${label}.rangeKm must be in (0, ${C120_MAX_SCENE_RANGE_KM}] km`);
  }
}

function validateSourceLayer(source: Record<string, unknown>): void {
  exactKeys(source, SOURCE_KEYS, 'artifact.source');
  if (source.kind !== C120_ORBIT_SOURCE_KIND || source.url !== CELESTRAK_ONEWEB_GP_URL || !isSha256(source.rawContentSha256)) {
    return fail('artifact source identity/hash mismatch');
  }
  if (!Number.isInteger(finiteNumber(source.catalogId, 'artifact.source.catalogId')) || finiteNumber(source.catalogId, 'artifact.source.catalogId') <= 0) {
    return fail('artifact.source.catalogId must be a positive integer');
  }
  nonEmptyString(source.objectName, 'artifact.source.objectName');
  parseUtc(source.retrievedAt, 'artifact.source.retrievedAt');
  parseUtc(source.sourceEpoch, 'artifact.source.sourceEpoch');
  if (finiteNumber(source.responseBytes, 'artifact.source.responseBytes') <= 0 || !Number.isInteger(source.responseBytes)) {
    return fail('artifact.source.responseBytes must be a positive integer');
  }
  const recordValue = record(source.record, 'artifact.source.record');
  keysWithin(recordValue, SOURCE_RECORD_KEYS, 'artifact.source.record');
  for (const required of ['OBJECT_NAME', 'EPOCH', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'NORAD_CAT_ID']) {
    if (!(required in recordValue)) return fail(`artifact.source.record.${required} is missing`);
  }
  for (const [key, value] of Object.entries(recordValue)) {
    if (value === undefined) continue;
    if (SOURCE_NUMERIC_KEYS.includes(key)) {
      const parsed = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : Number.NaN);
      if (!Number.isFinite(parsed)) return fail(`artifact.source.record.${key} must be finite numeric data`);
    } else if (typeof value !== 'string' || value.trim() === '') {
      return fail(`artifact.source.record.${key} must be non-empty text`);
    }
  }
  if (recordValue.OBJECT_NAME !== source.objectName || Number(recordValue.NORAD_CAT_ID) !== source.catalogId) {
    return fail('artifact.source.record identity mismatch');
  }
  const numericFields = record(source.numericFields, 'artifact.source.numericFields');
  keysWithin(numericFields, SOURCE_NUMERIC_KEYS, 'artifact.source.numericFields');
  Object.entries(numericFields).forEach(([key, value]) => finiteNumber(value, `artifact.source.numericFields.${key}`));
  const stringFields = record(source.stringFields, 'artifact.source.stringFields');
  keysWithin(stringFields, SOURCE_STRING_KEYS, 'artifact.source.stringFields');
  Object.entries(stringFields).forEach(([key, value]) => nonEmptyString(value, `artifact.source.stringFields.${key}`));
  const tle = record(source.tle, 'artifact.source.tle');
  keysWithin(tle, TLE_KEYS, 'artifact.source.tle');
  Object.entries(tle).forEach(([key, value]) => {
    if (value !== undefined) nonEmptyString(value, `artifact.source.tle.${key}`);
  });
}

function validateOrbitLayer(orbit: Record<string, unknown>, source: Record<string, unknown>): void {
  exactKeys(orbit, ORBIT_KEYS, 'artifact.orbit');
  if (orbit.kind !== C120_MODEL_DERIVED_ORBIT_KIND || orbit.model !== C120_SGP4_MODEL_VERSION
    || orbit.status !== 'READY' || orbit.measured !== false) {
    return fail('artifact orbit truth/status/model mismatch');
  }
  const orbitSource = record(orbit.source, 'artifact.orbit.source');
  exactKeys(orbitSource, ORBIT_SOURCE_KEYS, 'artifact.orbit.source');
  if (orbitSource.catalogId !== source.catalogId || orbitSource.objectName !== source.objectName
    || orbitSource.sourceEpoch !== source.sourceEpoch || orbitSource.rawContentSha256 !== source.rawContentSha256) {
    return fail('artifact.orbit.source provenance mismatch');
  }
  const observer = record(orbit.observer, 'artifact.orbit.observer');
  exactKeys(observer, OBSERVER_KEYS, 'artifact.orbit.observer');
  const latitude = finiteNumber(observer.latitudeDeg, 'artifact.orbit.observer.latitudeDeg');
  const longitude = finiteNumber(observer.longitudeDeg, 'artifact.orbit.observer.longitudeDeg');
  const height = finiteNumber(observer.heightKm, 'artifact.orbit.observer.heightKm');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || height < -1 || height > 100) {
    return fail('artifact.orbit.observer range mismatch');
  }
  const search = record(orbit.search, 'artifact.orbit.search');
  exactKeys(search, SEARCH_KEYS, 'artifact.orbit.search');
  parseUtc(search.startUtc, 'artifact.orbit.search.startUtc');
  parseUtc(search.endUtc, 'artifact.orbit.search.endUtc');
  const sampleCount = finiteNumber(search.sampleCount, 'artifact.orbit.search.sampleCount');
  if (Date.parse(search.endUtc as string) <= Date.parse(search.startUtc as string)
    || finiteNumber(search.sampleStepSec, 'artifact.orbit.search.sampleStepSec') <= 0
    || finiteNumber(search.minimumElevationDeg, 'artifact.orbit.search.minimumElevationDeg') < -90
    || finiteNumber(search.minimumElevationDeg, 'artifact.orbit.search.minimumElevationDeg') > 90
    || !Number.isInteger(sampleCount) || sampleCount <= 0 || sampleCount > C120_MAX_ORBIT_SAMPLES) {
    return fail('artifact.orbit.search policy mismatch');
  }
  const pass = record(orbit.pass, 'artifact.orbit.pass');
  exactKeys(pass, PASS_KEYS, 'artifact.orbit.pass');
  validateLookPoint(pass.aos, 'artifact.orbit.pass.aos');
  validateLookPoint(pass.peak, 'artifact.orbit.pass.peak');
  validateLookPoint(pass.los, 'artifact.orbit.pass.los');
  if (!Array.isArray(pass.trajectory)
    || pass.trajectory.length < 2
    || pass.trajectory.length > C120_MAX_VISUAL_TRAJECTORY_POINTS) {
    return fail(`artifact.orbit.pass.trajectory must contain 2-${C120_MAX_VISUAL_TRAJECTORY_POINTS} points`);
  }
  pass.trajectory.forEach((point, index) => validateLookPoint(point, `artifact.orbit.pass.trajectory[${index}]`));
  if (!sameJson(pass.trajectory[0], pass.aos)
    || !sameJson(pass.trajectory[pass.trajectory.length - 1], pass.los)) {
    return fail('artifact.orbit.pass.trajectory endpoints must exactly match AOS and LOS');
  }
  const trajectoryUtcMs = pass.trajectory.map((point, index) => (
    Date.parse(record(point, `artifact.orbit.pass.trajectory[${index}]`).utc as string)
  ));
  for (let index = 1; index < trajectoryUtcMs.length; index += 1) {
    if (trajectoryUtcMs[index]! <= trajectoryUtcMs[index - 1]!) {
      return fail('artifact.orbit.pass.trajectory UTC values must be strictly increasing');
    }
  }
  if (!pass.trajectory.some(point => sameJson(point, pass.peak))) {
    return fail('artifact.orbit.pass.trajectory must contain the exact peak sample');
  }
  const aosMs = Date.parse(record(pass.aos, 'artifact.orbit.pass.aos').utc as string);
  const peakMs = Date.parse(record(pass.peak, 'artifact.orbit.pass.peak').utc as string);
  const losMs = Date.parse(record(pass.los, 'artifact.orbit.pass.los').utc as string);
  const expectedDurationSec = (losMs - aosMs) / 1000;
  if (finiteNumber(pass.durationSec, 'artifact.orbit.pass.durationSec') <= 0
    || pass.durationSec !== expectedDurationSec
    || peakMs < aosMs || peakMs > losMs
    || typeof pass.clippedAtWindowStart !== 'boolean' || typeof pass.clippedAtWindowEnd !== 'boolean') {
    return fail('artifact.orbit.pass metadata mismatch');
  }
}

function validateClosureOutput(value: unknown, label: string): void {
  const output = record(value, label);
  exactKeys(output, CLOSURE_OUTPUT_KEYS, label);
  if (output.contract_version !== C120_CONTRACT_VERSION && output.contract_version !== 'family-b-thesis-3.13-3.17-v1') {
    return fail(`${label}.contract_version mismatch`);
  }
  for (const key of [
    'composite_gain_ub', 'eta_pa_b', 'gamma_req_b', 'interference_u_w', 'p_dl_b_w', 'p_dl_before_sat_cap_b_w',
    'p_req_b_w', 'p_req_u_w', 'p_tot_b_w', 'r1_u_bits_per_j', 'rate_u_bps', 'received_power_ub_w',
    'satellite_scale_b', 'signal_u_w', 'sinr_u', 'transmit_gain_ub',
  ]) validateNumericArray(output[key], `${label}.${key}`);
  validateBooleanArray(output.power_limited_u, `${label}.power_limited_u`);
  validateBooleanArray(output.qos_met_u, `${label}.qos_met_u`);
  finiteNumber(output.system_consumed_power_w, `${label}.system_consumed_power_w`);
  finiteNumber(output.system_ee_bits_per_j, `${label}.system_ee_bits_per_j`);
  finiteNumber(output.system_throughput_bps, `${label}.system_throughput_bps`);
  const accounting = record(output.system_accounting, `${label}.system_accounting`);
  exactKeys(accounting, ACCOUNTING_KEYS, `${label}.system_accounting`);
  validateNumericArray(accounting.per_user_contributions_bits_per_j, `${label}.system_accounting.per_user_contributions_bits_per_j`);
  finiteNumber(accounting.system_consumed_power_w, `${label}.system_accounting.system_consumed_power_w`);
  finiteNumber(accounting.system_ee_bits_per_j, `${label}.system_accounting.system_ee_bits_per_j`);
  finiteNumber(accounting.system_throughput_bps, `${label}.system_accounting.system_throughput_bps`);
  booleanValue(accounting.zero_over_zero, `${label}.system_accounting.zero_over_zero`);
  canonicalJson(output);
}

function validateEnergyLayer(energy: Record<string, unknown>): void {
  exactKeys(energy, ENERGY_KEYS, 'artifact.energy');
  if (energy.kind !== C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND
    || energy.scope !== 'GOLDEN_VECTOR_PARITY_ONLY'
    || energy.measured !== false
    || energy.contractVersion !== 'family-b-thesis-3.13-3.17-v1'
    || !isSha256(energy.runtimeSha256)
    || !isSha256(energy.goldenFixtureSha256)) {
    return fail('artifact energy must remain pinned golden-vector parity only');
  }
  const tolerance = record(energy.numericTolerance, 'artifact.energy.numericTolerance');
  exactKeys(tolerance, TOLERANCE_KEYS, 'artifact.energy.numericTolerance');
  if (finiteNumber(tolerance.rtol, 'artifact.energy.numericTolerance.rtol') < 0
    || finiteNumber(tolerance.atol, 'artifact.energy.numericTolerance.atol') < 0) {
    return fail('artifact.energy.numericTolerance domain mismatch');
  }
  if (!Array.isArray(energy.cases) || energy.cases.length !== 3) return fail('artifact.energy.cases must contain the pinned three vectors');
  const expectedIds = ['fixed_load_on_axis', 'fixed_load_off_axis', 'coupled_interference'];
  energy.cases.forEach((raw, index) => {
    const item = record(raw, `artifact.energy.cases[${index}]`);
    exactKeys(item, CASE_KEYS, `artifact.energy.cases[${index}]`);
    if (item.id !== expectedIds[index] || item.mode !== 'closure') return fail(`artifact.energy.cases[${index}] identity mismatch`);
    validateClosureOutput(item.output, `artifact.energy.cases[${index}].output`);
  });
  const evaluation = record(energy.evaluation, 'artifact.energy.evaluation');
  exactKeys(evaluation, EVALUATION_KEYS, 'artifact.energy.evaluation');
  if (evaluation.id !== 'evaluation_vector' || evaluation.mode !== 'evaluation') return fail('artifact.energy.evaluation identity mismatch');
  const output = record(evaluation.output, 'artifact.energy.evaluation.output');
  exactKeys(output, EVALUATION_OUTPUT_KEYS, 'artifact.energy.evaluation.output');
  finiteNumber(output.consumed_energy_j, 'artifact.energy.evaluation.output.consumed_energy_j');
  finiteNumber(output.delivered_bits, 'artifact.energy.evaluation.output.delivered_bits');
  finiteNumber(output.energy_efficiency_bits_per_j, 'artifact.energy.evaluation.output.energy_efficiency_bits_per_j');
  booleanValue(output.zero_over_zero, 'artifact.energy.evaluation.output.zero_over_zero');
  canonicalJson(output);
}

function validateArtifact(artifact: unknown): C120RealDataArtifact {
  const candidateRecord = record(artifact, 'artifact');
  exactKeys(candidateRecord, ARTIFACT_KEYS, 'artifact');
  const candidate = candidateRecord as unknown as C120RealDataArtifact;
  try {
    verifyC120RealDataArtifactContentAddress(candidate);
  } catch (error) {
    if (error instanceof C120RealDataError) throw error;
    return fail(error instanceof Error ? error.message : String(error));
  }
  if (candidate.artifactVersion !== C120_REAL_DATA_ARTIFACT_VERSION
    || candidate.courseId !== C120_COURSE_ID
    || candidate.courseContractVersion !== C120_CONTRACT_VERSION) {
    return fail('artifact course identity/version mismatch');
  }
  nonEmptyString(candidate.providerId, 'artifact.providerId');
  nonEmptyString(candidate.scenarioId, 'artifact.scenarioId');
  validateUnits(candidate.units, 'artifact.units');
  if (candidate.measured !== false || candidate.wholeSatelliteCanonical !== false) {
    return fail('artifact truth boundary must remain measured=false and wholeSatelliteCanonical=false');
  }
  const source = record(candidate.source, 'artifact.source');
  validateSourceLayer(source);
  const orbit = record(candidate.orbit, 'artifact.orbit');
  validateOrbitLayer(orbit, source);
  const energy = record(candidate.energy, 'artifact.energy');
  validateEnergyLayer(energy);
  const assumptions = record(candidate.assumptions, 'artifact.assumptions');
  exactKeys(assumptions, ASSUMPTION_KEYS, 'artifact.assumptions');
  if (assumptions.kind !== 'COURSE_ASSUMPTION' || assumptions.measured !== false || !Array.isArray(assumptions.values)
    || assumptions.values.some(value => typeof value !== 'string' || value.trim() === '')) {
    return fail('artifact course-assumption layer mismatch');
  }
  if (!Array.isArray(candidate.provenance) || candidate.provenance.length !== 4) return fail('artifact.provenance must contain four layers');
  const provenanceKinds = [C120_ORBIT_SOURCE_KIND, C120_MODEL_DERIVED_ORBIT_KIND, C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND, 'COURSE_ASSUMPTION'];
  candidate.provenance.forEach((raw, index) => {
    const entry = record(raw, `artifact.provenance[${index}]`);
    exactKeys(entry, PROVENANCE_KEYS, `artifact.provenance[${index}]`);
    if (entry.kind !== provenanceKinds[index] || entry.measured !== false) return fail(`artifact.provenance[${index}] identity/truth mismatch`);
    nonEmptyString(entry.note, `artifact.provenance[${index}].note`);
  });
  if (JSON.stringify(candidate.claims) !== JSON.stringify(provenanceKinds)) return fail('artifact claims mismatch');
  return candidate;
}

function bindingFromArtifact(artifact: C120RealDataArtifact): C120ClassScenarioBinding {
  return {
    courseId: C120_COURSE_ID,
    courseContractVersion: C120_CONTRACT_VERSION,
    providerId: artifact.providerId,
    scenarioId: artifact.scenarioId,
    units: cloneJson(artifact.units),
    sourceMode: 'bundled',
    measured: false,
    wholeSatelliteCanonical: false,
  };
}

function fallbackPayloadFromReceipt(receipt: C120BundledFallbackReceipt): Record<string, unknown> {
  const { receiptId: _receiptId, contentSha256: _contentSha256, ...payload } = receipt;
  return payload;
}

function validateFallbackReceipt(
  value: unknown,
  binding: C120ClassScenarioBinding,
): C120BundledFallbackReceipt {
  const receipt = record(value, 'fallbackReceipt');
  exactKeys(receipt, FALLBACK_KEYS, 'fallbackReceipt');
  if (receipt.schemaVersion !== C120_BUNDLED_FALLBACK_RECEIPT_VERSION
    || receipt.kind !== C120_BUNDLED_FALLBACK_RECEIPT_KIND
    || receipt.sourceMode !== 'fallback'
    || receipt.measured !== false
    || receipt.wholeSatelliteCanonical !== false) {
    return fail('fallback receipt version/kind/truth mismatch');
  }
  if (receipt.courseId !== binding.courseId
    || receipt.courseContractVersion !== binding.courseContractVersion
    || receipt.providerId !== binding.providerId
    || receipt.scenarioId !== binding.scenarioId) {
    return fail('fallback receipt scenario binding mismatch');
  }
  validateUnits(receipt.units, 'fallbackReceipt.units');
  nonEmptyString(receipt.bundleId, 'fallbackReceipt.bundleId');
  nonEmptyString(receipt.bundleVersion, 'fallbackReceipt.bundleVersion');
  if (!isSha256(receipt.bundleContentSha256)
    || !isSha256(receipt.fallbackArtifactContentSha256)
    || !isContentAddress(receipt.fallbackArtifactId)
    || receipt.fallbackArtifactId !== `sha256:${receipt.fallbackArtifactContentSha256}`) {
    return fail('fallback receipt content address mismatch');
  }
  if (!isSha256(receipt.contentSha256) || !isContentAddress(receipt.receiptId)
    || receipt.receiptId !== `sha256:${receipt.contentSha256}`) {
    return fail('fallback receipt address is malformed');
  }
  const digest = sha256(canonicalJson(fallbackPayloadFromReceipt(receipt as unknown as C120BundledFallbackReceipt)));
  if (digest !== receipt.contentSha256) return fail('fallback receipt content hash mismatch');
  return cloneJson(receipt) as unknown as C120BundledFallbackReceipt;
}

/** Create a receipt for a bundled fallback without manufacturing scientific values. */
export function createC120BundledFallbackReceipt(
  artifact: C120RealDataArtifact,
  descriptor: C120BundledFallbackDescriptor,
): C120BundledFallbackReceipt {
  const checkedArtifact = validateArtifact(artifact);
  const binding = bindingFromArtifact(checkedArtifact);
  nonEmptyString(descriptor.bundleId, 'fallback descriptor.bundleId');
  nonEmptyString(descriptor.bundleVersion, 'fallback descriptor.bundleVersion');
  if (!isSha256(descriptor.bundleContentSha256)
    || !isSha256(descriptor.fallbackArtifactContentSha256)
    || !isContentAddress(descriptor.fallbackArtifactId)
    || descriptor.fallbackArtifactId !== `sha256:${descriptor.fallbackArtifactContentSha256}`) {
    return fail('fallback descriptor content address mismatch');
  }
  const payload = {
    schemaVersion: C120_BUNDLED_FALLBACK_RECEIPT_VERSION,
    kind: C120_BUNDLED_FALLBACK_RECEIPT_KIND,
    sourceMode: 'fallback' as const,
    courseId: binding.courseId,
    courseContractVersion: binding.courseContractVersion,
    providerId: binding.providerId,
    scenarioId: binding.scenarioId,
    units: binding.units,
    bundleId: descriptor.bundleId,
    bundleVersion: descriptor.bundleVersion,
    bundleContentSha256: descriptor.bundleContentSha256,
    fallbackArtifactId: descriptor.fallbackArtifactId,
    fallbackArtifactContentSha256: descriptor.fallbackArtifactContentSha256,
    measured: false as const,
    wholeSatelliteCanonical: false as const,
  };
  const contentSha256 = sha256(canonicalJson(payload));
  const receipt = {
    ...payload,
    receiptId: `sha256:${contentSha256}`,
    contentSha256,
  } satisfies C120BundledFallbackReceipt;
  validateFallbackReceipt(receipt, binding);
  return freezeDeep(cloneJson(receipt));
}

function truthLayersFor(scenarioId: string): readonly C120ClassTruthLayer[] {
  return [
    {
      kind: C120_ORBIT_SOURCE_KIND,
      scenarioId,
      measured: false,
      wholeSatelliteCanonical: false,
      note: 'Public CelesTrak source bytes and retrieval metadata; not measured telemetry.',
    },
    {
      kind: C120_MODEL_DERIVED_ORBIT_KIND,
      scenarioId,
      measured: false,
      wholeSatelliteCanonical: false,
      note: 'Server-side SGP4/model-derived orbit and look angles; not measured telemetry.',
    },
    {
      kind: C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND,
      scenarioId,
      measured: false,
      wholeSatelliteCanonical: false,
      note: 'Pinned golden-vector parity only; no canonical whole-course replay energy is supplied.',
    },
    {
      kind: 'COURSE_ASSUMPTION',
      scenarioId,
      measured: false,
      wholeSatelliteCanonical: false,
      note: 'Observer, pass policy, workload and unavailable hardware/load values remain course assumptions.',
    },
    {
      kind: C120_BUNDLED_FALLBACK_RECEIPT_KIND,
      scenarioId,
      measured: false,
      wholeSatelliteCanonical: false,
      note: 'Offline fallback receipt only; it does not upgrade source, measured or whole-course claims.',
    },
  ];
}

function validateTruthLayers(value: unknown, scenarioId: string): readonly C120ClassTruthLayer[] {
  if (!Array.isArray(value) || value.length !== TRUTH_LAYER_ORDER.length) return fail('truth layer list is incomplete');
  const layers = value.map((raw, index) => {
    const layer = record(raw, `truthLayers[${index}]`);
    exactKeys(layer, TRUTH_LAYER_KEYS, `truthLayers[${index}]`);
    if (layer.kind !== TRUTH_LAYER_ORDER[index]
      || layer.scenarioId !== scenarioId
      || layer.measured !== false
      || layer.wholeSatelliteCanonical !== false) {
      return fail(`truthLayers[${index}] identity/truth boundary mismatch`);
    }
    return {
      kind: layer.kind as C120ClassTruthKind,
      scenarioId,
      measured: false as const,
      wholeSatelliteCanonical: false as const,
      note: nonEmptyString(layer.note, `truthLayers[${index}].note`),
    };
  });
  return Object.freeze(layers);
}

function validateClaims(value: unknown, scenarioId: string): readonly C120ClassTruthKind[] {
  if (JSON.stringify(value) !== JSON.stringify(TRUTH_LAYER_ORDER)) return fail('snapshot claims mismatch');
  return Object.freeze([...TRUTH_LAYER_ORDER]);
}

function snapshotPayload(snapshot: C120ClassSnapshot): Record<string, unknown> {
  const { snapshotId: _snapshotId, contentSha256: _contentSha256, ...payload } = snapshot;
  return payload;
}

function buildSnapshotPayload(
  artifact: C120RealDataArtifact,
  generatedAt: string,
  fallbackReceipt: C120BundledFallbackReceipt,
): Omit<C120ClassSnapshot, 'snapshotId' | 'contentSha256'> {
  const binding = bindingFromArtifact(artifact);
  return {
    schemaVersion: C120_CLASS_SNAPSHOT_VERSION,
    kind: C120_CLASS_SNAPSHOT_KIND,
    generatedAt,
    sourceRetrievedAt: artifact.source.retrievedAt,
    sourceEpoch: artifact.source.sourceEpoch,
    scenarioId: binding.scenarioId,
    sourceMode: 'bundled',
    scenarioBinding: binding,
    artifactRef: {
      artifactId: artifact.artifactId,
      contentSha256: artifact.contentSha256,
    },
    artifact: cloneJson(artifact),
    truthLayers: truthLayersFor(binding.scenarioId),
    claims: [...TRUTH_LAYER_ORDER],
    fallbackReceipt: cloneJson(fallbackReceipt),
    measured: false,
    wholeSatelliteCanonical: false,
  };
}

/** Materialize one deterministic, explicitly bundled pre-class snapshot. */
export function materializeC120ClassSnapshot(
  request: C120ClassSnapshotMaterializerRequest,
): C120ClassSnapshot {
  const artifact = validateArtifact(request.artifact);
  const generatedAt = parseUtc(request.generatedAt, 'generatedAt');
  const binding = bindingFromArtifact(artifact);
  const fallbackReceipt = validateFallbackReceipt(request.fallbackReceipt, binding);
  const payload = buildSnapshotPayload(artifact, generatedAt, fallbackReceipt);
  const contentSha256 = sha256(canonicalJson(payload));
  const snapshot = {
    ...payload,
    snapshotId: `sha256:${contentSha256}`,
    contentSha256,
  } satisfies C120ClassSnapshot;
  verifyC120ClassSnapshot(snapshot);
  return freezeDeep(cloneJson(snapshot));
}

/** Strictly validate a parsed snapshot, including its nested artifact address. */
export function verifyC120ClassSnapshot(value: unknown): asserts value is C120ClassSnapshot {
  const snapshot = record(value, 'snapshot');
  exactKeys(snapshot, SNAPSHOT_KEYS, 'snapshot');
  if (snapshot.schemaVersion !== C120_CLASS_SNAPSHOT_VERSION || snapshot.kind !== C120_CLASS_SNAPSHOT_KIND) {
    return fail('snapshot version/kind mismatch');
  }
  if (!isSha256(snapshot.contentSha256) || !isContentAddress(snapshot.snapshotId)
    || snapshot.snapshotId !== `sha256:${snapshot.contentSha256}`) {
    return fail('snapshot content address is malformed');
  }
  const { snapshotId: _snapshotId, contentSha256: _contentSha256, ...payload } = snapshot;
  if (sha256(canonicalJson(payload)) !== snapshot.contentSha256) return fail('snapshot content hash mismatch');
  const generatedAt = parseUtc(snapshot.generatedAt, 'snapshot.generatedAt');
  const sourceRetrievedAt = parseUtc(snapshot.sourceRetrievedAt, 'snapshot.sourceRetrievedAt');
  if (Date.parse(generatedAt) < Date.parse(sourceRetrievedAt)) {
    return fail('snapshot generatedAt predates source retrieval');
  }
  parseUtc(snapshot.sourceEpoch, 'snapshot.sourceEpoch');
  if (snapshot.sourceMode !== 'bundled' || snapshot.measured !== false || snapshot.wholeSatelliteCanonical !== false) {
    return fail('snapshot source/truth boundary mismatch');
  }
  const artifact = validateArtifact(snapshot.artifact);
  if (snapshot.scenarioId !== artifact.scenarioId
    || snapshot.sourceRetrievedAt !== artifact.source.retrievedAt
    || snapshot.sourceEpoch !== artifact.source.sourceEpoch) {
    return fail('snapshot source/scenario binding mismatch');
  }
  const binding = validateScenarioBinding(snapshot.scenarioBinding, artifact);
  if (snapshot.scenarioId !== binding.scenarioId) return fail('snapshot scenarioId mismatch');
  const artifactRef = record(snapshot.artifactRef, 'artifactRef');
  exactKeys(artifactRef, ['artifactId', 'contentSha256'], 'artifactRef');
  if (artifactRef.artifactId !== artifact.artifactId || artifactRef.contentSha256 !== artifact.contentSha256) {
    return fail('snapshot artifact reference mismatch');
  }
  validateTruthLayers(snapshot.truthLayers, binding.scenarioId);
  validateClaims(snapshot.claims, binding.scenarioId);
  validateFallbackReceipt(snapshot.fallbackReceipt, binding);
}

/** Emit canonical compact JSON; callers can hash or save it without reordering drift. */
export function serializeC120ClassSnapshot(snapshot: C120ClassSnapshot): string {
  verifyC120ClassSnapshot(snapshot);
  return canonicalJson(snapshot);
}

/** Reopen only a self-addressed, identity-bound, JSON snapshot. */
export function reopenC120ClassSnapshot(serialized: string): C120ClassSnapshot {
  if (typeof serialized !== 'string') return fail('serialized snapshot must be JSON text');
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return fail('serialized snapshot is invalid JSON');
  }
  verifyC120ClassSnapshot(parsed);
  return freezeDeep(cloneJson(parsed));
}

export const createC120ClassSnapshot = materializeC120ClassSnapshot;
export const materializeC120PreClassSnapshot = materializeC120ClassSnapshot;
export const serializeC120PreClassSnapshot = serializeC120ClassSnapshot;
export const reopenC120PreClassSnapshot = reopenC120ClassSnapshot;
export const restoreC120ClassSnapshot = reopenC120ClassSnapshot;
export const restoreC120PreClassSnapshot = reopenC120ClassSnapshot;
export const validateC120ClassSnapshot = verifyC120ClassSnapshot;
export const verifyC120PreClassSnapshot = verifyC120ClassSnapshot;
