import assert from 'node:assert/strict';
import {
  normalizePerSatelliteBeamLayoutCount,
  resolveBeamLayoutCountForSatellite,
} from './beamLayoutOverrides';

const normalized = normalizePerSatelliteBeamLayoutCount({
  ' sat-b ': 19,
  'sat-a': 1,
});

assert.deepEqual(Object.keys(normalized), ['sat-a', 'sat-b']);
assert.deepEqual(normalized, { 'sat-a': 1, 'sat-b': 19 });
assert.equal(Object.isFrozen(normalized), true);
assert.equal(resolveBeamLayoutCountForSatellite(7, normalized, 'sat-a'), 1);
assert.equal(resolveBeamLayoutCountForSatellite(7, normalized, 'sat-c'), 7);
assert.equal(resolveBeamLayoutCountForSatellite(undefined, normalized, 'sat-c'), undefined);
assert.throws(
  () => normalizePerSatelliteBeamLayoutCount({ ' sat-a ': 1, 'sat-a': 7 }),
  /duplicate satellite override ID/,
);
assert.throws(
  () => normalizePerSatelliteBeamLayoutCount({ 'sat-a': 13 }),
  /one of 1, 7, or 19/,
);

console.log('Per-satellite beam layout overrides normalize deterministically and resolve global fallback.');
