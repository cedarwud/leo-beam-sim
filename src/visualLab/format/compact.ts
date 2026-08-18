/**
 * Small, presentation-only formatters for the visual-lab readouts.
 *
 * The experiment schema owns parameter units.  These helpers only choose a
 * human-readable SI prefix for values that are already computed or selected.
 * They never emit JavaScript exponent notation.
 */

export interface CompactUnitParts {
  readonly value: string;
  readonly unit: string;
}

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function numberText(value: number, significantDigits = 3): string {
  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumSignificantDigits: significantDigits,
  }).format(Object.is(value, -0) ? 0 : value);
}

const ENGINEERING_PREFIXES = Object.freeze([
  { threshold: 1e-9, symbol: 'n' },
  { threshold: 1e-6, symbol: 'µ' },
  { threshold: 1e-3, symbol: 'm' },
  { threshold: 1, symbol: '' },
  { threshold: 1e3, symbol: 'k' },
  { threshold: 1e6, symbol: 'M' },
  { threshold: 1e9, symbol: 'G' },
  { threshold: 1e12, symbol: 'T' },
] as const);

function engineeringParts(
  value: number | null | undefined,
  unit: string,
  significantDigits = 3,
): CompactUnitParts | null {
  if (!finite(value)) return null;
  if (value === 0) return { value: '0', unit };

  const magnitude = Math.abs(value);
  let prefix = ENGINEERING_PREFIXES.reduce((candidate, current) => (
    magnitude >= current.threshold ? current : candidate
  ), ENGINEERING_PREFIXES[0]!);
  let scaled = value / prefix.threshold;
  if (Math.abs(Number(scaled.toPrecision(significantDigits))) >= 1000) {
    const nextIndex = ENGINEERING_PREFIXES.indexOf(prefix) + 1;
    if (nextIndex < ENGINEERING_PREFIXES.length) {
      prefix = ENGINEERING_PREFIXES[nextIndex]!;
      scaled = value / prefix.threshold;
    }
  }
  return { value: numberText(scaled, significantDigits), unit: `${prefix.symbol}${unit}` };
}

function join(parts: CompactUnitParts | null): string {
  return parts === null ? '—' : `${parts.value} ${parts.unit}`;
}

/** Format a dimensioned value with k/M/G (and small SI prefixes) as needed. */
export function formatCompactUnit(
  value: number | null | undefined,
  unit: string,
  significantDigits = 3,
): string {
  return join(engineeringParts(value, unit, significantDigits));
}

export function formatCompactUnitParts(
  value: number | null | undefined,
  unit: string,
  significantDigits = 3,
): CompactUnitParts | null {
  return engineeringParts(value, unit, significantDigits);
}

export function formatRate(value: number | null | undefined): string {
  return formatCompactUnit(value, 'bit/s');
}

export function formatRateParts(value: number | null | undefined): CompactUnitParts | null {
  return formatCompactUnitParts(value, 'bit/s');
}

export function formatBits(value: number | null | undefined): string {
  return formatCompactUnit(value, 'bit');
}

export function formatPower(value: number | null | undefined): string {
  return formatCompactUnit(value, 'W');
}

export function formatPowerParts(value: number | null | undefined): CompactUnitParts | null {
  return formatCompactUnitParts(value, 'W');
}

export function formatFrequency(value: number | null | undefined): string {
  return formatCompactUnit(value, 'Hz');
}

export function formatEnergy(value: number | null | undefined): string {
  if (!finite(value)) return '—';
  if (value === 0) return '0 J';
  const magnitude = Math.abs(value);
  if (magnitude >= 1e6) return `${numberText(value / 1e6)} MJ`;
  if (magnitude >= 1e3) return `${numberText(value / 1e3)} kJ`;
  if (magnitude >= 1) return `${numberText(value)} J`;
  if (magnitude >= 1e-3) return `${numberText(value * 1e3)} mJ`;
  if (magnitude >= 1e-6) return `${numberText(value * 1e6)} µJ`;
  return `${numberText(value * 1e9)} nJ`;
}

export function formatEnergyEfficiency(value: number | null | undefined): string {
  return formatCompactUnit(value, 'bit/J');
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  return finite(value) ? value.toFixed(digits) : '—';
}
