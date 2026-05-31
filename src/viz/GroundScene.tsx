import { useLayoutEffect, useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { UeTrailHistory } from '../scene/useUeTrailHistory';
import { UeTrail } from './UeTrail';

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
  readonly markerShape?: 'cylinder' | 'sphere';
  readonly ueTrailHistory?: UeTrailHistory;
  readonly secondaryOpacity?: number;
  readonly secondaryScale?: number;
}

const MARKER_HEIGHT = 16;
const MARKER_RADIUS = 26;
const MARKER_RADIAL_SEGMENTS = 16;
const PRIMARY_COLOR = '#ff3333';
const PRIMARY_EMISSIVE = '#ff1111';
const SECONDARY_COLOR = '#00ffcc'; // cyber cyan for high contrast in dark mode
const SECONDARY_EMISSIVE = '#00aa88';

function PrimaryUeMarker({
  x,
  y,
  z,
  ueMarkerMultiplier,
  markerShape,
}: {
  x: number;
  y: number;
  z: number;
  ueMarkerMultiplier: number;
  markerShape: 'cylinder' | 'sphere';
}) {
  const markerRadius = MARKER_RADIUS * ueMarkerMultiplier;
  const markerHeight = MARKER_HEIGHT * ueMarkerMultiplier;
  const markerY = markerShape === 'sphere'
    ? markerRadius
    : markerHeight / 2;
  const labelY = markerShape === 'sphere'
    ? markerRadius * 2.2
    : 18 * ueMarkerMultiplier;

  return (
    <group position={[x, y, z]}>
      {/* 暗色半透明底盤以提高在複雜地景紋理上的視覺對比度 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0, markerRadius * 2.2, 32]} />
        <meshBasicMaterial
          color="#000000"
          opacity={0.65}
          transparent
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, markerY, 0]}>
        {markerShape === 'sphere' ? (
          <sphereGeometry args={[markerRadius, 20, 14]} />
        ) : (
          <cylinderGeometry
            args={[
              markerRadius,
              markerRadius,
              markerHeight,
              MARKER_RADIAL_SEGMENTS,
            ]}
          />
        )}
        <meshStandardMaterial
          color={PRIMARY_COLOR}
          emissive={PRIMARY_EMISSIVE}
          emissiveIntensity={2.5}
        />
      </mesh>
      <Text
        position={[0, labelY, 0]}
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
  markerShape,
  opacity,
  scale,
}: {
  positions: ReadonlyArray<readonly [number, number, number]>;
  ueMarkerMultiplier: number;
  markerShape: 'cylinder' | 'sphere';
  opacity: number;
  scale: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const markerRadius = MARKER_RADIUS * 0.45 * ueMarkerMultiplier * scale;
  const markerHeight = MARKER_HEIGHT * 0.7 * ueMarkerMultiplier * scale;

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      // 1. 主體標記的位置更新
      dummy.position.set(
        x,
        y + (markerShape === 'sphere' ? markerRadius : markerHeight / 2),
        z,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = positions.length;
  }, [positions, dummy, markerHeight, markerRadius, markerShape, ueMarkerMultiplier]);

  if (positions.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(positions.length, 1)]}
    >
      {markerShape === 'sphere' ? (
        <sphereGeometry args={[markerRadius, 14, 10]} />
      ) : (
        <cylinderGeometry
          args={[
            MARKER_RADIUS * 0.6 * ueMarkerMultiplier,
            MARKER_RADIUS * 0.6 * ueMarkerMultiplier,
            markerHeight,
            12,
          ]}
        />
      )}
      <meshStandardMaterial
        color={SECONDARY_COLOR}
        emissive={SECONDARY_EMISSIVE}
        emissiveIntensity={1.4}
        transparent
        opacity={opacity}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

export function GroundScene({
  ues,
  ueMarkerMultiplier = 1.0,
  markerShape = 'cylinder',
  ueTrailHistory,
  secondaryOpacity = 0.9,
  secondaryScale = 1,
}: GroundSceneProps) {
  const secondaryPositions = useMemo(
    () => ues.slice(1).map((u) => u.worldPos),
    [ues],
  );
  if (ues.length === 0) {
    return ueTrailHistory !== undefined ? <UeTrail history={ueTrailHistory} /> : null;
  }
  const primary = ues[0];
  const [px, py, pz] = primary.worldPos;
  return (
    <group>
      {ueTrailHistory !== undefined && <UeTrail history={ueTrailHistory} />}
      <PrimaryUeMarker
        x={px}
        y={py}
        z={pz}
        ueMarkerMultiplier={ueMarkerMultiplier}
        markerShape={markerShape}
      />
      <SecondaryUeInstances
        positions={secondaryPositions}
        ueMarkerMultiplier={ueMarkerMultiplier}
        markerShape={markerShape}
        opacity={secondaryOpacity}
        scale={secondaryScale}
      />
    </group>
  );
}
