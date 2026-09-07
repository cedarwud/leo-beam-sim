import { useMemo } from 'react';
import {
  resolveCandidateConeItems,
  type CandidateConeGeometryInput,
  type CandidateConePresentationInput,
} from './candidateConeItems';
import { type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';

export interface UseSinrLiveCandidateBeamConeItemsParameters {
  /** Geometry is a selected, explicit frame/world-map request. */
  readonly geometry: CandidateConeGeometryInput;
  /** Presentation is display-only policy; it contains no React state. */
  readonly presentation: CandidateConePresentationInput;
}

export interface UseSinrLiveCandidateBeamConeItemsResult {
  readonly sinrLiveCandidateBeamConeItems: readonly SinrLiveCellBeamConeRenderItem[];
}

/** Thin React adapter around the pure candidate-cone projection. */
export function useSinrLiveCandidateBeamConeItems(
  input: UseSinrLiveCandidateBeamConeItemsParameters,
): UseSinrLiveCandidateBeamConeItemsResult {
  const sinrLiveCandidateBeamConeItems = useMemo(
    () => resolveCandidateConeItems(input),
    [input],
  );
  return { sinrLiveCandidateBeamConeItems };
}
