import assert from 'node:assert/strict';
import { loadProfile } from '../profiles';
import { createSinrLiveBeamDisplayFrame } from './sinrLiveBeamDisplayFrame';

const profile = loadProfile('hobs-2024-candidate-rich');
const runtime = {
  beamHoppingEnabled: false,
  beamCountBySatellite: { 'sat-serving': 19 },
  servingBeamCount: 1,
  candidateBeamCount: undefined,
} as const;

const frame = createSinrLiveBeamDisplayFrame({
  profile,
  runtime,
  servingSatelliteId: 'sat-serving',
  candidateSatelliteId: 'sat-candidate',
});

assert.equal(frame.schemaVersion, 'sinr-live-beam-display-frame-v1');
assert.equal(frame.globalSatelliteCount, 2928);
assert.equal(frame.globalBeamCount, 20508);
assert.equal(frame.beamHoppingEnabled, false);
assert.deepEqual(frame.serving, { satelliteId: 'sat-serving', configuredBeamCount: 1 });
assert.deepEqual(frame.candidate, { satelliteId: 'sat-candidate', configuredBeamCount: 7 });

const candidateRoleOverride = createSinrLiveBeamDisplayFrame({
  profile,
  runtime: { ...runtime, candidateBeamCount: 19, beamHoppingEnabled: true },
  servingSatelliteId: 'sat-serving',
  candidateSatelliteId: 'sat-candidate',
});
assert.equal(candidateRoleOverride.candidate.configuredBeamCount, 19);
assert.equal(candidateRoleOverride.beamHoppingEnabled, true);

const nineteenProfile = {
  ...profile,
  beams: { ...profile.beams, perSatellite: 19, maxActivePerSat: 19 },
};
const nineteenFrame = createSinrLiveBeamDisplayFrame({
  profile: nineteenProfile,
  runtime: { ...runtime, beamCountBySatellite: {}, servingBeamCount: undefined, candidateBeamCount: undefined },
  servingSatelliteId: 'sat-serving',
  candidateSatelliteId: 'sat-candidate',
});
assert.equal(nineteenFrame.globalBeamCount, 55632, 'global 19-beam configuration reaches the homepage display frame');
assert.equal(nineteenFrame.serving.configuredBeamCount, 19);
assert.equal(nineteenFrame.candidate.configuredBeamCount, 19);

console.log('sinrLiveBeamDisplayFrame.test.ts: PASS');
