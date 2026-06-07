#!/usr/bin/env node
/**
 * Render-resolver gate for the SINR-live earth-fixed cell-truth beam cones
 * (S-cells-3 / 3b). Authority `docs/sinr-live-earth-fixed-cells-mini-sdd.md`
 * §5.5 + decisions A1/B3.
 *
 * Locks the PURE resolver + geometry contract — not the cell physics (that is
 * `validate:phase-c:sinr-live-cells:model`) and not the runtime wiring (that is
 * `:runtime`). Milestone invariants:
 *   1. one cone per SERVED cell; idle cells (servingSatId === null) draw none;
 *   2. cone base centre sits at the FIXED cell centre on the GROUND (y = 0), NOT
 *      on the UE — this is the whole "UE off-centre" point;
 *   3. cone apex = the serving satellite's world position;
 *   4. a served cell whose serving sat is not rendered (absent from the world
 *      map) or whose placement is missing is skipped (honest under display caps);
 *   5. colour = FREQUENCY-REUSE colour (cellId mod reuse), not serving-sat tint;
 *   6. the OBLIQUE geometry: the base ring lies FLAT on the ground plane (all base
 *      verts at y = 0) and every triangle apex is the satellite (the cone is not a
 *      tilted cross-section disc).
 *
 * Run: `npm run validate:phase-c:sinr-live-cells:render`.
 */
import * as THREE from 'three';
import {
  buildObliqueBeamConePositions,
  resolveSinrLiveCellBeamConeItems,
  resolveSinrLiveCellBeamConeRenderCount,
  resolveSinrLiveCellBeamConeSatelliteCount,
  type SinrLiveCellPlacement,
} from './SinrLiveCellBeamCones';
import { frequencyReuseColor } from '../constants/beamRoleTokens';
import type { CellServingRecord, SinrLiveCellFrame } from '../scene/sinrLiveCellModel';

let passed = 0;
function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(`FAIL: ${label}`);
}
function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
function approx(a: number, b: number, eps: number, label: string): void {
  if (Math.abs(a - b) > eps) throw new Error(`${label}: expected ~${b}, got ${a}`);
}
function check(label: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${label}`);
}

function cell(cellId: number, servingSatId: string | null, frequencyIndex = cellId % 3): CellServingRecord {
  return {
    cellId,
    servingSatId,
    beamIdentity: servingSatId === null ? null : `${servingSatId}#cell${cellId}`,
    frequencyIndex,
    servingSinrDb: servingSatId === null ? null : 12,
    candidateCount: servingSatId === null ? 0 : 1,
  };
}

function frameOf(cells: CellServingRecord[]): SinrLiveCellFrame {
  return {
    simTimeSec: 450,
    cells,
    ues: [],
    servedCellCount: cells.filter(c => c.servingSatId !== null).length,
    servedUeCount: 0,
    servingSatCount: new Set(cells.filter(c => c.servingSatId !== null).map(c => c.servingSatId)).size,
    intraHandoverCount: 0,
    interHandoverCount: 0,
  };
}

// Three fixed cells on the ground plane, well separated. Cell 0 and 2 are served
// by two distinct sats; cell 1 is idle. Placements are at FIXED centres, none of
// them at the world origin (where the static primary UE sits).
const placementByCellId = new Map<number, SinrLiveCellPlacement>([
  [0, { cellId: 0, worldX: 30, worldZ: -40, radiusWorld: 12 }],
  [1, { cellId: 1, worldX: -50, worldZ: 20, radiusWorld: 12 }],
  [2, { cellId: 2, worldX: 60, worldZ: 70, radiusWorld: 12 }],
]);
const satelliteWorldById = new Map([
  ['sat-A', { x: 0, y: 900, z: 0 }],
  ['sat-B', { x: 100, y: 950, z: -100 }],
]);

console.log('SinrLiveCellBeamCones resolver checks:');

check('undefined cell frame → no cones (off-lane no-op)', () => {
  const items = resolveSinrLiveCellBeamConeItems({ cellFrame: undefined, placementByCellId, satelliteWorldById });
  assertEqual(items.length, 0, 'no cones without a cell frame');
});

check('one cone per served cell; idle cell draws none', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([cell(0, 'sat-A'), cell(1, null), cell(2, 'sat-B')]),
    placementByCellId,
    satelliteWorldById,
  });
  assertEqual(items.length, 2, 'two served cells → two cones (idle cell 1 skipped)');
  assert(items.every(i => i.cellId !== 1), 'idle cell 1 produces no cone');
});

check('cone base = FIXED cell centre on the GROUND (NOT the UE/origin), apex = serving sat', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([cell(0, 'sat-A')]),
    placementByCellId,
    satelliteWorldById,
  });
  assertEqual(items.length, 1, 'one cone');
  const c = items[0];
  approx(c.baseCenter.x, 30, 1e-9, 'base at cell-0 worldX');
  approx(c.baseCenter.z, -40, 1e-9, 'base at cell-0 worldZ');
  approx(c.baseCenter.y, 0, 1e-9, 'base on the ground plane (y=0)');
  assert(Math.hypot(c.baseCenter.x, c.baseCenter.z) > 1, 'cone base is off the origin (UE off-centre)');
  approx(c.apex.x, 0, 1e-9, 'apex at sat-A worldX');
  approx(c.apex.y, 900, 1e-9, 'apex at sat-A altitude');
});

check('colour = frequency-reuse colour (NOT serving-sat tint)', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([cell(0, 'sat-A'), cell(2, 'sat-B')]),
    placementByCellId,
    satelliteWorldById,
  });
  // cell 0 → freq 0, cell 2 → freq 2 → distinct reuse colours, served by 1 sat each.
  assertEqual(items[0].color, frequencyReuseColor(0), 'cell 0 uses freq-0 colour');
  assertEqual(items[1].color, frequencyReuseColor(2), 'cell 2 uses freq-2 colour');
  assert(items[0].color !== items[1].color, 'distinct frequencies → distinct colours (not mono)');
});

check('served cell with an unrendered serving sat is skipped (display-cap honest)', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([cell(0, 'sat-A'), cell(2, 'sat-MISSING')]),
    placementByCellId,
    satelliteWorldById,
  });
  assertEqual(items.length, 1, 'only the rendered-sat cell draws a cone');
  assertEqual(items[0].satId, 'sat-A', 'kept the rendered sat');
});

check('served cell with no placement is skipped', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([cell(0, 'sat-A'), cell(99, 'sat-B')]),
    placementByCellId,
    satelliteWorldById,
  });
  assertEqual(items.length, 1, 'cell 99 has no placement → skipped');
});

check('render-count + serving-sat-count helpers agree with the items', () => {
  const input = {
    cellFrame: frameOf([cell(0, 'sat-A'), cell(1, null), cell(2, 'sat-B')]),
    placementByCellId,
    satelliteWorldById,
  };
  assertEqual(resolveSinrLiveCellBeamConeRenderCount(input), 2, 'render count = 2 cones');
  assertEqual(resolveSinrLiveCellBeamConeSatelliteCount(input), 2, 'two distinct serving sats');
});

check('oblique geometry: base ring FLAT on the ground (y=0), every triangle apex = sat', () => {
  const apex = new THREE.Vector3(10, 900, -20);
  const baseCenter = new THREE.Vector3(40, 0, 60);
  const radius = 15;
  const segments = 8;
  const pos = buildObliqueBeamConePositions(apex, baseCenter, radius, segments);
  assertEqual(pos.length, segments * 9, '3 verts × segments triangles');
  for (let i = 0; i < segments; i += 1) {
    const o = i * 9;
    // vert 0 of each triangle = apex (the satellite)
    approx(pos[o], apex.x, 1e-6, `tri ${i} apex x`);
    approx(pos[o + 1], apex.y, 1e-6, `tri ${i} apex y`);
    approx(pos[o + 2], apex.z, 1e-6, `tri ${i} apex z`);
    // verts 1 & 2 = ground ring, FLAT at y=0, at `radius` from the cell centre
    approx(pos[o + 4], 0, 1e-9, `tri ${i} ring v1 on ground (y=0)`);
    approx(pos[o + 7], 0, 1e-9, `tri ${i} ring v2 on ground (y=0)`);
    const r1 = Math.hypot(pos[o + 3] - baseCenter.x, pos[o + 5] - baseCenter.z);
    approx(r1, radius, 1e-3, `tri ${i} ring v1 at footprint radius`); // Float32 storage precision
  }
});

console.log(`\nSinrLiveCellBeamCones resolver: ${passed} checks passed.`);
