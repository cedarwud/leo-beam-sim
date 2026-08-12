import type { CanonicalEeResult } from '../../analysis/canonicalEe';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { SimulatorParameters } from '../../simulator/types';
import { NumericControl } from './Controls';
import { FormulaHeader, FormulaRow } from './FormulaHeader';
import { txBi } from './labels';
import {
  captionTextStyle,
  controlStackStyle,
  groupTitleStyle,
  pagePanelStyle,
} from './styles';

const THROUGHPUT_ACCENT = UI_TOKENS.color.semantic.info;

function formatNumber(value: number, unit: string, digits = 3): string {
  return Number.isFinite(value) ? `${value.toLocaleString('en-US', { maximumFractionDigits: digits })} ${unit}` : '—';
}

function formatScientific(value: number, unit: string): string {
  return Number.isFinite(value) ? `${value.toExponential(3)} ${unit}` : '—';
}

/** Canonical throughput projection over the same immutable result as Power/SINR/EE. */
export function ThroughputTab({
  result,
  parameters,
  onParametersChange,
}: {
  readonly result: CanonicalEeResult;
  readonly parameters: SimulatorParameters;
  readonly onParametersChange: (next: SimulatorParameters) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const gammaReq = result.gammaReqB[0] ?? 0;
  const requestedPower = result.power.pReqBW[0] ?? 0;
  const actualPower = result.power.pDlActualBW[0] ?? 0;
  const sinrLinear = result.throughput.sinrU[0] ?? 0;
  const sinrDb = 10 * Math.log10(Math.max(sinrLinear, 1e-30));
  const rate = result.throughput.rateUBps[0] ?? 0;

  const update = (patch: Partial<SimulatorParameters>) => {
    onParametersChange({ ...parameters, ...patch });
  };

  return (
    <section
      id="tuning-page-panel-throughput"
      data-testid="throughput-canonical-page"
      data-canonical-status="canonical"
      role="tabpanel"
      aria-label={say('tab.throughput.label', '吞吐量', 'Throughput')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="throughput-canonical-formula-header"
        title={say('panel.throughput.canonical.title', '吞吐量與服務目標', 'Throughput and service target')}
        accent={THROUGHPUT_ACCENT}
        caption={say(
          'panel.throughput.canonical.scope',
          'R_min 與 B_beam 是輸入；gamma_req、p_req、P_DL_actual、SINR 與 R_u 全部由同一份 canonical result 推導。',
          'R_min and B_beam are inputs; gamma_req, p_req, P_DL_actual, SINR, and R_u are all derived by one canonical result.',
        )}
      >
        <FormulaRow
          testId="throughput-canonical-formula-row"
          accent={THROUGHPUT_ACCENT}
          emphasis
          expression={<>R<sub>u</sub> = (B<sub>beam</sub> / U<sub>b</sub>) log<sub>2</sub>(1 + SINR<sub>u</sub>)</>}
          note="bit/s"
          source={say(
            'panel.throughput.canonical.source',
            'SINR 與實際功率來自同一個 immutable frame',
            'SINR and actual power come from the same immutable frame',
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={groupTitleStyle}>{say('section.throughput.inputs', '可調整的模型輸入', 'Editable model inputs')}</div>
        <NumericControl
          testId="throughput-tab-minimum-rate-control"
          symbol={<>R<sub>min</sub></>}
          label="Minimum service rate"
          unit="bit/s"
          value={parameters.minimumRateBps}
          min={1_000}
          max={10_000_000}
          step={1_000}
          description="Service target used to derive gamma_req and requested RF power."
          effect="A higher target raises gamma_req and may make the link power-limited after caps."
          helpId="param.throughputTab.minimumRateBps"
          accentColor={THROUGHPUT_ACCENT}
          formatValue={value => `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} bit/s`}
          onChange={minimumRateBps => update({ minimumRateBps })}
        />
        <NumericControl
          testId="throughput-tab-bandwidth-control"
          symbol={<>B<sub>beam</sub></>}
          label="Per-beam bandwidth"
          unit="Hz"
          value={parameters.beamBandwidthHz}
          min={100_000}
          max={500_000_000}
          step={100_000}
          description="Bandwidth assigned to the active beam in the canonical service contract."
          effect="It changes gamma_req and the realized rate together; the page never injects a separate SINR."
          helpId="param.throughputTab.beamBandwidthHz"
          accentColor={THROUGHPUT_ACCENT}
          formatValue={value => `${(value / 1_000_000).toFixed(1)} MHz`}
          onChange={beamBandwidthHz => update({ beamBandwidthHz })}
        />
      </div>

      <section
        data-testid="throughput-canonical-readout"
        style={{
          display: 'grid',
          gap: 10,
          padding: '13px 14px',
          borderRadius: UI_TOKENS.radius.lg,
          background: UI_TOKENS.color.surface.card,
          border: `1px solid ${THROUGHPUT_ACCENT}3d`,
          borderLeft: `4px solid ${THROUGHPUT_ACCENT}`,
        }}
      >
        <div style={groupTitleStyle}>{say('section.throughput.derived', '同一 frame 的唯讀結果', 'Read-only results from the same frame')}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <Readout testId="throughput-tab-gamma-readout" label={<>γ<sub>req</sub></>} value={formatNumber(gammaReq, 'linear', 6)} note="derived from R_min / B_beam" />
          <Readout testId="throughput-tab-requested-power-readout" label={<>p<sub>req</sub></>} value={formatScientific(requestedPower, 'W')} note="before caps" />
          <Readout testId="throughput-tab-actual-power-readout" label={<>P<sub>DL,actual</sub></>} value={formatScientific(actualPower, 'W')} note="post-cap shared RF output" />
          <Readout testId="throughput-tab-sinr-readout" label="SINR" value={formatNumber(sinrDb, 'dB', 3)} note="derived from shared actual power" />
          <Readout testId="throughput-tab-rate-readout" label={<>R<sub>u</sub></>} value={formatNumber(rate, 'bit/s', 1)} note={result.throughput.qosMetU[0] ? 'QoS met' : 'QoS not met'} />
        </div>
        <div style={captionTextStyle}>
          {say(
            'section.throughput.canonical.note',
            '本頁不另算 SINR 或吞吐量，也不接受直接 P_t；所有讀數直接投影 canonical producer。',
            'This page neither recalculates SINR/rate nor accepts direct P_t; every readout projects the canonical producer.',
          )}
        </div>
      </section>
    </section>
  );
}
function Readout({
  testId,
  label,
  value,
  note,
}: {
  readonly testId: string;
  readonly label: React.ReactNode;
  readonly value: string;
  readonly note: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(86px, auto) 1fr',
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
        <strong style={{ color: THROUGHPUT_ACCENT, overflowWrap: 'anywhere' }}>{value}</strong>
        <small style={captionTextStyle}>{note}</small>
      </span>
    </div>
  );
}
