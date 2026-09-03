import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { ThroughputTab } from './ThroughputTab';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <ThroughputTab
      parameters={{ ...DEFAULT_SIMULATOR_PARAMETERS }}
      analysis={{} as HomepageCanonicalAnalysisState}
    />
  </LocaleProvider>,
);
const visibleText = markup.replace(/<[^>]+>/g, '');

assert.match(markup, /data-testid="throughput-canonical-page"/);
assert.match(markup, /data-testid="throughput-canonical-formula-row"/);
assert.match(markup, /R<sub>u,s,v<\/sub>\(t,[\s\S]*B<sup>w<\/sup>[\s\S]*U<sub>s,v<\/sub>\(t\)[\s\S]*γ<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\)/);
assert.doesNotMatch(markup, /R<sup>m<\/sup>|R<sub>u<\/sub>\(t\)|γ<sub>u<\/sub>\(t\)|P<sup>[or]<\/sup>|<select\b/);
assert.doesNotMatch(visibleText, /唯讀|Read-only|service demand/i);
assert.match(markup, /data-testid="throughput-tab-minimum-rate-control"[^>]*data-control-active="true"/);
assert.match(markup, /data-testid="throughput-tab-system-bandwidth-control"[^>]*data-control-active="true"/);
assert.match(markup, /data-source-provenance="TLE-CANONICAL-EE-SIMULATOR-SDD/);

console.log('ThroughputTab keeps only the canonical R_{u,s,v}(t, boldθ) equation; values remain on the right rail.');
