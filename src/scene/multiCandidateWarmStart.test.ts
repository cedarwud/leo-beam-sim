import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CandidateDecisionState,
  HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';
import {
  isMultiCandidateComparisonFocusDecisionFrame,
  isMultiCandidatePlaybackSlowDecisionFrame,
  isMultiCandidateWarmStartDecisionFrame,
  isMultiCandidateWarmStartFrame,
} from './multiCandidateWarmStart';

function makeState(
  satelliteId: string,
  beamId: number,
  hardEligibility: CandidateDecisionState['hardEligibility'] = 'eligible',
): CandidateDecisionState {
  return {
    key: { satelliteId, beamId },
    hardEligibility,
    triggerStatus: 'satisfied',
    qualificationSec: 1.0,
    requiredTttSec: 3.5,
    stable: false,
    rank: null,
    rejectionCodes: [],
  };
}

function makeDecisionFrame(overrides: Partial<HandoverDecisionFrame> = {}): HandoverDecisionFrame {
  return {
    episodeId: 'ep-test',
    sourceFrameId: 'frame-test',
    simTimeMs: 1000,
    phase: 'qualifying',
    serving: { satelliteId: 'sat-serving', beamId: 0 },
    opportunities: [],
    states: [
      makeState('sat-alt-1', 0, 'eligible'),
      makeState('sat-alt-2', 0, 'eligible'),
    ],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1.5,
    mode: 'sinr-offset',
    recentCommit: null,
    ...overrides,
  };
}

test('isMultiCandidateWarmStartDecisionFrame: returns false for null, undefined or empty input', () => {
  assert.equal(isMultiCandidateWarmStartDecisionFrame(null), false);
  assert.equal(isMultiCandidateWarmStartDecisionFrame(undefined), false);
  assert.equal(isMultiCandidateWarmStartDecisionFrame({} as HandoverDecisionFrame), false);
});

test('isMultiCandidateWarmStartDecisionFrame: returns false outside the pre-selection evaluation interval', () => {
  const nonQualifyingPhases: HandoverDecisionFrame['phase'][] = [
    'initial-attach',
    'monitoring',
    'selection-hold',
    'switching',
    'guard',
  ];
  for (const phase of nonQualifyingPhases) {
    const frame = makeDecisionFrame({ phase });
    assert.equal(
      isMultiCandidateWarmStartDecisionFrame(frame),
      false,
      `expected false for phase ${phase}`,
    );
  }
});

test('isMultiCandidateWarmStartDecisionFrame: returns false if provisionalLeader is non-null', () => {
  const frame = makeDecisionFrame({
    provisionalLeader: { satelliteId: 'sat-alt-1', beamId: 0 },
  });
  assert.equal(isMultiCandidateWarmStartDecisionFrame(frame), false);
});

test('isMultiCandidateWarmStartDecisionFrame: returns false if selectedTarget is non-null', () => {
  const frame = makeDecisionFrame({
    selectedTarget: { satelliteId: 'sat-alt-1', beamId: 0 },
  });
  assert.equal(isMultiCandidateWarmStartDecisionFrame(frame), false);
});

test('isMultiCandidateWarmStartDecisionFrame: returns false when states are empty or absent', () => {
  const frame = makeDecisionFrame({ states: [] });
  assert.equal(isMultiCandidateWarmStartDecisionFrame(frame), false);
});

test('isMultiCandidateWarmStartDecisionFrame: excludes serving satellite from alternate count', () => {
  // Only serving satellite has eligible pairs -> 0 alternate satellites
  const frameOnlyServing = makeDecisionFrame({
    serving: { satelliteId: 'sat-serving', beamId: 0 },
    states: [
      makeState('sat-serving', 1, 'eligible'),
      makeState('sat-serving', 2, 'eligible'),
    ],
  });
  assert.equal(isMultiCandidateWarmStartDecisionFrame(frameOnlyServing), false);

  // Serving satellite + only 1 alternate satellite -> 1 alternate satellite (needs >= 2)
  const frameOneAlt = makeDecisionFrame({
    serving: { satelliteId: 'sat-serving', beamId: 0 },
    states: [
      makeState('sat-serving', 1, 'eligible'),
      makeState('sat-alt-1', 0, 'eligible'),
      makeState('sat-alt-1', 1, 'eligible'), // multiple beams on same alternate sat
    ],
  });
  assert.equal(isMultiCandidateWarmStartDecisionFrame(frameOneAlt), false);
});

test('isMultiCandidateWarmStartDecisionFrame: ignores ineligible and unavailable states', () => {
  const frame = makeDecisionFrame({
    states: [
      makeState('sat-alt-1', 0, 'eligible'),
      makeState('sat-alt-2', 0, 'ineligible'),
      makeState('sat-alt-3', 0, 'unavailable'),
    ],
  });
  assert.equal(isMultiCandidateWarmStartDecisionFrame(frame), false);
});

test('isMultiCandidateWarmStartDecisionFrame: returns true when qualifying, pre-selection, with >= 2 distinct alternate eligible satellites', () => {
  const frame = makeDecisionFrame({
    serving: { satelliteId: 'sat-serving', beamId: 0 },
    states: [
      makeState('sat-serving', 1, 'eligible'),
      makeState('sat-alt-1', 0, 'eligible'),
      makeState('sat-alt-2', 0, 'eligible'),
    ],
  });
  assert.equal(isMultiCandidateWarmStartDecisionFrame(frame), true);
});

test('isMultiCandidateWarmStartDecisionFrame: opens at the earlier evaluating frame once two alternate satellites are eligible', () => {
  assert.equal(isMultiCandidateWarmStartDecisionFrame(makeDecisionFrame({ phase: 'evaluating' })), true);
});

test('isMultiCandidateWarmStartDecisionFrame: handles null serving correctly', () => {
  const frame = makeDecisionFrame({
    serving: null,
    states: [
      makeState('sat-1', 0, 'eligible'),
      makeState('sat-2', 0, 'eligible'),
    ],
  });
  assert.equal(isMultiCandidateWarmStartDecisionFrame(frame), true);
});

test('isMultiCandidateWarmStartFrame: wraps frame.handoverDecisionFrame', () => {
  assert.equal(isMultiCandidateWarmStartFrame(null), false);
  assert.equal(isMultiCandidateWarmStartFrame(undefined), false);
  assert.equal(isMultiCandidateWarmStartFrame({ handoverDecisionFrame: null }), false);

  const matchingDecision = makeDecisionFrame();
  assert.equal(isMultiCandidateWarmStartFrame({ handoverDecisionFrame: matchingDecision }), true);

  const nonMatchingDecision = makeDecisionFrame({ phase: 'monitoring' });
  assert.equal(isMultiCandidateWarmStartFrame({ handoverDecisionFrame: nonMatchingDecision }), false);
});

test('comparison focus spans qualification and selection hold without changing decision truth', () => {
  assert.equal(isMultiCandidateComparisonFocusDecisionFrame(makeDecisionFrame()), true);
  assert.equal(isMultiCandidateComparisonFocusDecisionFrame(makeDecisionFrame({
    phase: 'selection-hold',
    provisionalLeader: { satelliteId: 'sat-alt-1', beamId: 0 },
  })), true);
  assert.equal(isMultiCandidateComparisonFocusDecisionFrame(makeDecisionFrame({ phase: 'evaluating' })), true);
  assert.equal(isMultiCandidateComparisonFocusDecisionFrame(makeDecisionFrame({
    selectedTarget: { satelliteId: 'sat-alt-1', beamId: 0 },
  })), false);
  assert.equal(isMultiCandidateComparisonFocusDecisionFrame(makeDecisionFrame({
    states: [
      makeState('sat-alt-1', 0, 'eligible'),
      makeState('sat-alt-1', 1, 'eligible'),
    ],
  })), false, 'an inter comparison needs qualified candidates from two alternate satellites');
});

test('comparison focus opens for an intra-satellite replacement beam before switching', () => {
  const frame = makeDecisionFrame({
    phase: 'qualifying',
    serving: { satelliteId: 'sat-serving', beamId: 0 },
    states: [
      makeState('sat-serving', 0, 'eligible'),
      makeState('sat-serving', 3, 'eligible'),
    ],
  });
  assert.equal(isMultiCandidateComparisonFocusDecisionFrame(frame), true);
});

test('comparison focus stays closed when the only same-satellite state is the serving beam', () => {
  const frame = makeDecisionFrame({
    phase: 'qualifying',
    serving: { satelliteId: 'sat-serving', beamId: 0 },
    states: [makeState('sat-serving', 0, 'eligible')],
  });
  assert.equal(isMultiCandidateComparisonFocusDecisionFrame(frame), false);
});

test('playback slow phase excludes the long-lived post-commit guard', () => {
  assert.equal(
    isMultiCandidatePlaybackSlowDecisionFrame(makeDecisionFrame({ phase: 'qualifying' })),
    true,
    'candidate qualification keeps the comparison readable',
  );
  assert.equal(
    isMultiCandidatePlaybackSlowDecisionFrame(makeDecisionFrame({
      phase: 'switching',
      selectedTarget: { satelliteId: 'sat-alt-1', beamId: 0 },
    })),
    true,
    'the visible source-to-target switch stays slow',
  );
  assert.equal(
    isMultiCandidatePlaybackSlowDecisionFrame(makeDecisionFrame({ phase: 'guard' })),
    false,
    'engine guard must not cap ordinary playback after the visible switch',
  );
  assert.equal(
    isMultiCandidatePlaybackSlowDecisionFrame(makeDecisionFrame({ phase: 'monitoring' })),
    false,
    'ordinary monitoring keeps the user-selected rate',
  );
});

test('playback slow phase covers a single real candidate from evaluation through hold', () => {
  const singleCandidate = makeDecisionFrame({
    phase: 'evaluating',
    states: [makeState('sat-alt-1', 0, 'eligible')],
  });
  assert.equal(isMultiCandidatePlaybackSlowDecisionFrame(singleCandidate), true);
  assert.equal(
    isMultiCandidatePlaybackSlowDecisionFrame({
      ...singleCandidate,
      phase: 'selection-hold',
      provisionalLeader: { satelliteId: 'sat-alt-1', beamId: 0 },
    }),
    true,
  );
});

test('playback slow phase ignores hard-eligible candidates that have not passed the active trigger', () => {
  const frame = makeDecisionFrame({
    phase: 'evaluating',
    states: [{
      ...makeState('sat-alt-1', 0, 'eligible'),
      triggerStatus: 'not-satisfied',
    }],
  });
  assert.equal(isMultiCandidatePlaybackSlowDecisionFrame(frame), false);
});

test('comparison focus ignores ineligible intra beams', () => {
  const frame = makeDecisionFrame({
    phase: 'qualifying',
    serving: { satelliteId: 'sat-serving', beamId: 0 },
    states: [
      makeState('sat-serving', 0, 'eligible'),
      makeState('sat-serving', 3, 'ineligible'),
    ],
  });
  assert.equal(isMultiCandidateComparisonFocusDecisionFrame(frame), false);
});
