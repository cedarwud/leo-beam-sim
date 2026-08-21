import type { ReactNode } from 'react';
import type { SimulationAnalysisFrame, SimulatorTab } from '../../simulator/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { renderFormulaText } from './FormulaHeader';
import {
  formatCompactNumber,
  formatEnergyEfficiency,
  formatFrequency,
  formatPower,
  formatRate,
} from './formatters';
import { txBi } from './labels';
import { SystemAngleState } from './FormulaSymbols';
import {
  captionTextStyle,
  groupTitleStyle,
  pagePanelStyle,
} from './styles';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const SINR_ACCENT = UI_TOKENS.color.semantic.tuning;
const EE_ACCENT = UI_TOKENS.color.semantic.warning.accent;
const POWER_ACCENT = UI_TOKENS.color.semantic.good;
const THROUGHPUT_ACCENT = UI_TOKENS.color.semantic.info;

function firstActiveBeam(frame: SimulationAnalysisFrame): number {
  const index = frame.inputs.frame.beamActiveB.findIndex(active => active);
  return index >= 0 ? index : 0;
}

function representativeUserIndex(frame: SimulationAnalysisFrame): number {
  const userId = frame.links[0]?.userId ?? '';
  const match = /^ue-(\d+)$/.exec(userId);
  if (match === null) return 0;
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 && index < frame.throughput.rateUBps.length ? index : 0;
}

function CanonicalReadout({
  testId,
  label,
  value,
  note,
  accent,
}: {
  readonly testId: string;
  readonly label: ReactNode;
  readonly value: string;
  readonly note?: string;
  readonly accent: string;
}) {
  return (
    <div
      data-testid={testId}
      data-readonly="true"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(88px, auto) 1fr',
        gap: 8,
        alignItems: 'baseline',
        padding: '9px 10px',
        borderRadius: UI_TOKENS.radius.md,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <span style={{ ...captionTextStyle, color: UI_TOKENS.color.text.primary }}>{label}</span>
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <strong style={{ color: accent, overflowWrap: 'anywhere' }}>{value}</strong>
        {note === undefined || note.length === 0 ? null : <small style={captionTextStyle}>{renderFormulaText(note)}</small>}
      </span>
    </div>
  );
}

function formatLinearGain(value: number | null | undefined, unit: 'dB' | 'dBi'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(10 * Math.log10(Math.max(value, 1e-30))).toFixed(1)} ${unit}`;
}

function SinrProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const link = frame.links[0]!;
  const userIndex = representativeUserIndex(frame);
  const beam = link.beamId;
  const derived = frame.scenario.derived;
  const reuseColor = frame.inputs.frame.beamColorB[beam];
  // The canonical producer keeps reuse colours zero-based because the value is
  // used as an array/indexing key in the interference calculation.  The rail is
  // a user-facing group label, so display the corresponding one-based group
  // without changing the calculation input.
  const reuseGroup = reuseColor === undefined ? undefined : reuseColor + 1;
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  return (
    <section
      data-testid="homepage-sinr-results"
      role="tabpanel"
      aria-label={say('panel.sinr.result.aria', 'SINR', 'SINR')}
      style={pagePanelStyle}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="sinr-result-signal" label={say('sinr.result.signal.label', '接收訊號功率', 'Received signal power')} value={formatPower(link.signalW)} note={say('sinr.result.signal.note', 'p、H 與 Gᵀ 的乘積', 'Product of p, H, and Gᵀ')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-off-axis-angle" label={<>θ</>} value={formatCompactNumber(link.offAxisAngleRad, 'rad', 4)} note={say('homepage.param.theta', '服務鏈路的離軸角', 'Off-axis angle of the serving link')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-distance" label={say('homepage.param.distance.label', '斜距', 'Slant range')} value={formatCompactNumber(link.distanceKm, 'km', 4)} note={say('homepage.param.distance', '衛星至使用者的鏈路斜距', 'Satellite-to-user slant range')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-elevation" label={say('homepage.param.elevation.label', '仰角', 'Elevation')} value={formatCompactNumber(link.elevationDeg, '°', 4)} note={say('homepage.param.elevation', '衛星仰角', 'Satellite elevation')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-channel-gain" label={<>H<sub>u,s,v</sub>(t)</>} value={formatLinearGain(frame.inputs.frame.propagationGainUb[userIndex]?.[beam], 'dB')} note={say('homepage.param.propagation', '非角度相關的有效通道因子', 'Non-angle effective-channel factor')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-beam-gain" label={<>G<sup>T</sup>(θ<sub>u,s,v</sub>)</>} value={formatLinearGain(frame.canonical.transmitGainUb[userIndex]?.[beam], 'dBi')} note={say('homepage.sinr.gt.result', '由鏈路離軸角得到的發射增益', 'Transmit gain for the link off-axis angle')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-interference" label={<>I<sub>u,s,v</sub>(t, <SystemAngleState />)</>} value={formatPower(link.interferenceW)} note={say('sinr.result.interference.note', 'SINR 分母使用的總同頻干擾', 'Total co-channel interference used by the SINR denominator')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-reuse-color" label={say('homepage.sinr.interference.color', '重用群組', 'Reuse group')} value={String(reuseGroup ?? '—')} note={say('homepage.sinr.interference.color.note', '服務波束的頻率重用群組', 'Frequency-reuse group of the serving beam')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-beam-bandwidth" label={<>B<sup>w</sup></>} value={formatFrequency(derived.beamBandwidthHz)} note={say('homepage.sinr.frequencyReuse.bbeam', '單一波束頻寬', 'Bandwidth of one beam')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-noise" label={<>σ²</>} value={formatPower(link.noiseW)} note={say('sinr.result.noise.note', 'SINR 分母中的雜訊功率', 'Noise power in the SINR denominator')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-value" label="SINR" value={formatCompactNumber(link.sinrDb, 'dB', 3)} note="" accent={SINR_ACCENT} />
      </div>
    </section>
  );
}

function EeProjection({ analysis }: { readonly analysis: HomepageCanonicalAnalysisState }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const frame = analysis.frame!;
  const representativeLink = frame.links[0]!;
  return (
    <section
      data-testid="homepage-ee-results"
      role="tabpanel"
      aria-label={say('panel.ee.result.aria', 'EE 計算結果', 'EE calculation results')}
      style={pagePanelStyle}
    >
      <div style={{ ...groupTitleStyle, color: EE_ACCENT }}>
        {say('panel.ee.result.title', 'EE', 'EE')}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="ee-result-throughput" label={<>R<sub>u,s,v</sub>(t, <SystemAngleState />)</>} value={formatRate(representativeLink.rateBps)} note={say('ee.result.throughput.note', '代表服務鏈路的速率', 'Rate of the representative serving link')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-system-power" label={<>P<sup>N</sup>(t, <SystemAngleState />)</>} value={formatPower(frame.power.systemPowerW)} note={say('ee.result.power.note', '系統總功率', 'System total power')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-evaluation" label={<>η<sub>u,s,v</sub>(t, <SystemAngleState />)</>} value={formatEnergyEfficiency(representativeLink.instantaneousEeBitsPerJ ?? frame.ee.instantaneousBitsPerJ)} note={say('ee.result.link.note', '代表服務鏈路的實際 EE', 'Realized EE of the representative serving link')} accent={EE_ACCENT} />
      </div>
      <p style={captionTextStyle}>
        {say(
          'panel.ee.result.interpretation',
          'η 表示速率與系統總功率的關係；右側值和其他結果都來自同一 accepted frame。',
          'η relates rate to system total power; the value and the other results come from the same accepted frame.',
        )}
      </p>
    </section>
  );
}

function PowerProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const beam = firstActiveBeam(frame);
  const power = frame.power;
  const value = (values: readonly number[]): number => values[beam] ?? 0;
  return (
    <section
      data-testid="homepage-power-results"
      role="tabpanel"
      aria-label={say('panel.power.result.aria', '功率', 'Power')}
      style={pagePanelStyle}
    >
      <div style={{ ...groupTitleStyle, color: POWER_ACCENT }}>
        {say('panel.power.result.title', '功率計算結果', 'Power results')}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="power-result-requested" label={<>p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>} value={formatPower(value(power.pDlActualBW))} note={say('power.result.link.note', '單一鏈路實際 RF 功率', 'Actual RF power of the representative link')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-pa" label={<>P<sup>p</sup><sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>} value={formatPower(value(power.pPaBW))} note={say('power.result.pa.note', '由 p 與 ξ 得到的 PA 輸入功率', 'PA input power from p and ξ')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-pa-efficiency" label={<>ξ<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>} value={formatCompactNumber(value(power.paEfficiencyB), isEnglish ? 'dimensionless' : '無因次', 4)} note={say('power.result.eta.note', '鏈路功率模型中的效率因子', 'Efficiency factor in the link power model')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-fixed" label={<>P<sup>f</sup>(t)</>} value={formatPower(value(power.pRfcBW) + value(power.pBbBW) + value(power.pEventBW))} note={say('power.result.fixed.note', '固定功率組成', 'Fixed-power components')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-system" label={<>P<sup>N</sup>(t, <SystemAngleState />)</>} value={formatPower(power.systemPowerW)} note={say('power.result.system.note', 'EE 使用的系統總功率', 'System total power used by EE')} accent={POWER_ACCENT} />
      </div>
      <p style={captionTextStyle}>{say('panel.power.result.interpretation', 'P^N 是整個系統的值；p、P^p 與 ξ 是代表鏈路的值。', 'P^N is the system value; p, P^p, and ξ are representative-link values.')}</p>
    </section>
  );
}

function ThroughputProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const representativeLink = frame.links[0]!;
  const sinrLinear = representativeLink.sinrLinear;
  const sinrDb = 10 * Math.log10(Math.max(sinrLinear, 1e-30));
  const rate = representativeLink.rateBps;
  const totalRate = frame.throughput.totalRateBps;
  const servingBeamLoad = frame.scenario.beamLoadB[representativeLink.beamId] ?? 0;
  return (
    <section
      data-testid="homepage-throughput-results"
      role="tabpanel"
      aria-label={say('panel.throughput.result.aria', '吞吐量', 'Throughput')}
      style={pagePanelStyle}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="throughput-result-beam-bandwidth" label={<>B<sup>w</sup></>} value={formatFrequency(frame.scenario.derived.beamBandwidthHz)} note={say('throughput.result.beamBandwidth.note', '單一波束頻寬', 'Bandwidth of one beam')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-serving-beam-load" label={<>U<sub>s,v</sub>(t)</>} value={formatCompactNumber(servingBeamLoad, 'UE')} note={say('throughput.result.servingLoad.note', '服務波束的實際負載', 'Actual load of the serving beam')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-sinr" label="SINR" value={formatCompactNumber(sinrDb, 'dB', 3)} note={say('throughput.result.sinr.note', '實際鏈路品質', 'Realized link quality')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-rate" label={<>R<sub>u,s,v</sub>(t, <SystemAngleState />)</>} value={`≈ ${formatRate(rate)}`} note={say('throughput.result.rate.note', '代表服務鏈路的實際速率', 'Realized rate of the representative serving link')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-total-rate" label={say('throughput.result.total.label', '系統總速率', 'Total rate')} value={`≈ ${formatRate(totalRate)}`} note={say('throughput.result.total.note', '所有服務鏈路的實際速率總和', 'Total realized rate across serving links')} accent={THROUGHPUT_ACCENT} />
      </div>
      <p style={captionTextStyle}>{say('panel.throughput.result.interpretation', 'R、B^w、U 與 SINR 都是同一 accepted frame 的結果。', 'R, B^w, U, and SINR are results from the same accepted frame.')}</p>
    </section>
  );
}

export interface HomepageCanonicalAnalysisProps {
  readonly activeTab: SimulatorTab;
  readonly analysis: HomepageCanonicalAnalysisState;
  readonly showStatus?: boolean;
}

export function HomepageCanonicalAnalysis({
  activeTab,
  analysis,
  showStatus = true,
}: HomepageCanonicalAnalysisProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const { frame, status } = analysis;

  if (frame === null) {
    return (
      <section
        data-testid="homepage-canonical-results-state"
        role={status === 'error' ? 'alert' : 'status'}
        style={{ ...pagePanelStyle, padding: 14, border: `1px solid ${UI_TOKENS.color.border.subtle}`, borderRadius: UI_TOKENS.radius.lg }}
      >
        <div style={groupTitleStyle}>{say('canonical.results.waiting', '等待計算結果', 'Waiting for calculated results')}</div>
        <p style={captionTextStyle}>{say('canonical.results.loading', '正在準備結果。', 'Preparing results.')}</p>
        {activeTab === 'ee' && (
          <CanonicalReadout
            testId="ee-result-evaluation"
            label={<>η<sub>u,s,v</sub>(t, <SystemAngleState />)</>}
            value="—"
            note={say('ee.result.link.waitingNote', '尚未有可用結果。', 'No result is available yet.')}
            accent={EE_ACCENT}
          />
        )}
      </section>
    );
  }

  return (
    <section
      data-testid="homepage-canonical-results"
      data-result-source="accepted-immutable-frame"
      aria-label={say('canonical.results.title', '計算結果', 'Calculation results')}
      style={{ display: 'grid', gap: 10 }}
    >
      {showStatus && status !== 'ready' && (
        <div role={status === 'error' ? 'alert' : 'status'} style={{ ...captionTextStyle, padding: '8px 9px', border: `1px solid ${UI_TOKENS.color.border.subtle}`, borderRadius: UI_TOKENS.radius.md }}>
          {say(
            'canonical.results.fallback',
            '新設定仍在驗證或未通過；目前顯示上一筆有效結果。',
            'The new setting is still being verified or was rejected; showing the last valid result.',
          )}
        </div>
      )}
      {activeTab === 'sinr' && <SinrProjection frame={frame} />}
      {activeTab === 'ee' && <EeProjection analysis={analysis} />}
      {activeTab === 'power' && <PowerProjection frame={frame} />}
      {activeTab === 'throughput' && <ThroughputProjection frame={frame} />}
    </section>
  );
}
