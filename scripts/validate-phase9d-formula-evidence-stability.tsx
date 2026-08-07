import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import { createInitialSimState } from '../src/scene/initialSimState.ts';
import type { LinkBudgetTerms, SignalSourceState, SimState } from '../src/scene/types.ts';
import {
  assertAttrCount,
  assertValueInAttrElement,
} from './lib/dom-structure.ts';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';

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

function renderPanel({
  formulaBudget,
  formulaSource,
  isFormulaEvidenceStale = false,
}: {
  formulaBudget: LinkBudgetTerms | null;
  formulaSource: SignalSourceState;
  isFormulaEvidenceStale?: boolean;
}) {
  const profile = loadProfile(PROFILE_ID);
  const state = createPanelState(profile, formulaSource, formulaBudget);
  const markup = renderToStaticMarkup(
    <InfoPanel
      {...state}
      showFormulaTerms
      profile={profile}
      isFormulaEvidenceStale={isFormulaEvidenceStale}
    />,
  );

  return { markup, text: decodeHtmlText(markup) };
}

function createPanelState(
  profile: Profile,
  formulaSource: SignalSourceState,
  formulaBudget: LinkBudgetTerms | null,
): SimState {
  const base = createInitialSimState(profile);
  const hasFormulaSource = formulaSource.satId !== null && formulaSource.beamId !== null;

  return {
    ...base,
    physicalServing: formulaSource,
    panelPrimary: {
      ...formulaSource,
      role: hasFormulaSource ? 'serving' : 'none',
    },
    servingSatId: formulaSource.satId,
    servingBeamId: formulaSource.beamId,
    servingElevationDeg: formulaSource.elevationDeg,
    servingRangeKm: formulaSource.rangeKm,
    sinrDb: formulaSource.sinrDb ?? -Infinity,
    physicalServingBudget: formulaBudget,
    servingBudget: formulaBudget,
    servingBeamActiveThisSlot: hasFormulaSource,
  };
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

/**
 * Every term cell must show ITS OWN value, in its own cell.
 *
 * The old gate asserted these numbers against the whole panel's text, alongside
 * the English `hiddenLabel` of each cell ("numerator / signalDbm", "receiver
 * gain", ...). Both were weak proxies: the labels only proved English copy was
 * present, and a page-wide value search would happily pass if two cells swapped
 * their numbers. Binding the value to `data-term` proves the real invariant, and
 * a translated label cannot break it.
 */
const EXPECTED_TERM_VALUES: ReadonlyArray<readonly [term: string, value: string]> = [
  ['signalDbm', '-88.5 dBm'],
  ['effectiveTxPower', '50.5 dBm'],
  ['transmitGain', '5.6 dB'],
  ['receiverGain', '2.5 dBi'],
  ['pathLoss', '151.8 dB'],
  ['scanLoss', '1.2 dB'],
  ['intraInterference', '-113.2 dBm'],
  ['interInterference', '-110.7 dBm'],
  ['noiseDbm', '-104.2 dBm'],
  ['denominator', '-103.1 dBm'],
];

function run(): void {
  const current = renderPanel({
    formulaBudget: createBudgetTerms(),
    formulaSource: createCurrentFormulaSource(),
  });
  assertStableEvidenceShell(current.markup, 'current');
  for (const [term, value] of EXPECTED_TERM_VALUES) {
    assertValueInAttrElement(current.markup, 'data-term', term, value, 'current evidence');
  }

  const stale = renderPanel({
    formulaBudget: createBudgetTerms(),
    formulaSource: createCurrentFormulaSource(),
    isFormulaEvidenceStale: true,
  });
  assertStableEvidenceShell(stale.markup, 'stale');
  // Stale evidence keeps the LAST-KNOWN number in the same cell — it does not
  // blank the grid — and every cell declares itself stale rather than current.
  for (const [term, value] of EXPECTED_TERM_VALUES) {
    assertValueInAttrElement(stale.markup, 'data-term', term, value, 'stale evidence');
  }
  assertNotContains(stale.markup, 'data-formula-evidence-status="current"');

  const waiting = renderPanel({
    formulaBudget: null,
    formulaSource: createWaitingFormulaSource(),
  });
  assertStableEvidenceShell(waiting.markup, 'waiting');
  assertNotContains(waiting.markup, 'data-formula-evidence-status="current"');
  // Every one of the ten cells is individually in the waiting state (plus the
  // grid, the evidence block and the card that wrap them).
  assertAttrCount(
    waiting.markup,
    'data-formula-evidence-status',
    'waiting',
    EXPECTED_TERMS.length + 3,
    'waiting evidence',
  );
  // …and none of them is showing a stale number it no longer has a source for.
  for (const [, value] of EXPECTED_TERM_VALUES) {
    assertNotContains(waiting.text, value);
  }

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
