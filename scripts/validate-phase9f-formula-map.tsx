import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms } from '../src/scene/types.ts';
import { createSceneTopologyState } from '../src/sceneTopology.ts';
import { createSceneVisualScaleState } from '../src/sceneVisualScale.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';

const PROFILE_ID = 'hobs-2024-paper-default';

function decodeHtmlText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected content to contain "${expected}"`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected content not to contain "${unexpected}"`);
}

function extractElementByTestId(markup: string, testId: string): string {
  const attr = `data-testid="${testId}"`;
  const attrIndex = markup.indexOf(attr);
  assert.notEqual(attrIndex, -1, `expected markup to contain ${attr}`);

  const start = markup.lastIndexOf('<', attrIndex);
  assert.notEqual(start, -1, `expected opening tag for ${testId}`);

  const tagMatch = /^<([a-zA-Z][\w:-]*)/.exec(markup.slice(start));
  assert.ok(tagMatch, `expected tag name for ${testId}`);
  const tagName = tagMatch[1];
  const tagPattern = /<\/?([a-zA-Z][\w:-]*)(?:\s[^<>]*)?>/g;
  tagPattern.lastIndex = start;

  let depth = 0;
  for (let match = tagPattern.exec(markup); match !== null; match = tagPattern.exec(markup)) {
    const token = match[0];
    const name = match[1];
    if (name !== tagName) continue;

    if (token.startsWith('</')) {
      depth -= 1;
      if (depth === 0) {
        return markup.slice(start, match.index + token.length);
      }
    } else if (!token.endsWith('/>')) {
      depth += 1;
    }
  }

  assert.fail(`expected closing tag for ${testId}`);
}

function createBudgetTerms(): LinkBudgetTerms {
  return {
    signalDbm: -88.5,
    intraInterferenceDbm: -113.2,
    interInterferenceDbm: -110.7,
    noiseDbm: -104.2,
    denominatorDbm: -103.1,
    txPowerDbm: 50.5,
    pathLossDb: 151.8,
    beamGainDb: 5.6,
    steeringLossDb: 1.2,
    receiverGainDbi: 2.5,
  };
}

type TestTab = 'signal-power' | 'beam' | 'receiver-gain' | 'thermal-noise';

function renderPanel(initialActiveTab: TestTab = 'signal-power') {
  const profile = loadProfile(PROFILE_ID);
  const tuning = {
    ...createSignalTuningState(profile),
    ueAntennaMaxGainDbi: 2.5,
  };
  const markup = renderToStaticMarkup(
    // Aligned to the CURRENT SignalTuningPanelProps: the removed legacy props
    // (currentSinrDb/formulaSource/handover-policy sextet) were never destructured
    // by the panel any more, so dropping them is render-identical; the added
    // topology/visual-scale/appMode props are unread outside the (unrendered)
    // topology tab, and FormulaTabList ignores appMode (`void appMode`).
    <SignalTuningPanel
      baseProfile={profile}
      tuning={tuning}
      topology={createSceneTopologyState()}
      sceneVisualScale={createSceneVisualScaleState()}
      appMode="sinr-experiment"
      hasOverrides={true}
      formulaBudget={createBudgetTerms()}
      isFormulaEvidenceStale={false}
      initialActiveTab={initialActiveTab}
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      onReset={() => {}}
    />,
  );

  return { markup, text: decodeHtmlText(markup) };
}

function assertFormulaMapOwnership(): void {
  const signal = renderPanel('signal-power');
  assertContains(signal.markup, 'data-testid="sinr-formula-map"');
  assertContains(signal.markup, 'P<sub>t</sub> -&gt; H/L -&gt; G<sup>T</sup> -&gt; G<sup>R</sup>');

  const numerator = extractElementByTestId(signal.markup, 'formula-map-numerator');
  const numeratorText = decodeHtmlText(numerator);
  assertContains(numerator, 'data-formula-side="numerator"');
  assertContains(numerator, 'data-testid="formula-map-pt"');
  assertContains(numerator, 'data-testid="formula-map-hl"');
  assertContains(numerator, 'data-testid="formula-map-gt"');
  assertContains(numerator, 'data-testid="formula-map-gr"');
  assertContains(numeratorText, 'Numerator / Signal Path');
  assertContains(numeratorText, 'Transmit power');
  assertContains(numeratorText, 'Path gain / loss');
  assertContains(numeratorText, 'Satellite beam gain');
  assertContains(numeratorText, 'Receiver gain');
  assertContains(numeratorText, 'Sensitivity');

  const denominator = extractElementByTestId(signal.markup, 'formula-map-denominator');
  const denominatorText = decodeHtmlText(denominator);
  assertContains(denominator, 'data-formula-side="denominator"');
  assertContains(denominator, 'data-testid="formula-map-interference"');
  assertContains(denominator, 'data-testid="formula-map-sigma"');
  assertContains(denominator, 'I<sup>a</sup> + I<sup>b</sup>');
  assertContains(denominator, 'σ²');
  assertContains(denominatorText, 'Denominator / Impairments');
  assertContains(denominatorText, 'Co-channel interference');
  assertContains(denominatorText, 'Thermal noise floor');
  assertNotContains(denominator, 'data-testid="formula-map-gr"');
  assertNotContains(denominatorText, 'Receiver gain');
  assertNotContains(denominatorText, 'Research Override');

  const grTile = extractElementByTestId(signal.markup, 'formula-map-gr');
  const grTileText = decodeHtmlText(grTile);
  assertContains(grTile, 'data-formula-side="numerator"');
  assertContains(grTile, 'data-term-owner="receiver-gain"');
  assertContains(grTileText, 'Receiver gain');
  assertContains(grTileText, 'Sensitivity');
  assertContains(grTileText, 'receive-side gain');
  assertContains(grTileText, 'Independent numerator term');
  assertContains(grTileText, 'not transmit power or satellite beam gain');
  assertNotContains(grTileText, 'HOBS');
  assertNotContains(grTileText, 'Research Override');

  const ptTile = extractElementByTestId(signal.markup, 'formula-map-pt');
  assertNotContains(ptTile, 'data-testid="formula-map-gr"');
  assertNotContains(decodeHtmlText(ptTile), 'Receiver gain');

  const gtTile = extractElementByTestId(signal.markup, 'formula-map-gt');
  assertNotContains(gtTile, 'data-testid="formula-map-gr"');
  assertNotContains(decodeHtmlText(gtTile), 'Receiver gain');
}

function assertControlGroupingStillSeparated(): void {
  const signal = renderPanel('signal-power');
  const signalPower = extractElementByTestId(signal.markup, 'signal-power-controls');
  const ptControl = extractElementByTestId(signal.markup, 'pt-signal-power-control');

  assertContains(signalPower, 'data-formula-side="numerator"');
  assertContains(signalPower, 'data-testid="pt-signal-power-control"');
  assertNotContains(signalPower, 'data-testid="gr-receiver-gain-control"');
  assertNotContains(signalPower, 'data-testid="gtmax-transmit-gain-control"');
  assertNotContains(ptControl, 'data-testid="gr-receiver-gain-control"');
  assertNotContains(decodeHtmlText(ptControl), 'Receiver gain');
  assertNotContains(decodeHtmlText(ptControl), 'Research Override');

  const beam = renderPanel('beam');
  const transmitGain = extractElementByTestId(beam.markup, 'gtmax-transmit-gain-control');
  assertContains(decodeHtmlText(transmitGain), 'Max transmit gain');
  assertNotContains(beam.markup, 'data-testid="gr-receiver-gain-control"');

  const receiver = renderPanel('receiver-gain');
  const receiverGain = extractElementByTestId(receiver.markup, 'receiver-gain-controls');
  const grControl = extractElementByTestId(receiver.markup, 'gr-receiver-gain-control');
  assertContains(receiverGain, 'data-formula-side="numerator"');
  assertContains(receiverGain, 'data-testid="gr-receiver-gain-control"');
  assertContains(decodeHtmlText(grControl), 'Receiver gain');
  assertContains(decodeHtmlText(receiverGain), 'independently from P_t and G^T');
  assertNotContains(receiverGain, 'data-testid="pt-signal-power-control"');
  assertNotContains(receiverGain, 'data-testid="gtmax-transmit-gain-control"');
  assertNotContains(decodeHtmlText(receiverGain), 'Research Override');
  assertNotContains(decodeHtmlText(receiverGain), 'HOBS');

  const noise = renderPanel('thermal-noise');
  const thermalNoise = extractElementByTestId(noise.markup, 'thermal-noise-controls');
  assertContains(thermalNoise, 'data-formula-side="denominator"');
  assertContains(thermalNoise, 'data-testid="thermal-noise-floor-readout"');
  assertContains(thermalNoise, 'data-testid="bandwidth-thermal-noise-control"');
  assertContains(thermalNoise, 'data-testid="n0-thermal-noise-control"');
  assertNotContains(thermalNoise, 'data-testid="gr-receiver-gain-control"');
  assertNotContains(decodeHtmlText(thermalNoise), 'Receiver gain');
  assertNotContains(decodeHtmlText(thermalNoise), 'Research Override');

  const denominator = extractElementByTestId(noise.markup, 'formula-map-denominator');
  assertNotContains(denominator, 'data-testid="formula-map-gr"');
}

function run(): void {
  assertFormulaMapOwnership();
  assertControlGroupingStillSeparated();

  console.log('Phase 9F formula map / G^R placement validation passed.');
  console.log(JSON.stringify({
    asserted: {
      formulaMap: [
        'numerator map contains P_t, H/L, G^T, and independent G^R',
        'denominator map contains I^a + I^b and sigma^2',
        'G^R carries receiver gain and sensitivity-control copy',
        'G^R is not inside the P_t control group',
        'G^R is not in the denominator map',
      ],
      preserved: [
        'P_t, G^T, and G^R controls render in separate numerator-side tabs',
        'existing thermal-noise controls remain denominator-side controls',
      ],
    },
  }, null, 2));
}

run();
