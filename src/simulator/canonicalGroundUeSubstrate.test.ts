#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_GROUND_UE_COUNT,
  CANONICAL_GROUND_UE_SUBSTRATE,
  CANONICAL_GROUND_UE_SUBSTRATE_ID,
  CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM,
  CANONICAL_GROUND_UE_SUBSTRATE_SOURCE_LAYOUT,
} from './canonicalGroundUeSubstrate';

test('canonical ground UE substrate is immutable, deterministic, and identity-stable', () => {
  const substrate = CANONICAL_GROUND_UE_SUBSTRATE;

  assert.strictEqual(substrate, CANONICAL_GROUND_UE_SUBSTRATE);
  assert.equal(substrate.substrateId, CANONICAL_GROUND_UE_SUBSTRATE_ID);
  assert.equal(substrate.sourceLayoutCount, CANONICAL_GROUND_UE_SUBSTRATE_SOURCE_LAYOUT);
  assert.equal(substrate.ueCount, CANONICAL_GROUND_UE_COUNT);
  assert.equal(substrate.maxRadiusKm, CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM);
  assert.equal(substrate.users.length, CANONICAL_GROUND_UE_COUNT);
  assert.equal(Object.isFrozen(substrate), true);
  assert.equal(Object.isFrozen(substrate.users), true);
  assert.equal(new Set(substrate.users.map(user => user.userId)).size, CANONICAL_GROUND_UE_COUNT);
  assert.deepEqual(
    substrate.users.map(user => user.userId),
    Array.from({ length: CANONICAL_GROUND_UE_COUNT }, (_unused, index) => `ue-${index + 1}`),
  );
  for (const user of substrate.users) {
    assert.equal(Object.isFrozen(user), true);
    assert.equal(Object.isFrozen(user.positionKm), true);
    assert.ok(user.positionKm.every(Number.isFinite));
    assert.ok(Math.hypot(...user.positionKm) <= CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM);
  }
});
