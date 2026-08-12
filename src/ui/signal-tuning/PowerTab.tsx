import { useLocale } from '../../i18n';
import type { CanonicalEeResult } from '../../analysis/canonicalEe';
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

function formatWatts(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${value.toExponential(3)} W`;
}

function formatRatio(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toFixed(4);
}

function firstActiveBeam(result: CanonicalEeResult): number {
  const index = result.inputs.frame.beamActiveB.findIndex(active => active);
  return index >= 0 ? index : 0;
}

function beamValue(values: readonly number[], index: number): number {
  return values[index] ?? 0;
}

/**
 * Canonical power projection for the homepage sidebar.
 *
 * This component deliberately has no page-specific power formula. The parent
 * owns the canonical producer and passes its immutable result; changing one
 * of the five inputs asks the parent to rebuild that result. In particular,
 * there is no direct P_t control and no editable P_DL_actual, eta_PA, P_PA, or
 * P_sys field here.
 */
export function PowerTab({
  result,
  parameters,
  onParametersChange,
}: {
  readonly result: CanonicalEeResult;
  readonly parameters: SimulatorParameters;
  readonly onParametersChange: (next: SimulatorParameters) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const beam = firstActiveBeam(result);
  const power = result.power;

  return (
    <section
      id="tuning-page-panel-power"
      data-testid="power-canonical-page"
      data-canonical-status="canonical"
      data-canonical-contract={result.contractVersion}
      role="tabpanel"
      aria-label={say('tab.power.label', '功率', 'Power')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="power-canonical-formula-header"
        title={say('panel.power.title', '功率模型 / Canonical power model', 'Canonical power model / 功率模型')}
        accent={POWER_ACCENT}
        caption={say(
          'panel.power.scope',
          '本頁只調整 canonical EE 的限制條件與功耗模型參數；所有 p_req、P_DL_actual、η_PA、P_PA、P_sys 都由同一個 producer 唯讀推導。',
          'Adjust only canonical EE constraints and power-model inputs; p_req, P_DL_actual, η_PA, P_PA, and P_sys are read-only outputs from the same producer.',
        )}
        help={{
          helpId: 'panel.power.canonicalHelp',
          body: say(
            'panel.power.help',
            '先由服務目標與鏈路狀態求出 p_req，再依序套用每道波束上限與衛星總上限，得到實際 RF 輸出 P_DL_actual。PA 效率、PA 輸入功率與系統總功率都沿同一條 canonical power ledger 計算。',
            'The producer first derives p_req from the service target and accepted link state, applies the per-beam and satellite caps, and obtains P_DL_actual. PA efficiency, PA input power, and total system power then come from the same canonical power ledger.',
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
            'η_max 可調；η_PA 與 P_PA 由 canonical 曲線推導',
            'η_max is editable; η_PA and P_PA are derived by the canonical curve',
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
          {say('section.powerControls.title', '可調整的 canonical 輸入 / Adjustable canonical inputs', 'Adjustable canonical inputs / 可調整的 canonical 輸入')}
        </div>

        <NumericControl
          testId="power-tab-beam-cap-control"
          symbol={<>P<sub>beam,max</sub></>}
          label="P_beam,max / 每道波束 RF 上限"
          unit="W"
          value={parameters.beamPowerCapW}
          min={0.001}
          max={20}
          step={0.01}
          description="Per-beam RF output cap used by the canonical producer."
          effect="Changing this cap changes the allowable P_DL_actual and can change η_PA, P_PA, and P_sys."
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
          step={0.01}
          description="Aggregate RF output cap for all active beams on one satellite."
          effect="Changing this cap applies the satellite scale after the per-beam cap."
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
          description="Upper bound of the canonical load-dependent PA efficiency curve."
          effect="Changing η_max changes derived η_PA and therefore P_PA and P_sys."
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
          step={0.01}
          description="RF-chain power charged for each active beam in the canonical ledger."
          effect="Changing P_RFC changes the additive system-power denominator P_sys."
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
          step={0.01}
          description="Baseband power per satellite, apportioned across its active beams."
          effect="Changing P_BB changes the additive system-power denominator P_sys."
          helpId="param.canonicalPower.baseband"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(3)} W`}
          onChange={basebandPerSatelliteW => onParametersChange({ ...parameters, basebandPerSatelliteW })}
        />
      </div>

      <section
        data-testid="power-canonical-readout"
        data-readout-status="current"
        data-readout-source="canonical-result"
        style={{
          display: 'grid',
          gap: 10,
          padding: '13px 14px',
          borderRadius: UI_TOKENS.radius.lg,
          background: UI_TOKENS.color.surface.card,
          border: `1px solid ${POWER_ACCENT}3d`,
          borderLeft: `4px solid ${POWER_ACCENT}`,
        }}
      >
        <div style={groupTitleStyle}>
          {say('section.powerPreview.title', '同一 frame 的 canonical 結果 / Canonical result for this frame', 'Canonical result for this frame / 同一 frame 的 canonical 結果')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {[
            ['power-tab-requested-power-readout', <>p<sub>req</sub></>, formatWatts(beamValue(power.pReqBW, beam))],
            ['power-tab-actual-power-readout', <>P<sub>DL,actual</sub></>, formatWatts(beamValue(power.pDlActualBW, beam))],
            ['power-tab-pa-efficiency-readout', <>η<sub>PA</sub></>, formatRatio(beamValue(power.paEfficiencyB, beam))],
            ['power-tab-pa-readout', <>P<sub>PA</sub></>, formatWatts(beamValue(power.pPaBW, beam))],
            ['power-tab-rfc-readout', <>P<sub>RFC</sub> + P<sub>BB</sub> + P<sub>event</sub></>, formatWatts(beamValue(power.pRfcBW, beam) + beamValue(power.pBbBW, beam) + beamValue(power.pEventBW, beam))],
            ['power-tab-system-power-readout', <>P<sub>sys</sub></>, formatWatts(power.systemPowerW)],
          ].map(([testId, label, value]) => (
            <div
              key={testId as string}
              data-testid={testId as string}
              data-readonly="true"
              style={{
                display: 'grid',
                gap: 5,
                padding: '9px 8px',
                borderRadius: UI_TOKENS.radius.md,
                background: UI_TOKENS.color.surface.cardFaint,
                border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                textAlign: 'center',
              }}
            >
              <span style={captionTextStyle}>{label}</span>
              <strong style={{ color: POWER_ACCENT, fontSize: UI_TOKENS.type.size.bodyLg }}>{value}</strong>
            </div>
          ))}
        </div>
        <div style={captionTextStyle}>
          {say(
            'section.powerPreview.note',
            `第 ${beam + 1} 道 active beam 的 p_req 與 P_DL_actual；P_sys 是整個 canonical frame 的系統功率。這些數值不可直接編輯，必須修改上方輸入後由 producer 重新計算。`,
            `Beam ${beam + 1} p_req and P_DL_actual; P_sys is the canonical frame system power. These values are read-only and update only after the producer recomputes from the inputs above.`,
          )}
        </div>
      </section>
    </section>
  );
}
