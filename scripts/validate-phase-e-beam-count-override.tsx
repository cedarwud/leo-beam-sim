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

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

function syntheticProfile(beamCount = 7): Profile {
  const profile = deepClone(loadProfile('hobs-2024-candidate-rich'));
  return {
    ...profile,
    beams: {
      ...profile.beams,
      perSatellite: beamCount,
      maxActivePerSat: beamCount,
    },
  };
}

const nullTopology = createSceneTopologyState();

section('(a) TopologyTab.tsx beam-count source contract', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');
  check(
    countOccurrences(topologyTabSource, 'data-testid="topology-tab-beam-count-radio"') === 1,
    'TopologyTab.tsx contains beam-count radio testid exactly once',
  );
  for (const expected of [
    'topology-tab-beam-count-option-7',
    'topology-tab-beam-count-option-19',
    'topology-tab-beam-count-option-37',
    'data-testid="topology-tab-beam-count-clear-override"',
    'data-testid="topology-tab-beam-count-effective-value"',
  ]) {
    check(topologyTabSource.includes(expected), `TopologyTab.tsx contains ${expected}`);
  }
});

section('(b) applySceneTopology beam-count behavior', () => {
  const profile = syntheticProfile(7);
  const before = deepClone(profile);
  const applied = applySceneTopology(profile, {
    satsPerPlane: null,
    beamCountPerSatellite: 19,
    ueCount: null,
  });

  check(applied !== profile, 'beam-count override returns a new profile object');
  check(applied.beams !== profile.beams, 'beam-count override returns a new beams object');
  check(applied.beams.perSatellite === 19, 'beam-count override sets beams.perSatellite to 19');
  check(applied.beams.maxActivePerSat === 19, 'beam-count override sets beams.maxActivePerSat to 19');
  check(applied.beams.frequencyReuse === profile.beams.frequencyReuse, 'beam-count override preserves beams.frequencyReuse');

  const noOverride = applySceneTopology(profile, nullTopology);
  check(noOverride !== profile, 'null beam-count topology returns a referentially different profile');
  check(deepEqual(noOverride.beams, profile.beams), 'null beam-count topology leaves beams shape equal');

  const sameValueOverride = applySceneTopology(profile, {
    satsPerPlane: null,
    beamCountPerSatellite: 7,
    ueCount: null,
  });
  check(sameValueOverride !== profile, 'same-value beam-count override still returns a new profile object');
  check(sameValueOverride.beams.perSatellite === 7, 'same-value beam-count override keeps perSatellite at 7');
  check(sameValueOverride.beams.maxActivePerSat === 7, 'same-value beam-count override keeps maxActivePerSat at 7');
  check(deepEqual(profile, before), 'input profile is not mutated');
});

section('(c) reset key includes beam-count override', () => {
  const baseKey = getSceneTopologyResetKey({
    satsPerPlane: null,
    beamCountPerSatellite: null,
    ueCount: null,
  });
  const beamKey = getSceneTopologyResetKey({
    satsPerPlane: null,
    beamCountPerSatellite: 19,
    ueCount: null,
  });
  check(baseKey !== beamKey, 'reset keys differ when only beamCountPerSatellite changes');
});

section('(d) TopologyTab SSR beam-count behavior', () => {
  const baseProfile = syntheticProfile(7);
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
      topology={{ ...nullTopology, beamCountPerSatellite: 19 }}
      baseProfile={baseProfile}
      onTopologyChange={noop}
      onReset={noop}
    />,
  );

  for (const expected of [
    'data-testid="topology-tab-beam-count-radio"',
    'data-testid="topology-tab-beam-count-option-7"',
    'data-testid="topology-tab-beam-count-option-19"',
    'data-testid="topology-tab-beam-count-option-37"',
  ]) {
    check(baseMarkup.includes(expected), `SSR base markup contains ${expected}`);
  }

  const baseText = textFromMarkup(baseMarkup);
  const overrideText = textFromMarkup(overrideMarkup);
  check(
    /Effective beam count per sat:\s*7\s*\(\s*base profile\s*\)/.test(baseText),
    'SSR base render includes base-profile beam-count readout',
  );
  check(
    /Effective beam count per sat:\s*19\s*\(\s*override\s*\)/.test(overrideText),
    'SSR override render includes override beam-count readout',
  );
  check(
    /data-testid="topology-tab-beam-count-option-7"[^>]*checked=""/.test(baseMarkup),
    'SSR base render marks 7-beam radio active when base profile is 7',
  );
  check(
    /data-testid="topology-tab-beam-count-option-19"[^>]*checked=""/.test(overrideMarkup),
    'SSR override render marks 19-beam radio active when override is 19',
  );
  check(
    !/data-testid="topology-tab-beam-count[^"]*"[^>]*type="number"/.test(baseMarkup),
    'SSR beam-count controls do not render a freeform numeric input',
  );
});

section('(e) PR-pi sat-count testids remain present', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');
  for (const expected of [
    'data-testid="topology-tab-sat-count-slider"',
    'data-testid="topology-tab-restart-banner"',
    'data-testid="topology-tab-clear-override"',
    'data-testid="topology-tab-effective-value"',
  ]) {
    check(topologyTabSource.includes(expected), `TopologyTab.tsx still contains ${expected}`);
  }
});

section('(f) restart banner regression', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');
  check(
    topologyTabSource.includes('data-testid="topology-tab-restart-banner"'),
    'TopologyTab.tsx still contains restart banner testid',
  );
  check(
    topologyTabSource.includes('restarts the simulation'),
    'TopologyTab.tsx restart banner still contains "restarts the simulation"',
  );
});

console.log('\n---');
console.log(`[validate-phase-e-beam-count-override] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
