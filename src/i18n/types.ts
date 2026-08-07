/**
 * i18n locale contract (owner: agent-A). See CONTRACT.md §2.
 *
 * Only two locales are supported for this student-friendly redesign:
 * - 'zh-TW' is the default (matches the existing Traditional-Chinese-leaning
 *   copy already sprinkled through the app, e.g. CoverageFairnessPanel).
 * - 'en' is a parallel, equally student-friendly English translation — not a
 *   literal retranslation of the old engineer-facing English strings.
 */
export type Locale = 'zh-TW' | 'en';
