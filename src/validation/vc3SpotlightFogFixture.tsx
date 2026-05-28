import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { satelliteGlyph } from '../viz/glyphs';
import { satelliteTint, satelliteTintIndex } from '../constants/beamRoleTokens';
import type { CinematicMode } from '../scene/types';
import {
  CINEMATIC_EVENT_LIGHT_DECAY,
  CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD,
  CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD,
  CINEMATIC_FOG_COLOR,
  CINEMATIC_FOG_DENSITY,
  isSpotlightMode,
  resolveCinematicLightIntensity,
  resolveCinematicSpotlightTargets,
} from '../scene/cinematicEffects';
import type { BeamTarget } from '../scene/beamTargetTypes';

interface Vc3eFixtureInput {
  cinematicMode?: CinematicMode;
  viewport?: { width: number; height: number };
}

export interface Vc3eSpotlightFogFixtureResult {
  canvasReady: boolean;
  cinematicMode: CinematicMode;
  fogActive: boolean;
  dimmedLightIntensity: {
    hemisphere: number;
    ambient: number;
    directional: number;
  };
  spotlightTargets: Array<{
    role: string;
    beamId: number;
    color: string;
    groundX: number;
    groundZ: number;
    intensity: number;
  }>;
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    points: Record<'serving' | 'pending' | 'nonEvent' | 'campus', { x: number; y: number }>;
  };
}

const BACKGROUND_COLOR = '#020912';
const CAMPUS_SURFACE_COLOR = '#7f95b4';
const EVENT_DISC_COLOR = '#b9c4d2';
const BASE_HEMISPHERE_INTENSITY = 1;
const BASE_AMBIENT_INTENSITY = 0.7;
const BASE_DIRECTIONAL_INTENSITY = 1.35;
const DEFAULT_VIEWPORT = { width: 960, height: 640 };
const SAMPLE_WORLD_POINTS = {
  serving: { x: -185, y: -70 },
  pending: { x: 45, y: 92 },
  nonEvent: { x: 245, y: -128 },
  campus: { x: -20, y: 206 },
} as const;

let root: Root | null = null;

function createBeam(input: {
  satelliteId: string;
  displayOrder: number;
  beamId: number;
  groundX: number;
  groundZ: number;
  role?: BeamTarget['role'];
  isServing?: boolean;
  isScheduledActive?: boolean;
}): BeamTarget {
  const satelliteVisualIndex = satelliteTintIndex(input.satelliteId, input.displayOrder);

  return {
    beamId: input.beamId,
    groundX: input.groundX,
    groundZ: input.groundZ,
    isServing: input.isServing ?? false,
    isScheduledActive: input.isScheduledActive ?? true,
    isPrimary: Boolean(input.role || input.isServing),
    showBeam: true,
    frequencyIndex: input.displayOrder,
    satelliteTintColor: satelliteTint(input.satelliteId, input.displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
    role: input.role,
    sinrDb: 18 - input.displayOrder,
  };
}

function createFixtureBeams(): Map<string, BeamTarget[]> {
  return new Map([
    ['shell-pro-53-P0-S0', [
      createBeam({
        satelliteId: 'shell-pro-53-P0-S0',
        displayOrder: 0,
        beamId: 3,
        groundX: SAMPLE_WORLD_POINTS.serving.x,
        groundZ: SAMPLE_WORLD_POINTS.serving.y,
        role: 'serving',
        isServing: true,
      }),
    ]],
    ['shell-pro-53-P0-S1', [
      createBeam({
        satelliteId: 'shell-pro-53-P0-S1',
        displayOrder: 1,
        beamId: 5,
        groundX: SAMPLE_WORLD_POINTS.pending.x,
        groundZ: SAMPLE_WORLD_POINTS.pending.y,
        role: 'prepared',
      }),
    ]],
    ['shell-pro-53-P0-S2', [
      createBeam({
        satelliteId: 'shell-pro-53-P0-S2',
        displayOrder: 2,
        beamId: 7,
        groundX: SAMPLE_WORLD_POINTS.nonEvent.x,
        groundZ: SAMPLE_WORLD_POINTS.nonEvent.y,
      }),
    ]],
  ]);
}

function worldToScreen(
  point: { x: number; y: number },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: viewport.width / 2 + point.x,
    y: viewport.height / 2 - point.y,
  };
}

function FixtureScene({
  cinematicMode,
}: {
  cinematicMode: CinematicMode;
}) {
  const spotlightTargets = resolveCinematicSpotlightTargets({
    satBeams: createFixtureBeams(),
    cinematicMode,
  });
  const fogActive = isSpotlightMode(cinematicMode);

  return (
    <Canvas
      data-testid="vc3e-canvas"
      orthographic
      camera={{ position: [0, 0, 600], zoom: 1, near: 1, far: 1400 }}
      gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
      onCreated={({ camera, gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.2;
        gl.setClearColor(BACKGROUND_COLOR, 1);
        scene.background = new THREE.Color(BACKGROUND_COLOR);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }}
    >
      {fogActive && (
        <fogExp2 attach="fog" args={[CINEMATIC_FOG_COLOR, CINEMATIC_FOG_DENSITY]} />
      )}
      <hemisphereLight
        args={[
          0xffffff,
          0x293344,
          resolveCinematicLightIntensity(BASE_HEMISPHERE_INTENSITY, cinematicMode),
        ]}
      />
      <ambientLight intensity={resolveCinematicLightIntensity(BASE_AMBIENT_INTENSITY, cinematicMode)} />
      <directionalLight
        position={[0, 0, 420]}
        intensity={resolveCinematicLightIntensity(BASE_DIRECTIONAL_INTENSITY, cinematicMode)}
      />
      {spotlightTargets.map(target => (
        <pointLight
          key={target.id}
          color={target.color}
          intensity={target.intensity}
          distance={CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD}
          decay={CINEMATIC_EVENT_LIGHT_DECAY}
          position={[target.groundX, target.groundZ, CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD]}
        />
      ))}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[1200, 900]} />
        <meshStandardMaterial color={CAMPUS_SURFACE_COLOR} roughness={0.42} metalness={0.04} />
      </mesh>
      {[
        SAMPLE_WORLD_POINTS.serving,
        SAMPLE_WORLD_POINTS.pending,
      ].map(point => (
        <mesh key={`${point.x}:${point.y}`} position={[point.x, point.y, 1]}>
          <circleGeometry args={[26, 48]} />
          <meshBasicMaterial
            color={EVENT_DISC_COLOR}
            toneMapped={false}
            fog={!fogActive}
          />
        </mesh>
      ))}
    </Canvas>
  );
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderVc3SpotlightFogFixture(
  input: Vc3eFixtureInput = {},
): Promise<Vc3eSpotlightFogFixtureResult> {
  const cinematicMode = input.cinematicMode ?? 'off';
  const viewport = input.viewport ?? DEFAULT_VIEWPORT;
  const spotlightTargets = resolveCinematicSpotlightTargets({
    satBeams: createFixtureBeams(),
    cinematicMode,
  });

  root?.unmount();
  document.body.innerHTML = '<div id="vc3e-root"></div>';
  document.body.style.margin = '0';
  document.body.style.background = BACKGROUND_COLOR;
  document.body.style.overflow = 'hidden';

  const host = document.getElementById('vc3e-root');
  if (!host) throw new Error('vc3e-root was not created');
  host.style.width = `${viewport.width}px`;
  host.style.height = `${viewport.height}px`;
  host.style.position = 'relative';

  root = createRoot(host);
  flushSync(() => {
    root?.render(<FixtureScene cinematicMode={cinematicMode} />);
  });
  await nextPaint();

  return {
    canvasReady: Boolean(document.querySelector('canvas')),
    cinematicMode,
    fogActive: isSpotlightMode(cinematicMode),
    dimmedLightIntensity: {
      hemisphere: resolveCinematicLightIntensity(BASE_HEMISPHERE_INTENSITY, cinematicMode),
      ambient: resolveCinematicLightIntensity(BASE_AMBIENT_INTENSITY, cinematicMode),
      directional: resolveCinematicLightIntensity(BASE_DIRECTIONAL_INTENSITY, cinematicMode),
    },
    spotlightTargets: spotlightTargets.map(target => ({
      role: target.role,
      beamId: target.beamId,
      color: target.color,
      groundX: target.groundX,
      groundZ: target.groundZ,
      intensity: target.intensity,
    })),
    samplePlan: {
      backgroundColor: BACKGROUND_COLOR,
      viewport,
      points: {
        serving: worldToScreen(SAMPLE_WORLD_POINTS.serving, viewport),
        pending: worldToScreen(SAMPLE_WORLD_POINTS.pending, viewport),
        nonEvent: worldToScreen(SAMPLE_WORLD_POINTS.nonEvent, viewport),
        campus: worldToScreen(SAMPLE_WORLD_POINTS.campus, viewport),
      },
    },
  };
}
