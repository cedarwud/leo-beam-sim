import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  assertContainsTestId,
  assertNoTestId,
  assertNotContainsTestId,
  assertTestIdAttr,
  decodeHtmlText,
  extractElementByTestId,
} from './lib/dom-structure.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms } from '../src/scene/types.ts';
import { createSceneTopologyState } from '../src/sceneTopology.ts';
import { createSceneVisualScaleState } from '../src/sceneVisualScale.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';

const PROFILE_ID = 'hobs-2024-paper-default';

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected content not to contain "${unexpected}"`);
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

type TestTab = 'signal-power' | 'channel' | 'beam' | 'thermal-noise';

function renderPanel(
  initialActiveTab: TestTab = 'signal-power',
  initialMainTab: 'sinr' | 'power' = 'sinr',
) {
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
      initialMainTab={initialMainTab}
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      onReset={() => {}}
    />,
  );

  return { markup, text: decodeHtmlText(markup) };
}

/**
 * The formula map is the panel's claim about WHICH SIDE OF THE FRACTION each
 * term lives on, and WHO OWNS it. Both facts are already carried machine-
 * readably by `data-formula-side` and `data-term-owner`, so that is what this
 * gate reads. Pinning the English tile captions instead ("Receiver gain",
 * "Co-channel interference") only ever tested the copy — and made the copy
 * un-translatable, which is how the un-earned regression got in.
 */
function assertSimplifiedFormulaOwnership(): void {
  const signal = renderPanel('signal-power');
  assertNoTestId(signal.markup, 'sinr-formula-map', 'simplified SINR page');
  const formula = extractElementByTestId(signal.markup, 'sinr-formula-header');
  assert.match(formula, /γ<sub>u,s,v<\/sub>/);
  assert.match(formula, /<i>p<\/i><sub>u,s,v<\/sub>/);
  assert.match(formula, /H<sub>u,s,v<\/sub>/);
  assert.match(formula, /G<sup>T<\/sup>/);
  assert.match(signal.markup, /I<sub>u,s,v<\/sub>/);
  assert.match(signal.markup, /σ²/);
  assertNoTestId(signal.markup, 'signal-power-output-formula', 'runtime RF output page');
  assertNotContains(signal.markup, 'formula-map-pt');
}

/**
 * The map's ownership claim must match where the EDITABLE controls actually
 * live: a term that the map files under the numerator must not be editable from
 * a denominator control group, and vice versa.
 */
const CONTROL_GROUPS = [
  { tab: 'channel', section: 'loss-formula-controls', side: 'numerator', own: ['gr-receiver-gain-control', 'path-loss-term-fspl'] },
  { tab: 'beam', section: 'beam-gain-controls', side: 'numerator', own: ['gtmax-transmit-gain-control', 'beamwidth3db-transmit-gain-control'] },
  { tab: 'thermal-noise', section: 'thermal-noise-controls', side: 'denominator', own: ['bandwidth-thermal-noise-control', 'n0-thermal-noise-control'] },
] as const;

const ALL_TERM_CONTROLS = [
  'gr-receiver-gain-control',
  'path-loss-term-fspl',
  'gtmax-transmit-gain-control',
  'beamwidth3db-transmit-gain-control',
  'bandwidth-thermal-noise-control',
  'n0-thermal-noise-control',
] as const;

function assertControlGroupingStillSeparated(): void {
  for (const group of CONTROL_GROUPS) {
    const { markup } = renderPanel(group.tab);
    assertTestIdAttr(markup, group.section, 'data-formula-side', group.side, group.tab);
    for (const own of group.own) assertContainsTestId(markup, group.section, own, group.tab);

    for (const control of ALL_TERM_CONTROLS) {
      const belongsHere = (group.own as readonly string[]).includes(control);
      if (belongsHere) continue;
      assertNotContainsTestId(markup, group.section, control, group.tab);
    }

    // A control group never swallows the map tile of a term it does not own.
    assertNotContainsTestId(markup, group.section, 'sinr-formula-map', group.tab);
    assertNotContains(decodeHtmlText(extractElementByTestId(markup, group.section)), 'Research Override');
  }

  // The G^R control specifically is not a child of the P^o formula section.
  const signal = renderPanel('signal-power');
  assertNotContainsTestId(signal.markup, 'signal-power-controls', 'gr-receiver-gain-control');
  assert.ok(!/<input\b|<select\b|<textarea\b/.test(extractElementByTestId(signal.markup, 'signal-power-controls')));

  const power = renderPanel('signal-power', 'power');
  assertTestIdAttr(power.markup, 'walker-power-page', 'data-readonly', 'true');
  assertTestIdAttr(power.markup, 'walker-power-page', 'data-control-surface', 'derived-only');
  assertNoTestId(power.markup, 'walker-power-output-control', 'Walker derived Power page');

  // The thermal-noise page owns the two inputs; accepted-frame output remains
  // on the right rail and G^R remains absent from the denominator group.
  const noise = renderPanel('thermal-noise');
  assertContainsTestId(noise.markup, 'thermal-noise-controls', 'n0-thermal-noise-control');
  assertNotContainsTestId(noise.markup, 'thermal-noise-controls', 'gr-receiver-gain-control');
  assertNoTestId(noise.markup, 'thermal-noise-floor-readout', 'left-side input page');
}

function run(): void {
  assertSimplifiedFormulaOwnership();
  assertControlGroupingStillSeparated();

  console.log('Phase 9F simplified formula ownership / G^R placement validation passed.');
  console.log(JSON.stringify({
    asserted: {
      formulaMap: [
        'the retired P_t/H/G^T/G^R formula map is absent',
        'the visible SINR formula uses p, H, G^T, I, and sigma^2',
        'G^R is not inside the runtime p explanation section',
        'G^R is not in the denominator control group',
      ],
      preserved: [
        'each SINR group declares its formula side directly',
        'the Power main page is a derived-only formula explanation without a fake input',
        'existing thermal-noise controls remain denominator-side controls',
      ],
    },
  }, null, 2));
}

run();
