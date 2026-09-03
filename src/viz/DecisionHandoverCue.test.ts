import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthorityHandoverTransition } from '../scene/handoverAuthorityJoin';
import {
  resolveDecisionHandoverCueGeometry,
  resolveDecisionHandoverCueLabels,
} from './DecisionHandoverCue';

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

const intraTransition: AuthorityHandoverTransition = {
  ...transition,
  eventId: 'decision:intra-event',
  kind: 'intra',
  from: { satelliteId: 'SAT-A', beamId: 5 },
  to: { satelliteId: 'SAT-A', beamId: 425 },
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

test('decision cue preserves same-cell intra geometry for distinct beam identities', () => {
  const placements = new Map([
    [4, { cellId: 4, worldX: 12, worldZ: -8, radiusWorld: 8 }],
  ]);
  const geometry = resolveDecisionHandoverCueGeometry(intraTransition, placements);

  assert.equal(geometry?.fromCellId, 4);
  assert.equal(geometry?.toCellId, 4);
  assert.deepEqual(geometry?.from, [12, 0.55, -8]);
  assert.deepEqual(geometry?.to, [12, 0.55, -8]);
  assert.deepEqual(geometry?.path[1], [30, 10, -2]);
});

test('decision cue labels make intra and inter pair roles explicit', () => {
  assert.deepEqual(resolveDecisionHandoverCueLabels(intraTransition), {
    kindLabel: 'INTRA · SAME SATELLITE',
    sourceLabel: 'SOURCE · SAT-A / B5',
    targetLabel: 'TARGET · SAT-A / B425',
  });
  assert.deepEqual(resolveDecisionHandoverCueLabels(transition), {
    kindLabel: 'INTER · SATELLITE CHANGE',
    sourceLabel: 'SOURCE · SAT-A / B2',
    targetLabel: 'TARGET · SAT-B / B4',
  });
});
