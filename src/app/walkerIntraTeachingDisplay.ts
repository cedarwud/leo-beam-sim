import type { SimState } from '../scene/types';

export interface WalkerIntraTeachingDisplayInput {
  readonly simState: SimState;
  readonly visibleManualHandoverActive: boolean;
  readonly manualHandoverKind: 'intra' | 'inter' | null;
  readonly intraPresentation: SimState['intraHandoverPresentation'];
}

export function deriveWalkerIntraTeachingDisplay(
  input: WalkerIntraTeachingDisplayInput,
): SimState {
  const presentation = input.visibleManualHandoverActive && input.manualHandoverKind === 'intra'
    ? input.intraPresentation
    : null;
  if (presentation === null || presentation === undefined) return input.simState;
  return {
    ...input.simState,
    panelPrimary: {
      ...input.simState.panelPrimary,
      role: 'serving',
      satId: presentation.sourceSatId,
      beamId: null,
      sinrDb: presentation.servingSinrDb,
      elevationDeg: presentation.elevationDeg,
      rangeKm: presentation.rangeKm,
      status: 'live',
    },
    panelComparison: {
      ...input.simState.panelComparison,
      role: 'pending',
      satId: presentation.sourceSatId,
      beamId: null,
      sinrDb: presentation.candidateSinrDb,
      elevationDeg: presentation.elevationDeg,
      rangeKm: presentation.rangeKm,
      status: 'live',
    },
    servingSatId: presentation.sourceSatId,
    servingBeamId: null,
    servingCellId: presentation.sourceCellId,
    servingElevationDeg: presentation.elevationDeg,
    servingRangeKm: presentation.rangeKm,
    pendingTargetSatId: presentation.sourceSatId,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: presentation.candidateSinrDb,
    comparisonSatId: presentation.sourceSatId,
    comparisonBeamId: null,
    comparisonElevationDeg: presentation.elevationDeg,
    comparisonRangeKm: presentation.rangeKm,
    comparisonSinrDb: presentation.candidateSinrDb,
    comparisonKind: 'pending',
    sinrDeltaDb: presentation.deltaSinrDb,
    sinrDb: presentation.servingSinrDb,
  };
}
