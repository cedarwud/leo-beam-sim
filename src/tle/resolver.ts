import { tleFail } from './errors';
import { parseUtcInstant } from './time';
import { validateTleArchiveManifest } from './validation';
import type {
  ResolveTleSnapshotOptions,
  ResolvedTleSnapshot,
  TleArchiveEntry,
  TleArchiveManifest,
  UtcInstantInput,
} from './types';

type ManifestInput = TleArchiveManifest | readonly TleArchiveEntry[];

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function normalizeMaxAge(options: ResolveTleSnapshotOptions | undefined, manifestMaxAge: number): number {
  const requested = options?.maxPropagationAgeMs ?? options?.maxAgeMs;
  if (requested === undefined) return manifestMaxAge;
  if (typeof requested !== 'number' || !Number.isFinite(requested) || requested < 0) {
    tleFail('INVALID_MANIFEST', 'maxPropagationAgeMs must be a finite non-negative number');
  }
  return requested;
}

function normalizedManifest(input: ManifestInput, options: ResolveTleSnapshotOptions | undefined): TleArchiveManifest {
  if (Array.isArray(input)) {
    return validateTleArchiveManifest(input, {
      maxPropagationAgeMs: options?.maxPropagationAgeMs ?? options?.maxAgeMs,
    });
  }
  return validateTleArchiveManifest(input);
}

interface IndexedTleEntry {
  readonly entry: TleArchiveEntry;
  readonly epochMs: number;
}

interface ValidatedTleArchiveIndex {
  readonly manifest: TleArchiveManifest;
  readonly satelliteIds: readonly string[];
  readonly entriesBySatellite: ReadonlyMap<string, readonly IndexedTleEntry[]>;
}

/** Build once per validated manifest; callers must not pass unvalidated input. */
function indexValidatedManifest(manifest: TleArchiveManifest): ValidatedTleArchiveIndex {
  const grouped = new Map<string, IndexedTleEntry[]>();
  for (const entry of manifest.entries) {
    const epochMs = Date.parse(entry.epochUtc);
    const bucket = grouped.get(entry.satelliteId) ?? [];
    bucket.push({ entry, epochMs });
    grouped.set(entry.satelliteId, bucket);
  }
  const entriesBySatellite = new Map<string, readonly IndexedTleEntry[]>();
  for (const [satelliteId, entries] of grouped) {
    entries.sort((left, right) => left.epochMs - right.epochMs || left.entry.sourcePath.localeCompare(right.entry.sourcePath));
    entriesBySatellite.set(satelliteId, freeze(entries));
  }
  return {
    manifest,
    satelliteIds: freeze([...entriesBySatellite.keys()].sort()),
    entriesBySatellite,
  };
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

function isLikelyUtc(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

interface ParsedResolverArgs {
  readonly requested: UtcInstantInput;
  readonly satelliteId?: string;
  readonly options?: ResolveTleSnapshotOptions;
}

/**
 * Supports both useful call forms:
 *
 *   resolveTleSnapshot(manifest, requestedUtc, satelliteId?, options?)
 *   resolveTleSnapshot(manifest, satelliteId, requestedUtc, options?)
 *
 * The first form is the canonical one for a single-satellite archive.  The
 * second keeps the per-satellite identity explicit for a multi-satellite
 * archive and is detected without accepting ambiguous local timestamps.
 */
function parseResolverArgs(
  first: unknown,
  second: unknown,
  third: unknown,
  fourth: unknown,
): ParsedResolverArgs {
  if (isDate(first)) {
    return {
      requested: first,
      satelliteId: typeof second === 'string' ? second : undefined,
      options: (typeof third === 'object' && third !== null ? third : typeof second === 'object' && second !== null ? second : typeof fourth === 'object' && fourth !== null ? fourth : undefined) as ResolveTleSnapshotOptions | undefined,
    };
  }
  if (isDate(second) || isLikelyUtc(second)) {
    return {
      requested: second as UtcInstantInput,
      satelliteId: typeof first === 'string' ? first : undefined,
      options: (typeof third === 'object' && third !== null ? third : typeof fourth === 'object' && fourth !== null ? fourth : undefined) as ResolveTleSnapshotOptions | undefined,
    };
  }
  if (isLikelyUtc(first)) {
    return {
      requested: first as string,
      satelliteId: typeof second === 'string' ? second : undefined,
      options: (typeof third === 'object' && third !== null ? third : typeof second === 'object' && second !== null ? second : typeof fourth === 'object' && fourth !== null ? fourth : undefined) as ResolveTleSnapshotOptions | undefined,
    };
  }
  return {
    requested: first as UtcInstantInput,
    satelliteId: typeof second === 'string' ? second : undefined,
    options: (typeof third === 'object' && third !== null ? third : typeof fourth === 'object' && fourth !== null ? fourth : undefined) as ResolveTleSnapshotOptions | undefined,
  };
}

function identityForIndex(index: ValidatedTleArchiveIndex, requestedSatelliteId?: string): string {
  const satelliteId = requestedSatelliteId ?? (index.satelliteIds.length === 1 ? index.satelliteIds[0] : undefined);
  if (satelliteId === undefined || satelliteId.trim() === '') {
    tleFail('SATELLITE_ID_REQUIRED', 'a satelliteId is required when the manifest contains multiple satellites');
  }
  return satelliteId;
}

function buildSnapshot(
  entry: TleArchiveEntry,
  requestedInstantUtc: string,
  ageMs: number,
  maxPropagationAgeMs: number,
  archiveId?: string,
): ResolvedTleSnapshot {
  const provenance = freeze({
    satelliteId: entry.satelliteId,
    satelliteName: entry.satelliteName,
    sourcePath: entry.sourcePath,
    sourceKind: entry.sourceKind,
    epochUtc: entry.epochUtc,
    line1: entry.line1,
    line2: entry.line2,
    ...(archiveId === undefined ? {} : { archiveId }),
  });
  return freeze({
    ...entry,
    requestedInstantUtc,
    ageMs,
    maxPropagationAgeMs,
    provenance,
  });
}

function resolveIndexedSnapshot(
  index: ValidatedTleArchiveIndex,
  requested: { readonly value: string; readonly ms: number },
  requestedSatelliteId: string | undefined,
  options: ResolveTleSnapshotOptions | undefined,
  maxPropagationAgeMs = normalizeMaxAge(options, index.manifest.maxPropagationAgeMs),
): ResolvedTleSnapshot {
  const satelliteId = identityForIndex(index, requestedSatelliteId ?? options?.satelliteId);
  const candidates = index.entriesBySatellite.get(satelliteId);
  if (candidates === undefined || candidates.length === 0) {
    tleFail('SATELLITE_NOT_FOUND', `archive contains no TLE entries for satellite ${satelliteId}`, { satelliteId });
  }
  let low = 0;
  let high = candidates.length - 1;
  let selectedIndex = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = candidates[middle]!;
    if (candidate.epochMs <= requested.ms) {
      selectedIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (selectedIndex < 0) {
    tleFail('NO_PRIOR_SNAPSHOT', `no archived TLE epoch exists on or before ${requested.value}`, {
      satelliteId,
      requestedInstantUtc: requested.value,
    });
  }
  const selected = candidates[selectedIndex]!;
  const ageMs = requested.ms - selected.epochMs;
  if (ageMs > maxPropagationAgeMs) {
    tleFail('STALE_SNAPSHOT', `newest archived TLE for ${satelliteId} is ${ageMs} ms old, exceeding max age ${maxPropagationAgeMs} ms`, {
      satelliteId,
      requestedInstantUtc: requested.value,
      epochUtc: selected.entry.epochUtc,
      ageMs,
      maxPropagationAgeMs,
    });
  }
  return buildSnapshot(selected.entry, requested.value, ageMs, maxPropagationAgeMs, index.manifest.archiveId);
}

/**
 * Internal batch seam used by the frame producer after it has already
 * validated the manifest.  Keeping this out of the public index prevents a
 * caller from accidentally bypassing validation while avoiding N full scans
 * for a multi-satellite frame.
 */
export function resolveTleSnapshotsFromValidatedManifest(
  manifest: TleArchiveManifest,
  requestedInstantUtc: UtcInstantInput,
  satelliteIds?: readonly string[],
  options?: ResolveTleSnapshotOptions,
): readonly ResolvedTleSnapshot[] {
  const index = indexValidatedManifest(manifest);
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  const ids = satelliteIds === undefined ? index.satelliteIds : [...satelliteIds];
  if (ids.length === 0) tleFail('SATELLITE_ID_REQUIRED', 'at least one satelliteId is required');
  const maxPropagationAgeMs = normalizeMaxAge(options, manifest.maxPropagationAgeMs);
  return freeze(ids.map((id) => resolveIndexedSnapshot(index, requested, id, options, maxPropagationAgeMs)));
}

/** Resolve the newest valid archived element set not later than an instant. */
export function resolveTleSnapshot(
  input: ManifestInput,
  requestedInstantUtc: UtcInstantInput,
  satelliteId?: string,
  options?: ResolveTleSnapshotOptions,
): ResolvedTleSnapshot;
export function resolveTleSnapshot(
  input: ManifestInput,
  requestedInstantUtc: UtcInstantInput,
  options?: ResolveTleSnapshotOptions,
): ResolvedTleSnapshot;
export function resolveTleSnapshot(
  input: ManifestInput,
  satelliteId: string,
  requestedInstantUtc: UtcInstantInput,
  options?: ResolveTleSnapshotOptions,
): ResolvedTleSnapshot;
export function resolveTleSnapshot(
  input: ManifestInput,
  first: unknown,
  second?: unknown,
  third?: unknown,
): ResolvedTleSnapshot {
  const parsed = parseResolverArgs(first, second, third, undefined);
  const manifest = normalizedManifest(input, parsed.options);
  const requested = parseUtcInstant(parsed.requested, 'requestedInstantUtc');
  return resolveIndexedSnapshot(
    indexValidatedManifest(manifest),
    requested,
    parsed.satelliteId,
    parsed.options,
  );
}

/** Resolve one snapshot per requested satellite, sorted by satellite identity. */
export function resolveTleSnapshots(
  input: ManifestInput,
  requestedInstantUtc: UtcInstantInput,
  satelliteIds?: readonly string[],
  options?: ResolveTleSnapshotOptions,
): readonly ResolvedTleSnapshot[] {
  const manifest = normalizedManifest(input, options);
  return resolveTleSnapshotsFromValidatedManifest(manifest, requestedInstantUtc, satelliteIds, options);
}

export const resolveArchivedTleSnapshot = resolveTleSnapshot;
