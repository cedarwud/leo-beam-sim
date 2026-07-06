#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { applySceneTopology, createSceneTopologyState } from '../src/sceneTopology';
import { loadProfile } from '../src/profiles';
import type { Profile } from '../src/profiles/types';
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

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function textFromMarkup(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function syntheticProfile(): Profile {
  return deepClone(loadProfile('hobs-2024-candidate-rich'));
}

const nullTopology = createSceneTopologyState();

section('(a) sceneTopology.ts source exports', () => {
  const sceneTopologySource = source('src/sceneTopology.ts');
  for (const expected of [
    'export interface SceneTopologyState',
    'export function createSceneTopologyState',
    'export function applySceneTopology',
    'export function hasSceneTopologyOverrides',
    'export function getSceneTopologyResetKey',
    'export function getSceneTopologyEvidenceKey',
    'export const SCENE_TOPOLOGY_OVERRIDES_KEY',
  ]) {
    check(sceneTopologySource.includes(expected), `sceneTopology.ts contains ${expected}`);
  }
});

section('(b) applySceneTopology behavior', () => {
  const profile = syntheticProfile();
  const before = deepClone(profile);
  // Spread the src-owned all-null state so the fixture tracks the current
  // SceneTopologyState shape; null is the canonical "no override" for every field.
  const applied = applySceneTopology(profile, {
    ...nullTopology,
    satsPerPlane: 6,
  });

  check(applied !== profile, 'satsPerPlane override returns a new profile object');
  check(applied.orbit.shells[0]?.satsPerPlane === 6, 'shells[0].satsPerPlane is overridden to 6');
  check(
    deepEqual(
      { ...applied.orbit.shells[0], satsPerPlane: profile.orbit.shells[0]?.satsPerPlane },
      profile.orbit.shells[0],
    ),
    'all other shells[0] fields are unchanged',
  );
  check(deepEqual(applied.orbit.shells.slice(1), profile.orbit.shells.slice(1)), 'shells[1..] unchanged for multi-shell profile');
  check(deepEqual(profile, before), 'input profile is not mutated');

  const noOverride = applySceneTopology(profile, nullTopology);
  check(noOverride !== profile, 'null topology still returns a referentially different profile');
  check(deepEqual(noOverride.orbit.shells[0], profile.orbit.shells[0]), 'null satsPerPlane leaves shells[0] shape equal');

  const beamOverride = applySceneTopology(profile, {
    ...nullTopology,
    beamCountPerSatellite: 19,
  });
  check(beamOverride.beams.perSatellite === 19, 'beamCountPerSatellite overrides beams.perSatellite to 19');
  check(beamOverride.beams.maxActivePerSat === 19, 'beamCountPerSatellite overrides beams.maxActivePerSat to 19');
});

section('(c) App.tsx source wiring', () => {
  const appSource = source('src/App.tsx');
  const appPersistenceSource = source('src/app/appPersistence.ts');
  check(appSource.includes('applySceneTopology(applySignalTuning('), 'App.tsx composes applySceneTopology(applySignalTuning(...))');
  check(appSource.includes('getSceneTopologyResetKey('), 'App.tsx joins getSceneTopologyResetKey into reset chain');
  check(appPersistenceSource.includes('SCENE_TOPOLOGY_OVERRIDES_KEY'), 'appPersistence.ts uses SCENE_TOPOLOGY_OVERRIDES_KEY');
  check(appSource.includes('appMode={appMode}'), 'App.tsx passes appMode into SignalTuningPanel');
  check(
    appSource.includes("appMode === 'sinr-experiment' ? sceneTopology : createSceneTopologyState()"),
    'App.tsx gates topology overlay on appMode',
  );
});

section('(d) SignalTuningPanel.tsx source wiring', () => {
  const panelSource = source('src/ui/SignalTuningPanel.tsx');
  check(panelSource.includes('appMode: AppExperienceMode'), 'SignalTuningPanel accepts appMode prop');
  check(panelSource.includes('appMode={appMode}'), 'SignalTuningPanel forwards appMode to FormulaTabList');
  check(panelSource.includes("<TopologyTab"), 'SignalTuningPanel mounts TopologyTab');
  check(panelSource.includes("activeTab === 'topology'"), 'SignalTuningPanel renders TopologyTab for topology activeTab');
});

section('(e) FormulaTabList.tsx app-mode gate', () => {
  const tabListSource = source('src/ui/signal-tuning/FormulaTabList.tsx');
  check(
    tabListSource.includes("tab.key !== 'topology' || appMode === 'sinr-experiment'"),
    "FormulaTabList gates topology tab on appMode === 'sinr-experiment'",
  );
});

section('(f) TopologyTab.tsx source testids and banner', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');
  for (const expected of [
    'data-testid="topology-tab-sat-count-slider"',
    'data-testid="topology-tab-restart-banner"',
    'data-testid="topology-tab-clear-override"',
    'data-testid="topology-tab-effective-value"',
    'Adjusting sat count restarts the simulation',
  ]) {
    check(topologyTabSource.includes(expected), `TopologyTab.tsx contains ${expected}`);
  }
});

section('(g) SINR runtime contract amendment', () => {
  const contractSource = source('docs/sinr-runtime-parameter-contract.md');
  check(contractSource.includes('Topology Overrides (Phase E)'), 'contract contains Topology Overrides (Phase E) subsection');
  check(contractSource.includes('Simulation Setting'), 'contract contains Simulation Setting gating phrase');
});

section('(h) TopologyTab SSR behavior', () => {
  const baseProfile = syntheticProfile();
  const noop = () => undefined;
  const baseMarkup = renderToString(
    <TopologyTab
      topology={nullTopology}
      baseProfile={baseProfile}
      onTopologyChange={noop}
      onReset={noop}
    />,
  );
  const overrideMarkup = renderToString(
    <TopologyTab
      topology={{ ...nullTopology, satsPerPlane: 6 }}
      baseProfile={baseProfile}
      onTopologyChange={noop}
      onReset={noop}
    />,
  );

  for (const markup of [baseMarkup, overrideMarkup]) {
    check(markup.includes('data-testid="topology-tab-sat-count-slider"'), 'SSR markup contains sat-count slider testid');
    check(markup.includes('data-testid="topology-tab-restart-banner"'), 'SSR markup contains restart banner testid');
    check(markup.includes('data-testid="topology-tab-clear-override"'), 'SSR markup contains clear override testid');
    check(markup.includes('data-testid="topology-tab-effective-value"'), 'SSR markup contains effective value testid');
  }
  const baseText = textFromMarkup(baseMarkup);
  const overrideText = textFromMarkup(overrideMarkup);
  check(baseText.includes('Effective sat count:'), 'SSR base render includes effective sat-count readout');
  check(
    /Effective sat count:\s*6\s*\(\s*override\s*\)/.test(overrideText),
    'SSR override render includes override readout',
  );
  check(baseText !== overrideText, 'SSR effective value text differs between base and override renders');
});

console.log('\n---');
console.log(`[validate-phase-e-sat-count-override] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
