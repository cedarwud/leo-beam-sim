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

const sections: readonly CanonicalSinrSectionKey[] = [
  'power',
  'channel',
  'beam',
  'receiver',
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

const markupBySection = Object.fromEntries(sections.map(section => [section, renderSection(section)])) as Record<CanonicalSinrSectionKey, string>;

function topFormulaMarkup(markup: string): string {
  const start = markup.indexOf('data-testid="homepage-sinr-top-formula"');
  assert.notEqual(start, -1, 'the SINR header must expose one top formula');
  const end = markup.indexOf('</div>', start);
  assert.notEqual(end, -1, 'the SINR top formula wrapper must close');
  return markup.slice(start, end);
}

for (const section of sections) {
  const markup = markupBySection[section];
  const visibleText = markup.replace(/<[^>]+>/g, '');
  assert.match(markup, new RegExp(`id="canonical-sinr-section-tab-${section}"[^>]*aria-selected="true"`));
  assert.doesNotMatch(visibleText, /[A-Za-z]+_[A-Za-z]/, `${section} must not expose raw underscore notation`);
  assert.doesNotMatch(visibleText, /\b(?:linear|ratio)\b/i, `${section} must use symbols, not display-only prose tokens`);
  assert.doesNotMatch(visibleText, /\b(?:numerator|denominator)\b|分子|分母/i, `${section} must keep the formula symbolic`);
  assert.doesNotMatch(markup, /P_DL_tilde|P_DL(?:,actual|_actual)/);
}

const topFormula = topFormulaMarkup(markupBySection.power);
assert.equal((markupBySection.power.match(/data-testid="homepage-sinr-top-formula"/g) ?? []).length, 1);
assert.match(topFormula, /γ<sub>u,s,v<\/sub>\(t, θ\) =/);
assert.doesNotMatch(topFormula, /SINR<sub>|>SINR =/);
assert.match(
  topFormula,
  /data-formula-symbol="link-request-power"[\s\S]*data-formula-symbol="effective-channel"/,
);
assert.match(topFormula, /<i>p<\/i><sup>r<\/sup><sub>u,s,v<\/sub>\(t, θ\)[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(topFormula, /I<sub>u,s,v<\/sub>\(t, θ\) \+ σ²/);
assert.doesNotMatch(topFormula, /G<sup>LS|G<sup>T|G<sup>R/);
assert.doesNotMatch(markupBySection.power, /homepage-sinr-composite-channel|P̃<sub>|P̃<sup>/);

const powerMarkup = markupBySection.power;
assert.match(powerMarkup, /data-testid="canonical-sinr-formula-power"/);
assert.match(powerMarkup, /data-testid="canonical-sinr-power-chain"[\s\S]*<i>p<\/i><sup>r<\/sup><sub>u,s,v<\/sub>\(t, θ\)/);
assert.doesNotMatch(powerMarkup, /P<sup>r<\/sup><sub>s,v<\/sub>|P<sup>o<\/sup><sub>s,v<\/sub>/);
assert.doesNotMatch(powerMarkup, /P<sub>req,b<\/sub>|P̃<sub>|P̃<sup>/);

const channelMarkup = markupBySection.channel;
assert.match(channelMarkup, /data-testid="canonical-sinr-formula-channel"/);
assert.doesNotMatch(channelMarkup, /data-testid="canonical-sinr-composite-link-gain"/);
assert.match(channelMarkup, /canonical-sinr-channel-gain[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.doesNotMatch(channelMarkup, /G<sup>LS|L<sub>|Rician|>g = 1|H<sub>/);
assert.doesNotMatch(channelMarkup, /H adapter|s<sub>H<\/sub>|L<sub>FS|L<sub>atm/);
for (const testId of [
  'sinr-tab-scintillation-control',
  'sinr-tab-shadow-fading-control',
  'sinr-tab-channel-scale-control',
]) {
  assert.doesNotMatch(channelMarkup, new RegExp(`data-testid="${testId}"`));
}

const beamMarkup = markupBySection.beam;
assert.match(beamMarkup, /G<sup>T<\/sup>\(θ\)/);
assert.doesNotMatch(beamMarkup, /G<sup>T<\/sup>\(θ\) =|J<sub>|μ\(|θ<sub>3dB|3dB/);
assert.match(beamMarkup, /data-testid="sinr-tab-g0-control"[\s\S]*G<sub>0<\/sub>/);
assert.match(beamMarkup, /data-testid="sinr-tab-theta3db-control"/);
assert.doesNotMatch(beamMarkup, /data-testid="sinr-tab-theta3db-control"[\s\S]*θ<sub>3dB<\/sub>/);
assert.doesNotMatch(beamMarkup, /steering|scan control/i);

const receiverMarkup = markupBySection.receiver;
assert.match(receiverMarkup, /canonical-sinr-receiver-gain[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.doesNotMatch(receiverMarkup, /G<sup>R|G<sup>R,dB|G<sup>R<\/sup> =/);
assert.match(receiverMarkup, /data-testid="sinr-tab-receiver-gain-control"[\s\S]*Receive gain \(log value\)/);
assert.match(receiverMarkup, /data-testid="sinr-tab-receiver-gain-control"[^>]*data-reset-value="[^\"]+ dB"/);
assert.doesNotMatch(receiverMarkup, /G<sup>R<\/sup>_dBi|G<sup>R,dBi<\/sup>/);

const interferenceMarkup = markupBySection.interference;
assert.match(
  interferenceMarkup,
  /data-testid="canonical-sinr-interference-full-formula"[\s\S]*γ<sub>u,s,v<\/sub>\(t, θ\)[\s\S]*<i>p<\/i><sup>r<\/sup><sub>u,s,v<\/sub>\(t, θ\)[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)[\s\S]*I<sub>u,s,v<\/sub>\(t, θ\) \+ σ²/,
);
assert.match(interferenceMarkup, /I<sub>u,s,v<\/sub>\(t, θ\)/);
assert.doesNotMatch(interferenceMarkup, /B<sub>beam|B<sub>sys|K<sub>FR|I<sup>intra|I<sup>inter| \/ /);
assert.match(interferenceMarkup, /data-testid="sinr-tab-frequency-reuse-control"/);
assert.doesNotMatch(interferenceMarkup, /data-testid="sinr-tab-frequency-reuse-control"[\s\S]*K<sub>FR<\/sub>/);

const noiseMarkup = markupBySection.noise;
assert.match(noiseMarkup, /canonical-sinr-noise-power[\s\S]*σ²/);
assert.doesNotMatch(noiseMarkup, /T<sub>|B<sub>|K<sub>|NF\/10| \/ |k<sub>B<\/sub>/);
for (const testId of [
  'sinr-tab-antenna-noise-temperature-control',
  'sinr-tab-noise-figure-control',
  'sinr-tab-noise-reference-temperature-control',
]) {
  assert.match(noiseMarkup, new RegExp(`data-testid="${testId}"`));
}

assert.match(markupBySection.power, /γ<sub>u,s,v<\/sub>\(t, θ\)[\s\S]*<i>p<\/i><sup>r<\/sup><sub>u,s,v<\/sub>[\s\S]*h<sub>u,s,v<\/sub>/);
assert.doesNotMatch(markupBySection.power, /P̃<sup>DL<\/sup>|P̃<sub>b<\/sub><sup>DL<\/sup>/);
assert.match(markupBySection.channel, /canonical-sinr-section-tab-channel[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.doesNotMatch(markupBySection.channel, />h =|>g =|G<sup>LS|L<sub>/);
assert.match(markupBySection.beam, /canonical-sinr-section-tab-beam[\s\S]*G<sup>T<\/sup>\(θ\)/);
assert.match(markupBySection.receiver, /canonical-sinr-section-tab-receiver[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(powerMarkup, /<i>p<\/i><sup>r<\/sup><sub>u,s,v<\/sub>[\s\S]*I<sub>u,s,v<\/sub>\(t, θ\) \+ σ²/);
console.log('CanonicalSinrTab renders thesis SINR terms, the per-link SINR power term, and only formal channel controls.');
