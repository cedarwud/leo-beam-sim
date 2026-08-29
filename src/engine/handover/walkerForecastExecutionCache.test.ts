import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWalkerForecastCacheKey,
  type WalkerForecastCacheContinuityInput,
  type WalkerForecastCacheKeyInput,
} from './walkerForecastCache';
import {
  WalkerForecastExecutionCache,
  createWalkerForecastExecutionBudget,
} from './walkerForecastExecutionCache';

const UTC_MS = Date.UTC(2026, 7, 29, 0, 0, 0);

const budgetInput = Object.freeze({
  budgetId: 'validation-budget-v1',
  maxEntries: 2,
  maxComputationsPerRefresh: 4,
  maxConcurrentComputations: 2,
});

function keyInput(
  executionBudgetHash: string,
  candidate: Readonly<{ satelliteId: string; beamId: number }> = {
    satelliteId: 'SAT-A',
    beamId: 1,
  },
): WalkerForecastCacheKeyInput {
  return {
    sourceFrameId: `walker:${UTC_MS}:${UTC_MS + 10_000}`,
    acceptedFrameLineageId: 'lineage-a',
    epochToken: `walker:${UTC_MS}`,
    absoluteUtcMs: UTC_MS + 10_000,
    simulationSourceId: 'walker-live-v1',
    primaryUeId: 'ue-primary',
    candidate,
    horizonSec: 17.5,
    forecastSampleStepSec: 2.5,
    modelVersion: 'walker-forecast-v1',
    canonicalContractVersion: 'family-b-v1',
    geometryModelHash: 'geometry-a',
    scenarioStateHash: 'scenario-a',
    scheduleStateHash: 'schedule-a',
    assignmentStateHash: 'assignment-a',
    canonicalPowerStateHash: 'power-a',
    canonicalConfigHash: 'canonical-a',
    canonicalConfigurationProvenanceId: 'canonical-provenance-a',
    profileConfigHash: 'profile-a',
    policyConfigHash: 'policy-a',
    continuityEpochId: 'continuity-a',
    executionBudgetHash,
  };
}

function continuity(input: WalkerForecastCacheKeyInput): WalkerForecastCacheContinuityInput {
  return {
    sourceFrameId: input.sourceFrameId,
    acceptedFrameLineageId: input.acceptedFrameLineageId,
    epochToken: input.epochToken,
    absoluteUtcMs: input.absoluteUtcMs,
    simulationSourceId: input.simulationSourceId,
    primaryUeId: input.primaryUeId,
    profileConfigHash: input.profileConfigHash,
    policyConfigHash: input.policyConfigHash,
    continuityEpochId: input.continuityEpochId,
    executionBudgetHash: input.executionBudgetHash,
  };
}

test('creates a deterministic full-tuple execution budget identity and rejects invalid limits', () => {
  const first = createWalkerForecastExecutionBudget(budgetInput);
  const second = createWalkerForecastExecutionBudget({ ...budgetInput });
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.match(first.executionBudgetHash, /^walker-forecast-execution-budget-v1:/);

  assert.throws(
    () => createWalkerForecastExecutionBudget({ ...budgetInput, maxEntries: 0 }),
    /maxEntries/,
  );
  assert.throws(
    () => createWalkerForecastExecutionBudget({
      ...budgetInput,
      maxComputationsPerRefresh: 1,
      maxConcurrentComputations: 2,
    }),
    /must not exceed/,
  );
});

test('publishes one leased computation and reuses the exact immutable-key hit without spending budget', () => {
  const cache = new WalkerForecastExecutionCache<{ readonly ee: number }>(budgetInput);
  const input = keyInput(cache.budget.executionBudgetHash);
  const key = createWalkerForecastCacheKey(input);
  cache.beginRefresh({ refreshId: 'refresh-1', continuity: continuity(input) });

  const acquired = cache.acquire(key);
  assert.equal(acquired.status, 'compute');
  if (acquired.status !== 'compute') return;
  assert.deepEqual(cache.publish(acquired.lease, key, Object.freeze({ ee: 42 })), {
    status: 'committed',
    cacheId: key.cacheId,
    evictedCacheId: null,
  });
  const beforeHit = cache.snapshot().computationsThisRefresh;
  const hit = cache.acquire(key);
  assert.equal(hit.status, 'hit');
  if (hit.status !== 'hit') return;
  assert.equal(hit.value.ee, 42);
  assert.equal(cache.snapshot().computationsThisRefresh, beforeHit);
});

test('refuses to cache a caller-owned mutable evidence object', () => {
  const cache = new WalkerForecastExecutionCache<{ ee: number }>(budgetInput);
  const input = keyInput(cache.budget.executionBudgetHash);
  const key = createWalkerForecastCacheKey(input);
  cache.beginRefresh({ refreshId: 'refresh-mutable', continuity: continuity(input) });
  const acquired = cache.acquire(key);
  assert.equal(acquired.status, 'compute');
  if (acquired.status !== 'compute') return;
  assert.throws(() => cache.publish(acquired.lease, key, { ee: 42 }), /immutable/);
  assert.equal(cache.snapshot().inFlightCount, 1, 'failed publication keeps the lease explicit');
  assert.equal(cache.abandon(acquired.lease), true);
});

test('separates duplicate, concurrency, and per-refresh compute exhaustion', () => {
  const cache = new WalkerForecastExecutionCache<number>({
    ...budgetInput,
    maxComputationsPerRefresh: 2,
    maxConcurrentComputations: 1,
  });
  const base = keyInput(cache.budget.executionBudgetHash);
  cache.beginRefresh({ refreshId: 'refresh-budget', continuity: continuity(base) });
  const keyA = createWalkerForecastCacheKey(base);
  const keyB = createWalkerForecastCacheKey({
    ...base,
    candidate: { satelliteId: 'SAT-B', beamId: 2 },
  });
  const keyC = createWalkerForecastCacheKey({
    ...base,
    candidate: { satelliteId: 'SAT-C', beamId: 3 },
  });

  const first = cache.acquire(keyA);
  assert.equal(first.status, 'compute');
  assert.equal(cache.acquire(keyA).status, 'unavailable');
  const concurrent = cache.acquire(keyB);
  assert.deepEqual(
    concurrent.status === 'unavailable' ? concurrent.code : null,
    'concurrency-budget-exhausted',
  );
  if (first.status !== 'compute') return;
  assert.equal(cache.abandon(first.lease), true);
  const second = cache.acquire(keyB);
  assert.equal(second.status, 'compute');
  if (second.status !== 'compute') return;
  assert.equal(cache.abandon(second.lease), true);
  const exhausted = cache.acquire(keyC);
  assert.deepEqual(
    exhausted.status === 'unavailable' ? exhausted.code : null,
    'refresh-compute-budget-exhausted',
  );
});

test('evicts by bounded LRU order and rejects an active-frame key mismatch', () => {
  const cache = new WalkerForecastExecutionCache<number>({
    ...budgetInput,
    maxComputationsPerRefresh: 8,
  });
  const base = keyInput(cache.budget.executionBudgetHash);
  cache.beginRefresh({ refreshId: 'refresh-lru', continuity: continuity(base) });
  const keys = ['SAT-A', 'SAT-B', 'SAT-C'].map((satelliteId, index) => createWalkerForecastCacheKey({
    ...base,
    candidate: { satelliteId, beamId: index + 1 },
  }));
  for (const [index, key] of keys.slice(0, 2).entries()) {
    const acquired = cache.acquire(key);
    assert.equal(acquired.status, 'compute');
    if (acquired.status === 'compute') cache.publish(acquired.lease, key, index + 1);
  }
  assert.equal(cache.acquire(keys[0]!).status, 'hit', 'SAT-A is touched to MRU');
  const third = cache.acquire(keys[2]!);
  assert.equal(third.status, 'compute');
  if (third.status === 'compute') {
    const receipt = cache.publish(third.lease, keys[2]!, 3);
    assert.deepEqual(
      receipt.status === 'committed' ? receipt.evictedCacheId : null,
      keys[1]!.cacheId,
    );
  }
  assert.deepEqual(cache.snapshot().cacheIdsLeastToMostRecent, [
    keys[0]!.cacheId,
    keys[2]!.cacheId,
  ]);

  const wrongFrame = createWalkerForecastCacheKey({
    ...base,
    sourceFrameId: `${base.sourceFrameId}:other`,
  });
  const mismatch = cache.acquire(wrongFrame);
  assert.deepEqual(
    mismatch.status === 'unavailable' ? mismatch.code : null,
    'key-context-mismatch',
  );
});

test('new refreshes invalidate old leases, retain normal cache history, and clear on discontinuity', () => {
  const cache = new WalkerForecastExecutionCache<number>(budgetInput);
  const base = keyInput(cache.budget.executionBudgetHash);
  const key = createWalkerForecastCacheKey(base);
  cache.beginRefresh({ refreshId: 'refresh-a', continuity: continuity(base) });
  const pending = cache.acquire(key);
  assert.equal(pending.status, 'compute');
  if (pending.status !== 'compute') return;

  const normal = cache.beginRefresh({ refreshId: 'refresh-b', continuity: continuity(base) });
  assert.equal(normal.reset.reset, false);
  assert.equal(normal.invalidatedInFlightCount, 1);
  assert.deepEqual(cache.publish(pending.lease, key, 1), {
    status: 'rejected',
    cacheId: key.cacheId,
    code: 'unknown-lease',
    detail: 'the forecast lease is not active for this cache key',
  });
  const fresh = cache.acquire(key);
  assert.equal(fresh.status, 'compute');
  if (fresh.status === 'compute') cache.publish(fresh.lease, key, 2);
  assert.equal(cache.snapshot().entryCount, 1);

  const reset = cache.beginRefresh({
    refreshId: 'refresh-seek',
    continuity: continuity(base),
    declaredDiscontinuity: 'seek',
  });
  assert.deepEqual(reset.reset, { reset: true, reason: 'seek' });
  assert.equal(cache.snapshot().entryCount, 0);
});

test('fails closed when refresh budget identity or refresh-id continuity drifts', () => {
  const cache = new WalkerForecastExecutionCache<number>(budgetInput);
  const base = keyInput(cache.budget.executionBudgetHash);
  cache.beginRefresh({ refreshId: 'refresh-stable', continuity: continuity(base) });
  assert.deepEqual(
    cache.beginRefresh({ refreshId: 'refresh-stable', continuity: continuity(base) }),
    {
      refreshId: 'refresh-stable',
      generation: 1,
      reset: { reset: false, reason: null },
      invalidatedInFlightCount: 0,
    },
  );
  assert.throws(() => cache.beginRefresh({
    refreshId: 'refresh-stable',
    continuity: { ...continuity(base), primaryUeId: 'ue-other' },
  }), /cannot be reused/);
  assert.throws(() => cache.beginRefresh({
    refreshId: 'refresh-stable',
    continuity: continuity(base),
    declaredDiscontinuity: 'seek',
  }), /cannot be reused/);
  assert.throws(() => cache.beginRefresh({
    refreshId: 'refresh-wrong-budget',
    continuity: { ...continuity(base), executionBudgetHash: 'wrong-budget' },
  }), /does not match/);
});
