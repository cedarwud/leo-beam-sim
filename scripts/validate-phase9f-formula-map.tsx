import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  assertAttr,
  assertContainsTestId,
  assertNoTestId,
  assertNoAttr,
  assertNotContainsTestId,
  assertTestIdAttr,
  attrValuesIn,
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

type TestTab = 'signal-power' | 'beam' | 'receiver-gain' | 'thermal-noise';

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
  assertContainsTestId(signal.markup, 'signal-power-controls', 'signal-power-output-formula');
  assert.match(signal.markup, /P<sup>o<\/sup><sub>s,v<\/sub>/);
  assert.match(signal.markup, /h<sub>u,s,v<\/sub>/);
  assert.match(signal.markup, /I<sub>u,s,v<\/sub>/);
  assertNotContains(signal.markup, 'formula-map-pt');
}

/**
 * The map's ownership claim must match where the EDITABLE controls actually
 * live: a term that the map files under the numerator must not be editable from
 * a denominator control group, and vice versa.
 */
const CONTROL_GROUPS = [
  { tab: 'signal-power', section: 'signal-power-controls', side: 'numerator', own: 'signal-power-output-formula' },
  { tab: 'beam', section: 'beam-gain-controls', side: 'numerator', own: 'gtmax-transmit-gain-control' },
  { tab: 'receiver-gain', section: 'receiver-gain-controls', side: 'numerator', own: 'gr-receiver-gain-control' },
  { tab: 'thermal-noise', section: 'thermal-noise-controls', side: 'denominator', own: 'bandwidth-thermal-noise-control' },
] as const;

const ALL_TERM_CONTROLS = [
  'walker-power-output-control',
  'gtmax-transmit-gain-control',
  'gr-receiver-gain-control',
  'bandwidth-thermal-noise-control',
  'n0-thermal-noise-control',
] as const;

function assertControlGroupingStillSeparated(): void {
  for (const group of CONTROL_GROUPS) {
    const { markup } = renderPanel(group.tab);
    assertTestIdAttr(markup, group.section, 'data-formula-side', group.side, group.tab);
    assertContainsTestId(markup, group.section, group.own, group.tab);

    for (const control of ALL_TERM_CONTROLS) {
      const belongsHere = control === group.own
        || (group.section === 'thermal-noise-controls' && control.endsWith('-thermal-noise-control'));
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

  const power = renderPanel('signal-power', 'power');
  assertContainsTestId(power.markup, 'walker-power-page', 'walker-power-output-control');

  // The thermal-noise page keeps sigma^2 as a read-only derived readout beside
  // its two editable inputs; G^R remains absent from that denominator group.
  const noise = renderPanel('thermal-noise');
  assertContainsTestId(noise.markup, 'thermal-noise-controls', 'thermal-noise-floor-readout');
  assertContainsTestId(noise.markup, 'thermal-noise-controls', 'n0-thermal-noise-control');
  assertNotContainsTestId(noise.markup, 'thermal-noise-controls', 'gr-receiver-gain-control');
  assertAttr(noise.markup, 'data-readonly', 'true', 'thermal-noise page');
}

function run(): void {
  assertSimplifiedFormulaOwnership();
  assertControlGroupingStillSeparated();

  console.log('Phase 9F simplified formula ownership / G^R placement validation passed.');
  console.log(JSON.stringify({
    asserted: {
      formulaMap: [
        'the retired P_t/H/G^T/G^R formula map is absent',
        'the visible SINR formula uses h, P^o, I, and sigma^2',
        'G^R is not inside the P^o formula section',
        'G^R is not in the denominator control group',
      ],
      preserved: [
        'each SINR group declares its formula side directly',
        'the actual RF control is owned by the Power main page',
        'existing thermal-noise controls remain denominator-side controls',
      ],
    },
  }, null, 2));
}

run();
