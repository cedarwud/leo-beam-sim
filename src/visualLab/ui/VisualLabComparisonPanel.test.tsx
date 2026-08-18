import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComparisonView } from '../comparison';
import { VisualLabComparisonPanel } from './VisualLabComparisonPanel';

const metric = (baseline: number | null, candidate: number | null, delta: number | null) => ({ baseline, candidate, delta });

const availableComparison = (changedParameterKeys: readonly string[] = ['etaMax'], classification: 'identical' | 'causal' | 'exploratory' = 'causal'): ComparisonView => ({
  schemaVersion: 'visual-lab-comparison-v1',
  availability: 'available',
  reason: null,
  baseline: {} as ComparisonView['baseline'],
  candidate: {} as ComparisonView['candidate'],
  gates: {} as ComparisonView['gates'],
  changedParameterKeys,
  classification,
  frame: {
    availability: 'available',
    reason: null,
    deltas: {
      deliveredBits: metric(1_000_000_000, 1_200_000_000, 200_000_000),
      consumedJoules: metric(2_000, 2_100, 100),
      instantaneousEeBitsPerJ: metric(500_000, 571_000, 71_000),
      cumulativeEeBitsPerJ: metric(500_000, 571_428, 71_428),
      evaluationEeBitsPerJ: metric(null, null, null),
      servingThroughputBps: metric(10_000_000, 12_000_000, 2_000_000),
      totalThroughputBps: metric(12_500_000, 15_000_000, 2_500_000),
      systemPowerW: metric(1_200, 1_100, -100),
      serviceState: { baseline: 'available', candidate: 'available', changed: false },
      service: { baseline: true, candidate: true, changed: false },
      qos: { baseline: true, candidate: true, changed: false },
    },
  },
  evaluation: {
    availability: 'unavailable',
    reason: 'test fixture has no complete run',
    deltas: {
      deliveredBits: metric(null, null, null),
      consumedJoules: metric(null, null, null),
      evaluationEeBitsPerJ: metric(null, null, null),
    },
  },
});

const unavailableComparison = (baseline: ComparisonView['baseline'] | null): ComparisonView => ({
  schemaVersion: 'visual-lab-comparison-v1',
  availability: 'unavailable',
  reason: 'matched frame identity is not available for this accepted pair',
  baseline,
  candidate: baseline === null ? null : {} as ComparisonView['candidate'],
  gates: {} as ComparisonView['gates'],
  changedParameterKeys: [],
  classification: null,
  frame: {
    availability: 'unavailable',
    reason: 'comparison withheld',
    deltas: {} as ComparisonView['frame']['deltas'],
  },
  evaluation: {
    availability: 'unavailable',
    reason: 'comparison withheld',
    deltas: {} as ComparisonView['evaluation']['deltas'],
  },
});

const actions = { saved: 0, cleared: 0 };
const zh = renderToStaticMarkup(
  <VisualLabComparisonPanel
    comparison={availableComparison()}
    locale="zh-Hant"
    theme="light"
    canSaveBaseline
    onSaveBaseline={() => { actions.saved += 1; }}
    onClearBaseline={() => { actions.cleared += 1; }}
  />,
);
const en = renderToStaticMarkup(
  <VisualLabComparisonPanel
    comparison={availableComparison(['etaMax', 'rfcPowerW'], 'exploratory')}
    locale="en"
    canSaveBaseline
    onSaveBaseline={() => undefined}
    onClearBaseline={() => undefined}
  />,
);

assert.match(zh, /data-comparison-availability="available"/);
assert.match(zh, /data-comparison-metric="totalThroughputBps"/);
assert.match(zh, /12\.5 Mbit\/s/);
assert.match(zh, /etaMax/);
assert.match(zh, /只改變一個輸入/);
assert.match(zh, /data-comparison-action="save-baseline"/);
assert.match(zh, /data-comparison-action="clear-baseline"/);
assert.match(zh, /目前 B（自動更新）/);
assert.match(zh, /B 不是另一筆手動保存的資料/);
assert.doesNotMatch(zh, /節省|saving/i, 'comparison never makes a savings claim');

assert.match(en, /Multiple inputs changed/);
assert.match(en, /rfcPowerW/);
assert.match(en, /Delta \(B − A\)/);
assert.doesNotMatch(en, /causal/i, 'multi-input comparison is not labelled causal');

const missingBaseline = renderToStaticMarkup(
  <VisualLabComparisonPanel
    comparison={unavailableComparison(null)}
    locale="zh-Hant"
    onSaveBaseline={() => undefined}
    onClearBaseline={() => undefined}
  />,
);
assert.match(missingBaseline, /data-comparison-availability="unavailable"/);
assert.match(missingBaseline, /請先建立基準 A/);
assert.doesNotMatch(missingBaseline, /data-comparison-metric/);
assert.match(missingBaseline, /disabled/);

const waitingForCandidate = renderToStaticMarkup(
  <VisualLabComparisonPanel
    comparison={unavailableComparison({} as ComparisonView['baseline'])}
    locale="en"
    onSaveBaseline={() => undefined}
    onClearBaseline={() => undefined}
  />,
);
assert.match(waitingForCandidate, /A saved/);
assert.match(waitingForCandidate, /Current B \(auto\)/);
assert.match(waitingForCandidate, /Comparison unavailable/);

assert.equal(actions.saved, 0, 'static rendering does not invoke save callback');
assert.equal(actions.cleared, 0, 'static rendering does not invoke clear callback');
console.log('visual-lab comparison panel renders bilingual guarded A/B output without savings claims');
