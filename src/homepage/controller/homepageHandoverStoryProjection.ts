import {
  candidateLinkKey,
  candidateLinkKeyString,
  sameCandidateLinkKey,
  type CandidateLinkKey,
  type CandidateDecisionState,
  type MetricEvidence,
} from '../../engine/handover/candidateDecisionContract';
import type {
  HomepageAcceptedSnapshot,
  HomepageBeamMetricsProjection,
  HomepageHandoverStoryCellExample,
  HomepageHandoverStoryProjection,
  HomepageHandoverStorySelectionStatus,
} from './contracts';

export interface ProjectHomepageHandoverStoryInput {
  readonly snapshot: HomepageAcceptedSnapshot;
  /** Retained at the rail seam; story EE never comes from this projection. */
  readonly beamMetrics?: HomepageBeamMetricsProjection | null;
  /** The serving layout control is also the homepage scene-cell example. */
  readonly configuredCellCount?: number | null;
  /**
   * The immediately preceding accepted publication, when this is a
   * monotonic same-episode transition. It is a continuity source only; the
   * current snapshot still owns pair identity, phase, and selection.
   */
  readonly previousSnapshot?: HomepageAcceptedSnapshot | null;
  /** Retained for compatibility; accepted handover evidence is authoritative. */
  readonly previousBeamMetrics?: HomepageBeamMetricsProjection | null;
  /** Optional prior accepted story used only to retain the winner witness. */
  readonly previousStory?: HomepageHandoverStoryProjection | null;
}

function copyKey(key: CandidateLinkKey): CandidateLinkKey {
  return candidateLinkKey(key.satelliteId, key.beamId);
}

function finiteMetricEvidence(evidence: MetricEvidence | undefined): number | null {
  if (evidence?.status !== 'available' || evidence.value === null) return null;
  return Number.isFinite(evidence.value) && evidence.value >= 0 ? evidence.value : null;
}

function canRetainFromPreviousSnapshot(
  snapshot: HomepageAcceptedSnapshot,
  previousSnapshot: HomepageAcceptedSnapshot | null | undefined,
): previousSnapshot is HomepageAcceptedSnapshot {
  return previousSnapshot !== null
    && previousSnapshot !== undefined
    && previousSnapshot.episodeId === snapshot.episodeId
    && previousSnapshot.epochToken === snapshot.epochToken
    && previousSnapshot.policyConfigHash === snapshot.policyConfigHash
    && previousSnapshot.simTimeMs <= snapshot.simTimeMs;
}

function evidenceMatchesPair(
  evidence: HomepageAcceptedSnapshot['handoverEvidence'],
  pair: { readonly source: CandidateLinkKey; readonly target: CandidateLinkKey },
): evidence is NonNullable<HomepageAcceptedSnapshot['handoverEvidence']> {
  if (evidence === null || evidence === undefined) return false;
  const expectedKind = pair.source.satelliteId === pair.target.satelliteId
    ? 'intra-satellite'
    : 'inter-satellite';
  return evidence.source !== null
    && sameCandidateLinkKey(evidence.source, pair.source)
    && sameCandidateLinkKey(evidence.target, pair.target)
    && evidence.kind === expectedKind;
}

function acceptedEvidenceForPair(
  snapshot: HomepageAcceptedSnapshot,
  pair: { readonly source: CandidateLinkKey; readonly target: CandidateLinkKey },
  previousSnapshot: HomepageAcceptedSnapshot | null | undefined,
): NonNullable<HomepageAcceptedSnapshot['handoverEvidence']> | null {
  // The current accepted snapshot is authoritative, including an explicit
  // unavailable/stale endpoint. Only a completely omitted evidence object may
  // use the immediately preceding accepted snapshot as continuity.
  const currentEvidence = evidenceMatchesPair(snapshot.handoverEvidence, pair)
    ? snapshot.handoverEvidence
    : null;
  if (snapshot.handoverEvidence !== null
    && snapshot.handoverEvidence !== undefined
    && currentEvidence === null) return null;
  if (!canRetainFromPreviousSnapshot(snapshot, previousSnapshot)) return currentEvidence;

  const previousEvidence = evidenceMatchesPair(previousSnapshot.handoverEvidence, pair)
    ? previousSnapshot.handoverEvidence
    : null;
  if (currentEvidence === null) return previousEvidence;
  if (previousEvidence === null) return currentEvidence;

  // The accepted snapshot may carry the pair identity while one or both
  // endpoint measurements are omitted at the commit boundary. Join only the
  // omitted fields from the immediately preceding accepted evidence; an
  // explicit unavailable/stale/invalid field remains current truth.
  if (currentEvidence.sourceEe !== undefined && currentEvidence.targetEe !== undefined) {
    return currentEvidence;
  }
  return Object.freeze({
    ...currentEvidence,
    sourceEe: currentEvidence.sourceEe ?? previousEvidence.sourceEe,
    targetEe: currentEvidence.targetEe ?? previousEvidence.targetEe,
  });
}

function finiteAcceptedHandoverEvidenceEe(
  key: CandidateLinkKey,
  evidence: NonNullable<HomepageAcceptedSnapshot['handoverEvidence']> | null,
  pair: { readonly source: CandidateLinkKey; readonly target: CandidateLinkKey },
): number | null {
  // A missing evidence object, an unavailable endpoint, and a mismatched
  // evidence pair all remain unavailable. No newer measurement can replace
  // the accepted transition evidence here.
  if (evidence === null || evidence === undefined) return null;

  if (!evidenceMatchesPair(evidence, pair)) return null;

  if (evidence.source !== null && sameCandidateLinkKey(key, evidence.source)) {
    return finiteMetricEvidence(evidence.sourceEe);
  }
  if (sameCandidateLinkKey(key, evidence.target)) {
    return finiteMetricEvidence(evidence.targetEe);
  }
  return null;
}

function cellExampleFor(count: 1 | 7 | 19): HomepageHandoverStoryCellExample {
  if (count === 1) return 'one-cell';
  if (count === 7) return 'seven-cell';
  return 'nineteen-cell';
}

function normalizeCellCount(value: number | null | undefined): 1 | 7 | 19 {
  if (value === 1 || value === 7 || value === 19) return value;
  return 7;
}

function stateByKey(
  states: readonly CandidateDecisionState[],
): ReadonlyMap<string, CandidateDecisionState> {
  return new Map(states.map(state => [candidateLinkKeyString(state.key), state] as const));
}

function retainedCommitTarget(
  snapshot: HomepageAcceptedSnapshot,
): { readonly from: CandidateLinkKey; readonly to: CandidateLinkKey } | null {
  const commit = snapshot.commit;
  if (commit === null || commit.from === null) return null;
  if (snapshot.decision.serving === null || !sameCandidateLinkKey(commit.to, snapshot.decision.serving)) {
    return null;
  }
  return { from: copyKey(commit.from), to: copyKey(commit.to) };
}

function resolvePair(snapshot: HomepageAcceptedSnapshot): {
  readonly source: CandidateLinkKey;
  readonly target: CandidateLinkKey;
  readonly status: HomepageHandoverStorySelectionStatus;
} | null {
  const decision = snapshot.decision;
  // A commit on the accepted decision is already the transition authority.
  // Do not let stale selected/provisional fields mask its source/target pair.
  if (decision.recentCommit !== null) {
    const committed = retainedCommitTarget(snapshot);
    return committed === null
      ? null
      : { source: committed.from, target: committed.to, status: 'committed' };
  }
  // The accepted decision owns whether a target is active. In particular, do
  // not let a retained commit hide a provisional/selected target during a
  // qualifying, TTT, selection-hold, or switching publication.
  const activeTarget = decision.selectedTarget ?? decision.provisionalLeader;
  if (activeTarget !== null) {
    if (decision.serving === null) return null;
    const targetState = decision.states.find(state => sameCandidateLinkKey(state.key, activeTarget));
    return {
      source: copyKey(decision.serving),
      target: copyKey(activeTarget),
      status: decision.selectedTarget !== null
        ? 'selected'
        : targetState?.stable === true
          ? 'ttt-stable'
          : 'qualified',
    };
  }

  const retained = retainedCommitTarget(snapshot);
  if (retained !== null) {
    return {
      source: retained.from,
      target: retained.to,
      status: 'committed',
    };
  }

  return null;
}

function storyMatchesPair(
  story: HomepageHandoverStoryProjection | null | undefined,
  pair: { readonly source: CandidateLinkKey; readonly target: CandidateLinkKey },
): story is HomepageHandoverStoryProjection {
  return story !== null
    && story !== undefined
    && sameCandidateLinkKey(story.source, pair.source)
    && sameCandidateLinkKey(story.target, pair.target);
}

function acceptedPreviousStory(
  snapshot: HomepageAcceptedSnapshot,
  pair: { readonly source: CandidateLinkKey; readonly target: CandidateLinkKey },
  previousSnapshot: HomepageAcceptedSnapshot | null | undefined,
  previousStory: HomepageHandoverStoryProjection | null | undefined,
): HomepageHandoverStoryProjection | null {
  if (!storyMatchesPair(previousStory, pair)) return null;
  if (previousSnapshot === null || previousSnapshot === undefined) return null;
  if (!canRetainFromPreviousSnapshot(snapshot, previousSnapshot)) return null;
  return previousStory.snapshotId === previousSnapshot.snapshotId
    && previousStory.sourceFrameId === previousSnapshot.sourceFrameId
    ? previousStory
    : null;
}

function previousSnapshotSupportsWinner(
  snapshot: HomepageAcceptedSnapshot,
  pair: { readonly source: CandidateLinkKey; readonly target: CandidateLinkKey },
  previousSnapshot: HomepageAcceptedSnapshot | null | undefined,
): boolean {
  if (!canRetainFromPreviousSnapshot(snapshot, previousSnapshot)) return false;
  const previousPair = resolvePair(previousSnapshot);
  return previousPair !== null
    && sameCandidateLinkKey(previousPair.source, pair.source)
    && sameCandidateLinkKey(previousPair.target, pair.target)
    && previousSnapshot.decision.states.some(state => (
      sameCandidateLinkKey(state.key, pair.target) && state.rank === 1
    ));
}

/**
 * Join the accepted decision's selected/provisional pair with instantaneous EE.
 * No candidate is created, re-ranked for control, or committed here. A target is
 * labelled as selected by the maximum instantaneous-EE criterion only when
 * the accepted decision has the canonical
 * instantaneous-EE objective, its rank-one target and all required same-frame
 * evidence are finite. The projection never re-ranks candidate evidence.
 */
export function projectHomepageHandoverStory(
  input: ProjectHomepageHandoverStoryInput,
): HomepageHandoverStoryProjection | null {
  const { snapshot } = input;
  const pair = resolvePair(snapshot);
  if (pair === null || sameCandidateLinkKey(pair.source, pair.target)) return null;

  const decision = snapshot.decision;
  const states = stateByKey(decision.states);
  const previousStory = acceptedPreviousStory(
    snapshot,
    pair,
    input.previousSnapshot,
    input.previousStory,
  );
  const acceptedEvidence = acceptedEvidenceForPair(snapshot, pair, input.previousSnapshot);
  const targetEe = finiteAcceptedHandoverEvidenceEe(pair.target, acceptedEvidence, pair);
  const sourceEe = finiteAcceptedHandoverEvidenceEe(pair.source, acceptedEvidence, pair);
  const targetState = states.get(candidateLinkKeyString(pair.target));
  const hasCanonicalInstantaneousEeObjective = snapshot.policyMode === 'instantaneous-ee-optimization'
    && snapshot.activeTriggerObjective === 'instantaneous-ee-max'
    && snapshot.eeActivationStatus === 'active'
    && decision.mode === 'ee-optimization';
  // The accepted decision frame already owns ordering. Rank one is consumed as
  // a read-only winner witness; this projection never compares, sorts, or
  // re-ranks candidate EE evidence. A prior accepted story may retain that
  // witness through a commit/guard frame whose target state is transiently
  // unavailable, but it can only apply to the same target pair.
  const previousStoryAcceptedTarget = previousStory !== null
    && previousStory.targetIsWinner
    && sameCandidateLinkKey(previousStory.winner ?? pair.target, pair.target);
  const targetAcceptedWinner = targetState?.rank === 1
    || previousSnapshotSupportsWinner(snapshot, pair, input.previousSnapshot)
    || previousStoryAcceptedTarget;
  const kind = pair.source.satelliteId === pair.target.satelliteId ? 'intra' : 'inter';
  const targetIsWinner = hasCanonicalInstantaneousEeObjective
    && sourceEe !== null
    && targetEe !== null
    && targetAcceptedWinner;
  const cellCount = normalizeCellCount(input.configuredCellCount);
  const winner = targetIsWinner ? copyKey(pair.target) : null;
  const currentQualifiedCandidateSatelliteCount = new Set(
    decision.states
      .filter(state => (
        state.hardEligibility === 'eligible'
        && state.triggerStatus === 'satisfied'
        && (decision.serving === null || !sameCandidateLinkKey(state.key, decision.serving))
      ))
      .map(state => state.key.satelliteId),
  ).size;
  // A commit frame can legitimately replace the candidate set with the new
  // serving link before the accepted story has finished its visual receipt.
  // Keep the last accepted qualification counts for that same pair only; this
  // is display continuity, never a new decision or a re-ranking operation.
  // Keep the numeric explanation stable for the same accepted story. The
  // underlying decision counts remain untouched; this only prevents a live
  // threshold crossing from making the teaching rail claim that the same
  // handover alternates between 0 and several candidates.
  const retainPreviousCandidateCounts = previousStory !== null;

  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    sourceFrameId: snapshot.sourceFrameId,
    phase: snapshot.phase,
    kind,
    cellCount,
    cellExample: cellExampleFor(cellCount),
    source: pair.source,
    target: pair.target,
    winner,
    sourceEeBitsPerJoule: sourceEe,
    targetEeBitsPerJoule: targetEe,
    winnerEeBitsPerJoule: targetIsWinner ? targetEe : null,
    winnerBasis: targetIsWinner ? 'instantaneous-ee-max' : 'unavailable',
    targetIsWinner,
    qualifiedCandidateCount: retainPreviousCandidateCounts
      ? previousStory.qualifiedCandidateCount
      : snapshot.counts.triggerSatisfied,
    qualifiedCandidateSatelliteCount: retainPreviousCandidateCounts
      ? previousStory.qualifiedCandidateSatelliteCount
      : currentQualifiedCandidateSatelliteCount,
    selectionStatus: pair.status,
    sameSatellite: pair.source.satelliteId === pair.target.satelliteId,
  });
}
