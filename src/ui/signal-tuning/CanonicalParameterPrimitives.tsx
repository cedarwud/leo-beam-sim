import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { renderFormulaText } from './FormulaHeader';
import { captionTextStyle, controlLabelStyle, groupTitleStyle, pagePanelStyle } from './styles';
import { MathSymbol } from './MathSymbol';

export function CanonicalReadOnlyParameter({
  label,
  value,
  note,
  accent = UI_TOKENS.color.text.primary,
  testId,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly note: string;
  readonly accent?: string;
  readonly testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      data-readonly="true"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 8,
        alignItems: 'stretch',
        padding: '8px 9px',
        borderRadius: UI_TOKENS.radius.md,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <span data-control-identity="true" style={{ display: 'grid', gap: 3, minWidth: 0, alignContent: 'space-between' }}>
        <span data-control-label="true" style={{ ...controlLabelStyle, color: UI_TOKENS.color.text.primary }}>
          {renderFormulaText(note)}
        </span>
        <span data-control-symbol="true" style={{ display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
          <MathSymbol size={22} color={accent}>
            {typeof label === 'string' ? renderFormulaText(label) : label}
          </MathSymbol>
        </span>
      </span>
      <strong data-control-value="true" style={{ alignSelf: 'end', color: accent, fontSize: UI_TOKENS.type.size.metric, fontWeight: UI_TOKENS.type.weight.heavy, lineHeight: 1.2, overflowWrap: 'anywhere', textAlign: 'right' }}>
        {value}
      </strong>
    </div>
  );
}

export function CanonicalParameterSection({
  title,
  children,
  testId,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly testId: string;
}) {
  return (
    <section id={testId} data-testid={testId} style={{ ...pagePanelStyle, display: 'grid', gap: 10 }}>
      <div style={groupTitleStyle}>{renderFormulaText(title)}</div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </section>
  );
}

export function CanonicalPageLink({
  label,
  description,
  accent,
  onClick,
  testId,
}: {
  readonly label: string;
  readonly description: string;
  readonly accent: string;
  readonly onClick: () => void;
  readonly testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        display: 'grid',
        gap: 3,
        width: '100%',
        padding: '9px 10px',
        borderRadius: UI_TOKENS.radius.md,
        border: `1px solid ${accent}66`,
        borderLeft: `4px solid ${accent}`,
        background: UI_TOKENS.color.surface.card,
        color: UI_TOKENS.color.text.primary,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <strong style={{ fontSize: UI_TOKENS.type.size.body }}>{renderFormulaText(label)}</strong>
      <span style={captionTextStyle}>{renderFormulaText(description)}</span>
    </button>
  );
}
