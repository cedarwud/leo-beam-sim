import { useId, type CSSProperties } from 'react';

import {
  candidateLinkKeyString,
  sameCandidateLinkKey,
  type CandidateDecisionState,
  type CandidateLinkKey,
  type ForecastEeEvidence,
  type GateCode,
  type MetricEvidence,
} from '../../engine/handover/candidateDecisionContract';
import type {
  CandidatePresentationLink,
  CandidatePresentationPlan,
  CandidatePresentationRole,
} from '../../engine/handover/candidatePresentationPlan';

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

function beamLabel(link: CandidatePresentationLink, copy: Copy): string {
  return link.opportunity?.beamIdentitySource === 'walker-cell-surrogate'
    ? copy(`Walker 模型波束 B${link.beamId}`, `Walker beam surrogate B${link.beamId}`)
    : copy(`波束 B${link.beamId}`, `Beam B${link.beamId}`);
}

function roleLabel(role: CandidatePresentationRole, state: CandidateDecisionState | null, copy: Copy): string {
  switch (role) {
    case 'serving': return copy('目前服務', 'Serving');
    case 'committed-serving': return copy('已接手服務', 'Committed serving');
    case 'selected-target': return copy('選定目標', 'Selected target');
    case 'provisional-leader': return copy('暫列第一', 'Provisional leader');
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

function rejectionLabel(state: CandidateDecisionState | null, copy: Copy): string | null {
  const code = state?.rejectionCodes[0];
  if (code === undefined) return null;
  const [zh, en] = GATE_LABELS[code];
  return copy(`主要未成立條件：${zh}`, `Primary unmet condition: ${en}`);
}

function relationLabel(
  serving: CandidateLinkKey | null,
  target: CandidateLinkKey,
  copy: Copy,
): string {
  if (serving === null) return copy('初始連線候選', 'Initial-link candidate');
  return serving.satelliteId === target.satelliteId
    ? copy('同衛星波束候選', 'Same-satellite beam candidate')
    : copy('跨衛星候選', 'Inter-satellite candidate');
}

function tttLabel(state: CandidateDecisionState | null, copy: Copy): string {
  if (state === null) return '—';
  if (state.requiredTttSec <= 0) return copy('不需等待', 'No wait required');
  const elapsed = Math.min(state.qualificationSec, state.requiredTttSec);
  return `${formatNumber(elapsed, 1)} / ${formatNumber(state.requiredTttSec, 1)} s`;
}

function CandidateDetails({ link, copy }: { readonly link: CandidatePresentationLink; readonly copy: Copy }) {
  const opportunity = link.opportunity;
  if (opportunity === null) {
    return <p className="leo-handover-candidate__missing">{copy('本畫面尚無同幀量測資料', 'No same-frame measurement is available')}</p>;
  }
  const ee = opportunity.forecastEe;
  const provenance = ee?.provenance;
  const relativeDelta = ee?.relativeDelta === null || ee?.relativeDelta === undefined
    ? '—'
    : `${formatNumber(ee.relativeDelta * 100, 2)} %`;
  return (
    <div className="leo-handover-candidate__details" data-testid="handover-candidate-details">
      <dl>
        <div><dt>SINR</dt><dd>{formatMetric(opportunity.sinr, 2)}</dd></div>
        <div><dt>{copy('仰角', 'Elevation')}</dt><dd>{formatMetric(opportunity.elevation, 1)}</dd></div>
        <div><dt>{copy('轉向角', 'Steering')}</dt><dd>{formatMetric(opportunity.steering, 1)}</dd></div>
        <div><dt>{copy('距離', 'Range')}</dt><dd>{formatMetric(opportunity.range, 0)}</dd></div>
        <div><dt>{copy('預測吞吐量', 'Predicted throughput')}</dt><dd>{formatEvidence(opportunity.predictedThroughput, 0, copy)}</dd></div>
        <div><dt>{copy('預估剩餘服務時間', 'Estimated remaining service time')}</dt><dd>{formatEvidence(opportunity.remainingServiceTime, 1, copy)}</dd></div>
        <div><dt>{copy('預測 EE', 'Forecast EE')}</dt><dd>{forecastAvailability(ee, copy)}</dd></div>
        <div><dt>{copy('共同預測時域 H', 'Common forecast horizon H')}</dt><dd>{formatOptionalValue(ee?.horizonSec, 's', 1)}</dd></div>
        <div><dt>{copy('預測傳輸資料量', 'Forecast delivered data')}</dt><dd>{formatOptionalValue(ee?.deliveredBits, 'bit', 0)}</dd></div>
        <div><dt>{copy('預測耗能', 'Forecast energy')}</dt><dd>{formatOptionalValue(ee?.consumedJoules, 'J', 2)}</dd></div>
        <div><dt>{copy('維持目前連線基準', 'Keep-serving baseline')}</dt><dd>{formatOptionalValue(ee?.baselineEeBitPerJ, 'bit/J', 2)}</dd></div>
        <div><dt>{copy('相對基準變化', 'Relative to baseline')}</dt><dd>{relativeDelta}</dd></div>
        <div><dt>{copy('模型版本', 'Model version')}</dt><dd>{ee?.modelVersion ?? '—'}</dd></div>
        <div><dt>{copy('證據來源', 'Evidence source')}</dt><dd>{provenance?.frameIdsOrDigest ?? opportunity.sourceFrameId}</dd></div>
      </dl>
      <div className="leo-handover-candidate__gates" aria-label={copy('候選條件', 'Candidate gates')}>
        {opportunity.gates.map(gate => {
          const [zh, en] = GATE_LABELS[gate.code];
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
  serving,
  copy,
  showForecastEe,
}: {
  readonly link: CandidatePresentationLink;
  readonly pinned: boolean;
  readonly onTogglePin: (key: CandidateLinkKey) => void;
  readonly serving: CandidateLinkKey | null;
  readonly copy: Copy;
  readonly showForecastEe: boolean;
}) {
  const detailsId = useId();
  const state = link.state;
  const rejection = rejectionLabel(state, copy);
  const color = link.beamIdentity?.cssColor ?? link.satelliteIdentity.cssColor;
  return (
    <article
      className="leo-handover-candidate"
      data-role={link.role}
      data-active-data-link="false"
      data-pattern={link.beamIdentity?.pattern ?? link.satelliteIdentity.pattern}
      style={{ '--leo-handover-link-color': color } as CSSProperties}
    >
      <button
        type="button"
        className="leo-handover-candidate__summary"
        aria-expanded={pinned}
        aria-pressed={pinned}
        aria-controls={detailsId}
        aria-label={`${link.satelliteId}, ${beamLabel(link, copy)}, ${roleLabel(link.role, state, copy)}`}
        onClick={() => onTogglePin(link.key)}
      >
        <span className="leo-handover-candidate__glyph" aria-hidden="true">
          {link.beamIdentity?.glyph ?? link.satelliteIdentity.glyph}
        </span>
        <span className="leo-handover-candidate__identity">
          <strong>{beamLabel(link, copy)}</strong>
          <small>{relationLabel(serving, link.key, copy)}</small>
        </span>
        <span className="leo-handover-candidate__status">{roleLabel(link.role, state, copy)}</span>
      </button>
      <div className="leo-handover-candidate__metrics" data-forecast-ee={showForecastEe ? 'true' : 'false'}>
        <span><small>SINR</small><strong>{formatMetric(link.opportunity?.sinr, 1)}</strong></span>
        <span><small>TTT</small><strong>{tttLabel(state, copy)}</strong></span>
        {showForecastEe && (
          <span><small>{copy('預測 EE', 'Forecast EE')}</small><strong>{forecastSummary(link.opportunity?.forecastEe ?? null, copy)}</strong></span>
        )}
      </div>
      {rejection !== null && <p className="leo-handover-candidate__reason">{rejection}</p>}
      <div id={detailsId} hidden={!pinned}>
        {pinned && <CandidateDetails link={link} copy={copy} />}
      </div>
    </article>
  );
}

function hiddenKeys(plan: CandidatePresentationPlan): readonly CandidateLinkKey[] {
  const visible = new Set(
    plan.displayedLinks.filter(link => link.isCandidate).map(link => candidateLinkKeyString(link.key)),
  );
  return plan.scientificCandidateKeys.filter(key => !visible.has(candidateLinkKeyString(key)));
}

export function CandidateSetPanel({ plan, pinnedKey, onTogglePin, copy }: CandidateSetPanelProps) {
  const titleId = useId();
  const hidden = hiddenKeys(plan);
  return (
    <section className="leo-handover-candidate-set" aria-labelledby={titleId}>
      <header className="leo-handover-candidate-set__header">
        <h3 id={titleId}>{copy('候選連線', 'Candidate links')}</h3>
        <span>{plan.scientificCandidatePairCount}</span>
      </header>

      <div className="leo-handover-candidate-set__groups">
        {plan.groups.map(group => {
          const candidates = group.links.filter(link => link.isCandidate);
          if (candidates.length === 0) return null;
          return (
            <section
              key={group.joinKey}
              className="leo-handover-satellite-group"
              data-satellite-id={group.satelliteId}
              style={{ '--leo-handover-satellite-color': group.satelliteIdentity.cssColor } as CSSProperties}
            >
              <header>
                <span aria-hidden="true">{group.satelliteIdentity.glyph}</span>
                <strong>{group.satelliteId}</strong>
                {group.isServingSatellite && <small>{copy('同衛星', 'Same satellite')}</small>}
              </header>
              <div className="leo-handover-satellite-group__links">
                {candidates.map(link => (
                  <CandidateRow
                    key={link.joinKey}
                    link={link}
                    pinned={pinnedKey !== null && sameCandidateLinkKey(pinnedKey, link.key)}
                    onTogglePin={onTogglePin}
                    serving={plan.decision.serving}
                    copy={copy}
                    showForecastEe={plan.decision.mode === 'ee-optimization'}
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

      {plan.scientificCandidatePairCount === 0 && (
        <p className="leo-handover-candidate-set__empty">
          {copy('此時刻沒有符合幾何可達條件的替代連線。', 'No alternate link is geometrically reachable at this instant.')}
        </p>
      )}

      {hidden.length > 0 && (
        <details className="leo-handover-candidate-set__overflow">
          <summary>{copy(`檢視其餘 ${hidden.length} 組`, `Inspect ${hidden.length} more`)}</summary>
          <div>
            {hidden.map(key => {
              const satellite = plan.identityAllocation.identitiesBySatelliteId[key.satelliteId];
              const beam = plan.identityAllocation.beamIdentitiesBySatelliteId[key.satelliteId]?.[String(key.beamId)];
              return (
                <button
                  key={candidateLinkKeyString(key)}
                  type="button"
                  style={{ '--leo-handover-link-color': beam?.cssColor ?? satellite?.cssColor ?? '#94a3b8' } as CSSProperties}
                  onClick={() => onTogglePin(key)}
                >
                  <span aria-hidden="true">{beam?.glyph ?? satellite?.glyph ?? '○'}</span>
                  {key.satelliteId} / {plan.decision.opportunities.some(opportunity => opportunity.beamIdentitySource === 'walker-cell-surrogate')
                    ? copy(`Walker 模型波束 B${key.beamId}`, `Walker beam surrogate B${key.beamId}`)
                    : copy(`波束 B${key.beamId}`, `Beam B${key.beamId}`)}
                </button>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
