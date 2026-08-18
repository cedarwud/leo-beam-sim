import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { SimulatorParameters } from '../../simulator/types';
import { CanonicalReadOnlyParameter } from './CanonicalParameterPrimitives';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { formatFrequency, formatRate } from './formatters';
import { txBi } from './labels';
import { SIMPLIFIED_EE_BEAM_INDEX, SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { controlStackStyle, groupTitleStyle, pagePanelStyle } from './styles';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

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
  const calculatedRate = analysis.frame?.links[0]?.rateBps ?? null;

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
          'R^m 與 B^w 決定目標 γ^r、服務頻寬與使用者速率；速率由頻寬、服務負載與選定服務鏈路上的 γ 決定。',
          'R^m and B^w determine target γ^r and user rate; rate uses bandwidth, serving load, and realized γ on the selected serving link.',
        )}
      >
        <FormulaRow
          testId="throughput-canonical-formula-row"
          accent={THROUGHPUT_ACCENT}
          emphasis
          expression={(
            <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) = <InlineFormulaFraction
              numerator={<>B<sup>w</sup></>}
              denominator={<>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t)</>}
              label="beam bandwidth divided by serving users"
            /> log<sub>2</sub>(1 + γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ))</>
          )}
          note="bit/s"
          source={isEnglish
            ? <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) is the number of users served by the serving beam.</>
            : <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) 是服務波束的服務人數。</>}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={groupTitleStyle}>{say('homepage.throughput.calculated.title', '計算值', 'Calculated value')}</div>
        <CanonicalReadOnlyParameter
          testId="throughput-tab-calculated-value"
          label={<>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
          value={formatRate(calculatedRate)}
          note={say('homepage.throughput.calculated.note', '目前服務鏈路的實際吞吐量', 'Calculated throughput of the current serving link')}
          accent={THROUGHPUT_ACCENT}
        />
        <div style={groupTitleStyle}>{say('section.throughput.values', '參數值', 'Parameter values')}</div>
        <CanonicalReadOnlyParameter
          testId="throughput-tab-minimum-rate-value"
          label={<>R<sup>m</sup></>}
          value={formatRate(parameters.minimumRateBps)}
          note={say('throughput.minimumRate.note', '每位使用者最低傳輸速率要求', 'Per-user minimum transmission-rate requirement')}
          accent={THROUGHPUT_ACCENT}
        />
        <CanonicalReadOnlyParameter
          testId="throughput-tab-system-bandwidth-value"
          label={<>B<sup>w</sup></>}
          value={formatFrequency(parameters.systemBandwidthHz)}
          note={say('throughput.systemBandwidth.note', '服務頻寬', 'Service bandwidth')}
          accent={THROUGHPUT_ACCENT}
        />
      </div>

    </section>
  );
}
