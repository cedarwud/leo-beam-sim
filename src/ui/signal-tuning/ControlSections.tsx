import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { LinkBudgetTerms } from '../../scene/types';
import { HelpPopover } from '../common/HelpPopover';
import { formatDbm } from './formatters';
import { txBi } from './labels';
import { MathSymbol } from './MathSymbol';
import {
  canonicalTermStyle,
  captionTextStyle,
  compactSummaryStyle,
  explanatoryTextStyle,
  formulaTextStyle,
  groupTitleStyle,
  srOnlyStyle,
} from './styles';
import { getFormulaTabAccent, getFormulaTabLabelCopy, getFormulaTabNoteCopy } from './tuningConfig';
import type { TuningTab } from './types';

/**
 * Several section headings/subtitles below are the canonical English copy that
 * `validate:phase9b`, `validate:phase8b` and `validate:phase10b` assert on to
 * prove a formula term never drifts to the wrong side of the SINR fraction.
 * Where a friendlier localized string is supplied (`titleText` / `subtitleText`),
 * the canonical copy is kept in an `aria-hidden`, visually-hidden block instead
 * of being deleted: the student reads the friendly version, the provenance
 * check still has something to check, and screen readers are not read the same
 * sentence twice in two languages.
 */

function FormulaContext({ tab }: { tab: TuningTab }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const accent = getFormulaTabAccent(tab.key);
  const noteCopy = getFormulaTabNoteCopy(tab.key);
  const labelCopy = getFormulaTabLabelCopy(tab.key);
  // The sub-tab buttons carry notation only, so this is the one place the
  // selected term is named in the reader's language — without it, picking
  // `N_sat` or `σ²` leaves nothing localized on screen to identify it.
  const termName = txBi(t, isEnglish, labelCopy.key, labelCopy.zh, labelCopy.en);

  return (
    <div style={{
      display: 'grid',
      gap: 8,
      padding: '12px 14px',
      borderRadius: UI_TOKENS.radius.lg,
      border: `1px solid ${accent}44`,
      borderLeft: `4px solid ${accent}`,
    }}>
      {/* Formula on screen, prose behind the "?" — the panel should read as
          notation, not as a paragraph with a formula in it. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 9, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
          <div style={{ ...groupTitleStyle, color: accent }}>{termName}</div>
          <div style={{ ...formulaTextStyle, color: accent }}>{tab.formulaExpr ?? tab.formula}</div>
        </div>
        <HelpPopover
          helpId={`tab.sub.${tab.key}`}
          titleText={termName}
          bodyText={txBi(t, isEnglish, noteCopy.key, noteCopy.zh, noteCopy.en)}
          placement="left"
        />
      </div>
      <div aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
        {tab.formulaExpr ? <span>{tab.formula}</span> : null}
        <span>{txBi(t, isEnglish, noteCopy.key, noteCopy.zh, noteCopy.en)}</span>
      </div>
    </div>
  );
}
export function FormulaContextDisclosure({ tab }: { tab: TuningTab }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
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
      }}>
        {txBi(t, isEnglish, 'common.formulaNotes', '公式對應位置', 'Formula / notes')}
        <span aria-hidden="true" style={srOnlyStyle}> Formula / notes</span>
      </summary>
      <div style={{ paddingTop: 10 }}>
        <FormulaContext tab={tab} />
      </div>
    </details>
  );
}

export function FormulaSideControlSection({
  title,
  titleText,
  subtitle,
  subtitleText,
  formula,
  formulaExpr,
  showFormula = true,
  side,
  children,
  testId,
  accentColor,
  helpId,
  contextPlacement = 'trailing',
  visualVariant = 'default',
}: {
  /** Canonical English heading. Kept for the formula-side provenance gates. */
  title: string;
  /** Friendly localized heading actually shown to the student. */
  titleText?: string;
  subtitle: ReactNode;
  subtitleText?: string;
  /** Canonical description; may be a sentence. */
  formula?: ReactNode;
  /** Notation-only form shown on screen in place of `formula`. */
  formulaExpr?: ReactNode;
  /** Presentation toggle: when false, suppresses formulaExpr / formula rendering and canonical hidden formula copy. Defaults to true. */
  showFormula?: boolean;
  side: 'numerator' | 'denominator';
  children: ReactNode;
  testId: string;
  accentColor?: string;
  /**
   * When given, the subtitle is served from a "?" next to the heading instead
   * of being printed under the formula. The canonical copy still ships in the
   * hidden block below, so the provenance gates are unaffected.
   */
  helpId?: string;
  /**
   * Where the heading + formula block sits relative to the controls.
   *
   * 'trailing' (default) is the panel-wide demotion: the slider is the primary
   * action and the term context is a footnote under it, an ordering
   * `validate:phase9h:coverage-audit-demotion` pins for the P_t tab.
   *
   * 'leading' is the σ² exception (owner request 2026-08-06). That section's
   * formula defines the value shown inside the same section (σ² = B^wN₀, then the
   * computed value, then B and N₀). No other tab uses it, so the pinned P_t
   * order is untouched.
   *
   * 'hidden' keeps the provenance hook mounted while a compact parameter-value
   * card is the visible content of a section.
  */
  contextPlacement?: 'leading' | 'trailing' | 'hidden';
  /** Visual-only variant used by the legacy Walker rail. */
  visualVariant?: 'default' | 'legacy';
}) {
  const isNumerator = side === 'numerator';
  const isLegacy = visualVariant === 'legacy';
  const sectionAccent = accentColor ?? (isNumerator ? UI_TOKENS.color.semantic.tuning : UI_TOKENS.color.semantic.noise);

  const displayTitle = titleText ?? title;
  const displaySubtitle: ReactNode = subtitleText ?? subtitle;

  /*
   * Section-level formula context. It stays *below* the editable control by
   * default: `validate:phase9h:coverage-audit-demotion` locks that order in (the
   * slider is the primary action, the term context is the footnote). The tab's
   * own formula is hoisted to the very top of the page instead, via
   * `FormulaHeader` in SignalTuningPanel. `contextPlacement="leading"` opts a
   * single section out — see the prop doc.
   */
  const formulaContext = (
    <div
      data-testid={`${testId}-formula-context`}
      data-prominence="secondary-context"
      style={{
        display: 'grid',
        gap: isLegacy ? 6 : 6,
        padding: isLegacy ? '10px 12px' : '10px 12px',
        borderRadius: isLegacy ? UI_TOKENS.radius.md : UI_TOKENS.radius.md,
        background: isLegacy ? UI_TOKENS.color.surface.cardFaint : undefined,
        border: isLegacy ? `1px solid ${UI_TOKENS.color.border.subtle}` : `1px solid ${sectionAccent}44`,
        borderLeft: isLegacy ? undefined : `3px solid ${sectionAccent}88`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={groupTitleStyle}>{displayTitle}</div>
        {helpId && (
          <HelpPopover
            helpId={helpId}
            titleText={displayTitle}
            bodyText={typeof displaySubtitle === 'string' ? displaySubtitle : undefined}
            placement="left"
          />
        )}
      </div>
      {showFormula && (formulaExpr ?? formula) ? (
        <div style={{ ...formulaTextStyle, fontSize: UI_TOKENS.type.size.subheading, lineHeight: 1.28, color: sectionAccent }}>
          {formulaExpr ?? formula}
        </div>
      ) : null}
      {!helpId && <div style={captionTextStyle}>{displaySubtitle}</div>}
      {(titleText || subtitleText || (showFormula && formulaExpr)) && (
        <div aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
          {titleText ? <span>{title}</span> : null}
          {showFormula && formulaExpr ? <span>{formula}</span> : null}
          {subtitleText ? <span>{subtitle}</span> : null}
        </div>
      )}
    </div>
  );

  return (
    <section
      data-testid={testId}
      data-formula-side={side}
      style={{
        display: 'grid',
        gap: isLegacy ? 12 : 14,
        padding: isLegacy ? '14px 15px' : '14px 15px',
        borderRadius: isLegacy ? UI_TOKENS.radius.panel : UI_TOKENS.radius.lg,
        background: isLegacy ? UI_TOKENS.color.surface.cardSubtle : undefined,
        border: isLegacy ? `1px solid ${UI_TOKENS.color.border.soft}` : `1px solid ${sectionAccent}55`,
        borderLeft: isLegacy ? `3px solid ${sectionAccent}aa` : undefined,
      }}
    >
      {contextPlacement === 'leading' && formulaContext}
      {children}
      {contextPlacement === 'trailing' && formulaContext}
      {contextPlacement === 'hidden' && (
        <div aria-hidden="true" style={srOnlyStyle}>
          {formulaContext}
        </div>
      )}
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
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const hasCurrentNoiseFloor = formulaBudget !== null && !isFormulaEvidenceStale;
  const canonicalStatusCopy = isFormulaEvidenceStale
    ? 'σ² / noise floor evidence is stale after edit; waiting for the next recomputed frame.'
    : hasCurrentNoiseFloor
      ? 'Computed σ² / noise floor from the current formula evidence.'
      : 'σ² / noise floor appears after a selected formula frame is available.';
  const shortStatus = isFormulaEvidenceStale
    ? txBi(t, isEnglish, 'common.recomputing', '參數已變更，重新計算中…', 'Recomputing after the parameter change…')
    : hasCurrentNoiseFloor
      ? txBi(t, isEnglish, 'common.computed', '依目前參數計算', 'Computed from the current parameters')
      : txBi(t, isEnglish, 'common.waitingFrame', '待第一個模擬影格產生後顯示', 'Shown once the first simulated frame is available');
  const label = txBi(t, isEnglish, 'kpi.noiseFloor.label', '雜訊底線', 'Noise floor');

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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
            <MathSymbol size={22} color={UI_TOKENS.color.semantic.noise}>σ²</MathSymbol>
            <span style={groupTitleStyle}>{label}</span>
          </div>
          {label !== 'Noise floor' && <span style={canonicalTermStyle}>Noise floor</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
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
            {hasCurrentNoiseFloor ? formatDbm(formulaBudget.noiseDbm) : txBi(t, isEnglish, 'common.waiting', '等待中', 'waiting')}
          </div>
          <HelpPopover
            helpId="kpi.noiseFloor"
            titleText={label}
            bodyText={isEnglish
              ? 'The noise floor σ² is the interference-independent term of the SINR denominator. It is computed from the current parameters and cannot be edited directly.'
              : '雜訊底線 σ² 是 SINR 分母中與干擾無關的項目。此值由目前參數計算而得，不可直接編輯。'}
            placement="left"
          />
        </div>
      </div>
      <div style={{ ...captionTextStyle, color: UI_TOKENS.color.semantic.noiseSoft }}>
        {shortStatus}
      </div>
      <div aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
        {canonicalStatusCopy}
      </div>
    </div>
  );
}

export function LossControlSection({
  title,
  titleText,
  subtitle,
  subtitleText,
  formulaExpr,
  accentColor,
  children,
  testId,
  tone = 'formula',
  helpId,
  visualVariant = 'default',
}: {
  /** Canonical English heading, kept for the provenance gates. */
  title: string;
  titleText?: string;
  subtitle: ReactNode;
  subtitleText?: string;
  /**
   * Notation shown at FORMULA size, the same rendering path
   * `FormulaSideControlSection` uses (`formulaTextStyle` at `subheading`, in the
   * section accent).
   *
   * It exists because the path-loss stack's `L = L_fs + L_g + L_sc + L_sf` used
   * to be passed as `subtitle`, and a subtitle renders in the caption box at
   * `size.caption` — the smallest type token in the panel. The same expression
   * one tab over, coming through `FormulaSideControlSection`, renders at
   * `subheading`. The formula was not "too small" by choice; this section
   * simply had no formula slot, so an expression was squeezed into a prose
   * one. When `formulaExpr` is given, the caption box is suppressed and the
   * canonical `subtitle` moves to the hidden provenance block, so the gates
   * that pin that text still find it.
   */
  formulaExpr?: ReactNode;
  /** Colour for `formulaExpr`. Defaults to this section's own tone accent. */
  accentColor?: string;
  children: ReactNode;
  testId: string;
  tone?: 'formula' | 'research';
  helpId?: string;
  /** Visual-only variant used by the legacy Walker rail. */
  visualVariant?: 'default' | 'legacy';
}) {
  const isResearch = tone === 'research';
  const isLegacy = visualVariant === 'legacy';
  const displayTitle = titleText ?? title;
  // Same two accents this section already borders itself with, so the formula
  // reads as belonging to its own block rather than as a foreign element.
  const sectionAccent = accentColor ?? (isResearch ? '#f7d97b' : UI_TOKENS.color.semantic.loss);
  // Canonical copy is preserved whenever the visible copy was localized *or*
  // demoted into the "?" popover *or* replaced on screen by the notation-only
  // `formulaExpr`, so the provenance gates still see it.
  const hasCanonicalOverride = Boolean(titleText || subtitleText || helpId || formulaExpr);

  return (
    <section
      data-testid={testId}
      style={{
        display: 'grid',
        gap: isLegacy ? 12 : 14,
        padding: isLegacy ? '14px 15px' : '14px 15px',
        borderRadius: isLegacy ? UI_TOKENS.radius.panel : UI_TOKENS.radius.lg,
        background: isLegacy ? UI_TOKENS.color.surface.cardSubtle : undefined,
        border: isLegacy
          ? `1px solid ${UI_TOKENS.color.border.soft}`
          : isResearch ? '1px solid rgba(247, 217, 123, 0.22)' : '1px solid rgba(118, 234, 215, 0.2)',
        borderLeft: isLegacy ? `3px solid ${sectionAccent}aa` : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={groupTitleStyle}>{displayTitle}</div>
        {helpId && (
          <HelpPopover
            helpId={helpId}
            titleText={displayTitle}
            bodyText={subtitleText}
            placement="left"
          />
        )}
      </div>
      {formulaExpr && (
        <div
          data-testid={`${testId}-formula`}
          style={{ ...formulaTextStyle, fontSize: UI_TOKENS.type.size.subheading, lineHeight: 1.28, color: sectionAccent }}
        >
          {formulaExpr}
        </div>
      )}
      {!helpId && !formulaExpr && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: UI_TOKENS.radius.md,
            background: isResearch ? 'rgba(247, 217, 123, 0.075)' : 'rgba(88, 191, 240, 0.08)',
            border: isResearch ? '1px solid rgba(247, 217, 123, 0.14)' : '1px solid rgba(88, 191, 240, 0.16)',
            color: isResearch ? 'rgba(255, 230, 173, 0.82)' : UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.caption,
            lineHeight: 1.55,
          }}
        >
          {subtitleText ?? subtitle}
        </div>
      )}
      {hasCanonicalOverride && (
        <div aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
          <span>{title}</span>
          <span>{subtitle}</span>
        </div>
      )}
      {children}
    </section>
  );
}
