import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveVisualLabStoryInspectPlan } from './visualLabStoryInspectPlan';

test('story scene targets select the service view while preserving their focus', () => {
  assert.deepEqual(deriveVisualLabStoryInspectPlan('scene'), {
    module: 'scene',
    explicitView: 'service',
    focus: 'geometry',
  });
  assert.deepEqual(deriveVisualLabStoryInspectPlan('handover'), {
    module: 'scene',
    explicitView: 'service',
    focus: 'handover',
  });
});

test('power result targets select the power module and energy focus', () => {
  assert.deepEqual(deriveVisualLabStoryInspectPlan('power'), {
    module: 'power',
    explicitView: null,
    focus: 'energy',
  });
  assert.deepEqual(deriveVisualLabStoryInspectPlan('energy-efficiency'), {
    module: 'power',
    explicitView: null,
    focus: 'energy',
  });
});

test('signal and throughput targets share the sinr module with distinct focus', () => {
  assert.deepEqual(deriveVisualLabStoryInspectPlan('sinr'), {
    module: 'sinr',
    explicitView: null,
    focus: 'geometry',
  });
  assert.deepEqual(deriveVisualLabStoryInspectPlan('throughput'), {
    module: 'sinr',
    explicitView: null,
    focus: 'handover',
  });
  assert.deepEqual(deriveVisualLabStoryInspectPlan('figure'), {
    module: 'sinr',
    explicitView: null,
    focus: 'geometry',
  });
});
