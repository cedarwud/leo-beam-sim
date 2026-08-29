import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyWalkerForecastCacheReset,
  createWalkerForecastCacheKey,
  walkerForecastCacheKeyString,
  type WalkerForecastCacheContinuityInput,
  type WalkerForecastCacheKeyInput,
  type WalkerForecastDeclaredDiscontinuity,
} from './walkerForecastCache';

const UTC_MS = Date.UTC(2026, 7, 29, 0, 0, 0);

function keyInput(): WalkerForecastCacheKeyInput {
  return {
    sourceFrameId: `walker:${UTC_MS}:${UTC_MS + 42_000}`,
    acceptedFrameLineageId: 'accepted-lineage-a',
    epochToken: `walker:${UTC_MS}`,
    absoluteUtcMs: UTC_MS + 42_000,
    simulationSourceId: 'walker-live-v1',
    primaryUeId: 'ue-primary',
    candidate: { satelliteId: 'SAT-A', beamId: 3 },
    horizonSec: 17.5,
    forecastSampleStepSec: 2.5,
    modelVersion: 'walker-forecast-v1',
    canonicalContractVersion: 'family-b-thesis-3.13-3.17-v1',
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
    executionBudgetHash: 'budget-a',
  };
}

function continuityInput(): WalkerForecastCacheContinuityInput {
  const input = keyInput();
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

test('creates a deterministic immutable full Walker forecast cache identity', () => {
  const mutableCandidate = { satelliteId: 'SAT-A', beamId: 3 };
  const input = { ...keyInput(), candidate: mutableCandidate };
  const first = createWalkerForecastCacheKey(input);
  const second = createWalkerForecastCacheKey(keyInput());

  assert.equal(first.cacheId, second.cacheId);
  assert.equal(walkerForecastCacheKeyString(first), first.cacheId);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.candidate), true);
  mutableCandidate.satelliteId = 'SAT-MUTATED';
  mutableCandidate.beamId = 99;
  assert.deepEqual(first.candidate, { satelliteId: 'SAT-A', beamId: 3 });
});

test('every scientific identity dimension independently changes the cache key', () => {
  const base = keyInput();
  const baseId = createWalkerForecastCacheKey(base).cacheId;
  const variants: ReadonlyArray<readonly [string, WalkerForecastCacheKeyInput]> = [
    ['sourceFrameId', { ...base, sourceFrameId: `${base.sourceFrameId}:next` }],
    ['acceptedFrameLineageId', { ...base, acceptedFrameLineageId: 'accepted-lineage-b' }],
    ['epochToken', { ...base, epochToken: `${base.epochToken}:next` }],
    ['absoluteUtcMs', { ...base, absoluteUtcMs: base.absoluteUtcMs + 1 }],
    ['simulationSourceId', { ...base, simulationSourceId: 'walker-live-v2' }],
    ['primaryUeId', { ...base, primaryUeId: 'ue-other' }],
    ['candidate satellite', { ...base, candidate: { ...base.candidate, satelliteId: 'SAT-B' } }],
    ['candidate beam', { ...base, candidate: { ...base.candidate, beamId: 4 } }],
    ['horizonSec', { ...base, horizonSec: 20 }],
    ['forecastSampleStepSec', { ...base, forecastSampleStepSec: 1.25 }],
    ['modelVersion', { ...base, modelVersion: 'walker-forecast-v2' }],
    ['canonicalContractVersion', { ...base, canonicalContractVersion: 'canonical-v2' }],
    ['geometryModelHash', { ...base, geometryModelHash: 'geometry-b' }],
    ['scenarioStateHash', { ...base, scenarioStateHash: 'scenario-b' }],
    ['scheduleStateHash', { ...base, scheduleStateHash: 'schedule-b' }],
    ['assignmentStateHash', { ...base, assignmentStateHash: 'assignment-b' }],
    ['canonicalPowerStateHash', { ...base, canonicalPowerStateHash: 'power-b' }],
    ['canonicalConfigHash', { ...base, canonicalConfigHash: 'canonical-b' }],
    [
      'canonicalConfigurationProvenanceId',
      { ...base, canonicalConfigurationProvenanceId: 'canonical-provenance-b' },
    ],
    ['profileConfigHash', { ...base, profileConfigHash: 'profile-b' }],
    ['policyConfigHash', { ...base, policyConfigHash: 'policy-b' }],
    ['continuityEpochId', { ...base, continuityEpochId: 'continuity-b' }],
    ['executionBudgetHash', { ...base, executionBudgetHash: 'budget-b' }],
  ];

  for (const [label, variant] of variants) {
    assert.notEqual(createWalkerForecastCacheKey(variant).cacheId, baseId, label);
  }
});

test('fails closed for missing identities, invalid time/window values, and invalid links', () => {
  const base = keyInput();
  for (const field of [
    'sourceFrameId',
    'acceptedFrameLineageId',
    'epochToken',
    'simulationSourceId',
    'primaryUeId',
    'modelVersion',
    'canonicalContractVersion',
    'geometryModelHash',
    'scenarioStateHash',
    'scheduleStateHash',
    'assignmentStateHash',
    'canonicalPowerStateHash',
    'canonicalConfigHash',
    'canonicalConfigurationProvenanceId',
    'profileConfigHash',
    'policyConfigHash',
    'continuityEpochId',
    'executionBudgetHash',
  ] as const) {
    assert.throws(
      () => createWalkerForecastCacheKey({ ...base, [field]: ' ' }),
      new RegExp(field),
    );
  }
  assert.throws(() => createWalkerForecastCacheKey({ ...base, absoluteUtcMs: -1 }), /absoluteUtcMs/);
  assert.throws(() => createWalkerForecastCacheKey({ ...base, absoluteUtcMs: 0.5 }), /absoluteUtcMs/);
  assert.throws(() => createWalkerForecastCacheKey({ ...base, horizonSec: 0 }), /horizonSec/);
  assert.throws(
    () => createWalkerForecastCacheKey({ ...base, forecastSampleStepSec: Number.NaN }),
    /forecastSampleStepSec/,
  );
  assert.throws(
    () => createWalkerForecastCacheKey({ ...base, horizonSec: 1, forecastSampleStepSec: 2 }),
    /must not exceed horizonSec/,
  );
  assert.throws(
    () => createWalkerForecastCacheKey({ ...base, candidate: { satelliteId: 'SAT|BAD', beamId: 1 } }),
    /delimiter/,
  );
  assert.throws(
    () => createWalkerForecastCacheKey({ ...base, candidate: { satelliteId: 'SAT-A', beamId: -1 } }),
    /beamId/,
  );
});

test('classifies declared and identity discontinuities without resetting monotonic frames', () => {
  const previous = continuityInput();
  const later = {
    ...previous,
    sourceFrameId: `${previous.sourceFrameId}:later`,
    absoluteUtcMs: previous.absoluteUtcMs + 16,
  };
  assert.deepEqual(classifyWalkerForecastCacheReset({ previous: null, next: previous }), {
    reset: false,
    reason: null,
  });
  assert.deepEqual(classifyWalkerForecastCacheReset({ previous, next: later }), {
    reset: false,
    reason: null,
  });

  for (const reason of ['accepted-frame-change', 'seek', 'loop-wrap'] as const satisfies readonly WalkerForecastDeclaredDiscontinuity[]) {
    assert.deepEqual(classifyWalkerForecastCacheReset({
      previous,
      next: later,
      declaredDiscontinuity: reason,
    }), { reset: true, reason });
  }

  const changes: ReadonlyArray<readonly [string, WalkerForecastCacheContinuityInput, string]> = [
    ['epoch', { ...later, epochToken: 'walker:new-epoch' }, 'epoch-change'],
    ['source', { ...later, simulationSourceId: 'another-source' }, 'source-change'],
    ['profile', { ...later, profileConfigHash: 'profile-b' }, 'profile-change'],
    ['focus', { ...later, primaryUeId: 'ue-other' }, 'focus-change'],
    ['policy', { ...later, policyConfigHash: 'policy-b' }, 'policy-config-change'],
    ['continuity', { ...later, continuityEpochId: 'continuity-b' }, 'continuity-reset'],
    ['budget', { ...later, executionBudgetHash: 'budget-b' }, 'execution-budget-change'],
    [
      'accepted-frame lineage',
      { ...later, acceptedFrameLineageId: 'accepted-lineage-b' },
      'accepted-frame-change',
    ],
  ];
  for (const [label, next, reason] of changes) {
    assert.deepEqual(
      classifyWalkerForecastCacheReset({ previous, next }),
      { reset: true, reason },
      label,
    );
  }
  assert.deepEqual(classifyWalkerForecastCacheReset({
    previous,
    next: { ...later, absoluteUtcMs: previous.absoluteUtcMs - 1 },
  }), { reset: true, reason: 'seek' });
  assert.deepEqual(classifyWalkerForecastCacheReset({
    previous,
    next: { ...previous, sourceFrameId: `${previous.sourceFrameId}:replacement` },
  }), { reset: true, reason: 'accepted-frame-change' });
  assert.deepEqual(classifyWalkerForecastCacheReset({
    previous,
    next: { ...later, sourceFrameId: previous.sourceFrameId },
  }), { reset: true, reason: 'accepted-frame-change' });
});

test('detects a replacement lineage even when frame identity and time both advance', () => {
  const previous = continuityInput();
  const next = {
    ...previous,
    sourceFrameId: `${previous.sourceFrameId}:replacement-later`,
    absoluteUtcMs: previous.absoluteUtcMs + 1_000,
    acceptedFrameLineageId: 'accepted-lineage-replacement',
  };

  assert.deepEqual(classifyWalkerForecastCacheReset({ previous, next }), {
    reset: true,
    reason: 'accepted-frame-change',
  });
});
