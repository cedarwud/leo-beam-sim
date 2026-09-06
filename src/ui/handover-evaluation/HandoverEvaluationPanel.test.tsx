#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const infoPanelStyles = readFileSync(new URL('../../styles/_info-panel.scss', import.meta.url), 'utf8');
const comparisonBoardStyleStart = infoPanelStyles.indexOf('.leo-handover-comparison-board {');
const comparisonBoardStyleEnd = infoPanelStyles.indexOf('.leo-handover-comparison-board__empty');
assert.ok(comparisonBoardStyleStart >= 0 && comparisonBoardStyleEnd > comparisonBoardStyleStart);
const comparisonBoardStyles = infoPanelStyles.slice(comparisonBoardStyleStart, comparisonBoardStyleEnd);
assert.doesNotMatch(
  comparisonBoardStyles,
  /text-overflow\s*:\s*ellipsis/,
  'the primary service/candidate board must never hide identifiers behind an ellipsis',
);

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
assert.match(zhMarkup, /中央標記 S＝目前唯一作用中鏈路/);
assert.match(zhMarkup, /data-central-marker="S"/);
assert.match(zhMarkup, /data-central-marker="C1"/);
assert.match(zhMarkup, /跨衛星候選/);
assert.match(zhMarkup, /暫列第一/);
assert.match(zhMarkup, /預測能源效率尚未啟用/);
assert.match(zhMarkup, /模擬星座，同一時刻的候選鏈路量測（額定功率）/);
assert.match(zhMarkup, /目前決策依據：候選 SINR、換手偏移量與 TTT/);
assert.match(zhMarkup, /服務資格與 TTT 均已通過/);
assert.match(zhMarkup, /服務資格已通過；TTT 計時中/);
assert.doesNotMatch(zhMarkup, />[^<]*Walker[^<]*</);
assert.match(zhMarkup, /STARLINK-101 \/ B1 \/ C1/);
assert.match(zhMarkup, /STARLINK-101 \/ B2 \/ C2/);
assert.match(zhMarkup, /資格 SINR/);
assert.match(zhMarkup, /並非實體衛星波束識別碼/);
assert.match(zhMarkup, /服務鏈路維持/);
assert.match(zhMarkup, /data-testid="handover-comparison-decision-note"/);
assert.match(zhMarkup, /class="leo-handover-candidate-set__context"/);
assert.match(zhMarkup, /class="leo-handover-comparison-board__notes"/);
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
assert.match(zhMarkup, /展開其餘 1 組候選/);
assert.doesNotMatch(
  zhMarkup,
  /data-testid="handover-overflow-comparison"/,
  'collapsed overflow rows must not remain mounted and re-render on every live frame',
);
assert.match(zhMarkup, /data-testid="handover-selection-explanation"/);
assert.match(zhMarkup, /已通過服務資格與 3\.5 s TTT/);
assert.match(zhMarkup, /比目前服務高 4\.4 dB/);
assert.match(zhMarkup, /排名第 1/);
assert.match(zhMarkup, /保持完成後才執行切換/);
assert.doesNotMatch(zhMarkup, /檢視其餘/);
assert.doesNotMatch(zhMarkup, />0 bit\/J</);
assert.ok(
  zhMarkup.indexOf('leo-handover-candidate-set') < zhMarkup.indexOf('leo-handover-counts'),
  'same-frame candidate comparison must be visible before secondary counts',
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
assert.match(receiptMarkup, /data-testid="handover-receipt-explanation"/);
assert.match(receiptMarkup, /接手波束已通過服務資格與 3\.5 s TTT/);
assert.match(receiptMarkup, /資格 SINR 13\.8 dB/);
assert.match(receiptMarkup, /比原服務高 4\.4 dB/);
assert.match(receiptMarkup, /排名第 1/);
assert.match(receiptMarkup, /因此由此波束接手服務/);
assert.ok(
  receiptMarkup.indexOf('leo-handover-candidate-set') < receiptMarkup.indexOf('leo-handover-receipt'),
  'the same-frame comparison remains the primary rail surface before the receipt detail',
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
assert.match(pinnedMarkup, new RegExp(`data-source-frame-id="${SOURCE_FRAME_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
assert.doesNotMatch(pinnedMarkup, /預測能源效率增益/);
assert.doesNotMatch(pinnedMarkup, /預測 EE/);
assert.match(pinnedMarkup, /量測/);
assert.match(pinnedMarkup, /門檻/);
assert.match(pinnedMarkup, /資格 SINR/);
assert.match(pinnedMarkup, /class="leo-handover-satellite-group__roster"/);
assert.match(pinnedMarkup, /class="leo-handover-satellite-group__roster-summary"/);
assert.match(pinnedMarkup, /波束狀態/);
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
assert.match(eeModePinnedMarkup, /展開其餘/);
assert.doesNotMatch(
  eeModePinnedMarkup,
  /data-testid="handover-overflow-comparison"/,
  'the large overflow table must stay unmounted until the user expands it',
);

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

// ---------------------------------------------------------------------------
// The beam roster's three statements about itself must agree.
//
// `data-beam-roster-count`, the visible "N 個設定波束" text, and the number of
// rendered `data-beam-id` items are all derived from `group.beamRoster` -- and
// nothing asserted they stay in step. Measured: a cheap model asked to hide
// idle beams added `.filter(entry => entry.observed)` to the map alone, leaving
// the count attribute and the summary text at the unfiltered length. Every
// gate stayed green, including this file's own suite, so a badge reading
// "7 configured beams" above two rendered rows was a shippable state.
//
// This is the roster-completion contract seen from the render side: the roster
// deliberately includes idle entries (beamMetrics fills a sparse source frame
// to the configured budget), so "hide the idle ones" is a request that has to
// change the count and the copy too, or say why it does not.
// ---------------------------------------------------------------------------
function rosterSelfConsistency(markup: string): void {
  const blocks = markup.match(/data-beam-roster-count="(\d+)"[\s\S]*?(?=data-beam-roster-count="|$)/g) ?? [];
  assert.ok(blocks.length >= 1, 'the candidate set renders at least one beam roster');
  for (const block of blocks) {
    const declared = Number.parseInt(/data-beam-roster-count="(\d+)"/.exec(block)![1]!, 10);
    // Count the roster's own item class, not `data-beam-id` -- that attribute
    // appears on other surfaces in the same markup and over-counts by picking
    // them up past the end of the roster container.
    const rendered = (block.match(/leo-handover-beam-roster__item/g) ?? []).length;
    assert.equal(
      rendered,
      declared,
      `a roster declaring ${declared} beams rendered ${rendered} of them; `
      + 'the count, the copy and the rows are three statements about one list and must agree',
    );
    const labelled = /aria-label="(\d+) 個設定波束的同幀狀態"/.exec(block);
    if (labelled !== null) {
      assert.equal(
        Number.parseInt(labelled[1]!, 10),
        rendered,
        'the accessible label must count the rows a sighted reader can see',
      );
    }
  }
}

rosterSelfConsistency(zhMarkup);
rosterSelfConsistency(enMarkup);
rosterSelfConsistency(walkerCandidateSetMarkup);

console.log('Handover evaluation panel contract test passed.');
