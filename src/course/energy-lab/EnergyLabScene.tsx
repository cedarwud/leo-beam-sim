import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, Stars, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import type { EnergyLabServiceState } from './energyLabDirector';
import { SATELLITE_MODEL_CATALOG } from '../../viz/satelliteModelCatalog';

const USER_POSITIONS: ReadonlyArray<readonly [number, number, number]> = [
  [-2.2, 0.06, 0.25],
  [-0.78, 0.06, -1.1],
  [0.78, 0.06, -1.1],
  [2.2, 0.06, 0.25],
];

const SATELLITE_POSITION: readonly [number, number, number] = [0, 3.5, 0];
export const ENERGY_LAB_SATELLITE_STAGE_SCALE = 0.95;
export const ENERGY_LAB_BEAM_GROUND_Y = 0;

interface EnergyLabSceneProps {
  readonly serviceState: EnergyLabServiceState;
  readonly beamVisualStrength: number;
  readonly lowSinrUserCount: number;
  readonly totalUserCount: number;
  readonly isPrediction: boolean;
}

function SceneCamera() {
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 1.55, 0), []);

  useFrame((_, delta) => {
    // A narrow viewport otherwise crops the GLB's solar arrays before the
    // ground footprint is readable. Pull the same scene back on phones while
    // retaining the desktop composition.
    const compact = size.width < 720;
    const desired = new THREE.Vector3(0, compact ? 5.25 : 4.8, compact ? 13.2 : 9.8);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const nextFov = compact ? 42 : 38;
    if (perspectiveCamera.fov !== nextFov) {
      perspectiveCamera.fov = nextFov;
      perspectiveCamera.updateProjectionMatrix();
    }
    camera.position.lerp(desired, 1 - Math.exp(-delta * 2.4));
    camera.lookAt(target);
  });

  return null;
}

function SatelliteModel() {
  const model = SATELLITE_MODEL_CATALOG.oneweb;
  const { scene } = useGLTF(model.path);
  const cloned = useMemo(() => {
    const next = SkeletonUtils.clone(scene);
    next.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return next;
  }, [scene]);

  return (
    <group position={SATELLITE_POSITION}>
      <group rotation={model.rotation} scale={model.scale * ENERGY_LAB_SATELLITE_STAGE_SCALE}>
        <primitive object={cloned} position={model.centerOffset} />
      </group>
      <pointLight color="#72ead4" intensity={1.4} distance={5} decay={2} />
    </group>
  );
}

function SatelliteFallback() {
  return (
    <group position={SATELLITE_POSITION}>
      <mesh castShadow>
        <boxGeometry args={[0.75, 0.24, 0.42]} />
        <meshStandardMaterial color="#d7e9e1" metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[-0.85, 0, 0]}>
        <boxGeometry args={[0.9, 0.03, 0.42]} />
        <meshBasicMaterial color="#4bc5e5" />
      </mesh>
      <mesh position={[0.85, 0, 0]}>
        <boxGeometry args={[0.9, 0.03, 0.42]} />
        <meshBasicMaterial color="#4bc5e5" />
      </mesh>
    </group>
  );
}

function EnergyBeam({ strength, isPrediction }: { readonly strength: number; readonly isPrediction: boolean }) {
  const opacity = isPrediction ? 0.2 : 0.1 + Math.min(0.18, strength * 0.2);
  const height = SATELLITE_POSITION[1] - ENERGY_LAB_BEAM_GROUND_Y;
  return (
    <mesh position={[0, ENERGY_LAB_BEAM_GROUND_Y + height / 2, 0]}>
      <coneGeometry args={[2.65, height, 64, 1, true]} />
      <meshBasicMaterial
        color="#72ead4"
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GroundField() {
  return (
    <group position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[3.15, 64]} />
        <meshBasicMaterial color="#0b3435" transparent opacity={0.36} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[2.25, 2.29, 64]} />
        <meshBasicMaterial color="#4bc5e5" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <ringGeometry args={[1.12, 1.15, 64]} />
        <meshBasicMaterial color="#72ead4" transparent opacity={0.36} />
      </mesh>
      <gridHelper args={[5.8, 14, '#1f6662', '#123b3d']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]} />
    </group>
  );
}

function UserMarker({
  position,
  status,
  index,
}: {
  readonly position: readonly [number, number, number];
  readonly status: 'unknown' | 'served' | 'low-sinr' | 'outage';
  readonly index: number;
}) {
  const color = status === 'served'
    ? '#72ead4'
    : status === 'low-sinr'
      ? '#ffd166'
      : status === 'outage'
        ? '#ff6b6b'
        : '#d7e9e1';
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 24]} />
        <meshBasicMaterial color={color} transparent opacity={status === 'unknown' ? 0.55 : 0.95} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.075, 16, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Line
        points={[[0, 0.02, 0], [0, 0.34, 0]]}
        color={color}
        transparent
        opacity={0.7}
        lineWidth={1.5}
      />
      <pointLight color={color} intensity={0.24} distance={1.2} decay={2} />
    </group>
  );
}

function SceneContent({
  serviceState,
  beamVisualStrength,
  lowSinrUserCount,
  totalUserCount,
  isPrediction,
}: EnergyLabSceneProps) {
  const pulse = useRef<THREE.Group>(null);
  const safeCount = Math.min(USER_POSITIONS.length, totalUserCount);

  useFrame(({ clock }) => {
    if (pulse.current) {
      pulse.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.8) * 0.025);
    }
  });

  return (
    <>
      <color attach="background" args={["#010909"]} />
      <fog attach="fog" args={["#010909", 8, 18]} />
      <ambientLight intensity={0.55} color="#d5f4ed" />
      <directionalLight position={[4, 8, 5]} intensity={1.15} color="#e9fff7" />
      <SceneCamera />
      <Stars radius={32} depth={16} count={900} factor={1.6} saturation={0.1} fade speed={0.22} />
      <group ref={pulse}>
        <Suspense fallback={<SatelliteFallback />}>
          <SatelliteModel />
        </Suspense>
        <EnergyBeam strength={beamVisualStrength} isPrediction={isPrediction} />
        <GroundField />
        {USER_POSITIONS.slice(0, safeCount).map((position, index) => {
          const status = isPrediction
            ? 'unknown'
            : index >= safeCount - Math.min(lowSinrUserCount, safeCount)
              ? serviceState === 'outage' ? 'outage' : 'low-sinr'
              : 'served';
          const linkColor = status === 'served' ? '#72ead4' : status === 'unknown' ? '#d7e9e1' : '#ff6b6b';
          return (
            <group key={index}>
              <Line
                points={[SATELLITE_POSITION, position]}
                color={linkColor}
                transparent
                opacity={status === 'unknown' ? 0.34 : 0.72}
                lineWidth={status === 'served' ? 1.3 : 1.8}
              />
              <UserMarker position={position} status={status} index={index} />
            </group>
          );
        })}
      </group>
    </>
  );
}

export function EnergyLabScene(props: EnergyLabSceneProps) {
  return (
    <div
      className="energy-lab__canvas"
      data-testid="energy-lab-scene-canvas"
      data-satellite-model-path={SATELLITE_MODEL_CATALOG.oneweb.path}
      data-satellite-stage-scale={ENERGY_LAB_SATELLITE_STAGE_SCALE}
      data-beam-ground-y={ENERGY_LAB_BEAM_GROUND_Y}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 4.8, 9.8], fov: 38, near: 0.05, far: 80 }}
        dpr={[1, 1.5]}
        frameloop="always"
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}

useGLTF.preload(SATELLITE_MODEL_CATALOG.oneweb.path);
