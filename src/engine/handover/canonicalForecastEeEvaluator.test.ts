import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_EE_CONFORMANCE_FIXTURES,
  computeCanonicalEe,
  computeCanonicalEvaluation,
  type CanonicalEeInput,
} from '../../analysis/canonicalEe';
import {
  candidateLinkKey,
  type CandidateAssignmentDelta,
} from './candidateDecisionContract';
import {
  buildCanonicalForecastEeEvidence,
  type CanonicalForecastEeSample,
} from './canonicalForecastEeEvaluator';

const FROM = candidateLinkKey('SAT-A', 1);
const TO = candidateLinkKey('SAT-B', 2);
const ACTION: CandidateAssignmentDelta = {
  primaryUeId: 'ue-primary',
  from: FROM,
  to: TO,
  affectedUeIds: ['ue-primary'],
  affectedBeamKeys: [FROM, TO],
};
const DIGESTS = {
  frameIdsOrDigest: 'frames:forecast-0..forecast-1',
  sampleDurationsDigest: 'durations:1,3',
  canonicalInputHash: 'canonical-inputs:fixture-v1',
  assignmentStateHash: 'assignment:fixture-v1',
  powerStateHash: 'power-state:fixture-v1',
  canonicalConfigHash: 'canonical-config:fixture-v1',
};

function pairedInput(durationSec: number): { baseline: CanonicalEeInput; candidate: CanonicalEeInput } {
  const source = CANONICAL_EE_CONFORMANCE_FIXTURES.find(fixture => fixture.id === 'coupled_interference');
  assert.ok(source);
  const baseline: CanonicalEeInput = {
    config: { ...source.input.config, frameDurationS: durationSec },
    frame: {
      ...source.input.frame,
      thetaRadUb: source.input.frame.thetaRadUb.map(row => [...row]),
      propagationGainUb: source.input.frame.propagationGainUb.map(row => [...row]),
      receiveGainUb: source.input.frame.receiveGainUb.map(row => [...row]),
      servingBeamU: [0, 1],
      beamActiveB: [true, true],
      beamLoadB: [1, 1],
      beamSatelliteB: [...source.input.frame.beamSatelliteB],
      beamColorB: [...source.input.frame.beamColorB],
      laggedInterferenceUW: [...source.input.frame.laggedInterferenceUW],
    },
  };
  const candidate: CanonicalEeInput = {
    config: { ...baseline.config },
    frame: {
      ...baseline.frame,
      servingBeamU: [1, 1],
      beamActiveB: [false, true],
      beamLoadB: [0, 2],
      laggedInterferenceUW: [0, baseline.frame.laggedInterferenceUW[1] ?? 0],
    },
  };
  return { baseline, candidate };
}

function sample(startSimTimeMs: number, durationSec: number): CanonicalForecastEeSample {
  const pair = pairedInput(durationSec);
  const thetaRadUb = startSimTimeMs > 10_000
    ? [[0.015, 0.01], [0.01, 0.025]]
    : pair.baseline.frame.thetaRadUb;
  const baselineInput: CanonicalEeInput = {
    ...pair.baseline,
    frame: { ...pair.baseline.frame, thetaRadUb },
  };
  const candidateInput: CanonicalEeInput = {
    ...pair.candidate,
    frame: { ...pair.candidate.frame, thetaRadUb },
  };
  return {
    sourceFrameId: `forecast-${startSimTimeMs}`,
    startSimTimeMs,
    durationSec,
    baselineInput,
    candidateInput,
    ueIdsByIndex: ['ue-primary', 'ue-other'],
    beamKeysByIndex: [FROM, TO],
  };
}

test('computes candidate and keep-serving EE as equal-horizon ratio-of-sums', () => {
  const samples = [sample(10_000, 1), sample(11_000, 3)];
  const evidence = buildCanonicalForecastEeEvidence({ action: ACTION, samples, digests: DIGESTS });
  assert.equal(evidence.status, 'valid');
  assert.equal(evidence.horizonSec, 4);
  assert.ok(evidence.provenance);
  assert.equal(evidence.provenance.startSimTimeMs, 10_000);
  assert.equal(evidence.provenance.endSimTimeMs, 14_000);

  const candidateEvaluation = computeCanonicalEvaluation(samples.map(value => {
    const result = computeCanonicalEe(value.candidateInput);
    return {
      totalRateBps: result.throughput.totalRateBps,
      systemPowerW: result.power.systemPowerW,
      durationSec: value.durationSec,
    };
  }));
  const baselineEvaluation = computeCanonicalEvaluation(samples.map(value => {
    const result = computeCanonicalEe(value.baselineInput);
    return {
      totalRateBps: result.throughput.totalRateBps,
      systemPowerW: result.power.systemPowerW,
      durationSec: value.durationSec,
    };
  }));
  assert.equal(evidence.deliveredBits, candidateEvaluation.deliveredBits);
  assert.equal(evidence.consumedJoules, candidateEvaluation.consumedEnergyJ);
  assert.equal(evidence.eeBitPerJ, candidateEvaluation.energyEfficiencyBitsPerJ);
  assert.equal(evidence.baselineEeBitPerJ, baselineEvaluation.energyEfficiencyBitsPerJ);
  assert.equal(
    evidence.relativeDelta,
    candidateEvaluation.energyEfficiencyBitsPerJ / baselineEvaluation.energyEfficiencyBitsPerJ - 1,
  );

  const arithmeticMeanOfInstantaneousEe = samples.reduce((sum, value) => {
    const result = computeCanonicalEe(value.candidateInput);
    return sum + result.ee.systemEeBitsPerJ;
  }, 0) / samples.length;
  assert.notEqual(evidence.eeBitPerJ, arithmeticMeanOfInstantaneousEe);
});

test('fails closed when the candidate changes an undeclared UE assignment', () => {
  const invalid = sample(10_000, 1);
  const evidence = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: [{
      ...invalid,
      candidateInput: {
        ...invalid.candidateInput,
        frame: { ...invalid.candidateInput.frame, servingBeamU: [1, 0], beamLoadB: [1, 1], beamActiveB: [true, true] },
      },
    }],
    digests: DIGESTS,
  });
  assert.equal(evidence.status, 'invalid');
  assert.equal(evidence.eeBitPerJ, null);
  assert.match(evidence.reason ?? '', /undeclared UE assignment/);
});

test('fails closed for mismatched duration and for missing samples', () => {
  const invalidDuration = sample(10_000, 1);
  const durationEvidence = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: [{ ...invalidDuration, durationSec: 2 }],
    digests: DIGESTS,
  });
  assert.equal(durationEvidence.status, 'invalid');
  assert.match(durationEvidence.reason ?? '', /frameDurationS/);

  const missing = buildCanonicalForecastEeEvidence({ action: ACTION, samples: [], digests: DIGESTS });
  assert.equal(missing.status, 'unavailable');
  assert.equal(missing.eeBitPerJ, null);
  assert.equal(missing.action, null);
});

test('candidate cannot silently change the canonical physical configuration', () => {
  const invalid = sample(10_000, 1);
  const evidence = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: [{
      ...invalid,
      candidateInput: {
        ...invalid.candidateInput,
        config: {
          ...invalid.candidateInput.config,
          rfcPowerW: 0,
          basebandPerSatelliteW: 0,
          beamPowerCapW: [1e-30, 1e-30],
        },
      },
    }],
    digests: DIGESTS,
  });
  assert.equal(evidence.status, 'invalid');
  assert.equal(evidence.eeBitPerJ, null);
  assert.match(evidence.reason ?? '', /same non-event canonical configuration/);
});
