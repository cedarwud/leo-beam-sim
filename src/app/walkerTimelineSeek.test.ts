import assert from 'node:assert/strict';

import {
  resolveWalkerTimelineSeek,
  type WalkerTimelineSeekInput,
} from './walkerTimelineSeek';

const baseInput: WalkerTimelineSeekInput = {
  scene: {
    lane: 'sinr-live',
    source: 'live-sim',
    isLegacyWalkerRoute: true,
  },
  targetSec: 50,
  timeline: {
    durationSec: 100,
  },
  live: {
    windowStartSec: 40,
    durationSec: 120,
  },
};

assert.deepEqual(
  resolveWalkerTimelineSeek({
    ...baseInput,
    scene: { ...baseInput.scene, isLegacyWalkerRoute: false },
    targetSec: 150,
  }),
  { kind: 'archived-tle', targetSec: 100 },
  'the canonical SINR route selects an archived-TLE anchor and clamps it',
);

assert.deepEqual(
  resolveWalkerTimelineSeek({
    ...baseInput,
    scene: { ...baseInput.scene, source: 'artifact-replay' },
    targetSec: -10,
  }),
  { kind: 'artifact-replay', targetSec: 0 },
  'artifact replay keeps its own source-time controller',
);

assert.deepEqual(
  resolveWalkerTimelineSeek({
    ...baseInput,
    targetSec: 90,
  }),
  {
    kind: 'live-walker',
    sourceTargetSec: 120,
    visualTargetSec: 90,
  },
  'the live Walker target adds the window offset and clamps at the source horizon',
);

console.log('walkerTimelineSeek.test.ts: all assertions passed');
