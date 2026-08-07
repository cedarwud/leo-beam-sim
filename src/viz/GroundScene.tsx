import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  /** Display-only cue for a secondary UE selected by the live HO filter. */
  readonly isOtherHandover?: boolean;
}

interface GroundSceneProps {
  readonly ues: ReadonlyArray<GroundSceneUe>;
  readonly ueMarkerMultiplier?: number;
  readonly markerShape?: 'cylinder' | 'sphere';
  readonly ueTrailHistory?: UeTrailHistory;
  readonly secondaryOpacity?: number;
  readonly secondaryScale?: number;
  /**
   * Optional MESH-derived telemetry hook: when a lane owner passes a camelCase
   * dataset key (e.g. `'sinrServingMosaicColorCount'`, S2), the secondary
   * instanced markers publish the count of DISTINCT colours actually written to
   * the InstancedMesh `instanceColor` buffer to `gl.domElement.dataset[key]`.
   * This proves the per-UE colouring really landed on the mesh (a model-prop
   * observable would pass even if the colour write silently broke). Default
   * undefined — no publish, so it stays lane-owned by whoever passes it.
   */
  readonly colorTelemetryAttr?: string;
  /** UNLIT field mode — see {@link SecondaryUeInstancesProps.unlitMarkers}. */
  readonly unlitMarkers?: boolean;
}

/**
 * Count the distinct colours actually written to an InstancedMesh's
 * `instanceColor` buffer (over the live instance count) and publish to the
 * WebGL canvas dataset. MESH-derived (reads the buffer, not the input props).
 */
function publishInstanceColorTelemetry(
  gl: THREE.WebGLRenderer,
  attr: string | undefined,
  mesh: THREE.InstancedMesh,
  count: number,
): void {
  if (!attr) return;
  const instanceColor = mesh.instanceColor;
  if (!instanceColor || count <= 0) {
    gl.domElement.dataset[attr] = '0';
    return;
  }
  const seen = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    const r = Math.round(instanceColor.getX(i) * 255);
    const g = Math.round(instanceColor.getY(i) * 255);
    const b = Math.round(instanceColor.getZ(i) * 255);
    seen.add(`${r},${g},${b}`);
  }
  gl.domElement.dataset[attr] = String(seen.size);
}

/**
 * Marker SIZE (crowding, measured — not taste). The sinr-live default screen is
 * ~100 UEs on the 200x90 km paper user area (1375.9 x 619.1 world units, 1 wu =
 * 0.1454 km). Measured nearest-neighbour (NN) distance between the 99 secondary
 * markers on a warmed live frame:
 *   random    (default): min 13.3 / p05 19.5 / p25 29.8 / median 47.6 wu
 *   clustered          : min  0.1 / p05  2.7 / p25  7.4 / median 12.1 wu
 * At the previous MARKER_RADIUS = 26 the secondary cylinder radius was
 * 26*0.6 = 15.6 wu, i.e. a 31.2 wu DIAMETER against a 12.1 wu clustered median
 * NN — 94.9% of clustered markers overlapped a neighbour and 62.6% had a
 * neighbour's CENTRE inside their own disc (the "一坨" blob).
 *
 * MARKER_RADIUS = 10 is the LARGEST radius that satisfies "the median marker
 * does not overlap its nearest neighbour" on the worst distribution:
 * 2 * (10 * 0.6) = 12.0 wu <= clustered median NN 12.1 wu. Measured effect:
 * clustered overlap 94.9% -> 49.5%, centre-inside 62.6% -> 17.2%; the default
 * random distribution goes 26.3% -> 0.0%. Shrinking further hits a floor
 * (centre-inside plateaus at ~14% because the clustered generator emits pairs
 * ~0.1 wu apart — no marker size separates those) while costing legibility.
 * MARKER_HEIGHT shrinks by the SAME 10/26 ratio so the marker keeps its shape
 * (isotropic scale, not a re-proportioning).
 */
const MARKER_HEIGHT = 6;
const MARKER_RADIUS = 10;
const MARKER_RADIAL_SEGMENTS = 16;
const PRIMARY_COLOR = '#ff3333';
const PRIMARY_EMISSIVE = '#ff1111';
const SECONDARY_COLOR = '#00ffcc'; // cyber cyan for high contrast in dark mode
const SECONDARY_EMISSIVE = '#00aa88';
const SECONDARY_GLOW_STRENGTH = 1.6;
const SECONDARY_GLOW_PULSE_SPEED = 3.0;
const OTHER_HANDOVER_COLOR = '#facc15';
const OTHER_HANDOVER_RING_INNER_FACTOR = 1.65;
const OTHER_HANDOVER_RING_OUTER_FACTOR = 2.25;

/**
 * Marker OUTLINE (individuality under overlap). Size alone cannot fix the
 * clustered case — 49.5% of clustered markers still touch a neighbour at
 * MARKER_RADIUS = 10, and touching flat-shaded discs of the same colour fuse
 * into one silhouette. Each marker therefore carries a dark ANNULUS lifted just
 * above its own silhouette plane, so it is drawn OVER whatever neighbour disc it
 * overlaps and every marker keeps a visible boundary.
 *
 * Inner factor 0.94 < cos(pi/MARKER_RADIAL_SEGMENTS_SECONDARY=12) = 0.966, the
 * inradius/circumradius ratio of the 12-gon cylinder cross-section — so the ring
 * bites slightly INTO the coloured top face at every angle and leaves no
 * uncovered sliver between disc edge and stroke. Outer 1.5 gives a stroke
 * 0.56 * radius wide (~3.4 wu at the default scale ≈ 3 px at the default
 * camera): thick enough to read, thin enough that the coloured core still
 * dominates the marker.
 */
const SECONDARY_RIM_INNER_FACTOR = 0.94;
const SECONDARY_RIM_OUTER_FACTOR = 1.5;
const SECONDARY_RIM_SEGMENTS = 24;
/** Near-black with a cool cast so the stroke reads as shadow, not as a colour. */
const MARKER_RIM_COLOR = '#05070d';
/** World units the stroke sits above the marker silhouette plane (depth win). */
const MARKER_RIM_LIFT = 0.35;

interface SecondaryUeInstancesProps {
  readonly ues: ReadonlyArray<GroundSceneUe>;
  readonly ueMarkerMultiplier: number;
  readonly markerShape: 'cylinder' | 'sphere';
  readonly opacity: number;
  readonly scale: number;
  readonly colorTelemetryAttr?: string;
  /**
   * UNLIT field mode (P2 replay stage): render the instanced markers with an
   * unlit `meshBasicMaterial` so the per-instance colour IS the final pixel colour
   * (red starved / green served reads true — no fixed emissive wash) and the field
   * is cheaper (basic < standard, matches the demand-render perf budget). Default
   * (undefined/false) keeps the lit standard material for the live mosaic.
   */
  readonly unlitMarkers?: boolean;
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
  // Silhouette plane the outline stroke sits on: the flat top for the cylinder
  // marker, the equator for the sphere marker (both are the top-down outline).
  const rimY = markerShape === 'sphere' ? markerRadius : markerHeight;

  return (
    <group position={[x, y, z]}>
      {/*
        暗色半透明底盤以提高在複雜地景紋理上的視覺對比度。
        MARKER_RADIUS dropped 26 -> 10 to un-clump the ~100 UE field, so the
        plate factor rises 2.2 -> 4.2 to keep the protagonist's GROUND footprint
        (42 wu vs the previous 57.2 wu) in the same league — the primary must
        stay the obvious focus even though its core shrank with everyone else's.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0, markerRadius * 4.2, 32]} />
        <meshBasicMaterial
          color="#000000"
          opacity={0.65}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/*
        Protagonist halo: an annulus in the marker's own colour just outside the
        dark plate. Size shrank for everyone, so the primary is re-marked by a
        ring NO secondary marker carries — identity by ornament, not by bulk.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[markerRadius * 4.2, markerRadius * 5.0, 48]} />
        <meshBasicMaterial
          color={resolvedMarkerColor}
          opacity={0.85}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Same dark outline the secondary field wears — one visual language. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, rimY + MARKER_RIM_LIFT, 0]}>
        <ringGeometry
          args={[
            markerRadius * SECONDARY_RIM_INNER_FACTOR,
            markerRadius * SECONDARY_RIM_OUTER_FACTOR,
            SECONDARY_RIM_SEGMENTS,
          ]}
        />
        <meshBasicMaterial color={MARKER_RIM_COLOR} side={THREE.DoubleSide} />
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
        fontSize={14}
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

/**
 * Unlit field material (P2 replay stage): drives the emissive straight from the
 * per-instance colour so the red/green field POPS regardless of scene lighting
 * (a plain `vertexColors` diffuse stays dark in this dim scene, and the standard
 * material's fixed emissive would wash it teal). `vColor` carries the InstancedMesh
 * `instanceColor` when `vertexColors` is on. Unlit look, cheap, colour-true.
 */
function createUnlitFieldMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    // NB: do NOT set vertexColors here. The InstancedMesh's instanceColor already
    // defines USE_INSTANCING_COLOR → `varying vec3 vColor = instanceColor`. Adding
    // vertexColors (USE_COLOR) makes the shader ALSO do `vColor *= color` against the
    // UNBOUND geometry `color` attribute (defaults to 0,0,0), which zeroes vColor →
    // the whole field renders black. instanceColor alone gives the true per-UE colour.
    transparent: true,
    opacity: 1,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    // vColor here IS the per-instance colour (from USE_INSTANCING_COLOR). Drive the
    // emissive from it so the field is unlit-bright and colour-true (red starved /
    // green served) regardless of the dim scene lighting.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      ['#include <emissivemap_fragment>', 'totalEmissiveRadiance = vColor.rgb;'].join('\n'),
    );
  };
  // NB: do NOT pin customProgramCacheKey to a constant here — that would cache the
  // program compiled BEFORE the InstancedMesh's instanceColor exists (USE_INSTANCING_COLOR
  // undefined) and reuse it after, so vColor never picks up the per-instance colour and the
  // field renders black. Three's default cache key already folds in the shader defines.
  return material;
}

function SecondaryUePlainInstances({
  ues,
  ueMarkerMultiplier,
  markerShape,
  opacity,
  scale,
  colorTelemetryAttr,
  unlitMarkers = false,
}: SecondaryUeInstancesProps) {
  const gl = useThree(state => state.gl);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const unlitMaterial = useMemo(
    () => (unlitMarkers ? createUnlitFieldMaterial() : null),
    [unlitMarkers],
  );
  useEffect(() => () => { unlitMaterial?.dispose(); }, [unlitMaterial]);
  useLayoutEffect(() => {
    if (unlitMaterial) unlitMaterial.opacity = opacity;
  }, [unlitMaterial, opacity]);
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
    publishInstanceColorTelemetry(gl, colorTelemetryAttr, mesh, ues.length);
  }, [ues, color, dummy, gl, colorTelemetryAttr, markerHeight, markerRadius, markerShape, ueMarkerMultiplier]);

  useEffect(() => () => {
    if (colorTelemetryAttr) delete gl.domElement.dataset[colorTelemetryAttr];
  }, [gl, colorTelemetryAttr]);

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
      {unlitMaterial ? (
        // P2 replay stage: unlit — emissive = per-instance colour (red/green pops).
        <primitive object={unlitMaterial} attach="material" />
      ) : (
        <meshStandardMaterial
          color="#ffffff"
          emissive={SECONDARY_EMISSIVE}
          emissiveIntensity={1.4}
          vertexColors
          transparent
          opacity={opacity}
          blending={THREE.NormalBlending}
        />
      )}
    </instancedMesh>
  );
}

function SecondaryUeGlowInstances({
  ues,
  ueMarkerMultiplier,
  markerShape,
  opacity,
  scale,
  colorTelemetryAttr,
}: SecondaryUeInstancesProps) {
  const gl = useThree(state => state.gl);
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
    publishInstanceColorTelemetry(gl, colorTelemetryAttr, mesh, ues.length);
  }, [
    ues,
    color,
    dummy,
    gl,
    colorTelemetryAttr,
    markerHeight,
    markerRadius,
    markerShape,
    ueMarkerMultiplier,
  ]);

  useEffect(() => () => {
    if (colorTelemetryAttr) delete gl.domElement.dataset[colorTelemetryAttr];
  }, [gl, colorTelemetryAttr]);

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

/**
 * Dark outline stroke for the secondary UE field — the anti-blob layer.
 *
 * One extra InstancedMesh (one draw call for the whole field) of flat annuli,
 * one per marker, lifted {@link MARKER_RIM_LIFT} above that marker's silhouette
 * plane. Because every stroke sits ABOVE every coloured core, an overlapping
 * neighbour's core is drawn UNDER this marker's stroke, so two touching markers
 * still show a hard boundary instead of fusing into one blob. It carries NO
 * per-instance colour: a neutral stroke separates two same-colour neighbours
 * (the case a colour-derived stroke cannot), and the colour telemetry stays on
 * the core mesh where the mosaic claim is made.
 *
 * The core radius is mirrored from the core meshes EXACTLY, including their
 * cylinder/sphere asymmetry (the cylinder lane ignores `scale`), so the stroke
 * can never drift off the disc it outlines.
 */
function SecondaryUeRimInstances({
  ues,
  ueMarkerMultiplier,
  markerShape,
  opacity,
  scale,
}: SecondaryUeInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const coreRadius = markerShape === 'sphere'
    ? MARKER_RADIUS * 0.45 * ueMarkerMultiplier * scale
    : MARKER_RADIUS * 0.6 * ueMarkerMultiplier;
  const markerHeight = MARKER_HEIGHT * 0.7 * ueMarkerMultiplier * scale;
  const silhouetteY = markerShape === 'sphere' ? coreRadius : markerHeight;

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    for (let i = 0; i < ues.length; i++) {
      const [x, y, z] = ues[i].worldPos;
      dummy.position.set(x, y + silhouetteY + MARKER_RIM_LIFT, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = ues.length;
  }, [ues, dummy, silhouetteY]);

  if (ues.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(ues.length, 1)]}
    >
      <ringGeometry
        args={[
          coreRadius * SECONDARY_RIM_INNER_FACTOR,
          coreRadius * SECONDARY_RIM_OUTER_FACTOR,
          SECONDARY_RIM_SEGMENTS,
        ]}
      />
      <meshBasicMaterial
        color={MARKER_RIM_COLOR}
        side={THREE.DoubleSide}
        transparent
        opacity={opacity}
      />
    </instancedMesh>
  );
}

/**
 * High-contrast ring for the small, user-selected secondary-UE set. The normal
 * UE field remains instanced and colour-coded; only the capped handover subset
 * gets these lightweight per-UE rings, so the checkbox has an unmistakable cue
 * without turning every marker into a label or a separate mesh.
 */
function SecondaryUeHandoverRings({
  ues,
  ueMarkerMultiplier,
  markerShape,
  scale,
}: SecondaryUeInstancesProps) {
  const handoverUes = useMemo(
    () => ues.filter(ue => ue.isOtherHandover),
    [ues],
  );
  const coreRadius = markerShape === 'sphere'
    ? MARKER_RADIUS * 0.45 * ueMarkerMultiplier * scale
    : MARKER_RADIUS * 0.6 * ueMarkerMultiplier;
  const markerHeight = MARKER_HEIGHT * 0.7 * ueMarkerMultiplier * scale;
  const silhouetteY = markerShape === 'sphere' ? coreRadius : markerHeight;

  if (handoverUes.length === 0) return null;

  return (
    <group>
      {handoverUes.map((ue, index) => {
        const [x, y, z] = ue.worldPos;
        return (
          <group key={`other-handover-highlight-${ue.id ?? `${x}-${z}-${index}`}`}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[x, y + silhouetteY + MARKER_RIM_LIFT + 0.12, z]}
            >
              <ringGeometry
                args={[
                  coreRadius * OTHER_HANDOVER_RING_INNER_FACTOR,
                  coreRadius * OTHER_HANDOVER_RING_OUTER_FACTOR,
                  32,
                ]}
              />
              <meshBasicMaterial
                color={OTHER_HANDOVER_COLOR}
                side={THREE.DoubleSide}
                transparent
                opacity={0.98}
                depthWrite={false}
              />
            </mesh>
            <Text
              position={[x, y + silhouetteY + 14 * ueMarkerMultiplier, z]}
              fontSize={7 * ueMarkerMultiplier}
              color={OTHER_HANDOVER_COLOR}
              anchorX="center"
              anchorY="middle"
              outlineWidth={1}
              outlineColor="#05070d"
            >
              HO
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function SecondaryUeInstances(props: SecondaryUeInstancesProps) {
  const glowEnabled = props.ues.some(ue => ue.contention !== undefined);
  return (
    <>
      <SecondaryUeRimInstances {...props} />
      <SecondaryUeHandoverRings {...props} />
      {glowEnabled
        ? <SecondaryUeGlowInstances {...props} />
        : <SecondaryUePlainInstances {...props} />}
    </>
  );
}

export function GroundScene({
  ues,
  ueMarkerMultiplier = 1.0,
  markerShape = 'cylinder',
  ueTrailHistory,
  secondaryOpacity = 0.9,
  secondaryScale = 1,
  colorTelemetryAttr,
  unlitMarkers = false,
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
        colorTelemetryAttr={colorTelemetryAttr}
        unlitMarkers={unlitMarkers}
      />
    </group>
  );
}
