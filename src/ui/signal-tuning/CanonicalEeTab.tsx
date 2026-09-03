import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { NumericControl } from './Controls';
import { FormulaFraction, FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import {
  LinkEnergyEfficiency,
  LinkRate,
  LinkSinr,
  SystemAngleState,
  SystemPowerSum,
  Theta3db,
} from './FormulaSymbols';
import { txBi } from './labels';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { controlStackStyle, groupTitleStyle, pagePanelStyle } from './styles';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';
import { applyCanonicalParameterChange } from './canonicalParameterControls';

const EE_ACCENT = UI_TOKENS.color.semantic.warning.accent;

export function CanonicalEeTab({
  analysis,
}: {
  readonly analysis: HomepageCanonicalAnalysisState;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const parameters = analysis.parameters ?? DEFAULT_SIMULATOR_PARAMETERS;
  const update = (
    key: 'etaMax' | 'backoffDb' | 'rfcPowerW' | 'basebandPerSatelliteW',
    value: number,
  ) => {
    analysis.setParameters(applyCanonicalParameterChange(parameters, key, value));
  };
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
                lhs={<LinkEnergyEfficiency />}
                numerator={<LinkRate />}
                denominator={<>P<sup>N</sup>(t, <SystemAngleState />, <Theta3db />)</>}
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
            <><LinkRate /> = <InlineFormulaFraction
              numerator={<>B<sup>w</sup></>}
              denominator={<>U<sub>s,v</sub>(t)</>}
              label="beam bandwidth divided by serving users"
            /> log<sub>2</sub>(1 + <LinkSinr />)</>
          )}
          note="bit/s"
          source={say(
            'homepage.ee.rate.source',
            'R_{u,s,v}(t,θ,θ_{3dB}) 是鏈路實際速率，由波束頻寬 B^w、服務人數 U_{s,v}(t) 與鏈路 γ_{u,s,v}(t,θ,θ_{3dB}) 決定。',
            'R_{u,s,v}(t,θ,θ_{3dB}) is the realized link rate, determined by beam bandwidth B^w, serving users U_{s,v}(t), and link γ_{u,s,v}(t,θ,θ_{3dB}).',
          )}
        />
        <FormulaRow
          testId="homepage-ee-formula-system-power"
          accent={UI_TOKENS.color.semantic.good}
          expression={<>P<sup>N</sup>(t, <SystemAngleState />, <Theta3db />) = P<sup>f</sup>(t) + <SystemPowerSum /></>}
          note="W"
          source={say(
            'homepage.ee.systemPower.source',
            'P^N(t,θ,θ_{3dB}) 是共同系統總功率，由固定功率 P^f(t) 與所有作用中波束的 P^p_{s′,v′}(t,θ,θ_{3dB}) 組成。',
            'P^N(t,θ,θ_{3dB}) is common system power, composed of fixed power P^f(t) and beam-level P^p_{s′,v′}(t,θ,θ_{3dB}) across active beams.',
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle} data-testid="ee-canonical-controls">
        <div style={groupTitleStyle}>
          {say('section.eeControls.title', '可調整的能源模型輸入', 'Adjustable energy-model inputs')}
        </div>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}>
          {say(
            'section.eeControls.boundary',
            'ξ_max 是功率轉換效率上限；η 仍保留給鏈路能源效率，不把兩者混用。',
            'ξ_max is the power-conversion efficiency cap; η remains the link energy-efficiency symbol and is not reused for the cap.',
          )}
        </p>
        <NumericControl
          testId="ee-tab-eta-max-control"
          symbol={<>ξ<sub>max</sub></>}
          label={say('homepage.ee.etaMax.label', 'PA 效率上限', 'PA efficiency cap')}
          unit="ratio"
          value={parameters.etaMax}
          min={0.01}
          max={1}
          step={0.01}
          description={say('homepage.ee.etaMax.description', '射頻輸出轉換至電源端的效率上限。', 'Upper bound on RF-output to supply-power conversion efficiency.')}
          effect={say('homepage.ee.etaMax.effect', '提高 ξ_max 會改變 P^p，並連帶改變系統功率與 η。', 'Increasing ξ_max changes P^p and therefore system power and η.')}
          resetValue={DEFAULT_SIMULATOR_PARAMETERS.etaMax.toFixed(2)}
          source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · PA efficiency cap"
          helpId="param.canonicalEe.etaMax"
          accentColor={EE_ACCENT}
          formatValue={value => value.toFixed(2)}
          onChange={etaMax => update('etaMax', etaMax)}
        />
        <NumericControl
          testId="ee-tab-backoff-control"
          symbol={<>BO</>}
          label={say('homepage.ee.backoff.label', 'PA 輸出回退', 'PA output backoff')}
          unit="dB"
          value={parameters.backoffDb}
          min={0}
          max={10}
          step={0.1}
          description={say('homepage.ee.backoff.description', '由功率上限推導飽和功率的回退量。', 'Backoff used to derive the saturation power from the power cap.')}
          effect={say('homepage.ee.backoff.effect', '調整回退會改變 ξ 與 P^p 的功率模型，並連帶改變系統功率與 η。', 'Changing backoff changes the ξ and P^p power model and therefore system power and η.')}
          resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.backoffDb.toFixed(1)} dB`}
          source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · PA output backoff"
          helpId="param.canonicalEe.backoff"
          accentColor={EE_ACCENT}
          formatValue={value => `${value.toFixed(1)} dB`}
          onChange={backoffDb => update('backoffDb', backoffDb)}
        />
        <NumericControl
          testId="ee-tab-rfc-control"
          symbol={<>P<sub>RFC</sub></>}
          label={say('homepage.ee.rfc.label', '每道作用中波束的 RF chain 功率', 'RF-chain power per active beam')}
          unit="W/beam"
          value={parameters.rfcPowerW}
          min={0.001}
          max={10}
          step={0.001}
          description={say('homepage.ee.rfc.description', '每道作用中波束分攤的固定 RF chain 功率。', 'Fixed RF-chain power assigned to each active beam.')}
          effect={say('homepage.ee.rfc.effect', '提高 RF chain 功率會提高 P^f、系統功率並降低 η。', 'Increasing RF-chain power raises P^f and system power, reducing η.')}
          resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.rfcPowerW.toFixed(3)} W/beam`}
          source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · RF-chain power per active beam"
          helpId="param.canonicalEe.rfc"
          accentColor={EE_ACCENT}
          formatValue={value => `${value.toFixed(3)} W`}
          onChange={rfcPowerW => update('rfcPowerW', rfcPowerW)}
        />
        <NumericControl
          testId="ee-tab-bb-control"
          symbol={<>P<sub>BB</sub></>}
          label={say('homepage.ee.baseband.label', '每顆啟用衛星的 baseband 功率', 'Baseband power per active satellite')}
          unit="W/satellite"
          value={parameters.basebandPerSatelliteW}
          min={0.001}
          max={20}
          step={0.001}
          description={say('homepage.ee.baseband.description', '每顆啟用衛星分攤的固定 baseband 功率。', 'Fixed baseband power assigned to each active satellite.')}
          effect={say('homepage.ee.baseband.effect', '提高 baseband 功率會提高 P^f、系統功率並降低 η。', 'Increasing baseband power raises P^f and system power, reducing η.')}
          resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.basebandPerSatelliteW.toFixed(3)} W/satellite`}
          source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · baseband power per active satellite"
          helpId="param.canonicalEe.baseband"
          accentColor={EE_ACCENT}
          formatValue={value => `${value.toFixed(3)} W`}
          onChange={basebandPerSatelliteW => update('basebandPerSatelliteW', basebandPerSatelliteW)}
        />
      </div>

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
