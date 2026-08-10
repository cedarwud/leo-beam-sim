import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  C120_DEFAULT_LOCALE,
  C120_LOCALE_STORAGE_KEY,
  C120LanguageSwitch,
  C120LocaleProvider,
  formatC120Number,
  isC120Locale,
  readC120Locale,
  useC120Locale,
  writeC120Locale,
  type C120LocaleStorage,
} from './i18n';

function memoryStorage(initial: Record<string, string> = {}): C120LocaleStorage & { readonly values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    getItem: key => values[key] ?? null,
    setItem: (key, value) => { values[key] = value; },
  };
}

function LocaleProbe() {
  const { locale, text, formatNumber } = useC120Locale();
  return (
    <output data-locale={locale}>
      {text('繁體中文', 'English')} · {formatNumber(1234.5)}
    </output>
  );
}

test('C-120 defaults to Traditional Chinese during SSR', () => {
  assert.equal(C120_DEFAULT_LOCALE, 'zh-Hant');
  const html = renderToStaticMarkup(
    <C120LocaleProvider>
      <LocaleProbe />
    </C120LocaleProvider>,
  );

  assert.match(html, /data-locale="zh-Hant"/);
  assert.match(html, /繁體中文/);
  assert.doesNotMatch(html, /English/);
});

test('locale validation and storage failures fail safe to Traditional Chinese', () => {
  assert.equal(isC120Locale('zh-Hant'), true);
  assert.equal(isC120Locale('en'), true);
  assert.equal(isC120Locale('zh-TW'), false);
  assert.equal(isC120Locale(null), false);
  assert.equal(isC120Locale({}), false);

  const invalid = memoryStorage({ [C120_LOCALE_STORAGE_KEY]: 'fr' });
  assert.equal(readC120Locale(invalid), C120_DEFAULT_LOCALE);
  assert.equal(readC120Locale(null), C120_DEFAULT_LOCALE);
  assert.equal(readC120Locale({
    getItem: () => { throw new Error('blocked'); },
    setItem: () => undefined,
  }), C120_DEFAULT_LOCALE);
});

test('text and number formatting follow the selected locale', () => {
  const zhHtml = renderToStaticMarkup(
    <C120LocaleProvider initialLocale="zh-Hant">
      <LocaleProbe />
    </C120LocaleProvider>,
  );
  const enHtml = renderToStaticMarkup(
    <C120LocaleProvider initialLocale="en">
      <LocaleProbe />
    </C120LocaleProvider>,
  );

  assert.match(zhHtml, /繁體中文/);
  assert.doesNotMatch(zhHtml, /English/);
  assert.match(enHtml, /English/);
  assert.doesNotMatch(enHtml, /繁體中文/);
  assert.equal(formatC120Number(1234.5, 'en'), new Intl.NumberFormat('en').format(1234.5));
  assert.equal(formatC120Number(1234.5, 'zh-Hant'), new Intl.NumberFormat('zh-Hant').format(1234.5));
});

test('language switch is compact and accessible in SSR markup', () => {
  const html = renderToStaticMarkup(
    <C120LocaleProvider initialLocale="en">
      <C120LanguageSwitch />
    </C120LocaleProvider>,
  );

  assert.match(html, /data-testid="c120-language-switch"/);
  assert.match(html, /role="group"/);
  assert.match(html, /aria-label="Language switch"/);
  assert.match(html, /<button[^>]*type="button"[^>]*aria-pressed="false"[^>]*data-locale="zh-Hant"/);
  assert.match(html, /<button[^>]*type="button"[^>]*aria-pressed="true"[^>]*data-locale="en"/);
  assert.match(html, /lang="zh-Hant"/);
  assert.match(html, /lang="en"/);
});

test('preference storage is isolated to the versioned C-120 key', () => {
  const storage = memoryStorage({ 'leo.locale.v1': 'en', 'c120-session-v2': 'en' });
  assert.equal(readC120Locale(storage), C120_DEFAULT_LOCALE);

  writeC120Locale('en', storage);
  assert.equal(storage.values[C120_LOCALE_STORAGE_KEY], 'en');
  assert.equal(storage.values['leo.locale.v1'], 'en');
  assert.equal(storage.values['c120-session-v2'], 'en');
});

console.log('C-120 i18n seam tests passed');
