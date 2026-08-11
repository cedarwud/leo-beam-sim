import { parseUtcInstant } from '../tle/time';
import { TleArchiveError, tleFail } from '../tle/errors';
import { validateTleArchiveManifest, validateTleLines } from '../tle/validation';
import { TLE_PROPAGATION_MODEL, TLE_SOURCE_KIND, type TleArchiveEntry } from '../tle/types';
import type {
  LoadedTleSnapshot,
  LoadedTleSnapshotWindow,
  TleWebArchiveCatalog,
  TleWebArchiveSnapshot,
} from './types';

const ARCHIVE_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const SNAPSHOT_PATH_PATTERN = /^\/tle-archive\/oneweb\/oneweb_(\d{8})\.tle$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const browserFetcher: Fetcher = (input, init) => globalThis.fetch(input, init);
const snapshotPromiseCache = new Map<string, Promise<LoadedTleSnapshot>>();
const catalogPromiseCache = new Map<string, Promise<TleWebArchiveCatalog>>();

function archiveFail(message: string, details?: Readonly<Record<string, unknown>>): never {
  throw new TleArchiveError('INVALID_MANIFEST', message, details);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') archiveFail(`${label} must be a non-empty string`);
  return value.trim();
}

function archiveDateMs(value: string, label = 'archiveDate'): number {
  const match = ARCHIVE_DATE_PATTERN.exec(value);
  if (match === null) archiveFail(`${label} must use YYYYMMDD`, { value });
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (
    !Number.isFinite(ms)
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) archiveFail(`${label} is not a real calendar date`, { value });
  return ms;
}

function finitePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    archiveFail(`${label} must be a positive integer`, { value });
  }
  return value;
}

function parseSnapshotMetadata(raw: unknown, index: number): TleWebArchiveSnapshot {
  if (raw === null || typeof raw !== 'object') archiveFail(`snapshot ${index} must be an object`);
  const candidate = raw as Record<string, unknown>;
  const archiveDate = requiredText(candidate.archiveDate, `snapshot ${index}.archiveDate`);
  archiveDateMs(archiveDate, `snapshot ${index}.archiveDate`);
  const path = requiredText(candidate.path, `snapshot ${index}.path`);
  const pathMatch = SNAPSHOT_PATH_PATTERN.exec(path);
  if (pathMatch === null || pathMatch[1] !== archiveDate) {
    archiveFail(`snapshot ${index}.path must bind to its archiveDate`, { path, archiveDate });
  }
  const sha256 = requiredText(candidate.sha256, `snapshot ${index}.sha256`);
  if (!SHA256_PATTERN.test(sha256)) archiveFail(`snapshot ${index}.sha256 must be a lowercase SHA-256 digest`);
  const identityCount = finitePositiveInteger(candidate.identityCount ?? candidate.recordCount, `snapshot ${index}.identityCount`);
  if (identityCount !== candidate.recordCount) archiveFail(`snapshot ${index}.identityCount must match recordCount`);
  const minEpochUtc = requiredText(candidate.minEpochUtc, `snapshot ${index}.minEpochUtc`);
  const maxEpochUtc = requiredText(candidate.maxEpochUtc, `snapshot ${index}.maxEpochUtc`);
  const minEpoch = parseUtcInstant(minEpochUtc, `snapshot ${index}.minEpochUtc`);
  const maxEpoch = parseUtcInstant(maxEpochUtc, `snapshot ${index}.maxEpochUtc`);
  if (minEpoch.ms > maxEpoch.ms) archiveFail(`snapshot ${index} minEpochUtc must not be after maxEpochUtc`);
  return Object.freeze({
    archiveDate,
    path,
    byteLength: finitePositiveInteger(candidate.byteLength, `snapshot ${index}.byteLength`),
    recordCount: finitePositiveInteger(candidate.recordCount, `snapshot ${index}.recordCount`),
    identityCount,
    minEpochUtc: minEpoch.value,
    maxEpochUtc: maxEpoch.value,
    sha256,
  });
}

/** Validate the checked-in browser catalog before any snapshot is fetched. */
export function parseTleWebArchiveCatalog(raw: unknown): TleWebArchiveCatalog {
  if (raw === null || typeof raw !== 'object') archiveFail('TLE browser catalog must be an object');
  const candidate = raw as Record<string, unknown>;
  if (candidate.schemaVersion !== 'tle-web-archive-v1') archiveFail('unsupported TLE browser catalog schema');
  if (candidate.constellation !== 'oneweb') archiveFail('browser catalog is not the OneWeb archive');
  if (candidate.sourceKind !== TLE_SOURCE_KIND) archiveFail(`browser catalog sourceKind must be ${TLE_SOURCE_KIND}`);
  if (candidate.propagationModel !== TLE_PROPAGATION_MODEL) archiveFail(`browser catalog propagationModel must be ${TLE_PROPAGATION_MODEL}`);
  const archiveId = requiredText(candidate.archiveId, 'archiveId');
  const archiveContentSha256 = candidate.archiveContentSha256 === undefined
    ? undefined
    : requiredText(candidate.archiveContentSha256, 'archiveContentSha256');
  if (archiveContentSha256 !== undefined && !SHA256_PATTERN.test(archiveContentSha256)) archiveFail('archiveContentSha256 must be a lowercase SHA-256 digest');
  const firstArchiveDate = requiredText(candidate.firstArchiveDate, 'firstArchiveDate');
  const lastArchiveDate = requiredText(candidate.lastArchiveDate, 'lastArchiveDate');
  const firstMs = archiveDateMs(firstArchiveDate, 'firstArchiveDate');
  const lastMs = archiveDateMs(lastArchiveDate, 'lastArchiveDate');
  if (firstMs > lastMs) archiveFail('catalog firstArchiveDate must not be after lastArchiveDate');
  const maxPropagationAgeMs = candidate.maxPropagationAgeMs;
  if (typeof maxPropagationAgeMs !== 'number' || !Number.isFinite(maxPropagationAgeMs) || maxPropagationAgeMs < 0) {
    archiveFail('catalog maxPropagationAgeMs must be finite and non-negative');
  }
  if (!Array.isArray(candidate.snapshots) || candidate.snapshots.length === 0) archiveFail('catalog snapshots must be non-empty');
  const snapshots = candidate.snapshots.map((snapshot, index) => parseSnapshotMetadata(snapshot, index));
  if (candidate.snapshotCount !== snapshots.length) archiveFail('catalog snapshotCount does not match snapshots');
  if (snapshots[0]?.archiveDate !== firstArchiveDate || snapshots[snapshots.length - 1]?.archiveDate !== lastArchiveDate) {
    archiveFail('catalog first/last archive dates do not match snapshots');
  }
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1]!;
    const current = snapshots[index]!;
    if (previous.archiveDate >= current.archiveDate) archiveFail('catalog snapshots must be strictly date ordered');
  }
  return Object.freeze({
    schemaVersion: 'tle-web-archive-v1',
    archiveId,
    ...(archiveContentSha256 === undefined ? {} : { archiveContentSha256 }),
    constellation: 'oneweb',
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    firstArchiveDate,
    lastArchiveDate,
    snapshotCount: snapshots.length,
    maxPropagationAgeMs,
    snapshots: Object.freeze(snapshots),
  });
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new TleArchiveError('INVALID_MANIFEST', 'Web Crypto SHA-256 is unavailable; archive cannot be trusted');
  }
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function decodeUtf8(bytes: ArrayBuffer, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    archiveFail(`${label} is not valid UTF-8`, { cause: String(error) });
  }
}

/** Parse and validate one 3LE snapshot into the isolated TLE contract. */
export function parseTleSnapshotText(
  text: string,
  metadata: TleWebArchiveSnapshot,
): readonly TleArchiveEntry[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0 || lines.some(line => line.trim() === '') || lines.length % 3 !== 0) {
    archiveFail(`${metadata.path} is not a complete 3LE snapshot`);
  }
  const entries: TleArchiveEntry[] = [];
  for (let index = 0; index < lines.length; index += 3) {
    const name = lines[index]!.trim();
    const line1 = lines[index + 1]!;
    const line2 = lines[index + 2]!;
    if (name === '' || !line1.startsWith('1 ') || !line2.startsWith('2 ')) {
      archiveFail(`${metadata.path} contains a malformed record`, { record: index / 3 });
    }
    const validated = validateTleLines(line1, line2);
    entries.push(Object.freeze({
      satelliteId: validated.identity.satelliteId,
      satelliteName: name,
      epochUtc: validated.epoch.epochUtc,
      line1: validated.line1,
      line2: validated.line2,
      sourcePath: metadata.path,
      sourceKind: TLE_SOURCE_KIND,
    }));
  }
  if (entries.length !== metadata.recordCount) {
    archiveFail(`${metadata.path} recordCount disagrees with catalog`, {
      expected: metadata.recordCount,
      actual: entries.length,
    });
  }
  const identities = new Set(entries.map(entry => entry.satelliteId));
  if (identities.size !== entries.length) archiveFail(`${metadata.path} contains duplicate satellite identities`);
  return Object.freeze(entries);
}

async function fetchResponse(fetcher: Fetcher, path: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(path, { cache: 'force-cache' });
  } catch (error) {
    throw new TleArchiveError('INVALID_MANIFEST', `unable to fetch archived TLE resource ${path}`, { cause: String(error) });
  }
  if (!response.ok) throw new TleArchiveError('INVALID_MANIFEST', `archived TLE resource ${path} returned HTTP ${response.status}`);
  return response;
}

export async function loadTleWebArchiveCatalog(
  catalogUrl = '/tle-archive/oneweb/catalog.json',
  fetcher: Fetcher = browserFetcher,
): Promise<TleWebArchiveCatalog> {
  const cached = fetcher === browserFetcher ? catalogPromiseCache.get(catalogUrl) : undefined;
  if (cached !== undefined) return cached;
  const request = loadTleWebArchiveCatalogUncached(catalogUrl, fetcher);
  if (fetcher === browserFetcher) catalogPromiseCache.set(catalogUrl, request);
  return request;
}

async function loadTleWebArchiveCatalogUncached(catalogUrl: string, fetcher: Fetcher): Promise<TleWebArchiveCatalog> {
  const response = await fetchResponse(fetcher, catalogUrl);
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    archiveFail('TLE browser catalog is not valid JSON', { cause: String(error) });
  }
  return parseTleWebArchiveCatalog(raw);
}

export async function loadTleSnapshot(
  metadata: TleWebArchiveSnapshot,
  fetcher: Fetcher = browserFetcher,
): Promise<LoadedTleSnapshot> {
  const cached = fetcher === browserFetcher ? snapshotPromiseCache.get(metadata.path) : undefined;
  if (cached !== undefined) return cached;
  const request = loadTleSnapshotUncached(metadata, fetcher);
  if (fetcher === browserFetcher) snapshotPromiseCache.set(metadata.path, request);
  return request;
}

async function loadTleSnapshotUncached(
  metadata: TleWebArchiveSnapshot,
  fetcher: Fetcher,
): Promise<LoadedTleSnapshot> {
  const response = await fetchResponse(fetcher, metadata.path);
  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch (error) {
    throw new TleArchiveError('INVALID_MANIFEST', `unable to read archived TLE bytes ${metadata.path}`, { cause: String(error) });
  }
  if (bytes.byteLength !== metadata.byteLength) {
    archiveFail(`${metadata.path} byteLength disagrees with catalog`, { expected: metadata.byteLength, actual: bytes.byteLength });
  }
  const sha256 = await sha256Hex(bytes);
  if (sha256 !== metadata.sha256) archiveFail(`${metadata.path} SHA-256 disagrees with catalog`, { expected: metadata.sha256, actual: sha256 });
  const text = decodeUtf8(bytes, metadata.path);
  const entries = parseTleSnapshotText(text, metadata);
  return Object.freeze({ metadata, entries, byteLength: bytes.byteLength, sha256 });
}

function snapshotsCoveringWindow(catalog: TleWebArchiveCatalog, requestedMs: number): readonly TleWebArchiveSnapshot[] {
  const lowerBoundMs = requestedMs - catalog.maxPropagationAgeMs;
  const candidates = catalog.snapshots.filter(snapshot => {
    const minEpochMs = parseUtcInstant(snapshot.minEpochUtc, `${snapshot.archiveDate}.minEpochUtc`).ms;
    const maxEpochMs = parseUtcInstant(snapshot.maxEpochUtc, `${snapshot.archiveDate}.maxEpochUtc`).ms;
    return minEpochMs <= requestedMs && maxEpochMs >= lowerBoundMs;
  });
  if (candidates.length === 0) {
    tleFail('NO_PRIOR_SNAPSHOT', 'archive has no epoch-covering snapshot for the requested instant', { requestedInstantMs: requestedMs });
  }
  return Object.freeze(candidates);
}

/** Load every catalog snapshot whose epoch range can contribute to this request. */
export async function loadTleSnapshotWindow(
  catalog: TleWebArchiveCatalog,
  requestedInstantUtc: string,
  fetcher: Fetcher = browserFetcher,
): Promise<LoadedTleSnapshotWindow> {
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  const candidateMetadata = snapshotsCoveringWindow(catalog, requested.ms);
  const snapshots = await Promise.all(candidateMetadata.map(metadata => loadTleSnapshot(metadata, fetcher)));
  const ordered = [...snapshots].sort((left, right) => left.metadata.archiveDate.localeCompare(right.metadata.archiveDate));
  const current = ordered
    .filter(snapshot => parseUtcInstant(snapshot.metadata.minEpochUtc).ms <= requested.ms)
    .sort((left, right) => right.metadata.maxEpochUtc.localeCompare(left.metadata.maxEpochUtc))[0]
    ?? ordered[ordered.length - 1]!;
  const currentIndex = ordered.findIndex(snapshot => snapshot.metadata.archiveDate === current.metadata.archiveDate);
  const previous = currentIndex > 0 ? ordered[currentIndex - 1]! : null;
  const entries = ordered.flatMap(snapshot => snapshot.entries);
  const manifest = validateTleArchiveManifest(entries, {
    maxPropagationAgeMs: catalog.maxPropagationAgeMs,
    archiveId: catalog.archiveId,
  });
  return Object.freeze({ catalog, current, previous, snapshots: Object.freeze(ordered), manifest });
}

export type { Fetcher as TleArchiveFetcher };
