import assert from 'node:assert/strict';
import type { SimState } from './types';
import {
  hasUiStateBoundaryChanged,
  shouldPublishUiState,
} from './panelState';

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
