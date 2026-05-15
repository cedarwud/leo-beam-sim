import { memo } from 'react';

type NetworkParamInputKind = 'log-slider' | 'slider' | 'int-slider' | 'select' | 'checkbox';

interface BaseInputProps {
  readonly label: string;
  readonly description: string;
  readonly testId: string;
  readonly legacyTestId?: string;
  readonly disabled?: boolean;
  readonly kind: NetworkParamInputKind;
}

interface NumberParamConfig {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly logMin?: number;
  readonly logMax?: number;
  readonly valuePrecision?: number;
}

interface SelectParamConfig {
  readonly value: string;
  readonly options: readonly string[];
}

interface BooleanParamConfig {
  readonly value: boolean;
}

interface NetworkParamInputProps extends BaseInputProps {
  readonly onChange: (nextValue: number | string | boolean) => void;
  readonly kindProps: NumberParamConfig | SelectParamConfig | BooleanParamConfig;
}

function toLogValue(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return Math.log10(fallback);
  return Math.log10(Math.max(value, Number.EPSILON));
}

function fromLogValue(logValue: number): number {
  if (!Number.isFinite(logValue)) return 0;
  return Math.pow(10, logValue);
}

function formatValue(value: number, precision?: number): string {
  if (!Number.isFinite(value)) return '0';
  return precision === undefined ? value.toString() : value.toFixed(precision);
}

function isNumberConfig(value: BaseInputProps['kind'], cfg: NetworkParamInputProps['kindProps']): cfg is NumberParamConfig {
  return value === 'log-slider' || value === 'slider' || value === 'int-slider';
}

function isSelectConfig(value: BaseInputProps['kind'], cfg: NetworkParamInputProps['kindProps']): cfg is SelectParamConfig {
  return value === 'select';
}

function isBooleanConfig(value: BaseInputProps['kind'], cfg: NetworkParamInputProps['kindProps']): cfg is BooleanParamConfig {
  return value === 'checkbox';
}

export const NetworkParamInput = memo(function NetworkParamInput({
  label,
  description,
  testId,
  legacyTestId,
  kind,
  kindProps,
  onChange,
  disabled,
}: NetworkParamInputProps) {
  const legacyMarker = legacyTestId === undefined ? null : (
    <span hidden data-testid={legacyTestId} />
  );

  if (isNumberConfig(kind, kindProps)) {
    const {
      value,
      min,
      max,
      step = 0.01,
      logMin = -6,
      logMax = 0,
      valuePrecision = 4,
    } = kindProps;

    const isLog = kind === 'log-slider';
    const minValue = isLog ? logMin : min;
    const maxValue = isLog ? logMax : max;
    const sliderValue = isLog ? toLogValue(value, 1) : value;
    const displayValue = isLog ? fromLogValue(sliderValue) : value;

    return (
      <label className="leo-modqn-network-param" data-testid={testId}>
        {legacyMarker}
        <span className="leo-modqn-network-param__label">{label}</span>
        <input
          className="leo-modqn-network-param__range leo-ui-range"
          type="range"
          min={minValue}
          max={maxValue}
          step={step}
          value={sliderValue}
          disabled={disabled}
          aria-label={label}
          data-testid={testId}
          onChange={event => {
            if (!isLog) {
              onChange(Number(event.target.value));
              return;
            }
            onChange(fromLogValue(Number(event.target.value)));
          }}
        />
        <output className="leo-modqn-network-param__value">
          {formatValue(displayValue, isLog ? 4 : valuePrecision)}
        </output>
        <small className="leo-modqn-network-param__meta">{description}</small>
      </label>
    );
  }

  if (isSelectConfig(kind, kindProps)) {
    const { value, options } = kindProps;

    return (
      <label className="leo-modqn-network-param" data-testid={testId}>
        {legacyMarker}
        <span className="leo-modqn-network-param__label">{label}</span>
        <select
          className="leo-modqn-network-param__select"
          value={value}
          disabled={disabled}
          aria-label={label}
          data-testid={`${testId}-select`}
          onChange={event => onChange(event.target.value)}
        >
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <small className="leo-modqn-network-param__meta">{description}</small>
      </label>
    );
  }

  if (isBooleanConfig(kind, kindProps)) {
    const { value } = kindProps;

    return (
      <label className="leo-modqn-network-param" data-testid={testId}>
        {legacyMarker}
        <span className="leo-modqn-network-param__label">
          {label}
        </span>
        <input
          type="checkbox"
          className="leo-modqn-network-param__checkbox"
          checked={value}
          disabled={disabled}
          aria-label={label}
          data-testid={`${testId}-checkbox`}
          onChange={event => onChange(event.target.checked)}
        />
        <small className="leo-modqn-network-param__meta">{description}</small>
      </label>
    );
  }

  return null;
});
