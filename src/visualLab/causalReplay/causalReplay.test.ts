import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import type { ComparisonView } from '../comparison';
import {
  causalReplayMetrics,
  causalReplayParameterChange,
  formatCausalMetricDelta,
  formatCausalMetricValue,
} from './model';

const railSource = await readFile(new URL('./VisualLabCausalReplayRail.tsx', import.meta.url), 'utf8');
const stageSource = await readFile(new URL('./VisualLabCausalReplayStageCue.tsx', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('./VisualLabCausalReplay.scss', import.meta.url), 'utf8');

// Static contract checks keep the presentation lane separate from route/session ownership.
assert.match(railSource, /CAUSAL_REPLAY_STORIES/);
assert.match(railSource, /CAUSAL_REPLAY_PHASES/);
for (const phase of ['baseline', 'intervention', 'comparison']) {
  assert.match(stageSource, new RegExp(phase));
}
for (const control of ['previous', 'play-toggle', 'next', 'restart']) {
  assert.match(railSource, new RegExp(`data-causal-control="${control}"`));
}
for (const callback of ['onStoryChange', 'onPrevious', 'onPlayToggle', 'onNext', 'onRestart']) {
  assert.match(railSource, new RegExp(callback));
}
assert.match(railSource, /data-causal-classification/);
assert.match(stageSource, /data-causal-classification/);
assert.match(stageSource, /causalReplayMetrics/);
assert.match(stageSource, /parameterChange/);
assert.match(stageSource, /A · \{parameter\.baseline\} → B · \{parameter\.candidate\}/);
assert.doesNotMatch(stageSource, /accepted frame/i);
assert.doesNotMatch(stageSource, /saving/i);
assert.match(styleSource, /--causal-bg/);
assert.match(styleSource, /--vlab-bg/);
assert.match(styleSource, /--causal-service/);
assert.match(styleSource, /min-height: 44px/);
assert.match(styleSource, /font-size: 14px/);
assert.match(styleSource, /--light/);

const metric = (baseline: number | null, candidate: number | null, delta: number | null) => ({
  baseline,
  candidate,
  delta,
});

const causalComparison = {
  availability: 'available',
  classification: 'causal',
  changedParameterKeys: ['theta3dbRad'],
  baseline: {
    parameters: { theta3dbRad: 0.058 },
    canonical: { serving: { sinrDb: 7.2 } },
  },
  candidate: {
    parameters: { theta3dbRad: 0.087 },
    canonical: { serving: { sinrDb: 8.4 } },
  },
  frame: {
    availability: 'available',
    deltas: {
      totalThroughputBps: metric(10_000_000, 12_500_000, 2_500_000),
      systemPowerW: metric(1_200, 1_100, -100),
      instantaneousEeBitsPerJ: metric(500_000, 571_000, 71_000),
    },
  },
} as unknown as ComparisonView;

const readouts = causalReplayMetrics(causalComparison);
assert.deepEqual(readouts.map(readout => readout.id), [
  'totalThroughputBps',
  'systemPowerW',
  'instantaneousEeBitsPerJ',
  'servingSinrDb',
]);
assert.equal(readouts[0]?.metric.delta, 2_500_000);
assert.equal(readouts[1]?.metric.delta, -100);
assert.equal(readouts[3]?.metric.baseline, 7.2);
assert.equal(readouts[3]?.metric.candidate, 8.4);
assert.equal(readouts[3]?.metric.delta, null, 'SINR delta is not invented from canonical A/B values');

const explicitSinr = metric(7.2, 8.4, 1.2);
assert.equal(causalReplayMetrics(causalComparison, explicitSinr)[3]?.metric.delta, 1.2);

const unavailable = causalReplayMetrics({
  ...causalComparison,
  availability: 'unavailable',
  frame: { ...causalComparison.frame, availability: 'unavailable' },
});
assert.ok(unavailable.every(readout => readout.metric.baseline === null && readout.metric.candidate === null && readout.metric.delta === null));

assert.equal(formatCausalMetricValue('totalThroughputBps', 12_500_000), '12.5 Mbit/s');
assert.equal(formatCausalMetricValue('systemPowerW', 1.125), '1.13 W');
assert.equal(formatCausalMetricValue('instantaneousEeBitsPerJ', 2_500_000), '2.5 Mbit/J');
assert.equal(formatCausalMetricValue('servingSinrDb', 8.25), '8.25 dB');
assert.equal(formatCausalMetricDelta('systemPowerW', -100), '−100 W');
assert.equal(formatCausalMetricDelta('totalThroughputBps', 2_500_000), '+2.5 Mbit/s');
assert.equal(formatCausalMetricDelta('servingSinrDb', null), '—');

const derivedParameter = causalReplayParameterChange(causalComparison, 'en');
assert.ok(derivedParameter);
assert.equal(derivedParameter.label, 'Full 3 dB beamwidth');
assert.match(derivedParameter.baseline, /3\.3/);
assert.match(derivedParameter.candidate, /4\.98/);

const explicitParameter = causalReplayParameterChange(causalComparison, 'zh-Hant', {
  key: 'theta3dbRad',
  label: { 'zh-Hant': '波束寬度', en: 'Beamwidth' },
  baseline: '3.32°',
  candidate: '5.00°',
});
assert.deepEqual(explicitParameter, {
  label: '波束寬度',
  baseline: '3.32°',
  candidate: '5.00°',
});

console.log('visual-lab causal replay contract and source-backed formatter tests passed');
