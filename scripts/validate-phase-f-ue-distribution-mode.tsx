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
  hasSceneTopologyOverrides,
} from '../src/sceneTopology';
import { generateUePositions, type UeDistributionMode } from '../src/engine/ue/multiUeState';
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

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

function distanceFromPrimary(pos: { eastKm: number; northKm: number }, primaryEastKm: number, primaryNorthKm: number): number {
  return Math.hypot(pos.eastKm - primaryEastKm, pos.northKm - primaryNorthKm);
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
  ueDistributionMode: UeDistributionMode | null,
  appMode: 'sinr-experiment' | 'modqn-demo',
): string {
  const noop = () => undefined;
  return renderToString(
    <TopologyTab
      topology={{ ...createSceneTopologyState(), ueDistributionMode }}
      baseProfile={loadProfile('hobs-2024-candidate-rich')}
      appMode={appMode}
      onTopologyChange={noop}
      onReset={noop}
    />,
  );
}

const distributionTestIds = [
  'topology-tab-ue-distribution-radio',
  'topology-tab-ue-distribution-option-random',
  'topology-tab-ue-distribution-option-grid',
  'topology-tab-ue-distribution-option-clustered',
  'topology-tab-ue-distribution-reset',
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
  'topology-tab-ue-count-slider',
  'topology-tab-ue-count-effective-value',
  'topology-tab-ue-count-reset',
] as const;

section('(a) multiUeState source contract', () => {
  const multiUeStateSource = source('src/engine/ue/multiUeState.ts');
  check(
    multiUeStateSource.includes("export type UeDistributionMode = 'random' | 'grid' | 'clustered'"),
    'multiUeState.ts exports UeDistributionMode union',
  );
  for (const expected of [
    'function generateRandomUePositions',
    'function generateGridUePositions',
    'function generateClusteredUePositions',
  ]) {
    check(multiUeStateSource.includes(expected), `multiUeState.ts contains ${expected}`);
  }
  check(multiUeStateSource.includes("mode = 'random'"), 'generateUePositions defaults mode to random');
});

section('(b) generateUePositions behavior per mode', () => {
  const params = {
    ueCount: 10,
    primaryEastKm: 0,
    primaryNorthKm: 0,
    primaryFootprintRadiusKm: 100,
    ueWorldScale: 0.5,
    seed: 42,
  };
  const random = generateUePositions({ ...params, mode: 'random' });
  const randomDefault = generateUePositions(params);
  const gridA = generateUePositions({ ...params, mode: 'grid', seed: 42 });
  const gridB = generateUePositions({ ...params, mode: 'grid', seed: 99 });
  const clustered = generateUePositions({ ...params, ueCount: 12, mode: 'clustered' });
  const modes: UeDistributionMode[] = ['random', 'grid', 'clustered'];

  check(random.length === 10, 'random mode returns requested UE count');
  check(
    new Set(random.map(pos => `${pos.eastKm.toFixed(9)},${pos.northKm.toFixed(9)}`)).size > 8,
    'random mode produces distinct positions for ueCount=10 seed=42',
  );
  check(
    random.every(pos => distanceFromPrimary(pos, 0, 0) <= params.primaryFootprintRadiusKm + 1e-9),
    'random mode keeps positions inside the primary footprint disc',
  );
  check(
    sameJson(randomDefault, random),
    'omitting mode returns identical positions to mode=random for seed=42 ueCount=10',
  );

  check(gridA.length === 10, 'grid mode returns requested UE count');
  check(sameJson(gridA, gridB), 'grid mode is reproducible and ignores seed');
  check(
    gridA.every(pos => distanceFromPrimary(pos, 0, 0) <= params.primaryFootprintRadiusKm + 1e-9),
    'grid mode keeps first 10 points inside the footprint disc',
  );
  check(
    gridA.slice(1).every((pos, index, points) => (
      index === 0 || distanceFromPrimary(points[index - 1], 0, 0) <= distanceFromPrimary(pos, 0, 0) + 1e-9
    )),
    'grid mode secondary points are selected center-out',
  );

  const clusterCount = Math.ceil(Math.sqrt(12));
  const clusterSize = Math.ceil(12 / clusterCount);
  const clusterRadius = params.primaryFootprintRadiusKm / (2 * Math.sqrt(clusterCount));
  check(clusterCount === 4 && clusterSize === 3, 'clustered ueCount=12 uses M=4 clusters with 3 slots each');
  check(clustered.length === 12, 'clustered mode returns requested UE count');
  for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
    const bucket = clustered.slice(clusterIndex * clusterSize, (clusterIndex + 1) * clusterSize);
    check(bucket.length === 3, `cluster ${clusterIndex} has 3 UE slots`);
    const maxPairDistance = bucket.reduce((maxDistance, left, leftIndex) => {
      const bucketMax = bucket.slice(leftIndex + 1).reduce((innerMax, right) => (
        Math.max(innerMax, Math.hypot(left.eastKm - right.eastKm, left.northKm - right.northKm))
      ), 0);
      return Math.max(maxDistance, bucketMax);
    }, 0);
    check(
      maxPairDistance <= (clusterRadius * 2) + 1e-9,
      `cluster ${clusterIndex} positions fit inside one cluster sub-disc diameter`,
      `maxPairDistance=${maxPairDistance}, clusterRadius=${clusterRadius}`,
    );
  }
  check(
    clustered.every(pos => distanceFromPrimary(pos, 0, 0) <= params.primaryFootprintRadiusKm + 1e-9),
    'clustered mode keeps positions inside the primary footprint disc',
  );

  for (const mode of modes) {
    const positions = generateUePositions({ ...params, mode });
    check(positions[0].eastKm === 0 && positions[0].northKm === 0, `${mode} mode keeps primary UE at origin`);
    check(positions[0].groundX === 0 && positions[0].groundZ === 0, `${mode} mode keeps primary ground point at origin`);
  }
});

section('(c) sceneTopology source + behavior', () => {
  const sceneTopologySource = source('src/sceneTopology.ts');
  check(sceneTopologySource.includes('ueDistributionMode: UeDistributionMode | null'), 'SceneTopologyState declares ueDistributionMode');
  check(sceneTopologySource.includes("topology.ueDistributionMode ?? 'random'"), 'topology reset/evidence keys include ueDistributionMode default');

  const baseTopology = createSceneTopologyState();
  const randomTopology = { ...baseTopology, ueDistributionMode: 'random' as const };
  const gridTopology = { ...baseTopology, ueDistributionMode: 'grid' as const };
  const profile = loadProfile('hobs-2024-candidate-rich');

  check(baseTopology.ueDistributionMode === null, 'createSceneTopologyState defaults ueDistributionMode to null');
  check(getSceneTopologyResetKey(baseTopology) === getSceneTopologyResetKey(randomTopology), 'null and random topology reset keys are equivalent');
  check(getSceneTopologyResetKey(baseTopology) !== getSceneTopologyResetKey(gridTopology), 'grid topology changes reset key');
  check(!hasSceneTopologyOverrides(randomTopology), 'random distribution is not treated as a topology override');
  check(hasSceneTopologyOverrides(gridTopology), 'grid distribution is treated as a topology override');
  check(
    sameJson(applySceneTopology(profile, baseTopology), applySceneTopology(profile, gridTopology)),
    'ueDistributionMode does not mutate Profile shape through applySceneTopology',
  );
});

section('(d) App.tsx + MainScene.tsx runtime threading source grep', () => {
  const appSource = source('src/App.tsx');
  const mainSceneSource = source('src/scene/MainScene.tsx');
  const useSimulationSource = source('src/scene/useSimulation.ts');
  const runtimeFrameStepSource = source('src/scene/runtimeFrameStep.ts');

  check(appSource.includes('ueDistributionMode: appMode === \'sinr-experiment\''), 'App.tsx computes runtime.ueDistributionMode from app mode');
  check(appSource.includes("sceneTopology.ueDistributionMode ?? 'random'"), 'App.tsx uses topology mode default random');
  check(appSource.includes(": 'random'"), 'App.tsx modqn-demo branch passes random');
  check(mainSceneSource.includes('runtime.ueDistributionMode'), 'MainScene threads runtime.ueDistributionMode into useSimulation');
  check(useSimulationSource.includes('ueDistributionMode: UeDistributionMode = \'random\''), 'useSimulation defaults ueDistributionMode to random');
  check(runtimeFrameStepSource.includes('ueDistributionMode?: UeDistributionMode'), 'runtimeFrameStep accepts optional ueDistributionMode');
  check(runtimeFrameStepSource.includes('mode: ueDistributionMode'), 'runtimeFrameStep forwards mode to generateUePositions');
});

section('(e) TopologyTab source testids and radio options', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');

  for (const testId of priorTopologyTestIds) {
    check(topologyTabSource.includes(testId), `TopologyTab.tsx preserves prior testid ${testId}`);
  }
  for (const testId of distributionTestIds) {
    check(topologyTabSource.includes(testId), `TopologyTab.tsx contains new testid ${testId}`);
  }
  check(
    countOccurrences(topologyTabSource, 'topology-tab-') === 35,
    'TopologyTab.tsx contains exactly 35 topology-tab testid string literals after Phase G mobility params UI',
  );
  check(topologyTabSource.includes("['random', 'grid', 'clustered']"), 'TopologyTab radio declares random/grid/clustered options');
  check(topologyTabSource.includes('Changing UE distribution restarts the simulation'), 'TopologyTab includes distribution restart banner');
});

section('(f) modqn-demo bypass SSR behavior', () => {
  const modqnMarkup = renderTopologyTab('grid', 'modqn-demo');
  const modqnText = textFromMarkup(modqnMarkup);
  for (const testId of distributionTestIds) {
    check(!modqnMarkup.includes(`data-testid="${testId}"`), `modqn-demo SSR omits ${testId}`);
  }
  check(!modqnText.includes('UE distribution mode'), 'modqn-demo SSR omits UE distribution section text');
});

section('(g) showcaseArtifactToScene negative assertion', () => {
  const replaySource = source('src/showcase/showcaseArtifactToScene.ts');
  check(!replaySource.includes('ueDistributionMode'), 'showcaseArtifactToScene.ts has no ueDistributionMode reference');
  check(!replaySource.includes('UeDistributionMode'), 'showcaseArtifactToScene.ts has no UeDistributionMode reference');
});

section('(h) TopologyTab SSR active grid option', () => {
  const gridMarkup = renderTopologyTab('grid', 'sinr-experiment');
  const gridText = textFromMarkup(gridMarkup);
  for (const testId of distributionTestIds) {
    check(gridMarkup.includes(`data-testid="${testId}"`), `sinr-experiment SSR renders ${testId}`);
  }
  check(
    /data-testid="topology-tab-ue-distribution-option-grid"[^>]*checked=""/.test(gridMarkup),
    'SSR marks grid distribution option active',
  );
  check(gridText.includes('Changing UE distribution restarts the simulation'), 'SSR includes distribution restart copy');
});

console.log('\n---');
console.log(`[validate-phase-f-ue-distribution-mode] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
