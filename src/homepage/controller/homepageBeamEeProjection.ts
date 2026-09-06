/**
 * The homepage EE-to-visual projection, as a value instead of a `useMemo` body.
 *
 * `beamMetrics.ts` normalizes EE ONCE per frame, relative to that frame's own
 * available spread, and publishes the result as `metric.eeNormalized`. Every
 * renderer downstream is meant to reuse that number, so the rail and the 3-D
 * beams cannot disagree about how strong the same beam is.
 *
 * They did disagree. `6b9474e` ("tmp") replaced `metric.eeNormalized` with a
 * re-derivation from `metric.energyEfficiencyBitsPerJoule` against a FIXED
 * 80,000-180,000 bits/J scale, in two `useMemo` bodies inside a 5,700-line
 * MainScene.tsx. The same substitution was made a third time inside
 * `beamMetrics.ts` itself and fixed in `353960e`; these two survived because
 * nothing executable looked at them. A fixed absolute scale flattens the
 * acceptance cue: at attach every demo beam sits near 170,000 bits/J, so all of
 * them normalize to ~0.9 and render as one colour -- exactly when "faint to
 * strong through the handover" is supposed to be readable.
 *
 * These functions exist so that wiring is testable. A pure function with a test
 * is a thing a weak model can edit safely; a `useMemo` closure in the middle of
 * MainScene is not.
 */

/** The only fields the projection reads. `HomepageBeamMetric` satisfies it. */
export interface HomepageBeamEeSource {
  readonly satelliteId: string;
  readonly beamId: number;
  /** Frame-relative normalization from `beamMetrics.ts`. The single authority. */
  readonly eeNormalized: number | null;
}

/** `satelliteId:beamId`, the key both scene layers already join on. */
export function homepageBeamEeKey(satelliteId: string, beamId: number): string {
  return `${satelliteId}:${beamId}`;
}

/**
 * Per-beam EE strength, keyed for the cone/footprint renderers.
 *
 * This is a pass-through by design: the value is `metric.eeNormalized` and
 * nothing else. If a future frame needs a different scale, change it in
 * `beamMetrics.ts` where the normalization lives, so the rail moves with it.
 */
export function homepageBeamEeNormalizedByKey(
  metrics: readonly HomepageBeamEeSource[],
): ReadonlyMap<string, number | null> {
  return new Map(
    metrics.map(metric => [
      homepageBeamEeKey(metric.satelliteId, metric.beamId),
      metric.eeNormalized,
    ] as const),
  );
}

/**
 * Per-satellite EE progress: the best beam that satellite currently has.
 *
 * A satellite present in the frame is always in the map, so a satellite whose
 * beams have no measurable EE reads as `null` (unknown) rather than vanishing
 * and being drawn as if it were never there.
 */
export function homepageSatelliteEeProgressById(
  metrics: readonly HomepageBeamEeSource[],
): ReadonlyMap<string, number | null> {
  const bySatellite = new Map<string, number | null>();
  for (const metric of metrics) {
    const value = metric.eeNormalized;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      if (!bySatellite.has(metric.satelliteId)) bySatellite.set(metric.satelliteId, null);
      continue;
    }
    const previous = bySatellite.get(metric.satelliteId);
    if (previous === undefined || previous === null || value > previous) {
      bySatellite.set(metric.satelliteId, Math.max(0, Math.min(1, value)));
    }
  }
  return bySatellite;
}
