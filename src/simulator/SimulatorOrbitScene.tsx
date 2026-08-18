import { OrbitControls, Line } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import type { Vector3 as TleVector3 } from '../tle/types';
import type { SimulationAnalysisFrame } from './types';

const WORLD_SCALE = 1 / 7_000;
const EARTH_RADIUS_KM = 6_378.137;

function toWorld(point: TleVector3, scale = WORLD_SCALE): [number, number, number] {
  return [point.x * scale, point.y * scale, point.z * scale];
}

export interface SimulatorOrbitSceneContentsProps {
  readonly frame: SimulationAnalysisFrame;
}

/**
 * The R3F scene contents for an immutable analysis frame.
 *
 * This component intentionally does not create a Canvas.  The route-level
 * wrapper below owns the camera, renderer, and controls, while another scene
 * can reuse this exact TLE-derived geometry inside its own Canvas.
 */
export function SimulatorOrbitSceneContents({ frame }: SimulatorOrbitSceneContentsProps) {
  const selected = frame.tleState.selectedSatellite.positionTemeKm;
  const satellite = toWorld(selected);
  const trajectory = frame.tleState.trajectory.map(point => toWorld(point.positionTemeKm));
  const groundReference = toWorld(frame.tleState.groundPositionTemeKm);
  const constellationPositions = useMemo(() => {
    const satellites = frame.tleState.propagationFrame.satellites;
    const positions = new Float32Array(satellites.length * 3);
    satellites.forEach((candidate, index) => {
      const [x, y, z] = toWorld(candidate.positionTemeKm);
      const offset = index * 3;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
    });
    return positions;
  }, [frame.tleState.propagationFrame]);

  return (
    <group
      name="tle-analysis-frame"
      userData={{
        frameId: frame.frameId,
        tleFrameId: frame.tleFrameId,
        selectedSatelliteId: frame.selectedSatelliteId,
      }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 2]} intensity={2.2} />
      <OrbitControls enableDamping makeDefault />
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_KM * WORLD_SCALE, 48, 32]} />
        <meshStandardMaterial color="#123c59" roughness={0.8} metalness={0.1} wireframe />
      </mesh>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[constellationPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#8ab4c7" size={0.014} sizeAttenuation transparent opacity={0.72} />
      </points>
      <Line points={trajectory} color="#76ead7" lineWidth={2.5} />
      <Line points={[[0, 0, 0], satellite]} color="#f6bd60" lineWidth={1.2} transparent opacity={0.55} />
      <Line points={[groundReference, satellite]} color="#ff7d8f" lineWidth={1.4} transparent opacity={0.75} />
      <mesh position={satellite}>
        <sphereGeometry args={[0.045, 20, 14]} />
        <meshStandardMaterial color="#ffde85" emissive="#a65d2d" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={groundReference}>
        <sphereGeometry args={[0.028, 16, 12]} />
        <meshStandardMaterial color="#ff7d8f" emissive="#9b2e50" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

export interface SimulatorOrbitSceneProps {
  readonly frame: SimulationAnalysisFrame;
}

export function SimulatorOrbitScene({ frame }: SimulatorOrbitSceneProps) {
  return (
    <div className="simulator-orbit-scene" role="img" aria-label="TLE-derived SGP4 orbit trajectory around Earth">
      <Canvas
        camera={{ position: [2.65, 2.1, 2.65], fov: 42, near: 0.01, far: 20 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#07131d"]} />
        <SimulatorOrbitSceneContents frame={frame} />
      </Canvas>
      <div className="simulator-orbit-legend" aria-hidden="true">
        <span><i className="orbit-legend-line orbit-legend-line--trajectory" />SGP4 trajectory</span>
        <span><i className="orbit-legend-dot orbit-legend-dot--satellite" />satellite</span>
        <span><i className="orbit-legend-dot orbit-legend-dot--ground" />Taipei reference</span>
      </div>
    </div>
  );
}
