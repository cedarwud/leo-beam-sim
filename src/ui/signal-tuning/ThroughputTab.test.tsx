import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CANONICAL_EE_CONFORMANCE_FIXTURES,
  computeCanonicalEe,
} from '../../analysis/canonicalEe';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { ThroughputTab } from './ThroughputTab';

const fixture = CANONICAL_EE_CONFORMANCE_FIXTURES[1]!;
const result = computeCanonicalEe(fixture.input);
const parameters = {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  minimumRateBps: fixture.input.config.minimumRateBps,
  beamBandwidthHz: fixture.input.config.beamBandwidthHz,
};

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <ThroughputTab
      result={result}
      parameters={parameters}
      onParametersChange={() => {}}
    />
  </LocaleProvider>,
);

assert.match(markup, /data-testid="throughput-canonical-page"/);
assert.match(markup, /data-canonical-status="canonical"/);
assert.match(markup, /data-testid="throughput-tab-minimum-rate-control"/);
assert.match(markup, /data-testid="throughput-tab-bandwidth-control"/);
assert.match(markup, /data-testid="throughput-tab-gamma-readout"/);
assert.match(markup, /data-testid="throughput-tab-requested-power-readout"/);
assert.match(markup, /data-testid="throughput-tab-actual-power-readout"/);
assert.match(markup, /data-testid="throughput-tab-sinr-readout"/);
assert.match(markup, /data-testid="throughput-tab-rate-readout"/);
assert.doesNotMatch(markup, /frequency-reuse-control/);
assert.doesNotMatch(markup, /Non-canonical teaching projection/);

console.log('ThroughputTab projects the shared canonical result and edits only R_min/B_beam.');
