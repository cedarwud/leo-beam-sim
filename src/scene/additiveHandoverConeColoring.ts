import { paintConeItem } from '../appearance/paintConeItems';

export interface HandoverConeColorItem {
  readonly satId: string;
  readonly cellId: number;
  /**
   * Exact link-budget beam id when the item carries one — every real render item
   * does. It is here so the identity fallback below describes the SAME beam the
   * rest of the scene describes, instead of the beam one lightness rung away
   * that a cell-derived fallback names.
   */
  readonly beamId?: number;
  readonly color: string;
  readonly renderKey?: string;
  readonly kind?: 'intra' | 'inter';
  readonly role?: string;
}

export interface AdditiveHandoverConeColoringInput<TItem extends HandoverConeColorItem> {
  readonly pulseItems: readonly TItem[];
  readonly triggeredIntraItems: readonly TItem[];
  readonly cinemaPairItems: readonly TItem[];
  readonly centralOverlayActive: boolean;
  readonly authorityPresentationCommitObserved: boolean;
  readonly beamColorBySatelliteCell: ReadonlyMap<string, string>;
  readonly presentationPairKind: 'intra' | 'inter' | null | undefined;
}

export interface AdditiveHandoverConeColoringResult<TItem extends HandoverConeColorItem> {
  readonly pulseItems: readonly TItem[];
  readonly triggeredIntraItems: readonly TItem[];
  readonly cinemaPairItems: readonly TItem[];
}

/**
 * The overlay's colour for one item — identity, then the handover table.
 *
 * Two things are deliberate here.
 *
 * The IDENTITY source is the accepted comparison plan's published colour for
 * this (satellite, cell), which outranks anything derived from the id because it
 * is what the rail is already showing. Beneath it `paintConeItem` supplies the
 * deterministic identity colour for the same beam id it used as the key, which
 * is the rung this overlay used to miss: its own fallback was derived from the
 * CELL while every other lane's was derived from the BEAM.
 *
 * The MODIFIER is chosen per LANE, not per item, which is what this overlay
 * always did: the triggered lane shades both sides as an intra pair, the cinema
 * lane shades only when the presented pair is intra, and the pulse lane does not
 * shade at all. So `laneKind` carries the decision and the item's own `kind` is
 * deliberately not forwarded; the SIDE still comes from the item, resolved by
 * the appearance module from the same role/renderKey signals as everywhere else.
 */
function overlayColorForItem(
  item: HandoverConeColorItem,
  laneKind: 'intra' | 'inter' | null,
  beamColorBySatelliteCell: ReadonlyMap<string, string>,
): string {
  return paintConeItem(
    {
      satId: item.satId,
      cellId: item.cellId,
      beamId: item.beamId,
      color: item.color,
      role: item.role,
      renderKey: item.renderKey,
    },
    {
      // The plan map is supplied as ladder rung 0 (`planColorFor`). A MISS returns
      // `undefined` and falls through to the ladder's deterministic rung without any
      // caller-side `??` decision.
      planColorFor: (satId) => beamColorBySatelliteCell.get(`${satId}/${item.cellId}`),
      laneKind,
    },
  ).color;
}

/** Apply the additive candidate identity treatment to the three handover cone layers. */
export function resolveAdditiveHandoverConeColoring<TItem extends HandoverConeColorItem>(
  input: AdditiveHandoverConeColoringInput<TItem>,
): AdditiveHandoverConeColoringResult<TItem> {
  const filteredPulseItems = input.pulseItems.filter(item => !(
    input.centralOverlayActive
    && input.authorityPresentationCommitObserved
    && item.kind === 'inter'
    && item.role === 'handoverSource'
  ));
  if (!input.centralOverlayActive) {
    return {
      pulseItems: filteredPulseItems,
      triggeredIntraItems: input.triggeredIntraItems,
      cinemaPairItems: input.cinemaPairItems,
    };
  }

  return {
    pulseItems: filteredPulseItems.map(item => ({
      ...item,
      color: overlayColorForItem(item, null, input.beamColorBySatelliteCell),
    })),
    triggeredIntraItems: input.triggeredIntraItems.map(item => ({
      ...item,
      color: overlayColorForItem(item, 'intra', input.beamColorBySatelliteCell),
    })),
    cinemaPairItems: input.cinemaPairItems.map(item => ({
      ...item,
      color: overlayColorForItem(
        item,
        input.presentationPairKind ?? null,
        input.beamColorBySatelliteCell,
      ),
    })),
  };
}
