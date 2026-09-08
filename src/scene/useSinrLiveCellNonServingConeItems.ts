import { useMemo } from 'react';
import { type SimFrame, type VizFrame } from './types';
import { resolveSinrLiveNonServingConeItems, type SinrLiveCellPlacement, type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';
import { type BeamDisplaySpec } from './beamDisplaySpec';
import { type AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import { resolveAcceptedBeamIdentityColor } from './acceptedBeamIdentityColor';
import { paintConeItems } from '../appearance/paintConeItems';
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
        // COLOUR is decided by `src/appearance/`, never here. Keyed on the
        // item's own beam id so this lane and the serving lane name the same
        // rung of the identity ladder for the same beam.
        return restrictHomepageBeamItems(paintConeItems(items, {
          resolveIdentityColor: (satId, beamId) =>
            resolveAcceptedBeamIdentityColor(acceptedHandoverPresentation, satId, beamId, ''),
          prominence: 'candidate',
        }));
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
