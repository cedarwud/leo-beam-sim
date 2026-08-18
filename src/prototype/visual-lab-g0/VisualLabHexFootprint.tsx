import type { ReactElement } from 'react';
import * as THREE from 'three';

import {
  SINR_LIVE_FOOTPRINT_INNER_BAND_INNER_FACTOR,
  SINR_LIVE_FOOTPRINT_INNER_BAND_OPACITY,
  SINR_LIVE_FOOTPRINT_INNER_BAND_OUTER_FACTOR,
  SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR,
  SINR_LIVE_FOOTPRINT_RING_OPACITY,
  SINR_LIVE_FOOTPRINT_RING_OUTER_FACTOR,
} from '../../constants/sinrLiveConeStyle';

export interface VisualLabHexFootprintProps {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly outerColor: string;
  readonly innerColor: string;
  readonly fillOpacity?: number;
  readonly outerOpacity?: number;
  readonly innerOpacity?: number;
  readonly y?: number;
}

/** Established simulator footprint language: faint fill plus two close hex rims. */
export function VisualLabHexFootprint({
  x,
  z,
  radius,
  outerColor,
  innerColor,
  fillOpacity = 0,
  outerOpacity = SINR_LIVE_FOOTPRINT_RING_OPACITY,
  innerOpacity = SINR_LIVE_FOOTPRINT_INNER_BAND_OPACITY,
  y = .055,
}: VisualLabHexFootprintProps): ReactElement {
  return <group position={[x, y, z]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
    {fillOpacity > 0 ? <mesh renderOrder={8} frustumCulled={false}>
      <circleGeometry args={[radius, 6]} />
      <meshBasicMaterial
        color={innerColor}
        transparent
        opacity={fillOpacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh> : null}
    <mesh renderOrder={11} frustumCulled={false}>
      <ringGeometry args={[
        radius * SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR,
        radius * SINR_LIVE_FOOTPRINT_RING_OUTER_FACTOR,
        6,
      ]} />
      <meshBasicMaterial
        color={outerColor}
        transparent
        opacity={outerOpacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
    <mesh renderOrder={13} frustumCulled={false}>
      <ringGeometry args={[
        radius * SINR_LIVE_FOOTPRINT_INNER_BAND_INNER_FACTOR,
        radius * SINR_LIVE_FOOTPRINT_INNER_BAND_OUTER_FACTOR,
        6,
      ]} />
      <meshBasicMaterial
        color={innerColor}
        transparent
        opacity={innerOpacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  </group>;
}
