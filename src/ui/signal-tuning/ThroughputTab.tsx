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

/** Canonical throughput inputs for the homepage's left rail. */
export function ThroughputTab({
  parameters,
  onParametersChange,
}: {
  readonly parameters: SimulatorParameters;
  readonly onParametersChange: (next: SimulatorParameters) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
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
          'R_min 與 B_beam 是輸入；gamma_req、p_req、P_DL_actual、SINR 與 R_u 皆由同一條計算鏈推導。',
          'R_min and B_beam are inputs; gamma_req, p_req, P_DL_actual, SINR, and R_u are all derived by one calculation chain.',
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
          label={say('throughput.minimumRate.label', '最低服務速率', 'Minimum service rate')}
          unit="bit/s"
          value={parameters.minimumRateBps}
          min={1_000}
          max={10_000_000}
          step={1_000}
          description={say('throughput.minimumRate.description', '用來推導 gamma_req 與需求 RF 功率的服務目標。', 'Service target used to derive gamma_req and requested RF power.')}
          effect={say('throughput.minimumRate.effect', '目標越高，gamma_req 越高，也越可能在套用功率上限後無法達標。', 'A higher target raises gamma_req and may leave the link power-limited after caps.')}
          helpId="param.throughputTab.minimumRateBps"
          accentColor={THROUGHPUT_ACCENT}
          formatValue={value => `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} bit/s`}
          onChange={minimumRateBps => update({ minimumRateBps })}
        />
        <NumericControl
          testId="throughput-tab-bandwidth-control"
          symbol={<>B<sub>beam</sub></>}
          label={say('throughput.bandwidth.label', '每道波束頻寬', 'Per-beam bandwidth')}
          unit="Hz"
          value={parameters.beamBandwidthHz}
          min={100_000}
          max={500_000_000}
          step={100_000}
          description={say('throughput.bandwidth.description', '分配給 active beam 的服務頻寬。', 'Service bandwidth assigned to the active beam.')}
          effect={say('throughput.bandwidth.effect', '會同時改變 gamma_req 與實際速率；SINR 仍由完整計算鏈產生。', 'It changes gamma_req and realized rate together; SINR still comes from the full calculation chain.')}
          helpId="param.throughputTab.beamBandwidthHz"
          accentColor={THROUGHPUT_ACCENT}
          formatValue={value => `${(value / 1_000_000).toFixed(1)} MHz`}
          onChange={beamBandwidthHz => update({ beamBandwidthHz })}
        />
      </div>

      <p style={captionTextStyle}>
        {say(
          'section.throughput.resultLocation',
          'γ_req、p_req、P_DL_actual、SINR 與 R_u 會在右側顯示為最終計算結果。',
          'gamma_req, p_req, P_DL_actual, SINR, and R_u appear in the right rail as final calculated results.',
        )}
      </p>
    </section>
  );
}
