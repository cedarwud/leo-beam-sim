import type { SimulatorConstellation } from '../simulator/types';

export type SatelliteModelVector = readonly [number, number, number];

export interface SatelliteModelSpec {
  readonly path: string;
  readonly scale: number;
  readonly rotation: SatelliteModelVector;
  readonly centerOffset: SatelliteModelVector;
}

/**
 * Display-only spacecraft stand-ins selected by the accepted constellation.
 * The transforms are inherited from the BeamShift visual host and intentionally
 * remain separate from orbit/beam geometry or any physical spacecraft claim.
 */
export const SATELLITE_MODEL_CATALOG: Readonly<Record<SimulatorConstellation, SatelliteModelSpec>> = Object.freeze({
  starlink: Object.freeze({
    path: '/models/satellite-starlink.glb',
    scale: 0.411,
    rotation: [0.35, 0.6, 0] as const,
    centerOffset: [0.01, 0, -0.307] as const,
  }),
  oneweb: Object.freeze({
    path: '/models/satellite-oneweb.glb',
    scale: 0.336,
    rotation: [0.2, -0.5, 0.1] as const,
    centerOffset: [-1.349, 0.234, 2.092] as const,
  }),
});

export const DEFAULT_SATELLITE_CONSTELLATION: SimulatorConstellation = 'starlink';

export function satelliteModelForConstellation(
  constellation: SimulatorConstellation = DEFAULT_SATELLITE_CONSTELLATION,
): SatelliteModelSpec {
  return SATELLITE_MODEL_CATALOG[constellation];
}
