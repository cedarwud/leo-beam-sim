import { useMemo } from 'react';
import { type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';
import { resolveBeamInfoItems, type BeamInfoItemsInput } from './beamInfoItems';

export interface UseBeamInfoItemsParameters {
  beamInfoItemsInput: BeamInfoItemsInput<SinrLiveCellBeamConeRenderItem>;
}

export interface UseBeamInfoItemsResult {
  beamInfoItems: SinrLiveCellBeamConeRenderItem[];
}

export function useBeamInfoItems({ beamInfoItemsInput }: UseBeamInfoItemsParameters): UseBeamInfoItemsResult {
  const beamInfoItems = useMemo(
      () => resolveBeamInfoItems(beamInfoItemsInput),
      [beamInfoItemsInput],
    );
  return { beamInfoItems };
}
