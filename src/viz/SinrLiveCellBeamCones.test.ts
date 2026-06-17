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
 *   5. colour = SERVING-IDENTITY colour (`colorForServingBeam(satId, cellId)`, the
 *      SAME authority the UE mosaic uses) — a serving cone is the same colour as the
 *      UE dots it serves (SDD §3.2, kills Bug E); the freq-reuse palette is retired
 *      from the live render (the style fn is retained for a future colour mode);
 *   6. a serving sat not rendered / a cell with no placement is skipped;
 *   7. the OBLIQUE geometry: the base ring lies FLAT on the ground plane.
 *
 * Run: `npm run validate:phase-c:sinr-live-cells:render`.
 */
import * as THREE from 'three';
import {
  buildObliqueBeamConePositions,
  buildObliqueBeamConeVertexColors,
  resolveSinrLiveCellBeamConeItems,
  resolveSinrLiveNonServingConeItems,
  resolveSinrLiveCellBeamConeRenderCount,
  resolveSinrLiveCellBeamConeSatelliteCount,
  resolveSinrLiveCellHandoverPairConeItems,
  resolveSinrLiveHandoverPulseConeItems,
  resolveSinrLiveConeRenderColor,
  sinrLiveHandoverPulseOpacity,
  resolveTopServingFocusSatIds,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveCellPlacement,
} from './SinrLiveCellBeamCones';
import type { SinrLiveCellHandoverEvent } from '../scene/sinrLiveCellModel';
import { frequencyReuseColor } from '../constants/beamRoleTokens';
import { colorForServingBeam } from '../constants/servingColour';
import {
  SINR_LIVE_CONE_AMBIENT_OPACITY,
  SINR_LIVE_CONE_BASE_ALPHA_FACTOR,
  SINR_LIVE_CONE_BLENDING,
  SINR_LIVE_CONE_PAIR_OPACITY,
  SINR_LIVE_CONE_PULSE_PEAK_OPACITY,
  SINR_LIVE_CONE_NONSERVING_OPACITY,
  SINR_LIVE_CONE_SEGMENTS,
  SINR_LIVE_CONE_PULSE_INTRA_COLOR,
  SINR_LIVE_CONE_PULSE_INTER_COLOR,
  resolveSinrLiveConeColor,
  resolveSinrLiveConeLayerOpacity,
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

check('Tier-2 non-serving resolver: the COMPLEMENT — only non-serving beams, serving:false, separate from the serving-only resolver', () => {
  const frame = frameOf([beam('sat-A', 0, true), beam('sat-A', 2, false), beam('sat-B', 2, false)]);
  // The serving-only resolver is UNCHANGED: it still drops the non-serving beams
  // (the s0 connected-sat-has-beam + s4 serving-equivalence must-holds depend on this).
  const serving = resolveSinrLiveCellBeamConeItems(base({ cellFrame: frame }));
  assertEqual(serving.length, 1, 'serving resolver still serving-only (1 cone)');
  assert(serving.every(i => i.serving), 'serving resolver items all serving');
  // The new separate resolver emits ONLY the non-serving complement.
  const nonServing = resolveSinrLiveNonServingConeItems(base({ cellFrame: frame }));
  assertEqual(nonServing.length, 2, 'two non-serving illuminated beams draw dim cones');
  assert(nonServing.every(i => !i.serving), 'all non-serving items carry serving:false');
  assert(nonServing.some(i => i.satId === 'sat-A') && nonServing.some(i => i.satId === 'sat-B'), 'both non-serving sats present');
  // Colour is the serving-identity colour keyed on (satId, cellId) — one authority
  // for the whole field (SDD §3.2), not the retired freq-reuse palette.
  assertEqual(nonServing[0].color, colorForServingBeam(nonServing[0].satId, nonServing[0].cellId).markerColor, 'non-serving cone uses the serving-identity colour');
  // Disjoint from the serving set (the two never double-draw the same cone).
  const servingKeys = new Set(serving.map(i => `${i.cellId}-${i.satId}`));
  assert(nonServing.every(i => !servingKeys.has(`${i.cellId}-${i.satId}`)), 'non-serving cones are disjoint from serving cones');
});

check('Tier-2 non-serving resolver: off-lane / empty no-ops + focus narrowing', () => {
  assertEqual(resolveSinrLiveNonServingConeItems(base({ cellFrame: undefined })).length, 0, 'no frame → no non-serving cones');
  assertEqual(resolveSinrLiveNonServingConeItems(base({ cellFrame: frameOf([beam('sat-A', 0, true)]) })).length, 0, 'all-serving frame → no non-serving cones');
  const frame = frameOf([beam('sat-A', 1, false), beam('sat-B', 2, false)]);
  const narrowed = resolveSinrLiveNonServingConeItems(base({ cellFrame: frame, focusSatIds: new Set(['sat-B']) }));
  assertEqual(narrowed.length, 1, 'focus narrows non-serving cones too');
  assertEqual(narrowed[0].satId, 'sat-B', 'kept the focus sat');
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

check('colour = SERVING-IDENTITY colour (matches the UE mosaic for the same satId+cellId — Bug E kill)', () => {
  // The serving cone colours by colorForServingBeam(satId, cellId) — the SAME
  // authority buildSinrServingUeColorMapFromCells uses for the UE dots — so a cone
  // is the same colour as the UEs it serves. One sat over two cells = a shade family
  // (different cellId → different shade), NOT the retired freq-reuse palette.
  const items = resolveSinrLiveCellBeamConeItems(base({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-A', 2, true)]),
  }));
  const c0 = items.find(i => i.cellId === 0)!;
  const c2 = items.find(i => i.cellId === 2)!;
  assertEqual(c0.color, colorForServingBeam('sat-A', 0).markerColor, 'cell-0 cone == UE-mosaic colour for (sat-A, cell 0)');
  assertEqual(c2.color, colorForServingBeam('sat-A', 2).markerColor, 'cell-2 cone == UE-mosaic colour for (sat-A, cell 2)');
  assert(c0.color !== c2.color, 'same sat, different cell → a shade family (not mono)');
  assert(c0.color !== frequencyReuseColor(0), 'cone no longer uses the retired freq-reuse palette');
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

check('S5-2 style tokens (hybrid): ambient 0.14 < pair 0.30, 32 segments, NormalBlending (replaces the cone style/opacity/blending pins)', () => {
  assertEqual(SINR_LIVE_CONE_AMBIENT_OPACITY, 0.14, 'ambient cone opacity is the screenshot-locked 0.14 (A2 legibility lift from 0.08)');
  assertEqual(SINR_LIVE_CONE_PAIR_OPACITY, 0.3, 'bright focused-handover-pair cone opacity is 0.30');
  assert(SINR_LIVE_CONE_PAIR_OPACITY > SINR_LIVE_CONE_AMBIENT_OPACITY, 'HYBRID: the focused pair is brighter than the ambient field');
  assertEqual(SINR_LIVE_CONE_SEGMENTS, 32, 'oblique cone ring segment count');
  assertEqual(SINR_LIVE_CONE_BLENDING, THREE.NormalBlending, 'cones use NormalBlending (bounded translucency, no additive washout)');
  const posExplicit = buildObliqueBeamConePositions(new THREE.Vector3(0, 9, 0), new THREE.Vector3(1, 0, 1), 10, 5);
  assertEqual(posExplicit.length, 5 * 9, 'explicit segments honoured');
  const posDefault = buildObliqueBeamConePositions(new THREE.Vector3(0, 9, 0), new THREE.Vector3(1, 0, 1), 10);
  assertEqual(posDefault.length, SINR_LIVE_CONE_SEGMENTS * 9, 'default segment count == the style token');
});

check('Tier-2 SinrLiveConeStyle resolver: layer→opacity + colour map to the locked tokens (the ONE place; behaviour-identical)', () => {
  // resolveSinrLiveConeLayerOpacity is the single CHOICE point for each cone
  // layer's opacity (was: ambient default in the renderer, pair at the MainScene
  // mount, pulse a bare const). It must return the screenshot-locked values verbatim.
  assertEqual(resolveSinrLiveConeLayerOpacity('ambient'), SINR_LIVE_CONE_AMBIENT_OPACITY, 'resolver ambient == 0.14 token');
  assertEqual(resolveSinrLiveConeLayerOpacity('pair'), SINR_LIVE_CONE_PAIR_OPACITY, 'resolver pair == 0.30 token');
  assertEqual(resolveSinrLiveConeLayerOpacity('pulse'), SINR_LIVE_CONE_PULSE_PEAK_OPACITY, 'resolver pulse == 0.32 peak token');
  assertEqual(resolveSinrLiveConeLayerOpacity('nonServing'), SINR_LIVE_CONE_NONSERVING_OPACITY, 'resolver nonServing == 0.04 dim token');
  assert(
    resolveSinrLiveConeLayerOpacity('pair') > resolveSinrLiveConeLayerOpacity('ambient'),
    'HYBRID via resolver: focused pair brighter than ambient field',
  );
  assert(
    resolveSinrLiveConeLayerOpacity('nonServing') < resolveSinrLiveConeLayerOpacity('ambient'),
    'non-serving cones are dimmer than the ambient serving field (background context)',
  );
  // resolveSinrLiveConeColor is RETAINED for a future frequency-plan colour mode —
  // it is no longer the live cone colour (that is the serving-identity
  // colorForServingBeam, asserted above). It still maps an index → palette entry.
  for (const idx of [0, 1, 2, 5, 7]) {
    assertEqual(resolveSinrLiveConeColor(idx), frequencyReuseColor(idx), `resolver colour(${idx}) == frequency-reuse colour (behaviour-identical)`);
  }
});

check('G1-CONE-STYLE apex→base alpha fade: apex opaque (must-hold-safe), base faded (de-tangle), hue untouched (RGB white)', () => {
  assert(
    SINR_LIVE_CONE_BASE_ALPHA_FACTOR > 0 && SINR_LIVE_CONE_BASE_ALPHA_FACTOR < 1,
    'base alpha factor is a fade in (0,1) — base faded but never fully invisible',
  );
  const segments = 5;
  const colors = buildObliqueBeamConeVertexColors(segments, SINR_LIVE_CONE_BASE_ALPHA_FACTOR);
  // 4 components (RGBA) × 3 verts × segments, mirroring the [apex, baseA, baseB] position packing.
  assertEqual(colors.length, segments * 12, 'RGBA vertex-colour buffer matches the triangle-soup packing');
  for (let i = 0; i < segments; i += 1) {
    const o = i * 12;
    // RGB is white for every vertex → vertex colour does not tint the per-cone hue.
    for (const c of [o, o + 1, o + 2, o + 4, o + 5, o + 6, o + 8, o + 9, o + 10]) {
      assertEqual(colors[c], 1, 'vertex RGB is white (hue comes only from the material frequencyReuseColor)');
    }
    // Alpha: apex full, both ground-ring vertices faded to the factor.
    assertEqual(colors[o + 3], 1, 'apex vertex alpha is fully opaque (every serving sat still shows a beam)');
    approx(colors[o + 7], SINR_LIVE_CONE_BASE_ALPHA_FACTOR, 1e-6, 'base ring vertex A alpha is the faded factor');
    approx(colors[o + 11], SINR_LIVE_CONE_BASE_ALPHA_FACTOR, 1e-6, 'base ring vertex B alpha is the faded factor');
  }
  const defaultColors = buildObliqueBeamConeVertexColors();
  assertEqual(defaultColors.length, SINR_LIVE_CONE_SEGMENTS * 12, 'default segment count == the style token');
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

// ---------------------------------------------------------------------------
// G2c ambient live-handover PULSE resolver (decoupled from the director cinema).
// ---------------------------------------------------------------------------

const RET = 4;
function pulseEvent(opts: Partial<SinrLiveCellHandoverEvent> & { sourceTimeSec: number }): SinrLiveCellHandoverEvent {
  return {
    ueId: 'ue-0',
    kind: 'inter',
    fromSatId: 'sat-A',
    fromCellId: 0,
    toSatId: 'sat-B',
    toCellId: 2,
    ...opts,
  };
}

const PULSE_REUSE = 3;
function pulseInput(events: SinrLiveCellHandoverEvent[] | undefined, simTimeSec = 450) {
  return { recentHandoverEvents: events, simTimeSec, retentionSec: RET, placementByCellId, satelliteWorldById, frequencyReuse: PULSE_REUSE };
}

console.log('\nSinrLiveCellBeamCones live-pulse resolver checks:');

check('pulse fade curve: peak at age 0, 0 at/after the horizon, half at the midpoint, 0 on NaN', () => {
  approx(sinrLiveHandoverPulseOpacity(0, RET), SINR_LIVE_CONE_PULSE_PEAK_OPACITY, 1e-9, 'age 0 → peak opacity (0.32)');
  approx(sinrLiveHandoverPulseOpacity(RET / 2, RET), SINR_LIVE_CONE_PULSE_PEAK_OPACITY / 2, 1e-9, 'midpoint → half peak');
  assertEqual(sinrLiveHandoverPulseOpacity(RET, RET), 0, 'at the horizon → 0');
  assertEqual(sinrLiveHandoverPulseOpacity(RET + 0.1, RET), 0, 'past the horizon → 0');
  assertEqual(sinrLiveHandoverPulseOpacity(-0.1, RET), 0, 'negative age (future event) → 0');
  // Finite guard: a NaN age must clamp to 0, not fall through to a NaN opacity.
  assertEqual(sinrLiveHandoverPulseOpacity(NaN, RET), 0, 'NaN age → 0 (finite guard)');
  assertEqual(sinrLiveHandoverPulseOpacity(0, NaN), 0, 'NaN retention → 0 (finite guard)');
});

check('no recent handovers (undefined / empty) → no pulse cones (off-lane / cold no-op)', () => {
  assertEqual(resolveSinrLiveHandoverPulseConeItems(pulseInput(undefined)).length, 0, 'undefined events → no cones');
  assertEqual(resolveSinrLiveHandoverPulseConeItems(pulseInput([])).length, 0, 'empty events → no cones');
});

check('a fresh inter-HO draws the OLD + NEW cell cones, both at peak opacity', () => {
  const items = resolveSinrLiveHandoverPulseConeItems(pulseInput([pulseEvent({ sourceTimeSec: 450 })])); // age 0
  assertEqual(items.length, 2, 'old (sat-A/cell-0) + new (sat-B/cell-2) cones');
  assert(items.some(i => i.satId === 'sat-A' && i.cellId === 0), 'old cell cone present');
  assert(items.some(i => i.satId === 'sat-B' && i.cellId === 2), 'new cell cone present');
  for (const i of items) approx(i.opacity ?? -1, SINR_LIVE_CONE_PULSE_PEAK_OPACITY, 1e-9, 'fresh pulse cone at peak opacity');
});

check('a NaN simTimeSec yields NO pulse cones (no NaN-opacity cone slips through)', () => {
  const items = resolveSinrLiveHandoverPulseConeItems(pulseInput([pulseEvent({ sourceTimeSec: 450 })], NaN));
  assertEqual(items.length, 0, 'NaN sim-time → every pulse opacity 0 → skipped (no NaN material opacity)');
});

check('pulse cones fade by age: an older event is dimmer; a horizon-aged event draws nothing', () => {
  const fresh = resolveSinrLiveHandoverPulseConeItems(pulseInput([pulseEvent({ sourceTimeSec: 449 })])); // age 1
  const stale = resolveSinrLiveHandoverPulseConeItems(pulseInput([pulseEvent({ sourceTimeSec: 447 })])); // age 3
  assert((fresh[0].opacity ?? 0) > (stale[0].opacity ?? 0), 'younger pulse is brighter than older');
  const aged = resolveSinrLiveHandoverPulseConeItems(pulseInput([pulseEvent({ sourceTimeSec: 446 })])); // age 4 = horizon
  assertEqual(aged.length, 0, 'a pulse aged to the horizon draws nothing (opacity 0 → skipped)');
});

check('intra-HO (from cell present) draws both cells; an unplaced/unrendered side is skipped', () => {
  const intra = resolveSinrLiveHandoverPulseConeItems(pulseInput([
    pulseEvent({ kind: 'intra', fromSatId: 'sat-A', fromCellId: 0, toSatId: 'sat-A', toCellId: 1, sourceTimeSec: 450 }),
  ]));
  assertEqual(intra.length, 2, 'intra draws old cell-0 + new cell-1 (same sat)');
  // New cell has no placement (cell 99) → only the OLD cell draws.
  const partial = resolveSinrLiveHandoverPulseConeItems(pulseInput([pulseEvent({ toCellId: 99, sourceTimeSec: 450 })]));
  assertEqual(partial.length, 1, 'unplaced new cell skipped; old cell still pulses');
  assertEqual(partial[0].cellId, 0, 'the placed old cell-0 drew');
});

check('multiple concurrent events each pulse independently with DISTINCT stable keys (no array-index churn)', () => {
  const items = resolveSinrLiveHandoverPulseConeItems(pulseInput([
    pulseEvent({ ueId: 'ue-0', sourceTimeSec: 450 }), // age 0 → 2 cones
    pulseEvent({ ueId: 'ue-1', toCellId: 1, sourceTimeSec: 448 }), // age 2 → 2 cones, dimmer
  ]));
  assertEqual(items.length, 4, 'two live events → four cones');
  // Every pulse cone carries a per-event/side stable renderKey (never an array index),
  // and the four are distinct so React reconciles by identity, not position.
  assert(items.every(i => typeof i.renderKey === 'string' && i.renderKey.length > 0), 'every pulse cone carries a stable renderKey');
  assertEqual(new Set(items.map(i => i.renderKey)).size, 4, 'all four pulse cone keys are distinct');
});

check('pulse cone colour == the serving-identity colour (reads as the ambient cone for that satId+cellId flaring)', () => {
  // The pulse must read as the AMBIENT serving cone for the same (satId, cellId)
  // just brighter — so it shares the serving-identity colour, not a different hue.
  // The freq index is still recorded for telemetry but no longer drives the colour.
  const placement3 = new Map<number, SinrLiveCellPlacement>([
    [3, { cellId: 3, worldX: 10, worldZ: -10, radiusWorld: 12 }],
  ]);
  const items = resolveSinrLiveHandoverPulseConeItems({
    recentHandoverEvents: [pulseEvent({ kind: 'intra', fromSatId: 'sat-A', fromCellId: 3, toSatId: 'sat-A', toCellId: 3, sourceTimeSec: 450 })],
    simTimeSec: 450, retentionSec: RET, placementByCellId: placement3, satelliteWorldById, frequencyReuse: 3,
  });
  assert(items.length >= 1, 'cell-3 pulse cone drew');
  assertEqual(items[0].frequencyIndex, 0, 'cell 3 under reuse 3 → telemetry frequency index 0 (cellId % reuse)');
  assertEqual(items[0].color, colorForServingBeam('sat-A', 3).markerColor, 'pulse colour == serving-identity colour for (sat-A, cell 3)');
  const ambient = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 3, true)]),
    placementByCellId: placement3, satelliteWorldById, focusSatIds: null,
  });
  assertEqual(items[0].color, ambient[0].color, 'pulse colour == the ambient cone colour for the same (satId, cellId)');
});

check('pulse cones carry the truth event.kind (C2 / Bug H) so the render can paint intra vs inter distinctly', () => {
  const intra = resolveSinrLiveHandoverPulseConeItems(pulseInput([
    pulseEvent({ kind: 'intra', fromSatId: 'sat-A', fromCellId: 0, toSatId: 'sat-A', toCellId: 1, sourceTimeSec: 450 }),
  ]));
  assert(intra.length === 2 && intra.every(i => i.kind === 'intra'), 'every intra pulse cone is tagged kind=intra (old + new)');
  const inter = resolveSinrLiveHandoverPulseConeItems(pulseInput([
    pulseEvent({ kind: 'inter', sourceTimeSec: 450 }),
  ]));
  assert(inter.length === 2 && inter.every(i => i.kind === 'inter'), 'every inter pulse cone is tagged kind=inter');
  // The kind tag is ADDITIVE: the resolver colour stays serving-identity (the per-kind
  // hue is applied at the render from beamDisplaySpec), so the colour-match invariant
  // above is unaffected. Only the PULSE layer tags a kind; the ambient cone has none.
  assertEqual(intra[0].color, colorForServingBeam(intra[0].satId, intra[0].cellId).markerColor, 'kind tag leaves the resolver colour = serving-identity');
  const ambient = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true)]),
    placementByCellId, satelliteWorldById, focusSatIds: null,
  });
  assertEqual(ambient[0].kind, undefined, 'an ambient serving cone carries NO kind (only the pulse layer tags one)');
});

check('render-colour resolution (C2): hero > per-kind pulse > override > serving-identity', () => {
  const base = (kind?: 'intra' | 'inter'): SinrLiveCellBeamConeRenderItem => ({
    cellId: 0, satId: 'sat-A', frequencyIndex: 0, color: '#abcdef', serving: true,
    apex: new THREE.Vector3(), baseCenter: new THREE.Vector3(), baseRadiusWorld: 1, kind,
  });
  const opts = { pulseIntraColor: SINR_LIVE_CONE_PULSE_INTRA_COLOR, pulseInterColor: SINR_LIVE_CONE_PULSE_INTER_COLOR };
  // 4. default: a cone with no kind keeps its serving-identity colour.
  assertEqual(resolveSinrLiveConeRenderColor(base(), opts), '#abcdef', 'no kind → serving-identity colour');
  // 2. per-kind pulse colours.
  assertEqual(resolveSinrLiveConeRenderColor(base('intra'), opts), SINR_LIVE_CONE_PULSE_INTRA_COLOR, 'intra pulse → intra colour');
  assertEqual(resolveSinrLiveConeRenderColor(base('inter'), opts), SINR_LIVE_CONE_PULSE_INTER_COLOR, 'inter pulse → inter colour');
  // (intra ≠ inter is guaranteed at compile time — the constants are distinct literals.)
  // 3. mount override (the candidate cyan mount) wins over serving-identity but a
  //    kind still wins over the override (a pulse is never the candidate mount).
  assertEqual(resolveSinrLiveConeRenderColor(base(), { coneColorOverride: '#0ea5e9' }), '#0ea5e9', 'override → override colour when no kind');
  // 1. hero wins over everything (the protagonist beam, even if somehow kinded).
  assertEqual(resolveSinrLiveConeRenderColor(base('intra'), { ...opts, isHero: true, heroColor: '#facc15' }), '#facc15', 'hero overrides the per-kind colour');
  // a per-kind colour absent on the mount → falls through to serving-identity (a
  // non-pulse mount passes no pulse colours, so a stray kind never recolours it).
  assertEqual(resolveSinrLiveConeRenderColor(base('intra'), {}), '#abcdef', 'intra cone on a mount with no pulse colours → serving-identity');
});

console.log(`\nSinrLiveCellBeamCones resolver: ${passed} checks passed.`);
