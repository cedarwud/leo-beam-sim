import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { loadProfile } from '../../profiles';
import { createSignalTuningState } from '../../signalTuning';
import { WalkerEeTab } from './WalkerEeTab';
import { WalkerPowerTab } from './WalkerPowerTab';
import { WalkerThroughputTab } from './WalkerThroughputTab';

const profile = loadProfile('hobs-2024-candidate-rich');
const tuning = createSignalTuningState(profile);

const powerMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <WalkerPowerTab
      baseProfile={profile}
      tuning={tuning}
      onTuningChange={() => {}}
    />
  </LocaleProvider>,
);
const throughputMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <WalkerThroughputTab linkThroughputMbps={30} />
  </LocaleProvider>,
);
const eeMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <WalkerEeTab linkEeMbitPerJ={1.2} />
  </LocaleProvider>,
);

assert.match(powerMarkup, /data-testid="walker-power-output-control"/);
assert.match(powerMarkup, /data-control-active="true"/);
assert.match(powerMarkup, /<i>p<\/i><sub>u,s,v<\/sub>\(t,/);
assert.match(powerMarkup, /P<sup>N<\/sup>/);
assert.match(powerMarkup, /P<sup>p<\/sup><sub>u,s,v<\/sub>/);
assert.match(powerMarkup, /data-formula-symbol="system-angle-state"/);
assert.doesNotMatch(powerMarkup, /power-tab-(?:beam|satellite)-cap-control/);
assert.doesNotMatch(powerMarkup, /P<sup>o<\/sup>|P<sup>r<\/sup>|<i>p<\/i><sup>r<\/sup>/);

assert.match(throughputMarkup, /data-testid="walker-throughput-formula"/);
assert.match(throughputMarkup, /R<sub>u,s,v<\/sub>/);
assert.match(throughputMarkup, /B<sup>w<\/sup>/);
assert.match(throughputMarkup, /U<sub>s,v<\/sub>\(t\)/);
assert.match(throughputMarkup, /γ<sub>u,s,v<\/sub>/);
assert.match(throughputMarkup, /data-formula-symbol="system-angle-state"/);
assert.match(throughputMarkup, /data-testid="walker-throughput-value"[\s\S]*30 Mbit\/s/);
assert.doesNotMatch(throughputMarkup, /<input\b|<select\b|計算值|Calculated value/);

assert.match(eeMarkup, /data-testid="walker-ee-formula-instantaneous"/);
assert.match(eeMarkup, /η<sub>u,s,v<\/sub>/);
assert.doesNotMatch(eeMarkup, /η<sup>e<\/sup>|x<sub>u,s,v<\/sub>\(t\) ·/);
assert.match(eeMarkup, /R<sub>u,s,v<\/sub>\(t,/);
assert.match(eeMarkup, /P<sup>N<\/sup>/);
assert.match(eeMarkup, /data-testid="walker-ee-value"[\s\S]*1\.2 Mbit\/J/);
assert.match(eeMarkup, /data-testid="walker-ee-formula-x"/);
assert.match(eeMarkup, /data-testid="walker-ee-formula-rate"/);
assert.match(eeMarkup, /data-testid="walker-ee-formula-system-power"/);
assert.doesNotMatch(eeMarkup, /Σ<sub>t<\/sub>P<sup>N<\/sup>/);
assert.doesNotMatch(eeMarkup, /<input\b|<select\b|計算值|Calculated value/);

const allVisibleFormulaMarkup = `${powerMarkup}${throughputMarkup}${eeMarkup}`;
assert.doesNotMatch(allVisibleFormulaMarkup, /ŝ|v̂|P<sub>(?:beam|max|sat)/);
assert.doesNotMatch(allVisibleFormulaMarkup, /P<sup>o<\/sup>|P<sup>r<\/sup>|I<sup>[ab]<\/sup>|η<sup>e<\/sup>/);
assert.doesNotMatch(allVisibleFormulaMarkup.replace(/<[^>]+>/g, ''), /唯讀|Read-only/i);

console.log('Walker formula tabs use the simplified symbol contract and only expose the live RF control.');
