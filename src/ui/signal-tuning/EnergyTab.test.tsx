import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_ENERGY_TUNING } from '../../teaching';
import { EnergyTab } from './EnergyTab';

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <EnergyTab
      maxTxPowerDbm={24}
      energyTuning={DEFAULT_ENERGY_TUNING}
      onEnergyTuningChange={() => {}}
      onEnergyTuningReset={() => {}}
    />
  </LocaleProvider>,
);

assert.match(markup, /data-testid="energy-parameters-reset"/);
assert.match(markup, /Restore energy defaults/);
assert.doesNotMatch(markup, /data-testid="energy-parameters-reset"[^>]*disabled/);
assert.match(markup, /non-canonical/);
assert.match(markup, /data-testid="circuit-power-control"[\s\S]*3 W/);
assert.match(markup, /data-testid="canonical-formula-row-r1u"/);
assert.match(markup, /data-testid="canonical-formula-row-identity"/);
assert.match(markup, /EE<sub>eval<\/sub>/);

console.log('EnergyTab scope, reset, and canonical formula presentation validation passed.');
