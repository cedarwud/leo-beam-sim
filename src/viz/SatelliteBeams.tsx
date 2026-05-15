import { useEffect, useMemo, useRef } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  frequencyReuseColor,
  resolveBeamPulseOpacity,
  resolveBeamVisualEncoding,
  type BeamCodeRole,
} from '../constants/beamRoleTokens';
import {
  createGlyphFillGeometry,
  createGlyphOutlinePoints,
  type GlyphKind,
} from './glyphs';
import type { CinematicMode } from '../scene/types';
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
}

interface SatelliteBeamsProps {
  satelliteId: string;
  satellitePosition: THREE.Vector3;
  beams: BeamTarget[];
  footprintRadius: number; // world units
  reducedMotion?: boolean;
  cinematicMode?: CinematicMode;
}

const SEGMENTS = 32;
const DISC_OUTER_RING_THICKNESS_WORLD = 2.4;
const DISC_INNER_ROLE_RING_GAP_WORLD = 3;
const DISC_INNER_ROLE_RING_THICKNESS_WORLD = 1.8;

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
}: {
  beamKey: string;
  satelliteId: string;
  satellitePosition: THREE.Vector3;
  beam: BeamTarget;
  footprintRadius: number;
  reducedMotion: boolean;
  cinematicMode: CinematicMode;
  hasSomeServing: boolean;
}) {
  const style = resolveBeamVisualEncoding({
    role: beam.role,
    isPrimary: beam.isPrimary,
    isServing: beam.isServing,
    isScheduledActive: beam.isScheduledActive,
    frequencyColor: frequencyReuseColor(beam.frequencyIndex),
  });
  const color = style.color;
  const coneOpacity = style.coneOpacity * resolveCinematicConeOpacityMultiplier(
    style.visualRole,
    cinematicMode,
  );
  const eventRoleSurface = style.visualRole !== 'otherActive' && style.visualRole !== 'inactive';
  const spotlightEventSurface =
    isSpotlightMode(cinematicMode)
    && (style.visualRole === 'serving' || style.visualRole === 'pending');
  const discFillColor = eventRoleSurface ? style.frequencySwatchColor : color;
  const discOpacity = eventRoleSurface ? Math.min(style.discOpacity, 0.18) : style.discOpacity;
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
  const dimFactor = hasSomeServing ? (beam.isServing ? 1.0 : 0.45) : 1.0;
  const yLift = beam.isServing ? 5.0 : 0;
  const endpointRingOpacity = Math.max(style.endpointOpacity, style.isEventPrimary ? 0.5 : 0.28);
  const outerRingThickness = Math.min(
    footprintRadius * 0.08,
    DISC_OUTER_RING_THICKNESS_WORLD,
  );
  const innerRoleRingOuter = Math.max(footprintRadius - DISC_INNER_ROLE_RING_GAP_WORLD, footprintRadius * 0.72);
  const innerRoleRingInner = Math.max(0.1, innerRoleRingOuter - DISC_INNER_ROLE_RING_THICKNESS_WORLD);

  useEffect(() => {
    const material = coneMaterialRef.current;
    if (!material) return undefined;

    registerPulseTarget(beamKey, {
      material,
      baseOpacity: coneOpacity * dimFactor,
      pulse: style.pulse,
      visualRole: style.visualRole,
    });

    return () => registerPulseTarget(beamKey, null);
  }, [beamKey, coneOpacity, dimFactor, style.pulse, style.visualRole]);

  return (
    <group>
      <mesh geometry={coneGeo}>
        <meshBasicMaterial
          ref={coneMaterialRef}
          color={color}
          transparent
          opacity={resolveBeamPulseOpacity({
            baseOpacity: coneOpacity * dimFactor,
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
          opacity={discOpacity * dimFactor}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={!spotlightEventSurface}
        />
      </mesh>

      <mesh position={[beam.groundX, 1.55 + yLift, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={18}>
        <ringGeometry args={[footprintRadius, footprintRadius + outerRingThickness, SEGMENTS]} />
        <meshBasicMaterial
          color={satelliteTintColor}
          transparent
          opacity={0.78 * dimFactor}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={!spotlightEventSurface}
        />
      </mesh>

      {eventRoleSurface && (
        <mesh position={[beam.groundX, 1.85 + yLift, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={19}>
          <ringGeometry args={[innerRoleRingInner, innerRoleRingOuter, SEGMENTS]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.82 * dimFactor}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={!spotlightEventSurface}
          />
        </mesh>
      )}

      <Line
        points={[
          [satellitePosition.x, satellitePosition.y, satellitePosition.z],
          [beam.groundX, 0, beam.groundZ],
        ]}
        color={satelliteTintColor}
        lineWidth={style.lineWidth + 1}
        transparent
        opacity={Math.max(style.lineOpacity * 0.82, 0.42) * dimFactor}
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
        color={color}
        lineWidth={Math.max(1, style.lineWidth - 1)}
        transparent
        opacity={style.lineOpacity * dimFactor}
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
            color={color}
            transparent
            opacity={style.endpointOpacity * dimFactor}
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
            fog={!spotlightEventSurface}
          />
        </mesh>
      ) : (
        <Line
          points={glyphOutlinePoints.map(([x, y, z]) => [beam.groundX + x, 5.25 + z + yLift, beam.groundZ + y])}
          color={color}
          lineWidth={2.4}
          transparent
          opacity={endpointRingOpacity * dimFactor}
          depthTest={false}
          depthWrite={false}
          renderOrder={25}
        />
      )}

      <Line
        points={callout.points}
        color={color}
        lineWidth={beam.isServing || beam.isPrimary ? 1.6 : 1.1}
        transparent
        opacity={(isEmphasized ? 0.92 : Math.max(style.lineOpacity, 0.42)) * dimFactor}
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
          color={color}
          sinrLabel={sinrLabel}
          isEmphasized={isEmphasized}
        />
      </Html>
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
          />
        );
      })}
    </group>
  );
}
