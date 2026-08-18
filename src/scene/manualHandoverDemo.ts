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
): SinrLiveCellHandoverEvent | null {
  if (!cellFrame) return null;
  const primary = primaryUeId === undefined
    ? cellFrame.ues[0]
    : cellFrame.ues.find(ue => ue.ueId === primaryUeId);
  // F2: the fallback used to fire only when the protagonist had NO cellId at all —
  // but a UE almost always sits in some cell, so the real failure mode (the UE's cell
  // is momentarily UNSERVED under K<N beam hopping) fell straight through to
  // `return null` and the button drew nothing. Resolve the protagonist's own cell
  // first, and fall back to ANY served cell only when that cell has no server, so the
  // demonstration is always drawable while still preferring the protagonist's cell.
  const primaryCell = primary?.cellId == null
    ? undefined
    : cellFrame.cells.find(cell => cell.cellId === primary.cellId);
  const servingCell = primaryCell?.servingSatId != null
    ? primaryCell
    : cellFrame.cells.find(cell => cell.servingSatId !== null);
  const sourceSatId = primary?.servingSatId ?? servingCell?.servingSatId ?? null;
  const sourceCellId = primary?.cellId ?? servingCell?.cellId ?? null;
  if (sourceSatId === null || sourceCellId === null) return null;

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
    };
  }

  // A display-only intra switch must remain a same-satellite beam switch. Prefer
  // a beam that this satellite is illuminating in the current frame, then fall
  // back to a cell currently served by the same satellite. Do not invent a
  // beam on another satellite merely to keep the cue drawable.
  const illuminatedSameSatelliteBeam = cellFrame.illuminatedBeams.find(beam => (
    beam.satId === sourceSatId
    && beam.cellId !== sourceCellId
  ));
  const targetCell = illuminatedSameSatelliteBeam === undefined
    ? cellFrame.cells.find(cell => (
      cell.cellId !== sourceCellId
      && cell.servingSatId === sourceSatId
    ))
    : cellFrame.cells.find(cell => cell.cellId === illuminatedSameSatelliteBeam.cellId);
  if (!targetCell) return null;
  const targetSatId = sourceSatId;
  if (targetSatId === null) return null;

  return {
    ueId: primaryUeId ?? primary?.ueId ?? 'ue-0',
    kind,
    sourceTimeSec: cellFrame.simTimeSec,
    fromSatId: sourceSatId,
    fromCellId: sourceCellId,
    toSatId: targetSatId,
    toCellId: targetCell.cellId,
  };
}
