#!/usr/bin/env node
import assert from 'node:assert/strict';

import { loadProfile } from '../profiles';
import { createSceneTopologyState } from '../sceneTopology';
import { buildAppRuntimeConfig } from './appRuntimeConfig';

const runtime = buildAppRuntimeConfig({
  appMode: 'sinr-experiment',
  effectiveProfile: loadProfile('hobs-2024-candidate-rich'),
  demoStartOffsetSec: 12,
  liveTimelineSeekTargetSec: 24,
  liveTimelineSeekRequestKey: 'seek-7',
  measurementResetEpoch: 17,
  signalResetKey: 'signal-1',
  handoverResetKey: 'handover-1',
  runtimeVisualSettings: {
    beamDensity: 'event-only',
    effectsEnabled: {
      spineParticles: false,
      orbitTrail: false,
      servingRipple: false,
      pendingRipple: false,
    },
    cinematicMode: 'off',
    reducedMotion: false,
  },
  beamDensityOverride: null,
  effectiveCinematicMode: 'off',
  cameraCommand: undefined,
  viewport: { width: 1280, height: 720 },
  sceneTopology: createSceneTopologyState(),
  selectedTrainingEnvAxes: undefined,
});

assert.equal(runtime.measurementResetEpoch, 17);
assert.equal(runtime.replay.seekRequestKey, 'seek-7');
assert.equal(runtime.signalResetKey, 'signal-1');
assert.equal(runtime.handoverResetKey, 'handover-1');
assert.equal(runtime.viewport.width, 1280);
assert.equal(runtime.replay.startOffsetSec, 12);

const legacyWithStaleDistribution = buildAppRuntimeConfig({
  appMode: 'sinr-experiment',
  effectiveProfile: loadProfile('hobs-2024-candidate-rich'),
  demoStartOffsetSec: 12,
  signalResetKey: 'signal-1',
  handoverResetKey: 'handover-1',
  runtimeVisualSettings: {
    beamDensity: 'event-only',
    effectsEnabled: {
      spineParticles: false,
      orbitTrail: false,
      servingRipple: false,
      pendingRipple: false,
    },
    cinematicMode: 'off',
    reducedMotion: false,
  },
  beamDensityOverride: null,
  effectiveCinematicMode: 'off',
  cameraCommand: undefined,
  viewport: { width: 1280, height: 720 },
  sceneTopology: { ...createSceneTopologyState(), ueDistributionMode: 'random' },
  selectedTrainingEnvAxes: undefined,
});
assert.equal(
  legacyWithStaleDistribution.ueDistributionMode,
  'seven-cell-asymmetric',
  'legacy / ignores stale map-wide UE distribution overrides',
);

console.log('app runtime measurement-reset and replay-key threading test passed.');
