import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  assertContainsTestId,
  assertNoTestId,
  assertNotContainsTestId,
  assertTestId,
  assertTestIdAttr,
  assertValueInTestId,
  extractElementByTestId,
} from './lib/dom-structure.ts';
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

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected content to contain "${expected}"`);
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
  initialActiveTab: TestTab,
  isFormulaEvidenceStale = false,
  initialMainTab: 'sinr' | 'power' = 'sinr',
) {
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
      initialMainTab={initialMainTab}
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      onReset={() => {}}
    />,
  );

  return { markup };
}

/**
 * Structural identity of each tuning group.
 *
 * WHAT THIS PROTECTS: every scalar of the SINR expression must render in exactly
 * one tab, on the correct side of the fraction, and must never bleed into another
 * term's control group. That is a PLACEMENT invariant, so it is asserted through
 * placement (`data-formula-side` + test-id containment) rather than through the
 * English headings that used to stand in for it. Headings are copy; copy is now
 * bilingual and student-facing, and a gate that pins copy silently becomes a gate
 * against translating the UI.
 */
const TUNING_GROUPS = {
  signalPower: {
    tab: 'signal-power',
    section: 'signal-power-controls',
    side: 'numerator',
    ownControls: [],
    ownFormulaRows: ['signal-power-output-formula'],
    foreignControls: ['gtmax-transmit-gain-control', 'gr-receiver-gain-control', 'bandwidth-thermal-noise-control', 'n0-thermal-noise-control'],
    helpTriggers: [],
  },
  beam: {
    tab: 'beam',
    section: 'beam-gain-controls',
    side: 'numerator',
    ownControls: ['gtmax-transmit-gain-control'],
    ownFormulaRows: [],
    foreignControls: ['walker-power-output-control', 'gr-receiver-gain-control', 'bandwidth-thermal-noise-control', 'n0-thermal-noise-control'],
    helpTriggers: ['help-popover-trigger-param.maxGainDbi'],
  },
  receiverGain: {
    tab: 'receiver-gain',
    section: 'receiver-gain-controls',
    side: 'numerator',
    ownControls: ['gr-receiver-gain-control'],
    ownFormulaRows: [],
    foreignControls: ['walker-power-output-control', 'gtmax-transmit-gain-control', 'bandwidth-thermal-noise-control', 'n0-thermal-noise-control'],
    helpTriggers: ['help-popover-trigger-param.ueAntennaMaxGainDbi'],
  },
  thermalNoise: {
    tab: 'thermal-noise',
    section: 'thermal-noise-controls',
    side: 'denominator',
    ownControls: ['bandwidth-thermal-noise-control', 'n0-thermal-noise-control'],
    ownFormulaRows: [],
    foreignControls: ['walker-power-output-control', 'gtmax-transmit-gain-control', 'gr-receiver-gain-control'],
    helpTriggers: ['help-popover-trigger-param.bandwidthMHz', 'help-popover-trigger-param.noisePsdDbmHz'],
  },
} as const;

type TuningGroup = (typeof TUNING_GROUPS)[keyof typeof TUNING_GROUPS];

function assertGroupStructure(group: TuningGroup): string {
  const { markup } = renderPanel(group.tab);
  const where = `${group.section} tab`;

  // The group sits on the correct side of the SINR fraction. This is the
  // machine-readable form of the old "Transmit Power / numerator" heading pin.
  assertTestIdAttr(markup, group.section, 'data-formula-side', group.side, where);

  for (const control of group.ownControls) {
    assertContainsTestId(markup, group.section, control, where);
    // Every editable scalar keeps an attached explanation hook. The COPY inside
    // it is free to be localized or moved behind the help popover; the hook is
    // the contract, so "a slider with no explanation at all" still fails.
    assertContainsTestId(markup, control, `${control}-details`, where);
    // …and it keeps its own range affordance, so the editable bound stays visible.
    assertContainsTestId(markup, control, `${control}-range-endpoints`, where);
  }

  for (const formulaRow of group.ownFormulaRows) {
    assertContainsTestId(markup, group.section, formulaRow, where);
  }

  // Term bleed: no other term's control may render inside this group, and no
  // other term's control may render anywhere on this tab page.
  for (const foreign of group.foreignControls) {
    assertNotContainsTestId(markup, group.section, foreign, where);
    assertNoTestId(markup, foreign, `${where} (whole page)`);
  }

  // The group states its own formula context (the section header block), rather
  // than borrowing the neighbouring group's.
  assertContainsTestId(markup, group.section, `${group.section}-formula-context`, where);

  // The parameter identity is asserted through the help-popover id, which names
  // the tuning FIELD (`param.<field>`) — locale-independent and unambiguous.
  for (const helpTrigger of group.helpTriggers) {
    assertContainsTestId(markup, group.section, helpTrigger, where);
  }

  return markup;
}

function assertUiSeparation(): void {
  // The retired combined "Power" tab: asserted against the RENDERED tab strip
  // rather than against a source-literal in one file, so moving the tab table to
  // another module can no longer make this pass vacuously.
  const { markup: tabStripPage } = renderPanel('signal-power');
  const tabStrip = extractElementByTestId(tabStripPage, 'sinr-formula-tabs');
  assert.ok(
    !/id="sinr-formula-tab-power"/.test(tabStrip),
    'expected the retired combined P_t / sigma^2 "power" tab to be gone from the tab strip',
  );
  for (const group of Object.values(TUNING_GROUPS)) {
    assert.ok(
      tabStrip.includes(`id="sinr-formula-tab-${group.tab}"`),
      `expected a dedicated "${group.tab}" tab in the formula tab strip`,
    );
  }

  for (const group of Object.values(TUNING_GROUPS)) {
    assertGroupStructure(group);
  }

  // P^o is presented in the SINR numerator, while its one real Walker control
  // lives on the Power main page so the formula term is not duplicated as a
  // fake read-only p^r slider.
  const powerPage = renderPanel('signal-power', false, 'power');
  assertContainsTestId(powerPage.markup, 'walker-power-page', 'walker-power-output-control');
  assertContainsTestId(powerPage.markup, 'walker-power-output-control', 'walker-power-output-control-details');
  assertContainsTestId(powerPage.markup, 'walker-power-output-control', 'walker-power-output-control-range-endpoints');
  assertContainsTestId(powerPage.markup, 'walker-power-output-control', 'help-popover-trigger-param.maxTxPowerDbm');

  // Thermal-noise extras: sigma^2 is a READ-ONLY derived readout, not a fourth
  // editable knob, and it reports its own evidence freshness.
  const noise = renderPanel('thermal-noise');
  assertContainsTestId(noise.markup, 'thermal-noise-controls', 'thermal-noise-floor-readout');
  assertTestIdAttr(noise.markup, 'thermal-noise-floor-readout', 'data-readonly', 'true');
  assertTestIdAttr(noise.markup, 'thermal-noise-floor-readout', 'data-formula-evidence-status', 'current');
  // The computed noise floor still shows the value it was handed. Numbers and
  // unit symbols survive translation, so pinning them stays honest.
  assertValueInTestId(noise.markup, 'thermal-noise-floor-readout', '-104.2 dBm');

  const staleNoise = renderPanel('thermal-noise', true);
  assertTestId(staleNoise.markup, 'thermal-noise-floor-readout');
  assertTestIdAttr(staleNoise.markup, 'thermal-noise-floor-readout', 'data-formula-evidence-status', 'stale');
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

  console.log('Phase 9B P^o / sigma^2 formula-side UI separation validation passed.');
  console.log(JSON.stringify({
    asserted: {
      ui: [
        'each SINR group declares its own data-formula-side (P^o / G^T / G^R numerator, B + N_0 denominator)',
        'the P^o term is formula-only in SINR and the actual RF slider is owned by the Power main page',
        'each editable scalar renders inside its own group, with its -details and -range-endpoints hooks',
        'no term control leaks into another term group, or onto another term tab at all',
        'sigma^2 renders as a data-readonly="true" derived readout carrying its evidence status',
        'the retired combined "power" tab is gone from the rendered tab strip',
      ],
      wiring: [
        'P^o, G_{t,max}, G^R, B, and N_0 still map to the same tuning/profile fields',
        'each affected scalar edit changes the same signal tuning evidence key',
        'affected scalar edits do not enter the structural reset key',
      ],
    },
  }, null, 2));
}

run();
