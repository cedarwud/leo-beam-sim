import { useMemo } from 'react';
import { deriveWalkerVisualLabUeGeometry, type WalkerVisualLabUeGeometryInput, type WalkerVisualLabUeGeometryResult } from './walkerVisualLabUeGeometry';

export interface UseWalkerVisualLabGeometryParameters {
  vlabRefUeGeometryInput: WalkerVisualLabUeGeometryInput | null;
}

export interface UseWalkerVisualLabGeometryResult {
  vlabRefUeGeometry: WalkerVisualLabUeGeometryResult | null;
}

export function useWalkerVisualLabGeometry({ vlabRefUeGeometryInput }: UseWalkerVisualLabGeometryParameters): UseWalkerVisualLabGeometryResult {
  const vlabRefUeGeometry = useMemo(
      () => vlabRefUeGeometryInput === null
        ? null
        : deriveWalkerVisualLabUeGeometry(vlabRefUeGeometryInput),
      [vlabRefUeGeometryInput],
    );
  return { vlabRefUeGeometry };
}
