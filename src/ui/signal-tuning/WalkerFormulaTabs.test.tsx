import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { WalkerEeTab } from './WalkerEeTab';
import { WalkerPowerTab } from './WalkerPowerTab';
import { WalkerThroughputTab } from './WalkerThroughputTab';

const powerMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <WalkerPowerTab />
  </LocaleProvider>,
);
const throughputMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <WalkerThroughputTab />
  </LocaleProvider>,
);
const eeMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <WalkerEeTab />
  </LocaleProvider>,
);

assert.doesNotMatch(powerMarkup, /walker-power-reference-control|<input\b|<select\b/);
assert.match(powerMarkup, /data-testid="walker-power-page"[^>]*data-readonly="true"[^>]*data-control-surface="derived-only"/);
assert.match(powerMarkup, /data-testid="walker-power-recurrence-formula"/);
for (const testId of [
  'walker-power-system-formula',
  'walker-power-beam-aggregation-formula',
  'walker-power-pa-formula',
  'walker-power-segment-start-formula',
  'walker-power-recurrence-formula',
  'walker-power-closed-formula',
]) {
  assert.match(powerMarkup, new RegExp(`data-testid="${testId}"[\\s\\S]*?font-size:17px`));
}
assert.match(powerMarkup, /walker-power-segment-start-formula|p<sup>0<\/sup>[\s\S]*0\.825 W/);
assert.match(powerMarkup, /<i>p<\/i><sub>u,s,v<\/sub>\(t,/);
assert.match(powerMarkup, /P<sup>N<\/sup>/);
assert.match(powerMarkup, /P<sup>p<\/sup><sub>s,v<\/sub>/);
assert.match(powerMarkup, /s′∈𝒮[\s\S]*v′∈𝒱/);
assert.doesNotMatch(powerMarkup, /P<sup>p<\/sup><sub>u,s,v<\/sub>|ξ<sub>u,s,v<\/sub>/);
assert.match(powerMarkup, /θ<sub>3dB<\/sub>/);
assert.match(powerMarkup, /data-testid="formula-symbol-guide"/);
assert.match(powerMarkup, /data-testid="walker-power-symbol-system"/);
assert.match(powerMarkup, /data-testid="walker-power-symbol-rf"/);
assert.match(powerMarkup, /data-testid="walker-power-symbol-efficiency"/);
assert.match(powerMarkup, /data-testid="walker-power-symbol-gain"/);
assert.match(powerMarkup, /t−1/);
assert.doesNotMatch(powerMarkup, /θ<sup>0<\/sup>|t₀|t0/);
assert.doesNotMatch(powerMarkup, /P<sup>o<\/sup>|P<sup>r<\/sup>|G<sub>0<\/sub>/);
assert.match(powerMarkup, /data-formula-symbol="system-angle-state"/);
assert.doesNotMatch(powerMarkup, /power-tab-(?:beam|satellite)-cap-control/);
assert.doesNotMatch(powerMarkup, /P<sup>o<\/sup>|P<sup>r<\/sup>|<i>p<\/i><sup>r<\/sup>/);

assert.match(throughputMarkup, /data-testid="walker-throughput-formula"/);
assert.match(throughputMarkup, /data-testid="walker-throughput-formula"[\s\S]*?font-size:17px/);
assert.match(throughputMarkup, /data-testid="walker-throughput-page"[^>]*data-readonly="true"[^>]*data-control-surface="derived-only"/);
assert.match(throughputMarkup, /R<sub>u,s,v<\/sub>/);
assert.match(throughputMarkup, /B<sup>w<\/sup>/);
assert.match(throughputMarkup, /U<sub>s,v<\/sub>\(t\)/);
assert.match(throughputMarkup, /γ<sub>u,s,v<\/sub>/);
assert.match(throughputMarkup, /θ<sub>3dB<\/sub>/);
assert.match(throughputMarkup, /data-testid="formula-symbol-guide"/);
assert.match(throughputMarkup, /data-testid="walker-throughput-symbol-rate"/);
assert.doesNotMatch(throughputMarkup, /data-testid="walker-throughput-value"|walker-throughput-bandwidth-value|walker-throughput-load-value|walker-throughput-gamma-value/);
assert.doesNotMatch(throughputMarkup, /<input\b|<select\b|計算值|Calculated value/);

assert.match(eeMarkup, /data-testid="walker-ee-formula-instantaneous"/);
assert.match(eeMarkup, /data-testid="walker-ee-page"[^>]*data-readonly="true"[^>]*data-control-surface="derived-only"/);
assert.match(eeMarkup, /η<sub>u,s,v<\/sub>/);
assert.doesNotMatch(eeMarkup, /η<sup>e<\/sup>|x<sub>u,s,v<\/sub>\(t\) ·/);
assert.match(eeMarkup, /R<sub>u,s,v<\/sub>\(t,/);
assert.match(eeMarkup, /P<sup>N<\/sup>/);
assert.match(eeMarkup, /θ<sub>3dB<\/sub>/);
assert.match(eeMarkup, /data-testid="formula-symbol-guide"/);
assert.match(eeMarkup, /data-testid="walker-ee-symbol-x"/);
assert.match(eeMarkup, /data-testid="walker-ee-symbol-rate"/);
assert.match(eeMarkup, /data-testid="walker-ee-symbol-system-power"/);
assert.doesNotMatch(eeMarkup, /data-testid="walker-ee-value"|data-testid="walker-ee-formula-full"/);
assert.doesNotMatch(eeMarkup, /<i>p<\/i><sub>u,s,v<\/sub>\(t,[\s\S]*H<sub>u,s,v<\/sub>\(t\)[\s\S]*G<sup>T<\/sup>/);
assert.doesNotMatch(eeMarkup, /I<sub>u,s,v<\/sub>\(t,[\s\S]*σ²/);
assert.doesNotMatch(eeMarkup, /Σ<sub>t<\/sub>P<sup>N<\/sup>/);
assert.doesNotMatch(eeMarkup, /<input\b|<select\b|計算值|Calculated value/);

for (const markupWithGuide of [powerMarkup, throughputMarkup, eeMarkup]) {
  assert.match(markupWithGuide, /data-testid="[^"]+-symbol"/);
  assert.match(markupWithGuide, /data-testid="[^"]+-explanation"/);
  assert.doesNotMatch(markupWithGuide, /definition/);
}

const allVisibleFormulaMarkup = `${powerMarkup}${throughputMarkup}${eeMarkup}`;
assert.doesNotMatch(allVisibleFormulaMarkup, /ŝ|v̂|P<sub>(?:beam|max|sat)/);
assert.doesNotMatch(allVisibleFormulaMarkup, /P<sup>o<\/sup>|P<sup>r<\/sup>|I<sup>[ab]<\/sup>|η<sup>e<\/sup>/);
assert.doesNotMatch(allVisibleFormulaMarkup.replace(/<[^>]+>/g, ''), /唯讀|Read-only/i);

console.log('Walker formula tabs use the simplified symbol contract and expose previous-step power recurrence.');
