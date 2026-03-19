import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import { loadProfile } from '../profiles';
import type { RuntimeConfig, SimState } from './types';
import { useSimulation } from './useSimulation';
import { useBeamViz } from './useBeamViz';
import { EarthFixedCells, generateHexGrid } from '../viz/EarthFixedCells';
import { SatelliteBeams } from '../viz/SatelliteBeams';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { SinrOverlay } from '../viz/SinrOverlay';
import { GroundScene } from '../viz/GroundScene';
import { NTPUScene } from '../components/scene/NTPUScene';
import { UAV } from '../components/scene/UAV';
import { Starfield } from '../components/ui/Starfield';

interface SceneContentProps {
  profileId: string;
  speed: number;
  paused: boolean;
  runtime: RuntimeConfig;
  onSimUpdate: (state: SimState) => void;
}

function SceneContent({
  profileId,
  speed,
  paused,
  runtime,
  onSimUpdate,
}: SceneContentProps) {
  const profile = useMemo(() => loadProfile(profileId), [profileId]);
  const sim = useSimulation(profile, runtime.replay, speed, paused);
  const viz = useBeamViz(sim, profile, runtime.presentationMode);
  const cells = useMemo(
    () => generateHexGrid({ rows: 4, cols: 5, cellRadius: 80, centerX: 0, centerZ: 0 }),
    [],
  );

  useEffect(() => {
    onSimUpdate({
      servingSatId: sim.serving.satId,
      servingBeamId: sim.serving.beamId,
      sinrDb: sim.serving.sinrDb,
      hoCount: sim.hoCount,
      lastHoReason: sim.lastHoReason,
    });
  }, [onSimUpdate, sim]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 600, 750]} fov={60} near={0.1} far={10000} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.3}
        zoomSpeed={0.2}
        panSpeed={0.3}
        minDistance={50}
        maxDistance={3000}
      />

      <hemisphereLight args={[0xffffff, 0x444444, 1.0]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        castShadow
        position={[0, 50, 0]}
        intensity={1.5}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={1000}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
        shadow-camera-left={500}
        shadow-camera-right={-500}
        shadow-bias={-0.0004}
        shadow-radius={8}
      />

      <Suspense fallback={null}>
        <NTPUScene />
      </Suspense>
      <Suspense fallback={null}>
        <UAV position={[0, 10, 0]} scale={10} />
      </Suspense>

      <GroundScene />
      <EarthFixedCells cells={cells} />

      {viz.displaySats.map(sat => (
        <SatelliteMarker
          key={sat.id}
          position={sat.world}
          label={sat.id}
          isServing={viz.eventRoles.get(sat.id) === 'serving' || viz.eventRoles.get(sat.id) === 'post-ho'}
        />
      ))}

      {viz.displaySats
        .filter(sat => viz.beamSatIds.has(sat.id))
        .map(sat => {
          const beams = viz.satBeams.get(sat.id);
          if (!beams?.length) return null;

          return (
            <SatelliteBeams
              key={`beams-${sat.id}`}
              satelliteId={sat.id}
              satellitePosition={sat.world}
              beams={beams}
              footprintRadius={viz.footprintRadiusWorld}
            />
          );
        })}

      <SinrOverlay beams={viz.sinrLabels} />
    </>
  );
}

interface MainSceneProps {
  speed: number;
  paused: boolean;
  profileId: string;
  runtime: RuntimeConfig;
  onSimUpdate: (state: SimState) => void;
}

export function MainScene({
  speed,
  paused,
  profileId,
  runtime,
  onSimUpdate,
}: MainSceneProps) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)',
      overflow: 'hidden',
    }}>
      <Starfield starCount={180} />
      <Canvas
        shadows
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          alpha: true,
          powerPreference: 'high-performance',
          antialias: true,
        }}
      >
        <Suspense fallback={<Html center><div style={{ color: 'white', fontSize: 20 }}>Loading...</div></Html>}>
          <SceneContent
            profileId={profileId}
            speed={speed}
            paused={paused}
            runtime={runtime}
            onSimUpdate={onSimUpdate}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
