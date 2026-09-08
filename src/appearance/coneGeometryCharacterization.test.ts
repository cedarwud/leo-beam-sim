/**
 * CHARACTERIZATION TEST — what the cone geometry produces TODAY before convergence.
 *
 * Every literal below was produced by running the current code before the
 * convergence refactor. None is computed by calling the function under test.
 *
 * Follows src/appearance/handoverAppearanceModifiers.test.ts for style:
 * node:test, node:assert/strict, pure, no React, no canvas.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { SINR_LIVE_FOOTPRINT_RING_Y_LIFT } from '../constants/sinrLiveConeStyle';
import { MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER } from '../scene/multiCandidateSceneDisplayPolicy';
import { computeSinrLiveBeamFootprintEllipse } from '../scene/sinrLiveBeamGeometry';
import { buildObliqueBeamConePositions } from '../viz/SinrLiveCellBeamCones';
import { resolveServingConeGeometry } from '../scene/servingConeGeometry';
import type { SinrLiveCellFrame } from '../scene/sinrLiveCellModel';
import type { SinrLiveCellPlacement } from '../viz/SinrLiveCellBeamCones';
import type { WorldPoint } from '../viz/CellFootprints';

test('geometry constants retain baseline values', () => {
  assert.equal(SINR_LIVE_FOOTPRINT_RING_Y_LIFT, 0.6);
  assert.equal(MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER, 1);
});

test('footprint ellipse and cone mesh vertices match characterization photograph across grid', () => {
  const PHOTOGRAPH_ROWS = [
    { satId: 'sat-high', cellId: 0, ws: 1, radius: 4, shortAxis: 4, longAxis: 4.098780306383839, azimuth: 2.0344439357957027, elev: 77.39561735162083, renderElev: 77.39561735162083, pos0: [0, 100, 0], pos1: [8.167, 0, -16.3339], pos2: [6.174, 0, -18.6726] },
    { satId: 'sat-high', cellId: 0, ws: 0.8, radius: 3.2, shortAxis: 3.2, longAxis: 3.2790242451070717, azimuth: 2.0344439357957027, elev: 77.39561735162083, renderElev: 77.39561735162083, pos0: [0, 100, 0], pos1: [8.5336, 0, -17.0672], pos2: [6.9392, 0, -18.9381] },
    { satId: 'sat-high', cellId: 0, ws: 1.25, radius: 5, shortAxis: 5, longAxis: 5.123475382979799, azimuth: 2.0344439357957027, elev: 77.39561735162083, renderElev: 77.39561735162083, pos0: [0, 100, 0], pos1: [7.7087, 0, -15.4174], pos2: [5.2175, 0, -18.3408] },
    { satId: 'sat-high', cellId: 1, ws: 1, radius: 6, shortAxis: 6, longAxis: 6.328506932918696, azimuth: -0.4636476090008061, elev: 71.45802203600276, renderElev: 71.45802203600276, pos0: [0, 100, 0], pos1: [-24.3396, 0, 12.1698], pos2: [-24.1001, 0, 16.7935] },
    { satId: 'sat-high', cellId: 1, ws: 0.8, radius: 4.800000000000001, shortAxis: 4.800000000000001, longAxis: 5.062805546334958, azimuth: -0.4636476090008061, elev: 71.45802203600276, renderElev: 71.45802203600276, pos0: [0, 100, 0], pos1: [-25.4717, 0, 12.7358], pos2: [-25.2801, 0, 16.4348] },
    { satId: 'sat-high', cellId: 1, ws: 1.25, radius: 7.5, shortAxis: 7.5, longAxis: 7.91063366614837, azimuth: -0.4636476090008061, elev: 71.45802203600276, renderElev: 71.45802203600276, pos0: [0, 100, 0], pos1: [-22.9245, 0, 11.4623], pos2: [-22.6252, 0, 17.2419] },
    { satId: 'sat-high', cellId: 2, ws: 1, radius: 3.5, shortAxis: 3.5, longAxis: 3.5, azimuth: 0, elev: 89.99999999942705, renderElev: 89.99999999942705, pos0: [0, 100, 0], pos1: [3.5, 0, 0], pos2: [2.4749, 0, 2.4749] },
    { satId: 'sat-high', cellId: 2, ws: 0.8, radius: 2.8000000000000003, shortAxis: 2.8000000000000003, longAxis: 2.8000000000000003, azimuth: 0, elev: 89.99999999942705, renderElev: 89.99999999942705, pos0: [0, 100, 0], pos1: [2.8, 0, 0], pos2: [1.9799, 0, 1.9799] },
    { satId: 'sat-high', cellId: 2, ws: 1.25, radius: 4.375, shortAxis: 4.375, longAxis: 4.375, azimuth: 0, elev: 89.99999999942705, renderElev: 89.99999999942705, pos0: [0, 100, 0], pos1: [4.375, 0, 0], pos2: [3.0936, 0, 3.0936] },
    { satId: 'sat-oblique', cellId: 0, ws: 1, radius: 4, shortAxis: 4, longAxis: 5.656854249492381, azimuth: -0.4048917862850834, elev: 38.23240435411964, renderElev: 45, pos0: [80, 60, -50], pos1: [15.1995, 0, -22.2283], pos2: [14.7908, 0, -18.9759] },
    { satId: 'sat-oblique', cellId: 0, ws: 0.8, radius: 3.2, shortAxis: 3.2, longAxis: 4.525483399593905, azimuth: -0.4048917862850834, elev: 38.23240435411964, renderElev: 45, pos0: [80, 60, -50], pos1: [14.1596, 0, -21.7827], pos2: [13.8326, 0, -19.1808] },
    { satId: 'sat-oblique', cellId: 0, ws: 1.25, radius: 5, shortAxis: 5, longAxis: 7.0710678118654755, azimuth: -0.4048917862850834, elev: 38.23240435411964, renderElev: 45, pos0: [80, 60, -50], pos1: [16.4993, 0, -22.7854], pos2: [15.9884, 0, -18.7199] },
    { satId: 'sat-oblique', cellId: 1, ws: 1, radius: 6, shortAxis: 6, longAxis: 8.485281374238571, azimuth: -0.5337081916392615, elev: 25.15457573132144, renderElev: 45, pos0: [80, 60, -50], pos1: [-22.6948, 0, 10.6833], pos2: [-22.6761, 0, 15.6002] },
    { satId: 'sat-oblique', cellId: 1, ws: 0.8, radius: 4.800000000000001, shortAxis: 4.800000000000001, longAxis: 6.788225099390858, azimuth: -0.5337081916392615, elev: 25.15457573132144, renderElev: 45, pos0: [80, 60, -50], pos1: [-24.1558, 0, 11.5466], pos2: [-24.1409, 0, 15.4802] },
    { satId: 'sat-oblique', cellId: 1, ws: 1.25, radius: 7.5, shortAxis: 7.5, longAxis: 10.606601717798213, azimuth: -0.5337081916392615, elev: 25.15457573132144, renderElev: 45, pos0: [80, 60, -50], pos1: [-20.8685, 0, 9.6041], pos2: [-20.8451, 0, 15.7503] },
    { satId: 'sat-oblique', cellId: 2, ws: 1, radius: 3.5, shortAxis: 3.5, longAxis: 4.949747468305833, azimuth: -0.5585993153435624, elev: 32.45630846185897, renderElev: 45, pos0: [80, 60, -50], pos1: [4.1974, 0, -2.6234], pos2: [4.2797, 0, 0.2437] },
    { satId: 'sat-oblique', cellId: 2, ws: 0.8, radius: 2.8000000000000003, shortAxis: 2.8000000000000003, longAxis: 3.9597979746446668, azimuth: -0.5585993153435624, elev: 32.45630846185897, renderElev: 45, pos0: [80, 60, -50], pos1: [3.3579, 0, -2.0987], pos2: [3.4237, 0, 0.195] },
    { satId: 'sat-oblique', cellId: 2, ws: 1.25, radius: 4.375, shortAxis: 4.375, longAxis: 6.187184335382291, azimuth: -0.5585993153435624, elev: 32.45630846185897, renderElev: 45, pos0: [80, 60, -50], pos1: [5.2467, 0, -3.2792], pos2: [5.3496, 0, 0.3046] },
  ];

  const placements = new Map<number, { x: number; z: number; r: number }>([
    [0, { x: 10, z: -20, r: 4 }],
    [1, { x: -30, z: 15, r: 6 }],
    [2, { x: 0, z: 0, r: 3.5 }],
  ]);

  const satellites = new Map<string, { x: number; y: number; z: number }>([
    ['sat-high', { x: 0, y: 100, z: 0 }],
    ['sat-oblique', { x: 80, y: 60, z: -50 }],
  ]);

  for (const row of PHOTOGRAPH_ROWS) {
    const pl = placements.get(row.cellId)!;
    const sat = satellites.get(row.satId)!;
    const baseCenter = new THREE.Vector3(pl.x, 0, pl.z);
    const apex = new THREE.Vector3(sat.x, sat.y, sat.z);
    const ellipse = computeSinrLiveBeamFootprintEllipse({
      apex,
      baseCenter,
      radiusWorld: row.radius,
    });

    assert.equal(ellipse.shortAxisWorld, row.shortAxis, `shortAxis for ${row.satId} cell ${row.cellId} ws ${row.ws}`);
    assert.ok(Math.abs(ellipse.longAxisWorld - row.longAxis) < 1e-12, `longAxis for ${row.satId} cell ${row.cellId}`);
    assert.ok(Math.abs(ellipse.longAxisAzimuthRad - row.azimuth) < 1e-12, `azimuth for ${row.satId} cell ${row.cellId}`);
    assert.ok(Math.abs(ellipse.elevationDeg - row.elev) < 1e-12, `elevation for ${row.satId} cell ${row.cellId}`);
    assert.equal(ellipse.renderElevationDeg, row.renderElev, `renderElevation for ${row.satId} cell ${row.cellId}`);

    const pos = buildObliqueBeamConePositions(apex, baseCenter, row.radius, 8, 1);
    assert.equal(pos.length, 72, 'mesh position buffer length for 8 segments');
    assert.deepEqual([pos[0], pos[1], pos[2]], row.pos0, 'apex coordinate');
    assert.deepEqual(
      [Number(pos[3].toFixed(4)), Number(pos[4].toFixed(4)), Number(pos[5].toFixed(4))],
      row.pos1,
      'triangle first ground vertex',
    );
    assert.deepEqual(
      [Number(pos[6].toFixed(4)), Number(pos[7].toFixed(4)), Number(pos[8].toFixed(4))],
      row.pos2,
      'triangle second ground vertex',
    );
  }
});

test('resolveServingConeGeometry outputs match baseline serving cone items', () => {
  const placements = new Map<number, SinrLiveCellPlacement>([
    [0, { cellId: 0, worldX: 10, worldZ: -20, radiusWorld: 4 }],
    [1, { cellId: 1, worldX: -30, worldZ: 15, radiusWorld: 6 }],
  ]);

  const satellites = new Map<string, WorldPoint>([
    ['sat-serving', { x: 0, y: 100, z: 0 }],
    ['sat-candidate', { x: 80, y: 60, z: -50 }],
  ]);

  const frame: SinrLiveCellFrame = {
    simTimeSec: 10,
    cells: [],
    ues: [],
    illuminatedBeams: [
      { satId: 'sat-serving', cellId: 0, serving: true, beamId: 1, frequencyIndex: 0 },
      { satId: 'sat-serving', cellId: 1, serving: true, beamId: 2, frequencyIndex: 1 },
      { satId: 'sat-candidate', cellId: 1, serving: false, beamId: 5, frequencyIndex: 1 },
    ],
    servedCellCount: 2,
    servedUeCount: 0,
    servingSatCount: 1,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: [],
  };

  const normalItems = resolveServingConeGeometry({
    cellFrame: frame,
    placementByCellId: placements,
    satelliteWorldById: satellites,
    focusSatIds: null,
    frequencyReuse: 3,
    servingBeamBudget: 19,
    allowHeroFallback: false,
    budgetServingFan: false,
    displayHeroRecord: null,
  });

  assert.equal(normalItems.length, 2);
  assert.equal(normalItems[0].cellId, 0);
  assert.equal(normalItems[0].satId, 'sat-serving');
  assert.equal(normalItems[0].beamId, 1);
  assert.equal(normalItems[0].baseRadiusWorld, 4);
  assert.deepEqual([normalItems[0].apex.x, normalItems[0].apex.y, normalItems[0].apex.z], [0, 100, 0]);
  assert.deepEqual([normalItems[0].baseCenter.x, normalItems[0].baseCenter.y, normalItems[0].baseCenter.z], [10, 0, -20]);

  assert.equal(normalItems[1].cellId, 1);
  assert.equal(normalItems[1].satId, 'sat-serving');
  assert.equal(normalItems[1].beamId, 2);
  assert.equal(normalItems[1].baseRadiusWorld, 6);
  assert.deepEqual([normalItems[1].apex.x, normalItems[1].apex.y, normalItems[1].apex.z], [0, 100, 0]);
  assert.deepEqual([normalItems[1].baseCenter.x, normalItems[1].baseCenter.y, normalItems[1].baseCenter.z], [-30, 0, 15]);

  const fallbackItems = resolveServingConeGeometry({
    cellFrame: { ...frame, illuminatedBeams: [] },
    placementByCellId: placements,
    satelliteWorldById: satellites,
    focusSatIds: null,
    frequencyReuse: 3,
    servingBeamBudget: 19,
    allowHeroFallback: true,
    budgetServingFan: false,
    displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
  });

  assert.equal(fallbackItems.length, 1);
  assert.equal(fallbackItems[0].cellId, 0);
  assert.equal(fallbackItems[0].satId, 'sat-serving');
  assert.equal(fallbackItems[0].beamId, 1);
  assert.equal(fallbackItems[0].baseRadiusWorld, 4);
  assert.deepEqual([fallbackItems[0].apex.x, fallbackItems[0].apex.y, fallbackItems[0].apex.z], [0, 100, 0]);
  assert.deepEqual([fallbackItems[0].baseCenter.x, fallbackItems[0].baseCenter.y, fallbackItems[0].baseCenter.z], [10, 0, -20]);
});
