#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHandoverPolicyTuningState } from '../src/handoverPolicyTuning.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms, SignalSourceState } from '../src/scene/types.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
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

function renderPanel(initialActiveTab: TuningTabKey) {
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

function assertNoBannedPrimaryCopy(text: string, surface: string): void {
  for (const banned of BANNED_PRIMARY_COPY) {
    assertNotContains(text, banned);
  }
  console.log(`PASS: ${surface} primary text has no paper/provenance jargon`);
}

function validateLossCopy(): void {
  const { markup, text } = renderPanel('loss');
  assertContains(markup, 'data-testid="loss-sensitivity-controls"');
  assertContains(text, 'TR 38.811 Sensitivity');
  assertContains(text, 'Advanced sensitivity controls for simulator constants');
  assertContains(text, 'TR 38.811 NLoS clutter sensitivity control for seeded NLoS samples only.');
  assertContains(text, 'Editable in the TR 38.811 profile');
  assertContains(text, 'TR 38.811 sensitivity profile');
  assertContains(text, 'TR 38.811 path-loss model');
  assertContains(text, 'Seeded LoS samples do not change.');
  assertNoBannedPrimaryCopy(text, 'Loss tab');
}

function validateSignalPowerCopy(): void {
  const { text } = renderPanel('signal-power');
  assertContains(text, 'Receiver Gain');
  assertContains(text, 'This tab controls transmit power only. Receiver gain has its own tab.');
  assertNoBannedPrimaryCopy(text, 'Signal Power tab');
}

function validateReceiverGainCopy(): void {
  const { text } = renderPanel('receiver-gain');
  assertContains(text, 'Receiver gain');
  assertContains(text, 'Receive-side antenna gain in the SINR signal path.');
  assertNoBannedPrimaryCopy(text, 'Receiver Gain tab');
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
validateSourceStillKeepsInternalGuardrails();
