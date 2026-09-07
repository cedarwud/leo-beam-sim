import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAuthoritySpineParticlePlans } from './multiCandidateAuthoritySpineParticlePlans';

const serving = {
  pairKey: 'sat-serving/3',
  satelliteId: 'sat-serving',
  beamId: 3,
  beamColor: '#0f9d58',
  apex: [10, 20, 30] as const,
};

test('builds an authority particle row from the accepted serving pair', () => {
  const plans = resolveAuthoritySpineParticlePlans({
    enabled: true,
    serving,
    primaryUeWorld: [1, 2, 3],
    particlesPerBeam: 3,
  });

  assert.equal(plans?.length, 3);
  assert.deepEqual(plans?.map(plan => plan.id), [
    'authority:sat-serving/3:P0',
    'authority:sat-serving/3:P1',
    'authority:sat-serving/3:P2',
  ]);
  assert.deepEqual(plans?.map(plan => plan.phaseOffset), [0, 1 / 3, 2 / 3]);
  assert.deepEqual(plans?.[0]?.start.toArray(), [10, 20, 30]);
  assert.deepEqual(plans?.[0]?.end.toArray(), [1, 2, 3]);
  assert.notStrictEqual(plans?.[0]?.start, plans?.[1]?.start);
});

test('returns undefined when disabled and an empty row without a serving link', () => {
  const input = {
    enabled: true,
    serving,
    primaryUeWorld: [1, 2, 3] as const,
    particlesPerBeam: 2,
  };

  assert.equal(resolveAuthoritySpineParticlePlans({ ...input, enabled: false }), undefined);
  assert.deepEqual(resolveAuthoritySpineParticlePlans({ ...input, serving: null }), []);
  assert.deepEqual(resolveAuthoritySpineParticlePlans({ ...input, primaryUeWorld: undefined }), []);
});
