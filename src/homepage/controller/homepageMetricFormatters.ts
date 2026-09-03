/**
 * Homepage-only metric display policy.
 *
 * The simulation keeps EE in its canonical raw unit (bit/J) for ranking,
 * snapshots, and joins.  This formatter is presentation-only: every homepage
 * surface uses one fixed Kbit/J scale so a serving row and an observed or
 * candidate row cannot look different merely because one formatter chose an
 * SI prefix and the other did not.
 */
export const HOMEPAGE_EE_DISPLAY_UNIT = 'Kbit/J';
export const HOMEPAGE_EE_DISPLAY_FRACTION_DIGITS = 2;

export function formatHomepageEe(
  eeBitsPerJoule: number | null | undefined,
  fractionDigits: number = HOMEPAGE_EE_DISPLAY_FRACTION_DIGITS,
): string {
  if (typeof eeBitsPerJoule !== 'number' || !Number.isFinite(eeBitsPerJoule)) return '—';
  const digits = Number.isInteger(fractionDigits) && fractionDigits >= 0
    ? fractionDigits
    : HOMEPAGE_EE_DISPLAY_FRACTION_DIGITS;
  return `${(eeBitsPerJoule / 1_000).toFixed(digits)} ${HOMEPAGE_EE_DISPLAY_UNIT}`;
}

