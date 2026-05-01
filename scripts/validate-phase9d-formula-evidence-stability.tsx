import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHandoverPolicyTuningState } from '../src/handoverPolicyTuning.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms, SignalSourceState } from '../src/scene/types.ts';
import { createSignalTuningState, type SignalTuningState } from '../src/signalTuning.ts';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';

const PROFILE_ID = 'hobs-2024-paper-default';
const EXPECTED_TERMS = [
  'signalDbm',
  'effectiveTxPower',
  'transmitGain',
  'receiverGain',
  'pathLoss',
  'scanLoss',
  'intraInterference',
  'interInterference',
  'noiseDbm',
  'denominator',
] as const;

type EvidenceStatus = 'current' | 'stale' | 'waiting';

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

function createCurrentFormulaSource(): SignalSourceState {
  return {
    satId: 'sat-a',
    beamId: 1,
    sinrDb: 12.5,
    elevationDeg: 55,
    rangeKm: 900,
    status: 'live',
  };
}

function createWaitingFormulaSource(): SignalSourceState {
  return {
    satId: null,
    beamId: null,
    sinrDb: null,
    elevationDeg: null,
    rangeKm: null,
    status: 'none',
  };
}

function createEditedTuning(base: SignalTuningState): SignalTuningState {
  return {
    ...base,
    maxTxPowerDbm: base.maxTxPowerDbm + 1,
    bandwidthMHz: base.bandwidthMHz + 5,
  };
}

function renderPanel({
  formulaBudget,
  formulaSource,
  isFormulaEvidenceStale = false,
  editedTuning = false,
}: {
  formulaBudget: LinkBudgetTerms | null;
  formulaSource: SignalSourceState;
  isFormulaEvidenceStale?: boolean;
  editedTuning?: boolean;
}) {
  const profile = loadProfile(PROFILE_ID);
  const baseTuning = createSignalTuningState(profile);
  const tuning = editedTuning ? createEditedTuning(baseTuning) : baseTuning;
  const markup = renderToStaticMarkup(
    <SignalTuningPanel
      baseProfile={profile}
      tuning={tuning}
      hasOverrides={editedTuning}
      currentSinrDb={formulaSource.sinrDb ?? -Infinity}
      formulaBudget={formulaBudget}
      formulaSource={formulaSource}
      isFormulaEvidenceStale={isFormulaEvidenceStale}
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

function extractTermOrder(markup: string): string[] {
  return [...markup.matchAll(/data-term="([^"]+)"/g)].map(match => match[1]);
}

function extractTermTag(markup: string, term: string): string {
  const match = markup.match(new RegExp(`<div data-term="${term}"[^>]*>`));
  assert.ok(match, `expected term cell for ${term}`);
  return match[0];
}

function assertStableEvidenceShell(markup: string, status: EvidenceStatus): void {
  assertContains(markup, 'data-testid="formula-term-evidence"');
  assertContains(markup, 'data-testid="formula-term-grid"');
  assertContains(markup, `data-formula-evidence-status="${status}"`);
  assert.deepEqual(extractTermOrder(markup), [...EXPECTED_TERMS]);

  for (const term of EXPECTED_TERMS) {
    assertContains(extractTermTag(markup, term), `data-formula-evidence-status="${status}"`);
  }
}

function run(): void {
  const current = renderPanel({
    formulaBudget: createBudgetTerms(),
    formulaSource: createCurrentFormulaSource(),
  });
  assertStableEvidenceShell(current.markup, 'current');
  assertContains(current.text, 'Current computeLinkBudget term values for the selected formula source.');
  assertContains(current.text, 'numerator / signalDbm');
  assertContains(current.text, 'effective transmit power');
  assertContains(current.text, 'transmit gain pattern');
  assertContains(current.text, 'receiver gain');
  assertContains(current.text, 'path loss');
  assertContains(current.text, 'scan loss');
  assertContains(current.text, 'intra interference');
  assertContains(current.text, 'inter interference');
  assertContains(current.text, 'noise σ² / noiseDbm');
  assertContains(current.text, 'denominator');
  assertContains(current.text, '-88.5 dBm');
  assertContains(current.text, '50.5 dBm');
  assertContains(current.text, '5.6 dB');
  assertContains(current.text, '2.5 dBi');
  assertContains(current.text, '151.8 dB');
  assertContains(current.text, '1.2 dB');
  assertContains(current.text, '-113.2 dBm');
  assertContains(current.text, '-110.7 dBm');
  assertContains(current.text, '-104.2 dBm');
  assertContains(current.text, '-103.1 dBm');

  const stale = renderPanel({
    formulaBudget: createBudgetTerms(),
    formulaSource: createCurrentFormulaSource(),
    isFormulaEvidenceStale: true,
    editedTuning: true,
  });
  assertStableEvidenceShell(stale.markup, 'stale');
  assertContains(stale.text, 'Formula evidence is stale after a runtime edit');
  assertContains(stale.text, '-88.5 dBm stale');
  assertContains(stale.text, 'last-known stale');
  assertNotContains(stale.markup, 'data-formula-evidence-status="current"');
  assertNotContains(stale.text, 'Current computeLinkBudget term values');

  const waiting = renderPanel({
    formulaBudget: null,
    formulaSource: createWaitingFormulaSource(),
    editedTuning: true,
  });
  assertStableEvidenceShell(waiting.markup, 'waiting');
  assertContains(waiting.text, 'No selected formula source yet');
  assertContains(waiting.text, 'Waiting for a selected formula source');
  assert.equal((waiting.text.match(/\bwaiting\b/g) ?? []).length >= EXPECTED_TERMS.length, true);
  assertNotContains(waiting.markup, 'data-formula-evidence-status="current"');
  assertNotContains(waiting.text, 'Current computeLinkBudget term values');

  console.log('Phase 9D formula term evidence stability validation passed.');
  console.log(JSON.stringify({
    asserted: {
      states: [
        'formula-term-evidence shell remains mounted for current, stale, and waiting states',
        'all three states keep the same ten conceptual formula term cells',
        'stale runtime edits preserve the grid and label last-known values as stale',
        'waiting/no-source evidence preserves the grid with per-term waiting placeholders',
        'current evidence still renders real LinkBudgetTerms produced by computeLinkBudget',
      ],
      terms: EXPECTED_TERMS,
    },
  }, null, 2));
}

run();
