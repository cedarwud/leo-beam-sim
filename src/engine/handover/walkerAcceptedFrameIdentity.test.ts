import assert from 'node:assert/strict';
import test from 'node:test';

import { createWalkerAcceptedFrameIdentity } from './walkerAcceptedFrameIdentity';

test('creates one deterministic safe-integer identity for an accepted Walker frame', () => {
  const epochUtcMs = Date.UTC(2026, 7, 29, 0, 0, 0);
  const identity = createWalkerAcceptedFrameIdentity(epochUtcMs, 12.3456);

  assert.deepEqual(identity, {
    sourceFrameId: `walker:${epochUtcMs}:${epochUtcMs + 12_346}`,
    epochToken: `walker:${epochUtcMs}`,
    epochUtcMs,
    replayOffsetMs: 12_346,
    absoluteUtcMs: epochUtcMs + 12_346,
  });
  assert.equal(Number.isSafeInteger(identity.absoluteUtcMs), true);
  assert.equal(Object.isFrozen(identity), true);
  assert.deepEqual(
    createWalkerAcceptedFrameIdentity(epochUtcMs, 12.3456),
    identity,
  );
});

test('fails closed for invalid epochs, offsets, and unsafe sums', () => {
  assert.throws(() => createWalkerAcceptedFrameIdentity(-1, 0), /epochUtcMs/);
  assert.throws(() => createWalkerAcceptedFrameIdentity(0.5, 0), /epochUtcMs/);
  assert.throws(() => createWalkerAcceptedFrameIdentity(0, -1), /replayOffsetSec/);
  assert.throws(() => createWalkerAcceptedFrameIdentity(0, Number.NaN), /replayOffsetSec/);
  assert.throws(
    () => createWalkerAcceptedFrameIdentity(Number.MAX_SAFE_INTEGER, 0.001),
    /absoluteUtcMs/,
  );
});
