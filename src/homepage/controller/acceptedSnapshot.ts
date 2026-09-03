import {
  buildAcceptedHandoverPresentationSession,
  type AcceptedHandoverPresentationSession,
} from '../../scene/acceptedHandoverPresentationSnapshot';
import type { CandidateLinkKey } from '../../engine/handover/candidateDecisionContract';
import type {
  HomepageAcceptedSnapshot,
  HomepageHandoverDecisionBoundary,
} from './contracts';

/** Keep policy identity construction at the existing snapshot authority. */
export {
  createHandoverPresentationPolicyConfigHash,
} from '../../scene/acceptedHandoverPresentationSnapshot';

export interface BuildHomepageAcceptedSnapshotInput {
  /** The one homepage decision boundary; no alternate decision source is accepted. */
  readonly decisionBoundary: HomepageHandoverDecisionBoundary;
  /** Already-resolved route policy identity from the existing configuration path. */
  readonly policyConfigHash: string;
  /** Inspection state only; the decision frame remains authoritative. */
  readonly pinnedKey?: CandidateLinkKey | null;
  /** Prior accepted snapshot used only by the existing identity/commit retention rules. */
  readonly previousSnapshot?: HomepageAcceptedSnapshot | null;
  /** Existing homepage presentation choice; never changes the decision set. */
  readonly displayAllHardEligibleCandidates?: boolean;
  /** Keep only candidates that passed the active homepage decision trigger. */
  readonly displayOnlyTriggerSatisfiedCandidates?: boolean;
  /** Existing profile-declared inventory, used only by the snapshot presenter. */
  readonly configuredBeamCount?: number;
}

export type HomepageAcceptedSnapshotInput = BuildHomepageAcceptedSnapshotInput;

function fail(message: string): never {
  throw new TypeError(`homepage accepted snapshot: ${message}`);
}

function requireNonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be non-empty`);
  }
  return value;
}

function assertDecisionBoundary(
  boundary: HomepageHandoverDecisionBoundary,
): void {
  if (boundary === null || typeof boundary !== 'object') {
    fail('decisionBoundary must be an object');
  }
  requireNonEmpty(boundary.sourceFrameId, 'decisionBoundary.sourceFrameId');
  requireNonEmpty(boundary.epochToken, 'decisionBoundary.epochToken');
  if (!Number.isFinite(boundary.simTimeMs) || boundary.simTimeMs < 0) {
    fail('decisionBoundary.simTimeMs must be a non-negative finite number');
  }

  if (boundary.decision === null) return;
  if (boundary.decision === undefined) fail('decisionBoundary.decision must be a decision or null');

  if (boundary.decision.sourceFrameId !== boundary.sourceFrameId) {
    fail('decision/sourceFrameId mismatch');
  }
  if (boundary.decision.epochToken !== boundary.epochToken) {
    fail('decision/epochToken mismatch');
  }
  if (boundary.decision.simTimeMs !== boundary.simTimeMs) {
    fail('decision/simTimeMs mismatch');
  }
  if (boundary.decision.phase !== boundary.phase) {
    fail('decision/phase mismatch');
  }
}

function assertAcceptedSnapshotMetadata(
  session: AcceptedHandoverPresentationSession,
  input: BuildHomepageAcceptedSnapshotInput,
): void {
  const snapshot = session.snapshot;
  const boundary = input.decisionBoundary;
  if (snapshot.sourceFrameId !== boundary.sourceFrameId) {
    fail('accepted snapshot/sourceFrameId mismatch');
  }
  if (snapshot.epochToken !== boundary.epochToken) {
    fail('accepted snapshot/epochToken mismatch');
  }
  if (snapshot.simTimeMs !== boundary.simTimeMs) {
    fail('accepted snapshot/simTimeMs mismatch');
  }
  if (snapshot.phase !== boundary.phase) {
    fail('accepted snapshot/phase mismatch');
  }
  if (snapshot.policyConfigHash !== input.policyConfigHash) {
    fail('accepted snapshot/policyConfigHash mismatch');
  }
  if (snapshot.decision !== boundary.decision || snapshot.plan.decision !== snapshot.decision) {
    fail('accepted snapshot must retain the boundary decision reference');
  }
}

function previousSnapshotFor(
  input: BuildHomepageAcceptedSnapshotInput,
): HomepageAcceptedSnapshot | null {
  const previous = input.previousSnapshot ?? null;
  if (previous !== null && previous.policyConfigHash !== input.policyConfigHash) {
    fail('previous snapshot/policyConfigHash mismatch');
  }
  const decision = input.decisionBoundary.decision;
  if (
    previous !== null
    && decision !== null
    && (
      previous.episodeId !== decision.episodeId
      || previous.epochToken !== input.decisionBoundary.epochToken
      || previous.simTimeMs > input.decisionBoundary.simTimeMs
    )
  ) {
    // A seek, loop-wrap, or new decision epoch is a new continuity domain.
    // Drop the prior identity/commit input rather than letting an unrelated
    // snapshot influence the next accepted publication.
    return null;
  }
  return previous;
}

/**
 * Adapt one homepage decision boundary to the existing immutable session.
 *
 * This is deliberately only a boundary check plus delegation.  The scene
 * snapshot module remains the owner of snapshot construction, policy fields,
 * phase/source-frame propagation, identity allocation, and scene/rail joins.
 */
export function buildHomepageAcceptedSnapshotSession(
  input: BuildHomepageAcceptedSnapshotInput,
): AcceptedHandoverPresentationSession | null {
  if (input === null || typeof input !== 'object') fail('input must be an object');
  assertDecisionBoundary(input.decisionBoundary);
  requireNonEmpty(input.policyConfigHash, 'policyConfigHash');
  if (input.decisionBoundary.decision === null) return null;

  const session = buildAcceptedHandoverPresentationSession({
    decision: input.decisionBoundary.decision,
    policyConfigHash: input.policyConfigHash,
    pinnedKey: input.pinnedKey ?? null,
    previousSnapshot: previousSnapshotFor(input),
    instantaneousEeActive: true,
    // The homepage publisher has historically used the compact, satellite-
    // centric presentation. Preserve that visual carrier while moving its
    // construction behind this boundary.
    displayAllHardEligibleCandidates: input.displayAllHardEligibleCandidates ?? false,
    displayOnlyTriggerSatisfiedCandidates: input.displayOnlyTriggerSatisfiedCandidates ?? false,
    ...(input.configuredBeamCount === undefined
      ? {}
      : { configuredBeamCount: input.configuredBeamCount }),
  });
  assertAcceptedSnapshotMetadata(session, input);
  return session;
}

/** Return the same accepted object published inside the canonical session. */
export function buildHomepageAcceptedSnapshot(
  input: BuildHomepageAcceptedSnapshotInput,
): HomepageAcceptedSnapshot | null {
  return buildHomepageAcceptedSnapshotSession(input)?.snapshot ?? null;
}
