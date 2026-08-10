import { createHash } from 'node:crypto';

/** The bounded, official public source used by the optional C-120 backend lane. */
export const CELESTRAK_ONEWEB_GP_URL =
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=49100&FORMAT=JSON';
export const C120_ONEWEB_CATALOG_ID = 49100;
export const C120_ONEWEB_OBJECT_NAME = 'ONEWEB-0314';
export const C120_DEFAULT_ORBIT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const C120_DEFAULT_ORBIT_MAX_RESPONSE_BYTES = 256 * 1024;
/** CelesTrak's operator guidance is to avoid refetching a cached GP record more often than this. */
export const C120_MIN_SOURCE_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;
export const C120_ORBIT_SOURCE_KIND = 'PUBLIC_CURRENT_ORBIT_SOURCE' as const;

export type C120OrbitSourceKind = typeof C120_ORBIT_SOURCE_KIND;

export class C120RealDataError extends Error {
  readonly code: C120RealDataErrorCode;

  constructor(code: C120RealDataErrorCode, message: string) {
    super(`C-120 real-data adapter ${code}: ${message}`);
    this.name = 'C120RealDataError';
    this.code = code;
  }
}

export type C120RealDataErrorCode =
  | 'FETCH_FAILED'
  | 'HTTP_ERROR'
  | 'RESPONSE_TOO_LARGE'
  | 'MALFORMED_SOURCE'
  | 'SOURCE_IDENTITY_MISMATCH'
  | 'SOURCE_STALE'
  | 'SOURCE_REFRESH_TOO_SOON'
  | 'TIMESTAMP_INVALID'
  | 'VALIDATION_FAILED'
  | 'CANONICAL_RUNTIME_UNAVAILABLE'
  | 'CANONICAL_RUNTIME_DRIFT'
  | 'CANONICAL_CONTRACT_MISMATCH'
  | 'CANONICAL_INPUT_INVALID'
  | 'CANONICAL_OUTPUT_INVALID'
  | 'ORBIT_REQUEST_INVALID'
  | 'ORBIT_IDENTITY_MISMATCH'
  | 'ORBIT_PROPAGATION_FAILED'
  | 'ORBIT_NO_PASS'
  | 'ARTIFACT_INVALID';

export interface C120OrbitFetchResponse {
  readonly status: number;
  readonly body: string;
  readonly headers?: Readonly<Record<string, string | undefined>>;
}

/** A function boundary deliberately small enough to replace in offline tests. */
export type C120OrbitFetcher = (url: string) => Promise<C120OrbitFetchResponse>;

export interface C120OrbitSourceRequest {
  readonly catalogId?: number;
  /** Exact expected object name, or a predicate for an operator-owned catalog alias. */
  readonly expectedName?: string;
  readonly expectedNamePattern?: RegExp;
  readonly retrievedAt: string;
  /** Optional cache timestamp; when supplied, the adapter enforces the two-hour refresh floor. */
  readonly lastRetrievedAt?: string;
  readonly minRefreshIntervalMs?: number;
  readonly now?: string;
  readonly maxAgeMs?: number;
  readonly maxFutureSkewMs?: number;
  readonly maxResponseBytes?: number;
  readonly url?: string;
}

export interface C120CelestrakOrbitRecord {
  readonly OBJECT_NAME: string;
  readonly OBJECT_ID?: string;
  readonly EPOCH: string;
  readonly MEAN_MOTION: number | string;
  readonly ECCENTRICITY: number | string;
  readonly INCLINATION: number | string;
  readonly RA_OF_ASC_NODE: number | string;
  readonly ARG_OF_PERICENTER: number | string;
  readonly MEAN_ANOMALY: number | string;
  readonly EPHEMERIS_TYPE?: number | string;
  readonly CLASSIFICATION_TYPE?: string;
  readonly NORAD_CAT_ID: number | string;
  readonly ELEMENT_SET_NO?: number | string;
  readonly REV_AT_EPOCH?: number | string;
  readonly BSTAR?: number | string;
  readonly MEAN_MOTION_DOT?: number | string;
  readonly MEAN_MOTION_DDOT?: number | string;
  readonly TLE_LINE0?: string;
  readonly TLE_LINE1?: string;
  readonly TLE_LINE2?: string;
  readonly [key: string]: unknown;
}

export interface C120OrbitSourceReceipt {
  readonly kind: C120OrbitSourceKind;
  readonly catalogId: number;
  readonly objectName: string;
  readonly sourceEpoch: string;
  readonly retrievedAt: string;
  readonly url: string;
  readonly rawContentSha256: string;
  readonly responseBytes: number;
  readonly record: C120CelestrakOrbitRecord;
  readonly numericFields: Readonly<Record<string, number>>;
  readonly stringFields: Readonly<Record<string, string>>;
  readonly tle: Readonly<{
    readonly line0?: string;
    readonly line1?: string;
    readonly line2?: string;
  }>;
}

const REQUIRED_NUMERIC_FIELDS = Object.freeze([
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
  'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER',
  'MEAN_ANOMALY',
] as const);

const OPTIONAL_NUMERIC_FIELDS = Object.freeze([
  'EPHEMERIS_TYPE',
  'ELEMENT_SET_NO',
  'REV_AT_EPOCH',
  'BSTAR',
  'MEAN_MOTION_DOT',
  'MEAN_MOTION_DDOT',
] as const);

function fail(code: C120RealDataErrorCode, message: string): never {
  throw new C120RealDataError(code, message);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('MALFORMED_SOURCE', `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return fail('VALIDATION_FAILED', `${label} must be a non-empty string`);
  }
  return value;
}

function finiteNumericField(value: unknown, label: string): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return fail('VALIDATION_FAILED', `${label} must be a number or numeric string`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    return fail('VALIDATION_FAILED', `${label} must not be an empty numeric string`);
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fail('VALIDATION_FAILED', `${label} must be finite`);
  }
  return parsed;
}

function parseUtcTimestamp(value: unknown, label: string, allowImplicitUtc = false): { readonly value: string; readonly ms: number } {
  const text = nonEmptyString(value, label);
  const utcText = allowImplicitUtc && !text.endsWith('Z') ? `${text}Z` : text;
  const ms = Date.parse(utcText);
  if (!Number.isFinite(ms) || (!allowImplicitUtc && !text.endsWith('Z'))) {
    return fail('TIMESTAMP_INVALID', `${label} must be a parseable UTC timestamp ending in Z`);
  }
  // Preserve the source timestamp bytes (including sub-millisecond OMM
  // precision) while using Date.parse only for age validation.
  return { value: utcText, ms };
}

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function responseHeader(response: C120OrbitFetchResponse, name: string): string | undefined {
  const headers = response.headers;
  if (headers === undefined) return undefined;
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}

function validateCelestrakRecord(
  value: unknown,
  request: Required<Pick<C120OrbitSourceRequest, 'catalogId' | 'maxAgeMs' | 'maxFutureSkewMs'>> &
    Pick<C120OrbitSourceRequest, 'expectedName' | 'expectedNamePattern'>,
): {
  readonly record: C120CelestrakOrbitRecord;
  readonly numericFields: Readonly<Record<string, number>>;
  readonly stringFields: Readonly<Record<string, string>>;
  readonly sourceEpoch: { readonly value: string; readonly ms: number };
} {
  const candidate = assertRecord(value, 'CelesTrak record');
  const objectName = nonEmptyString(candidate.OBJECT_NAME, 'OBJECT_NAME');
  const catalogId = finiteNumericField(candidate.NORAD_CAT_ID, 'NORAD_CAT_ID');
  if (!Number.isInteger(catalogId) || catalogId !== request.catalogId) {
    return fail(
      'SOURCE_IDENTITY_MISMATCH',
      `NORAD_CAT_ID ${String(candidate.NORAD_CAT_ID)} does not match ${request.catalogId}`,
    );
  }
  if (request.expectedName !== undefined && objectName !== request.expectedName) {
    return fail('SOURCE_IDENTITY_MISMATCH', `OBJECT_NAME ${objectName} does not match expected name`);
  }
  if (request.expectedNamePattern !== undefined && !request.expectedNamePattern.test(objectName)) {
    return fail('SOURCE_IDENTITY_MISMATCH', `OBJECT_NAME ${objectName} does not match expected pattern`);
  }

  // CelesTrak OMM JSON commonly omits the trailing Z while specifying UTC.
  const sourceEpoch = parseUtcTimestamp(candidate.EPOCH, 'EPOCH', true);
  const numericFields: Record<string, number> = { NORAD_CAT_ID: catalogId };
  for (const field of REQUIRED_NUMERIC_FIELDS) {
    numericFields[field] = finiteNumericField(candidate[field], field);
  }
  for (const field of OPTIONAL_NUMERIC_FIELDS) {
    if (candidate[field] !== undefined) numericFields[field] = finiteNumericField(candidate[field], field);
  }

  if (numericFields.ECCENTRICITY < 0 || numericFields.ECCENTRICITY >= 1) {
    return fail('VALIDATION_FAILED', 'ECCENTRICITY must be in [0, 1)');
  }
  if (numericFields.MEAN_MOTION <= 0) return fail('VALIDATION_FAILED', 'MEAN_MOTION must be positive');
  if (numericFields.INCLINATION < 0 || numericFields.INCLINATION > 180) {
    return fail('VALIDATION_FAILED', 'INCLINATION must be in [0, 180] degrees');
  }
  for (const field of ['RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY'] as const) {
    if (numericFields[field] < 0 || numericFields[field] > 360) {
      return fail('VALIDATION_FAILED', `${field} must be in [0, 360] degrees`);
    }
  }

  const stringFields: Record<string, string> = { OBJECT_NAME: objectName };
  for (const field of ['OBJECT_ID', 'CLASSIFICATION_TYPE', 'TLE_LINE0', 'TLE_LINE1', 'TLE_LINE2'] as const) {
    if (candidate[field] !== undefined) stringFields[field] = nonEmptyString(candidate[field], field);
  }
  // OMM records are flat scalar records. Validate any future CelesTrak field
  // as a scalar as well, so a nested/error payload cannot pass through as orbit
  // provenance. Known numeric fields above are additionally parsed and ranged.
  for (const [field, value] of Object.entries(candidate)) {
    if (value === undefined) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) return fail('VALIDATION_FAILED', `${field} must be finite`);
    if (typeof value !== 'number' && typeof value !== 'string') return fail('VALIDATION_FAILED', `${field} must be a scalar`);
    if (typeof value === 'string' && value.trim() === '') return fail('VALIDATION_FAILED', `${field} must not be empty`);
  }
  if (stringFields.TLE_LINE1 !== undefined && stringFields.TLE_LINE2 === undefined) {
    return fail('VALIDATION_FAILED', 'TLE_LINE1 and TLE_LINE2 must be provided together');
  }
  if (stringFields.TLE_LINE2 !== undefined && stringFields.TLE_LINE1 === undefined) {
    return fail('VALIDATION_FAILED', 'TLE_LINE1 and TLE_LINE2 must be provided together');
  }

  return {
    record: candidate as C120CelestrakOrbitRecord,
    numericFields,
    stringFields,
    sourceEpoch,
  };
}

function normalizeRequest(request: C120OrbitSourceRequest): Required<Pick<
  C120OrbitSourceRequest,
  'catalogId' | 'retrievedAt' | 'now' | 'maxAgeMs' | 'maxFutureSkewMs' | 'maxResponseBytes' | 'url'
>> & Pick<C120OrbitSourceRequest, 'expectedName' | 'expectedNamePattern'> {
  const catalogId = request.catalogId ?? C120_ONEWEB_CATALOG_ID;
  if (!Number.isInteger(catalogId) || catalogId <= 0) return fail('VALIDATION_FAILED', 'catalogId must be a positive integer');
  if (catalogId !== C120_ONEWEB_CATALOG_ID) {
    return fail('SOURCE_IDENTITY_MISMATCH', `bounded C-120 source requires catalog ${C120_ONEWEB_CATALOG_ID}`);
  }
  if (request.expectedName !== undefined && request.expectedName !== C120_ONEWEB_OBJECT_NAME) {
    return fail('SOURCE_IDENTITY_MISMATCH', `bounded C-120 source requires object ${C120_ONEWEB_OBJECT_NAME}`);
  }
  if (request.expectedNamePattern !== undefined) {
    const stablePattern = new RegExp(
      request.expectedNamePattern.source,
      request.expectedNamePattern.flags.replace(/[gy]/g, ''),
    );
    if (!stablePattern.test(C120_ONEWEB_OBJECT_NAME)) {
      return fail('SOURCE_IDENTITY_MISMATCH', 'expectedNamePattern excludes the bounded C-120 object identity');
    }
  }
  const retrievedAt = parseUtcTimestamp(request.retrievedAt, 'retrievedAt');
  const now = parseUtcTimestamp(request.now ?? request.retrievedAt, 'now');
  const maxAgeMs = request.maxAgeMs ?? C120_DEFAULT_ORBIT_MAX_AGE_MS;
  const maxFutureSkewMs = request.maxFutureSkewMs ?? 5 * 60 * 1000;
  const maxResponseBytes = request.maxResponseBytes ?? C120_DEFAULT_ORBIT_MAX_RESPONSE_BYTES;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) return fail('VALIDATION_FAILED', 'maxAgeMs must be non-negative');
  if (!Number.isFinite(maxFutureSkewMs) || maxFutureSkewMs < 0) return fail('VALIDATION_FAILED', 'maxFutureSkewMs must be non-negative');
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0) return fail('VALIDATION_FAILED', 'maxResponseBytes must be a positive integer');
  if (retrievedAt.ms > now.ms + maxFutureSkewMs) {
    return fail('TIMESTAMP_INVALID', 'retrievedAt is later than now');
  }
  const lastRetrievedAt = request.lastRetrievedAt === undefined
    ? undefined
    : parseUtcTimestamp(request.lastRetrievedAt, 'lastRetrievedAt');
  const minRefreshIntervalMs = request.minRefreshIntervalMs ?? C120_MIN_SOURCE_REFRESH_INTERVAL_MS;
  if (!Number.isFinite(minRefreshIntervalMs) || minRefreshIntervalMs < 0) {
    return fail('VALIDATION_FAILED', 'minRefreshIntervalMs must be non-negative');
  }
  if (lastRetrievedAt !== undefined && retrievedAt.ms - lastRetrievedAt.ms < minRefreshIntervalMs) {
    return fail('SOURCE_REFRESH_TOO_SOON', `source refresh interval is less than ${minRefreshIntervalMs} ms`);
  }
  const url = request.url ?? CELESTRAK_ONEWEB_GP_URL;
  if (url !== CELESTRAK_ONEWEB_GP_URL) {
    return fail('VALIDATION_FAILED', 'orbit source URL must be the bounded CelesTrak CATNR endpoint');
  }
  return {
    catalogId,
    retrievedAt: retrievedAt.value,
    now: now.value,
    maxAgeMs,
    maxFutureSkewMs,
    maxResponseBytes,
    url,
    expectedName: C120_ONEWEB_OBJECT_NAME,
    expectedNamePattern: undefined,
  };
}

/**
 * Fetch and validate one bounded CelesTrak GP/OMM response.
 *
 * This module intentionally stops at public orbital source data. It does not
 * propagate SGP4, derive look angles, or manufacture power/energy values.
 */
export async function fetchC120CelestrakOrbitSource(
  request: C120OrbitSourceRequest,
  fetcher: C120OrbitFetcher,
): Promise<C120OrbitSourceReceipt> {
  const normalized = normalizeRequest(request);
  let response: C120OrbitFetchResponse;
  try {
    response = await fetcher(normalized.url);
  } catch (error) {
    return fail('FETCH_FAILED', error instanceof Error ? error.message : String(error));
  }
  if (!response || typeof response !== 'object' || typeof response.body !== 'string') {
    return fail('FETCH_FAILED', 'fetcher returned an invalid response');
  }
  if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
    return fail('FETCH_FAILED', 'fetcher returned an invalid HTTP status');
  }
  if (response.status < 200 || response.status >= 300) return fail('HTTP_ERROR', `HTTP status ${response.status}`);
  const contentLength = responseHeader(response, 'content-length');
  if (contentLength !== undefined) {
    const declared = Number(contentLength);
    if (!Number.isFinite(declared) || declared < 0) return fail('MALFORMED_SOURCE', 'content-length is invalid');
    if (declared > normalized.maxResponseBytes) return fail('RESPONSE_TOO_LARGE', 'declared response exceeds bound');
  }
  const responseBytes = new TextEncoder().encode(response.body).byteLength;
  if (responseBytes > normalized.maxResponseBytes) return fail('RESPONSE_TOO_LARGE', `response is ${responseBytes} bytes`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch (error) {
    return fail('MALFORMED_SOURCE', `response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const records = Array.isArray(parsed) ? parsed : [parsed];
  if (records.length !== 1) return fail('MALFORMED_SOURCE', `expected one catalog record, got ${records.length}`);
  const validated = validateCelestrakRecord(records[0], normalized);
  const retrievedAtMs = Date.parse(normalized.retrievedAt);
  if (validated.sourceEpoch.ms - retrievedAtMs > normalized.maxFutureSkewMs) {
    return fail('TIMESTAMP_INVALID', 'source EPOCH is later than retrievedAt');
  }
  const sourceAgeMs = Date.parse(normalized.now) - validated.sourceEpoch.ms;
  if (sourceAgeMs < -normalized.maxFutureSkewMs) return fail('SOURCE_STALE', 'source EPOCH is later than now');
  if (sourceAgeMs > normalized.maxAgeMs) return fail('SOURCE_STALE', `source EPOCH is ${sourceAgeMs} ms old`);

  const stringFields = validated.stringFields;
  return Object.freeze({
    kind: C120_ORBIT_SOURCE_KIND,
    catalogId: normalized.catalogId,
    objectName: stringFields.OBJECT_NAME,
    sourceEpoch: validated.sourceEpoch.value,
    retrievedAt: normalized.retrievedAt,
    url: normalized.url,
    rawContentSha256: sha256Utf8(response.body),
    responseBytes,
    record: Object.freeze({ ...validated.record }),
    numericFields: Object.freeze({ ...validated.numericFields }),
    stringFields: Object.freeze({ ...validated.stringFields }),
    tle: Object.freeze({
      line0: stringFields.TLE_LINE0,
      line1: stringFields.TLE_LINE1,
      line2: stringFields.TLE_LINE2,
    }),
  });
}

export const validateC120CelestrakGp = fetchC120CelestrakOrbitSource;
export const fetchC120OrbitSource = fetchC120CelestrakOrbitSource;
export const fetchC120OneWebOrbitSource = fetchC120CelestrakOrbitSource;
