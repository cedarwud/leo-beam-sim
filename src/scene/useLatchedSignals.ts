import { useEffect, useRef, type MutableRefObject } from 'react';
import type { LatchedBudgetState, LatchedSignalState, LatchedTopoState } from './panelState';

export interface LatchedSignalRefs {
  readonly servingSinr: MutableRefObject<LatchedSignalState>;
  readonly comparisonSinr: MutableRefObject<LatchedSignalState>;
  readonly physicalServingTopo: MutableRefObject<LatchedTopoState>;
  readonly servingTopo: MutableRefObject<LatchedTopoState>;
  readonly comparisonTopo: MutableRefObject<LatchedTopoState>;
  readonly physicalServingBudget: MutableRefObject<LatchedBudgetState>;
  readonly servingBudget: MutableRefObject<LatchedBudgetState>;
}

function emptySignal(): LatchedSignalState {
  return { satId: null, beamId: null, sinrDb: null };
}

function emptyTopo(): LatchedTopoState {
  return { satId: null, beamId: null, elevationDeg: null, rangeKm: null };
}

function emptyBudget(): LatchedBudgetState {
  return { satId: null, beamId: null, budget: null };
}

export function useLatchedSignals({
  signalResetKey,
  handoverResetKey,
  beamSinrByKeyRef,
}: {
  readonly signalResetKey?: string;
  readonly handoverResetKey?: string;
  readonly beamSinrByKeyRef: MutableRefObject<Map<string, number>>;
}): LatchedSignalRefs {
  const servingSinr = useRef<LatchedSignalState>(emptySignal());
  const comparisonSinr = useRef<LatchedSignalState>(emptySignal());
  const physicalServingTopo = useRef<LatchedTopoState>(emptyTopo());
  const servingTopo = useRef<LatchedTopoState>(emptyTopo());
  const comparisonTopo = useRef<LatchedTopoState>(emptyTopo());
  const physicalServingBudget = useRef<LatchedBudgetState>(emptyBudget());
  const servingBudget = useRef<LatchedBudgetState>(emptyBudget());

  useEffect(() => {
    servingSinr.current = emptySignal();
    comparisonSinr.current = emptySignal();
    physicalServingTopo.current = emptyTopo();
    servingTopo.current = emptyTopo();
    comparisonTopo.current = emptyTopo();
    physicalServingBudget.current = emptyBudget();
    servingBudget.current = emptyBudget();
    beamSinrByKeyRef.current = new Map();
  }, [signalResetKey, handoverResetKey, beamSinrByKeyRef]);

  return {
    servingSinr,
    comparisonSinr,
    physicalServingTopo,
    servingTopo,
    comparisonTopo,
    physicalServingBudget,
    servingBudget,
  };
}
