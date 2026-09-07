import { cellLinkBudgetBeamId } from './sinrLiveCellModel';
import type { HandoverPresentationEvent } from './handoverPresentationOwner';

export interface BeamInfoItemShape {
  readonly satId: string;
  readonly cellId: number;
  readonly beamId?: number | null;
  readonly displayOnly?: boolean;
}

export interface BeamInfoItemsInput<T extends BeamInfoItemShape = BeamInfoItemShape> {
  readonly layers: {
    readonly additiveCinemaHandoverPair: readonly T[];
    readonly additiveTriggeredIntra: readonly T[];
    readonly authorityHandoverPair: readonly T[];
    readonly serving: readonly T[];
  };
  readonly presentation: {
    readonly homepageVisualIdentity: boolean;
    readonly multiCandidateCentralOverlayActive: boolean;
    readonly multiCandidateIdentityTransitionActive: boolean;
    readonly active: boolean;
    readonly event: HandoverPresentationEvent | null;
  };
}

function beamKey(item: BeamInfoItemShape): string {
  return `${item.satId}/${item.cellId}/${item.beamId ?? cellLinkBudgetBeamId(item.cellId)}`;
}

/** Deduplicate visible beam evidence and narrow it to the active handover pair when required. */
export function resolveBeamInfoItems<T extends BeamInfoItemShape>(
  input: BeamInfoItemsInput<T>,
): T[] {
  const itemsByBeam = new Map<string, T>();
  for (const item of [
    ...input.layers.additiveCinemaHandoverPair,
    ...input.layers.additiveTriggeredIntra,
    ...input.layers.authorityHandoverPair,
    ...input.layers.serving,
  ]) {
    if (item.displayOnly === true) continue;
    const key = beamKey(item);
    if (!itemsByBeam.has(key)) itemsByBeam.set(key, item);
  }

  const allItems = [...itemsByBeam.values()];
  const presentation = input.presentation;
  if (
    presentation.homepageVisualIdentity
    && (presentation.multiCandidateCentralOverlayActive || presentation.multiCandidateIdentityTransitionActive)
    && presentation.active
    && presentation.event !== null
  ) {
    const endpointKeys = new Set([
      beamKey({
        satId: presentation.event.from.satId,
        cellId: presentation.event.from.cellId,
        beamId: presentation.event.from.beamId,
      }),
      beamKey({
        satId: presentation.event.to.satId,
        cellId: presentation.event.to.cellId,
        beamId: presentation.event.to.beamId,
      }),
    ]);
    const pairItems = allItems.filter(item => endpointKeys.has(beamKey(item)));
    return pairItems.length > 0 ? pairItems : allItems;
  }
  return allItems;
}
