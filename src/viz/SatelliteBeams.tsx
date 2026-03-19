import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';

/** A beam with its ground-projected center in world coordinates. */
export interface BeamTarget {
  beamId: number;
  groundX: number; // world X
  groundZ: number; // world Z
  isServing: boolean;
  isPrimary: boolean;
  showBeam: boolean;
  role?: 'serving' | 'secondary' | 'prepared' | 'post-ho';
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
const POLARIZATION_A_COLOR = '#ff8844';
const POLARIZATION_B_COLOR = '#44aaff';
const CURRENT_SERVICE_COLOR = '#0088ff';
const TARGET_HANDOVER_COLOR = '#00ff88';
const SECONDARY_EVENT_COLOR = '#6f7785';
const LABEL_OUTLINE_DARK = '#071018';

function baseBeamColor(beamId: number): string {
  return beamId % 2 === 1 ? POLARIZATION_A_COLOR : POLARIZATION_B_COLOR;
}

function beamColor(beam: BeamTarget): string {
  if (beam.isServing) return CURRENT_SERVICE_COLOR;
  switch (beam.role) {
    case 'prepared':
      return beam.isPrimary ? TARGET_HANDOVER_COLOR : baseBeamColor(beam.beamId);
    case 'post-ho':
      return beam.isPrimary ? CURRENT_SERVICE_COLOR : baseBeamColor(beam.beamId);
    case 'secondary':
      return beam.isPrimary ? SECONDARY_EVENT_COLOR : baseBeamColor(beam.beamId);
    default:
      return baseBeamColor(beam.beamId);
  }
}

function beamOpacity(beam: BeamTarget): { cone: number; disc: number; line: number; width: number; dashed: boolean } {
  if (beam.isServing) {
    if (beam.isTransitioningSource) {
      return { cone: 0.28, disc: 0.18, line: 0.92, width: 3.6, dashed: false };
    }
    return { cone: 0.35, disc: 0.22, line: 1, width: 4, dashed: false };
  }

  switch (beam.role) {
    case 'post-ho':
      return beam.isPrimary
        ? { cone: 0.3, disc: 0.2, line: 0.95, width: 3.6, dashed: false }
        : { cone: 0.14, disc: 0.1, line: 0.55, width: 2, dashed: true };
    case 'prepared':
      return beam.isPrimary
        ? { cone: 0.3, disc: 0.2, line: 0.9, width: 3.4, dashed: true }
        : { cone: 0.12, disc: 0.08, line: 0.5, width: 2, dashed: true };
    case 'secondary':
      return beam.isPrimary
        ? { cone: 0.2, disc: 0.14, line: 0.7, width: 2.4, dashed: true }
        : { cone: 0.1, disc: 0.06, line: 0.42, width: 1.7, dashed: true };
    default:
      return {
        cone: beam.isPrimary ? 0.2 : 0.12,
        disc: beam.isPrimary ? 0.12 : 0.06,
        line: beam.isPrimary ? 0.72 : 0.5,
        width: beam.isPrimary ? 2.4 : 2,
        dashed: !beam.isPrimary,
      };
  }
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

function BeamCone({
  satellitePosition,
  beam,
  footprintRadius,
}: {
  satellitePosition: THREE.Vector3;
  beam: BeamTarget;
  footprintRadius: number;
}) {
  const color = beamColor(beam);
  const style = beamOpacity(beam);
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

  const labelPos = useMemo(() => {
    const ground = new THREE.Vector3(gx, 0, gz);
    return new THREE.Vector3(sx, sy, sz).lerp(ground, 0.35);
  }, [sx, sy, sz, gx, gz]);

  return (
    <group>
      <mesh geometry={coneGeo}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={style.cone}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh geometry={discGeo}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={style.disc}
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
        lineWidth={style.width}
        transparent
        opacity={style.line}
        dashed={style.dashed}
        dashSize={15}
        gapSize={10}
      />

      <Text
        position={[labelPos.x, labelPos.y, labelPos.z]}
        fontSize={beam.isServing || beam.isPrimary || beam.role === 'post-ho' ? 14 : 10}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={beam.isServing || beam.isPrimary || beam.role === 'post-ho' ? 2.5 : 1.5}
        outlineColor={beam.isServing || beam.isPrimary ? '#ffffff' : LABEL_OUTLINE_DARK}
      >
        {`B${beam.beamId}${beam.isServing ? ' ★' : beam.isPrimary ? ' ◎' : ''}${beam.role ? ` ${beam.role}` : ''}`}
      </Text>
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
