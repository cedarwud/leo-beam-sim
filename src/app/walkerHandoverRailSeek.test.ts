import assert from 'node:assert/strict';

import {
  resolveWalkerHandoverRailSeek,
  type WalkerHandoverRailSeekInput,
} from './walkerHandoverRailSeek';

const baseInput: WalkerHandoverRailSeekInput = {
  sceneLane: 'sinr-live',
  directorFocusEnabled: false,
  targetSec: 42,
  railDurationSec: 100,
  liveTimelineWindowStartSec: 40,
  timelineDurationSec: 60,
};

assert.deepEqual(
  resolveWalkerHandoverRailSeek({
    ...baseInput,
    sceneLane: 'sinr-live',
    directorFocusEnabled: true,
    targetSec: 150,
  }),
  { kind: 'timeline', targetSec: 150 },
  'the SINR rail delegates its raw target to the main timeline resolver',
);

assert.deepEqual(
  resolveWalkerHandoverRailSeek({
    ...baseInput,
    targetSec: 150,
  }),
  { kind: 'timeline', targetSec: 150 },
  'a non-focused rail delegates to the main timeline resolver',
);

console.log('walkerHandoverRailSeek.test.ts: all assertions passed');
