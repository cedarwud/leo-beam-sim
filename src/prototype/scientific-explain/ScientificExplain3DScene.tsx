import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import {
  BASELINE_THETA_DEG,
  CAMERA_POSES,
  CameraPresetName,
  FIXED_ELEVATION_DEG,
  SATELLITE_POSITION,
  ScientificExplain3DBeatId,
  UE_GROUND_POSITION,
  calculateAntennaGain,
  calculateBoresightGroundCenter,
  calculateBoresightUnitVector,
  calculateElevationDeg,
  calculateOffAxisAngleDeg,
} from './scientificExplain3DDirector';

interface SceneProps {
  readonly beat: ScientificExplain3DBeatId;
  readonly cameraPreset: CameraPresetName;
  readonly thetaDeg: number;
  readonly isSteered: boolean;
  readonly isPlaying: boolean;
  readonly reducedMotion: boolean;
  readonly onSceneSteer?: (deltaDeg: number) => void;
}

const HEX_CELL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1.0, 0.2],
  [1.0, -0.2],
  [-0.5, -0.9],
  [0.5, -0.9],
  [-0.5, 0.9],
  [0.5, 0.9],
  [1.8, 0.4],
  [2.2, 0.5], // Cell under UE
];

// Mobile framing keeps the two physical landmarks around the visual centre of
// the teaching span.  It changes only the camera pose; the world coordinates,
// beam geometry, and all scientific calculations remain untouched.
const MOBILE_FRAME_TARGET: readonly [number, number, number] = [1.1, 2.25, 0.25];
const MOBILE_CAMERA_DISTANCE_SCALE = 1.28;

function resolveCameraPose(
  preset: CameraPresetName,
  isMobile: boolean,
): {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
} {
  const base = CAMERA_POSES[preset] ?? CAMERA_POSES['wide-oblique'];
  if (!isMobile) return base;

  const [baseX, baseY, baseZ] = base.position;
  const [baseTargetX, baseTargetY, baseTargetZ] = base.target;
  return {
    position: [
      MOBILE_FRAME_TARGET[0] + (baseX - baseTargetX) * MOBILE_CAMERA_DISTANCE_SCALE,
      MOBILE_FRAME_TARGET[1] + (baseY - baseTargetY) * MOBILE_CAMERA_DISTANCE_SCALE,
      MOBILE_FRAME_TARGET[2] + (baseZ - baseTargetZ) * MOBILE_CAMERA_DISTANCE_SCALE,
    ],
    target: MOBILE_FRAME_TARGET,
    fov: base.fov,
  };
}

function CameraController({
  preset,
  reducedMotion,
}: {
  readonly preset: CameraPresetName;
  readonly reducedMotion: boolean;
}) {
  const { camera, size } = useThree();
  const isMobile = size.width <= 600;
  const config = useMemo(() => resolveCameraPose(preset, isMobile), [isMobile, preset]);
  const targetPos = useMemo(() => new THREE.Vector3(...config.position), [config.position]);
  const targetLook = useMemo(() => new THREE.Vector3(...config.target), [config.target]);
  const currentLook = useRef(new THREE.Vector3(...config.target));

  useEffect(() => {
    currentLook.current.copy(targetLook);
  }, [targetLook]);

  useFrame((_, delta) => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const nextFov = isMobile ? config.fov : 38;
      if (Math.abs(camera.fov - nextFov) > 0.01) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }

    if (reducedMotion) {
      camera.position.copy(targetPos);
      currentLook.current.copy(targetLook);
      camera.lookAt(currentLook.current);
      return;
    }

    const t = Math.min(1, delta * 3.2);
    camera.position.lerp(targetPos, t);
    currentLook.current.lerp(targetLook, t);
    camera.lookAt(currentLook.current);
  });

  return null;
}

function Satellite({ position }: { readonly position: readonly [number, number, number] }) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* Satellite Body */}
      <mesh>
        <boxGeometry args={[0.5, 0.3, 0.36]} />
        <meshStandardMaterial
          color="#f5bf4f"
          emissive="#f5bf4f"
          emissiveIntensity={0.3}
          metalness={0.65}
          roughness={0.25}
        />
      </mesh>

      {/* Solar Panel Left */}
      <mesh position={[-0.72, 0, 0]}>
        <boxGeometry args={[0.82, 0.03, 0.38]} />
        <meshStandardMaterial
          color="#0d323e"
          emissive="#43cbe8"
          emissiveIntensity={0.15}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Solar Panel Right */}
      <mesh position={[0.72, 0, 0]}>
        <boxGeometry args={[0.82, 0.03, 0.38]} />
        <meshStandardMaterial
          color="#0d323e"
          emissive="#43cbe8"
          emissiveIntensity={0.15}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Antenna Feed Horn */}
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.1, 0.16, 0.18, 24]} />
        <meshStandardMaterial
          color="#f5bf4f"
          emissive="#f5bf4f"
          emissiveIntensity={0.45}
        />
      </mesh>

      {/* Label */}
      <Html center position={[0, 0.55, 0]} className="se3d-world-label se3d-world-label--sat">
        <span data-testid="se3d-sat-label">LEO 衛星 (頂點)</span>
      </Html>

      {/* Stable DOM hook for browser proof of the actual satellite body anchor. */}
      <Html center position={[0, 0, 0]} className="se3d-landmark-hook se3d-landmark-hook--satellite">
        <span data-testid="se3d-satellite-landmark" aria-hidden="true" />
      </Html>
    </group>
  );
}

function UserEquipment({ position }: { readonly position: readonly [number, number, number] }) {
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (beaconRef.current) {
      const pulse = 1.0 + Math.sin(clock.elapsedTime * 4.0) * 0.25;
      beaconRef.current.scale.set(pulse, 1, pulse);
    }
  });

  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* UE Ground Base Marker */}
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 24]} />
        <meshStandardMaterial
          color="#0e3d36"
          emissive="#73e6d3"
          emissiveIntensity={0.4}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {/* UE Terminal Sphere */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial
          color="#fff6cc"
          emissive="#f5bf4f"
          emissiveIntensity={0.85}
        />
      </mesh>

      {/* Glowing Pulse Ring */}
      <mesh ref={beaconRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.32, 0.44, 32]} />
        <meshBasicMaterial
          color="#73e6d3"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Label */}
      <Html center position={[0.48, 0.28, 0]} className="se3d-world-label se3d-world-label--ue">
        <span data-testid="se3d-ue-label">地面用戶 (UE)</span>
      </Html>

      {/* Stable DOM hook for browser proof of the ground terminal anchor. */}
      <Html center position={[0, 0, 0]} className="se3d-landmark-hook se3d-landmark-hook--ue">
        <span data-testid="se3d-ue-landmark" aria-hidden="true" />
      </Html>
    </group>
  );
}

function SignalFlowParticles({
  start,
  end,
  gainRatio,
  reducedMotion,
}: {
  readonly start: readonly [number, number, number];
  readonly end: readonly [number, number, number];
  readonly gainRatio: number;
  readonly reducedMotion: boolean;
}) {
  const count = 10;
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const speed = 0.35 + gainRatio * 0.55;
    for (let i = 0; i < count; i += 1) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const progress = (clock.elapsedTime * speed + i / count) % 1;
      mesh.position.lerpVectors(startVec, endVec, progress);
      const pulse = 0.7 + Math.sin(progress * Math.PI) * 0.3;
      mesh.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {Array.from({ length: count }, (_, idx) => (
        <mesh
          key={idx}
          ref={(node) => { meshRefs.current[idx] = node; }}
          position={[start[0], start[1], start[2]]}
        >
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshBasicMaterial
            color="#ffe680"
            transparent
            opacity={0.25 + gainRatio * 0.65}
          />
        </mesh>
      ))}
    </group>
  );
}

function BeamConeMesh({
  satPos,
  boresightCenter,
  gainRatio,
}: {
  readonly satPos: readonly [number, number, number];
  readonly boresightCenter: readonly [number, number, number];
  readonly gainRatio: number;
}) {
  const coneMeshRef = useRef<THREE.Mesh>(null);

  const { position, rotation, height, radius } = useMemo(() => {
    const start = new THREE.Vector3(...satPos);
    const end = new THREE.Vector3(...boresightCenter);
    const dir = new THREE.Vector3().subVectors(end, start);
    const h = dir.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    const r = Math.max(0.65, Math.tan(16 * (Math.PI / 180)) * h);

    // Orientation: Three.js ConeGeometry points along +Y by default
    const orientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      dir.clone().normalize(),
    );
    const euler = new THREE.Euler().setFromQuaternion(orientation);

    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
      height: h,
      radius: r,
    };
  }, [satPos, boresightCenter]);

  return (
    <group>
      {/* 3D Cone Shell */}
      <mesh position={position} rotation={rotation} ref={coneMeshRef}>
        <coneGeometry args={[radius, height, 48, 1, true]} />
        <meshBasicMaterial
          color="#f5bf4f"
          transparent
          opacity={0.08 + gainRatio * 0.14}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Ground Footprint Ring */}
      <mesh
        position={[boresightCenter[0], 0.02, boresightCenter[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[radius * 0.9, radius, 48]} />
        <meshBasicMaterial
          color="#f5bf4f"
          transparent
          opacity={0.35 + gainRatio * 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Footprint Center Spot */}
      <mesh position={[boresightCenter[0], 0.025, boresightCenter[2]]}>
        <circleGeometry args={[0.15, 24]} />
        <meshBasicMaterial color="#ffe27d" />
      </mesh>
    </group>
  );
}

export function ScientificExplain3DScene({
  beat,
  cameraPreset,
  thetaDeg,
  isSteered,
  isPlaying,
  reducedMotion,
}: SceneProps) {
  const satPos = SATELLITE_POSITION;
  const uePos = UE_GROUND_POSITION;

  const boresightCenter = useMemo(
    () => calculateBoresightGroundCenter(thetaDeg, satPos, uePos),
    [thetaDeg, satPos, uePos],
  );

  const { gainRatio } = useMemo(() => calculateAntennaGain(thetaDeg), [thetaDeg]);

  // Elevation arc points at UE vertex
  const elevationArcPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const arcRadius = 0.85;
    const elevRad = FIXED_ELEVATION_DEG * (Math.PI / 180);
    // Ground vector from UE toward satellite horizontal projection: [-dx, 0, -dz]
    const dx = satPos[0] - uePos[0];
    const dz = satPos[2] - uePos[2];
    const hLen = Math.hypot(dx, dz);
    const hDirX = dx / hLen;
    const hDirZ = dz / hLen;

    const segments = 24;
    for (let i = 0; i <= segments; i += 1) {
      const angle = (elevRad * i) / segments;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      points.push(
        new THREE.Vector3(
          uePos[0] + hDirX * arcRadius * cosA,
          uePos[1] + arcRadius * sinA,
          uePos[2] + hDirZ * arcRadius * cosA,
        ),
      );
    }
    return points;
  }, [satPos, uePos]);

  // Off-axis arc points at Satellite vertex
  const offAxisArcPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const arcRadius = 1.1;
    const thetaRad = thetaDeg * (Math.PI / 180);

    const [bx, by, bz] = calculateBoresightUnitVector(thetaDeg, satPos, uePos);
    // LOS unit vector
    const uDx = uePos[0] - satPos[0];
    const uDy = uePos[1] - satPos[1];
    const uDz = uePos[2] - satPos[2];
    const uLen = Math.hypot(uDx, uDy, uDz);
    const [ux, uy, uz] = [uDx / uLen, uDy / uLen, uDz / uLen];

    const segments = 24;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      // Slerp between boresight unit vector and LOS unit vector
      const v = new THREE.Vector3(
        bx * (1 - t) + ux * t,
        by * (1 - t) + uy * t,
        bz * (1 - t) + uz * t,
      ).normalize().multiplyScalar(arcRadius);
      points.push(new THREE.Vector3(satPos[0] + v.x, satPos[1] + v.y, satPos[2] + v.z));
    }
    return points;
  }, [thetaDeg, satPos, uePos]);

  return (
    <Canvas
      camera={{ position: [6.2, 5.0, 7.0], fov: 38, near: 0.1, far: 50 }}
      dpr={[1, 1.5]}
      frameloop="always"
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <CameraController preset={cameraPreset} reducedMotion={reducedMotion} />
      {!isPlaying && (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          rotateSpeed={0.72}
          zoomSpeed={0.8}
          minDistance={4.5}
          maxDistance={15}
          minPolarAngle={0.2}
          maxPolarAngle={1.52}
          target={[0, 1.65, 0]}
        />
      )}

      <color attach="background" args={['#020908']} />
      <fog attach="fog" args={['#020908', 9, 20]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 9, 5]} intensity={2.2} color="#e6fff8" />
      <pointLight position={[satPos[0], satPos[1], satPos[2]]} intensity={10} distance={10} color="#f5bf4f" />

      {/* Ground Horizon Grid */}
      <gridHelper args={[12, 24, '#1b5249', '#0d2b26']} position={[0, 0, 0]} />

      {/* Ground Horizon Plate */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[5.6, 5.6, 0.1, 72]} />
        <meshStandardMaterial color="#051917" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Ground Cells */}
      {HEX_CELL_OFFSETS.map(([cx, cz], index) => (
        <mesh key={index} position={[cx, 0.01, cz]}>
          <cylinderGeometry args={[0.52, 0.52, 0.04, 6]} />
          <meshStandardMaterial
            color={index === 8 ? '#423312' : '#0a2925'}
            emissive={index === 8 ? '#f5bf4f' : '#147062'}
            emissiveIntensity={index === 8 ? 0.45 : 0.08}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* Sat & UE Entities */}
      <Satellite position={satPos} />
      <UserEquipment position={uePos} />

      {/* 3D Beam Cone */}
      <BeamConeMesh
        satPos={satPos}
        boresightCenter={boresightCenter}
        gainRatio={gainRatio}
      />

      {/* Boresight Line (Dashed Yellow) */}
      <Line
        points={[
          [satPos[0], satPos[1], satPos[2]],
          [boresightCenter[0], boresightCenter[1], boresightCenter[2]],
        ]}
        color="#ffd466"
        lineWidth={2.2}
        dashed
        dashSize={0.18}
        gapSize={0.12}
        transparent
        opacity={0.85}
      />

      {/* User Line of Sight (Solid Bright Yellow) */}
      <Line
        points={[
          [satPos[0], satPos[1], satPos[2]],
          [uePos[0], uePos[1], uePos[2]],
        ]}
        color="#ffe27d"
        lineWidth={3.2}
        transparent
        opacity={0.95}
      />

      {/* Horizontal Horizon Reference at UE */}
      <Line
        points={[
          [uePos[0], uePos[1], uePos[2]],
          [satPos[0], uePos[1], satPos[2]],
        ]}
        color="#579b8f"
        lineWidth={1.5}
        dashed
        dashSize={0.15}
        gapSize={0.1}
        transparent
        opacity={0.6}
      />

      {/* Elevation Arc at UE */}
      <Line
        points={elevationArcPoints}
        color="#73e6d3"
        lineWidth={3.5}
        transparent
        opacity={0.95}
      />
      <Html
        center
        position={[uePos[0] - 0.42, uePos[1] + 0.52, uePos[2] - 0.1]}
        className="se3d-angle-tag se3d-angle-tag--elevation"
      >
        <div data-testid="se3d-elevation-indicator">
          <strong>仰角 α {FIXED_ELEVATION_DEG.toFixed(1)}°</strong>
          <small>地面用戶頂點 (固定)</small>
        </div>
      </Html>

      {/* Off-axis Arc at Satellite */}
      <Line
        points={offAxisArcPoints}
        color="#fff1a8"
        lineWidth={3.8}
        transparent
        opacity={0.95}
      />
      <Html
        center
        position={[satPos[0] + 0.65, satPos[1] - 0.65, satPos[2] + 0.1]}
        className="se3d-angle-tag se3d-angle-tag--off-axis"
      >
        <div data-testid="se3d-off-axis-indicator">
          <strong>離軸角 θ {thetaDeg.toFixed(1)}°</strong>
          <small>衛星波束夾角 ({isSteered ? '動態轉向' : '基準夾角'})</small>
        </div>
      </Html>

      {/* Signal Particle Flow along LOS */}
      <SignalFlowParticles
        start={satPos}
        end={uePos}
        gainRatio={gainRatio}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
