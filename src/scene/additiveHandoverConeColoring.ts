import { paintConeItem } from '../appearance/paintConeItems';
import { handoverConePaintContext } from '../appearance/handoverOverlayIdentity';

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
 * The overlay's colour for one item.
 *
 * ## This function no longer decides anything
 *
 * It used to. It carried its own copy of "which identity source names a
 * handover cone under the overlay" — plan map at rung 0, no scene lookup,
 * lane-owned kind — while `scene/handoverConeResolvers.ts` carried a DIFFERENT
 * copy for the same items, and this one won. Measured, on one inter pulse item
 * with the accepted snapshot present: the resolver produced `#0a10a0` (the
 * snapshot's published colour) and this pass overwrote it with `#bee561` (the
 * deterministic rung), so the accepted snapshot stopped reaching the screen the
 * moment the comparison overlay opened.
 *
 * The decision now lives once, in `appearance/handoverOverlayIdentity.ts`, and
 * the resolvers ask the same function with the same overlay before these items
 * ever get here. That is what makes this pass IDEMPOTENT rather than
 * authoritative: it recomputes the same answer the resolver already reached.
 * `handoverOverlayIdentityCharacterization.test.ts` pins that it cannot drift.
 *
 * The item's `kind` is now forwarded like every other field; the overlay's
 * `situationKindAuthority: 'lane'` is what makes the lane's kind win. Before,
 * the same effect was achieved by rebuilding the item WITHOUT its `kind`, which
 * made the decision invisible to anyone reading the call.
 */
function overlayColorForItem(
  item: HandoverConeColorItem,
  laneKind: 'intra' | 'inter' | null,
  beamColorBySatelliteCell: ReadonlyMap<string, string>,
): string {
  return paintConeItem(
    item,
    handoverConePaintContext({
      overlay: {
        centralOverlayActive: true,
        beamColorBySatelliteCell,
        laneKind,
      },
      cellId: item.cellId,
    }),
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
