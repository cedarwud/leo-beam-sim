import assert from 'node:assert/strict';
import { resolveSinrLiveBeamBudget } from './sinrLiveBeamBudget';

assert.equal(
  resolveSinrLiveBeamBudget({
    fallbackBeamCount: 7,
    satelliteId: 'sat-serving',
    roleBeamCount: 1,
    beamCountBySatellite: { 'sat-serving': 19 },
  }),
  1,
  'a serving-role override wins over a per-satellite override',
);
assert.equal(
  resolveSinrLiveBeamBudget({
    fallbackBeamCount: 7,
    satelliteId: 'sat-candidate',
    beamCountBySatellite: { 'sat-candidate': 19 },
  }),
  19,
  'a per-satellite override wins over the global fallback',
);
assert.equal(
  resolveSinrLiveBeamBudget({ fallbackBeamCount: 7, satelliteId: 'sat-other' }),
  7,
  'the global fallback remains the final source',
);

console.log('sinrLiveBeamBudget.test.ts: PASS');
