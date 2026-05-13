import type { ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import { formatWithUnit } from './formatters';
import { MathSymbol } from './MathSymbol';
import {
  compactDetailsStyle,
  compactSummaryStyle,
  explanatoryTextStyle,
} from './styles';

interface NumericControlProps {
  symbol: ReactNode;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description: string;
  effect: string;
  accentColor?: string;
  disabled?: boolean;
  inactiveReason?: string;
  formatValue?: (value: number) => string;
  testId?: string;
  onChange: (value: number) => void;
}
export function NumericControl({
  symbol,
  label,
  unit,
  value,
  min,
  max,
  step,
  description,
  effect,
  accentColor = UI_TOKENS.color.semantic.tuning,
  disabled = false,
  inactiveReason,
  formatValue,
  testId,
  onChange,
}: NumericControlProps) {
  const formatRangeEndpoint = (endpoint: number) => (
    formatValue ? formatValue(endpoint) : formatWithUnit(endpoint, unit)
  );

  return (
    <div
      data-testid={testId}
      data-control-active={disabled ? 'false' : 'true'}
      style={{
        display: 'grid',
        gap: 11,
        opacity: disabled ? 0.58 : 1,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: disabled ? 'rgba(132, 148, 163, 0.06)' : 'rgba(255, 255, 255, 0.09)',
        border: disabled ? `1px solid ${UI_TOKENS.color.border.subtle}` : '1px solid rgba(218, 244, 255, 0.18)',
        borderLeft: disabled ? '4px solid rgba(132, 148, 163, 0.28)' : `4px solid ${accentColor}aa`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, marginBottom: 5 }}>
            <MathSymbol color={disabled ? UI_TOKENS.color.text.faint : accentColor}>{symbol}</MathSymbol>
            <span
              title={description}
              style={{
                fontSize: UI_TOKENS.type.size.bodyLg,
                color: UI_TOKENS.color.text.controlLabel,
                lineHeight: 1.3,
                fontWeight: UI_TOKENS.type.weight.heavy,
              }}
            >
              {label}
            </span>
          </div>
        </div>
        <div style={{
          padding: '6px 10px',
          borderRadius: UI_TOKENS.radius.md,
          background: disabled ? 'rgba(132, 148, 163, 0.08)' : 'rgba(255, 255, 255, 0.055)',
          border: disabled ? `1px solid ${UI_TOKENS.color.border.subtle}` : `1px solid ${accentColor}38`,
          color: disabled ? UI_TOKENS.color.text.faint : UI_TOKENS.color.text.primary,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {formatValue ? formatValue(value) : formatWithUnit(value, unit)}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        <input
          className={UI_CLASSES.range}
          type="range"
          aria-label={`${label} (${unit})`}
          disabled={disabled}
          aria-disabled={disabled}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
          style={{ width: '100%', accentColor, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <div
          data-testid={testId ? `${testId}-range-endpoints` : undefined}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.35,
          }}
        >
          <span>Min {formatRangeEndpoint(min)}</span>
          <span>Max {formatRangeEndpoint(max)}</span>
        </div>
      </div>
      <details
        data-testid={testId ? `${testId}-details` : undefined}
        data-prominence="inline-description"
        style={{
          color: disabled ? UI_TOKENS.color.text.faint : UI_TOKENS.color.text.muted,
          fontSize: UI_TOKENS.type.size.body,
          lineHeight: 1.5,
        }}
      >
        <summary style={{
          cursor: 'pointer',
          color: disabled ? UI_TOKENS.color.text.faint : UI_TOKENS.color.text.secondary,
          fontWeight: UI_TOKENS.type.weight.strong,
        }}>
          Details
        </summary>
        <div style={{ display: 'grid', gap: 6, paddingTop: 8 }}>
          <div style={{ ...explanatoryTextStyle, color: disabled ? UI_TOKENS.color.text.faint : UI_TOKENS.color.text.secondary }}>
            {description}
          </div>
          <div
            data-testid={testId ? `${testId}-effect` : undefined}
            style={{ ...explanatoryTextStyle, color: disabled ? UI_TOKENS.color.text.faint : UI_TOKENS.color.text.secondary }}
          >
            {disabled && inactiveReason ? inactiveReason : effect}
          </div>
        </div>
      </details>
    </div>
  );
}

export function SelectControl({
  symbol,
  label,
  description,
  value,
  options,
  accentColor = UI_TOKENS.color.semantic.tuning,
  onChange,
}: {
  symbol: ReactNode;
  label: string;
  description: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string; detail?: string }>;
  accentColor?: string;
  onChange: (value: string) => void;
}) {
  const activeOption = options.find(option => option.value === value);

  return (
    <div style={{
      display: 'grid',
      gap: 12,
      padding: '12px 13px',
      borderRadius: UI_TOKENS.radius.lg,
      background: UI_TOKENS.color.surface.card,
      border: `1px solid ${UI_TOKENS.color.border.subtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 11 }}>
        <MathSymbol color={accentColor}>{symbol}</MathSymbol>
        <span style={{ fontSize: UI_TOKENS.type.size.subheading, color: UI_TOKENS.color.text.controlLabel, fontWeight: UI_TOKENS.type.weight.heavy }}>{label}</span>
      </div>
      <select
        className={UI_CLASSES.select}
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
        style={{
          cursor: 'pointer',
          width: '100%',
          borderRadius: UI_TOKENS.radius.md,
          border: `1px solid ${accentColor}33`,
          background: UI_TOKENS.color.surface.field,
          color: UI_TOKENS.color.text.primary,
          padding: '12px 13px',
          fontSize: UI_TOKENS.type.size.control,
        }}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {activeOption?.detail && (
        <div style={explanatoryTextStyle}>
          {activeOption.detail}
        </div>
      )}
      <details style={compactDetailsStyle}>
        <summary style={compactSummaryStyle}>Details</summary>
        <div style={{ ...explanatoryTextStyle, paddingTop: 8 }}>
          {description}
        </div>
      </details>
    </div>
  );
}

export function PathLossTermControl({
  active,
  symbol,
  label,
  detail,
  controlLabel,
  unit,
  value,
  min,
  max,
  step,
  effect,
  inactiveReason,
  accentColor = UI_TOKENS.color.semantic.tuning,
  formatValue,
  testId,
  onToggle,
  onChange,
}: {
  active: boolean;
  symbol: ReactNode;
  label: string;
  detail: string;
  controlLabel: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  effect: string;
  inactiveReason: string;
  accentColor?: string;
  formatValue?: (value: number) => string;
  testId?: string;
  onToggle: () => void;
  onChange: (value: number) => void;
}) {
  const displayValue = formatValue ? formatValue(value) : formatWithUnit(value, unit);
  const formatRangeEndpoint = (endpoint: number) => (
    formatValue ? formatValue(endpoint) : formatWithUnit(endpoint, unit)
  );
  const termAccent = active ? UI_TOKENS.color.text.secondary : UI_TOKENS.color.text.faint;
  const primaryText = active ? UI_TOKENS.color.text.label : UI_TOKENS.color.text.faint;
  const secondaryText = active ? UI_TOKENS.color.text.muted : UI_TOKENS.color.text.faint;
  const termBackground = active ? 'rgba(255, 255, 255, 0.045)' : 'rgba(132, 148, 163, 0.04)';

  return (
    <section
      className="leo-path-loss-term-row"
      data-testid={testId}
      data-path-loss-term-state={active ? 'on' : 'off'}
      style={{
        display: 'grid',
        gap: 9,
        padding: '12px 13px',
        borderRadius: UI_TOKENS.radius.lg,
        border: `1px solid ${active ? 'rgba(218, 244, 255, 0.14)' : UI_TOKENS.color.border.subtle}`,
        borderLeft: `3px solid ${active ? `${accentColor}66` : 'rgba(132, 148, 163, 0.24)'}`,
        background: termBackground,
        color: primaryText,
        opacity: active ? 1 : 0.58,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
        <div
          title={detail}
          style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}
        >
          <MathSymbol size={24} color={termAccent}>{symbol}</MathSymbol>
          <span style={{
            fontSize: UI_TOKENS.type.size.bodyLg,
            color: primaryText,
            fontWeight: UI_TOKENS.type.weight.strong,
            lineHeight: 1.25,
          }}>
            {label}
          </span>
        </div>
        <button
          className={`${UI_CLASSES.button} leo-path-loss-switch`}
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={`${label} path-loss component ${active ? 'on' : 'off'}`}
          data-state={active ? 'on' : 'off'}
          data-testid={testId ? `${testId}-switch` : undefined}
          onClick={onToggle}
          style={{
            cursor: 'pointer',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: active ? 'flex-start' : 'flex-end',
            width: 66,
            height: 30,
            padding: '0 9px',
            borderRadius: UI_TOKENS.radius.pill,
            border: active ? `1px solid ${accentColor}38` : '1px solid rgba(132, 148, 163, 0.32)',
            background: active ? 'rgba(255, 255, 255, 0.05)' : 'rgba(132, 148, 163, 0.10)',
            color: active ? UI_TOKENS.color.text.label : UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.caption,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0,
            boxSizing: 'border-box',
            touchAction: 'manipulation',
          }}
        >
          <span>{active ? 'ON' : 'OFF'}</span>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 4,
              left: active ? 40 : 4,
              width: 20,
              height: 20,
              borderRadius: UI_TOKENS.radius.pill,
              background: active ? `${accentColor}b8` : UI_TOKENS.color.semantic.inactive,
              boxShadow: active ? `0 0 4px ${accentColor}20` : 'none',
            }}
          />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
          <span style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'baseline',
            color: primaryText,
            fontSize: UI_TOKENS.type.size.body,
            fontWeight: UI_TOKENS.type.weight.strong,
          }}>
            <span>{controlLabel}</span>
            <span style={{ fontSize: UI_TOKENS.type.size.small, color: secondaryText }}>
              {active ? effect : inactiveReason}
            </span>
          </span>
          <input
            className={UI_CLASSES.range}
            type="range"
            aria-label={`${controlLabel} (${unit})`}
            disabled={!active}
            aria-disabled={!active}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            style={{ width: '100%', accentColor, cursor: active ? 'pointer' : 'not-allowed' }}
          />
          <span
            data-testid={testId ? `${testId}-range-meta` : undefined}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              color: secondaryText,
              fontSize: UI_TOKENS.type.size.body,
              lineHeight: 1.35,
            }}
          >
            <span>Min {formatRangeEndpoint(min)}</span>
            <span>Max {formatRangeEndpoint(max)}</span>
          </span>
        </label>
        <div style={{
          minWidth: 84,
          padding: '6px 9px',
          borderRadius: UI_TOKENS.radius.md,
          background: active ? 'rgba(255, 255, 255, 0.04)' : 'rgba(132, 148, 163, 0.05)',
          border: active ? '1px solid rgba(218, 244, 255, 0.13)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
          color: active ? UI_TOKENS.color.text.label : UI_TOKENS.color.text.faint,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}>
          {displayValue}
        </div>
      </div>

      <details data-testid={testId ? `${testId}-details` : undefined} style={{
        color: UI_TOKENS.color.text.muted,
        fontSize: UI_TOKENS.type.size.body,
        lineHeight: 1.55,
      }}>
        <summary style={{ cursor: 'pointer', color: secondaryText, fontWeight: UI_TOKENS.type.weight.strong }}>
          Details
        </summary>
        <div style={{ display: 'grid', gap: 6, paddingTop: 8 }}>
          <div>{detail}</div>
        </div>
      </details>
    </section>
  );
}
