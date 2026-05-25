#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  applySceneTopology,
  createSceneTopologyState,
  getSceneTopologyResetKey,
} from '../src/sceneTopology';
import { loadProfile } from '../src/profiles';
import { TopologyTab } from '../src/ui/signal-tuning/TopologyTab';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed += 1;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed += 1;
}

function check(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    pass(label);
  } else {
    fail(label, detail);
  }
}

function section(label: string, fn: () => void): void {
  console.log(`\n${label}`);
  try {
    fn();
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

function textFromMarkup(markup: string): string {
  return markup
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderTopologyTab(ueCount: number | null, appMode: 'sinr-experiment' | 'modqn-demo'): string {
  const noop = () => undefined;
  return renderToString(
    <TopologyTab
      topology={{ ...createSceneTopologyState(), ueCount }}
      baseProfile={loadProfile('hobs-2024-candidate-rich')}
      appMode={appMode}
      onTopologyChange={noop}
      onReset={noop}
    />,
  );
}

const newUeCountTestIds = [
  'topology-tab-ue-count-slider',
  'topology-tab-ue-count-effective-value',
  'topology-tab-ue-count-reset',
] as const;

const priorTopologyTestIds = [
  'topology-tab-sat-count-slider',
  'topology-tab-restart-banner',
  'topology-tab-clear-override',
  'topology-tab-effective-value',
  'topology-tab-beam-count-radio',
  'topology-tab-beam-count-option-7',
  'topology-tab-beam-count-option-19',
  'topology-tab-beam-count-option-37',
  'topology-tab-beam-count-clear-override',
  'topology-tab-beam-count-effective-value',
  'topology-tab-scene-scale-radio',
  'topology-tab-scene-scale-option-paper-faithful',
  'topology-tab-scene-scale-option-demo-readability',
  'topology-tab-scene-scale-reset',
  'topology-tab-scene-scale-effective-value',
  'topology-tab-ue-marker-slider',
  'topology-tab-ue-marker-effective-value',
  'topology-tab-ue-marker-reset',
] as const;

section('(a) TopologyTab.tsx UE-count source contract', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');

  for (const testId of newUeCountTestIds) {
    check(
      countOccurrences(topologyTabSource, `data-testid="${testId}"`) === 1,
      `TopologyTab.tsx contains ${testId} data-testid exactly once`,
    );
  }

  for (const testId of priorTopologyTestIds) {
    check(
      countOccurrences(topologyTabSource, testId) === 1,
      `TopologyTab.tsx preserves prior testid ${testId}`,
    );
  }
});

section('(b) UE-count slider range source contract', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');
  const sliderBlock = /data-testid="topology-tab-ue-count-slider"[\s\S]*?onChange=\{\(event\) => onTopologyChange/.exec(topologyTabSource)?.[0] ?? '';

  check(sliderBlock.includes('type="range"'), 'UE-count control uses a range input');
  check(sliderBlock.includes('min={40}') || sliderBlock.includes('min="40"'), 'UE-count slider min is 40');
  check(sliderBlock.includes('max={200}') || sliderBlock.includes('max="200"'), 'UE-count slider max is 200');
  check(sliderBlock.includes('step={1}') || sliderBlock.includes('step="1"'), 'UE-count slider step is 1');
});

section('(c) UE-count restart banner copy', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');
  check(
    topologyTabSource.includes('Adjusting UE count restarts the simulation'),
    'TopologyTab.tsx contains UE-count restart banner copy',
  );
});

section('(d) TopologyTab app-mode gate via SSR', () => {
  const sinrMarkup = renderTopologyTab(null, 'sinr-experiment');
  const modqnMarkup = renderTopologyTab(null, 'modqn-demo');
  const signalTuningPanelSource = source('src/ui/SignalTuningPanel.tsx');

  for (const testId of newUeCountTestIds) {
    check(sinrMarkup.includes(`data-testid="${testId}"`), `sinr-experiment SSR renders ${testId}`);
    check(!modqnMarkup.includes(`data-testid="${testId}"`), `modqn-demo SSR omits ${testId}`);
  }
  check(
    signalTuningPanelSource.includes('appMode={appMode}'),
    'SignalTuningPanel forwards appMode into TopologyTab',
  );
});

section('(e) applySceneTopology + reset-key UE-count regression', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const baseTopology = createSceneTopologyState();
  const ueOverrideTopology = { ...baseTopology, ueCount: 100 };
  const baseApplied = applySceneTopology(profile, baseTopology);
  const overrideApplied = applySceneTopology(profile, ueOverrideTopology);
  const baseKey = getSceneTopologyResetKey(baseTopology);
  const overrideKey = getSceneTopologyResetKey(ueOverrideTopology);

  check(baseApplied !== profile, 'base topology still returns a derived profile object');
  check(
    JSON.stringify(baseApplied) === JSON.stringify(overrideApplied),
    'ueCount overlay does not mutate the Profile shape',
  );
  check(baseKey !== overrideKey, 'reset keys differ when only ueCount changes');
  check(overrideKey.split('|').includes('100'), 'ueCount override is joined into the reset key');
});

section('(f) SINR runtime parameter contract amendment', () => {
  const contractSource = source('docs/sinr-runtime-parameter-contract.md');
  check(contractSource.includes('### UE Count (Phase F)'), 'contract contains UE Count (Phase F) subsection');
  check(contractSource.includes('Phase E DEFERRED'), 'contract contains Phase E DEFERRED phrase');
});

section('(g) TopologyTab SSR UE-count effective-value behavior', () => {
  const defaultMarkup = renderTopologyTab(null, 'sinr-experiment');
  const overrideMarkup = renderTopologyTab(150, 'sinr-experiment');
  const defaultText = textFromMarkup(defaultMarkup);
  const overrideText = textFromMarkup(overrideMarkup);

  check(
    defaultMarkup.includes('data-testid="topology-tab-ue-count-effective-value"'),
    'SSR default render contains UE-count effective-value testid',
  );
  check(
    /Effective UE count:\s*100\s*\(\s*default\s*\)/.test(defaultText),
    'SSR null ueCount renders default effective UE-count readout',
    defaultText,
  );
  check(
    /Effective UE count:\s*150\s*\(\s*override\s*\)/.test(overrideText),
    'SSR override ueCount renders override effective UE-count readout',
    overrideText,
  );
});

section('(h) modqn-demo UE-count bypass behavior', () => {
  const modqnMarkup = renderTopologyTab(150, 'modqn-demo');
  const modqnText = textFromMarkup(modqnMarkup);

  for (const testId of newUeCountTestIds) {
    check(!modqnMarkup.includes(`data-testid="${testId}"`), `modqn-demo bypass omits ${testId}`);
  }
  check(!modqnText.includes('UE count'), 'modqn-demo bypass omits UE-count section text');
});

console.log('\n---');
console.log(`[validate-phase-f-ue-count-slider] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
