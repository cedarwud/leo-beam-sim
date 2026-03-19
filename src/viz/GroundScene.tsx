import { Text } from '@react-three/drei';

/** Observer marker only — no ground plane (NTPU scene provides the ground). */
export function GroundScene() {
  return (
    <group>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[6, 6, 4, 16]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.3} />
      </mesh>
      <Text
        position={[0, 12, 0]}
        fontSize={12}
        color="#ff6666"
        anchorX="center"
        anchorY="middle"
        outlineWidth={1}
        outlineColor="#000000"
      >
        UE
      </Text>
    </group>
  );
}
