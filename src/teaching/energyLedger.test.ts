#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceEnergyLedger,
  computeHandoverEnergyJ,
  computeLowSinrRatioPct,
  computeRunEeMbitPerJ,
  computeTotalEnergyJ,
  getEnergyLedgerResetKey,
  DEFAULT_LOW_SINR_THRESHOLD_DB,
  DEFAULT_MAX_SAMPLE_GAP_SEC,
  EMPTY_ENERGY_LEDGER,
} from './energyLedger';
import type { EnergyLedgerState } from './energyLedger';
import { DEFAULT_ENERGY_TUNING } from './energyModel';
import { getEnergyLedgerSignalKey, getSignalTuningResetKey } from '../signalTuning';
import type { SignalTuningState } from '../signalTuning';

test('EMPTY_ENERGY_LEDGER is the fully-zeroed initial state', () => {
  assert.deepStrictEqual(EMPTY_ENERGY_LEDGER, {
    cumulativeDataMbit: 0,
    cumulativeEnergyJ: 0,
    elapsedSec: 0,
    lastSimTimeSec: null,
    handoverCount: 0,
    lastCumulativeHandoverCount: null,
    lowSinrSampleCount: 0,
    sinrSampleCount: 0,
  });
});

test('first sample only records the timestamp; does not accumulate', () => {
  const next = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 10,
    throughputMbps: 50,
    totalPowerW: 20,
  });
  assert.strictEqual(next.lastSimTimeSec, 10);
  assert.strictEqual(next.cumulativeDataMbit, 0);
  assert.strictEqual(next.cumulativeEnergyJ, 0);
  assert.strictEqual(next.elapsedSec, 0);
});

test('normal forward steps accumulate cumulativeDataMbit / cumulativeEnergyJ by dt', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 1, throughputMbps: 100, totalPowerW: 20 });
  assert.strictEqual(step2.cumulativeDataMbit, 100); // 100 Mbps * 1s
  assert.strictEqual(step2.cumulativeEnergyJ, 20); // 20 W * 1s
  assert.strictEqual(step2.elapsedSec, 1);
  assert.strictEqual(step2.lastSimTimeSec, 1);

  const step3 = advanceEnergyLedger(step2, { simTimeSec: 1.5, throughputMbps: 50, totalPowerW: 10 });
  assert.ok(Math.abs(step3.cumulativeDataMbit - 125) < 1e-9); // 100 + 50*0.5
  assert.ok(Math.abs(step3.cumulativeEnergyJ - 25) < 1e-9); // 20 + 10*0.5
  assert.ok(Math.abs(step3.elapsedSec - 1.5) < 1e-9);
});

test('dt exactly at the 2s boundary still accumulates normally (not treated as a jump)', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 2, throughputMbps: 100, totalPowerW: 20 });
  assert.ok(Math.abs(step2.cumulativeEnergyJ - 40) < 1e-9);
  assert.ok(Math.abs(step2.cumulativeDataMbit - 200) < 1e-9);
  assert.strictEqual(step2.lastSimTimeSec, 2);
});

test('simTimeSec going backwards (seek) resets to EMPTY_ENERGY_LEDGER', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 10,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 11, throughputMbps: 100, totalPowerW: 20 });
  assert.ok(step2.cumulativeEnergyJ > 0);

  const seekBack = advanceEnergyLedger(step2, { simTimeSec: 5, throughputMbps: 100, totalPowerW: 20 });
  assert.deepStrictEqual(seekBack, EMPTY_ENERGY_LEDGER);
});

test('simTimeSec jump > 2s (loop wrap) resets to EMPTY_ENERGY_LEDGER', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 10,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 11, throughputMbps: 100, totalPowerW: 20 });
  assert.ok(step2.cumulativeEnergyJ > 0);

  const jump = advanceEnergyLedger(step2, { simTimeSec: 14, throughputMbps: 100, totalPowerW: 20 }); // dt=3 > 2
  assert.deepStrictEqual(jump, EMPTY_ENERGY_LEDGER);
});

// ---------------------------------------------------------------------------
// maxSampleGapSec: caller-supplied jump threshold (playback-throttled callers)
// ---------------------------------------------------------------------------

test('DEFAULT_MAX_SAMPLE_GAP_SEC is exported and pinned at 2', () => {
  assert.strictEqual(DEFAULT_MAX_SAMPLE_GAP_SEC, 2);
});

test('maxSampleGapSec omitted: dt = 3.5 still resets using the 2s default (old behavior preserved)', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 3.5, throughputMbps: 100, totalPowerW: 20 });
  assert.deepStrictEqual(step2, EMPTY_ENERGY_LEDGER);
});

test('maxSampleGapSec = 10 lets dt = 3.5 accumulate instead of resetting', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    maxSampleGapSec: 10,
  });
  const step2 = advanceEnergyLedger(step1, {
    simTimeSec: 3.5,
    throughputMbps: 100,
    totalPowerW: 20,
    maxSampleGapSec: 10,
  });
  assert.strictEqual(step2.cumulativeDataMbit, 350); // 100 Mbps * 3.5s
  assert.strictEqual(step2.cumulativeEnergyJ, 70); // 20 W * 3.5s
  assert.strictEqual(step2.elapsedSec, 3.5);
  assert.strictEqual(step2.lastSimTimeSec, 3.5);
});

test('maxSampleGapSec = 10 still resets on a genuine jump (dt = 42)', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    maxSampleGapSec: 10,
  });
  const step2 = advanceEnergyLedger(step1, {
    simTimeSec: 42,
    throughputMbps: 100,
    totalPowerW: 20,
    maxSampleGapSec: 10,
  });
  assert.deepStrictEqual(step2, EMPTY_ENERGY_LEDGER);
});

test('an invalid maxSampleGapSec (null / undefined / NaN / 0 / negative) falls back to the 2s default', () => {
  const badValues: Array<number | null | undefined> = [null, undefined, Number.NaN, 0, -5];
  for (const bad of badValues) {
    const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
      simTimeSec: 0,
      throughputMbps: 100,
      totalPowerW: 20,
      maxSampleGapSec: bad,
    });
    const step2 = advanceEnergyLedger(step1, {
      simTimeSec: 3.5,
      throughputMbps: 100,
      totalPowerW: 20,
      maxSampleGapSec: bad,
    });
    assert.deepStrictEqual(
      step2,
      EMPTY_ENERGY_LEDGER,
      `maxSampleGapSec=${bad} must fall back to the 2s default`,
    );
  }
});

test('a backward seek resets regardless of how large maxSampleGapSec is', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 10,
    throughputMbps: 100,
    totalPowerW: 20,
    maxSampleGapSec: 1000,
  });
  const step2 = advanceEnergyLedger(step1, {
    simTimeSec: 11,
    throughputMbps: 100,
    totalPowerW: 20,
    maxSampleGapSec: 1000,
  });
  assert.ok(step2.cumulativeEnergyJ > 0);

  const seekBack = advanceEnergyLedger(step2, {
    simTimeSec: 5,
    throughputMbps: 100,
    totalPowerW: 20,
    maxSampleGapSec: 1000,
  });
  assert.deepStrictEqual(seekBack, EMPTY_ENERGY_LEDGER);
});

test('non-finite simTimeSec resets to EMPTY_ENERGY_LEDGER rather than NaN-poisoning the ledger', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 10,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 11, throughputMbps: 100, totalPowerW: 20 });
  assert.ok(step2.cumulativeEnergyJ > 0);

  const nanStep = advanceEnergyLedger(step2, {
    simTimeSec: Number.NaN,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  assert.deepStrictEqual(nanStep, EMPTY_ENERGY_LEDGER);
});

test('null throughputMbps advances time only and never pollutes accumulation', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 1, throughputMbps: null, totalPowerW: 20 });
  assert.strictEqual(step2.cumulativeDataMbit, 0);
  assert.strictEqual(step2.cumulativeEnergyJ, 0);
  assert.strictEqual(step2.elapsedSec, 0);
  assert.strictEqual(step2.lastSimTimeSec, 1);
});

test('null totalPowerW advances time only and never pollutes accumulation', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 1, throughputMbps: 100, totalPowerW: null });
  assert.strictEqual(step2.cumulativeDataMbit, 0);
  assert.strictEqual(step2.cumulativeEnergyJ, 0);
  assert.strictEqual(step2.elapsedSec, 0);
  assert.strictEqual(step2.lastSimTimeSec, 1);
});

test('a null sample in the middle of a run does not corrupt prior or subsequent accumulation', () => {
  const step1 = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
  });
  const step2 = advanceEnergyLedger(step1, { simTimeSec: 1, throughputMbps: 100, totalPowerW: 20 });
  assert.ok(Math.abs(step2.cumulativeDataMbit - 100) < 1e-9);
  assert.ok(Math.abs(step2.cumulativeEnergyJ - 20) < 1e-9);

  const step3 = advanceEnergyLedger(step2, { simTimeSec: 2, throughputMbps: null, totalPowerW: null });
  assert.ok(Math.abs(step3.cumulativeDataMbit - 100) < 1e-9); // unchanged from step2
  assert.ok(Math.abs(step3.cumulativeEnergyJ - 20) < 1e-9); // unchanged from step2
  assert.strictEqual(step3.lastSimTimeSec, 2);

  const step4 = advanceEnergyLedger(step3, { simTimeSec: 3, throughputMbps: 100, totalPowerW: 20 });
  assert.ok(Math.abs(step4.cumulativeDataMbit - 200) < 1e-9); // 100 (prior) + 100*1 (this dt)
  assert.ok(Math.abs(step4.cumulativeEnergyJ - 40) < 1e-9); // 20 (prior) + 20*1 (this dt)
});

test('computeRunEeMbitPerJ: normal ledger returns Sigma Mbit / Sigma J', () => {
  const ledger: EnergyLedgerState = {
    cumulativeDataMbit: 500,
    cumulativeEnergyJ: 100,
    elapsedSec: 10,
    lastSimTimeSec: 10,
    handoverCount: 0,
    lastCumulativeHandoverCount: 0,
    lowSinrSampleCount: 0,
    sinrSampleCount: 0,
  };
  assert.strictEqual(computeRunEeMbitPerJ(ledger), 5);
});

test('computeRunEeMbitPerJ: zero accumulated energy returns null, not Infinity', () => {
  assert.strictEqual(computeRunEeMbitPerJ(EMPTY_ENERGY_LEDGER), null);
});

test('computeRunEeMbitPerJ: negative energy (should never happen, but fail closed) returns null', () => {
  const ledger: EnergyLedgerState = {
    cumulativeDataMbit: 500,
    cumulativeEnergyJ: -10,
    elapsedSec: 10,
    lastSimTimeSec: 10,
    handoverCount: 0,
    lastCumulativeHandoverCount: 0,
    lowSinrSampleCount: 0,
    sinrSampleCount: 0,
  };
  assert.strictEqual(computeRunEeMbitPerJ(ledger), null);
});

test('computeRunEeMbitPerJ: non-finite cumulativeDataMbit returns null', () => {
  const ledger: EnergyLedgerState = {
    cumulativeDataMbit: Number.POSITIVE_INFINITY,
    cumulativeEnergyJ: 100,
    elapsedSec: 10,
    lastSimTimeSec: 10,
    handoverCount: 0,
    lastCumulativeHandoverCount: 0,
    lowSinrSampleCount: 0,
    sinrSampleCount: 0,
  };
  assert.strictEqual(computeRunEeMbitPerJ(ledger), null);
});

// ---------------------------------------------------------------------------
// Handover energy: cumulative-count semantics
// ---------------------------------------------------------------------------

test('cumulative hoCount is differenced, not re-added: a flat counter credits nothing', () => {
  // Upstream publishes a CUMULATIVE count. If it were treated as an increment,
  // a steady hoCount=3 across four samples would credit 3+3+3 = 9 handovers.
  let ledger = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 3,
  });
  assert.strictEqual(ledger.handoverCount, 0, 'first sample only baselines');
  assert.strictEqual(ledger.lastCumulativeHandoverCount, 3);

  for (const t of [1, 2, 3]) {
    ledger = advanceEnergyLedger(ledger, {
      simTimeSec: t,
      throughputMbps: 100,
      totalPowerW: 20,
      cumulativeHandoverCount: 3,
    });
  }
  assert.strictEqual(ledger.handoverCount, 0, 'a flat cumulative counter must credit nothing');
});

test('cumulative hoCount increments are credited exactly once, including multi-event steps', () => {
  let ledger = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 0,
  });
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 1,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 1,
  });
  assert.strictEqual(ledger.handoverCount, 1);

  // Two events land between published frames: the delta recovers both.
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 2,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 3,
  });
  assert.strictEqual(ledger.handoverCount, 3);
  assert.strictEqual(ledger.lastCumulativeHandoverCount, 3);
});

test('a baseline established mid-run does not back-charge earlier handovers', () => {
  // The ledger joins a run where upstream has already logged 42 handovers.
  let ledger = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 100,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 42,
  });
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 101,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 43,
  });
  assert.strictEqual(ledger.handoverCount, 1, 'only the one event inside the window counts');
});

test('a ledger reset also resets the handover baseline (no double-charging across a reset)', () => {
  let ledger = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 0,
  });
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 1,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 5,
  });
  assert.strictEqual(ledger.handoverCount, 5);

  // dt = 3 > 2 -> reset. Both the tally and the baseline must go.
  const afterJump = advanceEnergyLedger(ledger, {
    simTimeSec: 4,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 5,
  });
  assert.deepStrictEqual(afterJump, EMPTY_ENERGY_LEDGER);
  assert.strictEqual(afterJump.lastCumulativeHandoverCount, null);

  // Re-baseline at 5, then one genuinely new event -> exactly 1, not 6.
  let resumed = advanceEnergyLedger(afterJump, {
    simTimeSec: 4,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 5,
  });
  resumed = advanceEnergyLedger(resumed, {
    simTimeSec: 5,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 6,
  });
  assert.strictEqual(resumed.handoverCount, 1, 'pre-reset handovers must not be re-charged');
});

test('an explicit EMPTY_ENERGY_LEDGER restart (parameter change) drops the handover tally', () => {
  let ledger = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 0,
  });
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 1,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 7,
  });
  assert.strictEqual(ledger.handoverCount, 7);

  // How App.tsx restarts the window on a reset-key change.
  let restarted = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 1,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 7,
  });
  restarted = advanceEnergyLedger(restarted, {
    simTimeSec: 2,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 8,
  });
  assert.strictEqual(restarted.handoverCount, 1);
});

test('an upstream counter restart (hoCount going down) re-baselines instead of going negative', () => {
  let ledger = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 0,
  });
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 1,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 9,
  });
  assert.strictEqual(ledger.handoverCount, 9);

  // HandoverManager rebuilt: eventLog.length falls back to 0.
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 2,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 0,
  });
  assert.strictEqual(ledger.handoverCount, 9, 'no negative credit');
  assert.strictEqual(ledger.lastCumulativeHandoverCount, 0, 're-baselined to the new counter');

  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 3,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 1,
  });
  assert.strictEqual(ledger.handoverCount, 10);
});

test('an omitted / null / non-finite hoCount holds the tally and the baseline', () => {
  let ledger = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 0,
  });
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 1,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 2,
  });
  assert.strictEqual(ledger.handoverCount, 2);

  // Omitted entirely (a producer that does not report handovers at all).
  ledger = advanceEnergyLedger(ledger, { simTimeSec: 2, throughputMbps: 100, totalPowerW: 20 });
  assert.strictEqual(ledger.handoverCount, 2);
  assert.strictEqual(ledger.lastCumulativeHandoverCount, 2);

  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 3,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: Number.NaN,
  });
  assert.strictEqual(ledger.handoverCount, 2);
  assert.strictEqual(ledger.lastCumulativeHandoverCount, 2);

  // The baseline was held, so events missed while the count was unusable are
  // recovered on the next usable sample.
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 4,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 5,
  });
  assert.strictEqual(ledger.handoverCount, 5);
});

test('a skipped (null-physics) sample re-baselines without crediting: the interval is out of the window', () => {
  let ledger = advanceEnergyLedger(EMPTY_ENERGY_LEDGER, {
    simTimeSec: 0,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 0,
  });
  // Physics reading failed closed -> nothing is integrated for this interval,
  // so the handovers inside it are outside the accounted window too.
  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 1,
    throughputMbps: null,
    totalPowerW: null,
    cumulativeHandoverCount: 4,
  });
  assert.strictEqual(ledger.elapsedSec, 0, 'no time integrated');
  assert.strictEqual(ledger.handoverCount, 0, 'no handover charged for a non-integrated interval');
  assert.strictEqual(ledger.lastCumulativeHandoverCount, 4, 'but the baseline still moves');

  ledger = advanceEnergyLedger(ledger, {
    simTimeSec: 2,
    throughputMbps: 100,
    totalPowerW: 20,
    cumulativeHandoverCount: 5,
  });
  assert.strictEqual(ledger.handoverCount, 1, 'only the event inside the integrated interval');
});

// ---------------------------------------------------------------------------
// Low-SINR ratio — the third qualified-saving gate
// ---------------------------------------------------------------------------

/** Drives n samples of 1 s each, feeding one serving SINR per sample. */
function runSinrSamples(sinrs: readonly (number | null)[], thresholdDb?: number) {
  let state = EMPTY_ENERGY_LEDGER;
  sinrs.forEach((sinrDb, i) => {
    state = advanceEnergyLedger(state, {
      simTimeSec: i,
      throughputMbps: 10,
      totalPowerW: 5,
      servingSinrDb: sinrDb,
      lowSinrThresholdDb: thresholdDb,
    });
  });
  return state;
}

test('computeLowSinrRatioPct: null when no sample carried a usable SINR', () => {
  assert.strictEqual(computeLowSinrRatioPct(EMPTY_ENERGY_LEDGER), null);
  // "no reading" must not render as "0% were bad" — opposite claims.
  assert.strictEqual(computeLowSinrRatioPct(runSinrSamples([null, null, null])), null);
});

test('computeLowSinrRatioPct: counts samples strictly below the threshold', () => {
  // first sample only sets the baseline, so 13/15/20 are the counted ones
  const state = runSinrSamples([20, 13, 15, 20], 14);
  assert.strictEqual(state.sinrSampleCount, 3);
  assert.strictEqual(state.lowSinrSampleCount, 1);
  assert.strictEqual(computeLowSinrRatioPct(state), (1 / 3) * 100);
});

test('low-SINR threshold is strict: a sample exactly AT the threshold is not low', () => {
  const state = runSinrSamples([20, 14, 14], 14);
  assert.strictEqual(state.lowSinrSampleCount, 0);
  assert.strictEqual(computeLowSinrRatioPct(state), 0, 'a measured 0 is a real value');
});

test('low-SINR falls back to the COURSE-DEFINED 14 dB default', () => {
  assert.strictEqual(DEFAULT_LOW_SINR_THRESHOLD_DB, 14);
  const state = runSinrSamples([20, 13.9, 14.1]);
  assert.strictEqual(state.lowSinrSampleCount, 1);
});

test('low-SINR ignores no-service and broken readings', () => {
  // -Infinity is "unserved" (a coverage fact) and NaN is a broken expression;
  // neither is a quality measurement, so neither counter may move.
  const state = runSinrSamples([20, Number.NEGATIVE_INFINITY, Number.NaN, 20], 14);
  assert.strictEqual(state.sinrSampleCount, 1);
  assert.strictEqual(state.lowSinrSampleCount, 0);
});

test('a ledger reset clears the low-SINR tally with everything else', () => {
  const state = runSinrSamples([20, 5, 5], 14);
  assert.ok(state.lowSinrSampleCount > 0);
  const afterSeek = advanceEnergyLedger(state, {
    simTimeSec: state.lastSimTimeSec! + 999,
    throughputMbps: 10,
    totalPowerW: 5,
    servingSinrDb: 5,
  });
  assert.deepStrictEqual(afterSeek, EMPTY_ENERGY_LEDGER);
});

// ---------------------------------------------------------------------------
// E_HO / E_total / Run EE
// ---------------------------------------------------------------------------

function ledgerWith(over: Partial<EnergyLedgerState>): EnergyLedgerState {
  return {
    cumulativeDataMbit: 500,
    cumulativeEnergyJ: 100,
    elapsedSec: 10,
    lastSimTimeSec: 10,
    handoverCount: 0,
    lastCumulativeHandoverCount: 0,
    lowSinrSampleCount: 0,
    sinrSampleCount: 0,
    ...over,
  };
}

test('computeHandoverEnergyJ: E_HO = handoverCount * energyPerHandoverJ', () => {
  assert.strictEqual(computeHandoverEnergyJ(ledgerWith({ handoverCount: 4 }), 50), 200);
  assert.strictEqual(computeHandoverEnergyJ(ledgerWith({ handoverCount: 0 }), 50), 0);
  assert.strictEqual(computeHandoverEnergyJ(ledgerWith({ handoverCount: 4 }), 0), 0);
});

test('computeHandoverEnergyJ: broken cost or tally fails closed to null, never 0', () => {
  assert.strictEqual(computeHandoverEnergyJ(ledgerWith({ handoverCount: 4 }), Number.NaN), null);
  assert.strictEqual(computeHandoverEnergyJ(ledgerWith({ handoverCount: 4 }), -1), null);
  assert.strictEqual(
    computeHandoverEnergyJ(ledgerWith({ handoverCount: 4 }), Number.POSITIVE_INFINITY),
    null,
  );
  assert.strictEqual(computeHandoverEnergyJ(ledgerWith({ handoverCount: -2 }), 50), null);
  assert.strictEqual(computeHandoverEnergyJ(ledgerWith({ handoverCount: Number.NaN }), 50), null);
});

test('computeTotalEnergyJ: the split adds up exactly — E_total = radio + E_HO', () => {
  const ledger = ledgerWith({ cumulativeEnergyJ: 18222.6, handoverCount: 10 });
  const radioJ = ledger.cumulativeEnergyJ;
  const handoverJ = computeHandoverEnergyJ(ledger, 50);
  const totalJ = computeTotalEnergyJ(ledger, 50);
  assert.ok(handoverJ !== null && totalJ !== null);
  assert.strictEqual(handoverJ, 500);
  assert.ok(Math.abs(totalJ - (radioJ + handoverJ)) < 1e-9, 'radio + handover must equal total');
  assert.ok(Math.abs(totalJ - 18722.6) < 1e-9);
  // Sanity check on the sizing rationale in DEFAULT_ENERGY_PER_HANDOVER_J:
  // the handover term is visible but not dominant at the reference setup.
  const share = handoverJ / totalJ;
  assert.ok(share > 0.02 && share < 0.08, `E_HO share expected 2-8%, got ${(share * 100).toFixed(2)}%`);
});

test('computeTotalEnergyJ: a broken term poisons the whole sum (null, not a partial number)', () => {
  assert.strictEqual(computeTotalEnergyJ(ledgerWith({ handoverCount: 1 }), Number.NaN), null);
  assert.strictEqual(computeTotalEnergyJ(ledgerWith({ cumulativeEnergyJ: -1 }), 50), null);
  assert.strictEqual(
    computeTotalEnergyJ(ledgerWith({ cumulativeEnergyJ: Number.NaN }), 50),
    null,
  );
});

test('computeRunEeMbitPerJ: the denominator now includes E_HO', () => {
  const ledger = ledgerWith({ cumulativeDataMbit: 500, cumulativeEnergyJ: 100, handoverCount: 2 });
  // radio 100 J + 2 * 25 J = 150 J -> 500 / 150
  assert.ok(Math.abs((computeRunEeMbitPerJ(ledger, 25) ?? 0) - 500 / 150) < 1e-12);
});

test('computeRunEeMbitPerJ: explicit 0 is radio-only, while omitted cost uses the 3 J default', () => {
  const ledger = ledgerWith({ cumulativeDataMbit: 500, cumulativeEnergyJ: 100, handoverCount: 7 });
  assert.strictEqual(computeRunEeMbitPerJ(ledger, 0), 5);
  // The runtime default charges the seven handovers at 3 J each.
  assert.strictEqual(computeRunEeMbitPerJ(ledger), 500 / (100 + 7 * 3));
});

test('computeRunEeMbitPerJ: handoverCount = 0 leaves the value identical to the radio-only ledger', () => {
  const ledger = ledgerWith({ cumulativeDataMbit: 500, cumulativeEnergyJ: 100, handoverCount: 0 });
  assert.strictEqual(computeRunEeMbitPerJ(ledger, 50), 5);
});

test('computeRunEeMbitPerJ: still fails closed when the new denominator is <= 0 or untrustworthy', () => {
  // Nothing integrated and no handovers: 0 J denominator -> null, not Infinity.
  assert.strictEqual(computeRunEeMbitPerJ(EMPTY_ENERGY_LEDGER, 50), null);
  // Radio energy 0 but handovers charged -> denominator > 0, so it IS defined.
  const onlyHandovers = ledgerWith({
    cumulativeDataMbit: 500,
    cumulativeEnergyJ: 0,
    handoverCount: 2,
  });
  assert.strictEqual(computeRunEeMbitPerJ(onlyHandovers, 50), 5); // 500 / 100
  // Broken cost knob -> the whole EE is untrustworthy, not silently radio-only.
  assert.strictEqual(computeRunEeMbitPerJ(onlyHandovers, Number.NaN), null);
  assert.strictEqual(computeRunEeMbitPerJ(onlyHandovers, -50), null);
  // Negative radio energy still fails closed with handovers in the mix.
  assert.strictEqual(
    computeRunEeMbitPerJ(ledgerWith({ cumulativeEnergyJ: -10, handoverCount: 1 }), 50),
    null,
  );
});

test('handover energy changes Run EE — the causal link the handover controls needed', () => {
  const fewHandovers = ledgerWith({
    cumulativeDataMbit: 1000,
    cumulativeEnergyJ: 18222.6,
    handoverCount: 4,
  });
  const manyHandovers = ledgerWith({
    cumulativeDataMbit: 1000,
    cumulativeEnergyJ: 18222.6,
    handoverCount: 20,
  });
  const eeFew = computeRunEeMbitPerJ(fewHandovers, 50);
  const eeMany = computeRunEeMbitPerJ(manyHandovers, 50);
  assert.ok(eeFew !== null && eeMany !== null);
  assert.ok(eeMany < eeFew, 'ping-pong must cost energy efficiency');
});

// ---------------------------------------------------------------------------
// Accumulation-window key
// ---------------------------------------------------------------------------

const BASE_SIGNAL_TUNING: SignalTuningState = {
  frequencyGHz: 20,
  atmosphericZenithLossDb: 0.5,
  scintillationScaleDb: 0.3,
  shadowFadingMarginDb: 2,
  tr38811NlosClutterLossDb: 30,
  bandwidthMHz: 400,
  maxTxPowerDbm: 50,
  noisePsdDbmHz: -174,
  maxGainDbi: 38,
  ueAntennaMaxGainDbi: 0,
  beamwidth3dBDeg: 4.4,
  model: 'bessel-j1-j3',
  maxSteeringAngleDeg: 60,
  scanLossAtMaxSteeringDb: 3,
  frequencyReuse: 3,
  pathLossComponents: ['fspl', 'atmospheric'],
};

test('getEnergyLedgerSignalKey covers every SignalTuningState field', () => {
  // Any field left out silently mixes two configurations into one Sigma.
  const base = getEnergyLedgerSignalKey(BASE_SIGNAL_TUNING);
  const mutations: Array<[string, SignalTuningState]> = [
    ['frequencyGHz', { ...BASE_SIGNAL_TUNING, frequencyGHz: 30 }],
    ['atmosphericZenithLossDb', { ...BASE_SIGNAL_TUNING, atmosphericZenithLossDb: 1.5 }],
    ['scintillationScaleDb', { ...BASE_SIGNAL_TUNING, scintillationScaleDb: 1.3 }],
    ['shadowFadingMarginDb', { ...BASE_SIGNAL_TUNING, shadowFadingMarginDb: 4 }],
    ['tr38811NlosClutterLossDb', { ...BASE_SIGNAL_TUNING, tr38811NlosClutterLossDb: 35 }],
    ['bandwidthMHz', { ...BASE_SIGNAL_TUNING, bandwidthMHz: 200 }],
    ['maxTxPowerDbm', { ...BASE_SIGNAL_TUNING, maxTxPowerDbm: 33 }],
    ['noisePsdDbmHz', { ...BASE_SIGNAL_TUNING, noisePsdDbmHz: -170 }],
    ['maxGainDbi', { ...BASE_SIGNAL_TUNING, maxGainDbi: 40 }],
    ['ueAntennaMaxGainDbi', { ...BASE_SIGNAL_TUNING, ueAntennaMaxGainDbi: 5 }],
    ['beamwidth3dBDeg', { ...BASE_SIGNAL_TUNING, beamwidth3dBDeg: 5 }],
    ['model', { ...BASE_SIGNAL_TUNING, model: 'flat' }],
    ['maxSteeringAngleDeg', { ...BASE_SIGNAL_TUNING, maxSteeringAngleDeg: 45 }],
    ['scanLossAtMaxSteeringDb', { ...BASE_SIGNAL_TUNING, scanLossAtMaxSteeringDb: 6 }],
    ['frequencyReuse', { ...BASE_SIGNAL_TUNING, frequencyReuse: 1 }],
    ['pathLossComponents', { ...BASE_SIGNAL_TUNING, pathLossComponents: ['fspl'] }],
  ];

  const covered = new Set(mutations.map(([field]) => field));
  for (const field of Object.keys(BASE_SIGNAL_TUNING)) {
    assert.ok(covered.has(field), `SignalTuningState.${field} has no coverage assertion here`);
  }

  for (const [field, mutated] of mutations) {
    assert.notStrictEqual(
      getEnergyLedgerSignalKey(mutated),
      base,
      `changing ${field} must restart the energy accumulation window`,
    );
  }
});

test('getEnergyLedgerSignalKey is stable for an unchanged tuning state', () => {
  assert.strictEqual(
    getEnergyLedgerSignalKey(BASE_SIGNAL_TUNING),
    getEnergyLedgerSignalKey({ ...BASE_SIGNAL_TUNING }),
  );
});

test('the energy key and the engine-rebuild key stay independent', () => {
  // The bug this fixes: Tx power moved the energy model but not the reset key.
  const txChanged = { ...BASE_SIGNAL_TUNING, maxTxPowerDbm: 33 };
  assert.strictEqual(
    getSignalTuningResetKey(txChanged),
    getSignalTuningResetKey(BASE_SIGNAL_TUNING),
    'Tx power must NOT rebuild the engine (it would cold-start the beams)',
  );
  assert.notStrictEqual(
    getEnergyLedgerSignalKey(txChanged),
    getEnergyLedgerSignalKey(BASE_SIGNAL_TUNING),
    'Tx power MUST restart the energy ledger',
  );

  // Same for bandwidth and frequency reuse, the other two documented misses.
  for (const mutated of [
    { ...BASE_SIGNAL_TUNING, bandwidthMHz: 200 },
    { ...BASE_SIGNAL_TUNING, frequencyReuse: 1 },
  ]) {
    assert.strictEqual(getSignalTuningResetKey(mutated), getSignalTuningResetKey(BASE_SIGNAL_TUNING));
    assert.notStrictEqual(
      getEnergyLedgerSignalKey(mutated),
      getEnergyLedgerSignalKey(BASE_SIGNAL_TUNING),
    );
  }
});

test('getEnergyLedgerResetKey reacts to every energy tuning knob, including e_HO', () => {
  const signalKey = getEnergyLedgerSignalKey(BASE_SIGNAL_TUNING);
  const base = getEnergyLedgerResetKey(signalKey, DEFAULT_ENERGY_TUNING);

  assert.notStrictEqual(
    getEnergyLedgerResetKey(signalKey, { ...DEFAULT_ENERGY_TUNING, paEfficiency: 0.5 }),
    base,
  );
  assert.notStrictEqual(
    getEnergyLedgerResetKey(signalKey, { ...DEFAULT_ENERGY_TUNING, circuitPowerW: 25 }),
    base,
  );
  assert.notStrictEqual(
    getEnergyLedgerResetKey(signalKey, { ...DEFAULT_ENERGY_TUNING, energyPerHandoverJ: 100 }),
    base,
  );
  assert.notStrictEqual(
    getEnergyLedgerResetKey(getEnergyLedgerSignalKey({ ...BASE_SIGNAL_TUNING, maxTxPowerDbm: 33 }), DEFAULT_ENERGY_TUNING),
    base,
  );
  assert.strictEqual(getEnergyLedgerResetKey(signalKey, { ...DEFAULT_ENERGY_TUNING }), base);
});

test('getEnergyLedgerResetKey: an omitted e_HO keys the same as the explicit default', () => {
  const signalKey = getEnergyLedgerSignalKey(BASE_SIGNAL_TUNING);
  assert.strictEqual(
    getEnergyLedgerResetKey(signalKey, { paEfficiency: 0.35, circuitPowerW: 3 }),
    getEnergyLedgerResetKey(signalKey, DEFAULT_ENERGY_TUNING),
  );
});
