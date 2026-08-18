export function formatWithUnit(value: number, unit: string, digits = 1): string {
  return Number.isFinite(value) ? `${value.toFixed(digits)} ${unit}` : '—';
}

const SI_PREFIXES = Object.freeze([
  { exponent: -30, symbol: 'q' },
  { exponent: -27, symbol: 'r' },
  { exponent: -24, symbol: 'y' },
  { exponent: -21, symbol: 'z' },
  { exponent: -18, symbol: 'a' },
  { exponent: -15, symbol: 'f' },
  { exponent: -12, symbol: 'p' },
  { exponent: -9, symbol: 'n' },
  { exponent: -6, symbol: 'µ' },
  { exponent: -3, symbol: 'm' },
  { exponent: 0, symbol: '' },
  { exponent: 3, symbol: 'k' },
  { exponent: 6, symbol: 'M' },
  { exponent: 9, symbol: 'G' },
  { exponent: 12, symbol: 'T' },
  { exponent: 15, symbol: 'P' },
  { exponent: 18, symbol: 'E' },
  { exponent: 21, symbol: 'Z' },
  { exponent: 24, symbol: 'Y' },
  { exponent: 27, symbol: 'R' },
  { exponent: 30, symbol: 'Q' },
] as const);

const SUPERSCRIPT_DIGITS: Readonly<Record<string, string>> = Object.freeze({
  '-': '⁻',
  '+': '⁺',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
});

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function significant(value: number, significantDigits: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumSignificantDigits: significantDigits,
  }).format(normalized);
}

function roundedToSignificant(value: number, significantDigits: number): number {
  // `toPrecision` is only used for the internal boundary decision.  The
  // returned display string always comes from Intl.NumberFormat, so user
  // visible values never inherit JavaScript's exponent notation.
  return Number(value.toPrecision(significantDigits));
}

/**
 * Format a dimensional quantity with an engineering prefix.
 *
 * This is the default for visible power, energy, rate, bandwidth, and EE
 * readouts.  It deliberately never emits JavaScript's `e+N` notation and
 * keeps the magnitude next to the unit: 0.01005 W -> 10.1 mW.
 */
export function formatEngineering(
  value: number | null | undefined,
  unit: string,
  significantDigits = 3,
): string {
  if (!finite(value)) return '—';
  if (value === 0) return `0 ${unit}`;

  let exponent = Math.max(
    SI_PREFIXES[0].exponent,
    Math.min(
      SI_PREFIXES[SI_PREFIXES.length - 1].exponent,
      Math.floor(Math.log10(Math.abs(value)) / 3) * 3,
    ),
  );
  let scaled = value / (10 ** exponent);
  // Avoid an awkward `1000 mW` after rounding a value just below 1 W (and
  // the equivalent boundary for every other engineering prefix).
  if (
    Math.abs(roundedToSignificant(scaled, significantDigits)) >= 1000
    && exponent < SI_PREFIXES[SI_PREFIXES.length - 1].exponent
  ) {
    exponent += 3;
    scaled = value / (10 ** exponent);
  }
  const prefix = SI_PREFIXES.find(candidate => candidate.exponent === exponent)!;
  return `${significant(scaled, significantDigits)} ${prefix.symbol}${unit}`;
}

function superscriptInteger(value: number): string {
  return String(value)
    .split('')
    .map(character => SUPERSCRIPT_DIGITS[character] ?? character)
    .join('');
}

/**
 * Format a dimensionless value without long leading/trailing zero runs.
 * Ordinary values remain decimals; extreme values use a typographic power of
 * ten (never `e` notation).  Dimensional values should use formatEngineering.
 */
export function formatCompactNumber(
  value: number | null | undefined,
  unit = '',
  significantDigits = 3,
): string {
  if (!finite(value)) return '—';
  if (value === 0) return unit ? `0 ${unit}` : '0';

  const magnitude = Math.abs(value);
  const suffix = unit ? ` ${unit}` : '';
  if (
    magnitude >= 0.001
    && magnitude < 1_000_000
    && Math.abs(roundedToSignificant(value, significantDigits)) < 1_000_000
  ) {
    return `${significant(value, significantDigits)}${suffix}`;
  }

  let exponent = Math.floor(Math.log10(magnitude));
  let mantissa = value / (10 ** exponent);
  if (Math.abs(roundedToSignificant(mantissa, significantDigits)) >= 10) {
    exponent += 1;
    mantissa = value / (10 ** exponent);
  }
  return `${significant(mantissa, significantDigits)} × 10${superscriptInteger(exponent)}${suffix}`;
}

export function formatPower(value: number | null | undefined): string {
  return formatEngineering(value, 'W');
}

export function formatEnergy(value: number | null | undefined): string {
  return formatEngineering(value, 'J');
}

export function formatRate(value: number | null | undefined): string {
  return formatEngineering(value, 'bit/s');
}

export function formatEnergyEfficiency(value: number | null | undefined): string {
  return formatEngineering(value, 'bit/J');
}

export function formatFrequency(value: number | null | undefined): string {
  return formatEngineering(value, 'Hz');
}

export function formatDbm(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dBm`;
}

export function formatDbi(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dBi`;
}
