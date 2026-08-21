import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { captionTextStyle, formulaTextStyle, groupTitleStyle } from './styles';
import { renderFormulaText } from '../common/formulaText';

export interface FormulaSymbolGuideRow {
  readonly testId: string;
  readonly symbol: ReactNode;
  readonly explanation: ReactNode;
  readonly accent: string;
}

export function FormulaSymbolGuide({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly FormulaSymbolGuideRow[];
}) {
  return (
    <section
      data-testid="formula-symbol-guide"
      style={{
        display: 'grid',
        gap: 8,
        padding: '12px 14px',
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.soft}`,
      }}
    >
      <div style={groupTitleStyle}>{title}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map(row => (
          <div
            key={row.testId}
            data-testid={row.testId}
            style={{
              display: 'grid',
              gap: 3,
              padding: '8px 10px',
              borderRadius: UI_TOKENS.radius.md,
              background: UI_TOKENS.color.surface.cardSubtle,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
            }}
          >
            <div
              data-testid={`${row.testId}-symbol`}
              style={{
                ...formulaTextStyle,
                color: row.accent,
                fontSize: UI_TOKENS.type.size.metric,
                fontWeight: UI_TOKENS.type.weight.heavy,
                lineHeight: 1.2,
                overflowWrap: 'anywhere',
              }}
            >
              {row.symbol}
            </div>
            <div
              data-testid={`${row.testId}-explanation`}
              style={{ ...captionTextStyle, fontSize: UI_TOKENS.type.size.caption, lineHeight: 1.48 }}
            >
              {typeof row.explanation === 'string' ? renderFormulaText(row.explanation) : row.explanation}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
