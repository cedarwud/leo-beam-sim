import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { LocaleProvider } from '../../i18n';
import { HomepageBeamColorsPage } from './HomepageBeamColorsPage';

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageBeamColorsPage />
  </LocaleProvider>,
);

assert.match(markup, /data-testid="homepage-beam-colors-page"[^>]*data-family-count="6"/);
assert.match(markup, /Beam colour catalogue/);
assert.equal((markup.match(/data-testid="homepage-beam-color-family"/g) ?? []).length, 6);
assert.equal((markup.match(/data-testid="homepage-beam-colors-row"/g) ?? []).length, 12);
assert.equal((markup.match(/data-testid="homepage-beam-color-swatch"/g) ?? []).length, 48);
assert.match(markup, /data-family-name="blue"/);
assert.doesNotMatch(markup, /data-family-name="(?:red|purple|violet)"/i);
assert.match(markup, /Left → right: low → high EE/);

console.log('homepage beam colors page checks pass');
