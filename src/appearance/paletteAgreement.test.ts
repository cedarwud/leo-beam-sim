/**
 * Characterization test: BEFORE photograph of satellite palette allocation agreement.
 *
 * Three independent palette allocators decide what colour a SATELLITE is:
 *   - Allocator A: Deterministic serving identity (`servingIdentityPaletteIndex`,
 *     `colorForServingSatellite` from `src/constants/servingColour.ts`). Pure function
 *     of satellite ID alone; stable and display-order independent.
 *   - Allocator B: Episode-scoped handover visual identity allocator
 *     (`allocateHandoverVisualIdentities` from `src/constants/handoverVisualIdentity.ts`).
 *     Allocates slots sequentially using preferred hash starts and contrast-aware distance,
 *     making it dependent on the co-resident satellite working set.
 *   - Allocator C: Homepage satellite visual identity projection
 *     (`homepageSatellitePaletteIndex`, `homepageSatelliteBaseColor` from
 *     `src/homepage/controller/homepageSatelliteVisualIdentity.ts`).
 *     A 6-family projection that behaves differently when called with ID alone versus
 *     when supplied with an identity palette index from Allocator B.
 *
 * Decision: Allocator A becomes canonical, and B and C will converge onto it.
 * This test records the exact pre-convergence state with hardcoded literal hex strings
 * and numbers — no dynamic re-derivation.
 *
 * Pure: no React, no DOM, no canvas. Uses node:test and node:assert/strict.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  colorForServingSatellite,
  servingIdentityPaletteIndex,
} from '../constants/servingColour';
import { allocateHandoverVisualIdentities } from '../constants/handoverVisualIdentity';
import {
  homepageSatelliteBaseColor,
  homepageSatellitePaletteIndex,
} from '../homepage/controller/homepageSatelliteVisualIdentity';

/** The canonical 6-satellite characterization grid. */
const GRID = [
  'shell-a-P0-S0',
  'shell-a-P0-S1',
  'shell-a-P1-S0',
  'shell-b-P0-S0',
  'sat-42',
  'sat-7',
] as const;

test('Allocator A (servingColour): deterministic palette index and markerColor literals for grid', () => {
  // shell-a-P0-S0
  assert.equal(servingIdentityPaletteIndex('shell-a-P0-S0'), 12);
  assert.equal(colorForServingSatellite('shell-a-P0-S0').markerColor, '#96ceee');

  // shell-a-P0-S1
  assert.equal(servingIdentityPaletteIndex('shell-a-P0-S1'), 0);
  assert.equal(colorForServingSatellite('shell-a-P0-S1').markerColor, '#e2c550');

  // shell-a-P1-S0
  assert.equal(servingIdentityPaletteIndex('shell-a-P1-S0'), 10);
  assert.equal(colorForServingSatellite('shell-a-P1-S0').markerColor, '#aaa7f1');

  // shell-b-P0-S0
  assert.equal(servingIdentityPaletteIndex('shell-b-P0-S0'), 3);
  assert.equal(colorForServingSatellite('shell-b-P0-S0').markerColor, '#bf9fef');

  // sat-42
  assert.equal(servingIdentityPaletteIndex('sat-42'), 1);
  assert.equal(colorForServingSatellite('sat-42').markerColor, '#96b9ee');

  // sat-7
  assert.equal(servingIdentityPaletteIndex('sat-7'), 0);
  assert.equal(colorForServingSatellite('sat-7').markerColor, '#e2c550');
});

test('Allocator B (handoverVisualIdentity): co-resident grid allocation palette index and color literals', () => {
  const allocation = allocateHandoverVisualIdentities({
    episodeId: 'palette-agreement-grid-characterization',
    satelliteIds: GRID,
  });

  // When all 6 satellites are co-resident, Allocator B allocates in sorted lexical order:
  // sat-42 -> sat-7 -> shell-a-P0-S0 -> shell-a-P0-S1 -> shell-a-P1-S0 -> shell-b-P0-S0.

  const sat0 = allocation.identitiesBySatelliteId['shell-a-P0-S0'];
  assert.equal(sat0.paletteIndex, 14);
  assert.equal(sat0.color, '#dcb0f2');
  assert.equal(sat0.cssColor, '#dcb0f2');

  const sat1 = allocation.identitiesBySatelliteId['shell-a-P0-S1'];
  assert.equal(sat1.paletteIndex, 13);
  assert.equal(sat1.color, '#afef9f');
  assert.equal(sat1.cssColor, '#afef9f');

  const sat2 = allocation.identitiesBySatelliteId['shell-a-P1-S0'];
  assert.equal(sat2.paletteIndex, 1);
  assert.equal(sat2.color, '#96b9ee');
  assert.equal(sat2.cssColor, '#96b9ee');

  const sat3 = allocation.identitiesBySatelliteId['shell-b-P0-S0'];
  assert.equal(sat3.paletteIndex, 2);
  assert.equal(sat3.color, '#abde35');
  assert.equal(sat3.cssColor, '#abde35');

  const sat42 = allocation.identitiesBySatelliteId['sat-42'];
  assert.equal(sat42.paletteIndex, 4);
  assert.equal(sat42.color, '#50e2c5');
  assert.equal(sat42.cssColor, '#50e2c5');

  const sat7 = allocation.identitiesBySatelliteId['sat-7'];
  assert.equal(sat7.paletteIndex, 11);
  assert.equal(sat7.color, '#e4a358');
  assert.equal(sat7.cssColor, '#e4a358');
});

/**
 * Allocator C used to answer DIFFERENTLY for the same satellite depending on
 * whether the caller passed an optional `identityPaletteIndex`. That is now
 * fixed: the homepage slot derives from `servingIdentityPaletteIndex` alone.
 *
 * This test was originally a photograph of the split — it listed both answers
 * per satellite. It is now an INVARIANT instead: a colour that changes with the
 * caller is the defect, so the right assertion is that it cannot.
 */
test('Allocator C: the homepage slot is caller-independent (the split is closed)', () => {
  const allocationB = allocateHandoverVisualIdentities({
    episodeId: 'palette-agreement-grid-characterization',
    satelliteIds: GRID,
  });

  // Literals recorded from the running code, per satellite: slot then base colour.
  const EXPECTED_HOMEPAGE: ReadonlyArray<readonly [string, number, string]> = [
    ['shell-a-P0-S0', 1, '#476de1'],
    ['shell-a-P0-S1', 2, '#54e147'],
    ['shell-a-P1-S0', 5, '#e18747'],
    ['shell-b-P0-S0', 5, '#e18747'],
    ['sat-42', 5, '#e18747'],
    ['sat-7', 2, '#54e147'],
  ];

  for (const [satId, slot, color] of EXPECTED_HOMEPAGE) {
    assert.equal(homepageSatellitePaletteIndex(satId), slot, `${satId} slot`);
    assert.equal(homepageSatelliteBaseColor(satId), color, `${satId} base colour`);

    // The same question asked WITH allocator B's index must give the same answer.
    // Before the fix these diverged — e.g. shell-a-P0-S1 was #54e147 asked one
    // way and #47c7e1 asked the other.
    const bIndex = allocationB.identitiesBySatelliteId[satId]!.paletteIndex;
    assert.equal(
      homepageSatellitePaletteIndex(satId, bIndex), slot,
      `${satId}: the slot must not depend on whether the caller supplies an index`,
    );
    assert.equal(
      homepageSatelliteBaseColor(satId, bIndex), color,
      `${satId}: the base colour must not depend on whether the caller supplies an index`,
    );
  }
});

/**
 * The cost of making the homepage slot canonical, stated rather than hidden.
 *
 * The homepage palette is a COMPACT family table — far smaller than the 16-slot
 * identity palette — so deriving it purely from the satellite id means distinct
 * satellites can land on the same family. Three of the six grid ids currently do.
 *
 * This is the contrast trade-off that was accepted when the split was closed:
 * hue alone no longer separates every satellite on the homepage, and glyph,
 * label, EE lightness and opacity have to carry that load. Asserted here so the
 * collision count cannot grow silently.
 */
test('the canonical homepage slot collides for distinct satellites, by a known amount', () => {
  const colors = ['shell-a-P0-S0', 'shell-a-P0-S1', 'shell-a-P1-S0', 'shell-b-P0-S0', 'sat-42', 'sat-7']
    .map(satId => homepageSatelliteBaseColor(satId));
  const distinct = new Set(colors);
  assert.equal(colors.length, 6, 'six satellites were sampled');
  assert.equal(distinct.size, 3, `six satellites share ${distinct.size} homepage families (collisions are expected; a DROP here means contrast got worse)`);
});

test('BEFORE convergence: allocator A and allocator B disagree (this test is meant to fail once they are unified)', () => {
  const allocationB = allocateHandoverVisualIdentities({
    episodeId: 'palette-agreement-disagreement-check',
    satelliteIds: GRID,
  });

  // Explicit disagreement checks for each satellite in the grid under today's implementation.
  // When Allocator B is unified onto Allocator A, these assertions WILL FAIL,
  // signalling that convergence has landed.
  for (const satId of GRID) {
    const colorA = colorForServingSatellite(satId).markerColor;
    const colorB = allocationB.identitiesBySatelliteId[satId].color;
    assert.notEqual(
      colorA,
      colorB,
      `Expected allocator A (${colorA}) and allocator B (${colorB}) to disagree for ${satId} before convergence`,
    );
  }

  // Literal before-convergence hex pairs:
  // shell-a-P0-S0: A=#96ceee !== B=#dcb0f2
  assert.notEqual('#96ceee', '#dcb0f2');
  // shell-a-P0-S1: A=#e2c550 !== B=#afef9f
  assert.notEqual('#e2c550', '#afef9f');
  // shell-a-P1-S0: A=#aaa7f1 !== B=#96b9ee
  assert.notEqual('#aaa7f1', '#96b9ee');
  // shell-b-P0-S0: A=#bf9fef !== B=#abde35
  assert.notEqual('#bf9fef', '#abde35');
  // sat-42:        A=#96b9ee !== B=#50e2c5
  assert.notEqual('#96b9ee', '#50e2c5');
  // sat-7:         A=#e2c550 !== B=#e4a358
  assert.notEqual('#e2c550', '#e4a358');
});

test('Allocator B exhibits co-resident set / working set dependence across different co-resident sets', () => {
  // Allocator B's output for the SAME satellite changes depending on who else is on screen.
  //
  // For satellite 'shell-a-P0-S0':
  // 1. When co-resident with the full 6-satellite grid, other IDs claim slots first,
  //    and contrast-aware probing forces shell-a-P0-S0 into slot 14 (#dcb0f2).
  const fullAllocation = allocateHandoverVisualIdentities({
    episodeId: 'co-resident-full',
    satelliteIds: GRID,
  });
  const colorInFullGrid = fullAllocation.identitiesBySatelliteId['shell-a-P0-S0'].color;
  assert.equal(colorInFullGrid, '#dcb0f2');

  // 2. When co-resident with only ['shell-a-P0-S0', 'shell-a-P0-S1'], shell-a-P0-S0 sorts first,
  //    has no collisions, and receives its preferred slot 12 (#96ceee).
  const pairAllocation1 = allocateHandoverVisualIdentities({
    episodeId: 'co-resident-pair-1',
    satelliteIds: ['shell-a-P0-S0', 'shell-a-P0-S1'],
  });
  const colorInPair1 = pairAllocation1.identitiesBySatelliteId['shell-a-P0-S0'].color;
  assert.equal(colorInPair1, '#96ceee');

  // 3. When co-resident with ['shell-a-P0-S0', 'sat-42'], 'sat-42' sorts first lexically,
  //    claims slot 4, and contrast-aware distance steers shell-a-P0-S0 into slot 11 (#e4a358).
  const pairAllocation2 = allocateHandoverVisualIdentities({
    episodeId: 'co-resident-pair-2',
    satelliteIds: ['shell-a-P0-S0', 'sat-42'],
  });
  const colorInPair2 = pairAllocation2.identitiesBySatelliteId['shell-a-P0-S0'].color;
  assert.equal(colorInPair2, '#e4a358');

  // Concrete proof of co-resident dependence:
  // The exact same satellite 'shell-a-P0-S0' gets THREE different colours (#dcb0f2, #96ceee, #e4a358)
  // solely because the other satellites on screen changed.
  assert.notEqual(colorInFullGrid, colorInPair1, 'colour of shell-a-P0-S0 must differ between full grid and pair 1');
  assert.notEqual(colorInFullGrid, colorInPair2, 'colour of shell-a-P0-S0 must differ between full grid and pair 2');
  assert.notEqual(colorInPair1, colorInPair2, 'colour of shell-a-P0-S0 must differ between pair 1 and pair 2');
});

/**
 * The measured 4-satellite episode from the problem statement.
 *
 * The C column moved when the homepage slot became caller-independent: it is
 * now the SAME answer whether or not allocator B's index is passed in, so the
 * `paletteIndex` argument below is inert and kept only to show that passing it
 * no longer changes anything. A and B still disagree — that convergence was
 * deliberately NOT attempted, because collapsing B removes its co-resident
 * contrast spreading.
 */
test('Characterization of the measured 4-satellite handover episode from SDD / problem statement', () => {
  // In the measured handover scenario where shell-a-P0-S0 is designated as servingSatelliteId:
  const handoverAllocation = allocateHandoverVisualIdentities({
    episodeId: 'measured-handover-episode',
    servingSatelliteId: 'shell-a-P0-S0',
    satelliteIds: ['shell-a-P0-S0', 'shell-a-P0-S1', 'shell-a-P1-S0', 'sat-42'],
  });

  // shell-a-P0-S0: A=#96ceee, B=#96ceee, C=#476de1
  const sat0 = handoverAllocation.identitiesBySatelliteId['shell-a-P0-S0'];
  assert.equal(colorForServingSatellite('shell-a-P0-S0').markerColor, '#96ceee');
  assert.equal(sat0.color, '#96ceee');
  assert.equal(sat0.paletteIndex, 12);
  assert.equal(homepageSatelliteBaseColor('shell-a-P0-S0', sat0.paletteIndex), '#476de1');

  // shell-a-P0-S1: A=#e2c550, B=#f1a7f1, C=#54e147  (was #47c7e1 while C followed B)
  const sat1 = handoverAllocation.identitiesBySatelliteId['shell-a-P0-S1'];
  assert.equal(colorForServingSatellite('shell-a-P0-S1').markerColor, '#e2c550');
  assert.equal(sat1.color, '#f1a7f1');
  assert.equal(sat1.paletteIndex, 7);
  assert.equal(homepageSatelliteBaseColor('shell-a-P0-S1', sat1.paletteIndex), '#54e147');

  // shell-a-P1-S0: A=#aaa7f1, B=#afef9f, C=#e18747  (was #47e1a1 while C followed B)
  const sat2 = handoverAllocation.identitiesBySatelliteId['shell-a-P1-S0'];
  assert.equal(colorForServingSatellite('shell-a-P1-S0').markerColor, '#aaa7f1');
  assert.equal(sat2.color, '#afef9f');
  assert.equal(sat2.paletteIndex, 13);
  assert.equal(homepageSatelliteBaseColor('shell-a-P1-S0', sat2.paletteIndex), '#e18747');

  // sat-42: A=#96b9ee, B=#e4a358, C=#e18747  (was #476de1 while C followed B)
  const sat42 = handoverAllocation.identitiesBySatelliteId['sat-42'];
  assert.equal(colorForServingSatellite('sat-42').markerColor, '#96b9ee');
  assert.equal(sat42.color, '#e4a358');
  assert.equal(sat42.paletteIndex, 11);
  assert.equal(homepageSatelliteBaseColor('sat-42', sat42.paletteIndex), '#e18747');
});
