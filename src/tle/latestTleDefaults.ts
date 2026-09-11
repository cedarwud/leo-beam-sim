import type { SimulatorConstellation } from '../simulator/types';

/**
 * Shared, checked-in reference instant for the homepage and the six-act course.
 *
 * Both constellations' newest valid snapshot is 2026-09-08, so both are
 * propagated from the same archive date. When a future sync lands the two
 * constellations on different dates again, keep propagating both to the same
 * instant so visual comparisons remain time-aligned without pretending the
 * source publication dates are identical.
 *
 * The reference instant itself is one calendar day after the archive date:
 * Starlink's 2026-09-08 snapshot has records epoched as late as 21:53 UTC
 * that day, so a same-day noon-UTC instant would not be a "complete prior"
 * publication yet (`resolveTleSnapshotMetadata` in `src/simulator/archive.ts`
 * requires every admitted record's epoch to fall before the requested
 * instant). Propagating from noon Taipei the next day keeps the coverage
 * margin comfortable without reaching for a newer archive date.
 */
export const LATEST_TLE_REFERENCE_INSTANT_UTC = '2026-09-09T12:00:00.000Z' as const;
export const LATEST_TLE_REFERENCE_TAIPEI_LOCAL = '2026-09-09T20:00' as const;
export const LATEST_TLE_REFERENCE_ARTIFACT_DATE = '20260908' as const;

export const LATEST_TLE_ARCHIVE_DATES: Readonly<Record<SimulatorConstellation, string>> = Object.freeze({
  starlink: '20260908',
  oneweb: '20260908',
});

export function latestTleSnapshotPath(constellation: SimulatorConstellation): string {
  const archiveDate = LATEST_TLE_ARCHIVE_DATES[constellation];
  return `/tle-archive/${constellation}/${constellation}_${archiveDate}.tle`;
}
