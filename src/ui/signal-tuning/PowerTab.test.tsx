import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_ENERGY_TUNING } from '../../teaching';
import { createSignalTuningState } from '../../signalTuning';
import { loadProfile } from '../../profiles';
import { PowerTab } from './PowerTab';

const tuning = createSignalTuningState(loadProfile('hobs-2024-paper-default'));
const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <PowerTab
      tuning={tuning}
      energyTuning={DEFAULT_ENERGY_TUNING}
      onTuningChange={() => {}}
      onEnergyTuningChange={() => {}}
      onEnergyTuningReset={() => {}}
    />
  </LocaleProvider>,
);

assert.match(markup, /data-testid="power-teaching-page"/);
assert.match(markup, /data-teaching-claim="SIMULATED TEACHING"/);
assert.match(markup, /data-canonical-status="non-canonical"/);
assert.match(markup, /data-testid="power-tab-tx-power-control"/);
assert.match(markup, /data-testid="power-tab-pa-efficiency-control"/);
assert.match(markup, /data-testid="power-tab-circuit-power-control"/);
assert.match(markup, /data-testid="power-tab-rf-readout"/);
assert.match(markup, /data-testid="power-tab-pa-readout"/);
assert.match(markup, /data-testid="power-tab-total-readout"/);
assert.match(markup, /P<sub>total,teaching<\/sub>/);
assert.match(markup, /Non-canonical teaching readout/);

console.log('PowerTab exposes shared tuning/energy controls and a non-canonical teaching power preview.');
