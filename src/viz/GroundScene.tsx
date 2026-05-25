import { useLayoutEffect, useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

/**
 * GroundScene — UE markers (one per scene-frame UE).
 *
 * P2 (SDD §9): generalized from single-UE `(ueGroundX, ueGroundZ)` to a
 * multi-UE input. Array length matches `NormalizedSceneFrame.ues`:
 *   - live path (R6 invariant): exactly 1 element
 *   - replay path: up to ~100 elements (trigger artifact's UE count)
 *
 * Rendering technique:
 *   - When the input has >1 UE we use `THREE.InstancedMesh` so all
 *     non-primary UE markers share one draw call.
 *   - The primary UE (index 0) is drawn as a separate non-instanced mesh
 *     so its label can be a real `<Text>` element (instanced labels would
 *     require a different code path and aren't worth it for a single
 *     primary marker).
 *   - When the input has exactly 1 UE we render only the primary mesh —
 *     this keeps the live single-UE path visually identical to pre-P2.
 *
 * No ground plane (NTPU scene provides the ground). No SINR / handover /
 * link physics here — purely a positional marker.
 */

export interface GroundSceneUe {
  /** World-space anchor `[x, y, z]`. Y is height-above-ground. */
  readonly worldPos: readonly [number, number, number];
  readonly id?: string;
}

interface GroundSceneProps {
  readonly ues: ReadonlyArray<GroundSceneUe>;
  readonly ueMarkerMultiplier?: number;
}

const MARKER_HEIGHT = 4;
const MARKER_RADIUS = 6;
const MARKER_RADIAL_SEGMENTS = 16;
const PRIMARY_COLOR = '#ff4444';
const PRIMARY_EMISSIVE = '#ff2222';
const SECONDARY_COLOR = '#cc6644';
const SECONDARY_EMISSIVE = '#882222';

function PrimaryUeMarker({
  x,
  y,
  z,
  ueMarkerMultiplier,
}: {
  x: number;
  y: number;
  z: number;
  ueMarkerMultiplier: number;
}) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 2 * ueMarkerMultiplier, 0]}>
        <cylinderGeometry
          args={[
            MARKER_RADIUS * ueMarkerMultiplier,
            MARKER_RADIUS * ueMarkerMultiplier,
            MARKER_HEIGHT * ueMarkerMultiplier,
            MARKER_RADIAL_SEGMENTS,
          ]}
        />
        <meshStandardMaterial
          color={PRIMARY_COLOR}
          emissive={PRIMARY_EMISSIVE}
          emissiveIntensity={0.3}
        />
      </mesh>
      <Text
        position={[0, 12 * ueMarkerMultiplier, 0]}
        fontSize={12}
        color="#ff6666"
        anchorX="center"
        anchorY="middle"
        outlineWidth={1}
        outlineColor="#000000"
      >
        UE
      </Text>
    </group>
  );
}

function SecondaryUeInstances({
  positions,
  ueMarkerMultiplier,
}: {
  positions: ReadonlyArray<readonly [number, number, number]>;
  ueMarkerMultiplier: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      dummy.position.set(x, y + 2 * ueMarkerMultiplier, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = positions.length;
  }, [positions, dummy, ueMarkerMultiplier]);

  if (positions.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(positions.length, 1)]}
    >
      <cylinderGeometry
        args={[
          MARKER_RADIUS * 0.6 * ueMarkerMultiplier,
          MARKER_RADIUS * 0.6 * ueMarkerMultiplier,
          MARKER_HEIGHT * 0.7 * ueMarkerMultiplier,
          MARKER_RADIAL_SEGMENTS,
        ]}
      />
      <meshStandardMaterial
        color={SECONDARY_COLOR}
        emissive={SECONDARY_EMISSIVE}
        emissiveIntensity={0.15}
      />
    </instancedMesh>
  );
}

export function GroundScene({ ues, ueMarkerMultiplier = 1.0 }: GroundSceneProps) {
  const secondaryPositions = useMemo(
    () => ues.slice(1).map((u) => u.worldPos),
    [ues],
  );
  if (ues.length === 0) return null;
  const primary = ues[0];
  const [px, py, pz] = primary.worldPos;
  return (
    <group>
      <PrimaryUeMarker x={px} y={py} z={pz} ueMarkerMultiplier={ueMarkerMultiplier} />
      <SecondaryUeInstances positions={secondaryPositions} ueMarkerMultiplier={ueMarkerMultiplier} />
    </group>
  );
}
