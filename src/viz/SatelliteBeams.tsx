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

function beamColor(beam: BeamTarget): string {
  if (beam.isServing) return '#18f0ff';
  switch (beam.role) {
    case 'prepared':
      return beam.isPrimary ? '#ff9d1c' : '#8d4b10';
    case 'post-ho':
      return beam.isPrimary ? '#4f8cff' : '#30579c';
    case 'secondary':
      return beam.isPrimary ? '#ff5ab3' : '#8f3867';
    default:
      return beam.isPrimary
        ? (beam.beamId % 2 === 1 ? '#ffb066' : '#8fc7ff')
        : (beam.beamId % 2 === 1 ? '#8f5a2d' : '#3d6285');
  }
}

function beamOpacity(beam: BeamTarget): { cone: number; disc: number; line: number; width: number; dashed: boolean } {
  if (beam.isServing) {
    if (beam.isTransitioningSource) {
      return { cone: 0.2, disc: 0.34, line: 0.76, width: 2.8, dashed: false };
    }
    return { cone: 0.25, disc: 0.45, line: 0.85, width: 3, dashed: false };
  }

  switch (beam.role) {
    case 'post-ho':
      return beam.isPrimary
        ? { cone: 0.22, disc: 0.34, line: 0.78, width: 2.8, dashed: false }
        : { cone: 0.12, disc: 0.18, line: 0.42, width: 1.5, dashed: true };
    case 'prepared':
      return beam.isPrimary
        ? { cone: 0.16, disc: 0.26, line: 0.66, width: 2.3, dashed: true }
        : { cone: 0.06, disc: 0.12, line: 0.28, width: 1.2, dashed: true };
    case 'secondary':
      return beam.isPrimary
        ? { cone: 0.16, disc: 0.26, line: 0.66, width: 2.3, dashed: true }
        : { cone: 0.09, disc: 0.16, line: 0.38, width: 1.4, dashed: true };
    default:
      return {
        cone: beam.isPrimary ? 0.12 : 0.05,
        disc: beam.isPrimary ? 0.2 : 0.08,
        line: beam.isPrimary ? 0.46 : 0.2,
        width: beam.isPrimary ? 1.8 : 1.1,
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
        outlineColor={beam.isServing || beam.isPrimary ? '#ffffff' : '#000000'}
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
