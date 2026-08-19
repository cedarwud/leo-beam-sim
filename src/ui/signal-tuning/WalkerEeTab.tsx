import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { FormulaFraction, FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { SystemAngleState } from './FormulaSymbols';
import { formatEnergyEfficiency } from './formatters';
import { txBi } from './labels';
import { SIMPLIFIED_EE_BEAM_INDEX, SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { pagePanelStyle } from './styles';

const EE_ACCENT = UI_TOKENS.color.semantic.warning.accent;

export function WalkerEeTab({
  linkEeMbitPerJ = null,
}: {
  readonly linkEeMbitPerJ?: number | null;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);

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
        title={say('walker.ee.heading', '能源效率公式', 'Energy-efficiency equation')}
        accent={EE_ACCENT}
        align="center"
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
        />
        <FormulaRow
          testId="walker-ee-value"
          accent={EE_ACCENT}
          expression={(
            <span>
              η<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) ={' '}
              <strong>{formatEnergyEfficiency(typeof linkEeMbitPerJ === 'number' ? linkEeMbitPerJ * 1e6 : null)}</strong>
            </span>
          )}
        />
        <FormulaRow
          testId="walker-ee-formula-x"
          accent={UI_TOKENS.color.semantic.info}
          expression={<>x<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t) ∈ {'{'}0, 1{'}'}</>}
          source={say(
            'walker.ee.x.source',
            'x 表示固定 UE-link 是否在時間 t 被選用。',
            'x indicates whether the fixed UE-link is selected at time t.',
          )}
        />
        <FormulaRow
          testId="walker-ee-formula-rate"
          accent={UI_TOKENS.color.semantic.info}
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
          source={say(
            'walker.ee.rate.source',
            'R 是固定 UE-link 的實際速率。',
            'R is the realized rate of the fixed UE-link.',
          )}
        />
        <FormulaRow
          testId="walker-ee-formula-system-power"
          accent={UI_TOKENS.color.semantic.good}
          expression={(
            <span style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
              <span>P<sup>N</sup>(t, <SystemAngleState />)</span>
              <span>= P<sup>f</sup>(t) +</span>
              <span>Σ<sub>u′,s′,v′</sub> x<sub>u′,s′,v′</sub>(t) P<sup>p</sup><sub>u′,s′,v′</sub>(t, <SystemAngleState />)</span>
            </span>
          )}
          source={say(
            'walker.ee.systemPower.source',
            'P^N 是全系統共同使用的總功率分母。',
            'P^N is the shared total-system power denominator.',
          )}
        />
      </FormulaHeader>
    </section>
  );
}
