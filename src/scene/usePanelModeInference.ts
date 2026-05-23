import { useCallback, useEffect, useRef } from 'react';
import { isFinitePanelSinr } from './panelState';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import type { SimState } from './types';

// P1d: consumes `NormalizedSceneFrame.metrics` + `pendingTarget` + `recentHo`
// (per SDD §7 Refactored bucket). Both live + replay paths drive this hook
// uniformly through the adapter.

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
  readonly frame: NormalizedSceneFrame;
  readonly liveServingSinrDb: number | null;
  readonly candidateComparisonSatId: string | null;
  readonly candidateComparisonBeamId: number | null;
  readonly idleComparisonSinrDb: number | null;
}

export type InferPanelMode = (inputs: PanelModeInputs) => PanelModeResult;

function parseBeamId(beamId: string | null | undefined): number | null {
  if (beamId === null || beamId === undefined || beamId === '') return null;
  const numeric = Number(beamId);
  return Number.isFinite(numeric) ? numeric : null;
}

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
    frame,
    liveServingSinrDb,
    candidateComparisonSatId,
    candidateComparisonBeamId,
    idleComparisonSinrDb,
  }: PanelModeInputs): PanelModeResult => {
    const previousHandoverPanel = handoverPanelRef.current;
    const servingSatId = frame.metrics.servingSatelliteId || null;
    const servingBeamId = parseBeamId(frame.metrics.servingBeamId);
    const pendingTargetSatId = frame.pendingTarget?.satId ?? null;
    const pendingTargetBeamId = parseBeamId(frame.pendingTarget?.beamId);
    const pendingTargetSinrDb = frame.pendingTarget?.channelMetric?.dB ?? null;
    const recentHoSourceSatId = frame.recentHo?.sourceSatId ?? null;
    const recentHoSourceBeamId = parseBeamId(frame.recentHo?.sourceBeamId);
    const recentHoSourceSinrDb = frame.recentHo?.sourceChannelMetric?.dB ?? null;
    const recentHoTargetSatId = frame.recentHo?.targetSatId ?? null;
    const recentHoTargetBeamId = parseBeamId(frame.recentHo?.targetBeamId);
    // Live stub did not carry recentHoTargetSinrDb; renderer treats absent.
    const recentHoTargetSinrDb: number | null = null;

    let panelServingSatId = servingSatId;
    let panelServingBeamId = servingBeamId;
    let panelServingSinrDb: number | null = liveServingSinrDb;
    let panelComparisonSatId = candidateComparisonSatId;
    let panelComparisonBeamId = candidateComparisonBeamId;
    let panelComparisonSinrDb: number | null = idleComparisonSinrDb;
    let panelComparisonKind: SimState['comparisonKind'] =
      candidateComparisonSatId !== null ? 'candidate' : null;

    if (
      pendingTargetSatId !== null
      && pendingTargetBeamId !== null
      && servingSatId !== null
      && servingBeamId !== null
    ) {
      const samePendingPair =
        previousHandoverPanel?.phase === 'pending'
        && previousHandoverPanel.servingSatId === servingSatId
        && previousHandoverPanel.servingBeamId === servingBeamId
        && previousHandoverPanel.comparisonSatId === pendingTargetSatId
        && previousHandoverPanel.comparisonBeamId === pendingTargetBeamId;
      const pendingServingSinrDb = isFinitePanelSinr(liveServingSinrDb)
        ? liveServingSinrDb
        : samePendingPair
          ? previousHandoverPanel.servingSinrDb
          : null;
      const pendingComparisonSinrDb = isFinitePanelSinr(pendingTargetSinrDb)
        ? pendingTargetSinrDb
        : samePendingPair
          ? previousHandoverPanel.comparisonSinrDb
          : null;
      handoverPanelRef.current = {
        phase: 'pending',
        servingSatId,
        servingBeamId,
        servingSinrDb: pendingServingSinrDb,
        comparisonSatId: pendingTargetSatId,
        comparisonBeamId: pendingTargetBeamId,
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
      recentHoSourceSatId !== null
      && recentHoSourceBeamId !== null
      && recentHoTargetSatId !== null
      && recentHoTargetBeamId !== null
    ) {
      const sameRecentPair =
        previousHandoverPanel?.phase === 'recent-ho'
        && previousHandoverPanel.servingSatId === recentHoSourceSatId
        && previousHandoverPanel.servingBeamId === recentHoSourceBeamId
        && previousHandoverPanel.comparisonSatId === recentHoTargetSatId
        && previousHandoverPanel.comparisonBeamId === recentHoTargetBeamId;
      const matchesPreviousPendingPair =
        previousHandoverPanel?.phase === 'pending'
        && previousHandoverPanel.servingSatId === recentHoSourceSatId
        && previousHandoverPanel.servingBeamId === recentHoSourceBeamId
        && previousHandoverPanel.comparisonSatId === recentHoTargetSatId
        && previousHandoverPanel.comparisonBeamId === recentHoTargetBeamId;
      const recentServingSinrDb = isFinitePanelSinr(recentHoSourceSinrDb)
        ? recentHoSourceSinrDb
        : matchesPreviousPendingPair
          ? previousHandoverPanel.servingSinrDb
          : sameRecentPair
            ? previousHandoverPanel.servingSinrDb
            : null;
      const recentComparisonSinrDb = isFinitePanelSinr(recentHoTargetSinrDb)
        ? recentHoTargetSinrDb
        : matchesPreviousPendingPair
          ? previousHandoverPanel.comparisonSinrDb
          : sameRecentPair
            ? previousHandoverPanel.comparisonSinrDb
            : null;
      handoverPanelRef.current = {
        phase: 'recent-ho',
        servingSatId: recentHoSourceSatId,
        servingBeamId: recentHoSourceBeamId,
        servingSinrDb: recentServingSinrDb,
        comparisonSatId: recentHoTargetSatId,
        comparisonBeamId: recentHoTargetBeamId,
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
