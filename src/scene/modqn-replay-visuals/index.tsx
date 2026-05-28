import { useMemo, useRef } from 'react';
import { Line, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ModqnReplayPlaybackDisplayState } from '../../modqn/replay-bundle/playback-shell';
import { SatelliteMarker } from '../../viz/SatelliteMarker';
import {
  deriveModqnReplaySceneVisualState,
  type ModqnReplaySceneBeamVisual,
  type ModqnReplaySceneFocusedUserVisual,
  type ModqnReplaySceneSatelliteVisual,
  type ModqnReplaySceneVisualState,
} from '../modqnReplaySceneVisuals';
import {
  BOARD_DEPTH_WORLD,
  DISC_Y_WORLD,
  LAYER_ORIGIN,
  ROLE_COLORS,
  roleLabel,
} from './constants';
import { ReplaySwitchArc } from './ReplaySwitchArc';
import { useReplaySceneTelemetry } from './useReplaySceneTelemetry';

interface ModqnReplaySceneLayerProps {
  readonly displayState: ModqnReplayPlaybackDisplayState | null;
  readonly reducedMotion?: boolean;
  readonly showBoard?: boolean;
  readonly worldUnitsPerKm?: number;
  readonly visualSatelliteAltitudeWorld?: number;
}

function beamDiscOpacity(beam: ModqnReplaySceneBeamVisual): number {
  if (beam.geometrySource === 'producer-display-proxy') {
    if (beam.role === 'selected') return 0.18;
    if (beam.role === 'previous') return 0.15;
    if (beam.role === 'previous-and-selected') return 0.2;
    return beam.actionValidUnderDecisionMask === true ? 0.075 : 0.03;
  }
  const role = beam.role;
  if (role === 'selected') return 0.2;
  if (role === 'previous') return 0.17;
  if (role === 'previous-and-selected') return 0.22;
  return 0.1;
}

function beamRingOpacity(beam: ModqnReplaySceneBeamVisual): number {
  if (beam.geometrySource === 'producer-display-proxy') {
    if (beam.role === 'selected') return 0.78;
    if (beam.role === 'previous') return 0.68;
    if (beam.role === 'previous-and-selected') return 0.82;
    return beam.actionValidUnderDecisionMask === true ? 0.36 : 0.16;
  }
  const role = beam.role;
  if (role === 'selected') return 0.62;
  if (role === 'previous') return 0.56;
  if (role === 'previous-and-selected') return 0.68;
  return 0.36;
}

function sourceBackedLineOpacity(beam: ModqnReplaySceneBeamVisual): number {
  if (beam.geometrySource === 'producer-display-proxy') {
    if (beam.role === 'inactive') return beam.actionValidUnderDecisionMask === true ? 0.42 : 0.16;
    return 0.72;
  }
  if (beam.geometrySource !== 'producer-beam-state') return 0.38;
  if (beam.role === 'inactive') return beam.actionValidUnderDecisionMask === true ? 0.42 : 0.18;
  return 0.72;
}

function satelliteTintColor(role: ModqnReplaySceneSatelliteVisual['role']): string {
  if (role === 'selected') return '#f59e0b';
  if (role === 'previous') return '#38bdf8';
  if (role === 'selected-and-previous') return '#facc15';
  return '#aaccff';
}

function BeamActivationPulse({
  beam,
  visualState,
  reducedMotion,
}: {
  readonly beam: ModqnReplaySceneBeamVisual;
  readonly visualState: ModqnReplaySceneVisualState;
  readonly reducedMotion: boolean;
}) {
  const ringRef = useRef<THREE.Mesh | null>(null);
  const active = beam.role === 'selected' || beam.role === 'previous-and-selected';

  useFrame(({ clock }) => {
    const ring = ringRef.current;
    if (!ring || !active) return;

    const pulse = reducedMotion || !visualState.playing
      ? 0.5
      : (Math.sin(clock.getElapsedTime() * 5.2 + beam.canonicalLocalBeamIndex * 0.4) + 1) / 2;
    const scale = 1.03 + pulse * 0.18;
    ring.scale.setScalar(scale);

    const material = ring.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0.14 + pulse * 0.07;
    }
  });

  if (!active) return null;

  return (
    <mesh
      ref={ringRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.35, 0]}
      renderOrder={67}
      frustumCulled={false}
      name="modqn-replay-scene-active-beam-pulse"
    >
      <ringGeometry
        args={[
          beam.footprintRadiusWorld * 1.04,
          beam.footprintRadiusWorld * 1.12,
          72,
        ]}
      />
      <meshBasicMaterial
        color={ROLE_COLORS[beam.role]}
        transparent
        opacity={0.18}
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function BeamDisc({
  beam,
  visualState,
  reducedMotion,
}: {
  readonly beam: ModqnReplaySceneBeamVisual;
  readonly visualState: ModqnReplaySceneVisualState;
  readonly reducedMotion: boolean;
}) {
  const color = ROLE_COLORS[beam.role];
  const label = roleLabel(beam.role);

  return (
    <group
      name="modqn-replay-scene-beam-disc"
      position={[beam.position.x, DISC_Y_WORLD, beam.position.z]}
      userData={{
        canonicalBeamNumber: beam.canonicalBeamNumber,
        role: beam.role,
        producerSatId: beam.producerSatId,
        producerBeamId: beam.producerBeamId,
        geometrySource: beam.geometrySource,
        actionValidUnderDecisionMask: beam.actionValidUnderDecisionMask,
        previousProducerBeamId: beam.previousProducerBeamId,
        selectedProducerBeamId: beam.selectedProducerBeamId,
      }}
    >
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={64}
        frustumCulled={false}
        name="modqn-replay-scene-beam-footprint"
      >
        <circleGeometry args={[beam.footprintRadiusWorld, 96]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={beamDiscOpacity(beam)}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.18, 0]}
        renderOrder={65}
        frustumCulled={false}
      >
        <ringGeometry
          args={[
            beam.footprintRadiusWorld * 0.96,
            beam.footprintRadiusWorld,
            96,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={beamRingOpacity(beam)}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.38, 0]}
        renderOrder={66}
        frustumCulled={false}
      >
        <ringGeometry
          args={[
            beam.footprintRadiusWorld * 0.72,
            beam.footprintRadiusWorld * 0.73,
            96,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={sourceBackedLineOpacity(beam)}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <BeamActivationPulse beam={beam} visualState={visualState} reducedMotion={reducedMotion} />
      {beam.geometrySource === 'producer-display-proxy' && beam.role !== 'inactive' ? (
        <Text
          position={[0, 14.5, 0]}
          fontSize={6.2}
          color="#fef3c7"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.34}
          outlineColor="#020617"
        >
          EST
        </Text>
      ) : null}
      <Text
        position={[0, 7.5, 0]}
        fontSize={10.5}
        color={beam.role === 'inactive' ? '#e2e8f0' : color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.4}
        outlineColor="#020617"
      >
        {`B${beam.canonicalBeamNumber}`}
      </Text>
      {label ? (
        <Text
          position={[0, -8, 0]}
          fontSize={7.2}
          color="#fff7ed"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.34}
          outlineColor="#020617"
        >
          {label}
        </Text>
      ) : null}
    </group>
  );
}

function BeamDiscs({
  visualState,
  reducedMotion,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
  readonly reducedMotion: boolean;
}) {
  return (
    <group name="modqn-replay-scene-beam-discs">
      {visualState.beams.map(beam => (
        <BeamDisc
          key={beam.producerBeamId ?? `canonical-${beam.canonicalLocalBeamIndex}`}
          beam={beam}
          visualState={visualState}
          reducedMotion={reducedMotion}
        />
      ))}
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
            position={[endpoint.position.x + labelOffset, DISC_Y_WORLD + 34, endpoint.position.z]}
            userData={{
              endpointRole: endpoint.role,
              producerBeamId: endpoint.producerBeamId,
              producerSatId: endpoint.producerSatId,
              geometrySource: endpoint.geometrySource,
            }}
          >
            <Text
              position={[0, 0, 0]}
              fontSize={9.5}
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
              fontSize={6.2}
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

function FocusedUserMarker({
  focusedUser,
  reducedMotion,
  playing,
}: {
  readonly focusedUser: ModqnReplaySceneFocusedUserVisual | null;
  readonly reducedMotion: boolean;
  readonly playing: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh | null>(null);

  useFrame(({ clock }) => {
    const pulse = pulseRef.current;
    if (!pulse || focusedUser === null) return;

    const phase = reducedMotion || !playing
      ? 0.45
      : (Math.sin(clock.getElapsedTime() * 4.6) + 1) / 2;
    pulse.scale.setScalar(1.1 + phase * 0.55);
    const material = pulse.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0.18 + phase * 0.16;
    }
  });

  if (focusedUser === null) return null;

  return (
    <group
      name="modqn-replay-focused-user"
      position={[focusedUser.position.x, DISC_Y_WORLD + 4, focusedUser.position.z]}
      userData={{
        userId: focusedUser.userId,
        userIndex: focusedUser.userIndex,
        source: focusedUser.source,
      }}
    >
      <mesh renderOrder={82} frustumCulled={false}>
        <sphereGeometry args={[8.5, 24, 24]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.92}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={pulseRef} renderOrder={81} frustumCulled={false}>
        <sphereGeometry args={[14, 28, 28]} />
        <meshBasicMaterial
          color="#f8fafc"
          transparent
          opacity={0.24}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 18, 0]}
        fontSize={7.4}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.35}
        outlineColor="#020617"
      >
        {`UE ${focusedUser.userIndex}`}
      </Text>
    </group>
  );
}

function SourceSatellites({
  satellites,
}: {
  readonly satellites: readonly ModqnReplaySceneSatelliteVisual[];
}) {
  return (
    <group name="modqn-replay-source-satellites">
      {satellites.map(satellite => (
        <SatelliteMarker
          key={satellite.producerSatId}
          position={new THREE.Vector3(
            satellite.position.x,
            satellite.position.y,
            satellite.position.z,
          )}
          label={satellite.label}
          satelliteTintColor={satelliteTintColor(satellite.role)}
          scaleMultiplier={satellite.localFrameVisible ? 1.25 : 0.8}
        />
      ))}
    </group>
  );
}

function ProxyBeamLinks({
  visualState,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
}) {
  if (visualState.geometrySource !== 'producer-display-proxy') return null;

  const endpoints = [visualState.previous, visualState.selected] as const;

  return (
    <group name="modqn-replay-proxy-beam-links">
      {endpoints.flatMap(endpoint => {
        const satellite = visualState.satellites.find(item => item.producerSatId === endpoint.producerSatId);
        if (satellite === undefined) return [];

        const color = endpoint.role === 'previous' ? ROLE_COLORS.previous : ROLE_COLORS.selected;
        const apex: [number, number, number] = [
          satellite.position.x,
          satellite.position.y,
          satellite.position.z,
        ];
        const center: [number, number, number] = [
          endpoint.position.x,
          DISC_Y_WORLD + 3.2,
          endpoint.position.z,
        ];
        const radius = visualState.beams
          .find(beam => beam.producerBeamId === endpoint.producerBeamId)
          ?.footprintRadiusWorld ?? 58;
        const edgePoints: [number, number, number][] = [
          [endpoint.position.x + radius * 0.42, DISC_Y_WORLD + 2.2, endpoint.position.z],
          [endpoint.position.x - radius * 0.42, DISC_Y_WORLD + 2.2, endpoint.position.z],
          [endpoint.position.x, DISC_Y_WORLD + 2.2, endpoint.position.z + radius * 0.42],
          [endpoint.position.x, DISC_Y_WORLD + 2.2, endpoint.position.z - radius * 0.42],
        ];

        return [
          <Line
            key={`${endpoint.role}-center`}
            points={[apex, center]}
            color={color}
            lineWidth={endpoint.role === 'selected' ? 3.2 : 2.6}
            transparent
            opacity={endpoint.role === 'selected' ? 0.58 : 0.42}
            renderOrder={72}
            depthTest={false}
            depthWrite={false}
          />,
          ...edgePoints.map((edge, edgeIndex) => (
            <Line
              key={`${endpoint.role}-edge-${edgeIndex}`}
              points={[apex, edge]}
              color={color}
              lineWidth={1.35}
              transparent
              opacity={endpoint.role === 'selected' ? 0.24 : 0.16}
              renderOrder={71}
              depthTest={false}
              depthWrite={false}
            />
          )),
        ];
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
        geometrySource: visualState.geometrySource,
        eventKind: visualState.eventKind,
        previousProducerBeamId: visualState.previous.producerBeamId,
        selectedProducerBeamId: visualState.selected.producerBeamId,
      }}
    >
      <SourceSatellites satellites={visualState.satellites} />
      <ProxyBeamLinks visualState={visualState} />
      <BeamDiscs visualState={visualState} reducedMotion={reducedMotion} />
      <FocusedUserMarker
        focusedUser={visualState.focusedUser}
        reducedMotion={reducedMotion}
        playing={visualState.playing}
      />
      <ReplaySwitchArc visualState={visualState} reducedMotion={reducedMotion} />
      <EndpointLabels visualState={visualState} />
      <Text
        position={[0, DISC_Y_WORLD + 36, BOARD_DEPTH_WORLD / 2 - 13]}
        fontSize={8.5}
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
  worldUnitsPerKm,
  visualSatelliteAltitudeWorld,
}: ModqnReplaySceneLayerProps) {
  const visualState = useMemo(
    () => deriveModqnReplaySceneVisualState(displayState, {
      worldUnitsPerKm,
      visualSatelliteAltitudeWorld,
    }),
    [displayState, visualSatelliteAltitudeWorld, worldUnitsPerKm],
  );
  useReplaySceneTelemetry(visualState, showBoard);

  if (!showBoard || visualState === null) return null;
  return (
    <ReplayBoard
      visualState={visualState}
      reducedMotion={reducedMotion}
    />
  );
}
