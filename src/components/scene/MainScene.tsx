import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
import { NTPUScene } from './NTPUScene';
import { UAV } from './UAV';
import { NTPU_CONFIG } from '@/config/ntpu.config';
import { Starfield } from '../ui/Starfield';
import { ACESFilmicToneMapping } from 'three';

// 3D 場景中的載入提示
function Loader() {
  return (
    <Html center>
      <div style={{
        color: 'white',
        fontSize: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '20px 40px',
        borderRadius: '8px',
      }}>
        Loading NTPU Scene...
      </div>
    </Html>
  );
}

const SHOW_DEBUG = false; // 設為 true 可顯示調試網格

export function MainScene() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)',
        overflow: 'hidden',
      }}
    >
      <Starfield starCount={180} />

      <Canvas
        shadows
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          alpha: true,
          powerPreference: 'high-performance',
          antialias: true,
        }}
      >
        {/* 相機 */}
        <PerspectiveCamera
          makeDefault
          position={NTPU_CONFIG.camera.initialPosition}
          fov={NTPU_CONFIG.camera.fov}
          near={NTPU_CONFIG.camera.near}
          far={NTPU_CONFIG.camera.far}
        />

        {/* 軌道控制 */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={10}
          maxDistance={2000}
          maxPolarAngle={Math.PI / 2}
        />

        {/* 燈光 - 主光源位於正上方中央 */}
        <hemisphereLight args={[0xffffff, 0x444444, 1.0]} />
        <ambientLight intensity={0.2} />
        <directionalLight
          castShadow
          position={[0, 50, 0]}
          intensity={1.5}
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
          shadow-camera-near={1}
          shadow-camera-far={1000}
          shadow-camera-top={500}
          shadow-camera-bottom={-500}
          shadow-camera-left={500}
          shadow-camera-right={-500}
          shadow-bias={-0.0004}
          shadow-radius={8}
        />

        {/* 場景模型 */}
        <Suspense fallback={<Loader />}>
          <NTPUScene />
        </Suspense>

        {/* UAV 模型 */}
        <Suspense fallback={null}>
          <UAV position={[0, 10, 0]} scale={10} />
        </Suspense>

        {/* 網格輔助線（僅調試時顯示） */}
        {SHOW_DEBUG && (
          <>
            <gridHelper args={[1000, 50, '#888888', '#444444']} />
            <axesHelper args={[100]} />
          </>
        )}
      </Canvas>
    </div>
  );
}
