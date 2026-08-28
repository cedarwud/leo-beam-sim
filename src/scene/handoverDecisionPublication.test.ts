#!/usr/bin/env node
import assert from 'node:assert/strict';

import type { HandoverDecisionFrame } from '../engine/handover/candidateDecisionContract';
import { handoverDecisionBoundaryKey } from './handoverDecisionPublication';

const base = {
  episodeId: 'episode/1',
  sourceFrameId: 'frame-1',
  simTimeMs: 1_000,
  phase: 'qualifying',
  serving: { satelliteId: 'sat-a', beamId: 1 },
  opportunities: [{ key: { satelliteId: 'sat-b', beamId: 2 } }],
  states: [{
    key: { satelliteId: 'sat-b', beamId: 2 },
    hardEligibility: 'eligible',
    triggerStatus: 'satisfied',
    qualificationSec: 1,
    requiredTttSec: 3,
    stable: false,
    rank: null,
    rejectionCodes: [],
  }],
  provisionalLeader: null,
  selectedTarget: null,
  selectedKind: null,
  selectionHoldSec: 0,
  selectionHoldRequiredSec: 1.5,
  mode: 'sinr-offset',
  recentCommit: null,
} as unknown as HandoverDecisionFrame;

const key = handoverDecisionBoundaryKey(base);
assert.equal(handoverDecisionBoundaryKey(null), 'none');
assert.equal(handoverDecisionBoundaryKey(undefined), 'none');
assert.equal(handoverDecisionBoundaryKey({
  ...base,
  sourceFrameId: 'frame-2',
  simTimeMs: 1_100,
  selectionHoldSec: 0.2,
  states: [{ ...base.states[0]!, qualificationSec: 1.1 }],
}), key, 'continuous numeric evidence must keep the teaching cadence');
assert.notEqual(handoverDecisionBoundaryKey({ ...base, phase: 'selection-hold' }), key);
assert.notEqual(handoverDecisionBoundaryKey({
  ...base,
  states: [{ ...base.states[0]!, stable: true, rank: 1 }],
}), key);
assert.notEqual(handoverDecisionBoundaryKey({
  ...base,
  opportunities: [...base.opportunities, { ...base.opportunities[0]!, key: { satelliteId: 'sat-c', beamId: 1 } }],
}), key);

console.log('Handover decision publication boundary test passed.');
