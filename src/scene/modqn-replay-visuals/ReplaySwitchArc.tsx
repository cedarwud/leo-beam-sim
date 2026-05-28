import { useRef } from 'react';
import { Line, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ModqnReplaySceneVisualState } from '../modqnReplaySceneVisuals';
import { ARC_CONTROL_Y_WORLD, DISC_Y_WORLD } from './constants';
import { createArcPoints, pointOnQuadraticArc, samePoint } from './geometry';

function SwitchPulse({
  visualState,
  reducedMotion,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
  readonly reducedMotion: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh | null>(null);
  const active = visualState.switch.activeHandover
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
      renderOrder={79}
      frustumCulled={false}
      name="modqn-replay-scene-switch-pulse"
    >
      <sphereGeometry args={[4.2, 20, 20]} />
      <meshBasicMaterial
        color="#fff7ed"
        transparent
        opacity={0.74}
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

export function ReplaySwitchArc({
  visualState,
  reducedMotion,
}: {
  readonly visualState: ModqnReplaySceneVisualState;
  readonly reducedMotion: boolean;
}) {
  const source = visualState.switch.sourcePosition;
  const target = visualState.switch.targetPosition;
  const hasArc = !samePoint(source, target);
  const active = visualState.switch.activeHandover && hasArc;
  const color = visualState.switch.eventKind === 'inter-satellite-handover'
    ? '#a78bfa'
    : active ? '#f8fafc' : '#94a3b8';
  const points = createArcPoints(source, target, ARC_CONTROL_Y_WORLD);
  const groundPoints: [number, number, number][] = [
    [source.x, DISC_Y_WORLD + 1.2, source.z],
    [target.x, DISC_Y_WORLD + 1.2, target.z],
  ];
  const midpoint: [number, number, number] = [
    (source.x + target.x) / 2,
    ARC_CONTROL_Y_WORLD + 5,
    (source.z + target.z) / 2,
  ];

  if (!hasArc) return null;

  return (
    <group name="modqn-replay-scene-switch-arc">
      <Line
        points={groundPoints}
        color={color}
        lineWidth={active ? 3.2 : 2}
        transparent
        opacity={active ? 0.24 : 0.16}
        dashed={!active}
        dashSize={18}
        gapSize={10}
        renderOrder={76}
        depthTest={false}
        depthWrite={false}
      />
      <Line
        points={points}
        color={color}
        lineWidth={active ? 4.2 : 2.4}
        transparent
        opacity={active ? 0.72 : 0.36}
        dashed={!active}
        dashSize={9}
        gapSize={6}
        renderOrder={77}
        depthTest={false}
        depthWrite={false}
      />
      <Text
        position={midpoint}
        fontSize={7.2}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.45}
        outlineColor="#020617"
        renderOrder={78}
      >
        {visualState.switch.label}
      </Text>
      <SwitchPulse visualState={visualState} reducedMotion={reducedMotion} />
    </group>
  );
}
