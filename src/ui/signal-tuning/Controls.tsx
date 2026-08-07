import type { ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { HelpPopover } from '../common/HelpPopover';
import { renderInlineFormula } from '../common/inlineFormula';
import { formatWithUnit } from './formatters';
import { isSameLabel, tx, txBi, type Translate } from './labels';
import { MathSymbol } from './MathSymbol';
import {
  canonicalTermStyle,
  controlLabelStyle,
  explanatoryTextStyle,
  srOnlyStyle,
} from './styles';

/**
 * Every control in this file used to print two paragraphs of English prose
 * (`description` + `effect`) under its slider. They now live behind a single
 * "?" button on the right of the label row (HelpPopover, `placement="left"`),
 * which is what a student actually needs: a quiet panel, with the definition
 * one click away and translated.
 *
 * The English `description` / `effect` / `detail` props are still rendered,
 * but into an `aria-hidden`, visually-hidden block that keeps the existing
 * `<testId>-details` / `<testId>-effect` / `<testId>-range-endpoints` hooks
 * alive. Two reasons, in this order:
 *   1. `npm run validate:phase9b:power-noise-separation` and
 *      `validate:phase8b:path-loss-controls` assert on that copy to prove a
 *      term never drifts to the wrong side of the SINR fraction. That
 *      provenance check is worth keeping.
 *   2. It is `aria-hidden` precisely so screen readers do not read the English
 *      copy on top of the localized popover — the popover is the accessible
 *      path (role="dialog", proper labelling, Esc/outside-click).
 */

interface ControlHelpProps {
  /** Stable, app-unique help id, e.g. `param.maxTxPowerDbm`. */
  readonly helpId?: string;
  readonly helpBodyKey?: string;
  readonly helpEffectKey?: string;
}

function ControlHelpButton({
  helpId,
  title,
  body,
  effect,
  meta,
}: {
  helpId: string;
  title: string;
  body: string;
  effect?: string;
  meta?: ReactNode;
}) {
  return (
    <HelpPopover
      helpId={helpId}
      titleText={title}
      bodyText={body}
      effectText={effect}
      meta={meta}
      placement="left"
    />
  );
}

function RangeMeta({
  t,
  isEnglish,
  unitLabel,
  minText,
  maxText,
}: {
  t: Translate;
  isEnglish: boolean;
  unitLabel: string;
  minText: string;
  maxText: string;
}) {
  // NOTE: `common.unitLabel`, not `common.unit` — `common.unit.*` is already the
  // unit-symbol namespace (common.unit.dbm, …) in the catalog.
  const rangeWord = txBi(t, isEnglish, 'common.rangeLabel', '可調範圍', 'Range');
  const unitWord = txBi(t, isEnglish, 'common.unitLabel', '單位', 'Unit');
  return (
    <>
      <div>{unitWord}: {unitLabel}</div>
      <div>{rangeWord}: {minText} – {maxText}</div>
    </>
  );
}

interface NumericControlProps {
  symbol: ReactNode;
  /** Canonical English term. Drives aria-label and stays the fallback label. */
  label: string;
  /** i18n key for the student-facing label, e.g. `param.maxTxPowerDbm.label`. */
  labelKey?: string;
  unit: string;
  unitKey?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** English fallback for "what is this". Surfaced through the help popover. */
  description: string;
  /** English fallback for "what changes if I move it". */
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
  labelKey,
  unit,
  unitKey,
  value,
  min,
  max,
  step,
  description,
  effect,
  helpId,
  helpBodyKey,
  helpEffectKey,
  accentColor = UI_TOKENS.color.semantic.tuning,
  disabled = false,
  inactiveReason,
  formatValue,
  testId,
  onChange,
}: NumericControlProps & ControlHelpProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const formatRangeEndpoint = (endpoint: number) => (
    formatValue ? formatValue(endpoint) : formatWithUnit(endpoint, unit)
  );

  const displayLabel = tx(t, labelKey, label);
  const unitLabel = tx(t, unitKey, unit);
  const showCanonical = !isSameLabel(displayLabel, label);
  const helpBody = tx(t, helpBodyKey, description);
  const helpEffect = disabled && inactiveReason ? inactiveReason : tx(t, helpEffectKey, effect);

  return (
    <div
      data-testid={testId}
      data-control-active={disabled ? 'false' : 'true'}
      style={{
        display: 'grid',
        gap: 10,
        opacity: disabled ? 0.58 : 1,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: disabled ? 'rgba(132, 148, 163, 0.06)' : 'rgba(255, 255, 255, 0.09)',
        border: disabled ? `1px solid ${UI_TOKENS.color.border.subtle}` : '1px solid rgba(218, 244, 255, 0.18)',
        borderLeft: disabled ? '4px solid rgba(132, 148, 163, 0.28)' : `4px solid ${accentColor}aa`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <MathSymbol color={disabled ? UI_TOKENS.color.text.faint : accentColor}>{symbol}</MathSymbol>
            <span style={{ ...controlLabelStyle, color: disabled ? UI_TOKENS.color.text.faint : controlLabelStyle.color }}>
              {renderInlineFormula(displayLabel)}
            </span>
          </div>
          {showCanonical && (
            <span style={canonicalTermStyle}>{label}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
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
          {helpId && (
            <ControlHelpButton
              helpId={helpId}
              title={displayLabel}
              body={helpBody}
              effect={helpEffect}
              meta={(
                <RangeMeta
                  t={t}
                  isEnglish={isEnglish}
                  unitLabel={unitLabel}
                  minText={formatRangeEndpoint(min)}
                  maxText={formatRangeEndpoint(max)}
                />
              )}
            />
          )}
        </div>
      </div>
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
      <span
        aria-hidden="true"
        data-testid={testId ? `${testId}-range-endpoints` : undefined}
        style={srOnlyStyle}
      >
        Min {formatRangeEndpoint(min)} Max {formatRangeEndpoint(max)}
      </span>
      <div
        data-testid={testId ? `${testId}-details` : undefined}
        data-prominence="canonical-copy"
        aria-hidden="true"
        style={srOnlyStyle}
      >
        <span>{description}</span>
        <span data-testid={testId ? `${testId}-effect` : undefined}>
          {disabled && inactiveReason ? inactiveReason : effect}
        </span>
      </div>
    </div>
  );
}

export function SelectControl({
  symbol,
  label,
  labelKey,
  description,
  value,
  options,
  helpId,
  helpBodyKey,
  helpEffectKey,
  effect,
  accentColor = UI_TOKENS.color.semantic.tuning,
  onChange,
}: {
  symbol: ReactNode;
  label: string;
  labelKey?: string;
  description: string;
  effect?: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string; detail?: string }>;
  accentColor?: string;
  onChange: (value: string) => void;
} & ControlHelpProps) {
  const { t } = useLocale();
  const activeOption = options.find(option => option.value === value);
  const displayLabel = tx(t, labelKey, label);
  const showCanonical = !isSameLabel(displayLabel, label);

  return (
    <div style={{
      display: 'grid',
      gap: 10,
      padding: '12px 13px',
      borderRadius: UI_TOKENS.radius.lg,
      background: UI_TOKENS.color.surface.card,
      border: `1px solid ${UI_TOKENS.color.border.subtle}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <MathSymbol color={accentColor}>{symbol}</MathSymbol>
            <span style={controlLabelStyle}>{renderInlineFormula(displayLabel)}</span>
          </div>
          {showCanonical && <span style={canonicalTermStyle}>{label}</span>}
        </div>
        {helpId && (
          <ControlHelpButton
            helpId={helpId}
            title={displayLabel}
            body={tx(t, helpBodyKey, description)}
            effect={effect ? tx(t, helpEffectKey, effect) : undefined}
          />
        )}
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
      <div aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
        {description}
      </div>
    </div>
  );
}

export function PathLossTermControl({
  active,
  symbol,
  label,
  labelText,
  detail,
  controlLabel,
  controlLabelText,
  unit,
  unitKey,
  value,
  min,
  max,
  step,
  effect,
  inactiveReason,
  helpId,
  helpBodyKey,
  helpEffectKey,
  accentColor = UI_TOKENS.color.semantic.tuning,
  formatValue,
  testId,
  onToggle,
  onChange,
}: {
  active: boolean;
  /** Canonical English term name; also drives the switch's aria-label. */
  label: string;
  symbol: ReactNode;
  /** Already-localized term name shown to the student. */
  labelText?: string;
  detail: string;
  /** Canonical English slider label; also drives the slider's aria-label. */
  controlLabel: string;
  /** Already-localized slider label shown to the student. */
  controlLabelText?: string;
  unit: string;
  unitKey?: string;
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
} & ControlHelpProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const displayValue = formatValue ? formatValue(value) : formatWithUnit(value, unit);
  const formatRangeEndpoint = (endpoint: number) => (
    formatValue ? formatValue(endpoint) : formatWithUnit(endpoint, unit)
  );
  const termAccent = active ? UI_TOKENS.color.text.secondary : UI_TOKENS.color.text.faint;
  const primaryText = active ? UI_TOKENS.color.text.label : UI_TOKENS.color.text.faint;
  const secondaryText = active ? UI_TOKENS.color.text.muted : UI_TOKENS.color.text.faint;
  const termBackground = active ? 'rgba(255, 255, 255, 0.045)' : 'rgba(132, 148, 163, 0.04)';

  const displayLabel = labelText ?? label;
  const displayControlLabel = controlLabelText ?? controlLabel;
  const unitLabel = tx(t, unitKey, unit);
  // The switch text is deliberately a short word in both locales; 'ON'/'OFF'
  // remain the literal fallbacks so the state reads the same as the DOM state.
  const onLabel = txBi(t, isEnglish, 'common.on', '開', 'ON');
  const offLabel = txBi(t, isEnglish, 'common.off', '關', 'OFF');

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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: 8 }}>
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
            {renderInlineFormula(displayLabel)}
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
          <span>{active ? onLabel : offLabel}</span>
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
        {helpId && (
          <ControlHelpButton
            helpId={helpId}
            title={displayLabel}
            body={tx(t, helpBodyKey, detail)}
            effect={active ? tx(t, helpEffectKey, effect) : inactiveReason}
            meta={(
              <RangeMeta
                t={t}
                isEnglish={isEnglish}
                unitLabel={unitLabel}
                minText={formatRangeEndpoint(min)}
                maxText={formatRangeEndpoint(max)}
              />
            )}
          />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
          <span style={{
            color: primaryText,
            fontSize: UI_TOKENS.type.size.body,
            fontWeight: UI_TOKENS.type.weight.strong,
          }}>
            {displayControlLabel}
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
            aria-hidden="true"
            data-testid={testId ? `${testId}-range-meta` : undefined}
            style={srOnlyStyle}
          >
            Min {formatRangeEndpoint(min)} Max {formatRangeEndpoint(max)}
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

      <div
        data-testid={testId ? `${testId}-details` : undefined}
        data-prominence="canonical-copy"
        aria-hidden="true"
        style={{ ...srOnlyStyle, color: secondaryText }}
      >
        <span>{detail}</span>
      </div>
    </section>
  );
}
