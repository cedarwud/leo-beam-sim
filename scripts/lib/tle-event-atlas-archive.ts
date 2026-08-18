import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import {
  createLoadedTleSnapshotSelection,
  parseTleSnapshotText,
  parseTleWebArchiveCatalog,
  resolveTleSnapshotMetadata,
} from '../../src/simulator/archive';
import type {
  LoadedTleSnapshot,
  LoadedTleSnapshotSelection,
  SimulatorConstellation,
  TleWebArchiveCatalog,
  TleWebArchiveExcludedSnapshot,
  TleWebArchiveSnapshot,
} from '../../src/simulator/types';
import { TLE_PROPAGATION_MODEL, TLE_SOURCE_KIND } from '../../src/tle/types';

export const TLE_EVENT_ATLAS_ARCHIVE_CACHE_SCHEMA = 'tle-event-atlas-archive-cache-v1' as const;
export const TLE_EVENT_ATLAS_MAX_PROPAGATION_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export interface TleEventAtlasSourceInventoryEntry {
  readonly fileName: string;
  readonly byteLength: number;
  readonly mtimeMs: number;
}

export interface TleEventAtlasArchiveCache {
  readonly schema: typeof TLE_EVENT_ATLAS_ARCHIVE_CACHE_SCHEMA;
  readonly generatedAtUtc: string;
  readonly constellation: SimulatorConstellation;
  readonly sourceDirectory: string;
  readonly inventory: readonly TleEventAtlasSourceInventoryEntry[];
  readonly catalog: TleWebArchiveCatalog;
}

export interface PrepareTleEventAtlasArchiveOptions {
  readonly sourceRoot: string;
  readonly constellation: SimulatorConstellation;
  readonly cachePath: string;
  readonly rebuild?: boolean;
  readonly onProgress?: (message: string) => void;
}

export interface PreparedTleEventAtlasArchive {
  readonly cache: TleEventAtlasArchiveCache;
  readonly catalog: TleWebArchiveCatalog;
  readonly sourceDirectory: string;
  readonly loadSelection: (requestedT0Utc: string) => Promise<LoadedTleSnapshotSelection>;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function publicationPattern(constellation: SimulatorConstellation): RegExp {
  return new RegExp(`^${constellation}_(\\d{8})\\.tle$`);
}

async function sourceInventory(
  sourceDirectory: string,
  constellation: SimulatorConstellation,
): Promise<readonly TleEventAtlasSourceInventoryEntry[]> {
  const pattern = publicationPattern(constellation);
  const names = (await readdir(sourceDirectory))
    .filter(name => pattern.test(name))
    .sort();
  if (names.length === 0) throw new Error(`no ${constellation} TLE publications found in ${sourceDirectory}`);
  const entries = await Promise.all(names.map(async fileName => {
    const metadata = await stat(join(sourceDirectory, fileName));
    if (!metadata.isFile()) throw new Error(`${join(sourceDirectory, fileName)} is not a regular file`);
    return Object.freeze({
      fileName,
      byteLength: metadata.size,
      mtimeMs: Math.trunc(metadata.mtimeMs),
    });
  }));
  return Object.freeze(entries);
}

function sameInventory(
  left: readonly TleEventAtlasSourceInventoryEntry[],
  right: readonly TleEventAtlasSourceInventoryEntry[],
): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && entry.fileName === candidate.fileName
      && entry.byteLength === candidate.byteLength
      && entry.mtimeMs === candidate.mtimeMs;
  });
}

function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8: ${String(error)}`);
  }
}

function provisionalSnapshotMetadata(
  constellation: SimulatorConstellation,
  archiveDate: string,
  bytes: Uint8Array,
  text: string,
): TleWebArchiveSnapshot {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0 || lines.length % 3 !== 0) {
    throw new Error('publication is not a complete 3LE snapshot');
  }
  const recordCount = lines.length / 3;
  return {
    archiveDate,
    path: `/tle-archive/${constellation}/${constellation}_${archiveDate}.tle`,
    byteLength: bytes.byteLength,
    recordCount,
    identityCount: recordCount,
    minEpochUtc: '1970-01-01T00:00:00.000Z',
    maxEpochUtc: '1970-01-01T00:00:00.000Z',
    sha256: sha256(bytes),
  };
}

async function inspectPublication(
  sourceDirectory: string,
  constellation: SimulatorConstellation,
  inventory: TleEventAtlasSourceInventoryEntry,
): Promise<TleWebArchiveSnapshot> {
  const match = publicationPattern(constellation).exec(inventory.fileName);
  if (match === null) throw new Error(`unexpected ${constellation} publication name ${inventory.fileName}`);
  const archiveDate = match[1]!;
  const bytes = new Uint8Array(await readFile(join(sourceDirectory, inventory.fileName)));
  if (bytes.byteLength !== inventory.byteLength) {
    throw new Error(`${inventory.fileName} changed size while the archive catalog was being built`);
  }
  const text = decodeUtf8(bytes, inventory.fileName);
  const provisional = provisionalSnapshotMetadata(constellation, archiveDate, bytes, text);
  const entries = parseTleSnapshotText(text, provisional);
  const epochs = entries.map(entry => entry.epochUtc).sort();
  return Object.freeze({
    ...provisional,
    minEpochUtc: epochs[0]!,
    maxEpochUtc: epochs[epochs.length - 1]!,
  });
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}

function parseCache(value: unknown): TleEventAtlasArchiveCache {
  if (value === null || typeof value !== 'object') throw new Error('archive cache must be an object');
  const candidate = value as Partial<TleEventAtlasArchiveCache>;
  if (candidate.schema !== TLE_EVENT_ATLAS_ARCHIVE_CACHE_SCHEMA) throw new Error('unsupported archive cache schema');
  if (candidate.constellation !== 'starlink' && candidate.constellation !== 'oneweb') {
    throw new Error('archive cache constellation is unsupported');
  }
  if (typeof candidate.sourceDirectory !== 'string' || !Array.isArray(candidate.inventory)) {
    throw new Error('archive cache source identity is malformed');
  }
  return Object.freeze({
    schema: TLE_EVENT_ATLAS_ARCHIVE_CACHE_SCHEMA,
    generatedAtUtc: String(candidate.generatedAtUtc),
    constellation: candidate.constellation,
    sourceDirectory: candidate.sourceDirectory,
    inventory: Object.freeze(candidate.inventory.map(entry => Object.freeze({ ...entry }))),
    catalog: parseTleWebArchiveCatalog(candidate.catalog),
  });
}

async function readCache(path: string): Promise<TleEventAtlasArchiveCache | null> {
  try {
    return parseCache(JSON.parse(await readFile(path, 'utf8')) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function buildCache(
  options: PrepareTleEventAtlasArchiveOptions,
  sourceDirectory: string,
  inventory: readonly TleEventAtlasSourceInventoryEntry[],
): Promise<TleEventAtlasArchiveCache> {
  const snapshots: TleWebArchiveSnapshot[] = [];
  const excludedSnapshots: TleWebArchiveExcludedSnapshot[] = [];
  for (let index = 0; index < inventory.length; index += 1) {
    const item = inventory[index]!;
    options.onProgress?.(`catalog ${options.constellation} ${index + 1}/${inventory.length}: ${item.fileName}`);
    try {
      snapshots.push(await inspectPublication(sourceDirectory, options.constellation, item));
    } catch (error) {
      const bytes = new Uint8Array(await readFile(join(sourceDirectory, item.fileName)));
      excludedSnapshots.push(Object.freeze({
        fileName: item.fileName,
        sha256: sha256(bytes),
        reason: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  if (snapshots.length === 0) throw new Error(`all ${options.constellation} TLE publications were excluded`);
  snapshots.sort((left, right) => left.archiveDate.localeCompare(right.archiveDate));
  const archiveContentSha256 = sha256(JSON.stringify({
    snapshots: snapshots.map(snapshot => [snapshot.archiveDate, snapshot.sha256]),
    exclusions: excludedSnapshots.map(snapshot => [snapshot.fileName, snapshot.sha256, snapshot.reason]),
  }));
  const catalog = parseTleWebArchiveCatalog({
    schemaVersion: 'tle-web-archive-v1',
    archiveId: `${options.constellation}-filesystem-archive-v1`,
    archiveContentSha256,
    constellation: options.constellation,
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    firstArchiveDate: snapshots[0]!.archiveDate,
    lastArchiveDate: snapshots[snapshots.length - 1]!.archiveDate,
    snapshotCount: snapshots.length,
    sourceSnapshotCount: inventory.length,
    excludedSnapshots,
    maxPropagationAgeMs: TLE_EVENT_ATLAS_MAX_PROPAGATION_AGE_MS,
    snapshots,
  });
  const cache = Object.freeze({
    schema: TLE_EVENT_ATLAS_ARCHIVE_CACHE_SCHEMA,
    generatedAtUtc: new Date().toISOString(),
    constellation: options.constellation,
    sourceDirectory,
    inventory,
    catalog,
  });
  await atomicWriteJson(options.cachePath, cache);
  return cache;
}

function createSelectionLoader(
  cache: TleEventAtlasArchiveCache,
): (requestedT0Utc: string) => Promise<LoadedTleSnapshotSelection> {
  const snapshots = new Map<string, LoadedTleSnapshot>();
  const maximumCachedPublications = 3;
  return async requestedT0Utc => {
    const metadata = resolveTleSnapshotMetadata(cache.catalog, requestedT0Utc);
    let snapshot = snapshots.get(metadata.path);
    if (snapshot === undefined) {
      const fileName = metadata.path.slice(metadata.path.lastIndexOf('/') + 1);
      const bytes = new Uint8Array(await readFile(join(cache.sourceDirectory, fileName)));
      if (bytes.byteLength !== metadata.byteLength) throw new Error(`${fileName} byte length no longer matches the frozen catalog`);
      const digest = sha256(bytes);
      if (digest !== metadata.sha256) throw new Error(`${fileName} SHA-256 no longer matches the frozen catalog`);
      const text = decodeUtf8(bytes, fileName);
      snapshot = Object.freeze({
        metadata,
        entries: parseTleSnapshotText(text, metadata),
        byteLength: bytes.byteLength,
        sha256: digest,
      });
      snapshots.set(metadata.path, snapshot);
      while (snapshots.size > maximumCachedPublications) {
        const oldestKey = snapshots.keys().next().value as string | undefined;
        if (oldestKey === undefined) break;
        snapshots.delete(oldestKey);
      }
    } else {
      snapshots.delete(metadata.path);
      snapshots.set(metadata.path, snapshot);
    }
    return createLoadedTleSnapshotSelection(cache.catalog, snapshot, requestedT0Utc);
  };
}

/** Prepare and validate a read-only filesystem TLE archive for mining. */
export async function prepareTleEventAtlasArchive(
  options: PrepareTleEventAtlasArchiveOptions,
): Promise<PreparedTleEventAtlasArchive> {
  const sourceDirectory = resolve(options.sourceRoot, options.constellation, 'tle');
  const inventory = await sourceInventory(sourceDirectory, options.constellation);
  const cached = options.rebuild ? null : await readCache(options.cachePath);
  const cache = cached !== null
    && cached.constellation === options.constellation
    && cached.sourceDirectory === sourceDirectory
    && sameInventory(cached.inventory, inventory)
    ? cached
    : await buildCache(options, sourceDirectory, inventory);
  if (cache.catalog.archiveContentSha256 === undefined) {
    throw new Error('filesystem archive catalog has no content digest');
  }
  return Object.freeze({
    cache,
    catalog: cache.catalog,
    sourceDirectory,
    loadSelection: createSelectionLoader(cache),
  });
}
