import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfile } from '../src/profiles/index.ts';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
} from '../src/scene/acceptedHandoverPresentationSnapshot.ts';
import { buildMultiCandidateScenePresentation } from '../src/scene/multiCandidateScenePresentation.ts';
import { buildSinrLiveCellLayout } from '../src/scene/sinrLiveCellRuntime.ts';
import { isMultiCandidateComparisonFocusDecisionFrame } from '../src/scene/multiCandidateWarmStart.ts';
import { resolveMultiCandidateBeamScene } from '../src/viz/MultiCandidateBeamScene.tsx';
import {
  requiredFlowFailures,
  runMultiCandidateWindow,
  type MultiCandidateFrameObservation,
} from './diagnose-multi-candidate-window.ts';

test('requiredFlowFailures remains informational until the explicit flow gate is used', () => {
  assert.deepEqual(requiredFlowFailures({
    observedAlternativesMax: 120,
    eligibleAlternativesMax: 0,
    provisionalLeaderFrames: 0,
    selectedFrames: 0,
    decisionCommits: 0,
  }), [
    'fewer than two simultaneously eligible alternatives',
    'no provisional leader frame',
    'no selected target frame',
    'no decision commit receipt',
  ]);
});

test('requiredFlowFailures passes only after every authority stage is observed', () => {
  assert.deepEqual(requiredFlowFailures({
    observedAlternativesMax: 2,
    eligibleAlternativesMax: 2,
    provisionalLeaderFrames: 1,
    selectedFrames: 1,
    decisionCommits: 1,
  }), []);
});

test('requiredFlowFailures can require distinct satellite identities, not merely multiple beams', () => {
  assert.deepEqual(requiredFlowFailures({
    observedAlternativesMax: 8,
    eligibleAlternativesMax: 8,
    eligibleDistinctSatellitesMax: 1,
    provisionalLeaderFrames: 1,
    selectedFrames: 1,
    decisionCommits: 1,
  }), ['fewer than two simultaneously eligible alternatives']);
});

test('the homepage source trajectory exposes evaluation, selection, and both handover kinds', () => {
  // The shared homepage primary-UE trajectory exposes a real same-satellite
  // intra commit before the inter-satellite commit. A two-second diagnostic
  // cadence keeps this regression bounded while still exercising both
  // authority commit kinds.
  let normalCommitWithInsufficientCandidates = 0;
  const report = runMultiCandidateWindow({
    durationSec: 600,
    stepSec: 2,
    onDecisionFrame: observation => {
      if (observation.decision.recentCommit?.mode === 'sinr-offset'
        && observation.decision.recentCommit.kind === 'inter-satellite'
        && observation.decision.selectionGate?.satisfied !== true) {
        normalCommitWithInsufficientCandidates += 1;
      }
    },
  });

  assert.ok(report.multipleEligibleFrames > 0, 'several pairs must be eligible before selection');
  assert.ok(report.provisionalLeaderFrames > 0, 'a provisional leader must emerge after TTT');
  assert.ok(report.selectedFrames > 0, 'selection hold must produce a selected target');
  assert.ok(report.decisionCommits.some(receipt => receipt.kind === 'intra'));
  assert.ok(report.decisionCommits.some(receipt => receipt.kind === 'inter'));
  assert.equal(
    normalCommitWithInsufficientCandidates,
    0,
    'inter-satellite commits must not bypass the distinct-satellite selection floor',
  );
  assert.deepEqual(requiredFlowFailures({
    observedAlternativesMax: report.observedAlternatives.max,
    eligibleAlternativesMax: report.eligible.max,
    eligibleDistinctSatellitesMax: report.eligibleDistinctCandidateSatellites.max,
    provisionalLeaderFrames: report.provisionalLeaderFrames,
    selectedFrames: report.selectedFrames,
    decisionCommits: report.decisionCommits.length,
  }), []);
});

test('the first real multi-satellite qualification frame is renderable from the same accepted snapshot', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  let firstComparison: MultiCandidateFrameObservation | null = null;
  runMultiCandidateWindow({
    durationSec: 150,
    stepSec: 1,
    onDecisionFrame: observation => {
      if (firstComparison !== null) return;
      if (isMultiCandidateComparisonFocusDecisionFrame(observation.decision)) {
        firstComparison = observation;
      }
    },
  });

  assert.ok(firstComparison !== null, 'the real authority path must expose a pre-selection comparison frame');
  // TypeScript cannot use a callback's mutation as a narrowing proof. The
  // runtime assertion above is the guard; this cast keeps the rest of the
  // renderer-join fixture strongly typed.
  const observation = firstComparison as MultiCandidateFrameObservation;
  const snapshot = buildAcceptedHandoverPresentationSession({
    decision: observation.decision,
    policyConfigHash: createHandoverPresentationPolicyConfigHash(JSON.stringify(profile)),
    pinnedKey: null,
    displayAllHardEligibleCandidates: true,
    configuredBeamCount: profile.beams.perSatellite,
  }).snapshot;
  const servingSatelliteId = observation.decision.serving?.satelliteId ?? null;
  const alternateSatelliteIds = new Set(
    snapshot.plan.displayedLinks
      .filter(link => link.isCandidate && (
        servingSatelliteId === null || link.satelliteId !== servingSatelliteId
      ))
      .map(link => link.satelliteId),
  );
  assert.ok(alternateSatelliteIds.size >= 2, 'the accepted plan must retain two distinct alternate satellites');
  assert.ok(
    (observation.decision.selectionGate?.eligibleDistinctCandidateSatellites ?? 0) >= 2,
    'the authority frame must report two distinct alternate satellites',
  );
  assert.equal(
    snapshot.counts.displayed,
    snapshot.counts.hardEligible,
    'comparison mode must retain every hard-eligible candidate pair',
  );

  // This is the same renderer seam used by MainScene. A positive synthetic
  // world scale is enough here: the test is checking the join/mapping contract,
  // not a camera choice or a visual scale preference.
  const layout = buildSinrLiveCellLayout(profile, 7);
  const placementByCellId = new Map(layout.centers.map(center => [center.cellId, {
    cellId: center.cellId,
    worldX: center.localXKm,
    worldZ: -center.localYKm,
    radiusWorld: layout.cellRadiusKm,
    worldUnitsPerKm: 1,
  }]));
  const satelliteWorldById = new Map(observation.frame.satellites.map(satellite => [
    satellite.id,
    { x: satellite.world.x, y: satellite.world.y, z: satellite.world.z },
  ]));
  const renderPlan = resolveMultiCandidateBeamScene({
    presentation: buildMultiCandidateScenePresentation(snapshot.plan),
    placementByCellId,
    satelliteWorldById,
    primaryUeWorld: {
      x: observation.frame.ueGroundX,
      y: 0,
      z: observation.frame.ueGroundZ,
    },
    reducedMotion: false,
  });
  assert.equal(renderPlan.unmappedPairs.length, 0, 'every accepted displayed pair must map to scene geometry');
  assert.ok(renderPlan.telemetry.renderedSatelliteCount >= 3, 'scene must render serving plus two candidate satellites');
  assert.ok(renderPlan.telemetry.renderedPairCount >= 3, 'scene must render multiple candidate beam pairs');
  assert.equal(renderPlan.telemetry.solidDataLinkCount, 1, 'only the current serving link may be solid');
});
