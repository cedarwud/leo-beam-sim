import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { satelliteTint, satelliteTintIndex } from '../constants/beamRoleTokens';
import type { BeamTarget } from '../scene/beamTargetTypes';
import type { VisibleSat } from '../scene/types';
import { SpineParticles, resolveSpineParticlePlans } from '../viz/SpineParticles';
import { satelliteGlyph } from '../viz/glyphs';

interface Vc3bFixtureInput {
  enabled?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
}

interface Vc3bBeamFixture {
  satelliteId: string;
  displayOrder: number;
  beamId: number;
  groundX: number;
  groundZ: number;
  role?: BeamTarget['role'];
  isServing?: boolean;
  isScheduledActive?: boolean;
}

export interface Vc3bSpineParticlesFixtureResult {
  canvasReady: boolean;
  eventBeamCount: number;
  particleCount: number;
  particlesPerEventBeam: number;
  particleColors: string[];
  excludedBeamCount: number;
  gate: {
    enabled: boolean;
    paused: boolean;
    reducedMotion: boolean;
  };
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    expectedParticleColors: string[];
  };
}

const BACKGROUND_COLOR = '#020912';
const VIEWPORT = { width: 960, height: 640 };

let root: Root | null = null;

const fixtures: Vc3bBeamFixture[] = [
  {
    satelliteId: 'shell-pro-53-P0-S0',
    displayOrder: 0,
    beamId: 3,
    groundX: -150,
    groundZ: -26,
    role: 'serving',
    isServing: true,
  },
  {
    satelliteId: 'shell-pro-53-P0-S1',
    displayOrder: 1,
    beamId: 5,
    groundX: -48,
    groundZ: 16,
    role: 'prepared',
  },
  {
    satelliteId: 'shell-pro-53-P0-S2',
    displayOrder: 2,
    beamId: 7,
    groundX: 54,
    groundZ: -18,
    role: 'approach',
  },
  {
    satelliteId: 'shell-pro-53-P0-S3',
    displayOrder: 3,
    beamId: 9,
    groundX: 150,
    groundZ: 22,
    role: 'secondary',
  },
  {
    satelliteId: 'shell-pro-53-P0-S4',
    displayOrder: 0,
    beamId: 11,
    groundX: 0,
    groundZ: 92,
  },
];

function createSatellite(fixture: Vc3bBeamFixture): VisibleSat {
  const satelliteVisualIndex = satelliteTintIndex(fixture.satelliteId, fixture.displayOrder);

  return {
    id: fixture.satelliteId,
    shellId: 'fixture-shell',
    altitudeKm: 550,
    world: new THREE.Vector3(fixture.groundX, 180 - fixture.displayOrder * 9, 132),
    topo: { eastKm: 0, northKm: 0, upKm: 0, elevationDeg: 55, azimuthDeg: 90, rangeKm: 650 },
    latDeg: 0,
    lonDeg: 0,
    satelliteTintColor: satelliteTint(fixture.satelliteId, fixture.displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
  };
}

function createBeam(fixture: Vc3bBeamFixture): BeamTarget {
  const satelliteVisualIndex = satelliteTintIndex(fixture.satelliteId, fixture.displayOrder);

  return {
    beamId: fixture.beamId,
    groundX: fixture.groundX,
    groundZ: fixture.groundZ,
    isServing: fixture.isServing ?? false,
    isScheduledActive: fixture.isScheduledActive ?? true,
    isPrimary: Boolean(fixture.role),
    showBeam: true,
    frequencyIndex: fixture.displayOrder,
    satelliteTintColor: satelliteTint(fixture.satelliteId, fixture.displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
    role: fixture.role,
    sinrDb: 18 - fixture.displayOrder,
  };
}

function createFixtureState(): {
  satellites: VisibleSat[];
  satBeams: Map<string, BeamTarget[]>;
} {
  const satellites = fixtures.map(createSatellite);
  const satBeams = new Map<string, BeamTarget[]>();

  fixtures.forEach(fixture => {
    satBeams.set(fixture.satelliteId, [createBeam(fixture)]);
  });

  return { satellites, satBeams };
}

function FixtureScene(input: Required<Vc3bFixtureInput>) {
  const { satellites, satBeams } = createFixtureState();

  return (
    <Canvas
      data-testid="vc3b-canvas"
      orthographic
      camera={{ position: [0, 250, 380], zoom: 1.35, near: 1, far: 1200 }}
      gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
      onCreated={({ camera, gl, scene }) => {
        gl.setClearColor(BACKGROUND_COLOR, 1);
        scene.background = new THREE.Color(BACKGROUND_COLOR);
        camera.lookAt(0, 36, 0);
        camera.updateProjectionMatrix();
      }}
    >
      <SpineParticles
        satellites={satellites}
        satBeams={satBeams}
        enabled={input.enabled}
        paused={input.paused}
        reducedMotion={input.reducedMotion}
      />
    </Canvas>
  );
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderVc3SpineParticlesFixture(
  input: Vc3bFixtureInput = {},
): Promise<Vc3bSpineParticlesFixtureResult> {
  const gate = {
    enabled: input.enabled ?? true,
    paused: input.paused ?? false,
    reducedMotion: input.reducedMotion ?? false,
  };
  const { satellites, satBeams } = createFixtureState();
  const plans = resolveSpineParticlePlans({ satellites, satBeams, ...gate });
  const ungatedPlans = resolveSpineParticlePlans({ satellites, satBeams });

  root?.unmount();
  document.body.innerHTML = '<div id="vc3b-root"></div>';
  document.body.style.margin = '0';
  document.body.style.background = BACKGROUND_COLOR;
  document.body.style.overflow = 'hidden';

  const host = document.getElementById('vc3b-root');
  if (!host) throw new Error('vc3b-root was not created');
  host.style.width = `${VIEWPORT.width}px`;
  host.style.height = `${VIEWPORT.height}px`;
  host.style.position = 'relative';

  root = createRoot(host);
  flushSync(() => {
    root?.render(<FixtureScene {...gate} />);
  });
  await nextPaint();

  const eventBeamIds = new Set(ungatedPlans.map(plan => `${plan.satelliteId}:B${plan.beamId}`));
  const particleColors = [...new Set(plans.map(plan => plan.color.toLowerCase()))];

  return {
    canvasReady: Boolean(document.querySelector('canvas')),
    eventBeamCount: eventBeamIds.size,
    particleCount: plans.length,
    particlesPerEventBeam: eventBeamIds.size > 0 ? ungatedPlans.length / eventBeamIds.size : 0,
    particleColors,
    excludedBeamCount: fixtures.length - eventBeamIds.size,
    gate,
    samplePlan: {
      backgroundColor: BACKGROUND_COLOR,
      viewport: VIEWPORT,
      expectedParticleColors: [...new Set(ungatedPlans.map(plan => plan.color.toLowerCase()))],
    },
  };
}
