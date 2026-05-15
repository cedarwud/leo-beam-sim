import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ModqnReplayPlaybackDisplayState } from '../../modqn/replay-bundle/playback-shell';
import {
  deriveModqnReplaySceneVisualState,
  type ModqnReplaySceneVisualState,
} from '../modqnReplaySceneVisuals';
import { BeamDisc } from './BeamDisc';
import {
  BOARD_DEPTH_WORLD,
  BOARD_WIDTH_WORLD,
  BOARD_Y_WORLD,
  DISC_Y_WORLD,
  LAYER_ORIGIN,
  PRODUCER_MARKER_Y_WORLD,
  ROLE_COLORS,
  SEGMENTS,
} from './constants';
import { ReplaySwitchArc } from './ReplaySwitchArc';
import { useReplaySceneTelemetry } from './useReplaySceneTelemetry';

interface ModqnReplaySceneLayerProps {
  readonly displayState: ModqnReplayPlaybackDisplayState | null;
  readonly reducedMotion?: boolean;
  readonly showBoard?: boolean;
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

  useReplaySceneTelemetry(visualState);

  if (!showBoard || visualState === null) return null;
  return <ReplayBoard visualState={visualState} reducedMotion={reducedMotion} />;
}
