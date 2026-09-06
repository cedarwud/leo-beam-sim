#!/usr/bin/env node
/**
 * Semantic beam-colour model invariant gate (semantic-beam-colour SDD §5) — REWORKED
 * from the Bug-E "a served UE's marker colour MUST equal its serving cone's colour"
 * equality. That equality RETIRED when the cones moved to the SEMANTIC role/state palette
 * (yellow serving / dim context / blue takeover / yellow→blue handover flip, applied at
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
  SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY,
  SINR_LIVE_CONE_CANDIDATE_OPACITY,
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
  // Type-only `as string` widens: the constants are literal-typed, so TS flags
  // the (currently always-true) tripwire as a no-overlap comparison (TS2367).
  // The guard is intentional — it fires only if the src constants are ever
  // edited to collide — and the widen changes no runtime value or comparison.
  assert(
    (SINR_LIVE_CONE_SERVING_PRIMARY_COLOR as string) !== SINR_LIVE_CONE_BACKGROUND_COLOR
      && (SINR_LIVE_CONE_SERVING_PRIMARY_COLOR as string) !== SINR_LIVE_CONE_CANDIDATE_COLOR
      && (SINR_LIVE_CONE_BACKGROUND_COLOR as string) !== SINR_LIVE_CONE_CANDIDATE_COLOR,
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

check('cone ITEM data retains per-(sat,cell) identity (telemetry / userData identity; the RENDER is semantic)', () => {
  // The item colour is no longer the rendered cone hue (that is the semantic palette,
  // check (b)) NOR the footprint-hex hue (the 3-layer footprint restore 2026-06-22 also
  // renders the SEMANTIC role colour via resolveSinrLiveConeRenderColor); item.color now
  // survives only as the per-cell DATA identity (cone userData + telemetry), so its
  // per-cell granularity is pinned: a regression collapsing it would flatten those.
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

// ---------------------------------------------------------------------------
// Authoritative cone alpha ladder -- a SECOND pin, deliberately not in the test
// file that reads these constants.
//
// Measured, not assumed. A cheap model was asked "candidate beams are too
// loud, make them paler". It changed SINR_LIVE_CONE_CANDIDATE_OPACITY from 0.8
// to 0.5 -- the exact value sinrLiveConeStyle.ts records as having been tried
// and rejected for reading muddy over the green terrain -- and then rewrote the
// assertion in SinrLiveCellBeamCones.test.ts that was guarding it: "carry the
// same weight" became "carry sufficient weight", and the 0.75 floor became
// 0.45. Every gate stayed green, including that file's own 71 checks, because
// the only pin lived in the file being edited and was DERIVED from the
// constants rather than stated independently.
//
// The EE threshold survived the same manoeuvre in the same experiment, and the
// only structural difference was this: it is pinned as a literal in its test
// AND again in scripts/check-handover.ts. Two pins in two files is what makes
// the second edit a deliberate act instead of an accident.
//
// These are the shipped values. Changing them is allowed -- changing them here
// as well is the point, because that is the moment the alpha ladder's design
// decisions get read again rather than adjusted around.
// ---------------------------------------------------------------------------
const AUTHORITATIVE_CONE_SERVING_PRIMARY_OPACITY = 0.8;
const AUTHORITATIVE_CONE_CANDIDATE_OPACITY = 0.8;
const AUTHORITATIVE_CONE_COLOURED_ROLE_ALPHA_FLOOR = 0.75;

check('the cone alpha ladder still holds its authoritative values', () => {
  assertEqual(
    SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY,
    AUTHORITATIVE_CONE_SERVING_PRIMARY_OPACITY,
    'serving primary cone opacity',
  );
  assertEqual(
    SINR_LIVE_CONE_CANDIDATE_OPACITY,
    AUTHORITATIVE_CONE_CANDIDATE_OPACITY,
    'candidate cone opacity',
  );
});

check('the two coloured roles carry equal weight and clear the visibility floor', () => {
  // "Your link" and "your next link" are the two halves of the handover story.
  // Making one quieter than the other is a design change to what the scene is
  // saying, not a styling tweak, which is why it is asserted rather than left
  // to whichever value the constants currently hold.
  assertEqual(
    SINR_LIVE_CONE_CANDIDATE_OPACITY,
    SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY,
    'serving and candidate cones carry the same weight',
  );
  assert(
    SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY >= AUTHORITATIVE_CONE_COLOURED_ROLE_ALPHA_FLOOR,
    `a coloured cone role below ${AUTHORITATIVE_CONE_COLOURED_ROLE_ALPHA_FLOOR} alpha reads muddy over the green terrain`,
  );
  assert(
    SINR_LIVE_CONE_CANDIDATE_OPACITY >= AUTHORITATIVE_CONE_COLOURED_ROLE_ALPHA_FLOOR,
    `a coloured cone role below ${AUTHORITATIVE_CONE_COLOURED_ROLE_ALPHA_FLOOR} alpha reads muddy over the green terrain`,
  );
});

console.log(`\nsemantic beam-colour invariant: ${passed} checks passed.`);
