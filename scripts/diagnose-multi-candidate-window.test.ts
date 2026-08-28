import assert from 'node:assert/strict';
import test from 'node:test';

import {
  requiredFlowFailures,
  runMultiCandidateWindow,
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

test('the active SINR compatibility path exposes evaluation, selection, and both handover kinds', () => {
  const report = runMultiCandidateWindow({ durationSec: 150, stepSec: 1 });

  assert.ok(report.multipleEligibleFrames > 0, 'several pairs must be eligible before selection');
  assert.ok(report.provisionalLeaderFrames > 0, 'a provisional leader must emerge after TTT');
  assert.ok(report.selectedFrames > 0, 'selection hold must produce a selected target');
  assert.ok(report.decisionCommits.some(receipt => receipt.kind === 'intra'));
  assert.ok(report.decisionCommits.some(receipt => receipt.kind === 'inter'));
  assert.deepEqual(requiredFlowFailures({
    observedAlternativesMax: report.observedAlternatives.max,
    eligibleAlternativesMax: report.eligible.max,
    provisionalLeaderFrames: report.provisionalLeaderFrames,
    selectedFrames: report.selectedFrames,
    decisionCommits: report.decisionCommits.length,
  }), []);
});
