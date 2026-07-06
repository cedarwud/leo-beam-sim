import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms } from '../src/scene/types.ts';
import { createSceneTopologyState } from '../src/sceneTopology.ts';
import { createSceneVisualScaleState } from '../src/sceneVisualScale.ts';
import {
  applySignalTuning,
  createSignalTuningState,
  getSignalTuningEvidenceKey,
  getSignalTuningResetKey,
  hasSignalTuningOverrides,
  type SignalTuningState,
} from '../src/signalTuning.ts';
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
      if (depth === 0) return markup.slice(start, match.index + token.length);
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

function renderPanel(initialActiveTab: TestTab, isFormulaEvidenceStale = false) {
  const profile = loadProfile(PROFILE_ID);
  const tuning = createSignalTuningState(profile);
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
      hasOverrides={false}
      formulaBudget={createBudgetTerms()}
      isFormulaEvidenceStale={isFormulaEvidenceStale}
      initialActiveTab={initialActiveTab}
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      onReset={() => {}}
    />,
  );

  return { markup, text: decodeHtmlText(markup) };
}

function assertUiSeparation(): void {
  const source = readFileSync(new URL('../src/ui/SignalTuningPanel.tsx', import.meta.url), 'utf8');
  assertNotContains(source, "key: 'power'");
  assertNotContains(source, "title: 'Power'");
  assertNotContains(source, 'P<sub>t</sub> / σ²');
  assertNotContains(source, 'Signal strength, receiver override, and thermal noise.');

  const signal = renderPanel('signal-power');
  const signalControlsMarkup = extractElementByTestId(signal.markup, 'signal-power-controls');
  const signalControlsText = decodeHtmlText(signalControlsMarkup);
  assertContains(signalControlsMarkup, 'data-formula-side="numerator"');
  assertContains(signalControlsMarkup, 'data-testid="pt-signal-power-control"');
  assertNotContains(signalControlsMarkup, 'data-testid="gtmax-transmit-gain-control"');
  assertNotContains(signalControlsMarkup, 'data-testid="gr-receiver-gain-control"');
  assertContains(signalControlsText, 'Transmit Power / numerator');
  assertContains(signal.text, 'Per-beam transmit power');
  assertContains(signalControlsText, 'This tab controls transmit power only');
  assertNotContains(signalControlsText, 'Max transmit gain');
  assertNotContains(signalControlsText, 'Receiver Gain / numerator');
  assertContains(signal.text, 'Receiver Gain');
  assertNotContains(signal.text, 'Thermal Noise / denominator');
  assertNotContains(signal.text, 'Channel bandwidth');
  assertNotContains(signal.text, 'Noise PSD');

  const beam = renderPanel('beam');
  assertContains(beam.markup, 'data-testid="gtmax-transmit-gain-control"');
  assertContains(beam.text, 'Transmit Gain');
  assertContains(beam.text, 'Max transmit gain');
  assertNotContains(beam.markup, 'data-testid="gr-receiver-gain-control"');

  const receiver = renderPanel('receiver-gain');
  const receiverControlsMarkup = extractElementByTestId(receiver.markup, 'receiver-gain-controls');
  const receiverControlsText = decodeHtmlText(receiverControlsMarkup);
  assertContains(receiverControlsMarkup, 'data-formula-side="numerator"');
  assertContains(receiverControlsMarkup, 'data-testid="gr-receiver-gain-control"');
  assertContains(receiverControlsText, 'Receiver Gain / numerator');
  assertContains(receiverControlsText, 'Receiver gain');
  assertContains(receiverControlsText, 'Receive-side antenna gain in the SINR signal path');
  assertNotContains(receiverControlsText, 'Per-beam transmit power');
  assertNotContains(receiverControlsText, 'Max transmit gain');
  assertNotContains(receiverControlsText, 'Research Override');
  assertNotContains(receiverControlsText, 'HOBS paper');

  const noise = renderPanel('thermal-noise');
  const noiseControlsMarkup = extractElementByTestId(noise.markup, 'thermal-noise-controls');
  const noiseControlsText = decodeHtmlText(noiseControlsMarkup);
  assertContains(noiseControlsMarkup, 'data-formula-side="denominator"');
  assertContains(noiseControlsMarkup, 'data-testid="thermal-noise-floor-readout"');
  assertContains(noiseControlsMarkup, 'data-readonly="true"');
  assertContains(noiseControlsMarkup, 'data-formula-evidence-status="current"');
  assertContains(noiseControlsMarkup, 'data-testid="bandwidth-thermal-noise-control"');
  assertContains(noiseControlsMarkup, 'data-testid="n0-thermal-noise-control"');
  assertContains(noiseControlsText, 'Thermal Noise / denominator');
  assertContains(noiseControlsText, 'Noise floor');
  assertContains(noiseControlsText, '-104.2 dBm');
  assertContains(noiseControlsText, 'Read-only computed σ² / noise floor');
  assertContains(noiseControlsText, 'Channel bandwidth');
  assertContains(noiseControlsText, 'Noise PSD');
  assertContains(noiseControlsText, 'They are not transmit-power controls');
  assertNotContains(noiseControlsText, 'Transmit Power / numerator');
  assertNotContains(noiseControlsText, 'Per-beam transmit power');
  assertNotContains(noiseControlsText, 'Max transmit gain');
  assertNotContains(noiseControlsText, 'Receiver gain');

  const staleNoise = renderPanel('thermal-noise', true);
  assertContains(staleNoise.markup, 'data-testid="thermal-noise-floor-readout"');
  assertContains(staleNoise.markup, 'data-formula-evidence-status="stale"');
  assertContains(staleNoise.text, 'stale after edit; waiting for the next recomputed frame');
}

function assertTuningWiringAndEvidencePath(): void {
  const profile = loadProfile(PROFILE_ID);
  const base = createSignalTuningState(profile);
  const baseEvidenceKey = getSignalTuningEvidenceKey(base);
  const baseResetKey = getSignalTuningResetKey(base);

  const edits: Array<{
    label: string;
    field: keyof Pick<
      SignalTuningState,
      'maxTxPowerDbm' | 'maxGainDbi' | 'ueAntennaMaxGainDbi' | 'bandwidthMHz' | 'noisePsdDbmHz'
    >;
    value: number;
    assertApplied: (tuned: ReturnType<typeof applySignalTuning>, value: number) => void;
  }> = [
    {
      label: 'P_t',
      field: 'maxTxPowerDbm',
      value: base.maxTxPowerDbm + 1,
      assertApplied: (tuned, value) => assert.equal(tuned.channel.maxTxPowerDbm, value),
    },
    {
      label: 'G_{t,max}',
      field: 'maxGainDbi',
      value: base.maxGainDbi + 1,
      assertApplied: (tuned, value) => assert.equal(tuned.antenna.maxGainDbi, value),
    },
    {
      label: 'G^R',
      field: 'ueAntennaMaxGainDbi',
      value: base.ueAntennaMaxGainDbi + 1,
      assertApplied: (tuned, value) => assert.equal(tuned.ueAntenna.maxGainDbi, value),
    },
    {
      label: 'B',
      field: 'bandwidthMHz',
      value: base.bandwidthMHz + 5,
      assertApplied: (tuned, value) => assert.equal(tuned.channel.bandwidthMHz, value),
    },
    {
      label: 'N_0',
      field: 'noisePsdDbmHz',
      value: base.noisePsdDbmHz + 0.5,
      assertApplied: (tuned, value) => assert.equal(tuned.channel.noisePsdDbmHz, value),
    },
  ];

  for (const edit of edits) {
    const next = { ...base, [edit.field]: edit.value };
    const tuned = applySignalTuning(profile, next);
    edit.assertApplied(tuned, edit.value);
    assert.equal(hasSignalTuningOverrides(profile, next), true, `${edit.label} edit must create a signal tuning override`);
    assert.notEqual(
      getSignalTuningEvidenceKey(next),
      baseEvidenceKey,
      `${edit.label} edit must mark formula evidence stale through the same evidence key path`,
    );
    assert.equal(
      getSignalTuningResetKey(next),
      baseResetKey,
      `${edit.label} edit must not enter the structural reset key`,
    );
  }

  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assertContains(appSource, 'setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next))');
  assertContains(appSource, 'isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}');
}

function run(): void {
  assertUiSeparation();
  assertTuningWiringAndEvidencePath();

  console.log('Phase 9B P_t / sigma^2 formula-side UI separation validation passed.');
  console.log(JSON.stringify({
    asserted: {
      ui: [
        'P_t renders under Transmit Power / numerator',
        'G_{t,max} renders under Transmit Gain',
        'G^R renders under its own Receiver Gain / numerator tab',
        'B, N_0, and read-only computed sigma^2 / noise floor render under Thermal Noise / denominator',
        'the old combined P_t / sigma^2 Power tab label is removed',
      ],
      wiring: [
        'P_t, G_{t,max}, G^R, B, and N_0 still map to the same tuning/profile fields',
        'each affected scalar edit changes the same signal tuning evidence key',
        'affected scalar edits do not enter the structural reset key',
      ],
    },
  }, null, 2));
}

run();
