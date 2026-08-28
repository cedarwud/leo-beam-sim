import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCandidatePresentationIdentityStore,
  type CandidatePresentationIdentityLease,
} from './candidatePresentationIdentityStore';

function lease(
  simTimeMs: number,
  satelliteIds: readonly string[],
  servingSatelliteId = 'sat-a',
): CandidatePresentationIdentityLease {
  return {
    episodeId: 'shared-colour-episode',
    simTimeMs,
    servingSatelliteId,
    satelliteIds,
    beamIdsBySatellite: Object.fromEntries(
      satelliteIds.map((satelliteId, index) => [satelliteId, [index + 1]]),
    ),
    normalDisplayBudget: 3,
  };
}

test('high-cadence scene and throttled rail share stable collision-free satellite identities', () => {
  const store = createCandidatePresentationIdentityStore();

  const sceneAtZero = store.resolve('scene', lease(0, ['sat-a', 'sat-b', 'sat-c']));
  const satAAtZero = sceneAtZero.identitiesBySatelliteId['sat-a'];
  const satBAtZero = sceneAtZero.identitiesBySatelliteId['sat-b'];
  assert.ok(satAAtZero);
  assert.ok(satBAtZero);

  const railAtZero = store.resolve('rail', lease(0, ['sat-a', 'sat-b', 'sat-d']));
  assert.equal(railAtZero.identitiesBySatelliteId['sat-a']?.cssColor, satAAtZero.cssColor);
  assert.equal(railAtZero.identitiesBySatelliteId['sat-b']?.cssColor, satBAtZero.cssColor);

  // The scene advances through candidates the throttled rail has not published.
  const sceneAtHalfSecond = store.resolve('scene', lease(500, ['sat-a', 'sat-e', 'sat-f']));
  const satEFromScene = sceneAtHalfSecond.identitiesBySatelliteId['sat-e'];
  assert.ok(satEFromScene);
  assert.equal(sceneAtHalfSecond.assignments['sat-b']?.cssColor, satBAtZero.cssColor);

  // The rail catches up with a different third satellite. sat-e must retain the
  // exact scene token even though each consumer observed a different sequence.
  const railAtOneSecond = store.resolve('rail', lease(1_000, ['sat-a', 'sat-e', 'sat-g']));
  const satEFromRail = railAtOneSecond.identitiesBySatelliteId['sat-e'];
  assert.ok(satEFromRail);
  assert.equal(satEFromRail.cssColor, satEFromScene.cssColor);
  assert.equal(satEFromRail.threeColor, satEFromScene.threeColor);
  assert.equal(satEFromRail.paletteSlot, satEFromScene.paletteSlot);

  const current = store.getCurrentAllocation();
  assert.ok(current);
  assert.deepEqual(current.orderedSatelliteIds, ['sat-a', 'sat-e', 'sat-f', 'sat-g']);
  assert.equal(new Set(current.identities.map(identity => identity.cssColor)).size, 4);
  assert.equal(current.overflowSatelliteIds.length, 0);
  assert.equal(current.assignments['sat-b'], undefined);
  assert.equal(current.assignments['sat-d'], undefined);
});

test('episode changes reset leases and released consumers stop reserving slots', () => {
  const store = createCandidatePresentationIdentityStore();
  const oldScene = store.resolve('scene', lease(0, ['sat-a', 'sat-b', 'sat-c']));
  const oldRail = store.resolve('rail', lease(0, ['sat-a', 'sat-b', 'sat-d']));
  const oldSatAColor = oldRail.identitiesBySatelliteId['sat-a']?.cssColor;
  assert.equal(oldSatAColor, oldScene.identitiesBySatelliteId['sat-a']?.cssColor);
  store.release('scene', 'shared-colour-episode');

  const railOnly = store.getCurrentAllocation();
  assert.ok(railOnly);
  assert.deepEqual(railOnly.orderedSatelliteIds, ['sat-a', 'sat-b', 'sat-d']);
  assert.equal(railOnly.assignments['sat-c'], undefined);

  const nextEpisode = store.resolve('scene', {
    ...lease(0, ['sat-a', 'sat-x', 'sat-y']),
    episodeId: 'next-episode',
  });
  assert.equal(nextEpisode.episodeId, 'next-episode');
  assert.equal(nextEpisode.identitiesBySatelliteId['sat-a']?.cssColor, oldSatAColor);
  assert.deepEqual(nextEpisode.orderedSatelliteIds, ['sat-a', 'sat-x', 'sat-y']);
  assert.ok(nextEpisode.assignments['sat-b']);
  assert.ok(nextEpisode.assignments['sat-d']);

  // The throttled rail is still rendering the prior episode. Its old snapshot
  // and the new scene snapshot must assign the same token to any overlapping
  // satellite; this is the browser cadence that previously recoloured sat-a.
  assert.equal(oldRail.identitiesBySatelliteId['sat-a']?.cssColor, nextEpisode.identitiesBySatelliteId['sat-a']?.cssColor);

  const caughtUpRail = store.resolve('rail', {
    ...lease(1_000, ['sat-a', 'sat-x', 'sat-z']),
    episodeId: 'next-episode',
  });
  assert.equal(caughtUpRail.identitiesBySatelliteId['sat-a']?.cssColor, oldSatAColor);
  assert.equal(caughtUpRail.identitiesBySatelliteId['sat-x']?.cssColor, nextEpisode.identitiesBySatelliteId['sat-x']?.cssColor);
  assert.equal(caughtUpRail.assignments['sat-b'], undefined);
  assert.equal(caughtUpRail.assignments['sat-d'], undefined);
});

test('simultaneous StrictMode cleanup keeps palette memory until both consumers re-register', () => {
  const store = createCandidatePresentationIdentityStore();

  // sat-y and sat-a share a preferred palette slot. Seeding sat-y as serving
  // forces sat-a onto a probed slot that must remain stable after sat-y leaves.
  store.resolve('scene', lease(0, ['sat-y', 'sat-a', 'sat-c'], 'sat-y'));
  store.resolve('rail', lease(0, ['sat-y', 'sat-a', 'sat-d'], 'sat-y'));

  const currentSceneLease = lease(500, ['sat-a', 'sat-e', 'sat-f']);
  const currentRailLease = lease(500, ['sat-a', 'sat-e', 'sat-g']);
  store.resolve('scene', currentSceneLease);
  const railBeforeReplay = store.resolve('rail', currentRailLease);
  const satABeforeReplay = railBeforeReplay.identitiesBySatelliteId['sat-a'];
  assert.ok(satABeforeReplay);

  // React 18 StrictMode runs all passive-effect cleanups before replaying the
  // setups. Both committed components still paint their pre-cleanup plans.
  store.release('scene', currentSceneLease.episodeId);
  store.release('rail', currentRailLease.episodeId);
  assert.equal(store.getCurrentAllocation(), null);

  store.resolve('scene', currentSceneLease);
  store.resolve('rail', currentRailLease);
  const sceneAfterReplay = store.resolve('scene', currentSceneLease);
  const satAAfterReplay = sceneAfterReplay.identitiesBySatelliteId['sat-a'];
  assert.ok(satAAfterReplay);

  assert.equal(satAAfterReplay.cssColor, satABeforeReplay.cssColor);
  assert.equal(satAAfterReplay.threeColor, satABeforeReplay.threeColor);
  assert.equal(satAAfterReplay.paletteSlot, satABeforeReplay.paletteSlot);
});
