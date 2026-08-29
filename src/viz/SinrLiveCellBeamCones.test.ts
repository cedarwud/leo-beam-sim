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
 *   4. cone base = the resolved cell/beam footprint centre on the GROUND (y = 0), apex = serving sat;
 *   5. colour = SERVING-IDENTITY colour (`colorForServingBeam(satId, cellId)`, the
 *      SAME authority the UE mosaic uses) — a serving cone is the same colour as the
 *      UE dots it serves (SDD §3.2, kills Bug E); the freq-reuse palette is retired
 *      from the live render (the style fn is retained for a future colour mode);
 *   6. a serving sat not rendered / a cell with no placement is skipped;
 *   7. the OBLIQUE geometry: the base ring lies FLAT on the ground plane and is elliptical when tilted.
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
  resolveSinrLiveHandoverPulseConeItems,
  resolveTriggeredIntraConeItems,
  resolveCinemaHandoverPairConeItems,
  resolveCinemaInterServingFanConeItems,
  resolveSinrLiveConeFog,
  shouldDimSinrLiveConeRole,
  resolveSinrLiveConeRenderColor,
  resolveSinrLiveConeRole,
  resolveSinrLiveConeDisplayStyle,
  resolveCandidateBeamConeItems,
  resolveBudgetedSinrLiveBeamConeItems,
  sinrLiveHandoverPulseOpacity,
  resolveTopServingFocusSatIds,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveCellPlacement,
  type SinrLiveCinemaHandoverCandidate,
} from './SinrLiveCellBeamCones';
import type { SinrLiveCellHandoverEvent } from '../scene/sinrLiveCellModel';
import { computeSinrLiveBeamFootprintEllipse } from '../scene/sinrLiveBeamGeometry';
import { MANUAL_HANDOVER_DISPLAY_MS } from '../scene/manualHandoverDemo';
import {
  frequencyReuseColor,
  INTRA_HANDOVER_TARGET_COLOR,
} from '../constants/beamRoleTokens';
import { colorForServingBeam } from '../constants/servingColour';
import {
  SINR_LIVE_CONE_AMBIENT_OPACITY,
  SINR_LIVE_CONE_BASE_ALPHA_FACTOR,
  SINR_LIVE_CONE_BLENDING,
  SINR_LIVE_CONE_PULSE_PEAK_OPACITY,
  SINR_LIVE_CONE_NONSERVING_OPACITY,
  SINR_LIVE_CONE_SEGMENTS,
  SINR_LIVE_CONE_PULSE_INTRA_COLOR,
  SINR_LIVE_CONE_PULSE_INTER_COLOR,
  SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
  SINR_LIVE_CONE_BACKGROUND_COLOR,
  SINR_LIVE_CONE_CANDIDATE_COLOR,
  SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY,
  SINR_LIVE_CONE_SERVING_FAN_COLOR,
  SINR_LIVE_CONE_BACKGROUND_OPACITY,
  SINR_LIVE_CONE_CANDIDATE_FAN_COLOR,
  SINR_LIVE_CONE_CANDIDATE_FAN_OPACITY,
  SINR_LIVE_CONE_CANDIDATE_OPACITY,
  SINR_LIVE_CONE_DIM_MIN_FACTOR,
  SINR_LIVE_CANDIDATE_FAN_MAX_CONES,
  SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS,
  HANDOVER_CONE_PHASE_END,
  resolveHandoverConeEnvelope,
  resolveSinrLiveConeColor,
  resolveSinrLiveConeLayerOpacity,
  resolveSinrLiveConeRoleStyle,
  type SinrLiveConeRole,
} from '../constants/sinrLiveConeStyle';
import {
  DEFAULT_BEAM_DISPLAY_SPEC,
  resolveTriggeredHandoverTargetColor,
} from '../scene/beamDisplaySpec';
import { buildSinrLiveCellLayout } from '../scene/sinrLiveCellRuntime';
import { loadProfile } from '../profiles/index';
import type { CellServingRecord, IlluminatedCellBeam, SinrLiveCellFrame } from '../scene/sinrLiveCellModel';

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
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
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
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
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

check('sampled steering never makes the displayed ground footprint slide at re-point boundaries', () => {
  const first = resolveSinrLiveCellBeamConeItems(base({ cellFrame: frameOf([beam('sat-A', 0, true)]) }));
  const next = resolveSinrLiveCellBeamConeItems(base({ cellFrame: frameOf([beam('sat-A', 0, true)]) }));
  assertEqual(first.length, 1, 'one serving cone at the first steering sample');
  assertEqual(next.length, 1, 'one serving cone at the next steering sample');
  approx(first[0].baseCenter.x, 30, 1e-9, 'first display footprint stays at the fixed cell east centre');
  approx(first[0].baseCenter.z, -40, 1e-9, 'first display footprint stays at the fixed cell north centre');
  approx(next[0].baseCenter.x, first[0].baseCenter.x, 1e-9, 'next display footprint does not slide east');
  approx(next[0].baseCenter.z, first[0].baseCenter.z, 1e-9, 'next display footprint does not slide north');
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

check('oblique geometry: elliptical base ring FLAT on the ground (y=0), every triangle apex = sat', () => {
  const apex = new THREE.Vector3(10, 900, -20);
  const baseCenter = new THREE.Vector3(40, 0, 60);
  const radius = 15;
  const segments = 8;
  const pos = buildObliqueBeamConePositions(apex, baseCenter, radius, segments);
  const ellipse = computeSinrLiveBeamFootprintEllipse({ apex, baseCenter, radiusWorld: radius });
  assertEqual(pos.length, segments * 9, '3 verts × segments triangles');
  for (let i = 0; i < segments; i += 1) {
    const o = i * 9;
    approx(pos[o], apex.x, 1e-6, `tri ${i} apex x`);
    approx(pos[o + 1], apex.y, 1e-6, `tri ${i} apex y`);
    approx(pos[o + 2], apex.z, 1e-6, `tri ${i} apex z`);
    approx(pos[o + 4], 0, 1e-9, `tri ${i} ring v1 on ground (y=0)`);
    approx(pos[o + 7], 0, 1e-9, `tri ${i} ring v2 on ground (y=0)`);
    const dx = pos[o + 3] - baseCenter.x;
    const dz = pos[o + 5] - baseCenter.z;
    const localLong = (dx * Math.cos(ellipse.longAxisAzimuthRad))
      + (dz * Math.sin(ellipse.longAxisAzimuthRad));
    const localShort = (-dx * Math.sin(ellipse.longAxisAzimuthRad))
      + (dz * Math.cos(ellipse.longAxisAzimuthRad));
    const ellipseEquation = (localLong * localLong) / (ellipse.longAxisWorld * ellipse.longAxisWorld)
      + (localShort * localShort) / (ellipse.shortAxisWorld * ellipse.shortAxisWorld);
    approx(ellipseEquation, 1, 1e-3, `tri ${i} ring v1 lies on the footprint ellipse`);
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

check('S5-2 style tokens (hybrid): ambient 0.17 < pulse 0.8, 32 segments, NormalBlending (replaces the cone style/opacity/blending pins)', () => {
  // 0.45 restored 2026-08-06: under NormalBlending a LOW ambient alpha lets the green
  // terrain dominate the composite, which is what made the whole field read green.
  // The serving fan is neutral GREY
  // context, so it has no hue to defend — only its place in the alpha ladder matters
  // (0.80 coloured roles > 0.17 serving fan > 0.13 candidate fan > 0.10 background).
  assertEqual(SINR_LIVE_CONE_AMBIENT_OPACITY, 0.17, 'serving-fan (grey context) opacity sits below the two coloured roles and above the other grey layers');
  assert(SINR_LIVE_CONE_PULSE_PEAK_OPACITY > SINR_LIVE_CONE_AMBIENT_OPACITY, 'HYBRID: the handover pulse is brighter than the ambient field');
  assertEqual(SINR_LIVE_CONE_SEGMENTS, 32, 'oblique cone ring segment count');
  // Blending decision chain: 7fb5991 (2026-06-22) moved Additive→Normal for semantic
  // colour truth; 8e4e1e7 (2026-07-03, ab861c4 3-layer footprint restore) deliberately
  // restored Additive — owner PIXEL-VERIFIED that look (output/shot/candshot-2.png);
  // 2026-08-06 moved it BACK to Normal on an explicit owner call (顏色不要洗白 /
  // 候選衛星應該要是藍色) — Additive saturates #3b82f6 to white over bright terrain, which
  // destroys the yellow/blue role palette. This pin tracks the CURRENT owner-approved
  // token; update pin WITH token in the SAME commit if it flips again (this assert
  // rotted invisibly 07-03→07-07 while src tests sat outside the static:all discovery;
  // closed by P2 SN-1).
  assertEqual(SINR_LIVE_CONE_BLENDING, THREE.NormalBlending, 'cones use NormalBlending (2026-08-06 owner call: constant hue, opacity = lighter↔heavier)');
  const posExplicit = buildObliqueBeamConePositions(new THREE.Vector3(0, 9, 0), new THREE.Vector3(1, 0, 1), 10, 5);
  assertEqual(posExplicit.length, 5 * 9, 'explicit segments honoured');
  const posDefault = buildObliqueBeamConePositions(new THREE.Vector3(0, 9, 0), new THREE.Vector3(1, 0, 1), 10);
  assertEqual(posDefault.length, SINR_LIVE_CONE_SEGMENTS * 9, 'default segment count == the style token');
});

check('Tier-2 SinrLiveConeStyle resolver: layer→opacity + colour map to the locked tokens (the ONE place; behaviour-identical)', () => {
  // resolveSinrLiveConeLayerOpacity is the single CHOICE point for each cone
  // layer's opacity (was: ambient default in the renderer, pulse a bare const). It
  // must return the screenshot-locked values verbatim.
  assertEqual(resolveSinrLiveConeLayerOpacity('ambient'), SINR_LIVE_CONE_AMBIENT_OPACITY, 'resolver ambient == 0.17 token');
  assertEqual(resolveSinrLiveConeLayerOpacity('pulse'), SINR_LIVE_CONE_PULSE_PEAK_OPACITY, 'resolver pulse == 0.8 peak token');
  assertEqual(resolveSinrLiveConeLayerOpacity('nonServing'), SINR_LIVE_CONE_NONSERVING_OPACITY, 'resolver nonServing == 0.07 dim token');
  assert(
    resolveSinrLiveConeLayerOpacity('pulse') > resolveSinrLiveConeLayerOpacity('ambient'),
    'HYBRID via resolver: the handover pulse is brighter than the ambient field',
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

check('G1-CONE-STYLE apex→base alpha: apex opaque (must-hold-safe), base in (0,1] (fade machinery), hue untouched (RGB white)', () => {
  assert(
    SINR_LIVE_CONE_BASE_ALPHA_FACTOR > 0 && SINR_LIVE_CONE_BASE_ALPHA_FACTOR <= 1,
    'base alpha factor in (0,1] — apex-equal at the current 1.0 (fade disabled, the documented default) down to faded; never inverted or fully invisible',
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

check('handover pulse roles keep the source serving-yellow and colour only the acquiring side', () => {
  const inter = resolveSinrLiveHandoverPulseConeItems(pulseInput([
    pulseEvent({ kind: 'inter', sourceTimeSec: 450 }),
  ]));
  const interSource = inter.find(item => item.role === 'handoverSource');
  const interTarget = inter.find(item => item.role === 'handoverTarget');
  assert(interSource !== undefined && interTarget !== undefined, 'inter pulse has one explicit source and target role');
  if (interSource === undefined || interTarget === undefined) throw new Error('inter pulse role fixture is incomplete');
  assertEqual(
    resolveSinrLiveConeRoleStyle(interSource.role!, {}, interSource).color,
    SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
    'inter source remains serving yellow',
  );
  assertEqual(
    resolveSinrLiveConeRoleStyle(interTarget.role!, {}, interTarget).color,
    SINR_LIVE_CONE_CANDIDATE_COLOR,
    'inter target is the only blue pulse side',
  );

  const intra = resolveSinrLiveHandoverPulseConeItems(pulseInput([
    pulseEvent({ kind: 'intra', fromSatId: 'sat-A', fromCellId: 0, toSatId: 'sat-A', toCellId: 1, sourceTimeSec: 450 }),
  ]));
  const intraSource = intra.find(item => item.role === 'handoverSource');
  const intraTarget = intra.find(item => item.role === 'handoverTarget');
  assert(intraSource !== undefined && intraTarget !== undefined, 'intra pulse has one explicit source and target role');
  if (intraSource === undefined || intraTarget === undefined) throw new Error('intra pulse role fixture is incomplete');
  assertEqual(
    resolveSinrLiveConeRoleStyle(intraTarget.role!, {}, intraTarget).color,
    INTRA_HANDOVER_TARGET_COLOR,
    'intra target remains orange',
  );
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
  assertEqual(SINR_LIVE_CONE_PULSE_INTRA_COLOR, INTRA_HANDOVER_TARGET_COLOR, 'intra pulse uses the intra target colour');
  assertEqual(SINR_LIVE_CONE_PULSE_INTER_COLOR, SINR_LIVE_CONE_CANDIDATE_COLOR, 'inter pulse uses the candidate blue');
  // 3. mount override (the candidate cyan mount) wins over serving-identity but a
  //    kind still wins over the override (a pulse is never the candidate mount).
  assertEqual(resolveSinrLiveConeRenderColor(base(), { coneColorOverride: '#0ea5e9' }), '#0ea5e9', 'override → override colour when no kind');
  // 1. hero wins over everything (the protagonist beam, even if somehow kinded).
  assertEqual(resolveSinrLiveConeRenderColor(base('intra'), { ...opts, isHero: true, heroColor: '#facc15' }), '#facc15', 'hero overrides the per-kind colour');
  // a per-kind colour absent on the mount → falls through to serving-identity (a
  // non-pulse mount passes no pulse colours, so a stray kind never recolours it).
  assertEqual(resolveSinrLiveConeRenderColor(base('intra'), {}), '#abcdef', 'intra cone on a mount with no pulse colours → serving-identity');
});

check('SEMANTIC palette VALUE pin: hero YELLOW / context GREY / candidate BLUE resolve to the real tokens the mount passes', () => {
  // Regression guard for "the cones look green / the hero is not yellow" (2026-08-06).
  // The NormalBlending switch changed how a cone COMPOSITES, and the ambient level
  // changes how much terrain shows through — neither may change which colour a role
  // RESOLVES to. This asserts the resolved values, not a screenshot.
  const item = (over: Partial<SinrLiveCellBeamConeRenderItem> = {}): SinrLiveCellBeamConeRenderItem => ({
    cellId: 0, satId: 'sat-A', frequencyIndex: 0, color: '#abcdef', serving: true,
    apex: new THREE.Vector3(), baseCenter: new THREE.Vector3(), baseRadiusWorld: 1, ...over,
  });
  // The mount passes spec fields, so pin the spec → token wiring first: a re-tint that
  // only edited the spec default would otherwise slip past a token-only assert.
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.heroConeColor, SINR_LIVE_CONE_SERVING_PRIMARY_COLOR, 'spec heroConeColor == the serving token');
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.backgroundConeColor, SINR_LIVE_CONE_BACKGROUND_COLOR, 'spec backgroundConeColor == the context token');
  // The literal values, so a silent palette drift is loud.
  assertEqual(SINR_LIVE_CONE_SERVING_PRIMARY_COLOR, '#facc15', 'serving/hero is YELLOW #facc15 (NOT green — the file header said "serving GREEN" until 2026-08-06)');
  assertEqual(SINR_LIVE_CONE_CANDIDATE_COLOR, '#3b82f6', 'candidate is BLUE #3b82f6');
  // What the serving mount actually resolves for each role.
  const mount = {
    isHero: false,
    heroColor: DEFAULT_BEAM_DISPLAY_SPEC.heroConeColor,
    backgroundColor: DEFAULT_BEAM_DISPLAY_SPEC.backgroundConeColor,
  };
  assertEqual(
    resolveSinrLiveConeRenderColor(item(), { ...mount, isHero: true }),
    '#facc15',
    'HERO cone resolves YELLOW on the serving mount',
  );
  assertEqual(
    resolveSinrLiveConeRenderColor(item(), mount),
    SINR_LIVE_CONE_BACKGROUND_COLOR,
    'non-hero serving cone resolves the dim CONTEXT colour (not its per-sat identity hue)',
  );
  assertEqual(
    resolveSinrLiveConeRenderColor(item(), { ...mount, coneColorOverride: SINR_LIVE_CONE_CANDIDATE_COLOR }),
    '#3b82f6',
    'CANDIDATE mount resolves BLUE',
  );
  // The hero path is only reachable for cones with NO per-item opacity (the mount's
  // `isHero` requires `cone.opacity === undefined`). Pin that the ambient serving
  // resolver leaves it undefined — if it ever started stamping one, every hero cone
  // would silently fall back to the grey context colour.
  const servingItems = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf([beam('sat-A', 0, true), beam('sat-B', 1, true)]),
    placementByCellId,
    satelliteWorldById,
    focusSatIds: null,
  });
  assert(servingItems.length > 0, 'serving cones built');
  for (const c of servingItems) {
    assertEqual(c.opacity, undefined, 'ambient serving items carry NO per-item opacity (the isHero precondition)');
  }
});

// ---------------------------------------------------------------------------
// beam-stage ① #5 — TRIGGERED intra flash resolver (from/to colour split).
// ---------------------------------------------------------------------------
const FROM_COLOR = '#f5a524'; // warm
const TO_COLOR = '#22d3ee';   // cool
function triggeredInput(event: SinrLiveCellHandoverEvent | null, opacity = 0.5) {
  return { event, fromOpacity: opacity, toOpacity: opacity, fromColor: FROM_COLOR, toColor: TO_COLOR, placementByCellId, satelliteWorldById, frequencyReuse: PULSE_REUSE };
}
function splitTriggeredInput(event: SinrLiveCellHandoverEvent, fromOpacity: number, toOpacity: number) {
  return { event, fromOpacity, toOpacity, fromColor: FROM_COLOR, toColor: TO_COLOR, placementByCellId, satelliteWorldById, frequencyReuse: PULSE_REUSE };
}
/** An intra event whose from/to cells are BOTH placed, so a phase can drop exactly one. */
const SEQUENCED_EVENT = pulseEvent({ kind: 'intra', fromSatId: 'sat-A', fromCellId: 0, toSatId: 'sat-A', toCellId: 1, sourceTimeSec: 450 });

console.log('\nSinrLiveCellBeamCones triggered-intra resolver checks:');

check('triggered intra: null event or non-positive opacity → no cones (cold/cleared no-op)', () => {
  assertEqual(resolveTriggeredIntraConeItems(triggeredInput(null)).length, 0, 'null event → no cones');
  assertEqual(resolveTriggeredIntraConeItems(triggeredInput(pulseEvent({ sourceTimeSec: 450 }), 0)).length, 0, 'opacity 0 → no cones');
  assertEqual(resolveTriggeredIntraConeItems(triggeredInput(pulseEvent({ sourceTimeSec: 450 }), -1)).length, 0, 'negative opacity → no cones');
});

check('triggered intra: from/to COLOUR SPLIT — old cell = fromColor (warm), new cell = toColor (cool)', () => {
  const items = resolveTriggeredIntraConeItems(triggeredInput(
    pulseEvent({ kind: 'intra', fromSatId: 'sat-A', fromCellId: 0, toSatId: 'sat-A', toCellId: 1, sourceTimeSec: 450 }),
    0.5,
  ));
  assertEqual(items.length, 2, 'old + new cell cones');
  const from = items.find(i => i.cellId === 0);
  const to = items.find(i => i.cellId === 1);
  assert(from !== undefined && to !== undefined, 'both from + to cones present');
  assertEqual(from!.color, FROM_COLOR, 'OLD (handed-off) cell paints the WARM fromColor');
  assertEqual(to!.color, TO_COLOR, 'NEW (acquired) cell paints the COOL toColor');
  assert(from!.color !== to!.color, 'from/to are DISTINCT colours (directional read — not both one hue)');
});

check('triggered intra: the caller-driven wall-clock opacity passes through to every cone', () => {
  const items = resolveTriggeredIntraConeItems(triggeredInput(pulseEvent({ sourceTimeSec: 450 }), 0.42));
  assert(items.length > 0, 'cones built');
  for (const i of items) approx(i.opacity ?? -1, 0.42, 1e-9, 'cone carries the passed wall-clock opacity');
});

check('triggered intra: an unplaced/unrendered side is skipped honestly (no fabricated cone)', () => {
  const partial = resolveTriggeredIntraConeItems(triggeredInput(pulseEvent({ toCellId: 99, sourceTimeSec: 450 })));
  assertEqual(partial.length, 1, 'unplaced new cell (99) skipped; old cell still flashes');
  assertEqual(partial[0].cellId, 0, 'the placed old cell-0 drew');
  assertEqual(partial[0].color, FROM_COLOR, 'old cell keeps the warm fromColor');
});

// ---------------------------------------------------------------------------
// 2026-08-06 — the from/to opacities are INDEPENDENT, and the manual demo's
// four-phase envelope that drives them. Owner: 「inter 應該是先一個連線，然後另一個進來，
// 等一段時間後原本的斷掉，但是現在是2個同時連線，然後就結束了」.
// ---------------------------------------------------------------------------
check('triggered intra: fromOpacity / toOpacity are INDEPENDENT (a phase can hold one cone while the other is absent)', () => {
  // phase 1 shape: old link only — the new cone must not exist at all, not merely be invisible.
  const servingOnly = resolveTriggeredIntraConeItems(splitTriggeredInput(SEQUENCED_EVENT, 0.9, 0));
  assertEqual(servingOnly.length, 1, 'to-opacity 0 → the NEW cone is not emitted');
  assertEqual(servingOnly[0].cellId, 0, 'the surviving cone is the OLD (from) cell');
  approx(servingOnly[0].opacity ?? -1, 0.9, 1e-9, 'the old cone carries its OWN opacity');
  // phase 4 end shape: new link only — the old cone is released.
  const acquiredOnly = resolveTriggeredIntraConeItems(splitTriggeredInput(SEQUENCED_EVENT, 0, 0.9));
  assertEqual(acquiredOnly.length, 1, 'from-opacity 0 → the OLD cone is not emitted');
  assertEqual(acquiredOnly[0].cellId, 1, 'the surviving cone is the NEW (to) cell');
  // phase 2/3 shape: both up, at DIFFERENT alphas (the shared-opacity bug would equalise them).
  const both = resolveTriggeredIntraConeItems(splitTriggeredInput(SEQUENCED_EVENT, 0.9, 0.3));
  assertEqual(both.length, 2, 'both cones drawn while the links overlap');
  approx(both.find(i => i.cellId === 0)!.opacity ?? -1, 0.9, 1e-9, 'old cone keeps fromOpacity');
  approx(both.find(i => i.cellId === 1)!.opacity ?? -1, 0.3, 1e-9, 'new cone keeps toOpacity');
});

console.log('\nShared handover cone envelope checks (manual demo + REAL handover flash):');

check('both windows are long enough to narrate the phases', () => {
  // BOTH callers walk this envelope now, so BOTH windows must clear the readability bar.
  // The narrated acts are the first four; the fifth (`settled`) is the tail.
  const shortestActFraction = Math.min(
    HANDOVER_CONE_PHASE_END.serving,
    HANDOVER_CONE_PHASE_END.measuring - HANDOVER_CONE_PHASE_END.serving,
    HANDOVER_CONE_PHASE_END.holding - HANDOVER_CONE_PHASE_END.measuring,
    HANDOVER_CONE_PHASE_END.releasing - HANDOVER_CONE_PHASE_END.holding,
    1 - HANDOVER_CONE_PHASE_END.releasing,
  );
  assert(MANUAL_HANDOVER_DISPLAY_MS >= 4000, 'the manual demo window gets >= 1s per phase');
  // The 2026-08-06 regression the owner reported ("no animation") was the real flash NOT
  // walking this envelope at all. Now that it does, its window must not be so short that
  // the phases collapse back into a blink — ~600ms/act is what the manual demo was raised
  // OFF of. 900ms is the floor.
  assert(
    SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS * shortestActFraction >= 900,
    `the REAL handover window gives every act >= 900ms (got ${(SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS * shortestActFraction).toFixed(0)}ms)`,
  );
  // …and not so long that it routinely outlives the gap to the protagonist's next handover,
  // which would re-arm the latch mid-story. The manual window is the deliberate outlier
  // (it pauses the sim), so the real one must stay strictly under it.
  assert(
    SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS < MANUAL_HANDOVER_DISPLAY_MS,
    'the mid-playback window stays shorter than the sim-paused demonstration window',
  );
  assert(
    HANDOVER_CONE_PHASE_END.serving < HANDOVER_CONE_PHASE_END.measuring
    && HANDOVER_CONE_PHASE_END.measuring < HANDOVER_CONE_PHASE_END.holding
    && HANDOVER_CONE_PHASE_END.holding < HANDOVER_CONE_PHASE_END.releasing
    && HANDOVER_CONE_PHASE_END.releasing < 1,
    'the phase boundaries are strictly ordered inside the window',
  );
});

check('envelope: phase 1 = old link ALONE (the new beam has not arrived)', () => {
  for (const p of [0, 0.1, 0.18]) {
    const e = resolveHandoverConeEnvelope(p, 1);
    assertEqual(e.phase, 'serving', `p=${p} is the serving phase`);
    approx(e.fromOpacity, 1, 1e-9, 'the current link is at full strength');
    approx(e.toOpacity, 0, 1e-9, 'no candidate beam yet');
  }
});

check('envelope: phase 2 = the candidate FADES IN while the old link holds', () => {
  // The MEASURING window midpoint — (serving + measuring) / 2, i.e. 0.28125 at the
  // current boundaries. Pinned by expression so a boundary edit cannot silently
  // desynchronise the probe point from the phase it claims to sample.
  const measuringMid = (HANDOVER_CONE_PHASE_END.serving + HANDOVER_CONE_PHASE_END.measuring) / 2;
  const mid = resolveHandoverConeEnvelope(measuringMid, 1);
  assertEqual(mid.phase, 'measuring', 'mid-ramp is the measuring phase');
  approx(mid.fromOpacity, 1, 1e-9, 'the old link does NOT dip while the candidate arrives');
  approx(mid.toOpacity, 0.5, 1e-9, 'smoothstep is exactly half-way at the window midpoint');
  const early = resolveHandoverConeEnvelope(0.22, 1);
  assert(early.toOpacity > 0 && early.toOpacity < mid.toOpacity, 'the candidate ramps up monotonically');
});

check('envelope: phase 3 = BOTH links held (the overlap is a visible state, not the whole event)', () => {
  for (const p of [0.38, 0.46, 0.55]) {
    const e = resolveHandoverConeEnvelope(p, 1);
    assertEqual(e.phase, 'holding', `p=${p} is the holding phase`);
    approx(e.fromOpacity, 1, 1e-9, 'old link still up during the trigger timer');
    approx(e.toOpacity, 1, 1e-9, 'new link fully up during the trigger timer');
  }
});

check('envelope: phase 4 = the OLD link releases while the new one stays up', () => {
  const releasingMid = (HANDOVER_CONE_PHASE_END.holding + HANDOVER_CONE_PHASE_END.releasing) / 2;
  const mid = resolveHandoverConeEnvelope(releasingMid, 1);
  assertEqual(mid.phase, 'releasing', 'mid-release is the releasing phase');
  approx(mid.toOpacity, 1, 1e-9, 'the acquired link stays at full strength');
  approx(mid.fromOpacity, 0.5, 1e-9, 'the old link is half-released at the window midpoint');
  const end = resolveHandoverConeEnvelope(1, 1);
  approx(end.fromOpacity, 0, 1e-9, 'the old link is fully released at the end');
  approx(end.toOpacity, 1, 1e-9, 'only the new link remains');
});

check('envelope: the two cones are NEVER a single shared curve, and never both dark', () => {
  let sawFromOnly = false;
  let sawToOnly = false;
  let sawBoth = false;
  let sawDifferent = false;
  for (let i = 0; i <= 100; i += 1) {
    const { fromOpacity, toOpacity } = resolveHandoverConeEnvelope(i / 100, 0.95);
    assert(fromOpacity > 0 || toOpacity > 0, `p=${i / 100} still shows at least one beam (never a blank frame)`);
    assert(fromOpacity >= 0 && fromOpacity <= 0.95 && toOpacity >= 0 && toOpacity <= 0.95, 'opacities stay inside [0, peak]');
    if (fromOpacity > 0 && toOpacity === 0) sawFromOnly = true;
    if (fromOpacity === 0 && toOpacity > 0) sawToOnly = true;
    if (fromOpacity > 0 && toOpacity > 0) sawBoth = true;
    if (Math.abs(fromOpacity - toOpacity) > 1e-6) sawDifferent = true;
  }
  assert(sawFromOnly, 'there is a window where ONLY the old link is up');
  assert(sawToOnly, 'there is a window where ONLY the new link is up');
  assert(sawBoth, 'there is a window where BOTH are up (the trigger-timer overlap)');
  assert(sawDifferent, 'the two cones are driven by DISTINCT curves (regression guard for the shared-opacity bug)');
});

check('envelope: out-of-range / non-finite progress is clamped, never NaN', () => {
  const before = resolveHandoverConeEnvelope(-1, 0.8);
  approx(before.fromOpacity, 0.8, 1e-9, 'progress < 0 clamps to the opening frame');
  approx(before.toOpacity, 0, 1e-9, 'progress < 0 has no candidate yet');
  const after = resolveHandoverConeEnvelope(9, 0.8);
  approx(after.fromOpacity, 0, 1e-9, 'progress > 1 clamps to the closing frame');
  approx(after.toOpacity, 0.8, 1e-9, 'progress > 1 keeps the acquired link');
  const nan = resolveHandoverConeEnvelope(Number.NaN, 0.8);
  assert(Number.isFinite(nan.fromOpacity) && Number.isFinite(nan.toOpacity), 'NaN progress yields finite opacities');
  const nanPeak = resolveHandoverConeEnvelope(0.5, Number.NaN);
  assert(Number.isFinite(nanPeak.fromOpacity) && Number.isFinite(nanPeak.toOpacity), 'NaN peak yields finite opacities');
});

check('REAL handover path: age/sustain through the envelope draws 單 → 雙 → 單 (the "no animation" regression guard)', () => {
  // The exact expression MainScene's real-handover branch evaluates:
  //   resolveHandoverConeEnvelope(ageMs / triggeredIntraSustainMs, triggeredIntraPeakOpacity)
  // fed straight into the SAME cone resolver the branch calls. Before 2026-08-06 this
  // branch passed ONE opacity to both cones, so the count sequence was 2 → 2 → 2 → 0:
  // two beams blinking in lockstep, no handOVER. The owner's report was 「根本就沒有動畫阿」.
  const sustainMs = SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS;
  const peak = DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity;
  const counts: number[] = [];
  const phases: string[] = [];
  for (let ageMs = 0; ageMs <= sustainMs; ageMs += sustainMs / 20) {
    const env = resolveHandoverConeEnvelope(ageMs / sustainMs, peak);
    phases.push(env.phase);
    counts.push(resolveTriggeredIntraConeItems({
      event: SEQUENCED_EVENT,
      fromOpacity: env.fromOpacity,
      toOpacity: env.toOpacity,
      fromColor: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraFromColor,
      toColor: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraToColor,
      placementByCellId, satelliteWorldById, frequencyReuse: PULSE_REUSE,
    }).length);
  }
  assertEqual(counts[0], 1, 'the story OPENS on one beam — the current link alone');
  assert(counts.includes(2), 'there is a stretch where BOTH beams are up (the handover overlap)');
  assertEqual(counts[counts.length - 1], 1, 'the story CLOSES on one beam — settled on the new link');
  assert(counts.every(c => c >= 1), 'the cue never goes blank mid-story');
  // Monotone shape: it must be 1 → 2 → 1, not 1 → 2 → 1 → 2 → 1 (a flicker).
  const transitions = counts.filter((c, i) => i > 0 && c !== counts[i - 1]).length;
  assertEqual(transitions, 2, 'exactly two transitions: one beam becomes two, two become one');
  // All five phases are actually reachable at this sampling rate — none is a null act.
  for (const phase of ['serving', 'measuring', 'holding', 'releasing', 'settled']) {
    assert(phases.includes(phase), `the ${phase} phase is on screen for real time, not a single frame`);
  }
});

// ---------------------------------------------------------------------------
// 2026-08-06 CONSOLIDATION — the ONE cone appearance decision point.
//
// Before this, "what colour + how bright is this cone" was spread over a five-level
// precedence inside `resolveSinrLiveConeRenderColor`, a separate opacity ternary at the
// mount, an IMPLICIT hero signal (`cone.opacity === undefined`), and a different colour
// prop trio per mount. Now: a cone has a ROLE (explicit or derived), and the role decides
// colour + opacity in `resolveSinrLiveConeRoleStyle`. These checks VALUE-assert every role
// so the palette can never drift by screenshot.
// ---------------------------------------------------------------------------
console.log('\nSinrLiveCellBeamCones role decision-point checks:');

check('role DERIVATION: mount layer + hero identity → role (no implicit `cone.opacity === undefined` signal)', () => {
  const hero = { layer: 'serving' as const, heroSatId: 'sat-A', heroCellId: 0 };
  assertEqual(resolveSinrLiveConeRole({ ...hero, satId: 'sat-A', cellId: 0 }), 'hero', 'hero sat + hero cell → hero');
  assertEqual(resolveSinrLiveConeRole({ ...hero, satId: 'sat-A', cellId: 1 }), 'servingFan', 'hero SAT, other cell → servingFan (was collapsed into the grey context role)');
  assertEqual(resolveSinrLiveConeRole({ ...hero, satId: 'sat-B', cellId: 0 }), 'background', 'other satellite → background context');
  assertEqual(resolveSinrLiveConeRole({ layer: 'serving', satId: 'sat-A', cellId: 0 }), 'background', 'no hero identity → background (never a false hero)');
  assertEqual(resolveSinrLiveConeRole({ layer: 'nonServing', satId: 'sat-A', cellId: 0 }), 'nonServing', 'non-serving layer');
  assertEqual(resolveSinrLiveConeRole({ layer: 'pulse', satId: 'sat-A', cellId: 0 }), 'pulse', 'pulse layer');
  assertEqual(resolveSinrLiveConeRole({ layer: 'triggered', satId: 'sat-A', cellId: 0 }), 'triggered', 'triggered layer');
  assertEqual(resolveSinrLiveConeRole({ layer: 'candidate', satId: 'sat-C', cellId: 3 }), 'candidatePrimary', 'candidate layer default');
  // An EXPLICIT item role wins — the candidate resolver knows more than the mount does.
  assertEqual(
    resolveSinrLiveConeRole({ ...hero, satId: 'sat-A', cellId: 0, itemRole: 'candidateFan' }),
    'candidateFan',
    'an explicit item role overrides the layer derivation',
  );
  // The RETIRED implicit signal: a per-item opacity must no longer be able to un-hero a cone.
  assertEqual(
    resolveSinrLiveConeRole({ ...hero, satId: 'sat-A', cellId: 0 }),
    'hero',
    'hero derivation does not consult cone.opacity (the retired implicit signal)',
  );
});

check('role → FOG: primary/event cones bypass spotlight fog, context fans remain fogged', () => {
  for (const role of ['hero', 'candidatePrimary', 'pulse', 'triggered'] as const) {
    assertEqual(resolveSinrLiveConeFog(role), false, `${role} event surface bypasses scene fog`);
  }
  for (const role of ['servingFan', 'candidateFan', 'background', 'nonServing'] as const) {
    assertEqual(resolveSinrLiveConeFog(role), true, `${role} context surface remains fogged`);
  }
});

check('candidate primary stays visually legible at shallow elevation without changing candidate truth', () => {
  assertEqual(shouldDimSinrLiveConeRole('hero', true, true), false, 'hero remains exempt from shallow dimming');
  assertEqual(shouldDimSinrLiveConeRole('candidatePrimary', true, true), false, 'primary blue candidate remains fully visible');
  assertEqual(shouldDimSinrLiveConeRole('candidateFan', true, true), true, 'candidate fan remains atmospheric');
  assertEqual(shouldDimSinrLiveConeRole('servingFan', true, true), true, 'serving fan retains shallow dimming');
  assertEqual(shouldDimSinrLiveConeRole('candidatePrimary', false, true), false, 'disabled dimming stays disabled');
});

check('role → COLOUR + OPACITY table (defaults): every role resolves to its locked token', () => {
  const table: Record<string, { color: string; opacity: number }> = {
    hero: { color: SINR_LIVE_CONE_SERVING_PRIMARY_COLOR, opacity: SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY },
    servingFan: { color: SINR_LIVE_CONE_BACKGROUND_COLOR, opacity: SINR_LIVE_CONE_AMBIENT_OPACITY },
    background: { color: SINR_LIVE_CONE_BACKGROUND_COLOR, opacity: SINR_LIVE_CONE_BACKGROUND_OPACITY },
    candidatePrimary: { color: SINR_LIVE_CONE_CANDIDATE_COLOR, opacity: SINR_LIVE_CONE_CANDIDATE_OPACITY },
    candidateFan: { color: SINR_LIVE_CONE_BACKGROUND_COLOR, opacity: SINR_LIVE_CONE_CANDIDATE_FAN_OPACITY },
    nonServing: { color: SINR_LIVE_CONE_BACKGROUND_COLOR, opacity: SINR_LIVE_CONE_NONSERVING_OPACITY },
  };
  for (const [role, expected] of Object.entries(table)) {
    const style = resolveSinrLiveConeRoleStyle(role as SinrLiveConeRole);
    assertEqual(style.color, expected.color, `role ${role} colour`);
    assertEqual(style.opacity, expected.opacity, `role ${role} opacity`);
  }
  // The two event layers colour from the cone, not the role token.
  const pulseIntra = resolveSinrLiveConeRoleStyle('pulse', {}, { kind: 'intra', color: '#abcdef' });
  assertEqual(pulseIntra.color, SINR_LIVE_CONE_PULSE_INTRA_COLOR, 'pulse intra colour');
  assertEqual(pulseIntra.opacity, SINR_LIVE_CONE_PULSE_PEAK_OPACITY, 'pulse default peak opacity');
  assertEqual(resolveSinrLiveConeRoleStyle('pulse', {}, { kind: 'inter' }).color, SINR_LIVE_CONE_PULSE_INTER_COLOR, 'pulse inter colour');
  const triggered = resolveSinrLiveConeRoleStyle('triggered', {}, { color: '#22d3ee', opacity: 0.42 });
  assertEqual(triggered.color, '#22d3ee', 'triggered paints the item\'s explicit from/to colour');
  approx(triggered.opacity, 0.42, 1e-9, 'triggered carries the wall-clock envelope opacity');
});

check('role → style: a per-ITEM opacity always wins over the role base alpha (the pulse fade / triggered envelope)', () => {
  for (const role of ['hero', 'servingFan', 'background', 'candidatePrimary', 'candidateFan', 'nonServing'] as const) {
    approx(resolveSinrLiveConeRoleStyle(role, {}, { opacity: 0.137 }).opacity, 0.137, 1e-9, `${role} honours a per-item opacity`);
  }
});

check('role → style: the MOUNT palette (beamDisplaySpec) overrides every token, and the spec defaults ARE the tokens', () => {
  // The spec is the prompt-editable control surface; its defaults must be the tokens, or a
  // "change the beam colour" edit would land on a field the render does not read.
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.servingFanConeColor, SINR_LIVE_CONE_SERVING_FAN_COLOR, 'spec servingFanConeColor == token');
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.backgroundConeOpacity, SINR_LIVE_CONE_BACKGROUND_OPACITY, 'spec backgroundConeOpacity == token');
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.candidateFanConeColor, SINR_LIVE_CONE_CANDIDATE_FAN_COLOR, 'spec candidateFanConeColor == token');
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.candidateFanConeOpacity, SINR_LIVE_CONE_CANDIDATE_FAN_OPACITY, 'spec candidateFanConeOpacity == token');
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.candidateFanMaxCones, SINR_LIVE_CANDIDATE_FAN_MAX_CONES, 'spec candidateFanMaxCones == token');
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.candidateConeOpacity, SINR_LIVE_CONE_CANDIDATE_OPACITY, 'spec candidateConeOpacity == token');
  const palette = {
    heroColor: '#111111', servingFanColor: '#222222', backgroundColor: '#333333',
    candidateColor: '#444444', candidateFanColor: '#555555',
    heroOpacity: 0.91, servingConeOpacity: 0.51, backgroundOpacity: 0.11,
    candidateFanOpacity: 0.21, nonServingOpacity: 0.01,
  };
  assertEqual(resolveSinrLiveConeRoleStyle('hero', palette).color, '#111111', 'palette heroColor wins');
  assertEqual(resolveSinrLiveConeRoleStyle('servingFan', palette).color, '#222222', 'palette servingFanColor wins');
  assertEqual(resolveSinrLiveConeRoleStyle('background', palette).color, '#333333', 'palette backgroundColor wins');
  assertEqual(resolveSinrLiveConeRoleStyle('candidatePrimary', palette).color, '#444444', 'palette candidateColor wins');
  approx(resolveSinrLiveConeRoleStyle('candidatePrimary', { candidateOpacity: 0.33 }).opacity, 0.33, 1e-9, 'palette candidateOpacity wins');
  assertEqual(resolveSinrLiveConeRoleStyle('candidateFan', palette).color, '#555555', 'palette candidateFanColor wins');
  assertEqual(resolveSinrLiveConeRoleStyle('nonServing', palette).color, '#333333', 'nonServing shares the background context colour');
  approx(resolveSinrLiveConeRoleStyle('hero', palette).opacity, 0.91, 1e-9, 'palette heroOpacity wins');
  approx(resolveSinrLiveConeRoleStyle('servingFan', palette).opacity, 0.51, 1e-9, 'palette servingConeOpacity wins');
  approx(resolveSinrLiveConeRoleStyle('background', palette).opacity, 0.11, 1e-9, 'palette backgroundOpacity wins');
  approx(resolveSinrLiveConeRoleStyle('candidateFan', palette).opacity, 0.21, 1e-9, 'palette candidateFanOpacity wins');
  approx(resolveSinrLiveConeRoleStyle('nonServing', palette).opacity, 0.01, 1e-9, 'palette nonServingOpacity wins');
});

check('multi-candidate colour authority keeps publisher identity while preserving role opacity', () => {
  const identityCone: SinrLiveCellBeamConeRenderItem = {
    cellId: 0,
    satId: 'sat-identity',
    frequencyIndex: 0,
    color: '#d97706',
    serving: true,
    apex: new THREE.Vector3(0, 100, 0),
    baseCenter: new THREE.Vector3(0, 0, 0),
    baseRadiusWorld: 10,
  };
  const semantic = resolveSinrLiveConeDisplayStyle('hero', {}, identityCone, 'semantic-role');
  const identity = resolveSinrLiveConeDisplayStyle('hero', {}, identityCone, 'item-identity');
  assertEqual(semantic.color, SINR_LIVE_CONE_SERVING_PRIMARY_COLOR, 'legacy semantic-role mode stays yellow');
  assertEqual(identity.color, identityCone.color, 'accepted multi-candidate mode keeps the satellite/beam identity hue');
  assertEqual(identity.opacity, semantic.opacity, 'changing colour authority does not change carrier opacity');
});

check('FINAL COLOUR SPEC: colour marks ROLE and only role — exactly two coloured roles, everything else neutral grey', () => {
  // Owner 2026-08-06: 「只有服務波束是黃色，候選波束是藍色，其他都用灰色」.
  const s = (role: SinrLiveConeRole) => resolveSinrLiveConeRoleStyle(role);
  assertEqual(s('hero').color, SINR_LIVE_CONE_SERVING_PRIMARY_COLOR, 'the beam SERVING you is the only yellow');
  assertEqual(s('candidatePrimary').color, SINR_LIVE_CONE_CANDIDATE_COLOR, 'the beam ABOUT TO serve you is the only blue');
  for (const role of ['servingFan', 'candidateFan', 'background', 'nonServing'] as const) {
    assertEqual(s(role).color, SINR_LIVE_CONE_BACKGROUND_COLOR, `${role} is neutral context grey (a fan is 脈絡, not a role)`);
  }
  // The rejected "darker sibling" swatches must never come back: within the render there
  // are exactly THREE distinct cone colours, not a family per role.
  const distinct = new Set((['hero', 'candidatePrimary', 'servingFan', 'candidateFan', 'background', 'nonServing'] as const).map(r => s(r).color));
  assertEqual(distinct.size, 3, 'exactly three cone colours exist: serving yellow, candidate blue, context grey');
});

check('FINAL ALPHA LADDER: hierarchy is opacity alone, both coloured roles carry equal weight, nothing falls below the visibility floor', () => {
  const s = (role: SinrLiveConeRole) => resolveSinrLiveConeRoleStyle(role);
  // The two coloured roles are EQUAL-weight halves of the handover story, and both must be
  // strong enough that the green terrain cannot mute them under NormalBlending.
  assertEqual(s('candidatePrimary').opacity, s('hero').opacity, '"your link" and "your next link" carry the same weight');
  assert(s('hero').opacity >= 0.75, 'the coloured roles are bright + saturated (0.5 read muddy over the green terrain)');
  // Grey ladder, strictly ordered.
  assert(s('hero').opacity > s('servingFan').opacity, 'both coloured roles beat every grey layer');
  assert(s('servingFan').opacity > s('candidateFan').opacity, 'your satellite\'s fan reads above the candidate\'s fan');
  assert(s('candidateFan').opacity > s('background').opacity, 'the candidate fan reads above unrelated satellites');
  assert(s('background').opacity > s('nonServing').opacity, 'the opt-in non-serving layer is the faintest');
  // VISIBILITY FLOOR. The shallow-cone dim multiplies the serving + candidate mounts (the
  // non-serving mount passes no dimShallowCones, so its base alpha IS its effective alpha).
  // Nothing may land near the 0.023 "mathematically present, optically absent" level.
  for (const role of ['servingFan', 'background', 'candidatePrimary', 'candidateFan'] as const) {
    const effective = s(role).opacity * SINR_LIVE_CONE_DIM_MIN_FACTOR;
    assert(effective > 0.04, `${role} stays visible at the shallow-cone dim floor (effective ${effective.toFixed(4)})`);
  }
  assert(resolveSinrLiveConeLayerOpacity('nonServing') > 0.06, 'the opt-in non-serving layer remains visible while staying behind the default context field');
});

check('HANDOVER FADE is pure alpha: the from/to cones keep their event-kind hue for the whole envelope', () => {
  // Owner: 「換手的時候再用透明度來做漸淡跟漸濃」 — the old link's YELLOW fades out and the new
  // intra link's ORANGE fades in; neither swaps swatch mid-transition.
  const seen = { from: new Set<string>(), to: new Set<string>() };
  for (let i = 0; i <= 20; i += 1) {
    const env = resolveHandoverConeEnvelope(i / 20, DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity);
    const items = resolveTriggeredIntraConeItems({
      event: SEQUENCED_EVENT,
      fromOpacity: env.fromOpacity,
      toOpacity: env.toOpacity,
      fromColor: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraFromColor,
      toColor: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraToColor,
      placementByCellId, satelliteWorldById, frequencyReuse: PULSE_REUSE,
    });
    for (const item of items) {
      const style = resolveSinrLiveConeRoleStyle('triggered', {}, item);
      (item.cellId === SEQUENCED_EVENT.fromCellId ? seen.from : seen.to).add(style.color);
    }
  }
  assertEqual(seen.from.size, 1, 'the releasing cone keeps ONE colour across the whole envelope');
  assertEqual(seen.to.size, 1, 'the acquiring cone keeps ONE colour across the whole envelope');
  assertEqual([...seen.from][0], SINR_LIVE_CONE_SERVING_PRIMARY_COLOR, 'the releasing cone is the serving YELLOW, fading out');
  assertEqual([...seen.to][0], INTRA_HANDOVER_TARGET_COLOR, 'the intra acquiring cone is ORANGE, fading in');
});

check('HANDOVER EVENT PALETTE: intra is orange and inter is blue on both pulse and triggered layers', () => {
  assertEqual(resolveTriggeredHandoverTargetColor('intra', DEFAULT_BEAM_DISPLAY_SPEC), INTRA_HANDOVER_TARGET_COLOR, 'intra triggered target is orange');
  assertEqual(resolveTriggeredHandoverTargetColor('inter', DEFAULT_BEAM_DISPLAY_SPEC), SINR_LIVE_CONE_CANDIDATE_COLOR, 'inter triggered target is blue');
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraToColor, INTRA_HANDOVER_TARGET_COLOR, 'spec owns the intra target token');
  assertEqual(DEFAULT_BEAM_DISPLAY_SPEC.candidateConeColor, SINR_LIVE_CONE_CANDIDATE_COLOR, 'spec reuses candidate blue for inter');
});

check('LEGACY resolveSinrLiveConeRenderColor still delegates with byte-identical precedence (colour-match gate + footprint rings depend on it)', () => {
  const item = (over: Partial<SinrLiveCellBeamConeRenderItem> = {}): SinrLiveCellBeamConeRenderItem => ({
    cellId: 0, satId: 'sat-A', frequencyIndex: 0, color: '#abcdef', serving: true,
    apex: new THREE.Vector3(), baseCenter: new THREE.Vector3(), baseRadiusWorld: 1, ...over,
  });
  assertEqual(resolveSinrLiveConeRenderColor(item(), { isHero: true, heroColor: '#facc15' }), '#facc15', 'hero opt still wins');
  assertEqual(resolveSinrLiveConeRenderColor(item({ kind: 'intra' }), { pulseIntraColor: INTRA_HANDOVER_TARGET_COLOR }), INTRA_HANDOVER_TARGET_COLOR, 'kind opt still second');
  assertEqual(resolveSinrLiveConeRenderColor(item(), { coneColorOverride: '#3b82f6', backgroundColor: '#9ca3af' }), '#3b82f6', 'override still beats background');
  assertEqual(resolveSinrLiveConeRenderColor(item(), { backgroundColor: '#9ca3af' }), '#9ca3af', 'background still beats item identity');
  assertEqual(resolveSinrLiveConeRenderColor(item(), {}), '#abcdef', 'item identity is still the floor');
});

// ---------------------------------------------------------------------------
// 2026-08-06 — the pulse PER-SIDE focus gate (the "random blue beams" fix) and the
// candidate FAN (the owner's "not just one beam").
// ---------------------------------------------------------------------------
console.log('\nSinrLiveCellBeamCones pulse focus-gate + candidate-fan checks:');

check('pulse focus gate: an INTER handover only paints the side whose OWN satellite is focused', () => {
  // The exact measured pathology: an event admitted because its `to` end is the focused
  // hero sat still lit a cone on the `from` satellite, which draws nothing else.
  const event = pulseEvent({ ueId: 'ue-other', kind: 'inter', fromSatId: 'sat-A', fromCellId: 0, toSatId: 'sat-B', toCellId: 2, sourceTimeSec: 450 });
  const ungated = resolveSinrLiveHandoverPulseConeItems(pulseInput([event]));
  assertEqual(ungated.length, 2, 'with no focus set both sides draw (unchanged behaviour)');
  const gated = resolveSinrLiveHandoverPulseConeItems({
    ...pulseInput([event]), focusSatIds: new Set(['sat-B']), protagonistUeId: 'ue-0',
  });
  assertEqual(gated.length, 1, 'the off-focus `from` side is dropped');
  assertEqual(gated[0].satId, 'sat-B', 'only the focused satellite paints');
  assertEqual(gated[0].cellId, 2, 'and only on its own cell');
});

check('pulse focus gate: the PROTAGONIST\'s own handover still shows BOTH ends (the story is the point)', () => {
  const mine = pulseEvent({ ueId: 'ue-0', kind: 'inter', fromSatId: 'sat-A', fromCellId: 0, toSatId: 'sat-B', toCellId: 2, sourceTimeSec: 450 });
  const gated = resolveSinrLiveHandoverPulseConeItems({
    ...pulseInput([mine]), focusSatIds: new Set(['sat-B']), protagonistUeId: 'ue-0',
  });
  assertEqual(gated.length, 2, 'the protagonist\'s inter handover keeps its old + new cone');
  assert(gated.some(i => i.satId === 'sat-A') && gated.some(i => i.satId === 'sat-B'), 'both satellites paint for the protagonist');
});

check('pulse focus gate: an event entirely OFF focus paints nothing at all', () => {
  const other = pulseEvent({ ueId: 'ue-other', kind: 'inter', fromSatId: 'sat-A', fromCellId: 0, toSatId: 'sat-A', toCellId: 1, sourceTimeSec: 450 });
  const gated = resolveSinrLiveHandoverPulseConeItems({
    ...pulseInput([other]), focusSatIds: new Set(['sat-B']), protagonistUeId: 'ue-0',
  });
  assertEqual(gated.length, 0, 'no focused satellite on either side → no cone');
  // An EMPTY focus set is a real state (the protagonist is unserved this slot) and must
  // gate everything off, not be treated as "no filter".
  assertEqual(
    resolveSinrLiveHandoverPulseConeItems({ ...pulseInput([other]), focusSatIds: new Set<string>(), protagonistUeId: 'ue-0' }).length,
    0,
    'an empty focus set gates every non-protagonist cone off',
  );
});

check('candidate FAN: the candidate satellite draws its own bounded multibeam fan, not one lone cone', () => {
  const fanPlacements = new Map<number, SinrLiveCellPlacement>(
    [0, 1, 2, 3, 4].map(id => [id, { cellId: id, worldX: 20 * (id + 1), worldZ: -15 * (id + 1), radiusWorld: 10 }]),
  );
  const cellFrame = frameOf([
    beam('sat-B', 0, true), // the protagonist's cell — the primary candidate cone
    beam('sat-B', 1, false),
    beam('sat-B', 2, true),
    beam('sat-B', 3, false),
    beam('sat-A', 4, true), // a DIFFERENT satellite — must never be pulled in
  ]);
  const items = resolveCandidateBeamConeItems({
    pendingTargetSatId: 'sat-B', servingSatId: 'sat-A', primaryCellId: 0,
    placementByCellId: fanPlacements, satelliteWorldById, frequencyReuse: 3, cellFrame,
  });
  assert(items.length > 1, 'the candidate now draws a FAN (the 2026-08-06 owner decision), not a single cone');
  assertEqual(new Set(items.map(i => i.satId)).size, 1, 'the fan is ONE satellite — never the all-sat firehose');
  assertEqual(items[0].role, 'candidatePrimary', 'the cone on YOUR cell is the primary (bright blue) role');
  assertEqual(items[0].cellId, 0, 'the primary cone is on the protagonist cell');
  assert(items.slice(1).every(i => i.role === 'candidateFan'), 'every other cone is the dimmer fan role');
  assertEqual(new Set(items.map(i => i.cellId)).size, items.length, 'no cell is drawn twice');
  assert(items.every(i => typeof i.renderKey === 'string'), 'every candidate cone carries a stable renderKey');
  assertEqual(new Set(items.map(i => i.renderKey)).size, items.length, 'candidate render keys are distinct');
  // The fan is bounded, INCLUDING the primary.
  const capped = resolveCandidateBeamConeItems({
    pendingTargetSatId: 'sat-B', servingSatId: 'sat-A', primaryCellId: 0,
    placementByCellId: fanPlacements, satelliteWorldById, frequencyReuse: 3, cellFrame, maxFanCones: 2,
  });
  assertEqual(capped.length, 2, 'maxFanCones bounds the fan (primary included)');
  assertEqual(capped[0].role, 'candidatePrimary', 'the primary cone survives the cap first');
  assertEqual(
    resolveCandidateBeamConeItems({
      pendingTargetSatId: 'sat-B', servingSatId: 'sat-A', primaryCellId: 0,
      placementByCellId: fanPlacements, satelliteWorldById, frequencyReuse: 3, cellFrame, maxFanCones: 0,
    }).length,
    0,
    'maxFanCones 0 draws nothing',
  );
});

check('display beam budget: serving fan clamps to 1 and fills the display-only 19-cell substrate', () => {
  const displayPlacements = new Map<number, SinrLiveCellPlacement>(
    Array.from({ length: 19 }, (_, cellId) => [cellId, {
      cellId,
      worldX: 20 * (cellId + 1),
      worldZ: -15 * (cellId + 1),
      radiusWorld: 10,
    }]),
  );
  const rawItems = resolveSinrLiveCellBeamConeItems({
    cellFrame: frameOf(Array.from({ length: 7 }, (_, cellId) => beam('sat-A', cellId, true))),
    placementByCellId: displayPlacements,
    satelliteWorldById,
    focusSatIds: new Set(['sat-A']),
  });
  const one = resolveBudgetedSinrLiveBeamConeItems({
    existingItems: rawItems,
    satId: 'sat-A',
    maxCones: 1,
    placementByCellId: displayPlacements,
    satelliteWorldById,
    frequencyReuse: PULSE_REUSE,
    role: 'servingFan',
    renderKeyPrefix: 'test-serving',
    preferredCellId: 0,
  });
  assertEqual(one.length, 1, 'serving budget 1 produces one visible cone');
  assertEqual(one[0].cellId, 0, 'budget 1 preserves the preferred primary cell');

  const nineteen = resolveBudgetedSinrLiveBeamConeItems({
    existingItems: rawItems,
    satId: 'sat-A',
    maxCones: 19,
    placementByCellId: displayPlacements,
    satelliteWorldById,
    frequencyReuse: PULSE_REUSE,
    role: 'servingFan',
    renderKeyPrefix: 'test-serving',
  });
  assertEqual(nineteen.length, 19, 'serving budget 19 fills the visible fan');
  assert(nineteen.slice(7).every(item => item.role === 'servingFan'), 'supplemental beams are display fan items');
  assert(nineteen.slice(7).every(item => item.cellId >= 7), 'supplemental beams do not replace the seven UE cells');
});

check('candidate FAN: unchanged no-ops (no pending target / target IS the serving sat / no cell frame)', () => {
  const args = {
    placementByCellId, satelliteWorldById, frequencyReuse: PULSE_REUSE, primaryCellId: 0,
  };
  assertEqual(resolveCandidateBeamConeItems({ ...args, pendingTargetSatId: null, servingSatId: 'sat-A' }).length, 0, 'no pending target → nothing');
  assertEqual(resolveCandidateBeamConeItems({ ...args, pendingTargetSatId: 'sat-A', servingSatId: 'sat-A' }).length, 0, 'target IS the serving sat → nothing');
  assertEqual(
    resolveCandidateBeamConeItems({ ...args, pendingTargetSatId: 'sat-B', servingSatId: 'sat-A', primaryCellId: null }).length,
    0,
    'no protagonist cell → nothing',
  );
  // Omitting the cell frame degrades to exactly the OLD single-cone behaviour.
  const single = resolveCandidateBeamConeItems({ ...args, pendingTargetSatId: 'sat-B', servingSatId: 'sat-A' });
  assertEqual(single.length, 1, 'no cell frame → the primary cone only (the pre-2026-08-06 shape)');
  assertEqual(single[0].role, 'candidatePrimary', 'and it is the primary role');
});

check('cinema inter source FAN: the old serving satellite keeps its other beams separate from the pair primary', () => {
  const candidate: SinrLiveCinemaHandoverCandidate = {
    eventId: 'cinema-inter-source-fan',
    ueId: 'ue-0',
    kind: 'inter',
    sourceTimeSec: 450,
    fromSatId: 'sat-A',
    fromCellId: 0,
    toSatId: 'sat-B',
    toCellId: 2,
  };
  const cellFrame = frameOf([
    beam('sat-A', 0, true),
    beam('sat-A', 1, false),
    beam('sat-A', 3, false),
    beam('sat-B', 2, true),
  ]);
  const sourceFanPlacements = new Map<number, SinrLiveCellPlacement>(
    [0, 1, 2, 3].map(id => [id, { cellId: id, worldX: 20 * (id + 1), worldZ: -15 * (id + 1), radiusWorld: 10 }]),
  );
  const items = resolveCinemaInterServingFanConeItems({
    candidate,
    opacity: 0.24,
    placementByCellId: sourceFanPlacements,
    satelliteWorldById,
    frequencyReuse: PULSE_REUSE,
    cellFrame,
    maxFanCones: 4,
  });
  assert(items.length > 0, 'the source satellite owns visible fan cones');
  assert(items.every(item => item.satId === 'sat-A'), 'source fan never pulls in the candidate satellite');
  assert(items.every(item => item.role === 'servingFan'), 'source fan uses the serving-fan role');
  assert(items.every(item => item.opacity === 0.24), 'source fan follows the presentation opacity passed by the inter envelope');
  assert(items.every(item => item.cellId !== candidate.fromCellId), 'source fan leaves the primary service cone to the cinema pair');
  assertEqual(resolveCinemaInterServingFanConeItems({
    candidate,
    opacity: 0,
    placementByCellId: sourceFanPlacements,
    satelliteWorldById,
    frequencyReuse: PULSE_REUSE,
    cellFrame,
  }).length, 0, 'source fan is absent after the source side has fully released');
});

check('cinema inter pair: focused event resolves old + candidate cones for the handover story', () => {
  const candidate: SinrLiveCinemaHandoverCandidate = {
    eventId: 'cinema-inter-0001',
    ueId: 'ue-0',
    kind: 'inter',
    sourceTimeSec: 450,
    fromSatId: 'sat-A',
    fromCellId: 0,
    toSatId: 'sat-B',
    toCellId: 2,
  };
  const items = resolveCinemaHandoverPairConeItems({
    candidate,
    fromOpacity: 0.8,
    toOpacity: 0.8,
    fromColor: SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
    toColor: SINR_LIVE_CONE_CANDIDATE_COLOR,
    placementByCellId,
    satelliteWorldById,
    frequencyReuse: PULSE_REUSE,
  });
  assertEqual(items.length, 2, 'cinema inter has both source and candidate cones');
  assert(items.some(item => item.satId === 'sat-A' && item.cellId === 0), 'source satellite/cell is rendered');
  assert(items.some(item => item.satId === 'sat-B' && item.cellId === 2), 'candidate satellite/cell is rendered');
  assertEqual(new Set(items.map(item => item.renderKey)).size, 2, 'cinema pair keys are distinct');
  const candidateItem = items.find(item => item.satId === 'sat-B');
  assert(candidateItem !== undefined, 'candidate item is available for role styling');
  assertEqual(
    resolveSinrLiveConeRoleStyle('triggered', {}, candidateItem).color,
    SINR_LIVE_CONE_CANDIDATE_COLOR,
    'inter candidate keeps the candidate blue display role',
  );
});

check('cinema inter pair: both cones can be anchored on the protagonist UE', () => {
  const candidate: SinrLiveCinemaHandoverCandidate = {
    eventId: 'cinema-inter-ue-anchor',
    ueId: 'ue-0',
    kind: 'inter',
    sourceTimeSec: 450,
    fromSatId: 'sat-A',
    fromCellId: 0,
    toSatId: 'sat-B',
    toCellId: 2,
  };
  const target = new THREE.Vector3(4, 0, -7);
  const items = resolveCinemaHandoverPairConeItems({
    candidate,
    fromOpacity: 0.8,
    toOpacity: 0.8,
    fromColor: SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
    toColor: SINR_LIVE_CONE_CANDIDATE_COLOR,
    placementByCellId,
    satelliteWorldById,
    frequencyReuse: PULSE_REUSE,
    baseCenterOverride: target,
    fromBaseRadiusScale: 0.84,
    toBaseRadiusScale: 1,
  });
  assertEqual(items.length, 2, 'anchored cinema inter still has both cones');
  for (const item of items) {
    assertEqual(item.baseCenter.x, target.x, 'pair base uses the UE x anchor');
    assertEqual(item.baseCenter.y, target.y, 'pair base stays on the ground plane');
    assertEqual(item.baseCenter.z, target.z, 'pair base uses the UE z anchor');
  }
  const from = items.find(item => item.satId === 'sat-A');
  const to = items.find(item => item.satId === 'sat-B');
  assert(from !== undefined && to !== undefined, 'both anchored pair sides remain identifiable');
  assert(from!.baseRadiusWorld < to!.baseRadiusWorld, 'nested source radius keeps both colours visible');
});

check('cinema inter pair: fail closed when the focused event has no cell geometry', () => {
  const candidate: SinrLiveCinemaHandoverCandidate = {
    eventId: 'cinema-inter-no-cell',
    ueId: 'ue-0',
    kind: 'inter',
    sourceTimeSec: 450,
    fromSatId: 'sat-A',
    fromCellId: null,
    toSatId: 'sat-B',
    toCellId: null,
  };
  assertEqual(
    resolveCinemaHandoverPairConeItems({
      candidate,
      fromOpacity: 0.8,
      toOpacity: 0.8,
      fromColor: SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
      toColor: SINR_LIVE_CONE_CANDIDATE_COLOR,
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: PULSE_REUSE,
    }).length,
    0,
    'missing cell identity does not fabricate a cone',
  );
});

console.log(`\nSinrLiveCellBeamCones resolver: ${passed} checks passed.`);
