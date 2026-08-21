import { useLocale } from '../../i18n';
import type { SimulatorParameters } from '../../simulator/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { SystemAngleState, SystemPowerSum } from './FormulaSymbols';
import { txBi } from './labels';
import { pagePanelStyle } from './styles';

const POWER_ACCENT = UI_TOKENS.color.semantic.good;

/**
 * Power is a derived quantity. This tab explains the recurrence and aggregation
 * used by the model; live values belong to the result rail.
 */
export function PowerTab({
  parameters,
  onParametersChange,
}: {
  readonly parameters: SimulatorParameters;
  readonly onParametersChange: (next: SimulatorParameters) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  void parameters;
  void onParametersChange;
  return (
    <section
      id="tuning-page-panel-power"
      data-testid="power-canonical-page"
      role="tabpanel"
      aria-label={say('tab.power.label', '功率', 'Power')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="power-canonical-formula-header"
        title={say('panel.power.title', '功率模型', 'Power model')}
        accent={POWER_ACCENT}
        caption={say('panel.power.scope', 'Power 顯示角度感知遞推與系統總和。', 'Power shows the angle-aware recurrence and system total.')}
        help={{
          helpId: 'panel.power.canonicalHelp',
          body: say(
            'panel.power.help',
            'Power 由同一時間步的鏈路功率與系統總和得到。',
            'Power is formed from the link power and system total at the same time step.',
          ),
        }}
      >
        <FormulaRow
          testId="power-canonical-formula-row-system"
          accent={POWER_ACCENT}
          emphasis
          expression={<>P<sup>N</sup>(t, <SystemAngleState />) = P<sup>f</sup>(t) + <SystemPowerSum /></>}
          note="W"
          source={say(
            'panel.power.formula.systemSource',
            'P^f 是固定功率；P^N 是所有作用中鏈路的系統總功率。',
            'P^f is fixed power; P^N is total system power across active links.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-pa"
          accent={POWER_ACCENT}
          expression={<>P<sup>p</sup><sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>) = <InlineFormulaFraction
            numerator={<>p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>}
            denominator={<>ξ<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>}
            label="link power divided by efficiency"
          /></>}
          source={say(
            'panel.power.formula.paSource',
            'P^p 是鏈路功率除以效率 ξ 後的 PA 輸入功率。',
            'P^p is the PA input power obtained by dividing link power by efficiency ξ.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-segment-start"
          accent={POWER_ACCENT}
          expression={<>p<sub>u,s,v</sub>(τ<sub>u,s,v</sub>, θ<sub>u,s,v</sub>(τ<sub>u,s,v</sub>)) = 2 W</>}
          source={say(
            'panel.power.formula.segmentStartSource',
            '每個新的 served segment 從 2 W 開始；換手、中斷或重新進入服務時不沿用舊功率。',
            'Every new served segment starts at 2 W; handover, outage, or re-entry does not reuse the old power.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-recurrence"
          accent={POWER_ACCENT}
          expression={(
            <>
              p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>(t)) = p<sub>u,s,v</sub>(t−1, θ<sub>u,s,v</sub>(t−1)) · <InlineFormulaFraction
                numerator={<>G<sup>T</sup>(θ<sub>u,s,v</sub>(t−1))</>}
                denominator={<>G<sup>T</sup>(θ<sub>u,s,v</sub>(t))</>}
                label="previous transmit gain divided by current transmit gain"
              />
            </>
          )}
          source={say(
            'panel.power.formula.recurrenceSource',
            '後續時間點沿用上一幀的 p，再依前後幀的 G^T 比例更新；初始區段從 2 W 開始。',
            'Later time points carry forward the previous-frame p and update it by the transmit-gain ratio; the initial segment starts at 2 W.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-closed"
          accent={POWER_ACCENT}
          expression={<>p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>(t)) = 2 W · <InlineFormulaFraction
            numerator={<>G<sup>T</sup>(θ<sub>u,s,v</sub>(τ<sub>u,s,v</sub>))</>}
            denominator={<>G<sup>T</sup>(θ<sub>u,s,v</sub>(t))</>}
            label="segment-start to current transmit gain ratio"
          /></>}
          source={say(
            'panel.power.formula.closedSource',
            '這是同一 served segment 內由 2 W 起點展開的形式，不跨 handover、中斷或 episode reset。',
            'This is the form expanded from the 2 W segment start; it does not cross handover, outage, or an episode reset.',
          )}
        />
      </FormulaHeader>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.68)', lineHeight: 1.55 }}>
        {say('section.power.resultLocation', '實際 p、P^p 與 P^N 由右側同一個 accepted frame 顯示。', 'The actual p, P^p, and P^N values are shown on the right from the same accepted frame.')}
      </p>
    </section>
  );
}
