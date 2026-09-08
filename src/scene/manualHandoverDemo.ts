import type { SinrLiveCellFrame, SinrLiveCellHandoverEvent } from './sinrLiveCellModel';

/**
 * Compatibility export for the explicit top-bar demo. Timing and envelope
 * ownership live in `src/appearance/handoverTimingEnvelope.ts`; this module
 * owns only the demo event construction below.
 */
export { MANUAL_HANDOVER_DISPLAY_MS } from '../appearance/handoverTimingEnvelope';

export interface ManualHandoverDemoOptions {
  /** Snapshot captured when the teaching cue is armed; prevents target drift. */
  readonly sourceSatId?: string | null;
  readonly sourceCellId?: number | null;
  /**
   * Caller-chosen inter target. A lecture names its own winner spacecraft, so
   * without this the inter branch can only ever draw what the live model
   * happened to measure — which during a scripted run is usually nothing.
   */
  readonly targetSatId?: string | null;
  readonly targetCellId?: number | null;
  readonly servingSinrDb?: number | null;
  readonly candidateSinrDb?: number | null;
}

/**
 * Build the two endpoints for the explicit top-bar intra beam-switch cue from
 * the current cell snapshot. This is display-only: it never changes serving
 * state or the source-backed event index. Inter handovers are normally routed
 * through the source-backed seek path; the inter branch remains fail-closed
 * for any legacy caller that still reaches this resolver.
 */
export function resolveManualHandoverDemoEvent(
  kind: 'intra' | 'inter',
  cellFrame: SinrLiveCellFrame | undefined,
  primaryUeId: string | undefined,
  visibleSatelliteIds: readonly string[],
  options: ManualHandoverDemoOptions = {},
): SinrLiveCellHandoverEvent | null {
  if (!cellFrame) return null;
  const primary = primaryUeId === undefined
    ? cellFrame.ues[0]
    : cellFrame.ues.find(ue => ue.ueId === primaryUeId);
  // A teaching cue must describe the protagonist's actual link. Falling back to
  // another served cell makes the cones appear to target a different UE and was
  // the source of the intermittent "wrong UE" story.
  const sourceSatId = options.sourceSatId ?? primary?.servingSatId ?? null;
  const sourceCellId = options.sourceCellId ?? primary?.cellId ?? null;
  if (sourceSatId === null || sourceCellId === null) return null;
  if (!new Set(visibleSatelliteIds).has(sourceSatId)) return null;

  const servingSinrDb = options.servingSinrDb ?? primary?.sinrDb ?? null;
  const finiteServingSinrDb = Number.isFinite(servingSinrDb ?? NaN) ? servingSinrDb : null;

  if (kind === 'inter') {
    // Inter-satellite handover keeps the earth-fixed serving cell: only the
    // apex satellite changes. Prefer the caller's own snapshot, then the
    // model's real pending / best candidate, then an actually illuminated
    // same-cell satellite. Never fall back to an arbitrary visible satellite:
    // that would make the display claim a link nobody selected.
    const sameCellCandidate = cellFrame.illuminatedBeams.find(beam => (
      beam.cellId === sourceCellId
      && beam.satId !== sourceSatId
    ));
    const visibleSatelliteIdSet = new Set(visibleSatelliteIds);
    const targetSatId = [
      options.targetSatId,
      primary?.pendingTargetSatId,
      primary?.comparisonSatId,
      sameCellCandidate?.satId,
    ].find(satId => (
      satId !== undefined
      && satId !== null
      && satId !== sourceSatId
      && visibleSatelliteIdSet.has(satId)
    )) ?? null;
    if (targetSatId === null) return null;
    return {
      ueId: primaryUeId ?? primary?.ueId ?? 'ue-0',
      kind,
      sourceTimeSec: cellFrame.simTimeSec,
      fromSatId: sourceSatId,
      fromCellId: sourceCellId,
      toSatId: targetSatId,
      toCellId: sourceCellId,
      fromSinrDb: finiteServingSinrDb,
      toSinrDb: Number.isFinite(primary?.comparisonSinrDb ?? NaN) ? primary?.comparisonSinrDb ?? null : null,
      deltaDb: Number.isFinite(primary?.comparisonSinrDb ?? NaN) && finiteServingSinrDb !== null
        ? (primary?.comparisonSinrDb ?? 0) - finiteServingSinrDb
        : null,
    };
  }

  // Intra is a same-satellite beam switch. It is only drawable when the model
  // measured a real alternate beam at this UE; no illuminated/served-cell
  // fallback is allowed because that would fabricate the candidate SINR.
  const targetCellId = options.targetCellId ?? primary?.intraCandidateCellId ?? null;
  const candidateSinrDb = options.candidateSinrDb ?? primary?.intraCandidateSinrDb ?? null;
  const finiteCandidateSinrDb = Number.isFinite(candidateSinrDb ?? NaN) ? candidateSinrDb : null;
  if (
    targetCellId === null
    || targetCellId === sourceCellId
    || !Number.isInteger(targetCellId)
    || finiteCandidateSinrDb === null
    || finiteServingSinrDb === null
  ) return null;

  return {
    ueId: primaryUeId ?? primary?.ueId ?? 'ue-0',
    kind,
    sourceTimeSec: cellFrame.simTimeSec,
    fromSatId: sourceSatId,
    fromCellId: sourceCellId,
    toSatId: sourceSatId,
    toCellId: targetCellId,
    fromSinrDb: finiteServingSinrDb,
    toSinrDb: finiteCandidateSinrDb,
    deltaDb: finiteCandidateSinrDb - finiteServingSinrDb,
  };
}
