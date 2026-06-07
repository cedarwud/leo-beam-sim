import { useEffect, useRef, type MutableRefObject } from 'react';
import { getFormulaFamilyLabel } from '../profiles';
import type { Profile } from '../profiles/types';
import type {
  PanelComparisonState,
  PanelPrimaryState,
  SignalSourceState,
  SignalTruthStatus,
  SimFrame,
  SimState,
  VisualFrequencyDiagnosticsState,
  VizFrame,
} from './types';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import {
  extractBudgetTerms,
  hasUiStateChanged,
  isFiniteBeamSinr,
  normalizePanelSignal,
  resolveLatchedBudget,
  resolveLatchedSinr,
  resolveLatchedTopo,
  resolveSignalStatus,
  resolveVisualFrequencyDiagnosticsEntry,
} from './panelState';
import { useLatchedSignals } from './useLatchedSignals';
import { usePanelModeInference } from './usePanelModeInference';

// P1d: this hook now receives `frame: NormalizedSceneFrame` and forwards it
// to `usePanelModeInference`. The bulk of the SimState publication still
// reads `sim: SimFrame` because it surfaces deep live-engine details
// (LinkBudgetTerms, latched signals) that have no replay equivalent — the
// replay path will mount a parallel state publisher driven by producer
// diagnostics. TODO P2: collapse the two publishers behind the
// NormalizedSceneFrame seam once the replay SimState shape stabilises.

const UI_STABLE_UPDATE_INTERVAL_MS = 700;
const UI_HANDOVER_UPDATE_INTERVAL_MS = 250;

export function useSimStatePublisher({
  profile,
  sim,
  frame,
  viz,
  signalResetKey,
  handoverResetKey,
  latchedBeamSinrByKeyRef,
  onSimUpdate,
  enabled = true,
  modqnCellServiceReadout,
}: {
  profile: Profile;
  sim: SimFrame;
  frame: NormalizedSceneFrame;
  viz: VizFrame;
  signalResetKey?: string;
  handoverResetKey?: string;
  latchedBeamSinrByKeyRef: MutableRefObject<Map<string, number>>;
  onSimUpdate: (state: SimState) => void;
  enabled?: boolean;
  modqnCellServiceReadout?: SimState['modqnCellServiceReadout'];
}) {
  const latched = useLatchedSignals({
    signalResetKey,
    handoverResetKey,
    beamSinrByKeyRef: latchedBeamSinrByKeyRef,
  });
  const inferPanelMode = usePanelModeInference({ signalResetKey, handoverResetKey });

  const lastUiUpdateAtRef = useRef(0);
  const lastUiStateRef = useRef<SimState | null>(null);

  useEffect(() => {
    lastUiUpdateAtRef.current = 0;
    lastUiStateRef.current = null;
  }, [signalResetKey, handoverResetKey]);

  useEffect(() => {
    if (!enabled) return;

    const topoBySatId = new Map(sim.satellites.map(sat => [sat.id, sat.topo]));
    const pendingTargetSinrDb = sim.pendingTargetSinrDb;
    const liveServingSinrDb = resolveLatchedSinr(
      latched.servingSinr.current,
      sim.serving.satId,
      sim.serving.beamId,
      sim.serving.sinrDb,
    );
    const physicalServingSignal = normalizePanelSignal(
      sim.serving.satId,
      sim.serving.beamId,
      liveServingSinrDb,
    );
    const physicalServingTopo = physicalServingSignal.satId
      ? topoBySatId.get(physicalServingSignal.satId)
      : undefined;
    const physicalServingRangeKm = physicalServingSignal.satId
      ? sim.linkRangeKmBySatId.get(physicalServingSignal.satId) ?? physicalServingTopo?.rangeKm ?? null
      : null;
    const normalizedPhysicalServingTopo = resolveLatchedTopo(
      latched.physicalServingTopo.current,
      physicalServingSignal.satId,
      physicalServingSignal.beamId,
      physicalServingTopo?.elevationDeg ?? null,
      physicalServingRangeKm,
    );
    const candidateComparisonSample = [...sim.linkSamples]
      .filter(sample => sample.satId !== sim.serving.satId)
      .sort((a, b) => b.sinrDb - a.sinrDb)[0] ?? null;
    const idleComparisonSinrDb = resolveLatchedSinr(
      latched.comparisonSinr.current,
      candidateComparisonSample?.satId ?? null,
      candidateComparisonSample?.beamId ?? null,
      candidateComparisonSample?.sinrDb ?? null,
    );

    const panelMode = inferPanelMode({
      frame,
      liveServingSinrDb,
      candidateComparisonSatId: candidateComparisonSample?.satId ?? null,
      candidateComparisonBeamId: candidateComparisonSample?.beamId ?? null,
      idleComparisonSinrDb,
    });

    const normalizedServing = normalizePanelSignal(
      panelMode.panelServingSatId,
      panelMode.panelServingBeamId,
      panelMode.panelServingSinrDb,
    );
    const normalizedComparison = normalizePanelSignal(
      panelMode.panelComparisonSatId,
      panelMode.panelComparisonBeamId,
      panelMode.panelComparisonSinrDb,
    );
    const servingTopo = normalizedServing.satId
      ? topoBySatId.get(normalizedServing.satId)
      : undefined;
    const comparisonTopo = normalizedComparison.satId
      ? topoBySatId.get(normalizedComparison.satId)
      : undefined;
    const servingRangeKm = normalizedServing.satId
      ? sim.linkRangeKmBySatId.get(normalizedServing.satId) ?? servingTopo?.rangeKm ?? null
      : null;
    const comparisonRangeKm = normalizedComparison.satId
      ? sim.linkRangeKmBySatId.get(normalizedComparison.satId) ?? comparisonTopo?.rangeKm ?? null
      : null;
    const normalizedServingTopo = resolveLatchedTopo(
      latched.servingTopo.current,
      normalizedServing.satId,
      normalizedServing.beamId,
      servingTopo?.elevationDeg ?? null,
      servingRangeKm,
    );
    const normalizedComparisonTopo = resolveLatchedTopo(
      latched.comparisonTopo.current,
      normalizedComparison.satId,
      normalizedComparison.beamId,
      comparisonTopo?.elevationDeg ?? null,
      comparisonRangeKm,
    );
    const visibleBeamKeys = new Set<string>();
    const pushVisibleBeamKey = (satId: string | null, beamId: number | null) => {
      if (!satId || beamId === null) return;
      visibleBeamKeys.add(`${satId}:${beamId}`);
    };

    for (const [satId, beamCells] of sim.beamCellsBySatId.entries()) {
      for (const beam of beamCells) {
        visibleBeamKeys.add(`${satId}:${beam.beamId}`);
      }
    }

    pushVisibleBeamKey(normalizedServing.satId, normalizedServing.beamId);
    pushVisibleBeamKey(normalizedComparison.satId, normalizedComparison.beamId);
    pushVisibleBeamKey(sim.pendingTargetSatId, sim.pendingTargetBeamId);
    pushVisibleBeamKey(sim.recentHoSourceSatId, sim.recentHoSourceBeamId);
    pushVisibleBeamKey(sim.recentHoTargetSatId, sim.recentHoTargetBeamId);

    const nextLatchedBeamSinrByKey = new Map<string, number>();
    for (const key of visibleBeamKeys) {
      const previousSinrDb = latchedBeamSinrByKeyRef.current.get(key);
      if (isFiniteBeamSinr(previousSinrDb)) {
        nextLatchedBeamSinrByKey.set(key, previousSinrDb);
      }
    }

    for (const sample of sim.linkSamples) {
      const key = `${sample.satId}:${sample.beamId}`;
      if (!visibleBeamKeys.has(key) || !isFiniteBeamSinr(sample.sinrDb)) continue;
      nextLatchedBeamSinrByKey.set(key, sample.sinrDb);
    }

    const syncLatchedBeamSinr = (
      satId: string | null,
      beamId: number | null,
      sinrDb: number | null,
    ) => {
      if (!satId || beamId === null || !isFiniteBeamSinr(sinrDb)) return;
      nextLatchedBeamSinrByKey.set(`${satId}:${beamId}`, sinrDb);
    };

    syncLatchedBeamSinr(normalizedServing.satId, normalizedServing.beamId, normalizedServing.sinrDb);
    syncLatchedBeamSinr(normalizedComparison.satId, normalizedComparison.beamId, normalizedComparison.sinrDb);
    latchedBeamSinrByKeyRef.current = nextLatchedBeamSinrByKey;

    const panelSinrDeltaDb =
      normalizedComparison.sinrDb !== null && normalizedServing.sinrDb !== null
        ? normalizedComparison.sinrDb - normalizedServing.sinrDb
        : null;
    const servingSatBeamHopState = physicalServingSignal.satId
      ? sim.beamHopStatesBySatId.get(physicalServingSignal.satId)
      : undefined;
    const pendingTargetBeamHopState = sim.pendingTargetSatId
      ? sim.beamHopStatesBySatId.get(sim.pendingTargetSatId)
      : undefined;
    const servingBeamActiveThisSlot =
      physicalServingSignal.satId && physicalServingSignal.beamId !== null
        ? servingSatBeamHopState?.activeBeamIds.includes(physicalServingSignal.beamId) ?? false
        : null;
    const physicalServingSample = physicalServingSignal.satId && physicalServingSignal.beamId !== null
      ? sim.linkSamples.find(
        sample =>
          sample.satId === physicalServingSignal.satId
          && sample.beamId === physicalServingSignal.beamId,
      ) ?? null
      : null;
    const servingSample = normalizedServing.satId && normalizedServing.beamId !== null
      ? sim.linkSamples.find(
        sample =>
          sample.satId === normalizedServing.satId
          && sample.beamId === normalizedServing.beamId,
      ) ?? null
      : null;
    const physicalServingBudget = resolveLatchedBudget(
      latched.physicalServingBudget.current,
      physicalServingSignal.satId,
      physicalServingSignal.beamId,
      extractBudgetTerms(physicalServingSample),
    );
    const servingBudget = resolveLatchedBudget(
      latched.servingBudget.current,
      normalizedServing.satId,
      normalizedServing.beamId,
      extractBudgetTerms(servingSample),
    );
    const panelPrimaryRole: PanelPrimaryState['role'] = normalizedServing.satId
      ? panelMode.panelComparisonKind === 'recent-ho' ? 'ho-source' : 'serving'
      : 'none';
    const panelPrimaryStatus: SignalTruthStatus = panelPrimaryRole === 'ho-source'
      ? 'recent-ho'
      : resolveSignalStatus(
        normalizedServing.satId,
        normalizedServing.beamId,
        sim.serving.sinrDb,
        normalizedServing.sinrDb,
      );
    const panelComparisonRole: PanelComparisonState['role'] =
      normalizedComparison.satId === null
        ? 'none'
        : panelMode.panelComparisonKind === 'pending'
          ? 'pending'
          : panelMode.panelComparisonKind === 'recent-ho'
            ? 'ho-target'
            : 'candidate';
    const panelComparisonStatus: SignalTruthStatus =
      panelComparisonRole === 'none'
        ? 'none'
        : panelComparisonRole === 'ho-target'
          ? 'recent-ho'
          : panelComparisonRole === 'candidate'
            ? 'derived'
            : resolveSignalStatus(
              normalizedComparison.satId,
              normalizedComparison.beamId,
              pendingTargetSinrDb,
              normalizedComparison.sinrDb,
            );
    const physicalServing: SignalSourceState = {
      satId: physicalServingSignal.satId,
      beamId: physicalServingSignal.beamId,
      sinrDb: physicalServingSignal.sinrDb,
      elevationDeg: normalizedPhysicalServingTopo.elevationDeg,
      rangeKm: normalizedPhysicalServingTopo.rangeKm,
      status: resolveSignalStatus(
        physicalServingSignal.satId,
        physicalServingSignal.beamId,
        sim.serving.sinrDb,
        physicalServingSignal.sinrDb,
      ),
    };
    const panelPrimary: PanelPrimaryState = {
      role: panelPrimaryRole,
      satId: normalizedServing.satId,
      beamId: normalizedServing.beamId,
      sinrDb: normalizedServing.sinrDb,
      elevationDeg: normalizedServingTopo.elevationDeg,
      rangeKm: normalizedServingTopo.rangeKm,
      status: panelPrimaryStatus,
    };
    const panelComparison: PanelComparisonState = {
      role: panelComparisonRole,
      satId: normalizedComparison.satId,
      beamId: normalizedComparison.beamId,
      sinrDb: normalizedComparison.sinrDb,
      elevationDeg: normalizedComparisonTopo.elevationDeg,
      rangeKm: normalizedComparisonTopo.rangeKm,
      status: panelComparisonStatus,
    };
    const satelliteVisualIdentityById = Object.fromEntries(
      viz.displaySats.flatMap(sat => {
        if (
          sat.satelliteTintColor === undefined
          || sat.satelliteGlyph === undefined
          || sat.satelliteVisualIndex === undefined
        ) {
          return [];
        }

        return [[sat.id, {
          satelliteTintColor: sat.satelliteTintColor,
          satelliteGlyph: sat.satelliteGlyph,
          satelliteVisualIndex: sat.satelliteVisualIndex,
        }]];
      }),
    );
    const visualFrequencyDiagnostics: VisualFrequencyDiagnosticsState = {
      primary: resolveVisualFrequencyDiagnosticsEntry(
        viz.visualFrequencyByBeamKey,
        normalizedServing.satId,
        normalizedServing.beamId,
      ),
      comparison: resolveVisualFrequencyDiagnosticsEntry(
        viz.visualFrequencyByBeamKey,
        normalizedComparison.satId,
        normalizedComparison.beamId,
      ),
    };
    // S-cells-4c: on the sinr-live lane the published per-UE serving truth is the
    // EARTH-FIXED CELL model (`sim.sinrLiveCells`) so the aggregate HUD + per-UE
    // diagnostics agree with the cones — a UE is "served" only when its cell is lit
    // and served (servingSatId !== null), `servingBeamId` = its cell id. Off that
    // lane (no cell truth) the steered per-UE serving is published unchanged.
    const cellTruthUes = sim.sinrLiveCells?.ues;
    const perUePositions = cellTruthUes !== undefined
      ? (cellTruthUes.length > 1
        ? cellTruthUes.map(ue => ({
          id: ue.ueId,
          servingSatId: ue.servingSatId,
          servingBeamId: ue.servingSatId === null ? null : ue.cellId,
          sinrDb: ue.sinrDb,
        }))
        : undefined)
      : (sim.perUePositions.length > 1
        ? sim.perUePositions.map(position => ({
          id: position.id,
          servingSatId: position.servingSatId,
          servingBeamId: position.servingBeamId,
          sinrDb: position.sinrDb,
        }))
        : undefined);

    const nextIntraHandoverEvent = sim.intraHandoverEvent !== null && sim.intraHandoverWallClockStartMs !== null && sim.intraHandoverWallClockExpiresMs !== null
      ? {
        ...sim.intraHandoverEvent,
        wallClockStartMs: sim.intraHandoverWallClockStartMs,
        wallClockExpiresMs: sim.intraHandoverWallClockExpiresMs,
      }
      : null;

    const nextState: SimState = {
      profileId: profile.id,
      formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
      satelliteVisualIdentityById,
      physicalServing,
      panelPrimary,
      panelComparison,
      visualFrequencyDiagnostics,
      perUePositions,
      modqnCellServiceReadout,
      servingSatId: normalizedServing.satId,
      servingBeamId: normalizedServing.beamId,
      servingElevationDeg: normalizedServingTopo.elevationDeg,
      servingRangeKm: normalizedServingTopo.rangeKm,
      pendingTargetSatId: sim.pendingTargetSatId,
      pendingTargetBeamId: sim.pendingTargetBeamId,
      pendingTargetSinrDb,
      comparisonSatId: normalizedComparison.satId,
      comparisonBeamId: normalizedComparison.beamId,
      comparisonElevationDeg: normalizedComparisonTopo.elevationDeg,
      comparisonRangeKm: normalizedComparisonTopo.rangeKm,
      comparisonSinrDb: normalizedComparison.sinrDb,
      comparisonKind: normalizedComparison.satId ? panelMode.panelComparisonKind : null,
      intraHandoverEvent: nextIntraHandoverEvent,
      sinrDeltaDb: panelSinrDeltaDb,
      recentHoSourceSatId: sim.recentHoSourceSatId,
      recentHoTargetSatId: sim.recentHoTargetSatId,
      recentHoSourceBeamId: sim.recentHoSourceBeamId,
      recentHoTargetBeamId: sim.recentHoTargetBeamId,
      recentHoDeltaDb: sim.recentHoDeltaDb,
      lastHoEvent: sim.lastHoEvent,
      simTimeSec: sim.simTimeSec,
      sinrDb: normalizedServing.sinrDb ?? -Infinity,
      physicalServingBudget,
      servingBudget,
      handoverOffsetDb: profile.handover.offsetDb,
      handoverTriggerProgressSec: sim.handoverTriggerProgressSec,
      handoverTriggerSec: profile.handover.triggerTimeSec,
      hoCount: sim.hoCount,
      intraHoCount: sim.intraHoCount,
      lastHoReason: sim.lastHoReason,
      beamHopEnabled: sim.beamHopEnabled,
      beamHopSlotIndex: sim.beamHopSlotIndex,
      beamHopSlotSec: sim.beamHopSlotSec,
      servingBeamActiveThisSlot,
      servingSatActiveBeamIds: servingSatBeamHopState?.activeBeamIds ?? [],
      pendingTargetActiveBeamIds: pendingTargetBeamHopState?.activeBeamIds ?? [],
    };
    const nowMs = performance.now();
    const handoverWindowActive =
      sim.pendingTargetSatId !== null
      || sim.recentHoSourceSatId !== null
      || sim.recentHoTargetSatId !== null
      || sim.intraHandoverEvent !== null;
    const uiIntervalMs = handoverWindowActive
      ? UI_HANDOVER_UPDATE_INTERVAL_MS
      : UI_STABLE_UPDATE_INTERVAL_MS;
    if (
      hasUiStateChanged(lastUiStateRef.current, nextState)
      || nowMs - lastUiUpdateAtRef.current >= uiIntervalMs
    ) {
      lastUiStateRef.current = nextState;
      lastUiUpdateAtRef.current = nowMs;
      onSimUpdate(nextState);
    }
  }, [enabled, modqnCellServiceReadout, onSimUpdate, sim]);
}
