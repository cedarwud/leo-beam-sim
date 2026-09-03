import { decodeCellLinkBudgetBeamId } from '../../scene/sinrLiveCellModel';

/**
 * Homepage display labels for the SINR-live link-budget identity.
 *
 * The numeric beam id remains an internal join key. In particular, the
 * deterministic same-cell alternate is encoded as 421 for geographic cell 0;
 * exposing that raw number made it look like the model had hundreds of
 * ordinary beams. Keep the raw id in data attributes, but explain the public
 * identity as B1′ / C1.
 */
export function formatHomepageBeamLabel(beamId: number): string {
  if (!Number.isFinite(beamId)) return 'B—';
  const decoded = decodeCellLinkBudgetBeamId(beamId);
  const base = 'B' + (decoded.cellId + 1);
  return decoded.variantIndex === 0
    ? base
    : base + '′';
}

export function formatHomepageCellLabel(beamId: number): string {
  if (!Number.isFinite(beamId)) return 'C—';
  return 'C' + (decodeCellLinkBudgetBeamId(beamId).cellId + 1);
}

export function formatHomepageBeamCellLabel(beamId: number): string {
  return formatHomepageBeamLabel(beamId) + ' / ' + formatHomepageCellLabel(beamId);
}
