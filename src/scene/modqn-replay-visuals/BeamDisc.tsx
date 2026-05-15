import { Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD,
  type ModqnReplaySceneBeamVisual,
} from '../modqnReplaySceneVisuals';
import { DISC_Y_WORLD, ROLE_COLORS, SEGMENTS, roleLabel } from './constants';

export function BeamDisc({
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
