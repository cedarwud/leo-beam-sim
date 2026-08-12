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

assert.match(markup, /data-testid="power-canonical-page"/);

// The left rail is the parameter surface.  Its producer identity and final
// frame results belong to the right-side result surface, so this component
// must not render the old visible CANONICAL/family/frame summary.
assert.doesNotMatch(markup, /CANONICAL\s*·\s*family-b-thesis/);
assert.doesNotMatch(markup, /data-testid="homepage-canonical-frame-identity"/);

// The homepage Power tab must not expose the old direct transmit-power knob.
assert.doesNotMatch(markup, /data-testid="power-tab-tx-power-control"/);
assert.doesNotMatch(markup, /Per-beam transmit power/);
assert.doesNotMatch(markup, /P_t/);

// All five formal inputs are present, while derived quantities are read-only.
assert.match(markup, /data-testid="power-tab-beam-cap-control"/);
assert.match(markup, /data-testid="power-tab-satellite-cap-control"/);
assert.match(markup, /data-testid="power-tab-eta-max-control"/);
assert.match(markup, /data-testid="power-tab-rfc-control"/);
assert.match(markup, /data-testid="power-tab-bb-control"/);

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
