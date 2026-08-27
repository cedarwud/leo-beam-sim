import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  candidateLinkKeyString,
  type CandidateGateResult,
  type EvidenceStatus,
  type MetricEvidence,
} from './candidateDecisionContract';
import { HandoverManager } from './handover-manager';
import type { LinkSample } from '../signal/types';
import { loadProfile } from '../../profiles';
import {
  produceCandidateOpportunitySet,
  selectLegacyInterSinrOffsetTarget,
  type CandidateLinkMeasurement,
} from './candidateOpportunityProducer';

const PRIMARY_UE = 'ue-primary';
const SOURCE_FRAME = 'walker:2026-08-27T12:00:00.000Z:42';

function metric(
  value: number | null,
  unit: string,
  status: EvidenceStatus = 'available',
  sourceFrameId: string | null = status === 'available' ? SOURCE_FRAME : null,
): MetricEvidence {
  return {
    status,
    value,
    unit,
    sourceFrameId,
    reason: status === 'available' ? null : `${unit} unavailable in S1`,
  };
}

function scheduled(result: CandidateGateResult['result']): CandidateGateResult {
  return {
    code: 'scheduled-illumination',
    category: 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : result === 'pass' ? 1 : 0,
    threshold: 1,
    unit: 'boolean',
    reason: result === 'pass' ? null : result === 'fail' ? 'off-slot' : 'schedule unavailable',
  };
}

function measurement(
  satelliteId: string,
  beamId: number,
  sinrDb: number,
  options: {
    readonly steeringDeg?: number;
    readonly scheduled?: CandidateGateResult['result'];
    readonly remainingServiceTimeSec?: number | null;
    readonly primaryUeId?: string;
    readonly sourceFrameId?: string;
  } = {},
): CandidateLinkMeasurement {
  const sourceFrameId = options.sourceFrameId ?? SOURCE_FRAME;
  const available = (value: number, unit: string): MetricEvidence => metric(value, unit, 'available', sourceFrameId);
  const remaining = options.remainingServiceTimeSec === undefined
    ? metric(null, 's', 'unavailable', null)
    : available(options.remainingServiceTimeSec ?? 0, 's');
  return {
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: options.primaryUeId ?? PRIMARY_UE,
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    elevation: available(35, 'deg'),
    steering: available(options.steeringDeg ?? 8, 'deg'),
    range: available(900, 'km'),
    sinr: available(sinrDb, 'dB'),
    predictedThroughput: available(120_000_000, 'bit/s'),
    remainingServiceTime: remaining,
    scheduledIllumination: scheduled(options.scheduled ?? 'pass'),
  };
}

const thresholds = {
  minimumElevationDeg: 10,
  maximumSteeringDeg: 50,
  minimumSinrDb: -5,
  minimumThroughputBps: 1_000_000,
  minimumRemainingServiceTimeSec: 12,
};

test('preserves every satellite-beam pair and reports honest stage counts', () => {
  const set = produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    thresholds,
    measurements: [
      measurement('SAT-A', 1, 5, { remainingServiceTimeSec: 30 }),
      measurement('SAT-A', 2, 4, { remainingServiceTimeSec: 30 }),
      measurement('SAT-B', 1, 8, { scheduled: 'fail', remainingServiceTimeSec: 30 }),
      measurement('SAT-C', 4, 7),
    ],
  });

  assert.deepEqual(set.opportunities.map(item => candidateLinkKeyString(item.key)), [
    'SAT-A|1',
    'SAT-A|2',
    'SAT-B|1',
    'SAT-C|4',
  ]);
  assert.deepEqual(set.counts, {
    observed: 4,
    geometricallyReachable: 4,
    steeringValid: 4,
    scheduledAndIlluminated: 3,
    serviceEligible: 2,
  });
  assert.equal(set.opportunities[0]?.forecastEe, null);
  assert.equal(
    set.opportunities[0]?.gates.find(gate => gate.code === 'ee-advantage')?.result,
    'unavailable',
  );
  assert.equal(Object.isFrozen(set.opportunities), true);
});

test('keeps unavailable remaining-service evidence unavailable rather than converting it to zero', () => {
  const set = produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    thresholds,
    measurements: [measurement('SAT-A', 1, 5)],
  });
  const opportunity = set.opportunities[0];
  assert.equal(opportunity?.remainingServiceTime.value, null);
  assert.equal(opportunity?.remainingServiceTime.status, 'unavailable');
  assert.equal(opportunity?.geometryClass, 'scheduled-and-illuminated');
  assert.equal(
    opportunity?.gates.find(gate => gate.code === 'remaining-service-time')?.result,
    'unavailable',
  );
});

test('rejects mixed UE, mixed frame, and duplicate-pair measurements', () => {
  assert.throws(() => produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    thresholds,
    measurements: [measurement('SAT-A', 1, 5, { primaryUeId: 'ue-other' })],
  }), /different primary UE/);
  assert.throws(() => produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    thresholds,
    measurements: [measurement('SAT-A', 1, 5, { sourceFrameId: 'frame-other' })],
  }), /different source frame/);
  assert.throws(() => produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    thresholds,
    measurements: [measurement('SAT-A', 1, 5), measurement('SAT-A', 1, 6)],
  }), /duplicate candidate measurement/);
});

test('migration-only SINR projection matches the legacy inter-satellite argmax rule', () => {
  const set = produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    thresholds,
    measurements: [
      measurement('SAT-A', 1, 2, { remainingServiceTimeSec: 30 }),
      measurement('SAT-A', 2, 12, { remainingServiceTimeSec: 30 }),
      measurement('SAT-B', 1, 9, { remainingServiceTimeSec: 30 }),
      measurement('SAT-C', 1, 11, { remainingServiceTimeSec: 30 }),
      measurement('SAT-D', 1, 14, { scheduled: 'fail', remainingServiceTimeSec: 30 }),
    ],
  });

  const selected = selectLegacyInterSinrOffsetTarget({
    serving: candidateLinkKey('SAT-A', 1),
    opportunities: set.opportunities,
    offsetDb: 3,
  });
  assert.equal(selected === null ? null : candidateLinkKeyString(selected), 'SAT-C|1');

  const manager = new HandoverManager(loadProfile('hobs-2024-candidate-rich').handover);
  manager.state = {
    satId: 'SAT-A',
    beamId: 1,
    sinrDb: 2,
    triggerTimeSec: 0,
    pendingTarget: null,
  };
  const managerSamples = set.opportunities
    .filter(opportunity => opportunity.gates.find(gate => gate.code === 'scheduled-illumination')?.result === 'pass')
    .map(opportunity => ({
      satId: opportunity.key.satelliteId,
      beamId: opportunity.key.beamId,
      sinrDb: opportunity.sinr.value,
    } as LinkSample));
  manager.update(managerSamples, 0, Date.UTC(2026, 7, 27, 12, 0, 0));
  assert.equal(
    manager.state.pendingTarget === null
      ? null
      : `${manager.state.pendingTarget.satId}|${manager.state.pendingTarget.beamId}`,
    selected === null ? null : candidateLinkKeyString(selected),
  );
});
