import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  radiansToDegrees,
  twoline2satrec,
  type EciVec3,
} from 'satellite.js';

import type { TleArchiveEntry } from '../../src/tle/types';

export const PASS_INDEX_SCHEMA_VERSION = 'tle-pass-index-spike-v1' as const;

export interface PassIndexConfig {
  readonly durationS: number;
  readonly exactStepS: number;
  readonly coarseStepS: number;
  readonly chunkDurationS: number;
  readonly endpointPaddingS: number;
  readonly horizonElevationDeg: number;
  readonly coarseGuardElevationDeg: number;
}

export const DEFAULT_PASS_INDEX_CONFIG: PassIndexConfig = Object.freeze({
  durationS: 7_200,
  exactStepS: 30,
  coarseStepS: 120,
  chunkDurationS: 600,
  endpointPaddingS: 120,
  horizonElevationDeg: 0,
  coarseGuardElevationDeg: -20,
});

export interface ScanResult {
  readonly satelliteIds: ReadonlySet<string>;
  /** `satelliteId@anchorIndex` identities prove per-anchor, not only union, parity. */
  readonly visibleSampleKeys: ReadonlySet<string>;
  readonly failedSatelliteIds: ReadonlySet<string>;
  readonly propagationAttempts: number;
  readonly elapsedMs: number;
}

export interface CandidateIndexResult extends ScanResult {
  readonly admittedByGuard: number;
  readonly admittedFailClosed: number;
}

export interface PassIndexChunk {
  readonly chunkIndex: number;
  readonly startS: number;
  readonly endS: number;
  readonly candidateSatelliteIds: ReadonlySet<string>;
}

export interface ChunkedCandidateIndexResult extends CandidateIndexResult {
  readonly chunks: readonly PassIndexChunk[];
  readonly candidateMemberships: number;
}

interface PreparedRecord {
  readonly entry: TleArchiveEntry;
  readonly satrec: ReturnType<typeof twoline2satrec> | null;
}

interface ElevationSample {
  readonly ok: boolean;
  readonly elevationDeg?: number;
}

const NTPU_OBSERVER = Object.freeze({
  latitude: degreesToRadians(24.9441667),
  longitude: degreesToRadians(121.3713889),
  height: 0.05,
});

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${label} must be finite and positive`);
  return value;
}

function validateConfig(config: PassIndexConfig): void {
  finitePositive(config.durationS, 'durationS');
  finitePositive(config.exactStepS, 'exactStepS');
  finitePositive(config.coarseStepS, 'coarseStepS');
  finitePositive(config.chunkDurationS, 'chunkDurationS');
  if (config.durationS % config.chunkDurationS !== 0) {
    throw new TypeError('chunkDurationS must divide durationS exactly');
  }
  if (!Number.isFinite(config.endpointPaddingS) || config.endpointPaddingS < 0) {
    throw new TypeError('endpointPaddingS must be finite and non-negative');
  }
  if (!Number.isFinite(config.horizonElevationDeg)) throw new TypeError('horizonElevationDeg must be finite');
  if (!Number.isFinite(config.coarseGuardElevationDeg)) throw new TypeError('coarseGuardElevationDeg must be finite');
  if (config.coarseGuardElevationDeg > config.horizonElevationDeg) {
    throw new TypeError('coarseGuardElevationDeg must not exceed horizonElevationDeg');
  }
}

function prepare(entries: readonly TleArchiveEntry[]): readonly PreparedRecord[] {
  return entries.map((entry) => {
    try {
      const satrec = twoline2satrec(entry.line1, entry.line2);
      return { entry, satrec: satrec.error === 0 ? satrec : null };
    } catch {
      return { entry, satrec: null };
    }
  });
}

function offsets(startS: number, endS: number, stepS: number): readonly number[] {
  const values: number[] = [];
  for (let offsetS = startS; offsetS <= endS; offsetS += stepS) values.push(offsetS);
  if (values.at(-1) !== endS) values.push(endS);
  return values;
}

function elevationAt(record: PreparedRecord, instantMs: number): ElevationSample {
  if (record.satrec === null) return { ok: false };
  try {
    const propagated = propagate(record.satrec, new Date(instantMs));
    if (propagated === null || propagated === undefined || record.satrec.error !== 0) return { ok: false };
    const position = propagated.position;
    if (position === null || typeof position !== 'object') return { ok: false };
    const x = position.x;
    const y = position.y;
    const z = position.z;
    if (![x, y, z].every(value => typeof value === 'number' && Number.isFinite(value))) return { ok: false };
    const gmst = gstime(new Date(instantMs));
    const satelliteEcf = eciToEcf(
      { x: x as number, y: y as number, z: z as number } as EciVec3<number>,
      gmst,
    );
    const look = ecfToLookAngles(NTPU_OBSERVER, satelliteEcf);
    const elevationDeg = radiansToDegrees(look.elevation);
    return Number.isFinite(elevationDeg) ? { ok: true, elevationDeg } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * Build a conservative candidate set. A coarse failure admits the satellite
 * to the exact stage instead of silently dropping it.
 */
export function buildCandidateIndex(
  entries: readonly TleArchiveEntry[],
  t0Utc: string,
  config: PassIndexConfig = DEFAULT_PASS_INDEX_CONFIG,
): CandidateIndexResult {
  validateConfig(config);
  const t0Ms = Date.parse(t0Utc);
  if (!Number.isFinite(t0Ms)) throw new TypeError('t0Utc must be an ISO UTC instant');
  const sampleOffsets = offsets(
    -config.endpointPaddingS,
    config.durationS + config.endpointPaddingS,
    config.coarseStepS,
  );
  const satelliteIds = new Set<string>();
  const failedSatelliteIds = new Set<string>();
  let admittedByGuard = 0;
  let admittedFailClosed = 0;
  let propagationAttempts = 0;
  const startedAt = performance.now();
  for (const record of prepare(entries)) {
    let admitted = false;
    let failed = record.satrec === null;
    for (const offsetS of sampleOffsets) {
      if (admitted || failed) break;
      propagationAttempts += 1;
      const sample = elevationAt(record, t0Ms + offsetS * 1_000);
      if (!sample.ok) {
        failed = true;
        break;
      }
      if ((sample.elevationDeg as number) >= config.coarseGuardElevationDeg) admitted = true;
    }
    if (failed) {
      failedSatelliteIds.add(record.entry.satelliteId);
      satelliteIds.add(record.entry.satelliteId);
      admittedFailClosed += 1;
    } else if (admitted) {
      satelliteIds.add(record.entry.satelliteId);
      admittedByGuard += 1;
    }
  }
  return Object.freeze({
    satelliteIds,
    visibleSampleKeys: new Set<string>(),
    failedSatelliteIds,
    admittedByGuard,
    admittedFailClosed,
    propagationAttempts,
    elapsedMs: performance.now() - startedAt,
  });
}

/**
 * Build time-local candidate lists from one coarse scan. The union may remain
 * large over a full orbit, while each chunk stays small enough for exact work.
 */
export function buildChunkedCandidateIndex(
  entries: readonly TleArchiveEntry[],
  t0Utc: string,
  config: PassIndexConfig = DEFAULT_PASS_INDEX_CONFIG,
): ChunkedCandidateIndexResult {
  validateConfig(config);
  const t0Ms = Date.parse(t0Utc);
  if (!Number.isFinite(t0Ms)) throw new TypeError('t0Utc must be an ISO UTC instant');
  const sampleOffsets = offsets(
    -config.endpointPaddingS,
    config.durationS + config.endpointPaddingS,
    config.coarseStepS,
  );
  const chunkCount = config.durationS / config.chunkDurationS;
  const mutableChunks = Array.from({ length: chunkCount }, (_unused, chunkIndex) => ({
    chunkIndex,
    startS: chunkIndex * config.chunkDurationS,
    endS: (chunkIndex + 1) * config.chunkDurationS,
    candidateSatelliteIds: new Set<string>(),
  }));
  const union = new Set<string>();
  const failedSatelliteIds = new Set<string>();
  let admittedByGuard = 0;
  let admittedFailClosed = 0;
  let propagationAttempts = 0;
  const startedAt = performance.now();
  for (const record of prepare(entries)) {
    const samples: Array<{ readonly offsetS: number; readonly elevationDeg: number }> = [];
    let failed = record.satrec === null;
    for (const offsetS of sampleOffsets) {
      if (failed) break;
      propagationAttempts += 1;
      const sample = elevationAt(record, t0Ms + offsetS * 1_000);
      if (!sample.ok) {
        failed = true;
        break;
      }
      samples.push({ offsetS, elevationDeg: sample.elevationDeg as number });
    }
    if (failed) {
      failedSatelliteIds.add(record.entry.satelliteId);
      union.add(record.entry.satelliteId);
      admittedFailClosed += 1;
      for (const chunk of mutableChunks) chunk.candidateSatelliteIds.add(record.entry.satelliteId);
      continue;
    }
    let admittedSomewhere = false;
    for (const chunk of mutableChunks) {
      const guarded = samples.some(sample => (
        sample.offsetS >= chunk.startS - config.endpointPaddingS
        && sample.offsetS <= chunk.endS + config.endpointPaddingS
        && sample.elevationDeg >= config.coarseGuardElevationDeg
      ));
      if (!guarded) continue;
      chunk.candidateSatelliteIds.add(record.entry.satelliteId);
      admittedSomewhere = true;
    }
    if (admittedSomewhere) {
      union.add(record.entry.satelliteId);
      admittedByGuard += 1;
    }
  }
  const chunks = mutableChunks.map(chunk => Object.freeze({
    ...chunk,
    candidateSatelliteIds: chunk.candidateSatelliteIds as ReadonlySet<string>,
  }));
  return Object.freeze({
    satelliteIds: union,
    visibleSampleKeys: new Set<string>(),
    failedSatelliteIds,
    admittedByGuard,
    admittedFailClosed,
    propagationAttempts,
    elapsedMs: performance.now() - startedAt,
    chunks,
    candidateMemberships: chunks.reduce((sum, chunk) => sum + chunk.candidateSatelliteIds.size, 0),
  });
}

/** Exact 30-second visibility scan for a supplied set of identities. */
export function scanExactVisibility(
  entries: readonly TleArchiveEntry[],
  t0Utc: string,
  satelliteIds: ReadonlySet<string> | null,
  config: PassIndexConfig = DEFAULT_PASS_INDEX_CONFIG,
): ScanResult {
  validateConfig(config);
  const t0Ms = Date.parse(t0Utc);
  if (!Number.isFinite(t0Ms)) throw new TypeError('t0Utc must be an ISO UTC instant');
  const sampleOffsets = offsets(0, config.durationS, config.exactStepS);
  const visibleIds = new Set<string>();
  const visibleSampleKeys = new Set<string>();
  const failedSatelliteIds = new Set<string>();
  let propagationAttempts = 0;
  const startedAt = performance.now();
  for (const record of prepare(entries)) {
    if (satelliteIds !== null && !satelliteIds.has(record.entry.satelliteId)) continue;
    if (record.satrec === null) {
      failedSatelliteIds.add(record.entry.satelliteId);
      continue;
    }
    let visible = false;
    let failed = false;
    for (let anchorIndex = 0; anchorIndex < sampleOffsets.length; anchorIndex += 1) {
      const offsetS = sampleOffsets[anchorIndex]!;
      propagationAttempts += 1;
      const sample = elevationAt(record, t0Ms + offsetS * 1_000);
      if (!sample.ok) {
        failed = true;
        break;
      }
      if ((sample.elevationDeg as number) >= config.horizonElevationDeg) {
        visible = true;
        visibleSampleKeys.add(`${record.entry.satelliteId}@${anchorIndex}`);
      }
    }
    if (failed) failedSatelliteIds.add(record.entry.satelliteId);
    else if (visible) visibleIds.add(record.entry.satelliteId);
  }
  return Object.freeze({
    satelliteIds: visibleIds,
    visibleSampleKeys,
    failedSatelliteIds,
    propagationAttempts,
    elapsedMs: performance.now() - startedAt,
  });
}

/** Run the exact anchor scan using the candidate list that owns each anchor. */
export function scanExactVisibilityByChunk(
  entries: readonly TleArchiveEntry[],
  t0Utc: string,
  index: ChunkedCandidateIndexResult,
  config: PassIndexConfig = DEFAULT_PASS_INDEX_CONFIG,
): ScanResult {
  validateConfig(config);
  const t0Ms = Date.parse(t0Utc);
  if (!Number.isFinite(t0Ms)) throw new TypeError('t0Utc must be an ISO UTC instant');
  const sampleOffsets = offsets(0, config.durationS, config.exactStepS);
  const recordsById = new Map(prepare(entries).map(record => [record.entry.satelliteId, record]));
  const visibleIds = new Set<string>();
  const visibleSampleKeys = new Set<string>();
  const failedSatelliteIds = new Set<string>();
  let propagationAttempts = 0;
  const startedAt = performance.now();
  for (let anchorIndex = 0; anchorIndex < sampleOffsets.length; anchorIndex += 1) {
    const offsetS = sampleOffsets[anchorIndex]!;
    const chunkIndex = Math.min(
      Math.floor(offsetS / config.chunkDurationS),
      index.chunks.length - 1,
    );
    const chunk = index.chunks[chunkIndex]!;
    for (const satelliteId of chunk.candidateSatelliteIds) {
      const record = recordsById.get(satelliteId);
      if (record === undefined || record.satrec === null) {
        failedSatelliteIds.add(satelliteId);
        continue;
      }
      propagationAttempts += 1;
      const sample = elevationAt(record, t0Ms + offsetS * 1_000);
      if (!sample.ok) {
        failedSatelliteIds.add(satelliteId);
        continue;
      }
      if ((sample.elevationDeg as number) >= config.horizonElevationDeg) {
        visibleIds.add(satelliteId);
        visibleSampleKeys.add(`${satelliteId}@${anchorIndex}`);
      }
    }
  }
  return Object.freeze({
    satelliteIds: visibleIds,
    visibleSampleKeys,
    failedSatelliteIds,
    propagationAttempts,
    elapsedMs: performance.now() - startedAt,
  });
}

export function sortedDifference(left: ReadonlySet<string>, right: ReadonlySet<string>): readonly string[] {
  return [...left].filter(value => !right.has(value)).sort();
}
