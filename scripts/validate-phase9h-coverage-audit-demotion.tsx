import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHandoverPolicyTuningState } from '../src/handoverPolicyTuning.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms, SignalSourceState } from '../src/scene/types.ts';
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

function createFormulaSource(): SignalSourceState {
  return {
    satId: 'sat-a',
    beamId: 1,
    sinrDb: 12.5,
    elevationDeg: 55,
    rangeKm: 900,
    status: 'live',
  };
}

function renderPanel(initialActiveTab: 'signal-power' | 'loss' = 'signal-power') {
  const profile = loadProfile(PROFILE_ID);
  const markup = renderToStaticMarkup(
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      hasOverrides={false}
      currentSinrDb={12.5}
      formulaBudget={createBudgetTerms()}
      formulaSource={createFormulaSource()}
      initialActiveTab={initialActiveTab}
      handoverDraft={createHandoverPolicyTuningState(profile)}
      appliedHandoverPolicy={createHandoverPolicyTuningState(profile)}
      hasHandoverDraftChanges={false}
      hasHandoverOverrides={false}
      onTuningChange={() => {}}
      onReset={() => {}}
      onHandoverDraftChange={() => {}}
      onApplyHandoverPolicy={() => {}}
      onResetHandoverPolicy={() => {}}
    />,
  );

  return { markup, text: decodeHtmlText(markup) };
}

function assertCoverageSummaryIsRemovedFromPrimaryFlow(): void {
  const { markup, text } = renderPanel('signal-power');
  const tabIndex = markup.indexOf('data-testid="sinr-formula-tabs"');
  const controlsIndex = markup.indexOf('data-testid="signal-power-controls"');
  const ptControlIndex = markup.indexOf('data-testid="pt-signal-power-control"');
  const formulaContextIndex = markup.indexOf('data-testid="signal-power-controls-formula-context"');
  const disclosureIndex = markup.indexOf('data-testid="sinr-coverage-assumptions-disclosure"');

  assert.ok(tabIndex >= 0, 'expected SINR formula tabs to render');
  assert.ok(controlsIndex > tabIndex, 'expected active formula controls after tabs');
  assert.ok(ptControlIndex > controlsIndex, 'expected editable P_t control as the first content inside the signal-power section');
  assert.ok(formulaContextIndex > ptControlIndex, 'expected section formula context after the editable P_t control');
  assert.equal(disclosureIndex, -1, 'coverage / assumptions should not remain as a separate disclosure in the primary tuning flow');
  assertNotContains(markup, 'data-testid="sinr-coverage-audit"');
  assertNotContains(text, 'Coverage audit');
  assertNotContains(text, 'Coverage / assumptions');
}

function assertEssentialContextRemainsInline(): void {
  const signal = renderPanel('signal-power');
  const ptControlIndex = signal.markup.indexOf('data-testid="pt-signal-power-control"');
  const activeNotesIndex = signal.markup.indexOf('data-testid="active-tab-formula-context"');
  const overviewIndex = signal.markup.indexOf('data-testid="sinr-overview-disclosure"');

  assertContains(signal.text, 'Receiver Gain');
  assertContains(signal.markup, '<details open="" data-testid="sinr-overview-disclosure"');
  assertContains(signal.markup, '<details open="" data-testid="active-tab-formula-context"');
  assert.ok(activeNotesIndex > ptControlIndex, 'expected active-tab notes after the primary editable control');
  assert.ok(overviewIndex > activeNotesIndex, 'expected SINR overview below active-tab notes');
  assertContains(signal.text, 'SINR overview');
  assertContains(signal.text, 'Formula / notes');
  assertContains(signal.text, 'P t starts the desired-signal numerator');
  assertContains(signal.text, 'This tab controls transmit power only. Receiver gain has its own tab.');
  assertContains(signal.text, 'Base transmit power before dynamic power control overrides.');
  assertContains(signal.text, 'Raising it strengthens both the serving beam and any co-channel interferers.');
  assertContains(signal.markup, 'data-testid="pt-signal-power-control-range-endpoints"');
  assertNotContains(signal.text, 'HOBS paper parameter table');
  assertNotContains(signal.text, 'Research Override / teaching control');

  const loss = renderPanel('loss');
  assertContains(loss.markup, 'data-testid="loss-research-override"');
  assertContains(loss.text, 'Teaching / sensitivity controls for simulator constants');
  assertContains(loss.text, 'not HOBS paper-backed parameter ranges');
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
        'path-loss Research Override caveat remains visible in the Loss control group',
        'transmit-power effect and dynamic-power-control caveat remain visible without opening a details disclosure',
      ],
    },
  }, null, 2));
}

run();
