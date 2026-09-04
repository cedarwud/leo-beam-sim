/**
 * Homepage EE threshold control contract.
 *
 * The sidebar uses Kbit/J because that is the scale shown to learners. The
 * handover policy continues to compare the canonical metric in bit/J.
 */
// The homepage live EE lane is calibrated to the corrected physical
// counterfactual range. 135 Kbit/J sits below the seeded service value but
// above the low-elevation tail, so the active beam gets useful service time
// while the viewer can still see the threshold crossing before handover.
export const DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE = 135;
export const EE_THRESHOLD_MIN_KBIT_PER_JOULE = 80;
export const EE_THRESHOLD_MAX_KBIT_PER_JOULE = 220;
export const EE_THRESHOLD_STEP_KBIT_PER_JOULE = 1;

export function normalizeEeThresholdKbitPerJoule(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE;
  return Math.min(
    EE_THRESHOLD_MAX_KBIT_PER_JOULE,
    Math.max(EE_THRESHOLD_MIN_KBIT_PER_JOULE, numeric),
  );
}

/**
 * Resolve the low-level homepage runtime default.  The public sidebar range
 * starts at 80, but an omitted/zero runtime argument means "use the homepage
 * default", not "disable the handover floor" and not "silently use 80".
 */
export function resolveEeThresholdKbitPerJoule(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE;
  return normalizeEeThresholdKbitPerJoule(numeric);
}

export function eeThresholdKbitPerJouleToBitsPerJoule(value: unknown): number {
  return resolveEeThresholdKbitPerJoule(value) * 1000;
}

/**
 * The homepage handover trigger is one strict comparison: the current
 * serving EE must be below the configured floor. Candidate ranking and the
 * transition timer happen only after this predicate is true.
 */
export function isEeBelowThreshold(
  valueBitsPerJoule: number | null | undefined,
  thresholdBitsPerJoule: number,
): boolean {
  return typeof valueBitsPerJoule === 'number'
    && Number.isFinite(valueBitsPerJoule)
    && Number.isFinite(thresholdBitsPerJoule)
    && thresholdBitsPerJoule > 0
    && valueBitsPerJoule < thresholdBitsPerJoule;
}
