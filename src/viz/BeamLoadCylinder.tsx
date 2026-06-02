import { useLayoutEffect, useRef, type JSX } from 'react';
import * as THREE from 'three';

interface BeamLoadCylinderProps {
  readonly worldPos: readonly [number, number, number] | undefined;
  readonly normalizedLoad: number;
  readonly load: number;
  readonly tintColor?: string;
  readonly visible: boolean;
}

const MIN_HEIGHT_WORLD = 18;
const MAX_HEIGHT_WORLD = 86;
const RADIUS_WORLD = 9;
const BASE_OFFSET_WORLD = 18;
const DEFAULT_TINT_COLOR = '#76ead7';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function BeamLoadCylinder({
  worldPos,
  normalizedLoad,
  load,
  tintColor,
  visible,
}: BeamLoadCylinderProps): JSX.Element {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = tintColor ?? DEFAULT_TINT_COLOR;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const shouldShow = visible && worldPos !== undefined && load > 0;
    mesh.visible = shouldShow;
    mesh.userData.load = load;
    mesh.userData.normalizedLoad = clamp01(normalizedLoad);
    if (!shouldShow || worldPos === undefined) return;

    const height = MIN_HEIGHT_WORLD + clamp01(normalizedLoad) * (MAX_HEIGHT_WORLD - MIN_HEIGHT_WORLD);
    const [x, y, z] = worldPos;
    mesh.position.set(x, y + BASE_OFFSET_WORLD + height / 2, z);
    mesh.scale.set(1, height, 1);
    mesh.updateMatrix();
  }, [load, normalizedLoad, visible, worldPos]);

  return (
    <mesh
      ref={meshRef}
      name="beam-load-cylinder"
      visible={false}
      frustumCulled={false}
      renderOrder={14}
      userData={{
        source: 'beam-load-contention',
        channel: 'load',
      }}
    >
      <cylinderGeometry args={[RADIUS_WORLD, RADIUS_WORLD, 1, 28, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.95}
        transparent
        opacity={0.62}
        roughness={0.42}
        metalness={0.08}
        depthWrite={false}
      />
    </mesh>
  );
}
