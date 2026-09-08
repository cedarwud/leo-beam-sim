import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldEnableHomepageMultiCandidateAuthority,
  shouldSuppressLegacyPrimaryHandover,
  type SceneLane,
} from './sceneLane';

test('multi-candidate authority is enabled only on the homepage Walker lane', () => {
  assert.equal(shouldEnableHomepageMultiCandidateAuthority('sinr-live'), true);

  const zeroDriftLanes: readonly SceneLane[] = [
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

test('the legacy SINR manager is suppressed only on the homepage sinr-live lane', () => {
  // The homepage EE authority depends on this. Before it became a named
  // function it was an unnamed positional argument to useSimulation with no
  // test anywhere, so deleting it would have silently returned primary
  // handover to the SINR-only engine on the homepage.
  assert.equal(shouldSuppressLegacyPrimaryHandover('sinr-live', true), true);
  // Not the homepage: the rail engine is still the authority there.
  assert.equal(shouldSuppressLegacyPrimaryHandover('sinr-live', false), false);
  assert.equal(shouldSuppressLegacyPrimaryHandover('sinr-live', undefined), false);
  const nonHomepageLanes: readonly SceneLane[] = [
    'artifact-replay',
  ];
  for (const lane of nonHomepageLanes) {
    assert.equal(
      shouldSuppressLegacyPrimaryHandover(lane, true),
      false,
      `${lane} must keep the legacy manager's authority`,
    );
  }
});
