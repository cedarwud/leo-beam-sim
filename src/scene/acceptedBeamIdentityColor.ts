import { type AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';

function resolveAcceptedBeamIdentityColor(
  snapshot: AcceptedHandoverPresentationSnapshot | null | undefined,
  satelliteId: string,
  beamId: number,
  fallback: string,
): string {
  if (!Number.isFinite(beamId)) return fallback;
  return snapshot?.plan.identityAllocation.beamAssignmentsBySatelliteId[satelliteId]?.[String(Math.trunc(beamId))]?.cssColor
    ?? fallback;
}

export { resolveAcceptedBeamIdentityColor };
