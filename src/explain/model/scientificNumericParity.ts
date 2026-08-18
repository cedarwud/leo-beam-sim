const SCIENTIFIC_PARITY_RELATIVE_TOLERANCE = 1e-10;
const SCIENTIFIC_PARITY_ABSOLUTE_TOLERANCE = 1e-18;

export function scientificParityTolerance(expected: number): number {
  return expected === 0
    ? SCIENTIFIC_PARITY_ABSOLUTE_TOLERANCE
    : Math.abs(expected) * SCIENTIFIC_PARITY_RELATIVE_TOLERANCE;
}

export function withinScientificParityTolerance(actual: number, expected: number): boolean {
  return Number.isFinite(actual)
    && Number.isFinite(expected)
    && Math.abs(actual - expected) <= scientificParityTolerance(expected);
}
