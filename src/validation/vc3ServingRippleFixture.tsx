import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { satelliteGlyph } from '../viz/glyphs';
import { satelliteTint, satelliteTintIndex } from '../constants/beamRoleTokens';
import {
  GROUND_RIPPLE_RING_COUNT,
  ServingGroundRipple,
  createGroundRippleInstances,
  resolveGroundRippleEnvelope,
  resolveGroundRippleTargets,
} from '../viz/ServingGroundRipple';
import type { BeamTarget } from '../scene/beamTargetTypes';

interface Vc3dFixtureInput {
  servingEnabled?: boolean;
  pendingEnabled?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
  recentHoActive?: boolean;
}

export interface Vc3dServingRippleFixtureResult {
  canvasReady: boolean;
  targetCount: number;
  ringCount: number;
  targets: Array<{
    id: string;
    role: string;
    beamId: number;
    color: string;
    groundX: number;
    groundZ: number;
  }>;
  gate: Required<Vc3dFixtureInput>;
  envelopeSamples: Array<{
    role: string;
    atSec: number;
    progress: number;
    radius: number;
    opacity: number;
    visible: boolean;
  }>;
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    expectedColors: string[];
    ringCountPerTarget: number;
  };
}

const BACKGROUND_COLOR = '#020912';
const VIEWPORT = { width: 960, height: 640 };
const FOOTPRINT_RADIUS = 80;

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
        groundX: -110,
        groundZ: 0,
        role: 'serving',
        isServing: true,
      }),
    ]],
    ['shell-pro-53-P0-S1', [
      createBeam({
        satelliteId: 'shell-pro-53-P0-S1',
        displayOrder: 1,
        beamId: 5,
        groundX: 110,
        groundZ: 0,
        role: 'prepared',
      }),
    ]],
    ['shell-pro-53-P0-S2', [
      createBeam({
        satelliteId: 'shell-pro-53-P0-S2',
        displayOrder: 2,
        beamId: 7,
        groundX: 0,
        groundZ: 110,
        role: 'approach',
      }),
    ]],
  ]);
}

function FixtureScene(input: Required<Vc3dFixtureInput>) {
  return (
    <Canvas
      data-testid="vc3d-canvas"
      orthographic
      camera={{ position: [0, 320, 360], zoom: 1.55, near: 1, far: 1200 }}
      gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
      onCreated={({ camera, gl, scene }) => {
        gl.setClearColor(BACKGROUND_COLOR, 1);
        scene.background = new THREE.Color(BACKGROUND_COLOR);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }}
    >
      <ServingGroundRipple
        satBeams={createFixtureBeams()}
        footprintRadius={FOOTPRINT_RADIUS}
        servingEnabled={input.servingEnabled}
        pendingEnabled={input.pendingEnabled}
        paused={input.paused}
        reducedMotion={input.reducedMotion}
        recentHoActive={input.recentHoActive}
      />
    </Canvas>
  );
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderVc3ServingRippleFixture(
  input: Vc3dFixtureInput = {},
): Promise<Vc3dServingRippleFixtureResult> {
  const gate = {
    servingEnabled: input.servingEnabled ?? true,
    pendingEnabled: input.pendingEnabled ?? true,
    paused: input.paused ?? false,
    reducedMotion: input.reducedMotion ?? false,
    recentHoActive: input.recentHoActive ?? false,
  };
  const satBeams = createFixtureBeams();
  const targets = resolveGroundRippleTargets({
    satBeams,
    footprintRadius: FOOTPRINT_RADIUS,
    ...gate,
  });
  const instances = createGroundRippleInstances(targets);

  root?.unmount();
  document.body.innerHTML = '<div id="vc3d-root"></div>';
  document.body.style.margin = '0';
  document.body.style.background = BACKGROUND_COLOR;
  document.body.style.overflow = 'hidden';

  const host = document.getElementById('vc3d-root');
  if (!host) throw new Error('vc3d-root was not created');
  host.style.width = `${VIEWPORT.width}px`;
  host.style.height = `${VIEWPORT.height}px`;
  host.style.position = 'relative';

  root = createRoot(host);
  flushSync(() => {
    root?.render(<FixtureScene {...gate} />);
  });
  await nextPaint();

  const envelopeSamples = targets.flatMap(target => {
    const sampleTimes = [0, target.expandSec / 2, target.expandSec];
    return sampleTimes.map(atSec => ({
      role: target.role,
      atSec,
      ...resolveGroundRippleEnvelope(target, atSec, 0),
    }));
  });

  return {
    canvasReady: Boolean(document.querySelector('canvas')),
    targetCount: targets.length,
    ringCount: instances.length,
    targets: targets.map(target => ({
      id: target.id,
      role: target.role,
      beamId: target.beamId,
      color: target.color,
      groundX: target.groundX,
      groundZ: target.groundZ,
    })),
    gate,
    envelopeSamples,
    samplePlan: {
      backgroundColor: BACKGROUND_COLOR,
      viewport: VIEWPORT,
      expectedColors: [...new Set(targets.map(target => target.color.toLowerCase()))],
      ringCountPerTarget: GROUND_RIPPLE_RING_COUNT,
    },
  };
}
