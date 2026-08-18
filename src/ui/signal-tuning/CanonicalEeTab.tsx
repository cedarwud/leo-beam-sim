import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { CanonicalReadOnlyParameter } from './CanonicalParameterPrimitives';
import { FormulaFraction, FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { formatCompactNumber, formatEnergyEfficiency, formatPower } from './formatters';
import { txBi } from './labels';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { controlStackStyle, groupTitleStyle, pagePanelStyle } from './styles';
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
  const parameters = analysis.parameters;
  const calculatedEe = analysis.frame?.ee.instantaneousBitsPerJ ?? null;
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
                lhs={<>η<sup>e</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
                numerator={<>x<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
                denominator={<>Σ<sub>t</sub>P<sup>N</sup>(t, θ)Δt<sub>t</sub></>}
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
            <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) = <InlineFormulaFraction
              numerator={<>B<sup>w</sup></>}
              denominator={<>U<sub>s,v</sub>(t)</>}
              label="beam bandwidth divided by serving users"
            /> log<sub>2</sub>(1 + γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ))</>
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
          expression={<>P<sup>N</sup>(t, θ) = P<sup>f</sup>(t) + Σ<sub>s,v</sub>P<sup>p</sup><sub>s,v</sub>(t, θ)</>}
          note="W"
          source={say(
            'homepage.ee.systemPower.source',
            'P^N(t,θ) 是共同系統總功率，由固定功率 P^f(t) 與各波束 PA 輸入功率 P^p_{s,v}(t,θ) 組成。',
            'P^N(t,θ) is common system power, composed of fixed power P^f(t) and the PA input power P^p_{s,v}(t,θ) of each beam.',
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={groupTitleStyle}>
          {say('homepage.ee.calculated.title', '計算值', 'Calculated value')}
        </div>
        <CanonicalReadOnlyParameter
          testId="ee-tab-calculated-value"
          label={<>η<sup>e</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
          value={formatEnergyEfficiency(calculatedEe)}
          note={say('homepage.ee.calculated.note', '目前場景的實際能源效率', 'Calculated energy efficiency for the current frame')}
          accent={EE_ACCENT}
        />
        <div style={groupTitleStyle}>
          {say('homepage.ee.values.title', '參數值', 'Parameter values')}
        </div>
        <CanonicalReadOnlyParameter
          testId="ee-tab-eta-max-value"
          label={<>η<sub>0</sub></>}
          value={`${formatCompactNumber(parameters.etaMax, '', 4)} (${Math.round(parameters.etaMax * 100)}%)`}
          note={say('homepage.ee.etaMax.note', 'PA 效率上限', 'PA efficiency ceiling')}
          accent={EE_ACCENT}
        />
        <CanonicalReadOnlyParameter
          testId="ee-tab-backoff-value"
          label={<>BO</>}
          value={`${parameters.backoffDb.toFixed(1)} dB`}
          note={say('homepage.ee.backoff.note', 'PA 輸出回退量', 'PA output back-off')}
          accent={EE_ACCENT}
        />
        <CanonicalReadOnlyParameter
          testId="ee-tab-rfc-value"
          label={<>P<sup>c</sup></>}
          value={formatPower(parameters.rfcPowerW)}
          note={say('homepage.ee.rfc.note', '每個作用中波束的射頻鏈功率', 'RF-chain power per active beam')}
          accent={EE_ACCENT}
        />
        <CanonicalReadOnlyParameter
          testId="ee-tab-bb-value"
          label={<>P<sup>d</sup></>}
          value={formatPower(parameters.basebandPerSatelliteW)}
          note={say('homepage.ee.bb.note', '每顆衛星的基頻功率', 'Baseband power per satellite')}
          accent={EE_ACCENT}
        />
      </div>
    </section>
  );
}
