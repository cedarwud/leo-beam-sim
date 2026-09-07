import assert from 'node:assert/strict';
import test from 'node:test';

import type { AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import type { HandoverDecisionFrame } from '../engine/handover/candidateDecisionContract';
import type {
  MultiCandidateBeamSceneRenderInstruction,
  MultiCandidateBeamSceneRenderPlan,
} from '../viz/MultiCandidateBeamScene';
import {
  resolveMultiCandidateComparisonPolicy,
  resolveMultiCandidateMarkerPolicy,
  resolveMultiCandidatePresentationPolicy,
  resolveMultiCandidateRenderIdentity,
} from './multiCandidateSceneDisplayPolicy';

function decision(
  phase: HandoverDecisionFrame['phase'] = 'evaluating',
): HandoverDecisionFrame {
  const serving = { satelliteId: 'sat-serving', beamId: 1 };
  return {
    episodeId: 'episode-1',
    epochToken: 'epoch-1',
    sourceFrameId: 'frame-1',
    simTimeMs: 1000,
    phase,
    serving,
    opportunities: [],
    states: [
      {
        key: { satelliteId: 'sat-alpha', beamId: 2 },
        hardEligibility: 'eligible',
        triggerStatus: 'satisfied',
      },
      {
        key: { satelliteId: 'sat-beta', beamId: 3 },
        hardEligibility: 'eligible',
        triggerStatus: 'satisfied',
      },
    ],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  } as unknown as HandoverDecisionFrame;
}

function snapshot(
  frame: HandoverDecisionFrame,
  epochToken = 'epoch-1',
): AcceptedHandoverPresentationSnapshot {
  return {
    episodeId: frame.episodeId,
    sourceFrameId: frame.sourceFrameId,
    simTimeMs: frame.simTimeMs,
    epochToken,
    serving: frame.serving === null ? null : { key: frame.serving },
    decision: frame,
    plan: {},
  } as unknown as AcceptedHandoverPresentationSnapshot;
}

function instruction(
  satelliteId: string,
  isServing: boolean,
  isCandidate: boolean,
): MultiCandidateBeamSceneRenderInstruction {
  return {
    satelliteId,
    isServing,
    isCandidate,
    cone: { visible: isServing },
    footprint: { visible: true },
    link: { visible: isServing },
  } as unknown as MultiCandidateBeamSceneRenderInstruction;
}

function renderPlan(
  instructions: readonly MultiCandidateBeamSceneRenderInstruction[],
): MultiCandidateBeamSceneRenderPlan {
  return { instructions } as unknown as MultiCandidateBeamSceneRenderPlan;
}

const selectAll = (
  instructions: readonly MultiCandidateBeamSceneRenderInstruction[],
) => instructions;

test('comparison policy opens, latches, and clears the accepted episode', () => {
  const accepted = snapshot(decision());
  const opened = resolveMultiCandidateComparisonPolicy({
    acceptedPresentation: accepted,
    simSource: 'live',
    sceneLane: 'sinr-live',
    previousLatch: null,
    centralOverlayEnabled: true,
  });

  assert.equal(opened.snapshotMatchesFrame, true);
  assert.equal(opened.decisionAuthorityPresent, true);
  assert.equal(opened.rawComparisonPhase, true);
  assert.equal(opened.comparisonPhase, true);
  assert.equal(opened.centralOverlayActive, true);
  assert.deepEqual(opened.nextLatch, {
    episodeId: 'episode-1',
    epochToken: 'epoch-1',
  });

  const postSelection = resolveMultiCandidateComparisonPolicy({
    acceptedPresentation: snapshot(decision('switching')),
    simSource: 'live',
    sceneLane: 'sinr-live',
    previousLatch: opened.nextLatch,
    centralOverlayEnabled: true,
  });
  assert.equal(postSelection.preSelectionComparisonPhase, false);
  assert.equal(postSelection.comparisonPhase, false);
  assert.equal(postSelection.nextLatch, null);
});

test('presentation policy keeps a missing publication fail-closed', () => {
  const result = resolveMultiCandidatePresentationPolicy({
    acceptedPresentation: null,
    candidatePresentationPlan: null,
    homepageVisualIdentity: true,
    sceneLane: 'sinr-live',
    simSource: 'live',
    authorityActive: false,
    comparisonPhase: false,
    preSelectionComparisonPhase: false,
    showSinrLiveCellBeams: true,
    sceneLayerEnabled: true,
    previousHold: null,
    centralOverlayEnabled: true,
  });

  assert.equal(result.homepageSceneProjection, null);
  assert.equal(result.candidateReviewPresentation, null);
  assert.equal(result.scenePresentationForRender, null);
  assert.equal(result.sceneVisualActive, false);
  assert.equal(result.sceneLayerVisible, false);
});

test('render identity and marker policy share the selected satellite roster', () => {
  const serving = instruction('sat-serving', true, false);
  const alpha = instruction('sat-alpha', false, true);
  const beta = instruction('sat-beta', false, true);
  const candidatePlan = renderPlan([serving, alpha, beta]);
  const identity = resolveMultiCandidateRenderIdentity({
    candidateReviewRenderPlan: candidatePlan,
    sceneRenderPlan: candidatePlan,
    selectInstructions: selectAll,
  });

  assert.deepEqual(
    [...(identity.candidateComparisonVisibleSatelliteIds ?? new Set())],
    ['sat-serving', 'sat-alpha', 'sat-beta'],
  );
  assert.deepEqual(
    [...identity.candidateComparisonOrdinalBySatelliteId.entries()],
    [['sat-alpha', 1], ['sat-beta', 2]],
  );
  assert.equal(identity.servingCarrierRenderable, true);

  const marker = resolveMultiCandidateMarkerPolicy({
    simSource: 'live',
    canonicalCandidateSatelliteId: 'sat-canonical',
    primaryPendingTargetSatelliteId: 'sat-pending',
    sceneVisualActive: true,
    centralOverlayActive: true,
    candidateComparisonSceneActive: false,
    preSelectionComparisonPhase: true,
    acceptedComparisonEpisodeKey: 'episode-1|epoch-1',
    previousFilter: null,
    candidateComparisonRenderPlan: null,
    sceneRenderPlan: candidatePlan,
    candidateComparisonVisibleSatelliteIds: identity.candidateComparisonVisibleSatelliteIds,
    homepageVisualIdentity: true,
    selectInstructions: selectAll,
  });

  assert.deepEqual(
    [...(marker.centralMarkerSatelliteIds ?? new Set())],
    ['sat-serving', 'sat-alpha', 'sat-beta'],
  );
  assert.equal(marker.renderedCandidateSatelliteId, null);
  assert.equal(marker.homepageCandidateStageLabelActive, true);
  assert.equal(marker.satelliteCandidateLabelActive, true);

  const stale = resolveMultiCandidateMarkerPolicy({
    simSource: 'live',
    canonicalCandidateSatelliteId: null,
    primaryPendingTargetSatelliteId: 'sat-pending',
    sceneVisualActive: false,
    centralOverlayActive: false,
    candidateComparisonSceneActive: false,
    preSelectionComparisonPhase: false,
    acceptedComparisonEpisodeKey: 'episode-2|epoch-1',
    previousFilter: marker.nextFilter,
    candidateComparisonRenderPlan: null,
    sceneRenderPlan: null,
    candidateComparisonVisibleSatelliteIds: null,
    homepageVisualIdentity: false,
    selectInstructions: selectAll,
  });
  assert.equal(stale.nextFilter, null);
  assert.equal(stale.centralMarkerSatelliteIds, null);
  assert.equal(stale.renderedCandidateSatelliteId, 'sat-pending');
});
