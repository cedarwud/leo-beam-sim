import assert from 'node:assert/strict';

import {
  guidedReplayPhaseTiming,
  guidedReplayProgress,
  guidedReplayReturnProgress,
  nextGuidedReplayPhase,
  VISUAL_LAB_GUIDED_REPLAY_PHASES,
  VISUAL_LAB_GUIDED_REPLAY_TOTAL_DURATION_MS,
} from '../../visualLab/guidedReplay/model';
import type { VisualLabGuidedReplayPhase } from '../../visualLab/guidedReplay/types';
import {
  VISUAL_LAB_CAUSAL_REPLAY_PHASE_DURATION_MS,
  VISUAL_LAB_CAUSAL_REPLAY_TOTAL_DURATION_MS,
} from './useVisualLabCausalReplay';

assert.equal(VISUAL_LAB_GUIDED_REPLAY_TOTAL_DURATION_MS, 21_000);
assert.deepEqual(
  VISUAL_LAB_GUIDED_REPLAY_PHASES.map(phase => guidedReplayPhaseTiming(phase).stage),
  ['setup', 'candidate-approach', 'qualification', 'switch', 'settle', 'comparison'],
);
assert.equal(guidedReplayProgress('after', 3_900).stage, 'settle');
assert.equal(guidedReplayProgress('after', 4_100).stage, 'smooth-return');
assert.equal(guidedReplayProgress('after', 7_000).phaseFraction, 1);
assert.equal(guidedReplayReturnProgress('before', 4_500), null);
assert.equal(guidedReplayReturnProgress('after', 3_999), null);
assert.equal(guidedReplayReturnProgress('after', 4_000), 0);
assert.equal(guidedReplayReturnProgress('after', 7_000), 1);

assert.equal(VISUAL_LAB_CAUSAL_REPLAY_PHASE_DURATION_MS.baseline, 5_000);
assert.equal(VISUAL_LAB_CAUSAL_REPLAY_PHASE_DURATION_MS.intervention, 5_000);
assert.equal(VISUAL_LAB_CAUSAL_REPLAY_TOTAL_DURATION_MS, 10_000);

// A deterministic semantic walk proves that the auto-play endpoint is the
// comparison state, while restart always returns to the setup phase.
let phase: VisualLabGuidedReplayPhase = VISUAL_LAB_GUIDED_REPLAY_PHASES[0]!;
const visited: VisualLabGuidedReplayPhase[] = [phase];
while (phase !== 'comparison') {
  const next = nextGuidedReplayPhase(phase);
  assert.notEqual(next, null);
  phase = next!;
  visited.push(phase);
}
assert.deepEqual(visited, [...VISUAL_LAB_GUIDED_REPLAY_PHASES]);
assert.equal(nextGuidedReplayPhase('comparison'), null);
phase = 'baseline';
assert.equal(guidedReplayProgress(phase).stage, 'setup');
assert.equal(guidedReplayProgress(phase).phaseFraction, 0);

// The old phase name can survive one HMR turn; it must not make timer lookup
// throw while the current six-phase contract is being re-rendered.
assert.equal(guidedReplayPhaseTiming('return' as never).durationMs, 3_000);

console.log('visual-lab replay pacing and restart/return contract tests passed');
