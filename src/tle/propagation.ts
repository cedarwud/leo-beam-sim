import { propagate, twoline2satrec } from 'satellite.js';

import { tleFail } from './errors';
import { parseUtcInstant } from './time';
import { resolveTleSnapshotsFromValidatedManifest } from './resolver';
import { validateTleArchiveManifest } from './validation';
import {
  TLE_PROPAGATION_MODEL,
  TLE_SOURCE_KIND,
  type CreateTlePropagationFrameOptions,
  type PropagatedSatelliteState,
  type ResolvedTleSnapshot,
  type TleArchiveEntry,
  type TleArchiveManifest,
  type TlePropagationFrame,
  type TlePropagationFrameProvenance,
  type Vector3,
  type UtcInstantInput,
} from './types';

type ManifestInput = TleArchiveManifest | readonly TleArchiveEntry[];

/** Small playback window allowed around an accepted instant for trajectory points. */
export const TLE_TRAJECTORY_TOLERANCE_MS = 30 * 60 * 1_000;

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function finiteVector(value: unknown, label: string): Vector3 {
  if (value === null || typeof value !== 'object') {
    tleFail('PROPAGATION_FAILED', `${label} is missing from satellite.js output`);
  }
  const candidate = value as { x?: unknown; y?: unknown; z?: unknown };
  const x = candidate.x;
  const y = candidate.y;
  const z = candidate.z;
  if (![x, y, z].every((component) => typeof component === 'number' && Number.isFinite(component))) {
    tleFail('PROPAGATION_FAILED', `${label} contains a non-finite coordinate`);
  }
  return freeze({ x: x as number, y: y as number, z: z as number });
}

function frameHash(input: string): string {
  // FNV-1a is small, deterministic, and available in both Node and browsers.
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function snapshotKey(snapshot: ResolvedTleSnapshot): string {
  return [
    snapshot.satelliteId,
    snapshot.satelliteName,
    snapshot.epochUtc,
    snapshot.sourcePath,
    snapshot.line1,
    snapshot.line2,
  ].join('|');
}

/** Propagate one already-resolved archived snapshot at its accepted instant. */
export function propagateTleSnapshot(
  snapshot: ResolvedTleSnapshot,
  requestedInstantUtc: UtcInstantInput = snapshot.requestedInstantUtc,
): PropagatedSatelliteState {
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  const epochMs = Date.parse(snapshot.epochUtc);
  const acceptedInstantMs = Date.parse(snapshot.requestedInstantUtc);
  const ageMs = requested.ms - epochMs;
  const requestedDeltaMs = Math.abs(requested.ms - acceptedInstantMs);
  const withinDeclaredWindow = ageMs >= 0 && ageMs <= snapshot.maxPropagationAgeMs;
  const withinTrajectoryWindow = requestedDeltaMs <= TLE_TRAJECTORY_TOLERANCE_MS;
  if (!withinDeclaredWindow && !withinTrajectoryWindow) {
    tleFail('STALE_SNAPSHOT', `cannot propagate ${snapshot.satelliteId} at ${requested.value}: snapshot validity window is ${snapshot.maxPropagationAgeMs} ms`, {
      satelliteId: snapshot.satelliteId,
      requestedInstantUtc: requested.value,
      epochUtc: snapshot.epochUtc,
      acceptedInstantUtc: snapshot.requestedInstantUtc,
      ageMs,
      requestedDeltaMs,
      maxPropagationAgeMs: snapshot.maxPropagationAgeMs,
      trajectoryToleranceMs: TLE_TRAJECTORY_TOLERANCE_MS,
    });
  }
  let satrec: ReturnType<typeof twoline2satrec>;
  let propagated: ReturnType<typeof propagate>;
  try {
    satrec = twoline2satrec(snapshot.line1, snapshot.line2);
    propagated = propagate(satrec, new Date(requested.ms));
  } catch (error) {
    tleFail('PROPAGATION_FAILED', `SGP4 failed for ${snapshot.satelliteId} at ${requested.value}`, {
      satelliteId: snapshot.satelliteId,
      requestedInstantUtc: requested.value,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (propagated === null || propagated === undefined || satrec.error !== 0) {
    tleFail('PROPAGATION_FAILED', `SGP4 failed for ${snapshot.satelliteId} at ${requested.value}`, {
      satelliteId: snapshot.satelliteId,
      requestedInstantUtc: requested.value,
      satrecError: satrec.error,
    });
  }
  const positionTemeKm = finiteVector(propagated.position, 'SGP4 position');
  const velocityTemeKmPerSec = finiteVector(propagated.velocity, 'SGP4 velocity');
  const provenance = freeze({ ...snapshot.provenance });
  return deepFreeze({
    satelliteId: snapshot.satelliteId,
    satelliteName: snapshot.satelliteName,
    requestedInstantUtc: requested.value,
    tleEpochUtc: snapshot.epochUtc,
    sourcePath: snapshot.sourcePath,
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    positionTemeKm,
    velocityTemeKmPerSec,
    positionEciKm: positionTemeKm,
    velocityEciKmPerSec: velocityTemeKmPerSec,
    position: positionTemeKm,
    velocity: velocityTemeKmPerSec,
    provenance,
  });
}

function buildFrameProvenance(
  snapshots: readonly ResolvedTleSnapshot[],
  archiveId?: string,
): TlePropagationFrameProvenance {
  return freeze({
    ...(archiveId === undefined ? {} : { archiveId }),
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    snapshots: freeze(snapshots.map((snapshot) => freeze({ ...snapshot.provenance }))),
  });
}

/**
 * Resolve and propagate an immutable TLE-derived frame.  A caller can pass a
 * manifest object or an injected entry array; arrays must supply an explicit
 * max age in `options`, so stale-data policy never becomes an implicit
 * component default.
 */
export function createTlePropagationFrame(
  input: ManifestInput,
  requestedInstantUtc: UtcInstantInput,
  options: CreateTlePropagationFrameOptions = {},
): TlePropagationFrame {
  const manifest = Array.isArray(input)
    ? validateTleArchiveManifest(input, {
      maxPropagationAgeMs: options.maxPropagationAgeMs ?? options.maxAgeMs,
    })
    : validateTleArchiveManifest(input);
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  const snapshots = resolveTleSnapshotsFromValidatedManifest(
    manifest,
    requested.value,
    options.satelliteIds,
    options,
  );
  const satellites = freeze(snapshots.map((snapshot) => propagateTleSnapshot(snapshot, requested.value)));
  const resolvedEpochsUtc: Record<string, string> = {};
  for (const snapshot of snapshots) resolvedEpochsUtc[snapshot.satelliteId] = snapshot.epochUtc;
  const sortedSnapshots = [...snapshots].sort((left, right) => left.satelliteId.localeCompare(right.satelliteId));
  const identity = [
    requested.value,
    ...sortedSnapshots.map(snapshotKey),
  ].join('||');
  const provenance = buildFrameProvenance(sortedSnapshots, manifest.archiveId);
  const frame: TlePropagationFrame = {
    frameId: `tle-sgp4-${frameHash(identity)}`,
    requestedInstantUtc: requested.value,
    resolvedEpochsUtc: freeze(resolvedEpochsUtc),
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    satellites,
    provenance,
  };
  return deepFreeze(frame);
}

export const propagateArchivedTleFrame = createTlePropagationFrame;
export const buildTlePropagationFrame = createTlePropagationFrame;

export function createTleFrameId(
  requestedInstantUtc: UtcInstantInput,
  snapshots: readonly ResolvedTleSnapshot[],
): string {
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  return `tle-sgp4-${frameHash([requested.value, ...[...snapshots].sort((left, right) => left.satelliteId.localeCompare(right.satelliteId)).map(snapshotKey)].join('||'))}`;
}
