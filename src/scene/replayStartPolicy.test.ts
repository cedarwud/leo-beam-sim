import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInitialReplayWarmupSec } from './replayStartPolicy';

test('homepage policy stays at replay origin unless warm-start is explicitly enabled', () => {
  assert.equal(resolveInitialReplayWarmupSec({
    cellTruthAvailable: true,
    enabled: false,
    alreadyWarmed: false,
    requestedWarmupSec: 130,
  }), 0);
});

test('diagnostic opt-in keeps a bounded one-shot warm-start available', () => {
  assert.equal(resolveInitialReplayWarmupSec({
    cellTruthAvailable: true,
    enabled: true,
    alreadyWarmed: false,
    requestedWarmupSec: 130,
  }), 130);
  assert.equal(resolveInitialReplayWarmupSec({
    cellTruthAvailable: true,
    enabled: true,
    alreadyWarmed: true,
    requestedWarmupSec: 130,
  }), 0);
});

test('invalid or unavailable warm-ups fail closed to the exact replay origin', () => {
  for (const requestedWarmupSec of [undefined, Number.NaN, Number.POSITIVE_INFINITY, -5]) {
    assert.equal(resolveInitialReplayWarmupSec({
      cellTruthAvailable: true,
      enabled: true,
      alreadyWarmed: false,
      requestedWarmupSec,
    }), 0);
  }
  assert.equal(resolveInitialReplayWarmupSec({
    cellTruthAvailable: false,
    enabled: true,
    alreadyWarmed: false,
    requestedWarmupSec: 130,
  }), 0);
});
