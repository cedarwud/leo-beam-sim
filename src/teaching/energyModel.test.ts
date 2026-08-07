#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePowerTrain,
  computeTeachingThroughputMbps,
  resolveEnergyPerHandoverJ,
  DEFAULT_ENERGY_PER_HANDOVER_J,
  DEFAULT_ENERGY_TUNING,
  ENERGY_TUNING_RANGES,
} from './energyModel';

test('computePowerTrain: 24 dBm with default teaching tuning (paEff=0.35, circuit=3W)', () => {
  const result = computePowerTrain(24, DEFAULT_ENERGY_TUNING);
  assert.notStrictEqual(result, null);
  assert.ok(result);
  assert.ok(
    Math.abs(result.rfTxPowerW - 0.2512) < 1e-3,
    `rfTxPowerW expected ~0.2512, got ${result.rfTxPowerW}`,
  );
  assert.ok(
    Math.abs(result.paInputW - 0.7177) < 1e-3,
    `paInputW expected ~0.7177, got ${result.paInputW}`,
  );
  assert.ok(
    Math.abs(result.totalPowerW - 3.7177) < 1e-3,
    `totalPowerW expected ~3.7177, got ${result.totalPowerW}`,
  );
});

test('computePowerTrain: breakdown always sums back to totalPowerW', () => {
  const result = computePowerTrain(24, DEFAULT_ENERGY_TUNING);
  assert.ok(result);
  assert.ok(
    Math.abs(result.paInputW + result.circuitPowerW - result.totalPowerW) < 1e-9,
    'paInputW + circuitPowerW must equal totalPowerW',
  );
});

test('computePowerTrain: paEfficiency = 0 fails closed to null, not 0 and not Infinity', () => {
  const result = computePowerTrain(24, { paEfficiency: 0, circuitPowerW: 18 });
  assert.strictEqual(result, null);
});

test('computePowerTrain: negative paEfficiency fails closed to null', () => {
  const result = computePowerTrain(24, { paEfficiency: -0.1, circuitPowerW: 18 });
  assert.strictEqual(result, null);
});

test('computePowerTrain: non-finite txPowerDbm fails closed to null', () => {
  assert.strictEqual(computePowerTrain(Number.NaN, DEFAULT_ENERGY_TUNING), null);
  assert.strictEqual(computePowerTrain(Number.POSITIVE_INFINITY, DEFAULT_ENERGY_TUNING), null);
  assert.strictEqual(computePowerTrain(Number.NEGATIVE_INFINITY, DEFAULT_ENERGY_TUNING), null);
});

test('computePowerTrain: non-finite circuitPowerW fails closed to null', () => {
  assert.strictEqual(
    computePowerTrain(24, { paEfficiency: 0.35, circuitPowerW: Number.NaN }),
    null,
  );
});

test('computePowerTrain: negative circuitPowerW fails closed even when the sum stays positive', () => {
  assert.strictEqual(
    computePowerTrain(24, { paEfficiency: 0.35, circuitPowerW: -0.1 }),
    null,
  );
});

test('computePowerTrain: totalPowerW <= 0 fails closed to null (pathological negative circuit power)', () => {
  // rfTxPowerW at -200 dBm ~ 0, paInputW ~ 0, total = 0 + (-100) < 0 -> must be null.
  const result = computePowerTrain(-200, { paEfficiency: 0.35, circuitPowerW: -100 });
  assert.strictEqual(result, null);
});

test('computeTeachingThroughputMbps: sinrDb = -Infinity (no service) returns 0, not null', () => {
  const mbps = computeTeachingThroughputMbps({
    sinrDb: Number.NEGATIVE_INFINITY,
    bandwidthMHz: 20,
    frequencyReuse: 1,
  });
  assert.strictEqual(mbps, 0);
});

test('computeTeachingThroughputMbps: sinrDb = NaN fails closed to null', () => {
  const mbps = computeTeachingThroughputMbps({
    sinrDb: Number.NaN,
    bandwidthMHz: 20,
    frequencyReuse: 1,
  });
  assert.strictEqual(mbps, null);
});

test('computeTeachingThroughputMbps: sinrDb = +Infinity fails closed to null', () => {
  const mbps = computeTeachingThroughputMbps({
    sinrDb: Number.POSITIVE_INFINITY,
    bandwidthMHz: 20,
    frequencyReuse: 1,
  });
  assert.strictEqual(mbps, null);
});

test('computeTeachingThroughputMbps: matches Shannon formula for a normal SINR', () => {
  const mbps = computeTeachingThroughputMbps({ sinrDb: 10, bandwidthMHz: 20, frequencyReuse: 1 });
  const expectedSpectralEff = Math.log2(1 + Math.pow(10, 10 / 10)); // 10 dB -> linear 10
  const expected = 20 * expectedSpectralEff;
  assert.notStrictEqual(mbps, null);
  assert.ok(mbps !== null && Math.abs(mbps - expected) < 1e-9);
});

test('computeTeachingThroughputMbps: spectral efficiency is capped at 8 bit/s/Hz', () => {
  const mbps = computeTeachingThroughputMbps({ sinrDb: 200, bandwidthMHz: 10, frequencyReuse: 1 });
  assert.notStrictEqual(mbps, null);
  assert.ok(mbps !== null && Math.abs(mbps - 80) < 1e-9); // 10 MHz * 8 bit/s/Hz cap
});

test('computeTeachingThroughputMbps: frequencyReuse divides the result', () => {
  const base = computeTeachingThroughputMbps({ sinrDb: 10, bandwidthMHz: 20, frequencyReuse: 1 });
  const reused = computeTeachingThroughputMbps({ sinrDb: 10, bandwidthMHz: 20, frequencyReuse: 2 });
  assert.ok(base !== null && reused !== null);
  assert.ok(base !== null && reused !== null && Math.abs(reused - base / 2) < 1e-9);
});

test('computeTeachingThroughputMbps: bandwidthMHz <= 0 fails closed to null', () => {
  assert.strictEqual(
    computeTeachingThroughputMbps({ sinrDb: 10, bandwidthMHz: 0, frequencyReuse: 1 }),
    null,
  );
  assert.strictEqual(
    computeTeachingThroughputMbps({ sinrDb: 10, bandwidthMHz: -5, frequencyReuse: 1 }),
    null,
  );
});

test('computeTeachingThroughputMbps: frequencyReuse <= 0 fails closed to null', () => {
  assert.strictEqual(
    computeTeachingThroughputMbps({ sinrDb: 10, bandwidthMHz: 20, frequencyReuse: 0 }),
    null,
  );
  assert.strictEqual(
    computeTeachingThroughputMbps({ sinrDb: 10, bandwidthMHz: 20, frequencyReuse: -1 }),
    null,
  );
});

test('ENERGY_TUNING_RANGES brackets DEFAULT_ENERGY_TUNING for both knobs', () => {
  assert.strictEqual(DEFAULT_ENERGY_TUNING.circuitPowerW, 3);
  assert.ok(DEFAULT_ENERGY_TUNING.paEfficiency >= ENERGY_TUNING_RANGES.paEfficiency.min);
  assert.ok(DEFAULT_ENERGY_TUNING.paEfficiency <= ENERGY_TUNING_RANGES.paEfficiency.max);
  assert.ok(DEFAULT_ENERGY_TUNING.circuitPowerW >= ENERGY_TUNING_RANGES.circuitPowerW.min);
  assert.ok(DEFAULT_ENERGY_TUNING.circuitPowerW <= ENERGY_TUNING_RANGES.circuitPowerW.max);
});

test('ENERGY_TUNING_RANGES brackets and represents the handover-energy default', () => {
  const range = ENERGY_TUNING_RANGES.energyPerHandoverJ;
  assert.strictEqual(DEFAULT_ENERGY_PER_HANDOVER_J, 3);
  assert.ok(DEFAULT_ENERGY_PER_HANDOVER_J >= range.min);
  assert.ok(DEFAULT_ENERGY_PER_HANDOVER_J <= range.max);
  assert.strictEqual(DEFAULT_ENERGY_TUNING.energyPerHandoverJ, DEFAULT_ENERGY_PER_HANDOVER_J);
  // min must be exactly 0 so the term can be switched off and A/B'd.
  assert.strictEqual(range.min, 0);
  assert.strictEqual(
    (DEFAULT_ENERGY_PER_HANDOVER_J - range.min) % range.step,
    0,
    'the default must be an exact HTML range step so the rendered control keeps its 3 J value',
  );
});

test('DEFAULT_ENERGY_PER_HANDOVER_J is non-zero but not dominant at the reference setup', () => {
  // Reference setup from the DEFAULT_ENERGY_PER_HANDOVER_J doc comment.
  const powerTrain = computePowerTrain(50, DEFAULT_ENERGY_TUNING);
  assert.ok(powerTrain);
  assert.ok(
    Math.abs(powerTrain.totalPowerW - 288.714) < 1e-2,
    `P_total expected ~288.71 W, got ${powerTrain.totalPowerW}`,
  );

  const radioJ = powerTrain.totalPowerW * 60; // 60 s run
  assert.ok(Math.abs(radioJ - 17322.9) < 1, `E_radio expected ~17322.9 J, got ${radioJ}`);

  for (const handovers of [6, 10, 14]) {
    const handoverJ = handovers * DEFAULT_ENERGY_PER_HANDOVER_J;
    const share = handoverJ / (radioJ + handoverJ);
    assert.ok(
      share > 0 && share < 0.01,
      `N=${handovers}: E_HO share expected 0-1%, got ${(share * 100).toFixed(2)}%`,
    );
  }

  // At the top of the slider range the term is large but still not the whole
  // denominator, which is what "visible but not dominant" is bounded by.
  const maxJ = 10 * ENERGY_TUNING_RANGES.energyPerHandoverJ.max;
  const maxShare = maxJ / (radioJ + maxJ);
  assert.ok(maxShare > 0.15 && maxShare < 0.5, `max-slider share was ${(maxShare * 100).toFixed(1)}%`);
});

test('resolveEnergyPerHandoverJ: omitted uses the 3 J runtime default and an explicit configured value overrides it', () => {
  assert.strictEqual(resolveEnergyPerHandoverJ({}), 3);
  assert.strictEqual(
    resolveEnergyPerHandoverJ({ energyPerHandoverJ: undefined }),
    3,
  );
  assert.strictEqual(resolveEnergyPerHandoverJ({ energyPerHandoverJ: 17 }), 17);
});

test('resolveEnergyPerHandoverJ: an explicit 0 is honoured, not replaced by the default', () => {
  assert.strictEqual(resolveEnergyPerHandoverJ({ energyPerHandoverJ: 0 }), 0);
});

test('resolveEnergyPerHandoverJ: negative or non-finite fails closed to null', () => {
  assert.strictEqual(resolveEnergyPerHandoverJ({ energyPerHandoverJ: -1 }), null);
  assert.strictEqual(resolveEnergyPerHandoverJ({ energyPerHandoverJ: Number.NaN }), null);
  assert.strictEqual(
    resolveEnergyPerHandoverJ({ energyPerHandoverJ: Number.POSITIVE_INFINITY }),
    null,
  );
});

test('computePowerTrain ignores energyPerHandoverJ (it is not an instantaneous power term)', () => {
  const a = computePowerTrain(50, { paEfficiency: 0.35, circuitPowerW: 18 });
  const b = computePowerTrain(50, { paEfficiency: 0.35, circuitPowerW: 18, energyPerHandoverJ: 500 });
  assert.deepStrictEqual(a, b);
});
