import type { SimulatorConstellation } from '../simulator/types';

/**
 * Shared, checked-in reference instant for the homepage and the six-act course.
 *
 * The two constellations do not have a publication on the same archive date:
 * Starlink's newest valid snapshot is 2026-08-24, while OneWeb's is 2026-08-25.
 * Both are propagated to the same instant so visual comparisons remain
 * time-aligned without pretending the source publication dates are identical.
 */
export const LATEST_TLE_REFERENCE_INSTANT_UTC = '2026-08-25T12:00:00.000Z' as const;
export const LATEST_TLE_REFERENCE_TAIPEI_LOCAL = '2026-08-25T20:00' as const;
export const LATEST_TLE_REFERENCE_ARTIFACT_DATE = '20260825' as const;

export const LATEST_TLE_ARCHIVE_DATES: Readonly<Record<SimulatorConstellation, string>> = Object.freeze({
  starlink: '20260824',
  oneweb: '20260825',
});

export function latestTleSnapshotPath(constellation: SimulatorConstellation): string {
  const archiveDate = LATEST_TLE_ARCHIVE_DATES[constellation];
  return `/tle-archive/${constellation}/${constellation}_${archiveDate}.tle`;
}
