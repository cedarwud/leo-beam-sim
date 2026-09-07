import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveVisualLabReplayLaunchPlan } from './visualLabReplayLaunchPlan';

test('guided handover targets choose their presentation module and service focus', () => {
  assert.deepEqual(deriveVisualLabReplayLaunchPlan({
    clipId: 'inter-handover',
    runtime: 'guided',
    runtimeId: 'inter-handover',
  }), { runtime: 'guided', guidedReplayId: 'inter-handover', module: 'sinr', view: 'service', focus: 'handover' });
  assert.deepEqual(deriveVisualLabReplayLaunchPlan({
    clipId: 'intra-beam-handover',
    runtime: 'guided',
    runtimeId: 'intra-handover',
  }), { runtime: 'guided', guidedReplayId: 'intra-beam-handover', module: 'power', view: 'service', focus: 'handover' });
});

test('story and causal targets resolve to their distinct launch plans', () => {
  assert.deepEqual(deriveVisualLabReplayLaunchPlan({
    clipId: 'inter-handover',
    runtime: 'story',
    runtimeId: 'inter-handover',
  }), { runtime: 'story', module: 'scene', view: 'service', focus: 'handover' });
  assert.deepEqual(deriveVisualLabReplayLaunchPlan({
    clipId: 'link-gain-ab',
    runtime: 'causal',
    runtimeId: 'beamwidth',
  }), { runtime: 'causal', module: 'sinr', storyId: 'beamwidth' });
  assert.deepEqual(deriveVisualLabReplayLaunchPlan({
    clipId: 'power-cap-ab',
    runtime: 'causal',
    runtimeId: 'power-cap',
  }), { runtime: 'causal', module: 'power', storyId: 'power-cap' });
});

test('unsupported runtime combinations fail closed', () => {
  assert.throws(() => deriveVisualLabReplayLaunchPlan({
    clipId: 'power-cap-ab',
    runtime: 'guided',
    runtimeId: 'power-cap',
  }), /Unknown guided replay target/);
  assert.throws(() => deriveVisualLabReplayLaunchPlan({
    clipId: 'inter-handover',
    runtime: 'causal',
    runtimeId: 'unknown',
  }), /Unknown causal replay target/);
});
