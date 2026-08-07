import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertContainsTestId,
  assertNoTestId,
  assertNotContainsTestId,
  assertTestId,
  assertTestIdOrder,
  openingTagOfTestId,
} from './lib/dom-structure.ts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms } from '../src/scene/types.ts';
import { createSceneTopologyState } from '../src/sceneTopology.ts';
import { createSceneVisualScaleState } from '../src/sceneVisualScale.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
import { DEFAULT_ENERGY_TUNING } from '../src/teaching/energyModel.ts';
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

function renderPanel(initialActiveTab: 'signal-power' | 'loss' = 'signal-power') {
  const profile = loadProfile(PROFILE_ID);
  const markup = renderToStaticMarkup(
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
    />,
  );

  return { markup, text: decodeHtmlText(markup) };
}

/**
 * The demotion this gate protects is an ORDERING fact: the editable control is
 * the primary action and the explanatory context is the footnote below it, and
 * the old coverage/assumptions audit surface is gone from the primary flow
 * entirely. Both are asserted through test-id document order and test-id
 * absence — not through the English headings that used to proxy for them.
 */
function assertCoverageSummaryIsRemovedFromPrimaryFlow(): void {
  const { markup, text } = renderPanel('signal-power');

  assertTestIdOrder(markup, [
    'sinr-formula-tabs',
    'signal-power-controls',
    'pt-signal-power-control',
    'signal-power-controls-formula-context',
  ], 'primary SINR tuning flow');

  assertNoTestId(markup, 'sinr-coverage-assumptions-disclosure', 'primary tuning flow');
  assertNoTestId(markup, 'sinr-coverage-audit', 'primary tuning flow');
  // Negative copy bans: these do not force any particular language into the DOM,
  // so they stay as a belt-and-braces check that the retired surface has not
  // simply been re-titled.
  assertNotContains(text, 'Coverage audit');
  assertNotContains(text, 'Coverage / assumptions');
}

/** A `<details>` that must be open on arrival, not folded away behind a click. */
function assertOpenByDefault(markup: string, testId: string): void {
  const openTag = openingTagOfTestId(markup, testId);
  assert.ok(
    /^<details\b/.test(openTag) && / open(=|\s|>)/.test(openTag),
    `expected "${testId}" to render as a <details> that is open by default; opening tag was ${openTag}`,
  );
}

function assertEssentialContextRemainsInline(): void {
  const signal = renderPanel('signal-power');

  // G^R stays discoverable as its own tab rather than being folded into P_t.
  const tabStrip = openingTagOfTestId(signal.markup, 'sinr-formula-tabs');
  assert.ok(tabStrip.length > 0, 'expected the SINR formula tab strip to render');
  assertTestId(signal.markup, 'sinr-formula-tabs');
  assert.ok(
    signal.markup.includes('id="sinr-formula-tab-receiver-gain"'),
    'expected G^R to remain reachable as its own tab, not folded into the P_t group',
  );
  assertNotContainsTestId(signal.markup, 'signal-power-controls', 'gr-receiver-gain-control');

  // Context is present and expanded on arrival, BELOW the primary editable control.
  assertOpenByDefault(signal.markup, 'active-tab-formula-context');
  assertOpenByDefault(signal.markup, 'sinr-overview-disclosure');
  assertTestIdOrder(signal.markup, [
    'pt-signal-power-control',
    'active-tab-formula-context',
    'sinr-overview-disclosure',
  ], 'signal-power tab');

  // The parameter card keeps its own first-use context next to the slider: the
  // explanation hook, the "what changes if I move it" hook, and the range.
  assertContainsTestId(signal.markup, 'pt-signal-power-control', 'pt-signal-power-control-details');
  assertContainsTestId(signal.markup, 'pt-signal-power-control', 'pt-signal-power-control-effect');
  assertContainsTestId(signal.markup, 'pt-signal-power-control', 'pt-signal-power-control-range-endpoints');

  assertNotContains(signal.text, 'HOBS paper parameter table');
  assertNotContains(signal.text, 'Research Override / teaching control');

  // Path-loss sensitivity controls stay visible in the Loss group: the per-term
  // path-loss cards keep their own switch, range and detail hooks, and the
  // sensitivity group renders as its own section beneath them (it carries the
  // TR 38.811 help affordance, and gains an editable clutter control only in the
  // TR 38.811 profile — so its PRESENCE, not its contents, is the invariant here).
  const loss = renderPanel('loss');
  assertTestIdOrder(loss.markup, ['loss-formula-controls', 'loss-sensitivity-controls'], 'loss tab');
  for (const term of ['fspl', 'atmospheric', 'scintillation', 'shadow-fading']) {
    assertContainsTestId(loss.markup, 'loss-formula-controls', `path-loss-term-${term}`, 'loss tab');
    assertContainsTestId(loss.markup, `path-loss-term-${term}`, `path-loss-term-${term}-switch`, 'loss tab');
    assertContainsTestId(loss.markup, `path-loss-term-${term}`, `path-loss-term-${term}-range-meta`, 'loss tab');
    assertContainsTestId(loss.markup, `path-loss-term-${term}`, `path-loss-term-${term}-details`, 'loss tab');
  }
  assertContainsTestId(loss.markup, 'loss-sensitivity-controls', 'help-popover-trigger-section.tr38811', 'loss tab');
}

function assertSourceDoesNotKeepOldAuditSurface(): void {
  const source = readFileSync(new URL('../src/ui/SignalTuningPanel.tsx', import.meta.url), 'utf8');
  assertNotContains(source, 'function CoverageAudit');
  assertNotContains(source, 'sinr-coverage-audit');
  assertNotContains(source, 'function CoverageAssumptionsDisclosure');
  assertNotContains(source, 'sinr-coverage-assumptions-disclosure');
}

function run(): void {
  assertSourceDoesNotKeepOldAuditSurface();
  assertCoverageSummaryIsRemovedFromPrimaryFlow();
  assertEssentialContextRemainsInline();

  console.log('Phase 9H coverage audit primary-flow removal validation passed.');
  console.log(JSON.stringify({
    asserted: {
      placement: [
        'old sinr-coverage-audit test id is gone',
        'coverage / assumptions no longer remains as a separate disclosure in the primary SINR tuning flow',
        'editable parameter cards appear before section-level formula context',
        'parameter cards keep first-use formula context inline next to the slider, value, and range',
        'active-tab formula notes and SINR overview are expanded by default below the primary controls',
      ],
      preserved: [
        'G^R remains discoverable as a separate Receiver Gain control',
        'path-loss sensitivity controls remain visible in the Loss control group',
        'transmit-power effect and dynamic-power-control caveat remain visible without opening a details disclosure',
      ],
    },
  }, null, 2));
}

run();
