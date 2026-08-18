import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import * as THREE from 'three';

import {
  SINR_LIVE_CONE_BLENDING,
  resolveSinrLiveConeRoleStyle,
  type SinrLiveConeRole,
} from '../../constants/sinrLiveConeStyle';
import {
  buildObliqueBeamConePositions,
  buildObliqueBeamConeVertexColors,
} from '../../viz/SinrLiveCellBeamCones';

export type VisualLabBeamPoint = readonly [number, number, number];

export interface VisualLabBeamConeProps {
  readonly from: VisualLabBeamPoint;
  /** Ground footprint centre. Its y coordinate owns the flat base plane. */
  readonly to: VisualLabBeamPoint;
  readonly radius: number;
  readonly role: SinrLiveConeRole;
  readonly kind?: 'intra' | 'inter';
  readonly opacity?: number;
}

function AnimatedBeamMaterial({ color, opacity }: { readonly color: string; readonly opacity: number }): ReactElement {
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const initialRef = useRef({ color: new THREE.Color(color), opacity });
  const targetColorRef = useRef(new THREE.Color(color));
  const targetOpacityRef = useRef(opacity);

  useEffect(() => {
    targetColorRef.current.set(color);
    targetOpacityRef.current = opacity;
  }, [color, opacity]);

  useFrame((_state, delta) => {
    const material = materialRef.current;
    if (material === null) return;
    const blend = 1 - Math.exp(-Math.min(.1, Math.max(0, delta)) * 6.5);
    material.color.lerp(targetColorRef.current, blend);
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacityRef.current, blend);
  });

  return <meshBasicMaterial
    ref={materialRef}
    color={initialRef.current.color}
    vertexColors
    transparent
    opacity={initialRef.current.opacity}
    blending={SINR_LIVE_CONE_BLENDING}
    depthWrite={false}
    side={THREE.DoubleSide}
    toneMapped={false}
  />;
}

/**
 * Visual-Lab adapter over the established simulator cone geometry and role
 * palette. The base vertices remain on one ground plane even for oblique links.
 */
export function VisualLabBeamCone({ from, to, radius, role, kind, opacity }: VisualLabBeamConeProps): ReactElement {
  const style = resolveSinrLiveConeRoleStyle(role, {}, { kind, opacity });
  const positions = useMemo(() => buildObliqueBeamConePositions(
    new THREE.Vector3(...from),
    new THREE.Vector3(...to),
    radius,
  ), [from[0], from[1], from[2], radius, to[0], to[1], to[2]]);
  const colors = useMemo(() => buildObliqueBeamConeVertexColors(), []);

  return <>
    <Line points={[from, to]} color={style.color} lineWidth={role === 'hero' || role === 'candidatePrimary' || role === 'pulse' ? 2.5 : 1.3} transparent opacity={Math.min(1, style.opacity + .08)} />
    <mesh renderOrder={10} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 4]} />
      </bufferGeometry>
      <AnimatedBeamMaterial color={style.color} opacity={style.opacity} />
    </mesh>
  </>;
}
