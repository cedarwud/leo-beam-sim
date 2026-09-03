import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Line, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import type { SimulationAnalysisFrame, SimulatorConstellation } from '../../simulator/types';
import { SATELLITE_MODEL_CATALOG } from '../../viz/satelliteModelCatalog';
import type { CanonicalExperimentKind } from './canonicalExperimentModel';

const GROUND_SCALE = 0.055;
const SATELLITE_POSITION = new THREE.Vector3(0, 6, 0.35);
const REUSE_COLORS = Object.freeze([
  '#72ead4',
  '#ffd166',
  '#ff7a90',
  '#8ebaff',
  '#b8e66b',
  '#e8a1ff',
  '#ff9e64',
]);

interface CanonicalExperimentSceneProps {
  readonly frame: SimulationAnalysisFrame | null;
  readonly kind: CanonicalExperimentKind;
  readonly revealResults: boolean;
}

function worldPosition(positionKm: readonly [number, number], y = 0.05): readonly [number, number, number] {
  return [positionKm[0] * GROUND_SCALE, y, -positionKm[1] * GROUND_SCALE];
}

function SatelliteModel({ constellation }: { readonly constellation: SimulatorConstellation }) {
  const model = SATELLITE_MODEL_CATALOG[constellation];
  const { scene } = useGLTF(model.path);
  const cloned = useMemo(() => {
    const next = SkeletonUtils.clone(scene);
    next.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || mesh.material === undefined) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clonedMaterials = materials.map(material => {
        const copy = material.clone();
        copy.transparent = false;
        copy.opacity = 1;
        copy.depthWrite = true;
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.emissive = copy.color.clone().multiplyScalar(0.18);
          copy.emissiveIntensity = 0.7;
          copy.roughness = Math.min(copy.roughness, 0.55);
        }
        return copy;
      });
      mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]!;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return next;
  }, [scene]);

  return (
    <group position={SATELLITE_POSITION}>
      <group rotation={model.rotation} scale={model.scale * 0.72}>
        <primitive object={cloned} position={model.centerOffset} />
      </group>
      <pointLight color="#dffff7" intensity={4.5} distance={8} decay={2} />
    </group>
  );
}

function SatelliteFallback() {
  return (
    <group position={SATELLITE_POSITION}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.28, 0.42]} />
        <meshStandardMaterial color="#eafbf6" metalness={0.72} roughness={0.24} />
      </mesh>
      <mesh position={[-0.8, 0, 0]}><boxGeometry args={[0.9, 0.04, 0.38]} /><meshBasicMaterial color="#5cd7ef" /></mesh>
      <mesh position={[0.8, 0, 0]}><boxGeometry args={[0.9, 0.04, 0.38]} /><meshBasicMaterial color="#5cd7ef" /></mesh>
    </group>
  );
}

function BeamVolume({
  target,
  radius,
  color,
  active,
}: {
  readonly target: readonly [number, number, number];
  readonly radius: number;
  readonly color: string;
  readonly active: boolean;
}) {
  const geometry = useMemo(() => {
    const base = new THREE.Vector3(...target);
    const direction = SATELLITE_POSITION.clone().sub(base);
    const height = direction.length();
    const midpoint = base.clone().add(SATELLITE_POSITION).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return { height, midpoint, quaternion };
  }, [target]);
  return (
    <>
      <mesh position={geometry.midpoint} quaternion={geometry.quaternion} renderOrder={1}>
        <coneGeometry args={[radius, geometry.height, 48, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.105 : 0}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[target[0], 0.035, target[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[radius * 0.965, radius, 64]} />
        <meshBasicMaterial
          color={active ? color : '#5b7772'}
          transparent
          opacity={active ? 0.95 : 0.3}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

function UserMarker({
  position,
  served,
  reveal,
  focused,
}: {
  readonly position: readonly [number, number, number];
  readonly served: boolean;
  readonly reveal: boolean;
  readonly focused: boolean;
}) {
  const color = !reveal ? '#d9ebe6' : served ? '#77f0c8' : '#ff737f';
  return (
    <group position={position}>
      <mesh position={[0, 0.025, 0]}>
        <sphereGeometry args={[focused ? 0.085 : 0.052, 14, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {focused ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.15, 0.18, 36]} />
          <meshBasicMaterial color="#fff1a6" toneMapped={false} transparent opacity={0.98} />
        </mesh>
      ) : null}
    </group>
  );
}

function SceneContent({
  frame,
  kind,
  revealResults,
}: {
  readonly frame: SimulationAnalysisFrame;
  readonly kind: CanonicalExperimentKind;
  readonly revealResults: boolean;
}) {
  const representativeUserIndex = frame.links[0]?.userIndex ?? 0;
  const radius = frame.scenario.topology.cellRadiusKm * GROUND_SCALE;
  const activeBeamCount = frame.inputs.frame.beamActiveB.filter(Boolean).length;
  const showConfiguredRings = kind === 'beam-layout';
  return (
    <>
      <color attach="background" args={['#061413']} />
      <fog attach="fog" args={['#061413', 13, 28]} />
      <ambientLight intensity={1.45} color="#d8fff4" />
      <hemisphereLight args={['#dffcf5', '#15352e', 1.5]} />
      <directionalLight position={[6, 10, 7]} intensity={2.8} color="#fff8e8" castShadow />

      <Suspense fallback={<SatelliteFallback />}>
        <SatelliteModel constellation={frame.provenance.constellation} />
      </Suspense>

      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.6, 96]} />
        <meshStandardMaterial color="#12352f" roughness={0.92} metalness={0.04} />
      </mesh>
      <gridHelper args={[10.5, 24, '#39786d', '#1e5148']} position={[0, 0.005, 0]} />

      {frame.scenario.cells.map((cell, beamIndex) => {
        const active = frame.inputs.frame.beamActiveB[beamIndex] ?? false;
        if (!showConfiguredRings && !active) return null;
        const target = worldPosition(cell.centerKm, 0.02);
        const reuseColor = REUSE_COLORS[(frame.inputs.frame.beamColorB[beamIndex] ?? 0) % REUSE_COLORS.length]!;
        return (
          <BeamVolume
            key={cell.index}
            target={target}
            radius={radius}
            color={reuseColor}
            active={active}
          />
        );
      })}

      {frame.scenario.users.map((user, userIndex) => {
        const position = worldPosition(user.positionKm, 0.065);
        const served = frame.canonical.throughput.qosMetU[userIndex] ?? false;
        return (
          <UserMarker
            key={user.userId}
            position={position}
            served={served}
            reveal={revealResults}
            focused={userIndex === representativeUserIndex}
          />
        );
      })}

      {revealResults && frame.scenario.users[representativeUserIndex] !== undefined ? (
        <Line
          points={[
            SATELLITE_POSITION,
            new THREE.Vector3(...worldPosition(frame.scenario.users[representativeUserIndex]!.positionKm, 0.09)),
          ]}
          color="#fff1a6"
          transparent
          opacity={0.78}
          lineWidth={1.25}
        />
      ) : null}

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={8.5}
        maxDistance={17}
        minPolarAngle={0.58}
        maxPolarAngle={1.2}
        target={[0, 1.25, 0]}
      />
      <group visible={false} userData={{ activeBeamCount }} />
    </>
  );
}

export function CanonicalExperimentScene({ frame, kind, revealResults }: CanonicalExperimentSceneProps) {
  const constellation = frame?.provenance.constellation ?? 'starlink';
  return (
    <div
      className="canonical-experiment__canvas"
      data-testid="canonical-experiment-scene"
      data-experiment-kind={kind}
      data-satellite-model-path={SATELLITE_MODEL_CATALOG[constellation].path}
      data-beam-footprint-shape="circle"
      data-configured-beam-count={frame?.scenario.beamLayout.beamCount ?? 0}
      data-active-beam-count={frame?.inputs.frame.beamActiveB.filter(Boolean).length ?? 0}
      data-frequency-reuse={frame?.parameters.frequencyReuse ?? 0}
      data-rendered-user-count={frame?.scenario.users.length ?? 0}
      data-ue-substrate-id={frame?.scenario.ueSubstrateId ?? ''}
      data-results-revealed={revealResults ? 'true' : 'false'}
      aria-label={frame === null
        ? '正在載入正式實驗場景'
        : `${frame.scenario.beamLayout.beamCount} 個圓形波束配置與 ${frame.scenario.users.length} 個固定 UE`}
      role="img"
    >
      {frame === null ? <div className="canonical-experiment__scene-loading">正在由封存 TLE 建立計算影格…</div> : (
        <Canvas
          camera={{ position: [8.6, 8.2, 11.6], fov: 42, near: 0.05, far: 80 }}
          dpr={[1, 1.45]}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          shadows
        >
          <SceneContent frame={frame} kind={kind} revealResults={revealResults} />
        </Canvas>
      )}
    </div>
  );
}

useGLTF.preload(SATELLITE_MODEL_CATALOG.starlink.path);
useGLTF.preload(SATELLITE_MODEL_CATALOG.oneweb.path);
