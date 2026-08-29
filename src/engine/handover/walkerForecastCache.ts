import {
  candidateLinkKey,
  type CandidateLinkKey,
} from './candidateDecisionContract';

export const WALKER_FORECAST_CACHE_KEY_VERSION = 'walker-forecast-cache-key-v1' as const;

export interface WalkerForecastCacheKeyInput {
  readonly sourceFrameId: string;
  /** Stable across ordinary later frames; changes only when the accepted-frame lineage is replaced. */
  readonly acceptedFrameLineageId: string;
  readonly epochToken: string;
  readonly absoluteUtcMs: number;
  readonly simulationSourceId: string;
  readonly primaryUeId: string;
  readonly candidate: CandidateLinkKey;
  readonly horizonSec: number;
  readonly forecastSampleStepSec: number;
  readonly modelVersion: string;
  readonly canonicalContractVersion: string;
  readonly geometryModelHash: string;
  readonly scenarioStateHash: string;
  readonly scheduleStateHash: string;
  readonly assignmentStateHash: string;
  readonly canonicalPowerStateHash: string;
  readonly canonicalConfigHash: string;
  readonly canonicalConfigurationProvenanceId: string;
  readonly profileConfigHash: string;
  readonly policyConfigHash: string;
  readonly continuityEpochId: string;
  readonly executionBudgetHash: string;
}

export interface WalkerForecastCacheKey extends WalkerForecastCacheKeyInput {
  readonly keyVersion: typeof WALKER_FORECAST_CACHE_KEY_VERSION;
  readonly cacheId: string;
}

export type WalkerForecastDeclaredDiscontinuity =
  | 'none'
  | 'accepted-frame-change'
  | 'seek'
  | 'loop-wrap';

export type WalkerForecastCacheResetReason =
  | 'accepted-frame-change'
  | 'seek'
  | 'loop-wrap'
  | 'epoch-change'
  | 'source-change'
  | 'profile-change'
  | 'focus-change'
  | 'policy-config-change'
  | 'continuity-reset'
  | 'execution-budget-change';

/**
 * The identities that decide whether a cache may survive between two accepted
 * Walker frames. Candidate/model hashes belong to each entry key; these fields
 * own whole-cache invalidation.
 */
export interface WalkerForecastCacheContinuityInput {
  readonly sourceFrameId: string;
  readonly acceptedFrameLineageId: string;
  readonly epochToken: string;
  readonly absoluteUtcMs: number;
  readonly simulationSourceId: string;
  readonly primaryUeId: string;
  readonly profileConfigHash: string;
  readonly policyConfigHash: string;
  readonly continuityEpochId: string;
  readonly executionBudgetHash: string;
}

export interface WalkerForecastCacheTransition {
  readonly previous: WalkerForecastCacheContinuityInput | null;
  readonly next: WalkerForecastCacheContinuityInput;
  readonly declaredDiscontinuity?: WalkerForecastDeclaredDiscontinuity;
}

export type WalkerForecastCacheResetClassification =
  | Readonly<{ reset: false; reason: null }>
  | Readonly<{ reset: true; reason: WalkerForecastCacheResetReason }>;

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be non-empty`);
  }
  return value;
}

function safeUtcMs(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function positiveFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and greater than zero`);
  }
  return value;
}

function continuityIdentity(
  input: WalkerForecastCacheContinuityInput,
  label: string,
): WalkerForecastCacheContinuityInput {
  return Object.freeze({
    sourceFrameId: nonEmpty(input.sourceFrameId, `${label}.sourceFrameId`),
    acceptedFrameLineageId: nonEmpty(
      input.acceptedFrameLineageId,
      `${label}.acceptedFrameLineageId`,
    ),
    epochToken: nonEmpty(input.epochToken, `${label}.epochToken`),
    absoluteUtcMs: safeUtcMs(input.absoluteUtcMs, `${label}.absoluteUtcMs`),
    simulationSourceId: nonEmpty(input.simulationSourceId, `${label}.simulationSourceId`),
    primaryUeId: nonEmpty(input.primaryUeId, `${label}.primaryUeId`),
    profileConfigHash: nonEmpty(input.profileConfigHash, `${label}.profileConfigHash`),
    policyConfigHash: nonEmpty(input.policyConfigHash, `${label}.policyConfigHash`),
    continuityEpochId: nonEmpty(input.continuityEpochId, `${label}.continuityEpochId`),
    executionBudgetHash: nonEmpty(input.executionBudgetHash, `${label}.executionBudgetHash`),
  });
}

/**
 * Construct a collision-free serialized cache identity. The full ordered tuple
 * is retained as the Map key instead of relying on a short digest whose
 * collision could reuse scientific evidence for another candidate or model.
 */
export function createWalkerForecastCacheKey(
  input: WalkerForecastCacheKeyInput,
): WalkerForecastCacheKey {
  const continuity = continuityIdentity(input, 'Walker forecast cache key');
  const candidate = candidateLinkKey(input.candidate.satelliteId, input.candidate.beamId);
  const horizonSec = positiveFinite(input.horizonSec, 'Walker forecast cache key.horizonSec');
  const forecastSampleStepSec = positiveFinite(
    input.forecastSampleStepSec,
    'Walker forecast cache key.forecastSampleStepSec',
  );
  if (forecastSampleStepSec > horizonSec) {
    throw new RangeError('Walker forecast cache key.forecastSampleStepSec must not exceed horizonSec');
  }

  const normalized = {
    ...continuity,
    candidate,
    horizonSec,
    forecastSampleStepSec,
    modelVersion: nonEmpty(input.modelVersion, 'Walker forecast cache key.modelVersion'),
    canonicalContractVersion: nonEmpty(
      input.canonicalContractVersion,
      'Walker forecast cache key.canonicalContractVersion',
    ),
    geometryModelHash: nonEmpty(input.geometryModelHash, 'Walker forecast cache key.geometryModelHash'),
    scenarioStateHash: nonEmpty(input.scenarioStateHash, 'Walker forecast cache key.scenarioStateHash'),
    scheduleStateHash: nonEmpty(input.scheduleStateHash, 'Walker forecast cache key.scheduleStateHash'),
    assignmentStateHash: nonEmpty(input.assignmentStateHash, 'Walker forecast cache key.assignmentStateHash'),
    canonicalPowerStateHash: nonEmpty(
      input.canonicalPowerStateHash,
      'Walker forecast cache key.canonicalPowerStateHash',
    ),
    canonicalConfigHash: nonEmpty(input.canonicalConfigHash, 'Walker forecast cache key.canonicalConfigHash'),
    canonicalConfigurationProvenanceId: nonEmpty(
      input.canonicalConfigurationProvenanceId,
      'Walker forecast cache key.canonicalConfigurationProvenanceId',
    ),
    profileConfigHash: continuity.profileConfigHash,
    policyConfigHash: continuity.policyConfigHash,
    continuityEpochId: continuity.continuityEpochId,
    executionBudgetHash: continuity.executionBudgetHash,
  } satisfies WalkerForecastCacheKeyInput;
  const cacheId = `${WALKER_FORECAST_CACHE_KEY_VERSION}:${JSON.stringify([
    normalized.sourceFrameId,
    normalized.acceptedFrameLineageId,
    normalized.epochToken,
    normalized.absoluteUtcMs,
    normalized.simulationSourceId,
    normalized.primaryUeId,
    normalized.candidate.satelliteId,
    normalized.candidate.beamId,
    normalized.horizonSec,
    normalized.forecastSampleStepSec,
    normalized.modelVersion,
    normalized.canonicalContractVersion,
    normalized.geometryModelHash,
    normalized.scenarioStateHash,
    normalized.scheduleStateHash,
    normalized.assignmentStateHash,
    normalized.canonicalPowerStateHash,
    normalized.canonicalConfigHash,
    normalized.canonicalConfigurationProvenanceId,
    normalized.profileConfigHash,
    normalized.policyConfigHash,
    normalized.continuityEpochId,
    normalized.executionBudgetHash,
  ])}`;

  return Object.freeze({
    keyVersion: WALKER_FORECAST_CACHE_KEY_VERSION,
    ...normalized,
    cacheId,
  });
}

export function walkerForecastCacheKeyString(key: WalkerForecastCacheKey): string {
  const rebuilt = createWalkerForecastCacheKey(key);
  if (key.keyVersion !== WALKER_FORECAST_CACHE_KEY_VERSION || key.cacheId !== rebuilt.cacheId) {
    throw new TypeError('Walker forecast cache key does not match its canonical identity');
  }
  return key.cacheId;
}

/**
 * Classify whole-cache invalidation. A normal later accepted frame receives new
 * per-entry keys but does not clear the cache. Rewind/replacement and every
 * policy, source, profile, focus, continuity, or budget boundary fail closed.
 */
export function classifyWalkerForecastCacheReset(
  transition: WalkerForecastCacheTransition,
): WalkerForecastCacheResetClassification {
  const next = continuityIdentity(transition.next, 'Walker forecast cache transition.next');
  const declared = transition.declaredDiscontinuity ?? 'none';
  if (!(['none', 'accepted-frame-change', 'seek', 'loop-wrap'] as const).includes(declared)) {
    throw new TypeError('Walker forecast cache declaredDiscontinuity is invalid');
  }
  if (declared !== 'none') return Object.freeze({ reset: true, reason: declared });
  if (transition.previous === null) return Object.freeze({ reset: false, reason: null });

  const previous = continuityIdentity(
    transition.previous,
    'Walker forecast cache transition.previous',
  );
  if (previous.epochToken !== next.epochToken) {
    return Object.freeze({ reset: true, reason: 'epoch-change' });
  }
  if (previous.simulationSourceId !== next.simulationSourceId) {
    return Object.freeze({ reset: true, reason: 'source-change' });
  }
  if (previous.profileConfigHash !== next.profileConfigHash) {
    return Object.freeze({ reset: true, reason: 'profile-change' });
  }
  if (previous.primaryUeId !== next.primaryUeId) {
    return Object.freeze({ reset: true, reason: 'focus-change' });
  }
  if (previous.policyConfigHash !== next.policyConfigHash) {
    return Object.freeze({ reset: true, reason: 'policy-config-change' });
  }
  if (previous.continuityEpochId !== next.continuityEpochId) {
    return Object.freeze({ reset: true, reason: 'continuity-reset' });
  }
  if (previous.executionBudgetHash !== next.executionBudgetHash) {
    return Object.freeze({ reset: true, reason: 'execution-budget-change' });
  }
  if (previous.acceptedFrameLineageId !== next.acceptedFrameLineageId) {
    return Object.freeze({ reset: true, reason: 'accepted-frame-change' });
  }
  if (next.absoluteUtcMs < previous.absoluteUtcMs) {
    return Object.freeze({ reset: true, reason: 'seek' });
  }
  const identityAndTimeDisagree = (
    next.absoluteUtcMs === previous.absoluteUtcMs
      && next.sourceFrameId !== previous.sourceFrameId
  ) || (
    next.absoluteUtcMs !== previous.absoluteUtcMs
      && next.sourceFrameId === previous.sourceFrameId
  );
  if (identityAndTimeDisagree) {
    return Object.freeze({ reset: true, reason: 'accepted-frame-change' });
  }
  return Object.freeze({ reset: false, reason: null });
}
