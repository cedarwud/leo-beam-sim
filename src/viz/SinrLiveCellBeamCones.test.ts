#!/usr/bin/env node
/**
 * Render-resolver gate for the SINR-live earth-fixed cell-truth beam cones
 * (S-cells-3 / 3b / 4b-fix). Authority `docs/sinr-live-earth-fixed-cells-mini-sdd.md`
 * §5.5 + decisions A1/B3.
 *
 * Locks the PURE resolver + geometry contract — not the cell physics (that is
 * `validate:phase-c:sinr-live-cells:model`). Milestone invariants (S-cells-4b-fix):
 *   1. one cone per SERVING beam (the serving sat → its served cell); an
 *      illuminating-only beam (serving === false) draws NO cone;
 *   2. EVERY serving satellite draws its serving beams — a serving sat is never
 *      left beamless (the regression: a "most-illuminating" fallback narrowed to
 *      one wrong sat);
 *   3. `focusSatIds`, when non-empty, narrows to those sats (cinema handover pair);
 *      omitted/empty → all serving sats draw;
 *   4. cone base = the FIXED cell centre on the GROUND (y = 0), apex = serving sat;
 *   5. colour = FREQUENCY-REUSE colour (one satellite fan is multi-colour, the
 *      multibeam frequency pattern — not a single per-sat tint);
 *   6. a serving sat not rendered / a cell with no placement is skipped;
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

function base(opts: { cellFrame: SinrLiveCellFrame | undefined; focusSatIds?: ReadonlySet<string> | null }) {
  return { placementByCellId, satelliteWorldById, ...opts };
}

console.log('SinrLiveCellBeamCones resolver checks:');

check('undefined cell frame → no cones (off-lane no-op)', () => {
  assertEqual(resolveSinrLiveCellBeamConeItems(base({ cellFrame: undefined })).length, 0, 'no cones without a cell frame');
});

check('empty illuminated beams → no cones', () => {
  assertEqual(resolveSinrLiveCellBeamConeItems(base({ cellFrame: frameOf([]) })).length, 0, 'nothing lit → no cones');
});

check('EVERY serving satellite draws its serving beams (no serving sat left beamless)', () => {
  const items = resolveSinrLiveCellBeamConeItems(base({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-B', 2, true)]),
  }));
  assertEqual(items.length, 2, 'both serving sats draw their serving beam');
  assert(items.some(i => i.satId === 'sat-A') && items.some(i => i.satId === 'sat-B'), 'both serving sats present');
});

check('illuminating-only beam (serving === false) draws NO cone', () => {
  const items = resolveSinrLiveCellBeamConeItems(base({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 2, false), beam('sat-B', 2, false)]),
  }));
  assertEqual(items.length, 1, 'only the serving beam draws');
  assertEqual(items[0].cellId, 0, 'the serving cell-0 beam');
  assert(items.every(i => i.serving), 'all rendered items are serving');
});

check('focusSatIds narrows to those sats (cinema); omitted → all serving sats', () => {
  const frame = frameOf([beam('sat-A', 0, true), beam('sat-B', 2, true)]);
  const all = resolveSinrLiveCellBeamConeItems(base({ cellFrame: frame }));
  assertEqual(all.length, 2, 'omitted focus → all serving sats');
  const narrowed = resolveSinrLiveCellBeamConeItems(base({ cellFrame: frame, focusSatIds: new Set(['sat-B']) }));
  assertEqual(narrowed.length, 1, 'narrowed to the focus sat');
  assertEqual(narrowed[0].satId, 'sat-B', 'kept the focus sat');
  const empty = resolveSinrLiveCellBeamConeItems(base({ cellFrame: frame, focusSatIds: new Set<string>() }));
  assertEqual(empty.length, 2, 'empty focus set is treated as no narrowing (all serving)');
});

check('cone base = FIXED cell centre on the GROUND (NOT the UE/origin), apex = serving sat', () => {
  const items = resolveSinrLiveCellBeamConeItems(base({ cellFrame: frameOf([beam('sat-A', 0, true)]) }));
  assertEqual(items.length, 1, 'one cone');
  const c = items[0];
  approx(c.baseCenter.x, 30, 1e-9, 'base at cell-0 worldX');
  approx(c.baseCenter.z, -40, 1e-9, 'base at cell-0 worldZ');
  approx(c.baseCenter.y, 0, 1e-9, 'base on the ground plane (y=0)');
  assert(Math.hypot(c.baseCenter.x, c.baseCenter.z) > 1, 'cone base is off the origin (UE off-centre)');
  approx(c.apex.x, 0, 1e-9, 'apex at sat-A worldX');
  approx(c.apex.y, 900, 1e-9, 'apex at sat-A altitude');
});

check('colour = FREQUENCY-REUSE colour (multibeam pattern; one sat fan shows multiple hues)', () => {
  // One satellite serving cells 0 (freq 0) and 2 (freq 2) → its fan is multi-colour
  // (the multibeam frequency-reuse pattern), NOT a single per-sat tint.
  const items = resolveSinrLiveCellBeamConeItems(base({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 2, true)]),
  }));
  const c0 = items.find(i => i.cellId === 0)!;
  const c2 = items.find(i => i.cellId === 2)!;
  assertEqual(c0.color, frequencyReuseColor(0), 'cell 0 uses freq-0 colour');
  assertEqual(c2.color, frequencyReuseColor(2), 'cell 2 uses freq-2 colour');
  assert(c0.color !== c2.color, 'one satellite fan is multi-colour (not mono per sat)');
});

check('serving sat not rendered (absent world position) is skipped', () => {
  const items = resolveSinrLiveCellBeamConeItems(base({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-MISSING', 2, true)]),
  }));
  assertEqual(items.length, 1, 'only the rendered-sat serving beam draws');
  assertEqual(items[0].satId, 'sat-A', 'kept the rendered sat');
});

check('serving beam with no cell placement is skipped', () => {
  const items = resolveSinrLiveCellBeamConeItems(base({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 99, true)]),
  }));
  assertEqual(items.length, 1, 'cell 99 has no placement → skipped');
});

check('render-count + serving-sat-count helpers agree with the items', () => {
  const input = base({ cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 1, true), beam('sat-B', 2, true)]) });
  assertEqual(resolveSinrLiveCellBeamConeRenderCount(input), 3, 'render count = 3 serving cones');
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
    approx(pos[o], apex.x, 1e-6, `tri ${i} apex x`);
    approx(pos[o + 1], apex.y, 1e-6, `tri ${i} apex y`);
    approx(pos[o + 2], apex.z, 1e-6, `tri ${i} apex z`);
    approx(pos[o + 4], 0, 1e-9, `tri ${i} ring v1 on ground (y=0)`);
    approx(pos[o + 7], 0, 1e-9, `tri ${i} ring v2 on ground (y=0)`);
    const r1 = Math.hypot(pos[o + 3] - baseCenter.x, pos[o + 5] - baseCenter.z);
    approx(r1, radius, 1e-3, `tri ${i} ring v1 at footprint radius`);
  }
});

console.log(`\nSinrLiveCellBeamCones resolver: ${passed} checks passed.`);
