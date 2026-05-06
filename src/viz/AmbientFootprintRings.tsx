import * as THREE from 'three';
import { BEAM_ROLE_TOKENS } from '../constants/beamRoleTokens';
import type { AmbientRing } from '../scene/types';

interface AmbientFootprintRingsProps {
  rings: AmbientRing[];
  footprintRadiusWorld: number;
}

export function AmbientFootprintRings({
  rings,
  footprintRadiusWorld,
}: AmbientFootprintRingsProps) {
  if (rings.length === 0) return null;

  const color = BEAM_ROLE_TOKENS.otherActive.color;
  const innerRadius = footprintRadiusWorld * 1.03;
  const outerRadius = footprintRadiusWorld * 1.08;

  return (
    <group>
      {rings.map(ring => (
        <mesh
          key={`${ring.satelliteId}-ambient-B${ring.beamId}-${ring.groundX.toFixed(2)}-${ring.groundZ.toFixed(2)}`}
          position={[ring.groundX, 2.2, ring.groundZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={12}
        >
          <ringGeometry args={[innerRadius, outerRadius, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.32}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
