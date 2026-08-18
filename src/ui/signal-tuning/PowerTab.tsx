import { useLocale } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { NumericControl } from './Controls';
import { FormulaHeader, FormulaRow, InlineFormulaFraction, renderFormulaText } from './FormulaHeader';
import { formatPower } from './formatters';
import { txBi } from './labels';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import {
  captionTextStyle,
  controlStackStyle,
  groupTitleStyle,
  pagePanelStyle,
} from './styles';

const POWER_ACCENT = UI_TOKENS.color.semantic.good;

/**
 * Canonical power inputs for the homepage's left rail.
 *
 * This component deliberately has no result projection. Changing one of the
 * two RF-cap inputs ask the shared producer to rebuild the immutable frame; the
 * derived P^r, P^o, P^p, and P^N values are owned by the shared analysis frame.
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
        caption={say(
          'panel.power.scope',
          '調整功率上限與功耗參數；需求功率、實際 RF 輸出、PA 效率、PA 輸入與系統功率由這些輸入計算。',
          'Adjust power caps and consumption inputs; requested power, RF output, PA efficiency, PA input, and system power are calculated from them.',
        )}
        help={{
          helpId: 'panel.power.canonicalHelp',
          body: say(
            'panel.power.help',
            '先將每位使用者的需求功率聚合到波束，再依序套用波束上限與衛星上限；PA 效率、PA 輸入與系統功率使用套用上限後的 RF 輸出。',
            'Aggregate user requests per beam, apply the beam and satellite caps in order, then use the post-cap RF output for PA efficiency, PA input, and system power.',
          ),
        }}
      >
        <FormulaRow
          testId="power-canonical-formula-row-system"
          accent={POWER_ACCENT}
          emphasis
          expression={<>P<sup>N</sup>(t, θ) = P<sup>f</sup>(t) + Σ<sub>s,v</sub>P<sup>p</sup><sub>s,v</sub>(t, θ)</>}
          note="W"
          source={say(
            'panel.power.formula.systemSource',
            'P^f 是固定／circuit overhead 的總量；P^N 是系統總功率。',
            'P^f is aggregate fixed/circuit overhead; P^N is total system power.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-cap"
          accent={POWER_ACCENT}
          expression={<>P<sup>r</sup><sub>s,v</sub>(t, θ) = max<sub>u:x<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)=1</sub> p<sup>r</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
          source={say(
            'panel.power.formula.capSource',
            'P^r 是同一波束內已服務使用者需求功率的最大值；空集合時為 0。',
            'P^r is the maximum requested power among served users on one beam; it is 0 for an empty set.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-pa"
          accent={POWER_ACCENT}
          expression={(
            <>
              P<sup>o</sup><sub>s,v</sub>(t, θ) = z<sub>s,v</sub>(t)P<sup>r</sup><sub>s,v</sub>(t, θ), P<sup>p</sup><sub>s,v</sub>(t, θ) = <InlineFormulaFraction
                numerator={<>P<sup>o</sup><sub>s,v</sub>(t, θ)</>}
                denominator={<>η<sub>s,v</sub>(t, θ)</>}
                label="actual RF output divided by PA efficiency"
              />
            </>
          )}
          source={say(
            'panel.power.formula.paSource',
            'P^o 是共用的實際 RF 輸出；P^p 由 PA 效率 η 推導。',
            'P^o is the shared actual RF output; P^p is derived from PA efficiency η.',
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={groupTitleStyle}>
          {say('section.powerControls.title', '可調整的功率參數', 'Adjustable power inputs')}
        </div>

        <NumericControl
          testId="power-tab-beam-cap-control"
          symbol={<>P<sup>r</sup><sub>s,v</sub></>}
          label={say('power.beamCap.label', '每個波束的 RF 輸出上限', 'Per-beam RF output cap')}
          unit="W"
          value={parameters.beamPowerCapW}
          min={0.001}
          max={20}
          step={0.001}
          description={say('power.beamCap.description', '每個作用中波束的射頻輸出上限。', 'RF output cap for each active beam.')}
          effect={say('power.beamCap.effect', '調低後可能限制 RF 輸出，並連動 PA 效率、PA 輸入與 P^N。', 'Lowering it can cap RF output and change PA efficiency, PA input, and P^N.')}
          helpId="param.canonicalPower.beamCap"
          resetValue={formatPower(DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW)}
          accentColor={POWER_ACCENT}
          formatValue={formatPower}
          onChange={beamPowerCapW => onParametersChange({ ...parameters, beamPowerCapW })}
        />

        <NumericControl
          testId="power-tab-satellite-cap-control"
          symbol={<>Σ<sub>v</sub>P<sup>r</sup><sub>s,v</sub></>}
          label={say('power.satelliteCap.label', '衛星 RF 總上限', 'Aggregate satellite RF cap')}
          unit="W"
          value={parameters.satellitePowerCapW}
          min={0.001}
          max={40}
          step={0.001}
          description={say('power.satelliteCap.description', '單顆衛星所有作用中波束共用的射頻總上限。', 'Aggregate RF cap shared by all active beams on one satellite.')}
          effect={say('power.satelliteCap.effect', '先套用波束上限，再用此值限制衛星射頻總輸出。', 'This cap limits aggregate satellite RF output after the per-beam cap.')}
          helpId="param.canonicalPower.satelliteCap"
          resetValue={formatPower(DEFAULT_SIMULATOR_PARAMETERS.satellitePowerCapW)}
          accentColor={POWER_ACCENT}
          formatValue={formatPower}
          onChange={satellitePowerCapW => onParametersChange({ ...parameters, satellitePowerCapW })}
        />

      </div>

      <p style={captionTextStyle}>
        {renderFormulaText(say(
          'section.power.resultLocation',
          '套用波束與衛星上限得到實際 RF 輸出，再由 PA 效率與固定功耗形成 P^N。',
          'Beam and satellite caps give the RF output; PA efficiency and fixed power terms then form P^N.',
        ))}
      </p>
    </section>
  );
}
