import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { ScenarioDataTab } from './ScenarioDataTab';

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <ScenarioDataTab />
  </LocaleProvider>,
);
const connectedMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <ScenarioDataTab connection="live-scene" beamLayoutCount={1} />
  </LocaleProvider>,
);

assert.match(markup, /id="tuning-page-panel-scenario-data"/);
assert.match(markup, /data-testid="scenario-data-constellation-control"/);
assert.match(markup, /scenario-data-constellation-starlink/);
assert.match(markup, /scenario-data-constellation-oneweb/);
assert.match(markup, /data-testid="scenario-data-date"[^>]*type="date"/);
assert.match(markup, /data-testid="scenario-data-time"[^>]*role="group"/);
assert.match(markup, /data-testid="scenario-data-hour"[^>]*aria-label="Hour \(24-hour\)"/);
assert.match(markup, /data-testid="scenario-data-minute"[^>]*aria-label="Minute"/);
assert.match(markup, /data-testid="scenario-data-hour"[\s\S]*value="23"[^>]*>23/);
assert.match(markup, /data-testid="scenario-data-minute"[\s\S]*value="59"[^>]*>59/);
assert.match(markup, /Time \(24-hour\)/);
assert.match(markup, /data-testid="scenario-data-time-format"[^>]*>Format HH:MM \(00:00–23:59\)</);
assert.match(markup, /data-testid="scenario-data-hour"[\s\S]*value="20"[^>]*selected=""/);
assert.match(markup, /data-testid="scenario-data-minute"[\s\S]*value="00"[^>]*selected=""/);
const timeControls = markup.match(/data-testid="scenario-data-time"[\s\S]*?data-testid="scenario-data-time-format"/)?.[0] ?? '';
assert.doesNotMatch(timeControls, /AM|PM|上午|下午|seconds|milliseconds|秒|毫秒/i);
assert.match(markup, /data-testid="scenario-data-beam-configuration-control"/);
assert.match(connectedMarkup, /data-scenario-connection="live-scene"/);
assert.match(connectedMarkup, /id="scenario-data-beam-layout-1"[^>]*checked=""/);
assert.doesNotMatch(connectedMarkup, /id="scenario-data-beam-layout-7"[^>]*checked=""/);
assert.match(markup, /每顆衛星波束配置|Beams per satellite/);
for (const beamCount of [1, 7, 19]) {
  assert.match(markup, new RegExp(`scenario-data-beam-layout-${beamCount}`));
}
assert.match(markup, /data-testid="scenario-data-serving-beam-configuration"/);
assert.match(markup, /data-testid="scenario-data-candidate-beam-configuration"/);
assert.match(markup, /Serving satellite/);
assert.match(markup, /Candidate satellite/);

console.log('ScenarioDataTab renders 24-hour controls and accepts a live scene beam-layout value.');
