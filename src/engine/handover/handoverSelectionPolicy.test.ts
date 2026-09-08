import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ForecastEePolicy,
  InstantaneousEePolicy,
  SINR_OFFSET_REQUIRED_GATES,
  SinrOffsetPolicy,
  type HandoverSelectionPolicyInput,
} from './handoverSelectionPolicy';
import {
  candidateLinkKey,
  candidateLinkKeyString,
  type CandidateGateResult,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type ForecastEeEvidence,
  type MetricEvidence,
} from './candidateDecisionContract';

const UE = 'ue-primary';
const FRAME = 'walker-frame-1';
const SERVING = candidateLinkKey('SAT-S', 0);

function metric(value: number | null, unit: string, status: MetricEvidence['status'] = 'available'): MetricEvidence {
  return {
    status,
    value,
    unit,
    sourceFrameId: status === 'available' ? FRAME : null,
    reason: status === 'available' ? null : `${unit} evidence unavailable`,
  };
}

function gate(
  code: CandidateGateResult['code'],
  result: CandidateGateResult['result'] = 'pass',
): CandidateGateResult {
  if (code === 'scheduled-illumination') {
    return {
      code,
      category: 'hard-qos',
      result,
      measured: result === 'unavailable' ? null : result === 'pass' ? 1 : 0,
      threshold: result === 'unavailable' ? null : 1,
      unit: result === 'unavailable' ? null : 'boolean',
      reason: result === 'pass' ? null : `${code} ${result}`,
    };
  }
  return {
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : result === 'pass' ? 1 : 0,
    threshold: result === 'unavailable' ? null : 0,
    unit: result === 'unavailable' ? null : 'unit',
    reason: result === 'pass' ? null : `${code} ${result}`,
  };
}

function eeAdvantageGate(
  evidence: ForecastEeEvidence | null,
  result: CandidateGateResult['result'],
): CandidateGateResult {
  if (result === 'unavailable' || evidence?.relativeDelta === null || evidence?.relativeDelta === undefined) {
    return gate('ee-advantage', 'unavailable');
  }
  return {
    code: 'ee-advantage',
    category: 'decision-trigger',
    result,
    measured: evidence.relativeDelta,
    threshold: 0.05,
    unit: 'ratio',
    reason: result === 'pass' ? null : 'forecast EE advantage is below threshold',
  };
}

function forecast(key: CandidateLinkKey, eeBitPerJ: number): ForecastEeEvidence {
  const isServing = candidateLinkKeyString(key) === candidateLinkKeyString(SERVING);
  return {
    status: 'valid',
    horizonSec: 60,
    deliveredBits: eeBitPerJ * 60,
    consumedJoules: 60,
    eeBitPerJ,
    baselineDeliveredBits: isServing ? null : 4_800,
    baselineConsumedJoules: isServing ? null : 60,
    baselineEeBitPerJ: isServing ? null : 80,
    relativeDelta: isServing ? null : eeBitPerJ / 80 - 1,
    action: {
      primaryUeId: UE,
      from: isServing ? null : SERVING,
      to: key,
      affectedUeIds: [UE],
      affectedBeamKeys: isServing ? [key] : [SERVING, key],
    },
    provenance: {
      epochUtcMs: 0,
      startSimTimeMs: 0,
      endSimTimeMs: 60_000,
      frameIdsOrDigest: 'frames:1..60',
      sampleDurationsDigest: 'dt:1s',
      baselineAssignmentKey: isServing ? null : candidateLinkKeyString(SERVING),
      canonicalInputHash: 'canonical-input',
      assignmentStateHash: 'assignment-state',
      powerStateHash: 'power-state',
      scenarioStateHash: 'scenario-state',
      geometryModelHash: 'geometry-model',
      canonicalConfigHash: 'canonical-config',
      policyConfigHash: 'policy-config',
      switchEventAccountingMode: 'target-once-at-horizon-start',
      switchBoundarySimTimeMs: 0,
      switchTargetBeamIndex: 1,
      switchIndicatorDigest: 'fnv1a32-deadbeef',
    },
    modelVersion: 'canonical-walker-ee-v1',
    reason: null,
  };
}

function opportunity(
  key: CandidateLinkKey,
  options: {
    readonly sinrDb?: number;
    readonly throughputBps?: number | null;
    readonly remainingSec?: number | null;
    readonly eeBitPerJ?: number | null;
    readonly instantaneousEeBitPerJ?: number | null;
    readonly eeGate?: CandidateGateResult['result'];
    readonly scheduled?: CandidateGateResult['result'];
  } = {},
): CandidateOpportunity {
  const throughputAvailable = options.throughputBps !== null;
  const remainingAvailable = options.remainingSec !== null;
  const eeAvailable = options.eeBitPerJ !== null;
  const forecastEvidence = eeAvailable ? forecast(key, options.eeBitPerJ ?? 100) : null;
  const eeGateResult = options.eeGate ?? (eeAvailable ? 'pass' : 'unavailable');
  return {
    key,
    primaryUeId: UE,
    sourceFrameId: FRAME,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(35, 'deg'),
    steering: metric(5, 'deg'),
    range: metric(900, 'km'),
    sinr: metric(options.sinrDb ?? 12, 'dB'),
    predictedThroughput: throughputAvailable
      ? metric(options.throughputBps ?? 120_000_000, 'bit/s')
      : metric(null, 'bit/s', 'unavailable'),
    remainingServiceTime: remainingAvailable
      ? metric(options.remainingSec ?? 180, 's')
      : metric(null, 's', 'unavailable'),
    ...(options.instantaneousEeBitPerJ === undefined
      ? {}
      : {
        instantaneousEe: options.instantaneousEeBitPerJ === null
          ? metric(null, 'bit/J', 'unavailable')
          : metric(options.instantaneousEeBitPerJ, 'bit/J'),
      }),
    forecastEe: forecastEvidence,
    gates: [
      gate('elevation'),
      gate('steering'),
      gate('scheduled-illumination', options.scheduled ?? 'pass'),
      gate('sinr'),
      gate('throughput', throughputAvailable ? 'pass' : 'unavailable'),
      gate('remaining-service-time', remainingAvailable ? 'pass' : 'unavailable'),
      eeAdvantageGate(forecastEvidence, eeGateResult),
    ],
  };
}

const sinrConfig = {
  initialTttSec: 0,
  interTttSec: 3.5,
  intraTttSec: 0.75,
  interOffsetDb: 3,
  intraOffsetDb: 0,
};

const eeConfig = {
  initialTttSec: 0,
  interTttSec: 3.5,
  intraTttSec: 0.75,
  eeToleranceRelative: 0.05,
};

test('SINR policy applies a compatibility gate mask without relabelling unavailable future gates', () => {
  assert.deepEqual(SINR_OFFSET_REQUIRED_GATES, ['elevation', 'steering', 'scheduled-illumination', 'sinr']);
  const candidate = opportunity(candidateLinkKey('SAT-B', 1), {
    sinrDb: 16,
    throughputBps: null,
    remainingSec: null,
    eeBitPerJ: null,
  });
  const result = new SinrOffsetPolicy(sinrConfig).evaluate({
    serving: opportunity(SERVING, { sinrDb: 10 }),
    alternatives: [candidate],
  });
  assert.equal(result.mode, 'sinr-offset');
  assert.equal(result.assessments[0]?.hardEligibility, 'eligible');
  assert.equal(result.assessments[0]?.triggerStatus, 'satisfied');
  assert.deepEqual(result.assessments[0]?.rejectionCodes, []);
  assert.equal(candidate.predictedThroughput.status, 'unavailable');
  assert.equal(candidate.remainingServiceTime.status, 'unavailable');
  assert.equal(candidate.gates.find(item => item.code === 'throughput')?.result, 'unavailable');
});

test('SINR policy does not satisfy a candidate exactly at the configured margin', () => {
  const result = new SinrOffsetPolicy(sinrConfig).evaluate({
    serving: opportunity(SERVING, { sinrDb: 10 }),
    alternatives: [opportunity(candidateLinkKey('SAT-EXACT-MARGIN', 1), { sinrDb: 13 })],
  });

  assert.equal(result.assessments[0]?.triggerStatus, 'not-satisfied');
});

test('a hard-ineligible pair cannot be reported as trigger-satisfied', () => {
  const candidate = opportunity(candidateLinkKey('SAT-B', 1), {
    sinrDb: 18,
    eeBitPerJ: 110,
    eeGate: 'pass',
    scheduled: 'fail',
  });
  const serving = opportunity(SERVING, { sinrDb: 10, eeBitPerJ: 80 });
  const sinr = new SinrOffsetPolicy(sinrConfig).evaluate({
    serving,
    alternatives: [candidate],
  }).assessments[0];
  const ee = new ForecastEePolicy(eeConfig).evaluate({
    serving,
    alternatives: [candidate],
  }).assessments[0];

  assert.equal(sinr?.hardEligibility, 'ineligible');
  assert.equal(sinr?.triggerStatus, 'not-satisfied');
  assert.equal(ee?.hardEligibility, 'ineligible');
  assert.equal(ee?.triggerStatus, 'not-satisfied');
});

test('scheduled illumination cannot pass without boolean scheduling evidence', () => {
  const valid = opportunity(candidateLinkKey('SAT-B', 1), { sinrDb: 16 });
  const missingScheduleEvidence = {
    ...valid,
    gates: valid.gates.map(item => item.code === 'scheduled-illumination' ? {
      ...item,
      measured: null,
      threshold: null,
      unit: null,
    } : item),
  } as CandidateOpportunity;
  const result = new SinrOffsetPolicy(sinrConfig).evaluate({
    serving: opportunity(SERVING, { sinrDb: 10 }),
    alternatives: [missingScheduleEvidence],
  });
  assert.equal(result.assessments[0]?.hardEligibility, 'unavailable');
  assert.equal(result.assessments[0]?.triggerStatus, 'unavailable');
  assert.deepEqual(result.assessments[0]?.rejectionCodes, ['scheduled-illumination']);
});

test('SINR policy exposes separate initial, intra, and inter TTT and offsets', () => {
  const policy = new SinrOffsetPolicy(sinrConfig);
  const intra = opportunity(candidateLinkKey('SAT-S', 1), { sinrDb: 11 });
  const inter = opportunity(candidateLinkKey('SAT-B', 1), { sinrDb: 14 });
  const withServing = policy.evaluate({
    serving: opportunity(SERVING, { sinrDb: 10 }),
    alternatives: [intra, inter],
  });
  const byKey = new Map(withServing.assessments.map(item => [candidateLinkKeyString(item.key), item]));
  assert.equal(byKey.get('SAT-S|1')?.requiredTttSec, 0.75);
  assert.equal(byKey.get('SAT-S|1')?.triggerStatus, 'satisfied');
  assert.equal(byKey.get('SAT-B|1')?.requiredTttSec, 3.5);
  assert.equal(byKey.get('SAT-B|1')?.triggerStatus, 'satisfied');
  const initial = policy.evaluate({
    serving: null,
    alternatives: [opportunity(candidateLinkKey('SAT-B', 2), { sinrDb: -4 })],
  });
  assert.equal(initial.assessments[0]?.requiredTttSec, 0);
  assert.equal(initial.assessments[0]?.triggerStatus, 'satisfied');
});

test('SINR policy returns deterministic best-first ordering with stable-key tie-break', () => {
  const input: HandoverSelectionPolicyInput = {
    serving: opportunity(SERVING, { sinrDb: 10 }),
    alternatives: [
      opportunity(candidateLinkKey('SAT-Z', 2), { sinrDb: 14 }),
      opportunity(candidateLinkKey('SAT-A', 4), { sinrDb: 14 }),
      opportunity(candidateLinkKey('SAT-M', 1), { sinrDb: 12 }),
    ],
  };
  const result = new SinrOffsetPolicy(sinrConfig).evaluate(input);
  assert.deepEqual(result.assessments.map(item => candidateLinkKeyString(item.key)), [
    'SAT-A|4',
    'SAT-Z|2',
    'SAT-M|1',
  ]);
});

test('instantaneous EE policy selects the largest same-frame EE before SINR ranking', () => {
  const result = new InstantaneousEePolicy({
    initialTttSec: 0,
    interTttSec: 3.5,
    intraTttSec: 0.75,
    eeToleranceRelative: 0,
  }).evaluate({
    serving: opportunity(SERVING, { sinrDb: 25, instantaneousEeBitPerJ: 20 }),
    alternatives: [
      opportunity(candidateLinkKey('SAT-LOW-SINR', 1), {
        sinrDb: 4,
        instantaneousEeBitPerJ: 90,
      }),
      opportunity(candidateLinkKey('SAT-HIGH-SINR', 1), {
        sinrDb: 30,
        instantaneousEeBitPerJ: 60,
      }),
    ],
  });

  assert.equal(result.mode, 'ee-optimization');
  assert.deepEqual(result.assessments.map(item => candidateLinkKeyString(item.key)), [
    'SAT-LOW-SINR|1',
    'SAT-HIGH-SINR|1',
  ]);
  assert.equal(result.assessments[0]?.triggerStatus, 'satisfied');
  assert.equal(result.assessments[1]?.triggerStatus, 'satisfied');
});

test('instantaneous EE policy only qualifies a candidate when its EE is greater than serving EE', () => {
  const result = new InstantaneousEePolicy({
    initialTttSec: 0,
    interTttSec: 3.5,
    intraTttSec: 0.75,
    eeToleranceRelative: 0,
  }).evaluate({
    serving: opportunity(SERVING, { instantaneousEeBitPerJ: 100 }),
    alternatives: [
      opportunity(candidateLinkKey('SAT-BELOW', 1), { instantaneousEeBitPerJ: 99 }),
      opportunity(candidateLinkKey('SAT-WINNER', 1), { instantaneousEeBitPerJ: 101 }),
    ],
  });

  const byKey = new Map(result.assessments.map(item => [candidateLinkKeyString(item.key), item]));
  assert.equal(byKey.get('SAT-WINNER|1')?.triggerStatus, 'satisfied');
  assert.equal(byKey.get('SAT-BELOW|1')?.triggerStatus, 'not-satisfied');
  assert.deepEqual(result.assessments.map(item => candidateLinkKeyString(item.key)), [
    'SAT-WINNER|1',
    'SAT-BELOW|1',
  ]);
});

test('instantaneous EE policy enforces the configured absolute candidate floor', () => {
  const result = new InstantaneousEePolicy({
    initialTttSec: 0,
    interTttSec: 3.5,
    intraTttSec: 0.75,
    eeToleranceRelative: 0,
    minimumEeBitsPerJoule: 100_000,
  }).evaluate({
    serving: opportunity(SERVING, { instantaneousEeBitPerJ: 90_000 }),
    alternatives: [
      opportunity(candidateLinkKey('SAT-BELOW-FLOOR', 1), { instantaneousEeBitPerJ: 99_999 }),
      opportunity(candidateLinkKey('SAT-ABOVE-FLOOR', 1), { instantaneousEeBitPerJ: 100_001 }),
    ],
  });

  const byKey = new Map(result.assessments.map(item => [candidateLinkKeyString(item.key), item]));
  assert.equal(byKey.get('SAT-BELOW-FLOOR|1')?.triggerStatus, 'not-satisfied');
  assert.equal(byKey.get('SAT-ABOVE-FLOOR|1')?.triggerStatus, 'satisfied');

  const initialAttach = new InstantaneousEePolicy({
    initialTttSec: 0,
    interTttSec: 3.5,
    intraTttSec: 0.75,
    eeToleranceRelative: 0,
    minimumEeBitsPerJoule: 100_000,
  }).evaluate({
    serving: null,
    alternatives: [opportunity(candidateLinkKey('SAT-INITIAL-BELOW-FLOOR', 1), {
      instantaneousEeBitPerJ: 99_999,
    })],
  });
  assert.equal(initialAttach.assessments[0]?.triggerStatus, 'not-satisfied');
});

test('instantaneous EE policy admits a candidate exactly at the absolute floor when it improves service', () => {
  const result = new InstantaneousEePolicy({
    initialTttSec: 0,
    interTttSec: 3.5,
    intraTttSec: 0.75,
    eeToleranceRelative: 0,
    minimumEeBitsPerJoule: 100,
  }).evaluate({
    serving: opportunity(SERVING, { instantaneousEeBitPerJ: 50 }),
    alternatives: [
      opportunity(candidateLinkKey('SAT-AT-FLOOR', 1), { instantaneousEeBitPerJ: 100 }),
    ],
  });

  assert.equal(result.assessments[0]?.triggerStatus, 'satisfied');
});

test('instantaneous EE policy does not trigger while serving EE is exactly at its health floor', () => {
  const result = new InstantaneousEePolicy({
    initialTttSec: 0,
    interTttSec: 3.5,
    intraTttSec: 0.75,
    eeToleranceRelative: 0,
    servingEeThresholdBitsPerJoule: 100,
  }).evaluate({
    serving: opportunity(SERVING, { instantaneousEeBitPerJ: 100 }),
    alternatives: [
      opportunity(candidateLinkKey('SAT-ABOVE-HEALTH-FLOOR', 1), { instantaneousEeBitPerJ: 101 }),
    ],
  });

  assert.equal(result.assessments[0]?.triggerStatus, 'not-satisfied');
});

test('instantaneous EE policy fails closed when same-frame EE is unavailable', () => {
  const result = new InstantaneousEePolicy({
    initialTttSec: 0,
    interTttSec: 3.5,
    intraTttSec: 0.75,
    eeToleranceRelative: 0,
  }).evaluate({
    serving: opportunity(SERVING, { instantaneousEeBitPerJ: 50 }),
    alternatives: [opportunity(candidateLinkKey('SAT-MISSING-EE', 1), {
      instantaneousEeBitPerJ: null,
    })],
  });

  assert.equal(result.assessments[0]?.hardEligibility, 'eligible');
  assert.equal(result.assessments[0]?.triggerStatus, 'unavailable');
  assert.deepEqual(result.assessments[0]?.rejectionCodes, ['ee-advantage']);
});

test('EE policy fails closed when forecast evidence or EE trigger is missing', () => {
  const missing = opportunity(candidateLinkKey('SAT-B', 1), {
    eeBitPerJ: null,
    eeGate: 'unavailable',
  });
  const result = new ForecastEePolicy(eeConfig).evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 90 }),
    alternatives: [missing],
  });
  assert.equal(result.mode, 'ee-optimization');
  assert.equal(result.assessments[0]?.hardEligibility, 'eligible');
  assert.equal(result.assessments[0]?.triggerStatus, 'unavailable');
  assert.deepEqual(result.assessments[0]?.rejectionCodes, ['ee-advantage']);
});

test('both policies turn malformed candidate evidence into an unavailable assessment', () => {
  const valid = opportunity(candidateLinkKey('SAT-B', 1), { sinrDb: 16 });
  const malformed = {
    ...valid,
    gates: valid.gates.filter(item => item.code !== 'sinr'),
  } as CandidateOpportunity;
  const sinrResult = new SinrOffsetPolicy(sinrConfig).evaluate({
    serving: opportunity(SERVING, { sinrDb: 10 }),
    alternatives: [malformed],
  });
  assert.equal(sinrResult.assessments[0]?.hardEligibility, 'unavailable');
  assert.equal(sinrResult.assessments[0]?.triggerStatus, 'unavailable');
  assert.equal(sinrResult.assessments[0]?.rejectionCodes.includes('sinr'), true);
  const eeResult = new ForecastEePolicy(eeConfig).evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 80 }),
    alternatives: [malformed],
  });
  assert.equal(eeResult.assessments[0]?.hardEligibility, 'unavailable');
  assert.equal(eeResult.assessments[0]?.triggerStatus, 'unavailable');
  assert.equal(eeResult.assessments[0]?.rejectionCodes.includes('ee-advantage'), true);
});

test('malformed metrics remain unavailable and deterministically ordered instead of escaping the fallback', () => {
  const malformed = (satelliteId: string) => ({
    ...opportunity(candidateLinkKey(satelliteId, 1), { sinrDb: 16 }),
    sinr: undefined,
    remainingServiceTime: undefined,
    predictedThroughput: undefined,
  }) as unknown as CandidateOpportunity;
  const policy = new SinrOffsetPolicy(sinrConfig);
  const evaluate = (alternatives: readonly CandidateOpportunity[]) => policy.evaluate({
    serving: opportunity(SERVING, { sinrDb: 10 }),
    alternatives,
  }).assessments;
  const forward = evaluate([malformed('SAT-Z'), malformed('SAT-A')]);
  const reverse = evaluate([malformed('SAT-A'), malformed('SAT-Z')]);

  assert.deepEqual(forward.map(item => candidateLinkKeyString(item.key)), ['SAT-A|1', 'SAT-Z|1']);
  assert.deepEqual(reverse.map(item => candidateLinkKeyString(item.key)), ['SAT-A|1', 'SAT-Z|1']);
  assert.equal(forward.every(item => item.hardEligibility === 'unavailable'), true);

  const missingForecast = {
    ...malformed('SAT-B'),
    forecastEe: undefined,
  } as unknown as CandidateOpportunity;
  const eeResult = new ForecastEePolicy(eeConfig).evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 80 }),
    alternatives: [missingForecast],
  });
  assert.equal(eeResult.assessments[0]?.hardEligibility, 'unavailable');
  assert.equal(eeResult.assessments[0]?.triggerStatus, 'unavailable');
});

test('EE policy rejects a valid forecast whose declared source assignment is not serving', () => {
  const candidate = opportunity(candidateLinkKey('SAT-B', 1), { eeBitPerJ: 100 });
  const wrongFrom = candidateLinkKey('SAT-X', 7);
  const wrongIdentity = {
    ...candidate,
    forecastEe: {
      ...candidate.forecastEe!,
      action: {
        ...candidate.forecastEe!.action!,
        from: wrongFrom,
        affectedBeamKeys: [wrongFrom, candidate.key],
      },
    },
  };
  const result = new ForecastEePolicy(eeConfig).evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 80 }),
    alternatives: [wrongIdentity],
  });
  assert.equal(result.assessments[0]?.hardEligibility, 'eligible');
  assert.equal(result.assessments[0]?.triggerStatus, 'unavailable');
});

test('EE policy requires a positive keep-serving baseline and a common forecast window', () => {
  const noBaselineSource = opportunity(candidateLinkKey('SAT-A', 1), { eeBitPerJ: 100 });
  const noBaseline = {
    ...noBaselineSource,
    forecastEe: {
      ...noBaselineSource.forecastEe!,
      baselineEeBitPerJ: null,
      relativeDelta: null,
    },
  };
  const firstWindow = opportunity(candidateLinkKey('SAT-B', 1), { eeBitPerJ: 104 });
  const secondWindowSource = opportunity(candidateLinkKey('SAT-C', 1), { eeBitPerJ: 110 });
  const secondWindow = {
    ...secondWindowSource,
    forecastEe: {
      ...secondWindowSource.forecastEe!,
      horizonSec: 61,
      provenance: {
        ...secondWindowSource.forecastEe!.provenance!,
        endSimTimeMs: 61_000,
      },
    },
  };
  const policy = new ForecastEePolicy(eeConfig);
  const baselineResult = policy.evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 80 }),
    alternatives: [noBaseline],
  });
  assert.equal(baselineResult.assessments[0]?.triggerStatus, 'unavailable');

  const mixedWindowResult = policy.evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 80 }),
    alternatives: [firstWindow, secondWindow],
  });
  assert.equal(mixedWindowResult.assessments.every(item => item.triggerStatus === 'unavailable'), true);

  for (const provenanceOverride of [
    { scenarioStateHash: 'scenario-state:other' },
    { geometryModelHash: 'geometry-model:other' },
  ]) {
    const mismatchedSource = opportunity(candidateLinkKey('SAT-D', 1), { eeBitPerJ: 108 });
    const mismatched = {
      ...mismatchedSource,
      forecastEe: {
        ...mismatchedSource.forecastEe!,
        provenance: {
          ...mismatchedSource.forecastEe!.provenance!,
          ...provenanceOverride,
        },
      },
    };
    const result = policy.evaluate({
      serving: opportunity(SERVING, { eeBitPerJ: 80 }),
      alternatives: [firstWindow, mismatched],
    });
    assert.equal(result.assessments.every(item => item.triggerStatus === 'unavailable'), true);
  }

  const epochA = opportunity(candidateLinkKey('SAT-E', 1), { eeBitPerJ: 106 });
  const epochB = opportunity(candidateLinkKey('SAT-F', 1), { eeBitPerJ: 107 });
  const withEpoch = (candidate: CandidateOpportunity, epochUtcMs: number): CandidateOpportunity => ({
    ...candidate,
    forecastEe: {
      ...candidate.forecastEe!,
      provenance: {
        ...candidate.forecastEe!.provenance!,
        epochUtcMs,
        startSimTimeMs: 1_000,
        endSimTimeMs: 61_000,
        switchBoundarySimTimeMs: 1_000,
      },
    },
  });
  const mismatchedEpochResult = policy.evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 80 }),
    alternatives: [withEpoch(epochA, 0), withEpoch(epochB, 500)],
  });
  assert.equal(mismatchedEpochResult.assessments.every(item => item.triggerStatus === 'unavailable'), true);
});

test('EE policy can select an initial attachment without claiming improvement over a serving baseline', () => {
  const source = opportunity(candidateLinkKey('SAT-A', 1), { eeBitPerJ: 100 });
  const initialCandidate: CandidateOpportunity = {
    ...source,
    forecastEe: {
      ...source.forecastEe!,
      baselineDeliveredBits: null,
      baselineConsumedJoules: null,
      baselineEeBitPerJ: null,
      relativeDelta: null,
      action: {
        ...source.forecastEe!.action!,
        from: null,
        affectedBeamKeys: [source.key],
      },
      provenance: {
        ...source.forecastEe!.provenance!,
        baselineAssignmentKey: null,
      },
    },
    gates: source.gates.map(item => item.code === 'ee-advantage'
      ? gate('ee-advantage', 'unavailable')
      : item),
  };
  const result = new ForecastEePolicy(eeConfig).evaluate({ serving: null, alternatives: [initialCandidate] });
  assert.equal(result.assessments[0]?.hardEligibility, 'eligible');
  assert.equal(result.assessments[0]?.triggerStatus, 'satisfied');
  assert.equal(result.assessments[0]?.requiredTttSec, 0);
});

test('EE ranking uses relative tolerance, then remaining service, throughput, and stable key', () => {
  const result = new ForecastEePolicy(eeConfig).evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 80 }),
    alternatives: [
      opportunity(candidateLinkKey('SAT-A', 1), { eeBitPerJ: 100, remainingSec: 100, throughputBps: 100_000_000 }),
      opportunity(candidateLinkKey('SAT-B', 1), { eeBitPerJ: 104, remainingSec: 200, throughputBps: 90_000_000 }),
      opportunity(candidateLinkKey('SAT-C', 1), { eeBitPerJ: 110, remainingSec: 1, throughputBps: 1_000_000 }),
    ],
  });
  assert.deepEqual(result.assessments.map(item => candidateLinkKeyString(item.key)), [
    'SAT-C|1',
    'SAT-B|1',
    'SAT-A|1',
  ]);
});

test('EE tolerance groups use a fixed highest-EE anchor and remain input-order independent', () => {
  const candidates = [
    opportunity(candidateLinkKey('SAT-A', 1), { eeBitPerJ: 100, remainingSec: 500 }),
    opportunity(candidateLinkKey('SAT-B', 1), { eeBitPerJ: 104, remainingSec: 300 }),
    opportunity(candidateLinkKey('SAT-C', 1), { eeBitPerJ: 108, remainingSec: 100 }),
  ];
  const evaluate = (alternatives: readonly CandidateOpportunity[]) => new ForecastEePolicy(eeConfig).evaluate({
    serving: opportunity(SERVING, { eeBitPerJ: 80 }),
    alternatives,
  }).assessments.map(item => candidateLinkKeyString(item.key));

  // 108 and 104 are one anchor-relative tolerance group, so remaining service
  // may place 104 first. 100 is outside the 108 anchor's tolerance even though
  // it is close to 104; it cannot enter through a non-transitive tie chain.
  assert.deepEqual(evaluate(candidates), ['SAT-B|1', 'SAT-C|1', 'SAT-A|1']);
  assert.deepEqual(evaluate([...candidates].reverse()), ['SAT-B|1', 'SAT-C|1', 'SAT-A|1']);
});

/**
 * Red-team mutation B: removing 'steering' from SINR_OFFSET_REQUIRED_GATES
 * produced no failure anywhere. It was "caught" once only because deleting a
 * line shifted a line-pinned assertion in check:handover -- a right answer for
 * the wrong reason, and that pin is gone now.
 *
 * The expected set is written out as a literal on purpose. Deriving it from
 * the constant under test is exactly how a change to that constant goes
 * unnoticed.
 *
 * Honest limit: this asserts the SET, not the BEHAVIOUR. It catches a gate
 * being dropped from the list, which is the mutation that went unnoticed, but
 * it would not catch the list being honoured incorrectly downstream. The
 * behavioural half wants a candidate with a failing steering gate proven
 * inadmissible through the policy, which needs a full CandidateOpportunity
 * fixture; see the note in AGENT-EXECUTABILITY-FINDINGS §4.5.3 B.
 */
test('the sinr-offset hard gates are exactly elevation, steering, scheduled-illumination and sinr', () => {
  assert.deepEqual(
    [...SINR_OFFSET_REQUIRED_GATES].sort(),
    ['elevation', 'scheduled-illumination', 'sinr', 'steering'],
  );
});
