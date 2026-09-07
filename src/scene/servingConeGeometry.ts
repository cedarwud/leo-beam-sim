import { type SimFrame } from './types';
import { resolveSinrLiveCellBeamConeItems, resolveBudgetedSinrLiveBeamConeItems, type SinrLiveCellPlacement, type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';
import { cellFrequencyIndex, cellLinkBudgetBeamId } from './sinrLiveCellModel';

function resolveServingConeGeometry(input: {
  readonly cellFrame: SimFrame['sinrLiveCells'];
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, { readonly x: number; readonly y: number; readonly z: number }>;
  readonly focusSatIds: ReadonlySet<string> | null;
  readonly frequencyReuse: number;
  readonly servingBeamBudget: number;
  readonly allowHeroFallback: boolean;
  readonly budgetServingFan: boolean;
  readonly displayHeroRecord: { readonly servingSatId: string; readonly cellId: number; readonly beamId?: number | null } | null;
}): readonly SinrLiveCellBeamConeRenderItem[] {
  const {
    cellFrame,
    placementByCellId,
    satelliteWorldById,
    focusSatIds,
    frequencyReuse,
    servingBeamBudget,
    allowHeroFallback,
    budgetServingFan,
    displayHeroRecord,
  } = input;
  if (!cellFrame) return [];

  const rawItems = resolveSinrLiveCellBeamConeItems({
    cellFrame,
    placementByCellId,
    satelliteWorldById,
    focusSatIds,
  });
  const servingFallbackFrame: NonNullable<SimFrame['sinrLiveCells']> | null = allowHeroFallback
    && rawItems.length === 0
    && displayHeroRecord !== null
    ? {
      ...cellFrame,
      illuminatedBeams: [{
        satId: displayHeroRecord.servingSatId,
        cellId: displayHeroRecord.cellId,
        beamId: displayHeroRecord.beamId ?? cellLinkBudgetBeamId(displayHeroRecord.cellId),
        frequencyIndex: cellFrequencyIndex(displayHeroRecord.cellId, frequencyReuse),
        serving: true,
      }],
    }
    : null;
  const drawableItems = rawItems.length > 0 || servingFallbackFrame === null
    ? rawItems
    : resolveSinrLiveCellBeamConeItems({
      cellFrame: servingFallbackFrame,
      placementByCellId,
      satelliteWorldById,
      focusSatIds,
    });
  return budgetServingFan
    ? resolveBudgetedSinrLiveBeamConeItems({
      existingItems: drawableItems,
      satId: displayHeroRecord?.servingSatId,
      maxCones: servingBeamBudget,
      placementByCellId,
      satelliteWorldById,
      frequencyReuse,
      role: 'servingFan',
      renderKeyPrefix: 'serving-display-fan',
      preferredCellId: displayHeroRecord?.cellId,
      preferredBeamId: displayHeroRecord?.beamId,
    })
    : drawableItems;
}

export { resolveServingConeGeometry };
