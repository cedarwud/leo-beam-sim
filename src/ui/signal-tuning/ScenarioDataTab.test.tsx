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
    <ScenarioDataTab
      connection="live-scene"
      servingBeamLayoutCount={1}
      scenarioDate="2027-01-02"
      scenarioTime="03:04"
      onScenarioDateChange={() => undefined}
      onScenarioTimeChange={() => undefined}
    />
  </LocaleProvider>,
);
const oneCellMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <ScenarioDataTab
      connection="live-scene"
      servingBeamLayoutCount={1}
      focusCellCount={1}
      onFocusCellChange={() => undefined}
    />
  </LocaleProvider>,
);
const nineteenCellMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <ScenarioDataTab
      connection="live-scene"
      servingBeamLayoutCount={19}
      focusCellCount={19}
      onFocusCellChange={() => undefined}
    />
  </LocaleProvider>,
);
const canonicalMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <ScenarioDataTab
      connection="canonical-analysis"
      beamLayoutCount={7}
      beamLayoutOptions={[7]}
      servingBeamLayoutCount={7}
      candidateBeamLayoutCount={7}
    />
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
assert.match(connectedMarkup, /data-scenario-epoch-owner="walker-runtime"/);
assert.match(connectedMarkup, /data-testid="scenario-data-date"[^>]*value="2027-01-02"/);
assert.match(connectedMarkup, /data-testid="scenario-data-hour"[\s\S]*value="03"[^>]*selected=""/);
assert.match(connectedMarkup, /data-testid="scenario-data-minute"[\s\S]*value="04"[^>]*selected=""/);
assert.doesNotMatch(connectedMarkup, /id="scenario-data-beam-layout-1"/);
assert.match(connectedMarkup, /id="scenario-data-serving-beam-layout-1"[^>]*checked=""/);
assert.match(canonicalMarkup, /data-scenario-connection="canonical-analysis"/);
assert.match(canonicalMarkup, /id="scenario-data-serving-beam-layout-7"[^>]*checked=""/);
assert.match(canonicalMarkup, /id="scenario-data-candidate-beam-layout-7"[^>]*checked=""/);
assert.doesNotMatch(canonicalMarkup, /scenario-data-(?:serving|candidate)-beam-layout-(?:1|19)/);
assert.match(markup, /每顆衛星波束配置|Beams per satellite/);
for (const beamCount of [1, 7, 19]) {
  assert.match(markup, new RegExp(`scenario-data-beam-layout-${beamCount}`));
}
assert.match(markup, /data-testid="scenario-data-serving-beam-configuration"/);
assert.match(markup, /data-testid="scenario-data-candidate-beam-configuration"/);
assert.match(markup, /Serving satellite/);
assert.match(markup, /Candidate satellite/);
assert.match(oneCellMarkup, /場景 cells/);
assert.match(oneCellMarkup, /scenario-data-focus-cell-0/);
assert.doesNotMatch(oneCellMarkup, /scenario-data-focus-cell-1/);
assert.doesNotMatch(oneCellMarkup, /選擇左側公式與右側數值要跟隨哪一格的使用者/);
for (const cellId of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
  assert.match(nineteenCellMarkup, new RegExp(`scenario-data-focus-cell-${cellId}(?:\\\"|')`));
}
assert.doesNotMatch(nineteenCellMarkup, /scenario-data-focus-cell-19/);

console.log('ScenarioDataTab renders 24-hour controls and accepts a live scene beam-layout value.');
