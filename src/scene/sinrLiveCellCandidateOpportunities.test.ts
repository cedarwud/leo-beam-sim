import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCellLayout } from '../engine/cells/cellLayout';
import { candidateLinkKeyString } from '../engine/handover/candidateDecisionContract';
import { loadProfile } from '../profiles/index';
import {
  SinrLiveCellModel,
  cellLinkBudgetBeamId,
  type CellModelSat,
} from './sinrLiveCellModel';

const OBSERVER = { latDeg: 25.1519, lonDeg: 121.7811 };
const EPOCH_MS = Date.UTC(2026, 7, 27, 12, 0, 0);

function satellite(id: string, lonOffsetDeg: number): CellModelSat {
  return {
    id,
    shellId: 'walker-test-shell',
    altitudeKm: 550,
    latDeg: OBSERVER.latDeg,
    lonDeg: OBSERVER.lonDeg + lonOffsetDeg,
    topo: { azimuthDeg: lonOffsetDeg < 0 ? 270 : lonOffsetDeg > 0 ? 90 : 0, elevationDeg: 80 },
  };
}

test('Walker S1 publishes a complete same-UE candidate-pair set without activating EE', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const layout = buildCellLayout({
    centerLatDeg: OBSERVER.latDeg,
    centerLonDeg: OBSERVER.lonDeg,
    altitudeKm: 550,
    beamwidth3dBRad: 0.058,
    cellCount: 7,
  });
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: layout,
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
  });
  const frame = model.step({
    visibleSats: [
      satellite('SAT-A', 0),
      satellite('SAT-B', 0.8),
      satellite('SAT-C', -0.8),
    ],
    ues: [{ id: 'ue-primary', eastKm: 8, northKm: 2 }],
    simTimeSec: 42.0004,
    dtSec: 1,
  });

  const set = frame.primaryCandidateOpportunities;
  assert.ok(set);
  assert.equal(set.primaryUeId, 'ue-primary');
  assert.equal(set.sourceFrameId, `walker:${EPOCH_MS}:${EPOCH_MS + 42_000}`);
  assert.ok(set.opportunities.length >= 6, 'several satellite-beam pairs must survive measurement');
  assert.equal(set.counts.observed, set.opportunities.length);
  assert.ok(set.counts.scheduledAndIlluminated >= 3);

  const keys = set.opportunities.map(opportunity => candidateLinkKeyString(opportunity.key));
  assert.equal(new Set(keys).size, keys.length, 'pair identity must stay unique');
  assert.ok(new Set(set.opportunities.map(opportunity => opportunity.key.satelliteId)).size >= 2);
  for (const opportunity of set.opportunities) {
    assert.equal(opportunity.primaryUeId, 'ue-primary');
    assert.equal(opportunity.sourceFrameId, set.sourceFrameId);
    assert.equal(opportunity.sinr.measuredAtSimTimeMs, EPOCH_MS + 42_000);
    assert.equal(opportunity.remainingServiceTime.measuredAtSimTimeMs, EPOCH_MS + 42_000);
    assert.equal(opportunity.beamIdentitySource, 'walker-cell-surrogate');
    assert.equal(opportunity.forecastEe, null);
    assert.equal(opportunity.predictedThroughput.value, null);
    assert.equal(opportunity.remainingServiceTime.value, null);
    assert.equal(
      opportunity.gates.find(gate => gate.code === 'ee-advantage')?.result,
      'unavailable',
    );
  }

  const primary = frame.ues.find(ue => ue.ueId === 'ue-primary');
  assert.ok(primary?.servingSatId);
  assert.ok(primary.cellId !== null);
  const servingKey = `${primary.servingSatId}|${cellLinkBudgetBeamId(primary.cellId)}`;
  assert.ok(keys.includes(servingKey), 'the legacy serving pair must be present in the additive set');
});
