import { cellLinkBudgetBeamId } from './sinrLiveCellModel';
import { type AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import { resolveAcceptedBeamIdentityColor } from './acceptedBeamIdentityColor';

function resolveAcceptedCellIdentityColor(
  snapshot: AcceptedHandoverPresentationSnapshot | null | undefined,
  satelliteId: string | null | undefined,
  cellId: number | null | undefined,
  fallback: string,
): string {
  if (
    satelliteId === null
    || satelliteId === undefined
    || satelliteId.length === 0
    || cellId === null
    || cellId === undefined
    || !Number.isFinite(cellId)
  ) return fallback;
  return resolveAcceptedBeamIdentityColor(
    snapshot,
    satelliteId,
    cellLinkBudgetBeamId(Math.trunc(cellId)),
    fallback,
  );
}

export { resolveAcceptedCellIdentityColor };
