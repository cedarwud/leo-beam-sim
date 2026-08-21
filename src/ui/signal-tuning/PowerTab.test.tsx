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
assert.match(markup, /data-testid="power-canonical-formula-row-system"[\s\S]*P<sup>N<\/sup>\(t,[\s\S]*θ[\s\S]*\)/);
assert.match(markup, /P<sup>N<\/sup>\(t,[\s\S]*θ[\s\S]*\)/);
assert.match(markup, /P<sup>p<\/sup><sub>u,s,v<\/sub>/);
assert.match(markup, /data-testid="power-canonical-formula-row-segment-start"[\s\S]*2 W/);
assert.match(markup, /data-testid="power-canonical-formula-row-recurrence"[\s\S]*t−1[\s\S]*G<sup>T<\/sup>/);
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

// Power is derived from the angle-aware recurrence; it exposes no editable
// power-cap or amplifier controls on the presentation surface.
assert.doesNotMatch(markup, /data-testid="power-tab-(?:beam-cap|satellite-cap|eta-max|backoff|rfc|bb)-control"/);
// Final computed values are owned by the right sidebar.
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
