#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms } from '../src/scene/types.ts';
import { createSceneTopologyState } from '../src/sceneTopology.ts';
import { createSceneVisualScaleState } from '../src/sceneVisualScale.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
import {
  assertContainsTestId,
  assertTestId,
} from './lib/dom-structure.ts';
import { EN, LocaleProvider, ZH_TW } from '../src/i18n/index.ts';
import type { Locale } from '../src/i18n/types.ts';
import { DEFAULT_ENERGY_TUNING } from '../src/teaching/energyModel.ts';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';
import type { TuningTabKey } from '../src/ui/signal-tuning/types.ts';

const PROFILE_ID = 'hobs-2024-tr38811-research';
const BANNED_PRIMARY_COPY = [
  'Research Override',
  'HOBS',
  'paper-backed',
  'paper table',
  'non-paper',
] as const;

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

function renderPanel(initialActiveTab: TuningTabKey, locale: Locale) {
  const profile = loadProfile(PROFILE_ID);
  const markup = renderToStaticMarkup(
    <LocaleProvider initialLocale={locale}>
    // Aligned to the CURRENT SignalTuningPanelProps: the removed legacy props
    // (currentSinrDb/formulaSource/handover-policy sextet) were never destructured
    // by the panel any more, so dropping them is render-identical; the added
    // topology/visual-scale/appMode props are unread outside the (unrendered)
    // topology tab, and FormulaTabList ignores appMode (`void appMode`).
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      topology={createSceneTopologyState()}
      sceneVisualScale={createSceneVisualScaleState()}
      appMode="sinr-experiment"
      hasOverrides={false}
      formulaBudget={createBudgetTerms()}
      initialActiveTab={initialActiveTab}
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      energyTuning={DEFAULT_ENERGY_TUNING}
      onEnergyTuningChange={() => {}}
      onReset={() => {}}
    />
    </LocaleProvider>,
  );

  return { markup, text: decodeHtmlText(markup) };
}

const LOCALES = ['zh-TW', 'en'] as const satisfies readonly Locale[];

/**
 * WHAT THIS GATE PROTECTS: provenance / paper jargon ("Research Override",
 * "HOBS", "paper-backed", ...) must not surface in a primary user workflow,
 * while the parameters themselves stay present and editable.
 *
 * The ban is a NEGATIVE copy assertion, so it never forces English into the DOM
 * and stays valid under translation — it is kept, and STRENGTHENED: it now runs
 * against every shipped locale, not just the default one. A jargon term leaking
 * into the English catalog used to be invisible to this gate.
 *
 * The old POSITIVE copy assertions ("TR 38.811 Sensitivity", "Receive-side
 * antenna gain in the SINR signal path.") existed only to prove the surface had
 * not been deleted wholesale to satisfy the ban. That is a structural claim, so
 * it is now made structurally — via the control test ids and their explanation
 * hooks — and holds in any language.
 */
function assertNoBannedPrimaryCopy(text: string, surface: string): void {
  for (const banned of BANNED_PRIMARY_COPY) {
    assertNotContains(text, banned);
  }
  console.log(`PASS: ${surface} primary text has no paper/provenance jargon`);
}

/**
 * The surface must still BE there. Asserted through test ids so the check
 * cannot be satisfied by an empty tab, and cannot be broken by translating it.
 */
function assertSurfaceStillPresent(
  markup: string,
  section: string,
  controls: readonly string[],
  surface: string,
): void {
  assertTestId(markup, section, surface);
  for (const control of controls) {
    assertContainsTestId(markup, section, control, surface);
  }
}

function validateLossCopy(): void {
  for (const locale of LOCALES) {
    const { markup, text } = renderPanel('loss', locale);
    // The TR 38.811 sensitivity group still renders, still carries its own help
    // affordance, and still exposes the editable NLoS clutter control that only
    // the TR 38.811 profile provides.
    assertSurfaceStillPresent(
      markup,
      'loss-sensitivity-controls',
      ['help-popover-trigger-section.tr38811', 'lcl-nlos-control'],
      `Loss tab (${locale})`,
    );
    assertContainsTestId(markup, 'lcl-nlos-control', 'lcl-nlos-control-details', `Loss tab (${locale})`);
    assertContainsTestId(markup, 'lcl-nlos-control', 'lcl-nlos-control-effect', `Loss tab (${locale})`);
    assertNoBannedPrimaryCopy(text, `Loss tab (${locale})`);
  }
}

function validateSignalPowerCopy(): void {
  for (const locale of LOCALES) {
    const { markup, text } = renderPanel('signal-power', locale);
    assertSurfaceStillPresent(
      markup,
      'signal-power-controls',
      ['pt-signal-power-control', 'help-popover-trigger-param.maxTxPowerDbm'],
      `Signal Power tab (${locale})`,
    );
    // G^R keeps its own tab rather than being absorbed into the P_t group.
    assert.ok(
      markup.includes('id="sinr-formula-tab-receiver-gain"'),
      `expected a separate receiver-gain tab to stay reachable (${locale})`,
    );
    assertNoBannedPrimaryCopy(text, `Signal Power tab (${locale})`);
  }
}

function validateReceiverGainCopy(): void {
  for (const locale of LOCALES) {
    const { markup, text } = renderPanel('receiver-gain', locale);
    assertSurfaceStillPresent(
      markup,
      'receiver-gain-controls',
      ['gr-receiver-gain-control', 'help-popover-trigger-param.ueAntennaMaxGainDbi'],
      `Receiver Gain tab (${locale})`,
    );
    assertContainsTestId(markup, 'gr-receiver-gain-control', 'gr-receiver-gain-control-details', `Receiver Gain tab (${locale})`);
    assertNoBannedPrimaryCopy(text, `Receiver Gain tab (${locale})`);
  }
}

/**
 * COVERAGE HOLE THIS CLOSES: the panel's explanatory copy now lives behind help
 * popovers, and a popover panel only mounts while it is open — so none of it
 * appears in server-rendered markup. A rendered-text ban therefore cannot see
 * the single largest body of user-facing prose in the panel.
 *
 * Ban the jargon at its SOURCE instead: the shipped translation catalogs. This
 * is language-neutral (it checks every locale) and catches the copy whether it
 * is rendered inline, in a tooltip, or in a popover.
 */
function assertCatalogsCarryNoProvenanceJargon(): void {
  for (const [name, dict] of [['ZH_TW', ZH_TW], ['EN', EN]] as const) {
    const entries = Object.entries(dict as Record<string, string>);
    assert.ok(entries.length > 0, `expected the ${name} catalog to be populated`);
    for (const [key, value] of entries) {
      for (const banned of BANNED_PRIMARY_COPY) {
        assert.ok(
          !value.includes(banned),
          `${name}["${key}"] must not carry provenance jargon "${banned}"; got: ${value}`,
        );
      }
    }
    console.log(`PASS: ${name} catalog (${entries.length} keys) has no paper/provenance jargon`);
  }
}

function validateSourceStillKeepsInternalGuardrails(): void {
  const sddSource = readFileSync(new URL('../docs/frontend-ux-redesign-sdd.md', import.meta.url), 'utf8');
  const contractSource = readFileSync(new URL('../docs/sinr-runtime-parameter-contract.md', import.meta.url), 'utf8');
  assertContains(sddSource, 'Do not show the following provenance terms in primary user workflows');
  assertContains(sddSource, 'Diagnostics or docs still preserve enough provenance');
  assertContains(contractSource, 'Research Override');
  assertContains(contractSource, 'not a HOBS paper-backed range');
  console.log('PASS: docs keep internal provenance guardrails outside primary UI copy');
}

validateLossCopy();
validateSignalPowerCopy();
validateReceiverGainCopy();
assertCatalogsCarryNoProvenanceJargon();
validateSourceStillKeepsInternalGuardrails();
