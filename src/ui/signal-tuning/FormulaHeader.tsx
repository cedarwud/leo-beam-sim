import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { HelpPopover } from '../common/HelpPopover';
import { renderFormulaText } from '../common/formulaText';
import { txBi } from './labels';
import { captionTextStyle, formulaTextStyle, groupTitleStyle } from './styles';

export { renderFormulaText } from '../common/formulaText';

/**
 * The formula block that sits at the very top of each main tab. A student
 * should be able to see "this is the thing I am editing" before touching a
 * single slider, so this is the first element in the tab body — the seven
 * formula-term sub-tabs and their sliders come after it.
 */
export function FormulaHeader({
  testId,
  title,
  caption,
  accent,
  claim,
  children,
  help,
  action,
  align = 'start',
}: {
  testId: string;
  title: string;
  /**
   * One friendly paragraph, from `formula.<key>.caption`. Optional: on the SINR
   * tab the same sentence is served from the "?" instead, so the header shows
   * the formula and nothing else.
   */
  caption?: string;
  accent: string;
  /** e.g. `SIMULATED TEACHING` — rendered as a badge on the header. */
  claim?: string;
  /** The formula rows themselves. */
  children: ReactNode;
  help?: { helpId: string; body: string; effect?: string };
  /**
   * Optional control rendered in the header's right-hand cluster, next to the
   * claim badge and the "?" — e.g. the SINR tab's reset. It lives here because
   * the block that used to host it further down the page is gone.
   */
  action?: ReactNode;
  /**
   * `center` centres the whole header block — title, formula and caption — on
   * one vertical axis. It is used by the SINR tab, whose body is a single
   * stacked fraction that reads as a blackboard statement rather than as a
   * left-aligned list.
   *
   * The title row becomes a `1fr auto 1fr` grid so the title sits on the exact
   * centre line of the card no matter how wide the claim badge and the "?"
   * cluster on the right happen to be; without the empty left spacer the title
   * would be pushed off-axis by exactly the width of that cluster.
   *
   * `start` (the default) keeps the original title-left / badge-right bar, used
   * by the energy tab, whose body is a stack of `FormulaRow`s that each carry
   * their own right-aligned unit and must stay full-width.
   */
  align?: 'start' | 'center';
}) {
  const centered = align === 'center';
  return (
    <section
      data-testid={testId}
      style={{
        display: 'grid',
        gap: 10,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'rgba(255, 255, 255, 0.055)',
        border: `1px solid ${accent}44`,
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div
        style={centered
          ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }
          : { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}
      >
        {/* Empty left spacer: it is what puts the title on the card's centre
            line instead of the centre of the space the badge cluster leaves. */}
        {centered && <span aria-hidden="true" />}
        <div style={{ ...groupTitleStyle, color: accent, textAlign: centered ? 'center' : 'left' }}>
          {renderFormulaText(title)}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          justifySelf: centered ? 'end' : undefined,
        }}>
          {claim && (
            <span
              data-testid={`${testId}-claim`}
              style={{
                padding: '3px 8px',
                borderRadius: UI_TOKENS.radius.pill,
                background: 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${UI_TOKENS.color.border.soft}`,
                color: UI_TOKENS.color.text.muted,
                fontSize: UI_TOKENS.type.size.tiny,
                fontWeight: UI_TOKENS.type.weight.heavy,
                letterSpacing: 0.4,
                whiteSpace: 'nowrap',
              }}
            >
              {renderFormulaText(claim)}
            </span>
          )}
          {help && (
            <HelpPopover
              helpId={help.helpId}
              titleText={title}
              bodyText={help.body}
              effectText={help.effect}
              placement="left"
            />
          )}
          {action}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, justifyItems: centered ? 'center' : 'stretch' }}>{children}</div>
      {caption && (
        <div style={{ ...captionTextStyle, textAlign: centered ? 'center' : undefined }}>
          {renderFormulaText(caption)}
        </div>
      )}
    </section>
  );
}

/**
 * One formula line: the maths on the left, its unit on the right, and — when
 * `source` is given — a plain-language line underneath saying which slider or
 * which readout on screen that symbol is. Without that line a student can read
 * the whole chain and still not know which knob moves which letter.
 */
export function FormulaRow({
  expression,
  note,
  source,
  accent,
  emphasis = false,
  testId,
  help,
}: {
  expression: ReactNode;
  note?: string;
  /**
   * A SHORT one-liner naming the slider or readout this row owns. Anything
   * longer belongs in `help` — the panel deliberately keeps paragraphs behind
   * the "?" instead of stacking them on screen.
   */
  source?: ReactNode;
  accent: string;
  emphasis?: boolean;
  testId?: string;
  help?: { helpId: string; title: string; body: string; effect?: string };
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'grid',
        gap: 3,
        padding: emphasis ? '8px 10px' : '4px 10px',
        borderRadius: UI_TOKENS.radius.md,
        background: emphasis ? `${accent}14` : 'transparent',
        border: emphasis ? `1px solid ${accent}33` : '1px solid transparent',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
      }}>
        <div style={{
          ...formulaTextStyle,
          fontSize: UI_TOKENS.type.size.subheading,
          lineHeight: 1.35,
          color: emphasis ? accent : UI_TOKENS.color.text.math,
          minWidth: 0,
        }}>
          {expression}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {note && (
            <div style={{
              fontSize: UI_TOKENS.type.size.tiny,
              color: UI_TOKENS.color.text.faint,
              whiteSpace: 'nowrap',
              fontWeight: UI_TOKENS.type.weight.strong,
            }}>
              {renderFormulaText(note)}
            </div>
          )}
          {help && (
            <HelpPopover
              helpId={help.helpId}
              titleText={help.title}
              bodyText={help.body}
              effectText={help.effect}
              placement="left"
            />
          )}
        </div>
      </div>
      {source && (
        <div style={{
          fontSize: UI_TOKENS.type.size.tiny,
          color: UI_TOKENS.color.text.secondary,
          lineHeight: 1.5,
        }}>
          {typeof source === 'string' ? renderFormulaText(source) : source}
        </div>
      )}
    </div>
  );
}

/** A stacked fraction, so SINR reads like it does on a whiteboard. */
export function FormulaFraction({
  lhs,
  numerator,
  denominator,
  numeratorAccent,
  denominatorAccent,
  lhsFontSize = UI_TOKENS.type.size.formula,
  termFontSize = UI_TOKENS.type.size.subheading,
}: {
  lhs: ReactNode;
  numerator: ReactNode;
  denominator: ReactNode;
  numeratorAccent: string;
  denominatorAccent: string;
  /** Optional narrow-rail size for a long indexed left-hand side. */
  lhsFontSize?: number;
  /** Optional narrow-rail size for unusually long numerator/denominator terms. */
  termFontSize?: number;
}) {
  return (
    // Horizontally centred: the whole expression is the subject of the tab, so
    // it sits on the panel's centre line rather than hanging off the left edge.
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      flexWrap: 'wrap',
      padding: '4px 0',
      // Full width rather than shrink-to-fit, so the expression stays on the
      // card's centre line even when the rail is narrow enough that `γ =` and
      // the fraction wrap onto two rows.
      width: '100%',
      minWidth: 0,
    }}>
      <span style={{ ...formulaTextStyle, fontSize: lhsFontSize, lineHeight: 1.1 }}>
        {lhs} =
      </span>
      <span style={{ display: 'inline-grid', gap: 3, justifyItems: 'center', minWidth: 0 }}>
        <span style={{
          ...formulaTextStyle,
          fontSize: termFontSize,
          lineHeight: 1.2,
          color: numeratorAccent,
        }}>
          {numerator}
        </span>
        <span style={{
          width: '100%',
          height: 2,
          borderRadius: 2,
          background: UI_TOKENS.color.border.soft,
        }} />
        <span style={{
          ...formulaTextStyle,
          fontSize: termFontSize,
          lineHeight: 1.2,
          color: denominatorAccent,
        }}>
          {denominator}
        </span>
      </span>
    </div>
  );
}

/** Inline stacked fraction for a formula row or a product containing a ratio. */
export function InlineFormulaFraction({
  numerator,
  denominator,
  label,
  testId,
}: {
  readonly numerator: ReactNode;
  readonly denominator: ReactNode;
  readonly label: string;
  readonly testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      role="math"
      aria-label={label}
      style={{
        display: 'inline-grid',
        justifyItems: 'stretch',
        alignItems: 'center',
        verticalAlign: 'middle',
        lineHeight: 1.05,
        margin: '0 3px',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ borderBottom: '1px solid currentColor', padding: '0 3px', textAlign: 'center' }}>
        {numerator}
      </span>
      <span aria-hidden="true" style={{ padding: '0 3px', textAlign: 'center' }}>
        {denominator}
      </span>
    </span>
  );
}

/** Small helper so tab bodies can name the numerator/denominator in words. */
export function useFormulaWords() {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  return {
    wanted: txBi(t, isEnglish, 'common.wantedSignal', '接收訊號功率', 'received signal power'),
    unwanted: txBi(t, isEnglish, 'common.unwantedSignal', '干擾與雜訊', 'interference and noise'),
  };
}
