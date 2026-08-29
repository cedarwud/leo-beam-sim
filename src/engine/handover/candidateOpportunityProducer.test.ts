import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  candidateLinkKeyString,
  type CandidateLinkKey,
  type CandidateGateResult,
  type EvidenceStatus,
  type ForecastEeEvidence,
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
import {
  attachCandidateForecastEeValidation,
  type CandidateForecastEeValidationBatch,
} from './candidateForecastEeValidation';

const PRIMARY_UE = 'ue-primary';
const SOURCE_FRAME = 'walker:2026-08-27T12:00:00.000Z:42';
const FORECAST_POLICY_HASH = 'homepage-ee-handover-v1:policy';
const FORECAST_FROM = candidateLinkKey('SAT-A', 0);
const FORECAST_TO = candidateLinkKey('SAT-B', 1);

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

function forecastEvidence(target: CandidateLinkKey = FORECAST_TO): ForecastEeEvidence {
  return {
    status: 'valid',
    horizonSec: 17.5,
    deliveredBits: 1_750,
    consumedJoules: 17.5,
    eeBitPerJ: 100,
    baselineDeliveredBits: 1_400,
    baselineConsumedJoules: 17.5,
    baselineEeBitPerJ: 80,
    relativeDelta: 0.25,
    action: {
      primaryUeId: PRIMARY_UE,
      from: FORECAST_FROM,
      to: target,
      affectedUeIds: [PRIMARY_UE],
      affectedBeamKeys: [FORECAST_FROM, target],
    },
    provenance: {
      epochUtcMs: 0,
      startSimTimeMs: 1_000,
      endSimTimeMs: 18_500,
      frameIdsOrDigest: 'walker-forecast-frames:fixture',
      sampleDurationsDigest: 'walker-forecast-durations:fixture',
      baselineAssignmentKey: 'SAT-A|0',
      canonicalInputHash: 'canonical-input:fixture',
      assignmentStateHash: 'assignment:fixture',
      powerStateHash: 'power:fixture',
      scenarioStateHash: 'scenario:fixture',
      geometryModelHash: 'geometry:fixture',
      canonicalConfigHash: 'canonical-config:fixture',
      policyConfigHash: FORECAST_POLICY_HASH,
      switchEventAccountingMode: 'target-once-at-horizon-start',
      switchBoundarySimTimeMs: 1_000,
      switchTargetBeamIndex: 1,
      switchIndicatorDigest: 'switch-indicator:fixture',
    },
    modelVersion: 'family-b-thesis-3.13-3.17-v1',
    reason: null,
  };
}

function forecastOpportunitySet() {
  return produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    thresholds,
    measurements: [
      measurement('SAT-A', 0, 10, { remainingServiceTimeSec: 80 }),
      measurement('SAT-B', 1, 12, { remainingServiceTimeSec: 80 }),
    ],
  });
}

function forecastBatch(
  overrides: Partial<CandidateForecastEeValidationBatch> = {},
): CandidateForecastEeValidationBatch {
  return {
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    policyConfigHash: FORECAST_POLICY_HASH,
    receipts: [{ key: FORECAST_TO, evidence: forecastEvidence() }],
    ...overrides,
  };
}

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

test('attaches validation EE without changing compatibility gates, ordering, or counts', () => {
  const source = forecastOpportunitySet();
  const sourceBefore = JSON.stringify(source);
  const batch = forecastBatch();
  const inputEvidence = batch.receipts[0]!.evidence;
  const attached = attachCandidateForecastEeValidation(source, batch);

  assert.equal(JSON.stringify(source), sourceBefore);
  assert.equal(source.opportunities[1]!.forecastEe, null);
  assert.equal(attached.opportunities[0]!.forecastEe, null);
  assert.equal(attached.opportunities[1]!.forecastEe?.status, 'valid');
  assert.notEqual(attached.opportunities[1]!.forecastEe, inputEvidence);
  assert.notEqual(attached.opportunities[1]!.forecastEe?.action, inputEvidence.action);
  assert.notEqual(attached.opportunities[1]!.forecastEe?.provenance, inputEvidence.provenance);
  assert.deepEqual(attached.opportunities.map(item => item.key), source.opportunities.map(item => item.key));
  assert.deepEqual(attached.opportunities.map(item => item.gates), source.opportunities.map(item => item.gates));
  assert.equal(attached.opportunities[1]!.gates.find(gate => gate.code === 'ee-advantage')?.result, 'unavailable');
  assert.equal(attached.counts, source.counts);
  assert.equal(Object.isFrozen(attached.opportunities[1]!.forecastEe), true);

  const cleared = attachCandidateForecastEeValidation(attached, forecastBatch({ receipts: [] }));
  assert.equal(cleared.opportunities.every(item => item.forecastEe === null), true);
});

test('validation EE attachment fails closed across frame, policy, identity, and duplicate drift', () => {
  const source = forecastOpportunitySet();
  assert.throws(
    () => attachCandidateForecastEeValidation(source, forecastBatch({ sourceFrameId: 'walker:another-frame' })),
    /sourceFrameId does not match/,
  );
  assert.throws(
    () => attachCandidateForecastEeValidation(source, forecastBatch({ policyConfigHash: 'another-policy' })),
    /another policy configuration/,
  );
  assert.throws(
    () => attachCandidateForecastEeValidation(source, forecastBatch({
      receipts: [{
        key: candidateLinkKey('SAT-C', 2),
        evidence: forecastEvidence(candidateLinkKey('SAT-C', 2)),
      }],
    })),
    /absent from the opportunity set/,
  );
  assert.throws(
    () => attachCandidateForecastEeValidation(source, forecastBatch({
      receipts: [forecastBatch().receipts[0]!, forecastBatch().receipts[0]!],
    })),
    /duplicate receipt/,
  );
  assert.throws(
    () => attachCandidateForecastEeValidation(source, forecastBatch({
      receipts: [{ key: FORECAST_TO, evidence: forecastEvidence(candidateLinkKey('SAT-C', 2)) }],
    })),
    /action target does not match/,
  );
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
