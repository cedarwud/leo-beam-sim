/**
 * Unified i18n entry point (CONTRACT.md §2). All other agents/components
 * must import from `src/i18n` (this file), not from the individual
 * implementation modules, so the internal layout can change without
 * breaking consumers.
 */
export { LocaleProvider, useLocale } from './LocaleContext';
export type { LocaleContextValue } from './LocaleContext';
export { LocaleToggle } from './LocaleToggle';
export type { Locale } from './types';
export type { I18nKey } from './strings';
export { EN, ZH_TW } from './strings';
