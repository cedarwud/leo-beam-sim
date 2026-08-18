import type { ReactNode } from 'react';
import type { SimulationAnalysisFrame, SimulatorTab } from '../../simulator/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import {
  PostSatelliteCapDownlinkPower,
  PreSatelliteCapDownlinkPower,
} from '../common/formulaText';
import { FormulaHeader, FormulaRow, InlineFormulaFraction, renderFormulaText } from './FormulaHeader';
import {
  formatCompactNumber,
  formatEnergy,
  formatEnergyEfficiency,
  formatEngineering,
  formatFrequency,
  formatPower,
  formatRate,
} from './formatters';
import { txBi } from './labels';
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
        <CanonicalReadout testId="sinr-result-signal" label={<>S</>} value={formatPower(link.signalW)} note={say('sinr.result.signal.note', '訊號功率', 'Signal power')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-off-axis-angle" label={<>θ</>} value={formatCompactNumber(link.offAxisAngleRad, 'rad', 4)} note={say('homepage.param.theta', '服務鏈路的離軸角', 'Off-axis angle of the serving link')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-distance" label={say('homepage.param.distance.label', '斜距', 'Slant range')} value={formatCompactNumber(link.distanceKm, 'km', 4)} note={say('homepage.param.distance', '衛星至使用者的鏈路斜距', 'Satellite-to-user slant range')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-elevation" label={say('homepage.param.elevation.label', '仰角', 'Elevation')} value={formatCompactNumber(link.elevationDeg, '°', 4)} note={say('homepage.param.elevation', '衛星仰角', 'Satellite elevation')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-channel-gain" label={say('homepage.param.propagation.label', '大尺度傳播增益', 'Large-scale propagation gain')} value={formatLinearGain(frame.inputs.frame.propagationGainUb[userIndex]?.[beam], 'dB')} note={say('homepage.param.propagation', '有效通道中的傳播增益因子', 'Propagation-gain factor in the effective channel')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-beam-gain" label={<>G<sup>T</sup>(θ)</>} value={formatLinearGain(frame.canonical.transmitGainUb[userIndex]?.[beam], 'dBi')} note={say('homepage.sinr.gt.result', '由 θ、G₀ 與波束寬度計算的發射增益', 'Transmit gain computed from θ, G₀, and beamwidth')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-receive-gain" label={say('homepage.param.receiveGain.label', '接收增益', 'Receive gain')} value={formatLinearGain(frame.inputs.frame.receiveGainUb[userIndex]?.[beam], 'dBi')} note={say('homepage.param.receiveGain', '已併入有效通道 h 的接收端增益', 'Receive-side gain included in effective channel h')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-interference" label={<>I<sub>u,s,v</sub>(t, θ)</>} value={formatPower(link.interferenceW)} note={say('sinr.result.interference.note', 'SINR 分母使用的總同頻干擾', 'Total co-channel interference used by the SINR denominator')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-lagged-interference" label={<>Î<sub>u,s,v</sub>(t, θ)</>} value={formatPower(frame.inputs.frame.laggedInterferenceUW[userIndex])} note={say('homepage.sinr.interference.lagged', '前一時間步的干擾估計', 'Interference estimate from the previous time step')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-reuse-color" label={say('homepage.sinr.interference.color', '重用群組', 'Reuse group')} value={String(reuseGroup ?? '—')} note={say('homepage.sinr.interference.color.note', '服務波束的頻率重用群組', 'Frequency-reuse group of the serving beam')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-beam-bandwidth" label={<>B<sup>w</sup></>} value={formatFrequency(derived.beamBandwidthHz)} note={say('homepage.sinr.frequencyReuse.bbeam', '單一波束頻寬', 'Bandwidth of one beam')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-system-noise-temperature" label={say('homepage.sinr.noise.systemTemperature.label', '系統噪聲溫度', 'System noise temperature')} value={formatCompactNumber(derived.systemNoiseTemperatureK, 'K', 3)} note={say('homepage.sinr.noise.systemTemperature', '用於形成 σ² 的接收系統噪聲溫度', 'Receiver-system noise temperature used to form σ²')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-noise" label={say('sinr.result.noise.label', '雜訊功率', 'Noise power')} value={formatPower(link.noiseW)} note={say('sinr.result.noise.note', '接收端的熱雜訊功率', 'Receiver thermal-noise power')} accent={SINR_ACCENT} />
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
  const evaluation = analysis.evaluation;
  return (
    <section
      data-testid="homepage-ee-results"
      role="tabpanel"
      aria-label={say('panel.ee.result.aria', 'EE 計算結果', 'EE calculation results')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="ee-canonical-formula-header"
        title={say('panel.ee.result.title', 'EE 計算結果', 'EE calculation results')}
        accent={EE_ACCENT}
      >
        <FormulaRow
          testId="ee-canonical-formula-row"
          accent={EE_ACCENT}
          emphasis
          expression={<>η<sup>e</sup>(t, θ) = {formatEnergyEfficiency(frame.ee.instantaneousBitsPerJ)}</>}
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="ee-result-throughput" label={<>Σ<sub>u,s,v</sub>x<sub>u,s,v</sub>R<sub>u,s,v</sub>(t, θ)</>} value={formatRate(frame.throughput.totalRateBps)} note={say('ee.result.throughput.note', '所有服務鏈路的總吞吐量', 'Total throughput across serving links')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-system-power" label={<>P<sup>N</sup>(t, θ)</>} value={formatPower(frame.power.systemPowerW)} note={say('ee.result.power.note', '系統總功率', 'Total system power')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-delivered-bits" label={<>Σ<sub>t</sub>Δt<sub>t</sub>Σ<sub>u,s,v</sub>x<sub>u,s,v</sub>R<sub>u,s,v</sub>(t, θ)</>} value={formatEngineering(evaluation.deliveredBits, 'bit')} note={say('ee.result.delivered.note', '累積傳送資料量', 'Accumulated delivered data')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-consumed-energy" label={<>Σ<sub>t</sub>Δt<sub>t</sub>P<sup>N</sup>(t, θ)</>} value={formatEnergy(evaluation.consumedEnergyJ)} note={say('ee.result.energy.note', '累積消耗能量', 'Accumulated consumed energy')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-evaluation" label="EE" value={evaluation.durationSec > 0 ? formatEnergyEfficiency(evaluation.energyEfficiencyBitsPerJ) : '—'} note={say('ee.result.evaluation.note', '累積能源效率', 'Accumulated energy efficiency')} accent={EE_ACCENT} />
      </div>
      <p style={captionTextStyle}>
        {say(
          'panel.ee.result.interpretation',
          'EE 越高，代表每消耗 1 J 能量可傳送更多資料；仍須同時檢查吞吐量與 QoS 是否達標。',
          'Higher EE means more data is delivered per joule, but throughput and QoS still need to be checked together.',
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
      <FormulaHeader
        testId="power-result-formula-header"
        title={say('panel.power.result.title', '功率計算結果', 'Power results')}
        accent={POWER_ACCENT}
        caption={say(
          'panel.power.result.scope',
          '先求需求功率，再套用波束與衛星上限，最後沿完整功耗鏈得到系統總功率。',
          'Requested power is capped by beam and satellite limits before the full power chain produces total system power.',
        )}
      >
        <FormulaRow
          testId="power-result-formula-row"
          accent={POWER_ACCENT}
          emphasis
          expression={<>p<sup>r</sup><sub>u,s,v</sub> → <PreSatelliteCapDownlinkPower /> → <PostSatelliteCapDownlinkPower /> → η<sub>s,v</sub> → P<sup>p</sup><sub>s,v</sub> → P<sup>N</sup></>}
          note="W"
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="power-result-requested" label={<>p<sup>r</sup><sub>u,s,v</sub></>} value={formatPower(value(power.pReqBW))} note={say('power.result.requested.note', '套用上限前的鏈路需求功率', 'Requested link power before caps')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-before-satellite-cap" label={<PreSatelliteCapDownlinkPower />} value={formatPower(value(power.pDlBeforeSatelliteCapBW))} note={say('power.result.beforeSatelliteCap.note', '套用波束上限後、尚未套用衛星總上限的中間 RF 值', 'Intermediate RF value after the beam cap and before the aggregate satellite cap')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-actual" label={<PostSatelliteCapDownlinkPower />} value={formatPower(value(power.pDlActualBW))} note={say('power.result.actual.note', '套用兩級功率上限後的實際 RF 輸出', 'Actual RF output after both power caps')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-pa-efficiency" label={<>η<sub>s,v</sub>(t, θ)</>} value={formatCompactNumber(value(power.paEfficiencyB), isEnglish ? 'dimensionless' : '無因次', 4)} note={say('power.result.eta.note', '依目前負載推導的 PA 效率', 'Load-dependent PA efficiency')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-pa" label={<>P<sup>p</sup><sub>s,v</sub>(t, θ)</>} value={formatPower(value(power.pPaBW))} note={say('power.result.pa.note', 'PA 輸入功率', 'PA input power')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-rfc" label={<>P<sup>c</sup></>} value={formatPower(value(power.pRfcBW))} note={say('power.result.rfc.note', '固定 RF 鏈功耗', 'Fixed RF-chain power')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-baseband" label={<>P<sup>d</sup></>} value={formatPower(value(power.pBbBW))} note={say('power.result.baseband.note', '固定基頻功耗', 'Fixed baseband power')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-system" label={<>P<sup>N</sup></>} value={formatPower(power.systemPowerW)} note={say('power.result.system.note', 'EE 使用的系統總功率', 'Total system power used by EE')} accent={POWER_ACCENT} />
      </div>
      <p style={captionTextStyle}>
        {renderFormulaText(say(
          'panel.power.result.interpretation',
          '若需求功率超過上限，實際 RF 輸出會被限制；降低 RF 輸出不一定等比例降低系統總功率，因為固定功耗仍會保留。',
          'If requested power exceeds a cap, actual RF output is limited. Lower RF output does not necessarily reduce total system power proportionally because fixed power remains.',
        ))}
      </p>
    </section>
  );
}

function ThroughputProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const representativeLink = frame.links[0]!;
  const gammaReq = frame.canonical.gammaReqB[representativeLink.beamId] ?? 0;
  const sinrLinear = representativeLink.sinrLinear;
  const sinrDb = 10 * Math.log10(Math.max(sinrLinear, 1e-30));
  const rate = representativeLink.rateBps;
  const totalRate = frame.throughput.totalRateBps;
  const minimumRate = frame.inputs.config.minimumRateBps;
  const servingBeamLoad = frame.scenario.beamLoadB[representativeLink.beamId] ?? 0;
  const qosMet = representativeLink.qosMet;
  const qosBoundary = !qosMet
    && Math.abs(rate - minimumRate)
      <= Number.EPSILON * 8 * Math.max(Math.abs(rate), Math.abs(minimumRate), 1);
  return (
    <section
      data-testid="homepage-throughput-results"
      role="tabpanel"
      aria-label={say('panel.throughput.result.aria', '吞吐量', 'Throughput')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="throughput-result-formula-header"
        title={say('panel.throughput.result.title', '吞吐量計算結果', 'Throughput results')}
        accent={THROUGHPUT_ACCENT}
        caption={say(
          'panel.throughput.result.scope',
          '服務目標先決定目標 SINR 與需求功率；實際功率與 SINR 再決定最後可傳送的速率。',
          'The service target determines the target SINR and requested power; actual power and SINR then determine the realized rate.',
        )}
      >
        <FormulaRow
          testId="throughput-result-formula-row"
          accent={THROUGHPUT_ACCENT}
          emphasis
          expression={(
            <>R<sub>u,s,v</sub>(t, θ) = <InlineFormulaFraction
              numerator={<>B<sup>w</sup></>}
              denominator={<>U<sub>s,v</sub>(t)</>}
              label="beam bandwidth divided by serving users"
            /> log<sub>2</sub>(1 + γ<sub>u,s,v</sub>(t, θ))</>
          )}
          note="bit/s"
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="throughput-result-minimum-rate" label={<>R<sup>m</sup></>} value={formatRate(minimumRate)} note={say('throughput.result.minimum.note', '每位使用者的最低傳輸速率要求', 'Minimum transmission rate per user')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-beam-bandwidth" label={<>B<sup>w</sup></>} value={formatFrequency(frame.scenario.derived.beamBandwidthHz)} note={say('throughput.result.beamBandwidth.note', '單一波束頻寬', 'Bandwidth of one beam')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-serving-beam-load" label={<>U<sub>s,v</sub>(t)</>} value={formatCompactNumber(servingBeamLoad, 'UE')} note={say('throughput.result.servingLoad.note', '服務波束的實際負載', 'Actual load of the serving beam')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-gamma" label={<>γ<sup>r</sup></>} value={formatCompactNumber(gammaReq, '', 4)} note={say('throughput.result.gamma.note', '達成 R^m 所需的目標 SINR', 'Target SINR required for R^m')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-sinr" label="SINR" value={formatCompactNumber(sinrDb, 'dB', 3)} note={say('throughput.result.sinr.note', '實際鏈路品質', 'Realized link quality')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-rate" label={<>R<sub>u,s,v</sub></>} value={`≈ ${formatRate(rate)}`} note={qosMet ? say('throughput.result.qos.met', '實際速率；已達 R^m', 'Realized rate; meets R^m') : qosBoundary ? say('throughput.result.qos.boundary', '顯示值四捨五入後等於 R^m；精確值略低於目標', 'The displayed value rounds to R^m; the exact value is slightly below target') : say('throughput.result.qos.miss', '實際速率；未達 R^m', 'Realized rate; below R^m')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-total-rate" label={<>Σ<sub>u,s,v</sub>x<sub>u,s,v</sub>R<sub>u,s,v</sub></>} value={`≈ ${formatRate(totalRate)}`} note={say('throughput.result.total.note', '所有服務鏈路的實際速率總和', 'Total realized rate across serving links')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-qos" label="QoS" value={qosMet ? say('throughput.result.qos.value.met', '達標', 'Met') : say('throughput.result.qos.value.miss', '未達標', 'Missed')} note={say('throughput.result.qos.note', '以實際速率與最低速率要求比較', 'Compares the realized rate with the minimum-rate requirement')} accent={qosMet ? POWER_ACCENT : EE_ACCENT} />
      </div>
      <p style={captionTextStyle}>
        {renderFormulaText(say(
          'panel.throughput.result.interpretation',
          qosMet
            ? '目前速率已達 R_min；可再觀察是否能降低功率而仍維持服務目標。'
            : qosBoundary
              ? '目前顯示值四捨五入後等於 R_min；精確值仍略低於目標。'
            : '目前速率未達 R_min；先檢查功率限制，再檢查幾何與 SINR。',
          qosMet
            ? 'The current rate meets R_min; next check whether power can be reduced while preserving the target.'
            : qosBoundary
              ? 'The displayed value rounds to R_min; the exact value is slightly below target.'
            : 'The current rate is below R_min; first check power limits, then geometry and SINR.',
        ))}
      </p>
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
            label={say('ee.result.evaluation.label', '累積能源效率', 'Accumulated energy efficiency')}
            value="—"
            note={say('ee.result.evaluation.waitingNote', '尚未有可用結果。', 'No result is available yet.')}
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
