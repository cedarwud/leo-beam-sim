import { useEffect, useMemo } from 'react';

import type { CandidateLinkKey, HandoverDecisionFrame } from '../../engine/handover/candidateDecisionContract';
import {
  buildCandidatePresentationPlan,
  type CandidatePresentationPlan,
} from '../../engine/handover/candidatePresentationPlan';
import {
  candidatePresentationIdentityLeaseFromPlan,
  homepageCandidatePresentationIdentityStore,
  type CandidatePresentationIdentityConsumer,
} from './candidatePresentationIdentityStore';

/**
 * One route-scoped plan pipeline for both the high-cadence scene and throttled
 * right rail. The store leases the active union, so finite palette slots are
 * neither consumed by hidden science records nor allocated on separate paths.
 */
export function useHomepageCandidatePresentationPlan(
  consumer: CandidatePresentationIdentityConsumer,
  decision: HandoverDecisionFrame,
  pinnedKey: CandidateLinkKey | null,
): CandidatePresentationPlan;
export function useHomepageCandidatePresentationPlan(
  consumer: CandidatePresentationIdentityConsumer,
  decision: null,
  pinnedKey: CandidateLinkKey | null,
): null;
export function useHomepageCandidatePresentationPlan(
  consumer: CandidatePresentationIdentityConsumer,
  decision: HandoverDecisionFrame | null,
  pinnedKey: CandidateLinkKey | null,
): CandidatePresentationPlan | null;
export function useHomepageCandidatePresentationPlan(
  consumer: CandidatePresentationIdentityConsumer,
  decision: HandoverDecisionFrame | null,
  pinnedKey: CandidateLinkKey | null,
): CandidatePresentationPlan | null {
  const draft = useMemo(
    () => decision === null
      ? null
      : buildCandidatePresentationPlan(decision, undefined, { pinnedKey }),
    [decision, pinnedKey],
  );
  const lease = useMemo(
    () => draft === null ? null : candidatePresentationIdentityLeaseFromPlan(draft),
    [draft],
  );
  const sharedAllocation = useMemo(
    () => lease === null
      ? null
      : homepageCandidatePresentationIdentityStore.resolve(consumer, lease),
    [consumer, lease],
  );

  useEffect(() => {
    if (lease === null) return undefined;
    // Re-register during StrictMode's effect replay after its synthetic cleanup.
    homepageCandidatePresentationIdentityStore.resolve(consumer, lease);
    return () => homepageCandidatePresentationIdentityStore.release(consumer, lease.episodeId);
  }, [consumer, lease?.episodeId]);

  return useMemo(() => {
    if (decision === null || sharedAllocation === null) return null;
    return buildCandidatePresentationPlan(decision, undefined, {
      pinnedKey,
      identityAllocation: sharedAllocation,
    });
  }, [decision, pinnedKey, sharedAllocation]);
}
