import { useMemo } from 'react';
import {
  resolveServingConeItems,
  type ServingConeGeometryInput,
  type ServingConePresentationInput,
} from './servingConeItems';
import { type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';

export interface UseSinrLiveCellBeamConeItemsParameters {
  /** Explicit frame, placement, apex, identity, and budget inputs. */
  readonly geometry: ServingConeGeometryInput;
  /** Display-only gates and final filtering policy. */
  readonly presentation: ServingConePresentationInput;
}

export interface UseSinrLiveCellBeamConeItemsResult {
  readonly sinrLiveCellBeamConeItems: readonly SinrLiveCellBeamConeRenderItem[];
}

/** Thin React adapter around the pure serving-cone projection. */
export function useSinrLiveCellBeamConeItems(
  input: UseSinrLiveCellBeamConeItemsParameters,
): UseSinrLiveCellBeamConeItemsResult {
  const sinrLiveCellBeamConeItems = useMemo(
    () => resolveServingConeItems(input),
    [input],
  );
  return { sinrLiveCellBeamConeItems };
}
