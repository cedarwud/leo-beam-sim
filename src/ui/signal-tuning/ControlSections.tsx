import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { LinkBudgetTerms } from '../../scene/types';
import { formatDbm } from './formatters';
import { MathSymbol } from './MathSymbol';
import {
  compactSummaryStyle,
  explanatoryTextStyle,
  formulaTextStyle,
} from './styles';
import { getFormulaTabAccent } from './tuningConfig';
import type { TuningTab } from './types';

function FormulaContext({ tab }: { tab: TuningTab }) {
  const accent = getFormulaTabAccent(tab.key);

  return (
    <div style={{
      display: 'grid',
      gap: 8,
      padding: '12px 14px',
      borderRadius: UI_TOKENS.radius.lg,
      background: 'rgba(255, 255, 255, 0.06)',
      border: `1px solid ${accent}44`,
      borderLeft: `4px solid ${accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
        <div style={{ ...formulaTextStyle, color: accent }}>{tab.formula}</div>
      </div>
      <div style={explanatoryTextStyle}>
        {tab.note}
      </div>
    </div>
  );
}
export function FormulaContextDisclosure({ tab }: { tab: TuningTab }) {
  const accent = getFormulaTabAccent(tab.key);
  return (
    <details
      open
      data-testid="active-tab-formula-context"
      data-prominence="primary-context"
      style={{
        display: 'grid',
        gap: 10,
        padding: '10px 11px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'rgba(8, 40, 72, 0.55)',
        border: `1px solid ${accent}50`,
        color: UI_TOKENS.color.text.secondary,
      }}
    >
      <summary style={{
        ...compactSummaryStyle,
        color: accent,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        Formula / notes
      </summary>
      <div style={{ paddingTop: 10 }}>
        <FormulaContext tab={tab} />
      </div>
    </details>
  );
}

export function FormulaSideControlSection({
  title,
  subtitle,
  formula,
  side,
  children,
  testId,
  accentColor,
}: {
  title: string;
  subtitle: ReactNode;
  formula: ReactNode;
  side: 'numerator' | 'denominator';
  children: ReactNode;
  testId: string;
  accentColor?: string;
}) {
  const isNumerator = side === 'numerator';
  const sectionAccent = accentColor ?? (isNumerator ? UI_TOKENS.color.semantic.tuning : UI_TOKENS.color.semantic.noise);
  const sectionDarkBase = (() => {
    if (sectionAccent === UI_TOKENS.color.semantic.tuning) return 'rgba(12, 72, 65, 0.60)';
    if (sectionAccent === UI_TOKENS.color.semantic.fixed) return 'rgba(72, 52, 8, 0.60)';
    if (sectionAccent === UI_TOKENS.color.semantic.noise) return 'rgba(20, 38, 96, 0.60)';
    if (sectionAccent === UI_TOKENS.color.semantic.beam) return 'rgba(26, 62, 14, 0.60)';
    return 'rgba(12, 72, 65, 0.60)';
  })();

  return (
    <section
      data-testid={testId}
      data-formula-side={side}
      style={{
        display: 'grid',
        gap: 14,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: sectionDarkBase,
        border: `1px solid ${sectionAccent}55`,
      }}
    >
      {children}
      <div
        data-testid={`${testId}-formula-context`}
        data-prominence="secondary-context"
        style={{
          display: 'grid',
          gap: 6,
          padding: '10px 12px',
          borderRadius: UI_TOKENS.radius.md,
          background: 'rgba(255, 255, 255, 0.07)',
          border: `1px solid ${sectionAccent}44`,
          borderLeft: `3px solid ${sectionAccent}88`,
        }}
      >
        <div style={{
          fontSize: UI_TOKENS.type.size.body,
          color: UI_TOKENS.color.text.controlLabel,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          {title}
        </div>
        <div style={{ ...formulaTextStyle, fontSize: UI_TOKENS.type.size.subheading, lineHeight: 1.28, color: sectionAccent }}>
          {formula}
        </div>
        <div style={{
          ...explanatoryTextStyle,
        }}>
          {subtitle}
        </div>
      </div>
    </section>
  );
}

export function NoiseFloorReadout({
  formulaBudget,
  isFormulaEvidenceStale,
}: {
  formulaBudget: LinkBudgetTerms | null;
  isFormulaEvidenceStale: boolean;
}) {
  const hasCurrentNoiseFloor = formulaBudget !== null && !isFormulaEvidenceStale;

  return (
    <div
      data-testid="thermal-noise-floor-readout"
      data-readonly="true"
      data-formula-evidence-status={isFormulaEvidenceStale ? 'stale' : hasCurrentNoiseFloor ? 'current' : 'waiting'}
      style={{
        display: 'grid',
        gap: 8,
        padding: '12px 13px',
        borderRadius: UI_TOKENS.radius.md,
        background: UI_TOKENS.color.surface.card,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
          <MathSymbol size={22} color={UI_TOKENS.color.semantic.noise}>σ²</MathSymbol>
          <span style={{
            fontSize: UI_TOKENS.type.size.subheading,
            color: UI_TOKENS.color.text.controlLabel,
            fontWeight: UI_TOKENS.type.weight.heavy,
          }}>
            Noise floor
          </span>
        </div>
        <div style={{
          padding: '5px 8px',
          borderRadius: UI_TOKENS.radius.md,
          background: `${UI_TOKENS.color.semantic.noise}14`,
          border: `1px solid ${UI_TOKENS.color.semantic.noise}2e`,
          color: hasCurrentNoiseFloor ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.faint,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {hasCurrentNoiseFloor ? formatDbm(formulaBudget.noiseDbm) : 'waiting'}
        </div>
      </div>
      <div style={{ ...explanatoryTextStyle, color: UI_TOKENS.color.semantic.noiseSoft }}>
        {isFormulaEvidenceStale
          ? 'Read-only σ² / noise floor evidence is stale after edit; waiting for the next recomputed frame.'
          : hasCurrentNoiseFloor
            ? 'Read-only computed σ² / noise floor from the current formula evidence.'
            : 'Read-only σ² / noise floor appears after a selected formula frame is available.'}
      </div>
    </div>
  );
}

export function LossControlSection({
  title,
  subtitle,
  children,
  testId,
  tone = 'formula',
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  testId: string;
  tone?: 'formula' | 'research';
}) {
  const isResearch = tone === 'research';

  return (
    <section
      data-testid={testId}
      style={{
        display: 'grid',
        gap: 14,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: isResearch ? 'rgba(117, 74, 10, 0.2)' : 'rgba(21, 96, 88, 0.22)',
        border: isResearch ? '1px solid rgba(247, 217, 123, 0.22)' : '1px solid rgba(118, 234, 215, 0.2)',
      }}
    >
      <div style={{
        fontSize: UI_TOKENS.type.size.bodyLg,
        color: UI_TOKENS.color.text.controlLabel,
        fontWeight: UI_TOKENS.type.weight.heavy,
      }}>
        {title}
      </div>
      <div
        style={{
          padding: '8px 10px',
          borderRadius: UI_TOKENS.radius.md,
          background: isResearch ? 'rgba(247, 217, 123, 0.075)' : 'rgba(88, 191, 240, 0.08)',
          border: isResearch ? '1px solid rgba(247, 217, 123, 0.14)' : '1px solid rgba(88, 191, 240, 0.16)',
          color: isResearch ? 'rgba(255, 230, 173, 0.82)' : UI_TOKENS.color.text.secondary,
          fontSize: UI_TOKENS.type.size.body,
          lineHeight: explanatoryTextStyle.lineHeight,
        }}
      >
        {subtitle}
      </div>
      {children}
    </section>
  );
}
