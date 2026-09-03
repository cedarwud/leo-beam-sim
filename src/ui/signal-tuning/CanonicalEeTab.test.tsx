import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { CanonicalEeTab } from './CanonicalEeTab';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const analysis = {} as HomepageCanonicalAnalysisState;

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalEeTab analysis={analysis} />
  </LocaleProvider>,
);
const visibleText = markup.replace(/<[^>]+>/g, '');

assert.match(markup, /data-testid="homepage-ee-parameters"/);
assert.match(markup, /data-testid="homepage-ee-formula-instantaneous"/);
assert.match(markup, /η<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\)/);
assert.match(markup, /R<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\)/);
assert.match(markup, /P<sup>N<\/sup>\(t,[\s\S]*θ[\s\S]*\)/);
assert.match(markup, /data-testid="homepage-ee-formula-x"[\s\S]*x<sub>u,s,v<\/sub>\(t\)/);
assert.match(markup, /data-testid="homepage-ee-formula-rate"[\s\S]*R<sub>u,s,v<\/sub>[\s\S]*B<sup>w<\/sup>[\s\S]*U<sub>s,v<\/sub>\(t\)[\s\S]*γ<sub>u,s,v<\/sub>/);
assert.match(markup, /data-testid="homepage-ee-formula-system-power"[\s\S]*P<sup>f<\/sup>\(t\)[\s\S]*P<sup>p<\/sup><sub>s′,v′<\/sub>/);
assert.match(markup, /data-testid="ee-canonical-controls"/);
for (const testId of ['ee-tab-eta-max-control', 'ee-tab-backoff-control', 'ee-tab-rfc-control', 'ee-tab-bb-control']) {
  assert.match(markup, new RegExp(`data-testid="${testId}"[^>]*data-control-active="true"`));
}
assert.match(markup, /ξ<sub>max<\/sub>/);
assert.match(markup, /data-source-provenance="TLE-CANONICAL-EE-SIMULATOR-SDD/);
assert.doesNotMatch(markup, /η<sup>e<\/sup>|EE_eval|EE_inst|Σ<sub>t<\/sub>|Δt|P<sup>[or]<\/sup>|p<sup>r<\/sup>/);
assert.match(markup, /<input\b[^>]*type="range"/);
assert.doesNotMatch(markup, /<select\b/);
assert.doesNotMatch(visibleText, /唯讀|Read-only|numerator|denominator|分子|分母/i);
assert.doesNotMatch(markup, /P<sup>p<\/sup><sub>u,s,v<\/sub>/);

console.log('CanonicalEeTab keeps the single-link η = R / P^N presentation with X, R, and P^N explanations only.');
