import { decodeCellLinkBudgetBeamId } from '../../scene/sinrLiveCellModel';

/**
 * Homepage display labels for the SINR-live link-budget identity.
 *
 * The numeric beam id remains an internal join key. In particular, the
 * deterministic same-cell physical beams are encoded in a reserved internal
 * range (421..2521 for geographic cell 0). Exposing those raw numbers made it
 * look like the model had hundreds of ordinary beams. Keep the raw id in data
 * attributes, but explain the public identity as B1..B7. The geographic cell
 * remains an internal join identity and is not repeated beside every beam.
 */
export function formatHomepageBeamLabel(beamId: number): string {
  if (!Number.isFinite(beamId)) return 'B—';
  const decoded = decodeCellLinkBudgetBeamId(beamId);
  return `B${decoded.cellId + decoded.variantIndex + 1}`;
}

export function formatHomepageCellLabel(beamId: number): string {
  if (!Number.isFinite(beamId)) return 'C—';
  return 'C' + (decodeCellLinkBudgetBeamId(beamId).cellId + 1);
}

export function formatHomepageBeamCellLabel(beamId: number): string {
  return formatHomepageBeamLabel(beamId);
}
