import { cellLinkBudgetBeamId } from './sinrLiveCellModel';
import type { SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';
import type { SpineParticlePlan } from '../viz/SpineParticles';

export interface SinrLiveCellTruthSpineParticlePlansInput {
  readonly enabled: boolean;
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly displayHeroRecord: {
    readonly servingSatId: string;
    readonly cellId: number;
  } | null;
  readonly coneItems: readonly SinrLiveCellBeamConeRenderItem[];
  readonly restrictItems: (
    items: readonly SinrLiveCellBeamConeRenderItem[],
  ) => readonly SinrLiveCellBeamConeRenderItem[];
  readonly particlesPerBeam: number;
}

/** Build particles only from the currently rendered earth-fixed hero cone. */
export function resolveSinrLiveCellTruthSpineParticlePlans(
  input: SinrLiveCellTruthSpineParticlePlansInput,
): readonly SpineParticlePlan[] {
  if (!input.enabled || input.multiCandidateCentralOverlayActive) return [];
  const heroSatId = input.displayHeroRecord?.servingSatId;
  const heroCellId = input.displayHeroRecord?.cellId;
  if (heroSatId === undefined || heroCellId === undefined) return [];

  const heroCone = input.restrictItems(input.coneItems).find(item => (
    item.serving
    && item.satId === heroSatId
    && item.cellId === heroCellId
  ));
  if (heroCone === undefined) return [];

  const start = heroCone.apex.clone();
  const end = heroCone.baseCenter.clone();
  return Object.freeze(Array.from({ length: input.particlesPerBeam }, (_, particleIndex) => ({
    id: `cell-truth:${heroCone.satId}:C${heroCone.cellId}:P${particleIndex}`,
    satelliteId: heroCone.satId,
    beamId: cellLinkBudgetBeamId(heroCone.cellId),
    particleIndex,
    color: heroCone.color,
    start: start.clone(),
    end: end.clone(),
    phaseOffset: particleIndex / input.particlesPerBeam,
  })));
}
