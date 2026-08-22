import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProfile } from '../profiles/index';
import { LocaleProvider } from '../i18n';
import { createSceneTopologyState } from '../sceneTopology';
import { createSceneVisualScaleState } from '../sceneVisualScale';
import { createSignalTuningState } from '../signalTuning';
import { SignalTuningPanel } from './SignalTuningPanel';
import type { TuningTabKey } from './signal-tuning/types';

const profile = loadProfile('hobs-2024-candidate-rich');

function renderPanel(initialActiveTab: TuningTabKey = 'signal-power'): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <SignalTuningPanel
        baseProfile={profile}
        tuning={createSignalTuningState(profile)}
        topology={createSceneTopologyState()}
        sceneVisualScale={createSceneVisualScaleState()}
        hasOverrides={false}
        appMode="sinr-experiment"
        formulaBudget={null}
        initialActiveTab={initialActiveTab}
        onTuningChange={() => {}}
        onTopologyChange={() => {}}
        onSceneVisualScaleChange={() => {}}
        onReset={() => {}}
      />
    </LocaleProvider>,
  );
}

const markup = renderPanel();
const topFormula = markup.match(/data-testid="sinr-formula-header"[\s\S]*?<\/section>/)?.[0] ?? '';

assert.match(topFormula, /γ<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\)/);
assert.match(topFormula, /<i>p<\/i><sub>u,s,v<\/sub>\(t, θ<sub>u,s,v<\/sub>\)/);
assert.match(topFormula, /H<sub>u,s,v<\/sub>\(t\)[\s\S]*G<sup>T<\/sup>\(θ<sub>u,s,v<\/sub>\)/);
assert.match(topFormula, /I<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\)/);
assert.match(topFormula, /σ²/);
assert.doesNotMatch(topFormula, /p<sup>r<\/sup>|γ<sup>[er]<\/sup>|h<sub>|G<sup>[RLS]<\/sup>|I<sup>[ab]<\/sup>/);
assert.doesNotMatch(markup, /id="sinr-formula-tab-(loss|receiver-gain)"[^>]*role="tab"/);

for (const [id, symbol] of [
  ['signal-power', '<i>p</i><sub>u,s,v</sub>'],
  ['channel', 'H<sub>u,s,v</sub>'],
  ['beam', 'G<sup>T</sup>'],
  ['interference', 'I<sub>u,s,v</sub>'],
  ['thermal-noise', 'σ²'],
] as const) {
  assert.match(markup, new RegExp('id="sinr-formula-tab-' + id + '"[^>]*role="tab"'));
  assert.match(markup, new RegExp('id="sinr-formula-tab-' + id + '"[\\s\\S]*' + symbol));
}

const signalPower = renderPanel('signal-power');
assert.match(signalPower, /data-testid="signal-power-controls"[\s\S]*Actual RF output/);
assert.doesNotMatch(signalPower, /data-testid="signal-power-output-formula"|P<sup>[or]<\/sup>|data-testid="pt-signal-power-(?:value|control)"/);

const channel = renderPanel('channel');
assert.match(channel, /data-testid="loss-formula-controls"[\s\S]*H<sub>u,s,v<\/sub>\(t\)[\s\S]*(?:<i>)?G(?:<\/i>)?<sup>R<\/sup><sub>u,s,v<\/sub>\(t\)/);
assert.match(channel, /data-testid="loss-formula-controls"[\s\S]*L<sub>fs<\/sub>[\s\S]*L<sub>g<\/sub>[\s\S]*L<sub>sc<\/sub>[\s\S]*L<sub>sf<\/sub>/);
// The public H expansion stops at the four paper propagation terms plus G^R:
// scan loss and the NLoS clutter term stay in the implementation layer.
assert.doesNotMatch(channel, /data-testid="loss-formula-controls"[\s\S]*?L<sub>st(?:,max)?<\/sub>/);
assert.doesNotMatch(channel, /data-testid="loss-formula-controls"[\s\S]*?L<sub>N<\/sub>\(t\)/);
assert.doesNotMatch(channel, /data-testid="loss-formula-controls"[\s\S]*?φ<sub>max<\/sub>/);
assert.match(channel, /data-testid="gr-receiver-gain-control"[\s\S]*(?:<i>)?G(?:<\/i>)?<sup>R<\/sup><sub>u,s,v<\/sub>\(t\)/);
for (const id of [
  'path-loss-term-fspl',
  'path-loss-term-atmospheric',
  'path-loss-term-scintillation',
  'path-loss-term-shadow-fading',
] as const) {
  assert.match(channel, new RegExp(`data-testid="${id}"[\\s\\S]*data-control-symbol="true"[\\s\\S]*L<sub>(?:fs|g|sc|sf)<\\/sub>`));
}
// Scan-loss shaping is not a public formula symbol, so it is not a control.
assert.doesNotMatch(channel, /data-testid="max-steering-angle-control"|data-testid="max-scan-loss-control"/);
assert.doesNotMatch(channel, /data-testid="receiver-gain-controls"|G<sup>LS<\/sup>/);

const beam = renderPanel('beam');
assert.match(beam, /data-testid="beam-gain-controls"[\s\S]*G<sup>T<\/sup>\(θ<sub>u,s,v<\/sub>\)[\s\S]*G<sub>0<\/sub>\s*F\(/);
assert.match(beam, /data-testid="beam-gain-controls"[\s\S]*G<sup>T<\/sup>\(0\)\s*=\s*G<sub>0<\/sub>[\s\S]*F\(0/);
// HOBS Eq.(3) verbatim: the 2.07123 angle argument, J1 over TWICE mu, and no
// renormalizing constant (the pattern is already unity at boresight).
assert.match(beam, /data-testid="beam-gain-controls"[\s\S]*μ\(θ<sub>u,s,v<\/sub>\)\s*=\s*2\.07123/);
assert.match(beam, /J<sub>1<\/sub>\(μ\)[\s\S]*2μ[\s\S]*36J<sub>3<\/sub>\(μ\)[\s\S]*μ<sup>3<\/sup>/);
assert.doesNotMatch(beam, /1\.75|κ/);
// One paper pattern only: no J1-only / flat alternatives and no model selector.
assert.doesNotMatch(beam, /F<sub>J₁<\/sub>|F<sub>J₁\/J₃<\/sub>|F<sub>flat<\/sub>|F<sub>m<\/sub>|μ<sub>m<\/sub>/);
for (const id of [
  'gtmax-transmit-gain-control',
  'beamwidth3db-transmit-gain-control',
] as const) {
  assert.match(beam, new RegExp(`data-testid="${id}"[\\s\\S]*data-control-symbol="true"`));
}
assert.match(beam, /data-testid="beamwidth3db-transmit-gain-control"[\s\S]*data-control-symbol="true"[\s\S]*θ<sub>3dB<\/sub>/);
assert.doesNotMatch(beam, /data-testid="gain-model-control"/);
assert.doesNotMatch(beam, /G<sup>T<\/sup><sub>max<\/sub>|α<sub>max<\/sub>|L<sub>max<\/sub>/);

const interference = renderPanel('interference');
assert.match(interference, /data-testid="interference-controls"[\s\S]*<select\b/);
assert.equal((interference.match(/data-testid="interference-controls"[\s\S]*?<\/section>/)?.[0].match(/<select\b/g) ?? []).length, 1);
assert.doesNotMatch(interference, /I<sup>[ab]<\/sup>|γ<sub>u<\/sub>|p<sup>r<\/sup>|data-testid="interference-frequency-groups"/);
assert.match(interference, /Frequency-reuse groups determine which active beams share frequencies/);

const thermalNoise = renderPanel('thermal-noise');
assert.match(thermalNoise, /data-testid="thermal-noise-controls"[\s\S]*σ²\s*=\s*B<sup>w<\/sup>\s*·\s*<i>N<\/i><sub>0<\/sub>/);
assert.match(thermalNoise, /data-testid="bandwidth-thermal-noise-control"/);
assert.match(thermalNoise, /data-testid="n0-thermal-noise-control"/);
assert.doesNotMatch(thermalNoise, /T<sub>|NF|k<sub>B<\/sub>|分子項|分母項|numerator term|denominator term/);

const roleControlledMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      topology={{ ...createSceneTopologyState(), servingBeamCount: 1, candidateBeamCount: 19 }}
      sceneVisualScale={createSceneVisualScaleState()}
      hasOverrides
      appMode="sinr-experiment"
      formulaBudget={null}
      initialMainTab="scenario"
      servingSatelliteId="sat-serving"
      candidateSatelliteId="sat-candidate"
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      onReset={() => {}}
    />
  </LocaleProvider>,
);
assert.match(roleControlledMarkup, /id="scenario-data-serving-beam-layout-1"[^>]*checked=""/);
assert.match(roleControlledMarkup, /id="scenario-data-candidate-beam-layout-19"[^>]*checked=""/);

const roleFollowMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      topology={{ ...createSceneTopologyState(), servingBeamCount: 19 }}
      sceneVisualScale={createSceneVisualScaleState()}
      hasOverrides
      appMode="sinr-experiment"
      formulaBudget={null}
      initialMainTab="scenario"
      servingSatelliteId="sat-serving"
      candidateSatelliteId="sat-candidate"
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      onReset={() => {}}
    />
  </LocaleProvider>,
);
assert.match(roleFollowMarkup, /id="scenario-data-serving-beam-layout-19"[^>]*checked=""/);
assert.match(roleFollowMarkup, /id="scenario-data-candidate-beam-layout-19"[^>]*checked=""/);
assert.match(roleFollowMarkup, /data-testid="scenario-data-candidate-follow-serving"/);

console.log('SignalTuningPanel keeps the five active SINR groups and maps channel internals into H without retired symbols.');
