import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE,
  VISUAL_LAB_BEAM_ILLUMINATION_POLICY_REVISION,
  eligibleBeamCountForVisualLabScenario,
  eligibleBeamIdsForVisualLabScenario,
} from './beamIlluminationScenario';

test('fixed illumination admits the complete selected layout', () => {
  assert.equal(DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE, 'fixed');
  assert.equal(eligibleBeamCountForVisualLabScenario(7, 'fixed'), 7);
  assert.deepEqual(eligibleBeamIdsForVisualLabScenario(7, 'fixed', 14), [0, 1, 2, 3, 4, 5, 6]);
});

test('Beam Hopping uses a deterministic half-layout project policy', () => {
  assert.equal(eligibleBeamCountForVisualLabScenario(1, 'beam-hopping'), 1);
  assert.equal(eligibleBeamCountForVisualLabScenario(7, 'beam-hopping'), 4);
  assert.equal(eligibleBeamCountForVisualLabScenario(19, 'beam-hopping'), 10);
  assert.deepEqual(eligibleBeamIdsForVisualLabScenario(7, 'beam-hopping', 0), [0, 1, 2, 3]);
  assert.deepEqual(eligibleBeamIdsForVisualLabScenario(7, 'beam-hopping', 1), [4, 5, 6, 0]);
  assert.deepEqual(eligibleBeamIdsForVisualLabScenario(7, 'beam-hopping', 2), [1, 2, 3, 4]);
  assert.doesNotMatch(VISUAL_LAB_BEAM_ILLUMINATION_POLICY_REVISION, /v[_-]?max/i);
});

test('Beam Hopping rejects an invalid accepted-slot identity', () => {
  assert.throws(
    () => eligibleBeamIdsForVisualLabScenario(7, 'beam-hopping', -1),
    /slotIndex must be a non-negative integer/,
  );
});
