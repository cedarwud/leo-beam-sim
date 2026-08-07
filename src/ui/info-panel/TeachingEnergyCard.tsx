// Teaching energy breakdown (耗能明細) — the Σ-over-time half of the energy
// story, accumulated for the primary link.
//
// HONESTY BOUNDARY (shared/CONTRACT.md §1, §4). This card is bound by four
// rules that are not negotiable and not stylistic:
//
//   1. An absent value renders `TEACHING_ABSENT_DASH` ("—"), and a value that
//      was genuinely measured renders as a number — including a measured 0.
//      Confusing the two in either direction is the failure mode: a fabricated
//      0 claims "we measured nothing" when nothing was measured, and a dash
//      over a real 0 hides a reading the model did produce.
//   2. Handover energy IS modelled now (`computeHandoverEnergyJ`), so the row
//      shows `E_HO = handover count × e_HO`. It only falls back to "—" + an
//      ABSENT tag when the term genuinely could not be computed (a broken
//      per-handover cost knob, or a broken tally). `E_HO = 0` — no handover
//      inside the accumulation window, or the cost knob set to 0 — is a
//      measurement and prints as 0. No copy on this card may suggest that
//      handovers are free; the copy states the cost and where it comes from.
//   3. Run EE is labelled only as ΣMbit ÷ (Σ P_total·Δt + E_HO). It is never
//      described as an average of throughput/power — that would be a different
//      (and wrong) quantity dressed up as this one.
//   4. `TEACHING_CLAIM_LABEL` stays on the section as `data-claim-label` so
//      machine readers can still see the provenance. The STUDENT-facing marker
//      is `common.simulatedTeaching` ("模擬資料" / "Simulated"), rendered once
//      as a chip next to the card title — not repeated on every row.
//
// This card is deliberately NOT merged with `EnergyEfficiencyCard`. That card
// shows an instantaneous, cross-UE, coverage-weighted bit/J from
// `src/utils/paperEnergyEfficiency.ts`; this one shows a time-integrated
// single-link Σ Mbit / Σ J. Same unit family, different quantity — blending
// them into one number would be exactly the kind of two-sources-one-result
// splice the contract forbids.
import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import {
  TEACHING_ABSENT_DASH,
  TEACHING_CLAIM_LABEL,
  type TeachingEnergyReadout,
} from '../../teaching';
import { PanelHelp, usePanelCopy } from './panelHelp';
import { StatusBadge } from './StatusBadge';

/**
 * Absent-first number formatting. `null`, `undefined` and any non-finite value
 * collapse to the em dash — there is no code path here that turns a missing
 * reading into `0.000`.
 */
function teachingNumber(value: number | null | undefined, digits: number): string {
  if (!isMeasured(value)) {
    return TEACHING_ABSENT_DASH;
  }
  return value.toFixed(digits);
}

/**
 * "The producer actually gave us this number." False for `null` (the term
 * failed closed), `undefined` (a producer that predates the field) and any
 * non-finite value.
 *
 * Deliberately TRUE for `0`: a measured zero is a reading of this model — no
 * handover inside the accumulation window, or a per-handover cost of 0 — and
 * must render as `0`, keep the normal value colour and carry no ABSENT tag.
 * Folding it in with the missing cases would hide a result the model produced.
 */
function isMeasured(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

/**
 * Low-SINR row copy. It has no `panelHelp` dictionary key yet, so it lives here
 * pre-shaped as `panel.energy.lowSinrRatio*` for the fold-in; it is locale-aware
 * exactly like `tx`, so nothing here is pinned to one language.
 */
const LOW_SINR_COPY = {
  'zh-TW': {
    label: (threshold: string, unit: string) => `低 SINR 比例（< ${threshold} ${unit}）`,
    help: '累積取樣中，服務連線的 SINR 低於門檻的比例。這是課程合格節能的第三道關卡：省下的能量不得以連線品質崩壞換取。沒有任何取樣帶有可用 SINR 時顯示 —，與「每一筆都在門檻之上」的 0 是相反的兩件事。門檻為課程訂定的教學護欄，不是 3GPP 規範值。',
  },
  en: {
    label: (threshold: string, unit: string) => `Low-SINR share (< ${threshold} ${unit})`,
    help: 'The share of accumulated samples whose serving SINR fell below the threshold. This is the third gate on a qualified energy saving: the energy cut may not be bought by letting link quality collapse. A dash means no sample carried a usable SINR — the opposite of a measured 0, which means every sample cleared the threshold. The threshold is a course-defined teaching guardrail, not a 3GPP value.',
  },
} as const;

/**
 * Evidence tier of the low-SINR threshold, stated on the row the same way
 * `TEACHING_CLAIM_LABEL` states the card's: an uppercase token, not prose.
 * `DEFAULT_LOW_SINR_THRESHOLD_DB` is agreed for `energy-lab-v1` teaching, so it
 * must carry this tag wherever it is displayed — it is not a standards value.
 */
const LOW_SINR_TIER_TAG = 'COURSE-DEFINED';

type RowEmphasis = 'default' | 'sum' | 'result' | 'absent';

function LedgerRow({
  testId,
  prefix,
  label,
  help,
  value,
  unit,
  emphasis = 'default',
  trailing,
}: {
  testId: string;
  /** "＋" / "＝" operator glyph that makes the power train visibly add up. */
  prefix?: string;
  label: string;
  help: ReactNode;
  value: string;
  unit?: string;
  emphasis?: RowEmphasis;
  trailing?: ReactNode;
}) {
  const isStrong = emphasis === 'sum' || emphasis === 'result';
  const valueColor = emphasis === 'absent'
    ? UI_TOKENS.color.text.faint
    : emphasis === 'result'
      ? UI_TOKENS.color.semantic.tuning
      : UI_TOKENS.color.text.primary;

  return (
    <div
      data-testid={testId}
      data-emphasis={emphasis}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: UI_TOKENS.space.sm,
        minWidth: 0,
        padding: isStrong ? '7px 9px' : '3px 9px',
        borderRadius: UI_TOKENS.radius.md,
        background: isStrong ? UI_TOKENS.color.surface.cardSubtle : 'transparent',
        border: `1px solid ${isStrong ? UI_TOKENS.color.border.focus : 'transparent'}`,
      }}
    >
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minWidth: 0,
        color: isStrong ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
        fontSize: UI_TOKENS.type.size.tiny,
        fontWeight: isStrong ? UI_TOKENS.type.weight.heavy : UI_TOKENS.type.weight.strong,
        lineHeight: 1.25,
      }}>
        {prefix ? (
          <span aria-hidden="true" style={{
            width: 14,
            flexShrink: 0,
            color: UI_TOKENS.color.text.muted,
            fontFamily: UI_TOKENS.type.family.math,
          }}>
            {prefix}
          </span>
        ) : null}
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
        {help}
      </span>
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        color: valueColor,
        fontSize: isStrong ? UI_TOKENS.type.size.body : UI_TOKENS.type.size.small,
        fontWeight: UI_TOKENS.type.weight.heavy,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}>
        {value}
        {unit ? (
          <span style={{
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.tiny,
            fontWeight: UI_TOKENS.type.weight.strong,
          }}>
            {unit}
          </span>
        ) : null}
        {trailing}
      </span>
    </div>
  );
}

function GroupHeading({ children }: { children: string }) {
  return (
    <div style={{
      marginTop: UI_TOKENS.space.sm,
      color: UI_TOKENS.color.text.muted,
      fontSize: UI_TOKENS.type.size.tiny,
      fontWeight: UI_TOKENS.type.weight.heavy,
      letterSpacing: 0.5,
      lineHeight: 1.3,
    }}>
      {children}
    </div>
  );
}

export function TeachingEnergyCard({
  readout,
}: {
  readout: TeachingEnergyReadout | null;
}) {
  const { locale, t, tx } = usePanelCopy();
  const powerTrain = readout?.powerTrain ?? null;
  const watt = t('common.unit.watt');
  const joule = t('common.unit.joule');
  const mbps = t('common.unit.mbps');
  const mbitPerJoule = t('common.unit.mbitPerJoule');
  const handoverCountUnit = tx('panel.field.handoverCount.unit');
  const absentTag = t('common.absent');
  const percent = t('common.unit.percent');
  const decibel = t('common.unit.db');
  const lowSinrCopy = LOW_SINR_COPY[locale === 'en' ? 'en' : 'zh-TW'];
  // The threshold is READ, never asserted: if the producer did not report it the
  // label says "< — dB" rather than claiming a 14 the run may not have used.
  const lowSinrLabel = lowSinrCopy.label(
    teachingNumber(readout?.lowSinrThresholdDb, 0),
    decibel,
  );

  return (
    <section
      className="leo-teaching-energy-card"
      data-testid="teaching-energy-card"
      data-claim-label={TEACHING_CLAIM_LABEL}
      aria-labelledby="teaching-energy-card-title"
      style={{
        marginTop: UI_TOKENS.space.xl,
        padding: UI_TOKENS.space.xl,
        borderRadius: UI_TOKENS.radius.lg,
        background: 'linear-gradient(180deg, rgba(28, 22, 54, 0.82), rgba(7, 9, 22, 0.74))',
        border: '1px solid rgba(167, 139, 250, 0.28)',
        display: 'grid',
        gap: UI_TOKENS.space.xs,
      }}
    >
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: UI_TOKENS.space.sm,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <h2 id="teaching-energy-card-title" style={{
            margin: 0,
            color: '#c4b5fd',
            fontSize: UI_TOKENS.type.size.body,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.4,
          }}>
            {tx('panel.energy.title')}
          </h2>
          {/* The paragraph that used to sit under this title (what the ledger
              accumulates, and where the numbers come from) is now this "?"
              body — the card face keeps labels, values and units only. */}
          <PanelHelp
            helpId="panel.energy"
            titleText={tx('panel.energy.title')}
            bodyText={`${tx('panel.energy.subtitle')} ${tx('panel.energy.help')}`}
            formula={<>{tx('panel.energy.runEeFormula')}</>}
            meta={<>{t('formula.energy.caption')}</>}
          />
        </span>
        {/* Owner call 2026-08-06: the visible "模擬資料" chip is gone. The
            machine-readable marker stays on the section wrapper below
            (`data-claim-label`), so anything that needs the provenance can
            still read it; the student just no longer reads a label whose only
            job was to caveat the numbers. */}
      </div>

      <GroupHeading>{tx('panel.energy.groupPower')}</GroupHeading>
      <LedgerRow
        testId="teaching-energy-rf-tx-power"
        label={t('kpi.rfTxPower.label')}
        help={(
          <PanelHelp
            helpId="kpi.rfTxPower"
            titleKey="kpi.rfTxPower.label"
            bodyKey="kpi.rfTxPower.help"
            formula={<>P<sub>RF</sub> = 10<sup>(dBm/10)</sup> / 1000</>}
            meta={<>{watt}</>}
          />
        )}
        value={teachingNumber(powerTrain?.rfTxPowerW, 3)}
        unit={watt}
      />
      <LedgerRow
        testId="teaching-energy-pa-input"
        prefix="＋"
        label={t('kpi.paInputPower.label')}
        help={(
          <PanelHelp
            helpId="kpi.paInputPower"
            titleKey="kpi.paInputPower.label"
            bodyKey="kpi.paInputPower.help"
            formula={<>P<sub>PA</sub> = P<sub>RF</sub> / η<sub>PA</sub></>}
            meta={<>{watt}</>}
          />
        )}
        value={teachingNumber(powerTrain?.paInputW, 3)}
        unit={watt}
      />
      <LedgerRow
        testId="teaching-energy-circuit-power"
        prefix="＋"
        label={t('kpi.circuitPower.label')}
        help={(
          <PanelHelp
            helpId="kpi.circuitPower"
            titleKey="kpi.circuitPower.label"
            bodyKey="kpi.circuitPower.help"
            meta={<>{watt}</>}
          />
        )}
        value={teachingNumber(powerTrain?.circuitPowerW, 3)}
        unit={watt}
      />
      {/* The split must visibly add up: PA input + circuit = total. Same three
          decimals on every row so a student can check the sum by eye. */}
      <LedgerRow
        testId="teaching-energy-total-power"
        prefix="＝"
        label={t('kpi.totalPower.label')}
        help={(
          <PanelHelp
            helpId="kpi.totalPower"
            titleKey="kpi.totalPower.label"
            bodyKey="kpi.totalPower.help"
            formula={<>P<sub>total</sub> = P<sub>PA</sub> + P<sub>circuit</sub></>}
            meta={<>{watt} · {t('formula.power.caption')}</>}
          />
        )}
        value={teachingNumber(powerTrain?.totalPowerW, 3)}
        unit={watt}
        emphasis="sum"
      />
      <div style={{
        color: UI_TOKENS.color.text.faint,
        fontSize: UI_TOKENS.type.size.tiny,
        lineHeight: 1.35,
        paddingLeft: 9,
      }}>
        {tx('panel.energy.sumHint')}
      </div>

      <GroupHeading>{tx('panel.energy.groupThroughput')}</GroupHeading>
      <LedgerRow
        testId="teaching-energy-throughput"
        label={t('kpi.throughput.label')}
        help={(
          <PanelHelp
            helpId="kpi.throughput"
            titleKey="kpi.throughput.label"
            bodyKey="kpi.throughput.help"
            formula={<>R = (B / K) · log<sub>2</sub>(1 + γ)</>}
            meta={<>{mbps}</>}
          />
        )}
        value={teachingNumber(readout?.throughputMbps, 2)}
        unit={mbps}
      />

      <GroupHeading>{tx('panel.energy.groupRun')}</GroupHeading>
      <LedgerRow
        testId="teaching-energy-elapsed"
        label={tx('panel.energy.elapsed')}
        help={(
          <PanelHelp
            helpId="panel.energy.elapsed"
            titleText={tx('panel.energy.elapsed')}
            bodyText={tx('panel.energy.elapsed.help')}
            meta={<>{t('common.unit.second')}</>}
          />
        )}
        value={teachingNumber(readout?.elapsedSec, 1)}
        unit={t('common.unit.second')}
      />
      <LedgerRow
        testId="teaching-energy-cumulative-data"
        label={t('kpi.cumulativeDeliveredData.label')}
        help={(
          <PanelHelp
            helpId="kpi.cumulativeDeliveredData"
            titleKey="kpi.cumulativeDeliveredData.label"
            bodyKey="kpi.cumulativeDeliveredData.help"
            formula={<>Σ R · Δt</>}
            meta={<>Mbit</>}
          />
        )}
        value={teachingNumber(readout?.cumulativeDataMbit, 1)}
        unit="Mbit"
      />
      {/* The handover tally is the multiplicand of E_HO, so it is stated
          before the energy terms it feeds. `0` here is a measurement — no
          handover fell inside this accumulation window — not an absence. */}
      <LedgerRow
        testId="teaching-energy-handover-count"
        label={t('kpi.handoverCount.label')}
        help={(
          <PanelHelp
            helpId="panel.energy.handoverCount"
            titleKey="kpi.handoverCount.label"
            bodyText={tx('panel.energy.handoverCount.help')}
            formula={<>E<sub>HO</sub> = N<sub>HO</sub> · e<sub>HO</sub></>}
            meta={<>{handoverCountUnit}</>}
          />
        )}
        value={teachingNumber(readout?.handoverCount, 0)}
        unit={handoverCountUnit}
        emphasis={isMeasured(readout?.handoverCount) ? 'default' : 'absent'}
      />

      {/* The energy split must visibly add up the same way the power train
          does: radio energy + handover energy = total energy. Same single
          decimal on all three rows so a student can check the sum by eye. */}
      <LedgerRow
        testId="teaching-energy-cumulative-energy"
        label={t('kpi.cumulativeEnergy.label')}
        help={(
          <PanelHelp
            helpId="kpi.cumulativeEnergy"
            titleKey="kpi.cumulativeEnergy.label"
            bodyKey="kpi.cumulativeEnergy.help"
            formula={<>Σ P<sub>total</sub> · Δt</>}
            meta={<>{joule}</>}
          />
        )}
        value={teachingNumber(readout?.cumulativeEnergyJ, 1)}
        unit={joule}
      />
      {/* Handover energy is modelled (`computeHandoverEnergyJ`). It shows the
          number — including a measured 0 — and only falls back to a dash plus
          the ABSENT tag when the term itself could not be computed. */}
      <LedgerRow
        testId="teaching-energy-handover-energy"
        prefix="＋"
        label={t('kpi.handoverEnergy.label')}
        help={(
          <PanelHelp
            helpId="kpi.handoverEnergy"
            titleKey="kpi.handoverEnergy.label"
            bodyText={
              isMeasured(readout?.handoverEnergyJ)
                ? t('kpi.handoverEnergy.help')
                : `${t('kpi.handoverEnergy.help')} ${tx('panel.absent.hint')}`
            }
            formula={<>E<sub>HO</sub> = N<sub>HO</sub> · e<sub>HO</sub></>}
            meta={<>{isMeasured(readout?.handoverEnergyJ) ? joule : absentTag}</>}
          />
        )}
        value={teachingNumber(readout?.handoverEnergyJ, 1)}
        unit={joule}
        emphasis={isMeasured(readout?.handoverEnergyJ) ? 'default' : 'absent'}
        trailing={
          isMeasured(readout?.handoverEnergyJ)
            ? undefined
            : <StatusBadge tone="warning">{absentTag}</StatusBadge>
        }
      />
      <LedgerRow
        testId="teaching-energy-total-energy"
        prefix="＝"
        label={t('kpi.totalEnergy.label')}
        help={(
          <PanelHelp
            helpId="kpi.totalEnergy"
            titleKey="kpi.totalEnergy.label"
            bodyKey="kpi.totalEnergy.help"
            formula={<>E<sub>total</sub> = Σ P<sub>total</sub> · Δt + E<sub>HO</sub></>}
            meta={<>{joule} · {t('formula.energy.caption')}</>}
          />
        )}
        value={teachingNumber(readout?.totalEnergyJ, 1)}
        unit={joule}
        emphasis="sum"
      />
      <div style={{
        color: UI_TOKENS.color.text.faint,
        fontSize: UI_TOKENS.type.size.tiny,
        lineHeight: 1.35,
        paddingLeft: 9,
      }}>
        {tx('panel.energy.energySumHint')}
      </div>

      {/* CONTRACT §1: Run EE may only ever be described as
          Σ Mbit ÷ (Σ P_total·Δt + E_HO) — never as a mean of R / P_total. */}
      <LedgerRow
        testId="teaching-energy-run-ee"
        label={t('kpi.runEe.label')}
        help={(
          <PanelHelp
            helpId="kpi.runEe"
            titleKey="kpi.runEe.label"
            bodyKey="kpi.runEe.help"
            formula={<>{tx('panel.energy.runEeFormula')}</>}
            meta={<>{mbitPerJoule}</>}
          />
        )}
        value={teachingNumber(readout?.runEeMbitPerJ, 3)}
        unit={mbitPerJoule}
        emphasis="result"
      />
      <div style={{
        color: UI_TOKENS.color.text.faint,
        fontSize: UI_TOKENS.type.size.tiny,
        lineHeight: 1.35,
        paddingLeft: 9,
      }}>
        {tx('panel.energy.runEeFormula')}
      </div>

      {/* Quality guardrail, not a term of the sums above — it sits after Run EE
          so neither the power train nor the energy split is broken up. A `null`
          (no sample carried a usable SINR) renders as the em dash and NOT as 0:
          "no reading" and "every sample cleared the threshold" are opposites. */}
      <LedgerRow
        testId="teaching-energy-low-sinr-ratio"
        label={lowSinrLabel}
        help={(
          <PanelHelp
            helpId="panel.energy.lowSinrRatio"
            titleText={lowSinrLabel}
            bodyText={lowSinrCopy.help}
            formula={<>N<sub>low</sub> ÷ N<sub>samples</sub> · 100</>}
            meta={<>{percent} · {LOW_SINR_TIER_TAG}</>}
          />
        )}
        value={teachingNumber(readout?.lowSinrRatioPct, 1)}
        unit={percent}
        emphasis={isMeasured(readout?.lowSinrRatioPct) ? 'default' : 'absent'}
        trailing={<StatusBadge tone="neutral">{LOW_SINR_TIER_TAG}</StatusBadge>}
      />

      {readout === null ? (
        <div style={{
          marginTop: UI_TOKENS.space.sm,
          color: UI_TOKENS.color.text.faint,
          fontSize: UI_TOKENS.type.size.tiny,
          lineHeight: 1.4,
        }}>
          {tx('panel.energy.waiting')}
        </div>
      ) : null}
    </section>
  );
}
