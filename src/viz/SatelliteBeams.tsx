import { useEffect, useMemo, useRef } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  BEAM_ROLE_TOKENS,
  HANDOVER_ARROW_COLOR,
  HANDOVER_SOURCE_COLOR,
  HANDOVER_TARGET_COLOR,
  frequencyReuseColor,
  resolveBeamPulseOpacity,
  resolveHandoverVisualTransition,
  resolveBeamVisualEncoding,
  type BeamCodeRole,
  type HandoverBeamRole,
} from '../constants/beamRoleTokens';
import {
  createGlyphFillGeometry,
  createGlyphOutlinePoints,
  type GlyphKind,
} from './glyphs';
import type { CinematicMode } from '../scene/types';
import type { VisualShowcaseChannelMetricKind } from '../scene/visual-showcase-contract';
import { isSpotlightMode, resolveCinematicConeOpacityMultiplier } from '../scene/cinematicEffects';
import { BeamCalloutContent, formatBeamSinr } from './BeamCalloutContent';
import { registerPulseTarget } from './beamPulseMaterials';

export { BeamCalloutContent } from './BeamCalloutContent';
export { BeamPulseClock } from './beamPulseMaterials';

/** A beam with its ground-projected center in world coordinates. */
export interface BeamTarget {
  beamId: number;
  groundX: number; // world X
  groundZ: number; // world Z
  isServing: boolean;
  isScheduledActive: boolean;
  isPrimary: boolean;
  showBeam: boolean;
  frequencyIndex: number;
  satelliteTintColor: string;
  satelliteGlyph: GlyphKind;
  satelliteVisualIndex: number;
  role?: BeamCodeRole;
  isTransitioningSource?: boolean;
  sinrDb?: number | null;
  /**
   * P1e (c) audit-list hook (PR-0.5 backfill): the channel-metric kind that
   * accompanies `sinrDb`. Live engine = `'sinr-with-interference'`; replay =
   * `'snr-no-interference'`. Optional; live-sim path does not populate this
   * yet. Full kind-aware rendering (callout label branching via
   * `formatBeamSinrWithKind` / `formatBeamChannelMetric`) is reserved for the
   * slice PRs — this declaration only exposes the contract surface so future
   * wiring does not need a downstream BeamTarget change.
   */
  channelMetricKind?: VisualShowcaseChannelMetricKind;
  handoverRole?: HandoverBeamRole;
  handoverTransitionProgress?: number | null;
}

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

function createGroundDisc(
  centerX: number,
  centerZ: number,
  radius: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  positions.push(centerX, 1, centerZ);

  for (let i = 0; i < SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * Math.PI * 2;
    positions.push(
      centerX + Math.cos(angle) * radius,
      1,
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
  });
  const color = style.color;
  const handoverRole = beam.handoverRole ?? null;
  const isHandoverSource = handoverRole === 'intraSource' || handoverRole === 'interSource';
  const isHandoverTarget = handoverRole === 'intraTargetNewServing' || handoverRole === 'interTargetNewServing';
  const handoverTransition = resolveHandoverVisualTransition({
    role: handoverRole,
    progress: beam.handoverTransitionProgress ?? 1,
    reducedMotion,
  });
  const handoverOverlayColor =
    isHandoverSource
      ? HANDOVER_SOURCE_COLOR
      : isHandoverTarget
        ? HANDOVER_TARGET_COLOR
        : null;
  const displayColor = handoverOverlayColor ?? color;
  const baseConeOpacity = isHandoverSource
    ? Math.max(style.coneOpacity, BEAM_ROLE_TOKENS.serving.coneOpacity)
    : style.coneOpacity;
  const coneOpacity = baseConeOpacity * resolveCinematicConeOpacityMultiplier(
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
    : style.discOpacity;
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

  const discGeo = useMemo(
    () => createGroundDisc(gx, gz, footprintRadius),
    [gx, gz, footprintRadius],
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
  const sinrLabel = formatBeamSinr(beam.sinrDb);
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
  const handoverRoleRingOuter = handoverRoleRingInner + (isHandoverTarget ? 7.2 : 4.8);

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

      <mesh geometry={discGeo} position={[0, yLift, 0]}>
        <meshBasicMaterial
          color={discFillColor}
          transparent
          opacity={clampOpacity(discOpacity * dimFactor * handoverSurfaceScale)}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={!spotlightEventSurface}
        />
      </mesh>

      {roleSurface && (
        <mesh position={[beam.groundX, 1.68 + yLift, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={18}>
          <ringGeometry args={[frequencyRingInner, frequencyRingOuter, SEGMENTS]} />
          <meshBasicMaterial
            color={style.frequencySwatchColor}
            transparent
            opacity={clampOpacity(0.62 * dimFactor * (isHandoverTarget ? 1.1 : 1))}
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
          opacity={clampOpacity(0.78 * dimFactor * (isHandoverSource ? 0.62 : 1))}
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
            opacity={clampOpacity(0.9 * dimFactor * (isHandoverTarget ? 1.08 : isHandoverSource ? 0.52 : 1))}
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
          lineWidth={style.lineWidth + (isHandoverTarget ? 8.2 : isHandoverSource ? 3.2 : 3.2)}
          transparent
          opacity={clampOpacity((isHandoverTarget ? 0.58 : isHandoverSource ? 0.36 : 0.24) * dimFactor * handoverLineScale)}
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
        opacity={clampOpacity(Math.max((isHandoverSource ? BEAM_ROLE_TOKENS.serving.lineOpacity : style.lineOpacity) * 0.82, 0.42) * dimFactor * handoverLineScale)}
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
        lineWidth={Math.max(1.4, style.lineWidth - 0.4) + (isHandoverTarget ? 2.8 : isHandoverSource ? 0.5 : 0)}
        transparent
        opacity={clampOpacity((isHandoverSource ? BEAM_ROLE_TOKENS.serving.lineOpacity : style.lineOpacity) * dimFactor * handoverLineScale)}
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
            opacity={clampOpacity(style.endpointOpacity * dimFactor * (isHandoverTarget ? 1.18 : isHandoverSource ? 0.58 : 1))}
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
          opacity={clampOpacity(endpointRingOpacity * dimFactor * (isHandoverTarget ? 1.18 : isHandoverSource ? 0.58 : 1))}
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
