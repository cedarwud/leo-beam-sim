import type { SinrLiveCellFrame, SinrLiveCellHandoverEvent } from './sinrLiveCellModel';

/**
 * Wall-clock duration of the explicit top-bar handover demonstration.
 *
 * 2500 → 6000 → 8000 (2026-08-06). The cue is not a flash, it is a STORY
 * (`resolveHandoverConeEnvelope`, src/constants/sinrLiveConeStyle.ts): serve → candidate appears → both held
 * while the trigger timer runs → old link released → settled on the new link. At 2.5 s
 * each phase got ~600 ms, which is below the time it takes a student to move their eyes
 * from one cone to the other, so the whole thing read as "two beams blinked at once and
 * stopped" — the exact complaint.
 *
 * The last 2 s are the SETTLED tail (owner call: 結束時間再拉長2秒).
 *
 * This is the MANUAL window only. The envelope it walks is shared with the REAL handover
 * flash, which spends its own, shorter `SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS` on the
 * same shape — the envelope takes `progress01`, so shape and length are independent.
 *
 * NOTE: `src/App.tsx` imports this same const to schedule the button's reset timeout,
 * so the two ends can never disagree. The NAME and the export shape are load-bearing
 * for that import — change the value freely, never the identifier.
 */
export const MANUAL_HANDOVER_DISPLAY_MS = 8000;

export interface ManualHandoverDemoOptions {
  /** Snapshot captured when the teaching cue is armed; prevents target drift. */
  readonly sourceSatId?: string | null;
  readonly sourceCellId?: number | null;
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
    // apex satellite changes. Prefer the model's real pending / best candidate,
    // then an actually illuminated same-cell satellite. Never fall back to an
    // arbitrary visible satellite: that would make the display claim a link
    // the model never selected.
    const sameCellCandidate = cellFrame.illuminatedBeams.find(beam => (
      beam.cellId === sourceCellId
      && beam.satId !== sourceSatId
    ));
    const visibleSatelliteIdSet = new Set(visibleSatelliteIds);
    const targetSatId = [
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
