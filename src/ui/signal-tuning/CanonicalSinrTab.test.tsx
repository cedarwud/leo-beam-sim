import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { CanonicalSinrTab } from './CanonicalSinrTab';
import type { CanonicalSinrSectionKey } from './CanonicalSinrTabList';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const analysis = {
  parameters: { ...DEFAULT_SIMULATOR_PARAMETERS },
  setParameters: () => {},
} as unknown as HomepageCanonicalAnalysisState;

const visibleSections: readonly CanonicalSinrSectionKey[] = [
  'power',
  'channel',
  'beam',
  'interference',
  'noise',
];

function renderSection(initialSection: CanonicalSinrSectionKey): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <CanonicalSinrTab analysis={analysis} initialSection={initialSection} />
    </LocaleProvider>,
  );
}

function topFormula(markup: string): string {
  const start = markup.indexOf('data-testid="homepage-sinr-top-formula"');
  assert.notEqual(start, -1);
  const end = markup.indexOf('</div>', start);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

for (const section of visibleSections) {
  const markup = renderSection(section);
  const visibleText = markup.replace(/<[^>]+>/g, '');
  assert.match(markup, new RegExp('id="canonical-sinr-section-tab-' + section + '"[^>]*aria-selected="true"'));
  assert.doesNotMatch(visibleText, /[A-Za-z]+_[A-Za-z]/);
  assert.doesNotMatch(visibleText, /(?:numerator|denominator|分子|分母)/i);
  assert.doesNotMatch(markup, /P_DL|p_req|P_sys|P<sup>[or]<\/sup>|G<sup>(?:R|LS)<\/sup>|I<sup>[ab]<\/sup>|γ<sup>[er]<\/sup>/);
}

const power = renderSection('power');
const formula = topFormula(power);
assert.equal((power.match(/data-testid="homepage-sinr-top-formula"/g) ?? []).length, 1);
assert.match(formula, /γ<sub>u,s,v<\/sub>\(t,/);
assert.match(formula, /<i>p<\/i><sub>u,s,v<\/sub>\(t, θ<sub>u,s,v<\/sub>\)/);
assert.match(formula, /H<sub>u,s,v<\/sub>\(t\)/);
assert.match(formula, /G<sup>T<\/sup>\(θ<sub>u,s,v<\/sub>\)/);
assert.match(formula, /I<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\) \+ σ²/);

assert.match(power, /data-testid="canonical-sinr-formula-power"/);
assert.match(power, /data-testid="canonical-sinr-power-chain"[\s\S]*actual RF power/);
assert.doesNotMatch(power, /P<sup>[or]<\/sup>|P̃|data-testid="pt-signal-power-(?:value|control)"/);

const channel = renderSection('channel');
assert.match(channel, /data-testid="canonical-sinr-formula-channel"/);
assert.match(channel, /H<sub>u,s,v<\/sub>\(t\)/);
assert.match(channel, /data-testid="sinr-tab-carrier-frequency-control"/);
assert.match(channel, /data-testid="sinr-tab-atmospheric-loss-control"/);
assert.doesNotMatch(channel, /data-testid="receiver-gain-controls"|G<sup>[R]<\/sup>|G<sup>LS<\/sup>|L<sub>/);

const beam = renderSection('beam');
assert.match(beam, /data-testid="canonical-sinr-formula-beam"[\s\S]*G<sup>T<\/sup>\(θ<sub>u,s,v<\/sub>\)/);
assert.match(beam, /data-testid="sinr-tab-g0-control"[\s\S]*G<sup>T<\/sup>\(0\)/);
assert.match(beam, /data-testid="sinr-tab-theta3db-control"/);
assert.doesNotMatch(beam, /G<sup>T<\/sup><sub>max<\/sub>|θ<sub>3dB<\/sub>|steering|scan control/i);

const interference = renderSection('interference');
assert.match(interference, /data-testid="canonical-sinr-formula-interference"[\s\S]*I<sub>u,s,v<\/sub>/);
assert.match(interference, /data-testid="sinr-tab-frequency-reuse-control"/);
const interferenceSection = interference.slice(interference.indexOf('data-testid="canonical-sinr-section-interference"'));
assert.doesNotMatch(interferenceSection, /data-testid="canonical-sinr-interference-full-formula"|I<sup>[ab]<\/sup>|γ<sub>/);

const noise = renderSection('noise');
assert.match(noise, /data-testid="canonical-sinr-formula-noise"[\s\S]*σ²\s*=\s*B<sup>w<\/sup>\s*·\s*N<sub>0<\/sub>/);
assert.doesNotMatch(noise, /T<sub>|NF|k<sub>B<\/sub>|data-testid="sinr-tab-(?:antenna-noise-temperature|noise-figure|noise-reference-temperature)-control"/);

const receiverAlias = renderSection('receiver');
assert.match(receiverAlias, /id="canonical-sinr-section-tab-channel"[^>]*aria-selected="true"/);
assert.doesNotMatch(receiverAlias, /id="canonical-sinr-section-tab-receiver"[^>]*role="tab"/);

console.log('CanonicalSinrTab renders the active p/H/G^T/I/σ² contract and keeps receiver as a non-visible channel alias.');
