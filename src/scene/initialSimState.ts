// P1c §C bucket-bare classification (SDD §7): **live-sim only**. Constructs
// the initial `SimState` shape for the live render path before the first
// `useFrame` tick. The artifact-replay path mounts a parallel state
// publisher (P3) driven by the producer-truth `decisionFrames[0]` snapshot.
// No refactor required.
import { getFormulaFamilyLabel } from '../profiles';
import type { Profile } from '../profiles/types';
import { createPendingCanonicalEeSnapshot, type SignalSourceState, type SimState } from './types';

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
    intraHandoverPresentation: null,
    livePaperEnergyEfficiency: null,
    ch5DemoPaperEnergyEfficiency: null,
    canonicalEe: createPendingCanonicalEeSnapshot(),
    servingSatId: null,
    servingBeamId: null,
    servingCellId: null,
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
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoDeltaDb: null,
    lastHoEvent: null,
    simTimeSec: 0,
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
