import { Line } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { BaseSceneLayout } from '@/scene/BaseSceneLayout';
import { NTPU_CONFIG, type NTPUSceneConfig } from '@/config/ntpu.config';
import {
  C90_CLAIM_BOUNDARY,
  type CourseSceneFrame,
  type TleJourney,
  type TleTrajectoryBundle,
  type TleTrajectoryFrame,
} from './contract';

interface C90CourseSceneProps {
  readonly frame: CourseSceneFrame;
  readonly tleJourney: TleJourney;
  readonly tleBundle: TleTrajectoryBundle;
  readonly tleFrame: TleTrajectoryFrame | null;
}

const C90_SCENE_CONFIG: NTPUSceneConfig = {
  ...NTPU_CONFIG,
  camera: {
    ...NTPU_CONFIG.camera,
    initialPosition: [0, 560, 760],
    fov: 50,
  },
};

function tuple(position: readonly [number, number, number]): [number, number, number] {
  return [position[0], position[1], position[2]];
}

function CourseSceneOverlay({ frame }: C90CourseSceneProps) {
  const satellitePosition = tuple(frame.satellite.position);
  const beamPosition = tuple(frame.beam.position);
  const observerPosition: [number, number, number] = [0, 8, 0];
  const linkColor = frame.service.status === 'served' ? '#8df7e5' : '#ffce82';

  return (
    <group>
      <mesh position={satellitePosition}>
        <sphereGeometry args={[22, 20, 12]} />
        <meshStandardMaterial color="#8fc0ff" emissive="#153a66" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={beamPosition} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[42, 20, 4, 6]} />
        <meshStandardMaterial color={linkColor} transparent opacity={0.72} emissive={linkColor} emissiveIntensity={0.45} />
      </mesh>
      <Line points={[satellitePosition, beamPosition, observerPosition]} color={linkColor} lineWidth={2} transparent opacity={0.88} />
      <mesh position={observerPosition}>
        <sphereGeometry args={[11, 16, 8]} />
        <meshStandardMaterial color="#ffce82" emissive="#5c3d12" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function TleSceneOverlay({ frame }: { readonly frame: TleTrajectoryFrame }) {
  const satellitePosition = tuple(frame.scene.satellitePosition);
  const observerPosition = tuple(frame.scene.observerPosition);
  const linkColor = frame.look.visible ? '#8df7e5' : '#ff9f76';

  return (
    <group>
      <mesh position={satellitePosition}>
        <sphereGeometry args={[22, 20, 12]} />
        <meshStandardMaterial color={frame.look.visible ? '#8fc0ff' : '#ffb38d'} emissive={frame.look.visible ? '#153a66' : '#65321f'} emissiveIntensity={0.75} />
      </mesh>
      {frame.look.visible && <Line points={[satellitePosition, observerPosition]} color={linkColor} lineWidth={2} transparent opacity={0.9} />}
      <mesh position={observerPosition}>
        <sphereGeometry args={[11, 16, 8]} />
        <meshStandardMaterial color="#ffce82" emissive="#5c3d12" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[observerPosition[0], observerPosition[1] + 7, observerPosition[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[42, 20, 4, 24]} />
        <meshStandardMaterial color={linkColor} transparent opacity={0.5} emissive={linkColor} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

export function C90CourseScene({ frame, tleJourney, tleBundle, tleFrame }: C90CourseSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const isTle = tleFrame !== null;
  const activeFrameId = isTle ? tleFrame.frameId : frame.identity.frameId;
  const activeScenarioId = isTle ? tleJourney.scenario.scenarioId : frame.identity.scenarioId;

  return (
    <div className="c90-scene" data-testid="c90-scene" data-scenario-id={activeScenarioId} data-frame-id={activeFrameId} data-tle-bundle-id={isTle ? tleBundle.bundleId : undefined} data-claim-boundary={C90_CLAIM_BOUNDARY} aria-label={`Simulated NTPU scene for ${activeFrameId}`}>
      <div className="c90-scene__caption">
        <span className="c90-scene__live-dot" aria-hidden="true" />
        <strong>SIMULATED TEACHING</strong> · NTPU scene · {isTle ? `TLE producer frame ${tleFrame.frameIndex + 1}` : `course frame ${frame.frameIndex + 1}`} · {activeFrameId}
      </div>
      {isTle ? (
        <div className="c90-scene__status"><span>{tleFrame.look.visible ? 'VISIBLE FROM COURSE OBSERVER' : 'BELOW COURSE HORIZON'}</span><strong>{tleFrame.look.elevationDeg.toFixed(2)}° elevation</strong><small>{tleFrame.look.azimuthDeg.toFixed(2)}° az · {tleFrame.look.rangeKm.toFixed(1)} km · {tleFrame.targetUtc}</small></div>
      ) : (
        <div className="c90-scene__status"><span>{frame.service.status === 'served' ? 'SERVED' : frame.service.status === 'deadline-missed' ? 'DEADLINE MISSED' : 'EXPIRED'}</span><strong>{frame.service.rateMbps.toFixed(2)} Mbps</strong><small>{frame.energy.powerW.toFixed(1)} W · {frame.energy.energyJ.toFixed(1)} J · {frame.energy.eeMbitPerJ.toFixed(3)} Mbit/J</small></div>
      )}
      <Canvas
        frameloop="demand"
        dpr={1}
        shadows={false}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <BaseSceneLayout sceneConfig={C90_SCENE_CONFIG} controlsRef={controlsRef}>
          {isTle
            ? <TleSceneOverlay frame={tleFrame} />
            : <CourseSceneOverlay frame={frame} tleJourney={tleJourney} tleBundle={tleBundle} tleFrame={tleFrame} />}
        </BaseSceneLayout>
      </Canvas>
      <div className="c90-scene__legend" aria-label="Scene legend and claim boundary">
        <span><i className="c90-dot c90-dot--sat" /> satellite</span>
        <span><i className="c90-dot c90-dot--beam" /> {isTle ? 'model look-angle link' : 'serving beam'}</span>
        <span><i className="c90-dot c90-dot--observer" /> NTPU observer</span>
        <span className="c90-scene__legend-claim">fixture only · no live backend</span>
      </div>
    </div>
  );
}
