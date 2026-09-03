import { Html, Line, OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';

import {
  EarthSphere,
  GLOBAL_SCENE_PALETTES,
} from '../visual-lab-g0/VisualLabGlobalScene';
import {
  act1NtpuApexWorld,
  act1NtpuCameraPosition,
  act1NtpuZenithWorld,
} from './act1NtpuGeometry';
import {
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
  cameraTelemetryIsSettled,
  type GlobalConstellationCameraTelemetry,
} from './globalConstellationCamera';
import {
  GLOBAL_CONSTELLATION_COLOURS,
  GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
  GLOBAL_CONSTELLATION_POINT_MARKER_SIZE,
  medianAltitudeGuideRadiusWorld,
  type GlobalConstellationCameraPose,
  type GlobalConstellationFocusTarget,
} from './globalConstellationDirector';
import {
  ntpuElevationGeometry,
  ntpuMarkerGeometry,
  ntpuSurfaceReticleGeometry,
  ntpuTeachingCameraPose,
  type NtpuElevationGeometry,
} from './globalConstellationGeometry';
import type { VisualLabGlobalConstellationArtifact } from '../../visualLab/globalConstellation';

type ConstellationId = 'starlink' | 'oneweb';
type DisplayedConstellation = 'none' | ConstellationId;
type PointCloudVisibility = 'none' | ConstellationId;

const GLOBAL_CONSTELLATION_LIGHT_CAPTURE_COLOURS = Object.freeze({
  starlink: '#007b70',
  oneweb: '#9a5b00',
  ntpu: '#ad264d',
  horizon: '#315b63',
  zenith: '#986000',
  arc: '#183c45',
  disc: '#75aaa3',
});

interface CameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up: readonly [number, number, number];
}

const NTPU_CAMERA_TARGET = Object.freeze(
  [...act1NtpuApexWorld()] as [number, number, number],
);
const DEFAULT_CAMERA_UP = Object.freeze([0, 1, 0] as const);
const NTPU_CAMERA_UP = Object.freeze(
  new THREE.Vector3(...act1NtpuZenithWorld()).normalize().toArray() as [number, number, number],
);

const CAMERA_POSES: Readonly<Record<GlobalConstellationCameraPose, CameraPose>> = Object.freeze({
  'earth-wide': Object.freeze({ position: [7.9, 3.9, 7.9] as const, target: [0, 0, 0] as const, up: DEFAULT_CAMERA_UP }),
  'starlink-close': Object.freeze({ position: [7.4, 3.3, 7.4] as const, target: [0, 0, 0] as const, up: DEFAULT_CAMERA_UP }),
  'compare-wide': Object.freeze({ position: [8.6, 3.3, 8.6] as const, target: [0, 0, 0] as const, up: DEFAULT_CAMERA_UP }),
  'height-oblique': Object.freeze({ position: [9.4, 6.7, 9.4] as const, target: [0, 0.08, 0] as const, up: DEFAULT_CAMERA_UP }),
  'ntpu-approach': Object.freeze({ position: act1NtpuCameraPosition(11.8, -24) as [number, number, number], target: NTPU_CAMERA_TARGET, up: NTPU_CAMERA_UP }),
  'starlink-visibility': Object.freeze({ position: act1NtpuCameraPosition(11.2, -24) as [number, number, number], target: NTPU_CAMERA_TARGET, up: NTPU_CAMERA_UP }),
  'oneweb-visibility': Object.freeze({ position: act1NtpuCameraPosition(11.6, -24) as [number, number, number], target: NTPU_CAMERA_TARGET, up: NTPU_CAMERA_UP }),
  synthesis: Object.freeze({ position: [7.5, 3.2, 7.5] as const, target: [0, 0, 0] as const, up: DEFAULT_CAMERA_UP }),
  finale: Object.freeze({ position: [7.8, 3.4, 7.8] as const, target: [0, 0, 0] as const, up: DEFAULT_CAMERA_UP }),
});

function bounded(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const t = bounded(value);
  return t * t * (3 - 2 * t);
}

function DirectorCamera({
  pose,
  cameraPose,
  reducedMotion,
  locked,
  onTelemetry,
}: {
  readonly pose: GlobalConstellationCameraPose;
  readonly cameraPose: CameraPose;
  readonly reducedMotion: boolean;
  readonly locked: boolean;
  readonly onTelemetry: (telemetry: GlobalConstellationCameraTelemetry) => void;
}): null {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(...cameraPose.target));
  const activePoseRef = useRef<GlobalConstellationCameraPose>(pose);
  const initializedPoseRef = useRef<GlobalConstellationCameraPose | null>(null);
  const lockedRef = useRef(locked);
  const settledFramesRef = useRef(0);
  const settledRef = useRef(false);
  const lastReportAtRef = useRef(0);
  lockedRef.current = locked;

  useEffect(() => {
    const next = cameraPose;
    const firstPose = initializedPoseRef.current === null;
    initializedPoseRef.current = pose;
    activePoseRef.current = pose;
    settledFramesRef.current = 0;
    settledRef.current = false;
    lastReportAtRef.current = 0;
    if (firstPose || !lockedRef.current) {
      camera.position.set(...next.position);
      camera.up.set(...next.up).normalize();
      targetRef.current.set(...next.target);
      camera.lookAt(targetRef.current);
      camera.updateProjectionMatrix();
    }
    onTelemetry({
      pose,
      settled: !lockedRef.current,
      positionErrorWorld: lockedRef.current ? Number.POSITIVE_INFINITY : 0,
      targetErrorWorld: lockedRef.current ? Number.POSITIVE_INFINITY : 0,
      settledFrames: lockedRef.current ? 0 : GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
    });
  }, [camera, cameraPose, onTelemetry, pose]);

  useFrame((_, delta) => {
    if (!lockedRef.current) return;
    const next = cameraPose;
    if (activePoseRef.current !== pose) {
      activePoseRef.current = pose;
      settledFramesRef.current = 0;
      settledRef.current = false;
    }
    const destination = new THREE.Vector3(...next.position);
    const target = new THREE.Vector3(...next.target);
    const up = new THREE.Vector3(...next.up).normalize();
    if (reducedMotion) {
      camera.position.copy(destination);
      camera.up.copy(up);
      targetRef.current.copy(target);
    } else {
      const alpha = 1 - Math.exp(-Math.max(0.01, delta) * 2.5);
      camera.position.lerp(destination, alpha);
      camera.up.lerp(up, alpha).normalize();
      targetRef.current.lerp(target, alpha);
    }
    camera.lookAt(targetRef.current);
    camera.updateProjectionMatrix();
    const positionErrorWorld = camera.position.distanceTo(destination);
    const targetErrorWorld = Math.max(targetRef.current.distanceTo(target), camera.up.distanceTo(up));
    const insideBoundary = positionErrorWorld <= GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD
      && targetErrorWorld <= GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD;
    settledFramesRef.current = insideBoundary ? settledFramesRef.current + 1 : 0;
    const settled = cameraTelemetryIsSettled(positionErrorWorld, targetErrorWorld, settledFramesRef.current);
    const now = performance.now();
    // The DOM gate only needs a fresh telemetry sample, not a React commit on
    // every render frame. Keep the long directed take light enough for headless
    // WebGL/video capture while still reporting settlement promptly.
    if (settled !== settledRef.current || now - lastReportAtRef.current >= 500) {
      settledRef.current = settled;
      lastReportAtRef.current = now;
      onTelemetry({
        pose,
        settled,
        positionErrorWorld,
        targetErrorWorld,
        settledFrames: settledFramesRef.current,
      });
    }
  });

  return null;
}

interface PointCloudProps {
  readonly artifact: VisualLabGlobalConstellationArtifact;
  readonly visibilityMask: Uint8Array;
  readonly role: 'starlink' | 'oneweb';
  readonly reveal: number;
  readonly visibility: PointCloudVisibility;
  readonly colour: string;
}

function PointCloud({ artifact, visibilityMask, role, reveal, visibility, colour }: PointCloudProps): ReactElement | null {
  const shouldRender = reveal > 0.001;
  const geometry = useMemo(() => {
    const visibleOnly = visibility !== 'none';
    const includedIndices = Array.from({ length: artifact.satelliteCount }, (_, index) => index)
      .filter(index => !visibleOnly || (visibility === role && visibilityMask[index] === 1));
    const positions = new Float32Array(includedIndices.length * 3);
    const colors = new Float32Array(includedIndices.length * 3);
    const bright = new THREE.Color(colour);
    includedIndices.forEach((sourceIndex, destinationIndex) => {
      const sourceOffset = sourceIndex * 3;
      const destinationOffset = destinationIndex * 3;
      positions[destinationOffset] = artifact.positionsWorld[sourceOffset]!;
      positions[destinationOffset + 1] = artifact.positionsWorld[sourceOffset + 1]!;
      positions[destinationOffset + 2] = artifact.positionsWorld[sourceOffset + 2]!;
      colors[destinationOffset] = bright.r;
      colors[destinationOffset + 1] = bright.g;
      colors[destinationOffset + 2] = bright.b;
    });
    return { positions, colors, renderedCount: includedIndices.length };
  }, [artifact, colour, role, visibility, visibilityMask]);

  if (!shouldRender) return null;
  return (
    <points
      key={`${role}-${artifact.snapshotSha256}`}
      name={`global-${role}-point-cloud`}
      userData={{ renderedSatelliteCount: geometry.renderedCount, visibleOnly: visibility !== 'none' }}
      frustumCulled={false}
      scale={[0.99 + smoothstep(reveal) * 0.01, 0.99 + smoothstep(reveal) * 0.01, 0.99 + smoothstep(reveal) * 0.01]}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[geometry.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={GLOBAL_CONSTELLATION_POINT_MARKER_SIZE}
        sizeAttenuation
        transparent
        opacity={0.55 + smoothstep(reveal) * 0.45}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function HeightRing({
  label,
  medianAltitudeKm,
  altitudeLabel,
  active,
  showLabel,
  colour,
  labelAngleRad,
}: {
  readonly label: string;
  readonly medianAltitudeKm: number;
  readonly altitudeLabel: string;
  readonly active: boolean;
  readonly showLabel: boolean;
  readonly colour: string;
  readonly labelAngleRad: number;
}): ReactElement {
  const radius = medianAltitudeGuideRadiusWorld(medianAltitudeKm);
  const labelPosition = useMemo(() => [
    Math.cos(labelAngleRad) * radius,
    Math.sin(labelAngleRad) * radius,
    0,
  ] as const, [labelAngleRad, radius]);
  return (
    <group name={`${label.toLowerCase()}-median-height-ring`}>
      <mesh renderOrder={2}>
        <torusGeometry args={[radius, active ? 0.014 : 0.009, 8, 256]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={active ? 0.78 : 0.34}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {showLabel ? (
        <Html center position={labelPosition} className={`global-height-label global-height-label--${label.toLowerCase()}`}>
          <span
            data-testid={`global-height-guide-${label.toLowerCase()}`}
            data-scene-anchor-label="true"
            style={{ color: colour }}
          >
            {altitudeLabel}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

function NtpuMarker({ active, colour }: { readonly active: boolean; readonly colour: string }): ReactElement {
  const marker = useMemo(() => ntpuMarkerGeometry(active), [active]);
  return (
    <group name="global-ntpu-ground-station" position={marker.anchorWorld}>
      <group scale={marker.glyphScale}>
        <mesh position={[0, 0, 0]} renderOrder={6}>
          <sphereGeometry args={[0.11, 20, 14]} />
          <meshBasicMaterial
            color={colour}
            transparent
            opacity={active ? 0.34 : 0.14}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.062, 20, 14]} />
          <meshBasicMaterial color={colour} transparent opacity={active ? 1 : 0.78} toneMapped={false} />
        </mesh>
        {active ? (
          <Html center position={marker.labelOffsetLocal} className="global-ntpu-label">
            <span data-testid="global-ntpu-label" data-scene-anchor-label="true">NTPU</span>
          </Html>
        ) : null}
      </group>
    </group>
  );
}

function ElevationGeometry({
  artifact,
  geometry,
  role,
  active,
  lightCapture,
}: {
  readonly artifact: VisualLabGlobalConstellationArtifact;
  readonly geometry: NtpuElevationGeometry | null;
  readonly role: ConstellationId;
  readonly active: boolean;
  readonly lightCapture: boolean;
}): ReactElement | null {
  const viewportWidth = useThree(state => state.size.width);
  const constructionScale = viewportWidth <= 520 ? 0.56 : 1;
  const presentation = useMemo(() => {
    if (geometry === null) return null;
    const zenith = new THREE.Vector3(...geometry.zenithWorld);
    const center = new THREE.Vector3(...geometry.centerWorld);
    const constructionPoint = (point: readonly [number, number, number], amount = 0.028) => (
      center.clone()
        .lerp(new THREE.Vector3(...point), constructionScale)
        .addScaledVector(zenith, amount * constructionScale)
    );
    const discPosition = constructionPoint(geometry.centerWorld, 0.022);
    const discQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      zenith,
    );
    const satelliteDistance = viewportWidth <= 520 ? 1.12 : 2.02;
    const angleLabelHorizonDistance = viewportWidth <= 520 ? 0.75 : 1.12;
    const diagramSatellite = center.clone()
      .addScaledVector(new THREE.Vector3(...geometry.lineOfSightDirectionWorld), satelliteDistance * constructionScale)
      .addScaledVector(zenith, 0.028 * constructionScale);
    return {
      center: constructionPoint(geometry.centerWorld),
      satellite: diagramSatellite,
      horizon: geometry.horizonSegmentWorld.map(point => constructionPoint(point)),
      zenith: geometry.zenithSegmentWorld.map(point => constructionPoint(point)),
      arc: geometry.angleArcWorld.map(point => constructionPoint(point, 0.035)),
      angleLabel: center.clone()
        .addScaledVector(new THREE.Vector3(...geometry.horizonDirectionWorld), angleLabelHorizonDistance * constructionScale)
        .addScaledVector(zenith, 0.3 * constructionScale),
      horizonLabel: constructionPoint(geometry.horizonSegmentWorld[0], 0.045),
      zenithLabel: constructionPoint(geometry.zenithSegmentWorld[1], 0.045),
      satelliteLabel: diagramSatellite.clone().addScaledVector(zenith, 0.14 * constructionScale),
      discRadius: 0.62 * constructionScale,
      satelliteRadius: 0.072 * Math.max(0.78, constructionScale),
      discPosition,
      discQuaternion,
    };
  }, [constructionScale, geometry, viewportWidth]);
  if (!active || geometry === null || presentation === null) return null;
  const colour = lightCapture
    ? GLOBAL_CONSTELLATION_LIGHT_CAPTURE_COLOURS[role]
    : GLOBAL_CONSTELLATION_COLOURS[role];
  const constructionColours = lightCapture
    ? GLOBAL_CONSTELLATION_LIGHT_CAPTURE_COLOURS
    : { horizon: '#b8fff3', zenith: '#fff0a8', arc: '#ffffff', disc: '#8adfd3' };
  const satelliteId = artifact.satelliteIds[geometry.satelliteIndex] ?? '—';
  return (
    <group name="ntpu-elevation-geometry" userData={{
      referenceSatelliteId: satelliteId,
      elevationDeg: geometry.elevationDeg,
      referenceSatelliteElevationDeg: geometry.referenceSatelliteElevationDeg,
    }}>
      <mesh position={presentation.discPosition} quaternion={presentation.discQuaternion} renderOrder={4}>
        <circleGeometry args={[presentation.discRadius, 64]} />
        <meshBasicMaterial color={constructionColours.disc} transparent opacity={lightCapture ? 0.18 : 0.1} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <Line points={presentation.horizon} color={constructionColours.horizon} lineWidth={2.2} transparent opacity={0.9} depthTest={false} renderOrder={7} />
      <Line points={presentation.zenith} color={constructionColours.zenith} lineWidth={2.2} transparent opacity={0.92} depthTest={false} renderOrder={7} />
      <Line points={[presentation.center, presentation.satellite]} color={colour} lineWidth={2.8} transparent opacity={0.94} depthTest={false} renderOrder={7} />
      <Line points={presentation.arc} color={constructionColours.arc} lineWidth={2.4} transparent opacity={0.96} depthTest={false} renderOrder={8} />
      <mesh position={presentation.satellite} renderOrder={8}>
        <sphereGeometry args={[presentation.satelliteRadius, 18, 12]} />
        <meshBasicMaterial color={colour} toneMapped={false} depthTest={false} />
      </mesh>
      <Html center position={presentation.angleLabel} className="global-elevation-label global-elevation-label--angle">
        <span data-testid="global-elevation-angle" data-elevation-deg={geometry.elevationDeg.toFixed(2)}>
          α = {geometry.elevationDeg.toFixed(0)}°
        </span>
      </Html>
      <Html center position={presentation.horizonLabel} className="global-elevation-label global-elevation-label--horizon">
        <span data-testid="global-elevation-horizon">局部地平面<br /><small>√(E²+N²)</small></span>
      </Html>
      <Html center position={presentation.zenithLabel} className="global-elevation-label global-elevation-label--zenith">
        <span data-testid="global-elevation-zenith">U · 局部向上</span>
      </Html>
      <Html center position={presentation.satelliteLabel} className="global-elevation-label global-elevation-label--satellite">
        <span data-testid="global-elevation-satellite-direction">10° 最低仰角界線<br className="global-elevation-label__detail-break" /><small>角度按門檻繪製 · 線長不按比例</small></span>
      </Html>
    </group>
  );
}

function LocalSurfaceReticle({ active, colour }: { readonly active: boolean; readonly colour: string }): ReactElement | null {
  const geometry = useMemo(() => ntpuSurfaceReticleGeometry(), []);
  if (!active) return null;
  return (
    <group name="global-ntpu-surface-reticle" position={geometry.centerWorld}>
      {geometry.segmentsWorld.map((segment, index) => (
        <Line
          key={`ntpu-reticle-${index}`}
          points={segment.map(point => new THREE.Vector3(
            point[0] - geometry.centerWorld[0],
            point[1] - geometry.centerWorld[1],
            point[2] - geometry.centerWorld[2],
          ))}
          color={colour}
          lineWidth={1.8}
          transparent
          opacity={0.8}
        />
      ))}
    </group>
  );
}

export interface GlobalConstellationSceneProps {
  readonly starlink: VisualLabGlobalConstellationArtifact;
  readonly oneweb: VisualLabGlobalConstellationArtifact;
  readonly starlinkVisibilityMask: Uint8Array;
  readonly onewebVisibilityMask: Uint8Array;
  readonly cameraPose: GlobalConstellationCameraPose;
  readonly starlinkReveal: number;
  readonly onewebReveal: number;
  readonly showHeightGuides: boolean;
  readonly showHeightLabels: boolean;
  readonly displayedConstellation: DisplayedConstellation;
  readonly visibility: PointCloudVisibility;
  readonly ntpuActive: boolean;
  readonly showElevationGeometry: boolean;
  readonly focusTarget: GlobalConstellationFocusTarget;
  readonly reducedMotion: boolean;
  readonly isPlaying: boolean;
  readonly onTogglePlayback: () => void;
  readonly onCameraTelemetry: (telemetry: GlobalConstellationCameraTelemetry) => void;
  readonly lightCapture?: boolean;
}

export function GlobalConstellationScene({
  starlink,
  oneweb,
  starlinkVisibilityMask,
  onewebVisibilityMask,
  cameraPose,
  starlinkReveal,
  onewebReveal,
  showHeightGuides,
  showHeightLabels,
  displayedConstellation,
  visibility,
  ntpuActive,
  showElevationGeometry,
  focusTarget,
  reducedMotion,
  isPlaying,
  onTogglePlayback,
  onCameraTelemetry,
  lightCapture = false,
}: GlobalConstellationSceneProps): ReactElement {
  const pointerStartRef = useRef<{ readonly pointerId: number; readonly x: number; readonly y: number } | null>(null);
  const [orbitRevision, setOrbitRevision] = useState(0);
  const activeArtifact = displayedConstellation === 'starlink'
    ? starlink
    : displayedConstellation === 'oneweb'
      ? oneweb
      : null;
  const activeVisibilityMask = displayedConstellation === 'starlink'
    ? starlinkVisibilityMask
    : displayedConstellation === 'oneweb'
      ? onewebVisibilityMask
      : null;
  const starlinkElevationGeometry = useMemo(
    () => ntpuElevationGeometry(
      starlink.positionsWorld,
      starlinkVisibilityMask,
      GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
      GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
    ),
    [starlink, starlinkVisibilityMask],
  );
  const onewebElevationGeometry = useMemo(
    () => ntpuElevationGeometry(
      oneweb.positionsWorld,
      onewebVisibilityMask,
      GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
      GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
    ),
    [oneweb, onewebVisibilityMask],
  );
  const activeElevationGeometry = displayedConstellation === 'starlink'
    ? starlinkElevationGeometry
    : displayedConstellation === 'oneweb'
      ? onewebElevationGeometry
      : null;
  const resolvedCameraPose = useMemo<CameraPose>(() => {
    const cameraGeometry = cameraPose === 'oneweb-visibility'
      ? onewebElevationGeometry
      : cameraPose === 'ntpu-approach' || cameraPose === 'starlink-visibility'
        ? starlinkElevationGeometry
        : null;
    if (cameraGeometry === null) return CAMERA_POSES[cameraPose];
    const distanceWorld = cameraPose === 'ntpu-approach'
      ? 9.8
      : cameraPose === 'oneweb-visibility'
        ? 9.6
        : 9.2;
    return ntpuTeachingCameraPose(cameraGeometry, distanceWorld, 40);
  }, [cameraPose, onewebElevationGeometry, starlinkElevationGeometry]);
  const sceneColours = lightCapture
    ? GLOBAL_CONSTELLATION_LIGHT_CAPTURE_COLOURS
    : {
      starlink: GLOBAL_CONSTELLATION_COLOURS.starlink,
      oneweb: GLOBAL_CONSTELLATION_COLOURS.oneweb,
      ntpu: GLOBAL_CONSTELLATION_COLOURS.ntpu,
    };
  return (
    <div
      className="global-constellation-stage__canvas-wrap"
      data-testid="global-constellation-canvas"
      data-rendered-constellation={displayedConstellation}
      data-orbit-enabled={isPlaying ? 'false' : 'true'}
      data-orbit-revision={String(orbitRevision)}
      role="button"
      tabIndex={0}
      aria-label={`全球星座 3D 畫面；${isPlaying ? '點擊暫停播放' : '點擊開始播放'}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        pointerStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = pointerStartRef.current;
        pointerStartRef.current = null;
        if (start === null || start.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 6) onTogglePlayback();
      }}
      onPointerCancel={() => { pointerStartRef.current = null; }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onTogglePlayback();
      }}
    >
      <Canvas
        camera={{ position: resolvedCameraPose.position, up: resolvedCameraPose.up, fov: 31, near: 0.01, far: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        frameloop="always"
      >
        <color attach="background" args={[lightCapture ? '#ffffff' : '#020a10']} />
        <ambientLight intensity={lightCapture ? 1 : 0.68} color={lightCapture ? '#ffffff' : undefined} />
        <hemisphereLight args={lightCapture ? ['#ffffff', '#dce8e5', 0.62] : ['#bfefff', '#06131c', 0.92]} />
        <directionalLight position={[4, 5, 4]} intensity={lightCapture ? 1.2 : 2.2} color={lightCapture ? '#ffffff' : '#e8fbff'} />
        {lightCapture ? null : <Stars radius={60} depth={36} count={420} factor={1.6} saturation={0.1} fade speed={reducedMotion ? 0 : 0.12} />}
        <DirectorCamera pose={cameraPose} cameraPose={resolvedCameraPose} reducedMotion={reducedMotion} locked={isPlaying} onTelemetry={onCameraTelemetry} />
        <OrbitControls
          makeDefault
          enabled={!isPlaying}
          target={resolvedCameraPose.target}
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={4.2}
          maxDistance={15}
          minPolarAngle={0.18}
          maxPolarAngle={Math.PI - 0.18}
          onChange={() => {
            if (!isPlaying) setOrbitRevision(revision => revision + 1);
          }}
        />
        <EarthSphere palette={lightCapture ? GLOBAL_SCENE_PALETTES.light : GLOBAL_SCENE_PALETTES.dark} showAtmosphere={!lightCapture} />
        {showHeightGuides ? (
          <>
            <HeightRing
              label="Starlink"
              medianAltitudeKm={starlink.medianAltitudeKm}
              altitudeLabel="Starlink · 482 km"
              active={cameraPose === 'height-oblique' || displayedConstellation === 'starlink'}
              showLabel={showHeightLabels}
              colour={sceneColours.starlink}
              labelAngleRad={Math.PI * 0.82}
            />
            <HeightRing
              label="OneWeb"
              medianAltitudeKm={oneweb.medianAltitudeKm}
              altitudeLabel="OneWeb · 1,212 km"
              active={cameraPose === 'height-oblique' || displayedConstellation === 'oneweb'}
              showLabel={showHeightLabels}
              colour={sceneColours.oneweb}
              labelAngleRad={Math.PI * 0.18}
            />
          </>
        ) : null}
        {displayedConstellation === 'starlink' ? (
          <PointCloud artifact={starlink} visibilityMask={starlinkVisibilityMask} role="starlink" reveal={starlinkReveal} visibility={visibility} colour={sceneColours.starlink} />
        ) : null}
        {displayedConstellation === 'oneweb' ? (
          <PointCloud artifact={oneweb} visibilityMask={onewebVisibilityMask} role="oneweb" reveal={onewebReveal} visibility={visibility} colour={sceneColours.oneweb} />
        ) : null}
        <NtpuMarker active={ntpuActive} colour={sceneColours.ntpu} />
        {activeArtifact === null || activeVisibilityMask === null || activeElevationGeometry === null ? null : (
          <ElevationGeometry
            artifact={activeArtifact}
            geometry={activeElevationGeometry}
            role={activeArtifact.constellation}
            active={showElevationGeometry}
            lightCapture={lightCapture}
          />
        )}
        <LocalSurfaceReticle active={focusTarget === 'ntpu-local' && cameraPose === 'finale'} colour={sceneColours.ntpu} />
      </Canvas>
    </div>
  );
}
