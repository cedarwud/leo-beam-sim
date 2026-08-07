import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Locale } from './types';
import { EN, ZH_TW } from './strings';

const STORAGE_KEY = 'leo.locale.v1';
const DEFAULT_LOCALE: Locale = 'zh-TW';

function isLocale(value: unknown): value is Locale {
  return value === 'zh-TW' || value === 'en';
}

/** Fail-safe read: any storage error (private mode, disabled storage, quota) falls back to zh-TW. */
function readStoredLocale(): Locale {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_LOCALE;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Fail-safe write: a storage error must never surface as a thrown exception. */
function writeStoredLocale(locale: Locale): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore write failures — locale still works for this session, just not persisted.
  }
}

function resolveDictionary(locale: Locale): Record<string, string> {
  return locale === 'en' ? EN : ZH_TW;
}

/** Current locale, else ZH_TW, else the key itself — never throws, never renders blank. */
function translate(locale: Locale, key: string): string {
  const dict = resolveDictionary(locale);
  if (Object.prototype.hasOwnProperty.call(dict, key)) {
    return dict[key];
  }
  if (Object.prototype.hasOwnProperty.call(ZH_TW, key)) {
    return (ZH_TW as Record<string, string>)[key];
  }
  return key;
}

export interface LocaleContextValue {
  readonly locale: Locale;
  readonly setLocale: (next: Locale) => void;
  readonly t: (key: string) => string;
}

/**
 * Fallback used whenever `useLocale()` is called outside a `<LocaleProvider>`.
 * Per CONTRACT.md §2 this must never throw — components under test in
 * isolation, or mounted before the provider is wired up, still get a working
 * zh-TW `t()` and a no-op `setLocale`.
 */
function createFallbackContextValue(): LocaleContextValue {
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {
      // No provider is mounted, so there is nowhere to persist the change.
    },
    t: (key: string) => translate(DEFAULT_LOCALE, key),
  };
}

const FALLBACK_CONTEXT_VALUE = createFallbackContextValue();

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  return ctx ?? FALLBACK_CONTEXT_VALUE;
}
