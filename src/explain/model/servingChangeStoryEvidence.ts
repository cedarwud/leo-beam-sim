import type { TleAnalysisRun } from '../../simulator/tleAnalysisRun';
import { buildExplanatoryEvidence } from './explanatoryEvidence';
import type {
  ServingChangeFixtureManifest,
  ServingChangeStoryEvidence,
  ServingChangeStoryPoint,
} from './types';

export type ServingChangeStoryResult =
  | { readonly status: 'available'; readonly evidence: ServingChangeStoryEvidence }
  | { readonly status: 'unavailable'; readonly fixtureId: 'serving-change-v1'; readonly reason: string };

function unavailable(reason: string): ServingChangeStoryResult {
  return Object.freeze({ status: 'unavailable', fixtureId: 'serving-change-v1', reason });
}

export function resolveServingChangeStory(
  run: TleAnalysisRun,
  fixture: ServingChangeFixtureManifest,
): ServingChangeStoryResult {
  if (run.analysisRunId !== fixture.analysisRunId) return unavailable('serving-change run identity does not match the accepted fixture');
  if (run.handoverTrace.traceDigest !== fixture.traceDigest) {
    return unavailable(`serving-change trace digest ${run.handoverTrace.traceDigest} does not match accepted ${fixture.traceDigest}`);
  }
  const event = run.handoverTrace.servingChangeEvents.find(candidate => candidate.eventId === fixture.eventId);
  if (event === undefined) return unavailable(`accepted serving-change event ${fixture.eventId} is unavailable`);
  if (event.sourceEvent !== fixture.sourceEvent) return unavailable('serving-change event kind does not match the accepted fixture');
  if (event.analysisRunId !== run.analysisRunId || event.geometryRunId !== run.geometryRunId
    || event.traceDigest !== run.handoverTrace.traceDigest) return unavailable('serving-change event provenance is stale');
  if (event.fromSatelliteId !== event.preCommit.servingSatelliteId
    || event.toSatelliteId !== event.preCommit.candidateSatelliteId
    || event.toSatelliteId !== event.postCommit.servingSatelliteId) {
    return unavailable('serving-change pre/post identity contract failed');
  }
  if (event.triggerAnchorIndex !== fixture.decisionAnchorIndex
    || event.postCommit.anchorIndex !== fixture.decisionAnchorIndex) {
    return unavailable('serving-change trigger anchor does not match the accepted fixture');
  }
  if (fixture.beforeAnchorIndex + 1 !== fixture.decisionAnchorIndex
    || fixture.afterAnchorIndex !== fixture.decisionAnchorIndex + 1) {
    return unavailable('serving-change fixture does not use adjacent before/decision/after anchors');
  }
  if (event.triggerInstantUtc !== event.postCommit.instantUtc) {
    return unavailable('serving-change trigger and post-commit instants differ');
  }
  const targetPass = run.passPlan.passes.find(pass => pass.passId === event.targetSelection.passId);
  if (event.targetSelection.selectionKind !== 'pass-plan'
    || targetPass === undefined
    || targetPass.satelliteId !== event.toSatelliteId
    || !event.targetSelection.sourceLocator.includes(event.targetSelection.passId)
    || targetPass.aosAnchorIndex > event.triggerAnchorIndex
    || targetPass.losAnchorIndex < event.triggerAnchorIndex) {
    return unavailable('serving-change target lacks valid pass-plan provenance');
  }
  if (event.sourceEvent === 'forced-continuity'
    && (event.preCommit.servingVisible !== false
      || event.preCommit.candidateVisible !== true
      || event.continuity.targetSatelliteId !== event.toSatelliteId
      || event.continuity.reasonCode !== 'serving-lost-visibility'
      || event.qualificationAnchors.length !== 0)) {
    return unavailable('forced-continuity visibility evidence is invalid');
  }
  if (event.sourceEvent === 'inter-handover') {
    const anchors = event.qualificationAnchors;
    const finalAnchor = anchors[anchors.length - 1];
    if (anchors.length < 2
      || finalAnchor?.anchorIndex !== event.triggerAnchorIndex
      || finalAnchor.progressSec < event.decision.tttSec
      || anchors.some((anchor, index) => (
        anchor.servingSatelliteId !== event.fromSatelliteId
        || anchor.candidateSatelliteId !== event.toSatelliteId
        || anchor.deltaDb < event.decision.offsetDb
        || !anchor.conditionMet
        || (index > 0 && anchor.anchorIndex !== anchors[index - 1]!.anchorIndex + 1)
      ))) {
      return unavailable('offset-and-TTT qualification evidence is invalid');
    }
  }
  const points = [
    [fixture.beforeAnchorIndex, fixture.beforeFrameId, 'before-completed-frame'],
    [fixture.decisionAnchorIndex, fixture.decisionFrameId, 'post-commit-trigger-frame'],
    [fixture.afterAnchorIndex, fixture.afterFrameId, 'after-completed-frame'],
  ] as const;
  let resolved: readonly ServingChangeStoryPoint[];
  try {
    resolved = points.map(([anchorIndex, frameId, role]) => {
      const evidence = buildExplanatoryEvidence(run, anchorIndex);
      if (evidence.frame.frameId !== frameId) throw new Error(`serving-change frame ${anchorIndex} does not match the accepted fixture`);
      return Object.freeze({ ...evidence, quantitativeFrameRole: role }) satisfies ServingChangeStoryPoint;
    });
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
  if (resolved[0]?.frame.selectedSatelliteId !== event.fromSatelliteId
    || resolved[1]?.frame.selectedSatelliteId !== event.toSatelliteId
    || resolved[2]?.frame.selectedSatelliteId !== event.toSatelliteId
    || resolved[1]?.frame.instantUtc !== event.triggerInstantUtc) {
    return unavailable('serving-change frame identities do not match the event transition');
  }
  return Object.freeze({
    status: 'available',
    evidence: Object.freeze({
      fixtureId: 'serving-change-v1',
      eventKind: event.sourceEvent === 'inter-handover' ? 'offset-ttt' : 'forced-continuity',
      sourceEvent: event.sourceEvent,
      sourceEventEvidence: event,
      before: resolved[0]!,
      decision: resolved[1]!,
      after: resolved[2]!,
    }),
  });
}
