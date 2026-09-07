import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveMultiCandidateSceneRenderStatus,
  type MultiCandidateSceneRenderStatusInput,
} from './multiCandidateSceneRenderStatus';

const baseInput: MultiCandidateSceneRenderStatusInput = {
  hasAcceptedSnapshot: true,
  sourceFrameMatches: true,
  decisionPhase: 'evaluating',
  hardEligibleCount: 2,
  comparisonPhase: true,
  hasScenePlan: true,
  unmappedPairCount: 0,
};

test('reports missing or mismatched accepted snapshots before render details', () => {
  assert.equal(resolveMultiCandidateSceneRenderStatus({
    ...baseInput,
    hasAcceptedSnapshot: false,
    sourceFrameMatches: false,
  }), 'no-accepted-snapshot');
  assert.equal(resolveMultiCandidateSceneRenderStatus({
    ...baseInput,
    sourceFrameMatches: false,
  }), 'source-frame-mismatch');
});

test('preserves the decision and comparison precedence', () => {
  assert.equal(resolveMultiCandidateSceneRenderStatus({
    ...baseInput,
    decisionPhase: 'switching',
    hardEligibleCount: 0,
    comparisonPhase: false,
  }), 'switching');
  assert.equal(resolveMultiCandidateSceneRenderStatus({
    ...baseInput,
    hardEligibleCount: 1,
    comparisonPhase: false,
  }), 'below-comparison-threshold');
  assert.equal(resolveMultiCandidateSceneRenderStatus({
    ...baseInput,
    comparisonPhase: false,
  }), 'phase-not-comparison');
});

test('distinguishes missing, unmapped, and active scene projections', () => {
  assert.equal(resolveMultiCandidateSceneRenderStatus({
    ...baseInput,
    hasScenePlan: false,
  }), 'missing-scene-plan');
  assert.equal(resolveMultiCandidateSceneRenderStatus({
    ...baseInput,
    unmappedPairCount: 2,
  }), 'unmapped-pairs');
  assert.equal(resolveMultiCandidateSceneRenderStatus(baseInput), 'active');
});
