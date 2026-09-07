import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile } from '../profiles';
import { createSceneTopologyState } from '../sceneTopology';
import { createSignalTuningState } from '../signalTuning';
import {
  deriveWalkerSignalTunedProfile,
  type WalkerSignalProfileInput,
} from './walkerSignalProfile';

const baseProfile = loadProfile('hobs-2024-candidate-rich');

function createInput(): WalkerSignalProfileInput {
  return {
    baseProfile,
    signalTuning: createSignalTuningState(baseProfile),
    selectedTrainingEnvAxes: undefined,
    selectedTrainingSeedTriplet: undefined,
    activeSceneTopology: createSceneTopologyState(),
  };
}

test('applies signal tuning before the active scene topology', () => {
  const input = createInput();
  input.signalTuning.maxGainDbi += 1;
  input.activeSceneTopology.servingBeamCount = 19;

  const derived = deriveWalkerSignalTunedProfile(input);

  assert.equal(derived.antenna.maxGainDbi, input.signalTuning.maxGainDbi);
  assert.equal(derived.beams.perSatellite, 19);
});

test('keeps the profile stable when no training environment is selected', () => {
  const derived = deriveWalkerSignalTunedProfile(createInput());

  assert.equal(derived.id, baseProfile.id);
  assert.equal(derived.channel.frequencyGHz, baseProfile.channel.frequencyGHz);
  assert.deepEqual(derived.orbit.shells, baseProfile.orbit.shells);
});
