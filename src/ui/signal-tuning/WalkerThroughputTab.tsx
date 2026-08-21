import { UI_TOKENS } from '../../constants/uiTokens';
import type { AngleAwareFormulaFrame } from '../../engine/signal/types';
import { useLocale } from '../../i18n';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { SystemAngleState } from './FormulaSymbols';
import { txBi } from './labels';
import { SIMPLIFIED_EE_BEAM_INDEX, SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { FormulaSymbolGuide } from './FormulaSymbolGuide';
import { pagePanelStyle } from './styles';

const THROUGHPUT_ACCENT = UI_TOKENS.color.semantic.info;

export function WalkerThroughputTab({
  formulaFrame = null,
}: {
  readonly formulaFrame?: AngleAwareFormulaFrame | null;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  void formulaFrame;

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
        title={say('walker.throughput.heading', 'Throughput', 'Throughput')}
        accent={THROUGHPUT_ACCENT}
        align="center"
        variant="legacy"
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
              /> · log<sub>2</sub>(1 + γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />))</span>
            </span>
          )}
          source={isEnglish
            ? <>B<sup>w</sup> is the beam bandwidth, U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) is the number of users served by beam (s,v), and γ is the same selected-link SINR.</>
            : <>B<sup>w</sup> 是波束頻寬，U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t) 是波束 (s,v) 的服務人數，γ 是同一條選定鏈路的 SINR。</>}
        />
        <FormulaSymbolGuide
          title={say('walker.throughput.symbolGuide', '符號說明', 'Symbol guide')}
          rows={[
            {
              testId: 'walker-throughput-symbol-rate',
              symbol: <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>,
              explanation: say('walker.throughput.value', '選定 UE-link 的實際速率；右側顯示本幀結果。', 'Actual rate of the selected UE-link; the right rail shows the live result.'),
              accent: THROUGHPUT_ACCENT,
            },
            {
              testId: 'walker-throughput-symbol-bandwidth',
              symbol: <>B<sup>w</sup></>,
              explanation: say('walker.throughput.bandwidth', '單一波束可用的頻寬；由左側 SINR 的頻寬控制調整。', 'Available bandwidth of one beam; adjusted by the bandwidth control in the left SINR panel.'),
              accent: UI_TOKENS.color.semantic.info,
            },
            {
              testId: 'walker-throughput-symbol-load',
              symbol: <>U<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t)</>,
              explanation: say('walker.throughput.load', '同一時間步由波束 (s,v) 服務的使用者數。', 'Number of users served by beam (s,v) at the same time step.'),
              accent: UI_TOKENS.color.semantic.good,
            },
            {
              testId: 'walker-throughput-symbol-sinr',
              symbol: <>γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>,
              explanation: say('walker.throughput.gamma', '沿用 SINR 分頁的同一條選定鏈路 SINR，不在此重複展開。', 'The same selected-link SINR from the SINR page; it is not expanded again here.'),
              accent: UI_TOKENS.color.semantic.tuning,
            },
          ]}
        />
      </FormulaHeader>
    </section>
  );
}
