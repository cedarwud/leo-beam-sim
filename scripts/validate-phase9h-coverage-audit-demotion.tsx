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

function assertCoverageSummaryIsDemoted(): void {
  const { markup, text } = renderPanel('signal-power');
  const tabIndex = markup.indexOf('data-testid="sinr-formula-tabs"');
  const controlsIndex = markup.indexOf('data-testid="signal-power-controls"');
  const disclosureIndex = markup.indexOf('data-testid="sinr-coverage-assumptions-disclosure"');

  assert.ok(tabIndex >= 0, 'expected SINR formula tabs to render');
  assert.ok(controlsIndex > tabIndex, 'expected active formula controls after tabs');
  assert.ok(disclosureIndex > controlsIndex, 'expected coverage / assumptions after primary formula controls');
  assertNotContains(markup, 'data-testid="sinr-coverage-audit"');
  assertNotContains(text, 'Coverage audit');

  const disclosure = extractElementByTestId(markup, 'sinr-coverage-assumptions-disclosure');
  const openingTag = disclosure.match(/^<details[^>]*>/)?.[0] ?? '';
  assertContains(openingTag, 'data-demotion="collapsed"');
  assertContains(openingTag, 'data-readonly="true"');
  assertContains(openingTag, 'data-prominence="low"');
  assertNotContains(openingTag, ' open');
  assertContains(disclosure, 'data-testid="sinr-coverage-assumptions-summary"');
  assertContains(decodeHtmlText(disclosure), 'Coverage / assumptions');
  assertNotContains(disclosure, '<input');
  assertNotContains(disclosure, '<select');
  assertNotContains(disclosure, 'type="range"');
}

function assertCaveatsRemainDiscoverable(): void {
  const signal = renderPanel('signal-power');
  assertContains(signal.text, 'Receiver Gain');
  assertContains(signal.text, 'Coverage / assumptions');
  assertContains(signal.text, 'G R is controlled separately as receiver gain');
  assertContains(signal.text, 'TR 38.811 environment stays read-only');
  assertContains(signal.text, 'antenna efficiency remains future-only');
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
  assertContains(source, 'function CoverageAssumptionsDisclosure');
  assertContains(source, 'sinr-coverage-assumptions-disclosure');
}

function run(): void {
  assertSourceDoesNotKeepOldAuditSurface();
  assertCoverageSummaryIsDemoted();
  assertCaveatsRemainDiscoverable();

  console.log('Phase 9H coverage audit demotion validation passed.');
  console.log(JSON.stringify({
    asserted: {
      placement: [
        'old sinr-coverage-audit test id is gone',
        'coverage / assumptions facts are retained only behind a collapsed low-emphasis disclosure',
        'the disclosure renders after the active formula controls and has no editable inputs',
      ],
      preserved: [
        'G^R remains discoverable as a separate Receiver Gain control',
        'path-loss Research Override caveat remains visible in the Loss control group',
        'fixed TR 38.811 environment and antenna-efficiency assumptions remain discoverable as read-only assumptions',
      ],
    },
  }, null, 2));
}

run();
