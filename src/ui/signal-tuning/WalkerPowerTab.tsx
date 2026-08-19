import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { resolveMaxTxPowerDbm, type Profile } from '../../profiles/types';
import type { SignalTuningState } from '../../signalTuning';
import { NumericControl } from './Controls';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { SystemAngleState } from './FormulaSymbols';
import { formatDbm } from './formatters';
import { txBi } from './labels';
import { controlStackStyle, groupTitleStyle, pagePanelStyle } from './styles';

const POWER_ACCENT = UI_TOKENS.color.semantic.good;

export function WalkerPowerTab({
  baseProfile,
  tuning,
  onTuningChange,
}: {
  readonly baseProfile: Profile;
  readonly tuning: SignalTuningState;
  readonly onTuningChange: (next: SignalTuningState) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);

  return (
    <section
      id="tuning-page-panel-power"
      data-testid="walker-power-page"
      role="tabpanel"
      aria-label={say('tab.power.label', '功率', 'Power')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="walker-power-formula-header"
        title={say('walker.power.heading', '功率公式', 'Power equations')}
        accent={POWER_ACCENT}
        align="center"
      >
        <FormulaRow
          testId="walker-power-system-formula"
          accent={POWER_ACCENT}
          emphasis
          expression={(
            <span style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
              <span>P<sup>N</sup>(t, <SystemAngleState />)</span>
              <span>= P<sup>f</sup>(t) +</span>
              <span>Σ<sub>u′,s′,v′</sub> x<sub>u′,s′,v′</sub>(t) P<sup>p</sup><sub>u′,s′,v′</sub>(t, <SystemAngleState />)</span>
            </span>
          )}
        />
        <FormulaRow
          testId="walker-power-pa-formula"
          accent={POWER_ACCENT}
          expression={(
            <span style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
              <span>P<sup>p</sup><sub>{'u,s,v'}</sub>(t, <SystemAngleState />)</span>
              <span>=</span>
              <span><InlineFormulaFraction
                numerator={<><i>p</i><sub>{'u,s,v'}</sub>(t, <SystemAngleState />)</>}
                denominator={<>ξ<sub>{'u,s,v'}</sub>(t, <SystemAngleState />)</>}
                label="link RF power divided by effective conversion efficiency"
              /></span>
            </span>
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={groupTitleStyle}>
          {say('walker.power.input.title', '參數設定', 'Parameter setting')}
        </div>
        <NumericControl
          testId="walker-power-output-control"
          symbol={<><i>p</i><sub>{'u,s,v'}</sub>(t, <SystemAngleState />)</>}
          label={say('walker.power.output.label', '鏈路 RF 功率', 'Link RF power')}
          unit="dBm"
          value={tuning.maxTxPowerDbm}
          min={10}
          max={60}
          step={0.5}
          description={say(
            'walker.power.output.description',
            '中央場景套用到作用中 UE-link 的 RF 功率。',
            'RF power applied to active UE-links in the central scene.',
          )}
          effect={say(
            'walker.power.output.effect',
            '變更後會重新計算中央場景的接收訊號、干擾、SINR、吞吐量與能源效率。',
            'Changing it recomputes received signal, interference, SINR, throughput, and energy efficiency in the central scene.',
          )}
          helpId="param.maxTxPowerDbm"
          resetValue={formatDbm(resolveMaxTxPowerDbm(baseProfile.channel))}
          accentColor={POWER_ACCENT}
          stackHeader
          formatValue={formatDbm}
          onChange={maxTxPowerDbm => onTuningChange({ ...tuning, maxTxPowerDbm })}
        />
      </div>
    </section>
  );
}
