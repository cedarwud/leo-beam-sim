#!/usr/bin/env node
/**
 * Render-resolver gate for the SINR-live earth-fixed cell-truth beam cones
 * (S-cells-3 / 3b / 4b). Authority `docs/sinr-live-earth-fixed-cells-mini-sdd.md`
 * §5.5 + decisions A1/B3 + S-cells-4b (focus-subset + illuminated beams).
 *
 * Locks the PURE resolver + geometry contract — not the cell physics (that is
 * `validate:phase-c:sinr-live-cells:model`) and not the runtime wiring (that is
 * `:runtime`). Milestone invariants:
 *   1. cones come from ILLUMINATED beams (where the focus sat points), not only
 *      served cells; a serving beam carries `serving: true` (brighter render);
 *   2. FOCUS-SUBSET: only the focus satellite(s)' beams draw — the service breadth
 *      is the UE mosaic's job, not a cone per served cell (Rule#6 display filter);
 *   3. FALLBACK: a null/empty/absent focus → the single most-illuminating sat, so
 *      the lane always shows a bounded beam fan;
 *   4. cone base centre sits at the FIXED cell centre on the GROUND (y = 0), NOT
 *      on the UE; apex = the illuminating satellite's world position;
 *   5. a beam whose sat is not rendered / whose cell has no placement is skipped;
 *   6. colour = FREQUENCY-REUSE colour (cellId mod reuse), not serving-sat tint;
 *   7. the OBLIQUE geometry: the base ring lies FLAT on the ground plane.
 *
 * Run: `npm run validate:phase-c:sinr-live-cells:render`.
 */
import * as THREE from 'three';
import {
  buildObliqueBeamConePositions,
  resolveSinrLiveCellBeamConeItems,
  resolveSinrLiveCellBeamConeRenderCount,
  resolveSinrLiveCellBeamConeSatelliteCount,
  resolveSinrLiveConeFocusSatIds,
  type SinrLiveCellPlacement,
} from './SinrLiveCellBeamCones';
import { frequencyReuseColor } from '../constants/beamRoleTokens';
import type { IlluminatedCellBeam, SinrLiveCellFrame } from '../scene/sinrLiveCellModel';

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

function beam(satId: string, cellId: number, serving: boolean, frequencyIndex = cellId % 3): IlluminatedCellBeam {
  return { satId, cellId, frequencyIndex, serving };
}

function frameOf(beams: IlluminatedCellBeam[]): SinrLiveCellFrame {
  const servingCells = beams.filter(b => b.serving);
  return {
    simTimeSec: 450,
    cells: [],
    ues: [],
    illuminatedBeams: beams,
    servedCellCount: new Set(servingCells.map(b => b.cellId)).size,
    servedUeCount: 0,
    servingSatCount: new Set(servingCells.map(b => b.satId)).size,
    intraHandoverCount: 0,
    interHandoverCount: 0,
  };
}

// Fixed cells on the ground plane, well separated; placements at FIXED centres,
// none at the world origin (where the static primary UE sits).
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

check('empty illuminated beams → no cones', () => {
  const items = resolveSinrLiveCellBeamConeItems({ cellFrame: frameOf([]), placementByCellId, satelliteWorldById });
  assertEqual(items.length, 0, 'no cones when nothing is lit this slot');
});

check('one cone per ILLUMINATED beam of the (single) focus sat; unlit cells draw none', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 2, true)]),
    placementByCellId,
    satelliteWorldById,
  });
  assertEqual(items.length, 2, 'two lit beams of the only sat → two cones');
  assert(items.every(i => i.cellId !== 1), 'unlit cell 1 produces no cone');
});

check('FOCUS-SUBSET: focusSatIds keeps only that satellite\'s beams', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-B', 2, true)]),
    placementByCellId,
    satelliteWorldById,
    focusSatIds: new Set(['sat-A']),
  });
  assertEqual(items.length, 1, 'only the focus sat draws (breadth is the mosaic\'s job)');
  assertEqual(items[0].satId, 'sat-A', 'kept the focus sat');
});

check('FALLBACK: null focus → the single most-illuminating sat', () => {
  // sat-A lights 2 cells, sat-B lights 1 → fallback picks sat-A.
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 2, false), beam('sat-B', 2, true)]),
    placementByCellId,
    satelliteWorldById,
    focusSatIds: null,
  });
  assertEqual(items.length, 2, 'fallback shows the most-illuminating sat\'s beams');
  assert(items.every(i => i.satId === 'sat-A'), 'fallback sat = sat-A (lights the most cells)');
});

check('FALLBACK: focus naming a sat that illuminates nothing → most-illuminating sat', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true)]),
    placementByCellId,
    satelliteWorldById,
    focusSatIds: new Set(['sat-B']), // sat-B lights nothing this slot
  });
  assertEqual(items.length, 1, 'falls back when the focus sat is dark');
  assertEqual(items[0].satId, 'sat-A', 'fell back to the lit sat');
});

check('serving flag preserved: illuminating-only beams carry serving=false', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 2, false)]),
    placementByCellId,
    satelliteWorldById,
    focusSatIds: new Set(['sat-A']),
  });
  const c0 = items.find(i => i.cellId === 0)!;
  const c2 = items.find(i => i.cellId === 2)!;
  assertEqual(c0.serving, true, 'cell 0 beam is serving');
  assertEqual(c2.serving, false, 'cell 2 beam illuminates only (not serving)');
});

check('cone base = FIXED cell centre on the GROUND (NOT the UE/origin), apex = illuminating sat', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true)]),
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
  // One sat lights cell 0 (freq 0) and cell 2 (freq 2) → distinct reuse colours.
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 2, true)]),
    placementByCellId,
    satelliteWorldById,
  });
  const c0 = items.find(i => i.cellId === 0)!;
  const c2 = items.find(i => i.cellId === 2)!;
  assertEqual(c0.color, frequencyReuseColor(0), 'cell 0 uses freq-0 colour');
  assertEqual(c2.color, frequencyReuseColor(2), 'cell 2 uses freq-2 colour');
  assert(c0.color !== c2.color, 'distinct frequencies → distinct colours (not mono, single serving sat)');
});

check('beam with an unrendered sat is skipped (display-cap honest)', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-MISSING', 2, true)]),
    placementByCellId,
    satelliteWorldById,
    focusSatIds: new Set(['sat-A', 'sat-MISSING']),
  });
  assertEqual(items.length, 1, 'only the rendered-sat beam draws a cone');
  assertEqual(items[0].satId, 'sat-A', 'kept the rendered sat');
});

check('beam with no cell placement is skipped', () => {
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 99, true)]),
    placementByCellId,
    satelliteWorldById,
  });
  assertEqual(items.length, 1, 'cell 99 has no placement → skipped');
});

check('resolveSinrLiveConeFocusSatIds: explicit focus respected, else top illuminator', () => {
  const beams = [beam('sat-A', 0, true), beam('sat-A', 2, false), beam('sat-B', 2, true)];
  assertEqual([...resolveSinrLiveConeFocusSatIds(beams, new Set(['sat-B']))].join(','), 'sat-B', 'explicit focus honoured');
  assertEqual([...resolveSinrLiveConeFocusSatIds(beams, null)].join(','), 'sat-A', 'fallback = most-illuminating sat');
  assertEqual(resolveSinrLiveConeFocusSatIds([], null).size, 0, 'no beams → empty focus');
});

check('render-count + serving-sat-count helpers agree with the items', () => {
  const input = {
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 2, true)]),
    placementByCellId,
    satelliteWorldById,
  };
  assertEqual(resolveSinrLiveCellBeamConeRenderCount(input), 2, 'render count = 2 cones');
  assertEqual(resolveSinrLiveCellBeamConeSatelliteCount(input), 1, 'one focused serving sat');
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
