import assert from 'node:assert/strict';
import type { HandoverDecisionFrame } from '../engine/handover/candidateDecisionContract';
import type { SimState } from './types';
import {
  hasUiStateBoundaryChanged,
  shouldPublishUiState,
} from './panelState';

const decisionFrame = {
  episodeId: 'episode/1',
  sourceFrameId: 'frame-1',
  simTimeMs: 1_000,
  phase: 'qualifying',
  mode: 'sinr-offset',
  serving: { satelliteId: 'sat-a', beamId: 1 },
  opportunities: [{ key: { satelliteId: 'sat-b', beamId: 2 } }],
  states: [{
    key: { satelliteId: 'sat-b', beamId: 2 },
    hardEligibility: 'eligible',
    triggerStatus: 'satisfied',
    qualificationSec: 1,
    requiredTttSec: 3,
    stable: false,
  }],
  provisionalLeader: null,
  selectedTarget: null,
  recentCommit: null,
} as unknown as HandoverDecisionFrame;

const baseState = {
  profileId: 'profile-a',
  satelliteVisualIdentityById: {},
  physicalServing: { satId: 'sat-a', beamId: 1, sinrDb: 10, elevationDeg: 60, rangeKm: 700, status: 'live' },
  panelPrimary: { satId: 'sat-a', beamId: 1, sinrDb: 10, elevationDeg: 60, rangeKm: 700, status: 'live', role: 'serving' },
  panelComparison: { satId: 'sat-b', beamId: 2, sinrDb: 8, elevationDeg: 45, rangeKm: 900, status: 'derived', role: 'candidate' },
  servingSatId: 'sat-a',
  servingBeamId: 1,
  servingCellId: null,
  pendingTargetSatId: 'sat-b',
  pendingTargetBeamId: 2,
  comparisonSatId: 'sat-b',
  comparisonBeamId: 2,
  comparisonKind: 'candidate',
  recentHoSourceSatId: null,
  recentHoTargetSatId: null,
  hoCount: 0,
  intraHoCount: 0,
  intraHandoverEvent: null,
  physicalServingBudget: null,
  angleAwareFormulaFrame: null,
  handoverDecisionFrame: decisionFrame,
} as unknown as SimState;

const numericOnlyChange = {
  ...baseState,
  panelPrimary: { ...baseState.panelPrimary, sinrDb: 9.2 },
} as SimState;

const identityChange = {
  ...baseState,
  panelPrimary: { ...baseState.panelPrimary, satId: 'sat-c' },
  servingSatId: 'sat-c',
} as SimState;

const decisionNumericOnlyChange = {
  ...baseState,
  handoverDecisionFrame: {
    ...decisionFrame,
    sourceFrameId: 'frame-2',
    simTimeMs: 1_100,
    states: [{ ...decisionFrame.states[0]!, qualificationSec: 1.1 }],
  },
} as SimState;

const decisionPhaseChange = {
  ...baseState,
  handoverDecisionFrame: { ...decisionFrame, phase: 'selection-hold' },
} as SimState;

assert.equal(
  hasUiStateBoundaryChanged(baseState, numericOnlyChange),
  false,
  'numeric-only changes are display-throttled instead of bypassing the interval',
);
assert.equal(
  hasUiStateBoundaryChanged(baseState, identityChange),
  true,
  'serving identity changes remain immediate for handover readability',
);
assert.equal(
  hasUiStateBoundaryChanged(baseState, decisionNumericOnlyChange),
  false,
  'decision-frame measurements retain the shared one-second teaching cadence',
);
assert.equal(
  hasUiStateBoundaryChanged(baseState, decisionPhaseChange),
  true,
  'decision phase transitions publish immediately',
);
assert.equal(
  shouldPublishUiState({
    previous: baseState,
    next: numericOnlyChange,
    nowMs: 500,
    lastUpdateAtMs: 0,
    intervalMs: 1000,
    cursorReseat: false,
  }),
  false,
  'numeric-only right-rail updates wait for the display interval',
);
assert.equal(
  shouldPublishUiState({
    previous: baseState,
    next: identityChange,
    nowMs: 500,
    lastUpdateAtMs: 0,
    intervalMs: 1000,
    cursorReseat: false,
  }),
  true,
  'serving/candidate identity transitions publish immediately',
);
assert.equal(
  shouldPublishUiState({
    previous: baseState,
    next: numericOnlyChange,
    nowMs: 1000,
    lastUpdateAtMs: 0,
    intervalMs: 1000,
    cursorReseat: false,
  }),
  true,
  'numeric-only right-rail updates publish once the interval elapses',
);

console.log('uiUpdatePolicy.test.ts: PASS');
