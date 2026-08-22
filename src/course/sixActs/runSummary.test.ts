#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { declareSixActsCourseThreshold, getSixActsAttachThreshold } from './taughtConstants';
import {
  SixActsRunSummaryError,
  resampleSixActsRunToOneHz,
  summarizeSixActsRun,
  type SixActsRuntimeSample,
} from './runSummary';

/** Every test threshold is labelled; a bare number no longer type-checks. */
function threshold(valueDb: number) {
  return declareSixActsCourseThreshold(valueDb, `測試用門檻 ${valueDb} dB`);
}

const RUN_IDS = {
  runId: 'six-acts-test-run',
  strategyId: 'baseline',
  scenarioId: 'oneweb-20260810T150000Z',
} as const;

function sample(overrides: Partial<SixActsRuntimeSample> = {}): SixActsRuntimeSample {
  return {
    instantMs: 0,
    durationSec: 1,
    servingSatelliteId: '49194',
    servingSinrDb: -10,
    bestCandidateSatelliteId: '55159',
    bestCandidateSinrDb: -7,
    ratesMbps: [10],
    systemPowerW: 1,
    ...overrides,
  };
}

function assertDomainError(
  code: SixActsRunSummaryError['code'],
  operation: () => unknown,
): void {
  assert.throws(operation, error => {
    assert.ok(error instanceof SixActsRunSummaryError);
    assert.strictEqual(error.code, code);
    return true;
  });
}

test('run EE is the ratio of sums, not the mean of per-step EE', () => {
  const summary = summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-60),
    samples: [
      sample({ instantMs: 0, systemPowerW: 1 }),
      sample({ instantMs: 1000, systemPowerW: 9 }),
    ],
  });

  assert.strictEqual(summary.deliveredDataMbit, 20);
  assert.strictEqual(summary.totalEnergyJ, 10);
  assert.strictEqual(summary.runEeMbitPerJ, 2);
  // The mean of the two per-step values would be ~5.56 Mbit/J.
  assert.notStrictEqual(summary.runEeMbitPerJ, (10 + 10 / 9) / 2);
});

test('energy and delivered data integrate over the step duration', () => {
  const summary = summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-60),
    samples: [
      sample({ instantMs: 0, durationSec: 0.5, ratesMbps: [8], systemPowerW: 2 }),
      sample({ instantMs: 500, durationSec: 2, ratesMbps: [8], systemPowerW: 2 }),
    ],
  });

  assert.strictEqual(summary.deliveredDataMbit, 20);
  assert.strictEqual(summary.totalEnergyJ, 5);
  assert.strictEqual(summary.durationSec, 2.5);
});

test('an unattached step counts as low SINR rather than being dropped', () => {
  const summary = summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-20),
    samples: [
      sample({ instantMs: 0, servingSinrDb: -10 }),
      sample({
        instantMs: 1000,
        servingSatelliteId: null,
        servingSinrDb: null,
        ratesMbps: [0],
        systemPowerW: 1,
      }),
    ],
  });

  assert.strictEqual(summary.outageSampleCount, 1);
  assert.strictEqual(summary.outageDurationSec, 1);
  assert.strictEqual(summary.lowSinrFraction, 0.5);
  assert.strictEqual(summary.lowSinrRatioPercent, 50);
});

test('the low-SINR threshold is applied strictly below, in dB', () => {
  const summary = summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-10),
    samples: [
      sample({ instantMs: 0, servingSinrDb: -10.0001 }),
      sample({ instantMs: 1000, servingSinrDb: -10 }),
      sample({ instantMs: 2000, servingSinrDb: -9.9999 }),
    ],
  });

  assert.strictEqual(summary.lowSinrFraction, 1 / 3);
});

test('a serving change between attached steps is one handover', () => {
  const summary = summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-60),
    samples: [
      sample({ instantMs: 0, servingSatelliteId: '49194' }),
      sample({ instantMs: 1000, servingSatelliteId: '55159' }),
      sample({ instantMs: 2000, servingSatelliteId: '55159' }),
    ],
  });

  assert.strictEqual(summary.numHandovers, 1);
});

test('a drop and re-attach is not counted as a handover', () => {
  // The engine's inter-handover rule is relative and never fires on
  // re-attachment. Counting this would manufacture the "low power means more
  // handovers" story the review round established is false here.
  const summary = summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-60),
    samples: [
      sample({ instantMs: 0, servingSatelliteId: '49194' }),
      sample({
        instantMs: 1000,
        servingSatelliteId: null,
        servingSinrDb: null,
        ratesMbps: [0],
        systemPowerW: 1,
      }),
      sample({ instantMs: 2000, servingSatelliteId: '55159' }),
    ],
  });

  assert.strictEqual(summary.numHandovers, 0);
  assert.strictEqual(summary.outageSampleCount, 1);
});

test('the 1 Hz bridge takes the last level in each second', () => {
  const oneHz = resampleSixActsRunToOneHz([
    sample({ instantMs: 0, durationSec: 0.5, servingSinrDb: -12 }),
    sample({ instantMs: 500, durationSec: 0.5, servingSinrDb: -8 }),
    sample({ instantMs: 1000, durationSec: 0.5, servingSinrDb: -6 }),
  ]);

  assert.strictEqual(oneHz.length, 2);
  assert.strictEqual(oneHz[0].secondEpochMs, 0);
  assert.strictEqual(oneHz[0].currentSinrDb, -8);
  assert.strictEqual(oneHz[0].sourceSampleCount, 2);
  assert.strictEqual(oneHz[1].currentSinrDb, -6);
  assert.strictEqual(oneHz[1].sourceSampleCount, 1);
});

test('a handover inside a second survives the resample as an OR', () => {
  // Serving ping-pongs B -> A and back inside second 2. Last-wins on the
  // identity would show no change at the tick boundaries and erase both.
  const oneHz = resampleSixActsRunToOneHz([
    sample({ instantMs: 1500, durationSec: 0.5, servingSatelliteId: 'B' }),
    sample({ instantMs: 2000, durationSec: 0.5, servingSatelliteId: 'A' }),
    sample({ instantMs: 2500, durationSec: 0.5, servingSatelliteId: 'B' }),
  ]);

  const secondTwo = oneHz.find(entry => entry.secondEpochMs === 2000);
  assert.ok(secondTwo);
  assert.strictEqual(secondTwo.handoverEvent, 1);
});

test('the 1 Hz gain is candidate minus serving, and null while unattached', () => {
  const oneHz = resampleSixActsRunToOneHz([
    sample({ instantMs: 0, servingSinrDb: -10, bestCandidateSinrDb: -7 }),
    sample({
      instantMs: 1000,
      servingSatelliteId: null,
      servingSinrDb: null,
      bestCandidateSinrDb: -7,
      ratesMbps: [0],
    }),
  ]);

  assert.ok(Math.abs((oneHz[0].sinrGainDb as number) - 3) < 1e-12);
  assert.strictEqual(oneHz[0].attached, true);
  assert.strictEqual(oneHz[1].sinrGainDb, null);
  assert.strictEqual(oneHz[1].attached, false);
});

test('seconds with no runtime step are not invented', () => {
  const oneHz = resampleSixActsRunToOneHz([
    sample({ instantMs: 0 }),
    sample({ instantMs: 5000 }),
  ]);

  assert.deepStrictEqual(oneHz.map(entry => entry.secondEpochMs), [0, 5000]);
});

test('an empty run is a typed failure, not a zero summary', () => {
  assertDomainError('EMPTY_RUN', () => summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-10),
    samples: [],
  }));
});

test('a non-advancing sample is rejected', () => {
  assertDomainError('NON_MONOTONIC_SAMPLE', () => summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-10),
    samples: [sample({ instantMs: 1000 }), sample({ instantMs: 1000 })],
  }));
});

test('an attached step without a serving SINR is rejected', () => {
  assertDomainError('ATTACHMENT_INCONSISTENT', () => summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-10),
    samples: [sample({ servingSatelliteId: '49194', servingSinrDb: null })],
  }));
});

test('a non-positive step duration is rejected', () => {
  assertDomainError('INVALID_DURATION', () => summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: threshold(-10),
    samples: [sample({ durationSec: 0 })],
  }));
});

test('the engine attach threshold arrives with its provenance badge', () => {
  const summary = summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: getSixActsAttachThreshold(),
    samples: [sample({ servingSinrDb: -12 })],
  });

  assert.strictEqual(summary.lowSinrThresholdDb, -5);
  assert.strictEqual(summary.lowSinrThreshold.provenance, 'ENGINE-OPERATING');
  assert.strictEqual(summary.lowSinrThreshold.sourceRef, null);
  assert.match(summary.lowSinrThreshold.captionZhHant, /不是論文值/);
  assert.strictEqual(summary.lowSinrRatioPercent, 100);
});

test('a threshold without a caption is rejected', () => {
  assertDomainError('INVALID_THRESHOLD', () => summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: { ...threshold(-10), captionZhHant: '  ' },
    samples: [sample()],
  }));
});

test('a non-finite threshold is rejected', () => {
  assertDomainError('INVALID_THRESHOLD', () => summarizeSixActsRun({
    ...RUN_IDS,
    lowSinrThreshold: { ...threshold(0), value: Number.NaN },
    samples: [sample()],
  }));
});
