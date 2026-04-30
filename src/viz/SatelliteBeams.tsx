import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  frequencyReuseColor,
  resolveBeamVisualEncoding,
  type BeamCodeRole,
} from '../constants/beamRoleTokens';
import { formatBeamIdentityLabel } from '../utils/beamFrequency';

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
  role?: BeamCodeRole;
  isTransitioningSource?: boolean;
  sinrDb?: number | null;
}

interface SatelliteBeamsProps {
  satelliteId: string;
  satellitePosition: THREE.Vector3;
  beams: BeamTarget[];
  footprintRadius: number; // world units
}

const SEGMENTS = 32;

function formatBeamSinr(sinrDb?: number | null): string {
  if (sinrDb === null || sinrDb === undefined || !Number.isFinite(sinrDb)) return '-- dB';
  return `${sinrDb.toFixed(1)} dB`;
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
  satellitePosition,
  beam,
  footprintRadius,
}: {
  satellitePosition: THREE.Vector3;
  beam: BeamTarget;
  footprintRadius: number;
}) {
  const style = resolveBeamVisualEncoding({
    role: beam.role,
    isPrimary: beam.isPrimary,
    isServing: beam.isServing,
    isScheduledActive: beam.isScheduledActive,
    frequencyColor: frequencyReuseColor(beam.frequencyIndex),
  });
  const color = style.color;
  // Destructure to primitives so useMemo deps are stable between renders
  const sx = satellitePosition.x, sy = satellitePosition.y, sz = satellitePosition.z;
  const gx = beam.groundX, gz = beam.groundZ;

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
  const beamIdentityLabel = formatBeamIdentityLabel(beam.frequencyIndex, beam.beamId);
  const sinrLabel = formatBeamSinr(beam.sinrDb);
  const isEmphasized = style.isEmphasized;
  const endpointRingOpacity = Math.max(style.endpointOpacity, style.isEventPrimary ? 0.5 : 0.28);

  return (
    <group>
      <mesh geometry={coneGeo}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={style.coneOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh geometry={discGeo}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={style.discOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <Line
        points={[
          [satellitePosition.x, satellitePosition.y, satellitePosition.z],
          [beam.groundX, 0, beam.groundZ],
        ]}
        color={color}
        lineWidth={style.lineWidth}
        transparent
        opacity={style.lineOpacity}
        dashed={style.dashed}
        dashSize={15}
        gapSize={10}
      />

      <mesh position={[beam.groundX, 5, beam.groundZ]} renderOrder={24}>
        <sphereGeometry args={[style.endpointRadius, 16, 10]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={style.endpointFilled ? style.endpointOpacity : Math.min(style.endpointOpacity, 0.36)}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {!style.endpointFilled && (
        <mesh position={[beam.groundX, 5.25, beam.groundZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={25}>
          <ringGeometry args={[style.endpointRadius * 1.08, style.endpointRadius * 1.44, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={endpointRingOpacity}
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
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
        <div
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
          {style.operatorLabel && (
            <div style={{ color, fontWeight: 800 }}>{style.operatorLabel}</div>
          )}
          <div style={{ color: style.operatorLabel ? '#ffffff' : color, fontWeight: isEmphasized ? 800 : 700 }}>
            {beamIdentityLabel}
          </div>
          {style.slotStateLabel && (
            <div style={{ color: '#dbeafe', fontSize: 10, fontWeight: 800 }}>{style.slotStateLabel}</div>
          )}
          <div style={{ fontWeight: isEmphasized ? 700 : 600 }}>{sinrLabel}</div>
        </div>
      </Html>
    </group>
  );
}

export function SatelliteBeams({
  satelliteId,
  satellitePosition,
  beams,
  footprintRadius,
}: SatelliteBeamsProps) {
  return (
    <group>
      {beams.map(beam => {
        if (!beam.showBeam) return null;

        return (
          <BeamCone
            key={`${satelliteId}-B${beam.beamId}`}
            satellitePosition={satellitePosition}
            beam={beam}
            footprintRadius={footprintRadius}
          />
        );
      })}
    </group>
  );
}
