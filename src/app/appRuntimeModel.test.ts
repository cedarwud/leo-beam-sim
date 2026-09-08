import assert from 'node:assert/strict';
import {
  getHomepageRightSidebarTabsForSceneLane,
  getRightSidebarTabsForSceneLane,
  resolveHomepageInitialRuntimeState,
} from './appRuntimeModel';

const restoredHomepageState = resolveHomepageInitialRuntimeState({
  appMode: 'sinr-experiment',
  selectedProfileId: 'hobs-2024-candidate-rich',
  handoverMode: 'sinr-offset',
  profileByMode: {
    'sinr-experiment': 'hobs-2024-paper-default',
  },
});

assert.equal(
  restoredHomepageState.appMode,
  'sinr-experiment',
  'the root homepage uses the canonical SINR experience',
);
assert.equal(
  restoredHomepageState.handoverMode,
  'sinr-offset',
  'the root homepage must use the SINR lane',
);
assert.equal(
  restoredHomepageState.selectedProfileId,
  'hobs-2024-paper-default',
  'the root homepage retains the saved SINR profile',
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
