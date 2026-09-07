import type { SinrLiveCinemaHandoverCandidate } from '../viz/SinrLiveCellBeamCones';
import {
  resolveHomepageBeamVisibility,
  type HomepageBeamIdentity,
} from '../homepage/controller/homepageBeamVisibility';
import type { DisplayHeroRecord } from './beamDisplaySpec';
import type { HandoverAuthorityJoin } from './handoverAuthorityJoin';
import type { HandoverPresentationEvent } from './handoverPresentationOwner';
import {
  cellIdFromLinkBudgetBeamId,
  type SinrLiveCellHandoverEvent,
  type UeCellServingRecord,
} from './sinrLiveCellModel';
import { homepageBeamIdentityFromCell } from './homepageBeamIdentity';

export interface HomepageSceneBeamVisibilityInput {
  readonly displayHeroRecord: DisplayHeroRecord | null;
  readonly primaryServingRecord: UeCellServingRecord | null;
  readonly renderedCandidateSatelliteId: string | null | undefined;
  readonly presentedHandoverPairCandidate: SinrLiveCinemaHandoverCandidate | null;
  readonly handoverPresentationCandidate: HandoverPresentationEvent | null;
  readonly handoverAuthorityJoin: HandoverAuthorityJoin | null;
  readonly cinemaPairCandidate: SinrLiveCinemaHandoverCandidate | null;
  readonly recentPrimaryHandoverEvent: SinrLiveCellHandoverEvent | null;
}

function identityFromEventEndpoint(
  satelliteId: string | null | undefined,
  cellId: number | null | undefined,
  beamId: number | null | undefined,
): HomepageBeamIdentity | null {
  return homepageBeamIdentityFromCell(satelliteId, cellId, beamId);
}

/** Resolve the exact homepage beam identities owned by the current scene story. */
export function resolveHomepageSceneBeamVisibility(
  input: HomepageSceneBeamVisibilityInput,
): ReadonlySet<string> {
  const transition = input.handoverAuthorityJoin?.transition;
  return resolveHomepageBeamVisibility({
    servingBeam: homepageBeamIdentityFromCell(
      input.displayHeroRecord?.servingSatId ?? input.primaryServingRecord?.servingSatId,
      input.displayHeroRecord?.cellId ?? input.primaryServingRecord?.cellId,
      input.displayHeroRecord?.beamId ?? input.primaryServingRecord?.servingBeamId,
    ),
    preparedCandidateBeam: homepageBeamIdentityFromCell(
      input.renderedCandidateSatelliteId ?? input.primaryServingRecord?.pendingTargetSatId,
      input.displayHeroRecord?.cellId ?? input.primaryServingRecord?.cellId,
      input.handoverPresentationCandidate?.to.beamId
        ?? input.primaryServingRecord?.intraCandidateLinkSample?.beamId
        ?? null,
    ),
    presentationFromBeam: identityFromEventEndpoint(
      input.presentedHandoverPairCandidate?.fromSatId
        ?? input.handoverPresentationCandidate?.from.satId
        ?? transition?.from.satelliteId,
      input.presentedHandoverPairCandidate?.fromCellId
        ?? input.handoverPresentationCandidate?.from.cellId
        ?? (transition?.from.beamId === undefined
          ? null
          : cellIdFromLinkBudgetBeamId(transition.from.beamId)),
      input.presentedHandoverPairCandidate?.fromBeamId
        ?? input.handoverPresentationCandidate?.from.beamId
        ?? transition?.from.beamId
        ?? null,
    ),
    presentationToBeam: identityFromEventEndpoint(
      input.presentedHandoverPairCandidate?.toSatId
        ?? input.handoverPresentationCandidate?.to.satId
        ?? transition?.to.satelliteId,
      input.presentedHandoverPairCandidate?.toCellId
        ?? input.handoverPresentationCandidate?.to.cellId
        ?? (transition?.to.beamId === undefined
          ? null
          : cellIdFromLinkBudgetBeamId(transition.to.beamId)),
      input.presentedHandoverPairCandidate?.toBeamId
        ?? input.handoverPresentationCandidate?.to.beamId
        ?? transition?.to.beamId
        ?? null,
    ),
    cinemaFromBeam: homepageBeamIdentityFromCell(
      input.cinemaPairCandidate?.fromSatId,
      input.cinemaPairCandidate?.fromCellId,
      input.cinemaPairCandidate?.fromBeamId,
    ),
    cinemaToBeam: homepageBeamIdentityFromCell(
      input.cinemaPairCandidate?.toSatId,
      input.cinemaPairCandidate?.toCellId,
      input.cinemaPairCandidate?.toBeamId,
    ),
    recentFromBeam: homepageBeamIdentityFromCell(
      input.recentPrimaryHandoverEvent?.fromSatId,
      input.recentPrimaryHandoverEvent?.fromCellId,
      input.recentPrimaryHandoverEvent?.fromBeamId,
    ),
    recentToBeam: homepageBeamIdentityFromCell(
      input.recentPrimaryHandoverEvent?.toSatId,
      input.recentPrimaryHandoverEvent?.toCellId,
      input.recentPrimaryHandoverEvent?.toBeamId,
    ),
  });
}
