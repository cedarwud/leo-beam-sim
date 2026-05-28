import type { NormalizedSceneFrame } from '../scene/NormalizedSceneFrame';
import type {
  PanelComparisonState,
  PanelPrimaryState,
  SignalSourceState,
  SimState,
  VisualFrequencyDiagnosticsState,
} from '../scene/types';
import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';

export function selectReplayDisplayUes(
  replaySceneFrame: NormalizedSceneFrame | null,
  elevatedUeId: string | null,
  ueDisplayCount: number,
): NormalizedSceneFrame['ues'] {
  if (!replaySceneFrame) return [];
  const allUes = replaySceneFrame.ues;
  if (allUes.length === 0) return [];
  const focusedId = elevatedUeId ?? allUes[0]?.id;
  const focusedIndex = allUes.findIndex(u => u.id === focusedId);
  const reordered = [...allUes];
  if (focusedIndex > 0) {
    const [focusedUe] = reordered.splice(focusedIndex, 1);
    reordered.unshift(focusedUe);
  }
  return reordered.slice(0, Math.min(ueDisplayCount, reordered.length));
}

export function createReplayPanelSimState(input: {
  readonly sceneSource: 'live-sim' | 'artifact-replay';
  readonly replaySceneFrame: NormalizedSceneFrame | null;
  readonly elevatedUeId: string | null;
  readonly showcaseArtifact: VisualShowcaseArtifact | null;
  readonly frameIndex: number;
}): SimState | null {
  const { sceneSource, replaySceneFrame, elevatedUeId, showcaseArtifact, frameIndex } = input;
  if (sceneSource !== 'artifact-replay' || !replaySceneFrame) return null;

  const allUes = replaySceneFrame.ues;
  if (allUes.length === 0) return null;
  const focusedId = elevatedUeId ?? allUes[0]?.id ?? null;
  const focusedUe = (focusedId ? allUes.find(u => u.id === focusedId) : null) ?? allUes[0];
  if (!focusedUe) return null;

  let hoCount = 0;
  let intraHoCount = 0;
  if (showcaseArtifact) {
    for (let i = 1; i <= frameIndex; i++) {
      const prev = showcaseArtifact.timeline[i - 1];
      const curr = showcaseArtifact.timeline[i];
      if (!prev || !curr) continue;
      const prevUe = prev.ues.find(u => u.id === focusedId) ?? prev.ues[0];
      const currUe = curr.ues.find(u => u.id === focusedId) ?? curr.ues[0];
      if (prevUe && currUe) {
        if (currUe.servingSatelliteId !== prevUe.servingSatelliteId) {
          hoCount++;
        } else if (currUe.servingBeamId !== prevUe.servingBeamId) {
          intraHoCount++;
        }
      }
    }
  }

  const servingSatId = focusedUe.servingSatelliteId;
  const servingBeamId = focusedUe.servingBeamId ? parseInt(focusedUe.servingBeamId) : null;
  const targetSatId = focusedUe.targetSatelliteId ?? null;
  const targetBeamId = focusedUe.targetBeamId ? parseInt(focusedUe.targetBeamId) : null;

  const candidates = focusedUe.candidatesByBeamId;
  const targetSinrDb =
    targetSatId && focusedUe.targetBeamId && candidates
      ? candidates.get(focusedUe.targetBeamId)?.dB ?? null
      : null;

  const physicalServing: SignalSourceState = {
    satId: servingSatId,
    beamId: servingBeamId,
    sinrDb: focusedUe.channelMetric.dB,
    elevationDeg: null,
    rangeKm: null,
    status: 'derived',
  };

  const panelPrimary: PanelPrimaryState = {
    ...physicalServing,
    role:
      replaySceneFrame.handover.kind !== 'none' && replaySceneFrame.handover.kind !== ''
        ? 'ho-source'
        : 'serving',
  };

  const panelComparison: PanelComparisonState = {
    satId: targetSatId,
    beamId: targetBeamId,
    sinrDb: targetSinrDb,
    elevationDeg: null,
    rangeKm: null,
    status: targetSatId ? 'derived' : 'none',
    role: targetSatId ? 'pending' : 'none',
  };

  const sinrDeltaDb = targetSinrDb !== null ? targetSinrDb - focusedUe.channelMetric.dB : null;

  const visualFrequencyDiagnostics: VisualFrequencyDiagnosticsState = {
    primary: {
      satId: servingSatId,
      beamId: servingBeamId,
      frequencyIndex: 0,
      frequencyIndexSource:
        servingSatId !== null && servingBeamId !== null
          ? 'fallback-numeric-modulo'
          : 'not-visible',
      runtimeFrequencyReuse: 0,
      coreLayoutFrequencyReuse: null,
    },
    comparison: {
      satId: targetSatId,
      beamId: targetBeamId,
      frequencyIndex: 0,
      frequencyIndexSource:
        targetSatId !== null && targetBeamId !== null
          ? 'fallback-numeric-modulo'
          : 'not-visible',
      runtimeFrequencyReuse: 0,
      coreLayoutFrequencyReuse: null,
    },
  };

  return {
    profileId: showcaseArtifact?.scenario.id ?? 'modqn-1sat-7beam',
    formulaFamilyLabel: 'SNR (no interference)',
    satelliteVisualIdentityById: {},
    physicalServing,
    panelPrimary,
    panelComparison,
    visualFrequencyDiagnostics,
    servingSatId,
    servingBeamId,
    servingElevationDeg: null,
    servingRangeKm: null,
    pendingTargetSatId: targetSatId,
    pendingTargetBeamId: targetBeamId,
    pendingTargetSinrDb: targetSinrDb,
    comparisonSatId: targetSatId,
    comparisonBeamId: targetBeamId,
    comparisonElevationDeg: null,
    comparisonRangeKm: null,
    comparisonSinrDb: targetSinrDb,
    comparisonKind: targetSatId ? 'pending' : null,
    sinrDeltaDb,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoDeltaDb: null,
    lastHoEvent: null,
    simTimeSec: replaySceneFrame.tSec,
    sinrDb: focusedUe.channelMetric.dB,
    physicalServingBudget: null,
    servingBudget: null,
    handoverOffsetDb: 0,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: 0,
    hoCount,
    intraHoCount,
    lastHoReason: replaySceneFrame.handover.handoverProvenance?.note ?? '—',
    beamHopEnabled: false,
    beamHopSlotIndex: -1,
    beamHopSlotSec: 0,
    servingBeamActiveThisSlot: true,
    servingSatActiveBeamIds: servingBeamId !== null ? [servingBeamId] : [],
    pendingTargetActiveBeamIds: targetBeamId !== null ? [targetBeamId] : [],
  };
}
