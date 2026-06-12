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
  resolveSinrLiveCellHandoverPairConeItems,
  resolveTopServingFocusSatIds,
  type SinrLiveCellPlacement,
} from './SinrLiveCellBeamCones';
import { frequencyReuseColor } from '../constants/beamRoleTokens';
import {
  SINR_LIVE_CONE_AMBIENT_OPACITY,
  SINR_LIVE_CONE_BLENDING,
  SINR_LIVE_CONE_PAIR_OPACITY,
  SINR_LIVE_CONE_SEGMENTS,
} from '../constants/sinrLiveConeStyle';
import { buildSinrLiveCellLayout } from '../scene/sinrLiveCellRuntime';
import { loadProfile } from '../profiles/index';
import type { CellServingRecord, IlluminatedCellBeam, SinrLiveCellFrame } from '../scene/sinrLiveCellModel';
import type { RuntimeCandidateHighlightCommand } from '../scene/types';

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

function cellRec(cellId: number, servingSatId: string | null): CellServingRecord {
  return {
    cellId,
    servingSatId,
    beamIdentity: servingSatId === null ? null : `${servingSatId}#cell${cellId}`,
    frequencyIndex: cellId % 3,
    servingSinrDb: servingSatId === null ? null : 10,
    candidateCount: servingSatId === null ? 0 : 1,
  };
}

function frameWithCells(cells: CellServingRecord[]): SinrLiveCellFrame {
  const served = cells.filter(c => c.servingSatId !== null);
  return {
    simTimeSec: 450,
    cells,
    ues: [],
    illuminatedBeams: [],
    servedCellCount: served.length,
    servedUeCount: 0,
    servingSatCount: new Set(served.map(c => c.servingSatId)).size,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    recentHandoverEvents: [],
  };
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
    recentHandoverEvents: [],
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

check('S5-2 focus cap retired: focusSatIds null draws EVERY serving sat (no narrowing) — the ~759/760 gap fix', () => {
  // D-STYLE A (s5 plan §4): the focus cap is gone — MainScene passes focusSatIds:
  // null so the cone render beams every serving sat (the connected-sat-has-beam
  // must-hold). Six serving sats on six distinct cells must yield six cones.
  const sixPlacements = new Map<number, SinrLiveCellPlacement>(
    [0, 1, 2, 3, 4, 5].map(id => [id, {
      cellId: id, worldX: 20 * (id + 1), worldZ: -15 * (id + 1), radiusWorld: 10,
    }]),
  );
  const sixSats = new Map(
    ['s0', 's1', 's2', 's3', 's4', 's5'].map((id, i) => [id, { x: 30 * i, y: 900, z: -30 * i }]),
  );
  const frame = frameOf([0, 1, 2, 3, 4, 5].map(i => beam(`s${i}`, i, true)));
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frame, placementByCellId: sixPlacements, satelliteWorldById: sixSats, focusSatIds: null,
  });
  assertEqual(items.length, 6, 'focusSatIds null renders all 6 serving sats (no focus narrowing)');
  assertEqual(new Set(items.map(i => i.satId)).size, 6, 'all 6 distinct serving sats coned');
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

check('resolveTopServingFocusSatIds: top-K serving sats by served-cell count + preferred force-include', () => {
  const frame = frameWithCells([
    cellRec(0, 'sat-A'), cellRec(1, 'sat-A'), cellRec(2, 'sat-A'), // A serves 3
    cellRec(3, 'sat-B'), cellRec(4, 'sat-B'),                       // B serves 2
    cellRec(5, 'sat-C'),                                            // C serves 1
    cellRec(6, null),                                              // idle
  ]);
  assertEqual([...resolveTopServingFocusSatIds(frame, 2, null)].sort().join(','), 'sat-A,sat-B', 'top-2 serving sats by served count');
  const withPref = resolveTopServingFocusSatIds(frame, 2, 'sat-C');
  assert(withPref.size === 2 && withPref.has('sat-C') && withPref.has('sat-A'), 'preferred (C) force-included + filled with top server (A), capped to 2');
  assertEqual(resolveTopServingFocusSatIds(undefined, 2, null).size, 0, 'no frame → empty focus');
  assertEqual(resolveTopServingFocusSatIds(frame, 0, null).size, 0, 'maxSats 0 → empty focus');
  assertEqual(resolveTopServingFocusSatIds(frameWithCells([cellRec(0, null)]), 2, null).size, 0, 'no served cells → empty focus');
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

// ── S5-2 replacements for the retired QUAR-S5-BEAMRENDER cone text pins ──

check('S5-2 cone base == the TRUTH cell centre from buildSinrLiveCellLayout (no placement drift; replaces the MainScene buildSinrLiveCellLayout pin)', () => {
  // The retired pin asserted MainScene builds placements from the SAME layout the
  // truth uses. Behaviour: drive the resolver with placements built EXACTLY as
  // MainScene does from buildSinrLiveCellLayout(profile) and assert the cone base
  // lands on the truth cell centre (east → +X, north → −Z, ground y=0).
  const profile = loadProfile('hobs-2024-candidate-rich');
  const layout = buildSinrLiveCellLayout(profile);
  assert(layout.centers.length > 0, 'candidate-rich layout has cells');
  const worldUnitsPerKm = 2; // arbitrary positive scale; the invariant is base == centre * scale
  const truthPlacements = new Map<number, SinrLiveCellPlacement>(
    layout.centers.map(centre => [centre.cellId, {
      cellId: centre.cellId,
      worldX: centre.localXKm * worldUnitsPerKm,
      worldZ: -centre.localYKm * worldUnitsPerKm,
      radiusWorld: layout.cellRadiusKm * worldUnitsPerKm,
    }]),
  );
  const centre = layout.centers[Math.min(5, layout.centers.length - 1)];
  const items = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', centre.cellId, true)]),
    placementByCellId: truthPlacements,
    satelliteWorldById,
    focusSatIds: null,
  });
  assertEqual(items.length, 1, 'one cone for the truth cell');
  approx(items[0].baseCenter.x, centre.localXKm * worldUnitsPerKm, 1e-9, 'cone base east == truth cell centre');
  approx(items[0].baseCenter.z, -centre.localYKm * worldUnitsPerKm, 1e-9, 'cone base north == truth cell centre');
  approx(items[0].baseCenter.y, 0, 1e-9, 'cone base on the ground plane');
});

check('S5-2 style tokens (hybrid): ambient 0.08 < pair 0.30, 32 segments, NormalBlending (replaces the cone style/opacity/blending pins)', () => {
  assertEqual(SINR_LIVE_CONE_AMBIENT_OPACITY, 0.08, 'ambient cone opacity is the screenshot-locked 0.08');
  assertEqual(SINR_LIVE_CONE_PAIR_OPACITY, 0.3, 'bright focused-handover-pair cone opacity is 0.30');
  assert(SINR_LIVE_CONE_PAIR_OPACITY > SINR_LIVE_CONE_AMBIENT_OPACITY, 'HYBRID: the focused pair is brighter than the ambient field');
  assertEqual(SINR_LIVE_CONE_SEGMENTS, 32, 'oblique cone ring segment count');
  assertEqual(SINR_LIVE_CONE_BLENDING, THREE.NormalBlending, 'cones use NormalBlending (bounded translucency, no additive washout)');
  const posExplicit = buildObliqueBeamConePositions(new THREE.Vector3(0, 9, 0), new THREE.Vector3(1, 0, 1), 10, 5);
  assertEqual(posExplicit.length, 5 * 9, 'explicit segments honoured');
  const posDefault = buildObliqueBeamConePositions(new THREE.Vector3(0, 9, 0), new THREE.Vector3(1, 0, 1), 10);
  assertEqual(posDefault.length, SINR_LIVE_CONE_SEGMENTS * 9, 'default segment count == the style token');
});

check('S5-2 D4 pair resolver: inert unless the focused event is cell truth; draws the old/new pair (replaces the sourceOwner-guard pin)', () => {
  const candidateOf = (sourceOwner: 'live-walker' | 'sinr-live-cell-truth'): RuntimeCandidateHighlightCommand => ({
    sourceOwner,
    kind: 'inter',
    fromSatId: 'sat-A',
    fromBeamId: null,
    fromCellId: 0,
    fromFrequencyIndex: 0,
    toSatId: 'sat-B',
    toBeamId: null,
    toCellId: 2,
    toFrequencyIndex: 2,
  } as RuntimeCandidateHighlightCommand);
  const inert = resolveSinrLiveCellHandoverPairConeItems({
    candidate: candidateOf('live-walker'),
    placementByCellId,
    satelliteWorldById,
  });
  assertEqual(inert.length, 0, 'pair resolver is inert unless the event source is cell truth');
  const pair = resolveSinrLiveCellHandoverPairConeItems({
    candidate: candidateOf('sinr-live-cell-truth'),
    placementByCellId,
    satelliteWorldById,
  });
  assertEqual(pair.length, 2, 'cell-truth event draws the old + new cell-truth cones');
  assert(pair.some(c => c.satId === 'sat-A') && pair.some(c => c.satId === 'sat-B'), 'both old and new sats present');
});

console.log(`\nSinrLiveCellBeamCones resolver: ${passed} checks passed.`);
