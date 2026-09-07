import { useMemo } from 'react';
import { resolveRenderedLiveSatelliteMarkers, type RenderedLiveSatelliteMarkersInput, type RenderedLiveSatelliteMarker } from './renderedLiveSatelliteMarkers';

export interface UseRenderedLiveSatelliteMarkersParameters {
  renderedLiveSatelliteMarkersInput: RenderedLiveSatelliteMarkersInput;
}

export interface UseRenderedLiveSatelliteMarkersResult {
  renderedLiveSatelliteMarkers: RenderedLiveSatelliteMarker[];
}

export function useRenderedLiveSatelliteMarkers({ renderedLiveSatelliteMarkersInput }: UseRenderedLiveSatelliteMarkersParameters): UseRenderedLiveSatelliteMarkersResult {
  const renderedLiveSatelliteMarkers = useMemo(
      () => resolveRenderedLiveSatelliteMarkers(renderedLiveSatelliteMarkersInput),
      [renderedLiveSatelliteMarkersInput],
    );
  return { renderedLiveSatelliteMarkers };
}
