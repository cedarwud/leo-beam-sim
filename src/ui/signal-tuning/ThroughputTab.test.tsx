import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { loadProfile } from '../../profiles';
import { createSignalTuningState } from '../../signalTuning';
import { ThroughputTab } from './ThroughputTab';

const profile = loadProfile('hobs-2024-paper-default');
const tuning = {
  ...createSignalTuningState(profile),
  bandwidthMHz: 20,
  frequencyReuse: 2,
};
const formulaBudget = {
  signalDbm: -80,
  intraInterferenceDbm: -110,
  interInterferenceDbm: -110,
  noiseDbm: -110,
  denominatorDbm: -100,
  txPowerDbm: 30,
  pathLossDb: 150,
  beamGainDb: 20,
  steeringLossDb: 1,
  receiverGainDbi: 0,
};

const currentMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <ThroughputTab
      tuning={tuning}
      formulaBudget={formulaBudget}
      onTuningChange={() => {}}
    />
  </LocaleProvider>,
);

assert.match(currentMarkup, /data-testid="throughput-teaching-page"/);
assert.match(currentMarkup, /data-teaching-claim="SIMULATED TEACHING"/);
assert.match(currentMarkup, /data-testid="throughput-tab-bandwidth-control"/);
assert.match(currentMarkup, /data-testid="throughput-tab-frequency-reuse-control"/);
assert.match(currentMarkup, /data-throughput-status="current"/);
assert.match(currentMarkup, /data-testid="throughput-tab-sinr-readout"[\s\S]*20\.00 dB/);
assert.match(currentMarkup, /data-testid="throughput-tab-rate-readout"[\s\S]*66\.58 Mbit\/s/);
assert.match(currentMarkup, /Non-canonical teaching projection/);

const staleMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <ThroughputTab
      tuning={tuning}
      formulaBudget={formulaBudget}
      isFormulaEvidenceStale
      onTuningChange={() => {}}
    />
  </LocaleProvider>,
);
assert.match(staleMarkup, /data-throughput-status="stale"/);
assert.match(staleMarkup, /data-testid="throughput-tab-rate-readout"[\s\S]*—/);

console.log('ThroughputTab exposes shared B/K controls and fails closed on stale formula evidence.');
