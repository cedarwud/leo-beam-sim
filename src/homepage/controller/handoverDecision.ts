import type {
  DecisionClockContext,
  HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';
import type { CandidateOpportunitySet } from '../../engine/handover/candidateOpportunityProducer';
import type { HandoverDecisionEngine } from '../../engine/handover/handoverDecisionEngine';
import type { HomepageHandoverDecisionBoundary } from './contracts';

/**
 * The homepage seam delegates to the already-owned decision engine.  Keeping
 * only `step` in this dependency prevents this adapter from constructing a
 * competing engine or exposing its mutable checkpoint state to the route.
 */
export type HomepageHandoverDecisionDelegate = Pick<HandoverDecisionEngine, 'step'>;

/**
 * Scientific identity and time for the one source frame being decided.
 * Previous-clock fields are intentionally absent: the decision engine owns
 * that continuity, while the source adapter owns the current frame identity.
 */
export type HomepageHandoverSourceIdentity = Pick<
  DecisionClockContext,
  'simTimeMs' | 'dtSec' | 'sourceFrameId' | 'epochToken' | 'discontinuity'
>;

export interface HomepageHandoverDecisionInput {
  readonly opportunitySet: CandidateOpportunitySet;
  readonly sourceIdentity: HomepageHandoverSourceIdentity;
}

export interface HomepageHandoverDecisionController {
  step(input: HomepageHandoverDecisionInput): HomepageHandoverDecisionBoundary;
}

function toDecisionClock(sourceIdentity: HomepageHandoverSourceIdentity): DecisionClockContext {
  // Construct a fresh clock context so callers cannot smuggle a second
  // previous-time cursor into the engine through an object alias.
  return {
    simTimeMs: sourceIdentity.simTimeMs,
    dtSec: sourceIdentity.dtSec,
    sourceFrameId: sourceIdentity.sourceFrameId,
    epochToken: sourceIdentity.epochToken,
    discontinuity: sourceIdentity.discontinuity,
  };
}

function assertSourceJoin(
  decision: HandoverDecisionFrame,
  sourceIdentity: HomepageHandoverSourceIdentity,
): void {
  if (decision.sourceFrameId !== sourceIdentity.sourceFrameId) {
    throw new Error('homepage decision and source identity must share one source frame');
  }
  if (decision.simTimeMs !== sourceIdentity.simTimeMs) {
    throw new Error('homepage decision and source identity must share one simulation time');
  }
  if (decision.epochToken !== sourceIdentity.epochToken) {
    throw new Error('homepage decision and source identity must share one epoch token');
  }
}

/**
 * Step the canonical decision engine for one homepage source frame.
 *
 * This module owns no measurement, ranking, TTT, commit, playback, or
 * presentation state.  The engine remains the sole decision authority; this
 * function only supplies the one opportunity set and carries its source
 * identity into the existing homepage contract.
 */
export function stepHomepageHandoverDecision(
  delegate: HomepageHandoverDecisionDelegate,
  input: HomepageHandoverDecisionInput,
): HomepageHandoverDecisionBoundary {
  const decision = delegate.step(input.opportunitySet, toDecisionClock(input.sourceIdentity));
  assertSourceJoin(decision, input.sourceIdentity);
  return Object.freeze({
    sourceFrameId: input.sourceIdentity.sourceFrameId,
    epochToken: input.sourceIdentity.epochToken,
    simTimeMs: input.sourceIdentity.simTimeMs,
    phase: decision.phase,
    decision,
  });
}

/**
 * Bind one existing engine to the homepage seam without allocating any
 * decision or clock state.  The integration owner keeps the engine lifetime.
 */
export function createHomepageHandoverDecisionController(
  delegate: HomepageHandoverDecisionDelegate,
): HomepageHandoverDecisionController {
  return Object.freeze({
    step: (input: HomepageHandoverDecisionInput) => stepHomepageHandoverDecision(delegate, input),
  });
}
