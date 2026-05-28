import { useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { VisibleSat } from '../types';

const ARC_COLOR = '#a855f7';
const ARC_TUBE_RADIUS = 1.6;
const ARC_TUBE_SEGMENTS = 24;
const ARC_TUBE_RADIAL_SEGMENTS = 6;
const ARC_LIFT_FACTOR = 0.35;
const ARC_DURATION_MS = 3500;
const LABEL_COLOR = '#f5e8ff';

function buildArcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = from.clone().lerp(to, 0.5);
  const distance = from.distanceTo(to);
  mid.y += distance * ARC_LIFT_FACTOR;
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}

interface ResolvedInterHandover {
  readonly key: string;
  readonly sourceSatId: string;
  readonly targetSatId: string;
  readonly sourcePos: THREE.Vector3;
  readonly targetPos: THREE.Vector3;
}

function resolveActiveInterHandover(
  sourceSatId: string | null,
  targetSatId: string | null,
  displaySats: readonly VisibleSat[],
): ResolvedInterHandover | null {
  if (!sourceSatId || !targetSatId || sourceSatId === targetSatId) return null;
  const sourceSat = displaySats.find(sat => sat.id === sourceSatId);
  const targetSat = displaySats.find(sat => sat.id === targetSatId);
  if (!sourceSat || !targetSat) return null;
  return {
    key: `${sourceSatId}->${targetSatId}`,
    sourceSatId,
    targetSatId,
    sourcePos: sourceSat.world.clone(),
    targetPos: targetSat.world.clone(),
  };
}

interface MeshProps {
  readonly snapshot: ResolvedInterHandover;
  readonly startMs: number;
  readonly reducedMotion: boolean;
}

function InterHandoverArrowMesh({ snapshot, startMs, reducedMotion }: MeshProps): JSX.Element {
  const { gl } = useThree();
  const curve = useMemo(
    () => buildArcCurve(snapshot.sourcePos, snapshot.targetPos),
    [snapshot.sourcePos, snapshot.targetPos],
  );
  const tubeGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, ARC_TUBE_SEGMENTS, ARC_TUBE_RADIUS, ARC_TUBE_RADIAL_SEGMENTS, false),
    [curve],
  );
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const labelMidpoint = useMemo(() => curve.getPoint(0.5), [curve]);

  useEffect(() => {
    return () => {
      gl.domElement.dataset.interHandoverArrowActive = '0';
      gl.domElement.dataset.interHandoverArrowOpacity = '0';
    };
  }, [gl.domElement]);

  useFrame(() => {
    const elapsed = Date.now() - startMs;
    const progress = Math.min(1, Math.max(0, elapsed / ARC_DURATION_MS));
    const fade = reducedMotion ? 0.7 : 0.85 * (1 - progress * progress);
    const opacity = Math.max(0, fade);
    if (materialRef.current) {
      materialRef.current.opacity = opacity;
    }
    gl.domElement.dataset.interHandoverArrowActive = opacity > 0.01 ? '1' : '0';
    gl.domElement.dataset.interHandoverArrowOpacity = opacity.toFixed(4);
  });

  return (
    <group renderOrder={22}>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          ref={materialRef}
          color={ARC_COLOR}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[labelMidpoint.x, labelMidpoint.y + 8, labelMidpoint.z]}
        fontSize={10}
        color={LABEL_COLOR}
        anchorX="center"
        anchorY="bottom"
      >
        {`Inter HO ${snapshot.sourceSatId} → ${snapshot.targetSatId}`}
      </Text>
    </group>
  );
}

interface Props {
  readonly recentHoSourceSatId: string | null;
  readonly recentHoTargetSatId: string | null;
  readonly displaySats: readonly VisibleSat[];
  readonly reducedMotion: boolean;
}

export function InterHandoverArrow({
  recentHoSourceSatId,
  recentHoTargetSatId,
  displaySats,
  reducedMotion,
}: Props): JSX.Element | null {
  const snapshot = useMemo(
    () => resolveActiveInterHandover(recentHoSourceSatId, recentHoTargetSatId, displaySats),
    [recentHoSourceSatId, recentHoTargetSatId, displaySats],
  );
  const activeKeyRef = useRef<string | null>(null);
  const activeStartRef = useRef<number>(0);

  if (snapshot === null) {
    activeKeyRef.current = null;
    return null;
  }

  if (snapshot.key !== activeKeyRef.current) {
    activeKeyRef.current = snapshot.key;
    activeStartRef.current = Date.now();
  }

  return (
    <InterHandoverArrowMesh
      key={snapshot.key}
      snapshot={snapshot}
      startMs={activeStartRef.current}
      reducedMotion={reducedMotion}
    />
  );
}
