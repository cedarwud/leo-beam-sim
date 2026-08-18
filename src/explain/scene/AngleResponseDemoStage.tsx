import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import {
  createScientificExploreAnchor,
  type ScientificExploreResult,
} from '../model';
import type {
  CanonicalTermKey,
  ScientificExplanationArtifactPoint,
  ScientificExplanationSceneSatellite,
} from '../model';
import type { ScientificExplanationArtifactAvailableState } from '../route/scientificExplanationArtifactLoader';
import { ArtifactOrbitInspector, ArtifactOrbitScene } from './ArtifactOrbitInspector';
import './AngleResponseDemoStage.scss';

type PairMember = 'reference' | 'probe';
type StoryId = 'angle' | 'rate' | 'handover';
type HandoverPhase = 'before' | 'decision' | 'after';
type ExperienceMode = 'guided' | 'explore';
type MetricSnapshot = Pick<ScientificExplanationArtifactPoint, 'frameId' | 'identity' | 'terms'>
  | Pick<ScientificExploreResult, 'frameId' | 'identity' | 'terms'>;

const SATELLITE_POSITION: [number, number, number] = [0, 4.35, 0];
const VISUAL_ANGLE_SCALE = 28;
const BEAM_VISUAL_ANGLE_SCALE = 18;
const LINK_HEIGHT = 4.2;
const MAX_VISUAL_HALF_BEAM_RAD = THREE.MathUtils.degToRad(38);
const MAX_VISUAL_FOOTPRINT_RADIUS = 2.62;
const CUTAWAY_CELLS: readonly [number, number, number][] = Object.freeze([
  [0, 0.04, 0],
  [-1.92, 0.04, 0.26], [1.94, 0.04, -0.2],
  [-0.98, 0.04, -1.72], [1.04, 0.04, -1.74],
  [-1.18, 0.04, 1.62], [1.2, 0.04, 1.55],
]);
const HANDOVER_CELLS: readonly [number, number, number][] = Object.freeze([
  [-1.82, 0.12, -0.82], [-0.63, 0.12, -1.46], [1.08, 0.12, -1.16],
  [-1.26, 0.12, 0.58], [0.26, 0.12, 0.22], [1.78, 0.12, 0.78], [0.58, 0.12, 1.52],
]);

interface MetricSpec {
  readonly term: CanonicalTermKey;
  readonly symbol: string;
  readonly label: string;
  readonly tone: 'sinr' | 'power' | 'rate' | 'system' | 'ee';
}

const HANDOVER_METRICS: readonly MetricSpec[] = Object.freeze([
  { term: 'sinr', symbol: 'SINR', label: '代表鏈路 SINR', tone: 'sinr' },
  { term: 'actualBeamRf', symbol: 'P̃ᴰᴸ', label: '代表波束實際 RF', tone: 'power' },
  { term: 'representativeRate', symbol: 'Rᵤ', label: '代表鏈路傳輸速率', tone: 'rate' },
  { term: 'totalRate', symbol: 'ΣRᵤ', label: '系統總吞吐量', tone: 'rate' },
  { term: 'systemPower', symbol: 'Psys', label: '模型邊界內系統功率', tone: 'system' },
  { term: 'eeInst', symbol: 'EEinst', label: '瞬時系統能效', tone: 'ee' },
]);

const ANGLE_METRICS: readonly MetricSpec[] = Object.freeze([
  { term: 'theta', symbol: 'θ', label: '離軸角', tone: 'sinr' },
  { term: 'transmitGain', symbol: 'Gᵀ', label: '發射天線增益', tone: 'sinr' },
  { term: 'rawH', symbol: 'h', label: '通道功率增益', tone: 'sinr' },
  { term: 'hDiv', symbol: 'hᵈⁱᵛ', label: '除法用通道增益', tone: 'sinr' },
  { term: 'pReqUser', symbol: 'pʳᵉᑫ', label: '代表 UE 需求功率', tone: 'power' },
  ...HANDOVER_METRICS,
]);

const RATE_METRICS: readonly MetricSpec[] = Object.freeze([
  { term: 'minimumRate', symbol: 'Rmin', label: '最低傳輸速率目標', tone: 'rate' },
  { term: 'beamLoad', symbol: 'Uᵦ', label: '波束服務使用者數', tone: 'rate' },
  { term: 'beamBandwidth', symbol: 'Bbeam', label: '每波束頻寬', tone: 'rate' },
  { term: 'gammaReq', symbol: 'γreq', label: '需求 SINR', tone: 'sinr' },
  { term: 'pReqUser', symbol: 'pʳᵉᑫ', label: '代表 UE 需求功率', tone: 'power' },
  ...HANDOVER_METRICS,
]);

const EXPLORE_METRICS: readonly MetricSpec[] = Object.freeze([
  { term: 'transmitGain', symbol: 'Gᵀ', label: '發射天線增益', tone: 'sinr' },
  { term: 'rawH', symbol: 'h', label: '通道功率增益', tone: 'sinr' },
  { term: 'pReqUser', symbol: 'pʳᵉᑫ', label: '代表 UE 需求功率', tone: 'power' },
  { term: 'actualBeamRf', symbol: 'P̃ᴰᴸ', label: '代表波束實際 RF', tone: 'power' },
  { term: 'sinr', symbol: 'SINR', label: '代表鏈路 SINR', tone: 'sinr' },
  { term: 'representativeRate', symbol: 'Rᵤ', label: '代表鏈路傳輸速率', tone: 'rate' },
  { term: 'totalRate', symbol: 'ΣRᵤ', label: '系統總吞吐量', tone: 'rate' },
  { term: 'systemPower', symbol: 'Psys', label: '模型邊界內系統功率', tone: 'system' },
  { term: 'eeInst', symbol: 'EEinst', label: '瞬時系統能效', tone: 'ee' },
]);

const EXPLORE_CAUSAL_TERMS: readonly CanonicalTermKey[] = Object.freeze([
  'theta', 'transmitGain', 'actualBeamRf', 'representativeRate', 'eeInst',
]);

const CAUSAL_TERMS: Readonly<Record<Exclude<StoryId, 'handover'>, readonly CanonicalTermKey[]>> = Object.freeze({
  angle: ['transmitGain', 'actualBeamRf', 'totalRate', 'systemPower', 'eeInst'],
  rate: ['minimumRate', 'gammaReq', 'actualBeamRf', 'totalRate', 'eeInst'],
});

const TERM_SYMBOLS: Readonly<Partial<Record<CanonicalTermKey, string>>> = Object.freeze({
  transmitGain: 'Gᵀ(θ)',
  actualBeamRf: 'P̃ᴰᴸ',
  totalRate: 'ΣRᵤ',
  systemPower: 'Psys',
  eeInst: 'EEinst',
  minimumRate: 'Rmin',
  gammaReq: 'γreq',
  theta: 'θ',
  rawH: 'h',
  hDiv: 'hᵈⁱᵛ',
  beamLoad: 'Uᵦ',
  beamBandwidth: 'Bbeam',
  pReqUser: 'pʳᵉᑫ',
  sinr: 'SINR',
  representativeRate: 'Rᵤ',
});

function readPointTerm(point: MetricSnapshot, term: CanonicalTermKey): number {
  const resolved = point.terms[term];
  return resolved.status === 'available' ? resolved.value : Number.NaN;
}

function signed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 10 ** -(digits + 1)) return '0';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;
}

function metricValue(term: CanonicalTermKey, value: number): string {
  if (!Number.isFinite(value)) return '—';
  switch (term) {
    case 'theta': return `${degrees(value).toFixed(3)}°`;
    case 'transmitGain': return `${(10 * Math.log10(value)).toFixed(2)} dBi`;
    case 'rawH':
    case 'hDiv': return `${(10 * Math.log10(Math.max(value, 1e-30))).toFixed(2)} dB`;
    case 'sinr': return `${(10 * Math.log10(value)).toFixed(2)} dB`;
    case 'pReqUser':
    case 'actualBeamRf': return value < 1 ? `${(value * 1_000).toFixed(3)} mW` : `${value.toFixed(3)} W`;
    case 'representativeRate':
    case 'minimumRate':
    case 'totalRate': return `${(value / 1_000_000).toFixed(3)} Mbit/s`;
    case 'beamBandwidth': return `${(value / 1_000_000).toFixed(1)} MHz`;
    case 'beamLoad': return `${value.toFixed(0)} users`;
    case 'systemPower': return `${value.toFixed(3)} W`;
    case 'eeInst': return `${(value / 1_000_000).toFixed(3)} Mbit/J`;
    case 'gammaReq': return value.toFixed(3);
    default: return value.toPrecision(4);
  }
}

function metricDelta(term: CanonicalTermKey, reference: number, current: number): string {
  if (!Number.isFinite(reference) || !Number.isFinite(current)) return '—';
  switch (term) {
    case 'theta': return `${signed(degrees(current - reference), 3)}°`;
    case 'sinr':
    case 'rawH':
    case 'hDiv':
    case 'transmitGain': return `${signed(10 * Math.log10(current) - 10 * Math.log10(reference), 2)} dB`;
    case 'pReqUser':
    case 'actualBeamRf': return `${signed((current - reference) * 1_000, 3)} mW`;
    case 'representativeRate':
    case 'minimumRate':
    case 'totalRate': return `${signed((current - reference) / 1_000_000, 3)} Mbit/s`;
    case 'beamBandwidth': return `${signed((current - reference) / 1_000_000, 1)} MHz`;
    case 'beamLoad': return `${signed(current - reference, 0)} users`;
    case 'systemPower': return `${signed(current - reference, 3)} W`;
    case 'eeInst': return `${signed((current - reference) / 1_000_000, 3)} Mbit/J`;
    default: return signed(current - reference, 3);
  }
}

function degrees(rad: number): number {
  return THREE.MathUtils.radToDeg(rad);
}

function distanceLabelKm(value: number): string {
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const sign = normalized > 0 ? '+' : normalized < 0 ? '−' : '';
  return `${sign}${Math.abs(normalized).toFixed(1)} km`;
}

function FixedCutawayCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(5.9, 4.7, 7.0);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 38;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, 2.0, 0);
  }, [camera]);
  useFrame(() => camera.lookAt(0, 2.0, 0));
  return null;
}

function SatelliteMarker({
  satelliteId,
  position = SATELLITE_POSITION,
  role = 'service',
  opacity = 1,
}: {
  readonly satelliteId: string;
  readonly position?: [number, number, number];
  readonly role?: 'service' | 'candidate' | 'retired';
  readonly opacity?: number;
}) {
  const primary = role === 'service' ? '#f6c85f' : role === 'candidate' ? '#58bfe0' : '#70817d';
  const label = role === 'service' ? '服務衛星' : role === 'candidate' ? '候選衛星' : '原服務衛星';
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.5, 0.28, 0.36]} />
        <meshStandardMaterial color={primary} emissive={primary} emissiveIntensity={0.36} metalness={0.55} roughness={0.28} transparent opacity={opacity} />
      </mesh>
      <mesh position={[-0.72, 0, 0]}>
        <boxGeometry args={[0.86, 0.035, 0.4]} />
        <meshStandardMaterial color="#124d58" emissive="#2bc6c2" emissiveIntensity={0.12} metalness={0.68} roughness={0.32} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0.72, 0, 0]}>
        <boxGeometry args={[0.86, 0.035, 0.4]} />
        <meshStandardMaterial color="#124d58" emissive="#2bc6c2" emissiveIntensity={0.12} metalness={0.68} roughness={0.32} transparent opacity={opacity} />
      </mesh>
      <Html center position={[0, 0.48, 0]} className={`angle-demo-world-label is-${role}`}>
        <span>{label} {satelliteId}</span>
      </Html>
    </group>
  );
}

function EnergyFlow({
  from,
  to,
  strength,
}: {
  readonly from: [number, number, number];
  readonly to: [number, number, number];
  readonly strength: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const target = group.current;
    if (target === null) return;
    target.children.forEach((child, index) => {
      const progress = (clock.elapsedTime * (0.24 + strength * 0.42) + index / target.children.length) % 1;
      child.position.set(
        THREE.MathUtils.lerp(from[0], to[0], progress),
        THREE.MathUtils.lerp(from[1], to[1], progress),
        THREE.MathUtils.lerp(from[2], to[2], progress),
      );
      child.scale.setScalar(0.65 + strength * 0.55);
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={index}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshBasicMaterial color="#fff1a8" transparent opacity={0.28 + strength * 0.58} />
        </mesh>
      ))}
    </group>
  );
}

function UeDragSurface({
  maxVisualX,
  pathLimitKm,
  onUeOffsetChange,
}: {
  readonly maxVisualX: number;
  readonly pathLimitKm: number;
  readonly onUeOffsetChange: (offsetKm: number) => void;
}) {
  const dragging = useRef(false);
  const controls = useThree(state => state.controls) as { enabled: boolean } | null;

  const updateFromPointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const normalizedX = THREE.MathUtils.clamp(event.point.x / Math.max(maxVisualX, 0.01), -1, 1);
    onUeOffsetChange(normalizedX * pathLimitKm);
  };

  return (
    <mesh
      position={[0, 0.18, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={event => {
        dragging.current = true;
        if (controls !== null) controls.enabled = false;
        const target = event.nativeEvent.target as Element | null;
        target?.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={event => {
        if (dragging.current) updateFromPointer(event);
      }}
      onPointerUp={event => {
        dragging.current = false;
        if (controls !== null) controls.enabled = true;
        const target = event.nativeEvent.target as Element | null;
        if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        if (controls !== null) controls.enabled = true;
      }}
    >
      <planeGeometry args={[Math.max(2, maxVisualX * 2.4), 2.6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function LinkCutaway({
  thetaRad,
  fullHpbwRad,
  satelliteId,
  member,
  story,
  rfPowerW,
  ueDirection = 1,
  animateEnergy = false,
  candidateSatelliteId = null,
  candidatePosition = null,
  uePathLimitKm = null,
  maxVisualUeX = null,
  onUeOffsetChange = null,
}: {
  readonly thetaRad: number;
  readonly fullHpbwRad: number;
  readonly satelliteId: string;
  readonly member: PairMember;
  readonly story: 'angle' | 'rate' | 'explore';
  readonly rfPowerW: number;
  readonly ueDirection?: -1 | 1;
  readonly animateEnergy?: boolean;
  readonly candidateSatelliteId?: string | null;
  readonly candidatePosition?: [number, number, number] | null;
  readonly uePathLimitKm?: number | null;
  readonly maxVisualUeX?: number | null;
  readonly onUeOffsetChange?: ((offsetKm: number) => void) | null;
}) {
  const visualTheta = thetaRad * VISUAL_ANGLE_SCALE;
  const visualHalfBeam = Math.min((fullHpbwRad / 2) * BEAM_VISUAL_ANGLE_SCALE, MAX_VISUAL_HALF_BEAM_RAD);
  const rawFootprintRadius = Math.tan(visualHalfBeam) * LINK_HEIGHT;
  const footprintRadius = Math.min(rawFootprintRadius, MAX_VISUAL_FOOTPRINT_RADIUS);
  const footprintCompressed = rawFootprintRadius > MAX_VISUAL_FOOTPRINT_RADIUS + 1e-6;
  const uePosition = useMemo<[number, number, number]>(() => [
    ueDirection * Math.tan(visualTheta) * LINK_HEIGHT,
    0.16,
    0,
  ], [ueDirection, visualTheta]);
  const arcPoints = useMemo(() => Array.from({ length: 24 }, (_, index) => {
    const angle = visualTheta * (index / 23);
    return new THREE.Vector3(
      ueDirection * Math.sin(angle) * 0.72,
      SATELLITE_POSITION[1] - Math.cos(angle) * 0.72,
      0.04,
    );
  }), [ueDirection, visualTheta]);

  return (
    <>
      <FixedCutawayCamera />
      <color attach="background" args={['#020b0a']} />
      <fog attach="fog" args={['#020b0a', 8, 16]} />
      <ambientLight intensity={0.76} />
      <directionalLight position={[4, 7, 4]} intensity={2.6} color="#eafff8" />
      <pointLight position={SATELLITE_POSITION} intensity={9} distance={8} color="#f6c85f" />

      <gridHelper args={[10, 20, '#1d4944', '#0d2926']} position={[0, -0.02, 0]} />
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[4.6, 4.6, 0.12, 72]} />
        <meshStandardMaterial color="#061715" roughness={0.92} />
      </mesh>

      <SatelliteMarker satelliteId={satelliteId} />
      {candidateSatelliteId !== null && candidatePosition !== null && (
        <SatelliteMarker satelliteId={candidateSatelliteId} position={candidatePosition} role="candidate" opacity={0.82} />
      )}

      {CUTAWAY_CELLS.map((position, index) => (
        <mesh key={index} position={position}>
          <cylinderGeometry args={[index === 0 ? 0.78 : 0.66, index === 0 ? 0.78 : 0.66, 0.08, 6]} />
          <meshStandardMaterial
            color={index === 0 ? '#725518' : '#103934'}
            emissive={index === 0 ? '#f6c85f' : '#1b8c7b'}
            emissiveIntensity={index === 0 ? 0.34 : 0.09}
            transparent
            opacity={index === 0 ? 0.88 : 0.7}
            roughness={0.78}
          />
        </mesh>
      ))}

      {onUeOffsetChange !== null && uePathLimitKm !== null && maxVisualUeX !== null && (
        <UeDragSurface
          maxVisualX={maxVisualUeX}
          pathLimitKm={uePathLimitKm}
          onUeOffsetChange={onUeOffsetChange}
        />
      )}

      <mesh position={[0, LINK_HEIGHT / 2, 0]}>
        <coneGeometry key={footprintRadius.toFixed(5)} args={[footprintRadius, LINK_HEIGHT, 64, 1, true]} />
        <meshBasicMaterial
          color={member === 'probe' ? '#ffd976' : '#f4bd50'}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry key={`ring-${footprintRadius.toFixed(5)}`} args={[Math.max(0.05, footprintRadius - 0.035), footprintRadius + 0.035, 72]} />
        <meshBasicMaterial color="#f6c85f" transparent opacity={0.72} side={THREE.DoubleSide} />
      </mesh>

      <Line points={[[0, 4.17, 0], [0, 0.12, 0]]} color="#c9a94f" lineWidth={1.5} dashed dashSize={0.12} gapSize={0.1} transparent opacity={0.72} />
      <Line points={[SATELLITE_POSITION, uePosition]} color="#fff0a7" lineWidth={3.1} transparent opacity={0.98} />
      {candidateSatelliteId !== null && candidatePosition !== null && (
        <Line points={[candidatePosition, uePosition]} color="#58bfe0" lineWidth={1.35} dashed dashSize={0.16} gapSize={0.12} transparent opacity={0.62} />
      )}
      {animateEnergy && <EnergyFlow from={SATELLITE_POSITION} to={uePosition} strength={0.58} />}
      <Line points={arcPoints} color="#fff4bb" lineWidth={3.4} transparent opacity={0.95} />

      <group position={uePosition}>
        <mesh>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color="#fff1aa" emissive="#f6c85f" emissiveIntensity={0.82} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.105, 0]}>
          <ringGeometry args={[0.22, 0.29, 32]} />
          <meshBasicMaterial color="#f6c85f" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
        <Html center position={[0.43, 0.08, 0]} className="angle-demo-world-label angle-demo-world-label--ue">
          <span>{onUeOffsetChange === null ? '代表 UE' : '代表 UE · 可拖曳'}</span>
        </Html>
      </group>

      <Html center position={[1.72, 2.42, 0.04]} className="angle-demo-link-readout">
        <span>實際 RF</span>
        <strong>{metricValue('actualBeamRf', rfPowerW)}</strong>
        <small>數值標示；線寬不代表功率比例</small>
      </Html>

      <Html center position={[0.52, 3.73, 0.04]} className="angle-demo-theta-label">
        <strong>θ = {degrees(thetaRad).toFixed(3)}°</strong>
        <small>{story === 'explore'
          ? `實際角度 · 場景放大 ×${VISUAL_ANGLE_SCALE}`
          : story === 'angle'
            ? `角度比例等比放大 ×${VISUAL_ANGLE_SCALE}`
            : '幾何保持固定'}</small>
      </Html>
      {footprintCompressed && (
        <Html center position={[0, 0.24, -2.3]} className="angle-demo-visual-boundary">
          <span>視覺波束邊界已壓縮</span>
          <small>真實 HPBW {degrees(fullHpbwRad).toFixed(2)}°</small>
        </Html>
      )}
    </>
  );
}

function normalizedTopocentricPosition(
  satellite: ScientificExplanationSceneSatellite,
  ground: { readonly x: number; readonly y: number; readonly z: number },
): [number, number, number] {
  const groundVector = new THREE.Vector3(ground.x, ground.y, ground.z);
  const up = groundVector.clone().normalize();
  const referenceAxis = Math.abs(up.z) > 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const east = referenceAxis.clone().cross(up).normalize();
  const north = up.clone().cross(east).normalize();
  const relative = new THREE.Vector3(
    satellite.positionTemeKm.x - ground.x,
    satellite.positionTemeKm.y - ground.y,
    satellite.positionTemeKm.z - ground.z,
  );
  const range = Math.max(1, relative.length());
  const elevationSin = THREE.MathUtils.clamp(relative.dot(up) / range, -1, 1);
  const elevation = Math.asin(elevationSin);
  const azimuth = Math.atan2(relative.dot(east), relative.dot(north));
  const radius = 2.7 * Math.max(0.25, Math.cos(Math.max(0, elevation)));
  return [
    Math.sin(azimuth) * radius,
    0.62 + Math.max(0, Math.sin(elevation)) * 3.8,
    Math.cos(azimuth) * radius,
  ];
}

function BeamConeBetween({ from, to, color, opacity }: {
  readonly from: [number, number, number];
  readonly to: [number, number, number];
  readonly color: string;
  readonly opacity: number;
}) {
  const transform = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = start.clone().sub(end);
    const length = direction.length();
    return {
      midpoint: start.clone().add(end).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
      length,
    };
  }, [from, to]);
  return (
    <mesh position={transform.midpoint} quaternion={transform.quaternion}>
      <coneGeometry args={[0.28, transform.length, 28, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function HandoverCutaway({
  point,
  phase,
  fromSatelliteId,
  toSatelliteId,
  eventLabel,
}: {
  readonly point: ScientificExplanationArtifactPoint;
  readonly phase: HandoverPhase;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly eventLabel: string;
}) {
  const fromSatellite = point.scene.satellites.find(satellite => satellite.satelliteId === fromSatelliteId);
  const toSatellite = point.scene.satellites.find(satellite => satellite.satelliteId === toSatelliteId);
  const fromPosition = fromSatellite === undefined
    ? [-2.4, 0.65, 0] as [number, number, number]
    : normalizedTopocentricPosition(fromSatellite, point.scene.groundPositionTemeKm);
  const toPosition = toSatellite === undefined
    ? [2.2, 3.4, 0] as [number, number, number]
    : normalizedTopocentricPosition(toSatellite, point.scene.groundPositionTemeKm);
  const servicePosition = phase === 'before' ? fromPosition : toPosition;
  const serviceId = phase === 'before' ? fromSatelliteId : toSatelliteId;
  const otherPosition = phase === 'before' ? toPosition : fromPosition;
  const otherId = phase === 'before' ? toSatelliteId : fromSatelliteId;

  return (
    <>
      <FixedCutawayCamera />
      <color attach="background" args={['#020b0a']} />
      <fog attach="fog" args={['#020b0a', 8, 16]} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[4, 7, 4]} intensity={2.4} color="#eafff8" />
      <pointLight position={servicePosition} intensity={10} distance={9} color="#f6c85f" />
      <gridHelper args={[10, 20, '#1d4944', '#0d2926']} position={[0, -0.02, 0]} />
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[4.6, 4.6, 0.12, 72]} />
        <meshStandardMaterial color="#061715" roughness={0.92} />
      </mesh>

      {HANDOVER_CELLS.map((cell, index) => (
        <group key={index} position={cell}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.28, 32]} />
            <meshBasicMaterial color="#29685f" transparent opacity={0.58} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <ringGeometry args={[0.27, 0.31, 32]} />
            <meshBasicMaterial color="#6be2cf" transparent opacity={0.62} side={THREE.DoubleSide} />
          </mesh>
          <BeamConeBetween from={servicePosition} to={cell} color="#f6c85f" opacity={0.12} />
        </group>
      ))}

      <SatelliteMarker satelliteId={serviceId} position={servicePosition} role="service" />
      <SatelliteMarker satelliteId={otherId} position={otherPosition} role={phase === 'before' ? 'candidate' : 'retired'} opacity={phase === 'before' ? 0.86 : 0.38} />
      {phase === 'before' && (
        <Line points={[toPosition, [0.2, 0.15, 0.22]]} color="#58bfe0" lineWidth={2} dashed dashSize={0.15} gapSize={0.12} transparent opacity={0.7} />
      )}
      <Html center position={[0, 0.42, 2.05]} className="angle-demo-handover-label">
        <strong>{phase === 'before'
          ? `服務仍在 ${fromSatelliteId}`
          : phase === 'decision'
            ? `${eventLabel}，改由 ${toSatelliteId} 服務`
            : `${toSatelliteId} 持續服務`}</strong>
        <small>TLE 視線方向 · 距離正規化</small>
      </Html>
    </>
  );
}

function MetricCard({
  spec,
  current,
  baseline,
  comparisonLabel,
}: {
  readonly spec: MetricSpec;
  readonly current: MetricSnapshot;
  readonly baseline: MetricSnapshot | null;
  readonly comparisonLabel: string;
}) {
  const currentValue = readPointTerm(current, spec.term);
  const baselineValue = baseline === null ? Number.NaN : readPointTerm(baseline, spec.term);
  const changed = baseline !== null && current.frameId !== baseline.frameId && currentValue !== baselineValue;
  const comparison = baseline === null
    ? comparisonLabel
    : current.frameId === baseline.frameId
      ? null
      : metricDelta(spec.term, baselineValue, currentValue);
  return (
    <div className={`angle-demo-metric angle-demo-metric--${spec.tone}${changed ? ' is-changed' : ''}`}>
      <span className="angle-demo-metric__symbol">{spec.symbol}</span>
      <div>
        <small>{spec.label}</small>
        <strong>{metricValue(spec.term, currentValue)}</strong>
      </div>
      {comparison !== null && <em>{comparison}</em>}
    </div>
  );
}

function metricScopeLabel(term: CanonicalTermKey, point: MetricSnapshot): string {
  if (term === 'sinr' || term === 'representativeRate') return point.identity.userId;
  if (term === 'actualBeamRf') return `beam ${point.identity.beamId}`;
  return '系統';
}

function FixedFacts({ rows }: { readonly rows: readonly { readonly label: string; readonly value: string }[] }) {
  return (
    <div className="angle-demo__fixed">
      <span>目前觀察條件</span>
      <dl>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    </div>
  );
}

export function AngleResponseDemoStage({
  state,
  onBack,
}: {
  readonly state: ScientificExplanationArtifactAvailableState;
  readonly onBack: () => void;
}) {
  const stories = state.artifact.stories;
  const anglePair = stories.angleResponse;
  const ratePair = stories.serviceTargetStress;
  const handover = stories.servingChange;
  const exploreAnchor = useMemo(
    () => createScientificExploreAnchor(anglePair.reference),
    [anglePair.reference],
  );
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('explore');
  const [story, setStory] = useState<StoryId>('angle');
  const [angleMember, setAngleMember] = useState<PairMember>('reference');
  const [rateMember, setRateMember] = useState<PairMember>('reference');
  const [handoverPhase, setHandoverPhase] = useState<HandoverPhase>('before');
  const [exploreOffsetKm, setExploreOffsetKm] = useState(exploreAnchor.referenceOffsetKm);
  const [exploreHpbwDeg, setExploreHpbwDeg] = useState(degrees(exploreAnchor.referenceParameters.theta3dbRad));
  const [exploreRateMbps, setExploreRateMbps] = useState(exploreAnchor.referenceParameters.minimumRateBps / 1_000_000);
  const [exploreFrequencyReuse, setExploreFrequencyReuse] = useState(exploreAnchor.referenceParameters.frequencyReuse);
  const [showOrbitSource, setShowOrbitSource] = useState(false);
  const exploreResult = useMemo(
    () => exploreAnchor.build({
      radialOffsetKm: exploreOffsetKm,
      parameterOverrides: {
        theta3dbRad: THREE.MathUtils.degToRad(exploreHpbwDeg),
        minimumRateBps: exploreRateMbps * 1_000_000,
        frequencyReuse: exploreFrequencyReuse,
      },
    }),
    [exploreAnchor, exploreFrequencyReuse, exploreHpbwDeg, exploreOffsetKm, exploreRateMbps],
  );
  const exploreMaxVisualUeX = useMemo(() => {
    const edgeTheta = Math.max(
      Math.abs(readPointTerm(exploreAnchor.buildAtRadialOffsetKm(-exploreAnchor.pathLimitKm), 'theta')),
      Math.abs(readPointTerm(exploreAnchor.buildAtRadialOffsetKm(exploreAnchor.pathLimitKm), 'theta')),
    );
    return Math.abs(Math.tan(edgeTheta * VISUAL_ANGLE_SCALE) * LINK_HEIGHT);
  }, [exploreAnchor]);
  const isExplore = experienceMode === 'explore';
  const currentMember = story === 'rate' ? rateMember : angleMember;
  const guidedPoint = story === 'angle'
    ? anglePair[angleMember]
    : story === 'rate'
      ? ratePair[rateMember]
      : handover[handoverPhase];
  const currentPoint: ScientificExplanationArtifactPoint | ScientificExploreResult = isExplore
    ? exploreResult
    : guidedPoint;
  const visualScenePoint = isExplore ? anglePair.reference : guidedPoint;
  const candidateSatellite = visualScenePoint.candidateSatelliteId === null
    ? undefined
    : visualScenePoint.scene.satellites.find(satellite => satellite.satelliteId === visualScenePoint.candidateSatelliteId);
  const candidatePosition = candidateSatellite === undefined
    ? null
    : normalizedTopocentricPosition(candidateSatellite, visualScenePoint.scene.groundPositionTemeKm);
  const baseline: MetricSnapshot | null = isExplore
    ? exploreAnchor.reference
    : story === 'angle'
      ? anglePair.reference
      : story === 'rate'
        ? ratePair.reference
        : null;
  const showTakeaway = isExplore
    ? baseline !== null && currentPoint.frameId !== baseline.frameId
    : currentMember === 'probe' || story === 'handover';
  const thetaRad = readPointTerm(currentPoint, 'theta');
  const fullHpbwRad = isExplore
    ? exploreResult.parameters.theta3dbRad
    : story === 'angle'
    ? anglePair.control[currentMember === 'reference' ? 'referenceValue' : 'probeValue']
    : anglePair.control.referenceValue;
  const rfPowerW = readPointTerm(currentPoint, 'actualBeamRf');
  const phaseIndex = handoverPhase === 'before' ? 1 : handoverPhase === 'decision' ? 2 : 3;
  const identity = currentPoint.identity;
  const currentMetrics = isExplore
    ? EXPLORE_METRICS
    : story === 'angle'
      ? ANGLE_METRICS
      : story === 'rate'
        ? RATE_METRICS
        : HANDOVER_METRICS;
  const causalTerms = isExplore ? EXPLORE_CAUSAL_TERMS : story === 'handover' ? [] : CAUSAL_TERMS[story];
  const eventEvidence = handover.eventEvidence;
  const eventLabel = eventEvidence.sourceEvent === 'forced-continuity' ? '可見性中斷' : '偏移量與 TTT 條件';
  const guidedPowerLimitEvidence = story === 'angle'
    ? anglePair.capChecks.allUsersNotPowerLimited
    : ratePair.capChecks.allUsersNotPowerLimited;
  const qosMet = story === 'handover'
    ? null
    : isExplore
      ? exploreResult.qosMet
      : readPointTerm(currentPoint, 'representativeRate') + 1e-6 >= readPointTerm(currentPoint, 'minimumRate');
  const powerLimited = story === 'handover'
    ? null
    : isExplore
      ? exploreResult.powerLimited
      : guidedPowerLimitEvidence === null ? null : !guidedPowerLimitEvidence;

  const title = isExplore ? '調整鏈路參數' : story === 'angle' ? '波束角度' : story === 'rate' ? '傳輸目標' : '換手時刻';
  const lead = isExplore
    ? '移動 UE 或改變波束、速率與頻率重用；中央空間關係和右側結果同步更新。'
    : story === 'angle'
    ? '固定同一條鏈路，只切換完整 HPBW；中央波束邊界與右側結果同步更新。'
    : story === 'rate'
      ? '幾何完全不動，只提高最低傳輸速率目標；觀察需求 SINR、RF、吞吐量與 EE 如何連動。'
      : `沿著三筆相鄰 canonical frames 觀察服務角色切換；事件條件為${eventLabel}。`;
  const stageTitle = isExplore
    ? Math.abs(exploreOffsetKm) < 0.05 ? 'UE 位於波束中心' : 'UE 離開波束中心'
    : story === 'angle'
    ? angleMember === 'probe' ? '波束變寬，UE 與 θ 沒有移動' : '先固定同一條服務鏈路'
    : story === 'rate'
      ? rateMember === 'probe' ? '目標提高，鏈路能量與速率一起改變' : '先讀取 1 Mbit/s 目標的基準'
      : handoverPhase === 'before'
        ? `切換前：${handover.fromSatelliteId} 仍是服務衛星`
        : handoverPhase === 'decision'
          ? `切換點：${handover.toSatelliteId} 接手七個服務波束`
          : `切換後：${handover.toSatelliteId} 保持服務角色`;
  const resultTitle = isExplore
    ? '同一 TLE 時刻的重算結果'
    : story === 'angle'
    ? angleMember === 'probe' ? '功率下降，不代表 EE 必然上升' : '先讀取基準狀態'
    : story === 'rate'
      ? rateMember === 'probe' ? '目標提高，但代表 UE 尚未達標' : '先讀取低目標狀態'
      : handoverPhase === 'before' ? '切換前的完整 frame' : handoverPhase === 'decision' ? '服務角色已提交切換' : '切換後的完整 frame';
  const resultValue = isExplore
    ? `θ ${degrees(thetaRad).toFixed(3)}°`
    : story === 'angle'
    ? `${degrees(fullHpbwRad).toFixed(2)}°`
    : story === 'rate'
      ? `${(readPointTerm(currentPoint, 'minimumRate') / 1_000_000).toFixed(0)} M`
      : `0${phaseIndex} / 03`;
  const takeaway = isExplore
    ? `相對接受基準：SINR ${metricDelta('sinr', readPointTerm(exploreAnchor.reference, 'sinr'), readPointTerm(exploreResult, 'sinr'))}，代表鏈路速率 ${metricDelta('representativeRate', readPointTerm(exploreAnchor.reference, 'representativeRate'), readPointTerm(exploreResult, 'representativeRate'))}，瞬時 EE ${metricDelta('eeInst', readPointTerm(exploreAnchor.reference, 'eeInst'), readPointTerm(exploreResult, 'eeInst'))}。`
    : story === 'angle'
    ? angleMember === 'probe'
      ? '這筆比較中，較寬波束讓代表波束 RF 與系統功率降低，但系統總吞吐量下降更多，因此瞬時 EE 也下降。'
      : '切換「較寬波束」，中央波束邊界與五個 canonical 結果會一起更新。'
    : story === 'rate'
      ? rateMember === 'probe'
        ? '最低傳輸速率目標提高到 10 Mbit/s 後，代表 UE 實現 6.519 Mbit/s，仍未達標；右側保留這筆實際計算結果。'
        : '切換到 10 Mbit/s，觀察目標如何經由需求 SINR 與 RF 輸出影響吞吐量、功率和 EE。'
      : handoverPhase === 'before'
        ? `${handover.toSatelliteId} 已是可見的比較候選，但尚未擁有服務波束。`
        : handoverPhase === 'decision'
          ? `${handover.fromSatelliteId} 觸發${eventLabel}後，${handover.toSatelliteId} 依 ${eventEvidence.targetSelection.passId} 接手。`
          : '此處只比較相鄰 accepted frames 的觀察值，不把數值差異宣稱為換手造成的節能。';

  const fixedRows = isExplore
    ? [
        { label: 'UE 徑向位置', value: distanceLabelKm(exploreOffsetKm) },
        { label: '離軸角 θ', value: `${degrees(thetaRad).toFixed(3)}°` },
        { label: '服務衛星／波束', value: `${identity.satelliteId} / ${identity.beamId}` },
        { label: '代表 UE', value: identity.userId },
      ]
    : story === 'angle'
    ? [
        { label: '離軸角 θ', value: `${degrees(thetaRad).toFixed(3)}°` },
        { label: '服務衛星', value: identity.satelliteId },
        { label: '服務波束', value: `${identity.beamId}` },
        { label: '代表 UE', value: identity.userId },
      ]
    : story === 'rate'
      ? [
          { label: '離軸角 θ', value: `${degrees(thetaRad).toFixed(3)}°` },
          { label: '波束使用者數', value: `${readPointTerm(currentPoint, 'beamLoad').toFixed(0)}` },
          { label: '每波束頻寬', value: `${(readPointTerm(currentPoint, 'beamBandwidth') / 1_000_000).toFixed(1)} MHz` },
          { label: '代表鏈路', value: `${identity.satelliteId} / ${identity.userId}` },
        ]
      : [
          { label: '事件', value: eventLabel },
          { label: '服務角色', value: `${handover.fromSatelliteId} → ${handover.toSatelliteId}` },
          { label: '目前 UTC', value: guidedPoint.instantUtc.slice(11, 19) },
          { label: '代表鏈路', value: `${identity.satelliteId} / ${identity.userId}` },
        ];

  return (
    <article
      id="explain-causal-lab"
      className={`angle-demo is-${isExplore ? 'explore' : story} ${!isExplore && currentMember === 'probe' ? 'is-probe' : 'is-reference'}`}
      data-scene-layer="scientific-causal-lab"
      data-story={isExplore ? 'explore' : story}
      data-frame-id={currentPoint.frameId}
      aria-label="角度、傳輸目標與換手如何連動 SINR、功率、吞吐量與能效的三維實驗"
    >
      <header className="angle-demo__topbar">
        <button type="button" className="angle-demo__back" onClick={onBack}><span aria-hidden="true">←</span> 返回</button>
        <button
          type="button"
          className="angle-demo__source"
          aria-expanded={showOrbitSource}
          aria-controls="artifact-orbit-title"
          onClick={() => setShowOrbitSource(value => !value)}
        >
          <span>{isExplore ? 'ACCEPTED TLE ANCHOR · CANONICAL EXPLORE' : 'PRECOMPUTED ACCEPTED TLE EVIDENCE'}</span>
          <strong>{state.source.constellation.toUpperCase()} · {currentPoint.instantUtc.replace('T', ' ').replace('.000Z', ' UTC')}</strong>
          <small>{showOrbitSource ? '回到本地鏈路' : '查看軌道來源'}</small>
        </button>
        <div className="angle-demo__identity">SAT {identity.satelliteId} · BEAM {identity.beamId} · {identity.userId.toUpperCase()}</div>
      </header>

      <nav className="angle-demo__chapter-nav" aria-label="選擇探索或導覽主題">
        <button type="button" className={isExplore ? 'is-active' : ''} aria-pressed={isExplore} onClick={() => setExperienceMode('explore')}><span>01</span>自由探索</button>
        <button type="button" className={!isExplore && story === 'angle' ? 'is-active' : ''} aria-pressed={!isExplore && story === 'angle'} onClick={() => { setExperienceMode('guided'); setStory('angle'); }}><span>02</span>空間與角度</button>
        <button type="button" className={!isExplore && story === 'rate' ? 'is-active' : ''} aria-pressed={!isExplore && story === 'rate'} onClick={() => { setExperienceMode('guided'); setStory('rate'); }}><span>03</span>通道與功率</button>
        <button type="button" className={!isExplore && story === 'handover' ? 'is-active' : ''} aria-pressed={!isExplore && story === 'handover'} onClick={() => { setExperienceMode('guided'); setStory('handover'); }}><span>04</span>換手與能效</button>
      </nav>

      <section className="angle-demo__workspace">
        <aside className="angle-demo__control-panel" aria-label="教學實驗控制">
          <p className="angle-demo__eyebrow">CAUSE → SCENE → RESULT</p>
          <h1>{title}</h1>
          <p className="angle-demo__lead">{lead}</p>

          {isExplore && (
            <div className="angle-demo__explore-control">
              <div className="angle-demo__control-row">
                <div className="angle-demo__explore-control-heading">
                  <label htmlFor="scientific-explore-ue-position">UE 位置與離軸角</label>
                  <output htmlFor="scientific-explore-ue-position"><span>{distanceLabelKm(exploreOffsetKm)}</span><small>θ {degrees(thetaRad).toFixed(3)}°</small></output>
                </div>
                <input
                  id="scientific-explore-ue-position"
                  type="range"
                  min={-exploreAnchor.pathLimitKm}
                  max={exploreAnchor.pathLimitKm}
                  step={0.1}
                  value={exploreOffsetKm}
                  onChange={event => setExploreOffsetKm(Number(event.currentTarget.value))}
                />
                <div className="angle-demo__explore-scale" aria-hidden="true"><span>−{exploreAnchor.pathLimitKm.toFixed(0)} km</span><span>波束中心</span><span>+{exploreAnchor.pathLimitKm.toFixed(0)} km</span></div>
              </div>
              <div className="angle-demo__control-row">
                <div className="angle-demo__explore-control-heading">
                  <label htmlFor="scientific-explore-hpbw">完整 HPBW</label>
                  <output htmlFor="scientific-explore-hpbw">{exploreHpbwDeg.toFixed(2)}°</output>
                </div>
                <input id="scientific-explore-hpbw" type="range" min={1.2} max={8} step={0.05} value={exploreHpbwDeg} onChange={event => setExploreHpbwDeg(Number(event.currentTarget.value))} />
              </div>
              <div className="angle-demo__control-row">
                <div className="angle-demo__explore-control-heading">
                  <label htmlFor="scientific-explore-rate">最低傳輸速率目標</label>
                  <output htmlFor="scientific-explore-rate">{exploreRateMbps.toFixed(1)} Mbit/s</output>
                </div>
                <input id="scientific-explore-rate" type="range" min={0.5} max={12} step={0.5} value={exploreRateMbps} onChange={event => setExploreRateMbps(Number(event.currentTarget.value))} />
              </div>
              <div className="angle-demo__control-row">
                <div className="angle-demo__explore-control-heading"><span>頻率重用因子 K</span><output>{exploreFrequencyReuse}</output></div>
                <div className="angle-demo__reuse-options" role="group" aria-label="頻率重用因子">
                  {[1, 3, 7].map(value => <button type="button" key={value} aria-pressed={exploreFrequencyReuse === value} className={exploreFrequencyReuse === value ? 'is-active' : ''} onClick={() => setExploreFrequencyReuse(value)}>{value}</button>)}
                </div>
              </div>
              <button type="button" className="angle-demo__reset" onClick={() => {
                setExploreOffsetKm(exploreAnchor.referenceOffsetKm);
                setExploreHpbwDeg(degrees(exploreAnchor.referenceParameters.theta3dbRad));
                setExploreRateMbps(exploreAnchor.referenceParameters.minimumRateBps / 1_000_000);
                setExploreFrequencyReuse(exploreAnchor.referenceParameters.frequencyReuse);
              }}>回到接受基準</button>
            </div>
          )}
          {!isExplore && story === 'angle' && (
            <div className="angle-demo__switch" role="group" aria-label="選擇完整半功率波束寬度">
              <button type="button" aria-pressed={angleMember === 'reference'} className={angleMember === 'reference' ? 'is-active' : ''} onClick={() => setAngleMember('reference')}><span>基準 HPBW</span><strong>{degrees(anglePair.control.referenceValue).toFixed(2)}°</strong></button>
              <button type="button" aria-pressed={angleMember === 'probe'} className={angleMember === 'probe' ? 'is-active' : ''} onClick={() => setAngleMember('probe')}><span>較寬 HPBW</span><strong>{degrees(anglePair.control.probeValue).toFixed(2)}°</strong></button>
            </div>
          )}
          {!isExplore && story === 'rate' && (
            <div className="angle-demo__switch" role="group" aria-label="選擇最低傳輸速率目標">
              <button type="button" aria-pressed={rateMember === 'reference'} className={rateMember === 'reference' ? 'is-active' : ''} onClick={() => setRateMember('reference')}><span>基準目標</span><strong>1 M</strong></button>
              <button type="button" aria-pressed={rateMember === 'probe'} className={rateMember === 'probe' ? 'is-active' : ''} onClick={() => setRateMember('probe')}><span>提高目標</span><strong>10 M</strong></button>
            </div>
          )}
          {!isExplore && story === 'handover' && (
            <div className="angle-demo__handover-switch" role="group" aria-label="選擇換手觀察時刻">
              {(['before', 'decision', 'after'] as const).map((phase, index) => (
                <button type="button" key={phase} aria-pressed={handoverPhase === phase} className={handoverPhase === phase ? 'is-active' : ''} onClick={() => setHandoverPhase(phase)}>
                  <span>0{index + 1}</span><strong>{phase === 'before' ? '切換前' : phase === 'decision' ? '切換點' : '切換後'}</strong>
                </button>
              ))}
            </div>
          )}
          {!isExplore && (
            <button type="button" className="angle-demo__reset" onClick={() => {
              setAngleMember('reference');
              setRateMember('reference');
              setHandoverPhase('before');
            }}>回到此主題基準</button>
          )}

          <FixedFacts rows={fixedRows} />
          <p className="angle-demo__hint">{isExplore
            ? '調整位置後，UE、鏈路與右側結果會由同一個固定時刻 canonical frame 一起更新。'
            : '切換左側狀態；中央角色、能量強度與右側 canonical 結果會使用同一筆預計算 frame 更新。'}</p>
        </aside>

        <section className="angle-demo__stage" aria-label="持續存在的衛星、波束與 UE 三維場景">
          {!showOrbitSource && (
            <div className="angle-demo__stage-copy">
              <p>{isExplore ? 'FIXED-ANCHOR UE EXPLORE' : story === 'handover' ? 'TLE ROLE TRANSITION' : 'ANGLE-AWARE LINK CUTAWAY'}</p>
              <h2>{stageTitle}</h2>
            </div>
          )}
          {!showOrbitSource && qosMet !== null && (
            <div className="angle-demo__scene-status" aria-live="polite">
              <strong className={qosMet ? 'is-ok' : 'is-warning'}>{qosMet ? '傳輸目標達成' : '傳輸目標未達成'}</strong>
              {powerLimited !== null && <span>{powerLimited ? '功率上限已觸發' : '功率上限未觸發'}</span>}
            </div>
          )}
          <div className="angle-demo__canvas" role="img" aria-label="參數、場景角色與計算結果連動的三維視圖">
            <Canvas
              camera={{ position: [5.9, 4.7, 7.0], fov: 38, near: 0.05, far: 30 }}
              dpr={[1, 1.35]}
              frameloop={showOrbitSource || isExplore ? 'always' : 'demand'}
              shadows={false}
              gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
              fallback={<div className="angle-demo__fallback">此裝置無法建立 WebGL 教學視圖。</div>}
            >
              {showOrbitSource ? (
                <ArtifactOrbitScene point={visualScenePoint} />
              ) : !isExplore && story === 'handover' ? (
                <HandoverCutaway
                  point={guidedPoint}
                  phase={handoverPhase}
                  fromSatelliteId={handover.fromSatelliteId}
                  toSatelliteId={handover.toSatelliteId}
                  eventLabel={eventLabel}
                />
              ) : (
                <>
                  <LinkCutaway
                    thetaRad={thetaRad}
                    fullHpbwRad={fullHpbwRad}
                    satelliteId={identity.satelliteId}
                    member={isExplore ? 'reference' : currentMember}
                    story={isExplore ? 'explore' : story === 'handover' ? 'angle' : story}
                    rfPowerW={rfPowerW}
                    ueDirection={isExplore && exploreOffsetKm < 0 ? -1 : 1}
                    animateEnergy={isExplore || story === 'rate'}
                    candidateSatelliteId={visualScenePoint.candidateSatelliteId}
                    candidatePosition={candidatePosition}
                    uePathLimitKm={isExplore ? exploreAnchor.pathLimitKm : null}
                    maxVisualUeX={isExplore ? exploreMaxVisualUeX : null}
                    onUeOffsetChange={isExplore ? setExploreOffsetKm : null}
                  />
                  {isExplore && <OrbitControls makeDefault enablePan={false} enableDamping target={[0, 2, 0]} minDistance={6.2} maxDistance={12} maxPolarAngle={1.44} />}
                </>
              )}
            </Canvas>
          </div>
          {showOrbitSource && (
            <ArtifactOrbitInspector state={state} point={visualScenePoint} onClose={() => setShowOrbitSource(false)} />
          )}
          {!showOrbitSource && <div className="angle-demo__legend" aria-hidden="true">
            {!isExplore && story === 'handover' ? (
              <><span><i className="is-beam" />服務波束</span><span><i className="is-candidate" />比較候選</span><span><i className="is-context" />原服務角色</span></>
            ) : (
              <><span><i className="is-beam" />完整 HPBW 邊界</span><span><i className="is-boresight" />波束中心</span><span><i className="is-link" />代表鏈路</span></>
            )}
          </div>}
          {!showOrbitSource && (!isExplore && story === 'handover' ? (
            <div className="angle-demo__handover-rail" aria-label="換手三個相鄰 frame">
              {(['before', 'decision', 'after'] as const).map((phase, index) => (
                <button type="button" key={phase} className={handoverPhase === phase ? 'is-active' : ''} onClick={() => setHandoverPhase(phase)}>
                  <span>0{index + 1}</span><strong>{handover[phase].instantUtc.slice(11, 19)}</strong><small>{phase === 'before' ? '切換前' : phase === 'decision' ? '角色提交' : '切換後'}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className={`angle-demo__causal${isExplore ? ' is-explore' : ''}`} aria-label="目前 frame 的 canonical 計算鏈">
              {causalTerms.map((term, index) => (
                <div className="angle-demo__causal-item" key={term}>
                  <span>{TERM_SYMBOLS[term] ?? term}</span>
                  <strong>{metricValue(term, readPointTerm(currentPoint, term))}</strong>
                  {index < causalTerms.length - 1 && <i aria-hidden="true">→</i>}
                </div>
              ))}
            </div>
          ))}
        </section>

        <aside className="angle-demo__results" aria-label="目前 frame 的 canonical 計算結果">
          <p className="angle-demo__eyebrow">{isExplore ? 'REBUILT CANONICAL FRAME' : 'CURRENT CANONICAL FRAME'}</p>
          <div className="angle-demo__result-heading">
            <div><span>{isExplore ? 'UE 位置導出的離軸角' : story === 'angle' ? '完整 HPBW' : story === 'rate' ? '最低傳輸速率目標' : '換手觀察時刻'}</span><h2>{resultTitle}</h2></div>
            <strong>{resultValue}</strong>
          </div>
          <div className="angle-demo__metric-list">
            {currentMetrics.map(spec => <MetricCard key={spec.term} spec={spec} current={currentPoint} baseline={baseline} comparisonLabel={metricScopeLabel(spec.term, currentPoint)} />)}
          </div>
          {!isExplore && story === 'handover' && (
            <details className="angle-demo__event-evidence">
              <summary>查看換手證據</summary>
              <dl>
                <div><dt>事件 ID</dt><dd>{eventEvidence.eventId}</dd></div>
                <div><dt>觸發時刻</dt><dd>{eventEvidence.triggerInstantUtc.replace('T', ' ').replace('.000Z', ' UTC')}</dd></div>
                <div><dt>觸發前可見性</dt><dd>原服務 {eventEvidence.preCommit.servingVisible ? '可見' : '不可見'} · 候選 {eventEvidence.preCommit.candidateVisible ? '可見' : '不可見'}</dd></div>
                <div><dt>觸發前 ΔSINR</dt><dd>{eventEvidence.preCommit.deltaDb === null ? '不可用' : `${eventEvidence.preCommit.deltaDb.toFixed(2)} dB`}</dd></div>
                <div><dt>目標 pass</dt><dd>{eventEvidence.targetSelection.passId}</dd></div>
                <div><dt>事件 trace</dt><dd title={eventEvidence.traceDigest}>{eventEvidence.traceDigest.slice(0, 16)}…</dd></div>
              </dl>
              <p>三個 frame 各自標示代表鏈路；跨 frame 的數值不是同一條鏈路的因果差分。</p>
            </details>
          )}
          {showTakeaway && (
            <section className="angle-demo__takeaway is-visible" aria-live="polite">
              <span>這一筆資料顯示</span>
              <p>{takeaway}</p>
            </section>
          )}
        </aside>
      </section>

      <footer className="angle-demo__boundary">
        <span>來源：archived TLE / SGP4 / accepted canonical frames</span>
        <strong>{isExplore ? '探索變數：UE 位置 · HPBW · Rmin · K' : story === 'angle' ? '唯一改變：完整 HPBW' : story === 'rate' ? '唯一改變：最低傳輸速率目標' : `事件：${eventLabel}`}</strong>
        <span>{isExplore ? '固定 TLE 時刻 · 即時重建 canonical frame' : '場景與結果共用目前 frame'}</span>
      </footer>
    </article>
  );
}
