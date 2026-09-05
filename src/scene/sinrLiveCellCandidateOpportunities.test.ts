import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCellLayout } from '../engine/cells/cellLayout';
import { candidateLinkKeyString } from '../engine/handover/candidateDecisionContract';
import { loadProfile } from '../profiles/index';
import {
  SINR_LIVE_CANDIDATE_PROBE_PROVENANCE,
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
    // Seven same-cell satellites, not three: 33fa5ba scoped primary-UE
    // candidate measurement to the UE's own geographic cell (a same-satellite
    // beam belonging to another cell was previously miscounted as a same-UE
    // candidate). With multiCandidateDecisionEnabled left at its default
    // (false, see sinrLiveCellModel.ts's config doc), the compensating B1..B7
    // intra-cell beam expansion is intentionally scoped to the authoritative
    // decision lane and does not apply here, so this measurement-only fixture
    // now needs several distinct satellites in the same cell -- not the old
    // cross-cell leak -- to exercise "several satellite-beam pairs survive
    // measurement".
    visibleSats: [
      satellite('SAT-A', 0),
      satellite('SAT-B', 0.8),
      satellite('SAT-C', -0.8),
      satellite('SAT-D', 1.6),
      satellite('SAT-E', -1.6),
      satellite('SAT-F', 2.4),
      satellite('SAT-G', -2.4),
    ],
    ues: [{ id: 'ue-primary', eastKm: 8, northKm: 2 }],
    simTimeSec: 42.0004,
    dtSec: 1,
  });

  const set = frame.primaryCandidateOpportunities;
  assert.ok(set);
  const probeEvidence = frame.primaryCandidateProbeEvidence;
  assert.equal(set.primaryUeId, 'ue-primary');
  assert.equal(set.sourceFrameId, `walker:${EPOCH_MS}:${EPOCH_MS + 42_000}`);
  assert.equal(frame.sourceFrameId, set.sourceFrameId);
  assert.ok(probeEvidence);
  assert.equal(probeEvidence.length, set.opportunities.length);
  assert.ok(Object.isFrozen(probeEvidence));
  assert.ok(set.opportunities.length >= 6, 'several satellite-beam pairs must survive measurement');
  assert.equal(set.counts.observed, set.opportunities.length);
  assert.ok(set.counts.scheduledAndIlluminated >= 3);

  const keys = set.opportunities.map(opportunity => candidateLinkKeyString(opportunity.key));
  assert.equal(new Set(keys).size, keys.length, 'pair identity must stay unique');
  const probeKeys = probeEvidence.map(probe => candidateLinkKeyString(probe.key));
  assert.deepEqual(new Set(probeKeys), new Set(keys));
  assert.equal(new Set(probeKeys).size, probeKeys.length, 'candidate probe pair identity must stay unique');
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
    assert.equal(opportunity.sinrMeasurementContext?.purpose, 'sinr-offset-admission');
    assert.equal(opportunity.sinrMeasurementContext?.powerModel, 'profile-rated-rf');
    assert.equal(
      opportunity.gates.find(gate => gate.code === 'ee-advantage')?.result,
      'unavailable',
    );
  }

  for (const probe of probeEvidence) {
    assert.equal(probe.primaryUeId, 'ue-primary');
    assert.equal(probe.sourceFrameId, frame.sourceFrameId);
    assert.equal(probe.simTimeSec, 42.0004);
    assert.equal(probe.provenance, SINR_LIVE_CANDIDATE_PROBE_PROVENANCE);
    assert.equal(probe.eeBasis, 'candidate-probe');
    assert.equal(probe.status, 'available');
    assert.ok(probe.sample);
    assert.equal(probe.sample?.ueId, 'ue-primary');
    assert.equal(probe.sample?.satId, probe.key.satelliteId);
    assert.equal(probe.sample?.beamId, probe.key.beamId);
    assert.equal(probe.sample?.angleAware?.timeSec, probe.simTimeSec);
    assert.ok(Number.isFinite(probe.sample?.sinrDb));
    assert.ok(Number.isFinite(probe.sample?.angleAware?.powerW));
    assert.ok(Number.isFinite(probe.sample?.angleAware?.throughputBps));
    assert.ok(Number.isFinite(probe.sample?.angleAware?.energyEfficiencyBitsPerJoule));
    assert.ok(Object.isFrozen(probe));
    assert.ok(Object.isFrozen(probe.key));
    assert.ok(Object.isFrozen(probe.sample));
    assert.ok(Object.isFrozen(probe.sample?.angleAware));
  }

  const primary = frame.ues.find(ue => ue.ueId === 'ue-primary');
  assert.ok(primary?.servingSatId);
  assert.ok(primary.cellId !== null);
  const servingKey = `${primary.servingSatId}|${cellLinkBudgetBeamId(primary.cellId)}`;
  assert.ok(keys.includes(servingKey), 'the legacy serving pair must be present in the additive set');

  const firstProbe = probeEvidence[0]!;
  assert.throws(
    () => ((firstProbe.key as unknown as { satelliteId: string }).satelliteId = 'mutated'),
    TypeError,
  );
  assert.equal(firstProbe.key.satelliteId, probeEvidence[0]!.key.satelliteId);
});
