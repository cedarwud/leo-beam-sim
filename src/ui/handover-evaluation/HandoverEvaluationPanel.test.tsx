#!/usr/bin/env node
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverDecisionFrame,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateLinkKey,
  type CandidateDecisionState,
  type CandidateGateResult,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';
import { buildCandidatePresentationPlan } from '../../engine/handover/candidatePresentationPlan';
import { LocaleProvider } from '../../i18n';
import { loadProfile } from '../../profiles';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
} from '../../scene/acceptedHandoverPresentationSnapshot';
import { createInitialSimState } from '../../scene/initialSimState';
import { InfoPanel } from '../InfoPanel';
import { CandidateSetPanel } from './CandidateSetPanel';
import {
  formatHandoverDecisionTime,
  HandoverEvaluationPanel,
} from './HandoverEvaluationPanel';

const SOURCE_FRAME_ID = 'walker:fixture:12000.000';
const POLICY_CONFIG_HASH = createHandoverPresentationPolicyConfigHash('ui-fixture');

assert.deepEqual(
  formatHandoverDecisionTime(Date.UTC(2026, 7, 25, 10, 30, 15)),
  {
    dateTime: '2026-08-25T10:30:15.000Z',
    label: '2026-08-25 10:30:15 UTC',
  },
);
assert.deepEqual(formatHandoverDecisionTime(12_000), {
  dateTime: 'PT12S',
  label: 't = 12.0 s',
});

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
    sinrMeasurementContext: {
      purpose: 'sinr-offset-admission',
      powerModel: 'profile-rated-rf',
      profileId: 'hobs-2024-candidate-rich',
      epochToken: 'walker:fixture',
      ratedTransmitPowerDbm: 50,
      activeInterferenceKeys: ['STARLINK-101|1'],
    },
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
  epochToken: 'walker:fixture',
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

function acceptedSnapshot(
  frame: HandoverDecisionFrame,
  pinnedKey: CandidateLinkKey | null = null,
  previousSnapshot: ReturnType<typeof buildAcceptedHandoverPresentationSession>['snapshot'] | null = null,
) {
  return buildAcceptedHandoverPresentationSession({
    decision: frame,
    policyConfigHash: POLICY_CONFIG_HASH,
    pinnedKey,
    previousSnapshot,
  }).snapshot;
}

const decisionSnapshot = acceptedSnapshot(decision);

const zhMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <HandoverEvaluationPanel snapshot={decisionSnapshot} />
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
assert.match(zhMarkup, /模擬星座同時刻額定功率量測/);
assert.doesNotMatch(zhMarkup, />[^<]*Walker[^<]*</);
assert.match(zhMarkup, /STARLINK-101 \/ B1 \/ C1/);
assert.match(zhMarkup, /STARLINK-101 \/ B2 \/ C2/);
assert.match(zhMarkup, /資格 SINR/);
assert.match(zhMarkup, /並非實體衛星波束識別碼/);
assert.match(zhMarkup, /data-active-data-link-count="1"/);
assert.match(zhMarkup, /data-pair-key="STARLINK-101\|1"/);
assert.match(zhMarkup, /data-scene-join-key="homepage-handover\/1\/link\/STARLINK-101%7C1"/);
assert.match(zhMarkup, /data-rail-join-key="homepage-handover\/1\/link\/STARLINK-101%7C1"/);
assert.equal(zhMarkup.match(/data-active-data-link="true"/g)?.length, 1);
assert.ok((zhMarkup.match(/data-active-data-link="false"/g)?.length ?? 0) >= 1);
assert.match(zhMarkup, /data-scientific-candidate-count="6"/);
assert.match(zhMarkup, /data-displayed-hard-eligible-candidate-count="/);
assert.match(zhMarkup, /data-overflow-hard-eligible-candidate-count="/);
assert.match(zhMarkup, /顯示 \d+ \/ \d+/);
assert.match(zhMarkup, /檢視其餘 2 組/);
assert.doesNotMatch(zhMarkup, />0 bit\/J</);
assert.ok(
  zhMarkup.indexOf('leo-handover-selection') < zhMarkup.indexOf('leo-handover-candidate-set'),
  'event-state summary must remain visible before the long candidate list',
);

const enMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HandoverEvaluationPanel snapshot={decisionSnapshot} />
  </LocaleProvider>,
);

assert.match(enMarkup, /Multi-candidate handover evaluation/);
assert.match(enMarkup, /Leader confirmation/);
assert.match(enMarkup, /Only active data link/);
assert.match(enMarkup, /STARLINK-101 \/ B1 \/ C1/);
assert.match(enMarkup, /forecast EE is not active/i);
assert.match(enMarkup, /rated-power RF admission/i);
assert.match(enMarkup, /Admission SINR/);
assert.doesNotMatch(enMarkup, />[^<]*Walker[^<]*</);

const committedTarget = candidateLinkKey('STARLINK-202', 1);
const committedDecision = createHandoverDecisionFrame({
  ...decision,
  phase: 'guard',
  serving: committedTarget,
  provisionalLeader: null,
  selectedTarget: null,
  selectedKind: null,
  selectionHoldSec: 0,
  recentCommit: {
    episodeId: decision.episodeId,
    sourceFrameId: decision.sourceFrameId,
    simTimeMs: decision.simTimeMs,
    from: candidateLinkKey('STARLINK-101', 1),
    to: committedTarget,
    kind: 'inter-satellite',
    mode: 'sinr-offset',
    reason: 'fixed UI receipt fixture',
    oldLinkEnded: true,
    newLinkStarted: true,
  },
});
const receiptMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <HandoverEvaluationPanel snapshot={acceptedSnapshot(committedDecision)} />
  </LocaleProvider>,
);
assert.match(receiptMarkup, /跨衛星換手完成/);
assert.ok(
  receiptMarkup.indexOf('leo-handover-receipt') < receiptMarkup.indexOf('leo-handover-candidate-set'),
  'commit receipt must remain visible before the long candidate list',
);

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
assert.doesNotMatch(pinnedMarkup, /共同預測時域 H/);
assert.doesNotMatch(pinnedMarkup, /預測傳輸資料量/);
assert.doesNotMatch(pinnedMarkup, /預測耗能/);
assert.doesNotMatch(pinnedMarkup, /維持目前連線基準/);
assert.doesNotMatch(pinnedMarkup, /相對基準變化/);
assert.doesNotMatch(pinnedMarkup, /模型版本/);
assert.doesNotMatch(pinnedMarkup, /證據識別/);
assert.doesNotMatch(pinnedMarkup, new RegExp(SOURCE_FRAME_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(pinnedMarkup, /預測能源效率增益/);
assert.match(pinnedMarkup, /量測/);
assert.match(pinnedMarkup, /門檻/);
assert.match(pinnedMarkup, /資格 SINR/);
assert.doesNotMatch(pinnedMarkup, /尚未計算/);
const controlledDetailsId = pinnedMarkup.match(/aria-controls="([^"]+)"/)?.[1];
assert.ok(controlledDetailsId);
assert.match(pinnedMarkup, new RegExp(`id="${controlledDetailsId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));

const eeModeDecision = createHandoverDecisionFrame({
  ...decision,
  mode: 'ee-optimization',
});
const eeModePinnedMarkup = renderToStaticMarkup(
  <CandidateSetPanel
    plan={buildCandidatePresentationPlan(eeModeDecision, undefined, pinnedKey)}
    pinnedKey={pinnedKey}
    onTogglePin={() => undefined}
    copy={(zh) => zh}
  />,
);
assert.match(eeModePinnedMarkup, /共同預測時域 H/);
assert.match(eeModePinnedMarkup, /預測傳輸資料量/);
assert.match(eeModePinnedMarkup, /預測耗能/);
assert.match(eeModePinnedMarkup, /維持目前連線基準/);
assert.match(eeModePinnedMarkup, /相對基準變化/);
assert.match(eeModePinnedMarkup, /尚未計算/);
assert.match(eeModePinnedMarkup, /預測能源效率增益/);

const profile = loadProfile('hobs-2024-candidate-rich');
const integratedMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <InfoPanel
      {...createInitialSimState(profile)}
      handoverDecisionFrame={decision}
      acceptedHandoverPresentation={decisionSnapshot}
      profile={profile}
    />
  </LocaleProvider>,
);

assert.match(integratedMarkup, /data-testid="handover-evaluation-panel"/);
assert.doesNotMatch(integratedMarkup, /data-testid="info-panel-duel-card"/);

const walkerOpportunities = [
  opportunity('shell-pro-42-P21-S1', 1, 9.4),
  opportunity('shell-pro-42-P21-S1', 2, 11.1),
  opportunity('shell-pro-42-P22-S0', 1, 13.8),
  opportunity('shell-pro-42-P22-S0', 3, 12.9),
  opportunity('shell-pro-42-P23-S0', 1, 8.2),
  opportunity('shell-pro-42-P24-S0', 1, 2.1, false),
  opportunity('shell-pro-42-P25-S0', 1, 7.8),
];

const walkerDecision = createHandoverDecisionFrame({
  episodeId: 'homepage-handover/walker-1',
  sourceFrameId: SOURCE_FRAME_ID,
  epochToken: 'walker:fixture',
  simTimeMs: 12_000,
  phase: 'selection-hold',
  serving: candidateLinkKey('shell-pro-42-P21-S1', 1),
  opportunities: walkerOpportunities,
  states: [
    state('shell-pro-42-P21-S1', 1, {
      hardEligibility: 'unavailable',
      triggerStatus: 'not-satisfied',
      qualificationSec: 0,
      requiredTttSec: 0,
      stable: false,
      rank: null,
      rejectionCodes: ['throughput', 'remaining-service-time'],
    }),
    state('shell-pro-42-P21-S1', 2, { rank: 3 }),
    state('shell-pro-42-P22-S0', 1, { rank: 1 }),
    state('shell-pro-42-P22-S0', 3, { rank: 2 }),
    state('shell-pro-42-P23-S0', 1, {
      qualificationSec: 1.4,
      stable: false,
      rank: null,
    }),
    state('shell-pro-42-P24-S0', 1, {
      hardEligibility: 'ineligible',
      triggerStatus: 'not-satisfied',
      qualificationSec: 0,
      stable: false,
      rank: null,
      rejectionCodes: ['sinr'],
    }),
    state('shell-pro-42-P25-S0', 1, {
      triggerStatus: 'not-satisfied',
      qualificationSec: 0,
      stable: false,
      rank: null,
      rejectionCodes: ['sinr'],
    }),
  ],
  provisionalLeader: candidateLinkKey('shell-pro-42-P22-S0', 1),
  selectedTarget: null,
  selectedKind: null,
  selectionHoldSec: 0.8,
  selectionHoldRequiredSec: 1.5,
  mode: 'sinr-offset',
  recentCommit: null,
});

const walkerMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <HandoverEvaluationPanel snapshot={acceptedSnapshot(walkerDecision)} />
  </LocaleProvider>,
);

// Assert formatted satellite names appear in visible UI elements
assert.match(walkerMarkup, />G42-22-02 \/ B1 \/ C1</);
assert.match(walkerMarkup, />G42-23-01 \/ B1 \/ C1</);
assert.match(walkerMarkup, />G42-22-02</);
assert.match(walkerMarkup, />G42-23-01</);
assert.match(walkerMarkup, /aria-label="[^"]*G42-23-01[^"]*"/);

// Assert raw satellite IDs do NOT appear in visible text nodes
assert.doesNotMatch(walkerMarkup, />[^<]*shell-pro-42-P21-S1[^<]*</);
assert.doesNotMatch(walkerMarkup, />[^<]*shell-pro-42-P22-S0[^<]*</);
assert.doesNotMatch(walkerMarkup, />[^<]*shell-pro-42-P23-S0[^<]*</);
assert.doesNotMatch(walkerMarkup, />[^<]*shell-pro-42-P24-S0[^<]*</);
assert.doesNotMatch(walkerMarkup, />[^<]*shell-pro-42-P25-S0[^<]*</);
assert.doesNotMatch(walkerMarkup, /aria-label="[^"]*shell-pro-42-P21-S1[^"]*"/);
assert.doesNotMatch(walkerMarkup, /aria-label="[^"]*shell-pro-42-P22-S0[^"]*"/);

// Assert raw satellite IDs are retained in data-* attributes and decision metadata
assert.match(walkerMarkup, /data-satellite-id="shell-pro-42-P21-S1"/);
assert.match(walkerMarkup, /data-satellite-id="shell-pro-42-P22-S0"/);
assert.match(walkerMarkup, /data-satellite-identity-colors="[^"]*shell-pro-42-P21-S1[^"]*"/);

const walkerCommittedTarget = candidateLinkKey('shell-pro-42-P22-S0', 1);
const walkerCommittedDecision = createHandoverDecisionFrame({
  ...walkerDecision,
  phase: 'guard',
  serving: walkerCommittedTarget,
  provisionalLeader: null,
  selectedTarget: null,
  selectedKind: null,
  selectionHoldSec: 0,
  recentCommit: {
    episodeId: walkerDecision.episodeId,
    sourceFrameId: walkerDecision.sourceFrameId,
    simTimeMs: walkerDecision.simTimeMs,
    from: candidateLinkKey('shell-pro-42-P21-S1', 1),
    to: walkerCommittedTarget,
    kind: 'inter-satellite',
    mode: 'sinr-offset',
    reason: 'Walker inter-satellite handover fixture',
    oldLinkEnded: true,
    newLinkStarted: true,
  },
});

const walkerReceiptMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <HandoverEvaluationPanel snapshot={acceptedSnapshot(walkerCommittedDecision)} />
  </LocaleProvider>,
);

assert.match(walkerReceiptMarkup, /G42-22-02 \/ B1 \/ C1 → G42-23-01 \/ B1 \/ C1/);
assert.match(walkerReceiptMarkup, /data-from-satellite-id="shell-pro-42-P21-S1"/);
assert.match(walkerReceiptMarkup, /data-to-satellite-id="shell-pro-42-P22-S0"/);
assert.doesNotMatch(walkerReceiptMarkup, />[^<]*shell-pro-42-P21-S1[^<]*</);
assert.doesNotMatch(walkerReceiptMarkup, />[^<]*shell-pro-42-P22-S0[^<]*</);

const walkerPinnedKey = candidateLinkKey('shell-pro-42-P22-S0', 1);
const walkerCandidateSetMarkup = renderToStaticMarkup(
  <CandidateSetPanel
    plan={buildCandidatePresentationPlan(walkerDecision, undefined, walkerPinnedKey)}
    pinnedKey={walkerPinnedKey}
    onTogglePin={() => undefined}
    copy={(zh) => zh}
  />,
);

assert.match(walkerCandidateSetMarkup, />G42-22-02</);
assert.match(walkerCandidateSetMarkup, />G42-23-01</);
assert.match(walkerCandidateSetMarkup, /data-satellite-id="shell-pro-42-P21-S1"/);
assert.match(walkerCandidateSetMarkup, /data-satellite-id="shell-pro-42-P22-S0"/);
assert.doesNotMatch(walkerCandidateSetMarkup, />[^<]*shell-pro-42-P21-S1[^<]*</);
assert.doesNotMatch(walkerCandidateSetMarkup, />[^<]*shell-pro-42-P22-S0[^<]*</);
assert.doesNotMatch(walkerCandidateSetMarkup, /aria-label="[^"]*shell-pro-42-P22-S0[^"]*"/);
assert.match(walkerCandidateSetMarkup, /aria-label="[^"]*G42-23-01[^"]*"/);

console.log('Handover evaluation panel contract test passed.');
