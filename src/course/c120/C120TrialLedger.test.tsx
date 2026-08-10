import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  C120_CLAIM_BOUNDARY,
  type C120Evidence,
  type C120ReplayInput,
  type C120WorkbookReplayRecord,
} from './contract';
import { C120TrialLedger } from './C120TrialLedger';
import { C120LocaleProvider } from './i18n';

const baselineInput: C120ReplayInput = {
  surface: 'lab-c',
  missionContractId: 'mission-fixed-service-boundary',
  slots: ['fixed-contact', 'send-urgent', 'send-urgent', 'fixed-outage', 'send-bulk', 'sleep'],
  revisionOrdinal: 0,
  withheldEvent: 'none',
};
const candidateInput: C120ReplayInput = {
  surface: 'lab-c',
  missionContractId: 'mission-fixed-service-boundary',
  slots: ['fixed-contact', 'wait', 'batch-periodic', 'fixed-outage', 'flush-batch', 'sleep'],
  revisionOrdinal: 0,
  withheldEvent: 'shorter-window',
};
const revisionInput: C120ReplayInput = {
  surface: 'lab-c',
  missionContractId: 'mission-fixed-service-boundary',
  slots: ['fixed-contact', 'send-urgent', 'batch-periodic', 'fixed-outage', 'flush-batch', 'send-urgent'],
  revisionOrdinal: 1,
  withheldEvent: 'surprise-urgent',
};

const baselineOutcome: C120Evidence = {
  servicePass: true,
  deadlinePass: true,
  freshnessStatus: 'fresh',
  systemPowerW: 28,
  consumedEnergyJ: 510,
  energyBudgetJ: 520,
  budgetRemainingJ: 10,
  rateBitsPerSec: 380000,
  deliveredBits: 1500000,
  energyEfficiencyBitsPerJ: 2941.176,
  activeTimeSec: 42,
  switchCount: 0,
  wakeCount: 4,
  warningCodes: [],
};
const candidateOutcome: C120Evidence = {
  ...baselineOutcome,
  servicePass: false,
  deadlinePass: false,
  freshnessStatus: 'expired',
  consumedEnergyJ: 300,
  budgetRemainingJ: 220,
  deliveredBits: 800000,
  energyEfficiencyBitsPerJ: 2666.667,
  activeTimeSec: 28,
  wakeCount: 3,
};
const revisionOutcome: C120Evidence = {
  servicePass: true,
  deadlinePass: true,
  freshnessStatus: 'fresh',
  systemPowerW: 26,
  consumedEnergyJ: 460,
  energyBudgetJ: 520,
  budgetRemainingJ: 60,
  rateBitsPerSec: 360000,
  deliveredBits: 1450000,
  energyEfficiencyBitsPerJ: 3152.174,
  activeTimeSec: 36,
  switchCount: 0,
  wakeCount: 4,
  warningCodes: [],
};

function record(
  input: C120ReplayInput,
  replayId: string,
  replayInputId: string,
  outcome: C120Evidence,
): C120WorkbookReplayRecord {
  return { input, replayId, replayInputId, outcome };
}

const baseline = record(baselineInput, 'lab-c-immediate-baseline-replay', 'lab-c:baseline', baselineOutcome);
const candidate = record(candidateInput, 'lab-c-batched-replay', 'lab-c:candidate', candidateOutcome);
const revision = record(revisionInput, 'lab-c-revision-replay', 'lab-c:revision', revisionOutcome);

test('C120TrialLedger renders a meaningful empty state and exact disclaimer', () => {
  const html = renderToStaticMarkup(<C120LocaleProvider initialLocale="en"><C120TrialLedger records={[]} /></C120LocaleProvider>);

  assert.match(html, /data-testid="c120-trial-ledger-empty"/);
  assert.match(html, /There are no comparable results yet/);
  assert.ok(html.includes(C120_CLAIM_BOUNDARY));
  assert.doesNotMatch(html, /<table/);
});

test('C120TrialLedger is Traditional-Chinese-first for learners', () => {
  const html = renderToStaticMarkup(<C120TrialLedger records={[]} />);
  assert.match(html, /歷次選擇比較/);
  assert.match(html, /目前還沒有可比較的結果/);
});

test('C120TrialLedger renders baseline, candidate, revision, and withheld categories', () => {
  const html = renderToStaticMarkup(
    <C120LocaleProvider initialLocale="en"><C120TrialLedger records={[baseline, candidate, revision]} /></C120LocaleProvider>,
  );

  assert.match(html, /data-trial-categories="baseline"/);
  assert.match(html, /data-trial-categories="candidate withheld"/);
  assert.match(html, /data-trial-categories="revision withheld"/);
  assert.match(html, /data-trial-category="baseline">Baseline/);
  assert.match(html, /data-trial-category="candidate">Candidate/);
  assert.match(html, /data-trial-category="revision">Revision/);
  assert.match(html, /data-trial-category="withheld"> · Withheld/);
  assert.match(html, /scope="col">Trial category/);
  assert.match(html, /scope="row"/);
});

test('C120TrialLedger renders provider values, units, surface identity, and replay provenance', () => {
  const html = renderToStaticMarkup(<C120LocaleProvider initialLocale="en"><C120TrialLedger records={[revision]} /></C120LocaleProvider>);
  const { input, outcome } = revision;
  if (input.surface !== 'lab-c') throw new Error('revision test record must be a Lab C input');

  assert.match(html, /<caption>C-120 course replay comparison: baseline, candidate, revision, and withheld trials/);
  assert.match(html, /scope="col">Active \(s\)/);
  assert.match(html, /scope="col">Power \(W\)/);
  assert.match(html, /scope="col">Consumed \(J\)/);
  assert.match(html, /scope="col">Budget remaining \(J\)/);
  assert.match(html, /scope="col">Delivered \(bit\)/);
  assert.match(html, /scope="col">Bit\/J \(bit\/J\)/);
  assert.match(html, /scope="col">Switches \(count\)/);
  assert.match(html, /scope="col">Wakes \(count\)/);
  assert.match(html, new RegExp(`surface=${input.surface}`));
  assert.match(html, new RegExp(`action=slots=${input.slots.join(' → ')}`));
  assert.match(html, new RegExp(`replayId=${revision.replayId}`));
  assert.match(html, new RegExp(`replayInputId=${revision.replayInputId}`));
  assert.match(html, new RegExp(`service_pass=${outcome.servicePass ? 'PASS' : 'FAIL'}`));
  assert.match(html, new RegExp(`deadline=${outcome.deadlinePass ? 'PASS' : 'FAIL'}`));
  assert.match(html, new RegExp(`freshness=${outcome.freshnessStatus}`));
  const expectMetric = (value: number, unit: string): void => {
    assert.match(html, new RegExp(`data value="${value}">${value}</data> ${unit}`));
  };
  expectMetric(outcome.activeTimeSec, 's');
  expectMetric(outcome.systemPowerW, 'W');
  expectMetric(outcome.consumedEnergyJ, 'J');
  expectMetric(outcome.budgetRemainingJ, 'J');
  expectMetric(outcome.deliveredBits, 'bit');
  expectMetric(outcome.energyEfficiencyBitsPerJ, 'bit/J');
  expectMetric(outcome.switchCount, 'count');
  expectMetric(outcome.wakeCount, 'count');
  assert.ok(html.includes(C120_CLAIM_BOUNDARY));
});

console.log('C-120 trial ledger tests passed');
