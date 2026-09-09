import { useMemo } from 'react';
import { type Profile } from '../profiles/types';
import { type RuntimeConfig } from './types';
import { resolveCinemaInterServingFanConeItems, resolveBudgetedSinrLiveBeamConeItems, type SinrLiveCellPlacement, type SinrLiveCellBeamConeRenderItem, type SinrLiveCinemaHandoverCandidate } from '../viz/SinrLiveCellBeamCones';
import { type BeamDisplaySpec } from './beamDisplaySpec';
import { type SinrLiveCellHandoverEvent, type CellServingRecord, type SinrLiveCandidateProbeEvidence, type SinrLiveCellFrame, type SinrLivePrimaryBeamMetricEvidence, type UeCellServingRecord } from './sinrLiveCellModel';
import { resolveSinrLiveConfiguredBeamCount } from './sinrLiveBeamDisplayFrame';
import { type AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import { resolveAcceptedBeamIdentityColor } from './acceptedBeamIdentityColor';
import { paintConeItems } from '../appearance/paintConeItems';
import { type HandoverConeEnvelope } from '../appearance/handoverTimingEnvelope';
import { type CandidateOpportunitySet } from '../engine/handover/candidateOpportunityProducer';
import { type AngleAwareFormulaFrame } from '../engine/signal/types';
import { type HandoverDisplayIsolationState } from './handoverDisplayIsolation';

export interface UseSinrLiveCinemaInterServingFanConeItemsParameters {
  acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  beamDisplaySpec: BeamDisplaySpec;
  cinemaInterDisplayCellFrame: SinrLiveCellFrame | { illuminatedBeams: { satId: string; cellId: number; frequencyIndex: number; serving: boolean; }[]; simTimeSec: number; sourceFrameId?: string; cells: readonly CellServingRecord[]; ues: readonly UeCellServingRecord[]; primaryUeId?: string | null; primaryCandidateOpportunities?: CandidateOpportunitySet | null; primaryCandidateProbeEvidence?: readonly SinrLiveCandidateProbeEvidence[] | null; primaryBeamMetricEvidence?: readonly SinrLivePrimaryBeamMetricEvidence[] | null; servedCellCount: number; servedUeCount: number; servingSatCount: number; intraHandoverCount: number; interHandoverCount: number; cumulativeIntraHandoverCount: number; cumulativeInterHandoverCount: number; angleAwareFormulaFrame?: AngleAwareFormulaFrame | null; recentHandoverEvents: readonly SinrLiveCellHandoverEvent[]; } | undefined;
  handoverDisplayIsolation: HandoverDisplayIsolationState;
  homepageVisualIdentity: boolean;
  presentationHandoverEnvelope: HandoverConeEnvelope;
  presentationSatelliteWorldById: Map<string, { x: number; y: number; z: number; }>;
  presentedHandoverPairCandidate: SinrLiveCinemaHandoverCandidate | null;
  profile: Profile;
  restrictHomepageBeamItems: (items: readonly SinrLiveCellBeamConeRenderItem[]) => readonly SinrLiveCellBeamConeRenderItem[];
  runtime: RuntimeConfig;
  showSinrLiveCellBeams: boolean;
  sinrLiveCellPlacementById: ReadonlyMap<number, SinrLiveCellPlacement>;
}

export interface UseSinrLiveCinemaInterServingFanConeItemsResult {
  sinrLiveCinemaInterServingFanConeItems: readonly SinrLiveCellBeamConeRenderItem[];
}

export function useSinrLiveCinemaInterServingFanConeItems({ acceptedHandoverPresentation, beamDisplaySpec, cinemaInterDisplayCellFrame, handoverDisplayIsolation, homepageVisualIdentity, presentationHandoverEnvelope, presentationSatelliteWorldById, presentedHandoverPairCandidate, profile, restrictHomepageBeamItems, runtime, showSinrLiveCellBeams, sinrLiveCellPlacementById }: UseSinrLiveCinemaInterServingFanConeItemsParameters): UseSinrLiveCinemaInterServingFanConeItemsResult {
  const sinrLiveCinemaInterServingFanConeItems = useMemo(() => {
      if (
        !showSinrLiveCellBeams
        || homepageVisualIdentity
        || !handoverDisplayIsolation.showCinemaCandidateFan
        || presentedHandoverPairCandidate?.kind !== 'inter'
      ) return [];
      const sourceBeamBudget = resolveSinrLiveConfiguredBeamCount({
        profile,
        runtime,
        satelliteId: presentedHandoverPairCandidate.fromSatId,
        role: 'serving',
        roleCountsRepresentFocusedCells: homepageVisualIdentity,
      });
      const sourceFanOpacity = beamDisplaySpec.servingConeOpacity * presentationHandoverEnvelope.fromOpacity;
      const rawItems = resolveCinemaInterServingFanConeItems({
        candidate: presentedHandoverPairCandidate,
        opacity: sourceFanOpacity,
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: presentationSatelliteWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        cellFrame: cinemaInterDisplayCellFrame,
        maxFanCones: sourceBeamBudget,
      });
      const items = resolveBudgetedSinrLiveBeamConeItems({
        existingItems: rawItems,
        satId: presentedHandoverPairCandidate.fromSatId,
        // The cinema pair owns the source primary cone, so this fan uses the
        // remaining serving-satellite budget.
        maxCones: Math.max(0, sourceBeamBudget - 1),
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: presentationSatelliteWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        role: 'servingFan',
        renderKeyPrefix: 'cinema-serving-display-fan',
      }).map(item => ({ ...item, opacity: sourceFanOpacity }));
      // COLOUR is decided by `src/appearance/`, never here. Keyed on the item's
      // own beam id so the cinema fan and the serving lane agree on the shade
      // for the same beam. Opacity above is untouched by this pass.
      return restrictHomepageBeamItems(paintConeItems(items, {
        resolveIdentityColor: (satId, beamId) =>
          resolveAcceptedBeamIdentityColor(acceptedHandoverPresentation, satId, beamId, ''),
        prominence: 'candidate',
      }));
    }, [
      showSinrLiveCellBeams,
      handoverDisplayIsolation.showCinemaCandidateFan,
      presentedHandoverPairCandidate,
      beamDisplaySpec.servingConeOpacity,
      presentationHandoverEnvelope,
      sinrLiveCellPlacementById,
      presentationSatelliteWorldById,
      profile.beams.frequencyReuse,
      cinemaInterDisplayCellFrame,
      profile,
      runtime,
      homepageVisualIdentity,
      restrictHomepageBeamItems,
      acceptedHandoverPresentation,
    ]);
  return { sinrLiveCinemaInterServingFanConeItems };
}
