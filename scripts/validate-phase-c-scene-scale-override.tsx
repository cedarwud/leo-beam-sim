#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  createSceneVisualScaleState,
  getSceneVisualScaleEvidenceKey,
  getSceneVisualScaleResetKey,
  hasSceneVisualScaleOverrides,
  resolveSceneVisualScaleMultipliers,
} from '../src/sceneVisualScale';
import { createSceneTopologyState } from '../src/sceneTopology';
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

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

section('(a) sceneVisualScale.ts source exports', () => {
  const sceneVisualScaleSource = source('src/sceneVisualScale.ts');
  for (const expected of [
    'export type SceneScale',
    'export interface SceneVisualScaleState',
    'export interface SceneVisualScaleMultipliers',
    'export const DEFAULT_SCENE_VISUAL_SCALE_STATE',
    'export const SCENE_VISUAL_SCALE_OVERRIDES_KEY',
    'export function createSceneVisualScaleState',
    'export function resolveSceneVisualScaleMultipliers',
    'export function hasSceneVisualScaleOverrides',
    'export function getSceneVisualScaleResetKey',
    'export function getSceneVisualScaleEvidenceKey',
  ]) {
    check(sceneVisualScaleSource.includes(expected), `sceneVisualScale.ts contains ${expected}`);
  }
});

section('(b) sceneVisualScale behavior', () => {
  check(
    sameJson(
      resolveSceneVisualScaleMultipliers({ sceneScale: 'paper-faithful', ueMarkerScale: 1.0 }),
      { beamFootprintMultiplier: 1.0, ueMarkerMultiplier: 1.0 },
    ),
    'paper-faithful resolves to 1.0 beam + 1.0 UE multipliers',
  );
  check(
    sameJson(
      resolveSceneVisualScaleMultipliers({ sceneScale: 'demo-readability', ueMarkerScale: 1.0 }),
      { beamFootprintMultiplier: 1.6, ueMarkerMultiplier: 1.0 },
    ),
    'demo-readability resolves to 1.6 beam + 1.0 UE multipliers',
  );
  check(
    sameJson(
      resolveSceneVisualScaleMultipliers({ sceneScale: 'paper-faithful', ueMarkerScale: 2.5 }),
      { beamFootprintMultiplier: 1.0, ueMarkerMultiplier: 2.5 },
    ),
    'ueMarkerScale passes through independently',
  );

  const defaultState = createSceneVisualScaleState();
  const demoState = { ...defaultState, sceneScale: 'demo-readability' as const };
  check(!hasSceneVisualScaleOverrides(defaultState), 'default scene visual scale has no overrides');
  check(hasSceneVisualScaleOverrides(demoState), 'non-default scene visual scale has overrides');
  check(
    getSceneVisualScaleResetKey(defaultState) !== getSceneVisualScaleResetKey(demoState),
    'reset key differs when sceneScale changes',
  );
  check(
    getSceneVisualScaleEvidenceKey(defaultState) !== getSceneVisualScaleEvidenceKey(demoState),
    'evidence key differs when sceneScale changes',
  );
});

section('(c) App.tsx source wiring', () => {
  const appSource = source('src/App.tsx');
  const appPersistenceSource = source('src/app/appPersistence.ts');
  check(
    appPersistenceSource.includes('SCENE_VISUAL_SCALE_OVERRIDES_KEY'),
    'appPersistence.ts contains SCENE_VISUAL_SCALE_OVERRIDES_KEY',
  );
  for (const expected of [
    'resolveSceneVisualScaleMultipliers(',
    'setSceneVisualScale',
    'visualScaleMultipliers={',
    'sceneVisualScale={',
  ]) {
    check(appSource.includes(expected), `App.tsx contains ${expected}`);
  }
});

section('(d) useBeamViz.ts multiplier threading', () => {
  const useBeamVizSource = source('src/scene/useBeamViz.ts');
  check(
    useBeamVizSource.includes('visualScaleMultipliers?: SceneVisualScaleMultipliers'),
    'useBeamViz accepts visualScaleMultipliers optional parameter',
  );
  check(
    useBeamVizSource.includes('?? 1.0'),
    'useBeamViz has default-1.0 fallback',
  );
  check(
    useBeamVizSource.includes('fallbackFootprintRadiusWorld = 350 * alpha * beamFootprintMultiplier'),
    'useBeamViz applies beamFootprintMultiplier to fallback footprint radius',
  );
  check(
    countOccurrences(useBeamVizSource, 'fallbackFootprintRadiusWorld') >= 3,
    'useBeamViz threads scaled fallback footprint radius through shell layout helpers',
  );
});

section('(e) runtimeFrameStep.ts multiplier threading', () => {
  const runtimeFrameStepSource = source('src/scene/runtimeFrameStep.ts');
  check(
    runtimeFrameStepSource.includes('beamFootprintMultiplier?: number'),
    'runtimeFrameStep input declares optional beamFootprintMultiplier',
  );
  check(
    runtimeFrameStepSource.includes('?? 1.0'),
    'runtimeFrameStep has default-1.0 fallback',
  );
  check(
    countOccurrences(runtimeFrameStepSource, 'FOOTPRINT_RADIUS_WORLD * beamFootprintMultiplier') === 1,
    'runtimeFrameStep applies beamFootprintMultiplier at 1 consumer site',
  );
});

section('(f) replay path negative assertion', () => {
  const replaySource = source('src/showcase/showcaseArtifactToScene.ts');
  check(
    !replaySource.includes('beamFootprintMultiplier'),
    'showcaseArtifactToScene.ts does not reference beamFootprintMultiplier',
  );
});

section('(g) MainScene.tsx source wiring', () => {
  const mainSceneSource = source('src/scene/MainScene.tsx');
  check(mainSceneSource.includes('visualScaleMultipliers: SceneVisualScaleMultipliers'), 'MainScene accepts visualScaleMultipliers prop');
  check(mainSceneSource.includes('visualScaleMultipliers.beamFootprintMultiplier'), 'MainScene forwards beam multiplier to useSimulation');
  check(mainSceneSource.includes('visualScaleMultipliers,'), 'MainScene forwards visualScaleMultipliers to useBeamViz');
});

section('(h) SignalTuningPanel.tsx source wiring', () => {
  const panelSource = source('src/ui/SignalTuningPanel.tsx');
  check(panelSource.includes('sceneVisualScale: SceneVisualScaleState'), 'SignalTuningPanel accepts sceneVisualScale prop');
  check(panelSource.includes('onSceneVisualScaleChange: (next: SceneVisualScaleState) => void'), 'SignalTuningPanel accepts onSceneVisualScaleChange prop');
  check(panelSource.includes('sceneVisualScale={sceneVisualScale}'), 'SignalTuningPanel forwards sceneVisualScale to TopologyTab');
  check(panelSource.includes('onSceneVisualScaleChange={onSceneVisualScaleChange}'), 'SignalTuningPanel forwards onSceneVisualScaleChange to TopologyTab');
});

section('(i) TopologyTab.tsx source contract', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');
  for (const expected of [
    'topology-tab-scene-scale-radio',
    'topology-tab-scene-scale-option-paper-faithful',
    'topology-tab-scene-scale-option-demo-readability',
    'topology-tab-scene-scale-reset',
    'topology-tab-scene-scale-effective-value',
  ]) {
    check(countOccurrences(topologyTabSource, expected) === 1, `TopologyTab.tsx contains ${expected} exactly once`);
  }
  check(topologyTabSource.includes('no simulation restart'), 'TopologyTab.tsx contains no simulation restart banner copy');
  for (const expected of [
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
  ]) {
    check(topologyTabSource.includes(expected), `TopologyTab.tsx preserves ${expected}`);
  }
});

section('(j) SINR runtime contract amendment', () => {
  const contractSource = source('docs/sinr-runtime-parameter-contract.md');
  check(contractSource.includes('Scene Scale (Phase C)'), 'contract contains Scene Scale (Phase C) subsection');
  check(contractSource.includes('do NOT alter SINR'), 'contract contains do NOT alter SINR phrase');
});

section('(k) TopologyTab SSR scene-scale behavior', () => {
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const noop = () => undefined;
  const topology = createSceneTopologyState();
  const paperMarkup = renderToString(
    <TopologyTab
      topology={topology}
      sceneVisualScale={{ sceneScale: 'paper-faithful', ueMarkerScale: 1.0 }}
      baseProfile={baseProfile}
      onTopologyChange={noop}
      onSceneVisualScaleChange={noop}
      onReset={noop}
    />,
  );
  const demoMarkup = renderToString(
    <TopologyTab
      topology={topology}
      sceneVisualScale={{ sceneScale: 'demo-readability', ueMarkerScale: 1.0 }}
      baseProfile={baseProfile}
      onTopologyChange={noop}
      onSceneVisualScaleChange={noop}
      onReset={noop}
    />,
  );
  const paperText = textFromMarkup(paperMarkup);
  const demoText = textFromMarkup(demoMarkup);

  check(paperMarkup.includes('data-testid="topology-tab-scene-scale-effective-value"'), 'SSR paper render contains scene-scale effective-value testid');
  check(demoMarkup.includes('data-testid="topology-tab-scene-scale-effective-value"'), 'SSR demo render contains scene-scale effective-value testid');
  check(paperText.includes('Effective scene scale: paper-faithful (default)'), 'SSR paper render includes default readout');
  check(demoText.includes('Effective scene scale: demo-readability (override)'), 'SSR demo render includes override readout');
  check(paperText !== demoText, 'SSR effective-value text differs between paper and demo sceneScale renders');
});

console.log('\n---');
console.log(`[validate-phase-c-scene-scale-override] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
