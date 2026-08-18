import assert from 'node:assert/strict';

import {
  guidedReplayDefinition,
  guidedReplayCandidateEngaged,
  guidedReplayPhaseIndex,
  guidedReplayPhaseLabel,
  guidedReplayPhaseTiming,
  guidedReplayProgress,
  isGuidedHandoverPhase,
  nextGuidedReplayPhase,
  VISUAL_LAB_GUIDED_REPLAY_PHASE_TIMINGS,
  VISUAL_LAB_GUIDED_REPLAY_TOTAL_DURATION_MS,
  VISUAL_LAB_GUIDED_REPLAY_PHASES,
} from './model';

assert.deepEqual(VISUAL_LAB_GUIDED_REPLAY_PHASES, [
  'baseline',
  'intervention',
  'before',
  'decision',
  'after',
  'comparison',
]);
assert.equal(guidedReplayDefinition('inter-handover').causalStoryId, 'beamwidth');
assert.equal(guidedReplayDefinition('inter-handover').storyKind, 'inter-handover');
assert.equal(guidedReplayDefinition('intra-beam-handover').causalStoryId, 'power-cap');
assert.equal(guidedReplayDefinition('intra-beam-handover').storyKind, 'intra-handover');
assert.equal(guidedReplayPhaseLabel('decision', 'zh-Hant'), '切換');
assert.equal(guidedReplayPhaseLabel('comparison', 'en'), 'Compare');
assert.equal(guidedReplayPhaseIndex('after'), 4);
assert.equal(nextGuidedReplayPhase('baseline'), 'intervention');
assert.equal(nextGuidedReplayPhase('after'), 'comparison');
assert.equal(nextGuidedReplayPhase('comparison'), null);
assert.equal(isGuidedHandoverPhase('before'), true);
assert.equal(isGuidedHandoverPhase('intervention'), true);

// The semantic sequence stays source-backed while its presentation clock has
// enough room for setup, candidate approach, source-backed qualification,
// switch, settle, and smooth return.  The final comparison is entered after
// 21 seconds.
assert.deepEqual(VISUAL_LAB_GUIDED_REPLAY_PHASES, [
  'baseline', 'intervention', 'before', 'decision', 'after', 'comparison',
]);
assert.equal(VISUAL_LAB_GUIDED_REPLAY_TOTAL_DURATION_MS, 21_000);
assert.equal(VISUAL_LAB_GUIDED_REPLAY_PHASE_TIMINGS.baseline.durationMs, 3_000);
assert.equal(VISUAL_LAB_GUIDED_REPLAY_PHASE_TIMINGS.after.durationMs, 7_000);
assert.equal(guidedReplayCandidateEngaged('baseline'), false);
assert.equal(guidedReplayCandidateEngaged('intervention'), true);
assert.equal(guidedReplayCandidateEngaged('before'), true);
assert.equal(guidedReplayCandidateEngaged('decision'), true);
assert.equal(guidedReplayCandidateEngaged('after'), false);
assert.equal(guidedReplayProgress('after', 3_900).stage, 'settle');
assert.equal(guidedReplayProgress('after', 4_100).stage, 'smooth-return');
assert.equal(guidedReplayProgress('comparison').overallFraction, 1);
assert.ok(guidedReplayProgress('comparison').phaseFraction >= 1);
// Older hot-reload closures may still report the removed return phase; the
// timing seam must fail safe until the next render publishes the current six
// phase contract.
assert.equal(
  guidedReplayPhaseTiming('return' as never).stage,
  'smooth-return',
);
assert.equal(
  guidedReplayPhaseTiming('return' as never).durationMs,
  3_000,
);
assert.equal(guidedReplayPhaseLabel('return' as never, 'en'), 'Settle → smooth return');

console.log('visual-lab guided replay model tests passed');
