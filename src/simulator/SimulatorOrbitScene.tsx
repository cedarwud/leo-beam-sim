import { OrbitControls, Line } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { Vector3 as TleVector3 } from '../tle/types';
import type { SimulationAnalysisFrame } from './types';

const WORLD_SCALE = 1 / 7_000;
const EARTH_RADIUS_KM = 6_378.137;

function toWorld(point: TleVector3, scale = WORLD_SCALE): [number, number, number] {
  return [point.x * scale, point.y * scale, point.z * scale];
}

function SceneContents({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const selected = frame.tleState.selectedSatellite.positionTemeKm;
  const satellite = toWorld(selected);
  const trajectory = frame.tleState.trajectory.map(point => toWorld(point.positionTemeKm));
  const groundReference = toWorld(frame.tleState.groundPositionTemeKm);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 2]} intensity={2.2} />
      <OrbitControls enableDamping makeDefault />
      <axesHelper args={[1.45]} />
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_KM * WORLD_SCALE, 48, 32]} />
        <meshStandardMaterial color="#123c59" roughness={0.8} metalness={0.1} wireframe />
      </mesh>
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
    </>
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
        <SceneContents frame={frame} />
      </Canvas>
      <div className="simulator-orbit-legend" aria-hidden="true">
        <span><i className="orbit-legend-line orbit-legend-line--trajectory" />SGP4 trajectory</span>
        <span><i className="orbit-legend-dot orbit-legend-dot--satellite" />satellite</span>
        <span><i className="orbit-legend-dot orbit-legend-dot--ground" />Taipei reference</span>
      </div>
    </div>
  );
}
