import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { ThroughputTab } from './ThroughputTab';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const parameters = {
  ...DEFAULT_SIMULATOR_PARAMETERS,
};
const analysis = {
  frame: {
    links: [{ rateBps: 12_345.678 }],
  },
} as unknown as HomepageCanonicalAnalysisState;

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
  <ThroughputTab parameters={parameters} analysis={analysis} />
  </LocaleProvider>,
);
const zhMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
  <ThroughputTab parameters={parameters} analysis={analysis} />
  </LocaleProvider>,
);
const visibleText = markup.replace(/<[^>]+>/g, '');

assert.match(markup, /data-testid="throughput-canonical-page"/);
assert.match(markup, /data-testid="throughput-tab-calculated-value"[\s\S]*?12.3 kbit\/s/);
assert.doesNotMatch(visibleText, /[A-Za-z]+_[A-Za-z]/, 'rendered throughput copy must not expose raw underscore notation');
assert.match(markup, /R<sub>u,s,v<\/sub>\(t, θ\)[\s\S]*U<sub>s,v<\/sub>\(t\)[\s\S]*γ<sub>u,s,v<\/sub>\(t, θ\)/);
assert.doesNotMatch(markup, /<strong>Θ<\/strong>|Θ<sub>|; <strong>/);
assert.doesNotMatch(markup, /R<sub>u<\/sub>\(t\)|γ<sub>u<\/sub>\(t\)|ŝ|v̂/);
assert.match(markup, /data-testid="throughput-tab-minimum-rate-value"/);
assert.match(markup, /data-testid="throughput-tab-system-bandwidth-value"/);
assert.match(markup, /data-testid="throughput-tab-minimum-rate-value"[\s\S]*?data-readonly="true"/);
assert.match(markup, /data-testid="throughput-tab-system-bandwidth-value"[\s\S]*?data-readonly="true"/);
assert.match(markup, /data-testid="throughput-tab-minimum-rate-value"[\s\S]*font-size:22px/);
assert.match(markup, /data-testid="throughput-tab-system-bandwidth-value"[\s\S]*font-size:22px/);
const throughputValueCard = markup.match(
  /data-testid="throughput-tab-minimum-rate-value"[\s\S]*?data-testid="throughput-tab-system-bandwidth-value"/,
)?.[0] ?? '';
assert.match(throughputValueCard, /data-control-label="true"[\s\S]*data-control-symbol="true"[\s\S]*data-control-value="true"/);
assert.doesNotMatch(markup, /throughput-tab-(?:minimum-rate|system-bandwidth)-control/);
assert.doesNotMatch(markup, /<input\b|<select\b|\bdisabled(?:=|\s|>)/);

// The left rail owns the formula explanation and current model values. Final
// gamma/power/SINR/rate and fixed-scene derived values are rendered by the
// right-side result surface, so the old duplicated readout cards must not
// survive in this tab.
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
assert.doesNotMatch(markup, /throughput-tab-served-users-control/);
assert.doesNotMatch(markup, /throughput-tab-bandwidth-control/);
assert.doesNotMatch(markup, /100 UE \/ 7 beams/);
assert.doesNotMatch(markup, /Fixed load pattern is 15, 15, 14, 14, 14, 14, 14/);
assert.match(markup, /B<sup>w<\/sup>/);
assert.doesNotMatch(visibleText, /唯讀|Read-only/i);
assert.match(zhMarkup, /每位使用者最低傳輸速率要求/);
assert.match(zhMarkup, /R<sup>m<\/sup>/);
assert.doesNotMatch(markup, /Non-canonical teaching projection/);

console.log('ThroughputTab shows the simplified rate equation and current R^m/B^w values.');
