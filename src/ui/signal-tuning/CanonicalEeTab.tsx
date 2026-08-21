import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { FormulaFraction, FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { SystemAngleState, SystemPowerSum } from './FormulaSymbols';
import { txBi } from './labels';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { pagePanelStyle } from './styles';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const EE_ACCENT = UI_TOKENS.color.semantic.warning.accent;

export function CanonicalEeTab({
  analysis,
}: {
  readonly analysis: HomepageCanonicalAnalysisState;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  void analysis;
  return (
    <section
      id="tuning-page-panel-energy"
      data-testid="homepage-ee-parameters"
      role="tabpanel"
      aria-label={say('tab.energy.label', 'EE', 'EE')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="homepage-ee-formula-header"
        title={say('homepage.ee.heading', '能源效率', 'Energy efficiency')}
        accent={EE_ACCENT}
      >
        <FormulaRow
          testId="homepage-ee-formula-instantaneous"
          accent={EE_ACCENT}
          emphasis
          expression={(
            <>
              <FormulaFraction
                lhs={<>η<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
                numerator={<>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
                denominator={<>P<sup>N</sup>(t, <SystemAngleState />)</>}
                numeratorAccent={UI_TOKENS.color.semantic.info}
                denominatorAccent={UI_TOKENS.color.semantic.good}
              />{' '}
            </>
          )}
          note="bit/J"
        />
        <FormulaRow
          testId="homepage-ee-formula-x"
          accent={UI_TOKENS.color.semantic.info}
          expression={<>x<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t) ∈ {'{'}0, 1{'}'}</>}
          note="0/1"
          source={say(
            'homepage.ee.x.source',
            'x_{u,s,v}(t) 是連線指示；1 表示使用者 u 在時間 t 採用鏈路 (s,v)，0 表示未採用。',
            'x_{u,s,v}(t) is the link-association indicator; 1 means user u selects link (s,v) at time t, and 0 means it does not.',
          )}
        />
        <FormulaRow
          testId="homepage-ee-formula-rate"
          accent={UI_TOKENS.color.semantic.info}
          expression={(
            <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) = <InlineFormulaFraction
              numerator={<>B<sup>w</sup></>}
              denominator={<>U<sub>s,v</sub>(t)</>}
              label="beam bandwidth divided by serving users"
            /> log<sub>2</sub>(1 + γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />))</>
          )}
          note="bit/s"
          source={say(
            'homepage.ee.rate.source',
            'R_{u,s,v}(t,θ) 是鏈路實際速率，由波束頻寬 B^w、服務人數 U_{s,v}(t) 與鏈路 γ_{u,s,v}(t,θ) 決定。',
            'R_{u,s,v}(t,θ) is the realized link rate, determined by beam bandwidth B^w, serving users U_{s,v}(t), and link γ_{u,s,v}(t,θ).',
          )}
        />
        <FormulaRow
          testId="homepage-ee-formula-system-power"
          accent={UI_TOKENS.color.semantic.good}
          expression={<>P<sup>N</sup>(t, <SystemAngleState />) = P<sup>f</sup>(t) + <SystemPowerSum /></>}
          note="W"
          source={say(
            'homepage.ee.systemPower.source',
            'P^N(t,θ) 是共同系統總功率，由固定功率 P^f(t) 與所有作用中鏈路的 P^p_{u′,s′,v′}(t,θ_{u′,s′,v′}) 組成。',
            'P^N(t,θ) is common system power, composed of fixed power P^f(t) and P^p_{u′,s′,v′}(t,θ_{u′,s′,v′}) across active links.',
          )}
        />
      </FormulaHeader>

      <p style={{ margin: 0, color: 'rgba(255,255,255,0.68)', lineHeight: 1.55 }}>
        {say(
          'homepage.ee.scope',
          '左側保留 EE 的定義與符號關係；實際 η 值、速率與系統功率由右側顯示。',
          'The left rail keeps the EE definition and symbol relationships; the actual η, rate, and system power are shown on the right.',
        )}
      </p>
    </section>
  );
}
