import { useMemo } from 'react';
import { type SimFrame, type VizFrame } from './types';
import { resolveSinrLiveNonServingConeItems, type SinrLiveCellPlacement, type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';
import { type BeamDisplaySpec } from './beamDisplaySpec';
import { type AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import { resolveAcceptedCellIdentityColor } from './acceptedCellIdentityColor';
import { type HandoverDisplayIsolationState } from './handoverDisplayIsolation';

export interface UseSinrLiveCellNonServingConeItemsParameters {
  acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  beamDisplaySpec: BeamDisplaySpec;
  handoverDisplayIsolation: HandoverDisplayIsolationState;
  homepageVisualIdentity: boolean;
  restrictHomepageBeamItems: (items: readonly SinrLiveCellBeamConeRenderItem[]) => readonly SinrLiveCellBeamConeRenderItem[];
  showSinrLiveCellBeams: boolean;
  sim: SimFrame;
  sinrLiveCellPlacementById: ReadonlyMap<number, SinrLiveCellPlacement>;
  sinrLiveTargetSatIds: Set<string> | null;
  viz: VizFrame;
}

export interface UseSinrLiveCellNonServingConeItemsResult {
  sinrLiveCellNonServingConeItems: readonly SinrLiveCellBeamConeRenderItem[];
}

export function useSinrLiveCellNonServingConeItems({ acceptedHandoverPresentation, beamDisplaySpec, handoverDisplayIsolation, homepageVisualIdentity, restrictHomepageBeamItems, showSinrLiveCellBeams, sim, sinrLiveCellPlacementById, sinrLiveTargetSatIds, viz }: UseSinrLiveCellNonServingConeItemsParameters): UseSinrLiveCellNonServingConeItemsResult {
  const sinrLiveCellNonServingConeItems = useMemo(
      () => {
        if (
          !showSinrLiveCellBeams
          || homepageVisualIdentity
          || handoverDisplayIsolation.hideNormalBeamField
        ) return [];
        if (!beamDisplaySpec.showNonServingCones && sinrLiveTargetSatIds !== null && sinrLiveTargetSatIds.size === 0) return [];
        const items = resolveSinrLiveNonServingConeItems({
          cellFrame: sim.sinrLiveCells,
          placementByCellId: sinrLiveCellPlacementById,
          satelliteWorldById: viz.coneApexWorldById,
          focusSatIds: beamDisplaySpec.showNonServingCones ? null : sinrLiveTargetSatIds,
        });
        return restrictHomepageBeamItems(items.map(item => ({
          ...item,
          color: resolveAcceptedCellIdentityColor(
            acceptedHandoverPresentation,
            item.satId,
            item.cellId,
            item.color,
          ),
        })));
      },
      [
        showSinrLiveCellBeams,
        homepageVisualIdentity,
        handoverDisplayIsolation.hideNormalBeamField,
        beamDisplaySpec.showNonServingCones,
        sim.sinrLiveCells,
        sinrLiveCellPlacementById,
        viz.coneApexWorldById,
        sinrLiveTargetSatIds,
        restrictHomepageBeamItems,
        acceptedHandoverPresentation,
      ],
    );
  return { sinrLiveCellNonServingConeItems };
}
