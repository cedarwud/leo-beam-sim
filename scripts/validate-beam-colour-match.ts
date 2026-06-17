#!/usr/bin/env node
/**
 * Colour-match model invariant gate (consolidation SDD §4.2 / roadmap A3) — the
 * CONTRACT pin that locks Bug E's fix: on the sinr-live cell lane, a served UE's
 * marker colour MUST equal the colour of the serving cone for its (satId, cellId),
 * because both go through the ONE serving-identity authority
 * `colorForServingBeam` (`constants/servingColour`). This is a behaviour/contract
 * pin, NOT a source-text pin: it asserts the OUTPUT (cone colour == UE colour),
 * so moving/renaming code is cheap but routing either resolver through a second
 * colour authority (the regression that re-opens Bug E) turns it RED.
 *
 * Pure model test (no browser): drives the real production resolvers
 * (`resolveSinrLiveCellBeamConeItems` for cones, `buildSinrServingUeColorMapFromCells`
 * for the UE mosaic — the SAME pair MainScene mounts) over a synthetic multi-UE /
 * multi-cell frame and checks coverage + colour match end to end.
 *
 * Run: `npm run validate:beam:colour-match`.
 */
import {
  resolveSinrLiveCellBeamConeItems,
  resolveSinrLiveNonServingConeItems,
  type SinrLiveCellPlacement,
} from '../src/viz/SinrLiveCellBeamCones.tsx';
import {
  buildSinrServingUeColorMapFromCells,
  SINR_SERVING_UNSERVED_COLOR,
} from '../src/scene/sinrServingMosaic.ts';
import { colorForServingBeam } from '../src/constants/servingColour.ts';
import type {
  IlluminatedCellBeam,
  SinrLiveCellFrame,
  UeCellServingRecord,
} from '../src/scene/sinrLiveCellModel.ts';
import type { WorldPoint } from '../src/viz/CellFootprints.tsx';

let passed = 0;
function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(`FAIL: ${label}`);
}
function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
function check(label: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${label}`);
}

// ── Synthetic frame: several sats serving several cells, served + unserved UEs ──
// (satId, cellId) serving pairs the UEs connect to; one sat serves two cells (an
// intra colour family), two different sats (an inter hue jump).
const SERVING_PAIRS: ReadonlyArray<{ satId: string; cellId: number }> = [
  { satId: 'sat-A', cellId: 0 },
  { satId: 'sat-A', cellId: 1 },
  { satId: 'sat-B', cellId: 2 },
  { satId: 'sat-C', cellId: 3 },
];

const placementByCellId = new Map<number, SinrLiveCellPlacement>(
  [0, 1, 2, 3, 4].map(id => [id, {
    cellId: id, worldX: 30 * (id + 1), worldZ: -20 * (id + 1), radiusWorld: 12,
  }]),
);
const satelliteWorldById = new Map<string, WorldPoint>([
  ['sat-A', { x: 0, y: 900, z: 0 }],
  ['sat-B', { x: 120, y: 940, z: -90 }],
  ['sat-C', { x: -140, y: 920, z: 70 }],
]);

function ue(ueId: string, servingSatId: string | null, cellId: number | null): UeCellServingRecord {
  return {
    ueId,
    cellId,
    cellDistanceKm: 1.2,
    offAxisDeg: 2.1,
    servingSatId,
    beamIdentity: servingSatId === null ? null : `${servingSatId}#cell${cellId}`,
    frequencyIndex: cellId === null ? null : cellId % 3,
    sinrDb: servingSatId === null ? null : 11.4,
    handoverKind: 'none',
  };
}

// Two served UEs per pair (a cell mosaic), plus unserved UEs (idle cell / no cell).
const ues: UeCellServingRecord[] = [
  ...SERVING_PAIRS.flatMap((p, i) => [
    ue(`u-${i}-a`, p.satId, p.cellId),
    ue(`u-${i}-b`, p.satId, p.cellId),
  ]),
  ue('u-idle', null, 4),   // cell idle this slot → unserved grey
  ue('u-nocell', null, null), // no cell → unserved grey
];

const illuminatedBeams: IlluminatedCellBeam[] = [
  ...SERVING_PAIRS.map(p => ({ satId: p.satId, cellId: p.cellId, frequencyIndex: p.cellId % 3, serving: true })),
  // a couple of NON-serving illuminated beams (co-channel context)
  { satId: 'sat-B', cellId: 0, frequencyIndex: 0, serving: false },
  { satId: 'sat-C', cellId: 1, frequencyIndex: 1, serving: false },
];

const cellFrame: SinrLiveCellFrame = {
  simTimeSec: 450,
  cells: [],
  ues,
  illuminatedBeams,
  servedCellCount: SERVING_PAIRS.length,
  servedUeCount: SERVING_PAIRS.length * 2,
  servingSatCount: new Set(SERVING_PAIRS.map(p => p.satId)).size,
  intraHandoverCount: 0,
  interHandoverCount: 0,
  recentHandoverEvents: [],
};

console.log('beam colour-match invariant checks:');

const coneItems = resolveSinrLiveCellBeamConeItems({
  cellFrame, placementByCellId, satelliteWorldById, focusSatIds: null,
});
const ueColors = buildSinrServingUeColorMapFromCells(cellFrame.ues);
const coneColorByKey = new Map(coneItems.map(c => [`${c.satId}:${c.cellId}`, c.color]));

check('every served UE has a serving cone for its (satId, cellId) AND the same colour (Bug E kill)', () => {
  let servedChecked = 0;
  for (const u of cellFrame.ues) {
    if (u.servingSatId === null || u.cellId === null) continue;
    const key = `${u.servingSatId}:${u.cellId}`;
    assert(coneColorByKey.has(key), `served UE ${u.ueId} has a serving cone for ${key}`);
    const ueColor = ueColors.get(u.ueId);
    assert(ueColor !== undefined, `UE ${u.ueId} has a marker colour`);
    assertEqual(ueColor!.markerColor, coneColorByKey.get(key)!, `UE ${u.ueId} marker colour == its serving cone colour (${key})`);
    servedChecked += 1;
  }
  assertEqual(servedChecked, SERVING_PAIRS.length * 2, 'all served UEs were checked');
});

check('the colour-match runs through the ONE authority colorForServingBeam (cone == UE == authority)', () => {
  for (const p of SERVING_PAIRS) {
    const key = `${p.satId}:${p.cellId}`;
    const authority = colorForServingBeam(p.satId, p.cellId).markerColor;
    assertEqual(coneColorByKey.get(key)!, authority, `cone(${key}) == colorForServingBeam`);
    // and a UE served there carries the same authority colour
    const someUe = cellFrame.ues.find(u => u.servingSatId === p.satId && u.cellId === p.cellId)!;
    assertEqual(ueColors.get(someUe.ueId)!.markerColor, authority, `UE on ${key} == colorForServingBeam`);
  }
});

check('intra family vs inter jump: same sat different cell = different shade; different sat = different colour', () => {
  const a0 = coneColorByKey.get('sat-A:0')!;
  const a1 = coneColorByKey.get('sat-A:1')!;
  const b2 = coneColorByKey.get('sat-B:2')!;
  assert(a0 !== a1, 'sat-A cell-0 vs cell-1 are a shade family (different)');
  assert(a0 !== b2, 'sat-A vs sat-B are different colours');
});

check('unserved UEs are grey, and grey is never a serving-cone colour', () => {
  assertEqual(ueColors.get('u-idle')!.markerColor, SINR_SERVING_UNSERVED_COLOR, 'idle-cell UE is grey');
  assertEqual(ueColors.get('u-nocell')!.markerColor, SINR_SERVING_UNSERVED_COLOR, 'no-cell UE is grey');
  for (const color of coneColorByKey.values()) {
    assert(color !== SINR_SERVING_UNSERVED_COLOR, 'no serving cone uses the unserved grey');
  }
});

check('non-serving cones share the identity authority too (one colour scheme for the whole field)', () => {
  const nonServing = resolveSinrLiveNonServingConeItems({
    cellFrame, placementByCellId, satelliteWorldById, focusSatIds: null,
  });
  assert(nonServing.length >= 1, 'the frame has non-serving illuminated beams');
  for (const c of nonServing) {
    assertEqual(c.color, colorForServingBeam(c.satId, c.cellId).markerColor, `non-serving cone ${c.satId}:${c.cellId} uses the identity authority`);
  }
});

console.log(`\nbeam colour-match invariant: ${passed} checks passed.`);
