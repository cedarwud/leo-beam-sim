import type {
  HomepageAcceptedSnapshot,
  HomepageBeamMetricsProjection,
  HomepageHandoverStoryProjection,
  HomepageRailProjection,
} from './contracts';
import {
  sameCandidateLinkKey,
  type CandidateLinkKey,
} from '../../engine/handover/candidateDecisionContract';
import type { CandidatePresentationLink } from '../../engine/handover/candidatePresentationPlan';
import { projectHomepageHandoverStory } from './homepageHandoverStoryProjection';

/**
 * The frozen homepage contract predates the policy provenance field. Keep its
 * shape intact while carrying the accepted snapshot's hash to the rail.
 */
export type HomepageRailProjectionWithConfigHash = HomepageRailProjection
  & Pick<HomepageAcceptedSnapshot, 'policyConfigHash'>;

/**
 * Display-only candidate continuity carried by the homepage integration
 * owner. It lets a committed story keep the pre-commit roster visible while
 * the next decision frame is already measuring unrelated candidates. It is
 * never consulted by the decision engine or the scene authority.
 */
export interface HomepageCandidateRosterContinuity {
  readonly episodeId: string;
  readonly epochToken: string;
  readonly policyConfigHash: string;
  readonly sourceFrameId: string;
  readonly source: CandidateLinkKey;
  readonly target: CandidateLinkKey;
  readonly links: readonly CandidatePresentationLink[];
}

export interface HomepageRailProjectionOptions {
  readonly beamMetrics?: HomepageBeamMetricsProjection | null;
  readonly configuredCellCount?: number | null;
  /** Prior accepted publication used only by the existing story continuity contract. */
  readonly previousSnapshot?: HomepageAcceptedSnapshot | null;
  /** Prior accepted metrics used only when the current story sample is omitted. */
  readonly previousBeamMetrics?: HomepageBeamMetricsProjection | null;
  /** Prior accepted story used only to retain a matching committed winner witness. */
  readonly previousStory?: HomepageHandoverStoryProjection | null;
  /**
   * Prior display-only roster for the same story. This is required to keep a
   * committed story stable across several post-commit guard publications.
   */
  readonly previousCandidateRoster?: HomepageCandidateRosterContinuity | null;
}

function acceptedBeamMetrics(
  snapshot: HomepageAcceptedSnapshot,
  beamMetrics: HomepageBeamMetricsProjection | null | undefined,
): HomepageBeamMetricsProjection | null {
  if (beamMetrics === null || beamMetrics === undefined) return null;
  if (beamMetrics.sourceFrameId !== snapshot.sourceFrameId) return null;
  if (beamMetrics.snapshotId !== null && beamMetrics.snapshotId !== snapshot.snapshotId) return null;
  return beamMetrics;
}

function canRetainCandidateRoster(
  snapshot: HomepageAcceptedSnapshot,
  story: HomepageHandoverStoryProjection | null,
  previousSnapshot: HomepageAcceptedSnapshot | null | undefined,
  previousStory: HomepageHandoverStoryProjection | null | undefined,
  previousCandidateRoster: HomepageCandidateRosterContinuity | null | undefined,
): { readonly links: readonly CandidatePresentationLink[]; readonly sourceFrameId: string } | null {
  if (
    story === null
    || previousStory === null
    || previousStory === undefined
    || previousSnapshot === null
    || previousSnapshot === undefined
  ) return null;
  const samePair = sameCandidateLinkKey(story.source, previousStory.source)
    && sameCandidateLinkKey(story.target, previousStory.target)
    && previousSnapshot.episodeId === snapshot.episodeId
    && previousSnapshot.epochToken === snapshot.epochToken
    && previousSnapshot.policyConfigHash === snapshot.policyConfigHash
    && previousSnapshot.simTimeMs <= snapshot.simTimeMs;
  if (!samePair) return null;

  // Once committed, the current decision may already contain the next
  // unrelated candidate set. The saved roster is the only valid display
  // source for the story that is still being explained.
  if (
    previousCandidateRoster !== null
    && previousCandidateRoster !== undefined
    && previousCandidateRoster.episodeId === snapshot.episodeId
    && previousCandidateRoster.epochToken === snapshot.epochToken
    && previousCandidateRoster.policyConfigHash === snapshot.policyConfigHash
    && previousCandidateRoster.sourceFrameId.length > 0
    && sameCandidateLinkKey(previousCandidateRoster.source, story.source)
    && sameCandidateLinkKey(previousCandidateRoster.target, story.target)
    && previousCandidateRoster.links.some(candidate => candidate.isCandidate)
  ) {
    return {
      links: previousCandidateRoster.links,
      sourceFrameId: previousCandidateRoster.sourceFrameId,
    };
  }

  // The first commit publication has no prior continuity register yet, so
  // fall back once to the immediately preceding accepted snapshot. The
  // integration owner then carries that roster through later guard frames.
  if (previousSnapshot.candidates.some(candidate => candidate.isCandidate)) {
    return {
      links: previousSnapshot.candidates,
      sourceFrameId: previousSnapshot.sourceFrameId,
    };
  }
  return null;
}

/**
 * Project the already-accepted homepage snapshot for the rail.
 *
 * The snapshot is the authority for the rail and scene. Keep the link,
 * overflow, and count references intact so their source-frame and scene/rail
 * joins remain the ones published by the snapshot builder. This function does
 * not rebuild candidate state, apply a display budget, or infer presentation
 * flags.
 */
export function projectHomepageRail(
  snapshot: HomepageAcceptedSnapshot,
  options: HomepageRailProjectionOptions = {},
): HomepageRailProjectionWithConfigHash {
  const beamMetrics = acceptedBeamMetrics(snapshot, options.beamMetrics);
  const handoverStory = projectHomepageHandoverStory({
    snapshot,
    beamMetrics,
    configuredCellCount: options.configuredCellCount,
    previousSnapshot: options.previousSnapshot,
    previousBeamMetrics: options.previousBeamMetrics,
    previousStory: options.previousStory,
  });
  const retainedCandidateRoster = canRetainCandidateRoster(
    snapshot,
    handoverStory,
    options.previousSnapshot,
    options.previousStory,
    options.previousCandidateRoster,
  );
  // Once an accepted story exists, keep the same candidate roster for that
  // story's explanation window. Re-reading the live thresholded set every
  // publication made the rail visibly jump 0→N→0 while the source pair had not
  // changed. canRetainCandidateRoster still rejects a different pair,
  // episode, epoch, or policy, so this is continuity rather than a count cap.
  const shouldRetainCandidateRoster = handoverStory !== null;
  const candidateRosterRetained = shouldRetainCandidateRoster && retainedCandidateRoster !== null;
  const visibleCandidates: readonly CandidatePresentationLink[] = candidateRosterRetained
    ? retainedCandidateRoster.links
    : snapshot.candidates;
  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    sourceFrameId: snapshot.sourceFrameId,
    phase: snapshot.phase,
    decision: snapshot.decision,
    policyConfigHash: snapshot.policyConfigHash,
    serving: snapshot.serving,
    candidates: snapshot.candidates,
    visibleCandidates,
    candidateRosterSourceFrameId: candidateRosterRetained
      ? retainedCandidateRoster.sourceFrameId
      : snapshot.sourceFrameId,
    candidateRosterRetained,
    overflowKeys: snapshot.overflowKeys,
    counts: snapshot.counts,
    activeDataLinkCount: snapshot.activeDataLinkCount,
    beamMetrics,
    handoverStory,
  });
}
