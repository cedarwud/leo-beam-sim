import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  type CandidateGateResult,
  type EvidenceStatus,
  type MetricEvidence,
} from './candidateDecisionContract';
import {
  isSinrCompatibilityFallbackCandidate,
  selectServiceContinuityFallback,
  SERVICE_CONTINUITY_FALLBACK_REASON,
} from './serviceContinuityFallback';
import {
  produceCandidateOpportunitySet,
  type CandidateLinkMeasurement,
} from './candidateOpportunityProducer';

const PRIMARY_UE = 'ue-primary';
const SOURCE_FRAME = 'walker:continuity:42';
const THRESHOLDS = {
  minimumElevationDeg: 10,
  maximumSteeringDeg: 50,
  minimumSinrDb: -5,
  minimumThroughputBps: null,
  minimumRemainingServiceTimeSec: null,
};

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
    reason: status === 'available' ? null : `${unit} unavailable`,
  };
}

function scheduled(result: CandidateGateResult['result']): CandidateGateResult {
  return {
    code: 'scheduled-illumination',
    category: 'hard-qos',
    result,
    measured: result === 'pass' ? 1 : result === 'fail' ? 0 : null,
    threshold: 1,
    unit: 'boolean',
    reason: result === 'pass' ? null : 'not illuminated',
  };
}

function measurement(
  satelliteId: string,
  beamId: number,
  sinrDb: number,
  options: {
    readonly steeringDeg?: number;
    readonly scheduled?: CandidateGateResult['result'];
    readonly sinrStatus?: EvidenceStatus;
  } = {},
): CandidateLinkMeasurement {
  const available = (value: number, unit: string): MetricEvidence => metric(value, unit);
  const sinrStatus = options.sinrStatus ?? 'available';
  return {
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    beamIdentitySource: 'walker-cell-surrogate',
    elevation: available(35, 'deg'),
    steering: available(options.steeringDeg ?? 8, 'deg'),
    range: available(900, 'km'),
    sinr: sinrStatus === 'available' ? available(sinrDb, 'dB') : metric(null, 'dB', sinrStatus),
    predictedThroughput: available(120_000_000, 'bit/s'),
    remainingServiceTime: metric(null, 's', 'unavailable'),
    scheduledIllumination: scheduled(options.scheduled ?? 'pass'),
  };
}

function setFrom(measurements: readonly CandidateLinkMeasurement[]) {
  return produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId: SOURCE_FRAME,
    thresholds: THRESHOLDS,
    measurements,
  });
}

function input(
  serving: ReturnType<typeof candidateLinkKey>,
  opportunitySet: ReturnType<typeof setFrom>,
  overrides: Partial<{ episodeId: string; sourceFrameId: string; simTimeMs: number }> = {},
) {
  return {
    serving,
    opportunitySet,
    clock: {
      episodeId: overrides.episodeId ?? 'continuity-episode/7',
      sourceFrameId: overrides.sourceFrameId ?? SOURCE_FRAME,
      simTimeMs: overrides.simTimeMs ?? 12_345,
    },
  };
}

test('does not interfere while the serving pair remains in the frame', () => {
  const set = setFrom([
    measurement('SAT-A', 1, 2),
    measurement('SAT-B', 4, 30),
  ]);
  assert.equal(selectServiceContinuityFallback(input(candidateLinkKey('SAT-A', 1), set)), null);
});

test('chooses the highest SINR safe pair with a stable key tie-break', () => {
  const set = setFrom([
    measurement('SAT-B', 4, 14),
    measurement('SAT-A', 9, 14),
    measurement('SAT-C', 1, 14),
    measurement('SAT-D', 1, 25, { steeringDeg: 70 }),
    measurement('SAT-E', 1, 24, { scheduled: 'fail' }),
    measurement('SAT-F', 1, 23, { sinrStatus: 'unavailable' }),
  ]);
  const receipt = selectServiceContinuityFallback(input(candidateLinkKey('SAT-Z', 1), set));
  assert.notEqual(receipt, null);
  assert.deepEqual(receipt?.from, candidateLinkKey('SAT-Z', 1));
  assert.deepEqual(receipt?.to, candidateLinkKey('SAT-A', 9));
  assert.equal(receipt?.kind, 'inter-satellite');
  assert.equal(receipt?.mode, 'service-continuity-protection');
  assert.equal(receipt?.reason, SERVICE_CONTINUITY_FALLBACK_REASON);
  assert.equal(receipt?.oldLinkEnded, true);
  assert.equal(receipt?.newLinkStarted, true);
  assert.equal(receipt?.episodeId, 'continuity-episode/7');
  assert.equal(receipt?.sourceFrameId, SOURCE_FRAME);
  assert.equal(receipt?.simTimeMs, 12_345);
});

test('supports intra-satellite replacement and exposes the exact compatibility predicate', () => {
  const set = setFrom([
    measurement('SAT-A', 8, 30),
    measurement('SAT-B', 2, 18),
  ]);
  const candidate = set.opportunities.find(item => item.key.satelliteId === 'SAT-A')!;
  assert.equal(isSinrCompatibilityFallbackCandidate(candidate), true);
  const receipt = selectServiceContinuityFallback(input(candidateLinkKey('SAT-A', 3), set));
  assert.equal(receipt?.kind, 'intra-satellite');
  assert.deepEqual(receipt?.to, candidateLinkKey('SAT-A', 8));
});

test('returns null when no safe SINR-compatible target exists', () => {
  const set = setFrom([
    measurement('SAT-A', 1, 4, { steeringDeg: 80 }),
    measurement('SAT-B', 2, 4, { scheduled: 'fail' }),
    measurement('SAT-C', 3, 4, { sinrStatus: 'unavailable' }),
  ]);
  assert.equal(selectServiceContinuityFallback(input(candidateLinkKey('SAT-Z', 1), set)), null);
});

test('rejects clock metadata from a different source frame', () => {
  const set = setFrom([measurement('SAT-A', 1, 4)]);
  assert.throws(
    () => selectServiceContinuityFallback(input(candidateLinkKey('SAT-Z', 1), set, {
      sourceFrameId: 'other-frame',
    })),
    /share one source frame/,
  );
});
