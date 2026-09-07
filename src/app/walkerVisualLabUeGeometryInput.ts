import type { WalkerVisualLabUeGeometryInput } from './walkerVisualLabUeGeometry';

type GroundPositionKm = readonly [number, number];

/**
 * The smallest read model needed to feed the Walker Visual Lab geometry
 * calculation.  The session owns the larger canonical/local scene objects;
 * this adapter deliberately depends only on the fields used by the geometry
 * seam.
 */
export interface WalkerVisualLabUeGeometrySource {
  readonly snapshot: {
    readonly serving: {
      readonly distanceKm: number | null;
      readonly elevationDeg: number | null;
    };
  } | null;
  readonly localScene: {
    readonly representative: {
      readonly availability: 'available' | 'unavailable';
      readonly user: {
        readonly index: number;
        readonly positionKm: GroundPositionKm;
      } | null;
      readonly cell: {
        readonly centerKm: GroundPositionKm;
      } | null;
    };
    readonly substrate: {
      readonly cellRadiusKm: number;
      readonly worldUnitsPerKm: number;
    };
  } | null;
  readonly selectedUeWorldPosition: Readonly<{ x: number; z: number }> | null;
}

/**
 * Convert the Visual Lab session read model into the geometry module's input.
 * Missing accepted link/representative data keeps the control unavailable;
 * the adapter never invents a position or a scale.
 */
export function buildWalkerVisualLabUeGeometryInput(
  input: WalkerVisualLabUeGeometrySource,
): WalkerVisualLabUeGeometryInput | null {
  const { snapshot, localScene } = input;
  const representative = localScene?.representative;
  const user = representative?.user;
  const cell = representative?.cell;
  if (
    snapshot === null
    || localScene === null
    || representative === undefined
    || representative.availability !== 'available'
    || user === null
    || user === undefined
    || cell === null
    || cell === undefined
    || snapshot.serving.distanceKm === null
    || snapshot.serving.elevationDeg === null
    || !Number.isFinite(localScene.substrate.worldUnitsPerKm)
    || localScene.substrate.worldUnitsPerKm <= 0
  ) return null;

  return {
    link: {
      satelliteDistanceKm: snapshot.serving.distanceKm,
      satelliteElevationDeg: snapshot.serving.elevationDeg,
    },
    geometry: {
      beamCenterKm: cell.centerKm,
      acceptedPositionKm: user.positionKm,
      cellRadiusKm: localScene.substrate.cellRadiusKm,
      worldUnitsPerKm: localScene.substrate.worldUnitsPerKm,
    },
    representativeUserIndex: user.index,
    selectedUeWorldPosition: input.selectedUeWorldPosition,
  };
}
