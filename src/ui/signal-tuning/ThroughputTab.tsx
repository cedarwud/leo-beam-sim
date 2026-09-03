import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { NumericControl } from './Controls';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { LinkRate, LinkSinr } from './FormulaSymbols';
import { formatFrequency, formatRate } from './formatters';
import { txBi } from './labels';
import { SIMPLIFIED_EE_BEAM_INDEX, SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { controlStackStyle, groupTitleStyle, pagePanelStyle } from './styles';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';
import { applyCanonicalParameterChange } from './canonicalParameterControls';

const THROUGHPUT_ACCENT = UI_TOKENS.color.semantic.info;

/** Canonical throughput inputs for the homepage's left rail. */
export function ThroughputTab({
  parameters,
  analysis,
}: {
  readonly parameters: SimulatorParameters;
  readonly analysis: HomepageCanonicalAnalysisState;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const update = (key: 'minimumRateBps' | 'systemBandwidthHz', value: number) => {
    analysis.setParameters(applyCanonicalParameterChange(parameters, key, value));
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
        title={say('panel.throughput.canonical.title', 'Throughput', 'Throughput')}
        accent={THROUGHPUT_ACCENT}
        caption={say(
          'panel.throughput.canonical.scope',
          '速率由單一波束頻寬、服務中的使用者數、該鏈路 γ 與 θ₃dB 共同決定。',
          'Rate is determined by per-beam bandwidth, serving-user load, link γ, and θ₃dB.',
        )}
      >
        <FormulaRow
          testId="throughput-canonical-formula-row"
          accent={THROUGHPUT_ACCENT}
          emphasis
          expression={(
            <><LinkRate /> = <InlineFormulaFraction
              numerator={<>B<sup>w</sup></>}
              denominator={<>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t)</>}
              label="beam bandwidth divided by serving users"
            /> log<sub>2</sub>(1 + <LinkSinr />)</>
          )}
          note="bit/s"
          source={isEnglish
            ? <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) is the number of users served by the serving beam; θ<sub>3dB</sub> remains an explicit model input to γ.</>
            : <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) 是服務波束的服務人數；θ<sub>3dB</sub> 是 γ 的明確模型輸入。</>}
        />
      </FormulaHeader>

      <div style={controlStackStyle} data-testid="throughput-canonical-controls">
        <div style={groupTitleStyle}>
          {say('section.throughputControls.title', '可調整的吞吐量輸入', 'Adjustable throughput inputs')}
        </div>
        <NumericControl
          testId="throughput-tab-minimum-rate-control"
          symbol={<>R<sub>min</sub></>}
          label={say('homepage.throughput.minimumRate.label', '最低服務速率', 'Minimum service rate')}
          unit="bit/s"
          value={parameters.minimumRateBps}
          min={1_000}
          max={10_000_000}
          step={1_000}
          description={say('homepage.throughput.minimumRate.description', '用於服務速率門檻檢查的最低速率設定。', 'Minimum rate used by the service-rate assessment.')}
          effect={say('homepage.throughput.minimumRate.effect', '調整此值會改變速率門檻判定；實際 R 仍由同一 accepted frame 計算。', 'Changing this value changes the rate-threshold assessment; actual R still comes from the same accepted frame.')}
          resetValue={formatRate(DEFAULT_SIMULATOR_PARAMETERS.minimumRateBps)}
          source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · minimum service rate"
          helpId="param.canonicalThroughput.minimumRate"
          accentColor={THROUGHPUT_ACCENT}
          formatValue={value => formatRate(value)}
          onChange={minimumRateBps => update('minimumRateBps', minimumRateBps)}
        />
        <NumericControl
          testId="throughput-tab-system-bandwidth-control"
          symbol={<>B<sub>sys</sub></>}
          label={say('homepage.throughput.systemBandwidth.label', '系統頻寬', 'System bandwidth')}
          unit="Hz"
          value={parameters.systemBandwidthHz}
          min={1_000_000}
          max={2_000_000_000}
          step={1_000_000}
          description={say('homepage.throughput.systemBandwidth.description', '全系統可分配的頻寬；依頻率重用群組分配到各波束。', 'Total system bandwidth allocated across beams by the frequency-reuse groups.')}
          effect={say('homepage.throughput.systemBandwidth.effect', '提高系統頻寬會提高 B^w，並連帶改變 R、系統總速率與 η。', 'Increasing system bandwidth raises B^w and therefore changes R, total rate, and η.')}
          resetValue={formatFrequency(DEFAULT_SIMULATOR_PARAMETERS.systemBandwidthHz)}
          source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · system bandwidth"
          helpId="param.canonicalThroughput.systemBandwidth"
          accentColor={THROUGHPUT_ACCENT}
          formatValue={value => formatFrequency(value)}
          onChange={systemBandwidthHz => update('systemBandwidthHz', systemBandwidthHz)}
        />
      </div>

      <p style={{ margin: 0, color: 'rgba(255,255,255,0.68)', lineHeight: 1.55 }}>
        {say(
          'homepage.throughput.scope',
          '左側只保留吞吐量公式；實際單鏈路與系統速率由右側同一個 accepted frame 顯示。',
          'The left rail keeps the throughput equation; actual link and system rates are shown on the right from the same accepted frame.',
        )}
      </p>
    </section>
  );
}
