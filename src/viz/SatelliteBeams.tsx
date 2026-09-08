/**
 * ⚠️ NOT MOUNTED IN-APP ON ANY LANE (Tier-2 dead-twin retirement, 2026-06-14).
 *
 * This is the legacy STEERED beam renderer (apex at the satellite, footprint
 * glued under the UE). It was retired in-app: on the sinr-live lane the steered
 * cones were replaced by the earth-fixed cell-truth cones (S-cells-3), and its
 * MainScene mount was gated `showLiveBeamCones && !showSinrLiveCellBeams` = a
 * provably-false `X && !X`, so it never rendered anyway. The dead mount made
 * MainScene falsely point here as if this were the live renderer — the
 * "改波束改不對 / edit the wrong file" trap. It is gone.
 *
 * 👉 To change the LIVE sinr-live beam DISPLAY, edit:
 *      - src/viz/SinrLiveCellBeamCones.tsx     (the cone renderer)
 *      - src/constants/sinrLiveConeStyle.ts     (colour / opacity resolver)
 *
 * This component survives ONLY as the render subject of the vc1c/vc2 validation
 * fixtures (src/validation/vc1cFrequencyDemotionFixture.tsx +
 * vc2NonTextChannelsFixture.tsx) and the beamConeRoleFactors test. Do NOT delete
 * the file or its exports (BeamCalloutContent / BeamPulseClock / BeamTarget) —
 * ~9 vc-family validators import them. It is just no longer in the scene graph.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { resolveBeamConeRoleFactors } from './beamConeRoleFactors';
import {
  BEAM_ROLE_TOKENS,
  HANDOVER_ARROW_COLOR,
  HANDOVER_SOURCE_COLOR,
  HANDOVER_TARGET_COLOR,
  INTRA_HANDOVER_TARGET_COLOR,
  frequencyReuseColor,
  resolveBeamPulseOpacity,
  resolveHandoverVisualTransition,
  resolveBeamVisualEncoding,
} from '../constants/beamRoleTokens';
import {
  createGlyphFillGeometry,
  createGlyphOutlinePoints,
} from './glyphs';
import type { CinematicMode } from '../scene/types';
import type { BeamTarget } from '../scene/beamTargetTypes';
import { isSpotlightMode, resolveCinematicConeOpacityMultiplier } from '../scene/cinematicEffects';
import { BeamCalloutContent, formatBeamSinrWithKind } from './BeamCalloutContent';
import { registerPulseTarget } from './beamPulseMaterials';

export { BeamCalloutContent } from './BeamCalloutContent';
export { BeamPulseClock } from './beamPulseMaterials';
export type { BeamTarget } from '../scene/beamTargetTypes';

interface SatelliteBeamsProps {
  satelliteId: string;
  satellitePosition: THREE.Vector3;
  beams: BeamTarget[];
  footprintRadius: number; // world units
  reducedMotion?: boolean;
  cinematicMode?: CinematicMode;
  showCallouts?: boolean;
}

const SEGMENTS = 32;
const DISC_OUTER_RING_THICKNESS_WORLD = 2.4;
const DISC_INNER_ROLE_RING_GAP_WORLD = 3;
const DISC_INNER_ROLE_RING_THICKNESS_WORLD = 1.8;
const DISC_FREQUENCY_RING_THICKNESS_WORLD = 1.1;

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function createObliqueConeSide(
  apex: THREE.Vector3,
  centerX: number,
  centerZ: number,
  radius: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  positions.push(apex.x, apex.y, apex.z);

  for (let i = 0; i < SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * Math.PI * 2;
    positions.push(
      centerX + Math.cos(angle) * radius,
      0,
      centerZ + Math.sin(angle) * radius,
    );
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const next = (i + 1) % SEGMENTS;
    indices.push(0, i + 1, next + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createCalloutLayout(
  beam: BeamTarget,
  footprintRadius: number,
): {
  points: [number, number, number][];
  labelPosition: [number, number, number];
} {
  const radialLength = Math.hypot(beam.groundX, beam.groundZ);
  const fallbackAngle = ((beam.beamId - 1) / 7) * Math.PI * 2 - Math.PI / 2;
  const dirX = radialLength > 1e-6 ? beam.groundX / radialLength : Math.cos(fallbackAngle);
  const dirZ = radialLength > 1e-6 ? beam.groundZ / radialLength : Math.sin(fallbackAngle);
  const outwardDistance = footprintRadius * (beam.isPrimary || beam.isServing ? 1.7 : 1.45);
  const elbowDistance = footprintRadius * 0.58;
  const height = 28 + (beam.frequencyIndex % 3) * 5 + (beam.isPrimary || beam.isServing ? 6 : 0);
  const elbow: [number, number, number] = [
    beam.groundX + dirX * elbowDistance,
    height * 0.55,
    beam.groundZ + dirZ * elbowDistance,
  ];
  const labelPosition: [number, number, number] = [
    beam.groundX + dirX * outwardDistance,
    height,
    beam.groundZ + dirZ * outwardDistance,
  ];

  return {
    points: [
      [beam.groundX, 4, beam.groundZ],
      elbow,
      labelPosition,
    ],
    labelPosition,
  };
}

function BeamCone({
  beamKey,
  satelliteId,
  satellitePosition,
  beam,
  footprintRadius,
  reducedMotion,
  cinematicMode,
  hasSomeServing,
  showCallouts,
}: {
  beamKey: string;
  satelliteId: string;
  satellitePosition: THREE.Vector3;
  beam: BeamTarget;
  footprintRadius: number;
  reducedMotion: boolean;
  cinematicMode: CinematicMode;
  hasSomeServing: boolean;
  showCallouts: boolean;
}) {
  const style = resolveBeamVisualEncoding({
    role: beam.role,
    isPrimary: beam.isPrimary,
    isServing: beam.isServing,
    isScheduledActive: beam.isScheduledActive,
    frequencyColor: frequencyReuseColor(beam.frequencyIndex),
    identityColor: beam.satelliteTintColor,
    preferIdentityColor: beam.visualColorSource === 'satellite',
  });
  const color = style.color;
  // Paper §III φ1/φ2 distinguishes intra- vs inter-satellite handover; no
  // source-truth file specifies frequency-colour semantics for this renderer.
  const loadIntensity = 0.45 + 0.55 * clampOpacity(beam.loadRatio ?? 0);
  const handoverRole = beam.handoverRole ?? null;
  const isHandoverSource = handoverRole === 'intraSource' || handoverRole === 'interSource';
  const isHandoverTarget = handoverRole === 'intraTargetNewServing' || handoverRole === 'interTargetNewServing';
  // P4: per-role visual factors collected in one pure helper (was ~9 scattered
  // inline (isHandoverTarget ? : isHandoverSource ? :) ternaries). Values are
  // byte-identical; the runtime opacity/line composition stays inline below.
  const roleFactors = resolveBeamConeRoleFactors(isHandoverSource, isHandoverTarget);
  const handoverTransition = resolveHandoverVisualTransition({
    role: handoverRole,
    progress: beam.handoverTransitionProgress ?? 1,
    reducedMotion,
  });
  // The TARGET colour is the one that tells the two event kinds apart: an
  // intra-switch lands on the same satellite (orange, serving family), an
  // inter-handover lands on a different one (candidate blue). The source beam is
  // serving-yellow either way, so it is not routed per kind.
  const handoverOverlayColor =
    isHandoverSource
      ? HANDOVER_SOURCE_COLOR
      : isHandoverTarget
        ? (handoverRole === 'intraTargetNewServing'
          ? INTRA_HANDOVER_TARGET_COLOR
          : HANDOVER_TARGET_COLOR)
        : null;
  const displayColor = handoverOverlayColor ?? color;
  const baseConeOpacity = isHandoverSource
    ? Math.max(style.coneOpacity, BEAM_ROLE_TOKENS.serving.coneOpacity)
    : style.coneOpacity;
  const coneOpacity = baseConeOpacity * loadIntensity * resolveCinematicConeOpacityMultiplier(
    style.visualRole,
    cinematicMode,
  );
  const eventRoleSurface = style.visualRole !== 'otherActive' && style.visualRole !== 'inactive';
  const roleSurface = eventRoleSurface || handoverOverlayColor !== null;
  const spotlightEventSurface =
    isSpotlightMode(cinematicMode)
    && (style.visualRole === 'serving' || style.visualRole === 'pending' || handoverOverlayColor !== null);
  const discFillColor = roleSurface ? displayColor : color;
  const discOpacity = isHandoverSource
    ? Math.max(style.discOpacity, BEAM_ROLE_TOKENS.serving.discOpacity)
    : style.discOpacity * loadIntensity;
  const coneMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  // Destructure to primitives so useMemo deps are stable between renders
  const sx = satellitePosition.x, sy = satellitePosition.y, sz = satellitePosition.z;
  const gx = beam.groundX, gz = beam.groundZ;
  const satelliteTintColor = beam.satelliteTintColor;
  const satelliteGlyph = beam.satelliteGlyph;

  const coneGeo = useMemo(
    () => createObliqueConeSide(new THREE.Vector3(sx, sy, sz), gx, gz, footprintRadius),
    [sx, sy, sz, gx, gz, footprintRadius],
  );

  const callout = useMemo(
    () => createCalloutLayout(beam, footprintRadius),
    [beam, footprintRadius],
  );
  const glyphFillGeo = useMemo(
    () => createGlyphFillGeometry(satelliteGlyph, style.endpointRadius),
    [satelliteGlyph, style.endpointRadius],
  );
  const glyphOutlinePoints = useMemo(
    () => createGlyphOutlinePoints(satelliteGlyph, style.endpointRadius * 1.28),
    [satelliteGlyph, style.endpointRadius],
  );
  const sinrLabel = formatBeamSinrWithKind(beam.sinrDb, beam.channelMetricKind);
  const isEmphasized = style.isEmphasized;
  const isForegroundBeam = beam.isServing || style.isEmphasized || handoverOverlayColor !== null;
  const dimFactor = (() => {
    if (!hasSomeServing) return 1.0;
    if (isHandoverSource || isHandoverTarget) return handoverTransition.dimFactor;
    if (beam.isServing) return 1.0;
    if (isForegroundBeam) return 0.82;
    return 0.32;
  })();
  const handoverSurfaceScale = handoverRole ? handoverTransition.surfaceScale : 1;
  const handoverLineScale = handoverRole ? handoverTransition.lineScale : 1;
  const handoverCalloutScale = handoverRole ? handoverTransition.calloutScale : 1;
  const yLift = handoverRole ? handoverTransition.yLift : beam.isServing ? 6.0 : 0;
  const discUniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(discFillColor) },
    uOpacity: { value: clampOpacity(discOpacity * dimFactor * handoverSurfaceScale) },
    uRadius: { value: footprintRadius },
  }), [discFillColor, discOpacity, dimFactor, handoverSurfaceScale, footprintRadius]);
  const endpointRingOpacity = Math.max(style.endpointOpacity, style.isEventPrimary ? 0.5 : 0.28);
  const outerRingThickness = Math.min(
    footprintRadius * 0.08,
    DISC_OUTER_RING_THICKNESS_WORLD,
  );
  const innerRoleRingOuter = Math.max(footprintRadius - DISC_INNER_ROLE_RING_GAP_WORLD, footprintRadius * 0.72);
  const innerRoleRingInner = Math.max(0.1, innerRoleRingOuter - DISC_INNER_ROLE_RING_THICKNESS_WORLD);
  const frequencyRingInner = Math.max(0.1, footprintRadius * 0.84);
  const frequencyRingOuter = frequencyRingInner + DISC_FREQUENCY_RING_THICKNESS_WORLD;
  const handoverRoleRingInner = Math.max(0.1, footprintRadius + outerRingThickness + 1.2);
  const handoverRoleRingOuter = handoverRoleRingInner + roleFactors.roleRingOuterAdd;

  useEffect(() => {
    const material = coneMaterialRef.current;
    if (!material) return undefined;

    registerPulseTarget(beamKey, {
      material,
      baseOpacity: clampOpacity(coneOpacity * dimFactor * handoverSurfaceScale),
      pulse: style.pulse,
      visualRole: style.visualRole,
    });

    return () => registerPulseTarget(beamKey, null);
  }, [beamKey, coneOpacity, dimFactor, handoverSurfaceScale, style.pulse, style.visualRole]);

  return (
    <group>
      <mesh geometry={coneGeo}>
        <meshBasicMaterial
          ref={coneMaterialRef}
          color={displayColor}
          transparent
          opacity={resolveBeamPulseOpacity({
            baseOpacity: clampOpacity(coneOpacity * dimFactor * handoverSurfaceScale),
            pulse: style.pulse,
            elapsedSec: 0,
            reducedMotion,
          })}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={!spotlightEventSurface}
        />
      </mesh>

      <mesh position={[beam.groundX, 1.0 + yLift, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[footprintRadius, 32]} />
        <shaderMaterial
          vertexShader={`
            varying vec3 vPosition;
            void main() {
              vPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vPosition;
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uRadius;
            void main() {
              float dist = length(vPosition.xy);
              float intensity = 1.0 - smoothstep(0.0, uRadius, dist);
              gl_FragColor = vec4(uColor, intensity * uOpacity);
            }
          `}
          uniforms={discUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {roleSurface && (
        <mesh position={[beam.groundX, 1.68 + yLift, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={18}>
          <ringGeometry args={[frequencyRingInner, frequencyRingOuter, SEGMENTS]} />
        <meshBasicMaterial
            color={style.frequencySwatchColor}
            transparent
            opacity={clampOpacity(0.62 * loadIntensity * dimFactor * roleFactors.innerArcMul)}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={!spotlightEventSurface}
          />
        </mesh>
      )}

      <mesh position={[beam.groundX, 1.55 + yLift, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={18}>
        <ringGeometry args={[footprintRadius, footprintRadius + outerRingThickness, SEGMENTS]} />
        <meshBasicMaterial
          color={satelliteTintColor}
          transparent
          opacity={clampOpacity(0.78 * dimFactor * roleFactors.groundDiscMul)}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={!spotlightEventSurface}
        />
      </mesh>

      {roleSurface && (
        <mesh position={[beam.groundX, 1.85 + yLift, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={19}>
          <ringGeometry args={[innerRoleRingInner, innerRoleRingOuter, SEGMENTS]} />
          <meshBasicMaterial
            color={displayColor}
            transparent
            opacity={clampOpacity(0.9 * loadIntensity * dimFactor * roleFactors.midRingMul)}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={!spotlightEventSurface}
          />
        </mesh>
      )}

      {handoverRole && (
        <mesh position={[beam.groundX, 2.7 + yLift, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={23}>
          <ringGeometry args={[handoverRoleRingInner, handoverRoleRingOuter, SEGMENTS]} />
          <meshBasicMaterial
            color={handoverOverlayColor ?? HANDOVER_ARROW_COLOR}
            transparent
            opacity={handoverTransition.roleRingOpacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {roleSurface && (
        <Line
          points={[
            [satellitePosition.x, satellitePosition.y, satellitePosition.z],
            [beam.groundX, 0.06, beam.groundZ],
          ]}
          color={displayColor}
          lineWidth={style.lineWidth + roleFactors.haloLineWidthAdd}
          transparent
          opacity={clampOpacity(roleFactors.haloLineOpacityBase * dimFactor * handoverLineScale)}
          depthWrite={false}
          renderOrder={19}
        />
      )}

      <Line
        points={[
          [satellitePosition.x, satellitePosition.y, satellitePosition.z],
          [beam.groundX, 0, beam.groundZ],
        ]}
        color={satelliteTintColor}
        lineWidth={style.lineWidth + 1}
        transparent
        opacity={clampOpacity(Math.max((isHandoverSource ? BEAM_ROLE_TOKENS.serving.lineOpacity : style.lineOpacity) * loadIntensity * 0.82, 0.42) * dimFactor * handoverLineScale)}
        dashed={style.dashed}
        dashSize={15}
        gapSize={10}
        renderOrder={20}
      />

      <Line
        points={[
          [satellitePosition.x, satellitePosition.y, satellitePosition.z],
          [beam.groundX, 0.12, beam.groundZ],
        ]}
        color={displayColor}
        lineWidth={Math.max(1.4, style.lineWidth - 0.4) + roleFactors.coreLineWidthAdd}
        transparent
        opacity={clampOpacity((isHandoverSource ? BEAM_ROLE_TOKENS.serving.lineOpacity : style.lineOpacity) * loadIntensity * dimFactor * handoverLineScale)}
        dashed={style.dashed}
        dashSize={15}
        gapSize={10}
        renderOrder={21}
      />

      {style.endpointFilled ? (
        <mesh
          geometry={glyphFillGeo}
          position={[beam.groundX, 5 + yLift, beam.groundZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={24}
        >
          <meshBasicMaterial
            color={displayColor}
            transparent
            opacity={clampOpacity(style.endpointOpacity * dimFactor * roleFactors.endpointMul)}
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
            fog={!spotlightEventSurface}
          />
        </mesh>
      ) : (
        <Line
          points={glyphOutlinePoints.map(([x, y, z]) => [beam.groundX + x, 5.25 + z + yLift, beam.groundZ + y])}
          color={displayColor}
          lineWidth={2.4}
          transparent
          opacity={clampOpacity(endpointRingOpacity * dimFactor * roleFactors.endpointMul)}
          depthTest={false}
          depthWrite={false}
          renderOrder={25}
        />
      )}

      {showCallouts && (
        <>
          <Line
            points={callout.points}
            color={displayColor}
            lineWidth={isHandoverTarget ? 2.8 : beam.isServing || beam.isPrimary || handoverRole ? 1.8 : 1.1}
            transparent
            opacity={clampOpacity((isEmphasized ? 0.92 : Math.max(style.lineOpacity, 0.42)) * dimFactor * handoverCalloutScale)}
            dashed={style.dashed || !beam.isScheduledActive}
            dashSize={8}
            gapSize={6}
            depthWrite={false}
          />

          <Html
            position={callout.labelPosition}
            center
            zIndexRange={[80, 20]}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <BeamCalloutContent
              satelliteId={satelliteId}
              satelliteGlyph={satelliteGlyph}
              beam={beam}
              style={style}
              color={displayColor}
              sinrLabel={sinrLabel}
              isEmphasized={isEmphasized}
            />
          </Html>
        </>
      )}
    </group>
  );
}

export function SatelliteBeams({
  satelliteId,
  satellitePosition,
  beams,
  footprintRadius,
  reducedMotion = false,
  cinematicMode = 'off',
  showCallouts = true,
}: SatelliteBeamsProps) {
  const hasSomeServing = beams.some(b => b.isServing);

  return (
    <group>
      {beams.map(beam => {
        if (!beam.showBeam) return null;
        const beamKey = `${satelliteId}-B${beam.beamId}`;

        return (
          <BeamCone
            key={beamKey}
            beamKey={beamKey}
            satelliteId={satelliteId}
            satellitePosition={satellitePosition}
            beam={beam}
            footprintRadius={footprintRadius}
            reducedMotion={reducedMotion}
            cinematicMode={cinematicMode}
            hasSomeServing={hasSomeServing}
            showCallouts={showCallouts}
          />
        );
      })}
    </group>
  );
}
