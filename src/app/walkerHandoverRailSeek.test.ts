import assert from 'node:assert/strict';

import {
  resolveWalkerHandoverRailSeek,
  type WalkerHandoverRailSeekInput,
} from './walkerHandoverRailSeek';

const baseInput: WalkerHandoverRailSeekInput = {
  sceneLane: 'modqn-live-cell-preview',
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

assert.deepEqual(
  resolveWalkerHandoverRailSeek({
    ...baseInput,
    directorFocusEnabled: true,
    targetSec: 150,
  }),
  {
    kind: 'director-live',
    sourceTargetSec: 100,
    visualTargetSec: 60,
  },
  'Director focus clamps the source rail and maps it into the visible live window',
);

assert.deepEqual(
  resolveWalkerHandoverRailSeek({
    ...baseInput,
    directorFocusEnabled: true,
    targetSec: -10,
  }),
  {
    kind: 'director-live',
    sourceTargetSec: 0,
    visualTargetSec: 0,
  },
  'focused rail seeks fail closed at the lower source and visual bounds',
);

console.log('walkerHandoverRailSeek.test.ts: all assertions passed');
