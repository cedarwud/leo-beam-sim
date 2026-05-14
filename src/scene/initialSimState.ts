import { getFormulaFamilyLabel } from '../profiles';
import type { Profile } from '../profiles/types';
import type { SignalSourceState, SimState } from './types';

function createEmptySignalSource(): SignalSourceState {
  return {
    satId: null,
    beamId: null,
    sinrDb: null,
    elevationDeg: null,
    rangeKm: null,
    status: 'none',
  };
}

export function createInitialSimState(profile: Profile): SimState {
  const emptyPhysicalServing = createEmptySignalSource();
  const emptyPanelPrimary = createEmptySignalSource();
  const emptyPanelComparison = createEmptySignalSource();

  return {
    profileId: profile.id,
    formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
    satelliteVisualIdentityById: {},
    physicalServing: emptyPhysicalServing,
    panelPrimary: { ...emptyPanelPrimary, role: 'none' },
    panelComparison: { ...emptyPanelComparison, role: 'none' },
    servingSatId: null,
    servingBeamId: null,
    servingElevationDeg: null,
    servingRangeKm: null,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    comparisonSatId: null,
    comparisonBeamId: null,
    comparisonElevationDeg: null,
    comparisonRangeKm: null,
    comparisonSinrDb: null,
    comparisonKind: null,
    sinrDeltaDb: null,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    sinrDb: -Infinity,
    physicalServingBudget: null,
    servingBudget: null,
    handoverOffsetDb: profile.handover.offsetDb,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: profile.handover.triggerTimeSec,
    hoCount: 0,
    intraHoCount: 0,
    lastHoReason: '',
    beamHopEnabled: profile.beamHopping.enabled,
    beamHopSlotIndex: -1,
    beamHopSlotSec: profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: null,
    servingSatActiveBeamIds: [],
    pendingTargetActiveBeamIds: [],
  };
}
