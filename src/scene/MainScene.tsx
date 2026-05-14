import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Profile } from '../profiles/types';
import type {
  CameraPreset,
  RuntimeConfig,
  SimState,
} from './types';
import type { ModqnReplayPlaybackDisplayState } from '../modqn/replay-bundle/playback-shell';
import { useSimulation } from './useSimulation';
import { useBeamViz } from './useBeamViz';
import { useSimStatePublisher } from './useSimStatePublisher';
import { ModqnReplaySceneLayer } from './ModqnReplaySceneLayer';
import {
  EarthFixedCells,
  createCellCoverCandidate,
  generateHexGrid,
  resolveHexCellCoverAssignments,
  type CellCoverHysteresisState,
} from '../viz/EarthFixedCells';
import { AmbientFootprintRings } from '../viz/AmbientFootprintRings';
import { HandoverLinks } from '../viz/HandoverLinks';
import { IntraHandoverArrow } from '../viz/IntraHandoverArrow';
import { BeamPulseClock, SatelliteBeams } from '../viz/SatelliteBeams';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { SpineParticles } from '../viz/SpineParticles';
import { OrbitTrail } from '../viz/OrbitTrail';
import { ServingGroundRipple } from '../viz/ServingGroundRipple';
import { GroundScene } from '../viz/GroundScene';
import { formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import { NTPUScene } from '../components/scene/NTPUScene';
import { UAV } from '../components/scene/UAV';
import { Starfield } from '../components/ui/Starfield';
import {
  CINEMATIC_EVENT_LIGHT_DECAY,
  CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD,
  CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD,
  CINEMATIC_FOG_COLOR,
  CINEMATIC_FOG_DENSITY,
  isSpotlightMode,
  resolveCinematicLightIntensity,
  resolveCinematicSpotlightTargets,
} from './cinematicEffects';

interface SceneContentProps {
  profile: Profile;
  speed: number;
  paused: boolean;
  runtime: RuntimeConfig;
  modqnReplayDisplayState: ModqnReplayPlaybackDisplayState | null;
  onSimUpdate: (state: SimState) => void;
}

const SHOW_BEAMS = true;
const CAMERA_TWEEN_DURATION_MS = 600;

const CAMERA_PRESET_POSES: Record<CameraPreset, {
  position: [number, number, number];
  target: [number, number, number];
}> = {
  zenith: {
    position: [0, 980, 1],
    target: [0, 0, 0],
  },
  oblique: {
    position: [0, 600, 750],
    target: [0, 0, 0],
  },
  chase: {
    position: [520, 260, -620],
    target: [0, 20, 0],
  },
};

interface CameraTweenState {
  preset: CameraPreset;
  startedAtMs: number;
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPosition: THREE.Vector3;
  toTarget: THREE.Vector3;
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}

function formatCameraVector(vector: THREE.Vector3): string {
  return [vector.x, vector.y, vector.z].map(value => value.toFixed(2)).join(',');
}

function SceneContent({
  profile,
  speed,
  paused,
  runtime,
  modqnReplayDisplayState,
  onSimUpdate,
}: SceneContentProps) {
  const camera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraTweenRef = useRef<CameraTweenState | null>(null);
  const lastCameraCommandAtRef = useRef<number | null>(null);
  const lastCameraPresetRef = useRef<CameraPreset | null>(null);
  const sim = useSimulation(
    profile,
    runtime.replay,
    speed,
    paused,
    runtime.signalResetKey,
    runtime.handoverResetKey,
  );
  const latchedBeamSinrByKeyRef = useRef<Map<string, number>>(new Map());
  const cellCoverHysteresisRef = useRef<CellCoverHysteresisState>(new Map());
  const writeCameraTelemetry = (preset: CameraPreset | null, transition: 'idle' | 'animating') => {
    const controls = controlsRef.current;
    gl.domElement.dataset.cameraPreset = preset ?? 'manual';
    gl.domElement.dataset.cameraTransition = transition;
    gl.domElement.dataset.cameraPosition = formatCameraVector(camera.position);
    gl.domElement.dataset.cameraTarget = formatCameraVector(controls?.target ?? new THREE.Vector3());
  };
  const applyCameraPose = (preset: CameraPreset, transition: 'idle' | 'animating') => {
    const presetPose = CAMERA_PRESET_POSES[preset];
    const controls = controlsRef.current;
    camera.position.set(...presetPose.position);
    controls?.target.set(...presetPose.target);
    controls?.update();
    writeCameraTelemetry(preset, transition);
  };
  const cells = useMemo(
    () => generateHexGrid({ rows: 4, cols: 5, cellRadius: 80, centerX: 0, centerZ: 0 }),
    [],
  );
  const viz = useBeamViz(sim, profile, runtime, latchedBeamSinrByKeyRef.current);
  useSimStatePublisher({
    profile,
    sim,
    viz,
    signalResetKey: runtime.signalResetKey,
    handoverResetKey: runtime.handoverResetKey,
    latchedBeamSinrByKeyRef,
    onSimUpdate,
  });
  const cellCoverCandidates = useMemo(() => {
    const displayOrderBySatId = new Map(viz.displaySats.map((sat, index) => [sat.id, index]));

    return [...viz.satBeams.entries()].flatMap(([satelliteId, beams]) => {
      const displayOrder = displayOrderBySatId.get(satelliteId) ?? 0;
      return beams.flatMap(beam => {
        const candidate = createCellCoverCandidate({
          satelliteId,
          beam,
          footprintRadius: viz.footprintRadiusWorld,
          displayOrder,
        });
        return candidate ? [candidate] : [];
      });
    });
  }, [viz.displaySats, viz.footprintRadiusWorld, viz.satBeams]);
  const paintedCells = useMemo(
    () => resolveHexCellCoverAssignments({
      cells,
      beams: cellCoverCandidates,
      hysteresis: cellCoverHysteresisRef.current,
    }),
    [cellCoverCandidates, cells],
  );
  const showSpineParticles =
    runtime.effectsEnabled.spineParticles
    && !paused
    && !runtime.reducedMotion;
  const showOrbitTrail =
    runtime.effectsEnabled.orbitTrail
    && !runtime.reducedMotion;
  const recentHoActive =
    sim.recentHoSourceSatId !== null
    || sim.recentHoTargetSatId !== null;
  const showGroundRipple =
    (runtime.effectsEnabled.servingRipple || runtime.effectsEnabled.pendingRipple)
    && !paused
    && !runtime.reducedMotion
    && !recentHoActive;
  const cinematicSpotlightActive = isSpotlightMode(runtime.cinematicMode);
  const cinematicSpotlightTargets = useMemo(
    () => resolveCinematicSpotlightTargets({
      satBeams: viz.satBeams,
      cinematicMode: runtime.cinematicMode,
    }),
    [runtime.cinematicMode, viz.satBeams],
  );

  useEffect(() => {
    cellCoverHysteresisRef.current.clear();
  }, [runtime.handoverResetKey, runtime.signalResetKey]);

  useEffect(() => {
    writeCameraTelemetry(lastCameraPresetRef.current, cameraTweenRef.current ? 'animating' : 'idle');
  });

  useLayoutEffect(() => {
    const command = runtime.cameraCommand;
    if (!command || lastCameraCommandAtRef.current === command.issuedAtMs) return;

    lastCameraCommandAtRef.current = command.issuedAtMs;
    lastCameraPresetRef.current = command.preset;

    const presetPose = CAMERA_PRESET_POSES[command.preset];
    const controls = controlsRef.current;
    const toPosition = new THREE.Vector3(...presetPose.position);
    const toTarget = new THREE.Vector3(...presetPose.target);
    const currentTarget = controls?.target.clone() ?? new THREE.Vector3();

    if (runtime.reducedMotion) {
      cameraTweenRef.current = null;
      applyCameraPose(command.preset, 'idle');
      return;
    }

    cameraTweenRef.current = {
      preset: command.preset,
      startedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
      fromPosition: camera.position.clone(),
      fromTarget: currentTarget,
      toPosition,
      toTarget,
    };
    writeCameraTelemetry(command.preset, 'animating');
  }, [camera, runtime.cameraCommand, runtime.reducedMotion]);

  useFrame(() => {
    const tween = cameraTweenRef.current;
    if (!tween) {
      if (runtime.reducedMotion && lastCameraPresetRef.current) {
        applyCameraPose(lastCameraPresetRef.current, 'idle');
      }
      return;
    }

    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const progress = Math.min(Math.max((nowMs - tween.startedAtMs) / CAMERA_TWEEN_DURATION_MS, 0), 1);
    const eased = easeInOutCubic(progress);
    const controls = controlsRef.current;

    camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
    if (controls) {
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      controls.update();
    }

    if (progress >= 1) {
      camera.position.copy(tween.toPosition);
      controls?.target.copy(tween.toTarget);
      controls?.update();
      cameraTweenRef.current = null;
      writeCameraTelemetry(tween.preset, 'idle');
      return;
    }

    writeCameraTelemetry(tween.preset, 'animating');
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 600, 750]} fov={60} near={0.1} far={10000} />
      <OrbitControls
        ref={controlsRef}
        enableDamping={false}
        rotateSpeed={0.3}
        zoomSpeed={0.45}
        panSpeed={0.3}
        minDistance={50}
        maxDistance={3000}
      />

      {cinematicSpotlightActive && (
        <fogExp2 attach="fog" args={[CINEMATIC_FOG_COLOR, CINEMATIC_FOG_DENSITY]} />
      )}
      <hemisphereLight args={[0xffffff, 0x444444, resolveCinematicLightIntensity(1.0, runtime.cinematicMode)]} />
      <ambientLight intensity={resolveCinematicLightIntensity(0.2, runtime.cinematicMode)} />
      <directionalLight
        castShadow
        position={[0, 50, 0]}
        intensity={resolveCinematicLightIntensity(1.5, runtime.cinematicMode)}
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
      {cinematicSpotlightTargets.map(target => (
        <pointLight
          key={target.id}
          color={target.color}
          intensity={target.intensity}
          distance={CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD}
          decay={CINEMATIC_EVENT_LIGHT_DECAY}
          position={[target.groundX, CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD, target.groundZ]}
        />
      ))}

      <Suspense fallback={null}>
        <NTPUScene />
      </Suspense>
      <Suspense fallback={null}>
        <UAV position={[0, 10, 0]} scale={10} />
      </Suspense>

      <GroundScene />
      <EarthFixedCells cells={paintedCells} showDebugLabels={runtime.beamDensity === 'all'} />
      <AmbientFootprintRings rings={viz.ambientRings} footprintRadiusWorld={viz.footprintRadiusWorld} />
      <HandoverLinks satellites={viz.displaySats} eventRoles={viz.eventRoles} satBeams={viz.satBeams} />
      <BeamPulseClock reducedMotion={runtime.reducedMotion} />
      <ModqnReplaySceneLayer
        displayState={modqnReplayDisplayState}
        reducedMotion={runtime.reducedMotion}
      />
      {showOrbitTrail && (
        <OrbitTrail satellites={viz.displaySats} />
      )}
      {showSpineParticles && (
        <SpineParticles satellites={viz.displaySats} satBeams={viz.satBeams} />
      )}
      {showGroundRipple && (
        <ServingGroundRipple
          satBeams={viz.satBeams}
          footprintRadius={viz.footprintRadiusWorld}
          servingEnabled={runtime.effectsEnabled.servingRipple}
          pendingEnabled={runtime.effectsEnabled.pendingRipple}
          paused={paused}
          reducedMotion={runtime.reducedMotion}
          recentHoActive={recentHoActive}
        />
      )}

      {viz.displaySats.map(sat => (
        <SatelliteMarker
          key={sat.id}
          position={sat.world}
          label={formatSatelliteLabel(sat.id)}
          eventRole={viz.eventRoles.get(sat.id)}
          satelliteTintColor={sat.satelliteTintColor}
        />
      ))}

      {SHOW_BEAMS && viz.displaySats
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
            reducedMotion={runtime.reducedMotion}
            cinematicMode={runtime.cinematicMode}
          />
        );
        })}
      <IntraHandoverArrow vizFrame={viz} runtime={runtime} />
    </>
  );
}

interface MainSceneProps {
  speed: number;
  paused: boolean;
  profile: Profile;
  runtime: RuntimeConfig;
  modqnReplayDisplayState: ModqnReplayPlaybackDisplayState | null;
  onSimUpdate: (state: SimState) => void;
}

export const MainScene = memo(function MainScene({
  speed,
  paused,
  profile,
  runtime,
  modqnReplayDisplayState,
  onSimUpdate,
}: MainSceneProps) {
  return (
    <div className="leo-main-scene" data-testid="leo-main-scene" style={{
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
            profile={profile}
            speed={speed}
            paused={paused}
            runtime={runtime}
            modqnReplayDisplayState={modqnReplayDisplayState}
            onSimUpdate={onSimUpdate}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});

MainScene.displayName = 'MainScene';
