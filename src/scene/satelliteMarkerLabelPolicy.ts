/**
 * The teaching-story decision for which satellite markers receive labels.
 *
 * The marker layer only renders the set it receives; it does not infer story
 * membership from satellite roles or array position.
 */

/** Resolve the source/target satellite labels for the active teaching story. */
export function resolveTeachingLabelSatelliteIds(
  sourceSatelliteId: string | null,
  targetSatelliteId: string | null,
): ReadonlySet<string> | null {
  if (sourceSatelliteId === null) return null;
  return new Set([
    sourceSatelliteId,
    targetSatelliteId ?? sourceSatelliteId,
  ]);
}
