import { type AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';

function resolveAcceptedSatelliteIdentityColor(
  snapshot: AcceptedHandoverPresentationSnapshot | null | undefined,
  satelliteId: string,
  fallback: string,
): string {
  return snapshot?.plan.identityAllocation.identitiesBySatelliteId[satelliteId]?.cssColor
    ?? fallback;
}

export { resolveAcceptedSatelliteIdentityColor };
