import { createHash } from 'node:crypto';

import {
  C120_MIN_SOURCE_REFRESH_INTERVAL_MS,
  C120_ONEWEB_CATALOG_ID,
  C120_ONEWEB_OBJECT_NAME,
  C120RealDataError,
  type C120OrbitFetcher,
  type C120OrbitSourceReceipt,
} from './orbitSource';

/**
 * The optional server-side TLE companion for the validated C-120 OMM source.
 *
 * This endpoint is deliberately fixed.  A TLE fetched from another catalog or
 * another CelesTrak query cannot silently become the source for this lane.
 */
export const CELESTRAK_ONEWEB_TLE_URL =
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=49100&FORMAT=TLE';
export const C120_CURRENT_TLE_SOURCE_KIND = 'PUBLIC_CURRENT_TLE_SOURCE' as const;
export const C120_TLE_FORMAT = 'TLE' as const;
export const C120_DEFAULT_TLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const C120_DEFAULT_TLE_MAX_RESPONSE_BYTES = 4 * 1024;
export const C120_MAX_TLE_RESPONSE_BYTES = 16 * 1024;
export const C120_MAX_TLE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const C120_MAX_TLE_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const C120_MAX_TLE_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * TLE line 1 carries eight decimal places of day precision (~0.86 ms).
 * The OMM receipt preserves six decimal places of seconds, while JavaScript's
 * Date parser compares at millisecond precision.  Two seconds is intentionally
 * small compared with the seven-day source-age bound and covers only those
 * representation/rounding differences; it does not reconcile different
 * element sets.
 */
export const C120_TLE_OMM_EPOCH_TOLERANCE_MS = 2_000;

export type C120CurrentTleFetcher = C120OrbitFetcher;

export interface C120CurrentTleRequest {
  readonly retrievedAt: string;
  readonly lastRetrievedAt?: string;
  readonly minRefreshIntervalMs?: number;
  readonly now?: string;
  readonly maxAgeMs?: number;
  readonly maxFutureSkewMs?: number;
  readonly maxResponseBytes?: number;
  /** Present only to make an attempted identity override fail closed. */
  readonly catalogId?: number;
  readonly expectedName?: string;
  readonly url?: string;
}

export interface C120CurrentTleReceipt {
  readonly kind: typeof C120_CURRENT_TLE_SOURCE_KIND;
  readonly format: typeof C120_TLE_FORMAT;
  readonly catalogId: typeof C120_ONEWEB_CATALOG_ID;
  readonly objectName: typeof C120_ONEWEB_OBJECT_NAME;
  readonly epochUtc: string;
  readonly epochField: string;
  readonly retrievedAt: string;
  readonly url: typeof CELESTRAK_ONEWEB_TLE_URL;
  /** Exact bounded response bytes, retained so downstream materializers can re-address the receipt. */
  readonly rawContent: string;
  readonly rawContentSha256: string;
  readonly responseBytes: number;
  readonly line0: string;
  readonly line1: string;
  readonly line2: string;
  readonly tle: Readonly<{
    readonly line0: string;
    readonly line1: string;
    readonly line2: string;
  }>;
  /** Explicit provenance for this public source snapshot, not a telemetry claim. */
  readonly sourceProvenance: Readonly<{
    readonly provider: 'CelesTrak';
    readonly endpoint: typeof CELESTRAK_ONEWEB_TLE_URL;
    readonly format: typeof C120_TLE_FORMAT;
    readonly catalogId: typeof C120_ONEWEB_CATALOG_ID;
    readonly objectName: typeof C120_ONEWEB_OBJECT_NAME;
    readonly retrievedAt: string;
    readonly rawContentSha256: string;
  }>;
  readonly matchedOmm: Readonly<{
    readonly catalogId: number;
    readonly objectName: string;
    readonly sourceEpoch: string;
    readonly rawContentSha256: string;
    readonly epochDeltaMs: number;
  }>;
}

interface NormalizedRequest {
  readonly retrievedAt: string;
  readonly retrievedAtMs: number;
  readonly now: string;
  readonly nowMs: number;
  readonly lastRetrievedAt?: string;
  readonly lastRetrievedAtMs?: number;
  readonly minRefreshIntervalMs: number;
  readonly maxAgeMs: number;
  readonly maxFutureSkewMs: number;
  readonly maxResponseBytes: number;
}

interface ParsedTle {
  readonly line0: string;
  readonly line1: string;
  readonly line2: string;
  readonly catalogId: number;
  readonly objectName: string;
  readonly epochUtc: string;
  readonly epochMs: number;
  readonly epochField: string;
}

function fail(code: ConstructorParameters<typeof C120RealDataError>[0], message: string): never {
  throw new C120RealDataError(code, message);
}

function parseUtcTimestamp(value: unknown, label: string): { readonly value: string; readonly ms: number } {
  if (typeof value !== 'string' || value.trim() === '' || !value.endsWith('Z')) {
    return fail('TIMESTAMP_INVALID', `${label} must be a non-empty UTC timestamp ending in Z`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return fail('TIMESTAMP_INVALID', `${label} is not parseable UTC`);
  return { value, ms };
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fail('VALIDATION_FAILED', `${label} must be a finite non-negative number`);
  }
  return value;
}

function normalizeRequest(request: C120CurrentTleRequest): NormalizedRequest {
  if (request.catalogId !== undefined && request.catalogId !== C120_ONEWEB_CATALOG_ID) {
    return fail('SOURCE_IDENTITY_MISMATCH', `bounded C-120 TLE source requires catalog ${C120_ONEWEB_CATALOG_ID}`);
  }
  if (request.expectedName !== undefined && request.expectedName !== C120_ONEWEB_OBJECT_NAME) {
    return fail('SOURCE_IDENTITY_MISMATCH', `bounded C-120 TLE source requires object ${C120_ONEWEB_OBJECT_NAME}`);
  }
  if (request.url !== undefined && request.url !== CELESTRAK_ONEWEB_TLE_URL) {
    return fail('VALIDATION_FAILED', 'TLE source URL must be the bounded CelesTrak CATNR endpoint');
  }

  const retrievedAt = parseUtcTimestamp(request.retrievedAt, 'retrievedAt');
  const now = parseUtcTimestamp(request.now ?? request.retrievedAt, 'now');
  const lastRetrievedAt = request.lastRetrievedAt === undefined
    ? undefined
    : parseUtcTimestamp(request.lastRetrievedAt, 'lastRetrievedAt');
  const minRefreshIntervalMs = request.minRefreshIntervalMs ?? C120_MIN_SOURCE_REFRESH_INTERVAL_MS;
  const maxAgeMs = request.maxAgeMs ?? C120_DEFAULT_TLE_MAX_AGE_MS;
  const maxFutureSkewMs = request.maxFutureSkewMs ?? C120_MAX_TLE_FUTURE_SKEW_MS;
  const maxResponseBytes = request.maxResponseBytes ?? C120_DEFAULT_TLE_MAX_RESPONSE_BYTES;
  finiteNonNegative(minRefreshIntervalMs, 'minRefreshIntervalMs');
  finiteNonNegative(maxAgeMs, 'maxAgeMs');
  finiteNonNegative(maxFutureSkewMs, 'maxFutureSkewMs');
  if (minRefreshIntervalMs > C120_MAX_TLE_REFRESH_INTERVAL_MS) {
    return fail('VALIDATION_FAILED', `minRefreshIntervalMs exceeds ${C120_MAX_TLE_REFRESH_INTERVAL_MS} ms`);
  }
  if (minRefreshIntervalMs < C120_MIN_SOURCE_REFRESH_INTERVAL_MS) {
    return fail('VALIDATION_FAILED', `minRefreshIntervalMs cannot bypass the ${C120_MIN_SOURCE_REFRESH_INTERVAL_MS} ms CelesTrak cache floor`);
  }
  if (maxAgeMs > C120_MAX_TLE_MAX_AGE_MS) {
    return fail('VALIDATION_FAILED', `maxAgeMs exceeds ${C120_MAX_TLE_MAX_AGE_MS} ms`);
  }
  if (maxFutureSkewMs > C120_MAX_TLE_FUTURE_SKEW_MS) {
    return fail('VALIDATION_FAILED', `maxFutureSkewMs exceeds ${C120_MAX_TLE_FUTURE_SKEW_MS} ms`);
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0 || maxResponseBytes > C120_MAX_TLE_RESPONSE_BYTES) {
    return fail('VALIDATION_FAILED', `maxResponseBytes must be an integer in (0, ${C120_MAX_TLE_RESPONSE_BYTES}]`);
  }
  if (retrievedAt.ms > now.ms + maxFutureSkewMs) {
    return fail('TIMESTAMP_INVALID', 'retrievedAt is later than now');
  }
  if (lastRetrievedAt !== undefined && retrievedAt.ms - lastRetrievedAt.ms < minRefreshIntervalMs) {
    return fail('SOURCE_REFRESH_TOO_SOON', `source refresh interval is less than ${minRefreshIntervalMs} ms`);
  }
  return {
    retrievedAt: retrievedAt.value,
    retrievedAtMs: retrievedAt.ms,
    now: now.value,
    nowMs: now.ms,
    lastRetrievedAt: lastRetrievedAt?.value,
    lastRetrievedAtMs: lastRetrievedAt?.ms,
    minRefreshIntervalMs,
    maxAgeMs,
    maxFutureSkewMs,
    maxResponseBytes,
  };
}

function responseHeader(response: Awaited<ReturnType<C120CurrentTleFetcher>>, name: string): string | undefined {
  const headers = response.headers;
  if (headers === undefined) return undefined;
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function checksumIsValid(line: string): boolean {
  if (line.length !== 69 || !/^[0-9]$/.test(line[68] ?? '')) return false;
  let sum = 0;
  for (const character of line.slice(0, 68)) {
    if (character >= '0' && character <= '9') sum += character.charCodeAt(0) - 48;
    else if (character === '-') sum += 1;
  }
  return sum % 10 === Number(line[68]);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function parseTleEpoch(line1: string): { readonly epochField: string; readonly epochUtc: string; readonly epochMs: number } {
  const epochField = line1.slice(18, 32);
  if (!/^\d{2}\d{3}\.\d{8}$/.test(epochField)) {
    return fail('TIMESTAMP_INVALID', `TLE epoch field ${JSON.stringify(epochField)} is invalid`);
  }
  const year2 = Number(epochField.slice(0, 2));
  const year = year2 < 57 ? 2000 + year2 : 1900 + year2;
  const day = Number(epochField.slice(2, 5));
  const fractionDigits = BigInt(epochField.slice(6));
  const maxDay = isLeapYear(year) ? 366 : 365;
  if (day < 1 || day > maxDay) return fail('TIMESTAMP_INVALID', `TLE epoch day ${day} is outside ${year}`);
  // Round the decimal day to milliseconds with integer arithmetic.  This
  // avoids a binary-float boundary moving an otherwise valid epoch by a day.
  const fractionalMs = Number((fractionDigits * 86_400_000n + 50_000_000n) / 100_000_000n);
  const epochMs = Date.UTC(year, 0, 1) + (day - 1) * 86_400_000 + fractionalMs;
  const epoch = new Date(epochMs);
  if (!Number.isFinite(epochMs) || Number.isNaN(epoch.getTime())) {
    return fail('TIMESTAMP_INVALID', 'TLE epoch is outside JavaScript date range');
  }
  return { epochField, epochUtc: epoch.toISOString(), epochMs };
}

function parseTle(body: string, source: C120OrbitSourceReceipt): ParsedTle {
  const lines = body.split(/\r\n|\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length !== 3 || lines.some(line => line.length === 0)) {
    return fail('MALFORMED_SOURCE', 'CelesTrak TLE response must contain exactly one 3LE record');
  }
  const [line0, line1, line2] = lines as [string, string, string];
  const objectName = line0.trimEnd();
  if (!/^[\x20-\x7e]+$/.test(line0) || line0.trimStart() !== line0 || objectName !== source.objectName) {
    return fail('SOURCE_IDENTITY_MISMATCH', 'TLE object name does not match the validated OMM receipt');
  }
  for (const [line, expectedPrefix, label] of [[line1, '1 ', 'line 1'], [line2, '2 ', 'line 2']] as const) {
    if (line.length !== 69 || !line.startsWith(expectedPrefix) || !/^[\x20-\x7e]+$/.test(line)) {
      return fail('MALFORMED_SOURCE', `TLE ${label} is not an exact 69-column line`);
    }
    if (!checksumIsValid(line)) return fail('VALIDATION_FAILED', `TLE ${label} checksum is invalid`);
  }
  if (line1[8] !== ' ' || line2[7] !== ' ') return fail('MALFORMED_SOURCE', 'TLE fixed-column spacing is invalid');
  const catalog1 = line1.slice(2, 7);
  const catalog2 = line2.slice(2, 7);
  if (!/^\d{5}$/.test(catalog1) || !/^\d{5}$/.test(catalog2)) {
    return fail('MALFORMED_SOURCE', 'TLE NORAD catalog fields are malformed');
  }
  const catalogId = Number(catalog1);
  if (catalogId !== Number(catalog2) || catalogId !== source.catalogId || catalogId !== C120_ONEWEB_CATALOG_ID) {
    return fail('SOURCE_IDENTITY_MISMATCH', 'TLE NORAD catalog does not match the validated OMM receipt');
  }
  const epoch = parseTleEpoch(line1);
  return {
    // CelesTrak pads 3LE name lines in real responses. Keep the exact bytes
    // in rawContent/rawContentSha256, but expose a canonical line 0 so the
    // browser's trimEnd-normalized offline import binds to the same record.
    line0: objectName,
    line1,
    line2,
    catalogId,
    objectName,
    ...epoch,
  };
}

function validateOmmReceiptIdentity(source: C120OrbitSourceReceipt): void {
  const recordCatalog = typeof source.record.NORAD_CAT_ID === 'number'
    ? source.record.NORAD_CAT_ID
    : Number(source.record.NORAD_CAT_ID);
  if (source.catalogId !== C120_ONEWEB_CATALOG_ID || source.objectName !== C120_ONEWEB_OBJECT_NAME
    || !Number.isInteger(recordCatalog) || recordCatalog !== source.catalogId
    || source.record.OBJECT_NAME !== source.objectName) {
    return fail('SOURCE_IDENTITY_MISMATCH', 'validated OMM receipt identity is inconsistent');
  }
  if (!/^[0-9a-f]{64}$/.test(source.rawContentSha256)) {
    return fail('SOURCE_IDENTITY_MISMATCH', 'validated OMM receipt raw SHA-256 is malformed');
  }
}

/**
 * Fetch one bounded CelesTrak 3LE record and bind it to a previously validated
 * OMM receipt.  The fetcher is injected so this module is deterministic and
 * offline-testable; this function never propagates an orbit or computes a KPI.
 */
export async function fetchC120CurrentTle(
  source: C120OrbitSourceReceipt,
  request: C120CurrentTleRequest,
  fetcher: C120CurrentTleFetcher,
): Promise<C120CurrentTleReceipt>;
export async function fetchC120CurrentTle(
  request: C120CurrentTleRequest,
  source: C120OrbitSourceReceipt,
  fetcher: C120CurrentTleFetcher,
): Promise<C120CurrentTleReceipt>;
export async function fetchC120CurrentTle(
  first: C120OrbitSourceReceipt | C120CurrentTleRequest,
  second: C120CurrentTleRequest | C120OrbitSourceReceipt,
  fetcher: C120CurrentTleFetcher,
): Promise<C120CurrentTleReceipt> {
  const source = 'record' in first ? first : second as C120OrbitSourceReceipt;
  const request = 'record' in first ? second as C120CurrentTleRequest : first;
  validateOmmReceiptIdentity(source);
  const normalized = normalizeRequest(request);
  let response: Awaited<ReturnType<C120CurrentTleFetcher>>;
  try {
    response = await fetcher(CELESTRAK_ONEWEB_TLE_URL);
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
    if (!Number.isInteger(declared) || declared < 0) return fail('MALFORMED_SOURCE', 'content-length is invalid');
    if (declared > normalized.maxResponseBytes) return fail('RESPONSE_TOO_LARGE', 'declared response exceeds bound');
  }
  const responseBytes = new TextEncoder().encode(response.body).byteLength;
  if (responseBytes > normalized.maxResponseBytes) return fail('RESPONSE_TOO_LARGE', `response is ${responseBytes} bytes`);

  const parsed = parseTle(response.body, source);
  const sourceEpoch = parseUtcTimestamp(source.sourceEpoch, 'OMM sourceEpoch');
  const epochDeltaMs = Math.abs(parsed.epochMs - sourceEpoch.ms);
  if (epochDeltaMs > C120_TLE_OMM_EPOCH_TOLERANCE_MS) {
    return fail('SOURCE_IDENTITY_MISMATCH', `TLE epoch differs from OMM sourceEpoch by ${epochDeltaMs} ms`);
  }
  if (parsed.epochMs > normalized.retrievedAtMs + normalized.maxFutureSkewMs) {
    return fail('TIMESTAMP_INVALID', 'TLE epoch is later than retrievedAt');
  }
  const sourceAgeMs = normalized.nowMs - parsed.epochMs;
  if (sourceAgeMs < -normalized.maxFutureSkewMs) return fail('SOURCE_STALE', 'TLE epoch is later than now');
  if (sourceAgeMs > normalized.maxAgeMs) return fail('SOURCE_STALE', `TLE epoch is ${sourceAgeMs} ms old`);

  const rawContentSha256 = sha256Utf8(response.body);
  return Object.freeze({
    kind: C120_CURRENT_TLE_SOURCE_KIND,
    format: C120_TLE_FORMAT,
    catalogId: C120_ONEWEB_CATALOG_ID,
    objectName: C120_ONEWEB_OBJECT_NAME,
    epochUtc: parsed.epochUtc,
    epochField: parsed.epochField,
    retrievedAt: normalized.retrievedAt,
    url: CELESTRAK_ONEWEB_TLE_URL,
    rawContent: response.body,
    rawContentSha256,
    responseBytes,
    line0: parsed.line0,
    line1: parsed.line1,
    line2: parsed.line2,
    tle: Object.freeze({ line0: parsed.line0, line1: parsed.line1, line2: parsed.line2 }),
    sourceProvenance: Object.freeze({
      provider: 'CelesTrak',
      endpoint: CELESTRAK_ONEWEB_TLE_URL,
      format: C120_TLE_FORMAT,
      catalogId: C120_ONEWEB_CATALOG_ID,
      objectName: C120_ONEWEB_OBJECT_NAME,
      retrievedAt: normalized.retrievedAt,
      rawContentSha256,
    }),
    matchedOmm: Object.freeze({
      catalogId: source.catalogId,
      objectName: source.objectName,
      sourceEpoch: source.sourceEpoch,
      rawContentSha256: source.rawContentSha256,
      epochDeltaMs,
    }),
  });
}

export const fetchC120CelestrakCurrentTle = fetchC120CurrentTle;
export const fetchC120CurrentTleSource = fetchC120CurrentTle;
export const fetchC120OneWebCurrentTle = fetchC120CurrentTle;

export const parseC120CurrentTle = parseTle;
export const validateC120TleChecksum = checksumIsValid;
