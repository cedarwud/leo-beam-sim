import assert from 'node:assert/strict';

import {
  ENERGY_LAB_ACT6_BEATS,
  ENERGY_LAB_ACT6_DURATION_SEC,
  ENERGY_LAB_BEATS,
  ENERGY_LAB_CHECKPOINTS,
  ENERGY_LAB_DURATION_SEC,
  ENERGY_LAB_QUESTION_POWER_W,
  ENERGY_LAB_SOURCE_CONTRACT,
  advanceEnergyLabCourseTime,
  bestSampledEnergyLabPoint,
  buildEnergyLabLocalReceipt,
  energyLabAct6BeatAtTime,
  energyLabActFromLocation,
  energyLabActFromSearch,
  energyLabBeatAtTime,
  energyLabSampleAt,
  resolveEnergyLabFrame,
  sampledEnergyLabPoints,
  serviceValidEnergyLabPoints,
} from './energyLabDirector';
import {
  ENERGY_LAB_FRAME_SET_DIGEST,
  ENERGY_LAB_SCENARIO_ID,
  ENERGY_LAB_STOPS,
  energyLabPoint,
} from './energyLabFixture';

assert.equal(ENERGY_LAB_DURATION_SEC, 84);
assert.equal(ENERGY_LAB_ACT6_DURATION_SEC, 42);
assert.deepEqual(
  ENERGY_LAB_BEATS.map(beat => beat.id),
  ['prediction', 'baseline', 'downward-sweep', 'outage-reveal', 'upward-sweep', 'checkpoint-compare', 'finale'],
);
assert.deepEqual(
  ENERGY_LAB_ACT6_BEATS.map(beat => beat.id),
  ['source', 'sample', 'receipt'],
);
assert.equal(energyLabActFromSearch(''), 5);
assert.equal(energyLabActFromSearch('?act=5'), 5);
assert.equal(energyLabActFromSearch('?act=6'), 6);
assert.equal(energyLabActFromSearch('?act=6&source=fixture'), 6);
assert.equal(energyLabActFromLocation('/course/energy-lab', ''), 5);
assert.equal(energyLabActFromLocation('/course/energy-evidence', ''), 6);
assert.equal(energyLabActFromLocation('/course/energy-lab', '?act=6'), 6, 'legacy query remains compatible');

// Fixture-source fidelity: the director does not manufacture a second curve.
const sampled = sampledEnergyLabPoints();
assert.deepEqual(sampled.map(sample => sample.powerW), ENERGY_LAB_STOPS);
for (const sample of sampled) {
  const source = energyLabPoint(sample.powerW);
  assert.equal(sample.point.totalRateMbps, source.totalRateMbps);
  assert.equal(sample.point.systemPowerW, source.systemPowerW);
  assert.equal(sample.point.eeMbitPerJ, source.eeMbitPerJ);
  assert.equal(sample.point.lowSinrFraction, source.lowSinrFraction);
  assert.equal(sample.point.fixedOverheadW, source.fixedOverheadW);
}
assert.equal(ENERGY_LAB_SOURCE_CONTRACT.frameSetDigest, ENERGY_LAB_FRAME_SET_DIGEST);
assert.equal(ENERGY_LAB_SOURCE_CONTRACT.scenarioId, ENERGY_LAB_SCENARIO_ID);

// Unit and ratio-of-sums contract: EE is not an arithmetic mean of per-point EE.
assert.equal(ENERGY_LAB_SOURCE_CONTRACT.eeLabel, 'ΣR / P^N = η · Mbit/J');
assert.equal(ENERGY_LAB_SOURCE_CONTRACT.rateUnit, 'Mbit/s');
assert.equal(ENERGY_LAB_SOURCE_CONTRACT.systemPowerUnit, 'W');
assert.equal(ENERGY_LAB_SOURCE_CONTRACT.energyEfficiencyUnit, 'Mbit/J');
const baseline = energyLabSampleAt(0.8).point;
assert.equal(baseline.eeMbitPerJ, baseline.totalRateMbps / baseline.systemPowerW);
assert.notEqual(
  baseline.eeMbitPerJ,
  sampled.reduce((sum, sample) => sum + sample.point.eeMbitPerJ, 0) / sampled.length,
);

// Act 5 asks a sample-specific service question whose answer is derived from
// the declared fixture point, not stored as a director verdict.
const predictionFrame = resolveEnergyLabFrame(0);
assert.equal(predictionFrame.beat.id, 'prediction');
assert.equal('answer' in predictionFrame, false);
assert.equal(predictionFrame.questionSample.powerW, ENERGY_LAB_QUESTION_POWER_W);
assert.equal(predictionFrame.questionAnswer, 'service-fails');
assert.equal(predictionFrame.traceSamples.length, 0);
assert.equal(predictionFrame.lowSinrUserCount, 0);
assert.equal(energyLabBeatAtTime(10).id, 'baseline');

// The best EE is selected only from service-valid sampled points.
const serviceValid = serviceValidEnergyLabPoints();
assert.ok(serviceValid.length > 0);
assert.ok(serviceValid.every(sample => sample.point.lowSinrFraction === 0));
const best = bestSampledEnergyLabPoint();
assert.equal(best.powerW, 0.8);
assert.equal(best.point.eeMbitPerJ, energyLabPoint(0.8).eeMbitPerJ);
assert.ok(energyLabPoint(1.65).totalRateMbps > best.point.totalRateMbps);
assert.ok(energyLabPoint(1.65).eeMbitPerJ < best.point.eeMbitPerJ);

// Seeking reconstructs the same clock frame and preserves the explicit checkpoint branch.
const baselineFrame = resolveEnergyLabFrame(12);
assert.equal(baselineFrame.currentSample.powerW, 0.8);
const checkpointFrame = resolveEnergyLabFrame(72, ENERGY_LAB_CHECKPOINTS[0]);
const checkpointReplay = resolveEnergyLabFrame(72, ENERGY_LAB_CHECKPOINTS[0]);
assert.equal(checkpointFrame.beat.id, 'checkpoint-compare');
assert.equal(checkpointFrame.currentSample.powerW, 0.8);
assert.equal(checkpointFrame.selectedSample.powerW, ENERGY_LAB_CHECKPOINTS[0]);
assert.deepEqual(checkpointReplay, checkpointFrame);
assert.equal(advanceEnergyLabCourseTime(10, 1, 0.5), 10.5);
assert.equal(advanceEnergyLabCourseTime(83.9, 1, 2), ENERGY_LAB_DURATION_SEC);

// The low-power point is a clear fixture finding: lower system power does not
// preserve service, while fixed overhead remains in the energy boundary.
const low = resolveEnergyLabFrame(44).currentSample.point;
assert.equal(low.beamPowerW, ENERGY_LAB_QUESTION_POWER_W);
assert.equal(resolveEnergyLabFrame(44).serviceState, 'outage');
assert.equal(resolveEnergyLabFrame(44).lowSinrUserCount, 4);
assert.ok(low.systemPowerW < baseline.systemPowerW);
assert.ok(low.totalRateMbps < baseline.totalRateMbps);
assert.equal(low.fixedOverheadW, baseline.fixedOverheadW);

// An intermediate stop is a genuinely degraded state, not the outage/healthy
// binary alone: some but not all served users clear the threshold.
const degraded = energyLabSampleAt(0.35).point;
assert.ok(degraded.lowSinrFraction > 0, 'intermediate stop should not be fully healthy');
assert.ok(degraded.lowSinrFraction < 1, 'intermediate stop should not be a full outage');

// Act 6 is a local source receipt only. It has no event/handover or transport claim.
assert.equal(energyLabAct6BeatAtTime(0).id, 'source');
assert.equal(energyLabAct6BeatAtTime(20).id, 'sample');
assert.equal(energyLabAct6BeatAtTime(41.9).id, 'receipt');
const receipt = buildEnergyLabLocalReceipt(best);
assert.equal(receipt.persistence, 'local-only');
assert.equal(receipt.sourceLabel, 'deterministic-teaching-fixture');
assert.equal(receipt.samplePowerW, 0.8);
assert.equal(receipt.sampleDurationSec, 1);
assert.deepEqual(receipt.fields.map(field => field.key), [
  'DELIVERED_DATA_MBIT',
  'TOTAL_ENERGY_J',
  'RUN_EE_MBIT_PER_J',
  'LOW_SINR_RATIO',
]);
assert.equal(receipt.fields.map(field => field.key as string).includes('HANDOVER_EVENT'), false);
const lowSinrRatioField = receipt.fields.find(field => field.key === 'LOW_SINR_RATIO');
assert.equal(lowSinrRatioField?.value, 0);

// No sampled point the selector could ever call "best" may present as evidence
// while under-serving: every service-valid point's receipt must show a clean
// low-SINR ratio, not merely the one the selector happens to have picked.
for (const sample of serviceValid) {
  const sampleReceipt = buildEnergyLabLocalReceipt(sample);
  const ratioField = sampleReceipt.fields.find(field => field.key === 'LOW_SINR_RATIO');
  assert.equal(ratioField?.value, 0);
}

console.log('energy-lab Act 5/6 split, sample answer, service-valid optimum, and local receipt tests pass');
