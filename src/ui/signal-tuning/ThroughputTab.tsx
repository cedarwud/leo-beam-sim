import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { SimulatorParameters } from '../../simulator/types';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { SystemAngleState } from './FormulaSymbols';
import { txBi } from './labels';
import { SIMPLIFIED_EE_BEAM_INDEX, SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { pagePanelStyle } from './styles';
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
  void parameters;
  void analysis;

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
          '速率由單一波束頻寬、服務中的使用者數與該鏈路 γ 決定。',
          'Rate is determined by per-beam bandwidth, serving-user load, and the link γ.',
        )}
      >
        <FormulaRow
          testId="throughput-canonical-formula-row"
          accent={THROUGHPUT_ACCENT}
          emphasis
          expression={(
            <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) = <InlineFormulaFraction
              numerator={<>B<sup>w</sup></>}
              denominator={<>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t)</>}
              label="beam bandwidth divided by serving users"
            /> log<sub>2</sub>(1 + γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />))</>
          )}
          note="bit/s"
          source={isEnglish
            ? <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) is the number of users served by the serving beam.</>
            : <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) 是服務波束的服務人數。</>}
        />
      </FormulaHeader>

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
