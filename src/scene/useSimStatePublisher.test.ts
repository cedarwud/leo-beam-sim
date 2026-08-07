import assert from 'node:assert/strict';
import type { LinkSample } from '../engine/signal/types';
import {
  buildPublishedFormulaEvidence,
  buildPublishedPrimaryServing,
  type PublishedFormulaEvidence,
  type PublishedPrimaryServing,
} from './useSimStatePublisher';
import type { SignalSourceState } from './types';
import type { SinrLiveCellFrame, UeCellServingRecord } from './sinrLiveCellModel';

const sample: LinkSample = {
  satId: 'sat-cell',
  beamId: 4,
  rsrpDbm: -78.4,
  sinrDb: 6.25,
  signalDbm: -78.4,
  intraInterferenceDbm: -101.2,
  interInterferenceDbm: -99.8,
  noiseDbm: -104.2,
  denominatorDbm: -95.7,
  txPowerDbm: 50,
  pathLossDb: 150.5,
  beamGainDb: 3.2,
  steeringLossDb: 0.8,
  receiverGainDbi: 2.5,
};

const primaryRecord: UeCellServingRecord = {
  ueId: 'ue-primary',
  cellId: 3,
  cellDistanceKm: 4.5,
  offAxisDeg: 0.42,
  servingSatId: sample.satId,
  beamIdentity: 'sat-cell#cell3',
  frequencyIndex: 0,
  sinrDb: sample.sinrDb,
  servingLinkSample: sample,
  handoverKind: 'none',
  comparisonSatId: null,
  comparisonSinrDb: null,
  pendingTargetSatId: null,
  triggerProgressSec: 0,
};

const cellFrame: SinrLiveCellFrame = {
  simTimeSec: 12,
  cells: [],
  ues: [primaryRecord],
  illuminatedBeams: [],
  servedCellCount: 1,
  servedUeCount: 1,
  servingSatCount: 1,
  intraHandoverCount: 0,
  interHandoverCount: 0,
  cumulativeIntraHandoverCount: 0,
  cumulativeInterHandoverCount: 0,
  recentHandoverEvents: [],
};

const perUePositions = [{
  id: primaryRecord.ueId,
  groundX: 0,
  groundZ: 0,
  eastKm: 0,
  northKm: 0,
  sinrDb: sample.sinrDb,
  servingSatId: sample.satId,
  servingBeamId: null,
  pendingTargetSatId: null,
  pendingTargetBeamId: null,
  triggerProgressSec: 0,
}];

const steeredSource: SignalSourceState = {
  satId: 'sat-steered',
  beamId: 1,
  sinrDb: 31,
  elevationDeg: 55,
  rangeKm: 850,
  status: 'live',
};

function steeredPrimary(): PublishedPrimaryServing {
  return {
    servingSatId: steeredSource.satId,
    servingBeamId: steeredSource.beamId,
    servingCellId: null,
    servingSinrDb: steeredSource.sinrDb,
    servingElevationDeg: steeredSource.elevationDeg,
    servingRangeKm: steeredSource.rangeKm,
    panelPrimary: { ...steeredSource, role: 'serving' },
    comparisonSatId: null,
    comparisonBeamId: null,
    comparisonSinrDb: null,
    comparisonElevationDeg: null,
    comparisonRangeKm: null,
    comparisonKind: null,
    panelComparison: {
      satId: null,
      beamId: null,
      sinrDb: null,
      elevationDeg: null,
      rangeKm: null,
      status: 'none',
      role: 'none',
    },
    sinrDeltaDb: null,
  };
}

const steeredEvidence: PublishedFormulaEvidence = {
  source: steeredSource,
  budget: {
    signalDbm: -70,
    intraInterferenceDbm: -110,
    interInterferenceDbm: -108,
    noiseDbm: -104,
    denominatorDbm: -100,
    txPowerDbm: 51,
    pathLossDb: 145,
    beamGainDb: 12,
    steeringLossDb: 0,
    receiverGainDbi: 2.5,
  },
};

const cellSim = { sinrLiveCells: cellFrame, perUePositions };

const publishedPrimary = buildPublishedPrimaryServing(cellSim, steeredPrimary());
const publishedFormula = buildPublishedFormulaEvidence(cellSim, steeredEvidence);

assert.equal(
  publishedPrimary.servingSinrDb,
  publishedFormula.source.sinrDb,
  'DuelCard serving SINR and Formula Terms source.sinrDb use the same primary UE record',
);
assert.equal(publishedFormula.source.satId, sample.satId, 'formula source uses the cell-truth serving satellite');
assert.equal(publishedFormula.source.beamId, null, 'cell-truth source does not leak an internal steered beam id');

for (const key of [
  'signalDbm',
  'intraInterferenceDbm',
  'interInterferenceDbm',
  'noiseDbm',
  'denominatorDbm',
  'txPowerDbm',
  'pathLossDb',
  'beamGainDb',
  'steeringLossDb',
  'receiverGainDbi',
] as const) {
  assert.equal(
    publishedFormula.budget?.[key],
    sample[key],
    `formula budget ${key} comes from the same cell-truth LinkSample`,
  );
}

const missingSample = buildPublishedFormulaEvidence({
  sinrLiveCells: {
    ...cellFrame,
    ues: [{ ...primaryRecord, servingLinkSample: null, sinrDb: null }],
  },
  perUePositions,
}, steeredEvidence);
assert.equal(missingSample.source.satId, null, 'missing cell-truth sample fails closed');
assert.equal(missingSample.budget, null, 'missing cell-truth sample never falls back to steered budget');

const offLane = buildPublishedFormulaEvidence({ sinrLiveCells: undefined, perUePositions }, steeredEvidence);
assert.strictEqual(offLane, steeredEvidence, 'non-sinr-live lanes preserve the steered formula evidence object');

console.log('useSimStatePublisher formula-source alignment test passed (primary SINR + all budget terms share one cell-truth LinkSample).');
