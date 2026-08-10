import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * The learner-facing locale contract for the isolated C-120 route.
 *
 * This is intentionally separate from the legacy application's `zh-TW`
 * locale.  Scientific units, stable identifiers, provider payloads, and
 * exported workbook evidence must not be translated through this seam.
 */
export type C120Locale = 'zh-Hant' | 'en';

export const C120_DEFAULT_LOCALE: C120Locale = 'zh-Hant';

/**
 * A route-local, versioned preference key.  It is deliberately unrelated to
 * C-120 session/checkpoint keys and to the legacy `leo.locale.v1` key.
 */
export const C120_LOCALE_STORAGE_KEY = 'leo-beam-sim.c120.locale.v1';
export const C120_LOCALE_STORAGE_KEY_V1 = C120_LOCALE_STORAGE_KEY;

export interface C120LocaleStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export function isC120Locale(value: unknown): value is C120Locale {
  return value === 'zh-Hant' || value === 'en';
}

function normalizeC120Locale(value: unknown): C120Locale {
  return isC120Locale(value) ? value : C120_DEFAULT_LOCALE;
}

function browserStorage(): C120LocaleStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolvedStorage(storage: C120LocaleStorage | null | undefined): C120LocaleStorage | null {
  return storage === undefined ? browserStorage() : storage;
}

/**
 * Reads only the C-120 preference.  Invalid, missing, unavailable, or
 * throwing storage always falls back to Traditional Chinese.
 */
export function readC120Locale(storage?: C120LocaleStorage | null): C120Locale {
  try {
    const source = resolvedStorage(storage);
    if (source === null) return C120_DEFAULT_LOCALE;
    return normalizeC120Locale(source.getItem(C120_LOCALE_STORAGE_KEY));
  } catch {
    return C120_DEFAULT_LOCALE;
  }
}

/**
 * Persists only a validated C-120 locale.  Storage failures are intentionally
 * swallowed: the in-memory preference remains usable in private/blocked
 * browsing contexts.
 */
export function writeC120Locale(
  locale: C120Locale,
  storage?: C120LocaleStorage | null,
): void {
  try {
    const source = resolvedStorage(storage);
    if (source === null) return;
    source.setItem(C120_LOCALE_STORAGE_KEY, normalizeC120Locale(locale));
  } catch {
    // Local persistence is best effort and must not interrupt the lesson.
  }
}

/**
 * Formats learner-facing numbers with the active locale.  This helper is
 * pure and safe to use from SSR; callers should keep scientific units outside
 * the localized text when rendering evidence.
 */
export function formatC120Number(
  value: number,
  locale: C120Locale = C120_DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions,
): string {
  const safeLocale = normalizeC120Locale(locale);
  try {
    return new Intl.NumberFormat(safeLocale, options).format(value);
  } catch {
    return new Intl.NumberFormat(C120_DEFAULT_LOCALE, options).format(value);
  }
}

export interface C120LocaleContextValue {
  readonly locale: C120Locale;
  readonly setLocale: (next: C120Locale) => void;
  readonly text: (zhHant: string, en: string) => string;
  readonly formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

function createFallbackContextValue(): C120LocaleContextValue {
  return {
    locale: C120_DEFAULT_LOCALE,
    setLocale: () => {
      // A standalone panel still renders in Chinese; there is no provider to persist into.
    },
    text: (zhHant: string) => zhHant,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      formatC120Number(value, C120_DEFAULT_LOCALE, options),
  };
}

const C120_FALLBACK_CONTEXT_VALUE = createFallbackContextValue();

export const C120LocaleContext = createContext<C120LocaleContextValue>(C120_FALLBACK_CONTEXT_VALUE);

export interface C120LocaleProviderProps {
  readonly children: ReactNode;
  /**
   * Optional deterministic override for tests or an SSR request.  Without an
   * override, SSR starts in Traditional Chinese and the browser reconciles a
   * locally persisted preference after mount.
   */
  readonly initialLocale?: C120Locale;
}

export function C120LocaleProvider({ children, initialLocale }: C120LocaleProviderProps) {
  const [locale, setLocaleState] = useState<C120Locale>(() => normalizeC120Locale(initialLocale));

  useEffect(() => {
    if (initialLocale !== undefined || typeof window === 'undefined') return;
    const stored = readC120Locale();
    setLocaleState(current => current === stored ? current : stored);
  }, [initialLocale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const previousLang = root.lang;
    root.lang = locale;
    return () => {
      root.lang = previousLang;
    };
  }, [locale]);

  const setLocale = useCallback((next: C120Locale) => {
    const safeLocale = normalizeC120Locale(next);
    setLocaleState(safeLocale);
    writeC120Locale(safeLocale);
  }, []);

  const text = useCallback(
    (zhHant: string, en: string) => locale === 'en' ? en : zhHant,
    [locale],
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => formatC120Number(value, locale, options),
    [locale],
  );

  const value = useMemo<C120LocaleContextValue>(
    () => ({ locale, setLocale, text, formatNumber }),
    [formatNumber, locale, setLocale, text],
  );

  return <C120LocaleContext.Provider value={value}>{children}</C120LocaleContext.Provider>;
}

/**
 * Reads the C-120 locale context.  The Chinese fallback keeps isolated panel
 * tests and gradual route integration deterministic before the provider is
 * mounted.
 */
export function useC120Locale(): C120LocaleContextValue {
  return useContext(C120LocaleContext);
}

export interface C120LanguageSwitchProps {
  readonly ariaLabel?: string;
  readonly className?: string;
}

/**
 * Compact, keyboard-native language control for the C-120 learner header.
 * `aria-pressed` communicates the active choice without relying on colour.
 */
export function C120LanguageSwitch({
  ariaLabel,
  className,
}: C120LanguageSwitchProps = {}) {
  const { locale, setLocale, text } = useC120Locale();
  const rootClassName = ['c120-language-switch', className].filter(Boolean).join(' ') || undefined;
  const resolvedAriaLabel = ariaLabel ?? text('語言切換', 'Language switch');

  return (
    <div className={rootClassName} role="group" aria-label={resolvedAriaLabel} data-testid="c120-language-switch">
      <button
        type="button"
        lang="zh-Hant"
        aria-label={text('切換為繁體中文', 'Switch to Traditional Chinese')}
        aria-pressed={locale === 'zh-Hant'}
        data-locale="zh-Hant"
        onClick={() => setLocale('zh-Hant')}
      >
        繁中
      </button>
      <button
        type="button"
        lang="en"
        aria-label={text('切換為英文', 'Switch to English')}
        aria-pressed={locale === 'en'}
        data-locale="en"
        onClick={() => setLocale('en')}
      >
        EN
      </button>
    </div>
  );
}

// These aliases keep integration naming flexible without introducing another
// implementation or another persistence boundary.
export const C120LocaleSwitch = C120LanguageSwitch;
export const C120LocaleToggle = C120LanguageSwitch;
