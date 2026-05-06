import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { satelliteGlyph } from '../viz/glyphs';
import { satelliteTint, satelliteTintIndex } from '../constants/beamRoleTokens';
import type { VisibleSat } from '../scene/types';
import {
  ORBIT_TRAIL_SAMPLE_COUNT,
  OrbitTrailPrimitive,
  createOrbitTrailGeometry,
  resolveOrbitTrailPlans,
  type OrbitTrailPlan,
} from '../viz/OrbitTrail';

interface Vc3cFixtureInput {
  enabled?: boolean;
  reducedMotion?: boolean;
}

interface StaticTrailGeometry {
  id: string;
  color: string;
  geometry: THREE.BufferGeometry;
}

export interface Vc3cOrbitTrailFixtureResult {
  canvasReady: boolean;
  visibleSatelliteCount: number;
  trailCount: number;
  geometryIds: string[];
  attributeCounts: Array<{
    id: string;
    position: number;
    trailOpacity: number;
  }>;
  gate: {
    enabled: boolean;
    reducedMotion: boolean;
  };
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    expectedTrailColors: string[];
    firstTrailSamples: Array<{
      sampleIndex: number;
      x: number;
      y: number;
      opacity: number;
    }>;
  };
}

const BACKGROUND_COLOR = '#020912';
const VIEWPORT = { width: 960, height: 640 };
const CAMERA_ZOOM = 2;
const TRAIL_HEAD_X = 180;
const TRAIL_SAMPLE_SPACING = 10;
const TRAIL_Y_POSITIONS = [-72, 0, 72];
const SAMPLE_INDICES = [0, 5, 10, 15, 20];

let root: Root | null = null;

function createSatellite(satelliteId: string, displayOrder: number): VisibleSat {
  const satelliteVisualIndex = satelliteTintIndex(satelliteId, displayOrder);

  return {
    id: satelliteId,
    shellId: 'fixture-shell',
    altitudeKm: 550,
    world: new THREE.Vector3(TRAIL_HEAD_X, TRAIL_Y_POSITIONS[displayOrder] ?? 0, 0),
    topo: { eastKm: 0, northKm: 0, upKm: 0, elevationDeg: 55, azimuthDeg: 90, rangeKm: 650 },
    latDeg: 0,
    lonDeg: 0,
    satelliteTintColor: satelliteTint(satelliteId, displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
  };
}

function createFixtureSatellites(): VisibleSat[] {
  return [
    createSatellite('shell-pro-53-P0-S0', 0),
    createSatellite('shell-pro-53-P0-S1', 1),
    createSatellite('shell-pro-53-P0-S2', 2),
  ];
}

function createStaticTrailSamples(trailIndex: number): THREE.Vector3[] {
  const y = TRAIL_Y_POSITIONS[trailIndex] ?? 0;

  return Array.from({ length: ORBIT_TRAIL_SAMPLE_COUNT }, (_, sampleIndex) => (
    new THREE.Vector3(TRAIL_HEAD_X - sampleIndex * TRAIL_SAMPLE_SPACING, y, 0)
  ));
}

function worldToScreen(point: THREE.Vector3): { x: number; y: number } {
  return {
    x: VIEWPORT.width / 2 + point.x * CAMERA_ZOOM,
    y: VIEWPORT.height / 2 - point.y * CAMERA_ZOOM,
  };
}

function createStaticTrailGeometries(plans: OrbitTrailPlan[]): StaticTrailGeometry[] {
  return plans.map((plan, index) => ({
    id: plan.id,
    color: plan.color,
    geometry: createOrbitTrailGeometry(createStaticTrailSamples(index)),
  }));
}

function FixtureScene({ trails }: { trails: StaticTrailGeometry[] }) {
  useEffect(() => () => {
    trails.forEach(trail => trail.geometry.dispose());
  }, [trails]);

  return (
    <Canvas
      data-testid="vc3c-canvas"
      orthographic
      camera={{ position: [0, 0, 500], zoom: CAMERA_ZOOM, near: 1, far: 1200 }}
      gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
      onCreated={({ camera, gl, scene }) => {
        gl.setClearColor(BACKGROUND_COLOR, 1);
        scene.background = new THREE.Color(BACKGROUND_COLOR);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }}
    >
      {trails.map(trail => (
        <OrbitTrailPrimitive
          key={trail.id}
          geometry={trail.geometry}
          color={trail.color}
        />
      ))}
    </Canvas>
  );
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderVc3OrbitTrailFixture(
  input: Vc3cFixtureInput = {},
): Promise<Vc3cOrbitTrailFixtureResult> {
  const gate = {
    enabled: input.enabled ?? true,
    reducedMotion: input.reducedMotion ?? false,
  };
  const satellites = createFixtureSatellites();
  const plans = resolveOrbitTrailPlans({ satellites, ...gate });
  const trails = createStaticTrailGeometries(plans);
  const firstTrailSamples = createStaticTrailSamples(0);

  root?.unmount();
  document.body.innerHTML = '<div id="vc3c-root"></div>';
  document.body.style.margin = '0';
  document.body.style.background = BACKGROUND_COLOR;
  document.body.style.overflow = 'hidden';

  const host = document.getElementById('vc3c-root');
  if (!host) throw new Error('vc3c-root was not created');
  host.style.width = `${VIEWPORT.width}px`;
  host.style.height = `${VIEWPORT.height}px`;
  host.style.position = 'relative';

  root = createRoot(host);
  flushSync(() => {
    root?.render(<FixtureScene trails={trails} />);
  });
  await nextPaint();

  return {
    canvasReady: Boolean(document.querySelector('canvas')),
    visibleSatelliteCount: satellites.length,
    trailCount: plans.length,
    geometryIds: trails.map(trail => trail.geometry.uuid),
    attributeCounts: trails.map(trail => ({
      id: trail.id,
      position: trail.geometry.getAttribute('position').count,
      trailOpacity: trail.geometry.getAttribute('trailOpacity').count,
    })),
    gate,
    samplePlan: {
      backgroundColor: BACKGROUND_COLOR,
      viewport: VIEWPORT,
      expectedTrailColors: plans.map(plan => plan.color.toLowerCase()),
      firstTrailSamples: SAMPLE_INDICES.map(sampleIndex => {
        const screen = worldToScreen(firstTrailSamples[sampleIndex]);
        return {
          sampleIndex,
          x: screen.x,
          y: screen.y,
          opacity: plans[0]?.opacities[sampleIndex] ?? 0,
        };
      }),
    },
  };
}
