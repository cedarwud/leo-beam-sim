import {
  classifyWalkerForecastCacheReset,
  walkerForecastCacheKeyString,
  type WalkerForecastCacheContinuityInput,
  type WalkerForecastCacheKey,
  type WalkerForecastCacheResetClassification,
  type WalkerForecastDeclaredDiscontinuity,
} from './walkerForecastCache';

export const WALKER_FORECAST_EXECUTION_BUDGET_VERSION =
  'walker-forecast-execution-budget-v1' as const;

export interface WalkerForecastExecutionBudgetInput {
  readonly budgetId: string;
  readonly maxEntries: number;
  readonly maxComputationsPerRefresh: number;
  readonly maxConcurrentComputations: number;
}

export interface WalkerForecastExecutionBudget extends WalkerForecastExecutionBudgetInput {
  readonly budgetVersion: typeof WALKER_FORECAST_EXECUTION_BUDGET_VERSION;
  /** Full collision-free tuple identity used by WalkerForecastCacheKey. */
  readonly executionBudgetHash: string;
}

export interface WalkerForecastRefreshInput {
  readonly refreshId: string;
  readonly continuity: WalkerForecastCacheContinuityInput;
  readonly declaredDiscontinuity?: WalkerForecastDeclaredDiscontinuity;
}

export interface WalkerForecastRefreshReceipt {
  readonly refreshId: string;
  readonly generation: number;
  readonly reset: WalkerForecastCacheResetClassification;
  readonly invalidatedInFlightCount: number;
}

export interface WalkerForecastComputationLease {
  readonly leaseId: string;
  readonly refreshId: string;
  readonly generation: number;
  readonly cacheId: string;
}

export type WalkerForecastExecutionUnavailableCode =
  | 'already-computing'
  | 'concurrency-budget-exhausted'
  | 'refresh-compute-budget-exhausted'
  | 'key-context-mismatch';

export type WalkerForecastCacheAcquireResult<T> =
  | Readonly<{
      status: 'hit';
      cacheId: string;
      value: T;
    }>
  | Readonly<{
      status: 'compute';
      cacheId: string;
      lease: WalkerForecastComputationLease;
    }>
  | Readonly<{
      status: 'unavailable';
      cacheId: string;
      code: WalkerForecastExecutionUnavailableCode;
      detail: string;
    }>;

export type WalkerForecastCachePublishResult =
  | Readonly<{ status: 'committed'; cacheId: string; evictedCacheId: string | null }>
  | Readonly<{
      status: 'rejected';
      cacheId: string;
      code: 'stale-lease' | 'unknown-lease';
      detail: string;
    }>;

export interface WalkerForecastExecutionCacheSnapshot {
  readonly budget: WalkerForecastExecutionBudget;
  readonly activeRefreshId: string | null;
  readonly generation: number;
  readonly entryCount: number;
  readonly inFlightCount: number;
  readonly computationsThisRefresh: number;
  readonly cacheIdsLeastToMostRecent: readonly string[];
}

interface CacheEntry<T> {
  readonly key: WalkerForecastCacheKey;
  readonly value: T;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be non-empty`);
  }
  return value;
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function continuityTuple(input: WalkerForecastCacheContinuityInput): readonly unknown[] {
  return [
    input.sourceFrameId,
    input.acceptedFrameLineageId,
    input.epochToken,
    input.absoluteUtcMs,
    input.simulationSourceId,
    input.primaryUeId,
    input.profileConfigHash,
    input.policyConfigHash,
    input.continuityEpochId,
    input.executionBudgetHash,
  ];
}

function normalizeContinuity(
  input: WalkerForecastCacheContinuityInput,
): WalkerForecastCacheContinuityInput {
  // The reset classifier is also the canonical fail-closed validator for this
  // tuple. With no previous frame it performs validation without requesting a
  // reset or mutating any store state.
  classifyWalkerForecastCacheReset({ previous: null, next: input });
  return Object.freeze({ ...input });
}

function sameContinuity(
  left: WalkerForecastCacheContinuityInput,
  right: WalkerForecastCacheContinuityInput,
): boolean {
  return JSON.stringify(continuityTuple(left)) === JSON.stringify(continuityTuple(right));
}

function requireImmutablePublishedValue<T>(value: T): void {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    throw new TypeError('Walker forecast cache values must be immutable published objects');
  }
}

export function createWalkerForecastExecutionBudget(
  input: WalkerForecastExecutionBudgetInput,
): WalkerForecastExecutionBudget {
  const budgetId = nonEmpty(input.budgetId, 'Walker forecast execution budget.budgetId');
  const maxEntries = positiveSafeInteger(
    input.maxEntries,
    'Walker forecast execution budget.maxEntries',
  );
  const maxComputationsPerRefresh = positiveSafeInteger(
    input.maxComputationsPerRefresh,
    'Walker forecast execution budget.maxComputationsPerRefresh',
  );
  const maxConcurrentComputations = positiveSafeInteger(
    input.maxConcurrentComputations,
    'Walker forecast execution budget.maxConcurrentComputations',
  );
  if (maxConcurrentComputations > maxComputationsPerRefresh) {
    throw new RangeError(
      'Walker forecast execution budget.maxConcurrentComputations must not exceed maxComputationsPerRefresh',
    );
  }
  const executionBudgetHash =
    `${WALKER_FORECAST_EXECUTION_BUDGET_VERSION}:${JSON.stringify([
      budgetId,
      maxEntries,
      maxComputationsPerRefresh,
      maxConcurrentComputations,
    ])}`;
  return Object.freeze({
    budgetVersion: WALKER_FORECAST_EXECUTION_BUDGET_VERSION,
    budgetId,
    maxEntries,
    maxComputationsPerRefresh,
    maxConcurrentComputations,
    executionBudgetHash,
  });
}

/**
 * Bounded validation-only cache/execution coordinator.
 *
 * Refresh cadence remains caller-owned: `beginRefresh` must be called only at
 * an accepted forecast refresh, never from render FPS. A granted lease consumes
 * one computation from that refresh even if the caller later abandons it.
 * Cache hits consume neither computation nor concurrency budget.
 */
export class WalkerForecastExecutionCache<T> {
  readonly budget: WalkerForecastExecutionBudget;

  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, WalkerForecastComputationLease>();
  private activeRefreshId: string | null = null;
  private activeContinuity: WalkerForecastCacheContinuityInput | null = null;
  private activeDeclaredDiscontinuity: WalkerForecastDeclaredDiscontinuity = 'none';
  private generation = 0;
  private leaseSequence = 0;
  private computationsThisRefresh = 0;

  constructor(budget: WalkerForecastExecutionBudgetInput) {
    this.budget = createWalkerForecastExecutionBudget(budget);
  }

  beginRefresh(input: WalkerForecastRefreshInput): WalkerForecastRefreshReceipt {
    const refreshId = nonEmpty(input.refreshId, 'Walker forecast refresh.refreshId');
    const continuity = normalizeContinuity(input.continuity);
    const declaredDiscontinuity = input.declaredDiscontinuity ?? 'none';
    if (continuity.executionBudgetHash !== this.budget.executionBudgetHash) {
      throw new RangeError(
        'Walker forecast refresh continuity.executionBudgetHash does not match the active budget',
      );
    }
    if (this.activeRefreshId === refreshId) {
      if (
        this.activeContinuity === null
        || !sameContinuity(this.activeContinuity, continuity)
        || this.activeDeclaredDiscontinuity !== declaredDiscontinuity
      ) {
        throw new Error(
          'Walker forecast refreshId cannot be reused with different continuity or discontinuity',
        );
      }
      return Object.freeze({
        refreshId,
        generation: this.generation,
        reset: Object.freeze({ reset: false, reason: null }),
        invalidatedInFlightCount: 0,
      });
    }

    const reset = classifyWalkerForecastCacheReset({
      previous: this.activeContinuity,
      next: continuity,
      declaredDiscontinuity,
    });
    const invalidatedInFlightCount = this.inFlight.size;
    this.generation += 1;
    this.activeRefreshId = refreshId;
    this.activeContinuity = continuity;
    this.activeDeclaredDiscontinuity = declaredDiscontinuity;
    this.computationsThisRefresh = 0;
    this.inFlight.clear();
    if (reset.reset) this.entries.clear();

    return Object.freeze({
      refreshId,
      generation: this.generation,
      reset,
      invalidatedInFlightCount,
    });
  }

  acquire(key: WalkerForecastCacheKey): WalkerForecastCacheAcquireResult<T> {
    if (this.activeRefreshId === null || this.activeContinuity === null) {
      throw new Error('Walker forecast execution cache requires beginRefresh before acquire');
    }
    const cacheId = walkerForecastCacheKeyString(key);
    if (
      key.executionBudgetHash !== this.budget.executionBudgetHash
      || JSON.stringify(continuityTuple(key)) !== JSON.stringify(continuityTuple(this.activeContinuity))
    ) {
      return Object.freeze({
        status: 'unavailable',
        cacheId,
        code: 'key-context-mismatch',
        detail: 'cache key does not belong to the active accepted-frame continuity and execution budget',
      });
    }

    const cached = this.entries.get(cacheId);
    if (cached !== undefined) {
      // Map insertion order is the bounded LRU order. Touch an exact hit.
      this.entries.delete(cacheId);
      this.entries.set(cacheId, cached);
      return Object.freeze({ status: 'hit', cacheId, value: cached.value });
    }
    if (this.inFlight.has(cacheId)) {
      return Object.freeze({
        status: 'unavailable',
        cacheId,
        code: 'already-computing',
        detail: 'the exact forecast key already has an in-flight computation',
      });
    }
    if (this.computationsThisRefresh >= this.budget.maxComputationsPerRefresh) {
      return Object.freeze({
        status: 'unavailable',
        cacheId,
        code: 'refresh-compute-budget-exhausted',
        detail: 'the accepted refresh has used its bounded forecast computation budget',
      });
    }
    if (this.inFlight.size >= this.budget.maxConcurrentComputations) {
      return Object.freeze({
        status: 'unavailable',
        cacheId,
        code: 'concurrency-budget-exhausted',
        detail: 'the bounded forecast concurrency budget is currently full',
      });
    }

    this.computationsThisRefresh += 1;
    this.leaseSequence += 1;
    const lease = Object.freeze({
      leaseId: `walker-forecast-lease:${this.generation}:${this.leaseSequence}`,
      refreshId: this.activeRefreshId,
      generation: this.generation,
      cacheId,
    });
    this.inFlight.set(cacheId, lease);
    return Object.freeze({ status: 'compute', cacheId, lease });
  }

  publish(lease: WalkerForecastComputationLease, key: WalkerForecastCacheKey, value: T): WalkerForecastCachePublishResult {
    const cacheId = walkerForecastCacheKeyString(key);
    const activeLease = this.inFlight.get(cacheId);
    if (activeLease === undefined || activeLease.leaseId !== lease.leaseId) {
      return Object.freeze({
        status: 'rejected',
        cacheId,
        code: 'unknown-lease',
        detail: 'the forecast lease is not active for this cache key',
      });
    }
    if (
      lease.cacheId !== cacheId
      || lease.generation !== this.generation
      || lease.refreshId !== this.activeRefreshId
    ) {
      this.inFlight.delete(cacheId);
      return Object.freeze({
        status: 'rejected',
        cacheId,
        code: 'stale-lease',
        detail: 'the forecast lease belongs to an earlier accepted refresh',
      });
    }

    requireImmutablePublishedValue(value);

    this.inFlight.delete(cacheId);
    this.entries.delete(cacheId);
    this.entries.set(cacheId, { key, value });
    let evictedCacheId: string | null = null;
    while (this.entries.size > this.budget.maxEntries) {
      evictedCacheId = this.entries.keys().next().value as string | undefined ?? null;
      if (evictedCacheId === null) break;
      this.entries.delete(evictedCacheId);
    }
    return Object.freeze({ status: 'committed', cacheId, evictedCacheId });
  }

  abandon(lease: WalkerForecastComputationLease): boolean {
    const active = this.inFlight.get(lease.cacheId);
    if (
      active === undefined
      || active.leaseId !== lease.leaseId
      || lease.generation !== this.generation
      || lease.refreshId !== this.activeRefreshId
    ) {
      return false;
    }
    this.inFlight.delete(lease.cacheId);
    return true;
  }

  snapshot(): WalkerForecastExecutionCacheSnapshot {
    return Object.freeze({
      budget: this.budget,
      activeRefreshId: this.activeRefreshId,
      generation: this.generation,
      entryCount: this.entries.size,
      inFlightCount: this.inFlight.size,
      computationsThisRefresh: this.computationsThisRefresh,
      cacheIdsLeastToMostRecent: Object.freeze([...this.entries.keys()]),
    });
  }
}
