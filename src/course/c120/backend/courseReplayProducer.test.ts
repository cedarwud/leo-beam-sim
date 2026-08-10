import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  C120_ANGLE_AWARE_CONTRACT_VERSION,
  createC120CanonicalRuntimeAdapter,
  type C120CanonicalRunRequest,
} from './canonicalRuntime';
import {
  C120_COURSE_ASSUMPTION,
  C120_COURSE_CLAIM,
  C120_COURSE_REPLAY_UNITS,
  C120_FROZEN_SCENARIO_ID,
  C120_MATERIALIZED_SGP4_MODEL_VERSION,
  C120_NTPU_OBSERVER_ID,
  C120_ONEWEB_OBJECT_NAME,
  C120CourseReplayProducerError,
  createC120CourseReplayRequestFromMaterializedScenario,
  createC120CourseReplayProducer,
  type C120CourseReplayRequest,
  type C120CourseReplayReceipt,
} from './courseReplayProducer';

const SOURCE_SHA = 'a'.repeat(64);
const ORBIT_SHA = 'b'.repeat(64);
const PROVIDER_ID = 'course-provider-oneweb-0314';
const SCENARIO_ID = C120_FROZEN_SCENARIO_ID;
const SOURCE_SNAPSHOT_ID = 'oneweb-0314-source-snapshot-01';

const MATERIALIZED_TLE_LINES = [
  'ONEWEB-0314'.padEnd(24, ' '),
  '1 49100U 21075AB  26221.38948065  .00000050  00000-0  94634-3 0  9999',
  '2 49100  87.9167  11.2157 0001855  96.2926 263.8417 13.17649901230012',
] as const;
const MATERIALIZED_TLE_CONTENT = `${MATERIALIZED_TLE_LINES.join('\n')}\n`;
const MATERIALIZED_TLE_SHA = createHash('sha256').update(MATERIALIZED_TLE_CONTENT, 'utf8').digest('hex');
const MATERIALIZED_PROVIDER_ID = `c120-canonical-adapter-${'c'.repeat(64)}`;
const MATERIALIZED_SCENARIO = {
  manifest: {
    providerKind: 'canonical-adapter',
    providerId: MATERIALIZED_PROVIDER_ID,
    scenario: {
      providerKind: 'canonical-adapter',
      providerId: MATERIALIZED_PROVIDER_ID,
      scenarioId: SCENARIO_ID,
      sourceMode: 'bundled',
      tleSourceId: `c120-current-tle-${MATERIALIZED_TLE_SHA}`,
      targetUtc: '2026-08-09T04:00:00Z',
    },
  },
  tle: {
    sourceEpochUtc: '2026-08-09T09:20:51.128Z',
    targetUtc: '2026-08-09T04:00:00Z',
    producerLabel: `${C120_MATERIALIZED_SGP4_MODEL_VERSION} · highest sampled NTPU look-angle point`,
    recordSha256: MATERIALIZED_TLE_SHA,
    lines: MATERIALIZED_TLE_LINES,
    frame: {
      identity: {
        providerKind: 'canonical-adapter',
        providerId: MATERIALIZED_PROVIDER_ID,
        scenarioId: SCENARIO_ID,
        surface: 'tle',
      },
    },
  },
} as const;

function closureOutput(request: C120CanonicalRunRequest): Record<string, unknown> {
  const inputs = request.inputs;
  const active = Array.isArray(inputs.beam_active_b) && inputs.beam_active_b[0] === true;
  const theta = Number((inputs.theta_rad_ub as readonly [readonly [number]])[0]?.[0] ?? 0);
  const minimumRate = Number(inputs.minimum_rate_bps ?? 0);
  const frameDuration = Number(inputs.frame_duration_s ?? 30);
  const switchIndicator = Number((inputs.switch_indicator_b as readonly number[])[0] ?? 0);
  const switchEnergy = Number(inputs.e_switch_j ?? 0);
  const switchPower = switchEnergy * switchIndicator / frameDuration;
  const throughput = active ? minimumRate : 0;
  const activePower = active ? 0.5 + theta * 4 + minimumRate / 1_000_000 : 0;
  const power = activePower + switchPower;
  const efficiency = power === 0 ? 0 : throughput / power;
  return {
    contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
    system_accounting: {
      per_user_contributions_bits_per_j: [efficiency],
      system_consumed_power_w: power,
      system_ee_bits_per_j: efficiency,
      system_throughput_bps: throughput,
      zero_over_zero: power === 0,
    },
  };
}

function evaluationOutput(request: C120CanonicalRunRequest): Record<string, unknown> {
  const rates = request.inputs.step_throughputs_bps;
  const powers = request.inputs.step_consumed_power_w;
  const durations = request.inputs.step_duration_s;
  assert(Array.isArray(rates));
  assert(Array.isArray(powers));
  assert(Array.isArray(durations));
  const bits = rates.reduce((sum, rate, index) => sum + Number(rate) * Number(durations[index]), 0);
  const energy = powers.reduce((sum, power, index) => sum + Number(power) * Number(durations[index]), 0);
  return {
    delivered_bits: bits,
    consumed_energy_j: energy,
    energy_efficiency_bits_per_j: energy === 0 ? 0 : bits / energy,
    zero_over_zero: energy === 0,
  };
}

const calls: C120CanonicalRunRequest[] = [];
const canonicalAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async request => {
    calls.push(request);
    return request.mode === 'closure' ? closureOutput(request) : evaluationOutput(request);
  },
});
const producer = createC120CourseReplayProducer({ canonicalAdapter });

const baseRequest: C120CourseReplayRequest = {
  scenarioId: SCENARIO_ID,
  providerId: PROVIDER_ID,
  sourceSnapshot: {
    kind: 'orbit-source-snapshot',
    snapshotId: SOURCE_SNAPSHOT_ID,
    contentSha256: SOURCE_SHA,
    providerId: PROVIDER_ID,
    objectName: C120_ONEWEB_OBJECT_NAME,
  },
  orbitSnapshot: {
    kind: 'orbit-pass-snapshot',
    snapshotId: 'oneweb-0314-ntpu-orbit-snapshot-01',
    contentSha256: ORBIT_SHA,
    providerId: PROVIDER_ID,
    sourceSnapshotId: SOURCE_SNAPSHOT_ID,
    objectName: C120_ONEWEB_OBJECT_NAME,
    observerId: C120_NTPU_OBSERVER_ID,
    passId: 'ntpu-pass-01',
    passIndex: 0,
    targetUtc: '2026-08-09T04:00:00Z',
  },
  units: C120_COURSE_REPLAY_UNITS,
  courseAssumption: C120_COURSE_ASSUMPTION,
  action: { kind: 'lab-a', candidateId: 'pace' },
};

function replaceRequest(overrides: Partial<C120CourseReplayRequest>): C120CourseReplayRequest {
  return { ...baseRequest, ...overrides };
}

function expectProducerError(action: () => Promise<unknown>, code?: C120CourseReplayProducerError['code']): Promise<void> {
  return assert.rejects(action, error => {
    if (!(error instanceof C120CourseReplayProducerError)) return false;
    return code === undefined || error.code === code;
  });
}

function assertDeepFrozen(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  assert.equal(Object.isFrozen(value), true);
  if (Array.isArray(value)) value.forEach(assertDeepFrozen);
  else Object.values(value).forEach(assertDeepFrozen);
}

function accounting(step: C120CourseReplayReceipt['closureSteps'][number]): Readonly<Record<string, unknown>> {
  return step.outputReceipt.output.system_accounting as Readonly<Record<string, unknown>>;
}

function fixedInputSignature(receipt: C120CourseReplayReceipt): string[] {
  const keys = [
    'propagation_gain_ub', 'receive_gain_ub', 'noise_power_w', 'beam_bandwidth_hz', 'beam_power_cap_w',
    'satellite_power_cap_w', 'g0_linear', 'theta_3db_rad', 'p_circuit_w', 'p_baseband_per_satellite_w',
    'beam_satellite_b', 'beam_color_b', 'e_switch_j', 'frame_duration_s',
  ];
  return receipt.closureSteps.flatMap(step => keys.map(key => JSON.stringify(step.inputReceipt.request.inputs[key])));
}

const first = await producer.produce(baseRequest);
const second = await producer.produce(JSON.parse(JSON.stringify(baseRequest)) as C120CourseReplayRequest);

// Exact identity/units/assumption acceptance and deterministic output.
assert.equal(first.schemaVersion, 'c120-course-replay-producer-v2');
assert.equal(first.producerKind, 'C120_COURSE_REPLAY_PRODUCER');
assert.equal(first.closureSteps.length, 5);
assert.equal(first.evaluation.derivedFrom.length, first.closureSteps.length);
assert.deepEqual(first.identity.sourceSnapshot, baseRequest.sourceSnapshot);
assert.deepEqual(first.identity.orbitSnapshot, baseRequest.orbitSnapshot);
assert.deepEqual(first.identity.units, C120_COURSE_REPLAY_UNITS);
assert.deepEqual(first.courseAssumption, C120_COURSE_ASSUMPTION);
assert.deepEqual(first.claim, C120_COURSE_CLAIM);
assert.equal(first.claim.label, 'model-derived course computation');
assert.equal(first.claim.measured, false);
assert.equal(first.claim.wholeSatelliteCanonical, false);
assert.equal(first.claim.producerVerifiesRuntimeHashes, false);
assert.equal(first.claim.runtimeHashProvenance, 'delegated to canonical-runtime adapter');
assert.equal(first.canonicalRuntime.parityClaim, 'none-beyond-pinned-runtime-call');
assert.equal(first.canonicalRuntime.producerVerifiesRuntimeHashes, false);
assert.deepEqual(first.courseWorkload, { kind: 'lab-a-frozen-workload', horizonSec: 150, workloadBits: 1_500_000 });
assert.ok(Math.abs(Number(first.evaluation.outputReceipt.output.delivered_bits) - 1_500_000) <= 1e-6);
assert.deepEqual(first, second);
assert.equal(JSON.stringify(first), JSON.stringify(JSON.parse(JSON.stringify(first))));
assertDeepFrozen(first);
assert.equal(calls.length, 12); // 5 closure steps + 1 evaluation, twice.

// A materialized, pinned SGP4/TLE scenario crosses the backend seam through
// content-addressed source/orbit identities.  Its TLE/model provenance binds
// the request, while the provider still owns the same course replay trace and
// the canonical adapter still owns all closure/evaluation values.
const materializedRequest = createC120CourseReplayRequestFromMaterializedScenario(
  MATERIALIZED_SCENARIO,
  { kind: 'lab-a', candidateId: 'pace' },
);
const materializedFirst = await producer.produce(materializedRequest);
const materializedSecond = await producer.produce(createC120CourseReplayRequestFromMaterializedScenario(
  JSON.parse(JSON.stringify(MATERIALIZED_SCENARIO)),
  { kind: 'lab-a', candidateId: 'pace' },
));
assert.deepEqual(materializedFirst, materializedSecond);
assert.equal(materializedFirst.identity.scenarioId, SCENARIO_ID);
assert.equal(materializedFirst.identity.providerId, MATERIALIZED_PROVIDER_ID);
assert.equal(materializedFirst.identity.sourceSnapshot.snapshotId, `c120-current-tle-${MATERIALIZED_TLE_SHA}`);
assert.equal(materializedFirst.identity.sourceSnapshot.contentSha256, MATERIALIZED_TLE_SHA);
assert.equal(materializedFirst.identity.orbitSnapshot.sourceSnapshotId, materializedFirst.identity.sourceSnapshot.snapshotId);
assert.equal(materializedFirst.identity.orbitSnapshot.targetUtc, MATERIALIZED_SCENARIO.tle.targetUtc);
assert.deepEqual(materializedFirst.claim, C120_COURSE_CLAIM);
assert.deepEqual(materializedFirst.identity.units, C120_COURSE_REPLAY_UNITS);
assertDeepFrozen(materializedFirst);
assert.equal(calls.length, 24); // materialized request repeated deterministically.

// The comparable link assumptions remain fixed. There is no action-ID or
// schedule-code leakage into theta, bandwidth, caps, or circuit/baseband.
const fixedValues = fixedInputSignature(first);
assert.deepEqual(fixedValues, fixedInputSignature(second));
assert.equal(first.closureSteps[0]?.inputReceipt.request.inputs.beam_bandwidth_hz, C120_COURSE_ASSUMPTION.values.beamBandwidthHz.value);
assert.equal(first.closureSteps[0]?.inputReceipt.request.inputs.theta_3db_rad, C120_COURSE_ASSUMPTION.values.beamPatternTheta3dbRad.value);
assert.equal(first.closureSteps[0]?.inputReceipt.request.inputs.frame_duration_s, C120_COURSE_ASSUMPTION.values.slotDurationSec.value);

// Every evaluation array is derived from its closure steps. Active samples
// use canonical rate/power; non-active samples use explicit course power and
// retain any canonical switch-event power.
first.closureSteps.forEach((step, index) => {
  const derived = first.evaluation.derivedFrom[index]!;
  assert.equal(derived.stepIndex, step.stepIndex);
  assert.equal(derived.state, step.state);
  assert.equal(derived.rateBps, step.evaluationContribution.rateBps);
  assert.equal(derived.powerW, step.evaluationContribution.powerW);
  assert.equal(derived.durationSec, step.durationSec);
  assert.equal(derived.powerSource, step.evaluationContribution.powerSource);
  if (step.state === 'active') {
    assert.equal(step.evaluationContribution.powerSource, 'canonical-closure');
    assert.equal(step.evaluationContribution.rateBps, Number(accounting(step).system_throughput_bps));
    assert.equal(step.evaluationContribution.powerW, Number(accounting(step).system_consumed_power_w));
  } else {
    assert.equal(step.evaluationContribution.rateBps, 0);
    assert.equal(step.evaluationContribution.coursePowerW !== null, true);
  }
});
assert.deepEqual(
  first.evaluation.inputReceipt.request.inputs.step_throughputs_bps,
  first.evaluation.derivedFrom.map(step => step.rateBps),
);
assert.deepEqual(
  first.evaluation.inputReceipt.request.inputs.step_consumed_power_w,
  first.evaluation.derivedFrom.map(step => step.powerW),
);
assert.deepEqual(
  first.evaluation.inputReceipt.request.inputs.step_duration_s,
  first.evaluation.derivedFrom.map(step => step.durationSec),
);

const actionRequests: C120CourseReplayRequest[] = [
  replaceRequest({ action: { kind: 'lab-a', candidateId: 'pace' } }),
  replaceRequest({ action: { kind: 'lab-a', candidateId: 'balanced' } }),
  replaceRequest({ action: { kind: 'lab-a', candidateId: 'burst-to-sleep' } }),
  replaceRequest({ action: { kind: 'lab-b', frozenRuleId: 'switch-now' } }),
  replaceRequest({ action: { kind: 'lab-b', frozenRuleId: 'stable-two' } }),
  replaceRequest({ action: { kind: 'lab-b', frozenRuleId: 'hysteresis' } }),
  replaceRequest({ action: { kind: 'lab-c', schedule: ['fixed-contact', 'send-urgent', 'wait', 'fixed-outage', 'batch-periodic', 'sleep'] } }),
  replaceRequest({ action: { kind: 'lab-c', schedule: ['fixed-contact', 'send-bulk', 'flush-batch', 'fixed-outage', 'wait', 'sleep'] } }),
  replaceRequest({ action: { kind: 'clinic', actionId: 'protect-service' } }),
  replaceRequest({ action: { kind: 'clinic', actionId: 'chase-score' } }),
];
const actionReceipts = await Promise.all(actionRequests.map(request => producer.produce(request)));

// Complete authoritative receipts differ, but closure output is allowed to
// match where the intended consequence is duty/policy in evaluation.
assert.equal(new Set(actionReceipts.map(receipt => JSON.stringify(receipt))).size, actionReceipts.length);
assert.deepEqual(
  actionReceipts[0]?.closureSteps[0]?.outputReceipt.output,
  actionReceipts[2]?.closureSteps[0]?.outputReceipt.output,
);
assert.notDeepEqual(actionReceipts[0]?.evaluation.outputReceipt.output, actionReceipts[1]?.evaluation.outputReceipt.output);
assert.notDeepEqual(actionReceipts[1]?.evaluation.outputReceipt.output, actionReceipts[2]?.evaluation.outputReceipt.output);
assert.notDeepEqual(actionReceipts[3]?.evaluation.outputReceipt.output, actionReceipts[4]?.evaluation.outputReceipt.output);
assert.notDeepEqual(actionReceipts[4]?.evaluation.outputReceipt.output, actionReceipts[5]?.evaluation.outputReceipt.output);
assert.notDeepEqual(actionReceipts[6]?.evaluation.outputReceipt.output, actionReceipts[7]?.evaluation.outputReceipt.output);
assert.notDeepEqual(actionReceipts[8]?.evaluation.outputReceipt.output, actionReceipts[9]?.evaluation.outputReceipt.output);

// Lab A shares a five-slot/150 s horizon and frozen 1,500,000-bit workload;
// candidates differ only in pacing and idle/sleep power state.
const labAReceipts = actionReceipts.slice(0, 3);
for (const receipt of labAReceipts) {
  assert.deepEqual(receipt.courseWorkload, { kind: 'lab-a-frozen-workload', horizonSec: 150, workloadBits: 1_500_000 });
  assert.equal(receipt.closureSteps.reduce((sum, step) => sum + step.durationSec, 0), 150);
  assert.equal(receipt.evaluation.outputReceipt.output.delivered_bits, labAReceipts[0]?.evaluation.outputReceipt.output.delivered_bits);
  assert.ok(Math.abs(Number(receipt.evaluation.outputReceipt.output.delivered_bits) - 1_500_000) <= 1e-6);
}
assert.deepEqual(actionReceipts[0]?.closureSteps.map(step => step.state), ['active', 'idle', 'idle', 'idle', 'idle']);
assert.deepEqual(actionReceipts[1]?.closureSteps.map(step => step.state), ['idle', 'idle', 'active', 'sleep', 'idle']);
assert.deepEqual(actionReceipts[2]?.closureSteps.map(step => step.state), ['active', 'sleep', 'sleep', 'sleep', 'sleep']);
assert.deepEqual(
  [...new Set(fixedInputSignature(actionReceipts[0]!))],
  [...new Set(fixedInputSignature(actionReceipts[1]!))],
);

// Lab B keeps one fixed geometry trace but changes serving/switch timing.
const labBGeometry = actionReceipts.slice(3, 6).map(receipt => receipt.closureSteps.map(step => step.geometry.thetaRad));
assert.deepEqual(labBGeometry[0], [0, 0.02, 0.02, 0]);
assert.deepEqual(labBGeometry[0], labBGeometry[1]);
assert.deepEqual(labBGeometry[1], labBGeometry[2]);
assert.notDeepEqual(actionReceipts[3]?.closureSteps.map(step => step.switchIndicator), actionReceipts[5]?.closureSteps.map(step => step.switchIndicator));
assert.notDeepEqual(actionReceipts[3]?.closureSteps.map(step => step.state), actionReceipts[4]?.closureSteps.map(step => step.state));

// Lab C is six fixed 30 s slots. Slot 0 is a contact/window marker and slot 3
// is an outage marker; neither may produce throughput or delivered bits.
for (const receipt of actionReceipts.slice(6, 8)) {
  assert.equal(receipt.closureSteps.length, 6);
  assert.equal(receipt.closureSteps[0]?.state, 'idle');
  assert.equal(receipt.closureSteps[0]?.marker, 'fixed-contact');
  assert.equal(receipt.closureSteps[3]?.state, 'outage');
  assert.equal(receipt.closureSteps[3]?.marker, 'fixed-outage');
  assert.equal(receipt.closureSteps[0]?.evaluationContribution.rateBps, 0);
  assert.equal(receipt.closureSteps[3]?.evaluationContribution.rateBps, 0);
  assert.deepEqual(receipt.closureSteps.map(step => step.durationSec), [30, 30, 30, 30, 30, 30]);
}

// Clinic reuses the same held-out geometry trace; policy knobs, not action IDs,
// cause the different service/score consequences.
assert.deepEqual(actionReceipts[8]?.closureSteps.map(step => step.geometry.thetaRad), [0, 0.01, 0.02, 0.01]);
assert.deepEqual(actionReceipts[8]?.closureSteps.map(step => step.geometry.thetaRad), actionReceipts[9]?.closureSteps.map(step => step.geometry.thetaRad));
assert.notDeepEqual(actionReceipts[8]?.closureSteps.map(step => step.inputReceipt.request.inputs.minimum_rate_bps), actionReceipts[9]?.closureSteps.map(step => step.inputReceipt.request.inputs.minimum_rate_bps));

for (const receipt of actionReceipts) assertDeepFrozen(receipt);

// Identity, units, assumption, unknown fields, and non-finite values fail
// closed before a canonical call is made.
await expectProducerError(() => producer.produce(replaceRequest({ scenarioId: 'not-the-frozen-c120-scenario' })), 'IDENTITY_MISMATCH');
await expectProducerError(() => producer.produce(replaceRequest({ providerId: 'other-provider' })), 'IDENTITY_MISMATCH');
await expectProducerError(() => producer.produce(replaceRequest({ sourceSnapshot: { ...baseRequest.sourceSnapshot, providerId: 'other-provider' } })), 'IDENTITY_MISMATCH');
await expectProducerError(() => producer.produce(replaceRequest({ orbitSnapshot: { ...baseRequest.orbitSnapshot, sourceSnapshotId: 'other-source' } })), 'IDENTITY_MISMATCH');
await expectProducerError(() => producer.produce(replaceRequest({ units: { ...C120_COURSE_REPLAY_UNITS, power: 'kW' } as never })), 'UNITS_MISMATCH');
await expectProducerError(() => producer.produce(replaceRequest({ courseAssumption: { ...C120_COURSE_ASSUMPTION, version: 'unfrozen' } as never })), 'ASSUMPTION_MISMATCH');
await expectProducerError(() => producer.produce(replaceRequest({ sourceSnapshot: { ...baseRequest.sourceSnapshot, unknownField: true } as never })), 'INPUT_INVALID');
await expectProducerError(() => producer.produce(replaceRequest({ orbitSnapshot: { ...baseRequest.orbitSnapshot, passIndex: Number.NaN } })), 'INPUT_INVALID');
await expectProducerError(() => producer.produce(replaceRequest({ action: { kind: 'lab-c', schedule: ['fixed-contact', 'wait', 'wait', 'wait', 'sleep', 'sleep'] } as never })), 'INPUT_INVALID');

function expectMaterializedError(action: () => unknown, code: C120CourseReplayProducerError['code']): void {
  assert.throws(action, error => error instanceof C120CourseReplayProducerError && error.code === code);
}

// Materialized scenario/provider/TLE/source identity and unsupported replay
// inputs fail before the canonical adapter is reached.
expectMaterializedError(() => createC120CourseReplayRequestFromMaterializedScenario(
  { ...MATERIALIZED_SCENARIO, manifest: { ...MATERIALIZED_SCENARIO.manifest, scenario: { ...MATERIALIZED_SCENARIO.manifest.scenario, scenarioId: 'other-scenario' } } },
  { kind: 'lab-a', candidateId: 'pace' },
), 'IDENTITY_MISMATCH');
expectMaterializedError(() => createC120CourseReplayRequestFromMaterializedScenario(
  { ...MATERIALIZED_SCENARIO, manifest: { ...MATERIALIZED_SCENARIO.manifest, providerId: 'other-provider' } },
  { kind: 'lab-a', candidateId: 'pace' },
), 'IDENTITY_MISMATCH');
expectMaterializedError(() => createC120CourseReplayRequestFromMaterializedScenario(
  { ...MATERIALIZED_SCENARIO, manifest: { ...MATERIALIZED_SCENARIO.manifest, scenario: { ...MATERIALIZED_SCENARIO.manifest.scenario, tleSourceId: 'c120-current-tle-other' } } },
  { kind: 'lab-a', candidateId: 'pace' },
), 'IDENTITY_MISMATCH');
expectMaterializedError(() => createC120CourseReplayRequestFromMaterializedScenario(
  { ...MATERIALIZED_SCENARIO, tle: { ...MATERIALIZED_SCENARIO.tle, lines: ['ONEWEB-0315'.padEnd(24, ' '), MATERIALIZED_TLE_LINES[1], MATERIALIZED_TLE_LINES[2]] } },
  { kind: 'lab-a', candidateId: 'pace' },
), 'IDENTITY_MISMATCH');
expectMaterializedError(() => createC120CourseReplayRequestFromMaterializedScenario(
  MATERIALIZED_SCENARIO,
  { kind: 'unsupported-replay' },
), 'INPUT_INVALID');

// A self-consistent but wrong evaluation runner must still fail against the
// producer's derived arrays; zero-power/zero-throughput with non-zero EE also
// fails closed at the closure boundary.
const wrongEvaluationAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async request => request.mode === 'closure'
    ? closureOutput(request)
    : { delivered_bits: 0, consumed_energy_j: 1, energy_efficiency_bits_per_j: 0, zero_over_zero: false },
});
await expectProducerError(
  () => createC120CourseReplayProducer({ canonicalAdapter: wrongEvaluationAdapter }).produce(baseRequest),
  'CANONICAL_OUTPUT_INVALID',
);
const zeroZeroEeAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async request => request.mode === 'closure'
    ? {
      contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
      system_accounting: {
        per_user_contributions_bits_per_j: [0],
        system_consumed_power_w: 0,
        system_ee_bits_per_j: 1,
        system_throughput_bps: 0,
        zero_over_zero: true,
      },
    }
    : evaluationOutput(request),
});
await expectProducerError(
  () => createC120CourseReplayProducer({ canonicalAdapter: zeroZeroEeAdapter }).produce(baseRequest),
  'CANONICAL_OUTPUT_INVALID',
);
const falseAtZeroAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async request => request.mode === 'closure'
    ? {
      contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
      system_accounting: {
        per_user_contributions_bits_per_j: [0],
        system_consumed_power_w: 0,
        system_ee_bits_per_j: 0,
        system_throughput_bps: 0,
        zero_over_zero: false,
      },
    }
    : evaluationOutput(request),
});
await expectProducerError(
  () => createC120CourseReplayProducer({ canonicalAdapter: falseAtZeroAdapter }).produce(baseRequest),
  'CANONICAL_OUTPUT_INVALID',
);
const trueAtNonzeroAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async request => request.mode === 'closure'
    ? {
      contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
      system_accounting: {
        per_user_contributions_bits_per_j: [1],
        system_consumed_power_w: 1,
        system_ee_bits_per_j: 1,
        system_throughput_bps: 1,
        zero_over_zero: true,
      },
    }
    : evaluationOutput(request),
});
await expectProducerError(
  () => createC120CourseReplayProducer({ canonicalAdapter: trueAtNonzeroAdapter }).produce(baseRequest),
  'CANONICAL_OUTPUT_INVALID',
);

// The source remains server-only and contains no action-code/schedule-code
// physics, wall-clock, random, or browser dependency.
const producerSource = await readFile(new URL('./courseReplayProducer.ts', import.meta.url), 'utf8');
assert.equal(/Date\.now\(\)|Math\.random\(\)|\b(?:window|document)\b/.test(producerSource), false);
assert.equal(/scheduleCode|actionCode|evaluationRatesBps|evaluationPowerW/.test(producerSource), false);
assert.match(producerSource, /from 'node:crypto'/);

console.log('courseReplayProducer.test.ts: all assertions passed');
