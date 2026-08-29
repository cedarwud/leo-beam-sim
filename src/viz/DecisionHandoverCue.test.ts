import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthorityHandoverTransition } from '../scene/handoverAuthorityJoin';
import { resolveDecisionHandoverCueGeometry } from './DecisionHandoverCue';

const transition: AuthorityHandoverTransition = {
  eventId: 'decision:event',
  episodeId: 'episode',
  sourceFrameId: 'frame',
  simTimeMs: 1_000,
  kind: 'inter',
  boundary: 'selected',
  from: { satelliteId: 'SAT-A', beamId: 2 },
  to: { satelliteId: 'SAT-B', beamId: 4 },
};

test('decision cue maps exact Walker beam surrogates to ground cells', () => {
  const placements = new Map([
    [1, { cellId: 1, worldX: 10, worldZ: 20, radiusWorld: 8 }],
    [3, { cellId: 3, worldX: 30, worldZ: 40, radiusWorld: 8 }],
  ]);
  const geometry = resolveDecisionHandoverCueGeometry(transition, placements);
  assert.equal(geometry?.fromCellId, 1);
  assert.equal(geometry?.toCellId, 3);
  assert.deepEqual(geometry?.from, [10, 0.55, 20]);
  assert.deepEqual(geometry?.to, [30, 0.55, 40]);
  assert.equal(geometry?.path.length, 3);
});

test('decision cue fails closed instead of guessing a missing ground placement', () => {
  const placements = new Map([
    [1, { cellId: 1, worldX: 10, worldZ: 20, radiusWorld: 8 }],
  ]);
  assert.equal(resolveDecisionHandoverCueGeometry(transition, placements), null);
});
