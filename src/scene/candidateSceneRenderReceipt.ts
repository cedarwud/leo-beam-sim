import { candidateLinkKey } from '../engine/handover/candidateDecisionContract';
import type {
  AcceptedHandoverPresentationSnapshot,
  CandidateSceneRenderReceipt,
} from './acceptedHandoverPresentationSnapshot';
import type {
  MultiCandidateBeamSceneRenderPlan,
  MultiCandidateBeamSceneUnmappedReason,
} from '../viz/MultiCandidateBeamScene';

const UNMAPPED_REASON: Readonly<Record<
  MultiCandidateBeamSceneUnmappedReason,
  CandidateSceneRenderReceipt['unmappedPairs'][number]['reason']
>> = Object.freeze({
  'missing-placement': 'missing-cell-placement',
  'missing-satellite-world': 'missing-satellite-world',
  'invalid-radius': 'invalid-beam-geometry',
});

function fail(message: string): never {
  throw new TypeError(`candidate scene render receipt: ${message}`);
}

/**
 * Acknowledge the actual WebGL mapping for one already accepted publication.
 * This adapter records renderer facts only; it cannot add candidates, change a
 * role, or repair a missing geometry mapping.
 */
export function buildCandidateSceneRenderReceipt({
  snapshot,
  renderPlan,
  eventCueCount,
}: {
  readonly snapshot: AcceptedHandoverPresentationSnapshot;
  readonly renderPlan: MultiCandidateBeamSceneRenderPlan;
  readonly eventCueCount: number;
}): CandidateSceneRenderReceipt {
  if (!Number.isInteger(eventCueCount) || eventCueCount < 0) {
    fail('eventCueCount must be a non-negative integer');
  }
  for (const unmapped of renderPlan.unmappedPairs) {
    if (unmapped.sourceFrameId !== snapshot.sourceFrameId) {
      fail(`unmapped pair source ${unmapped.sourceFrameId} does not match accepted source ${snapshot.sourceFrameId}`);
    }
  }
  const renderedSceneJoinKeys = Object.freeze(
    renderPlan.instructions.map(instruction => instruction.sceneJoinKey),
  );
  if (new Set(renderedSceneJoinKeys).size !== renderedSceneJoinKeys.length) {
    fail('rendered scene join keys must be unique');
  }
  if (renderPlan.solidDataLinkCount !== snapshot.activeDataLinkCount) {
    fail(
      `solid data-link count ${renderPlan.solidDataLinkCount} does not match accepted count ${snapshot.activeDataLinkCount}`,
    );
  }

  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    sourceFrameId: snapshot.sourceFrameId,
    renderedSceneJoinKeys,
    unmappedPairs: Object.freeze(renderPlan.unmappedPairs.map(unmapped => Object.freeze({
      key: candidateLinkKey(unmapped.satelliteId, unmapped.beamId),
      reason: UNMAPPED_REASON[unmapped.reason],
    }))),
    solidDataLinkCount: renderPlan.solidDataLinkCount,
    eventCueCount,
  });
}
