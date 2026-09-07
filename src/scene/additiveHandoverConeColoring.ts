import { HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR } from '../constants/handoverVisualIdentity';
import { emphasizeIntraHandoverColor } from '../constants/servingColour';
import { resolveServingIdentityColor } from './beamConeIdentityColors';

export interface HandoverConeColorItem {
  readonly satId: string;
  readonly cellId: number;
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

function colorForItem<TItem extends HandoverConeColorItem>(
  item: TItem,
  beamColorBySatelliteCell: ReadonlyMap<string, string>,
): string {
  return beamColorBySatelliteCell.get(`${item.satId}/${item.cellId}`)
    ?? resolveServingIdentityColor(
      item.satId,
      item.cellId,
      HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
    );
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
      color: colorForItem(item, input.beamColorBySatelliteCell),
    })),
    triggeredIntraItems: input.triggeredIntraItems.map(item => ({
      ...item,
      color: emphasizeIntraHandoverColor(
        colorForItem(item, input.beamColorBySatelliteCell),
        item.renderKey?.endsWith('-trig-to') === true ? 'target' : 'source',
      ),
    })),
    cinemaPairItems: input.cinemaPairItems.map(item => ({
      ...item,
      color: input.presentationPairKind === 'intra'
        ? emphasizeIntraHandoverColor(
          colorForItem(item, input.beamColorBySatelliteCell),
          item.renderKey?.endsWith('-from') === true ? 'source' : 'target',
        )
        : colorForItem(item, input.beamColorBySatelliteCell),
    })),
  };
}
