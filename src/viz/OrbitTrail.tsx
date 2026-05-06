import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VisibleSat } from '../scene/types';

export const ORBIT_TRAIL_SAMPLE_COUNT = 25;
export const ORBIT_TRAIL_SAMPLE_INTERVAL_SEC = 0.2;
export const ORBIT_TRAIL_HEAD_OPACITY = 0.6;
export const ORBIT_TRAIL_TAIL_OPACITY = 0;
export const ORBIT_TRAIL_OPACITY_FLOOR = 0.06;
export const ORBIT_TRAIL_FALLBACK_COLOR = '#ffffff';

const ORBIT_TRAIL_VERTEX_SHADER = `
attribute float trailOpacity;
varying float vTrailOpacity;

void main() {
  vTrailOpacity = trailOpacity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ORBIT_TRAIL_FRAGMENT_SHADER = `
uniform vec3 trailColor;
varying float vTrailOpacity;

void main() {
  if (vTrailOpacity < ${ORBIT_TRAIL_OPACITY_FLOOR.toFixed(3)}) discard;
  gl_FragColor = vec4(trailColor, vTrailOpacity);
}
`;

export interface OrbitTrailPlan {
  id: string;
  satelliteId: string;
  color: string;
  sampleCount: number;
  opacities: number[];
}

export function resolveOrbitTrailOpacity(
  sampleIndex: number,
  sampleCount = ORBIT_TRAIL_SAMPLE_COUNT,
): number {
  const clampedIndex = Math.max(0, Math.min(sampleCount - 1, Math.floor(sampleIndex)));
  const denominator = Math.max(1, sampleCount - 1);
  const opacity = ORBIT_TRAIL_HEAD_OPACITY
    + (ORBIT_TRAIL_TAIL_OPACITY - ORBIT_TRAIL_HEAD_OPACITY) * (clampedIndex / denominator);

  return opacity >= ORBIT_TRAIL_OPACITY_FLOOR ? opacity : 0;
}

export function createOrbitTrailOpacitySamples(sampleCount = ORBIT_TRAIL_SAMPLE_COUNT): number[] {
  return Array.from({ length: sampleCount }, (_, index) => resolveOrbitTrailOpacity(index, sampleCount));
}

export function createOrbitTrailSamples(
  position: THREE.Vector3,
  sampleCount = ORBIT_TRAIL_SAMPLE_COUNT,
): THREE.Vector3[] {
  return Array.from({ length: sampleCount }, () => position.clone());
}

export function advanceOrbitTrailSamples(samples: THREE.Vector3[], nextPosition: THREE.Vector3): void {
  for (let index = samples.length - 1; index > 0; index -= 1) {
    samples[index].copy(samples[index - 1]);
  }
  samples[0].copy(nextPosition);
}

export function createOrbitTrailGeometry(samples: THREE.Vector3[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(samples.length * 3);
  const opacities = new Float32Array(createOrbitTrailOpacitySamples(samples.length));

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('trailOpacity', new THREE.BufferAttribute(opacities, 1));
  writeOrbitTrailGeometryPositions(geometry, samples);

  return geometry;
}

export function writeOrbitTrailGeometryPositions(
  geometry: THREE.BufferGeometry,
  samples: THREE.Vector3[],
): void {
  const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!positionAttribute) return;

  const positions = positionAttribute.array as Float32Array;
  samples.forEach((sample, index) => {
    const offset = index * 3;
    positions[offset] = sample.x;
    positions[offset + 1] = sample.y;
    positions[offset + 2] = sample.z;
  });

  positionAttribute.needsUpdate = true;
}

export function resolveOrbitTrailPlans(input: {
  satellites: Pick<VisibleSat, 'id' | 'satelliteTintColor'>[];
  enabled?: boolean;
  reducedMotion?: boolean;
  sampleCount?: number;
}): OrbitTrailPlan[] {
  if (input.enabled === false || input.reducedMotion) return [];

  const sampleCount = input.sampleCount ?? ORBIT_TRAIL_SAMPLE_COUNT;
  const opacities = createOrbitTrailOpacitySamples(sampleCount);

  return input.satellites.map(satellite => ({
    id: `orbit-trail-${satellite.id}`,
    satelliteId: satellite.id,
    color: satellite.satelliteTintColor ?? ORBIT_TRAIL_FALLBACK_COLOR,
    sampleCount,
    opacities,
  }));
}

function createOrbitTrailMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      trailColor: { value: new THREE.Color(color) },
    },
    vertexShader: ORBIT_TRAIL_VERTEX_SHADER,
    fragmentShader: ORBIT_TRAIL_FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
  });
}

export function OrbitTrailPrimitive({
  geometry,
  color,
  renderOrder = 16,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  renderOrder?: number;
}) {
  const line = useMemo(() => {
    const material = createOrbitTrailMaterial(color);
    const trailLine = new THREE.Line(geometry, material);
    trailLine.frustumCulled = false;
    trailLine.renderOrder = renderOrder;
    return trailLine;
  }, [color, geometry, renderOrder]);

  useEffect(() => {
    const material = line.material as THREE.ShaderMaterial;
    material.uniforms.trailColor.value.set(color);
  }, [color, line]);

  useEffect(() => () => {
    (line.material as THREE.ShaderMaterial).dispose();
  }, [line]);

  return <primitive object={line} />;
}

function OrbitTrailLine({ satellite }: { satellite: VisibleSat }) {
  const initialSamples = useMemo(
    () => createOrbitTrailSamples(satellite.world, ORBIT_TRAIL_SAMPLE_COUNT),
    [satellite.id],
  );
  const samplesRef = useRef(initialSamples);
  const lastSampleAtSecRef = useRef<number | null>(null);
  const geometry = useMemo(
    () => createOrbitTrailGeometry(samplesRef.current),
    [satellite.id],
  );
  const color = satellite.satelliteTintColor ?? ORBIT_TRAIL_FALLBACK_COLOR;

  useFrame(({ clock }) => {
    const elapsedSec = clock.getElapsedTime();
    const lastSampleAtSec = lastSampleAtSecRef.current;

    if (lastSampleAtSec === null || elapsedSec < lastSampleAtSec) {
      lastSampleAtSecRef.current = elapsedSec;
      samplesRef.current[0].copy(satellite.world);
      writeOrbitTrailGeometryPositions(geometry, samplesRef.current);
      return;
    }

    const missedSamples = Math.min(
      ORBIT_TRAIL_SAMPLE_COUNT - 1,
      Math.floor((elapsedSec - lastSampleAtSec) / ORBIT_TRAIL_SAMPLE_INTERVAL_SEC),
    );

    for (let index = 0; index < missedSamples; index += 1) {
      advanceOrbitTrailSamples(samplesRef.current, satellite.world);
    }

    if (missedSamples > 0) {
      lastSampleAtSecRef.current = lastSampleAtSec + missedSamples * ORBIT_TRAIL_SAMPLE_INTERVAL_SEC;
    }

    samplesRef.current[0].copy(satellite.world);
    writeOrbitTrailGeometryPositions(geometry, samplesRef.current);
  });

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  return <OrbitTrailPrimitive geometry={geometry} color={color} />;
}

export function OrbitTrail({
  satellites,
  enabled = true,
  reducedMotion = false,
}: {
  satellites: VisibleSat[];
  enabled?: boolean;
  reducedMotion?: boolean;
}) {
  const plans = useMemo(
    () => resolveOrbitTrailPlans({ satellites, enabled, reducedMotion }),
    [enabled, reducedMotion, satellites],
  );
  const activeSatelliteIds = new Set(plans.map(plan => plan.satelliteId));

  if (plans.length === 0) return null;

  return (
    <group>
      {satellites
        .filter(satellite => activeSatelliteIds.has(satellite.id))
        .map(satellite => (
          <OrbitTrailLine key={satellite.id} satellite={satellite} />
        ))}
    </group>
  );
}
