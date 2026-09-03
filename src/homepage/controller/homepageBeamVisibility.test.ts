import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterHomepageBeamItems,
  homepageBeamIdentityKey,
  resolveHomepageBeamVisibility,
} from './homepageBeamVisibility';

test('homepage beam visibility keeps only exact serving and prepared beam pairs', () => {
  const allowed = resolveHomepageBeamVisibility({
    servingBeam: { satelliteId: 'serving', cellId: 0 },
    preparedCandidateBeam: { satelliteId: 'candidate', cellId: 1 },
    presentationFromBeam: { satelliteId: 'serving', cellId: 0 },
    presentationToBeam: { satelliteId: 'candidate', cellId: 1 },
  });
  assert.deepEqual([...allowed], [
    homepageBeamIdentityKey({ satelliteId: 'serving', cellId: 0 }),
    homepageBeamIdentityKey({ satelliteId: 'candidate', cellId: 1 }),
  ]);

  const visible = filterHomepageBeamItems([
    { satId: 'background-a', cellId: 0, value: 1 },
    { satId: 'serving', cellId: 0, value: 2 },
    { satId: 'serving', cellId: 2, value: 3 },
    { satId: 'candidate', cellId: 1, value: 4 },
    { satId: 'candidate', cellId: 3, value: 5 },
  ], allowed);
  assert.deepEqual(visible, [
    { satId: 'serving', cellId: 0, value: 2 },
    { satId: 'candidate', cellId: 1, value: 4 },
  ]);
  assert.equal(Object.isFrozen(visible), true);
});

test('homepage beam visibility distinguishes same-cell beams when exact beam IDs are supplied', () => {
  const from = { satelliteId: 'same-satellite', cellId: 4, beamId: 101 };
  const to = { satelliteId: 'same-satellite', cellId: 4, beamId: 202 };
  const visibleBeams = [
    { satId: 'same-satellite', cellId: 4, beamId: 101, value: 'from' },
    { satId: 'same-satellite', cellId: 4, beamId: 202, value: 'to' },
    { satId: 'same-satellite', cellId: 4, beamId: 303, value: 'unrelated' },
    { satId: 'same-satellite', cellId: 4, value: 'cell-only' },
  ];

  const exactAllowed = resolveHomepageBeamVisibility({
    presentationFromBeam: from,
    presentationToBeam: to,
  });
  assert.deepEqual([...exactAllowed], [
    homepageBeamIdentityKey(from),
    homepageBeamIdentityKey(to),
  ]);
  assert.deepEqual(filterHomepageBeamItems(visibleBeams, exactAllowed), visibleBeams.slice(0, 2));
  assert.deepEqual(
    filterHomepageBeamItems(
      visibleBeams,
      resolveHomepageBeamVisibility({ presentationFromBeam: from }),
    ),
    [visibleBeams[0]],
  );
});

test('homepage beam visibility retains cell-only identities for legacy callers', () => {
  const legacyIdentity = { satelliteId: 'legacy-satellite', cellId: 2 };
  const allowed = resolveHomepageBeamVisibility({ servingBeam: legacyIdentity });

  assert.equal(homepageBeamIdentityKey(legacyIdentity), 'legacy-satellite|2');
  assert.deepEqual(
    filterHomepageBeamItems([
      { satId: 'legacy-satellite', cellId: 2 },
      { satId: 'other-satellite', cellId: 2 },
    ], allowed),
    [{ satId: 'legacy-satellite', cellId: 2 }],
  );
});

test('homepage beam visibility fails closed without a resolved beam identity', () => {
  const allowed = resolveHomepageBeamVisibility({});
  assert.equal(allowed.size, 0);
  assert.deepEqual(
    filterHomepageBeamItems([{ satId: 'background', cellId: 0, value: 1 }], allowed),
    [],
  );
});

test('homepage may keep the serving satellite fan but never an entire candidate fan', () => {
  const allowed = resolveHomepageBeamVisibility({
    servingBeam: { satelliteId: 'serving', cellId: 0 },
    preparedCandidateBeam: { satelliteId: 'candidate', cellId: 1 },
  });
  assert.deepEqual(
    filterHomepageBeamItems([
      { satId: 'serving', cellId: 0 },
      { satId: 'serving', cellId: 6 },
      { satId: 'candidate', cellId: 1 },
      { satId: 'candidate', cellId: 6 },
      { satId: 'background', cellId: 0 },
    ], allowed, new Set(['serving'])),
    [
      { satId: 'serving', cellId: 0 },
      { satId: 'serving', cellId: 6 },
      { satId: 'candidate', cellId: 1 },
    ],
  );
});
