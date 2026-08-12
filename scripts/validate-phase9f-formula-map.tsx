import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  assertAttr,
  assertContainsTestId,
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

/**
 * The formula map is the panel's claim about WHICH SIDE OF THE FRACTION each
 * term lives on, and WHO OWNS it. Both facts are already carried machine-
 * readably by `data-formula-side` and `data-term-owner`, so that is what this
 * gate reads. Pinning the English tile captions instead ("Receiver gain",
 * "Co-channel interference") only ever tested the copy — and made the copy
 * un-translatable, which is how the un-earned regression got in.
 */
const NUMERATOR_CHAIN = ['transmit-power', 'path-gain-loss', 'transmit-gain', 'receiver-gain'] as const;
const DENOMINATOR_TERMS = ['interference', 'thermal-noise'] as const;

function assertFormulaMapOwnership(): void {
  const signal = renderPanel('signal-power');
  const map = extractElementByTestId(signal.markup, 'sinr-formula-map', 'signal-power tab');

  const numerator = extractElementByTestId(map, 'formula-map-numerator');
  assertTestIdAttr(map, 'formula-map-numerator', 'data-formula-side', 'numerator');
  assertContainsTestId(map, 'formula-map-numerator', 'formula-map-pt');
  assertContainsTestId(map, 'formula-map-numerator', 'formula-map-hl');
  assertContainsTestId(map, 'formula-map-numerator', 'formula-map-gt');
  assertContainsTestId(map, 'formula-map-numerator', 'formula-map-gr');

  // The signal path is an ORDERED chain P_t -> H/L -> G^T -> G^R. Asserting the
  // sequence of term owners replaces the old pin on the rendered notation string
  // and is strictly stronger: it fails on a reordering the notation pin allowed.
  assert.deepEqual(
    attrValuesIn(numerator, 'data-term-owner'),
    [...NUMERATOR_CHAIN],
    'numerator map must present the full signal chain, in signal-path order',
  );
  // Every numerator tile declares the numerator side on its own element, so a
  // tile cannot be visually filed under the numerator while claiming otherwise.
  for (const tile of ['formula-map-pt', 'formula-map-hl', 'formula-map-gt', 'formula-map-gr']) {
    assertTestIdAttr(numerator, tile, 'data-formula-side', 'numerator');
  }

  const denominator = extractElementByTestId(map, 'formula-map-denominator');
  assertTestIdAttr(map, 'formula-map-denominator', 'data-formula-side', 'denominator');
  assertContainsTestId(map, 'formula-map-denominator', 'formula-map-interference');
  assertContainsTestId(map, 'formula-map-denominator', 'formula-map-sigma');
  assert.deepEqual(
    attrValuesIn(denominator, 'data-term-owner'),
    [...DENOMINATOR_TERMS],
    'denominator map must present exactly the impairment terms',
  );
  assertTestIdAttr(denominator, 'formula-map-interference', 'data-formula-side', 'denominator');
  assertTestIdAttr(denominator, 'formula-map-sigma', 'data-formula-side', 'denominator');

  // G^R is a NUMERATOR term. It must not appear on the impairment side at all —
  // neither as a tile nor as an owner claim.
  assertNotContainsTestId(map, 'formula-map-denominator', 'formula-map-gr');
  assertNoAttr(denominator, 'data-term-owner', 'receiver-gain', 'denominator map');
  assertNotContains(decodeHtmlText(denominator), 'Research Override');

  // G^R is an INDEPENDENT numerator tile: it owns receiver gain, and it is not
  // nested inside (i.e. presented as a sub-property of) P_t or G^T.
  assertTestIdAttr(numerator, 'formula-map-gr', 'data-term-owner', 'receiver-gain');
  const grTile = extractElementByTestId(numerator, 'formula-map-gr');
  assertNotContains(decodeHtmlText(grTile), 'Research Override');
  for (const sibling of ['formula-map-pt', 'formula-map-gt', 'formula-map-hl']) {
    assertNotContainsTestId(numerator, sibling, 'formula-map-gr');
    assertNoAttr(
      extractElementByTestId(numerator, sibling),
      'data-term-owner',
      'receiver-gain',
      `${sibling} tile`,
    );
  }
}

/**
 * The map's ownership claim must match where the EDITABLE controls actually
 * live: a term that the map files under the numerator must not be editable from
 * a denominator control group, and vice versa.
 */
const CONTROL_GROUPS = [
  { tab: 'signal-power', section: 'signal-power-controls', side: 'numerator', own: 'pt-signal-power-control' },
  { tab: 'beam', section: 'beam-gain-controls', side: 'numerator', own: 'gtmax-transmit-gain-control' },
  { tab: 'receiver-gain', section: 'receiver-gain-controls', side: 'numerator', own: 'gr-receiver-gain-control' },
  { tab: 'thermal-noise', section: 'thermal-noise-controls', side: 'denominator', own: 'bandwidth-thermal-noise-control' },
] as const;

const ALL_TERM_CONTROLS = [
  'pt-signal-power-control',
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

  // The G^R control specifically is not a child of the P_t control.
  const signal = renderPanel('signal-power');
  assertNotContainsTestId(signal.markup, 'pt-signal-power-control', 'gr-receiver-gain-control');

  // The thermal-noise page keeps sigma^2 as a read-only derived readout beside
  // its two editable inputs, and the denominator map there still excludes G^R.
  const noise = renderPanel('thermal-noise');
  assertContainsTestId(noise.markup, 'thermal-noise-controls', 'thermal-noise-floor-readout');
  assertContainsTestId(noise.markup, 'thermal-noise-controls', 'n0-thermal-noise-control');
  assertNotContainsTestId(noise.markup, 'formula-map-denominator', 'formula-map-gr');
  assertAttr(noise.markup, 'data-readonly', 'true', 'thermal-noise page');
}

function run(): void {
  assertFormulaMapOwnership();
  assertControlGroupingStillSeparated();

  console.log('Phase 9F formula map / G^R placement validation passed.');
  console.log(JSON.stringify({
    asserted: {
      formulaMap: [
        'numerator map presents the ordered chain transmit-power -> path-gain-loss -> transmit-gain -> receiver-gain',
        'denominator map presents exactly interference + thermal-noise, and never claims receiver-gain',
        'every map tile declares its own data-formula-side and data-term-owner',
        'G^R is not inside the P_t control group',
        'G^R is not in the denominator map',
      ],
      preserved: [
        'each control group declares the same formula side its map tile claims',
        'existing thermal-noise controls remain denominator-side controls',
      ],
    },
  }, null, 2));
}

run();
