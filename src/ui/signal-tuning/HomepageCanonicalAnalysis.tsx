import type { ReactNode } from 'react';
import type { SimulationAnalysisFrame, SimulatorTab } from '../../simulator/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { FormulaHeader, FormulaRow } from './FormulaHeader';
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

function formatNumber(value: number, unit: string, digits = 3): string {
  return Number.isFinite(value)
    ? `${value.toLocaleString('en-US', { maximumFractionDigits: digits })} ${unit}`
    : '—';
}

function formatScientific(value: number, unit: string): string {
  return Number.isFinite(value) ? `${value.toExponential(3)} ${unit}` : '—';
}

function firstActiveBeam(frame: SimulationAnalysisFrame): number {
  const index = frame.inputs.frame.beamActiveB.findIndex(active => active);
  return index >= 0 ? index : 0;
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
  readonly note: string;
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
        <small style={captionTextStyle}>{note}</small>
      </span>
    </div>
  );
}

function SinrProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const link = frame.links[0]!;
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  return (
    <section
      data-testid="homepage-sinr-results"
      role="tabpanel"
      aria-label="SINR results"
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="sinr-canonical-formula-header"
        title={say('panel.sinr.result.title', 'SINR 最終結果', 'Final SINR result')}
        accent={SINR_ACCENT}
        caption={say(
          'panel.sinr.result.scope',
          '右側只顯示同一筆運算狀態完成後的結果；所有輸入都在左側。',
          'The right rail shows only results from the completed calculation state; all inputs remain on the left.',
        )}
      >
        <FormulaRow
          testId="sinr-canonical-formula-row"
          accent={SINR_ACCENT}
          emphasis
          expression={<>SINR<sub>u</sub> = S<sub>u</sub> / (I<sub>u</sub> + σ²)</>}
          note="linear"
          source={say(
            'panel.sinr.result.source',
            'S 與 I 使用同一份 post-cap P_DL_actual',
            'S and I use the same post-cap P_DL_actual',
          )}
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="sinr-result-actual-power" label={<>P<sub>DL,actual</sub></>} value={formatScientific(link.actualPowerW, 'W')} note={say('sinr.result.actual.note', '套用功率上限後的 RF 輸出', 'RF output after power caps')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-signal" label="Signal" value={formatScientific(link.signalW, 'W')} note={say('sinr.result.signal.note', '接收端的有用訊號功率', 'Useful received power')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-interference" label="Interference" value={formatScientific(link.interferenceW, 'W')} note={say('sinr.result.interference.note', '同頻干擾總和', 'Co-channel interference sum')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-noise" label="Noise σ²" value={formatScientific(link.noiseW, 'W')} note={say('sinr.result.noise.note', '分母採用的雜訊功率', 'Noise power used in the denominator')} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-result-value" label="SINR" value={formatNumber(link.sinrDb, 'dB', 3)} note={`${link.sinrLinear.toExponential(3)} linear`} accent={SINR_ACCENT} />
      </div>
      <p style={captionTextStyle}>
        {say(
          'panel.sinr.result.interpretation',
          'SINR 越高，代表有用訊號相對於干擾與雜訊越強；此值會繼續進入吞吐量計算。',
          'A higher SINR means the useful signal is stronger relative to interference and noise; this value then feeds the throughput calculation.',
        )}
      </p>
    </section>
  );
}

function EeProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  return (
    <section
      data-testid="homepage-ee-results"
      role="tabpanel"
      aria-label="EE results"
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="ee-canonical-formula-header"
        title={say('panel.ee.result.title', 'EE 最終結果', 'Final EE result')}
        accent={EE_ACCENT}
        caption={say(
          'panel.ee.result.scope',
          '分子與分母皆來自同一筆已完成的計算結果。',
          'The numerator and denominator come from the same completed calculation result.',
        )}
      >
        <FormulaRow
          testId="ee-canonical-formula-row"
          accent={EE_ACCENT}
          emphasis
          expression={<>EE<sub>inst</sub> = Σ<sub>u</sub>R<sub>u</sub> / P<sub>sys</sub></>}
          note="bit/J"
          source="P_sys = Σ_b(P_PA + P_RFC + P_BB + P_event)"
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="ee-result-throughput" label={<>ΣR<sub>u</sub></>} value={formatNumber(frame.throughput.totalRateBps, 'bit/s', 1)} note={say('ee.result.throughput.note', '吞吐量分子', 'Throughput numerator')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-system-power" label={<>P<sub>sys</sub></>} value={formatScientific(frame.power.systemPowerW, 'W')} note={say('ee.result.power.note', '系統功率分母', 'System-power denominator')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-instantaneous" label={<>EE<sub>inst</sub></>} value={formatNumber(frame.ee.instantaneousBitsPerJ, 'bit/J', 1)} note={say('ee.result.instant.note', '目前計算狀態', 'Current calculation state')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-evaluation" label={<>EE<sub>eval</sub></>} value={formatNumber(frame.ee.evaluationBitsPerJ, 'bit/J', 1)} note={say('ee.result.evaluation.note', '累加總和後再相除', 'Ratio of accumulated sums')} accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-result-contribution-sum" label={<>Σr<sub>1,u</sub></>} value={formatNumber(frame.canonical.ee.contributionSumBitsPerJ, 'bit/J', 1)} note={frame.canonical.ee.sumIdentity ? say('ee.result.identity.valid', '等式檢查通過', 'Identity verified') : say('ee.result.identity.invalid', '等式檢查失敗', 'Identity invalid')} accent={EE_ACCENT} />
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
      aria-label="Power results"
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="power-result-formula-header"
        title={say('panel.power.result.title', 'Power 最終結果', 'Final power result')}
        accent={POWER_ACCENT}
        caption={say(
          'panel.power.result.scope',
          '先求需求功率，再套用波束與衛星上限，最後沿完整功耗鏈得到 P_sys。',
          'Requested power is capped by beam and satellite limits before the full power chain produces P_sys.',
        )}
      >
        <FormulaRow
          testId="power-result-formula-row"
          accent={POWER_ACCENT}
          emphasis
          expression={<>p<sub>req</sub> → P<sub>DL,actual</sub> → η<sub>PA</sub> → P<sub>PA</sub> → P<sub>sys</sub></>}
          note="W"
          source={say('panel.power.result.source', '所有數值由左側參數重新計算', 'Every value is recomputed from the left-side parameters')}
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="power-result-requested" label={<>p<sub>req</sub></>} value={formatScientific(value(power.pReqBW), 'W')} note={say('power.result.requested.note', '套用上限前的需求功率', 'Requested power before caps')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-actual" label={<>P<sub>DL,actual</sub></>} value={formatScientific(value(power.pDlActualBW), 'W')} note={say('power.result.actual.note', '套用上限後的實際 RF 輸出', 'Actual RF output after caps')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-pa-efficiency" label={<>η<sub>PA</sub></>} value={formatNumber(value(power.paEfficiencyB), 'ratio', 4)} note={say('power.result.eta.note', '依目前負載推導的 PA 效率', 'Load-dependent PA efficiency')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-pa" label={<>P<sub>PA</sub></>} value={formatScientific(value(power.pPaBW), 'W')} note={say('power.result.pa.note', 'PA 輸入功率', 'PA input power')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-overhead" label={<>P<sub>RFC</sub>+P<sub>BB</sub>+P<sub>event</sub></>} value={formatScientific(value(power.pRfcBW) + value(power.pBbBW) + value(power.pEventBW), 'W')} note={say('power.result.overhead.note', 'PA 以外的 payload 功耗', 'Non-PA payload power')} accent={POWER_ACCENT} />
        <CanonicalReadout testId="power-result-system" label={<>P<sub>sys</sub></>} value={formatScientific(power.systemPowerW, 'W')} note={say('power.result.system.note', 'EE 採用的完整功率分母', 'Full power denominator used by EE')} accent={POWER_ACCENT} />
      </div>
      <p style={captionTextStyle}>
        {say(
          'panel.power.result.interpretation',
          '若 p_req 超過上限，P_DL_actual 會被限制；降低 RF 輸出不一定等比例降低 P_sys，因為 RF chain 與 baseband 仍會耗能。',
          'If p_req exceeds a cap, P_DL_actual is limited. Lower RF output does not necessarily reduce P_sys proportionally because RF-chain and baseband power remain.',
        )}
      </p>
    </section>
  );
}

function ThroughputProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const gammaReq = frame.canonical.gammaReqB[0] ?? 0;
  const requestedPower = frame.power.pReqBW[0] ?? 0;
  const actualPower = frame.power.pDlActualBW[0] ?? 0;
  const sinrLinear = frame.throughput.sinrU[0] ?? 0;
  const sinrDb = 10 * Math.log10(Math.max(sinrLinear, 1e-30));
  const rate = frame.throughput.rateUBps[0] ?? 0;
  const qosMet = frame.throughput.qosMetU[0] ?? false;
  return (
    <section
      data-testid="homepage-throughput-results"
      role="tabpanel"
      aria-label="Throughput results"
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="throughput-result-formula-header"
        title={say('panel.throughput.result.title', 'Throughput 最終結果', 'Final throughput result')}
        accent={THROUGHPUT_ACCENT}
        caption={say(
          'panel.throughput.result.scope',
          '服務目標先決定 γ_req 與 p_req；實際功率與 SINR 再決定最後可傳送的速率。',
          'The service target determines gamma_req and p_req; actual power and SINR then determine the realized rate.',
        )}
      >
        <FormulaRow
          testId="throughput-result-formula-row"
          accent={THROUGHPUT_ACCENT}
          emphasis
          expression={<>R<sub>u</sub> = (B<sub>beam</sub> / U<sub>b</sub>) log<sub>2</sub>(1 + SINR<sub>u</sub>)</>}
          note="bit/s"
          source={say('panel.throughput.result.source', 'SINR 與實際功率來自同一筆計算結果', 'SINR and actual power come from the same calculation result')}
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="throughput-result-gamma" label={<>γ<sub>req</sub></>} value={formatNumber(gammaReq, 'linear', 6)} note={say('throughput.result.gamma.note', '達成 R_min 所需的 SINR 門檻', 'SINR threshold required to meet R_min')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-requested-power" label={<>p<sub>req</sub></>} value={formatScientific(requestedPower, 'W')} note={say('throughput.result.requested.note', '套用上限前的需求功率', 'Requested power before caps')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-actual-power" label={<>P<sub>DL,actual</sub></>} value={formatScientific(actualPower, 'W')} note={say('throughput.result.actual.note', '套用上限後的實際 RF 輸出', 'Actual RF output after caps')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-sinr" label="SINR" value={formatNumber(sinrDb, 'dB', 3)} note={say('throughput.result.sinr.note', '實際鏈路品質', 'Realized link quality')} accent={THROUGHPUT_ACCENT} />
        <CanonicalReadout testId="throughput-result-rate" label={<>R<sub>u</sub></>} value={formatNumber(rate, 'bit/s', 1)} note={qosMet ? say('throughput.result.qos.met', 'QoS 已達標', 'QoS met') : say('throughput.result.qos.miss', 'QoS 未達標', 'QoS not met')} accent={THROUGHPUT_ACCENT} />
      </div>
      <p style={captionTextStyle}>
        {say(
          'panel.throughput.result.interpretation',
          qosMet
            ? '目前速率已達 R_min；可再觀察是否能降低功率而仍維持服務目標。'
            : '目前速率未達 R_min；先檢查功率是否受限，再檢查幾何與 SINR。',
          qosMet
            ? 'The current rate meets R_min; next check whether power can be reduced while preserving the target.'
            : 'The current rate misses R_min; first check power caps, then geometry and SINR.',
        )}
      </p>
    </section>
  );
}

export interface HomepageCanonicalAnalysisProps {
  readonly activeTab: SimulatorTab;
  readonly analysis: HomepageCanonicalAnalysisState;
}

/** Read-only final results backed by the same accepted immutable frame as the left inputs. */
export function HomepageCanonicalAnalysis({ activeTab, analysis }: HomepageCanonicalAnalysisProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const { frame, status, error } = analysis;

  if (frame === null) {
    return (
      <section
        data-testid="homepage-canonical-results-state"
        role={status === 'error' ? 'alert' : 'status'}
        style={{ ...pagePanelStyle, padding: 14, border: `1px solid ${UI_TOKENS.color.border.subtle}`, borderRadius: UI_TOKENS.radius.lg }}
      >
        <div style={groupTitleStyle}>{say('canonical.results.waiting', '等待計算結果', 'Waiting for calculated results')}</div>
        <p style={captionTextStyle}>{error ?? say('canonical.results.loading', '正在驗證 TLE 並建立計算狀態。', 'Validating TLE data and building the calculation state.')}</p>
      </section>
    );
  }

  return (
    <section
      data-testid="homepage-canonical-results"
      data-result-source="accepted-immutable-frame"
      aria-label={say('canonical.results.title', '最終計算結果', 'Final calculated results')}
      style={{ display: 'grid', gap: 10 }}
    >
      <div style={groupTitleStyle}>{say('canonical.results.title', '最終計算結果', 'Final calculated results')}</div>
      {status !== 'ready' && (
        <div role={status === 'error' ? 'alert' : 'status'} style={{ ...captionTextStyle, padding: '8px 9px', border: `1px solid ${UI_TOKENS.color.border.subtle}`, borderRadius: UI_TOKENS.radius.md }}>
          {say(
            'canonical.results.fallback',
            '左側新設定仍在處理或未通過驗證；目前保留上一筆已接受結果。',
            'The new left-side selection is still loading or was not accepted; the last accepted result remains visible.',
          )}
        </div>
      )}
      {activeTab === 'sinr' && <SinrProjection frame={frame} />}
      {activeTab === 'ee' && <EeProjection frame={frame} />}
      {activeTab === 'power' && <PowerProjection frame={frame} />}
      {activeTab === 'throughput' && <ThroughputProjection frame={frame} />}
    </section>
  );
}
