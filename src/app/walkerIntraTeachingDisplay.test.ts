import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile } from '../profiles';
import { createInitialSimState } from '../scene/initialSimState';
import {
  deriveWalkerIntraTeachingDisplay,
  type WalkerIntraTeachingDisplayInput,
} from './walkerIntraTeachingDisplay';

const simState = createInitialSimState(loadProfile('hobs-2024-candidate-rich'));
const presentation = {
  ueId: 'ue-0',
  sourceSatId: 'sat-a',
  sourceCellId: 2,
  targetCellId: 3,
  servingSinrDb: 11,
  candidateSinrDb: 8,
  deltaSinrDb: -3,
  elevationDeg: 42,
  rangeKm: 720,
};

function createInput(overrides: Partial<WalkerIntraTeachingDisplayInput> = {}): WalkerIntraTeachingDisplayInput {
  return {
    simState,
    visibleManualHandoverActive: false,
    manualHandoverKind: 'intra',
    intraPresentation: presentation,
    ...overrides,
  };
}

test('returns the live state reference when the manual intra display is inactive', () => {
  assert.equal(deriveWalkerIntraTeachingDisplay(createInput()), simState);
});

test('projects the manual intra presentation into both panel and scalar display fields', () => {
  const derived = deriveWalkerIntraTeachingDisplay(createInput({ visibleManualHandoverActive: true }));

  assert.notEqual(derived, simState);
  assert.equal(derived.panelPrimary.satId, 'sat-a');
  assert.equal(derived.panelPrimary.sinrDb, 11);
  assert.equal(derived.panelComparison.role, 'pending');
  assert.equal(derived.panelComparison.sinrDb, 8);
  assert.equal(derived.servingCellId, 2);
  assert.equal(derived.pendingTargetSatId, 'sat-a');
  assert.equal(derived.comparisonKind, 'pending');
  assert.equal(derived.sinrDeltaDb, -3);
  assert.equal(simState.panelPrimary.satId, null);
});
