import { useState, type ReactElement, type ReactNode } from 'react';
import {
  formatCompactUnit,
  formatDecimal,
  formatEnergyEfficiency as formatEe,
  formatPower,
  formatPowerParts,
  formatRate,
  formatRateParts,
} from '../../visualLab/format/compact';
import type { LocalizedCopy, VisualLabLocale } from '../../visualLab/experiment';
import type { VisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';
import {
  moduleLabel,
  moduleDefinition,
  type VisualLabModuleKey,
} from './visualLabWorkspace';
import type { VisualLabResultFocus } from './visualLabResultFocus';
import type { ComparisonView } from '../../visualLab/comparison';
import { VisualLabComparisonPanel } from '../../visualLab/ui/VisualLabComparisonPanel';
import type { VisualLabBeamDisplayFrame, VisualLabBeamDisplayLane } from './visualLabBeamDisplayFrame';

export interface VisualLabProgressiveResultDockProps {
  readonly locale: VisualLabLocale;
  readonly snapshot: VisualLabCanonicalSnapshot;
  readonly beamFrame: VisualLabBeamDisplayFrame;
  readonly activeModule: VisualLabModuleKey | null;
  readonly onFocus?: (focus: VisualLabResultFocus) => void;
  readonly className?: string;
  readonly comparison?: ComparisonView;
  readonly canSaveBaseline?: boolean;
  readonly interactionLocked?: boolean;
  readonly onSaveBaseline?: () => void;
  readonly onClearBaseline?: () => void;
}

type ResultModuleKey = Exclude<VisualLabModuleKey, 'scene'>;

const DETAIL_MODULES: readonly ResultModuleKey[] = [
  'handover',
  'sinr',
  'power',
  'throughput',
  'ee',
];

const localized = (zhHant: string, en: string): LocalizedCopy => Object.freeze({ 'zh-Hant': zhHant, en });

const COPY = Object.freeze({
  eyebrow: localized('結果', 'Results'),
  title: localized('計算結果', 'Computed results'),
  comparison: localized('服務／候選', 'Serving / candidate'),
  currentLinks: localized('目前鏈路', 'Current links'),
  serving: localized('服務', 'Serving'),
  candidate: localized('候選', 'Candidate'),
  timing: localized('TTT 計時中', 'TTT timing'),
  monitoring: localized('監測中', 'Monitoring'),
  unavailable: localized('資料不可用', 'Data unavailable'),
  safetyMargin: localized('安全門檻', 'Safety margin'),
  ttt: localized('TTT', 'TTT'),
  handoverCount: localized('換手次數', 'Handover count'),
  handoverEvents: localized('次', 'events'),
  progress: localized('TTT 進度', 'TTT progress'),
  candidateAbove: localized('候選高於門檻', 'Candidate above margin'),
  monitoringCandidate: localized('監測候選鏈路', 'Monitoring candidate link'),
  noHandoverData: localized('目前沒有換手判定資料。', 'No handover decision is available.'),
  servingLink: localized('服務鏈路', 'Serving link'),
  candidateLink: localized('候選鏈路', 'Candidate link'),
  deltaSinr: localized('ΔSINR', 'ΔSINR'),
  offAxisAngle: localized('離軸角', 'Off-axis angle'),
  elevation: localized('仰角', 'Elevation'),
  distance: localized('斜距', 'Slant range'),
  transmitGain: localized('Gᵀ(θᵤ,ₛ,ᵥ)', 'Gᵀ(θᵤ,ₛ,ᵥ)'),
  compositeGain: localized('Hᵤ,ₛ,ᵥ(t)', 'Hᵤ,ₛ,ᵥ(t)'),
  signalPower: localized('wanted-link 訊號', 'Wanted-link signal'),
  totalInterference: localized('Iᵤ,ₛ,ᵥ(t, θ)', 'Iᵤ,ₛ,ᵥ(t, θ)'),
  noisePower: localized('σ²', 'σ²'),
  systemPower: localized('Pᴺ(t, θ)', 'Pᴺ(t, θ)'),
  linkRfPower: localized('pᵤ,ₛ,ᵥ(t, θᵤ,ₛ,ᵥ)', 'pᵤ,ₛ,ᵥ(t, θᵤ,ₛ,ᵥ)'),
  linkSupplyPower: localized('Pᵖᵤ,ₛ,ᵥ(t, θᵤ,ₛ,ᵥ)', 'Pᵖᵤ,ₛ,ᵥ(t, θᵤ,ₛ,ᵥ)'),
  linkEfficiency: localized('ξᵤ,ₛ,ᵥ(t, θᵤ,ₛ,ᵥ)', 'ξᵤ,ₛ,ᵥ(t, θᵤ,ₛ,ᵥ)'),
  fixedPower: localized('Pᶠ(t)', 'Pᶠ(t)'),
  totalThroughput: localized('總吞吐量', 'Total throughput'),
  servingRate: localized('代表服務鏈路速率', 'Representative serving-link rate'),
  beamBandwidth: localized('Bʷ', 'Bʷ'),
  linkEe: localized('ηᵤ,ₛ,ᵥ(t, θ)', 'ηᵤ,ₛ,ᵥ(t, θ)'),
  rate: localized('Rᵤ,ₛ,ᵥ(t, θ)', 'Rᵤ,ₛ,ᵥ(t, θ)'),
  currentView: localized('目前檢視', 'Current view'),
  quantity: localized('量測項目', 'Quantity'),
  controlledComparison: localized('A／B 控制比較', 'Controlled A/B comparison'),
  representativeSinr: localized('代表鏈路 SINR', 'Representative-link SINR'),
  systemPowerMetric: localized('系統功率', 'System power'),
  systemThroughput: localized('系統吞吐量', 'System throughput'),
  systemEeMetric: localized('系統 EE', 'System EE'),
  beamConfiguration: localized('波束配置', 'Beam configuration'),
  globalBeams: localized('全域波束', 'Total beams'),
  servingBeams: localized('服務波束', 'Serving beams'),
  candidateBeams: localized('候選波束', 'Candidate beams'),
  activeBeamsSuffix: localized('啟用', 'active'),
} as const);

function text(copy: LocalizedCopy, locale: VisualLabLocale): string {
  return copy[locale];
}

function signedValue(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${formatDecimal(value, digits)}`;
}

function linearGainDb(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—';
  return `${formatDecimal(10 * Math.log10(value), 2)} dB`;
}

function powerDbw(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return value === 0 ? '0 W' : '—';
  return `${formatDecimal(10 * Math.log10(value), 2)} dBW`;
}

function sumFinite(values: readonly (number | null | undefined)[]): number | null {
  const finiteValues = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return finiteValues.length === 0 ? null : finiteValues.reduce((sum, value) => sum + value, 0);
}

function progressPercent(snapshot: VisualLabCanonicalSnapshot): number {
  const { progressSec, tttSec } = snapshot.handover;
  if (progressSec === null || tttSec === null || !Number.isFinite(progressSec) || !Number.isFinite(tttSec) || tttSec <= 0) return 0;
  return Math.min(100, Math.max(0, progressSec / tttSec * 100));
}

function numberOrDash(value: number | null, digits = 2): string {
  return value === null ? '—' : formatDecimal(value, digits);
}

function identityOrDash(value: string | number | null): string {
  return value === null ? '—' : String(value);
}

function beamLaneValue(lane: VisualLabBeamDisplayLane, locale: VisualLabLocale): string {
  const active = `${lane.activeTargetCount} ${text(COPY.activeBeamsSuffix, locale)}`;
  return `${lane.configuredLayoutCount} · ${active}`;
}

function BeamConfigurationSection({ beamFrame, locale }: {
  readonly beamFrame: VisualLabBeamDisplayFrame;
  readonly locale: VisualLabLocale;
}): ReactElement {
  return <details className="vlab-progressive-result-dock__section vlab-progressive-result-dock__beam-configuration" open>
    <summary className="vlab-progressive-result-dock__summary">
      <span className="vlab-progressive-result-dock__summary-name">
        <span className="vlab-progressive-result-dock__marker vlab-progressive-result-dock__marker--sinr" aria-hidden="true">B</span>
        <span>{text(COPY.beamConfiguration, locale)}</span>
      </span>
    </summary>
    <div className="vlab-progressive-result-dock__section-body">
      <dl className="vlab-progressive-result-dock__rows">
        <ResultRow
          label={text(COPY.globalBeams, locale)}
          value={formatCompactUnit(beamFrame.globalBeamCount, locale === 'zh-Hant' ? '波束' : 'beams')}
        />
        <ResultRow label={`${text(COPY.servingBeams, locale)} · ${identityOrDash(beamFrame.serving.satelliteId)}`} value={beamLaneValue(beamFrame.serving, locale)} />
        <ResultRow label={`${text(COPY.candidateBeams, locale)} · ${identityOrDash(beamFrame.candidate.visible ? beamFrame.candidate.satelliteId : null)}`} value={beamLaneValue(beamFrame.candidate, locale)} />
      </dl>
    </div>
  </details>;
}

function focusFor(module: ResultModuleKey): VisualLabResultFocus {
  switch (module) {
    case 'handover':
      return 'handover';
    case 'power':
    case 'ee':
      return 'energy-flow';
    case 'sinr':
    case 'throughput':
      return 'serving-link';
    default:
      return 'serving-link';
  }
}

function ModuleMarker({ module }: { readonly module: VisualLabModuleKey }): ReactElement {
  const definition = moduleDefinition(module);
  return <span className={`vlab-progressive-result-dock__marker vlab-progressive-result-dock__marker--${definition.tone}`} aria-hidden="true">{definition.symbol}</span>;
}

function MetricCard({
  label,
  value,
  unit,
  tone,
  onActivate,
}: {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly tone: string;
  readonly onActivate: () => void;
}): ReactElement {
  return (
    <button type="button" className={`vlab-progressive-result-dock__metric vlab-progressive-result-dock__metric--${tone}`} onClick={onActivate}>
      <span className="vlab-progressive-result-dock__metric-label">{label}</span>
      <strong className="vlab-progressive-result-dock__metric-value">{value}</strong>
      <span className="vlab-progressive-result-dock__metric-unit">{unit}</span>
    </button>
  );
}

function ResultRow({ label, value, tone }: { readonly label: string; readonly value: string; readonly tone?: 'positive' | 'negative' }): ReactElement {
  return (
    <div className="vlab-progressive-result-dock__row">
      <dt>{label}</dt>
      <dd className={tone ? `vlab-value--${tone}` : undefined}>{value}</dd>
    </div>
  );
}

function LinkComparisonTable({ snapshot, locale }: {
  readonly snapshot: VisualLabCanonicalSnapshot;
  readonly locale: VisualLabLocale;
}): ReactElement {
  const rows: readonly [ReactNode, string, string][] = [
    [text(COPY.offAxisAngle, locale), snapshot.serving.offAxisAngleRad == null ? '—' : `${formatDecimal(snapshot.serving.offAxisAngleRad * 180 / Math.PI, 2)}°`, snapshot.candidate.offAxisAngleRad == null ? '—' : `${formatDecimal(snapshot.candidate.offAxisAngleRad * 180 / Math.PI, 2)}°`],
    [text(COPY.elevation, locale), snapshot.serving.elevationDeg == null ? '—' : `${formatDecimal(snapshot.serving.elevationDeg, 2)}°`, snapshot.candidate.elevationDeg == null ? '—' : `${formatDecimal(snapshot.candidate.elevationDeg, 2)}°`],
    [text(COPY.distance, locale), snapshot.serving.distanceKm == null ? '—' : formatCompactUnit(snapshot.serving.distanceKm, 'km'), snapshot.candidate.distanceKm == null ? '—' : formatCompactUnit(snapshot.candidate.distanceKm, 'km')],
    [text(COPY.transmitGain, locale), linearGainDb(snapshot.serving.transmitGainLinear), linearGainDb(snapshot.candidate.transmitGainLinear)],
    [text(COPY.compositeGain, locale), linearGainDb(snapshot.serving.compositeGainLinear), linearGainDb(snapshot.candidate.compositeGainLinear)],
    [text(COPY.signalPower, locale), powerDbw(snapshot.serving.signalW), powerDbw(snapshot.candidate.signalW)],
    [text(COPY.totalInterference, locale), powerDbw(snapshot.serving.interferenceW), powerDbw(snapshot.candidate.interferenceW)],
    [text(COPY.noisePower, locale), powerDbw(snapshot.serving.noiseW), powerDbw(snapshot.candidate.noiseW)],
  ] as const;
  return (
    <table className="vlab-progressive-result-dock__comparison-table">
      <thead>
        <tr><th scope="col">{text(COPY.quantity, locale)}</th><th scope="col">{text(COPY.serving, locale)}</th><th scope="col">{text(COPY.candidate, locale)}</th></tr>
      </thead>
      <tbody>{rows.map(([label, serving, candidate], index) => <tr key={index}><th scope="row">{label}</th><td>{serving}</td><td>{candidate}</td></tr>)}</tbody>
    </table>
  );
}

function SectionSummary({
  module,
  locale,
  summaryValue,
  summaryUnit,
}: {
  readonly module: VisualLabModuleKey;
  readonly locale: VisualLabLocale;
  readonly summaryValue?: string;
  readonly summaryUnit?: string;
}): ReactElement {
  return (
    <summary className="vlab-progressive-result-dock__summary">
      <span className="vlab-progressive-result-dock__summary-name">
        <ModuleMarker module={module} />
        <span>{moduleLabel(module, locale)}</span>
      </span>
      {summaryValue ? <span className="vlab-progressive-result-dock__summary-value">{summaryValue}{summaryUnit ? <small>{summaryUnit}</small> : null}</span> : null}
    </summary>
  );
}

type ResultSectionProps = {
  readonly snapshot: VisualLabCanonicalSnapshot;
  readonly locale: VisualLabLocale;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

function HandoverSection({ snapshot, locale, open, onOpenChange }: ResultSectionProps): ReactElement {
  const progress = progressPercent(snapshot);
  const count = snapshot.handover.cumulativeCount;
  const tttSec = snapshot.handover.tttSec;
  const progressSec = snapshot.handover.progressSec;
  return (
    <details className="vlab-progressive-result-dock__section" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <SectionSummary module="handover" locale={locale} summaryValue={count === null ? '—' : `${count}`} summaryUnit={count === null ? undefined : text(COPY.handoverEvents, locale)} />
      <div className="vlab-progressive-result-dock__section-body">
        <dl className="vlab-progressive-result-dock__rows">
          <ResultRow label={text(COPY.safetyMargin, locale)} value={snapshot.handover.offsetDb === null ? '—' : `${formatDecimal(snapshot.handover.offsetDb, 1)} dB`} />
          <ResultRow label={text(COPY.ttt, locale)} value={tttSec === null ? '—' : `${formatDecimal(tttSec, 0)} s`} />
          <ResultRow label={text(COPY.handoverCount, locale)} value={count === null ? '—' : `${count} ${text(COPY.handoverEvents, locale)}`} />
        </dl>
        {progressSec !== null && tttSec !== null ? <div className="vlab-progressive-result-dock__progress" aria-label={`${text(COPY.progress, locale)} ${formatDecimal(progressSec, 1)} s / ${formatDecimal(tttSec, 0)} s`}>
          <div className="vlab-progressive-result-dock__progress-labels"><span>{snapshot.handover.state === 'pending' ? text(COPY.candidateAbove, locale) : text(COPY.monitoringCandidate, locale)}</span><span>{formatDecimal(progressSec, 1)} / {formatDecimal(tttSec, 0)} s</span></div>
          <progress value={progress} max={100} />
        </div> : <p>{text(COPY.noHandoverData, locale)}</p>}
      </div>
    </details>
  );
}

function SinrSection({ snapshot, locale, open, onOpenChange }: ResultSectionProps): ReactElement {
  return (
    <details className="vlab-progressive-result-dock__section" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <SectionSummary module="sinr" locale={locale} />
      <div className="vlab-progressive-result-dock__section-body">
        <dl className="vlab-progressive-result-dock__rows">
          <ResultRow label={text(COPY.candidateLink, locale)} value={snapshot.candidate.sinrDb === null ? '—' : `${formatDecimal(snapshot.candidate.sinrDb, 2)} dB`} />
          <ResultRow
            label={text(COPY.deltaSinr, locale)}
            value={snapshot.deltaSinrDb === null ? '—' : `${signedValue(snapshot.deltaSinrDb, 2)} dB`}
            tone={snapshot.deltaSinrDb === null ? undefined : snapshot.deltaSinrDb >= 0 ? 'positive' : 'negative'}
          />
        </dl>
        <LinkComparisonTable snapshot={snapshot} locale={locale} />
      </div>
    </details>
  );
}

function PowerSection({ snapshot, locale, open, onOpenChange }: ResultSectionProps): ReactElement {
  const fixedPowerW = sumFinite([
    snapshot.power.servingRfcPowerW,
    snapshot.power.servingBasebandPowerW,
    snapshot.power.servingEventPowerW,
  ]);
  return (
    <details className="vlab-progressive-result-dock__section" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <SectionSummary module="power" locale={locale} />
      <div className="vlab-progressive-result-dock__section-body">
        <dl className="vlab-progressive-result-dock__rows">
          <ResultRow label={text(COPY.systemPower, locale)} value={formatPower(snapshot.power.systemPowerW)} />
          <ResultRow label={text(COPY.linkRfPower, locale)} value={formatPower(snapshot.power.servingActualPowerW)} />
          <ResultRow label={text(COPY.linkSupplyPower, locale)} value={formatPower(snapshot.power.servingPaInputPowerW)} />
          <ResultRow label={text(COPY.linkEfficiency, locale)} value={snapshot.power.servingPaEfficiency == null ? '—' : `${formatDecimal(snapshot.power.servingPaEfficiency * 100, 1)}%`} />
          <ResultRow label={text(COPY.fixedPower, locale)} value={formatPower(fixedPowerW)} />
        </dl>
      </div>
    </details>
  );
}

function ThroughputSection({ snapshot, locale, open, onOpenChange }: ResultSectionProps): ReactElement {
  return (
    <details className="vlab-progressive-result-dock__section" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <SectionSummary module="throughput" locale={locale} />
      <div className="vlab-progressive-result-dock__section-body">
        <dl className="vlab-progressive-result-dock__rows">
          <ResultRow label={text(COPY.systemThroughput, locale)} value={formatRate(snapshot.throughput.totalRateBps)} />
          <ResultRow label={text(COPY.servingRate, locale)} value={formatRate(snapshot.throughput.servingRateBps)} />
          <ResultRow label={text(COPY.beamBandwidth, locale)} value={formatCompactUnit(snapshot.throughput.beamBandwidthHz, 'Hz')} />
        </dl>
      </div>
    </details>
  );
}

function EeSection({ snapshot, locale, open, onOpenChange }: ResultSectionProps): ReactElement {
  return (
    <details className="vlab-progressive-result-dock__section" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <SectionSummary module="ee" locale={locale} />
      <div className="vlab-progressive-result-dock__section-body">
        <dl className="vlab-progressive-result-dock__rows">
          <ResultRow label={text(COPY.linkEe, locale)} value={snapshot.ee.instantaneousBitsPerJ === null ? '—' : formatEe(snapshot.ee.instantaneousBitsPerJ)} />
          <ResultRow label={text(COPY.rate, locale)} value={formatRate(snapshot.throughput.servingRateBps)} />
          <ResultRow label={text(COPY.systemPower, locale)} value={formatPower(snapshot.power.systemPowerW)} />
        </dl>
      </div>
    </details>
  );
}

function ModuleSection({
  module,
  snapshot,
  locale,
  open,
  onOpenChange,
}: {
  readonly module: ResultModuleKey;
  readonly snapshot: VisualLabCanonicalSnapshot;
  readonly locale: VisualLabLocale;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}): ReactElement | null {
  switch (module) {
    case 'handover':
      return <HandoverSection snapshot={snapshot} locale={locale} open={open} onOpenChange={onOpenChange} />;
    case 'sinr':
      return <SinrSection snapshot={snapshot} locale={locale} open={open} onOpenChange={onOpenChange} />;
    case 'power':
      return <PowerSection snapshot={snapshot} locale={locale} open={open} onOpenChange={onOpenChange} />;
    case 'throughput':
      return <ThroughputSection snapshot={snapshot} locale={locale} open={open} onOpenChange={onOpenChange} />;
    case 'ee':
      return <EeSection snapshot={snapshot} locale={locale} open={open} onOpenChange={onOpenChange} />;
    default:
      return null;
  }
}

export function VisualLabProgressiveResultDock({
  locale = 'zh-Hant',
  snapshot,
  beamFrame,
  activeModule,
  onFocus,
  className,
  comparison,
  canSaveBaseline = false,
  interactionLocked = false,
  onSaveBaseline,
  onClearBaseline,
}: VisualLabProgressiveResultDockProps): ReactElement {
  const [expandedModules, setExpandedModules] = useState<readonly ResultModuleKey[]>([]);
  const classNames = ['vlab-progressive-result-dock', className].filter(Boolean).join(' ');
  const setExpanded = (module: ResultModuleKey, open: boolean): void => {
    setExpandedModules((current) => open
      ? current.includes(module) ? current : [...current, module]
      : current.filter((candidate) => candidate !== module));
  };
  const activate = (module: ResultModuleKey): void => {
    setExpanded(module, true);
    onFocus?.(focusFor(module));
  };

  return (
    <aside id="vlab-results" className={classNames} aria-label={text(COPY.title, locale)} aria-disabled={interactionLocked || undefined} inert={interactionLocked || undefined} tabIndex={-1}
      data-beam-frame-id={beamFrame.sourceFrameId ?? undefined}
      data-beam-global-layout-count={beamFrame.globalLayoutCount}
      data-beam-global-count={beamFrame.globalBeamCount}
      data-beam-global-satellite-count={beamFrame.globalSatelliteCount ?? undefined}
      data-beam-serving-layout-count={beamFrame.serving.configuredLayoutCount}
      data-beam-serving-active-count={beamFrame.serving.activeTargetCount}
      data-beam-candidate-layout-count={beamFrame.candidate.configuredLayoutCount}
      data-beam-candidate-active-count={beamFrame.candidate.activeTargetCount}
      data-beam-illumination-mode={beamFrame.illuminationMode}
    >
      <section className="vlab-progressive-result-dock__comparison" aria-label={text(COPY.comparison, locale)}>
        <div className="vlab-progressive-result-dock__identities">
          <button className="vlab-identity-chip vlab-identity-chip--serving" type="button" onClick={() => onFocus?.('serving-link')}>
            <span>{text(COPY.serving, locale)}</span><strong>{identityOrDash(snapshot.serving.satelliteId)}</strong>
          </button>
          <button className="vlab-identity-chip vlab-identity-chip--candidate" type="button" onClick={() => onFocus?.('candidate-link')}>
            <span>{text(COPY.candidate, locale)}</span><strong>{identityOrDash(beamFrame.candidate.visible ? snapshot.candidate.satelliteId : null)}</strong>
          </button>
        </div>
        <div className="vlab-progressive-result-dock__metrics">
          <MetricCard label={text(COPY.representativeSinr, locale)} value={numberOrDash(snapshot.serving.sinrDb, 1)} unit={snapshot.serving.sinrDb === null ? '' : 'dB'} tone="sinr" onActivate={() => activate('sinr')} />
          <MetricCard label={text(COPY.systemPowerMetric, locale)} value={formatPowerParts(snapshot.power.systemPowerW)?.value ?? '—'} unit={formatPowerParts(snapshot.power.systemPowerW)?.unit ?? ''} tone="power" onActivate={() => activate('power')} />
          <MetricCard label={text(COPY.systemThroughput, locale)} value={formatRateParts(snapshot.throughput.totalRateBps)?.value ?? '—'} unit={formatRateParts(snapshot.throughput.totalRateBps)?.unit ?? ''} tone="throughput" onActivate={() => activate('throughput')} />
          <MetricCard label={text(COPY.systemEeMetric, locale)} value={snapshot.ee.instantaneousBitsPerJ === null ? '—' : formatEe(snapshot.ee.instantaneousBitsPerJ)} unit="" tone="ee" onActivate={() => activate('ee')} />
        </div>
      </section>

      <div className="vlab-progressive-result-dock__sections">
        <BeamConfigurationSection beamFrame={beamFrame} locale={locale} />
        {DETAIL_MODULES.map((module) => (
          <ModuleSection
            key={module}
            module={module}
            snapshot={snapshot}
            locale={locale}
            open={expandedModules.includes(module)}
            onOpenChange={(open) => setExpanded(module, open)}
          />
        ))}
        {comparison !== undefined && onSaveBaseline !== undefined && onClearBaseline !== undefined ? (
          <details className="vlab-progressive-result-dock__section vlab-progressive-result-dock__comparison-section">
            <summary className="vlab-progressive-result-dock__summary">
              <span className="vlab-progressive-result-dock__summary-name">
                <span className="vlab-progressive-result-dock__marker vlab-progressive-result-dock__marker--energy" aria-hidden="true">A/B</span>
                <span>{text(COPY.controlledComparison, locale)}</span>
              </span>
            </summary>
            <VisualLabComparisonPanel
              comparison={comparison}
              locale={locale}
              canSaveBaseline={canSaveBaseline}
              onSaveBaseline={onSaveBaseline}
              onClearBaseline={onClearBaseline}
            />
          </details>
        ) : null}
      </div>

      {activeModule ? <span className="vlab-visually-hidden" aria-live="polite">{text(COPY.currentView, locale)}：{moduleLabel(activeModule, locale)}</span> : null}
    </aside>
  );
}
