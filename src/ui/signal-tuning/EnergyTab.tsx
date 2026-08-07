import { useLocale } from '../../i18n';
import {
  DEFAULT_ENERGY_PER_HANDOVER_J,
  ENERGY_TUNING_RANGES,
  TEACHING_CLAIM_LABEL,
  type EnergyTuningState,
} from '../../teaching';
import { HelpPopover } from '../common/HelpPopover';
import { NumericControl } from './Controls';
import { FormulaHeader, FormulaRow } from './FormulaHeader';
import { txBi } from './labels';
import {
  controlStackStyle,
  groupTitleStyle,
  pagePanelStyle,
} from './styles';

const ENERGY_ACCENT = '#c3a6ff';

/**
 * The energy tab is INPUTS ONLY: the formula chain that defines the quantities,
 * and the three knobs that move them (η_PA, P_circuit, e_HO).
 *
 * It used to also carry a "power-train results (read-only)" block — P_RF, P_PA,
 * P_circuit, P_total, E_HO. That block was removed: every one of those numbers
 * is already stated by `TeachingEnergyCard` on the right-hand side, and two
 * copies of the same reading on screen at once is one copy too many — they can
 * drift, and a student cannot tell which one to believe. Values live on the
 * right; controls live here. That is also why no energy ledger is prop-drilled
 * into this component: with nothing to display, it has nothing to read.
 */
export function EnergyTab({
  maxTxPowerDbm,
  energyTuning,
  onEnergyTuningChange,
  onEnergyTuningReset,
}: {
  /**
   * Comes from the existing SINR tuning state — the two panels share one P_tx.
   * Nothing on this tab displays it; it is here because the formula rows name
   * it as their input, and because removing the prop would change the call
   * signature the panel's validate scripts already pin.
   */
  maxTxPowerDbm: number;
  energyTuning: EnergyTuningState;
  onEnergyTuningChange: (next: EnergyTuningState) => void;
  onEnergyTuningReset?: () => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);

  const wattUnit = t('common.unit.watt');
  const jouleUnit = t('common.unit.joule');

  return (
    <section
      id="tuning-page-panel-energy"
      data-testid="energy-teaching-page"
      data-teaching-claim={TEACHING_CLAIM_LABEL}
      role="tabpanel"
      aria-label={t('tab.energy.label')}
      style={pagePanelStyle}
    >
      {/*
        The whole chain, top to bottom, in the order it is actually computed:
        dBm -> watts -> amplifier draw -> total draw, then data rate, then the
        handover-energy term, then the ratio of numerator to denominator
        integrated over the run. Every line names the slider that owns its
        symbols, so "if I move eta_PA, which number moves?" is answerable
        without reading any code. The numbers themselves are on the right-hand
        energy card — these rows are definitions, not readings.
      */}
      <FormulaHeader
        testId="energy-formula-header"
        title={t('panel.energy.teachingKnobTitle')}
        accent={ENERGY_ACCENT}
        caption={t('panel.energy.teachingScopeNote')}
        action={(
          <button
            type="button"
            data-testid="energy-parameters-reset"
            onClick={onEnergyTuningReset}
            disabled={onEnergyTuningReset === undefined}
            style={{
              border: '1px solid rgba(195, 166, 255, 0.42)',
              borderRadius: 6,
              background: 'rgba(195, 166, 255, 0.10)',
              color: '#e7ddff',
              padding: '3px 7px',
              fontSize: 11,
              fontWeight: 700,
              cursor: onEnergyTuningReset === undefined ? 'not-allowed' : 'pointer',
              opacity: onEnergyTuningReset === undefined ? 0.5 : 1,
            }}
          >
            {t('panel.energy.restoreDefaults.label')}
          </button>
        )}
        // Owner call 2026-08-06: no `claim` badge. The visible "模擬資料" chip is
        // gone here for the same reason it went from `TeachingEnergyCard` — the
        // machine-readable marker stays as `data-teaching-claim` on the page
        // wrapper above, so anything needing the provenance can still read it,
        // while the student no longer reads a label whose only job was to
        // caveat numbers this tab no longer shows.
        help={{ helpId: 'panel.energy.teachingKnobHelp', body: t('panel.energy.teachingKnobHelp') }}
      >
        <FormulaRow
          testId="energy-formula-row-prf"
          accent={ENERGY_ACCENT}
          expression={<>P<sub>RF</sub> = 10<sup>(P<sub>tx</sub>/10)</sup> / 1000</>}
          note={wattUnit}
          source={say(
            'formula.ee.row.prf.source',
            'P_tx ← 「訊號品質」分頁的發射功率參數',
            'P_tx ← the transmit-power control on the Signal Quality tab',
          )}
          help={{
            helpId: 'formula.ee.row.prf',
            title: say('formula.ee.row.prf.title', 'P_RF：無線電發射功率', 'P_RF: RF transmit power'),
            body: say(
              'formula.ee.row.prf.help',
              'P_tx 以 dBm 表示，本式將其換算為瓦特；dBm 每增加 10，功率為十倍。結果即讀數區的「無線電發射功率」。',
              'P_tx is expressed in dBm; this line converts it to watts. Each additional 10 dBm multiplies the power by ten. The result is the RF transmit power reading.',
            ),
            effect: say(
              'formula.ee.row.prf.effect',
              '提高「訊號品質」分頁的發射功率，本頁各項功率讀數同步升高。',
              'Raising the transmit power on the Signal Quality tab raises every power reading on this tab.',
            ),
          }}
        />
        <FormulaRow
          testId="energy-formula-row-ppa"
          accent={ENERGY_ACCENT}
          expression={<>P<sub>PA</sub> = P<sub>RF</sub> / η<sub>PA</sub></>}
          note={wattUnit}
          source={say(
            'formula.ee.row.ppa.source',
            'η_PA ← 本頁的功率放大器效率參數',
            'η_PA ← the PA-efficiency control on this tab',
          )}
          help={{
            helpId: 'formula.ee.row.ppa',
            title: say('formula.ee.row.ppa.title', 'P_PA：功率放大器輸入功率', 'P_PA: power-amplifier input power'),
            body: say(
              'formula.ee.row.ppa.help',
              '功率放大器效率小於 1：輸出 P_RF 的射頻功率需要更高的輸入功率。η_PA = 0.35 表示輸入功率中僅 35% 轉為射頻輸出，其餘以熱的形式散失。',
              'Power-amplifier efficiency is below 1: delivering P_RF of RF output requires a higher input power. η_PA = 0.35 means 35% of the input becomes RF output and the remainder is dissipated as heat.',
            ),
            effect: say(
              'formula.ee.row.ppa.effect',
              '提高 η_PA，相同發射功率所需的輸入功率下降，P_PA 與 P_total 同步下降。',
              'Raising η_PA lowers the input power needed for the same transmit power, so both P_PA and P_total fall.',
            ),
          }}
        />
        <FormulaRow
          testId="energy-formula-row-ptotal"
          accent={ENERGY_ACCENT}
          emphasis
          expression={<>P<sub>total</sub> = P<sub>PA</sub> + P<sub>circuit</sub></>}
          note={wattUnit}
          source={say(
            'formula.ee.row.ptotal.source',
            'P_circuit ← 本頁的電路功率參數；本式是 non-canonical Run EE 的分母',
            'P_circuit ← the circuit-power control; this is the denominator of non-canonical Run EE',
          )}
          help={{
            helpId: 'formula.ee.row.ptotal',
            title: say('formula.ee.row.ptotal.title', 'P_total：教學總功率', 'P_total: teaching-scope total power'),
            body: say(
              'formula.ee.row.ptotal.help',
              'P_circuit 為與傳輸負載無關的固定消耗，涵蓋控制電路與散熱等。與放大器輸入功率相加即為當下的總消耗功率。',
              'P_circuit is the load-independent fixed consumption, covering control electronics, cooling and similar. Added to the amplifier input power it gives the total consumption at that instant.',
            ),
            effect: say(
              'formula.ee.row.ptotal.effect',
              '提高 P_circuit，總功率等量增加，能源效率隨之下降。',
              'Raising P_circuit increases the total power by the same amount, so energy efficiency falls.',
            ),
          }}
        />
        <FormulaRow
          testId="energy-formula-row-rate"
          accent={ENERGY_ACCENT}
          expression={<>R = (B / K) · log<sub>2</sub>(1 + SINR)</>}
          note={t('common.unit.mbps')}
          source={say(
            'formula.ee.row.rate.source',
            'B、K ← 「訊號品質」分頁；本式為 EE 的分子',
            'B, K ← the Signal Quality tab; this line is the numerator of EE',
          )}
          help={{
            helpId: 'formula.ee.row.rate',
            title: say('formula.ee.row.rate.title', 'R：鏈路資料傳輸率', 'R: link data rate'),
            body: say(
              'formula.ee.row.rate.help',
              '依 Shannon 容量式：SINR 越高，單位頻寬可承載的位元數越多。頻寬 B 由 K 個頻率重複使用群組分配，故除以 K。本模擬將頻譜效率上限設為 8 bit/s/Hz。',
              'From the Shannon capacity expression: the higher the SINR, the more bits a unit of bandwidth carries. Bandwidth B is divided across K reuse groups, hence the division by K. This simulation caps spectral efficiency at 8 bit/s/Hz.',
            ),
            effect: say(
              'formula.ee.row.rate.effect',
              '提高 SINR 的參數調整會提高 R；分子增加而分母不變，能源效率隨之提高。',
              'Any parameter change that raises SINR raises R. The numerator grows while the denominator is unchanged, so energy efficiency rises.',
            ),
          }}
        />
        {/* E_HO belongs in the chain BEFORE the EE line that divides by it —
            the student meets the term where it is defined, not as an unexplained
            symbol in the denominator. */}
        <FormulaRow
          testId="energy-formula-row-eho"
          accent={ENERGY_ACCENT}
          expression={<>E<sub>HO</sub> = N<sub>HO</sub> · e<sub>HO</sub></>}
          note={jouleUnit}
          source={say(
            'formula.ee.row.eho.source',
            'e_HO ← 本頁的每次換手耗能參數；N_HO ← 累積區間內的換手次數',
            'e_HO ← the per-handover energy control on this tab; N_HO ← the handover count for the accumulation window',
          )}
          help={{
            helpId: 'formula.ee.row.eho',
            title: say('formula.ee.row.eho.title', 'E_HO：換手耗能', 'E_HO: handover energy'),
            body: t('kpi.handoverEnergy.help'),
            effect: t('param.energyPerHandoverJ.effect'),
          }}
        />
        <FormulaRow
          testId="energy-formula-row-ee"
          accent={ENERGY_ACCENT}
          emphasis
          expression={<>EE<sub>teaching</sub> = Σ(R · Δt) / (Σ(P<sub>total</sub> · Δt) + E<sub>HO</sub>)</>}
          note={t('common.unit.mbitPerJoule')}
          source={say(
            'formula.ee.row.ee.source',
            'non-canonical scope 的全程累積後相除；結果顯示於右側面板',
            'Accumulated over the non-canonical scope; the result is shown in the right-hand panel',
          )}
          help={{
            helpId: 'formula.ee.row.ee',
            title: say('formula.ee.row.ee.title', 'EE_teaching：每焦耳傳輸的資料量', 'EE_teaching: data delivered per joule'),
            body: t('panel.energy.teachingScopeNote'),
            effect: say(
              'formula.ee.row.ee.effect',
              '任一參數變更會重置累積量，因不同參數組合屬於不同的實驗條件。',
              'Changing any parameter resets the accumulation, since a different parameter set is a different experimental condition.',
            ),
          }}
        />
      </FormulaHeader>

      <FormulaHeader
        testId="canonical-energy-formula-header"
        title={t('panel.energy.canonicalTitle')}
        accent="#4ADE80"
        help={{ helpId: 'panel.energy.canonicalHelp', body: t('panel.energy.canonicalHelp') }}
      >
        <FormulaRow
          testId="canonical-formula-row-psys"
          accent="#4ADE80"
          expression={<>P<sub>sys</sub> = Σ<sub>s,v</sub> P<sup>tot</sup><sub>s,v</sub></>}
          note={wattUnit}
          source={say('formula.canonical.psys.source', '來自核心模組', 'Provided by core module')}
          help={{
            helpId: 'kpi.systemPowerW.help',
            title: t('kpi.systemPowerW.label'),
            body: t('kpi.systemPowerW.help'),
            effect: say('formula.canonical.psys.effect', '不受單一連線參數影響。', 'Not affected by single-link parameters.'),
          }}
        />
        <FormulaRow
          testId="canonical-formula-row-r1u"
          accent="#4ADE80"
          expression={<>r<sub>1,u</sub> = R<sub>u</sub> / P<sub>sys</sub></>}
          note={t('common.unit.mbitPerJoule')}
          source={say('formula.canonical.r1u.source', '由 canonical producer 保留每位使用者貢獻', 'Preserved per-user contribution from the canonical producer')}
          help={{
            helpId: 'kpi.contributionSumMbitPerJ',
            title: t('kpi.perUserContribution.label'),
            body: t('kpi.contributionSumMbitPerJ.help'),
            effect: say('formula.canonical.r1u.effect', '每位使用者使用同一個 P_sys 分母；不是個人實體發射功率。', 'Every user uses the same P_sys denominator; this is not personal physical transmit power.'),
          }}
        />
        <FormulaRow
          testId="canonical-formula-row-eeinst"
          accent="#4ADE80"
          expression={<>EE<sub>inst</sub> = Σ<sub>u</sub> R<sub>u</sub> / P<sub>sys</sub></>}
          note={t('common.unit.mbitPerJoule')}
          source={say('formula.canonical.eeinst.source', '來自核心模組', 'Provided by core module')}
          help={{
            helpId: 'kpi.eeInstMbitPerJ.help',
            title: t('kpi.eeInstMbitPerJ.label'),
            body: t('kpi.eeInstMbitPerJ.help'),
            effect: say('formula.canonical.eeinst.effect', '瞬時計算之系統整體能源效率。', 'Instantaneous system-wide energy efficiency.'),
          }}
        />
        <FormulaRow
          testId="canonical-formula-row-identity"
          accent="#4ADE80"
          emphasis
          expression={<>Σ<sub>u</sub> r<sub>1,u</sub> = EE<sub>inst</sub></>}
          note={t('common.unit.mbitPerJoule')}
          source={say('formula.canonical.identity.source', '右側面板顯示 PASS / FAIL / PENDING', 'The right-hand panel reports PASS / FAIL / PENDING')}
          help={{
            helpId: 'kpi.contributionSumMbitPerJ',
            title: t('panel.energy.canonicalIdentity.label'),
            body: t('kpi.contributionSumMbitPerJ.help'),
            effect: say('formula.canonical.identity.effect', '未取得 producer 值時維持 PENDING，不把缺值當成零。', 'Without producer values it stays PENDING; missing values are never treated as zero.'),
          }}
        />
        <FormulaRow
          testId="canonical-formula-row-eeeval"
          accent="#4ADE80"
          emphasis
          expression={<>EE<sub>eval</sub> = (Σ<sub>t</sub> Σ<sub>u</sub> R<sub>u</sub> Δt) / (Σ<sub>t</sub> P<sub>sys</sub> Δt)</>}
          note={t('common.unit.mbitPerJoule')}
          source={say('formula.canonical.eeeval.source', '來自核心模組', 'Provided by core module')}
          help={{
            helpId: 'kpi.eeEvalMbitPerJ.help',
            title: t('kpi.eeEvalMbitPerJ.label'),
            body: t('kpi.eeEvalMbitPerJ.help'),
            effect: say('formula.canonical.eeeval.effect', '依時間累積之比例和能源效率。', 'Time-accumulated ratio-of-sums EE.'),
          }}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={groupTitleStyle}>
            {say('section.energyControls.title', '可調參數', 'Adjustable parameters')}
          </div>
          <HelpPopover
            helpId="section.energyControls"
            titleText={say('section.energyControls.title', '可調參數', 'Adjustable parameters')}
            bodyText={say(
              'section.energyControls.hint',
              '發射功率 P_tx 於「訊號品質」分頁設定。本頁設定功率放大器效率 η_PA、與傳輸負載無關的固定消耗功率 P_circuit，以及每次換手的耗能 e_HO。計算結果顯示於右側能源面板。',
              'Transmit power P_tx is set on the Signal Quality tab. This tab sets the power-amplifier efficiency η_PA, the load-independent fixed consumption P_circuit, and the per-handover energy cost e_HO. The resulting numbers are shown on the energy panel to the right.',
            )}
            placement="left"
          />
        </div>

        <NumericControl
          testId="pa-efficiency-control"
          symbol={<>η<sub>PA</sub></>}
          label="PA efficiency"
          labelKey="param.paEfficiency.label"
          unit="ratio"
          unitKey="param.paEfficiency.unit"
          value={energyTuning.paEfficiency}
          min={ENERGY_TUNING_RANGES.paEfficiency.min}
          max={ENERGY_TUNING_RANGES.paEfficiency.max}
          step={ENERGY_TUNING_RANGES.paEfficiency.step}
          description="Fraction of the amplifier input power delivered to the antenna as RF output."
          effect="Raising it lowers the input power required for the same transmit power, so total power falls."
          helpId="param.paEfficiency"
          helpBodyKey="param.paEfficiency.help"
          helpEffectKey="param.paEfficiency.effect"
          accentColor={ENERGY_ACCENT}
          formatValue={value => `${value.toFixed(2)} (${Math.round(value * 100)}%)`}
          onChange={paEfficiency => onEnergyTuningChange({ ...energyTuning, paEfficiency })}
        />

        <NumericControl
          testId="circuit-power-control"
          symbol={<>P<sub>circuit</sub></>}
          label="Circuit power"
          labelKey="param.circuitPowerW.label"
          unit="W"
          unitKey="param.circuitPowerW.unit"
          value={energyTuning.circuitPowerW}
          min={ENERGY_TUNING_RANGES.circuitPowerW.min}
          max={ENERGY_TUNING_RANGES.circuitPowerW.max}
          step={ENERGY_TUNING_RANGES.circuitPowerW.step}
          description="Load-independent electronics consumption, present regardless of transmission."
          effect="Raising it increases total power by the same amount, so energy efficiency falls."
          helpId="param.circuitPowerW"
          helpBodyKey="param.circuitPowerW.help"
          helpEffectKey="param.circuitPowerW.effect"
          accentColor={ENERGY_ACCENT}
          formatValue={value => `${value.toFixed(0)} ${wattUnit}`}
          onChange={circuitPowerW => onEnergyTuningChange({ ...energyTuning, circuitPowerW })}
        />

        {/* The third knob is the only one that is not a power: it prices an
            EVENT. `energyPerHandoverJ` is optional on the state (producers
            written before it existed omit it), so the displayed value falls
            back to the model default rather than to 0 — showing 0 for "unset"
            would claim handovers are free. An explicit 0 chosen on the slider
            is a different thing and is honoured as-is. */}
        <NumericControl
          testId="energy-per-handover-control"
          symbol={<>e<sub>HO</sub></>}
          label="Energy per handover"
          labelKey="param.energyPerHandoverJ.label"
          unit="J"
          unitKey="param.energyPerHandoverJ.unit"
          value={energyTuning.energyPerHandoverJ ?? DEFAULT_ENERGY_PER_HANDOVER_J}
          min={ENERGY_TUNING_RANGES.energyPerHandoverJ.min}
          max={ENERGY_TUNING_RANGES.energyPerHandoverJ.max}
          step={ENERGY_TUNING_RANGES.energyPerHandoverJ.step}
          description="Energy charged for one completed handover: signalling, measurement reporting and re-establishing the link on the new beam."
          effect="Raising it makes each handover weigh more in the energy denominator, so ping-ponging visibly costs run EE. Setting it to 0 charges no handover energy at all."
          helpId="param.energyPerHandoverJ"
          helpBodyKey="param.energyPerHandoverJ.help"
          helpEffectKey="param.energyPerHandoverJ.effect"
          accentColor={ENERGY_ACCENT}
          formatValue={value => `${value.toFixed(0)} ${jouleUnit}`}
          onChange={energyPerHandoverJ => onEnergyTuningChange({ ...energyTuning, energyPerHandoverJ })}
        />
      </div>
    </section>
  );
}
