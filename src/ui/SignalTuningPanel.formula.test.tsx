import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProfile } from '../profiles/index';
import { createSceneTopologyState } from '../sceneTopology';
import { createSceneVisualScaleState } from '../sceneVisualScale';
import { createSignalTuningState } from '../signalTuning';
import { SignalTuningPanel } from './SignalTuningPanel';
import type { TuningTabKey } from './signal-tuning/types';

const profile = loadProfile('hobs-2024-candidate-rich');
function renderPanel(initialActiveTab: TuningTabKey = 'signal-power') {
  return renderToStaticMarkup(
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
  );
}

const markup = renderPanel();
const roleControlledMarkup = renderToStaticMarkup(
  <SignalTuningPanel
    baseProfile={profile}
    tuning={createSignalTuningState(profile)}
    topology={{
      ...createSceneTopologyState(),
      servingBeamCount: 1,
      candidateBeamCount: 19,
    }}
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
  />,
);

const topFormula = markup.match(/data-testid="sinr-formula-header"[\s\S]*?<\/section>/)?.[0] ?? '';

assert.match(topFormula, /γ<sub>u,s,v<\/sub>/);
assert.match(topFormula, /data-formula-symbol="system-angle-state"/);
assert.match(topFormula, /h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(topFormula, /<i>p<\/i><sub>u,s,v<\/sub>\(t,/);
assert.match(topFormula, /I<sub>u,s,v<\/sub>/);
assert.doesNotMatch(topFormula, /<i>p<\/i><sup>r<\/sup>|p<sup>r<\/sup>/);
assert.doesNotMatch(topFormula, /γ<sub>u<\/sub>|h<sub>u<\/sub>|I<sub>u<\/sub>/);
assert.doesNotMatch(topFormula, /ŝ|v̂/);
assert.doesNotMatch(topFormula, /Θ|θ<sub>/);
assert.match(markup, /id="sinr-formula-tab-signal-power"[\s\S]*<i>p<\/i><sub>u,s,v<\/sub>/);
assert.match(markup, /id="sinr-formula-tab-channel"[\s\S]*h<sub>u,s,v<\/sub>[\s\S]*\(t, θ\)/);
assert.match(markup, /id="sinr-formula-tab-interference"[\s\S]*I<sub>u,s,v<\/sub>/);

const signalPower = renderPanel('signal-power');
const channel = renderPanel('channel');
const loss = renderPanel('loss');
const interference = renderPanel('interference');
const receiver = renderPanel('receiver-gain');
const legacyInterference = renderPanel('interference');
const signalPowerControls = signalPower.match(
  /<section[^>]*data-testid="signal-power-controls"[\s\S]*?<\/section>/,
)?.[0] ?? '';
const interferenceContext = interference.match(
  /data-testid="interference-controls-formula-context"[\s\S]*?data-testid="interference-frequency-groups"/,
)?.[0] ?? '';
assert.match(markup, /id="sinr-formula-tab-signal-power"[^>]*role="tab"/);
assert.match(markup, /id="sinr-formula-tab-channel"[^>]*role="tab"/);
assert.match(markup, /id="sinr-formula-tab-interference"[^>]*role="tab"/);
assert.match(roleControlledMarkup, /id="scenario-data-serving-beam-layout-1"[^>]*checked=""/);
assert.match(roleControlledMarkup, /id="scenario-data-candidate-beam-layout-19"[^>]*checked=""/);
assert.match(markup, /id="sinr-formula-tab-thermal-noise"[^>]*role="tab"/);
assert.match(markup, /grid-template-columns:repeat\(3, minmax\(0, 1fr\)\) minmax\(40px, 0\.45fr\)/);
assert.doesNotMatch(markup, /id="sinr-formula-tab-(loss|beam|receiver-gain)"[^>]*role="tab"/);
assert.match(signalPowerControls, /<i>p<\/i><sub>u,s,v<\/sub>\(t,[\s\S]*?θ/);
assert.match(signalPowerControls, /data-testid="signal-power-output-formula"/);
assert.doesNotMatch(signalPowerControls, /P<sup>o<\/sup>|P<sup>r<\/sup>|z<sub>s,v<\/sub>/);
assert.doesNotMatch(signalPowerControls, /分子項|numerator term/);
assert.doesNotMatch(signalPower, /P̃<sup>DL<\/sup>/);
assert.doesNotMatch(signalPower, /data-testid="pt-signal-power-(?:value|control)"/);
assert.match(channel, /data-testid="receiver-gain-controls"/);
assert.match(channel, /data-testid="loss-formula-controls"/);
assert.match(channel, /data-testid="beam-gain-controls"/);
const effectiveChannelFormula = channel.match(
  /data-testid="effective-channel-composition-formula"[\s\S]*?<\/div>/,
)?.[0] ?? '';
assert.match(
  effectiveChannelFormula,
  /h<sub>u,s,v<\/sub>\(t, θ\) = H<sub>u,s,v<\/sub>\(t\) · G<sup>T<\/sup>\(θ\)/,
);
const effectiveChannelDetail = channel.match(
  /data-testid="effective-channel-detail"[\s\S]*?data-testid="receiver-gain-controls"/,
)?.[0] ?? '';
assert.match(
  effectiveChannelDetail,
  /data-testid="effective-channel-detail-formula"[\s\S]*H<sub>u,s,v<\/sub>\(t\) = G<sup>LS<\/sup><sub>u,s<\/sub> · G<sup>R<\/sup><sub>u,s<\/sub> · g<sub>u,s,v<\/sub>\(t\)/,
);
assert.doesNotMatch(channel, /data-testid="effective-channel-path-loss-formula"/);
const propagationFactors = channel.match(
  /data-testid="loss-formula-controls"[\s\S]*?data-testid="path-loss-term-fspl"/,
)?.[0] ?? '';
assert.match(
  propagationFactors,
  /data-testid="loss-formula-controls-formula"[\s\S]*G<sup>LS<\/sup><sub>u,s<\/sub> ← L<sup>FS<\/sup>\(.*<i>f<\/i><sub>c<\/sub>.*d<sub>u,s,v<\/sub>\(t\).*L<sup>atm<\/sup>.*χ<sub>atm<\/sub>.*L<sup>sc<\/sup>.*L<sup>sf<\/sup>/,
);
assert.doesNotMatch(channel, /有效通道 h（分子項）|Effective channel h \(numerator term\)/);
assert.match(channel, /data-testid="path-loss-term-fspl"[\s\S]*<i>f<\/i><sub>c<\/sub>/);
assert.match(channel, /data-testid="path-loss-term-atmospheric"[\s\S]*χ<sub>atm<\/sub>/);
assert.match(channel, /data-testid="gr-receiver-gain-control"[\s\S]*G<sup>R<\/sup>/);
assert.match(channel, /data-testid="gtmax-transmit-gain-control"[\s\S]*G<sub>0<\/sub>/);
assert.match(channel, /data-testid="beamwidth3db-transmit-gain-control"[\s\S]*θ<sub>3dB<\/sub>/);
const beamGainControls = channel.match(
  /<section[^>]*data-testid="beam-gain-controls"[\s\S]*?<\/section>/,
)?.[0] ?? '';
assert.doesNotMatch(beamGainControls, /data-control-symbol="true"[\s\S]{0,140}G<sup>T<\/sup>\(θ\)/);
assert.match(channel, /h<sub>u,s,v<\/sub>[\s\S]*\(t, θ\)/);
assert.match(loss, /h<sub>u,s,v<\/sub>[\s\S]*\(t, θ\)/);
assert.match(loss, /data-testid="loss-formula-controls-formula"[\s\S]*H<sub>u,s,v<\/sub>\(t\)/);
assert.doesNotMatch(loss, /G<sup>T<\/sup>\(θ\) =/);
assert.match(
  interferenceContext,
  /I<sub>u,s,v<\/sub>\(t,[\s\S]*?θ/,
);
assert.match(interferenceContext, /data-formula-symbol="system-angle-state"/);
assert.doesNotMatch(interferenceContext, /γ<sub>|<i>p<\/i><sup>r<\/sup>|h<sub>u,s,v<\/sub>/);
assert.match(interference, /data-testid="interference-frequency-swatch-1"[\s\S]*頻率 1/);
assert.match(interference, /data-testid="interference-frequency-swatch-2"[\s\S]*頻率 2/);
const thermalNoise = renderPanel('thermal-noise');
const thermalNoiseSection = thermalNoise.match(
  /<section[^>]*data-testid="thermal-noise-controls"[\s\S]*?<\/section>/,
)?.[0] ?? '';
assert.match(thermalNoiseSection, /σ² = B<sup>w<\/sup> · <i>N<\/i><sub>0<\/sub>/);
assert.match(thermalNoiseSection, /data-testid="thermal-noise-floor-readout"[\s\S]*data-testid="bandwidth-thermal-noise-control"/);
assert.match(thermalNoiseSection, /data-testid="n0-thermal-noise-control"[\s\S]*<i>N<\/i><sub>0<\/sub>/);
assert.doesNotMatch(thermalNoiseSection, /分子項|分母項|numerator term|denominator term/);
const thermalBandwidthControl = thermalNoiseSection.match(
  /data-testid="bandwidth-thermal-noise-control"[\s\S]*?data-testid="n0-thermal-noise-control"/,
)?.[0] ?? '';
assert.match(thermalBandwidthControl, /data-control-label="true"[\s\S]*data-control-symbol="true"[\s\S]*data-control-value="true"/);
assert.match(receiver, /h<sub>u,s,v<\/sub>[\s\S]*\(t, θ\)/);
assert.match(
  legacyInterference,
  /data-testid="interference-controls-formula-context"[\s\S]*I<sub>u,s,v<\/sub>\(t,[\s\S]*?θ/,
);
assert.doesNotMatch(markup, /P<sup>o<\/sup>|P<sup>r<\/sup>|I<sup>[ab]<\/sup>|η<sup>e<\/sup>/);

console.log('SignalTuningPanel renders the four visible SINR groups with h and total I notation.');
