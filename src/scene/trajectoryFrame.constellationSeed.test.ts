import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createObserverContext,
  generateWalkerConstellation,
  WALKER_CONSTELLATION_PHASE_MODEL_VERSION,
} from '../engine/orbit';
import { loadProfile } from '../profiles';
import type { Profile } from '../profiles/types';
import { createTrajectoryCache } from './trajectoryFrame';
import { createDemoReplayRecommendationCacheKey } from './replay-recommendation';

const EPOCH_UTC_MS = Date.UTC(2026, 7, 29, 0, 0, 0);

function profileWithSeed(constellationSeed: number): Profile {
  const base = loadProfile('hobs-2024-candidate-rich');
  return {
    ...base,
    orbit: {
      ...base.orbit,
      constellationSeed,
      shells: [{
        id: 'seed-test-shell',
        altitudeKm: 550,
        inclinationDeg: 53,
        planes: 1,
        satsPerPlane: 1,
      }],
    },
  };
}

test('all shipped profiles state the legacy-preserving Walker constellation seed explicitly', () => {
  const shippedProfileIds = [
    'hobs-2024-candidate-rich',
    'hobs-2024-paper-default',
    'hobs-2024-tr38811-research',
    'hobs-2024-mobile-demo-aircraft',
    'modqn-1sat-7beam',
    'modqn-4sat-7beam-paper-faithful',
  ];

  for (const profileId of shippedProfileIds) {
    assert.equal(loadProfile(profileId).orbit.constellationSeed, 0, profileId);
  }
});

test('explicit seed zero preserves the established Walker phase baseline', () => {
  const elements = generateWalkerConstellation({
    shells: [{
      id: 'seed-test-shell',
      altitudeKm: 550,
      inclinationDeg: 53,
      planes: 2,
      satsPerPlane: 2,
    }],
    epochUtcMs: EPOCH_UTC_MS,
    phaseSeed: 0,
  });

  assert.deepEqual(
    elements.map(element => ({
      id: element.id,
      raanRad: element.raanRad,
      meanAnomalyRad: element.meanAnomalyRad,
    })),
    [
      { id: 'seed-test-shell-P0-S0', raanRad: 0, meanAnomalyRad: -1.2566370614359172 },
      { id: 'seed-test-shell-P0-S1', raanRad: 0, meanAnomalyRad: 2.060884780754904 },
      {
        id: 'seed-test-shell-P1-S0',
        raanRad: Math.PI,
        meanAnomalyRad: 0.6408849013323177,
      },
      {
        id: 'seed-test-shell-P1-S1',
        raanRad: Math.PI,
        meanAnomalyRad: 3.958406743523139,
      },
    ],
  );
});

test('constellation seed is deterministic, changes phase geometry, and isolates trajectory cache identity', () => {
  const seedZero = profileWithSeed(0);
  const seedOne = profileWithSeed(1);
  const observer = createObserverContext(
    seedZero.orbit.observerLatDeg,
    seedZero.orbit.observerLonDeg,
  );
  const elementsZero = generateWalkerConstellation({
    shells: seedZero.orbit.shells,
    epochUtcMs: EPOCH_UTC_MS,
    phaseSeed: seedZero.orbit.constellationSeed,
  });
  const elementsOne = generateWalkerConstellation({
    shells: seedOne.orbit.shells,
    epochUtcMs: EPOCH_UTC_MS,
    phaseSeed: seedOne.orbit.constellationSeed,
  });

  assert.notEqual(elementsZero[0]?.meanAnomalyRad, elementsOne[0]?.meanAnomalyRad);
  assert.deepEqual(
    elementsOne,
    generateWalkerConstellation({
      shells: seedOne.orbit.shells,
      epochUtcMs: EPOCH_UTC_MS,
      phaseSeed: seedOne.orbit.constellationSeed,
    }),
  );

  const firstSeedZero = createTrajectoryCache(seedZero, observer, EPOCH_UTC_MS);
  assert.equal(
    createTrajectoryCache(seedZero, observer, EPOCH_UTC_MS),
    firstSeedZero,
    'identical explicit seed reuses the memoized cache',
  );
  assert.notEqual(
    createTrajectoryCache(seedOne, observer, EPOCH_UTC_MS),
    firstSeedZero,
    'a different seed cannot reuse another constellation cache',
  );
});

test('live trajectory construction fails closed instead of restoring an omitted or invalid seed', () => {
  const profile = profileWithSeed(Number.NaN);
  const observer = createObserverContext(
    profile.orbit.observerLatDeg,
    profile.orbit.observerLonDeg,
  );

  assert.throws(
    () => createTrajectoryCache(profile, observer, EPOCH_UTC_MS),
    /must declare orbit\.constellationSeed as a safe integer/,
  );
  assert.throws(
    () => generateWalkerConstellation({
      shells: profile.orbit.shells,
      epochUtcMs: EPOCH_UTC_MS,
      phaseSeed: 0.5,
    }),
    /phaseSeed must be a safe integer/,
  );
});

test('homepage replay recommendation identity includes the phase model and explicit seed', () => {
  const seedZeroKey = createDemoReplayRecommendationCacheKey(profileWithSeed(0), EPOCH_UTC_MS);
  const seedOneKey = createDemoReplayRecommendationCacheKey(profileWithSeed(1), EPOCH_UTC_MS);

  assert.match(seedZeroKey, new RegExp(WALKER_CONSTELLATION_PHASE_MODEL_VERSION));
  assert.notEqual(seedZeroKey, seedOneKey);
});
