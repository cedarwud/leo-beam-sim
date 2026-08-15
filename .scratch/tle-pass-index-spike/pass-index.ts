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

export const PASS_INDEX_SCHEMA_VERSION = 'tle-pass-index-spike-v2' as const;

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

export function exactSampleOffsets(config: PassIndexConfig = DEFAULT_PASS_INDEX_CONFIG): readonly number[] {
  validateConfig(config);
  return offsets(0, config.durationS, config.exactStepS);
}

export function coarseSampleOffsets(config: PassIndexConfig = DEFAULT_PASS_INDEX_CONFIG): readonly number[] {
  validateConfig(config);
  return offsets(-config.endpointPaddingS, config.durationS + config.endpointPaddingS, config.coarseStepS);
}

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
  readonly startAnchorIndexInclusive: number;
  readonly endAnchorIndexExclusive: number;
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
  readonly kind: 'valid' | 'unknown';
  readonly reason?: string;
  readonly azimuthDeg?: number;
  readonly elevationDeg?: number;
  readonly rangeKm?: number;
}

export interface SpikePassEvent {
  readonly eventKey: string;
  readonly satelliteId: string;
  readonly aosAnchorIndex: number;
  readonly peakAnchorIndex: number;
  readonly losAnchorIndex: number;
  readonly aosTimeSec: number;
  readonly peakTimeSec: number;
  readonly losTimeSec: number;
  readonly maxElevationDeg: number;
}

export interface PassEventScanResult {
  readonly events: readonly SpikePassEvent[];
  readonly failedSatelliteIds: ReadonlySet<string>;
  readonly propagationAttempts: number;
  readonly elapsedMs: number;
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
  if (config.chunkDurationS % config.coarseStepS !== 0) {
    throw new TypeError('coarseStepS must divide chunkDurationS exactly');
  }
  if (!Number.isFinite(config.endpointPaddingS) || config.endpointPaddingS < 0) {
    throw new TypeError('endpointPaddingS must be finite and non-negative');
  }
  if (config.endpointPaddingS < config.coarseStepS) {
    throw new TypeError('endpointPaddingS must cover at least one coarse sample interval');
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
  const spanS = endS - startS;
  if (!Number.isFinite(spanS) || spanS < 0) throw new TypeError('offset range must be finite and ordered');
  const count = Math.floor(spanS / stepS);
  const values = Array.from({ length: count + 1 }, (_unused, index) => startS + index * stepS);
  const last = values[values.length - 1]!;
  const epsilon = Math.max(1e-9, Math.abs(endS) * 1e-12);
  if (Math.abs(last - endS) <= epsilon) values[values.length - 1] = endS;
  else values.push(endS);
  return Object.freeze(values);
}

function elevationAt(record: PreparedRecord, instantMs: number): ElevationSample {
  if (record.satrec === null) return { kind: 'unknown', reason: 'invalid TLE record' };
  try {
    const propagated = propagate(record.satrec, new Date(instantMs));
    if (propagated === null || propagated === undefined || record.satrec.error !== 0) {
      return { kind: 'unknown', reason: 'SGP4 propagation failed' };
    }
    const position = propagated.position;
    if (position === null || typeof position !== 'object') return { kind: 'unknown', reason: 'SGP4 returned no position' };
    const x = position.x;
    const y = position.y;
    const z = position.z;
    if (![x, y, z].every(value => typeof value === 'number' && Number.isFinite(value))) {
      return { kind: 'unknown', reason: 'SGP4 returned a non-finite position' };
    }
    const gmst = gstime(new Date(instantMs));
    const satelliteEcf = eciToEcf(
      { x: x as number, y: y as number, z: z as number } as EciVec3<number>,
      gmst,
    );
    const look = ecfToLookAngles(NTPU_OBSERVER, satelliteEcf);
    const azimuthDeg = ((radiansToDegrees(look.azimuth) % 360) + 360) % 360;
    const elevationDeg = radiansToDegrees(look.elevation);
    const rangeKm = look.rangeSat;
    return [azimuthDeg, elevationDeg, rangeKm].every(Number.isFinite) && rangeKm > 0
      ? { kind: 'valid', azimuthDeg, elevationDeg, rangeKm }
      : { kind: 'unknown', reason: 'observer look-angle result was invalid' };
  } catch (error) {
    return {
      kind: 'unknown',
      reason: error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'observer look-angle calculation failed',
    };
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
      if (sample.kind === 'unknown') {
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
  const records = [...prepare(entries)].sort((left, right) => left.entry.satelliteId.localeCompare(right.entry.satelliteId));
  const recordsById = new Map(records.map(record => [record.entry.satelliteId, record]));
  const coarseOffsets = offsets(
    -config.endpointPaddingS,
    config.durationS + config.endpointPaddingS,
    config.coarseStepS,
  );
  const exactOffsets = offsets(0, config.durationS, config.exactStepS);
  const chunkCount = config.durationS / config.chunkDurationS;
  const mutableChunks = Array.from({ length: chunkCount }, (_unused, chunkIndex) => {
    const startS = chunkIndex * config.chunkDurationS;
    const endS = (chunkIndex + 1) * config.chunkDurationS;
    const startAnchorIndexInclusive = exactOffsets.findIndex(offsetS => offsetS >= startS);
    const endAnchorIndexExclusive = chunkIndex === chunkCount - 1
      ? exactOffsets.length
      : exactOffsets.findIndex(offsetS => offsetS >= endS);
    if (startAnchorIndexInclusive < 0 || endAnchorIndexExclusive < 0) {
      throw new TypeError('exact sample offsets cannot represent chunk boundaries');
    }
    return {
      chunkIndex,
      startS,
      endS,
      startAnchorIndexInclusive,
      endAnchorIndexExclusive,
      candidateSatelliteIds: new Set<string>(),
    };
  });
  const union = new Set<string>();
  const failedSatelliteIds = new Set<string>();
  let admittedByGuard = 0;
  let admittedFailClosed = 0;
  let propagationAttempts = 0;
  const startedAt = performance.now();
  for (const record of records) {
    const failed = record.satrec === null;
    const samples: Array<{ readonly offsetS: number; readonly elevationDeg: number }> = [];
    let unknownReason = failed ? 'invalid TLE record' : '';
    if (!failed) {
      for (const offsetS of coarseOffsets) {
        propagationAttempts += 1;
        const sample = elevationAt(record, t0Ms + offsetS * 1_000);
        if (sample.kind === 'unknown') {
          unknownReason = sample.reason ?? 'coarse propagation failed';
          break;
        }
        samples.push({ offsetS, elevationDeg: sample.elevationDeg as number });
      }
    }
    if (failed || unknownReason !== '') {
      failedSatelliteIds.add(record.entry.satelliteId);
      union.add(record.entry.satelliteId);
      admittedFailClosed += 1;
      for (const chunk of mutableChunks) chunk.candidateSatelliteIds.add(record.entry.satelliteId);
      continue;
    }
    let admittedSomewhere = false;
    for (const chunk of mutableChunks) {
      const admitted = samples.some(sample => (
        sample.offsetS >= chunk.startS - config.endpointPaddingS
        && sample.offsetS <= chunk.endS + config.endpointPaddingS
        && sample.elevationDeg >= config.coarseGuardElevationDeg
      ));
      if (!admitted) continue;
      chunk.candidateSatelliteIds.add(record.entry.satelliteId);
      admittedSomewhere = true;
    }
    if (admittedSomewhere) {
      union.add(record.entry.satelliteId);
      admittedByGuard += 1;
    }
  }
  const chunks = mutableChunks.map(chunk => Object.freeze({
    chunkIndex: chunk.chunkIndex,
    startS: chunk.startS,
    endS: chunk.endS,
    startAnchorIndexInclusive: chunk.startAnchorIndexInclusive,
    endAnchorIndexExclusive: chunk.endAnchorIndexExclusive,
    candidateSatelliteIds: new Set(chunk.candidateSatelliteIds) as ReadonlySet<string>,
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
      if (sample.kind === 'unknown') {
        failed = true;
        break;
      }
      if ((sample.elevationDeg as number) >= config.horizonElevationDeg) {
        visible = true;
        visibleSampleKeys.add(`${record.entry.satelliteId}@${anchorIndex}`);
      }
    }
    if (failed) {
      failedSatelliteIds.add(record.entry.satelliteId);
      visibleIds.delete(record.entry.satelliteId);
      for (const key of visibleSampleKeys) {
        if (key.startsWith(`${record.entry.satelliteId}@`)) visibleSampleKeys.delete(key);
      }
    }
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
      if (sample.kind === 'unknown') {
        failedSatelliteIds.add(satelliteId);
        visibleIds.delete(satelliteId);
        for (const key of visibleSampleKeys) {
          if (key.startsWith(`${satelliteId}@`)) visibleSampleKeys.delete(key);
        }
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

function interpolateCrossingTimeSec(
  leftElevationDeg: number,
  rightElevationDeg: number,
  leftTimeSec: number,
  rightTimeSec: number,
  thresholdDeg: number,
): number {
  const denominator = rightElevationDeg - leftElevationDeg;
  const fraction = denominator === 0
    ? 0.5
    : Math.max(0, Math.min(1, (thresholdDeg - leftElevationDeg) / denominator));
  return leftTimeSec + (rightTimeSec - leftTimeSec) * fraction;
}

function eventsForSatellite(
  satelliteId: string,
  samples: readonly (ElevationSample | null)[],
  sampleOffsetsS: readonly number[],
  thresholdDeg: number,
): readonly SpikePassEvent[] {
  const events: SpikePassEvent[] = [];
  let openStartIndex: number | null = null;
  let visibleIndices: number[] = [];
  for (let anchorIndex = 0; anchorIndex < samples.length; anchorIndex += 1) {
    const current = samples[anchorIndex];
    const currentVisible = current?.kind === 'valid' && (current.elevationDeg as number) >= thresholdDeg;
    if (currentVisible) {
      if (openStartIndex === null) {
        const previous = anchorIndex > 0 ? samples[anchorIndex - 1] : null;
        if (previous?.kind === 'valid' && (previous.elevationDeg as number) < thresholdDeg) {
          openStartIndex = anchorIndex;
          visibleIndices = [];
        }
      }
      if (openStartIndex !== null) visibleIndices.push(anchorIndex);
      continue;
    }
    if (openStartIndex !== null && visibleIndices.length > 0 && current?.kind === 'valid') {
      const previousIndex = anchorIndex - 1;
      const previous = samples[previousIndex];
      const beforeStart = samples[openStartIndex - 1];
      const firstVisible = samples[openStartIndex];
      if (
        previous?.kind === 'valid'
        && (previous.elevationDeg as number) >= thresholdDeg
        && beforeStart?.kind === 'valid'
        && firstVisible?.kind === 'valid'
      ) {
        let peakAnchorIndex = visibleIndices[0]!;
        for (const index of visibleIndices.slice(1)) {
          if ((samples[index]!.elevationDeg as number) > (samples[peakAnchorIndex]!.elevationDeg as number)) {
            peakAnchorIndex = index;
          }
        }
        const aosTimeSec = interpolateCrossingTimeSec(
          beforeStart.elevationDeg as number,
          firstVisible.elevationDeg as number,
          sampleOffsetsS[openStartIndex - 1]!,
          sampleOffsetsS[openStartIndex]!,
          thresholdDeg,
        );
        const losTimeSec = interpolateCrossingTimeSec(
          previous.elevationDeg as number,
          current.elevationDeg as number,
          sampleOffsetsS[previousIndex]!,
          sampleOffsetsS[anchorIndex]!,
          thresholdDeg,
        );
        events.push(Object.freeze({
          eventKey: `${satelliteId}@${openStartIndex}:${anchorIndex}`,
          satelliteId,
          aosAnchorIndex: openStartIndex,
          peakAnchorIndex,
          losAnchorIndex: anchorIndex,
          aosTimeSec,
          peakTimeSec: sampleOffsetsS[peakAnchorIndex]!,
          losTimeSec,
          maxElevationDeg: samples[peakAnchorIndex]!.elevationDeg as number,
        }));
      }
    }
    openStartIndex = null;
    visibleIndices = [];
  }
  return events;
}

/**
 * Extract complete horizon-to-horizon events using dense or time-local exact
 * samples. Boundary-clipped events and missing-neighbour events are excluded,
 * matching the active pass contract.
 */
export function scanExactPassEvents(
  entries: readonly TleArchiveEntry[],
  t0Utc: string,
  chunkedIndex: ChunkedCandidateIndexResult | null,
  config: PassIndexConfig = DEFAULT_PASS_INDEX_CONFIG,
): PassEventScanResult {
  validateConfig(config);
  const t0Ms = Date.parse(t0Utc);
  if (!Number.isFinite(t0Ms)) throw new TypeError('t0Utc must be an ISO UTC instant');
  const sampleOffsets = offsets(0, config.durationS, config.exactStepS);
  const events: SpikePassEvent[] = [];
  const failedSatelliteIds = new Set<string>();
  let propagationAttempts = 0;
  const startedAt = performance.now();
  for (const record of prepare(entries)) {
    if (record.satrec === null) {
      failedSatelliteIds.add(record.entry.satelliteId);
      continue;
    }
    const samples: Array<ElevationSample | null> = [];
    let failed = false;
    for (let anchorIndex = 0; anchorIndex < sampleOffsets.length; anchorIndex += 1) {
      const offsetS = sampleOffsets[anchorIndex]!;
      const chunkIndex = chunkedIndex === null
        ? null
        : Math.min(Math.floor(offsetS / config.chunkDurationS), chunkedIndex.chunks.length - 1);
      const admitted = chunkIndex === null
        || chunkedIndex!.chunks[chunkIndex]!.candidateSatelliteIds.has(record.entry.satelliteId);
      if (!admitted) {
        samples.push(null);
        continue;
      }
      propagationAttempts += 1;
      const sample = elevationAt(record, t0Ms + offsetS * 1_000);
      if (sample.kind === 'unknown') {
        failed = true;
        samples.push(null);
      } else {
        samples.push(sample);
      }
    }
    if (failed) failedSatelliteIds.add(record.entry.satelliteId);
    if (!failed) {
      events.push(...eventsForSatellite(
        record.entry.satelliteId,
        samples,
        sampleOffsets,
        config.horizonElevationDeg,
      ));
    }
  }
  return Object.freeze({
    events: Object.freeze(events.sort((left, right) => (
      left.aosTimeSec - right.aosTimeSec
      || left.peakTimeSec - right.peakTimeSec
      || left.satelliteId.localeCompare(right.satelliteId)
    ))),
    failedSatelliteIds,
    propagationAttempts,
    elapsedMs: performance.now() - startedAt,
  });
}

export function sortedDifference(left: ReadonlySet<string>, right: ReadonlySet<string>): readonly string[] {
  return [...left].filter(value => !right.has(value)).sort();
}
