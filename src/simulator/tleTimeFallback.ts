import { parseUtcInstant } from '../tle/time';
import type { TleWebArchiveCatalog } from './types';

/**
 * A bounded fallback candidate derived from a catalog publication boundary.
 *
 * `maxEpochUtc` is the earliest instant at which every record in that atomic
 * snapshot is no longer from the future.  It is therefore a much stronger
 * candidate than an arbitrary wall-clock offset and avoids brute-force
 * propagation of thousands of satellites at every second around the request.
 */
export interface TleTimeFallbackCandidate {
  readonly instantUtc: string;
  readonly archiveDate: string;
  readonly offsetSeconds: number;
  readonly absoluteOffsetSeconds: number;
}

export interface TleTimeResolution {
  readonly requestedInstantUtc: string;
  readonly appliedInstantUtc: string;
  readonly usedFallback: boolean;
  readonly offsetSeconds: number;
  readonly attemptedInstantCount: number;
  readonly exactFailure: string | null;
}

/**
 * Each admitted fallback still builds and validates the complete 241-anchor
 * run. This is an execution budget, not a claim that every wall-clock instant
 * around the request was searched.
 */
export const DEFAULT_TLE_TIME_FALLBACK_LIMIT = 3;

/**
 * Return nearest catalog-boundary fallback instants in deterministic order.
 *
 * The exact requested instant is deliberately absent: the controller always
 * tries it first.  Ties prefer the earlier instant so a fallback never reads
 * as an unexplained jump into the future.  Duplicate publication boundaries
 * are collapsed before the caller applies the bounded attempt limit.
 */
export function nearestTleTimeFallbackCandidates(
  catalog: TleWebArchiveCatalog,
  requestedInstantUtc: string,
  limit = DEFAULT_TLE_TIME_FALLBACK_LIMIT,
): readonly TleTimeFallbackCandidate[] {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('TLE time fallback limit must be a non-negative integer');
  }
  const requested = parseUtcInstant(requestedInstantUtc, 'requested TLE fallback instant');
  const byInstant = new Map<string, TleTimeFallbackCandidate>();

  for (const snapshot of catalog.snapshots) {
    const candidate = parseUtcInstant(
      snapshot.maxEpochUtc,
      `${snapshot.archiveDate}.maxEpochUtc fallback candidate`,
    );
    if (candidate.ms === requested.ms) continue;
    const offsetSeconds = (candidate.ms - requested.ms) / 1_000;
    const current = byInstant.get(candidate.value);
    if (current === undefined || snapshot.archiveDate > current.archiveDate) {
      byInstant.set(candidate.value, Object.freeze({
        instantUtc: candidate.value,
        archiveDate: snapshot.archiveDate,
        offsetSeconds,
        absoluteOffsetSeconds: Math.abs(offsetSeconds),
      }));
    }
  }

  return Object.freeze([...byInstant.values()]
    .sort((left, right) => (
      left.absoluteOffsetSeconds - right.absoluteOffsetSeconds
      || left.offsetSeconds - right.offsetSeconds
      || right.archiveDate.localeCompare(left.archiveDate)
    ))
    .slice(0, limit));
}
