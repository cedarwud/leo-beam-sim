import { useMemo } from 'react';
import { type SimState } from '../scene/types';
import { type WalkerIntraTeachingDisplayInput, deriveWalkerIntraTeachingDisplay } from './walkerIntraTeachingDisplay';

export interface UseWalkerIntraTeachingDisplayParameters {
  intraTeachingDisplayInput: WalkerIntraTeachingDisplayInput;
}

export interface UseWalkerIntraTeachingDisplayResult {
  intraTeachingDisplayState: SimState;
}

export function useWalkerIntraTeachingDisplay({ intraTeachingDisplayInput }: UseWalkerIntraTeachingDisplayParameters): UseWalkerIntraTeachingDisplayResult {
  const intraTeachingDisplayState = useMemo(
      () => deriveWalkerIntraTeachingDisplay(intraTeachingDisplayInput),
      [intraTeachingDisplayInput],
    );
  return { intraTeachingDisplayState };
}
