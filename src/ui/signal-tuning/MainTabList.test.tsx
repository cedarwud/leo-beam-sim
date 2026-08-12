import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { MainTabList } from './MainTabList';

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <MainTabList activeTab="sinr" showHandoverTab onChange={() => {}} />
  </LocaleProvider>,
);

for (const key of ['sinr', 'energy', 'power', 'throughput']) {
  assert.match(markup, new RegExp(`id="signal-tuning-main-tab-${key}"`));
}
assert.match(markup, /grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
assert.doesNotMatch(markup, /Policy/);
assert.doesNotMatch(markup, /Scene/);
assert.doesNotMatch(markup, /signal-tuning-main-tab-handover/);
assert.doesNotMatch(markup, /signal-tuning-main-tab-scene/);
assert.doesNotMatch(markup, /teaching throughput/i);
assert.doesNotMatch(markup, /Tune transmit power/i);
// SINR and EE are homepage result projections without stable panel ids. Their
// tabs therefore omit aria-controls instead of pointing at invented targets.
assert.doesNotMatch(markup, /id="signal-tuning-main-tab-sinr"[^>]*aria-controls=/);
assert.doesNotMatch(markup, /id="signal-tuning-main-tab-energy"[^>]*aria-controls=/);
assert.match(markup, /id="signal-tuning-main-tab-power"[^>]*aria-controls="tuning-page-panel-power"/);
assert.match(markup, /id="signal-tuning-main-tab-throughput"[^>]*aria-controls="tuning-page-panel-throughput"/);

console.log('MainTabList exposes exactly SINR, EE, Power, and Throughput in a narrow-rail layout.');
