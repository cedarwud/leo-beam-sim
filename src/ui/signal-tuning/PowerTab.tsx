import { useLocale } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { NumericControl } from './Controls';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import {
  BeamEfficiency,
  BeamRfPower,
  BeamSupplyPower,
  LinkAngle,
  LinkRfPower,
  SystemAngleState,
  SystemPowerSum,
  Theta3db,
} from './FormulaSymbols';
import { txBi } from './labels';
import { controlStackStyle, groupTitleStyle, pagePanelStyle } from './styles';
import { applyCanonicalParameterChange } from './canonicalParameterControls';

const POWER_ACCENT = UI_TOKENS.color.semantic.good;

/**
 * The power page owns the two runtime RF feasibility bounds. Actual p,
 * beam-level P^p, efficiency, and system P^N remain derived values on the
 * accepted-frame result rail; they are never direct knobs.
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
  const update = (key: 'beamPowerCapW' | 'satellitePowerCapW', value: number) => {
    onParametersChange(applyCanonicalParameterChange(parameters, key, value));
  };
  const segmentStartPowerW = parameters.beamPowerCapW / 2;
  const authoritySegmentStartPowerW = DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW / 2;

  return (
    <section
      id="tuning-page-panel-power"
      data-testid="power-canonical-page"
      data-canonical-status="canonical"
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
          '本頁調整功率可行性上限；實際鏈路功率、波束耗電與系統總功率由同一 accepted frame 推導。',
          'Adjust the power feasibility bounds here; actual link power, beam consumption, and system total power are derived from the same accepted frame.',
        )}
        help={{
          helpId: 'panel.power.canonicalHelp',
          body: say(
            'panel.power.help',
            '波束上限先限制每道 RF 輸出，衛星上限再限制同一顆衛星的作用中波束總和。p、P^p、ξ 與 P^N 都是輸出，不是直接輸入。',
            'The beam cap bounds each RF output, then the satellite cap bounds the sum of active beams on that satellite. p, P^p, ξ, and P^N are outputs, not direct inputs.',
          ),
        }}
      >
        <FormulaRow
          testId="power-canonical-formula-row-system"
          accent={POWER_ACCENT}
          emphasis
          expression={<>P<sup>N</sup>(t, <SystemAngleState />, <Theta3db />) = P<sup>f</sup>(t) + <SystemPowerSum /></>}
          note="W"
          source={say(
            'panel.power.formula.systemSource',
            'P^N 是系統總功率；P^p 以衛星—波束 (s,v) 聚合，並保留全系統角度狀態。',
            'P^N is system total power; P^p is aggregated by satellite-beam (s,v) and keeps the full system angle state.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-beam-aggregation"
          accent={POWER_ACCENT}
          emphasis
          expression={(
            <><BeamRfPower /> = max<sub>u:x<sub>u,s,v</sub>(t)=1</sub> <LinkRfPower /></>
          )}
          source={say(
            'panel.power.formula.beamAggregationSource',
            '波束 RF 功率取實際服務鏈路功率的最大值；同一波束只有一個功率放大器，不對服務使用者逐一加總。',
            'Beam RF power is the maximum actual RF power among served links; one physical beam has one power amplifier, so served users are not summed.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-pa"
          accent={POWER_ACCENT}
          expression={<><BeamSupplyPower /> = <InlineFormulaFraction
            numerator={<BeamRfPower />}
            denominator={<BeamEfficiency />}
            label="beam power divided by beam efficiency"
          /></>}
          source={say(
            'panel.power.formula.paSource',
            'P^p 是單一道波束的電源端功率；由波束最大 RF 功率 p_{s,v} 除以同一波束效率 ξ_{s,v} 得到。',
            'P^p is the power-stage consumption of one beam; it is the beam maximum RF power p_{s,v} divided by the same beam efficiency ξ_{s,v}.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-segment-start"
          accent={POWER_ACCENT}
          expression={<>p<sub>u,s,v</sub>(τ<sub>u,s,v</sub>, <LinkAngle />, <Theta3db />) = p<sup>0</sup> = p<sub>max</sub>/2</>}
          source={say(
            'panel.power.formula.segmentStartSource',
            `每個新的連續服務片段從 p^0 開始。權威初始值為 p_max=${DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW.toFixed(2)} W，因此 p^0=${authoritySegmentStartPowerW.toFixed(3)} W；目前草稿上限對應 ${segmentStartPowerW.toFixed(3)} W。`,
            `Each new uninterrupted served segment starts at p^0. The authority initial value is p_max=${DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW.toFixed(2)} W, hence p^0=${authoritySegmentStartPowerW.toFixed(3)} W; the current draft cap gives ${segmentStartPowerW.toFixed(3)} W.`,
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-recurrence"
          accent={POWER_ACCENT}
          expression={(
            <>
              p<sub>u,s,v</sub>(t, <LinkAngle />, <Theta3db />) = p<sub>u,s,v</sub>(t−1, θ<sub>u,s,v</sub>(t−1), <Theta3db />) · <InlineFormulaFraction
                numerator={<>G<sup>T</sup>(θ<sub>u,s,v</sub>(t−1), <Theta3db />)</>}
                denominator={<>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>}
                label="previous transmit gain divided by current transmit gain"
              />
            </>
          )}
          source={say(
            'panel.power.formula.recurrenceSource',
            '同一 physical link 連續服務時，沿用前一步功率並依前後兩步的發射增益比更新；換手、中斷與重新進入服務會重新起算。',
            'While the same physical link stays continuously served, carry forward the previous power and update by the transmit-gain ratio; handover, outage, and re-entry restart the segment.',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-closed"
          accent={POWER_ACCENT}
          expression={<>p<sub>u,s,v</sub>(t, <LinkAngle />, <Theta3db />) = p<sup>0</sup> · <InlineFormulaFraction
            numerator={<>G<sup>T</sup>(θ<sub>u,s,v</sub>(τ<sub>u,s,v</sub>), <Theta3db />)</>}
            denominator={<>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>}
            label="segment-start to current transmit gain ratio"
          /></>}
          source={say(
            'panel.power.formula.closedSource',
            '這是同一 served segment 內的 telescoped 形式，不跨 handover、outage、unserved、re-entry 或 episode reset。',
            'This is the telescoped form within one served segment; it does not cross handover, outage, unserved, re-entry, or an episode reset.',
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={groupTitleStyle}>
          {say('section.powerControls.title', '可調整的功率輸入', 'Adjustable power inputs')}
        </div>
        <NumericControl
          testId="power-tab-beam-cap-control"
          symbol={<>p<sub>max</sub></>}
          label="每道波束 RF 輸出上限"
          unit="W"
          value={parameters.beamPowerCapW}
          min={0.1}
          max={20}
          step={0.01}
          description="Per-beam RF output cap used by the canonical runtime feasibility check."
          effect="Changing this cap changes the allowable actual RF output and can change the derived power and EE values."
          source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · per-beam RF output cap"
          helpId="param.canonicalPower.beamCap"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(2)} W`}
          onChange={beamPowerCapW => update('beamPowerCapW', beamPowerCapW)}
        />
        <NumericControl
          testId="power-tab-satellite-cap-control"
          symbol={<>P<sub>sat,max</sub></>}
          label="每顆衛星 RF 輸出總上限"
          unit="W"
          value={parameters.satellitePowerCapW}
          min={0.1}
          max={40}
          step={0.01}
          description="Aggregate RF output cap for the active beams on one satellite."
          effect="Changing this cap changes the satellite scale applied after each beam's RF cap."
          source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · per-satellite RF output cap"
          helpId="param.canonicalPower.satelliteCap"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(2)} W`}
          onChange={satellitePowerCapW => update('satellitePowerCapW', satellitePowerCapW)}
        />
      </div>
    </section>
  );
}
