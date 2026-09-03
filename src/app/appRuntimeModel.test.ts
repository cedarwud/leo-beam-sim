import assert from 'node:assert/strict';
import {
  getHomepageRightSidebarTabsForSceneLane,
  getRightSidebarTabsForSceneLane,
  resolveHomepageInitialRuntimeState,
} from './appRuntimeModel';

const restoredModqnState = resolveHomepageInitialRuntimeState({
  appMode: 'modqn-demo',
  selectedProfileId: 'hobs-2024-candidate-rich',
  handoverMode: 'decision-overlay-on-live-sinr',
  profileByMode: {
    'sinr-experiment': 'hobs-2024-paper-default',
    'modqn-demo': 'hobs-2024-candidate-rich',
  },
});

assert.equal(
  restoredModqnState.appMode,
  'sinr-experiment',
  'the root homepage must not restore the legacy MODQN experience',
);
assert.equal(
  restoredModqnState.handoverMode,
  'sinr-offset',
  'the root homepage must use the SINR lane',
);
assert.equal(
  restoredModqnState.selectedProfileId,
  'hobs-2024-paper-default',
  'the root homepage may retain the saved SINR profile without restoring MODQN UI',
);

const homepageTabs = getHomepageRightSidebarTabsForSceneLane('sinr-live', 'sinr-offset');
assert.deepEqual(homepageTabs.map(tab => tab.key), []);
assert.deepEqual(
  getRightSidebarTabsForSceneLane('sinr-live', 'sinr-offset').map(tab => tab.key),
  ['live'],
  'the shared scene-lane model must not expose the homepage-only palette tab',
);
assert.deepEqual(
  getHomepageRightSidebarTabsForSceneLane('artifact-replay', 'sinr-offset').map(tab => tab.key),
  ['artifact'],
  'homepage helper must not broaden non-homepage lanes',
);

console.log('appRuntimeModel homepage launch checks passed');
