import type { JSX } from 'react';
import { Line } from '@react-three/drei';

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CellGroundPoint {
  readonly x: number;
  readonly z: number;
}

export interface FootprintEllipse {
  readonly longAxis: number;
  readonly shortAxis: number;
  readonly longAxisAzimuth: number;
  readonly elevationRad: number;
  readonly points: readonly [number, number, number][];
}

export interface CellFootprintEllipseProps {
  readonly cellId: number;
  readonly cellWorld: CellGroundPoint;
  readonly radiusWorld: number;
  readonly satelliteWorld?: WorldPoint;
  readonly color: string;
}

const FOOTPRINT_POINT_COUNT = 72;
const FOOTPRINT_Y_OFFSET = 0.1;
const MIN_ELEVATION_RAD = 15 * Math.PI / 180;

export function computeFootprintEllipse(
  satelliteWorld: WorldPoint | undefined,
  cellWorld: CellGroundPoint,
  radiusWorld: number,
): FootprintEllipse {
  const shortAxis = radiusWorld;
  if (!satelliteWorld) {
    return {
      longAxis: shortAxis,
      shortAxis,
      longAxisAzimuth: 0,
      elevationRad: Math.PI / 2,
      points: ellipsePoints(shortAxis, shortAxis, 0),
    };
  }

  const dx = satelliteWorld.x - cellWorld.x;
  const dz = satelliteWorld.z - cellWorld.z;
  const horizontalDist = Math.hypot(dx, dz);
  const elevationRad = Math.atan2(satelliteWorld.y, Math.max(horizontalDist, 1e-6));
  const clampedSinElevation = Math.max(Math.sin(elevationRad), Math.sin(MIN_ELEVATION_RAD));
  const longAxis = shortAxis / clampedSinElevation;
  const longAxisAzimuth = Math.atan2(dz, dx);

  return {
    longAxis,
    shortAxis,
    longAxisAzimuth,
    elevationRad,
    points: ellipsePoints(longAxis, shortAxis, longAxisAzimuth),
  };
}

export function CellFootprintEllipse({
  cellId,
  cellWorld,
  radiusWorld,
  satelliteWorld,
  color,
}: CellFootprintEllipseProps): JSX.Element {
  const ellipse = computeFootprintEllipse(satelliteWorld, cellWorld, radiusWorld);

  return (
    <Line
      name={`footprint-${cellId}`}
      position={[0, FOOTPRINT_Y_OFFSET, 0]}
      points={ellipse.points}
      color={color}
      lineWidth={1.4}
      transparent
      opacity={0.5}
      depthWrite={false}
      renderOrder={13}
      userData={{
        cellId,
        longAxis: ellipse.longAxis,
        shortAxis: ellipse.shortAxis,
        longAxisAzimuth: ellipse.longAxisAzimuth,
        elevationRad: ellipse.elevationRad,
        color,
      }}
    />
  );
}

function ellipsePoints(
  longAxis: number,
  shortAxis: number,
  longAxisAzimuth: number,
): readonly [number, number, number][] {
  const points: [number, number, number][] = [];
  const cosAzimuth = Math.cos(longAxisAzimuth);
  const sinAzimuth = Math.sin(longAxisAzimuth);

  for (let index = 0; index <= FOOTPRINT_POINT_COUNT; index += 1) {
    const theta = (index / FOOTPRINT_POINT_COUNT) * Math.PI * 2;
    const localLong = Math.cos(theta) * longAxis;
    const localShort = Math.sin(theta) * shortAxis;
    points.push([
      localLong * cosAzimuth - localShort * sinAzimuth,
      0,
      localLong * sinAzimuth + localShort * cosAzimuth,
    ]);
  }

  return points;
}
