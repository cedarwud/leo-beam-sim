import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ModqnReplayPlaybackDisplayState } from '../../modqn/replay-bundle/playback-shell';
import { SatelliteMarker } from '../../viz/SatelliteMarker';
import {
  deriveModqnReplaySceneVisualState,
  type ModqnReplaySceneVisualState,
} from '../modqnReplaySceneVisuals';
import {
  BOARD_DEPTH_WORLD,
  DISC_Y_WORLD,
  LAYER_ORIGIN,
  PRODUCER_MARKER_Y_WORLD,
  ROLE_COLORS,
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
  const satellitePosition = useMemo(
    () => new THREE.Vector3(0, PRODUCER_MARKER_Y_WORLD, 0),
    [],
  );
  const producerSatLabel = visualState.previous.producerSatId === visualState.selected.producerSatId
    ? visualState.selected.producerSatId
    : `${visualState.previous.producerSatId} -> ${visualState.selected.producerSatId}`;

  return (
    <group name="modqn-replay-scene-producer-anchor">
      <SatelliteMarker
        position={satellitePosition}
        label={producerSatLabel}
        satelliteTintColor="#e2e8f0"
      />
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
  useReplaySceneTelemetry(visualState, showBoard);

  if (!showBoard || visualState === null) return null;
  return <ReplayBoard visualState={visualState} reducedMotion={reducedMotion} />;
}
