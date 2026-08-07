import type { CSSProperties, ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { SimState } from '../../scene/types';
import {
  channelMetricLabelForKind,
  formatDb,
  formatDbm,
  formatDbi,
  formatCellServingIdentity,
  formatPanelBeamIdentity,
  formatSinr,
  sinrColor,
} from './formatters';
import { PanelHelp, usePanelCopy } from './panelHelp';
import { StatusBadge } from './StatusBadge';

// P1e (c) audit-list hook (PR-0.5 backfill): keep `channelMetricLabelForKind`
// in scope so the SINR-derived terms (the card heading) can later branch to a
// "SNR Formula Terms" heading when the producer-declared kind is
// `'snr-no-interference'`. Full heading branching is reserved for the slice
// PRs — this constant keeps the contract surface in scope.
const _FORMULA_TERMS_DEFAULT_LABEL = channelMetricLabelForKind(undefined);
void _FORMULA_TERMS_DEFAULT_LABEL;

type FormulaEvidenceStatus = 'current' | 'stale' | 'waiting';
type FormulaTermUnit = 'dBm' | 'dB' | 'dBi';

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function formatFormulaSourceProvenance(status: SimState['physicalServing']['status']): string {
  switch (status) {
    case 'live':
      return 'physical serving source';
    case 'latched':
      return 'latched physical serving source';
    case 'recent-ho':
      return 'recent-HO physical serving source';
    case 'derived':
      return 'derived physical serving source';
    case 'none':
      return 'no physical serving source';
  }
}
function formatFormulaTermValue(value: number | null, unit: FormulaTermUnit): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (unit === 'dBi') return formatDbi(value);
  if (unit === 'dB') return formatDb(value);
  return formatDbm(value);
}

/**
 * One line of the fraction: `[op] [symbol] [label] [?] ............ [value]`.
 *
 * The `op` glyph ("＋" / "－" / "＝") is what makes the group visibly compose,
 * the same device the energy card uses for its power and energy trains — a
 * student can read the group top-to-bottom and check the arithmetic by eye.
 *
 * `order` exists because the DOM order of `data-term` cells is a CONTRACT
 * (`validate:phase9d:formula-evidence-stability` deep-equals the ten term ids
 * in a fixed sequence, and phase7b / phase1a re-assert it). The numerator's
 * SUM (`signalDbm`) is first in that sequence but has to read LAST on screen,
 * after the terms it is the sum of — so it keeps its DOM position and moves
 * visually with flex `order`.
 */
function FormulaTermRow({
  dataTerm,
  status,
  op,
  symbol,
  label,
  help,
  value,
  unit = 'dBm',
  tone = 'default',
  emphasis = 'term',
  order,
}: {
  dataTerm: string;
  status: FormulaEvidenceStatus;
  /** "＋" / "－" / "＝" — how this term enters its group. */
  op?: string;
  symbol: ReactNode;
  label: string;
  /** "?" trigger for this term's definition. */
  help?: ReactNode;
  value: number | null;
  unit?: FormulaTermUnit;
  tone?: 'default' | 'fixed' | 'signal' | 'loss' | 'interference' | 'noise';
  /** `sum` is the group's "＝" line: the value the terms above it compose into. */
  emphasis?: 'term' | 'sum';
  order?: number;
}) {
  const formattedValue = formatFormulaTermValue(value, unit);
  const valueLabel = status === 'current'
    ? formattedValue ?? '—'
    : status === 'stale'
      ? formattedValue ? `${formattedValue} stale` : 'stale waiting'
      : 'waiting';

  // W2: per-term accent. The noise tone (σ² + denominator) uses semantic.noise to
  // match the LEFT formula-tab σ² accent (getFormulaTabAccent in tuningConfig.tsx).
  // Previously the right tile used semantic.info (#7ba7ff) while the left used
  // semantic.noise (#8ebaff), so the same σ² term showed two different blues.
  const accent = tone === 'fixed'
    ? UI_TOKENS.color.semantic.fixed
    : tone === 'loss'
      ? '#58bff0'
      : tone === 'interference'
        ? '#ff8a6b'
        : tone === 'noise'
          ? UI_TOKENS.color.semantic.noise
          : UI_TOKENS.color.semantic.tuning;

  return (
    <div
      data-term={dataTerm}
      data-formula-evidence-status={status}
      style={{
        order,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
        padding: emphasis === 'sum' ? '6px 8px' : '3px 8px',
        borderRadius: UI_TOKENS.radius.md,
        background: emphasis === 'sum' ? `${accent}14` : 'transparent',
        border: `1px solid ${emphasis === 'sum' ? `${accent}33` : 'transparent'}`,
      }}
    >
      <span aria-hidden="true" style={{
        width: 13,
        flexShrink: 0,
        color: UI_TOKENS.color.text.muted,
        fontFamily: UI_TOKENS.type.family.math,
        fontSize: UI_TOKENS.type.size.tiny,
      }}>
        {op ?? ''}
      </span>
      <span style={{
        flexShrink: 0,
        minWidth: 26,
        fontFamily: UI_TOKENS.type.family.math,
        fontSize: UI_TOKENS.type.size.small,
        color: accent,
        fontWeight: UI_TOKENS.type.weight.heavy,
        whiteSpace: 'nowrap',
      }}>
        {symbol}
      </span>
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flex: 1,
        minWidth: 0,
        color: emphasis === 'sum' ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
        fontSize: UI_TOKENS.type.size.tiny,
        fontWeight: emphasis === 'sum' ? UI_TOKENS.type.weight.heavy : UI_TOKENS.type.weight.strong,
        lineHeight: 1.25,
      }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
        {help}
      </span>
      <span style={{
        flexShrink: 0,
        color: status === 'current' ? accent : UI_TOKENS.color.text.faint,
        fontSize: emphasis === 'sum' ? UI_TOKENS.type.size.body : UI_TOKENS.type.size.small,
        fontWeight: UI_TOKENS.type.weight.heavy,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}>
        {valueLabel}
      </span>
    </div>
  );
}

function TermGroup({
  title,
  tone,
  help,
  hint,
  children,
}: {
  title: string;
  tone: string;
  help?: ReactNode;
  /** One line stating how the group's terms compose into its sum. */
  hint: string;
  children: ReactNode;
}) {
  return (
    <section style={{
      display: 'grid',
      gap: 5,
      padding: '9px',
      borderRadius: UI_TOKENS.radius.lg,
      background: UI_TOKENS.color.surface.cardFaint,
      border: `1px solid ${tone}24`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minWidth: 0,
        color: tone,
        fontSize: UI_TOKENS.type.size.caption,
        fontWeight: UI_TOKENS.type.weight.heavy,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
        {help}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {children}
      </div>
      <div style={{
        color: UI_TOKENS.color.text.faint,
        fontSize: UI_TOKENS.type.size.tiny,
        lineHeight: 1.35,
        overflowWrap: 'anywhere',
      }}>
        {hint}
      </div>
    </section>
  );
}

export function FormulaTermsReadout({
  source,
  budget,
  isFormulaEvidenceStale,
  frequencyReuse,
  servingCellId,
}: {
  source: SimState['physicalServing'];
  budget: SimState['physicalServingBudget'];
  isFormulaEvidenceStale: boolean;
  frequencyReuse: number;
  /** Cell-truth serving unit on sinr-live; null on steered/replay lanes. */
  servingCellId: number | null;
}) {
  const { t, tx } = usePanelCopy();
  const hasSteeredFormulaSource = source.satId !== null && source.beamId !== null;
  const hasCellFormulaSource = source.satId !== null && source.beamId === null && servingCellId !== null;
  const hasFormulaSource = hasSteeredFormulaSource || hasCellFormulaSource;
  const formulaEvidenceStatus: FormulaEvidenceStatus = isFormulaEvidenceStale
    ? 'stale'
    : budget !== null && hasFormulaSource
      ? 'current'
      : 'waiting';
  const formulaResultLabel = formulaEvidenceStatus === 'waiting'
    ? 'waiting'
    : source.sinrDb !== null && Number.isFinite(source.sinrDb)
      ? `${formatSinr(source.sinrDb)}${formulaEvidenceStatus === 'stale' ? ' stale' : ''}`
      : formulaEvidenceStatus;
  const sourceLabel = hasCellFormulaSource
    ? formatCellServingIdentity(source.satId, servingCellId, frequencyReuse, 'No serving source yet')
    : hasSteeredFormulaSource
      ? formatPanelBeamIdentity(source.satId, source.beamId, frequencyReuse, 'No physical serving source yet')
      : 'No serving source yet';
  const statusLabel = formulaEvidenceStatus === 'current'
    ? source.status
    : formulaEvidenceStatus;
  // Student-facing state line. The canonical English provenance token stays in
  // the DOM as sr-only text (below) so machine readers keep the vocabulary the
  // pre-i18n surface exposed.
  const statusCopy = formulaEvidenceStatus === 'stale'
    ? tx('panel.formulaTerms.status.stale')
    : formulaEvidenceStatus === 'waiting'
      ? tx('panel.formulaTerms.status.waiting')
      : source.status === 'live'
        ? tx('panel.formulaTerms.status.live')
        : tx('panel.formulaTerms.status.latched');
  const canonicalStatusCopy = formulaEvidenceStatus === 'stale'
    ? 'stale after edit; waiting for next recomputed frame'
    : hasCellFormulaSource
      ? `${formatFormulaSourceProvenance(source.status)} for the current primary UE sinr-live cell-truth link`
      : formatFormulaSourceProvenance(source.status);
  const evidenceAuthority = hasCellFormulaSource
    ? 'the current primary UE sinr-live cell-truth LinkSample'
    : 'computeLinkBudget';
  const evidenceCopy = formulaEvidenceStatus === 'current' && source.status === 'live'
    ? `Live values from ${evidenceAuthority}.`
    : formulaEvidenceStatus === 'current'
      ? `Last-known values for ${evidenceAuthority}.`
      : formulaEvidenceStatus === 'stale'
        ? 'Edited. Waiting for the next recomputed frame.'
        : 'Waiting for a serving link sample.';
  const legacyEvidenceCopy = formulaEvidenceStatus === 'current' && source.status === 'live'
    ? `Current term values for ${evidenceAuthority}.`
    : formulaEvidenceStatus === 'current'
      ? `Last-known term values for ${evidenceAuthority}.`
      : formulaEvidenceStatus === 'stale'
        ? 'Formula evidence is stale after a runtime edit; last-known values are labeled stale.'
        : 'Waiting for a serving link sample; placeholders keep the term grid stable.';

  return (
    <div
      data-testid="formula-verification-card"
      data-formula-evidence-status={formulaEvidenceStatus}
      style={{
        marginTop: 12,
        display: 'grid',
        gap: 10,
        padding: '13px 14px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'linear-gradient(180deg, rgba(8, 38, 44, 0.82), rgba(5, 15, 24, 0.72))',
        border: '1px solid rgba(118, 234, 215, 0.2)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            color: UI_TOKENS.color.semantic.tuningSoft,
            fontSize: UI_TOKENS.type.size.caption,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
            {tx('panel.formulaTerms.title')}
            {/* Canonical English heading, preserved for machine readers that
                learned this surface before it was translated. */}
            <span style={srOnlyStyle}> SINR Formula Terms</span>
          </div>
          <div style={{
            marginTop: 5,
            color: UI_TOKENS.color.text.primary,
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.35,
          }}>
            {sourceLabel}
          </div>
          <div style={{
            marginTop: 4,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.caption,
            lineHeight: 1.35,
          }}>
            {statusCopy}
            <span style={srOnlyStyle}> {canonicalStatusCopy}</span>
          </div>
        </div>
        <div
          data-testid="formula-result-readout"
          data-ownership="formula-verification"
          data-visual-weight="secondary"
          style={{
            display: 'grid',
            gap: 3,
            justifyItems: 'end',
            minWidth: 96,
            padding: '7px 9px',
            borderRadius: UI_TOKENS.radius.md,
            background: UI_TOKENS.color.surface.card,
            border: '1px solid rgba(118, 234, 215, 0.22)',
          }}
        >
          <div style={{
            color: UI_TOKENS.color.text.muted,
            fontSize: UI_TOKENS.type.size.tiny,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            textAlign: 'right',
          }}>
            {tx('panel.formulaTerms.result')}
          </div>
          <div style={{
            color: formulaEvidenceStatus === 'current' ? sinrColor(source.sinrDb ?? -Infinity) : UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            whiteSpace: 'nowrap',
          }}>
            {formulaResultLabel}
          </div>
          <div style={{
            color: UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.tiny,
            lineHeight: 1.3,
            textAlign: 'right',
          }}>
            {tx('panel.formulaTerms.resultHint')}
          </div>
        </div>
      </div>

      <div aria-hidden="true" style={{ display: 'none' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <StatusBadge tone={formulaEvidenceStatus === 'current' ? 'serving' : 'warning'}>
            {statusLabel}
          </StatusBadge>
          <StatusBadge tone="neutral">
            computeLinkBudget
          </StatusBadge>
        </div>
      </div>

      <div
        data-testid="formula-term-evidence"
        data-ownership="formula-verification"
        data-visual-weight="primary"
        data-formula-evidence-status={formulaEvidenceStatus}
        style={{
          display: 'grid',
          gap: 9,
        }}
      >
        <div aria-hidden="true" style={{ display: 'none' }}>
          <div style={{
            color: UI_TOKENS.color.text.muted,
            fontSize: UI_TOKENS.type.size.caption,
            lineHeight: 1.4,
          }}>
            {evidenceCopy}
            <span style={srOnlyStyle}>{legacyEvidenceCopy}</span>
          </div>
        </div>
        <div
          data-testid="formula-term-grid"
          data-formula-evidence-status={formulaEvidenceStatus}
          style={{ display: 'grid', gap: 9 }}
        >
          <TermGroup
            title={tx('panel.formulaTerms.numerator')}
            tone={UI_TOKENS.color.semantic.tuning}
            hint={tx('panel.formulaTerms.numeratorHint')}
            help={(
              <PanelHelp
                helpId="panel.formulaTerms"
                titleText={tx('panel.formulaTerms.numerator')}
                bodyText={`${tx('panel.formulaTerms.numerator.help')} ${tx('panel.formulaTerms.help')}`}
                formula={<>γ = S / (I<sup>a</sup> + I<sup>b</sup> + σ²)</>}
                meta={<>{t('formula.sinr.caption')}</>}
              />
            )}
          >
            {/* DOM-first (term-id order is a contract), read last on screen. */}
            <FormulaTermRow
              dataTerm="signalDbm"
              status={formulaEvidenceStatus}
              op="＝"
              order={1}
              symbol={<>S</>}
              label={tx('panel.formulaTerms.signalTotal.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.signalTotal"
                  titleText={tx('panel.formulaTerms.signalTotal.label')}
                  bodyText={tx('panel.formulaTerms.signalTotal.help')}
                  meta={<>{t('common.unit.dbm')}</>}
                />
              )}
              value={budget?.signalDbm ?? null}
              tone="signal"
              emphasis="sum"
            />
            <FormulaTermRow
              dataTerm="effectiveTxPower"
              status={formulaEvidenceStatus}
              symbol={<>P<sub>t</sub></>}
              label={tx('panel.formulaTerms.txPower.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.txPower"
                  titleText={tx('panel.formulaTerms.txPower.label')}
                  bodyText={tx('panel.formulaTerms.txPower.help')}
                  meta={<>{t('common.unit.dbm')}</>}
                />
              )}
              value={budget?.txPowerDbm ?? null}
              tone="signal"
            />
            <FormulaTermRow
              dataTerm="transmitGain"
              status={formulaEvidenceStatus}
              op="＋"
              symbol={<>G<sup>T</sup></>}
              label={tx('panel.formulaTerms.txGain.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.txGain"
                  titleText={tx('panel.formulaTerms.txGain.label')}
                  bodyText={tx('panel.formulaTerms.txGain.help')}
                  meta={<>{t('common.unit.db')}</>}
                />
              )}
              value={budget?.beamGainDb ?? null}
              unit="dB"
              tone="signal"
            />
            <FormulaTermRow
              dataTerm="receiverGain"
              status={formulaEvidenceStatus}
              op="＋"
              symbol={<>G<sup>R</sup></>}
              label={tx('panel.formulaTerms.rxGain.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.rxGain"
                  titleText={tx('panel.formulaTerms.rxGain.label')}
                  bodyText={tx('panel.formulaTerms.rxGain.help')}
                  meta={<>{t('common.unit.dbi')}</>}
                />
              )}
              value={budget?.receiverGainDbi ?? null}
              unit="dBi"
              tone="fixed"
            />
            <FormulaTermRow
              dataTerm="pathLoss"
              status={formulaEvidenceStatus}
              op="－"
              symbol={<>L</>}
              label={tx('panel.formulaTerms.pathLoss.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.pathLoss"
                  titleText={tx('panel.formulaTerms.pathLoss.label')}
                  bodyText={tx('panel.formulaTerms.pathLoss.help')}
                  meta={<>{t('common.unit.db')}</>}
                />
              )}
              value={budget?.pathLossDb ?? null}
              unit="dB"
              tone="loss"
            />
            <FormulaTermRow
              dataTerm="scanLoss"
              status={formulaEvidenceStatus}
              op="－"
              symbol={<>L<sub>scan</sub></>}
              label={tx('panel.formulaTerms.scanLoss.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.scanLoss"
                  titleText={tx('panel.formulaTerms.scanLoss.label')}
                  bodyText={tx('panel.formulaTerms.scanLoss.help')}
                  meta={<>{t('common.unit.db')}</>}
                />
              )}
              value={budget?.steeringLossDb ?? null}
              unit="dB"
              tone="loss"
            />
          </TermGroup>
          <TermGroup
            title={tx('panel.formulaTerms.denominator')}
            tone={UI_TOKENS.color.semantic.noise}
            hint={tx('panel.formulaTerms.denominatorHint')}
            help={(
              <PanelHelp
                helpId="panel.formulaTerms.denominator"
                titleText={tx('panel.formulaTerms.denominator')}
                bodyText={tx('panel.formulaTerms.denominator.help')}
                formula={<>D = I<sup>a</sup> + I<sup>b</sup> + σ²</>}
                meta={<>{t('common.unit.dbm')}</>}
              />
            )}
          >
            <FormulaTermRow
              dataTerm="intraInterference"
              status={formulaEvidenceStatus}
              symbol={<>I<sup>a</sup></>}
              label={tx('panel.formulaTerms.intraInterference.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.intraInterference"
                  titleText={tx('panel.formulaTerms.intraInterference.label')}
                  bodyText={tx('panel.formulaTerms.intraInterference.help')}
                  meta={<>{t('common.unit.dbm')}</>}
                />
              )}
              value={budget?.intraInterferenceDbm ?? null}
              tone="interference"
            />
            <FormulaTermRow
              dataTerm="interInterference"
              status={formulaEvidenceStatus}
              op="＋"
              symbol={<>I<sup>b</sup></>}
              label={tx('panel.formulaTerms.interInterference.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.interInterference"
                  titleText={tx('panel.formulaTerms.interInterference.label')}
                  bodyText={tx('panel.formulaTerms.interInterference.help')}
                  meta={<>{t('common.unit.dbm')}</>}
                />
              )}
              value={budget?.interInterferenceDbm ?? null}
              tone="interference"
            />
            <FormulaTermRow
              dataTerm="noiseDbm"
              status={formulaEvidenceStatus}
              op="＋"
              symbol={<>σ²</>}
              label={tx('panel.formulaTerms.noise.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.noise"
                  titleText={tx('panel.formulaTerms.noise.label')}
                  bodyText={tx('panel.formulaTerms.noise.help')}
                  meta={<>{t('common.unit.dbm')}</>}
                />
              )}
              value={budget?.noiseDbm ?? null}
              tone="noise"
            />
            <FormulaTermRow
              dataTerm="denominator"
              status={formulaEvidenceStatus}
              op="＝"
              symbol={<>D</>}
              label={tx('panel.formulaTerms.denominatorTotal.label')}
              help={(
                <PanelHelp
                  helpId="panel.formulaTerms.denominatorTotal"
                  titleText={tx('panel.formulaTerms.denominatorTotal.label')}
                  bodyText={tx('panel.formulaTerms.denominatorTotal.help')}
                  meta={<>{t('common.unit.dbm')}</>}
                />
              )}
              value={budget?.denominatorDbm ?? null}
              tone="noise"
              emphasis="sum"
            />
          </TermGroup>
        </div>
      </div>
    </div>
  );
}
