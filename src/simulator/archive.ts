import { parseUtcInstant } from '../tle/time';
import { TleArchiveError, tleFail } from '../tle/errors';
import { validateTleArchiveManifest, validateTleLines } from '../tle/validation';
import { TLE_PROPAGATION_MODEL, TLE_SOURCE_KIND, type TleArchiveEntry } from '../tle/types';
import type {
  LoadedTleSnapshot,
  LoadedTleSnapshotSelection,
  SimulatorConstellation,
  TleWebArchiveCatalog,
  TleWebArchiveExcludedSnapshot,
  TleWebArchiveSnapshot,
} from './types';

const ARCHIVE_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SUPPORTED_CONSTELLATIONS = new Set<SimulatorConstellation>(['oneweb', 'starlink']);

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const browserFetcher: Fetcher = (input, init) => globalThis.fetch(input, init);
const snapshotPromiseCache = new Map<string, Promise<LoadedTleSnapshot>>();

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

function parseConstellation(value: unknown): SimulatorConstellation {
  if (typeof value !== 'string' || !SUPPORTED_CONSTELLATIONS.has(value as SimulatorConstellation)) {
    archiveFail('browser catalog constellation must be oneweb or starlink', { value });
  }
  return value as SimulatorConstellation;
}

function parseSnapshotMetadata(
  raw: unknown,
  index: number,
  constellation: SimulatorConstellation,
): TleWebArchiveSnapshot {
  if (raw === null || typeof raw !== 'object') archiveFail(`snapshot ${index} must be an object`);
  const candidate = raw as Record<string, unknown>;
  const archiveDate = requiredText(candidate.archiveDate, `snapshot ${index}.archiveDate`);
  archiveDateMs(archiveDate, `snapshot ${index}.archiveDate`);
  const path = requiredText(candidate.path, `snapshot ${index}.path`);
  const expectedPath = `/tle-archive/${constellation}/${constellation}_${archiveDate}.tle`;
  if (path !== expectedPath) {
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

function parseExcludedSnapshot(
  raw: unknown,
  index: number,
  constellation: SimulatorConstellation,
): TleWebArchiveExcludedSnapshot {
  if (raw === null || typeof raw !== 'object') archiveFail(`excluded snapshot ${index} must be an object`);
  const candidate = raw as Record<string, unknown>;
  const fileName = requiredText(candidate.fileName, `excluded snapshot ${index}.fileName`);
  const prefix = `${constellation}_`;
  const archiveDate = fileName.startsWith(prefix) && fileName.endsWith('.tle')
    ? fileName.slice(prefix.length, -4)
    : '';
  if (!/^\d{8}$/.test(archiveDate)) archiveFail(`excluded snapshot ${index}.fileName is outside the ${constellation} archive`);
  archiveDateMs(archiveDate, `excluded snapshot ${index}.fileName date`);
  const sha256 = requiredText(candidate.sha256, `excluded snapshot ${index}.sha256`);
  if (!SHA256_PATTERN.test(sha256)) archiveFail(`excluded snapshot ${index}.sha256 must be a lowercase SHA-256 digest`);
  const reason = requiredText(candidate.reason, `excluded snapshot ${index}.reason`);
  return Object.freeze({ fileName, sha256, reason });
}

/** Validate the checked-in browser catalog before any snapshot is fetched. */
export function parseTleWebArchiveCatalog(raw: unknown): TleWebArchiveCatalog {
  if (raw === null || typeof raw !== 'object') archiveFail('TLE browser catalog must be an object');
  const candidate = raw as Record<string, unknown>;
  if (candidate.schemaVersion !== 'tle-web-archive-v1') archiveFail('unsupported TLE browser catalog schema');
  const constellation = parseConstellation(candidate.constellation);
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
  const snapshots = candidate.snapshots.map((snapshot, index) => parseSnapshotMetadata(snapshot, index, constellation));
  if (candidate.snapshotCount !== snapshots.length) archiveFail('catalog snapshotCount does not match snapshots');
  const excludedSnapshots = candidate.excludedSnapshots === undefined
    ? undefined
    : Array.isArray(candidate.excludedSnapshots)
      ? candidate.excludedSnapshots.map((snapshot, index) => parseExcludedSnapshot(snapshot, index, constellation))
      : archiveFail('catalog excludedSnapshots must be an array');
  const sourceSnapshotCount = candidate.sourceSnapshotCount === undefined
    ? undefined
    : finitePositiveInteger(candidate.sourceSnapshotCount, 'sourceSnapshotCount');
  if ((excludedSnapshots === undefined) !== (sourceSnapshotCount === undefined)) {
    archiveFail('catalog sourceSnapshotCount and excludedSnapshots must be declared together');
  }
  if (excludedSnapshots !== undefined && sourceSnapshotCount !== snapshots.length + excludedSnapshots.length) {
    archiveFail('catalog sourceSnapshotCount must equal valid plus excluded snapshots');
  }
  if (excludedSnapshots !== undefined && new Set(excludedSnapshots.map(snapshot => snapshot.fileName)).size !== excludedSnapshots.length) {
    archiveFail('catalog excludedSnapshots must not repeat file names');
  }
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
    constellation,
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    firstArchiveDate,
    lastArchiveDate,
    snapshotCount: snapshots.length,
    ...(sourceSnapshotCount === undefined ? {} : { sourceSnapshotCount }),
    ...(excludedSnapshots === undefined ? {} : { excludedSnapshots: Object.freeze(excludedSnapshots) }),
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

async function fetchResponse(
  fetcher: Fetcher,
  path: string,
  cache: RequestCache = 'force-cache',
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(path, { cache });
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
  // Catalog files are mutable indexes: adding a new daily snapshot changes
  // the same URL. Always revalidate them so a long-lived dev/browser session
  // cannot keep resolving against yesterday's archive. The immutable daily
  // TLE resources remain force-cached below.
  return loadTleWebArchiveCatalogUncached(catalogUrl, fetcher);
}

async function loadTleWebArchiveCatalogUncached(catalogUrl: string, fetcher: Fetcher): Promise<TleWebArchiveCatalog> {
  const response = await fetchResponse(fetcher, catalogUrl, 'no-cache');
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

/**
 * Resolve the one frozen atomic publication selected by ADR-005 for an
 * instant. This pure seam is shared by browser loading and offline archive
 * mining so filesystem tooling cannot drift to a second publication rule.
 */
export function resolveTleSnapshotMetadata(
  catalog: TleWebArchiveCatalog,
  requestedInstantUtc: string,
): TleWebArchiveSnapshot {
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  const candidateMetadata = snapshotsCoveringWindow(catalog, requested.ms);
  const completePriorCandidates = candidateMetadata.filter(metadata => (
    parseUtcInstant(metadata.maxEpochUtc, `${metadata.archiveDate}.maxEpochUtc`).ms <= requested.ms
  ));
  const selectionPool = completePriorCandidates.length > 0 ? completePriorCandidates : candidateMetadata;
  return [...selectionPool].sort((left, right) => (
    right.archiveDate.localeCompare(left.archiveDate)
    || right.maxEpochUtc.localeCompare(left.maxEpochUtc)
  ))[0]!;
}

/**
 * Admit only records valid at the requested instant from an already verified
 * atomic publication. Callers must obtain `snapshot` from
 * `resolveTleSnapshotMetadata`; cross-publication merging is never accepted.
 */
export function createLoadedTleSnapshotSelection(
  catalog: TleWebArchiveCatalog,
  snapshot: LoadedTleSnapshot,
  requestedInstantUtc: string,
): LoadedTleSnapshotSelection {
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  const selectedMetadata = resolveTleSnapshotMetadata(catalog, requested.value);
  if (
    snapshot.metadata.path !== selectedMetadata.path
    || snapshot.sha256 !== selectedMetadata.sha256
    || snapshot.metadata.sha256 !== selectedMetadata.sha256
  ) {
    archiveFail('loaded snapshot does not match the frozen publication selected for the requested instant', {
      requestedInstantUtc: requested.value,
      expectedPath: selectedMetadata.path,
      actualPath: snapshot.metadata.path,
      expectedSha256: selectedMetadata.sha256,
      actualSha256: snapshot.sha256,
    });
  }
  const lowerBoundMs = requested.ms - catalog.maxPropagationAgeMs;
  const validEntries = snapshot.entries.filter(entry => {
    const epochMs = parseUtcInstant(entry.epochUtc, `${entry.satelliteId}.epochUtc`).ms;
    return epochMs <= requested.ms && epochMs >= lowerBoundMs;
  });
  if (validEntries.length === 0) {
    tleFail('NO_PRIOR_SNAPSHOT', 'selected archive snapshot has no valid TLE records at the requested instant', {
      requestedInstantUtc: requested.value,
      archiveDate: snapshot.metadata.archiveDate,
    });
  }
  const manifest = validateTleArchiveManifest(validEntries, {
    maxPropagationAgeMs: catalog.maxPropagationAgeMs,
    archiveId: catalog.archiveId,
  });
  return Object.freeze({
    catalog,
    snapshot,
    manifest,
  });
}

/** Select and validate one atomic published snapshot for this request. */
export async function loadTleSnapshotSelection(
  catalog: TleWebArchiveCatalog,
  requestedInstantUtc: string,
  fetcher: Fetcher = browserFetcher,
): Promise<LoadedTleSnapshotSelection> {
  // Each source file is an atomic published catalog snapshot. Do not merge
  // successive files: Starlink can legitimately revise element content while
  // retaining an epoch, and cross-publication mixing would create a false
  // identity+epoch conflict. Pick the newest overlapping publication, then
  // admit only records whose own epochs are valid at the requested instant.
  const selectedMetadata = resolveTleSnapshotMetadata(catalog, requestedInstantUtc);
  const snapshot = await loadTleSnapshot(selectedMetadata, fetcher);
  return createLoadedTleSnapshotSelection(catalog, snapshot, requestedInstantUtc);
}

export type { Fetcher as TleArchiveFetcher };
