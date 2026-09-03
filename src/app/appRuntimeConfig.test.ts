#!/usr/bin/env node
import assert from 'node:assert/strict';

import { loadProfile } from '../profiles';
import { createSceneTopologyState } from '../sceneTopology';
import { buildAppRuntimeConfig, type AppRuntimeConfigInput } from './appRuntimeConfig';

function buildRuntime(
  sceneTopology: AppRuntimeConfigInput['sceneTopology'],
  liveEpochUtcMs?: number,
) {
  return buildAppRuntimeConfig({
    appMode: 'sinr-experiment',
    effectiveProfile: loadProfile('hobs-2024-candidate-rich'),
    demoStartOffsetSec: 12,
    liveEpochUtcMs,
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
    sceneTopology,
    selectedTrainingEnvAxes: undefined,
  });
}

const runtime = buildRuntime(createSceneTopologyState());

assert.equal(runtime.measurementResetEpoch, 17);
assert.equal(runtime.replay.seekRequestKey, 'seek-7');
assert.equal(runtime.signalResetKey, 'signal-1');
assert.equal(runtime.handoverResetKey, 'handover-1');
assert.equal(runtime.viewport.width, 1280);
assert.equal(runtime.replay.startOffsetSec, 12);

const selectedEpochUtcMs = Date.parse('2026-08-12T12:00:00.000Z');
assert.equal(
  buildRuntime(createSceneTopologyState(), selectedEpochUtcMs).replay.epochUtcMs,
  selectedEpochUtcMs,
  'the public Walker scenario instant must reach the runtime replay epoch',
);

const legacyWithStaleDistribution = buildRuntime({ ...createSceneTopologyState(), ueDistributionMode: 'random' });
assert.equal(
  legacyWithStaleDistribution.ueDistributionMode,
  'seven-cell-asymmetric',
  'legacy / ignores stale map-wide UE distribution overrides',
);

const servingMaster = buildRuntime({
  ...createSceneTopologyState(),
  servingBeamCount: 19,
});
assert.equal(servingMaster.servingBeamCount, 19, 'serving setting is the live scene beam authority');
assert.equal(servingMaster.candidateBeamCount, 19, 'candidate follows serving without an override');

const candidateOverride = buildRuntime({
  ...createSceneTopologyState(),
  servingBeamCount: 19,
  candidateBeamCount: 1,
});
assert.equal(candidateOverride.servingBeamCount, 19, 'candidate override does not change serving');
assert.equal(candidateOverride.candidateBeamCount, 1, 'candidate role can still override serving');

console.log('app runtime measurement-reset and replay-key threading test passed.');
