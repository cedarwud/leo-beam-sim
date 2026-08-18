import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { PowerTab } from './PowerTab';

const parameters: SimulatorParameters = {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  beamPowerCapW: 2,
  satellitePowerCapW: 3,
  etaMax: 0.35,
  rfcPowerW: 0.338,
  basebandPerSatelliteW: 0.2,
};
let changedParameters: SimulatorParameters | null = null;

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <PowerTab
      parameters={parameters}
      onParametersChange={next => { changedParameters = next; }}
    />
  </LocaleProvider>,
);
const visibleText = markup.replace(/<[^>]+>/g, '');

assert.match(markup, /data-testid="power-canonical-page"/);
assert.doesNotMatch(visibleText, /[A-Za-z]+_[A-Za-z]/, 'rendered power copy must not expose raw underscore notation');
assert.match(markup, /P<sup>r<\/sup><sub>s,v<\/sub>\(t, θ\) = max<sub>u:x<sub>u,s,v<\/sub>\(t\)=1<\/sub> p<sup>r<\/sup><sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(markup, /P<sup>N<\/sup>\(t, θ\)/);
assert.doesNotMatch(markup, /<strong>Θ<\/strong>|Θ<sub>|; <strong>/);
assert.doesNotMatch(markup, /ŝ|v̂/);
assert.doesNotMatch(markup, /max<sub>u served<\/sub>/);

// The left rail is the parameter surface.  Its producer identity and final
// frame results belong to the right-side result surface, so this component
// must not render the old visible CANONICAL/family/frame summary.
assert.doesNotMatch(markup, /CANONICAL\s*·\s*family-b-thesis/);
assert.doesNotMatch(markup, /data-testid="homepage-canonical-frame-identity"/);

// The homepage Power tab must not expose the old direct transmit-power knob.
assert.doesNotMatch(markup, /data-testid="power-tab-tx-power-control"/);
assert.doesNotMatch(markup, /Per-beam transmit power/);
assert.doesNotMatch(markup, /P_t/);

// Power owns the two RF output caps. Energy-consumption inputs belong to EE.
assert.match(markup, /data-testid="power-tab-beam-cap-control"/);
assert.match(markup, /data-testid="power-tab-satellite-cap-control"/);
assert.match(markup, /data-testid="power-tab-beam-cap-control"[\s\S]*data-control-symbol="true"[\s\S]*P<sup>r<\/sup><sub>s,v<\/sub>/);
assert.match(markup, /data-testid="power-tab-satellite-cap-control"[\s\S]*data-control-symbol="true"[\s\S]*Σ<sub>v<\/sub>P<sup>r<\/sup><sub>s,v<\/sub>/);

for (const testId of [
  'power-tab-beam-cap-control',
  'power-tab-satellite-cap-control',
]) {
  const controlTag = markup.match(new RegExp(`<div[^>]*data-testid="${testId}"[^>]*>`))?.[0];
  assert.ok(controlTag, `${testId} should render an editable control`);
  assert.doesNotMatch(controlTag, /data-source-provenance=/, `${testId} should not expose provenance copy`);
  assert.ok(
    controlTag.match(/data-reset-value="([^"]*\S[^"]*)"/)?.[1].trim(),
    `${testId} should expose non-empty data-reset-value`,
  );
}
for (const testId of [
  'power-tab-eta-max-control',
  'power-tab-backoff-control',
  'power-tab-rfc-control',
  'power-tab-bb-control',
]) {
  assert.doesNotMatch(markup, new RegExp(`data-testid="${testId}"`));
}

// Final computed values are owned by the right sidebar.  In particular, the
// left Power tab must not duplicate the old result card or expose stale
// result testids that make it look like a second producer.
assert.doesNotMatch(markup, /data-testid="power-canonical-readout"/);
for (const testId of [
  'power-tab-requested-power-readout',
  'power-tab-actual-power-readout',
  'power-tab-pa-efficiency-readout',
  'power-tab-pa-readout',
  'power-tab-rfc-readout',
  'power-tab-system-power-readout',
]) {
  assert.doesNotMatch(markup, new RegExp(`data-testid="${testId}"`));
}
assert.equal(changedParameters, null, 'static rendering must not mutate parameter state');

console.log('PowerTab exposes only canonical power inputs; final power results stay off the left rail.');
