import type { CandidateLinkKey } from '../../engine/handover/candidateDecisionContract';
import type { AcceptedHandoverPresentationSnapshot } from '../../scene/acceptedHandoverPresentationSnapshot';
import {
  buildMultiCandidateScenePresentation,
  type MultiCandidateScenePresentation,
} from '../../scene/multiCandidateScenePresentation';
import type { HomepageSceneProjection } from './contracts';

/**
 * The homepage scene is a view of the accepted snapshot, not another scene
 * planner.  The existing multi-candidate adapter owns visual treatment and
 * the one-solid-data-link invariant; this boundary only carries snapshot
 * identity and the exact pair joins alongside that presentation.
 */
export function buildHomepageSceneProjection(
  snapshot: AcceptedHandoverPresentationSnapshot,
): HomepageSceneProjection {
  const presentation: MultiCandidateScenePresentation = buildMultiCandidateScenePresentation(snapshot.plan);
  const renderedSceneJoinKeys: readonly CandidateLinkKey[] = Object.freeze(
    presentation.instructions.map(instruction => instruction.key),
  );

  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    sourceFrameId: snapshot.sourceFrameId,
    phase: snapshot.phase,
    presentation,
    renderedSceneJoinKeys,
  });
}
