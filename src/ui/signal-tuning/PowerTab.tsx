import { useLocale } from '../../i18n';
import type { SimulatorParameters } from '../../simulator/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { NumericControl } from './Controls';
import { FormulaHeader, FormulaRow } from './FormulaHeader';
import { txBi } from './labels';
import {
  captionTextStyle,
  controlStackStyle,
  groupTitleStyle,
  pagePanelStyle,
} from './styles';

const POWER_ACCENT = UI_TOKENS.color.semantic.good;

function formatRatio(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toFixed(4);
}

/**
 * Canonical power inputs for the homepage's left rail.
 *
 * This component deliberately has no result projection. Changing one of the
 * five inputs asks the shared producer to rebuild the immutable frame; p_req,
 * P_DL_actual, eta_PA, P_PA, and P_sys are owned by the right result rail.
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
          '本頁調整 EE 計算採用的功率上限與功耗參數；p_req、P_DL_actual、η_PA、P_PA、P_sys 皆由完整計算鏈推導。',
          'This page adjusts the power caps and consumption inputs used by EE; p_req, P_DL_actual, eta_PA, P_PA, and P_sys are derived by the full calculation chain.',
        )}
        help={{
          helpId: 'panel.power.canonicalHelp',
          body: say(
            'panel.power.help',
            '先由服務目標與鏈路狀態求出 p_req，再依序套用每道波束上限與衛星總上限，得到實際 RF 輸出 P_DL_actual。PA 效率、PA 輸入功率與系統總功率都沿同一條功率計算鏈取得。',
            'The calculation first derives p_req from the service target and accepted link state, applies the per-beam and satellite caps, and obtains P_DL_actual. PA efficiency, PA input power, and total system power then follow the same power chain.',
          ),
        }}
      >
        <FormulaRow
          testId="power-canonical-formula-row-cap"
          accent={POWER_ACCENT}
          emphasis
          expression={<>p<sub>req</sub> → P<sub>beam,max</sub> → P<sub>sat,max</sub> → P<sub>DL,actual</sub></>}
          note="W"
          source={say(
            'panel.power.formula.capSource',
            '前兩項是可調上限；P_DL_actual 是 producer 的唯讀輸出',
            'The first two terms are editable caps; P_DL_actual is the producer readout',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-pa"
          accent={POWER_ACCENT}
          expression={<>η<sub>PA</sub> = f(P<sub>DL,actual</sub>, η<sub>max</sub>), P<sub>PA</sub> = P<sub>DL,actual</sub> / η<sub>PA</sub></>}
          note="ratio / W"
          source={say(
            'panel.power.formula.paSource',
            'η_max 可調；η_PA 與 P_PA 由效率曲線推導',
            'eta_max is editable; eta_PA and P_PA are derived by the efficiency curve',
          )}
        />
        <FormulaRow
          testId="power-canonical-formula-row-system"
          accent={POWER_ACCENT}
          expression={<>P<sub>sys</sub> = Σ(P<sub>PA</sub> + P<sub>RFC</sub> + P<sub>BB</sub> + P<sub>event</sub>)</>}
          note="W"
          source={say(
            'panel.power.formula.systemSource',
            'P_RFC、P_BB 可調；P_event 由事件輸入，P_sys 唯讀',
            'P_RFC and P_BB are editable; P_event is event input and P_sys is read-only',
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={groupTitleStyle}>
          {say('section.powerControls.title', '可調整的功率參數', 'Adjustable power inputs')}
        </div>

        <NumericControl
          testId="power-tab-beam-cap-control"
          symbol={<>P<sub>beam,max</sub></>}
          label="P_beam,max / 每道波束 RF 上限"
          unit="W"
          value={parameters.beamPowerCapW}
          min={0.001}
          max={20}
          step={0.001}
          description={say('power.beamCap.description', '每道 active beam 可使用的 RF 輸出上限。', 'RF output cap available to each active beam.')}
          effect={say('power.beamCap.effect', '調低後可能限制 P_DL_actual，並連動 η_PA、P_PA 與 P_sys。', 'Lowering it can cap P_DL_actual and change eta_PA, P_PA, and P_sys.')}
          helpId="param.canonicalPower.beamCap"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(2)} W`}
          onChange={beamPowerCapW => onParametersChange({ ...parameters, beamPowerCapW })}
        />

        <NumericControl
          testId="power-tab-satellite-cap-control"
          symbol={<>P<sub>sat,max</sub></>}
          label="P_sat,max / 衛星 RF 總上限"
          unit="W"
          value={parameters.satellitePowerCapW}
          min={0.001}
          max={40}
          step={0.001}
          description={say('power.satelliteCap.description', '單一衛星全部 active beams 共用的 RF 總上限。', 'Aggregate RF cap shared by all active beams on one satellite.')}
          effect={say('power.satelliteCap.effect', '先套用波束上限，再用此值限制衛星 RF 總輸出。', 'This cap limits aggregate satellite RF output after the per-beam cap.')}
          helpId="param.canonicalPower.satelliteCap"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(2)} W`}
          onChange={satellitePowerCapW => onParametersChange({ ...parameters, satellitePowerCapW })}
        />

        <NumericControl
          testId="power-tab-eta-max-control"
          symbol={<>η<sub>max</sub></>}
          label="η_max / PA 效率上限"
          unit="ratio"
          value={parameters.etaMax}
          min={0.01}
          max={1}
          step={0.01}
          description={say('power.etaMax.description', '負載相依 PA 效率曲線的最高效率。', 'Upper bound of the load-dependent PA efficiency curve.')}
          effect={say('power.etaMax.effect', '調整後會改變 η_PA，並連動 P_PA 與 P_sys。', 'Changing it updates eta_PA and therefore P_PA and P_sys.')}
          helpId="param.canonicalPower.etaMax"
          accentColor={POWER_ACCENT}
          formatValue={formatRatio}
          onChange={etaMax => onParametersChange({ ...parameters, etaMax })}
        />

        <NumericControl
          testId="power-tab-rfc-control"
          symbol={<>P<sub>RFC</sub></>}
          label="P_RFC / RF chain 功率"
          unit="W / active beam"
          value={parameters.rfcPowerW}
          min={0.001}
          max={10}
          step={0.001}
          description={say('power.rfc.description', '每道 active beam 的 RF chain 固定功耗。', 'RF-chain power charged to each active beam.')}
          effect={say('power.rfc.effect', '此值直接加進系統功率分母 P_sys。', 'This value is added directly to the system-power denominator P_sys.')}
          helpId="param.canonicalPower.rfc"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(3)} W`}
          onChange={rfcPowerW => onParametersChange({ ...parameters, rfcPowerW })}
        />

        <NumericControl
          testId="power-tab-bb-control"
          symbol={<>P<sub>BB</sub></>}
          label="P_BB / baseband 功率"
          unit="W / satellite"
          value={parameters.basebandPerSatelliteW}
          min={0.001}
          max={20}
          step={0.001}
          description={say('power.bb.description', '每顆衛星的 baseband 功耗，分攤至 active beams。', 'Baseband power per satellite, apportioned across its active beams.')}
          effect={say('power.bb.effect', '此值直接改變系統功率分母 P_sys。', 'This value directly changes the system-power denominator P_sys.')}
          helpId="param.canonicalPower.baseband"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(3)} W`}
          onChange={basebandPerSatelliteW => onParametersChange({ ...parameters, basebandPerSatelliteW })}
        />
      </div>

      <p style={captionTextStyle}>
        {say(
          'section.power.resultLocation',
          'p_req、P_DL_actual、η_PA、P_PA 與 P_sys 會在右側顯示為最終計算結果。',
          'p_req, P_DL_actual, eta_PA, P_PA, and P_sys appear in the right rail as final calculated results.',
        )}
      </p>
    </section>
  );
}
