import { useMemo } from 'react';
import { type HandoverRailEvent } from '../ui/HandoverEventRail';
import { selectWalkerHandoverRailEvents, type WalkerHandoverRailSelectionInput } from './walkerHandoverRailSelection';

export interface UseWalkerHandoverRailParameters {
  handoverRailSelectionInput: WalkerHandoverRailSelectionInput;
}

export interface UseWalkerHandoverRailResult {
  handoverRailEvents: readonly HandoverRailEvent[];
}

export function useWalkerHandoverRail({ handoverRailSelectionInput }: UseWalkerHandoverRailParameters): UseWalkerHandoverRailResult {
  const handoverRailEvents = useMemo(
      () => selectWalkerHandoverRailEvents(handoverRailSelectionInput),
      [handoverRailSelectionInput],
    );
  return { handoverRailEvents };
}
