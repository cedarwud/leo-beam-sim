/**
 * Small i18n resolution helpers for the left tuning panel.
 *
 * `useLocale().t(key)` returns the key itself when the catalog has no entry
 * (CONTRACT §2). Rendering a raw dotted key to a student would be worse than
 * rendering nothing, so every call site in this panel goes through one of the
 * helpers below and supplies a literal fallback.
 *
 * - `tx`      — localized string, or the canonical English literal if the key
 *               is missing. Use where the fallback is a technical term that
 *               reads fine in both locales (units, formula symbols).
 * - `txBi`    — localized string, or a locale-appropriate literal. Use for
 *               prose, so a missing key does not drop English into the zh-TW
 *               view. Any key resolved this way is a catalog gap that should
 *               be reported and later added to `src/i18n/strings.ts` (owned by
 *               agent-A — never edited from here).
 */

export type Translate = (key: string) => string;

export function tx(t: Translate, key: string | undefined, fallback: string): string {
  if (!key) return fallback;
  const resolved = t(key);
  return resolved === key ? fallback : resolved;
}

export function txBi(
  t: Translate,
  isEnglish: boolean,
  key: string,
  zh: string,
  en: string,
): string {
  const resolved = t(key);
  if (resolved !== key) return resolved;
  return isEnglish ? en : zh;
}

/**
 * True when the localized label carries no more information than the canonical
 * English term, so the panel can avoid printing the same words twice.
 */
export function isSameLabel(localizedLabel: string, canonical: string): boolean {
  return localizedLabel.trim().toLowerCase() === canonical.trim().toLowerCase();
}
