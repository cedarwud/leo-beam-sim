import assert from 'node:assert/strict';

import {
  candidateLinkKey,
  candidateLinkKeyString,
  compareCandidateLinkKey,
  createHandoverDecisionFrame,
  deriveCandidateDecisionState,
  deriveCandidateEligibility,
  deriveCandidateTriggerStatus,
  deriveHandoverKind,
  isForecastEeRankable,
  requiresDecisionReset,
  validateCandidateOpportunity,
  type CandidateGateResult,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type CandidateSinrMeasurementContext,
  type DecisionClockContext,
  type EvidenceStatus,
  type ForecastEeEvidence,
  type MetricEvidence,
} from './candidateDecisionContract';

const UE = 'ue-1';
const FRAME = 'walker-frame-1';

function metric(
  value: number | null,
  unit: string,
  status: EvidenceStatus = 'available',
): MetricEvidence {
  return {
    status,
    value,
    unit,
    sourceFrameId: status === 'available' ? FRAME : null,
    reason: status === 'available' ? null : 'evidence is not usable in this frame',
  };
}

function gate(code: CandidateGateResult['code'], result: CandidateGateResult['result'] = 'pass'): CandidateGateResult {
  return {
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : 1,
    threshold: result === 'unavailable' ? null : 0,
    unit: result === 'unavailable' ? null : 'unit',
    reason: result === 'pass' ? null : `gate ${result}`,
  };
}

function provenance() {
  return {
    epochUtcMs: 0,
    startSimTimeMs: 0,
    endSimTimeMs: 60_000,
    frameIdsOrDigest: 'frames:walker-frame-1..walker-frame-4',
    sampleDurationsDigest: 'dt:1s x 60',
    baselineAssignmentKey: 'SAT-SERVING|0',
    canonicalInputHash: 'canonical-input-hash',
    assignmentStateHash: 'assignment-state-hash',
    powerStateHash: 'power-state-hash',
    scenarioStateHash: 'scenario-state-hash',
    geometryModelHash: 'geometry-model-hash',
    canonicalConfigHash: 'canonical-config-hash',
    policyConfigHash: 'policy-config-hash',
    switchEventAccountingMode: 'target-once-at-horizon-start' as const,
    switchBoundarySimTimeMs: 0,
    switchTargetBeamIndex: 1,
    switchIndicatorDigest: 'fnv1a32-deadbeef',
  };
}

function forecast(key: CandidateLinkKey, status: ForecastEeEvidence['status'] = 'valid'): ForecastEeEvidence {
  if (status === 'valid') {
    return {
      status,
      horizonSec: 60,
      deliveredBits: 600,
      consumedJoules: 60,
      eeBitPerJ: 10,
      baselineDeliveredBits: 480,
      baselineConsumedJoules: 60,
      baselineEeBitPerJ: 8,
      relativeDelta: 0.25,
      action: {
        primaryUeId: UE,
        from: candidateLinkKey('SAT-SERVING', 0),
        to: key,
        affectedUeIds: [UE],
        affectedBeamKeys: [candidateLinkKey('SAT-SERVING', 0), key],
      },
      provenance: provenance(),
      modelVersion: 'canonical-walker-ee-v1',
      reason: null,
    };
  }
  return {
    status,
    horizonSec: status === 'stale' ? 60 : null,
    deliveredBits: status === 'stale' ? 600 : null,
    consumedJoules: status === 'stale' ? 60 : null,
    eeBitPerJ: null,
    baselineDeliveredBits: status === 'stale' ? 480 : null,
    baselineConsumedJoules: status === 'stale' ? 60 : null,
    baselineEeBitPerJ: status === 'stale' ? 8 : null,
    relativeDelta: null,
    action: null,
    provenance: null,
    modelVersion: null,
    reason: `${status} counterfactual evidence`,
  };
}

function opportunity(
  key: CandidateLinkKey,
  options: {
    readonly primaryUeId?: string;
    readonly sourceFrameId?: string;
    readonly elevation?: MetricEvidence;
    readonly forecastEe?: ForecastEeEvidence | null;
    readonly includeEeGate?: boolean;
    readonly sinrMeasurementContext?: CandidateSinrMeasurementContext;
  } = {},
): CandidateOpportunity {
  const sourceFrameId = options.sourceFrameId ?? FRAME;
  const available = (value: number, unit: string): MetricEvidence => ({
    status: 'available',
    value,
    unit,
    sourceFrameId,
    reason: null,
  });
  return {
    key,
    primaryUeId: options.primaryUeId ?? UE,
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    ...(options.sinrMeasurementContext === undefined
      ? {}
      : { sinrMeasurementContext: options.sinrMeasurementContext }),
    geometryClass: 'service-eligible',
    elevation: options.elevation ?? available(35, 'deg'),
    steering: available(2, 'deg'),
    range: available(900, 'km'),
    sinr: available(12, 'dB'),
    predictedThroughput: available(120, 'Mbit/s'),
    remainingServiceTime: available(240, 's'),
    forecastEe: options.forecastEe === undefined ? forecast(key) : options.forecastEe,
    gates: [
      gate('elevation'),
      gate('steering'),
      gate('scheduled-illumination'),
      gate('sinr'),
      gate('throughput'),
      gate('remaining-service-time'),
      ...(options.includeEeGate === false ? [] : [gate('ee-advantage')]),
    ],
  };
}

function clock(overrides: Partial<DecisionClockContext> = {}): DecisionClockContext {
  return {
    simTimeMs: 5_000,
    dtSec: 2,
    sourceFrameId: FRAME,
    epochToken: 'walker-epoch-1',
    discontinuity: 'none',
    previousSimTimeMs: 3_000,
    previousEpochToken: 'walker-epoch-1',
    ...overrides,
  };
}

const satABeam1 = candidateLinkKey('SAT-A', 1);
const satABeam2 = candidateLinkKey('SAT-A', 2);
const satBBeam1 = candidateLinkKey('SAT-B', 1);

const ratedAdmissionContext: CandidateSinrMeasurementContext = {
  purpose: 'sinr-offset-admission',
  powerModel: 'profile-rated-rf',
  profileId: 'candidate-rich',
  epochToken: 'walker-epoch-1',
  ratedTransmitPowerDbm: 50,
  activeInterferenceKeys: ['SAT-SERVING|0', 'SAT-B|1'],
};

validateCandidateOpportunity(opportunity(satABeam1, {
  sinrMeasurementContext: ratedAdmissionContext,
}));

for (const [context, expected] of [
  [{ ...ratedAdmissionContext, purpose: 'invalid-purpose' }, /SINR purpose is invalid/],
  [{ ...ratedAdmissionContext, powerModel: 'invalid-model' }, /SINR power model is invalid/],
  [{ ...ratedAdmissionContext, ratedTransmitPowerDbm: null }, /requires rated transmit power/],
  [{ ...ratedAdmissionContext, activeInterferenceKeys: ['SAT-A|0', 'SAT-A|0'] }, /contains duplicate/],
  [{ ...ratedAdmissionContext, activeInterferenceKeys: [''] }, /active interference key must be non-empty/],
] as const) {
  assert.throws(
    () => validateCandidateOpportunity(opportunity(satABeam1, {
      sinrMeasurementContext: context as CandidateSinrMeasurementContext,
    })),
    expected,
  );
}

// The pair, not the satellite alone, is the identity used by every join.
assert.equal(candidateLinkKeyString(candidateLinkKey('SAT-A', 1)), 'SAT-A|1');
assert.equal(candidateLinkKeyString(satABeam1), candidateLinkKeyString(candidateLinkKey('SAT-A', 1)));
assert.notEqual(candidateLinkKeyString(satABeam1), candidateLinkKeyString(satABeam2));
assert.equal(compareCandidateLinkKey(satABeam1, satABeam2) < 0, true);

assert.equal(deriveHandoverKind(null, satABeam1), 'initial-attach');
assert.equal(deriveHandoverKind(satABeam1, satABeam2), 'intra-satellite');
assert.equal(deriveHandoverKind(satABeam1, satBBeam1), 'inter-satellite');
assert.throws(() => deriveHandoverKind(satABeam1, satABeam1), /must differ/);

const unavailableElevation = metric(null, 'deg', 'unavailable');
const unavailableOpportunity = opportunity(satABeam2, { elevation: unavailableElevation });
assert.equal(deriveCandidateEligibility(unavailableOpportunity), 'unavailable');
const unavailableState = deriveCandidateDecisionState(unavailableOpportunity, 10, 3, 1);
assert.equal(unavailableState.hardEligibility, 'unavailable');
assert.equal(unavailableState.triggerStatus, 'satisfied');
assert.equal(unavailableState.stable, false);

for (const status of ['stale', 'invalid'] as const) {
  const notCurrent = opportunity(satABeam2, { forecastEe: forecast(satABeam2, status) });
  assert.equal(isForecastEeRankable(notCurrent.forecastEe), false);
  assert.equal(deriveCandidateTriggerStatus(notCurrent), 'unavailable');
  const state = deriveCandidateDecisionState(notCurrent, 10, 3, 1);
  assert.equal(state.triggerStatus, 'unavailable');
  assert.equal(state.stable, false);
}

assert.throws(
  () => validateCandidateOpportunity(opportunity(satABeam2, {
    forecastEe: {
      ...forecast(satABeam2),
      baselineEeBitPerJ: 0,
      relativeDelta: null,
    },
  })),
  /baseline must be positive/,
);

assert.throws(
  () => validateCandidateOpportunity(opportunity(satABeam2, {
    forecastEe: {
      ...forecast(satABeam2),
      baselineDeliveredBits: 481,
    },
  })),
  /baselineDeliveredBits \/ baselineConsumedJoules/,
);

const good = opportunity(satABeam1);
const goodState = deriveCandidateDecisionState(good, 3, 3, 1);
const validFrame = createHandoverDecisionFrame({
  episodeId: 'episode-1',
  sourceFrameId: FRAME,
  simTimeMs: 5_000,
  phase: 'initial-attach',
  serving: null,
  opportunities: [good],
  states: [goodState],
  provisionalLeader: satABeam1,
  selectedTarget: satABeam1,
  selectedKind: 'initial-attach',
  selectionHoldSec: 0,
  selectionHoldRequiredSec: 0,
  mode: 'sinr-offset',
  recentCommit: null,
});
assert.equal(validFrame.serving, null);
assert.equal(Object.isFrozen(validFrame), true);
assert.equal(Object.isFrozen(validFrame.opportunities), true);
assert.equal(Object.isFrozen(validFrame.opportunities[0]), true);
assert.equal(Object.isFrozen(validFrame.opportunities[0].gates), true);

const wrongUe = opportunity(satABeam2, { primaryUeId: 'ue-2', forecastEe: null });
const wrongUeState = deriveCandidateDecisionState(wrongUe, 0, 3, null);
assert.throws(
  () => createHandoverDecisionFrame({
    ...validFrame,
    opportunities: [good, wrongUe],
    states: [goodState, wrongUeState],
  }),
  /different primary UEs/,
);

const wrongFrame = opportunity(satABeam2, { sourceFrameId: 'walker-frame-2', forecastEe: null });
const wrongFrameState = deriveCandidateDecisionState(wrongFrame, 0, 3, null);
assert.throws(
  () => createHandoverDecisionFrame({
    ...validFrame,
    opportunities: [good, wrongFrame],
    states: [goodState, wrongFrameState],
  }),
  /different source frame/,
);

assert.equal(requiresDecisionReset(clock()), false);
assert.equal(requiresDecisionReset(clock({ discontinuity: 'seek' })), true);
assert.equal(requiresDecisionReset(clock({ discontinuity: 'loop-wrap' })), true);
assert.equal(requiresDecisionReset(clock({ epochToken: 'walker-epoch-2' })), true);
assert.equal(requiresDecisionReset(clock({ simTimeMs: 4_000, dtSec: 0, previousSimTimeMs: 5_000 })), true);
assert.equal(requiresDecisionReset(clock({ dtSec: -1 })), true);

console.log('candidate decision contract tests passed');
