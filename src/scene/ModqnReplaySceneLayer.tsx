import { useEffect, useMemo, useRef } from 'react';
import { Line, Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ModqnReplayPlaybackDisplayState } from '../modqn/replay-bundle/playback-shell';
import {
  MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD,
  deriveModqnReplaySceneVisualState,
  type ModqnReplaySceneBeamRole,
  type ModqnReplaySceneBeamVisual,
  type ModqnReplayScenePoint,
  type ModqnReplaySceneVisualState,
} from './modqnReplaySceneVisuals';

interface ModqnReplaySceneLayerProps {
  readonly displayState: ModqnReplayPlaybackDisplayState | null;
  readonly reducedMotion?: boolean;
  readonly showBoard?: boolean;
}

const LAYER_ORIGIN: [number, number, number] = [245, 0, -185];
const BOARD_WIDTH_WORLD = 220;
const BOARD_DEPTH_WORLD = 175;
const BOARD_Y_WORLD = 2.6;
const DISC_Y_WORLD = 5.2;
const PRODUCER_MARKER_Y_WORLD = 84;
const ARC_CONTROL_Y_WORLD = 44;
const SEGMENTS = 96;

const ROLE_COLORS: Record<ModqnReplaySceneBeamRole, string> = {
  inactive: '#94a3b8',
  previous: '#38bdf8',
  selected: '#f59e0b',
  'previous-and-selected': '#facc15',
};

const REPLAY_CANVAS_ATTRIBUTES = [
  'data-modqn-replay-scene-layer',
  'data-modqn-replay-scene-renderer',
  'data-modqn-replay-scene-source',
  'data-modqn-replay-scene-event-kind',
  'data-modqn-replay-scene-previous-beam',
  'data-modqn-replay-scene-selected-beam',
  'data-modqn-replay-scene-previous-position',
  'data-modqn-replay-scene-selected-position',
  'data-modqn-replay-scene-source-row',
] as const;

function formatPoint(point: ModqnReplayScenePoint): string {
  return [point.x, point.y, point.z].map(value => value.toFixed(1)).join(',');
}

function removeReplayCanvasAttributes(canvas: HTMLCanvasElement): void {
  for (const attribute of REPLAY_CANVAS_ATTRIBUTES) {
    canvas.removeAttribute(attribute);
  }
}

function ReplayCanvasTelemetry({
  visualState,
}: {
  readonly visualState: ModqnReplaySceneVisualState | null;
}) {
  const gl = useThree(state => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.setAttribute(
      'data-modqn-replay-scene-layer',
      visualState === null ? 'fail-closed' : 'ready',
    );
    canvas.setAttribute('data-modqn-replay-scene-renderer', 'r3f-world-layer');

    if (visualState !== null) {
      canvas.setAttribute('data-modqn-replay-scene-source', visualState.source);
      canvas.setAttribute('data-modqn-replay-scene-event-kind', visualState.eventKind);
      canvas.setAttribute('data-modqn-replay-scene-previous-beam', visualState.previous.producerBeamId);
      canvas.setAttribute('data-modqn-replay-scene-selected-beam', visualState.selected.producerBeamId);
      canvas.setAttribute('data-modqn-replay-scene-previous-position', formatPoint(visualState.previous.position));
      canvas.setAttribute('data-modqn-replay-scene-selected-position', formatPoint(visualState.selected.position));
      canvas.setAttribute('data-modqn-replay-scene-source-row', String(visualState.sourceRowNumber));
    } else {
      for (const attribute of REPLAY_CANVAS_ATTRIBUTES) {
        if (
          attribute !== 'data-modqn-replay-scene-layer'
          && attribute !== 'data-modqn-replay-scene-renderer'
        ) {
          canvas.removeAttribute(attribute);
        }
      }
    }

    return () => removeReplayCanvasAttributes(canvas);
  }, [gl, visualState]);

  return null;
}

function samePoint(a: ModqnReplayScenePoint, b: ModqnReplayScenePoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.1;
}

function createArcPoints(
  source: ModqnReplayScenePoint,
  target: ModqnReplayScenePoint,
  controlY: number,
): Array<[number, number, number]> {
  const sourceVector = new THREE.Vector3(source.x, DISC_Y_WORLD + 2, source.z);
  const targetVector = new THREE.Vector3(target.x, DISC_Y_WORLD + 2, target.z);
  const control = new THREE.Vector3(
    (source.x + target.x) / 2,
    controlY,
    (source.z + target.z) / 2,
  );
  const curve = new THREE.QuadraticBezierCurve3(sourceVector, control, targetVector);
  return curve.getPoints(28).map(point => [point.x, point.y, point.z]);
}

function pointOnQuadraticArc(
  source: ModqnReplayScenePoint,
  target: ModqnReplayScenePoint,
  controlY: number,
  progress: number,
): THREE.Vector3 {
  const start = new THREE.Vector3(source.x, DISC_Y_WORLD + 2, source.z);
  const end = new THREE.Vector3(target.x, DISC_Y_WORLD + 2, target.z);
  const control = new THREE.Vector3(
    (source.x + target.x) / 2,
    controlY,
    (source.z + target.z) / 2,
  );
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  return curve.getPoint(progress);
}

function roleLabel(role: ModqnReplaySceneBeamRole): string | null {
  switch (role) {
    case 'previous':
      return 'PREV';
    case 'selected':
      return 'SELECT';
    case 'previous-and-selected':
      return 'PREV + SELECT';
    case 'inactive':
      return null;
  }
}

function BeamDisc({
  beam,
}: {
  readonly beam: ModqnReplaySceneBeamVisual;
}) {
  const isEndpoint = beam.role !== 'inactive';
  const color = ROLE_COLORS[beam.role];
  const fillOpacity = isEndpoint ? 0.34 : 0.1;
  const ringOpacity = isEndpoint ? 0.92 : 0.34;
  const label = roleLabel(beam.role);

  return (
    <group
      name={`modqn-replay-scene-beam-${beam.canonicalBeamNumber}`}
      position={[beam.position.x, DISC_Y_WORLD + beam.position.y, beam.position.z]}
      userData={{
        source: 'display-only-canonical-7beam',
        canonicalBeamNumber: beam.canonicalBeamNumber,
        role: beam.role,
        producerSatId: beam.producerSatId,
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={60} frustumCulled={false}>
        <circleGeometry args={[MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD, SEGMENTS]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={fillOpacity}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={61} frustumCulled={false}>
        <ringGeometry
          args={[
            MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD * 0.86,
            MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD,
            SEGMENTS,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={ringOpacity}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {isEndpoint && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={62} frustumCulled={false}>
          <ringGeometry
            args={[
              MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD * 1.08,
              MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD * 1.18,
              SEGMENTS,
            ]}
          />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.88}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
      <Text
        position={[0, 16, 0]}
        fontSize={11}
        color={isEndpoint ? '#ffffff' : '#dbe4ee'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.45}
        outlineColor="#020617"
      >
        {`B${beam.canonicalBeamNumber}`}
      </Text>
      {label !== null && (
        <Text
          position={[0, 30, 0]}
          fontSize={7}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.35}
          outlineColor="#020617"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function SwitchPulse({
  visualState,
  reducedMotion,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
  readonly reducedMotion: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh | null>(null);
  const active = visualState.switch.activeIntraSatelliteSwitch
    && !samePoint(visualState.switch.sourcePosition, visualState.switch.targetPosition);

  useFrame(({ clock }) => {
    const pulse = pulseRef.current;
    if (!pulse || !active) return;

    const progress = reducedMotion || !visualState.playing
      ? 0.58
      : ((clock.getElapsedTime() * 0.65) % 1);
    const point = pointOnQuadraticArc(
      visualState.switch.sourcePosition,
      visualState.switch.targetPosition,
      ARC_CONTROL_Y_WORLD,
      progress,
    );
    pulse.position.copy(point);
  });

  if (!active) return null;

  const initialPoint = pointOnQuadraticArc(
    visualState.switch.sourcePosition,
    visualState.switch.targetPosition,
    ARC_CONTROL_Y_WORLD,
    0.58,
  );

  return (
    <mesh
      ref={pulseRef}
      position={initialPoint}
      renderOrder={69}
      frustumCulled={false}
      name="modqn-replay-scene-switch-pulse"
    >
      <sphereGeometry args={[5.8, 20, 20]} />
      <meshBasicMaterial
        color="#fff7ed"
        transparent
        opacity={0.96}
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function ReplaySwitchArc({
  visualState,
  reducedMotion,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
  readonly reducedMotion: boolean;
}) {
  const source = visualState.switch.sourcePosition;
  const target = visualState.switch.targetPosition;
  const hasArc = !samePoint(source, target);
  const active = visualState.switch.activeIntraSatelliteSwitch && hasArc;
  const color = active ? '#f59e0b' : '#94a3b8';
  const points = useMemo(
    () => createArcPoints(source, target, ARC_CONTROL_Y_WORLD),
    [source, target],
  );
  const midpoint: [number, number, number] = [
    (source.x + target.x) / 2,
    ARC_CONTROL_Y_WORLD + 5,
    (source.z + target.z) / 2,
  ];

  if (!hasArc) return null;

  return (
    <group name="modqn-replay-scene-switch-arc">
      <Line
        points={points}
        color={color}
        lineWidth={active ? 4.6 : 2.4}
        transparent
        opacity={active ? 0.95 : 0.48}
        dashed={!active}
        dashSize={9}
        gapSize={6}
        renderOrder={66}
        depthTest={false}
        depthWrite={false}
      />
      <Text
        position={midpoint}
        fontSize={7.5}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.45}
        outlineColor="#020617"
      >
        {visualState.switch.label}
      </Text>
      <SwitchPulse visualState={visualState} reducedMotion={reducedMotion} />
    </group>
  );
}

function ProducerReplayAnchor({
  visualState,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
}) {
  const producerSatLabel = visualState.previous.producerSatId === visualState.selected.producerSatId
    ? visualState.selected.producerSatId
    : `${visualState.previous.producerSatId} -> ${visualState.selected.producerSatId}`;

  return (
    <group name="modqn-replay-scene-producer-anchor">
      <mesh position={[0, PRODUCER_MARKER_Y_WORLD, 0]} renderOrder={64} frustumCulled={false}>
        <octahedronGeometry args={[8, 0]} />
        <meshBasicMaterial
          color="#e2e8f0"
          transparent
          opacity={0.86}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Line
        points={[
          [0, PRODUCER_MARKER_Y_WORLD - 6, 0],
          [visualState.previous.position.x, DISC_Y_WORLD + 3, visualState.previous.position.z],
        ]}
        color="#38bdf8"
        lineWidth={1.7}
        transparent
        opacity={0.54}
        dashed
        dashSize={7}
        gapSize={6}
        depthTest={false}
        depthWrite={false}
        renderOrder={63}
      />
      <Line
        points={[
          [0, PRODUCER_MARKER_Y_WORLD - 6, 0],
          [visualState.selected.position.x, DISC_Y_WORLD + 3, visualState.selected.position.z],
        ]}
        color="#f59e0b"
        lineWidth={1.9}
        transparent
        opacity={0.62}
        dashed
        dashSize={7}
        gapSize={6}
        depthTest={false}
        depthWrite={false}
        renderOrder={63}
      />
      <Text
        position={[0, PRODUCER_MARKER_Y_WORLD + 18, 0]}
        fontSize={8.2}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.45}
        outlineColor="#020617"
      >
        {`MODQN replay ${producerSatLabel}`}
      </Text>
      <Text
        position={[0, PRODUCER_MARKER_Y_WORLD + 7, 0]}
        fontSize={6.4}
        color="#cbd5e1"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.35}
        outlineColor="#020617"
      >
        display-only 7-beam plane
      </Text>
    </group>
  );
}

function EndpointLabels({
  visualState,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
}) {
  const endpoints = [visualState.previous, visualState.selected] as const;

  return (
    <group name="modqn-replay-scene-endpoint-labels">
      {endpoints.map(endpoint => {
        const color = endpoint.role === 'previous' ? ROLE_COLORS.previous : ROLE_COLORS.selected;
        const labelOffset = endpoint.role === 'previous' ? -15 : 15;
        return (
          <group
            key={endpoint.role}
            position={[endpoint.position.x + labelOffset, DISC_Y_WORLD + 47, endpoint.position.z]}
            userData={{
              endpointRole: endpoint.role,
              producerBeamId: endpoint.producerBeamId,
              producerSatId: endpoint.producerSatId,
            }}
          >
            <Text
              position={[0, 0, 0]}
              fontSize={7.2}
              color={color}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.45}
              outlineColor="#020617"
            >
              {endpoint.label}
            </Text>
            <Text
              position={[0, -9, 0]}
              fontSize={5.5}
              color="#f8fafc"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.35}
              outlineColor="#020617"
            >
              {endpoint.detail}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function ReplayBoard({
  visualState,
  reducedMotion,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
  readonly reducedMotion: boolean;
}) {
  return (
    <group
      name="modqn-replay-scene-layer"
      position={LAYER_ORIGIN}
      userData={{
        source: visualState.source,
        coordinateFrame: visualState.coordinateFrame,
        eventKind: visualState.eventKind,
        previousProducerBeamId: visualState.previous.producerBeamId,
        selectedProducerBeamId: visualState.selected.producerBeamId,
      }}
    >
      <mesh
        position={[0, BOARD_Y_WORLD, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={58}
        frustumCulled={false}
        name="modqn-replay-scene-board"
      >
        <planeGeometry args={[BOARD_WIDTH_WORLD, BOARD_DEPTH_WORLD]} />
        <meshBasicMaterial
          color="#020617"
          transparent
          opacity={0.46}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh
        position={[0, BOARD_Y_WORLD + 0.3, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={59}
        frustumCulled={false}
      >
        <ringGeometry args={[82, 85, SEGMENTS]} />
        <meshBasicMaterial
          color="#64748b"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {visualState.beams.map(beam => (
        <BeamDisc key={beam.canonicalBeamNumber} beam={beam} />
      ))}
      <ReplaySwitchArc visualState={visualState} reducedMotion={reducedMotion} />
      <ProducerReplayAnchor visualState={visualState} />
      <EndpointLabels visualState={visualState} />
      <Text
        position={[0, DISC_Y_WORLD + 49, BOARD_DEPTH_WORLD / 2 - 13]}
        fontSize={7}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.35}
        outlineColor="#020617"
      >
        {`slot ${visualState.slotIndex} / source row ${visualState.sourceRowNumber}`}
      </Text>
    </group>
  );
}

export function ModqnReplaySceneLayer({
  displayState,
  reducedMotion = false,
  showBoard = true,
}: ModqnReplaySceneLayerProps) {
  const visualState = useMemo(
    () => deriveModqnReplaySceneVisualState(displayState),
    [displayState],
  );

  return (
    <>
      <ReplayCanvasTelemetry visualState={visualState} />
      {showBoard && visualState !== null && (
        <ReplayBoard visualState={visualState} reducedMotion={reducedMotion} />
      )}
    </>
  );
}
