import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldEnableHomepageMultiCandidateAuthority,
  type SceneLane,
} from './sceneLane';

test('multi-candidate authority is enabled only on the homepage Walker lane', () => {
  assert.equal(shouldEnableHomepageMultiCandidateAuthority('sinr-live'), true);

  const zeroDriftLanes: readonly SceneLane[] = [
    'modqn-live-cell-preview',
    'modqn-replay-proof',
    'artifact-replay',
  ];
  for (const lane of zeroDriftLanes) {
    assert.equal(
      shouldEnableHomepageMultiCandidateAuthority(lane),
      false,
      `${lane} must retain its existing decision authority`,
    );
  }
});
