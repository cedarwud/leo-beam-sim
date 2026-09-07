import * as THREE from 'three';
import type { VisibleSat } from './types';

export type SatelliteMarkerSeed = Pick<VisibleSat, 'id' | 'world' | 'satelliteTintColor'>;

export interface SatelliteApexWorld {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RenderedLiveSatelliteMarkersInput {
  readonly displaySats: readonly SatelliteMarkerSeed[];
  readonly handoverMarkerSatelliteIds: ReadonlySet<string>;
  readonly identityColorBySatelliteId: ReadonlyMap<string, string>;
  readonly coneApexWorldById: ReadonlyMap<string, SatelliteApexWorld>;
  readonly resolveFallbackColor: (satelliteId: string) => string;
}

export interface RenderedLiveSatelliteMarker {
  readonly id: string;
  readonly world: THREE.Vector3;
  readonly satelliteTintColor?: string;
}

function markerColor(
  input: RenderedLiveSatelliteMarkersInput,
  satelliteId: string,
): string {
  return input.identityColorBySatelliteId.get(satelliteId)
    ?? input.resolveFallbackColor(satelliteId);
}

/** Preserve the ambient marker field and add only explicitly requested event markers. */
export function resolveRenderedLiveSatelliteMarkers(
  input: RenderedLiveSatelliteMarkersInput,
): RenderedLiveSatelliteMarker[] {
  const markers: RenderedLiveSatelliteMarker[] = input.displaySats.map(marker => ({
    ...marker,
    satelliteTintColor: markerColor(input, marker.id),
  }));
  if (input.handoverMarkerSatelliteIds.size === 0) return markers;

  const displayedSatelliteIds = [...input.handoverMarkerSatelliteIds];
  const existingIds = new Set(markers.map(marker => marker.id));
  for (const satelliteId of displayedSatelliteIds) {
    if (existingIds.has(satelliteId)) continue;
    const existing = input.displaySats.find(satellite => satellite.id === satelliteId);
    if (existing !== undefined) {
      markers.push({
        ...existing,
        satelliteTintColor: markerColor(input, satelliteId),
      });
      existingIds.add(satelliteId);
      continue;
    }
    const apex = input.coneApexWorldById.get(satelliteId);
    if (apex === undefined) continue;
    markers.push({
      id: satelliteId,
      world: new THREE.Vector3(apex.x, apex.y, apex.z),
      satelliteTintColor: markerColor(input, satelliteId),
    });
    existingIds.add(satelliteId);
  }
  return markers;
}
