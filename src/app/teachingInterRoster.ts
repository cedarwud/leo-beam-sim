export interface TeachingInterRosterMetric {
  readonly satelliteId: string;
  readonly energyEfficiencyBitsPerJoule: number | null;
}

export interface TeachingInterRosterInput {
  readonly servingSatelliteId: string | null;
  readonly candidateSatelliteIds: readonly string[];
  readonly beamMetrics: readonly TeachingInterRosterMetric[];
}

/** Rank replacement spacecraft by their strongest measured beam efficiency. */
export function resolveTeachingInterRosterSatelliteIds(
  input: TeachingInterRosterInput,
): readonly string[] {
  const satelliteIds = [...new Set(input.candidateSatelliteIds.filter(satelliteId => (
    input.servingSatelliteId === null || satelliteId !== input.servingSatelliteId
  )))];
  const bestEeBySatellite = new Map<string, number>();

  for (const metric of input.beamMetrics) {
    if (metric.satelliteId === input.servingSatelliteId) continue;
    const ee = metric.energyEfficiencyBitsPerJoule ?? Number.NEGATIVE_INFINITY;
    const current = bestEeBySatellite.get(metric.satelliteId);
    if (current === undefined || ee > current) bestEeBySatellite.set(metric.satelliteId, ee);
    if (!satelliteIds.includes(metric.satelliteId)) satelliteIds.push(metric.satelliteId);
  }

  const ee = (satelliteId: string): number =>
    bestEeBySatellite.get(satelliteId) ?? Number.NEGATIVE_INFINITY;
  return Object.freeze([...satelliteIds].sort((left, right) => ee(right) - ee(left)));
}
