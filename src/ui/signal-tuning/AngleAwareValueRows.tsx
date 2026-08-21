import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { AngleAwareFormulaFrame } from '../../engine/signal/types';
import {
  formatCompactNumber,
  formatEnergyEfficiency,
  formatFrequency,
  formatEngineering,
  formatPower,
  formatRate,
} from './formatters';

export type AngleAwareValueKind =
  | 'number'
  | 'distance'
  | 'angle'
  | 'power'
  | 'rate'
  | 'frequency'
  | 'ee';

export interface AngleAwareValueRow {
  readonly testId: string;
  readonly symbol: ReactNode;
  readonly label: string;
  readonly value: number | null | undefined;
  readonly kind?: AngleAwareValueKind;
  readonly digits?: number;
  readonly scope?: 'primary-ue' | 'system' | 'beam-aggregate';
  readonly scopeLabel?: string;
}

function formatValue(
  value: number | null | undefined,
  kind: AngleAwareValueKind,
  digits: number,
): string {
  switch (kind) {
    case 'distance':
      return formatEngineering(value, 'm');
    case 'angle':
      return formatCompactNumber(value, 'rad', digits);
    case 'power':
      return formatPower(value);
    case 'rate':
      return formatRate(value);
    case 'frequency':
      return formatFrequency(value);
    case 'ee':
      return formatEnergyEfficiency(value);
    default:
      return formatCompactNumber(value, '', digits);
  }
}

export function AngleAwareValueRows({
  rows,
  emptyLabel = '—',
}: {
  readonly rows: readonly AngleAwareValueRow[];
  readonly emptyLabel?: string;
}) {
  return (
    <div
      data-testid="angle-aware-value-rows"
      style={{
        display: 'grid',
        gap: 5,
        width: '100%',
      }}
    >
      {rows.map(row => (
        <div
          key={row.testId}
          data-testid={row.testId}
          data-scope={row.scope}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'baseline',
            gap: 10,
            padding: '7px 9px',
            borderRadius: UI_TOKENS.radius.md,
            background: 'rgba(255, 255, 255, 0.035)',
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
          }}
        >
          <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  color: UI_TOKENS.color.text.math,
                  fontFamily: UI_TOKENS.type.family.math,
                  fontSize: UI_TOKENS.type.size.body,
                  fontWeight: UI_TOKENS.type.weight.heavy,
                  lineHeight: 1.25,
                  overflowWrap: 'anywhere',
                }}
              >
                {row.symbol}
              </span>
              {row.scopeLabel && (
                <span
                  className="leo-walker-result-row__scope-tag"
                  data-scope={row.scope ?? 'primary-ue'}
                >
                  {row.scopeLabel}
                </span>
              )}
            </span>
            <span
              style={{
                color: UI_TOKENS.color.text.secondary,
                fontSize: UI_TOKENS.type.size.tiny,
                lineHeight: 1.2,
              }}
            >
              {row.label}
            </span>
          </span>
          <strong
            style={{
              color: UI_TOKENS.color.text.primary,
              fontSize: UI_TOKENS.type.size.body,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {row.value === null || row.value === undefined || !Number.isFinite(row.value)
              ? emptyLabel
              : formatValue(row.value, row.kind ?? 'number', row.digits ?? 3)}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function AngleAwareFrameIdentity({
  frame,
}: {
  readonly frame: AngleAwareFormulaFrame | null | undefined;
}) {
  if (!frame) return null;
  return (
    <span
      data-testid="angle-aware-frame-identity"
      style={{
        color: UI_TOKENS.color.text.muted,
        fontSize: UI_TOKENS.type.size.tiny,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {frame.ueId} · {frame.satId} · v{frame.beamId}
    </span>
  );
}
