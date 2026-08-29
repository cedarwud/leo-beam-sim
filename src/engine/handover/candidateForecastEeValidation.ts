import {
  candidateLinkKey,
  candidateLinkKeyString,
  createForecastEeEvidence,
  freezeCandidateOpportunity,
  sameCandidateLinkKey,
  type CandidateLinkKey,
  type ForecastEeEvidence,
} from './candidateDecisionContract';
import type { CandidateOpportunitySet } from './candidateOpportunityProducer';

export interface CandidateForecastEeValidationReceipt {
  readonly key: CandidateLinkKey;
  readonly evidence: ForecastEeEvidence;
}

/**
 * One cache publication for one accepted candidate-opportunity frame.
 *
 * This is deliberately presentation/validation evidence only. It carries no
 * policy switch and cannot change candidate gates, ordering, TTT, or service.
 */
export interface CandidateForecastEeValidationBatch {
  readonly primaryUeId: string;
  readonly sourceFrameId: string;
  readonly policyConfigHash: string;
  readonly receipts: readonly CandidateForecastEeValidationReceipt[];
}

function fail(message: string): never {
  throw new TypeError(`candidate Forecast-EE validation batch: ${message}`);
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be non-empty`);
  return value;
}

/**
 * Attach a complete validation-cache publication to one opportunity set.
 *
 * Receipts omitted from the batch become `null`, which prevents evidence from
 * a previous source frame or partial refresh from surviving accidentally.
 */
export function attachCandidateForecastEeValidation(
  opportunitySet: CandidateOpportunitySet,
  batch: CandidateForecastEeValidationBatch,
): CandidateOpportunitySet {
  const primaryUeId = nonEmpty(batch.primaryUeId, 'primaryUeId');
  const sourceFrameId = nonEmpty(batch.sourceFrameId, 'sourceFrameId');
  const policyConfigHash = nonEmpty(batch.policyConfigHash, 'policyConfigHash');
  if (opportunitySet.primaryUeId !== primaryUeId) fail('primaryUeId does not match the opportunity set');
  if (opportunitySet.sourceFrameId !== sourceFrameId) fail('sourceFrameId does not match the opportunity set');
  if (!Array.isArray(batch.receipts)) fail('receipts must be an array');

  const opportunityKeys = new Set(opportunitySet.opportunities.map(opportunity => {
    if (opportunity.primaryUeId !== primaryUeId || opportunity.sourceFrameId !== sourceFrameId) {
      fail('opportunity set contains mixed primary-UE or source-frame evidence');
    }
    return candidateLinkKeyString(opportunity.key);
  }));
  if (opportunityKeys.size !== opportunitySet.opportunities.length) {
    fail('opportunity set contains duplicate link identities');
  }

  const evidenceByKey = new Map<string, ForecastEeEvidence>();
  for (const receipt of batch.receipts) {
    const key = candidateLinkKey(receipt.key.satelliteId, receipt.key.beamId);
    const encoded = candidateLinkKeyString(key);
    if (!opportunityKeys.has(encoded)) fail(`receipt ${encoded} is absent from the opportunity set`);
    if (evidenceByKey.has(encoded)) fail(`duplicate receipt ${encoded}`);
    const evidence = createForecastEeEvidence(receipt.evidence);
    if (evidence.action !== null) {
      if (evidence.action.primaryUeId !== primaryUeId) fail(`receipt ${encoded} belongs to another primary UE`);
      if (!sameCandidateLinkKey(evidence.action.to, key)) fail(`receipt ${encoded} action target does not match its key`);
    }
    if (evidence.provenance !== null && evidence.provenance.policyConfigHash !== policyConfigHash) {
      fail(`receipt ${encoded} belongs to another policy configuration`);
    }
    evidenceByKey.set(encoded, evidence);
  }

  const opportunities = Object.freeze(opportunitySet.opportunities.map(opportunity => (
    freezeCandidateOpportunity({
      ...opportunity,
      forecastEe: evidenceByKey.get(candidateLinkKeyString(opportunity.key)) ?? null,
    })
  )));
  return Object.freeze({
    primaryUeId,
    sourceFrameId,
    opportunities,
    counts: opportunitySet.counts,
  });
}
