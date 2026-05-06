import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { satelliteTint, satelliteTintIndex } from '../constants/beamRoleTokens';
import {
  CELL_COVER_FILL_OPACITY,
  EarthFixedCells,
  createCellCoverCandidate,
  generateHexGrid,
  resolveHexCellCoverAssignments,
  type CellCoverCandidate,
  type CellData,
} from '../viz/EarthFixedCells';
import type { BeamTarget } from '../viz/SatelliteBeams';
import { satelliteGlyph } from '../viz/glyphs';

interface Vc3FixtureInput {
  showDebugLabels?: boolean;
}

interface Vc3FixtureBeam {
  satelliteId: string;
  displayOrder: number;
  beamId: number;
  groundX: number;
  groundZ: number;
  role?: BeamTarget['role'];
  isServing?: boolean;
  frequencyIndex: number;
  sinrDb: number;
}

export interface Vc3HexPaintFixtureResult {
  canvasReady: boolean;
  cells: Array<{
    id: number;
    isServed: boolean;
    coveringBeamKey: string | null;
    debugLabel: string | null;
    outerBorderColor: string | null;
    fillColor: string | null;
    innerRoleBorderColor: string | null;
  }>;
  expected: {
    dominantBeamKey: string;
    outerBorderColor: string;
    fillColor: string;
    innerRoleBorderColor: string;
    fillOpacity: number;
  };
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    center: { x: number; y: number };
    outerBorderRadiusPx: number;
    innerBorderRadiusPx: number;
  };
}

const BACKGROUND_COLOR = '#020912';
const VIEWPORT = { width: 800, height: 600 };
const CAMERA_ZOOM = 1.55;
const FOOTPRINT_RADIUS = 68;
const CENTRAL_CELL_RADIUS = 80;

let root: Root | null = null;

function createFixtureBeam(input: Vc3FixtureBeam): BeamTarget {
  const satelliteVisualIndex = satelliteTintIndex(input.satelliteId, input.displayOrder);
  return {
    beamId: input.beamId,
    groundX: input.groundX,
    groundZ: input.groundZ,
    isServing: input.isServing ?? false,
    isScheduledActive: true,
    isPrimary: Boolean(input.role),
    showBeam: true,
    frequencyIndex: input.frequencyIndex,
    satelliteTintColor: satelliteTint(input.satelliteId, input.displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
    role: input.role,
    sinrDb: input.sinrDb,
  };
}

function fixtureCandidates(): CellCoverCandidate[] {
  const beams: Vc3FixtureBeam[] = [
    {
      satelliteId: 'shell-pro-53-P0-S0',
      displayOrder: 2,
      beamId: 2,
      groundX: -18,
      groundZ: 12,
      frequencyIndex: 0,
      sinrDb: 42,
    },
    {
      satelliteId: 'shell-pro-53-P0-S1',
      displayOrder: 0,
      beamId: 3,
      groundX: 14,
      groundZ: -14,
      role: 'prepared',
      frequencyIndex: 1,
      sinrDb: 25,
    },
    {
      satelliteId: 'shell-pro-53-P0-S2',
      displayOrder: 1,
      beamId: 4,
      groundX: 0,
      groundZ: 0,
      role: 'serving',
      isServing: true,
      frequencyIndex: 2,
      sinrDb: 8,
    },
  ];

  return beams.flatMap(beam => {
    const candidate = createCellCoverCandidate({
      satelliteId: beam.satelliteId,
      beam: createFixtureBeam(beam),
      footprintRadius: FOOTPRINT_RADIUS,
      displayOrder: beam.displayOrder,
    });
    return candidate ? [candidate] : [];
  });
}

function createFixtureCells(): CellData[] {
  return resolveHexCellCoverAssignments({
    cells: generateHexGrid({
      rows: 1,
      cols: 1,
      cellRadius: CENTRAL_CELL_RADIUS,
      centerX: 0,
      centerZ: 0,
    }),
    beams: fixtureCandidates(),
    hysteresis: new Map(),
  });
}

function FixtureScene({ cells, showDebugLabels }: { cells: CellData[]; showDebugLabels: boolean }) {
  return (
    <Canvas
      data-testid="vc3a-canvas"
      orthographic
      camera={{ position: [0, 320, 360], zoom: CAMERA_ZOOM, near: 1, far: 1000 }}
      gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
      onCreated={({ camera, gl, scene }) => {
        gl.setClearColor(BACKGROUND_COLOR, 1);
        scene.background = new THREE.Color(BACKGROUND_COLOR);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }}
    >
      <EarthFixedCells cells={cells} showDebugLabels={showDebugLabels} />
    </Canvas>
  );
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderVc3HexPaintFixture(input: Vc3FixtureInput = {}): Promise<Vc3HexPaintFixtureResult> {
  const cells = createFixtureCells();
  const dominant = cells[0].coveringBeam;
  if (!dominant) throw new Error('vc3a fixture did not resolve a dominant covering beam');

  root?.unmount();
  document.body.innerHTML = '<div id="vc3a-root"></div>';
  document.body.style.margin = '0';
  document.body.style.background = BACKGROUND_COLOR;
  document.body.style.overflow = 'hidden';

  const host = document.getElementById('vc3a-root');
  if (!host) throw new Error('vc3a-root was not created');
  host.style.width = `${VIEWPORT.width}px`;
  host.style.height = `${VIEWPORT.height}px`;
  host.style.position = 'relative';

  root = createRoot(host);
  flushSync(() => {
    root?.render(<FixtureScene cells={cells} showDebugLabels={input.showDebugLabels ?? false} />);
  });
  await nextPaint();

  return {
    canvasReady: Boolean(document.querySelector('canvas')),
    cells: cells.map(cell => ({
      id: cell.id,
      isServed: cell.isServed,
      coveringBeamKey: cell.coveringBeam?.beamKey ?? null,
      debugLabel: cell.coveringBeam?.debugLabel ?? null,
      outerBorderColor: cell.coveringBeam?.satTintColor ?? null,
      fillColor: cell.coveringBeam?.frequencyColor ?? null,
      innerRoleBorderColor: cell.coveringBeam?.isServingOrPending ? cell.coveringBeam.roleColor : null,
    })),
    expected: {
      dominantBeamKey: dominant.beamKey,
      outerBorderColor: dominant.satTintColor,
      fillColor: dominant.frequencyColor,
      innerRoleBorderColor: dominant.roleColor,
      fillOpacity: CELL_COVER_FILL_OPACITY,
    },
    samplePlan: {
      backgroundColor: BACKGROUND_COLOR,
      viewport: VIEWPORT,
      center: { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 },
      outerBorderRadiusPx: CENTRAL_CELL_RADIUS * CAMERA_ZOOM,
      innerBorderRadiusPx: CENTRAL_CELL_RADIUS * 0.82 * CAMERA_ZOOM,
    },
  };
}
