import { useMemo } from 'react';
import { useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface SatelliteMarkerProps {
  position: THREE.Vector3;
  label: string;
  isServing?: boolean;
}

const SAT_MODEL_PATH = '/models/sat.glb';

export function SatelliteMarker({ position, label, isServing = false }: SatelliteMarkerProps) {
  const { scene } = useGLTF(SAT_MODEL_PATH);

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
      <primitive object={cloned} scale={isServing ? 7 : 5} />
      {isServing && (
        <pointLight color="#00ff88" intensity={1} distance={80} decay={2} />
      )}
      <Text
        position={[0, 20, 0]}
        fontSize={12}
        color={isServing ? '#00ff88' : '#aaccff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={1}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}

useGLTF.preload(SAT_MODEL_PATH);
