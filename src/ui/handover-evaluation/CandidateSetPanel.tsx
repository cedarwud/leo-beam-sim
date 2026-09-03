import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react';

import type {
  HandoverBeamVisualIdentity,
  HandoverSatelliteVisualIdentity,
} from '../../constants/handoverVisualIdentity';

import {
  candidateLinkKeyString,
  sameCandidateLinkKey,
  type CandidateDecisionState,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type ForecastEeEvidence,
  type GateCode,
  type MetricEvidence,
} from '../../engine/handover/candidateDecisionContract';
import type {
  CandidatePresentationBeamRosterStatus,
  CandidatePresentationLink,
  CandidatePresentationPlan,
  CandidatePresentationRole,
} from '../../engine/handover/candidatePresentationPlan';
import { formatCandidateDisplayKey } from '../../engine/handover/candidateDisplayKey';
import { formatSatelliteLabel } from '../../utils/formatSatelliteLabel';

type Copy = (zh: string, en: string) => string;

interface CandidateSetPanelProps {
  readonly plan: CandidatePresentationPlan;
  readonly pinnedKey: CandidateLinkKey | null;
  readonly onTogglePin: (key: CandidateLinkKey) => void;
  readonly copy: Copy;
}

const GATE_LABELS: Readonly<Record<GateCode, readonly [string, string]>> = Object.freeze({
  elevation: ['仰角', 'elevation'],
  steering: ['波束轉向角', 'steering angle'],
  'scheduled-illumination': ['目前時槽照明', 'scheduled illumination'],
  sinr: ['SINR', 'SINR'],
  throughput: ['預測吞吐量', 'predicted throughput'],
  'remaining-service-time': ['預估剩餘服務時間', 'estimated remaining service time'],
  'ee-advantage': ['預測能源效率增益', 'forecast EE advantage'],
});

function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatMetric(evidence: MetricEvidence | null | undefined, digits = 1): string {
  if (evidence?.status !== 'available' || evidence.value === null || !Number.isFinite(evidence.value)) {
    return '—';
  }
  return `${formatNumber(evidence.value, digits)} ${evidence.unit}`;
}

function formatOptionalValue(value: number | null | undefined, unit: string, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${formatNumber(value, digits)} ${unit}`;
}

function unavailableLabel(status: MetricEvidence['status'], copy: Copy): string {
  if (status === 'stale') return copy('資料已逾時', 'Stale evidence');
  if (status === 'invalid') return copy('資料無效', 'Invalid evidence');
  if (status === 'zero-activity') return copy('此時域無活動量', 'No activity in this horizon');
  return copy('資料不足', 'Evidence unavailable');
}

function formatEvidence(evidence: MetricEvidence, digits: number, copy: Copy): string {
  return evidence.status === 'available'
    ? formatMetric(evidence, digits)
    : unavailableLabel(evidence.status, copy);
}

function forecastAvailability(evidence: ForecastEeEvidence | null, copy: Copy): string {
  if (evidence === null || evidence.status === 'unavailable') return copy('尚未計算', 'Not computed');
  if (evidence.status === 'stale') return copy('資料已逾時', 'Stale evidence');
  if (evidence.status === 'invalid') return copy('資料無效', 'Invalid evidence');
  if (evidence.status === 'zero-activity') return copy('此時域無活動量', 'No activity in this horizon');
  return evidence.eeBitPerJ === null
    ? copy('資料不足', 'Evidence unavailable')
    : `${formatNumber(evidence.eeBitPerJ, 2)} bit/J`;
}

function forecastSummary(evidence: ForecastEeEvidence | null, copy: Copy): string {
  const ee = forecastAvailability(evidence, copy);
  return evidence?.status === 'valid' && evidence.horizonSec !== null
    ? `${ee} · H ${formatNumber(evidence.horizonSec, 1)} s`
    : ee;
}

function roleLabel(role: CandidatePresentationRole, state: CandidateDecisionState | null, copy: Copy): string {
  switch (role) {
    case 'serving': return copy('目前服務', 'Serving');
    case 'committed-serving': return copy('已接手服務', 'Committed serving');
    case 'selected-target': return copy('選定目標', 'Selected target');
    case 'provisional-leader': return copy('暫列第一', 'Provisional leader');
    case 'hard-eligible': return copy('已通過服務資格', 'Service eligible');
    case 'qualified':
      return state?.stable
        ? copy('穩定候選', 'Stable candidate')
        : copy('條件持續中', 'Qualification in progress');
    case 'observed':
      if (state?.hardEligibility === 'unavailable') return copy('資料不足', 'Evidence unavailable');
      if (state?.hardEligibility === 'ineligible') return copy('未通過資格', 'Not eligible');
      return copy('已觀測', 'Observed');
  }
}

function beamRosterStatusLabel(
  status: CandidatePresentationBeamRosterStatus,
  observed: boolean,
  displayed: boolean,
  copy: Copy,
): string {
  if (status === 'not-observed') return copy('未觀測', 'Not observed');
  if (!displayed) return observed
    ? copy('已量測／未列入場景', 'Measured / not in scene')
    : copy('未列入場景', 'Not in scene');
  if (status === 'hard-eligible') return copy('資格通過', 'Eligible');
  if (status === 'qualified') return copy('TTT中', 'TTT');
  if (status === 'provisional-leader') return copy('暫列第一', 'Provisional');
  if (status === 'selected-target') return copy('選定', 'Selected');
  if (status === 'observed') return copy('已觀測', 'Observed');
  return copy('服務中', 'Serving');
}

function compatibilityMetricLabel(opportunity: CandidateOpportunity | null, copy: Copy): string {
  return opportunity?.sinrMeasurementContext?.powerModel === 'profile-rated-rf'
    ? copy('資格 SINR', 'Admission SINR')
    : copy('換手判定 SINR', 'Handover-decision SINR');
}

function metricForGate(opportunity: CandidateOpportunity, code: GateCode): MetricEvidence | null {
  switch (code) {
    case 'elevation': return opportunity.elevation;
    case 'steering': return opportunity.steering;
    case 'sinr': return opportunity.sinr;
    case 'throughput': return opportunity.predictedThroughput;
    case 'remaining-service-time': return opportunity.remainingServiceTime;
    case 'scheduled-illumination':
    case 'ee-advantage':
      return null;
  }
}

function gateIssueLabel(
  opportunity: CandidateOpportunity,
  code: GateCode,
  copy: Copy,
): string {
  const gate = opportunity.gates.find(candidateGate => candidateGate.code === code);
  const metric = metricForGate(opportunity, code);
  const unavailable = gate === undefined
    || gate.result === 'unavailable'
    || (metric !== null && metric.status !== 'available');
  const result = unavailable
    ? metric !== null && metric.status !== 'available'
      ? unavailableLabel(metric.status, copy)
      : copy('資料不足', 'Evidence unavailable')
    : copy('未通過', 'Failed');
  const [zh, en] = GATE_LABELS[code];
  return copy(`${result}：${zh}`, `${result}: ${en}`);
}

function candidateReason(
  opportunity: CandidateOpportunity | null,
  state: CandidateDecisionState | null,
  showForecastEe: boolean,
  copy: Copy,
): string {
  if (opportunity === null) return copy('資料不足：候選量測', 'Evidence unavailable: candidate measurement');
  if (state === null) return copy('資料不足：候選決策狀態', 'Evidence unavailable: candidate decision state');

  if (opportunity.sinr.status !== 'available') {
    return copy(
      `${unavailableLabel(opportunity.sinr.status, copy)}：${compatibilityMetricLabel(opportunity, copy)}`,
      `${unavailableLabel(opportunity.sinr.status, copy)}: ${compatibilityMetricLabel(opportunity, copy)}`,
    );
  }

  const rejectionCode = state.rejectionCodes.find(code => showForecastEe || code !== 'ee-advantage');
  if (rejectionCode !== undefined) return gateIssueLabel(opportunity, rejectionCode, copy);

  if (state.hardEligibility !== 'eligible') {
    const gateCode = opportunity.gates.find(gate => (
      gate.result !== 'pass' && (showForecastEe || gate.code !== 'ee-advantage')
    ))?.code;
    return gateCode === undefined
      ? state.hardEligibility === 'unavailable'
        ? copy('資料不足：服務條件', 'Evidence unavailable: service gates')
        : copy('未通過：服務條件', 'Failed: service gates')
      : gateIssueLabel(opportunity, gateCode, copy);
  }

  if (state.triggerStatus === 'unavailable') {
    return showForecastEe
      ? copy('資料不足：預測 EE', 'Evidence unavailable: forecast EE')
      : copy('資料不足：換手觸發條件', 'Evidence unavailable: handover trigger');
  }
  if (state.triggerStatus === 'not-satisfied') {
    return showForecastEe
      ? copy('預測 EE 尚未達到換手門檻', 'Forecast EE has not reached the handover threshold')
      : copy('服務資格已通過；換手觸發條件尚未成立', 'Service eligibility passed; handover trigger not yet satisfied');
  }
  return state.stable
    ? copy('服務資格與 TTT 均已通過', 'Service eligibility and TTT both passed')
    : copy('服務資格已通過；TTT 計時中', 'Service eligibility passed; TTT in progress');
}

function tttLabel(state: CandidateDecisionState | null, copy: Copy): string {
  if (state === null) return '—';
  if (state.requiredTttSec <= 0) return copy('不需等待', 'No wait required');
  const elapsed = Math.min(state.qualificationSec, state.requiredTttSec);
  return `${formatNumber(elapsed, 1)} / ${formatNumber(state.requiredTttSec, 1)} s`;
}

function CandidateDetails({
  link,
  copy,
  showForecastEe,
}: {
  readonly link: CandidatePresentationLink;
  readonly copy: Copy;
  readonly showForecastEe: boolean;
}) {
  const opportunity = link.opportunity;
  if (opportunity === null) {
    return <p className="leo-handover-candidate__missing">{copy('本畫面尚無同幀量測資料', 'No same-frame measurement is available')}</p>;
  }
  const ratedAdmission = opportunity.sinrMeasurementContext?.powerModel === 'profile-rated-rf';
  const ee = opportunity.forecastEe;
  const provenance = ee?.provenance;
  const relativeDelta = ee?.relativeDelta === null || ee?.relativeDelta === undefined
    ? '—'
    : `${formatNumber(ee.relativeDelta * 100, 2)} %`;
  return (
    <div className="leo-handover-candidate__details" data-testid="handover-candidate-details">
      <dl>
        <div><dt>{compatibilityMetricLabel(opportunity, copy)}</dt><dd>{formatMetric(opportunity.sinr, 2)}</dd></div>
        <div><dt>{copy('仰角', 'Elevation')}</dt><dd>{formatMetric(opportunity.elevation, 1)}</dd></div>
        <div><dt>{copy('轉向角', 'Steering')}</dt><dd>{formatMetric(opportunity.steering, 1)}</dd></div>
        <div><dt>{copy('距離', 'Range')}</dt><dd>{formatMetric(opportunity.range, 0)}</dd></div>
        <div><dt>{copy('預測吞吐量', 'Predicted throughput')}</dt><dd>{formatEvidence(opportunity.predictedThroughput, 0, copy)}</dd></div>
        <div><dt>{copy('預估剩餘服務時間', 'Estimated remaining service time')}</dt><dd>{formatEvidence(opportunity.remainingServiceTime, 1, copy)}</dd></div>
        {showForecastEe && <>
          <div><dt>{copy('預測 EE', 'Forecast EE')}</dt><dd>{forecastAvailability(ee, copy)}</dd></div>
          <div><dt>{copy('共同預測時域 H', 'Common forecast horizon H')}</dt><dd>{formatOptionalValue(ee?.horizonSec, 's', 1)}</dd></div>
          <div><dt>{copy('預測傳輸資料量', 'Forecast delivered data')}</dt><dd>{formatOptionalValue(ee?.deliveredBits, 'bit', 0)}</dd></div>
          <div><dt>{copy('預測耗能', 'Forecast energy')}</dt><dd>{formatOptionalValue(ee?.consumedJoules, 'J', 2)}</dd></div>
          <div><dt>{copy('維持目前連線基準', 'Keep-serving baseline')}</dt><dd>{formatOptionalValue(ee?.baselineEeBitPerJ, 'bit/J', 2)}</dd></div>
          <div><dt>{copy('相對基準變化', 'Relative to baseline')}</dt><dd>{relativeDelta}</dd></div>
          {ee !== null && <div><dt>{copy('模型版本', 'Model version')}</dt><dd>{ee.modelVersion}</dd></div>}
          {provenance != null && <div><dt>{copy('證據識別', 'Evidence receipt')}</dt><dd>{provenance.frameIdsOrDigest}</dd></div>}
        </>}
      </dl>
      <div className="leo-handover-candidate__gates" aria-label={copy('候選條件', 'Candidate gates')}>
        {opportunity.gates
          .filter(gate => showForecastEe || gate.code !== 'ee-advantage')
          .map(gate => {
          const [zh, en] = gate.code === 'sinr' && ratedAdmission
            ? ['資格 SINR', 'admission SINR']
            : GATE_LABELS[gate.code];
          const measurement = gate.measured === null
            ? null
            : gate.unit === 'boolean'
              ? gate.measured === 1 ? copy('已照明', 'illuminated') : copy('未照明', 'not illuminated')
              : `${formatNumber(gate.measured, 2)}${gate.unit === null ? '' : ` ${gate.unit}`}`;
          const threshold = gate.threshold === null
            ? null
            : gate.unit === 'boolean'
              ? copy('必須照明', 'illumination required')
              : `${formatNumber(gate.threshold, 2)}${gate.unit === null ? '' : ` ${gate.unit}`}`;
          return (
            <span key={gate.code} data-result={gate.result}>
              {copy(zh, en)} · {gate.result === 'pass'
                ? copy('通過', 'pass')
                : gate.result === 'fail'
                  ? copy('未通過', 'fail')
                  : copy('資料不足', 'unavailable')}
              {measurement === null ? '' : copy(`；量測 ${measurement}`, `; measured ${measurement}`)}
              {threshold === null ? '' : copy(`；門檻 ${threshold}`, `; threshold ${threshold}`)}
            </span>
          );
          })}
      </div>
    </div>
  );
}

function CandidateRow({
  link,
  pinned,
  onTogglePin,
  copy,
  showForecastEe,
}: {
  readonly link: CandidatePresentationLink;
  readonly pinned: boolean;
  readonly onTogglePin: (key: CandidateLinkKey) => void;
  readonly copy: Copy;
  readonly showForecastEe: boolean;
}) {
  const detailsId = useId();
  const state = link.state;
  const compatibilityLabel = compatibilityMetricLabel(link.opportunity, copy);
  const compatibilityValue = link.opportunity === null
    ? copy('資料不足', 'Evidence unavailable')
    : formatEvidence(link.opportunity.sinr, 1, copy);
  const reason = candidateReason(link.opportunity, state, showForecastEe, copy);
  const color = link.beamIdentity?.cssColor ?? link.satelliteIdentity.cssColor;
  return (
    <article
      className="leo-handover-candidate"
      data-role={link.role}
      data-active-data-link="false"
      data-satellite-id={link.satelliteId}
      data-beam-id={link.beamId}
      data-pair-key={candidateLinkKeyString(link.key)}
      data-source-frame-id={link.sourceFrameId}
      data-scene-join-key={link.sceneJoinKey}
      data-rail-join-key={link.railJoinKey}
      data-pattern={link.beamIdentity?.pattern ?? link.satelliteIdentity.pattern}
      style={{ '--leo-handover-link-color': color } as CSSProperties}
    >
      <button
        type="button"
        className="leo-handover-candidate__summary"
        aria-expanded={pinned}
        aria-pressed={pinned}
        aria-controls={detailsId}
        aria-label={`${link.displayKey}, ${roleLabel(link.role, state, copy)}, ${compatibilityLabel}: ${compatibilityValue}; ${reason}`}
        onClick={() => onTogglePin(link.key)}
      >
        <span className="leo-handover-candidate__glyph" aria-hidden="true">
          {link.beamIdentity?.glyph ?? link.satelliteIdentity.glyph}
        </span>
        <span className="leo-handover-candidate__identity">
          <strong>{link.displayKey}</strong>
        </span>
        <span className="leo-handover-candidate__status">
          {roleLabel(link.role, state, copy)}
          {state?.rank !== null && state?.rank !== undefined && <b>#{state.rank}</b>}
        </span>
      </button>
      <div className="leo-handover-candidate__metrics" data-forecast-ee={showForecastEe ? 'true' : 'false'}>
        <span><small>{compatibilityLabel}</small><strong>{compatibilityValue}</strong></span>
        <span><small>{copy('轉向角', 'Steering')}</small><strong>{link.opportunity === null ? copy('資料不足', 'Evidence unavailable') : formatEvidence(link.opportunity.steering, 1, copy)}</strong></span>
        <span><small>{copy('獨立 TTT', 'Independent TTT')}</small><strong>{tttLabel(state, copy)}</strong></span>
        {showForecastEe && (
          <span><small>{copy('預測 EE', 'Forecast EE')}</small><strong>{forecastSummary(link.opportunity?.forecastEe ?? null, copy)}</strong></span>
        )}
      </div>
      <p
        className="leo-handover-candidate__reason"
        data-reason-state={state?.hardEligibility === 'eligible' ? 'status' : 'issue'}
      >
        {reason}
      </p>
      <div id={detailsId} hidden={!pinned}>
        {pinned && <CandidateDetails link={link} copy={copy} showForecastEe={showForecastEe} />}
      </div>
    </article>
  );
}

const CENTRAL_CANDIDATE_SATELLITE_LIMIT = 2;

function comparisonBoardRolePriority(role: CandidatePresentationRole): number {
  switch (role) {
    case 'selected-target': return 0;
    case 'provisional-leader': return 1;
    case 'qualified': return 2;
    case 'hard-eligible': return 3;
    case 'observed': return 4;
    case 'serving':
    case 'committed-serving': return -1;
  }
}

function comparisonBoardGroups(plan: CandidatePresentationPlan): readonly {
  readonly satelliteId: string;
  readonly isServingSatellite: boolean;
  readonly hasSameSatelliteCandidate: boolean;
  readonly links: readonly CandidatePresentationLink[];
  readonly satelliteIdentity: HandoverSatelliteVisualIdentity;
}[] {
  const displayedIndex = new Map(plan.displayedLinks.map((link, index) => [link.joinKey, index] as const));
  const sortCandidateLinks = (links: readonly CandidatePresentationLink[]) => [...links].sort((left, right) => (
    comparisonBoardRolePriority(left.role) - comparisonBoardRolePriority(right.role)
    || Number(right.isPinned) - Number(left.isPinned)
    || (displayedIndex.get(left.joinKey) ?? Number.POSITIVE_INFINITY)
      - (displayedIndex.get(right.joinKey) ?? Number.POSITIVE_INFINITY)
    || left.beamId - right.beamId
  ));
  const serving = plan.groups.find(group => group.isServingSatellite) ?? null;
  const alternates = plan.groups
    .filter(group => !group.isServingSatellite)
    .map(group => {
      const links = sortCandidateLinks(group.links.filter(link => link.isCandidate));
      const representative = links[0] ?? null;
      return {
        group,
        links,
        representative,
        firstIndex: representative === null
          ? Number.POSITIVE_INFINITY
          : displayedIndex.get(representative.joinKey) ?? Number.POSITIVE_INFINITY,
      };
    })
    .filter(item => item.representative !== null)
    // Keep this ordering identical to the central scene's one-pair-per-satellite
    // selector.  The rail must never call a different spacecraft "Candidate 1"
    // than the colored GLB/halo in the canvas.
    .sort((left, right) => (
      comparisonBoardRolePriority(left.representative!.role)
      - comparisonBoardRolePriority(right.representative!.role)
      || Number(right.representative!.isPinned) - Number(left.representative!.isPinned)
      || left.firstIndex - right.firstIndex
      || left.group.satelliteId.localeCompare(right.group.satelliteId)
    ));
  const selected = alternates.slice(0, CENTRAL_CANDIDATE_SATELLITE_LIMIT);
  return Object.freeze([
    ...(serving === null ? [] : [Object.freeze({
      satelliteId: serving.satelliteId,
      isServingSatellite: true,
      // The central scene keeps one same-satellite replacement beam beside the
      // serving link for an intra-satellite handover. Keep that exact pair in
      // the serving card instead of hiding it behind the detailed roster.
      hasSameSatelliteCandidate: serving.links.some(link => link.isCandidate),
      links: Object.freeze(sortCandidateLinks(serving.links).slice(0, 2)),
      satelliteIdentity: serving.satelliteIdentity,
    })]),
    ...selected.map(({ group, links }) => Object.freeze({
      satelliteId: group.satelliteId,
      isServingSatellite: false,
      hasSameSatelliteCandidate: false,
      links: Object.freeze(links.slice(0, 2)),
      satelliteIdentity: group.satelliteIdentity,
    })),
  ]);
}

function compactCandidateMetric(
  link: CandidatePresentationLink,
  copy: Copy,
): { readonly sinr: string; readonly elevation: string; readonly ttt: string } {
  return {
    sinr: link.opportunity === null
      ? copy('資料不足', '—')
      : formatEvidence(link.opportunity.sinr, 1, copy),
    elevation: link.opportunity === null
      ? '—'
      : formatEvidence(link.opportunity.elevation, 0, copy),
    ttt: tttLabel(link.state, copy),
  };
}

function comparisonDecisionNote(
  plan: CandidatePresentationPlan,
  copy: Copy,
): string {
  const decision = plan.decision;
  const key = decision.selectedTarget ?? decision.provisionalLeader;
  const leadingLink = key === null
    ? null
    : plan.displayedLinks.find(link => sameCandidateLinkKey(link.key, key)) ?? null;
  if (decision.phase === 'switching' || decision.phase === 'guard') {
    return decision.recentCommit === null
      ? copy('換手程序已進入執行階段；中央畫面仍只保留一條作用中資料鏈路。', 'The handover is executing; the centre still has exactly one active data link.')
      : copy(
        `已由 ${leadingLink?.displayKey ?? formatCandidateDisplayKey({ key: decision.recentCommit.to, beamIdentitySource: 'walker-cell-surrogate' })} 接手；候選量測不代表同時承載資料。`,
        `${leadingLink?.displayKey ?? formatCandidateDisplayKey({ key: decision.recentCommit.to, beamIdentitySource: 'walker-cell-surrogate' })} has taken over; candidate measurements never carry data simultaneously.`,
      );
  }
  if (leadingLink !== null) {
    const label = decision.selectedTarget !== null
      ? copy('已選定', 'Selected')
      : copy('暫列第一', 'Provisional leader');
    return copy(
      `${label} ${leadingLink.displayKey}；服務鏈路維持，待 TTT／保持時間完成後才切換。`,
      `${label} ${leadingLink.displayKey}; the serving link stays active until TTT/selection hold completes.`,
    );
  }
  return copy(
    '尚未選定接手鏈路；服務鏈路維持，先比較同一時刻的候選衛星與波束。',
    'No replacement is selected yet; the serving link stays active while same-frame candidate satellites and beams are compared.',
  );
}

function CandidateComparisonBoard({
  plan,
  pinnedKey,
  onTogglePin,
  copy,
}: {
  readonly plan: CandidatePresentationPlan;
  readonly pinnedKey: CandidateLinkKey | null;
  readonly onTogglePin: (key: CandidateLinkKey) => void;
  readonly copy: Copy;
}) {
  const groups = comparisonBoardGroups(plan);
  const candidateSatelliteCount = groups.filter(group => !group.isServingSatellite).length;
  const totalCandidateSatelliteCount = plan.scientificCandidateSatelliteGroupCount;
  const hiddenSatelliteCount = Math.max(0, totalCandidateSatelliteCount - candidateSatelliteCount);
  const candidateOrdinalBySatelliteId = new Map(
    groups
      .filter(group => !group.isServingSatellite)
      .map((group, index) => [group.satelliteId, index + 1] as const),
  );
  return (
    <section
      className="leo-handover-comparison-board"
      data-testid="handover-candidate-board"
      data-source-frame-id={plan.decision.sourceFrameId}
      data-scene-join-contract="same-accepted-snapshot"
      aria-label={copy('同幀候選比較', 'Same-frame candidate comparison')}
    >
      <header className="leo-handover-comparison-board__header">
        <div>
          <h4>{copy('同幀候選比較', 'Same-frame candidate comparison')}</h4>
          <p>{copy('服務鏈路維持；比較具備資格的候選波束。', 'Serving link stays active; eligible candidate beams are compared.')}</p>
        </div>
        <span className="leo-handover-comparison-board__count">
          {copy(`${candidateSatelliteCount} 顆替代衛星`, `${candidateSatelliteCount} alternates`)}
        </span>
      </header>
      <details className="leo-handover-comparison-board__notes">
        <summary>{copy('如何對應中央場景', 'How to read the scene mapping')}</summary>
        <div>
          <p className="leo-handover-comparison-board__join-note">
            {copy('色點、衛星與波束編號和中央畫面同一來源；點選波束可釘選完整證據。', 'The colour dot, spacecraft and beam IDs are the same as in the centre scene; select a beam to pin its evidence.')}
          </p>
          <p
            className="leo-handover-comparison-board__mapping-note"
            data-testid="handover-central-marker-legend"
          >
            {copy(
              '中央標記 S＝目前唯一作用中鏈路；C1、C2＝場景中以同色標記呈現的候選衛星。候選僅量測，不會同時承載資料。',
              'Centre marker S is the only active data link; C1 and C2 are the candidate spacecraft highlighted in the scene. Candidates measure only and do not carry data simultaneously.',
            )}
          </p>
        </div>
      </details>
      <p
        className="leo-handover-comparison-board__decision-note"
        data-testid="handover-comparison-decision-note"
      >
        {comparisonDecisionNote(plan, copy)}
      </p>
      <div className="leo-handover-comparison-board__rows">
        {groups.map(group => {
          const ordinal = group.isServingSatellite
            ? null
            : groups.filter(candidate => !candidate.isServingSatellite).findIndex(
              candidate => candidate.satelliteId === group.satelliteId,
            ) + 1;
          const centralMarker = group.isServingSatellite
            ? 'S'
            : `C${candidateOrdinalBySatelliteId.get(group.satelliteId) ?? ordinal ?? '—'}`;
          return (
            <article
              key={group.satelliteId}
              className="leo-handover-comparison-board__satellite"
              data-satellite-id={group.satelliteId}
              data-satellite-color={group.satelliteIdentity.cssColor}
              data-role={group.isServingSatellite ? 'serving' : 'candidate'}
              data-central-marker={centralMarker}
              data-central-shortlist-ordinal={group.isServingSatellite
                ? 'serving'
                : String(candidateOrdinalBySatelliteId.get(group.satelliteId) ?? '')}
              style={{ '--leo-handover-satellite-color': group.satelliteIdentity.cssColor } as CSSProperties}
            >
              <header>
                <span className="leo-handover-comparison-board__swatch" aria-hidden="true" />
                <span
                  className="leo-handover-comparison-board__scene-marker"
                  data-central-marker={centralMarker}
                  aria-label={copy(`中央標記 ${centralMarker}`, `Centre marker ${centralMarker}`)}
                >
                  {centralMarker}
                </span>
                <strong>{group.isServingSatellite
                  ? group.hasSameSatelliteCandidate
                    ? copy('服務／同衛星候選', 'Serving / same-satellite candidate')
                    : copy('目前服務', 'Serving')
                  : `${copy('候選', 'Candidate')} ${ordinal}`}</strong>
                <span className="leo-handover-comparison-board__satellite-id">
                  {formatSatelliteLabel(group.satelliteId)}
                </span>
              </header>
              <div className="leo-handover-comparison-board__beams">
                {group.links.length === 0 && (
                  <span className="leo-handover-comparison-board__empty">{copy('尚無同幀波束量測', 'No same-frame beam measurement')}</span>
                )}
                {group.links.map(link => {
                  const metric = compactCandidateMetric(link, copy);
                  const pinned = pinnedKey !== null && sameCandidateLinkKey(pinnedKey, link.key);
                  const color = link.beamIdentity?.cssColor ?? group.satelliteIdentity.cssColor;
                  return (
                    <button
                      type="button"
                      key={link.joinKey}
                      className="leo-handover-comparison-board__beam"
                      data-satellite-id={link.satelliteId}
                      data-beam-id={link.beamId}
                      data-pair-key={candidateLinkKeyString(link.key)}
                      data-source-frame-id={link.sourceFrameId}
                      data-scene-join-key={link.sceneJoinKey}
                      data-rail-join-key={link.railJoinKey}
                      data-role={link.role}
                      data-central-representative={group.links[0]?.joinKey === link.joinKey ? 'true' : 'false'}
                      data-central-marker={centralMarker}
                      data-pinned={pinned ? 'true' : 'false'}
                      aria-pressed={pinned}
                      aria-label={`${link.displayKey}, ${roleLabel(link.role, link.state, copy)}; ${copy('SINR', 'SINR')} ${metric.sinr}; ${copy('仰角', 'elevation')} ${metric.elevation}`}
                      onClick={() => onTogglePin(link.key)}
                      style={{ '--leo-handover-link-color': color } as CSSProperties}
                    >
                      <span className="leo-handover-comparison-board__beam-main">
                        <span className="leo-handover-comparison-board__beam-chip">B{link.beamId}</span>
                        <strong>{link.displayKey}</strong>
                        <small>
                          {group.links[0]?.joinKey === link.joinKey
                            ? copy(`中央 ${centralMarker}`, `Centre ${centralMarker}`)
                            : roleLabel(link.role, link.state, copy)}
                        </small>
                      </span>
                      <span className="leo-handover-comparison-board__beam-metrics">
                        <span><small>SINR</small><strong>{metric.sinr}</strong></span>
                        <span><small>{copy('仰角', 'EL')}</small><strong>{metric.elevation}</strong></span>
                        <span><small>TTT</small><strong>{metric.ttt}</strong></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      {hiddenSatelliteCount > 0 && (
        <p className="leo-handover-comparison-board__overflow">
          {copy(`另有 ${hiddenSatelliteCount} 顆候選衛星，完整資料見下方明細。`, `${hiddenSatelliteCount} more candidate satellites are available in the detailed evidence below.`)}
        </p>
      )}
    </section>
  );
}

interface CandidateComparisonRow {
  readonly key: CandidateLinkKey;
  readonly opportunity: CandidateOpportunity;
  readonly state: CandidateDecisionState | null;
}

function hiddenComparisonRows(plan: CandidatePresentationPlan): readonly CandidateComparisonRow[] {
  const visible = new Set(
    plan.displayedLinks.filter(link => link.isCandidate).map(link => candidateLinkKeyString(link.key)),
  );
  const states = new Map(
    plan.decision.states.map(state => [candidateLinkKeyString(state.key), state] as const),
  );
  return plan.decision.opportunities
    .filter(opportunity => (
      (plan.decision.serving === null || !sameCandidateLinkKey(opportunity.key, plan.decision.serving))
      && !visible.has(candidateLinkKeyString(opportunity.key))
    ))
    .map(opportunity => Object.freeze({
      key: opportunity.key,
      opportunity,
      state: states.get(candidateLinkKeyString(opportunity.key)) ?? null,
    }));
}

function comparisonRole(
  plan: CandidatePresentationPlan,
  opportunity: CandidateOpportunity,
  state: CandidateDecisionState | null,
): CandidatePresentationRole {
  if (plan.decision.selectedTarget !== null && sameCandidateLinkKey(plan.decision.selectedTarget, opportunity.key)) {
    return 'selected-target';
  }
  if (plan.decision.provisionalLeader !== null && sameCandidateLinkKey(plan.decision.provisionalLeader, opportunity.key)) {
    return 'provisional-leader';
  }
  if (state?.hardEligibility === 'eligible' && state.triggerStatus === 'satisfied') return 'qualified';
  if (state?.hardEligibility === 'eligible') return 'hard-eligible';
  return 'observed';
}

interface CandidateComparisonIdentity {
  readonly satellite: HandoverSatelliteVisualIdentity | null;
  readonly beam: HandoverBeamVisualIdentity | null;
}

function comparisonIdentity(
  plan: CandidatePresentationPlan,
  key: CandidateLinkKey,
): CandidateComparisonIdentity {
  const displayedLink = plan.displayedLinks.find(link => sameCandidateLinkKey(link.key, key));
  const satellite = displayedLink?.satelliteIdentity
    ?? plan.identityAllocation.identitiesBySatelliteId[key.satelliteId]
    ?? plan.identityAllocation.assignments[key.satelliteId]
    ?? null;
  const beam = displayedLink?.beamIdentity
    ?? plan.identityAllocation.beamAssignmentsBySatelliteId[key.satelliteId]?.[String(key.beamId)]
    ?? plan.identityAllocation.beamIdentitiesBySatelliteId[key.satelliteId]?.[String(key.beamId)]
    ?? null;
  return { satellite, beam };
}

function comparisonDisplayKey(plan: CandidatePresentationPlan, opportunity: CandidateOpportunity): string {
  return plan.displayedLinks.find(link => sameCandidateLinkKey(link.key, opportunity.key))?.displayKey
    ?? formatCandidateDisplayKey({
      key: opportunity.key,
      beamIdentitySource: opportunity.beamIdentitySource,
    });
}

function CandidateOverflowTable({
  plan,
  rows,
  pinnedKey,
  onTogglePin,
  copy,
  showForecastEe,
}: {
  readonly plan: CandidatePresentationPlan;
  readonly rows: readonly CandidateComparisonRow[];
  readonly pinnedKey: CandidateLinkKey | null;
  readonly onTogglePin: (key: CandidateLinkKey) => void;
  readonly copy: Copy;
  readonly showForecastEe: boolean;
}) {
  const instructionId = useId();
  const comparisonMetric = rows.length === 0
    ? copy('換手判定 SINR', 'Handover-decision SINR')
    : compatibilityMetricLabel(rows[0].opportunity, copy);
  return (
    <div className="leo-handover-candidate-set__overflow-content">
      <p id={instructionId} className="leo-handover-candidate-set__overflow-description">
        {copy('選取任一列會將該候選釘選到主比較區。', 'Selecting a row pins that candidate into the main comparison.')}
      </p>
      <table
        className="leo-handover-candidate-set__overflow-table"
        data-testid="handover-overflow-comparison"
        data-forecast-ee={showForecastEe ? 'true' : 'false'}
        aria-describedby={instructionId}
        aria-label={copy('其餘候選同幀比較', 'Same-frame comparison of remaining candidates')}
      >
        <caption>{copy('其餘候選同幀比較', 'Same-frame comparison of remaining candidates')}</caption>
        <thead>
          <tr>
            <th scope="col">{copy('候選衛星／波束', 'Candidate satellite/beam')}</th>
            <th scope="col">{comparisonMetric}</th>
            <th scope="col">{copy('轉向角', 'Steering')}</th>
            <th scope="col">{copy('獨立 TTT', 'Independent TTT')}</th>
            {showForecastEe && <th scope="col">{copy('預測 EE', 'Forecast EE')}</th>}
            <th scope="col">{copy('失敗／不可用理由', 'Failed/unavailable reason')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const identity = comparisonIdentity(plan, row.key);
            const role = comparisonRole(plan, row.opportunity, row.state);
            const status = roleLabel(role, row.state, copy);
            const displayKey = comparisonDisplayKey(plan, row.opportunity);
            const compatibilityValue = formatEvidence(row.opportunity.sinr, 1, copy);
            const reason = candidateReason(row.opportunity, row.state, showForecastEe, copy);
            const pinned = pinnedKey !== null && sameCandidateLinkKey(pinnedKey, row.key);
            const color = identity.beam?.cssColor ?? identity.satellite?.cssColor;
            const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onTogglePin(row.key);
            };
            return (
              <tr
                key={candidateLinkKeyString(row.key)}
                tabIndex={0}
                role="button"
                aria-pressed={pinned}
                aria-label={`${displayKey}, ${status}, ${compatibilityMetricLabel(row.opportunity, copy)}: ${compatibilityValue}; ${reason}. ${copy('選取以釘選到主比較區。', 'Select to pin into the main comparison.')}`}
                className="leo-handover-candidate-set__overflow-row"
                data-active-data-link="false"
                data-satellite-id={row.key.satelliteId}
                data-beam-id={row.key.beamId}
                data-pair-key={candidateLinkKeyString(row.key)}
                data-source-frame-id={plan.decision.sourceFrameId}
                data-role={role}
                data-pinned={pinned ? 'true' : 'false'}
                data-identity-allocated={identity.satellite !== null ? 'true' : 'false'}
                data-pattern={identity.beam?.pattern ?? identity.satellite?.pattern}
                style={color === undefined ? undefined : { '--leo-handover-link-color': color } as CSSProperties}
                onClick={() => onTogglePin(row.key)}
                onKeyDown={handleKeyDown}
              >
                <th scope="row">
                  <span className="leo-handover-candidate-set__overflow-identity">
                    <span aria-hidden="true">{identity.beam?.glyph ?? identity.satellite?.glyph ?? '○'}</span>
                    <span>
                      <strong>{displayKey}</strong>
                      <span>{formatSatelliteLabel(row.key.satelliteId)}</span>
                    </span>
                  </span>
                  <span className="leo-handover-candidate-set__overflow-status">{status}</span>
                </th>
                <td data-metric-label={compatibilityMetricLabel(row.opportunity, copy)}><strong>{compatibilityValue}</strong></td>
                <td><strong>{formatEvidence(row.opportunity.steering, 1, copy)}</strong></td>
                <td><strong>{tttLabel(row.state, copy)}</strong></td>
                {showForecastEe && <td><strong>{forecastSummary(row.opportunity.forecastEe, copy)}</strong></td>}
                <td><span>{reason}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CandidateSetPanel({ plan, pinnedKey, onTogglePin, copy }: CandidateSetPanelProps) {
  const titleId = useId();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRows = hiddenComparisonRows(plan);
  const showForecastEe = plan.decision.mode === 'ee-optimization';
  const displayedCandidateSatelliteCount = plan.groups.filter(group => (
    !group.isServingSatellite && group.links.some(link => link.isCandidate)
  )).length;
  const candidateGroupOrdinalBySatelliteId = new Map<string, number>();
  let candidateGroupOrdinal = 0;
  for (const group of plan.groups) {
    if (!group.isServingSatellite && group.links.some(link => link.isCandidate)) {
      candidateGroupOrdinal += 1;
      candidateGroupOrdinalBySatelliteId.set(group.satelliteId, candidateGroupOrdinal);
    }
  }
  return (
    <section className="leo-handover-candidate-set" aria-labelledby={titleId}>
      <header className="leo-handover-candidate-set__header">
        <h3 id={titleId}>{copy('候選連線比較', 'Candidate-link comparison')}</h3>
        <span className="leo-handover-candidate-set__summary">
          <strong>
            {copy(
              `候選衛星 ${displayedCandidateSatelliteCount} / ${plan.scientificCandidateSatelliteGroupCount} 顆`,
              `${displayedCandidateSatelliteCount} / ${plan.scientificCandidateSatelliteGroupCount} candidate satellites`,
            )}
          </strong>
          <small>
            {copy(
              `波束量測 ${plan.displayedCandidatePairCount} / ${plan.scientificCandidatePairCount} 組 · 顯示 ${plan.displayedCandidatePairCount} / ${plan.scientificCandidatePairCount}`,
              `${plan.displayedCandidatePairCount} / ${plan.scientificCandidatePairCount} beam measurements shown`,
            )}
          </small>
        </span>
      </header>
      <details className="leo-handover-candidate-set__context">
        <summary>{copy('識別與畫面對照', 'Scene and identity mapping')}</summary>
        <div>
          <p className="leo-handover-candidate-set__legend" data-testid="handover-candidate-identity-legend">
            {copy(
              '色彩代表衛星；同一色彩內的深淺代表不同波束。中央畫面與此清單使用同一組識別。',
              'Colour identifies the satellite; shades within it identify beams. The centre scene and this list use the same identities.',
            )}
          </p>
          <p
            className="leo-handover-candidate-set__scene-join"
            data-testid="candidate-scene-join-summary"
            data-source-frame-id={plan.decision.sourceFrameId}
            data-scene-join-contract="same-accepted-snapshot"
          >
            {copy(
              '中央畫面保留服務鏈路，並以每顆候選衛星一條測量連線呈現；本清單列出同一來源幀的波束比較。',
              'The centre keeps the serving link and one measured link per candidate satellite; this list compares beams from the same source frame.',
            )}
          </p>
        </div>
      </details>

      <CandidateComparisonBoard
        plan={plan}
        pinnedKey={pinnedKey}
        onTogglePin={onTogglePin}
        copy={copy}
      />

      <details className="leo-handover-candidate-set__detail-groups">
        <summary>{copy('完整波束明細', 'Detailed beam evidence')}</summary>
        <div className="leo-handover-candidate-set__groups">
        {plan.groups.map(group => {
          const candidates = group.links.filter(link => link.isCandidate);
          const observedBeamIds = group.beamRoster
            .filter(entry => entry.observed)
            .map(entry => `B${entry.beamId}`);
          const beamRosterSummary = observedBeamIds.length > 0
            ? observedBeamIds.join('／')
            : copy('無', 'none');
          const candidateOrdinal = candidateGroupOrdinalBySatelliteId.get(group.satelliteId);
          // Keep the serving group's complete beam roster available even when
          // this frame has no same-satellite candidate pair.  The roster is a
          // truthful configured-slot status view (unobserved slots stay
          // explicit), while candidate rows below remain reserved for
          // alternate links.
          // The complete roster is progressively disclosed so the rows that
          // actually compare candidate links stay in the first viewport.
          if (candidates.length === 0 && !group.isServingSatellite) return null;
          return (
            <section
              key={group.joinKey}
              className="leo-handover-satellite-group"
              data-scene-join-key={group.joinKey}
              data-satellite-color={group.satelliteIdentity.cssColor}
              data-satellite-id={group.satelliteId}
              style={{ '--leo-handover-satellite-color': group.satelliteIdentity.cssColor } as CSSProperties}
            >
              <header>
                <span
                  className="leo-handover-satellite-group__swatch"
                  aria-hidden="true"
                  style={{ backgroundColor: group.satelliteIdentity.cssColor }}
                />
                <span aria-hidden="true">{group.satelliteIdentity.glyph}</span>
                <strong>{formatSatelliteLabel(group.satelliteId)}</strong>
                {candidateOrdinal !== undefined && (
                  <small className="leo-handover-satellite-group__ordinal">
                    {copy(`候選 ${candidateOrdinal}`, `Candidate ${candidateOrdinal}`)}
                  </small>
                )}
                <small>
                  {plan.decision.serving === null
                    ? copy('初始連線候選', 'Initial-link candidate')
                    : group.isServingSatellite
                      ? candidates.length > 0
                        ? copy('同衛星波束候選', 'Same-satellite beam candidate')
                        : copy('目前服務衛星／波束狀態', 'Serving satellite / beam status')
                      : copy('跨衛星候選', 'Inter-satellite candidate')}
                </small>
              </header>
              <details className="leo-handover-satellite-group__roster">
                <summary className="leo-handover-satellite-group__roster-summary">
                  <span>{copy('波束狀態', 'Beam status')}</span>
                  <small>
                    {copy(
                      `${group.beamRoster.length} 個設定波束 · 已量測 ${beamRosterSummary}`,
                      `${group.beamRoster.length} configured beams · measured ${beamRosterSummary}`,
                    )}
                  </small>
                </summary>
                <div
                  className="leo-handover-satellite-group__beam-roster"
                  data-beam-roster-count={group.beamRoster.length}
                  aria-label={copy(`${group.beamRoster.length} 個設定波束的同幀狀態`, `${group.beamRoster.length} configured beams, same-frame status`)}
                >
                  {group.beamRoster.map(entry => {
                    const label = beamRosterStatusLabel(entry.status, entry.observed, entry.displayed, copy);
                    const color = entry.link?.beamIdentity?.cssColor ?? group.satelliteIdentity.cssColor;
                    const content = (
                      <>
                        <strong>B{entry.beamId}</strong>
                        <small>{label}</small>
                      </>
                    );
                    return entry.link === null
                      ? (
                        <span
                          key={`${group.joinKey}/beam/${entry.beamId}`}
                          className="leo-handover-beam-roster__item"
                          data-beam-id={entry.beamId}
                          data-status={entry.status}
                          data-observed={entry.observed ? 'true' : 'false'}
                          data-displayed={entry.displayed ? 'true' : 'false'}
                          style={{ '--leo-handover-beam-color': color } as CSSProperties}
                        >
                          {content}
                        </span>
                      )
                      : (
                        <button
                          key={`${group.joinKey}/beam/${entry.beamId}`}
                          type="button"
                          className="leo-handover-beam-roster__item"
                          data-beam-id={entry.beamId}
                          data-status={entry.status}
                          data-observed={entry.observed ? 'true' : 'false'}
                          data-displayed={entry.displayed ? 'true' : 'false'}
                          data-pair-key={candidateLinkKeyString(entry.link.key)}
                          data-source-frame-id={entry.link.sourceFrameId}
                          data-scene-join-key={entry.link.sceneJoinKey}
                          data-rail-join-key={entry.link.railJoinKey}
                          aria-label={`${entry.link.displayKey}, ${label}`}
                          aria-pressed={pinnedKey !== null && sameCandidateLinkKey(pinnedKey, entry.link.key)}
                          onClick={() => onTogglePin(entry.link!.key)}
                          style={{ '--leo-handover-beam-color': color } as CSSProperties}
                        >
                          {content}
                        </button>
                      );
                  })}
                </div>
              </details>
      <div className="leo-handover-satellite-group__links">
                {candidates.map(link => (
                  <CandidateRow
                    key={link.joinKey}
                    link={link}
                    pinned={pinnedKey !== null && sameCandidateLinkKey(pinnedKey, link.key)}
                    onTogglePin={onTogglePin}
                    copy={copy}
                    showForecastEe={showForecastEe}
                  />
                ))}
              </div>
              {group.hiddenCandidatePairCount > 0 && (
                <small className="leo-handover-satellite-group__overflow">
                  {copy(`另有 ${group.hiddenCandidatePairCount} 組波束量測`, `${group.hiddenCandidatePairCount} more measured beam pair(s)`)}
                </small>
              )}
            </section>
          );
        })}
        </div>
      </details>

      {plan.scientificCandidatePairCount === 0 && (
        <p className="leo-handover-candidate-set__empty">
          {copy('此時刻沒有符合幾何可達條件的替代連線。', 'No alternate link is geometrically reachable at this instant.')}
        </p>
      )}

      {overflowRows.length > 0 && (
        <details
          className="leo-handover-candidate-set__overflow"
          open={overflowOpen}
          onToggle={event => setOverflowOpen(event.currentTarget.open)}
        >
          <summary>{copy(`展開其餘 ${overflowRows.length} 組候選`, `Expand ${overflowRows.length} more candidates`)}</summary>
          {overflowOpen && (
            <CandidateOverflowTable
              plan={plan}
              rows={overflowRows}
              pinnedKey={pinnedKey}
              onTogglePin={onTogglePin}
              copy={copy}
              showForecastEe={showForecastEe}
            />
          )}
        </details>
      )}
    </section>
  );
}
