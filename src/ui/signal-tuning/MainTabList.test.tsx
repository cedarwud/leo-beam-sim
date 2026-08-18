import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { MainTabList } from './MainTabList';

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <MainTabList activeTab="sinr" showHandoverTab onChange={() => {}} />
  </LocaleProvider>,
);

for (const key of ['scenario', 'sinr', 'energy', 'power', 'throughput']) {
  assert.match(markup, new RegExp(`id="signal-tuning-main-tab-${key}"`));
}
const tabOrder = ['scenario', 'sinr', 'throughput', 'power', 'energy'].map(key => markup.indexOf(`id="signal-tuning-main-tab-${key}"`));
assert.deepEqual(tabOrder, [...tabOrder].sort((a, b) => a - b));
assert.match(markup, /grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(markup, /id="signal-tuning-main-tab-scenario"[^>]*data-tab-layout="full-width"/);
assert.doesNotMatch(markup, /Policy/);
assert.doesNotMatch(markup, /Scene/);
assert.doesNotMatch(markup, /signal-tuning-main-tab-handover/);
assert.doesNotMatch(markup, /signal-tuning-main-tab-scene/);
assert.doesNotMatch(markup, /teaching throughput/i);
assert.doesNotMatch(markup, /Tune transmit power/i);
assert.match(markup, /id="signal-tuning-main-tab-scenario"[^>]*aria-controls="tuning-page-panel-scenario-data"/);
// Every visible page has a stable panel id, so keyboard and screen-reader
// navigation retain the original tab-to-panel relationship.
assert.match(markup, /id="signal-tuning-main-tab-sinr"[^>]*aria-controls="tuning-page-panel-sinr-formula"/);
assert.match(markup, /id="signal-tuning-main-tab-energy"[^>]*aria-controls="tuning-page-panel-energy"/);
assert.match(markup, /id="signal-tuning-main-tab-power"[^>]*aria-controls="tuning-page-panel-power"/);
assert.match(markup, /id="signal-tuning-main-tab-throughput"[^>]*aria-controls="tuning-page-panel-throughput"/);

console.log('MainTabList exposes Scenario, SINR, Throughput, Power, and EE in the narrow-rail layout.');
