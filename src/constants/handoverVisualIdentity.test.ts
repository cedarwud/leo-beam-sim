import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_HANDOVER_VISUAL_IDENTITY_NORMAL_DISPLAY_BUDGET,
  DEFAULT_HANDOVER_VISUAL_IDENTITY_PALETTE,
  allocateHandoverVisualIdentities,
  handoverVisualPaletteStartIndex,
  resolveHandoverBeamVisualIdentity,
} from './handoverVisualIdentity';

function identity(
  allocation: ReturnType<typeof allocateHandoverVisualIdentities>,
  satelliteId: string,
) {
  const value = allocation.identitiesBySatelliteId[satelliteId];
  assert.ok(value, `missing visual identity for ${satelliteId}`);
  return value;
}

function findCollision(paletteSize: number): readonly [string, string] {
  const seen = new Map<number, string>();
  for (let index = 0; index < 200; index += 1) {
    const satelliteId = `collision-satellite-${index}`;
    const start = handoverVisualPaletteStartIndex(satelliteId, paletteSize);
    const previous = seen.get(start);
    if (previous !== undefined) return [previous, satelliteId];
    seen.set(start, satelliteId);
  }
  throw new Error(`could not find a palette collision for size ${paletteSize}`);
}

test('resolves palette collisions with stable hash starts and linear probing', () => {
  const palette = DEFAULT_HANDOVER_VISUAL_IDENTITY_PALETTE.slice(0, 4);
  const [servingSatelliteId, collidingSatelliteId] = findCollision(palette.length);
  const allocation = allocateHandoverVisualIdentities({
    episodeId: 'collision-episode',
    servingSatelliteId,
    satelliteIds: [collidingSatelliteId, servingSatelliteId],
    palette,
  });

  const serving = identity(allocation, servingSatelliteId);
  const colliding = identity(allocation, collidingSatelliteId);
  const preferred = handoverVisualPaletteStartIndex(servingSatelliteId, palette.length);
  assert.equal(serving.paletteIndex, preferred);
  assert.equal(
    colliding.paletteIndex,
    (handoverVisualPaletteStartIndex(collidingSatelliteId, palette.length) + 1) % palette.length,
  );
  assert.notEqual(serving.cssColor, colliding.cssColor);
  assert.equal(new Set(allocation.identities.map(value => value.paletteIndex)).size, 2);
});

test('serving-first and lexicographic ordering make allocation input-order independent', () => {
  const first = allocateHandoverVisualIdentities({
    episodeId: 'ordering-episode',
    servingSatelliteId: 'sat-serving',
    satelliteIds: ['sat-zulu', 'sat-alpha', 'sat-serving', 'sat-mike'],
  });
  const shuffled = allocateHandoverVisualIdentities({
    episodeId: 'ordering-episode',
    servingSatelliteId: 'sat-serving',
    satelliteIds: ['sat-mike', 'sat-serving', 'sat-zulu', 'sat-alpha'],
  });

  assert.deepEqual(first.orderedSatelliteIds, [
    'sat-serving',
    'sat-alpha',
    'sat-mike',
    'sat-zulu',
  ]);
  assert.deepEqual(shuffled.orderedSatelliteIds, first.orderedSatelliteIds);
  for (const satelliteId of first.orderedSatelliteIds) {
    const value = identity(first, satelliteId);
    assert.deepEqual(
      identity(shuffled, satelliteId),
      value,
      `${satelliteId} changed when the input order changed`,
    );
    assert.equal(value.cssColor, value.threeColor);
    assert.equal(value.accessibility.colorIsNotSoleCue, true);
    assert.equal('role' in value, false);
    assert.equal(value.contrastStatus, 'pass');
    assert.ok(value.contrastRatioAgainstDarkBackground !== null);
    assert.ok(value.contrastRatioAgainstDarkBackground >= 3);
  }
  assert.ok(
    DEFAULT_HANDOVER_VISUAL_IDENTITY_PALETTE.length
      > DEFAULT_HANDOVER_VISUAL_IDENTITY_NORMAL_DISPLAY_BUDGET,
  );
});

test('preserves identity assignments through rank changes, commit, and overflow pinning', () => {
  const palette = DEFAULT_HANDOVER_VISUAL_IDENTITY_PALETTE.slice(0, 3);
  const initial = allocateHandoverVisualIdentities({
    episodeId: 'episode-1',
    servingSatelliteId: 'sat-a',
    satelliteIds: ['sat-a', 'sat-b', 'sat-c'],
    palette,
    normalDisplayBudget: 3,
  });
  const initialAssignments = Object.fromEntries(initial.identities.map(value => [
    value.satelliteId,
    {
      cssColor: value.cssColor,
      paletteIndex: value.paletteIndex,
      glyph: value.glyph,
      pattern: value.pattern,
    },
  ]));

  const afterRankChange = allocateHandoverVisualIdentities({
    episodeId: 'episode-1',
    servingSatelliteId: 'sat-a',
    satelliteIds: ['sat-c', 'sat-a', 'sat-b'],
    palette,
    normalDisplayBudget: 3,
    previousAllocation: initial,
  });
  const afterCommit = allocateHandoverVisualIdentities({
    episodeId: 'episode-1',
    servingSatelliteId: 'sat-b',
    satelliteIds: ['sat-b', 'sat-a', 'sat-c'],
    palette,
    normalDisplayBudget: 3,
    previousAllocation: afterRankChange,
  });
  const afterPin = allocateHandoverVisualIdentities({
    episodeId: 'episode-1',
    servingSatelliteId: 'sat-b',
    satelliteIds: ['sat-pinned-overflow', 'sat-c', 'sat-b', 'sat-a'],
    palette,
    normalDisplayBudget: 3,
    previousAllocation: afterCommit,
  });

  for (const satelliteId of ['sat-a', 'sat-b', 'sat-c']) {
    assert.deepEqual(
      {
        cssColor: identity(afterRankChange, satelliteId).cssColor,
        paletteIndex: identity(afterRankChange, satelliteId).paletteIndex,
        glyph: identity(afterRankChange, satelliteId).glyph,
        pattern: identity(afterRankChange, satelliteId).pattern,
      },
      initialAssignments[satelliteId],
      `${satelliteId} changed after a rank update`,
    );
    assert.deepEqual(
      {
        cssColor: identity(afterCommit, satelliteId).cssColor,
        paletteIndex: identity(afterCommit, satelliteId).paletteIndex,
        glyph: identity(afterCommit, satelliteId).glyph,
        pattern: identity(afterCommit, satelliteId).pattern,
      },
      initialAssignments[satelliteId],
      `${satelliteId} changed after commit`,
    );
    assert.deepEqual(
      {
        cssColor: identity(afterPin, satelliteId).cssColor,
        paletteIndex: identity(afterPin, satelliteId).paletteIndex,
        glyph: identity(afterPin, satelliteId).glyph,
        pattern: identity(afterPin, satelliteId).pattern,
      },
      initialAssignments[satelliteId],
      `${satelliteId} changed when an overflow row was pinned`,
    );
  }

  const pinned = identity(afterPin, 'sat-pinned-overflow');
  assert.equal(pinned.isOverflow, true);
  assert.equal(pinned.paletteIndex, null);
  assert.equal(pinned.fallback?.kind, 'palette-exhausted');
  assert.equal(pinned.fallback?.colorIsNotUnique, true);
  assert.ok(pinned.glyph);
  assert.ok(pinned.pattern);
});

test('same-satellite beam shades are deterministic, distinct, and stay in one hue family', () => {
  const allocation = allocateHandoverVisualIdentities({
    episodeId: 'beam-episode',
    servingSatelliteId: 'sat-shades',
    satelliteIds: ['sat-shades'],
    beamIdsBySatellite: { 'sat-shades': [1, 9, 2] },
  });
  const beamOne = resolveHandoverBeamVisualIdentity(allocation, 'sat-shades', 1);
  const beamTwo = resolveHandoverBeamVisualIdentity(allocation, 'sat-shades', 9);
  const beamOneAgain = resolveHandoverBeamVisualIdentity(allocation, 'sat-shades', 1);

  assert.ok(beamOne);
  assert.ok(beamTwo);
  assert.ok(beamOneAgain);
  assert.notEqual(beamOne.cssColor, beamTwo.cssColor);
  assert.equal(beamOne.cssColor, beamOne.threeColor);
  assert.equal(beamOne.cssColor, beamOneAgain.cssColor);
  assert.equal(beamOne.hueDegrees, beamTwo.hueDegrees);
  assert.notEqual(beamOne.shadeIndex, beamTwo.shadeIndex);
  assert.ok(beamOne.contrastRatioAgainstDarkBackground !== null);
  assert.ok(beamOne.contrastRatioAgainstDarkBackground >= 3);
  assert.equal(beamOne.accessibility.colorIsNotSoleCue, true);
  assert.equal('role' in beamOne, false);
});

test('blue-purple rail keeps the configured B2 to B7 switch visibly separated', () => {
  const allocation = allocateHandoverVisualIdentities({
    episodeId: 'blue-purple-contrast-episode',
    servingSatelliteId: 'shell-pro-53-P13-S6',
    satelliteIds: ['shell-pro-53-P13-S6'],
    beamIdsBySatellite: { 'shell-pro-53-P13-S6': [1, 2, 3, 4, 5, 6, 7] },
  });
  const beamTwo = resolveHandoverBeamVisualIdentity(allocation, 'shell-pro-53-P13-S6', 2);
  const beamSeven = resolveHandoverBeamVisualIdentity(allocation, 'shell-pro-53-P13-S6', 7);
  assert.ok(beamTwo);
  assert.ok(beamSeven);
  assert.notEqual(beamTwo.cssColor, beamSeven.cssColor);
  const brightness = (color: string) => color.slice(1).match(/../g)!
    .map(value => Number.parseInt(value, 16))
    .reduce((sum, channel) => sum + channel, 0);
  assert.ok(
    brightness(beamSeven.cssColor) - brightness(beamTwo.cssColor) >= 100,
    `B2 → B7 must have a visible tonal separation: ${beamTwo.cssColor} → ${beamSeven.cssColor}`,
  );
  for (const beam of [beamTwo, beamSeven]) {
    assert.ok(
      Math.max(...beam.cssColor.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16))) >= 190,
      `${beam.cssColor} is too dark for the blue/purple rail`,
    );
  }
});

test('more than eight episode beams reuse shades explicitly instead of truncating scientific identity', () => {
  const beamIds = Array.from({ length: 10 }, (_, index) => index + 1);
  const allocation = allocateHandoverVisualIdentities({
    episodeId: 'beam-overflow-episode',
    servingSatelliteId: 'sat-many-beams',
    satelliteIds: ['sat-many-beams'],
    beamIdsBySatellite: { 'sat-many-beams': beamIds },
  });
  const identities = Object.values(allocation.beamIdentitiesBySatelliteId['sat-many-beams'] ?? {});

  assert.equal(identities.length, 10);
  assert.ok(identities.every(value => value.colorMayRepeat));
  assert.ok(identities.every(value => /color or shade may repeat/i.test(value.ariaLabel)));
  assert.ok(new Set(identities.map(value => value.shadeIndex)).size <= 8);
  assert.ok(new Set(identities.map(value => value.cssColor)).size < identities.length);

  const extended = allocateHandoverVisualIdentities({
    episodeId: 'beam-overflow-episode',
    servingSatelliteId: 'sat-many-beams',
    satelliteIds: ['sat-many-beams'],
    beamIdsBySatellite: { 'sat-many-beams': [...beamIds, 11] },
    previousAllocation: allocation,
  });
  for (const beamId of beamIds) {
    assert.equal(
      resolveHandoverBeamVisualIdentity(extended, 'sat-many-beams', beamId)?.cssColor,
      resolveHandoverBeamVisualIdentity(allocation, 'sat-many-beams', beamId)?.cssColor,
    );
  }
});

test('palette exhaustion remains explicit and accessible instead of silently reusing a colour', () => {
  const allocation = allocateHandoverVisualIdentities({
    episodeId: 'overflow-episode',
    servingSatelliteId: 'sat-1',
    satelliteIds: ['sat-1', 'sat-2', 'sat-3', 'sat-4'],
    palette: DEFAULT_HANDOVER_VISUAL_IDENTITY_PALETTE.slice(0, 2),
    normalDisplayBudget: 2,
  });
  const overflow = identity(allocation, 'sat-4');

  assert.equal(overflow.isOverflow, true);
  assert.equal(overflow.paletteIndex, null);
  assert.equal(overflow.cssColor, overflow.threeColor);
  assert.equal(overflow.fallback?.kind, 'palette-exhausted');
  assert.equal(overflow.fallback?.colorIsNotUnique, true);
  assert.match(overflow.ariaLabel, /glyph|pattern|satellite ID/i);
  assert.equal(overflow.accessibility.colorIsNotSoleCue, true);
  assert.ok(overflow.contrastRatioAgainstDarkBackground !== null);
  assert.ok(overflow.contrastRatioAgainstDarkBackground >= 3);
});

test('fails closed for invalid custom palettes and negative beam IDs', () => {
  assert.throws(() => allocateHandoverVisualIdentities({
    episodeId: 'invalid-hue',
    satelliteIds: ['sat-a'],
    palette: [{ cssColor: '#ffffff', hueDegrees: Number.NaN }],
  }), /hueDegrees must be finite/);
  assert.throws(() => allocateHandoverVisualIdentities({
    episodeId: 'invalid-token',
    satelliteIds: ['sat-a'],
    palette: ['rgb(255, 255, 255)'],
  }), /#RGB or #RRGGBB/);
  assert.throws(() => allocateHandoverVisualIdentities({
    episodeId: 'invalid-contrast',
    satelliteIds: ['sat-a'],
    palette: ['#000000'],
  }), /3:1 dark-surface contrast/);
  const allocation = allocateHandoverVisualIdentities({
    episodeId: 'beam-validation',
    satelliteIds: ['sat-a'],
    beamIdsBySatellite: { 'sat-a': [1] },
  });
  assert.throws(
    () => resolveHandoverBeamVisualIdentity(allocation, 'sat-a', -1),
    /non-negative finite integer/,
  );
});

test('a new episode resets prior palette and beam reservations', () => {
  const previous = allocateHandoverVisualIdentities({
    episodeId: 'episode-old',
    servingSatelliteId: 'sat-old',
    satelliteIds: ['sat-old'],
    beamIdsBySatellite: { 'sat-old': [1, 9] },
  });
  const next = allocateHandoverVisualIdentities({
    episodeId: 'episode-new',
    servingSatelliteId: 'sat-new',
    satelliteIds: ['sat-new'],
    beamIdsBySatellite: { 'sat-new': [1] },
    previousAllocation: previous,
  });
  assert.equal(next.episodeId, 'episode-new');
  assert.deepEqual(next.reservedSatelliteIds, []);
  assert.deepEqual(Object.keys(next.assignments), ['sat-new']);
  assert.equal(next.beamAssignmentsBySatelliteId['sat-old'], undefined);
});
