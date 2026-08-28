import {
  allocateHandoverVisualIdentities,
  type HandoverVisualIdentityAllocation,
} from '../../constants/handoverVisualIdentity';
import type { CandidatePresentationPlan } from '../../engine/handover/candidatePresentationPlan';

export type CandidatePresentationIdentityConsumer = 'scene' | 'rail';

export interface CandidatePresentationIdentityLease {
  readonly episodeId: string;
  readonly simTimeMs: number;
  readonly servingSatelliteId: string | null;
  readonly satelliteIds: readonly string[];
  readonly beamIdsBySatellite: Readonly<Record<string, readonly number[]>>;
  readonly normalDisplayBudget: number;
}

export interface CandidatePresentationIdentityStore {
  readonly resolve: (
    consumer: CandidatePresentationIdentityConsumer,
    lease: CandidatePresentationIdentityLease,
  ) => HandoverVisualIdentityAllocation;
  readonly release: (
    consumer: CandidatePresentationIdentityConsumer,
    episodeId?: string,
  ) => void;
  readonly getCurrentAllocation: () => HandoverVisualIdentityAllocation | null;
  readonly reset: () => void;
}

function fail(message: string): never {
  throw new TypeError(`candidate presentation identity store: ${message}`);
}

function uniqueSortedStrings(values: readonly string[]): readonly string[] {
  const result = [...new Set(values)];
  result.sort((left, right) => left.localeCompare(right));
  return Object.freeze(result);
}

function normalizeLease(input: CandidatePresentationIdentityLease): CandidatePresentationIdentityLease {
  if (typeof input.episodeId !== 'string' || input.episodeId.trim().length === 0) {
    fail('episodeId must be a non-empty string');
  }
  if (!Number.isFinite(input.simTimeMs) || input.simTimeMs < 0) {
    fail('simTimeMs must be a non-negative finite number');
  }
  if (!Number.isInteger(input.normalDisplayBudget) || input.normalDisplayBudget <= 0) {
    fail('normalDisplayBudget must be a positive integer');
  }
  const satelliteIds = uniqueSortedStrings(input.satelliteIds);
  if (satelliteIds.length > input.normalDisplayBudget) {
    fail(`consumer lease contains ${satelliteIds.length} satellites for budget ${input.normalDisplayBudget}`);
  }
  const satelliteIdSet = new Set(satelliteIds);
  if (input.servingSatelliteId !== null && !satelliteIdSet.has(input.servingSatelliteId)) {
    fail(`serving satellite ${input.servingSatelliteId} is absent from its consumer lease`);
  }
  const beamIdsBySatellite: Record<string, readonly number[]> = {};
  for (const satelliteId of satelliteIds) {
    const beamIds = [...new Set(input.beamIdsBySatellite[satelliteId] ?? [])];
    for (const beamId of beamIds) {
      if (!Number.isInteger(beamId) || beamId < 0) fail(`invalid beam ID ${beamId} for ${satelliteId}`);
    }
    beamIds.sort((left, right) => left - right);
    beamIdsBySatellite[satelliteId] = Object.freeze(beamIds);
  }
  return Object.freeze({
    episodeId: input.episodeId,
    simTimeMs: input.simTimeMs,
    servingSatelliteId: input.servingSatelliteId,
    satelliteIds,
    beamIdsBySatellite: Object.freeze(beamIdsBySatellite),
    normalDisplayBudget: input.normalDisplayBudget,
  });
}

/**
 * Extract only the bounded presentation set. Scientific opportunities remain
 * in the decision frame and never reserve finite visual identity slots.
 */
export function candidatePresentationIdentityLeaseFromPlan(
  plan: CandidatePresentationPlan,
): CandidatePresentationIdentityLease {
  const beamIdsBySatellite: Record<string, number[]> = {};
  for (const link of plan.displayedLinks) {
    const beamIds = beamIdsBySatellite[link.satelliteId] ?? [];
    if (!beamIds.includes(link.beamId)) beamIds.push(link.beamId);
    beamIdsBySatellite[link.satelliteId] = beamIds;
  }
  return normalizeLease({
    episodeId: plan.decision.episodeId,
    simTimeMs: plan.decision.simTimeMs,
    servingSatelliteId: plan.decision.serving?.satelliteId ?? null,
    satelliteIds: plan.groups.map(group => group.satelliteId),
    beamIdsBySatellite,
    normalDisplayBudget: plan.budget.maxSatelliteGroups,
  });
}

function latestLease(
  leases: ReadonlyMap<CandidatePresentationIdentityConsumer, CandidatePresentationIdentityLease>,
): CandidatePresentationIdentityLease {
  const ordered = [...leases.entries()].sort((left, right) => {
    if (left[1].simTimeMs !== right[1].simTimeMs) return right[1].simTimeMs - left[1].simTimeMs;
    return left[0].localeCompare(right[0]);
  });
  const lease = ordered[0]?.[1];
  if (lease === undefined) fail('cannot resolve an empty lease set');
  return lease;
}

export function createCandidatePresentationIdentityStore(): CandidatePresentationIdentityStore {
  // Scene and rail intentionally publish at different cadences. Their visible
  // frames can therefore straddle a handover episode boundary for a short
  // period. Palette ownership must live at route scope, not episode scope, or
  // the same satellite can be recoloured while both snapshots remain visible.
  const ROUTE_IDENTITY_EPISODE_ID = 'homepage-candidate-presentation-route';
  const leases = new Map<CandidatePresentationIdentityConsumer, CandidatePresentationIdentityLease>();
  let routeAllocation: HandoverVisualIdentityAllocation | null = null;

  const recompute = (): HandoverVisualIdentityAllocation | null => {
    if (leases.size === 0) {
      // React 18 StrictMode replays all passive-effect cleanups before their
      // setups. Keep the last allocation as private palette memory across that
      // zero-lease gap; the next non-empty recompute prunes it to the new active
      // union through previousReservationSatelliteIds.
      return null;
    }
    const authoritativeLease = latestLease(leases);
    const satelliteIds = uniqueSortedStrings(
      [...leases.values()].flatMap(lease => lease.satelliteIds),
    );
    const beamIdsBySatellite: Record<string, number[]> = {};
    for (const lease of leases.values()) {
      for (const satelliteId of lease.satelliteIds) {
        const beamIds = beamIdsBySatellite[satelliteId] ?? [];
        for (const beamId of lease.beamIdsBySatellite[satelliteId] ?? []) {
          if (!beamIds.includes(beamId)) beamIds.push(beamId);
        }
        beamIdsBySatellite[satelliteId] = beamIds;
      }
    }
    for (const beamIds of Object.values(beamIdsBySatellite)) {
      beamIds.sort((left, right) => left - right);
    }
    routeAllocation = allocateHandoverVisualIdentities({
      episodeId: ROUTE_IDENTITY_EPISODE_ID,
      servingSatelliteId: authoritativeLease.servingSatelliteId,
      satelliteIds,
      beamIdsBySatellite,
      normalDisplayBudget: Math.max(...[...leases.values()].map(lease => lease.normalDisplayBudget)),
      previousAllocation: routeAllocation,
      previousReservationSatelliteIds: satelliteIds,
    });
    const visibleColors = routeAllocation.identities.map(identity => identity.cssColor);
    if (routeAllocation.overflowSatelliteIds.length > 0
      || new Set(visibleColors).size !== visibleColors.length) {
      fail(
        `active scene/rail union of ${satelliteIds.length} satellites exceeds the collision-free palette capacity ${routeAllocation.paletteCapacity}`,
      );
    }
    return routeAllocation;
  };

  const projectForLease = (
    allocation: HandoverVisualIdentityAllocation,
    lease: CandidatePresentationIdentityLease,
  ): HandoverVisualIdentityAllocation => {
    const orderedSatelliteIds = Object.freeze([
      ...(lease.servingSatelliteId === null ? [] : [lease.servingSatelliteId]),
      ...lease.satelliteIds.filter(satelliteId => satelliteId !== lease.servingSatelliteId),
    ]);
    const identities = Object.freeze(orderedSatelliteIds.map(satelliteId => {
      const identity = allocation.identitiesBySatelliteId[satelliteId];
      if (identity === undefined) fail(`route allocation is missing satellite ${satelliteId}`);
      return identity;
    }));
    const identitiesBySatelliteId = Object.freeze(Object.fromEntries(
      identities.map(identity => [identity.satelliteId, identity]),
    ));
    const beamIdentitiesBySatelliteId = Object.freeze(Object.fromEntries(
      orderedSatelliteIds.map(satelliteId => [
        satelliteId,
        allocation.beamIdentitiesBySatelliteId[satelliteId] ?? Object.freeze({}),
      ]),
    ));
    const currentSatelliteIds = new Set(orderedSatelliteIds);
    return Object.freeze({
      ...allocation,
      episodeId: lease.episodeId,
      servingSatelliteId: lease.servingSatelliteId,
      orderedSatelliteIds,
      normalDisplayBudget: lease.normalDisplayBudget,
      identities,
      identitiesBySatelliteId,
      overflowSatelliteIds: Object.freeze(
        identities.filter(identity => identity.isOverflow).map(identity => identity.satelliteId),
      ),
      reservedSatelliteIds: Object.freeze(
        Object.keys(allocation.assignments)
          .filter(satelliteId => !currentSatelliteIds.has(satelliteId))
          .sort((left, right) => left.localeCompare(right)),
      ),
      beamIdentitiesBySatelliteId,
    });
  };

  const releaseConsumer = (
    consumer: CandidatePresentationIdentityConsumer,
    expectedEpisodeId?: string,
  ): void => {
    const activeLease = leases.get(consumer);
    if (activeLease === undefined) return;
    if (expectedEpisodeId !== undefined && activeLease.episodeId !== expectedEpisodeId) {
      return;
    }
    leases.delete(consumer);
    recompute();
  };

  return Object.freeze({
    resolve: (
      consumer: CandidatePresentationIdentityConsumer,
      input: CandidatePresentationIdentityLease,
    ) => {
      const lease = normalizeLease(input);
      leases.set(consumer, lease);
      const resolved = recompute();
      if (resolved === null) fail('resolve unexpectedly produced no allocation');
      return projectForLease(resolved, lease);
    },
    release: releaseConsumer,
    getCurrentAllocation: () => leases.size === 0 ? null : routeAllocation,
    reset: () => {
      leases.clear();
      routeAllocation = null;
    },
  });
}

export const homepageCandidatePresentationIdentityStore = createCandidatePresentationIdentityStore();
