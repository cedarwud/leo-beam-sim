#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createSceneTopologyState } from '../src/sceneTopology';
import type { UeMobilityMode } from '../src/engine/ue/multiUeMobility';
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

function renderTopologyTab(
  ueMobilityMode: UeMobilityMode | null,
  appMode: 'sinr-experiment' | 'modqn-demo',
): string {
  const noop = () => undefined;
  return renderToString(
    <TopologyTab
      topology={{ ...createSceneTopologyState(), ueMobilityMode }}
      baseProfile={loadProfile('hobs-2024-candidate-rich')}
      appMode={appMode}
      onTopologyChange={noop}
      onReset={noop}
    />,
  );
}

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
  'topology-tab-ue-count-slider',
  'topology-tab-ue-count-effective-value',
  'topology-tab-ue-count-reset',
  'topology-tab-ue-distribution-radio',
  'topology-tab-ue-distribution-option-random',
  'topology-tab-ue-distribution-option-grid',
  'topology-tab-ue-distribution-option-clustered',
  'topology-tab-ue-distribution-reset',
] as const;

const mobilityModes: readonly UeMobilityMode[] = ['static', 'random-walk', 'waypoints', 'manhattan'];

const mobilityTestIds = [
  'topology-tab-ue-mobility-radio',
  'topology-tab-ue-mobility-option-static',
  'topology-tab-ue-mobility-option-random-walk',
  'topology-tab-ue-mobility-option-waypoints',
  'topology-tab-ue-mobility-option-manhattan',
  'topology-tab-ue-mobility-reset',
  'topology-tab-ue-mobility-speed',
  'topology-tab-ue-mobility-waypoint-count',
  'topology-tab-ue-mobility-grid-spacing',
] as const;

const optionTestIds: Record<UeMobilityMode, string> = {
  static: 'topology-tab-ue-mobility-option-static',
  'random-walk': 'topology-tab-ue-mobility-option-random-walk',
  waypoints: 'topology-tab-ue-mobility-option-waypoints',
  manhattan: 'topology-tab-ue-mobility-option-manhattan',
};

section('(a) TopologyTab source grep', () => {
  const topologySource = source('src/ui/signal-tuning/TopologyTab.tsx');
  for (const testId of priorTopologyTestIds) {
    check(topologySource.includes(testId), `TopologyTab.tsx preserves prior testid ${testId}`);
  }
  for (const testId of mobilityTestIds) {
    check(topologySource.includes(testId), `TopologyTab.tsx contains mobility testid ${testId}`);
  }
  check(
    countOccurrences(topologySource, 'topology-tab-') >= 37,
    'TopologyTab.tsx preserves prior topology-tab testid string literals after UE trail toggle',
  );
  check(
    topologySource.includes("topology.ueMobilityMode ?? 'static'"),
    'TopologyTab uses static as the null mobility default',
  );
  check(
    topologySource.includes('onTopologyChange({ ...topology, ueMobilityMode: null, ueMobilityParams: null })'),
    'TopologyTab reset button clears ueMobilityMode and ueMobilityParams to null',
  );
});

section('(b) Radio renders 4 options with correct labels', () => {
  const markup = renderTopologyTab(null, 'sinr-experiment');
  const text = textFromMarkup(markup);
  check(markup.includes('data-testid="topology-tab-ue-mobility-radio"'), 'SSR renders UE mobility radio fieldset');
  check(text.includes('UE mobility'), 'SSR renders UE mobility section title');
  for (const mode of mobilityModes) {
    check(markup.includes(`data-testid="${optionTestIds[mode]}"`), `SSR renders ${mode} option testid`);
    check(text.includes(mode), `SSR renders ${mode} option label`);
  }
});

section('(c) Banner text grep', () => {
  const topologySource = source('src/ui/signal-tuning/TopologyTab.tsx');
  const markup = renderTopologyTab(null, 'sinr-experiment');
  const text = textFromMarkup(markup);
  check(
    topologySource.includes('Changing UE mobility restarts the simulation.'),
    'TopologyTab source contains UE mobility restart banner text',
  );
  check(text.includes('Changing UE mobility restarts the simulation.'), 'SSR renders UE mobility restart banner text');
});

section('(d) modqn-demo bypass SSR', () => {
  const markup = renderTopologyTab('manhattan', 'modqn-demo');
  const text = textFromMarkup(markup);
  for (const testId of mobilityTestIds) {
    check(!markup.includes(`data-testid="${testId}"`), `modqn-demo SSR omits ${testId}`);
  }
  check(!text.includes('UE mobility'), 'modqn-demo SSR omits UE mobility section title');
  check(!text.includes('Changing UE mobility restarts the simulation.'), 'modqn-demo SSR omits UE mobility restart banner');
});

section('(e) Contract md grep', () => {
  const contractSource = source('docs/sinr-runtime-parameter-contract.md');
  for (const expected of [
    '### UE Mobility (Phase G)',
    'Phase G activates per-tick UE position update so secondary UEs move',
    'Selector lives in the Topology tab as a `Simulation Setting`',
    '`static` (default; zero-drift with Phase F)',
    '`random-walk` (uniform direction per tick, fixed speed)',
    '`waypoints` (per-UE circular waypoint tour)',
    '`manhattan` (axis-aligned grid streets)',
    'Replay artifacts continue to consume producer-baked positions',
    'Primary UE remains static for backward compat with',
  ]) {
    check(contractSource.includes(expected), `contract contains ${expected}`);
  }
  check(
    contractSource.indexOf('### UE Count (Phase F)') < contractSource.indexOf('### UE Mobility (Phase G)'),
    'UE Mobility subsection appears after UE Count subsection',
  );
});

section('(f) SSR active mobility option per mode', () => {
  for (const mode of mobilityModes) {
    const markup = renderTopologyTab(mode, 'sinr-experiment');
    for (const testId of mobilityTestIds.slice(0, 6)) {
      check(markup.includes(`data-testid="${testId}"`), `${mode} SSR renders ${testId}`);
    }
    check(
      new RegExp(`data-testid="${optionTestIds[mode]}"[^>]*checked=""`).test(markup),
      `SSR marks ${mode} mobility option active`,
    );
  }
});

console.log('\n---');
console.log(`[validate-phase-g-ue-mobility-ui] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
