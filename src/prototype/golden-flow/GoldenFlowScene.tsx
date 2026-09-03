import {
  Suspense,
  createContext,
  useContext,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, Stars, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import type {
  GoldenFlowBeatId,
  GoldenFlowCameraPose,
  GoldenFlowSceneConstellation,
  GoldenFlowTruth,
} from './goldenFlowDirector';
import {
  GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG,
  GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG,
  goldenFlowBeatHasAuthoredMotionHold,
  goldenFlowMotionState,
  GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG,
} from './goldenFlowDirector';
import {
  buildConstantElevationTerminalPosition,
  buildGroundBeamGeometry,
  buildGroundClippedConePositions,
} from './goldenFlowSceneGeometry';
import type { SimulatorConstellation } from '../../simulator/types';
import { SATELLITE_MODEL_CATALOG, satelliteModelForConstellation } from '../../viz/satelliteModelCatalog';
import { buildGoldenFlowAngleLessonMetrics } from './goldenFlowAngleLesson';
import {
  buildGoldenFlowCandidateComparisonFrame,
  buildGoldenFlowHandoverDecisionFrame,
  GOLDEN_FLOW_HANDOVER_SWITCH_PROGRESS,
} from './goldenFlowHandoverLesson';

// Act 3 follows the accepted legacy side-profile carrier: the observer and
// spacecraft share a readable oblique section so the 55° teaching-elevation ray
// reads against a true horizontal reference. Act 4 uses a separate wide pair stage;
// its positions are presentation geometry for the archived event, not orbit
// coordinates.
// Pull the Act 3 terminal into the legacy carrier's central ground platform.
// This is presentation geometry: the lesson keeps the authored 55° elevation,
// while the shorter horizontal span leaves the beam, UE, and both angle rays
// readable in the same frame.
const ANGLE_TERMINAL_POSITION = new THREE.Vector3(1, 0, 0);
const ANGLE_SOURCE_HORIZONTAL_ANCHOR = new THREE.Vector3(-3, 0, 0);
const HANDOVER_TERMINAL_POSITION = new THREE.Vector3(0, 0, 0.3);
const HANDOVER_SOURCE_POSITION = new THREE.Vector3(-3.9, 4.45, 0);
const HANDOVER_TARGET_POSITION = new THREE.Vector3(3.9, 4.75, -0.15);
const HANDOVER_ALTERNATIVE_CANDIDATE_POSITIONS = Object.freeze([
  new THREE.Vector3(0.55, 5.25, -1.55),
  new THREE.Vector3(6.05, 4.3, 1.1),
]);
const UE_TRAVEL_DEG_PER_POINTER_PX = 0.075;
const GROUND_PLANE_Y = 0;

const GOLDEN_FLOW_LIGHT_CAPTURE_COLOURS = Object.freeze({
  serving: '#8b5a00',
  candidate: '#08758d',
  measurement: '#356c78',
  elevation: '#08766d',
  offAxis: '#956000',
  ground: '#d7e3e0',
  groundMajor: '#9eb8b2',
  groundMinor: '#c9d8d4',
  groundHandover: '#e8f1ef',
  groundHandoverMajor: '#9eb8b2',
  groundHandoverMinor: '#c9d8d4',
  terminal: '#ad264d',
  terminalAccent: '#08766d',
  particle: '#314e57',
});

const GoldenFlowLightCaptureContext = createContext(false);
// Match the legibility of the legacy classroom carrier while retaining the
// real constellation-specific GLB.  This is a display scale, not a physical
// spacecraft-to-Earth scale.
export const GOLDEN_FLOW_SATELLITE_STAGE_SCALE = 0.62;
export const GOLDEN_FLOW_AXIS_KEYBOARD_STEP_DEG = 0.25;
// Display-only beam styling. Act 3 follows the legacy carrier's restrained
// gold cone without letting the footprint dominate the angle construction.
// These values do not represent a physical HPBW and are never consumed by the
// canonical link-budget path.
export const GOLDEN_FLOW_ANGLE_BEAM_DISPLAY_RADIUS = 1.8;
export const GOLDEN_FLOW_ANGLE_BEAM_DISPLAY_OPACITY = 0.08;
export const GOLDEN_FLOW_HANDOVER_BEAM_DISPLAY_RADIUS = 1.5;
export const GOLDEN_FLOW_HANDOVER_BEAM_BASE_OPACITY = 0.045;
export const GOLDEN_FLOW_HANDOVER_BEAM_STRENGTH_OPACITY = 0.075;

const POSES: Record<GoldenFlowCameraPose, {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}> = {
  // Keep the approved legacy carrier's diagonal/side profile: the ground
  // plane, LOS, and spacecraft remain readable as one classroom composition.
  // These are presentation poses only; they do not alter source-backed data.
  'wide-oblique': { position: [6.2, 5, 7], target: [0, 1.65, 0] },
  // The Act 3 pair is laid out along the horizontal world axis; look from
  // +Z so the LOS, horizon, and both angle vertices do not collapse into one
  // projected line.
  'side-angle': { position: [8.2, 5.1, 8.2], target: [-0.9, 2.55, 0] },
  'top-angle': { position: [0.1, 8.6, 0.1], target: [0, 0.5, 0] },
  // The GLB assets are more legible than the original block carrier, so the
  // pair stage sits farther back to keep both spacecraft and the full ground
  // footprints inside the central frame.
  'pair-wide': { position: [5.2, 4.5, 10.8], target: [0, 2.1, 0] },
  'pair-close': { position: [5.2, 4.5, 10.8], target: [0, 2.1, 0] },
  'commit-wide': { position: [4.8, 4.4, 10.6], target: [0, 2, 0] },
  'new-normal': { position: [4.6, 4.2, 10.4], target: [0, 2, 0] },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function ease(value: number) {
  const bounded = clamp01(value);
  return bounded * bounded * (3 - 2 * bounded);
}

/**
 * All spacecraft are driven by the same course clock along one non-closing
 * local flyby. This is a readable orbital-pass cue, not propagated ECEF
 * coordinates: no sine/cosine loop is allowed to make a satellite appear to
 * orbit in place.
 */
function satelliteTransportOffset(
  motionTimeSec: number,
): THREE.Vector3 {
  const boundedTimeSec = Math.max(0, Math.min(72, Number.isFinite(motionTimeSec) ? motionTimeSec : 0));
  const pass = boundedTimeSec / 72;
  const centered = pass * 2 - 1;
  return new THREE.Vector3(
    centered * 1.65,
    0.22 * (1 - centered * centered),
    -centered * 0.9,
  );
}

function positionAtObserverElevation(
  horizontalAnchor: THREE.Vector3,
  observer: THREE.Vector3,
  elevationDeg: number,
  transportOffset: THREE.Vector3,
): THREE.Vector3 {
  const x = horizontalAnchor.x + transportOffset.x;
  const z = horizontalAnchor.z + transportOffset.z;
  const horizontalDistance = Math.hypot(x - observer.x, z - observer.z);
  return new THREE.Vector3(
    x,
    observer.y + Math.tan(THREE.MathUtils.degToRad(elevationDeg)) * horizontalDistance,
    z,
  );
}

function CameraDirector({ pose, reducedMotion, frozen }: {
  readonly pose: GoldenFlowCameraPose;
  readonly reducedMotion: boolean;
  readonly frozen: boolean;
}) {
  const { camera, size } = useThree();
  const lookAt = useRef(new THREE.Vector3(...POSES[pose].target));

  useFrame((_, delta) => {
    const next = POSES[pose];
    const targetLookAt = new THREE.Vector3(...next.target);
    const basePosition = new THREE.Vector3(...next.position);
    const isPortrait = size.width / Math.max(1, size.height) < 0.72;
    const anglePose = pose === 'wide-oblique' || pose === 'side-angle' || pose === 'top-angle';
    const portraitDistanceScale = isPortrait ? (anglePose ? 2.65 : 1.72) : 1;
    const targetPosition = targetLookAt.clone().add(
      basePosition.sub(targetLookAt).multiplyScalar(portraitDistanceScale),
    );
    if (reducedMotion || frozen) {
      camera.position.copy(targetPosition);
      lookAt.current.copy(targetLookAt);
    } else {
      const smoothing = 1 - Math.exp(-delta * 2.4);
      camera.position.lerp(targetPosition, smoothing);
      lookAt.current.lerp(targetLookAt, smoothing);
    }
    camera.lookAt(lookAt.current);
  });

  return null;
}

function cloneSatelliteAsset(source: THREE.Object3D, lightCapture: boolean): THREE.Object3D {
  const cloned = SkeletonUtils.clone(source);
  cloned.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const patchMaterial = (material: THREE.Material): THREE.Material => {
      const next = material.clone();
      // Preserve the authored GLB material. Satellite identity is expressed by
      // labels and link colours, never by repainting or changing opacity.
      next.needsUpdate = true;
      if (lightCapture && next instanceof THREE.MeshStandardMaterial) {
        next.color.lerp(new THREE.Color('#40545b'), 0.38);
        next.emissive.set('#000000');
        next.emissiveIntensity = 0;
        next.roughness = Math.max(next.roughness, 0.76);
      }
      return next;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(patchMaterial)
      : patchMaterial(mesh.material);
    mesh.castShadow = !lightCapture;
  });
  return cloned;
}

function SatelliteModel({
  constellation,
}: {
  readonly constellation: SimulatorConstellation;
}) {
  const model = satelliteModelForConstellation(constellation);
  const { scene } = useGLTF(model.path);
  const lightCapture = useContext(GoldenFlowLightCaptureContext);
  const cloned = useMemo(() => cloneSatelliteAsset(scene, lightCapture), [lightCapture, scene]);

  return (
    <group
      rotation={[model.rotation[0], model.rotation[1], model.rotation[2]]}
      scale={model.scale * GOLDEN_FLOW_SATELLITE_STAGE_SCALE * 0.85}
    >
      <primitive object={cloned} position={[model.centerOffset[0], model.centerOffset[1], model.centerOffset[2]]} />
    </group>
  );
}

function Satellite({
  position,
  label,
  role,
  constellation,
}: {
  readonly position: THREE.Vector3;
  readonly label: string;
  readonly role: 'serving' | 'candidate';
  readonly constellation: SimulatorConstellation;
}) {
  const lightCapture = useContext(GoldenFlowLightCaptureContext);
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!group.current) return;
    // Position comes exclusively from the directed transport clock. Keep the
    // GLB attitude stable so a local flyby cannot be mistaken for an object
    // circling or spinning in place.
    group.current.rotation.y = role === 'candidate' ? 0.04 : -0.04;
    group.current.position.copy(position);
  });

  return (
    <group ref={group} position={position} scale={0.92}>
      <Suspense fallback={null}>
        <SatelliteModel constellation={constellation} />
      </Suspense>
      {lightCapture ? null : <pointLight color="#ffffff" intensity={role === 'serving' ? 1.15 : 0.95} distance={4.4} decay={2} />}
      <Html center position={[role === 'serving' ? -1.05 : 1.05, 0.7, 0]} className={`golden-flow-world-label is-${role}`}>
        <span data-subject-role={`${role}-satellite`}>{label}</span>
      </Html>
    </group>
  );
}

function CandidateMarker({
  position,
  marker,
  selected,
}: {
  readonly position: THREE.Vector3;
  readonly marker: string;
  readonly selected: boolean;
}) {
  return (
    <group position={position}>
      <Html center position={[0, -0.78, 0]} className={`golden-flow-candidate-marker${selected ? ' is-selected' : ''}`}>
        <span data-candidate-marker={marker}>{marker}</span>
      </Html>
    </group>
  );
}

function CandidateMeasurementLine({
  from,
  to,
  selected,
  strength,
}: {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly selected: boolean;
  readonly strength: number;
}) {
  const lightCapture = useContext(GoldenFlowLightCaptureContext);
  const boundedStrength = clamp01(strength);
  if (boundedStrength <= 0.01) return null;
  return (
    <Line
      points={[from, to]}
      color={lightCapture ? GOLDEN_FLOW_LIGHT_CAPTURE_COLOURS.measurement : selected ? '#62e8ff' : '#5fadb9'}
      lineWidth={selected ? 2.5 : 1.55}
      dashed
      dashSize={selected ? 0.16 : 0.12}
      gapSize={selected ? 0.11 : 0.16}
      transparent
      opacity={(selected ? 0.45 : 0.2) + boundedStrength * (selected ? 0.48 : 0.35)}
    />
  );
}

function BeamCone({
  source,
  target,
  color,
  opacity,
  radius,
}: {
  readonly source: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly color: string;
  readonly opacity: number;
  readonly radius: number;
}) {
  const geometry = useMemo(() => {
    const ground = buildGroundBeamGeometry({
      source: [source.x, source.y, source.z],
      target: [target.x, target.y, target.z],
      radius,
      groundY: GROUND_PLANE_Y,
    });
    const footprintCenter = new THREE.Vector3(...ground.footprintCenter);
    const surface = new THREE.BufferGeometry();
    surface.setAttribute(
      'position',
      new THREE.BufferAttribute(buildGroundClippedConePositions(
        [source.x, source.y, source.z],
        ground,
        56,
      ), 3),
    );
    surface.computeVertexNormals();
    return { ...ground, surface, footprintCenter };
  }, [radius, source, target]);

  if (opacity <= 0.01) return null;

  return (
    <group>
      <mesh geometry={geometry.surface}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
      <group
        position={[
          geometry.footprintCenter.x,
          GROUND_PLANE_Y + 0.012,
          geometry.footprintCenter.z,
        ]}
        rotation={[0, -geometry.footprintRotationY, 0]}
      >
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[geometry.footprintMajorRadius, geometry.footprintMinorRadius, 1]}
        >
          <ringGeometry args={[0.9, 1, 56]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={Math.min(0.52, opacity * 2)}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[geometry.footprintMajorRadius, geometry.footprintMinorRadius, 1]}
        >
          <circleGeometry args={[1, 56]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={Math.min(0.12, opacity * 0.45)}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      </group>
    </group>
  );
}

function EnergyFlow({
  from,
  to,
  color,
  strength,
  reverse = false,
  paused,
  motionTimeSec,
}: {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly color: string;
  readonly strength: number;
  readonly reverse?: boolean;
  readonly paused: boolean;
  readonly motionTimeSec: number;
}) {
  const particles = useRef<Array<THREE.Mesh | null>>([]);
  const count = 12;

  useFrame(() => {
    if (paused) {
      // Keep the particles temporally frozen, but re-project them when the
      // learner drags the UE. Otherwise the link endpoint moves while the old
      // particle positions remain on the pre-drag path.
      particles.current.forEach((particle, index) => {
        if (!particle) return;
        const progress = (index + 1) / (count + 1);
        particle.position.lerpVectors(from, to, reverse ? 1 - progress : progress);
        particle.scale.setScalar(0.72 + strength * 0.08);
      });
      return;
    }
    particles.current.forEach((particle, index) => {
      if (!particle) return;
      let progress = (motionTimeSec * (0.16 + strength * 0.35) + index / count) % 1;
      if (reverse) progress = 1 - progress;
      particle.position.lerpVectors(from, to, progress);
      const pulse = 0.62 + Math.sin((progress + index / count) * Math.PI * 2) * 0.26;
      particle.scale.setScalar(pulse);
    });
  });

  if (strength <= 0.02) return null;
  return (
    <group>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index} ref={(node) => { particles.current[index] = node; }}>
          <sphereGeometry args={[0.045 + strength * 0.025, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.14 + strength * 0.78} />
        </mesh>
      ))}
    </group>
  );
}

function arcBetween(
  origin: THREE.Vector3,
  fromDirection: THREE.Vector3,
  toDirection: THREE.Vector3,
  radius: number,
  segments = 28,
): THREE.Vector3[] {
  const from = fromDirection.clone().normalize();
  const to = toDirection.clone().normalize();
  const axis = from.clone().cross(to);
  if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0);
  axis.normalize();
  const angle = from.angleTo(to);
  return Array.from({ length: segments }, (_, index) => {
    const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle * (index / (segments - 1)));
    return from.clone().applyQuaternion(quaternion).multiplyScalar(radius).add(origin);
  });
}

function AngleGeometry({
  source,
  beamTarget,
  terminal,
  mode,
}: {
  readonly source: THREE.Vector3;
  readonly beamTarget: THREE.Vector3;
  readonly terminal: THREE.Vector3;
  readonly mode: 'elevation' | 'off-axis';
}) {
  const geometry = useMemo(() => {
    const toSource = source.clone().sub(terminal);
    const horizontal = new THREE.Vector3(toSource.x, 0, toSource.z).normalize();
    const beamDirection = beamTarget.clone().sub(source).normalize();
    const ueDirection = terminal.clone().sub(source).normalize();
    return {
      elevationArc: arcBetween(terminal, horizontal, toSource, 1.3),
      offAxisArc: arcBetween(source, beamDirection, ueDirection, 2.35),
      groundDirection: horizontal,
      beamDirection,
    };
  }, [beamTarget, source, terminal]);
  const groundRayEnd = terminal.clone().add(geometry.groundDirection.clone().multiplyScalar(2.8));
  const lightCapture = useContext(GoldenFlowLightCaptureContext);
  const colours = lightCapture
    ? GOLDEN_FLOW_LIGHT_CAPTURE_COLOURS
    : { elevation: '#72ead4', offAxis: '#ffe27d' };

  return (
    <>
      {mode === 'elevation' && (
        <>
          <Line points={geometry.elevationArc} color={colours.elevation} lineWidth={6.2} transparent opacity={1} />
          <Line
            points={[terminal, groundRayEnd]}
            color={colours.elevation}
            lineWidth={2.1}
            dashed
            dashSize={0.13}
            gapSize={0.1}
            transparent
            opacity={0.84}
          />
          <Line
            points={[terminal, source]}
            color={colours.elevation}
            lineWidth={2.6}
            transparent
            opacity={0.94}
          />
          <mesh position={terminal}>
            <sphereGeometry args={[0.105, 18, 18]} />
            <meshBasicMaterial color={colours.elevation} wireframe />
          </mesh>
        </>
      )}
      {mode === 'off-axis' && (
        <>
          <Line points={geometry.offAxisArc} color={colours.offAxis} lineWidth={7} transparent opacity={1} />
          <Line
            points={[source, beamTarget]}
            color={colours.offAxis}
            lineWidth={2.8}
            transparent
            opacity={0.96}
          />
          <Line
            points={[source, terminal]}
            color={colours.elevation}
            lineWidth={2.5}
            transparent
            opacity={0.94}
          />
          <mesh position={source}>
            <sphereGeometry args={[0.13, 18, 18]} />
            <meshBasicMaterial color={colours.offAxis} wireframe />
          </mesh>
        </>
      )}
    </>
  );
}

function UeDragHandle({
  position,
  valueDeg,
  baselineOffAxisDeg,
  interactive,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyboardCommit,
}: {
  readonly position: THREE.Vector3;
  readonly valueDeg: number;
  readonly baselineOffAxisDeg: number;
  readonly interactive: boolean;
  readonly dragging: boolean;
  readonly onPointerDown: () => void;
  readonly onPointerMove: (offsetDeg: number) => void;
  readonly onPointerUp: (offsetDeg: number) => void;
  readonly onKeyboardCommit: (offsetDeg: number) => void;
}) {
  const lightCapture = useContext(GoldenFlowLightCaptureContext);
  const pointerDragging = useRef(false);
  const startX = useRef(0);
  const startValue = useRef(valueDeg);
  const currentValue = useRef(valueDeg);
  currentValue.current = valueDeg;

  const offsetFromPointer = (clientX: number) => Math.max(
    baselineOffAxisDeg,
    Math.min(
      baselineOffAxisDeg + GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG,
      startValue.current + (clientX - startX.current) * UE_TRAVEL_DEG_PER_POINTER_PX,
    ),
  );
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.stopPropagation();
    pointerDragging.current = true;
    startX.current = event.clientX;
    startValue.current = valueDeg;
    currentValue.current = valueDeg;
    event.currentTarget.setPointerCapture(event.pointerId);
    onPointerDown();
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !pointerDragging.current) return;
    event.stopPropagation();
    const next = offsetFromPointer(event.clientX);
    currentValue.current = next;
    onPointerMove(next);
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !pointerDragging.current) return;
    event.stopPropagation();
    const next = offsetFromPointer(event.clientX);
    pointerDragging.current = false;
    currentValue.current = next;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onPointerUp(next);
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    // Pointer-up and React's render can settle on adjacent frames. Read the
    // ref that pointer moves/up-to-date renders maintain instead of the
    // closure's possibly stale prop, so a focused keyboard adjustment always
    // starts from the value the learner can currently see.
    const current = currentValue.current;
    const next = event.key === 'Home'
      ? baselineOffAxisDeg
      : event.key === 'End'
        ? baselineOffAxisDeg + GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG
        : current + (event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? GOLDEN_FLOW_AXIS_KEYBOARD_STEP_DEG
          : -GOLDEN_FLOW_AXIS_KEYBOARD_STEP_DEG);
    const bounded = Math.max(baselineOffAxisDeg, Math.min(baselineOffAxisDeg + GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG, next));
    currentValue.current = bounded;
    onKeyboardCommit(bounded);
  };

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.34, 0.43, 44]} />
        <meshBasicMaterial color={dragging ? '#1e353d' : lightCapture ? GOLDEN_FLOW_LIGHT_CAPTURE_COLOURS.elevation : '#72ead4'} transparent opacity={0.86} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[-1.45, 0.78, 0.38]} className="golden-flow-ue-handle-label">
        <div
          role={interactive ? 'slider' : undefined}
          aria-label={interactive ? '拖曳地面 UE' : undefined}
          aria-valuemin={interactive ? baselineOffAxisDeg : undefined}
          aria-valuemax={interactive ? baselineOffAxisDeg + GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG : undefined}
          aria-valuenow={interactive ? valueDeg : undefined}
          data-testid="golden-flow-ue-handle"
          tabIndex={interactive ? 0 : -1}
          onPointerDown={interactive ? handlePointerDown : undefined}
          onPointerMove={interactive ? handlePointerMove : undefined}
          onPointerUp={interactive ? handlePointerUp : undefined}
          onPointerCancel={interactive ? handlePointerUp : undefined}
          onKeyDown={interactive ? handleKeyDown : undefined}
        >
          <span aria-hidden="true">{dragging ? '向右移動 →' : 'UE 向右拖 →'}</span>
          <span className="golden-flow-visually-hidden">{interactive ? '向右拖曳地面 UE' : '地面 UE'}</span>
        </div>
      </Html>
    </group>
  );
}

function BeamImpactMarker({ position, color, label }: {
  readonly position: THREE.Vector3;
  readonly color: string;
  readonly label: string;
}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.18, 0.34, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[0.42, 0.46, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.38} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0, 0.28, 0]} className="golden-flow-impact-label">
        <span>{label}</span>
      </Html>
    </group>
  );
}

function LinkSpotlight({
  position,
  intensity,
  role,
  label,
  state,
}: {
  readonly position: THREE.Vector3;
  readonly intensity: number;
  readonly role: 'source' | 'candidate';
  readonly label: string;
  readonly state: string;
}) {
  const bounded = clamp01(intensity);
  return (
    <group position={position}>
      <Html center className={`golden-flow-link-spotlight is-${role}`}>
        <div
          data-testid={`golden-flow-link-status-${role}`}
          data-link-role={role}
          data-link-intensity={bounded.toFixed(3)}
          data-link-state={state}
        >
          <span>{label}</span>
          <small>{role === 'source' ? '唯一服務鏈路' : '只量測，尚未連線'}</small>
        </div>
      </Html>
    </group>
  );
}

function ServiceSwitchPulse({ position, progress }: {
  readonly position: THREE.Vector3;
  readonly progress: number;
}) {
  const switchDistance = Math.abs(clamp01(progress) - GOLDEN_FLOW_HANDOVER_SWITCH_PROGRESS);
  const lightCapture = useContext(GoldenFlowLightCaptureContext);
  const visibility = clamp01(1 - switchDistance / 0.24);
  if (visibility <= 0.01) return null;

  return (
    <group position={position}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.035, 0]}
        scale={0.75 + visibility * 0.7}
      >
        <ringGeometry args={[0.34, 0.44, 52]} />
        <meshBasicMaterial
          color={lightCapture ? GOLDEN_FLOW_LIGHT_CAPTURE_COLOURS.terminal : '#ffffff'}
          transparent
          opacity={0.18 + visibility * 0.72}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function GroundField({
  activeTarget,
  terminal,
  mode,
  terminalLabel,
}: {
  readonly activeTarget: 'source' | 'target';
  readonly terminal: THREE.Vector3;
  readonly mode: 'angles' | 'handover';
  readonly terminalLabel: string;
}) {
  const lightCapture = useContext(GoldenFlowLightCaptureContext);
  const colours = lightCapture
    ? GOLDEN_FLOW_LIGHT_CAPTURE_COLOURS
    : { ground: '#061917', groundMajor: '#1d4b45', groundMinor: '#102b28', groundHandover: '#051917', groundHandoverMajor: '#1b5249', groundHandoverMinor: '#0d2b26', terminal: '#ffffff', terminalAccent: '#7ecfc0', serving: '#f5bf4f', candidate: '#43cbe8' };
  return (
    <group>
      {mode === 'angles' ? (
        <>
          {/* Restore the legacy circular ground carrier, but intentionally do
              not restore its hexagonal cells. */}
          <gridHelper args={[10, 20, colours.groundMajor, colours.groundMinor]} position={[0, GROUND_PLANE_Y + 0.002, 0]} />
          <mesh position={[0, GROUND_PLANE_Y - 0.08, 0]}>
            <cylinderGeometry args={[4.7, 4.7, 0.12, 72]} />
            <meshStandardMaterial color={colours.ground} metalness={0.1} roughness={0.9} />
          </mesh>
        </>
      ) : (
        <>
          <gridHelper args={[14, 28, colours.groundHandoverMajor, colours.groundHandoverMinor]} position={[0, GROUND_PLANE_Y + 0.002, 0]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_PLANE_Y - 0.018, 0]}>
            <planeGeometry args={[14, 7.8]} />
            <meshStandardMaterial color={colours.groundHandover} roughness={0.94} metalness={0.06} />
          </mesh>
        </>
      )}
      <group position={terminal}>
        <mesh position={[0, 0.16, 0]} renderOrder={20}>
          <sphereGeometry args={[0.17, 28, 28]} />
          <meshStandardMaterial color={colours.terminal} emissive={lightCapture ? '#000000' : '#f5bf4f'} emissiveIntensity={lightCapture ? 0 : 0.32} roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.065, 0]} renderOrder={20}>
          <cylinderGeometry args={[0.075, 0.11, 0.18, 24]} />
          <meshStandardMaterial color={lightCapture ? '#52666d' : '#e7f4ef'} emissive={lightCapture ? '#000000' : '#7ecfc0'} emissiveIntensity={lightCapture ? 0 : 0.18} roughness={0.55} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]} renderOrder={19}>
          <ringGeometry args={[0.22, 0.36, 48]} />
          <meshBasicMaterial color={activeTarget === 'source' ? colours.serving : colours.candidate} transparent opacity={0.82} side={THREE.DoubleSide} />
        </mesh>
        <Html center position={[0.62, 0.58, 0.24]} className="golden-flow-world-label is-ue">
          <span data-subject-role="ue">{terminalLabel}</span>
        </Html>
      </group>
    </group>
  );
}

function SceneContent({
  beat,
  beatIndex,
  progress,
  cameraPose,
  sceneConstellation,
  beamOffsetDeg,
  truth,
  reducedMotion,
  isPlaying,
  motionTimeSec,
  beamAxisDragging,
  onBeamAxisPointerDown,
  onBeamAxisPointerMove,
  onBeamAxisPointerUp,
  onBeamAxisKeyboardCommit,
}: GoldenFlowSceneProps) {
  const lightCapture = useContext(GoldenFlowLightCaptureContext);
  const targetInStory = beatIndex >= 5;
  const isForcedContinuity = truth.eventKind === 'forced-continuity';
  const handoverDecision = buildGoldenFlowHandoverDecisionFrame(beat, progress, truth);
  const decisionBeat = beat === 'candidate' || beat === 'qualification' || beat === 'ttt' || beat === 'trace';
  const authoredMotionHold = goldenFlowBeatHasAuthoredMotionHold(beat);
  const motionFrozen = goldenFlowMotionState(isPlaying, authoredMotionHold) === 'frozen';
  const sharedHandoverTrackOffset = targetInStory
    ? satelliteTransportOffset(motionTimeSec)
    : new THREE.Vector3(0, 0, 0);
  const targetPosition = HANDOVER_TARGET_POSITION.clone()
    .add(sharedHandoverTrackOffset);
  const sourceTransportOffset = sharedHandoverTrackOffset;
  const candidateComparison = buildGoldenFlowCandidateComparisonFrame(progress, truth);
  const alternativeCandidates = beat === 'candidate'
    ? candidateComparison.entries.slice(1).map((entry, index) => ({
      entry,
      position: HANDOVER_ALTERNATIVE_CANDIDATE_POSITIONS[index]!
        .clone()
        .add(sharedHandoverTrackOffset),
    }))
    : [];
  // Act 4 compares a serving link with an unconnected candidate measurement.
  // Only the active service owns a beam to the UE; candidate quality remains
  // numeric evidence until the explicit break-before-make switch.
  const angleBaselineOffAxisDeg = targetInStory
    ? 0
    : GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG;
  const sourcePosition = targetInStory
    ? HANDOVER_SOURCE_POSITION.clone().add(sourceTransportOffset)
    : positionAtObserverElevation(
      ANGLE_SOURCE_HORIZONTAL_ANCHOR,
      ANGLE_TERMINAL_POSITION,
      GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG,
      sourceTransportOffset,
    );
  const terminalPosition = targetInStory
    ? HANDOVER_TERMINAL_POSITION
    : new THREE.Vector3(...buildConstantElevationTerminalPosition({
      source: [sourcePosition.x, sourcePosition.y, sourcePosition.z],
      centeredTerminal: [ANGLE_TERMINAL_POSITION.x, ANGLE_TERMINAL_POSITION.y, ANGLE_TERMINAL_POSITION.z],
      offAxisDeg: beamOffsetDeg,
      groundY: GROUND_PLANE_Y,
    }));
  // The Act 3 beam centre never moves. The learner changes the UE ground
  // position; Act 4 points whichever satellite currently owns service at the
  // same fixed UE, while the other remains unconnected.
  const axisTarget = targetInStory
    ? terminalPosition.clone()
    : ANGLE_TERMINAL_POSITION.clone();
  const counterfactual = beat === 'interaction' || beat === 'consequence';
  const consequence = beat === 'consequence';
  const angleLinkCueStrength = counterfactual
    ? Math.max(0.12, buildGoldenFlowAngleLessonMetrics(beamOffsetDeg).relativeGainPercent / 100)
    : 1;
  const sourceStrength = targetInStory
    ? handoverDecision.servingLinkStrength
    : angleLinkCueStrength;
  const targetStrength = targetInStory
    ? handoverDecision.candidateLinkStrength
    : 0;
  const candidateMeasurementStrength = targetInStory
    ? handoverDecision.candidateMeasurementStrength
    : 0;
  const showSelectedCandidateMeasurement = targetInStory
    && handoverDecision.activeService === 'source'
    && candidateMeasurementStrength > 0.02;
  const angleGeometryMode = beat === 'angles'
    ? 'elevation' as const
    : beat === 'interaction' || beat === 'consequence' || beat === 'restore'
      ? 'off-axis' as const
      : null;
  const activeTarget = handoverDecision.activeService;
  const sourceSpotPosition = sourcePosition.clone().lerp(terminalPosition, 0.46).add(new THREE.Vector3(-0.18, 0.28, 0));
  const candidateSpotPosition = targetPosition.clone().add(new THREE.Vector3(0.18, -0.72, 0));
  const serviceSwitched = targetInStory && handoverDecision.activeService === 'target';
  const heroConstellation: SimulatorConstellation = sceneConstellation;
  const fixedAxisGround = buildGroundBeamGeometry({
    source: [sourcePosition.x, sourcePosition.y, sourcePosition.z],
    target: [axisTarget.x, axisTarget.y, axisTarget.z],
    radius: targetInStory
      ? GOLDEN_FLOW_HANDOVER_BEAM_DISPLAY_RADIUS
      : GOLDEN_FLOW_ANGLE_BEAM_DISPLAY_RADIUS,
    groundY: GROUND_PLANE_Y,
  });
  const colours = lightCapture
    ? GOLDEN_FLOW_LIGHT_CAPTURE_COLOURS
    : {
      serving: '#f5bf4f',
      candidate: '#5fe7ff',
      measurement: '#5fadb9',
      elevation: '#72ead4',
      offAxis: '#ffe27d',
      particle: '#ffe27d',
      terminal: '#ffffff',
    };
  return (
    <>
      <CameraDirector pose={cameraPose} reducedMotion={reducedMotion} frozen={motionFrozen} />
      <color attach="background" args={[lightCapture ? '#ffffff' : '#061b1b']} />
      {lightCapture ? null : <fog attach="fog" args={['#061b1b', 20, 40]} />}
      <ambientLight intensity={lightCapture ? 1 : 1.18} color={lightCapture ? '#ffffff' : undefined} />
      <directionalLight position={[4, 8, 5]} intensity={lightCapture ? 1.2 : 4.2} color={lightCapture ? '#ffffff' : '#f2fff9'} />
      {lightCapture ? null : <directionalLight position={[-5, 6, 8]} intensity={2.1} color="#b8edff" />}
      {lightCapture ? null : <pointLight position={sourcePosition} intensity={2.5 + sourceStrength * 2.5} distance={10} color="#ffffff" />}
      {targetInStory && !lightCapture && (
        <pointLight
          position={targetPosition}
          intensity={2.2 + Math.max(targetStrength, candidateMeasurementStrength * 0.55) * 2.3}
          distance={10}
          color="#ffffff"
        />
      )}
      {lightCapture ? null : <Stars radius={45} depth={18} count={700} factor={1.6} saturation={0.2} fade speed={motionFrozen ? 0 : 0.18} />}

      <GroundField
        activeTarget={activeTarget}
        terminal={terminalPosition}
        mode={targetInStory ? 'handover' : 'angles'}
        terminalLabel={consequence ? 'UE · 移動後' : 'UE'}
      />
        <Satellite
        position={sourcePosition}
        label={serviceSwitched ? '前服務' : '目前服務'}
          role="serving"
          constellation={heroConstellation}
      />
      {targetInStory && (
        <>
          <Satellite
            position={targetPosition}
            label={serviceSwitched ? '新服務' : '候選・未連線'}
            role="candidate"
            constellation={heroConstellation}
          />
          {beat === 'candidate' && <CandidateMarker position={targetPosition} marker="B1" selected />}
        </>
      )}
      {alternativeCandidates.map(({ entry, position }) => (
        <group key={entry.marker}>
          <Satellite
            position={position}
            label={`${entry.satelliteName}・候選`}
            role="candidate"
            constellation={heroConstellation}
          />
          <CandidateMarker position={position} marker={entry.marker} selected={false} />
        </group>
      ))}

      <BeamCone
        source={sourcePosition}
        target={axisTarget}
        color={colours.serving}
        opacity={targetInStory
          ? sourceStrength > 0.02
            ? GOLDEN_FLOW_HANDOVER_BEAM_BASE_OPACITY + sourceStrength * GOLDEN_FLOW_HANDOVER_BEAM_STRENGTH_OPACITY
            : 0
          : GOLDEN_FLOW_ANGLE_BEAM_DISPLAY_OPACITY}
        radius={targetInStory
          ? GOLDEN_FLOW_HANDOVER_BEAM_DISPLAY_RADIUS
          : GOLDEN_FLOW_ANGLE_BEAM_DISPLAY_RADIUS}
      />
      {targetInStory && (
          <BeamCone
          source={targetPosition}
          target={terminalPosition}
          color={colours.candidate}
          opacity={targetStrength > 0.02
            ? GOLDEN_FLOW_HANDOVER_BEAM_BASE_OPACITY + targetStrength * GOLDEN_FLOW_HANDOVER_BEAM_STRENGTH_OPACITY
            : 0}
          radius={GOLDEN_FLOW_HANDOVER_BEAM_DISPLAY_RADIUS}
        />
      )}
      {!targetInStory && (
        <Line
          points={[sourcePosition, axisTarget]}
          color={counterfactual ? colours.offAxis : colours.serving}
          lineWidth={counterfactual ? 2.2 : 1.25}
          dashed={!counterfactual}
          dashSize={0.14}
          gapSize={0.1}
          transparent
          opacity={counterfactual ? 0.95 : 0.72}
        />
      )}
      {(!targetInStory || sourceStrength > 0.02) && (
        <Line
          points={[sourcePosition, terminalPosition]}
          color={counterfactual ? colours.offAxis : colours.serving}
          lineWidth={counterfactual ? 1.1 + sourceStrength * 1.3 : 1.4 + sourceStrength * 2.4}
          transparent
          opacity={counterfactual ? 0.24 + sourceStrength * 0.5 : 0.3 + sourceStrength * 0.82}
        />
      )}
      {targetInStory && targetStrength > 0.02 && (
        <Line points={[targetPosition, terminalPosition]} color={colours.candidate} lineWidth={1.6 + targetStrength * 3.2} transparent opacity={0.24 + targetStrength * 0.76} />
      )}
      {showSelectedCandidateMeasurement && (
        <CandidateMeasurementLine
          from={targetPosition}
          to={terminalPosition}
          selected
          strength={candidateMeasurementStrength}
        />
      )}
      {alternativeCandidates.map(({ entry, position }, index) => (
        <CandidateMeasurementLine
          key={`${entry.marker}-measurement`}
          from={position}
          to={terminalPosition}
          selected={false}
          strength={index === 0 ? 0.62 : 0.4}
        />
      ))}
      <EnergyFlow
        from={sourcePosition}
        to={terminalPosition}
        color={colours.particle}
        strength={sourceStrength}
        paused={motionFrozen}
        motionTimeSec={motionTimeSec}
      />
      {targetInStory && (
        <EnergyFlow
          from={targetPosition}
          to={terminalPosition}
          color={colours.candidate}
          strength={targetStrength}
          paused={motionFrozen}
          motionTimeSec={motionTimeSec}
        />
      )}

      {decisionBeat && (
        <>
          <LinkSpotlight
            position={sourceSpotPosition}
            intensity={sourceStrength}
            role="source"
            label={isForcedContinuity
              ? '來源・已不可見'
              : beat === 'candidate' ? '來源・逐漸不利' : '來源・較弱'}
            state={beat === 'candidate' ? 'declining' : 'weaker'}
          />
          <LinkSpotlight
            position={candidateSpotPosition}
            intensity={candidateMeasurementStrength}
            role="candidate"
            label={isForcedContinuity
              ? '候選量測・未連線'
              : beat === 'ttt' ? '候選量測・優勢持續' : '候選量測・未連線'}
            state="measurement-only"
          />
        </>
      )}

      {beat === 'interaction' && (
        <UeDragHandle
          position={terminalPosition}
          valueDeg={beamOffsetDeg}
          baselineOffAxisDeg={angleBaselineOffAxisDeg}
          interactive={beat === 'interaction'}
          dragging={beamAxisDragging}
          onPointerDown={onBeamAxisPointerDown}
          onPointerMove={onBeamAxisPointerMove}
          onPointerUp={onBeamAxisPointerUp}
          onKeyboardCommit={onBeamAxisKeyboardCommit}
        />
      )}

      {consequence && (
        <BeamImpactMarker position={new THREE.Vector3(...fixedAxisGround.groundAxis)} color={colours.offAxis} label="固定波束中心" />
      )}

      {angleGeometryMode && (
        <AngleGeometry
          source={sourcePosition}
          beamTarget={axisTarget}
          terminal={terminalPosition}
          mode={angleGeometryMode}
        />
      )}
      {beat === 'commit' && (
        <ServiceSwitchPulse position={terminalPosition} progress={handoverDecision.commitProgress} />
      )}
    </>
  );
}

export interface GoldenFlowSceneProps {
  readonly beat: GoldenFlowBeatId;
  readonly beatIndex: number;
  readonly progress: number;
  readonly cameraPose: GoldenFlowCameraPose;
  readonly sceneConstellation: GoldenFlowSceneConstellation;
  readonly beamOffsetDeg: number;
  readonly truth: GoldenFlowTruth;
  readonly reducedMotion: boolean;
  readonly isPlaying: boolean;
  /** The only clock consumed by satellite/link animation. */
  readonly motionTimeSec: number;
  readonly beamAxisDragging: boolean;
  readonly onBeamAxisPointerDown: () => void;
  readonly onBeamAxisPointerMove: (offsetDeg: number) => void;
  readonly onBeamAxisPointerUp: (offsetDeg: number) => void;
  readonly onBeamAxisKeyboardCommit: (offsetDeg: number) => void;
  readonly lightCapture?: boolean;
}

export function GoldenFlowScene(props: GoldenFlowSceneProps) {
  return (
    <GoldenFlowLightCaptureContext.Provider value={props.lightCapture === true}>
      <Canvas
        camera={{ position: [...POSES['wide-oblique'].position], fov: 38, near: 0.05, far: 100 }}
        dpr={[1, 1.5]}
        frameloop="always"
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <SceneContent {...props} />
      </Canvas>
    </GoldenFlowLightCaptureContext.Provider>
  );
}

useGLTF.preload(SATELLITE_MODEL_CATALOG.starlink.path);
useGLTF.preload(SATELLITE_MODEL_CATALOG.oneweb.path);
