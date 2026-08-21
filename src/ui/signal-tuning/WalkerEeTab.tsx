import { UI_TOKENS } from '../../constants/uiTokens';
import type { AngleAwareFormulaFrame } from '../../engine/signal/types';
import { useLocale } from '../../i18n';
import { FormulaFraction, FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { SystemAngleState, SystemPowerSum } from './FormulaSymbols';
import { txBi } from './labels';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { FormulaSymbolGuide } from './FormulaSymbolGuide';
import { pagePanelStyle } from './styles';

const EE_ACCENT = UI_TOKENS.color.semantic.warning.accent;

export function WalkerEeTab({
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
      id="tuning-page-panel-energy"
      data-testid="walker-ee-page"
      role="tabpanel"
      aria-label={say('tab.energy.label', 'EE', 'EE')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="walker-ee-formula-header"
        title="EE"
        accent={EE_ACCENT}
        align="center"
        variant="legacy"
      >
        <FormulaRow
          testId="walker-ee-formula-instantaneous"
          accent={EE_ACCENT}
          emphasis
          expression={(
            <FormulaFraction
              lhs={<>η<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              numerator={<>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              denominator={<>P<sup>N</sup>(t, <SystemAngleState />)</>}
              numeratorAccent={UI_TOKENS.color.semantic.info}
              denominatorAccent={UI_TOKENS.color.semantic.good}
              lhsFontSize={21}
              termFontSize={18}
            />
          )}
          source={say(
            'walker.ee.formulaExplanation',
            'η 是選定 UE-link 的 throughput 除以共同系統總功率；右側顯示此幀的實際值。',
            'η is the selected UE-link throughput divided by shared system total power; the right rail shows the live value for this frame.',
          )}
        />
        <FormulaSymbolGuide
          title={say('walker.ee.symbolGuide', '符號說明', 'Symbol guide')}
          rows={[
            {
              testId: 'walker-ee-symbol-x',
              symbol: <>x<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>,
              explanation: isEnglish
                ? <>x<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t) ∈ {'{'}0, 1{'}'}; it is 1 when the selected UE-link is served and 0 otherwise.</>
                : <>x<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t) ∈ {'{'}0, 1{'}'}；選定 UE-link 服務中為 1，否則為 0。</>,
              accent: UI_TOKENS.color.semantic.tuning,
            },
            {
              testId: 'walker-ee-symbol-rate',
              symbol: <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>,
              explanation: isEnglish
                ? <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) = <InlineFormulaFraction numerator={<>B<sup>w</sup></>} denominator={<>U<sub>s,v</sub>(t)</>} label="beam bandwidth divided by serving users" /> · log<sub>2</sub>(1 + γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)).</>
                : <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) = <InlineFormulaFraction numerator={<>B<sup>w</sup></>} denominator={<>U<sub>s,v</sub>(t)</>} label="beam bandwidth divided by serving users" /> · log<sub>2</sub>(1 + γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />))；分子沿用同一條選定鏈路。</>,
              accent: UI_TOKENS.color.semantic.info,
            },
            {
              testId: 'walker-ee-symbol-system-power',
              symbol: <>P<sup>N</sup>(t, <SystemAngleState />)</>,
              explanation: isEnglish
                ? <>P<sup>N</sup>(t, <SystemAngleState />) = P<sup>f</sup>(t) + <SystemPowerSum />; this is the shared system denominator.</>
                : <>P<sup>N</sup>(t, <SystemAngleState />) = P<sup>f</sup>(t) + <SystemPowerSum />；這是所有作用中鏈路共用的系統分母。</>,
              accent: UI_TOKENS.color.semantic.good,
            },
          ]}
        />
      </FormulaHeader>
    </section>
  );
}
