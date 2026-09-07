import { useMemo } from 'react';
import { resolveMultiCandidateSatelliteColors, type MultiCandidateSatelliteColorsInput } from './multiCandidateSatelliteColors';

export interface UseMultiCandidateSatelliteColorsParameters {
  multiCandidateSatelliteColorsInput: MultiCandidateSatelliteColorsInput;
}

export interface UseMultiCandidateSatelliteColorsResult {
  multiCandidateSatelliteColorById: Map<string, string>;
}

export function useMultiCandidateSatelliteColors({ multiCandidateSatelliteColorsInput }: UseMultiCandidateSatelliteColorsParameters): UseMultiCandidateSatelliteColorsResult {
  const multiCandidateSatelliteColorById = useMemo(
      () => resolveMultiCandidateSatelliteColors(multiCandidateSatelliteColorsInput),
      [multiCandidateSatelliteColorsInput],
    );
  return { multiCandidateSatelliteColorById };
}
