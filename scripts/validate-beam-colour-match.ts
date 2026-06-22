#!/usr/bin/env node
/**
 * Semantic beam-colour model invariant gate (semantic-beam-colour SDD §5) — REWORKED
 * from the Bug-E "a served UE's marker colour MUST equal its serving cone's colour"
 * equality. That equality RETIRED when the cones moved to the SEMANTIC role/state palette
 * (yellow serving / dim context / blue candidate / purple→yellow handover flip, applied at
 * the mount by `resolveSinrLiveConeRenderColor`) and the UE dots moved to a per-SATELLITE hue
 * (Option A) — the cones and the dots are now intentionally DIFFERENT colour schemes.
 *
 * What it still locks (behaviour/contract pins, NOT source-text):
 *  (a) EXISTENCE — every served UE has a serving cone for its (satId, cellId). [the
 *      surviving half of Bug E; also the s0:connected-sat-has-beam must-hold.]
 *  (b) the protagonist's serving cone RESOLVES the semantic serving YELLOW, a non-hero
 *      served cone the dim context colour, a candidate the candidate BLUE — through the
 *      real `resolveSinrLiveConeRenderColor` precedence (the render colour, eyeballed
 *      nowhere): a regression that drops the hero/override path turns it RED.
 *  (c) unserved UEs are GREY and grey is never a serving colour.
 *  (d) the UE mosaic partitions by SERVING SATELLITE (per-sat hue: same sat → one dot
 *      colour, so an intra-HO does NOT recolour a dot; a serving-sat change does).
 *  (e) the cone ITEM colour still routes through the ONE serving-identity authority
 *      `colorForServingBeam` (the per-cell DATA default survives behind the mount override).
 *
 * Pure model test (no browser): drives the real production resolvers
 * (`resolveSinrLiveCellBeamConeItems` + `resolveSinrLiveConeRenderColor` for cones,
 * `buildSinrServingUeColorMapFromCells` for the UE mosaic — the SAME pieces MainScene
 * mounts) over a synthetic multi-UE / multi-cell frame.
 *
 * Run: `npm run validate:beam:colour-match`.
 */
import {
  resolveSinrLiveCellBeamConeItems,
  resolveSinrLiveNonServingConeItems,
  resolveSinrLiveConeRenderColor,
  type SinrLiveCellPlacement,
} from '../src/viz/SinrLiveCellBeamCones.tsx';
import {
  buildSinrServingUeColorMapFromCells,
  SINR_SERVING_UNSERVED_COLOR,
} from '../src/scene/sinrServingMosaic.ts';
import { colorForServingBeam, colorForServingSatellite } from '../src/constants/servingColour.ts';
import {
  SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
  SINR_LIVE_CONE_BACKGROUND_COLOR,
  SINR_LIVE_CONE_CANDIDATE_COLOR,
} from '../src/constants/sinrLiveConeStyle.ts';
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
  cumulativeIntraHandoverCount: 0,
  cumulativeInterHandoverCount: 0,
  recentHandoverEvents: [],
};

console.log('semantic beam-colour invariant checks:');

const coneItems = resolveSinrLiveCellBeamConeItems({
  cellFrame, placementByCellId, satelliteWorldById, focusSatIds: null,
});
const ueColors = buildSinrServingUeColorMapFromCells(cellFrame.ues);
const coneColorByKey = new Map(coneItems.map(c => [`${c.satId}:${c.cellId}`, c.color]));

check('(a) EXISTENCE: every served UE has a serving cone for its (satId, cellId) + a marker colour', () => {
  let servedChecked = 0;
  for (const u of cellFrame.ues) {
    if (u.servingSatId === null || u.cellId === null) continue;
    const key = `${u.servingSatId}:${u.cellId}`;
    assert(coneColorByKey.has(key), `served UE ${u.ueId} has a serving cone for ${key}`);
    const ueColor = ueColors.get(u.ueId);
    assert(ueColor !== undefined, `UE ${u.ueId} has a marker colour`);
    // NB: the UE marker colour == cone colour EQUALITY retired with the semantic
    // redesign (cones = role palette, dots = per-sat); only existence is asserted here.
    servedChecked += 1;
  }
  assertEqual(servedChecked, SERVING_PAIRS.length * 2, 'all served UEs were checked');
});

check('(e) the cone ITEM colour still routes through the ONE serving-identity authority colorForServingBeam', () => {
  // The semantic render colour is applied at the MOUNT (resolveSinrLiveConeRenderColor,
  // asserted in check (b)); the resolver ITEM colour stays the serving-identity authority
  // — the per-cell DATA default that survives behind the override. Routing the resolver
  // through a SECOND colour authority would turn this RED.
  for (const p of SERVING_PAIRS) {
    const key = `${p.satId}:${p.cellId}`;
    const authority = colorForServingBeam(p.satId, p.cellId).markerColor;
    assertEqual(coneColorByKey.get(key)!, authority, `cone(${key}) item colour == colorForServingBeam`);
  }
});

check('(b) the SEMANTIC render colour resolves: hero serving YELLOW / non-hero dim context / candidate BLUE', () => {
  const heroItem = coneItems.find(c => c.satId === 'sat-A' && c.cellId === 0);
  assert(heroItem !== undefined, 'a hero cone item exists for the protagonist (sat-A, cell-0)');
  // the protagonist (isHero) → serving YELLOW, the role colour a viewer reads as "your link".
  assertEqual(
    resolveSinrLiveConeRenderColor(heroItem!, {
      isHero: true,
      heroColor: SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
      backgroundColor: SINR_LIVE_CONE_BACKGROUND_COLOR,
    }),
    SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
    'the protagonist serving cone renders the semantic serving YELLOW',
  );
  // a NON-hero served cone falls to the dim context colour (one colour, NOT a per-sat rainbow).
  const bgItem = coneItems.find(c => c.satId === 'sat-B');
  assert(bgItem !== undefined, 'a non-hero served cone item exists (sat-B)');
  assertEqual(
    resolveSinrLiveConeRenderColor(bgItem!, {
      heroColor: SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
      backgroundColor: SINR_LIVE_CONE_BACKGROUND_COLOR,
    }),
    SINR_LIVE_CONE_BACKGROUND_COLOR,
    'a non-hero served cone renders the dim semantic context colour',
  );
  // a candidate cone (the single-cone mount's coneColorOverride) → candidate BLUE.
  assertEqual(
    resolveSinrLiveConeRenderColor(bgItem!, { coneColorOverride: SINR_LIVE_CONE_CANDIDATE_COLOR }),
    SINR_LIVE_CONE_CANDIDATE_COLOR,
    'a candidate cone renders the candidate BLUE',
  );
  // the three semantic role colours are distinct (legible without a legend).
  assert(
    SINR_LIVE_CONE_SERVING_PRIMARY_COLOR !== SINR_LIVE_CONE_BACKGROUND_COLOR
      && SINR_LIVE_CONE_SERVING_PRIMARY_COLOR !== SINR_LIVE_CONE_CANDIDATE_COLOR
      && SINR_LIVE_CONE_BACKGROUND_COLOR !== SINR_LIVE_CONE_CANDIDATE_COLOR,
    'serving / context / candidate are three distinct role colours',
  );
});

check('(d) the UE mosaic partitions by SERVING SATELLITE (per-sat hue; intra-HO leaves a dot unchanged)', () => {
  // sat-A serves BOTH cell-0 and cell-1 (an intra family on the cones), but the two UEs'
  // DOTS are now ONE colour — the per-sat hue — so an intra HO does NOT recolour a dot.
  const aCell0 = ueColors.get('u-0-a')!.markerColor; // sat-A, cell-0
  const aCell1 = ueColors.get('u-1-a')!.markerColor; // sat-A, cell-1
  assertEqual(aCell0, aCell1, 'two UEs on the SAME sat (different cells) share ONE dot colour (intra-HO = no dot recolour)');
  assertEqual(aCell0, colorForServingSatellite('sat-A').markerColor, 'the dot colour is the per-satellite authority colorForServingSatellite');
  // a different serving sat = a different dot colour (an INTER handover repartitions).
  const bCell2 = ueColors.get('u-2-a')!.markerColor; // sat-B, cell-2
  assert(aCell0 !== bCell2, 'a different serving sat = a different dot colour (inter-HO repartitions the mosaic)');
});

check('cone ITEM data retains per-(sat,cell) identity (footprint-ring/telemetry colour; the RENDER is semantic)', () => {
  // The item colour is no longer the rendered cone hue (that is the semantic palette,
  // check (b)) but it still drives the footprint-ring hex bands + the cone userData, so
  // its per-cell granularity is pinned: a regression collapsing it would flatten those.
  const a0 = coneColorByKey.get('sat-A:0')!;
  const a1 = coneColorByKey.get('sat-A:1')!;
  const b2 = coneColorByKey.get('sat-B:2')!;
  assert(a0 !== a1, 'sat-A cell-0 vs cell-1 item colours are a shade family (different)');
  assert(a0 !== b2, 'sat-A vs sat-B item colours are different');
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

console.log(`\nsemantic beam-colour invariant: ${passed} checks passed.`);
