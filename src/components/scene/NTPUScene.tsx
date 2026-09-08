import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { NTPU_CONFIG, type NTPUSceneConfig } from '@/config/ntpu.config';
import * as THREE from 'three';

interface NTPUSceneProps {
  config?: NTPUSceneConfig;
}

export function NTPUScene({ config = NTPU_CONFIG }: NTPUSceneProps) {
  const { scene } = useGLTF(config.scene.modelPath);

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
                // Phase 3E: leave fog enabled so the campus fades with spotlight mode.
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
            // Phase 3E: default MeshStandardMaterial fog behavior is intentional.
            basicMat.dispose();
          }
        }
      }
    });

    return clonedScene;
  }, [scene]);

  return (
    <group position={config.scene.position} rotation={config.scene.rotation}>
      <primitive object={processedScene} scale={config.scene.scale} />
    </group>
  );
}

// 預載入模型 — sinr-live (the default/first lane) uses NTPU_CONFIG only;
// The larger scene is loaded on demand by its owning route; preloading only the
// default scene keeps the first paint small.
useGLTF.preload(NTPU_CONFIG.scene.modelPath);
