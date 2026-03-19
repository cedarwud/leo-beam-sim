import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';

/** A beam with its ground-projected center in world coordinates. */
export interface BeamTarget {
  beamId: number;
  groundX: number; // world X
  groundZ: number; // world Z
  isServing: boolean;
}

interface SatelliteBeamsProps {
  satelliteId: string;
  satellitePosition: THREE.Vector3;
  beams: BeamTarget[];
  footprintRadius: number; // world units
}

const SEGMENTS = 32;

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
  const color = beam.beamId % 2 === 1 ? '#ff8844' : '#44aaff';
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
          opacity={beam.isServing ? 0.25 : 0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh geometry={discGeo}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={beam.isServing ? 0.45 : 0.15}
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
        lineWidth={beam.isServing ? 3 : 1.5}
        transparent
        opacity={beam.isServing ? 0.8 : 0.4}
        dashed={!beam.isServing}
        dashSize={15}
        gapSize={10}
      />

      <Text
        position={[labelPos.x, labelPos.y, labelPos.z]}
        fontSize={beam.isServing ? 14 : 10}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={beam.isServing ? 2.5 : 1.5}
        outlineColor={beam.isServing ? '#ffffff' : '#000000'}
      >
        {`B${beam.beamId}${beam.isServing ? ' ★' : ''}`}
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
      {beams.map(beam => (
        <BeamCone
          key={`${satelliteId}-B${beam.beamId}`}
          satellitePosition={satellitePosition}
          beam={beam}
          footprintRadius={footprintRadius}
        />
      ))}
    </group>
  );
}
