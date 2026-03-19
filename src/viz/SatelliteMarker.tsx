import { useMemo } from 'react';
import { useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { EventRole } from '../scene/types';

interface SatelliteMarkerProps {
  position: THREE.Vector3;
  label: string;
  eventRole?: EventRole;
}

const SAT_MODEL_PATH = '/models/sat.glb';

function roleColor(role?: EventRole): string {
  switch (role) {
    case 'serving':
      return '#18f0ff';
    case 'prepared':
      return '#ff9d1c';
    case 'post-ho':
      return '#4f8cff';
    case 'secondary':
      return '#ff5ab3';
    default:
      return '#aaccff';
  }
}

function roleScale(role?: EventRole): number {
  switch (role) {
    case 'serving':
    case 'post-ho':
      return 7;
    case 'prepared':
      return 6;
    case 'secondary':
      return 5.5;
    default:
      return 5;
  }
}

export function SatelliteMarker({ position, label, eventRole }: SatelliteMarkerProps) {
  const { scene } = useGLTF(SAT_MODEL_PATH);
  const accent = roleColor(eventRole);
  const scale = roleScale(eventRole);
  const isPrimaryEvent = eventRole === 'serving' || eventRole === 'post-ho';
  const isPrepared = eventRole === 'prepared';

  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
      }
    });
    return c;
  }, [scene]);

  return (
    <group position={position}>
      <primitive object={cloned} scale={scale} />
      {(isPrimaryEvent || isPrepared) && (
        <pointLight color={accent} intensity={isPrimaryEvent ? 1 : 0.6} distance={80} decay={2} />
      )}
      <Text
        position={[0, 20, 0]}
        fontSize={isPrimaryEvent ? 12 : 10}
        color={accent}
        anchorX="center"
        anchorY="middle"
        outlineWidth={1}
        outlineColor="#000000"
      >
        {eventRole ? `${label} (${eventRole})` : label}
      </Text>
    </group>
  );
}

useGLTF.preload(SAT_MODEL_PATH);
