import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { SystemAngleState } from './FormulaSymbols';
import { formatRate } from './formatters';
import { txBi } from './labels';
import { SIMPLIFIED_EE_BEAM_INDEX, SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { pagePanelStyle } from './styles';

const THROUGHPUT_ACCENT = UI_TOKENS.color.semantic.info;

export function WalkerThroughputTab({
  linkThroughputMbps = null,
}: {
  readonly linkThroughputMbps?: number | null;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);

  return (
    <section
      id="tuning-page-panel-throughput"
      data-testid="walker-throughput-page"
      role="tabpanel"
      aria-label={say('tab.throughput.label', '吞吐量', 'Throughput')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="walker-throughput-formula-header"
        title={say('walker.throughput.heading', '吞吐量公式', 'Throughput equation')}
        accent={THROUGHPUT_ACCENT}
        align="center"
      >
        <FormulaRow
          testId="walker-throughput-formula"
          accent={THROUGHPUT_ACCENT}
          emphasis
          expression={(
            <span style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <span>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</span>
              <span>= <InlineFormulaFraction
                  numerator={<>B<sup>w</sup></>}
                  denominator={<>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t)</>}
                  label="beam bandwidth divided by serving users"
                /></span>
              <span>· log<sub>2</sub>(1 +</span>
              <span>γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />))</span>
            </span>
          )}
          source={isEnglish
            ? <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) is the number of users served by beam (s,v).</>
            : <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) 是波束 (s,v) 的服務人數。</>}
        />
        <FormulaRow
          testId="walker-throughput-value"
          accent={THROUGHPUT_ACCENT}
          expression={(
            <span>
              R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) ={' '}
              <strong>{formatRate(typeof linkThroughputMbps === 'number' ? linkThroughputMbps * 1e6 : null)}</strong>
            </span>
          )}
        />
      </FormulaHeader>
    </section>
  );
}
