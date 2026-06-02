import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { UeTrailHistory } from '../scene/useUeTrailHistory';
import { UeTrail } from './UeTrail';

/**
 * GroundScene — UE markers (one per scene-frame UE).
 *
 * P2 (SDD §9): generalized from single-UE `(ueGroundX, ueGroundZ)` to a
 * multi-UE input. Array length matches `NormalizedSceneFrame.ues`:
 *   - live path (R6 invariant): exactly 1 element
 *   - replay path: up to ~100 elements (trigger artifact's UE count)
 *
 * Rendering technique:
 *   - When the input has >1 UE we use `THREE.InstancedMesh` so all
 *     non-primary UE markers share one draw call.
 *   - The primary UE (index 0) is drawn as a separate non-instanced mesh
 *     so its label can be a real `<Text>` element (instanced labels would
 *     require a different code path and aren't worth it for a single
 *     primary marker).
 *   - When the input has exactly 1 UE we render only the primary mesh —
 *     this keeps the live single-UE path visually identical to pre-P2.
 *
 * No ground plane (NTPU scene provides the ground). No SINR / handover /
 * link physics here — purely a positional marker.
 */

export interface GroundSceneUe {
  /** World-space anchor `[x, y, z]`. Y is height-above-ground. */
  readonly worldPos: readonly [number, number, number];
  readonly id?: string;
  readonly markerColor?: string;
  readonly markerEmissive?: string;
  readonly contention?: number;
}

interface GroundSceneProps {
  readonly ues: ReadonlyArray<GroundSceneUe>;
  readonly ueMarkerMultiplier?: number;
  readonly markerShape?: 'cylinder' | 'sphere';
  readonly ueTrailHistory?: UeTrailHistory;
  readonly secondaryOpacity?: number;
  readonly secondaryScale?: number;
}

const MARKER_HEIGHT = 16;
const MARKER_RADIUS = 26;
const MARKER_RADIAL_SEGMENTS = 16;
const PRIMARY_COLOR = '#ff3333';
const PRIMARY_EMISSIVE = '#ff1111';
const SECONDARY_COLOR = '#00ffcc'; // cyber cyan for high contrast in dark mode
const SECONDARY_EMISSIVE = '#00aa88';
const SECONDARY_GLOW_STRENGTH = 1.6;
const SECONDARY_GLOW_PULSE_SPEED = 3.0;

interface SecondaryUeInstancesProps {
  readonly ues: ReadonlyArray<GroundSceneUe>;
  readonly ueMarkerMultiplier: number;
  readonly markerShape: 'cylinder' | 'sphere';
  readonly opacity: number;
  readonly scale: number;
}

interface ShaderNumberUniform {
  value: number;
}

function PrimaryUeMarker({
  x,
  y,
  z,
  ueMarkerMultiplier,
  markerShape,
  markerColor,
  markerEmissive,
}: {
  x: number;
  y: number;
  z: number;
  ueMarkerMultiplier: number;
  markerShape: 'cylinder' | 'sphere';
  markerColor?: string;
  markerEmissive?: string;
}) {
  const markerRadius = MARKER_RADIUS * ueMarkerMultiplier;
  const markerHeight = MARKER_HEIGHT * ueMarkerMultiplier;
  const markerY = markerShape === 'sphere'
    ? markerRadius
    : markerHeight / 2;
  const labelY = markerShape === 'sphere'
    ? markerRadius * 2.2
    : 18 * ueMarkerMultiplier;
  const resolvedMarkerColor = markerColor ?? PRIMARY_COLOR;
  const resolvedMarkerEmissive = markerEmissive ?? markerColor ?? PRIMARY_EMISSIVE;

  return (
    <group position={[x, y, z]}>
      {/* 暗色半透明底盤以提高在複雜地景紋理上的視覺對比度 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0, markerRadius * 2.2, 32]} />
        <meshBasicMaterial
          color="#000000"
          opacity={0.65}
          transparent
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, markerY, 0]}>
        {markerShape === 'sphere' ? (
          <sphereGeometry args={[markerRadius, 20, 14]} />
        ) : (
          <cylinderGeometry
            args={[
              markerRadius,
              markerRadius,
              markerHeight,
              MARKER_RADIAL_SEGMENTS,
            ]}
          />
        )}
        <meshStandardMaterial
          color={resolvedMarkerColor}
          emissive={resolvedMarkerEmissive}
          emissiveIntensity={2.5}
        />
      </mesh>
      <Text
        position={[0, labelY, 0]}
        fontSize={12}
        color={resolvedMarkerColor}
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

function clampContention(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value ?? 0));
}

function createSecondaryContentionMaterial(
  uTimeUniformRef: MutableRefObject<ShaderNumberUniform | null>,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: SECONDARY_EMISSIVE,
    emissiveIntensity: 1.4,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.NormalBlending,
  });

  material.onBeforeCompile = (shader) => {
    const uTime: ShaderNumberUniform = { value: 0 };
    shader.uniforms.uTime = uTime;
    shader.uniforms.uGlowStrength = { value: SECONDARY_GLOW_STRENGTH };
    shader.uniforms.uPulseSpeed = { value: SECONDARY_GLOW_PULSE_SPEED };
    uTimeUniformRef.current = uTime;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'attribute float aContention;',
          'varying float vContention;',
        ].join('\n'),
      )
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vContention = aContention;',
        ].join('\n'),
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'uniform float uTime;',
          'uniform float uGlowStrength;',
          'uniform float uPulseSpeed;',
          'varying float vContention;',
        ].join('\n'),
      )
      .replace(
        '#include <emissivemap_fragment>',
        [
          '#include <emissivemap_fragment>',
          'float contentionGlow = clamp(vContention, 0.0, 1.0);',
          'float contentionPulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
          'totalEmissiveRadiance *= (1.0 + uGlowStrength * contentionGlow * contentionPulse);',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'secondary-ue-contention-glow-v1';
  return material;
}

function SecondaryUePlainInstances({
  ues,
  ueMarkerMultiplier,
  markerShape,
  opacity,
  scale,
}: SecondaryUeInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const markerRadius = MARKER_RADIUS * 0.45 * ueMarkerMultiplier * scale;
  const markerHeight = MARKER_HEIGHT * 0.7 * ueMarkerMultiplier * scale;

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    for (let i = 0; i < ues.length; i++) {
      const ue = ues[i];
      const [x, y, z] = ue.worldPos;
      // 1. 主體標記的位置更新
      dummy.position.set(
        x,
        y + (markerShape === 'sphere' ? markerRadius : markerHeight / 2),
        z,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(ue.markerColor ?? SECONDARY_COLOR);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = ues.length;
  }, [ues, color, dummy, markerHeight, markerRadius, markerShape, ueMarkerMultiplier]);

  if (ues.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(ues.length, 1)]}
    >
      {markerShape === 'sphere' ? (
        <sphereGeometry args={[markerRadius, 14, 10]} />
      ) : (
        <cylinderGeometry
          args={[
            MARKER_RADIUS * 0.6 * ueMarkerMultiplier,
            MARKER_RADIUS * 0.6 * ueMarkerMultiplier,
            markerHeight,
            12,
          ]}
        />
      )}
      <meshStandardMaterial
        color="#ffffff"
        emissive={SECONDARY_EMISSIVE}
        emissiveIntensity={1.4}
        vertexColors
        transparent
        opacity={opacity}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

function SecondaryUeGlowInstances({
  ues,
  ueMarkerMultiplier,
  markerShape,
  opacity,
  scale,
}: SecondaryUeInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const markerRadius = MARKER_RADIUS * 0.45 * ueMarkerMultiplier * scale;
  const markerHeight = MARKER_HEIGHT * 0.7 * ueMarkerMultiplier * scale;
  const uTimeUniformRef = useRef<ShaderNumberUniform | null>(null);
  const contentionAttributeRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const glowMaterial = useMemo(
    () => createSecondaryContentionMaterial(uTimeUniformRef),
    [],
  );

  useLayoutEffect(() => {
    glowMaterial.opacity = opacity;
  }, [glowMaterial, opacity]);

  useEffect(() => () => {
    uTimeUniformRef.current = null;
    glowMaterial.dispose();
  }, [glowMaterial]);

  useFrame((state) => {
    if (uTimeUniformRef.current) {
      uTimeUniformRef.current.value = state.clock.elapsedTime;
    }
  });

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const capacity = Math.max(ues.length, 1);
    let contentionAttribute = contentionAttributeRef.current;
    if (!contentionAttribute || contentionAttribute.count !== capacity) {
      contentionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      contentionAttributeRef.current = contentionAttribute;
    }
    if (mesh.geometry.getAttribute('aContention') !== contentionAttribute) {
      mesh.geometry.setAttribute('aContention', contentionAttribute);
    }

    for (let i = 0; i < ues.length; i++) {
      const ue = ues[i];
      const [x, y, z] = ue.worldPos;
      dummy.position.set(
        x,
        y + (markerShape === 'sphere' ? markerRadius : markerHeight / 2),
        z,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(ue.markerColor ?? SECONDARY_COLOR);
      mesh.setColorAt(i, color);
      contentionAttribute.setX(i, clampContention(ue.contention));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    contentionAttribute.needsUpdate = true;
    mesh.count = ues.length;
  }, [ues, color, dummy, markerHeight, markerRadius, markerShape, ueMarkerMultiplier]);

  if (ues.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(ues.length, 1)]}
    >
      {markerShape === 'sphere' ? (
        <sphereGeometry args={[markerRadius, 14, 10]} />
      ) : (
        <cylinderGeometry
          args={[
            MARKER_RADIUS * 0.6 * ueMarkerMultiplier,
            MARKER_RADIUS * 0.6 * ueMarkerMultiplier,
            markerHeight,
            12,
          ]}
        />
      )}
      <primitive object={glowMaterial} attach="material" />
    </instancedMesh>
  );
}

function SecondaryUeInstances(props: SecondaryUeInstancesProps) {
  const glowEnabled = props.ues.some(ue => ue.contention !== undefined);
  if (!glowEnabled) return <SecondaryUePlainInstances {...props} />;
  return <SecondaryUeGlowInstances {...props} />;
}

export function GroundScene({
  ues,
  ueMarkerMultiplier = 1.0,
  markerShape = 'cylinder',
  ueTrailHistory,
  secondaryOpacity = 0.9,
  secondaryScale = 1,
}: GroundSceneProps) {
  const secondaryUes = useMemo(
    () => ues.slice(1),
    [ues],
  );
  if (ues.length === 0) {
    return ueTrailHistory !== undefined ? <UeTrail history={ueTrailHistory} /> : null;
  }
  const primary = ues[0];
  const [px, py, pz] = primary.worldPos;
  return (
    <group>
      {ueTrailHistory !== undefined && <UeTrail history={ueTrailHistory} />}
      <PrimaryUeMarker
        x={px}
        y={py}
        z={pz}
        ueMarkerMultiplier={ueMarkerMultiplier}
        markerShape={markerShape}
        markerColor={primary.markerColor}
        markerEmissive={primary.markerEmissive}
      />
      <SecondaryUeInstances
        ues={secondaryUes}
        ueMarkerMultiplier={ueMarkerMultiplier}
        markerShape={markerShape}
        opacity={secondaryOpacity}
        scale={secondaryScale}
      />
    </group>
  );
}
