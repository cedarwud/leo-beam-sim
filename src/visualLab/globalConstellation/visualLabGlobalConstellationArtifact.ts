import {
  eciToEcf,
  gstime,
  type EciVec3,
} from 'satellite.js';

import { deriveObserverLinkGeometry, NTPU_TLE_OBSERVER } from '../../simulator/observer';
import { deriveSatelliteAltitudeKm, propagateTleSnapshot } from '../../tle/propagation';
import { resolveTleSnapshotsFromValidatedManifest } from '../../tle/resolver';
import { parseUtcInstant } from '../../tle/time';
import { validateTleArchiveManifest } from '../../tle/validation';
import {
  TLE_PROPAGATION_MODEL,
  TLE_SOURCE_KIND,
  type TleArchiveEntry,
  type TleArchiveManifest,
  type Vector3,
} from '../../tle/types';
import type { SimulatorConstellation } from '../../simulator/types';

/** The only precomputed global artifact schema accepted by this lane. */
export const VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_SCHEMA =
  'visual-lab-global-constellation-artifact-v1' as const;

/** All default global artifacts are pinned to the same UTC instant. */
export const VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC =
  '2026-08-12T12:00:00.000Z' as const;

export const VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE = '20260812' as const;
export const VISUAL_LAB_GLOBAL_CONSTELLATION_WORLD_FRAME =
  'earth-fixed-radius-2.48-v1' as const;
export const VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD = 2.48 as const;
export const VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_KM = 6_378.137 as const;

export const VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_URLS: Readonly<
  Record<SimulatorConstellation, string>
> = Object.freeze({
  oneweb: '/global-first-frame/oneweb-20260812.json',
  starlink: '/global-first-frame/starlink-20260812.json',
});

export interface VisualLabGlobalConstellationArtifact {
  readonly schema: typeof VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_SCHEMA;
  readonly sourceKind: typeof TLE_SOURCE_KIND;
  readonly propagationModel: typeof TLE_PROPAGATION_MODEL;
  readonly worldFrame: typeof VISUAL_LAB_GLOBAL_CONSTELLATION_WORLD_FRAME;
  readonly constellation: SimulatorConstellation;
  readonly instantUtc: string;
  readonly snapshotPath: string;
  readonly snapshotSha256: string;
  readonly satelliteCount: number;
  readonly ntpuVisibleSatelliteCount: number;
  readonly medianAltitudeKm: number;
  /** NORAD catalog IDs only; display names stay in the source TLE. */
  readonly satelliteIds: readonly string[];
  /** Earth-fixed display positions, flattened as [x0,y0,z0,...]. */
  readonly positionsWorld: readonly number[];
  /** NTPU horizon mask aligned one-to-one with satelliteIds. 1 = visible. */
  readonly visibility: readonly number[];
}

export interface VisualLabGlobalConstellationArtifactBuildOptions {
  readonly constellation: SimulatorConstellation;
  readonly snapshotPath: string;
  readonly snapshotSha256: string;
  readonly instantUtc?: string;
  /** The source catalog's declared maximum age. Defaults to seven days. */
  readonly maxPropagationAgeMs?: number;
}

export interface VisualLabGlobalConstellationArtifactValidationOptions {
  readonly expectedConstellation?: SimulatorConstellation;
  readonly expectedInstantUtc?: string;
  readonly expectedSnapshotPath?: string;
  readonly expectedSnapshotSha256?: string;
}

export type VisualLabGlobalConstellationArtifactFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface LoadVisualLabGlobalConstellationArtifactOptions
  extends VisualLabGlobalConstellationArtifactValidationOptions {
  readonly fetcher?: VisualLabGlobalConstellationArtifactFetcher;
  readonly signal?: AbortSignal;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const NORAD_ID_PATTERN = /^\d{1,6}$/;
const SNAPSHOT_PATH_PATTERN = /^\/tle-archive\/(oneweb|starlink)\/\1_(\d{8})\.tle$/;
const ARTIFACT_KEY_SET = new Set([
  'schema',
  'sourceKind',
  'propagationModel',
  'worldFrame',
  'constellation',
  'instantUtc',
  'snapshotPath',
  'snapshotSha256',
  'satelliteCount',
  'ntpuVisibleSatelliteCount',
  'medianAltitudeKm',
  'satelliteIds',
  'positionsWorld',
  'visibility',
]);

const browserFetcher: VisualLabGlobalConstellationArtifactFetcher = (
  input,
  init,
) => globalThis.fetch(input, init);

function fail(path: string, message: string): never {
  throw new Error(`invalid visual-lab global constellation artifact at ${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>, path: string): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.size || actual.some(key => !expected.has(key))) {
    fail(path, `has unexpected or missing keys: ${actual.sort().join(', ')}`);
  }
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'must be a non-empty string');
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be finite');
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(path, 'must be a positive integer');
  }
  return value;
}

function canonicalUtc(value: unknown, path: string): string {
  const text = requiredString(value, path);
  const parsed = parseUtcInstant(text, path);
  if (parsed.value !== text) fail(path, 'must be a canonical ISO-8601 UTC instant');
  return parsed.value;
}

function snapshotPathFor(constellation: SimulatorConstellation): string {
  return `/tle-archive/${constellation}/${constellation}_${VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE}.tle`;
}

function assertSnapshotPath(
  value: unknown,
  constellation: SimulatorConstellation,
  path: string,
): string {
  const snapshotPath = requiredString(value, path);
  const match = SNAPSHOT_PATH_PATTERN.exec(snapshotPath);
  if (match === null || match[1] !== constellation || match[2] !== VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE) {
    fail(path, `must be the ${constellation} ${VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE} archived TLE path`);
  }
  return snapshotPath;
}

function artifactConstellation(value: unknown, path: string): SimulatorConstellation {
  if (value !== 'oneweb' && value !== 'starlink') fail(path, 'must be oneweb or starlink');
  return value;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function worldPositionFromTeme(positionTemeKm: Vector3, instantUtc: string): readonly [number, number, number] {
  const ecf = eciToEcf(
    positionTemeKm as EciVec3<number>,
    gstime(new Date(Date.parse(instantUtc))),
  );
  const scale = VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD
    / VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_KM;
  return [
    round(ecf.x * scale, 6),
    round(ecf.z * scale, 6),
    round(-ecf.y * scale, 6),
  ];
}

function manifestForEntries(
  entries: readonly TleArchiveEntry[],
  options: VisualLabGlobalConstellationArtifactBuildOptions,
): TleArchiveManifest {
  const maxPropagationAgeMs = options.maxPropagationAgeMs ?? 7 * 24 * 60 * 60 * 1_000;
  if (!Number.isFinite(maxPropagationAgeMs) || maxPropagationAgeMs < 0) {
    throw new RangeError('global constellation artifact maxPropagationAgeMs must be finite and non-negative');
  }
  return Object.freeze({
    entries,
    maxPropagationAgeMs,
    archiveId: `global-first-frame-${options.constellation}-${VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE}`,
  });
}

/**
 * Build the compact global frame from one validated published 3LE snapshot.
 * The caller supplies the source bytes and digest; this function never
 * discovers another publication or synthesizes an identity for a failed
 * record.
 */
export function buildVisualLabGlobalConstellationArtifact(
  entries: readonly TleArchiveEntry[],
  options: VisualLabGlobalConstellationArtifactBuildOptions,
): VisualLabGlobalConstellationArtifact {
  const instantUtc = options.instantUtc ?? VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC;
  const parsedInstant = parseUtcInstant(instantUtc, 'instantUtc');
  if (parsedInstant.value !== instantUtc) throw new Error('global constellation artifact instantUtc must be canonical UTC');
  if (!SHA256_PATTERN.test(options.snapshotSha256)) throw new Error('global constellation artifact snapshotSha256 must be lowercase SHA-256');
  if (options.snapshotPath !== snapshotPathFor(options.constellation)) {
    throw new Error(`global constellation artifact snapshotPath must be ${snapshotPathFor(options.constellation)}`);
  }
  if (entries.length === 0) throw new Error('global constellation artifact cannot be built from an empty snapshot');
  if (entries.some(entry => entry.sourcePath !== options.snapshotPath || entry.sourceKind !== TLE_SOURCE_KIND)) {
    throw new Error('global constellation artifact entries must all come from the one archived snapshot');
  }

  const manifest = validateTleArchiveManifest(manifestForEntries(entries, options));
  const snapshots = resolveTleSnapshotsFromValidatedManifest(manifest, instantUtc);
  if (snapshots.length !== entries.length) {
    throw new Error('global constellation artifact resolution changed the published satellite set');
  }

  const propagated = snapshots.map(snapshot => {
    const state = propagateTleSnapshot(snapshot, instantUtc);
    const observer = deriveObserverLinkGeometry(state.positionTemeKm, instantUtc, NTPU_TLE_OBSERVER);
    const altitudeKm = deriveSatelliteAltitudeKm(state.positionTemeKm, instantUtc);
    return {
      satelliteId: state.satelliteId,
      positionWorld: worldPositionFromTeme(state.positionTemeKm, instantUtc),
      visible: observer.visible,
      altitudeKm,
    };
  }).sort((left, right) => left.satelliteId.localeCompare(right.satelliteId));

  const satelliteIds = propagated.map(item => item.satelliteId);
  if (new Set(satelliteIds).size !== satelliteIds.length) {
    throw new Error('global constellation artifact contains duplicate satellite identities');
  }
  const positionsWorld = propagated.flatMap(item => item.positionWorld);
  const visibility = propagated.map(item => item.visible ? 1 : 0);
  const altitudes = propagated.map(item => item.altitudeKm).sort((left, right) => left - right);
  const middle = Math.floor(altitudes.length / 2);
  const medianAltitudeKm = round(altitudes.length % 2 === 1
    ? altitudes[middle]!
    : (altitudes[middle - 1]! + altitudes[middle]!) / 2, 3);

  return validateVisualLabGlobalConstellationArtifact({
    schema: VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_SCHEMA,
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    worldFrame: VISUAL_LAB_GLOBAL_CONSTELLATION_WORLD_FRAME,
    constellation: options.constellation,
    instantUtc,
    snapshotPath: options.snapshotPath,
    snapshotSha256: options.snapshotSha256,
    satelliteCount: satelliteIds.length,
    ntpuVisibleSatelliteCount: visibility.reduce<number>((sum, value) => sum + value, 0),
    medianAltitudeKm,
    satelliteIds,
    positionsWorld,
    visibility,
  }, {
    expectedConstellation: options.constellation,
    expectedInstantUtc: instantUtc,
    expectedSnapshotPath: options.snapshotPath,
    expectedSnapshotSha256: options.snapshotSha256,
  });
}

/**
 * Validate untrusted JSON before a renderer can consume it.  No fallback,
 * second publication, or identity reconstruction occurs at this boundary.
 */
export function validateVisualLabGlobalConstellationArtifact(
  input: unknown,
  options: VisualLabGlobalConstellationArtifactValidationOptions = {},
): VisualLabGlobalConstellationArtifact {
  const value = record(input, 'artifact');
  exactKeys(value, ARTIFACT_KEY_SET, 'artifact');
  if (value.schema !== VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_SCHEMA) fail('artifact.schema', 'unsupported schema');
  if (value.sourceKind !== TLE_SOURCE_KIND) fail('artifact.sourceKind', `must be ${TLE_SOURCE_KIND}`);
  if (value.propagationModel !== TLE_PROPAGATION_MODEL) fail('artifact.propagationModel', `must be ${TLE_PROPAGATION_MODEL}`);
  if (value.worldFrame !== VISUAL_LAB_GLOBAL_CONSTELLATION_WORLD_FRAME) fail('artifact.worldFrame', 'unsupported world coordinate frame');
  const constellation = artifactConstellation(value.constellation, 'artifact.constellation');
  if (options.expectedConstellation !== undefined && constellation !== options.expectedConstellation) {
    fail('artifact.constellation', `does not match expected ${options.expectedConstellation}`);
  }
  const expectedInstantUtc = options.expectedInstantUtc ?? VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC;
  const instantUtc = canonicalUtc(value.instantUtc, 'artifact.instantUtc');
  if (instantUtc !== expectedInstantUtc) fail('artifact.instantUtc', `must be ${expectedInstantUtc}`);
  const snapshotPath = assertSnapshotPath(value.snapshotPath, constellation, 'artifact.snapshotPath');
  if (options.expectedSnapshotPath !== undefined && snapshotPath !== options.expectedSnapshotPath) {
    fail('artifact.snapshotPath', `does not match expected ${options.expectedSnapshotPath}`);
  }
  const snapshotSha256 = requiredString(value.snapshotSha256, 'artifact.snapshotSha256');
  if (!SHA256_PATTERN.test(snapshotSha256)) fail('artifact.snapshotSha256', 'must be a lowercase SHA-256 digest');
  if (options.expectedSnapshotSha256 !== undefined && snapshotSha256 !== options.expectedSnapshotSha256) {
    fail('artifact.snapshotSha256', 'does not match the accepted source snapshot');
  }

  const satelliteCount = positiveInteger(value.satelliteCount, 'artifact.satelliteCount');
  const ntpuVisibleSatelliteCount = finiteNumber(value.ntpuVisibleSatelliteCount, 'artifact.ntpuVisibleSatelliteCount');
  if (!Number.isInteger(ntpuVisibleSatelliteCount) || ntpuVisibleSatelliteCount < 0 || ntpuVisibleSatelliteCount > satelliteCount) {
    fail('artifact.ntpuVisibleSatelliteCount', 'must be an integer between zero and satelliteCount');
  }
  const medianAltitudeKm = finiteNumber(value.medianAltitudeKm, 'artifact.medianAltitudeKm');
  if (medianAltitudeKm <= 0) fail('artifact.medianAltitudeKm', 'must be positive');

  if (!Array.isArray(value.satelliteIds) || value.satelliteIds.length !== satelliteCount) {
    fail('artifact.satelliteIds', 'must contain exactly satelliteCount entries');
  }
  const satelliteIds = value.satelliteIds.map((id, index) => {
    if (typeof id !== 'string' || !NORAD_ID_PATTERN.test(id)) fail(`artifact.satelliteIds[${index}]`, 'must be a compact NORAD catalog ID');
    return id;
  });
  if (new Set(satelliteIds).size !== satelliteIds.length) fail('artifact.satelliteIds', 'must not contain duplicate identities');

  if (!Array.isArray(value.positionsWorld) || value.positionsWorld.length !== satelliteCount * 3) {
    fail('artifact.positionsWorld', 'must be a flat array with three coordinates per satellite');
  }
  const positionsWorld = value.positionsWorld.map((coordinate, index) => finiteNumber(coordinate, `artifact.positionsWorld[${index}]`));
  for (let index = 0; index < satelliteCount; index += 1) {
    const offset = index * 3;
    const radius = Math.hypot(positionsWorld[offset]!, positionsWorld[offset + 1]!, positionsWorld[offset + 2]!);
    if (radius <= VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD) {
      fail(`artifact.positionsWorld[${offset}:${offset + 3}]`, 'satellite must be outside the Earth shell');
    }
  }

  if (!Array.isArray(value.visibility) || value.visibility.length !== satelliteCount) {
    fail('artifact.visibility', 'must align one-to-one with satelliteIds');
  }
  const visibility = value.visibility.map((entry, index) => {
    if (entry !== 0 && entry !== 1) fail(`artifact.visibility[${index}]`, 'must be 0 or 1');
    return entry;
  });
  const computedVisibleCount = visibility.reduce((sum, entry) => sum + entry, 0);
  if (computedVisibleCount !== ntpuVisibleSatelliteCount) {
    fail('artifact.ntpuVisibleSatelliteCount', 'does not match the NTPU visibility mask');
  }

  return Object.freeze({
    schema: VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_SCHEMA,
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    worldFrame: VISUAL_LAB_GLOBAL_CONSTELLATION_WORLD_FRAME,
    constellation,
    instantUtc,
    snapshotPath,
    snapshotSha256,
    satelliteCount,
    ntpuVisibleSatelliteCount,
    medianAltitudeKm,
    satelliteIds: Object.freeze(satelliteIds),
    positionsWorld: Object.freeze(positionsWorld),
    visibility: Object.freeze(visibility),
  });
}

export const parseVisualLabGlobalConstellationArtifact = validateVisualLabGlobalConstellationArtifact;

/** Load one static artifact and refuse any invalid source identity. */
export async function loadVisualLabGlobalConstellationArtifact(
  url = VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_URLS.starlink,
  optionsOrFetcher: LoadVisualLabGlobalConstellationArtifactOptions | VisualLabGlobalConstellationArtifactFetcher = {},
): Promise<VisualLabGlobalConstellationArtifact> {
  const options: LoadVisualLabGlobalConstellationArtifactOptions = typeof optionsOrFetcher === 'function'
    ? { fetcher: optionsOrFetcher }
    : optionsOrFetcher;
  const fetcher = options.fetcher ?? browserFetcher;
  const response = await fetcher(url, { cache: 'no-cache', signal: options.signal });
  if (!response.ok) throw new Error(`global constellation artifact returned HTTP ${response.status}`);
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    throw new Error(`global constellation artifact is not valid JSON: ${String(error)}`);
  }
  const expectedConstellation = options.expectedConstellation
    ?? (url.includes('/oneweb-') ? 'oneweb' : url.includes('/starlink-') ? 'starlink' : undefined);
  return validateVisualLabGlobalConstellationArtifact(raw, {
    expectedConstellation,
    expectedInstantUtc: options.expectedInstantUtc,
    expectedSnapshotPath: options.expectedSnapshotPath,
    expectedSnapshotSha256: options.expectedSnapshotSha256,
  });
}
