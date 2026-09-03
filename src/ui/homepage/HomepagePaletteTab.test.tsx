import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { LocaleProvider } from '../../i18n';
import { HomepagePaletteTab } from './HomepagePaletteTab';

function renderPalette(initialLocale: 'en' | 'zh-TW'): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale={initialLocale}>
      <HomepagePaletteTab />
    </LocaleProvider>,
  );
}

const markup = renderPalette('en');
const zhMarkup = renderPalette('zh-TW');

assert.match(markup, /data-testid="homepage-palette-tab"[^>]*data-family-count="6"/);
assert.match(markup, /Satellite colour families/);
assert.match(markup, /A satellite keeps one hue family/);

const familyMatches = markup.match(/data-testid="homepage-palette-family"/g) ?? [];
assert.equal(familyMatches.length, 6, 'the tab must expose exactly six hue families');

for (const family of ['gold', 'blue', 'green', 'cyan', 'teal', 'orange']) {
  assert.match(markup, new RegExp(`data-family-name="${family}"`));
}
for (const [paletteIndex, family] of ['gold', 'blue', 'green', 'cyan', 'teal', 'orange'].entries()) {
  assert.match(
    markup,
    new RegExp(`data-palette-index="${paletteIndex}"[^>]*data-family-name="${family}"`),
    `${family} must be backed by the matching visual-identity family slot`,
  );
}

assert.equal(
  (markup.match(/data-testid="homepage-palette-swatch"/g) ?? []).length,
  12,
  'each family must show one primary and one context shade',
);
assert.equal((markup.match(/data-shade-role="primary"/g) ?? []).length, 6);
assert.equal((markup.match(/data-shade-role="context"/g) ?? []).length, 6);
assert.match(markup, /Primary · serving beam/);
assert.match(markup, /Context · other beam/);
assert.match(markup, /data-color-token="#/);
assert.match(markup, /data-hue-degrees="225"/);
assert.doesNotMatch(markup, /data-family-name="(?:red|purple|violet)"/i);

assert.match(zhMarkup, /衛星色彩家族/);
assert.match(zhMarkup, /主要/);
assert.match(zhMarkup, /背景/);
for (const family of ['金色', '藍色', '綠色', '青色', '藍綠色', '橙色']) {
  assert.match(zhMarkup, new RegExp(family));
}

console.log('homepage palette tab checks pass');
