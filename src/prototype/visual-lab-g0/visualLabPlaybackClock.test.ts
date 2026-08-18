import assert from 'node:assert/strict';

import {
  advanceVisualLabPlayback,
  effectiveVisualLabPlaybackRate,
  VISUAL_LAB_COMMITTED_SWITCH_SLOW_MOTION_FACTOR,
} from './visualLabPlaybackClock';

const normal = { committedSwitchWindow: false, guidedReplayActive: false } as const;
const committedSwitch = { committedSwitchWindow: true, guidedReplayActive: false } as const;
const guided = { committedSwitchWindow: true, guidedReplayActive: true } as const;

assert.equal(VISUAL_LAB_COMMITTED_SWITCH_SLOW_MOTION_FACTOR, .25);
assert.equal(effectiveVisualLabPlaybackRate(1, normal), 1);
assert.equal(effectiveVisualLabPlaybackRate(1, committedSwitch), .25);
assert.equal(effectiveVisualLabPlaybackRate(1, guided), 1, 'guided replay owns its clock');

// Outside the committed switch window, 1x is literally one simulated second
// per wall-clock second.  There is no timer-interval fudge factor or cap.
assert.equal(advanceVisualLabPlayback(12, 2.5, 1, normal), 14.5);
assert.equal(
  advanceVisualLabPlayback(12, 2.5, 1, committedSwitch),
  12.625,
  'only the committed switch window receives automatic slow motion',
);
assert.equal(advanceVisualLabPlayback(12, 2.5, 1, guided), 14.5);

console.log('visual-lab playback clock preserves 1x and slows only committed switches');
