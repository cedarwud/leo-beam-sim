import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { NTPU_CONFIG } from '@/config/ntpu.config';
import * as THREE from 'three';

export function NTPUScene() {
  const { scene } = useGLTF(NTPU_CONFIG.scene.modelPath);

  // 處理場景材質，與 ntn-stack 完全相同
  const processedScene = useMemo(() => {
    const clonedScene = scene.clone(true);

    clonedScene.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // 將 MeshBasicMaterial 轉換為 MeshStandardMaterial
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((mat) => {
              if (mat instanceof THREE.MeshBasicMaterial) {
                const newMat = new THREE.MeshStandardMaterial({
                  color: mat.color,
                  map: mat.map,
                });
                mat.dispose();
                return newMat;
              }
              return mat;
            });
          } else if (mesh.material instanceof THREE.MeshBasicMaterial) {
            const basicMat = mesh.material;
            mesh.material = new THREE.MeshStandardMaterial({
              color: basicMat.color,
              map: basicMat.map,
            });
            basicMat.dispose();
          }
        }
      }
    });

    return clonedScene;
  }, [scene]);

  return (
    <group position={NTPU_CONFIG.scene.position}>
      <primitive object={processedScene} scale={NTPU_CONFIG.scene.scale} />
    </group>
  );
}

// 預載入模型
useGLTF.preload(NTPU_CONFIG.scene.modelPath);
