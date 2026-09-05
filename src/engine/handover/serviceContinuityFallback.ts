/**
 * Deterministic protection path for a serving pair that disappeared from a
 * candidate measurement frame.
 *
 * This is intentionally separate from the normal decision engine.  A missing
 * serving pair is not evidence that a new target won TTT or a selection hold;
 * it is a continuity hazard.  The protection path therefore accepts only a
 * currently measured, SINR-compatible pair and emits an explicit receipt.
 * It does not inspect forecast EE, throughput, or remaining-service forecasts.
 */

import { mintContinuityEePermit } from './eeCommitPermit';
import {
  candidateLinkKey,
  candidateLinkKeyString,
  compareCandidateLinkKey,
  createHandoverCommitReceipt,
  sameCandidateLinkKey,
  validateCandidateLinkKey,
  validateCandidateOpportunity,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type HandoverCommitReceipt,
} from './candidateDecisionContract';
import type { CandidateOpportunitySet } from './candidateOpportunityProducer';

/** Metadata copied from the authoritative simulation/decision clock. */
export interface ServiceContinuityFallbackClock {
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly simTimeMs: number;
}

export interface ServiceContinuityFallbackInput {
  /** The last committed primary serving pair. */
  readonly serving: CandidateLinkKey;
  /** The complete, same-frame candidate measurement set. */
  readonly opportunitySet: CandidateOpportunitySet;
  /** Optional teaching/readability floor shared with the normal selector. */
  readonly minimumDistinctCandidateSatellites?: number;
  /** Caller-owned episode and clock identity; never inferred here. */
  readonly clock: ServiceContinuityFallbackClock;
  /**
   * EE evidence for the serving link that vanished. Required, not optional.
   *
   * This lane used to rely on its caller having written
   * `if (servingBelowEeThreshold)` around the call. That is the shape SDD §2 F1
   * describes: the authority lives at the call site, so a second call site --
   * or an edit that drops the guard -- silently commits without it. The check
   * now lives here, and the parameter is required, so a caller that cannot
   * supply EE evidence cannot reach this lane at all.
   *
   * `servingEeBitsPerJoule` is null when the vanished link had no measurable
   * EE this frame; that is refused rather than treated as zero.
   */
  readonly servingEe: {
    readonly servingEeBitsPerJoule: number | null;
    readonly thresholdBitsPerJoule: number;
  };
}

/** The reason is deliberately explicit in the published receipt. */
export const SERVICE_CONTINUITY_FALLBACK_REASON =
  'serving pair is absent from the current candidate frame; selecting the highest-SINR safe continuity target';

const SINR_COMPATIBILITY_GATE_CODES = [
  'elevation',
  'steering',
  'scheduled-illumination',
  'sinr',
] as const;

type SinrCompatibilityGateCode = (typeof SINR_COMPATIBILITY_GATE_CODES)[number];

function nonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be non-empty`);
  }
  return value;
}

function nonNegative(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be finite and non-negative`);
  }
  return value;
}

function validateOpportunitySet(set: CandidateOpportunitySet): void {
  if (set === null || typeof set !== 'object') {
    throw new TypeError('candidate opportunity set must be an object');
  }
  nonEmpty(set.primaryUeId, 'candidate opportunity set primaryUeId');
  nonEmpty(set.sourceFrameId, 'candidate opportunity set sourceFrameId');
  if (!Array.isArray(set.opportunities)) {
    throw new TypeError('candidate opportunity set opportunities must be an array');
  }

  const seen = new Set<string>();
  for (const opportunity of set.opportunities) {
    validateCandidateOpportunity(opportunity);
    if (opportunity.primaryUeId !== set.primaryUeId) {
      throw new Error('candidate opportunity set contains mixed primary UE evidence');
    }
    if (opportunity.sourceFrameId !== set.sourceFrameId) {
      throw new Error('candidate opportunity set contains mixed source-frame evidence');
    }
    const key = candidateLinkKeyString(opportunity.key);
    if (seen.has(key)) throw new Error(`candidate opportunity set contains duplicate ${key}`);
    seen.add(key);
  }
}

function metricIsFiniteAndAvailable(
  opportunity: CandidateOpportunity,
  code: Exclude<SinrCompatibilityGateCode, 'scheduled-illumination'>,
): boolean {
  const metric = opportunity[code];
  return metric.status === 'available'
    && metric.value !== null
    && Number.isFinite(metric.value)
    && metric.sourceFrameId === opportunity.sourceFrameId;
}

/**
 * Apply the same four hard-gate semantics as the SINR compatibility policy.
 * Throughput, remaining service time, and forecast EE are deliberately not
 * consulted by this emergency continuity path.
 */
export function isSinrCompatibilityFallbackCandidate(
  opportunity: CandidateOpportunity,
): boolean {
  validateCandidateOpportunity(opportunity);
  const gateByCode = new Map(opportunity.gates.map(gate => [gate.code, gate] as const));

  for (const code of SINR_COMPATIBILITY_GATE_CODES) {
    const gate = gateByCode.get(code);
    if (gate === undefined || gate.result !== 'pass') return false;
    if (code === 'scheduled-illumination') {
      // A boolean schedule pass must carry the canonical positive evidence;
      // this mirrors the normal SINR policy's fail-closed check.
      if (gate.measured !== 1 || gate.threshold !== 1 || gate.unit !== 'boolean') return false;
      continue;
    }
    if (!metricIsFiniteAndAvailable(opportunity, code)) return false;
  }
  return true;
}

function compareFallbackCandidates(left: CandidateOpportunity, right: CandidateOpportunity): number {
  const leftSinr = left.sinr.value;
  const rightSinr = right.sinr.value;
  // The eligibility predicate guarantees both values are finite. Keep this
  // branch defensive so a future caller cannot make ordering nondeterministic.
  if (leftSinr !== null && rightSinr !== null && leftSinr !== rightSinr) {
    return rightSinr - leftSinr;
  }
  return compareCandidateLinkKey(left.key, right.key);
}

function validateInput(input: ServiceContinuityFallbackInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('service-continuity fallback input must be an object');
  }
  validateCandidateLinkKey(input.serving);
  validateOpportunitySet(input.opportunitySet);
  const minimumDistinctCandidateSatellites = input.minimumDistinctCandidateSatellites ?? 0;
  if (!Number.isSafeInteger(minimumDistinctCandidateSatellites)
    || minimumDistinctCandidateSatellites < 0) {
    throw new TypeError('minimumDistinctCandidateSatellites must be a non-negative safe integer');
  }
  nonEmpty(input.clock.episodeId, 'service-continuity fallback episodeId');
  nonEmpty(input.clock.sourceFrameId, 'service-continuity fallback sourceFrameId');
  nonNegative(input.clock.simTimeMs, 'service-continuity fallback simTimeMs');
  if (input.clock.sourceFrameId !== input.opportunitySet.sourceFrameId) {
    throw new Error('service-continuity fallback clock and opportunity set must share one source frame');
  }
}

/**
 * Select and receipt-commit a safe replacement only when the current serving
 * pair is absent.  A present serving pair returns null even if another pair
 * has stronger SINR: normal TTT/selection logic remains authoritative then.
 */
export function selectServiceContinuityFallback(
  input: ServiceContinuityFallbackInput,
): HandoverCommitReceipt | null {
  validateInput(input);

  const servingExists = input.opportunitySet.opportunities.some(opportunity =>
    sameCandidateLinkKey(opportunity.key, input.serving));
  if (servingExists) return null;

  const safeCandidates = input.opportunitySet.opportunities
    .filter(isSinrCompatibilityFallbackCandidate);
  const minimumDistinctCandidateSatellites = input.minimumDistinctCandidateSatellites ?? 0;
  if (minimumDistinctCandidateSatellites > 0) {
    const distinctSatelliteIds = new Set(safeCandidates.map(candidate => candidate.key.satelliteId));
    if (distinctSatelliteIds.size < minimumDistinctCandidateSatellites) return null;
  }
  // The serving link must actually be below the floor. A vanished pair is not
  // by itself permission to replace a link that was still healthy.
  // The vanished pair has no measurable target EE, so this lane cannot satisfy
  // the "target strictly better" half of the rule. It uses the continuity mint,
  // which records that absence on the permit instead of fabricating a
  // comparison -- an earlier version passed the threshold itself as the target
  // EE, which let the permit claim a measured comparison it never made.
  if (mintContinuityEePermit({
    path: 'live-cell:service-continuity-fallback',
    servingEeBitsPerJoule: input.servingEe.servingEeBitsPerJoule,
    thresholdBitsPerJoule: input.servingEe.thresholdBitsPerJoule,
  }) === null) {
    return null;
  }

  const target = safeCandidates.sort(compareFallbackCandidates)[0] ?? null;
  if (target === null || target.sinr.value === null || !Number.isFinite(target.sinr.value)) {
    return null;
  }

  const to = candidateLinkKey(target.key.satelliteId, target.key.beamId);
  return createHandoverCommitReceipt({
    episodeId: input.clock.episodeId,
    sourceFrameId: input.clock.sourceFrameId,
    simTimeMs: input.clock.simTimeMs,
    from: candidateLinkKey(input.serving.satelliteId, input.serving.beamId),
    to,
    kind: input.serving.satelliteId === to.satelliteId ? 'intra-satellite' : 'inter-satellite',
    mode: 'service-continuity-protection',
    reason: SERVICE_CONTINUITY_FALLBACK_REASON,
    oldLinkEnded: true,
    newLinkStarted: true,
  });
}
