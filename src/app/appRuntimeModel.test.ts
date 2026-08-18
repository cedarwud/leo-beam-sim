import assert from 'node:assert/strict';
import { resolveHomepageInitialRuntimeState } from './appRuntimeModel';

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

console.log('appRuntimeModel homepage launch checks passed');
