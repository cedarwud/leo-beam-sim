import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeCanonicalEe, CANONICAL_EE_CONFORMANCE_FIXTURES } from '../../analysis/canonicalEe';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { PowerTab } from './PowerTab';

const fixture = CANONICAL_EE_CONFORMANCE_FIXTURES[0]!;
const result = computeCanonicalEe(fixture.input);
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
      result={result}
      parameters={parameters}
      onParametersChange={next => { changedParameters = next; }}
    />
  </LocaleProvider>,
);

assert.match(markup, /data-testid="power-canonical-page"/);
assert.match(markup, /data-canonical-status="canonical"/);
assert.match(markup, /data-canonical-contract="family-b-thesis-3\.13-3\.17-v1"/);

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
assert.match(markup, /data-testid="power-tab-requested-power-readout"[^>]*data-readonly="true"/);
assert.match(markup, /data-testid="power-tab-actual-power-readout"[^>]*data-readonly="true"/);
assert.match(markup, /data-testid="power-tab-pa-efficiency-readout"[^>]*data-readonly="true"/);
assert.match(markup, /data-testid="power-tab-pa-readout"[^>]*data-readonly="true"/);
assert.match(markup, /data-testid="power-tab-system-power-readout"[^>]*data-readonly="true"/);
assert.match(markup, /P<sub>DL,actual<\/sub>/);

// The display is sourced from the frozen conformance result, not a local
// `P_t`/teaching formula: the fixture's p_req and P_sys values must be visible.
assert.match(markup, /7\.177e-5 W/);
assert.match(markup, /0\.5988735882771666|5\.989e-1 W/);
assert.equal(changedParameters, null, 'static rendering must not mutate parameter state');

console.log('PowerTab uses the canonical EE result, exposes only canonical inputs, and keeps derived power read-only.');
