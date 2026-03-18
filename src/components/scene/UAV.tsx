import { useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { NTPU_CONFIG } from '@/config/ntpu.config';

interface UAVProps {
  position: [number, number, number];
  scale?: number;
}

export function UAV({ position, scale = 10 }: UAVProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(NTPU_CONFIG.uav.modelPath);

  // 使用 useMemo clone 場景 (使用 SkeletonUtils 處理骨骼動畫)
  const clonedScene = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);

    // 只設置陰影，不修改材質
    cloned.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return cloned;
  }, [scene]);

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <primitive object={clonedScene} />
      <pointLight
        intensity={0.3}
        distance={50}
        decay={2}
        color="#ffffff"
        position={[0, 2, 0]}
      />
    </group>
  );
}

// 預載入模型
useGLTF.preload(NTPU_CONFIG.uav.modelPath);
