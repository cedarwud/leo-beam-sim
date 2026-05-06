import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  frequencyReuseColor,
  resolveBeamPulseOpacity,
  resolveBeamVisualEncoding,
  type BeamCodeRole,
  type BeamPulseKind,
  type BeamVisualEncoding,
  type BeamVisualRole,
} from '../constants/beamRoleTokens';
import { formatBeamIdentityLabel } from '../utils/beamFrequency';
import { formatBeamIdentityByIndex, formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import {
  createGlyphFillGeometry,
  createGlyphOutlinePoints,
  glyphSymbolForKind,
  type GlyphKind,
} from './glyphs';
import type { CinematicMode } from '../scene/types';
import { isSpotlightMode, resolveCinematicConeOpacityMultiplier } from '../scene/cinematicEffects';

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

interface BeamPulseTarget {
  material: THREE.MeshBasicMaterial;
  baseOpacity: number;
  pulse: BeamPulseKind;
  visualRole: BeamVisualRole;
  roleEnteredAtSec: number;
}

type RegisterPulseTarget = (
  key: string,
  target: Omit<BeamPulseTarget, 'roleEnteredAtSec'> | null,
) => void;

const beamPulseTargets = new Map<string, BeamPulseTarget>();
let beamPulseClockSec = 0;

const registerPulseTarget: RegisterPulseTarget = (key, target) => {
  if (!target) {
    beamPulseTargets.delete(key);
    return;
  }

  const existing = beamPulseTargets.get(key);
  beamPulseTargets.set(key, {
    ...target,
    roleEnteredAtSec: existing?.visualRole === target.visualRole
      ? existing.roleEnteredAtSec
      : beamPulseClockSec,
  });
};

export function BeamPulseClock({ reducedMotion = false }: { reducedMotion?: boolean }) {
  useFrame(({ clock }) => {
    const elapsedSec = clock.getElapsedTime();
    beamPulseClockSec = elapsedSec;

    for (const target of beamPulseTargets.values()) {
      target.material.opacity = resolveBeamPulseOpacity({
        baseOpacity: target.baseOpacity,
        pulse: target.pulse,
        elapsedSec,
        roleAgeSec: elapsedSec - target.roleEnteredAtSec,
        reducedMotion,
      });
    }
  });

  return null;
}

function formatBeamSinr(sinrDb?: number | null): string {
  if (sinrDb === null || sinrDb === undefined || !Number.isFinite(sinrDb)) return '-- dB';
  return `${sinrDb.toFixed(1)} dB`;
}

export function BeamCalloutContent({
  satelliteId,
  satelliteGlyph,
  beam,
  style,
  color,
  sinrLabel,
  isEmphasized,
}: {
  satelliteId: string | null;
  satelliteGlyph?: GlyphKind;
  beam: Pick<BeamTarget, 'beamId' | 'frequencyIndex'>;
  style: Pick<
    BeamVisualEncoding,
    'operatorLabel' | 'slotStateLabel' | 'calloutMinWidth' | 'calloutGlowPx' | 'frequencySwatchColor'
  >;
  color: string;
  sinrLabel: string;
  isEmphasized: boolean;
}) {
  const satelliteLabel = formatSatelliteLabel(satelliteId);
  const beamTokenLabel = formatBeamIdentityLabel(beam.frequencyIndex, beam.beamId);
  const beamIdentity = formatBeamIdentityByIndex({
    satId: satelliteId,
    beamId: beam.beamId,
    frequencyIndex: beam.frequencyIndex,
  });
  const identityLine = style.operatorLabel ? `${style.operatorLabel} · ${beamTokenLabel}` : beamTokenLabel;
  const [frequencyToken, beamNumberToken] = beamTokenLabel.split(' ');
  const showFrequencySwatch = Boolean(style.operatorLabel && frequencyToken && beamNumberToken);
  const glyphSymbol = satelliteGlyph ? glyphSymbolForKind(satelliteGlyph) : null;

  return (
    <div
      data-testid="beam-callout"
      data-satellite-label={satelliteLabel}
      data-satellite-glyph={satelliteGlyph}
      data-beam-identity={beamIdentity}
      data-beam-token={beamTokenLabel}
      style={{
        minWidth: style.calloutMinWidth,
        padding: isEmphasized ? '5px 7px' : '4px 6px',
        borderRadius: 4,
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        background: 'rgba(2, 9, 18, 0.82)',
        boxShadow: `0 0 ${style.calloutGlowPx}px ${color}66`,
        color: '#ffffff',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: isEmphasized ? 12 : 11,
        lineHeight: 1.05,
        letterSpacing: 0,
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        data-testid="beam-callout-satellite-chip"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 2,
          padding: '2px 5px',
          borderRadius: 3,
          border: `1px solid ${color}`,
          background: `${color}1f`,
          color,
          fontWeight: 800,
        }}
      >
        {glyphSymbol && (
          <span
            data-testid="beam-callout-satellite-glyph"
            aria-hidden="true"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontFeatureSettings: '"liga" 0',
              textRendering: 'geometricPrecision',
              lineHeight: 1,
            }}
          >
            {glyphSymbol}
          </span>
        )}
        <span>{satelliteLabel}</span>
      </div>
      <div
        data-testid="beam-callout-identity-line"
        style={{ color: style.operatorLabel ? '#ffffff' : color, fontWeight: isEmphasized ? 800 : 700 }}
      >
        {showFrequencySwatch ? (
          <>
            <span>{style.operatorLabel} · </span>
            <span
              data-testid="beam-callout-frequency-token"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
            >
              <span
                data-testid="beam-callout-frequency-swatch"
                data-frequency-swatch-color={style.frequencySwatchColor}
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  display: 'inline-block',
                  borderRadius: 2,
                  background: style.frequencySwatchColor,
                  boxShadow: `0 0 7px ${style.frequencySwatchColor}99`,
                  flex: '0 0 auto',
                }}
              />
              <span>{frequencyToken}</span>
            </span>
            <span> {beamNumberToken}</span>
          </>
        ) : identityLine}
      </div>
      {style.slotStateLabel && (
        <div style={{ color: '#dbeafe', fontSize: 10, fontWeight: 800 }}>{style.slotStateLabel}</div>
      )}
      <div style={{ fontWeight: isEmphasized ? 700 : 600 }}>{sinrLabel}</div>
    </div>
  );
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
}: {
  beamKey: string;
  satelliteId: string;
  satellitePosition: THREE.Vector3;
  beam: BeamTarget;
  footprintRadius: number;
  reducedMotion: boolean;
  cinematicMode: CinematicMode;
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
      baseOpacity: coneOpacity,
      pulse: style.pulse,
      visualRole: style.visualRole,
    });

    return () => registerPulseTarget(beamKey, null);
  }, [beamKey, coneOpacity, style.pulse, style.visualRole]);

  return (
    <group>
      <mesh geometry={coneGeo}>
        <meshBasicMaterial
          ref={coneMaterialRef}
          color={color}
          transparent
          opacity={resolveBeamPulseOpacity({
            baseOpacity: coneOpacity,
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

      <mesh geometry={discGeo}>
        <meshBasicMaterial
          color={discFillColor}
          transparent
          opacity={discOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={!spotlightEventSurface}
        />
      </mesh>

      <mesh position={[beam.groundX, 1.55, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={18}>
        <ringGeometry args={[footprintRadius, footprintRadius + outerRingThickness, SEGMENTS]} />
        <meshBasicMaterial
          color={satelliteTintColor}
          transparent
          opacity={0.78}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={!spotlightEventSurface}
        />
      </mesh>

      {eventRoleSurface && (
        <mesh position={[beam.groundX, 1.85, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={19}>
          <ringGeometry args={[innerRoleRingInner, innerRoleRingOuter, SEGMENTS]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.82}
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
        opacity={Math.max(style.lineOpacity * 0.82, 0.42)}
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
        opacity={style.lineOpacity}
        dashed={style.dashed}
        dashSize={15}
        gapSize={10}
        renderOrder={21}
      />

      {style.endpointFilled ? (
        <mesh
          geometry={glyphFillGeo}
          position={[beam.groundX, 5, beam.groundZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={24}
        >
          <meshBasicMaterial
            color={color}
            transparent
            opacity={style.endpointOpacity}
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
            fog={!spotlightEventSurface}
          />
        </mesh>
      ) : (
        <Line
          points={glyphOutlinePoints.map(([x, y, z]) => [beam.groundX + x, 5.25 + z, beam.groundZ + y])}
          color={color}
          lineWidth={2.4}
          transparent
          opacity={endpointRingOpacity}
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
        opacity={isEmphasized ? 0.92 : Math.max(style.lineOpacity, 0.42)}
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
          />
        );
      })}
    </group>
  );
}
