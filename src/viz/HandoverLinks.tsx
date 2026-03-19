import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { EventRole, VisibleSat } from '../scene/types';

interface HandoverLinksProps {
  satellites: VisibleSat[];
  eventRoles: Map<string, EventRole>;
}

function roleStyle(role: EventRole): {
  color: string;
  label: string;
  lineWidth: number;
  dashed: boolean;
  opacity: number;
} {
  switch (role) {
    case 'serving':
      return {
        color: '#18f0ff',
        label: 'serving',
        lineWidth: 3.5,
        dashed: false,
        opacity: 0.9,
      };
    case 'prepared':
      return {
        color: '#ff9d1c',
        label: 'prepared',
        lineWidth: 2.4,
        dashed: true,
        opacity: 0.85,
      };
    case 'post-ho':
      return {
        color: '#4f8cff',
        label: 'post-ho',
        lineWidth: 3.2,
        dashed: false,
        opacity: 0.9,
      };
    case 'secondary':
      return {
        color: '#ff5ab3',
        label: 'secondary',
        lineWidth: 2.2,
        dashed: true,
        opacity: 0.75,
      };
  }
}

const UE_ANCHOR: [number, number, number] = [0, 6, 0];

export function HandoverLinks({ satellites, eventRoles }: HandoverLinksProps) {
  return (
    <group>
      {satellites
        .filter(satellite => {
          const role = eventRoles.get(satellite.id);
          return role === 'serving' || role === 'post-ho';
        })
        .map(satellite => {
          const role = eventRoles.get(satellite.id);
          if (!role) return null;

          const style = roleStyle(role);
          const midpoint = new THREE.Vector3(...UE_ANCHOR).lerp(satellite.world, 0.42);

          return (
            <group key={`link-${satellite.id}`}>
              <Line
                points={[
                  UE_ANCHOR,
                  [satellite.world.x, satellite.world.y, satellite.world.z],
                ]}
                color={style.color}
                lineWidth={style.lineWidth}
                transparent
                opacity={style.opacity}
                dashed={style.dashed}
                dashSize={14}
                gapSize={8}
                depthWrite={false}
              />
              <Text
                position={[midpoint.x, midpoint.y + 8, midpoint.z]}
                fontSize={role === 'serving' || role === 'post-ho' ? 12 : 10}
                color={style.color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={1.5}
                outlineColor="#000000"
              >
                {style.label}
              </Text>
            </group>
          );
        })}
    </group>
  );
}
