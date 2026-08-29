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
  buildCanonicalForecastConfigHash,
  buildCanonicalForecastDigestBundle,
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
const EPOCH_UTC_MS = 0;
const POLICY_CONFIG_HASH = 'policy-config:fixture-v1';
const SCENARIO_STATE_HASH = 'scenario:fixture-v1';
const GEOMETRY_MODEL_HASH = 'geometry:fixture-v1';

function pairedInput(
  durationSec: number,
  includeSwitchEvent: boolean,
): { baseline: CanonicalEeInput; candidate: CanonicalEeInput } {
  const source = CANONICAL_EE_CONFORMANCE_FIXTURES.find(fixture => fixture.id === 'coupled_interference');
  assert.ok(source);
  const baseline: CanonicalEeInput = {
    config: {
      ...source.input.config,
      frameDurationS: durationSec,
      switchEnergyJ: 2,
      switchIndicatorByBeam: [0, 0],
    },
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
    config: {
      ...baseline.config,
      switchIndicatorByBeam: includeSwitchEvent ? [0, 1] : [0, 0],
    },
    frame: {
      ...baseline.frame,
      servingBeamU: [1, 1],
      beamActiveB: [false, true],
      beamLoadB: [0, 2],
      laggedInterferenceUW: [...baseline.frame.laggedInterferenceUW],
    },
  };
  return { baseline, candidate };
}

function sample(
  startSimTimeMs: number,
  durationSec: number,
  includeSwitchEvent = true,
): CanonicalForecastEeSample {
  const pair = pairedInput(durationSec, includeSwitchEvent);
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
    epochUtcMs: EPOCH_UTC_MS,
    startSimTimeMs,
    durationSec,
    policyConfigHash: POLICY_CONFIG_HASH,
    scenarioStateHash: SCENARIO_STATE_HASH,
    geometryModelHash: GEOMETRY_MODEL_HASH,
    canonicalConfigHash: buildCanonicalForecastConfigHash(baselineInput.config),
    assignmentStateHash: `assignment:${startSimTimeMs}`,
    canonicalPowerStateHash: `power:${startSimTimeMs}`,
    protagonistUeId: ACTION.primaryUeId,
    baselineInput,
    candidateInput,
    ueIdsByIndex: ['ue-primary', 'ue-other'],
    beamKeysByIndex: [FROM, TO],
  };
}

function causalSequence(
  inputs: readonly CanonicalForecastEeSample[],
): readonly CanonicalForecastEeSample[] {
  let baselineLagged: readonly number[] | null = null;
  let candidateLagged: readonly number[] | null = null;
  return inputs.map((input, index) => {
    const acceptedLagged = input.baselineInput.frame.laggedInterferenceUW;
    const baselineInput: CanonicalEeInput = {
      ...input.baselineInput,
      frame: {
        ...input.baselineInput.frame,
        laggedInterferenceUW: [...(index === 0 ? acceptedLagged : baselineLagged!)],
      },
    };
    const candidateInput: CanonicalEeInput = {
      ...input.candidateInput,
      frame: {
        ...input.candidateInput.frame,
        laggedInterferenceUW: [...(index === 0 ? acceptedLagged : candidateLagged!)],
      },
    };
    baselineLagged = computeCanonicalEe(baselineInput).throughput.interferenceUW;
    candidateLagged = computeCanonicalEe(candidateInput).throughput.interferenceUW;
    return { ...input, baselineInput, candidateInput };
  });
}

function digestsFor(
  samples: readonly CanonicalForecastEeSample[],
  action: CandidateAssignmentDelta = ACTION,
) {
  return buildCanonicalForecastDigestBundle(samples, action);
}

const VALID_SINGLE_SAMPLE_DIGESTS = digestsFor([sample(10_000, 1)]);

test('computes candidate and keep-serving EE as equal-horizon ratio-of-sums', () => {
  const samples = causalSequence([sample(10_000, 1), sample(11_000, 3, false)]);
  const evidence = buildCanonicalForecastEeEvidence({ action: ACTION, samples, digests: digestsFor(samples) });
  assert.equal(evidence.status, 'valid', evidence.reason ?? 'unexpected invalid evidence');
  assert.equal(evidence.horizonSec, 4);
  assert.ok(evidence.provenance);
  assert.equal(evidence.provenance.startSimTimeMs, 10_000);
  assert.equal(evidence.provenance.endSimTimeMs, 14_000);
  assert.equal(evidence.provenance.scenarioStateHash, SCENARIO_STATE_HASH);
  assert.equal(evidence.provenance.geometryModelHash, GEOMETRY_MODEL_HASH);

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
  assert.equal(evidence.baselineDeliveredBits, baselineEvaluation.deliveredBits);
  assert.equal(evidence.baselineConsumedJoules, baselineEvaluation.consumedEnergyJ);
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
  const samples = [{
    ...invalid,
    candidateInput: {
      ...invalid.candidateInput,
      frame: { ...invalid.candidateInput.frame, servingBeamU: [1, 0], beamLoadB: [1, 1], beamActiveB: [true, true] },
    },
  }];
  const evidence = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples,
    digests: VALID_SINGLE_SAMPLE_DIGESTS,
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
    digests: VALID_SINGLE_SAMPLE_DIGESTS,
  });
  assert.equal(durationEvidence.status, 'invalid');
  assert.match(durationEvidence.reason ?? '', /frameDurationS/);

  const missing = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: [],
    digests: VALID_SINGLE_SAMPLE_DIGESTS,
  });
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
    digests: VALID_SINGLE_SAMPLE_DIGESTS,
  });
  assert.equal(evidence.status, 'invalid');
  assert.equal(evidence.eeBitPerJ, null);
  assert.match(evidence.reason ?? '', /same non-event canonical configuration/);
});

test('rejects a missing, duplicate, misplaced, or non-binary switch-event witness', () => {
  const first = sample(10_000, 1);
  const second = sample(11_000, 1, false);
  const cases: readonly [string, readonly CanonicalForecastEeSample[], RegExp][] = [
    [
      'missing',
      [{
        ...first,
        candidateInput: {
          ...first.candidateInput,
          config: { ...first.candidateInput.config, switchIndicatorByBeam: [0, 0] },
        },
      }],
      /exactly one target-beam switch event/,
    ],
    [
      'duplicate',
      [first, {
        ...second,
        candidateInput: {
          ...second.candidateInput,
          config: { ...second.candidateInput.config, switchIndicatorByBeam: [0, 1] },
        },
      }],
      /exactly one target-beam switch event/,
    ],
    [
      'misplaced',
      [{
        ...first,
        candidateInput: {
          ...first.candidateInput,
          config: { ...first.candidateInput.config, switchIndicatorByBeam: [1, 0] },
        },
      }],
      /exactly one target-beam switch event/,
    ],
    [
      'non-binary',
      [{
        ...first,
        candidateInput: {
          ...first.candidateInput,
          config: { ...first.candidateInput.config, switchIndicatorByBeam: [0, 0.5] },
        },
      }],
      /must be binary/,
    ],
    [
      'baseline event',
      [{
        ...first,
        baselineInput: {
          ...first.baselineInput,
          config: { ...first.baselineInput.config, switchIndicatorByBeam: [1, 0] },
        },
      }],
      /baseline must not contain/,
    ],
  ];
  for (const [label, samples, reason] of cases) {
    const evidence = buildCanonicalForecastEeEvidence({
      action: ACTION,
      samples,
      digests: VALID_SINGLE_SAMPLE_DIGESTS,
    });
    assert.equal(evidence.status, 'invalid', label);
    assert.match(evidence.reason ?? '', reason, label);
  }
});

test('training events must remain identical across the matched counterfactual pair', () => {
  const invalid = sample(10_000, 1);
  const evidence = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: [{
      ...invalid,
      candidateInput: {
        ...invalid.candidateInput,
        config: { ...invalid.candidateInput.config, trainingIndicatorByBeam: [0, 1] },
      },
    }],
    digests: VALID_SINGLE_SAMPLE_DIGESTS,
  });
  assert.equal(evidence.status, 'invalid');
  assert.match(evidence.reason ?? '', /same non-event canonical configuration/);
});

test('rejects policy-hash drift and canonical index remapping inside one horizon', () => {
  const first = sample(10_000, 1);
  const second = sample(11_000, 1, false);
  const policyDrift = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: [{ ...first, policyConfigHash: 'policy-config:other' }],
    digests: VALID_SINGLE_SAMPLE_DIGESTS,
  });
  assert.equal(policyDrift.status, 'invalid');
  assert.match(policyDrift.reason ?? '', /policyConfigHash/);

  const indexDrift = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: [first, {
      ...second,
      ueIdsByIndex: [...second.ueIdsByIndex].reverse(),
    }],
    digests: VALID_SINGLE_SAMPLE_DIGESTS,
  });
  assert.equal(indexDrift.status, 'invalid');
  assert.match(indexDrift.reason ?? '', /index mappings must remain stable/);
});

test('rejects a mismatched initial lag and a broken counterfactual recurrence', () => {
  const first = sample(10_000, 1);
  const mismatchedSamples = [{
    ...first,
    candidateInput: {
      ...first.candidateInput,
      frame: {
        ...first.candidateInput.frame,
        laggedInterferenceUW: first.candidateInput.frame.laggedInterferenceUW.map(value => value + 1e-6),
      },
    },
  }];
  const mismatchedInitial = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: mismatchedSamples,
    digests: digestsFor(mismatchedSamples),
  });
  assert.equal(mismatchedInitial.status, 'invalid');
  assert.match(mismatchedInitial.reason ?? '', /same accepted lagged-interference state/);

  const valid = causalSequence([first, sample(11_000, 1, false)]);
  const brokenSecond = {
    ...valid[1]!,
    baselineInput: {
      ...valid[1]!.baselineInput,
      frame: {
        ...valid[1]!.baselineInput.frame,
        laggedInterferenceUW: valid[1]!.baselineInput.frame.laggedInterferenceUW.map(value => value + 1e-6),
      },
    },
  };
  const broken = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: [valid[0]!, brokenSecond],
    digests: digestsFor([valid[0]!, brokenSecond]),
  });
  assert.equal(broken.status, 'invalid');
  assert.match(broken.reason ?? '', /follow each counterfactual previous canonical result/);
});

test('recomputes and rejects every tampered forecast provenance digest', () => {
  const samples = causalSequence([sample(10_000, 1), sample(11_000, 1, false)]);
  const valid = digestsFor(samples);
  for (const key of Object.keys(valid) as (keyof typeof valid)[]) {
    const evidence = buildCanonicalForecastEeEvidence({
      action: ACTION,
      samples,
      digests: { ...valid, [key]: `${valid[key]}:tampered` },
    });
    assert.equal(evidence.status, 'invalid', key);
    assert.match(evidence.reason ?? '', new RegExp(`(?:policyConfigHash|forecast digest ${key})`), key);
  }
});

test('fails closed instead of publishing valid evidence with a zero baseline EE', () => {
  const source = CANONICAL_EE_CONFORMANCE_FIXTURES.find(fixture => fixture.id === 'coupled_interference');
  assert.ok(source);
  const config = {
    ...source.input.config,
    frameDurationS: 1,
    switchEnergyJ: 2,
  };
  const baselineInput: CanonicalEeInput = {
    config: { ...config, switchIndicatorByBeam: [0, 0] },
    frame: {
      thetaRadUb: [[0, 0]],
      propagationGainUb: [[0, 1]],
      receiveGainUb: [[1, 1]],
      servingBeamU: [0],
      beamActiveB: [true, false],
      beamLoadB: [1, 0],
      beamSatelliteB: [0, 1],
      beamColorB: [0, 1],
      laggedInterferenceUW: [0],
    },
  };
  const candidateInput: CanonicalEeInput = {
    config: { ...config, switchIndicatorByBeam: [0, 1] },
    frame: {
      ...baselineInput.frame,
      servingBeamU: [1],
      beamActiveB: [false, true],
      beamLoadB: [0, 1],
    },
  };
  const samples: readonly CanonicalForecastEeSample[] = [{
    sourceFrameId: 'forecast-zero-baseline',
    epochUtcMs: EPOCH_UTC_MS,
    startSimTimeMs: 10_000,
    durationSec: 1,
    policyConfigHash: POLICY_CONFIG_HASH,
    scenarioStateHash: SCENARIO_STATE_HASH,
    geometryModelHash: GEOMETRY_MODEL_HASH,
    canonicalConfigHash: buildCanonicalForecastConfigHash(baselineInput.config),
    assignmentStateHash: 'assignment:zero-baseline',
    canonicalPowerStateHash: 'power:zero-baseline',
    protagonistUeId: ACTION.primaryUeId,
    baselineInput,
    candidateInput,
    ueIdsByIndex: ['ue-primary'],
    beamKeysByIndex: [FROM, TO],
  }];
  const evidence = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples,
    digests: digestsFor(samples),
  });
  assert.equal(evidence.status, 'invalid');
  assert.equal(evidence.eeBitPerJ, null);
  assert.equal(evidence.relativeDelta, null);
  assert.match(evidence.reason ?? '', /baseline EE must be finite and positive/);
});
