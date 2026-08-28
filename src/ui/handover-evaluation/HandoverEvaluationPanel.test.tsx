#!/usr/bin/env node
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverDecisionFrame,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateDecisionState,
  type CandidateGateResult,
  type CandidateOpportunity,
} from '../../engine/handover/candidateDecisionContract';
import { buildCandidatePresentationPlan } from '../../engine/handover/candidatePresentationPlan';
import { LocaleProvider } from '../../i18n';
import { loadProfile } from '../../profiles';
import { createInitialSimState } from '../../scene/initialSimState';
import { InfoPanel } from '../InfoPanel';
import { CandidateSetPanel } from './CandidateSetPanel';
import { HandoverEvaluationPanel } from './HandoverEvaluationPanel';

const SOURCE_FRAME_ID = 'walker:fixture:12000.000';

function metric(value: number, unit: string) {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId: SOURCE_FRAME_ID,
    reason: null,
  });
}

function unavailableMetric(unit: string, reason: string) {
  return createMetricEvidence({
    status: 'unavailable',
    value: null,
    unit,
    sourceFrameId: null,
    reason,
  });
}

function gate(
  code: CandidateGateResult['code'],
  result: CandidateGateResult['result'],
): CandidateGateResult {
  const scheduled = code === 'scheduled-illumination';
  return createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : scheduled ? (result === 'pass' ? 1 : 0) : 12,
    threshold: result === 'unavailable' ? null : scheduled ? 1 : 10,
    unit: result === 'unavailable' ? null : scheduled ? 'boolean' : code === 'sinr' ? 'dB' : 'unit',
    reason: result === 'pass' ? null : `${code} fixture evidence`,
  });
}

function opportunity(satelliteId: string, beamId: number, sinrDb: number, eligible = true): CandidateOpportunity {
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-ntpu',
    sourceFrameId: SOURCE_FRAME_ID,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: eligible ? 'service-eligible' : 'scheduled-and-illuminated',
    elevation: metric(42 - beamId, 'deg'),
    steering: metric(5 + beamId, 'deg'),
    range: metric(820 + beamId * 10, 'km'),
    sinr: metric(sinrDb, 'dB'),
    predictedThroughput: unavailableMetric('bit/s', 'candidate throughput is not activated'),
    remainingServiceTime: unavailableMetric('s', 'contact prediction is not activated'),
    forecastEe: null,
    gates: [
      gate('elevation', 'pass'),
      gate('steering', 'pass'),
      gate('scheduled-illumination', 'pass'),
      gate('sinr', eligible ? 'pass' : 'fail'),
      gate('throughput', 'unavailable'),
      gate('remaining-service-time', 'unavailable'),
      gate('ee-advantage', 'unavailable'),
    ],
  });
}

function state(
  satelliteId: string,
  beamId: number,
  input: Partial<Omit<CandidateDecisionState, 'key'>> = {},
): CandidateDecisionState {
  return {
    key: candidateLinkKey(satelliteId, beamId),
    hardEligibility: 'eligible',
    triggerStatus: 'satisfied',
    qualificationSec: 3.5,
    requiredTttSec: 3.5,
    stable: true,
    rank: 1,
    rejectionCodes: [],
    ...input,
  };
}

const opportunities = [
  opportunity('STARLINK-101', 1, 9.4),
  opportunity('STARLINK-101', 2, 11.1),
  opportunity('STARLINK-202', 1, 13.8),
  opportunity('STARLINK-202', 3, 12.9),
  opportunity('STARLINK-303', 1, 8.2),
  opportunity('STARLINK-404', 1, 2.1, false),
  opportunity('STARLINK-505', 1, 7.8),
];

const decision = createHandoverDecisionFrame({
  episodeId: 'homepage-handover/1',
  sourceFrameId: SOURCE_FRAME_ID,
  simTimeMs: 12_000,
  phase: 'selection-hold',
  serving: candidateLinkKey('STARLINK-101', 1),
  opportunities,
  states: [
    state('STARLINK-101', 1, {
      hardEligibility: 'unavailable',
      triggerStatus: 'not-satisfied',
      qualificationSec: 0,
      requiredTttSec: 0,
      stable: false,
      rank: null,
      rejectionCodes: ['throughput', 'remaining-service-time'],
    }),
    state('STARLINK-101', 2, { rank: 3 }),
    state('STARLINK-202', 1, { rank: 1 }),
    state('STARLINK-202', 3, { rank: 2 }),
    state('STARLINK-303', 1, {
      qualificationSec: 1.4,
      stable: false,
      rank: null,
    }),
    state('STARLINK-404', 1, {
      hardEligibility: 'ineligible',
      triggerStatus: 'not-satisfied',
      qualificationSec: 0,
      stable: false,
      rank: null,
      rejectionCodes: ['sinr'],
    }),
    state('STARLINK-505', 1, {
      triggerStatus: 'not-satisfied',
      qualificationSec: 0,
      stable: false,
      rank: null,
      rejectionCodes: ['sinr'],
    }),
  ],
  provisionalLeader: candidateLinkKey('STARLINK-202', 1),
  selectedTarget: null,
  selectedKind: null,
  selectionHoldSec: 0.8,
  selectionHoldRequiredSec: 1.5,
  mode: 'sinr-offset',
  recentCommit: null,
});

const zhMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <HandoverEvaluationPanel decision={decision} />
  </LocaleProvider>,
);

assert.match(zhMarkup, /多候選換手評估/);
assert.match(zhMarkup, /領先候選確認/);
assert.match(zhMarkup, /目前服務連線/);
assert.match(zhMarkup, /候選連線/);
assert.match(zhMarkup, /STARLINK-101/);
assert.match(zhMarkup, /STARLINK-202/);
assert.match(zhMarkup, /同衛星波束候選/);
assert.match(zhMarkup, /跨衛星候選/);
assert.match(zhMarkup, /暫列第一/);
assert.match(zhMarkup, /預測能源效率尚未啟用/);
assert.match(zhMarkup, /不是 TLE 提供的實體波束識別碼/);
assert.match(zhMarkup, /data-active-data-link-count="1"/);
assert.equal(zhMarkup.match(/data-active-data-link="true"/g)?.length, 1);
assert.ok((zhMarkup.match(/data-active-data-link="false"/g)?.length ?? 0) >= 1);
assert.match(zhMarkup, /data-scientific-candidate-count="6"/);
assert.match(zhMarkup, /檢視其餘 2 組/);
assert.doesNotMatch(zhMarkup, />0 bit\/J</);

const enMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HandoverEvaluationPanel decision={decision} />
  </LocaleProvider>,
);

assert.match(enMarkup, /Multi-candidate handover evaluation/);
assert.match(enMarkup, /Leader confirmation/);
assert.match(enMarkup, /Only active data link/);
assert.match(enMarkup, /forecast EE is not active/i);

const pinnedKey = candidateLinkKey('STARLINK-202', 1);
const pinnedMarkup = renderToStaticMarkup(
  <CandidateSetPanel
    plan={buildCandidatePresentationPlan(decision, undefined, pinnedKey)}
    pinnedKey={pinnedKey}
    onTogglePin={() => undefined}
    copy={(zh) => zh}
  />,
);

assert.match(pinnedMarkup, /預測吞吐量/);
assert.match(pinnedMarkup, /預估剩餘服務時間/);
assert.match(pinnedMarkup, /共同預測時域 H/);
assert.match(pinnedMarkup, /預測傳輸資料量/);
assert.match(pinnedMarkup, /預測耗能/);
assert.match(pinnedMarkup, /維持目前連線基準/);
assert.match(pinnedMarkup, /相對基準變化/);
assert.match(pinnedMarkup, /模型版本/);
assert.match(pinnedMarkup, /證據來源/);
assert.match(pinnedMarkup, /量測/);
assert.match(pinnedMarkup, /門檻/);
assert.match(pinnedMarkup, /尚未計算/);
const controlledDetailsId = pinnedMarkup.match(/aria-controls="([^"]+)"/)?.[1];
assert.ok(controlledDetailsId);
assert.match(pinnedMarkup, new RegExp(`id="${controlledDetailsId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));

const profile = loadProfile('hobs-2024-candidate-rich');
const integratedMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <InfoPanel
      {...createInitialSimState(profile)}
      handoverDecisionFrame={decision}
      profile={profile}
    />
  </LocaleProvider>,
);

assert.match(integratedMarkup, /data-testid="handover-evaluation-panel"/);
assert.doesNotMatch(integratedMarkup, /data-testid="info-panel-duel-card"/);

console.log('Handover evaluation panel contract test passed.');
