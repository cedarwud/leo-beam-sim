import type { CSSProperties, ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { SimState } from '../../scene/types';
import {
  formatDb,
  formatDbm,
  formatDbi,
  formatPanelBeamIdentity,
  formatSinr,
  sinrColor,
} from './formatters';
import { StatusBadge } from './StatusBadge';

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

function FormulaTermTile({
  dataTerm,
  status,
  symbol,
  label,
  hiddenLabel,
  value,
  unit = 'dBm',
  tone = 'default',
}: {
  dataTerm: string;
  status: FormulaEvidenceStatus;
  symbol: ReactNode;
  label: string;
  hiddenLabel?: string;
  value: number | null;
  unit?: FormulaTermUnit;
  tone?: 'default' | 'fixed' | 'signal' | 'loss' | 'interference' | 'noise';
}) {
  const formattedValue = formatFormulaTermValue(value, unit);
  const valueLabel = status === 'current'
    ? formattedValue ?? '—'
    : status === 'stale'
      ? formattedValue ? `${formattedValue} stale` : 'stale waiting'
      : 'waiting';

  const accent = tone === 'fixed'
    ? UI_TOKENS.color.semantic.fixed
    : tone === 'loss'
      ? '#58bff0'
      : tone === 'interference'
        ? '#ff8a6b'
        : tone === 'noise'
          ? UI_TOKENS.color.semantic.info
          : UI_TOKENS.color.semantic.tuning;
  const background = tone === 'fixed'
    ? 'rgba(247, 217, 123, 0.1)'
    : tone === 'loss'
      ? 'rgba(88, 191, 240, 0.09)'
      : tone === 'interference'
        ? 'rgba(255, 138, 107, 0.1)'
        : tone === 'noise'
          ? 'rgba(123, 167, 255, 0.1)'
          : 'rgba(118, 234, 215, 0.1)';

  return (
    <div
      data-term={dataTerm}
      data-formula-evidence-status={status}
      style={{
        display: 'grid',
        gap: 4,
        minWidth: 0,
        padding: '9px 10px',
        borderRadius: UI_TOKENS.radius.md,
        background,
        border: `1px solid ${accent}24`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        <span style={{
          fontFamily: UI_TOKENS.type.family.math,
          fontSize: UI_TOKENS.type.size.body,
          color: accent,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {symbol}
        </span>
        <span style={{
          minWidth: 0,
          color: UI_TOKENS.color.text.muted,
          fontSize: UI_TOKENS.type.size.tiny,
          lineHeight: 1.2,
          textTransform: 'uppercase',
          overflowWrap: 'anywhere',
        }}>
          {label}
          {hiddenLabel && hiddenLabel !== label && <span style={srOnlyStyle}> {hiddenLabel}</span>}
        </span>
      </div>
      <div style={{
        color: status === 'current'
          ? accent
          : UI_TOKENS.color.text.faint,
        fontSize: UI_TOKENS.type.size.body,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1.2,
      }}>
        {valueLabel}
      </div>
    </div>
  );
}

function TermGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone: string;
  children: ReactNode;
}) {
  return (
    <section style={{
      display: 'grid',
      gap: 7,
      padding: '9px',
      borderRadius: UI_TOKENS.radius.lg,
      background: UI_TOKENS.color.surface.cardFaint,
      border: `1px solid ${tone}24`,
    }}>
      <div style={{
        color: tone,
        fontSize: UI_TOKENS.type.size.caption,
        fontWeight: UI_TOKENS.type.weight.heavy,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
        {children}
      </div>
    </section>
  );
}

export function FormulaTermsReadout({
  source,
  budget,
  isFormulaEvidenceStale,
  frequencyReuse,
}: {
  source: SimState['physicalServing'];
  budget: SimState['physicalServingBudget'];
  isFormulaEvidenceStale: boolean;
  frequencyReuse: number;
}) {
  const hasFormulaSource = source.satId !== null && source.beamId !== null;
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
  const sourceLabel = hasFormulaSource
    ? formatPanelBeamIdentity(source.satId, source.beamId, frequencyReuse, 'No physical serving source yet')
    : 'No physical serving source yet';
  const statusLabel = formulaEvidenceStatus === 'current'
    ? source.status
    : formulaEvidenceStatus;
  const evidenceCopy = formulaEvidenceStatus === 'current' && source.status === 'live'
    ? 'Live values from computeLinkBudget.'
    : formulaEvidenceStatus === 'current'
      ? 'Last-known values for the latched source.'
      : formulaEvidenceStatus === 'stale'
        ? 'Edited. Waiting for the next recomputed frame.'
        : 'Waiting for a physical serving source.';
  const legacyEvidenceCopy = formulaEvidenceStatus === 'current' && source.status === 'live'
    ? 'Current computeLinkBudget term values for the physical serving formula source.'
    : formulaEvidenceStatus === 'current'
      ? 'Last-known computeLinkBudget term values for the latched physical serving formula source.'
      : formulaEvidenceStatus === 'stale'
        ? 'Formula evidence is stale after a runtime edit; last-known values are labeled stale.'
        : 'Waiting for a physical serving formula source; placeholders keep the term grid stable.';

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
            SINR Formula Terms
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
            {formulaEvidenceStatus === 'stale'
              ? 'stale after edit; waiting for next recomputed frame'
              : formatFormulaSourceProvenance(source.status)}
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
          }}>
            γ result
          </div>
          <div style={{
            color: formulaEvidenceStatus === 'current' ? sinrColor(source.sinrDb ?? -Infinity) : UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            whiteSpace: 'nowrap',
          }}>
            {formulaResultLabel}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <StatusBadge tone={formulaEvidenceStatus === 'current' ? 'serving' : 'warning'}>
          {statusLabel}
        </StatusBadge>
        <StatusBadge tone="neutral">
          computeLinkBudget
        </StatusBadge>
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
        <div style={{
          color: UI_TOKENS.color.text.muted,
          fontSize: UI_TOKENS.type.size.caption,
          lineHeight: 1.4,
        }}>
          {evidenceCopy}
          <span style={srOnlyStyle}>{legacyEvidenceCopy}</span>
        </div>
        <div
          data-testid="formula-term-grid"
          data-formula-evidence-status={formulaEvidenceStatus}
          style={{ display: 'grid', gap: 9 }}
        >
          <TermGroup title="Signal path" tone={UI_TOKENS.color.semantic.tuning}>
            <FormulaTermTile
              dataTerm="signalDbm"
              status={formulaEvidenceStatus}
              symbol={<>S</>}
              label="Signal total"
              hiddenLabel="numerator / signalDbm"
              value={budget?.signalDbm ?? null}
              tone="signal"
            />
            <FormulaTermTile
              dataTerm="effectiveTxPower"
              status={formulaEvidenceStatus}
              symbol={<>P<sub>t</sub></>}
              label="Tx power"
              hiddenLabel="effective transmit power"
              value={budget?.txPowerDbm ?? null}
              tone="signal"
            />
            <FormulaTermTile
              dataTerm="transmitGain"
              status={formulaEvidenceStatus}
              symbol={<>G<sup>T</sup></>}
              label="Tx gain"
              hiddenLabel="transmit gain pattern"
              value={budget?.beamGainDb ?? null}
              unit="dB"
              tone="signal"
            />
            <FormulaTermTile
              dataTerm="receiverGain"
              status={formulaEvidenceStatus}
              symbol={<>G<sup>R</sup></>}
              label="Rx gain"
              hiddenLabel="receiver gain"
              value={budget?.receiverGainDbi ?? null}
              unit="dBi"
              tone="fixed"
            />
          </TermGroup>
          <TermGroup title="Loss" tone="#58bff0">
            <FormulaTermTile
              dataTerm="pathLoss"
              status={formulaEvidenceStatus}
              symbol={<>L</>}
              label="Path loss"
              hiddenLabel="path loss"
              value={budget?.pathLossDb ?? null}
              unit="dB"
              tone="loss"
            />
            <FormulaTermTile
              dataTerm="scanLoss"
              status={formulaEvidenceStatus}
              symbol={<>L<sub>scan</sub></>}
              label="Scan loss"
              hiddenLabel="scan loss"
              value={budget?.steeringLossDb ?? null}
              unit="dB"
              tone="loss"
            />
          </TermGroup>
          <TermGroup title="Interference + noise" tone={UI_TOKENS.color.semantic.info}>
            <FormulaTermTile
              dataTerm="intraInterference"
              status={formulaEvidenceStatus}
              symbol={<>I<sup>a</sup></>}
              label="Inside sat"
              hiddenLabel="intra interference"
              value={budget?.intraInterferenceDbm ?? null}
              tone="interference"
            />
            <FormulaTermTile
              dataTerm="interInterference"
              status={formulaEvidenceStatus}
              symbol={<>I<sup>b</sup></>}
              label="Other sat"
              hiddenLabel="inter interference"
              value={budget?.interInterferenceDbm ?? null}
              tone="interference"
            />
            <FormulaTermTile
              dataTerm="noiseDbm"
              status={formulaEvidenceStatus}
              symbol={<>σ²</>}
              label="Noise floor"
              hiddenLabel="noise σ² / noiseDbm"
              value={budget?.noiseDbm ?? null}
              tone="noise"
            />
            <FormulaTermTile
              dataTerm="denominator"
              status={formulaEvidenceStatus}
              symbol={<>D</>}
              label="Denominator"
              hiddenLabel="denominator"
              value={budget?.denominatorDbm ?? null}
              tone="noise"
            />
          </TermGroup>
        </div>
      </div>
    </div>
  );
}
