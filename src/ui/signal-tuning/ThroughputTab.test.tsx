import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { ThroughputTab } from './ThroughputTab';

const parameters = {
  ...DEFAULT_SIMULATOR_PARAMETERS,
};

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <ThroughputTab
      parameters={parameters}
      onParametersChange={() => {}}
    />
  </LocaleProvider>,
);

assert.match(markup, /data-testid="throughput-canonical-page"/);
assert.match(markup, /data-testid="throughput-tab-minimum-rate-control"/);
assert.match(markup, /data-testid="throughput-tab-bandwidth-control"/);

// The left rail owns editable and non-editable parameter controls only.  Final
// gamma/power/SINR/rate results are rendered by the right-side result surface,
// so the old duplicated readout card must not survive in this tab.
assert.doesNotMatch(markup, /data-testid="throughput-canonical-readout"/);
for (const testId of [
  'throughput-tab-gamma-readout',
  'throughput-tab-requested-power-readout',
  'throughput-tab-actual-power-readout',
  'throughput-tab-sinr-readout',
  'throughput-tab-rate-readout',
]) {
  assert.doesNotMatch(markup, new RegExp(`data-testid="${testId}"`));
}
assert.doesNotMatch(markup, /CANONICAL\s*·\s*family-b-thesis/);
assert.doesNotMatch(markup, /data-testid="homepage-canonical-frame-identity"/);
assert.doesNotMatch(markup, /frequency-reuse-control/);
assert.doesNotMatch(markup, /Non-canonical teaching projection/);

console.log('ThroughputTab exposes only R_min/B_beam inputs; final throughput results stay off the left rail.');
