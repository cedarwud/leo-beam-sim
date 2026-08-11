import { useLocale } from '../../i18n';
import {
  computePowerTrain,
  ENERGY_TUNING_RANGES,
  TEACHING_CLAIM_LABEL,
  type EnergyTuningState,
} from '../../teaching';
import type { SignalTuningState } from '../../signalTuning';
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

function formatWatts(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)} W`;
}

/**
 * Teaching-only power controls and the instantaneous power-train preview.
 *
 * This deliberately reads the existing signal/energy state rather than
 * introducing a second power model. The preview is the pedagogical
 * `computePowerTrain` chain; it is not a canonical system-power frame.
 */
export function PowerTab({
  tuning,
  energyTuning,
  onTuningChange,
  onEnergyTuningChange,
  onEnergyTuningReset,
}: {
  tuning: SignalTuningState;
  energyTuning: EnergyTuningState;
  onTuningChange: (next: SignalTuningState) => void;
  onEnergyTuningChange: (next: EnergyTuningState) => void;
  onEnergyTuningReset?: () => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const powerTrain = computePowerTrain(tuning.maxTxPowerDbm, energyTuning);

  return (
    <section
      id="tuning-page-panel-power"
      data-testid="power-teaching-page"
      data-teaching-claim={TEACHING_CLAIM_LABEL}
      data-canonical-status="non-canonical"
      role="tabpanel"
      aria-label={say('tab.power.label', '功率', 'Power')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="power-teaching-formula-header"
        title={say('panel.power.title', '功率鏈', 'Power train')}
        accent={POWER_ACCENT}
        caption={say(
          'panel.power.scope',
          '這是可操作的教學功率投影：P_RF → PA 輸入功率 → 固定電路功耗。它不是 canonical system-power frame。',
          'Interactive teaching projection: P_RF → PA input power → fixed circuit draw. It is not the canonical system-power frame.',
        )}
        help={{
          helpId: 'panel.power.teachingHelp',
          body: say(
            'panel.power.help',
            '本頁的三個控制直接寫入既有 tuning 與 energyTuning 狀態。讀數只描述教學功率鏈，不代表真實硬體耗電或 canonical system power。',
            'These three controls write the existing tuning and energyTuning state. The preview describes only the teaching power train, not hardware consumption or canonical system power.',
          ),
        }}
      >
        <FormulaRow
          testId="power-teaching-formula-row"
          accent={POWER_ACCENT}
          emphasis
          expression={<>P<sub>total,teaching</sub> = P<sub>RF</sub> / η<sub>PA</sub> + P<sub>circuit</sub></>}
          note="W"
          source={say(
            'panel.power.formula.source',
            'P_tx 來自 SINR；η_PA 與 P_circuit 由本頁控制',
            'P_tx comes from SINR; η_PA and P_circuit are controlled here',
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={groupTitleStyle}>{say('section.powerControls.title', '可操作參數', 'Adjustable inputs')}</div>
          <button
            type="button"
            data-testid="power-parameters-reset"
            onClick={onEnergyTuningReset}
            disabled={onEnergyTuningReset === undefined}
            style={{
              border: `1px solid ${POWER_ACCENT}66`,
              borderRadius: UI_TOKENS.radius.md,
              background: `${POWER_ACCENT}18`,
              color: POWER_ACCENT,
              padding: '4px 8px',
              fontSize: UI_TOKENS.type.size.tiny,
              fontWeight: UI_TOKENS.type.weight.heavy,
              cursor: onEnergyTuningReset === undefined ? 'not-allowed' : 'pointer',
              opacity: onEnergyTuningReset === undefined ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {say('panel.power.restore.label', '恢復預設', 'Reset')}
          </button>
        </div>

        <NumericControl
          testId="power-tab-tx-power-control"
          symbol={<>P<sub>t</sub></>}
          label="Per-beam transmit power"
          labelKey="param.maxTxPowerDbm.label"
          unit="dBm"
          unitKey="param.maxTxPowerDbm.unit"
          value={tuning.maxTxPowerDbm}
          min={10}
          max={60}
          step={0.5}
          description="Base transmit power before dynamic power-control overrides."
          effect="Raising it increases RF output and the teaching PA/total-power preview."
          helpId="param.powerTab.maxTxPowerDbm"
          helpBodyKey="param.maxTxPowerDbm.help"
          helpEffectKey="param.maxTxPowerDbm.effect"
          accentColor={POWER_ACCENT}
          onChange={maxTxPowerDbm => onTuningChange({ ...tuning, maxTxPowerDbm })}
        />

        <NumericControl
          testId="power-tab-pa-efficiency-control"
          symbol={<>η<sub>PA</sub></>}
          label="PA efficiency"
          labelKey="param.paEfficiency.label"
          unit="ratio"
          unitKey="param.paEfficiency.unit"
          value={energyTuning.paEfficiency}
          min={ENERGY_TUNING_RANGES.paEfficiency.min}
          max={ENERGY_TUNING_RANGES.paEfficiency.max}
          step={ENERGY_TUNING_RANGES.paEfficiency.step}
          description="Fraction of PA input power delivered as RF output."
          effect="Raising it lowers the teaching PA input power needed for the same P_RF."
          helpId="param.powerTab.paEfficiency"
          helpBodyKey="param.paEfficiency.help"
          helpEffectKey="param.paEfficiency.effect"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(2)} (${Math.round(value * 100)}%)`}
          onChange={paEfficiency => onEnergyTuningChange({ ...energyTuning, paEfficiency })}
        />

        <NumericControl
          testId="power-tab-circuit-power-control"
          symbol={<>P<sub>circuit</sub></>}
          label="Circuit power"
          labelKey="param.circuitPowerW.label"
          unit="W"
          unitKey="param.circuitPowerW.unit"
          value={energyTuning.circuitPowerW}
          min={ENERGY_TUNING_RANGES.circuitPowerW.min}
          max={ENERGY_TUNING_RANGES.circuitPowerW.max}
          step={ENERGY_TUNING_RANGES.circuitPowerW.step}
          description="Fixed teaching-only electronics draw, independent of RF load."
          effect="Raising it adds the same amount to P_total and lowers teaching EE."
          helpId="param.powerTab.circuitPowerW"
          helpBodyKey="param.circuitPowerW.help"
          helpEffectKey="param.circuitPowerW.effect"
          accentColor={POWER_ACCENT}
          formatValue={value => `${value.toFixed(0)} W`}
          onChange={circuitPowerW => onEnergyTuningChange({ ...energyTuning, circuitPowerW })}
        />
      </div>

      <section
        data-testid="power-teaching-preview"
        data-readout-status={powerTrain === null ? 'absent' : 'current'}
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
        <div style={groupTitleStyle}>{say('section.powerPreview.title', '目前教學功率', 'Current teaching preview')}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {[
            ['power-tab-rf-readout', <>P<sub>RF</sub></>, powerTrain ? formatWatts(powerTrain.rfTxPowerW) : '—'],
            ['power-tab-pa-readout', <>P<sub>PA</sub></>, powerTrain ? formatWatts(powerTrain.paInputW) : '—'],
            ['power-tab-total-readout', <>P<sub>total</sub></>, powerTrain ? formatWatts(powerTrain.totalPowerW) : '—'],
          ].map(([testId, label, value]) => (
            <div
              key={testId as string}
              data-testid={testId as string}
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
            '非 canonical 教學讀數；只作為調整參數時觀察功率鏈因果的即時投影。',
            'Non-canonical teaching readout for observing the power-chain effect of each control.',
          )}
        </div>
      </section>
    </section>
  );
}
