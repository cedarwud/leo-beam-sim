import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface SinrLabel {
  position: THREE.Vector3;
  sinrDb: number;
  isServing: boolean;
}

function sinrColor(sinrDb: number): string {
  if (sinrDb >= 20) return '#00ff00';
  if (sinrDb >= 10) return '#aaff00';
  if (sinrDb >= 5) return '#ffaa00';
  return '#ff4444';
}

export function SinrOverlay({ beams }: { beams: SinrLabel[] }) {
  return (
    <group>
      {beams.map((beam, i) => (
        <Text
          key={i}
          position={[beam.position.x, beam.position.y + 25, beam.position.z]}
          fontSize={beam.isServing ? 14 : 10}
          color={sinrColor(beam.sinrDb)}
          anchorX="center"
          anchorY="middle"
          outlineWidth={1.5}
          outlineColor="#000000"
        >
          {`${beam.sinrDb.toFixed(1)} dB`}
        </Text>
      ))}
    </group>
  );
}
