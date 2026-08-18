import type {
  PassAnchor,
  PassAnchorInput,
  PassAnchorTime,
  PassEvent,
  PassExtractionOptions,
  PassGeometrySample,
  PassGeometrySource,
  PassGeometryReader,
} from './types';

export interface NormalizedPassSample {
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly rangeKm?: number;
  readonly orbitalPlaneKey?: string;
}

interface NormalizedAnchor {
  readonly originalIndex: number;
  readonly time: PassAnchorTime;
  readonly timeSec: number;
  readonly utcMs?: number;
  readonly anchor?: PassAnchor;
}

export interface NormalizedPassGeometrySource {
  readonly anchorTimes: readonly PassAnchorTime[];
  readonly anchorTimesSec: readonly number[];
  readonly anchorUtcMs: readonly (number | undefined)[];
  readonly satelliteIds: readonly string[];
  /** Read one satellite's samples and release them before reading the next. */
  readonly readSamplesForSatellite: (satelliteId: string) => readonly (NormalizedPassSample | null)[];
}

const DEFAULT_HORIZON_ELEVATION_DEG = 0;
export const PASS_DIVERSITY_POLICY_REVISION = 'tle-pass-diversity-v1' as const;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function circularAzimuthDistance(left: number, right: number): number {
  return Math.abs(((left - right + 540) % 360) - 180);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function firstFinite(object: PassGeometrySample | undefined, keys: readonly string[]): number | undefined {
  if (object === undefined) return undefined;
  for (const key of keys) {
    const candidate = finiteNumber((object as Record<string, unknown>)[key]);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
}

function normalizeSample(value: unknown): NormalizedPassSample | null {
  if (value === null || typeof value !== 'object') return null;
  const object = value as PassGeometrySample;
  const azimuthDeg = firstFinite(object, ['azimuthDeg', 'azimuth']);
  const elevationDeg = firstFinite(object, ['elevationDeg', 'elevation']);
  if (azimuthDeg === undefined || elevationDeg === undefined) return null;
  const range = firstFinite(object, ['rangeKm', 'range']);
  const orbitalPlaneValue = [object.orbitalPlaneKey, object.orbitalPlane, object.planeKey]
    .find(candidate => typeof candidate === 'string' && candidate.trim().length > 0);
  return {
    azimuthDeg,
    elevationDeg,
    ...(range === undefined || range < 0 ? {} : { rangeKm: range }),
    ...(orbitalPlaneValue === undefined ? {} : { orbitalPlaneKey: orbitalPlaneValue }),
  };
}

function parseTime(value: PassAnchorTime): { readonly seconds: number; readonly utcMs?: number } {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('pass anchor time must be finite');
    return { seconds: value };
  }
  const date = value instanceof Date ? value : new Date(value);
  const utcMs = date.getTime();
  if (!Number.isFinite(utcMs)) throw new TypeError('pass anchor time must be a valid Date or ISO instant');
  return { seconds: utcMs / 1000, utcMs };
}

function anchorTimeFromObject(anchor: PassAnchor): PassAnchorTime | undefined {
  if (anchor.time !== undefined) return anchor.time;
  if (anchor.anchorTime !== undefined) return anchor.anchorTime;
  if (anchor.timestamp !== undefined) return anchor.timestamp;
  if (anchor.timeSec !== undefined) return anchor.timeSec;
  return undefined;
}

function asAnchor(value: PassAnchorInput, fallbackTime?: PassAnchorTime): {
  readonly time: PassAnchorTime;
  readonly anchor?: PassAnchor;
} {
  if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
    const anchor = value as PassAnchor;
    const time = anchorTimeFromObject(anchor) ?? fallbackTime;
    if (time === undefined) throw new TypeError('every pass anchor must provide a time');
    return { time, anchor };
  }
  if (value === undefined || value === null) {
    if (fallbackTime === undefined) throw new TypeError('every pass anchor must provide a time');
    return { time: fallbackTime };
  }
  return { time: value };
}

function sourceAnchors(source: PassGeometrySource): Array<{
  readonly originalIndex: number;
  readonly time: PassAnchorTime;
  readonly anchor?: PassAnchor;
}> {
  const explicitTimes = source.anchorTimes ?? source.times;
  const anchors = source.anchors;
  if (explicitTimes !== undefined) {
    return explicitTimes.map((time, index) => {
      const supplied = anchors?.[index];
      if (supplied === undefined) return { originalIndex: index, time };
      const parsed = asAnchor(supplied, time);
      return { originalIndex: index, ...parsed };
    });
  }
  if (anchors !== undefined) {
    return anchors.map((anchor, index) => ({ originalIndex: index, ...asAnchor(anchor) }));
  }
  throw new TypeError('pass geometry source must provide anchorTimes, times, or anchors');
}

function indexedTable(source: PassGeometrySource): Readonly<Record<string, readonly (PassGeometrySample | null | undefined)[]>> | undefined {
  return source.samples ?? source.geometry ?? source.geometryBySatellite ?? source.perSatellite;
}

function sampleFromAnchor(anchor: PassAnchor | undefined, satelliteId: string): unknown {
  if (anchor === undefined) return undefined;
  const collections = [anchor.geometry, anchor.samples, anchor.geometries, anchor.satellites];
  for (const collection of collections) {
    if (collection === undefined) continue;
    if (Array.isArray(collection)) {
      const match = collection.find(sample => {
        if (sample === null || typeof sample !== 'object') return false;
        const value = sample as PassGeometrySample;
        return value.satelliteId === satelliteId || value.id === satelliteId;
      });
      if (match !== undefined) return match;
    } else {
      const match = (collection as Record<string, unknown>)[satelliteId];
      if (match !== undefined) return match;
    }
  }
  return undefined;
}

function collectSatelliteIds(
  source: PassGeometrySource,
  rows: readonly { readonly anchor?: PassAnchor }[],
): string[] {
  const ids = new Set<string>();
  for (const id of source.satelliteIds ?? []) {
    if (typeof id === 'string' && id.length > 0) ids.add(id);
  }
  const table = indexedTable(source);
  for (const id of Object.keys(table ?? {})) ids.add(id);
  for (const row of rows) {
    const collections = [row.anchor?.geometry, row.anchor?.samples, row.anchor?.geometries, row.anchor?.satellites];
    for (const collection of collections) {
      if (collection === undefined) continue;
      if (Array.isArray(collection)) {
        for (const sample of collection) {
          if (sample === null || typeof sample !== 'object') continue;
          const value = sample as PassGeometrySample;
          const id = value.satelliteId ?? value.id;
          if (typeof id === 'string' && id.length > 0) ids.add(id);
        }
      } else {
        Object.keys(collection).forEach(id => ids.add(id));
      }
    }
  }
  return [...ids].sort(compareStrings);
}

function callbackFor(source: PassGeometrySource): PassGeometryReader | undefined {
  return source.sample ?? source.getSample ?? source.getGeometry ?? source.getLookAngle;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

/**
 * Normalize all supported source forms to one shared, sorted anchor axis.
 * Numeric anchors are interpreted as seconds.  Date/string anchors are
 * represented relative to the first anchor in `anchorTimesSec` and retain a
 * UTC representation for pass-event labels.
 */
export function normalizePassGeometrySource(source: PassGeometrySource): NormalizedPassGeometrySource {
  if (source === null || typeof source !== 'object') throw new TypeError('pass geometry source must be an object');
  const rawRows = sourceAnchors(source);
  if (rawRows.length === 0) {
    return deepFreeze({
      anchorTimes: [],
      anchorTimesSec: [],
      anchorUtcMs: [],
      satelliteIds: [],
      readSamplesForSatellite: () => [],
    });
  }
  const parsedRows = rawRows.map(row => {
    const parsed = parseTime(row.time);
    return {
      ...row,
      absoluteSec: parsed.seconds,
      utcMs: parsed.utcMs,
    };
  });
  const allNumeric = parsedRows.every(row => typeof row.time === 'number');
  const originSec = allNumeric ? 0 : parsedRows[0].absoluteSec;
  const rows: NormalizedAnchor[] = parsedRows
    .map(row => ({
      originalIndex: row.originalIndex,
      time: row.time,
      timeSec: row.absoluteSec - originSec,
      ...(row.utcMs === undefined ? {} : { utcMs: row.utcMs }),
      ...(row.anchor === undefined ? {} : { anchor: row.anchor }),
    }))
    .sort((left, right) => left.timeSec - right.timeSec || left.originalIndex - right.originalIndex);
  for (let index = 1; index < rows.length; index += 1) {
    if (!(rows[index].timeSec > rows[index - 1].timeSec)) {
      throw new TypeError('pass anchor times must be strictly increasing');
    }
  }
  const satelliteIds = collectSatelliteIds(source, rows);
  const table = indexedTable(source);
  const read = callbackFor(source);
  const readSamplesForSatellite = (satelliteId: string): readonly (NormalizedPassSample | null)[] => rows.map(row => {
    const callbackValue = read?.(satelliteId, row.time, row.originalIndex);
    const indexedValue = table?.[satelliteId]?.[row.originalIndex];
    const anchorValue = sampleFromAnchor(row.anchor, satelliteId);
    return normalizeSample(callbackValue ?? indexedValue ?? anchorValue);
  });
  const anchorTimes = rows.map(row => row.time);
  const anchorTimesSec = rows.map(row => row.timeSec);
  const anchorUtcMs = rows.map(row => row.utcMs);
  return deepFreeze({ anchorTimes, anchorTimesSec, anchorUtcMs, satelliteIds, readSamplesForSatellite });
}

function interpolateNumber(left: number | undefined, right: number | undefined, fraction: number): number | undefined {
  if (left === undefined || right === undefined) return left ?? right;
  return left + (right - left) * fraction;
}

function interpolateAzimuth(left: number, right: number, fraction: number): number {
  const delta = ((right - left + 540) % 360) - 180;
  return (left + delta * fraction + 360) % 360;
}

function boundarySample(left: NormalizedPassSample, right: NormalizedPassSample, threshold: number): NormalizedPassSample {
  const denominator = right.elevationDeg - left.elevationDeg;
  const rawFraction = denominator === 0 ? 0.5 : (threshold - left.elevationDeg) / denominator;
  const fraction = Math.max(0, Math.min(1, rawFraction));
  return {
    azimuthDeg: interpolateAzimuth(left.azimuthDeg, right.azimuthDeg, fraction),
    elevationDeg: threshold,
    ...(interpolateNumber(left.rangeKm, right.rangeKm, fraction) === undefined
      ? {}
      : { rangeKm: interpolateNumber(left.rangeKm, right.rangeKm, fraction) }),
    ...(left.orbitalPlaneKey ?? right.orbitalPlaneKey) === undefined
      ? {}
      : { orbitalPlaneKey: left.orbitalPlaneKey ?? right.orbitalPlaneKey },
  };
}

function fixed(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : 'nan';
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function utcLabel(ms: number | undefined): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString();
}

function createPassEvent(
  satelliteId: string,
  rows: readonly {
    readonly timeSec: number;
    readonly time: PassAnchorTime;
    readonly utcMs?: number;
    readonly sample: NormalizedPassSample | null;
  }[],
  visibleSamples: readonly { readonly index: number; readonly sample: NormalizedPassSample }[],
  startIndex: number,
  endIndex: number,
  threshold: number,
): PassEvent {
  const firstVisible = visibleSamples[0];
  const lastVisible = visibleSamples[visibleSamples.length - 1];
  const startBoundary = boundarySample(rows[startIndex - 1].sample as NormalizedPassSample, firstVisible.sample, threshold);
  const endBoundary = boundarySample(lastVisible.sample, rows[endIndex].sample as NormalizedPassSample, threshold);
  let peak = visibleSamples[0];
  for (const candidate of visibleSamples.slice(1)) {
    if (candidate.sample.elevationDeg > peak.sample.elevationDeg) peak = candidate;
  }
  const aos = rows[startIndex - 1].timeSec + (
    (rows[startIndex].timeSec - rows[startIndex - 1].timeSec)
    * ((threshold - (rows[startIndex - 1].sample as NormalizedPassSample).elevationDeg)
      / (firstVisible.sample.elevationDeg - (rows[startIndex - 1].sample as NormalizedPassSample).elevationDeg))
  );
  const los = rows[endIndex - 1].timeSec + (
    (rows[endIndex].timeSec - rows[endIndex - 1].timeSec)
    * ((threshold - lastVisible.sample.elevationDeg)
      / ((rows[endIndex].sample as NormalizedPassSample).elevationDeg - lastVisible.sample.elevationDeg))
  );
  const peakTimeSec = rows[peak.index].timeSec;
  const peakSample = peak.sample;
  const passId = `pass-${satelliteId}-${stableHash([
    satelliteId,
    fixed(aos),
    fixed(peakTimeSec),
    fixed(los),
    peak.index,
    fixed(peakSample.azimuthDeg),
    fixed(peakSample.elevationDeg),
  ].join('|'))}`;
  const startLeftUtcMs = rows[startIndex - 1].utcMs;
  const startRightUtcMs = rows[startIndex].utcMs;
  const startUtcMs = startLeftUtcMs === undefined || startRightUtcMs === undefined
    ? undefined
    : startLeftUtcMs + (startRightUtcMs - startLeftUtcMs) * (
      (aos - rows[startIndex - 1].timeSec) / (rows[startIndex].timeSec - rows[startIndex - 1].timeSec)
    );
  const endLeftUtcMs = rows[endIndex - 1].utcMs;
  const endRightUtcMs = rows[endIndex].utcMs;
  const endUtcMs = endLeftUtcMs === undefined || endRightUtcMs === undefined
    ? undefined
    : endLeftUtcMs + (endRightUtcMs - endLeftUtcMs) * (
      (los - rows[endIndex - 1].timeSec) / (rows[endIndex].timeSec - rows[endIndex - 1].timeSec)
    );
  const peakUtcMs = rows[peak.index].utcMs;
  const event: PassEvent = {
    passId,
    satelliteId,
    aos,
    peak: peakTimeSec,
    los,
    aosTimeSec: aos,
    peakTimeSec,
    losTimeSec: los,
    aosTime: aos,
    peakTime: peakTimeSec,
    losTime: los,
    maxElevationDeg: peakSample.elevationDeg,
    peakAzimuthDeg: peakSample.azimuthDeg,
    ...(peakSample.rangeKm === undefined ? {} : { peakRangeKm: peakSample.rangeKm }),
    entryAzimuthDeg: startBoundary.azimuthDeg,
    exitAzimuthDeg: endBoundary.azimuthDeg,
    ...(startBoundary.rangeKm === undefined ? {} : { entryRangeKm: startBoundary.rangeKm }),
    ...(endBoundary.rangeKm === undefined ? {} : { exitRangeKm: endBoundary.rangeKm }),
    durationSec: los - aos,
    ...(peakSample.orbitalPlaneKey === undefined ? {} : { orbitalPlaneKey: peakSample.orbitalPlaneKey }),
    aosAnchorIndex: startIndex,
    peakAnchorIndex: peak.index,
    losAnchorIndex: endIndex,
    ...(utcLabel(startUtcMs) === undefined ? {} : { aosUtc: utcLabel(startUtcMs) }),
    ...(utcLabel(peakUtcMs) === undefined ? {} : { peakUtc: utcLabel(peakUtcMs) }),
    ...(utcLabel(endUtcMs) === undefined ? {} : { losUtc: utcLabel(endUtcMs) }),
    boundaryClippedStart: false,
    boundaryClippedEnd: false,
  };
  return Object.freeze(event);
}

/**
 * Extract only complete above-horizon events. Visibility already in progress
 * at the first anchor and visibility still in progress at the last anchor are
 * intentionally excluded because their AOS/LOS is not observed; returned
 * events carry explicit false boundary flags rather than invented times.
 */
export function extractPassEvents(
  source: PassGeometrySource,
  options: PassExtractionOptions = {},
): readonly PassEvent[] {
  const normalized = normalizePassGeometrySource(source);
  const threshold = options.horizonElevationDeg ?? options.minimumElevationDeg ?? DEFAULT_HORIZON_ELEVATION_DEG;
  if (!Number.isFinite(threshold)) throw new TypeError('horizon elevation must be finite');
  const rows = normalized.anchorTimesSec.map((timeSec, index) => ({
    timeSec,
    time: normalized.anchorTimes[index],
    utcMs: normalized.anchorUtcMs[index],
  }));
  const events: PassEvent[] = [];
  for (const satelliteId of normalized.satelliteIds) {
    // Keep only one satellite's normalized samples alive at a time. This is
    // essential for full-catalog runs where a 241-anchor callback source can
    // contain ten thousand satellites.
    const samples = normalized.readSamplesForSatellite(satelliteId);
    const stateRows = rows.map((row, index) => ({
      ...row,
      sample: samples[index] ?? null,
    }));
    let open: { readonly startIndex: number; readonly visible: Array<{ readonly index: number; readonly sample: NormalizedPassSample }> } | null = null;
    for (let index = 0; index < stateRows.length; index += 1) {
      const current = stateRows[index].sample;
      const visible = current !== null && current.elevationDeg >= threshold;
      if (visible) {
        if (open === null) {
          const previous = index > 0 ? stateRows[index - 1].sample : null;
          if (previous !== null && previous !== undefined && previous.elevationDeg < threshold) {
            open = { startIndex: index, visible: [] };
          } else {
            // The pass started before the run (or after a missing sample); retain
            // no event until a fresh below-horizon crossing is observed.
            open = null;
          }
        }
        if (open !== null) open.visible.push({ index, sample: current as NormalizedPassSample });
        continue;
      }
      if (open !== null) {
        const previous = index > 0 ? stateRows[index - 1].sample : null;
        if (current !== null && current !== undefined && previous !== null && previous !== undefined
          && previous.elevationDeg >= threshold && open.visible.length > 0) {
          events.push(createPassEvent(satelliteId, stateRows, open.visible, open.startIndex, index, threshold));
        }
      }
      open = null;
    }
    // An open segment at the final anchor is a pass that has not yet reached LOS.
  }
  return events.sort(comparePassEvents);
}

/** Short aliases for adapters that call complete events simply "passes". */
export const extractPasses = extractPassEvents;
export const extractCompletePassEvents = extractPassEvents;

export function comparePassEvents(left: PassEvent, right: PassEvent): number {
  const byAos = left.aos - right.aos;
  if (byAos !== 0) return byAos;
  const byPeak = left.peak - right.peak;
  if (byPeak !== 0) return byPeak;
  const bySatellite = compareStrings(left.satelliteId, right.satelliteId);
  if (bySatellite !== 0) return bySatellite;
  const byElevation = right.maxElevationDeg - left.maxElevationDeg;
  if (byElevation !== 0) return byElevation;
  return compareStrings(left.passId, right.passId);
}

export function sortPassEvents(events: readonly PassEvent[]): PassEvent[] {
  return [...events].sort(comparePassEvents);
}

export function angularSeparationDeg(
  leftAzimuthDeg: number,
  leftElevationDeg: number,
  rightAzimuthDeg: number,
  rightElevationDeg: number,
): number {
  const toRad = Math.PI / 180;
  const leftAz = leftAzimuthDeg * toRad;
  const rightAz = rightAzimuthDeg * toRad;
  const leftEl = leftElevationDeg * toRad;
  const rightEl = rightElevationDeg * toRad;
  const dot = Math.sin(leftEl) * Math.sin(rightEl)
    + Math.cos(leftEl) * Math.cos(rightEl) * Math.cos(leftAz - rightAz);
  return Math.acos(Math.max(-1, Math.min(1, dot))) / toRad;
}

function resolvePolicyValue(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < 0) throw new TypeError(`${label} must be finite and non-negative`);
  return resolved;
}

export function normalizePassPolicy(options: PassExtractionOptions & {
  readonly policyRevision?: string;
  readonly highElevationDeg?: number;
  readonly nearDuplicatePeakTimeSec?: number;
  readonly duplicatePeakTimeSec?: number;
  readonly peakTimeSeparationSec?: number;
  readonly simultaneousSkySeparationDeg?: number;
  readonly simultaneousSeparationDeg?: number;
  readonly aosLosSimilaritySec?: number;
  readonly overlapSimilaritySec?: number;
  readonly preferredPeakSeparationSec?: number;
  readonly minimumCandidateOverlapSec?: number;
  readonly candidateOverlapSec?: number;
  readonly minimumCandidateContinuationSec?: number;
  readonly candidateContinuationSec?: number;
} = {}): import('./types').PassDiversityPolicy {
  const horizon = options.horizonElevationDeg ?? options.minimumElevationDeg ?? 0;
  const high = options.highElevationDeg ?? 70;
  if (!Number.isFinite(horizon) || !Number.isFinite(high)) throw new TypeError('pass elevation policy values must be finite');
  return Object.freeze({
    revision: options.policyRevision ?? PASS_DIVERSITY_POLICY_REVISION,
    horizonElevationDeg: horizon,
    highElevationDeg: high,
    nearDuplicatePeakTimeSec: resolvePolicyValue(
      options.nearDuplicatePeakTimeSec ?? options.duplicatePeakTimeSec ?? options.peakTimeSeparationSec,
      90,
      'nearDuplicatePeakTimeSec',
    ),
    simultaneousSkySeparationDeg: resolvePolicyValue(
      options.simultaneousSkySeparationDeg ?? options.simultaneousSeparationDeg,
      10,
      'simultaneousSkySeparationDeg',
    ),
    aosLosSimilaritySec: resolvePolicyValue(
      options.aosLosSimilaritySec ?? options.overlapSimilaritySec,
      90,
      'aosLosSimilaritySec',
    ),
    preferredPeakSeparationSec: resolvePolicyValue(options.preferredPeakSeparationSec, 180, 'preferredPeakSeparationSec'),
    minimumCandidateOverlapSec: resolvePolicyValue(
      options.minimumCandidateOverlapSec ?? options.candidateOverlapSec,
      60,
      'minimumCandidateOverlapSec',
    ),
    minimumCandidateContinuationSec: resolvePolicyValue(
      options.minimumCandidateContinuationSec ?? options.candidateContinuationSec,
      120,
      'minimumCandidateContinuationSec',
    ),
  });
}

function intervalOverlap(left: PassEvent, right: PassEvent): number {
  return Math.max(0, Math.min(left.los, right.los) - Math.max(left.aos, right.aos));
}

export function areNearDuplicatePasses(
  left: PassEvent,
  right: PassEvent,
  policy: Pick<import('./types').PassDiversityPolicy, 'nearDuplicatePeakTimeSec' | 'simultaneousSkySeparationDeg' | 'aosLosSimilaritySec'>,
): boolean {
  if (left.passId === right.passId) return true;
  if (Math.abs(left.peak - right.peak) > policy.nearDuplicatePeakTimeSec) return false;
  const overlap = intervalOverlap(left, right);
  if (overlap <= 0) return false;
  const shorterDuration = Math.min(left.durationSec, right.durationSec);
  if (shorterDuration <= 0 || overlap / shorterDuration < 0.5) return false;
  if (Math.abs(left.aos - right.aos) > policy.aosLosSimilaritySec
    || Math.abs(left.los - right.los) > policy.aosLosSimilaritySec) return false;
  // Distinct approach directions or explicitly supplied orbital planes are
  // useful diversity evidence even when two paths momentarily share a sky
  // position, so do not collapse those real alternatives.
  if (left.orbitalPlaneKey !== undefined && right.orbitalPlaneKey !== undefined
    && left.orbitalPlaneKey !== right.orbitalPlaneKey) return false;
  if (circularAzimuthDistance(left.entryAzimuthDeg, right.entryAzimuthDeg) > policy.simultaneousSkySeparationDeg
    || circularAzimuthDistance(left.exitAzimuthDeg, right.exitAzimuthDeg) > policy.simultaneousSkySeparationDeg) return false;
  const separation = angularSeparationDeg(
    left.peakAzimuthDeg,
    left.maxElevationDeg,
    right.peakAzimuthDeg,
    right.maxElevationDeg,
  );
  return separation <= policy.simultaneousSkySeparationDeg;
}

function preferenceCompare(left: PassEvent, right: PassEvent, highElevationDeg: number): number {
  return Number(right.maxElevationDeg >= highElevationDeg) - Number(left.maxElevationDeg >= highElevationDeg)
    || right.maxElevationDeg - left.maxElevationDeg
    || Number(right.orbitalPlaneKey !== undefined) - Number(left.orbitalPlaneKey !== undefined)
    || left.peak - right.peak
    || compareStrings(left.satelliteId, right.satelliteId)
    || compareStrings(left.passId, right.passId);
}

/** Deduplicate only events that are simultaneously close in time, sky, and footprint. */
export function deduplicatePassEvents(
  events: readonly PassEvent[],
  options: PassExtractionOptions & {
    readonly highElevationDeg?: number;
    readonly nearDuplicatePeakTimeSec?: number;
    readonly duplicatePeakTimeSec?: number;
    readonly peakTimeSeparationSec?: number;
    readonly simultaneousSkySeparationDeg?: number;
    readonly simultaneousSeparationDeg?: number;
    readonly aosLosSimilaritySec?: number;
    readonly overlapSimilaritySec?: number;
  } = {},
): readonly PassEvent[] {
  const policy = normalizePassPolicy(options);
  const retained: PassEvent[] = [];
  for (const event of [...events].sort((left, right) => preferenceCompare(left, right, policy.highElevationDeg))) {
    const duplicateIndex = retained.findIndex(existing => areNearDuplicatePasses(event, existing, policy));
    if (duplicateIndex < 0) retained.push(event);
    else if (preferenceCompare(event, retained[duplicateIndex], policy.highElevationDeg) < 0) retained[duplicateIndex] = event;
  }
  return retained.sort(comparePassEvents);
}
