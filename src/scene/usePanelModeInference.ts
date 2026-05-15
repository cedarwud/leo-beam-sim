import { useCallback, useEffect, useRef } from 'react';
import { isFinitePanelSinr } from './panelState';
import type { SimFrame, SimState } from './types';

interface HandoverPanelSnapshot {
  phase: 'pending' | 'recent-ho';
  servingSatId: string;
  servingBeamId: number;
  servingSinrDb: number | null;
  comparisonSatId: string;
  comparisonBeamId: number;
  comparisonSinrDb: number | null;
}

export interface PanelModeResult {
  readonly panelServingSatId: string | null;
  readonly panelServingBeamId: number | null;
  readonly panelServingSinrDb: number | null;
  readonly panelComparisonSatId: string | null;
  readonly panelComparisonBeamId: number | null;
  readonly panelComparisonSinrDb: number | null;
  readonly panelComparisonKind: SimState['comparisonKind'];
}

export interface PanelModeInputs {
  readonly sim: SimFrame;
  readonly liveServingSinrDb: number | null;
  readonly candidateComparisonSatId: string | null;
  readonly candidateComparisonBeamId: number | null;
  readonly idleComparisonSinrDb: number | null;
}

export type InferPanelMode = (inputs: PanelModeInputs) => PanelModeResult;

export function usePanelModeInference({
  signalResetKey,
  handoverResetKey,
}: {
  readonly signalResetKey?: string;
  readonly handoverResetKey?: string;
}): InferPanelMode {
  const handoverPanelRef = useRef<HandoverPanelSnapshot | null>(null);

  useEffect(() => {
    handoverPanelRef.current = null;
  }, [signalResetKey, handoverResetKey]);

  return useCallback(({
    sim,
    liveServingSinrDb,
    candidateComparisonSatId,
    candidateComparisonBeamId,
    idleComparisonSinrDb,
  }: PanelModeInputs): PanelModeResult => {
    const previousHandoverPanel = handoverPanelRef.current;
    let panelServingSatId = sim.serving.satId;
    let panelServingBeamId = sim.serving.beamId;
    let panelServingSinrDb: number | null = liveServingSinrDb;
    let panelComparisonSatId = candidateComparisonSatId;
    let panelComparisonBeamId = candidateComparisonBeamId;
    let panelComparisonSinrDb: number | null = idleComparisonSinrDb;
    let panelComparisonKind: SimState['comparisonKind'] =
      candidateComparisonSatId !== null ? 'candidate' : null;

    if (
      sim.pendingTargetSatId !== null
      && sim.pendingTargetBeamId !== null
      && sim.serving.satId !== null
      && sim.serving.beamId !== null
    ) {
      const samePendingPair =
        previousHandoverPanel?.phase === 'pending'
        && previousHandoverPanel.servingSatId === sim.serving.satId
        && previousHandoverPanel.servingBeamId === sim.serving.beamId
        && previousHandoverPanel.comparisonSatId === sim.pendingTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.pendingTargetBeamId;
      const pendingServingSinrDb = isFinitePanelSinr(liveServingSinrDb)
        ? liveServingSinrDb
        : samePendingPair
          ? previousHandoverPanel.servingSinrDb
          : null;
      const pendingComparisonSinrDb = isFinitePanelSinr(sim.pendingTargetSinrDb)
        ? sim.pendingTargetSinrDb
        : samePendingPair
          ? previousHandoverPanel.comparisonSinrDb
          : null;
      handoverPanelRef.current = {
        phase: 'pending',
        servingSatId: sim.serving.satId,
        servingBeamId: sim.serving.beamId,
        servingSinrDb: pendingServingSinrDb,
        comparisonSatId: sim.pendingTargetSatId,
        comparisonBeamId: sim.pendingTargetBeamId,
        comparisonSinrDb: pendingComparisonSinrDb,
      };
      panelServingSatId = handoverPanelRef.current.servingSatId;
      panelServingBeamId = handoverPanelRef.current.servingBeamId;
      panelServingSinrDb = handoverPanelRef.current.servingSinrDb;
      panelComparisonSatId = handoverPanelRef.current.comparisonSatId;
      panelComparisonBeamId = handoverPanelRef.current.comparisonBeamId;
      panelComparisonSinrDb = handoverPanelRef.current.comparisonSinrDb;
      panelComparisonKind = 'pending';
    } else if (
      sim.recentHoSourceSatId !== null
      && sim.recentHoSourceBeamId !== null
      && sim.recentHoTargetSatId !== null
      && sim.recentHoTargetBeamId !== null
    ) {
      const sameRecentPair =
        previousHandoverPanel?.phase === 'recent-ho'
        && previousHandoverPanel.servingSatId === sim.recentHoSourceSatId
        && previousHandoverPanel.servingBeamId === sim.recentHoSourceBeamId
        && previousHandoverPanel.comparisonSatId === sim.recentHoTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.recentHoTargetBeamId;
      const matchesPreviousPendingPair =
        previousHandoverPanel?.phase === 'pending'
        && previousHandoverPanel.servingSatId === sim.recentHoSourceSatId
        && previousHandoverPanel.servingBeamId === sim.recentHoSourceBeamId
        && previousHandoverPanel.comparisonSatId === sim.recentHoTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.recentHoTargetBeamId;
      const recentServingSinrDb = isFinitePanelSinr(sim.recentHoSourceSinrDb)
        ? sim.recentHoSourceSinrDb
        : matchesPreviousPendingPair
          ? previousHandoverPanel.servingSinrDb
          : sameRecentPair
            ? previousHandoverPanel.servingSinrDb
            : null;
      const recentComparisonSinrDb = isFinitePanelSinr(sim.recentHoTargetSinrDb)
        ? sim.recentHoTargetSinrDb
        : matchesPreviousPendingPair
          ? previousHandoverPanel.comparisonSinrDb
          : sameRecentPair
            ? previousHandoverPanel.comparisonSinrDb
            : null;
      handoverPanelRef.current = {
        phase: 'recent-ho',
        servingSatId: sim.recentHoSourceSatId,
        servingBeamId: sim.recentHoSourceBeamId,
        servingSinrDb: recentServingSinrDb,
        comparisonSatId: sim.recentHoTargetSatId,
        comparisonBeamId: sim.recentHoTargetBeamId,
        comparisonSinrDb: recentComparisonSinrDb,
      };
      panelServingSatId = handoverPanelRef.current.servingSatId;
      panelServingBeamId = handoverPanelRef.current.servingBeamId;
      panelServingSinrDb = handoverPanelRef.current.servingSinrDb;
      panelComparisonSatId = handoverPanelRef.current.comparisonSatId;
      panelComparisonBeamId = handoverPanelRef.current.comparisonBeamId;
      panelComparisonSinrDb = handoverPanelRef.current.comparisonSinrDb;
      panelComparisonKind = 'recent-ho';
    } else {
      handoverPanelRef.current = null;
    }

    return {
      panelServingSatId,
      panelServingBeamId,
      panelServingSinrDb,
      panelComparisonSatId,
      panelComparisonBeamId,
      panelComparisonSinrDb,
      panelComparisonKind,
    };
  }, []);
}
