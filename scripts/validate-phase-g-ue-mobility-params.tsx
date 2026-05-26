#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import { createObserverContext } from '../src/engine/orbit';
import {
  createMobilityStates,
  DEFAULT_UE_MOBILITY_PARAMS,
  type UeMobilityMode,
  type UeMobilityParams,
} from '../src/engine/ue/multiUeMobility';
import type { UeDistributionMode } from '../src/engine/ue/multiUeState';
import { loadProfile } from '../src/profiles';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep';
import {
  createSceneTopologyState,
  getSceneTopologyEvidenceKey,
  getSceneTopologyResetKey,
  hasSceneTopologyOverrides,
} from '../src/sceneTopology';
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

function compact(value: string): string {
  return value.replace(/\s+/g, '');
}

function gitDiff(relativePath: string): string {
  return execFileSync('git', ['diff', '--', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function renderTopologyTab(input: {
  ueMobilityMode: UeMobilityMode | null;
  ueMobilityParams?: UeMobilityParams | null;
  ueDistributionMode?: UeDistributionMode | null;
  appMode?: 'sinr-experiment' | 'modqn-demo';
}): string {
  const noop = () => undefined;
  return renderToString(
    <TopologyTab
      topology={{
        ...createSceneTopologyState(),
        ueDistributionMode: input.ueDistributionMode ?? null,
        ueMobilityMode: input.ueMobilityMode,
        ueMobilityParams: input.ueMobilityParams ?? null,
      }}
      baseProfile={loadProfile('hobs-2024-candidate-rich')}
      appMode={input.appMode ?? 'sinr-experiment'}
      onTopologyChange={noop}
      onReset={noop}
    />,
  );
}

function runMobilityFrame(params: UeMobilityParams) {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const replay = {
    epochUtcMs: Date.UTC(2026, 0, 1),
    startOffsetSec: 0,
    loop: true,
  };
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, replay.epochUtcMs);
  const frame = stepRuntimeFrame({
    profile,
    replay,
    speed: 1,
    paused: false,
    deltaSec: 1,
    observer,
    beamLayoutsByShellId: createBeamLayoutsByShellId(profile),
    trajectoryCache,
    hoManager: new HandoverManager(profile.handover),
    ueCount: 4,
    ueDistributionMode: 'random',
    ueMobilityMode: 'random-walk',
    ueMobilityParams: params,
    mobilityStates: createMobilityStates(4, 'random-walk', params, 42),
    state: createRuntimeFrameStepState(0),
  }).frame;
  return frame.perUePositions[1];
}

const preservedTopologyTestIds = [
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
  'topology-tab-ue-mobility-radio',
  'topology-tab-ue-mobility-option-static',
  'topology-tab-ue-mobility-option-random-walk',
  'topology-tab-ue-mobility-option-waypoints',
  'topology-tab-ue-mobility-option-manhattan',
  'topology-tab-ue-mobility-reset',
] as const;

const newParamTestIds = [
  'topology-tab-ue-mobility-speed',
  'topology-tab-ue-mobility-waypoint-count',
  'topology-tab-ue-mobility-grid-spacing',
] as const;

section('(a) sceneTopology source grep', () => {
  const sceneTopologySource = source('src/sceneTopology.ts');
  check(sceneTopologySource.includes('ueMobilityParams: UeMobilityParams | null'), 'SceneTopologyState declares ueMobilityParams');
  check(sceneTopologySource.includes('ueMobilityParams: null'), 'createSceneTopologyState defaults ueMobilityParams to null');
  check(sceneTopologySource.includes('topology.ueMobilityParams !== null'), 'hasSceneTopologyOverrides includes ueMobilityParams');
  for (const expected of [
    "topology.ueMobilityParams?.speedKmPerSec ?? 'default'",
    "topology.ueMobilityParams?.waypointCount ?? 'default'",
    "topology.ueMobilityParams?.manhattanGridSpacingKm ?? 'default'",
  ]) {
    check(sceneTopologySource.includes(expected), `reset/evidence keys include ${expected}`);
  }
});

section('(b) behavioral params change reset/evidence keys and runtime motion', () => {
  const base = { ...createSceneTopologyState(), ueMobilityMode: 'random-walk' as const };
  const custom = {
    ...base,
    ueMobilityParams: {
      speedKmPerSec: 17,
      waypointCount: 6,
      manhattanGridSpacingKm: 11,
    },
  };
  check(hasSceneTopologyOverrides(base), 'moving mobility mode counts as topology override');
  check(hasSceneTopologyOverrides(custom), 'non-null ueMobilityParams counts as topology override');
  check(getSceneTopologyResetKey(base) !== getSceneTopologyResetKey(custom), 'non-default params produce a different reset key');
  check(getSceneTopologyEvidenceKey(base) !== getSceneTopologyEvidenceKey(custom), 'non-default params produce a different evidence key');

  const defaultMoved = runMobilityFrame(DEFAULT_UE_MOBILITY_PARAMS);
  const fastMoved = runMobilityFrame({ ...DEFAULT_UE_MOBILITY_PARAMS, speedKmPerSec: 20 });
  const delta = Math.hypot(defaultMoved.eastKm - fastMoved.eastKm, defaultMoved.northKm - fastMoved.northKm);
  check(delta > 1e-6, 'runtimeFrameStep output changes when speedKmPerSec changes');
});

section('(c) runtimeFrameStep + useSimulation + App + MainScene threading grep', () => {
  const runtimeSource = source('src/scene/runtimeFrameStep.ts');
  const useSimulationSource = source('src/scene/useSimulation.ts');
  const appSource = source('src/App.tsx');
  const mainSceneSource = source('src/scene/MainScene.tsx');
  check(runtimeSource.includes('ueMobilityParams?: UeMobilityParams'), 'runtimeFrameStep input accepts ueMobilityParams');
  check(runtimeSource.includes('ueMobilityParams = DEFAULT_UE_MOBILITY_PARAMS'), 'runtimeFrameStep falls back to default params');
  check(runtimeSource.includes('ueMobilityParams,'), 'runtimeFrameStep forwards ueMobilityParams into applyPerTickUeMobility');
  check(useSimulationSource.includes('ueMobilityParams: UeMobilityParams = DEFAULT_UE_MOBILITY_PARAMS'), 'useSimulation accepts ueMobilityParams with default fallback');
  check(useSimulationSource.includes('createMobilityStates(effectiveUeCount, ueMobilityMode, effectiveUeMobilityParams, 42)'), 'useSimulation creates mobility states from runtime params');
  check(countOccurrences(useSimulationSource, 'ueMobilityParams: effectiveUeMobilityParams') >= 2, 'useSimulation passes effective params to both stepRuntimeFrame calls');
  check(appSource.includes('record.ueMobilityParams'), 'App reads persisted ueMobilityParams');
  check(appSource.includes('sceneTopology.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS'), 'App threads topology params with default fallback');
  check(mainSceneSource.includes('runtime.ueMobilityParams'), 'MainScene threads runtime.ueMobilityParams into useSimulation');
});

section('(d) TopologyTab source grep', () => {
  const topologySource = source('src/ui/signal-tuning/TopologyTab.tsx');
  for (const testId of preservedTopologyTestIds) {
    check(topologySource.includes(testId), `TopologyTab preserves prior testid ${testId}`);
  }
  for (const testId of newParamTestIds) {
    check(topologySource.includes(testId), `TopologyTab contains new param testid ${testId}`);
  }
  check(countOccurrences(topologySource, 'topology-tab-') === 35, 'TopologyTab contains exactly 35 topology-tab testid string literals');
  check(topologySource.includes('topology.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS'), 'TopologyTab merges null params with defaults');
  check(topologySource.includes('...(topology.ueMobilityParams ?? {})'), 'TopologyTab updates params with merge pattern');
});

section('(e) conditional rendering', () => {
  const speedId = 'topology-tab-ue-mobility-speed';
  const waypointId = 'topology-tab-ue-mobility-waypoint-count';
  const gridId = 'topology-tab-ue-mobility-grid-spacing';
  const byMode: Record<UeMobilityMode, string> = {
    static: renderTopologyTab({ ueMobilityMode: 'static' }),
    'random-walk': renderTopologyTab({ ueMobilityMode: 'random-walk' }),
    waypoints: renderTopologyTab({ ueMobilityMode: 'waypoints' }),
    manhattan: renderTopologyTab({ ueMobilityMode: 'manhattan' }),
  };
  check(!byMode.static.includes(speedId), 'static omits speed input');
  check(!byMode.static.includes(waypointId), 'static omits waypoint count input');
  check(!byMode.static.includes(gridId), 'static omits grid spacing input');
  check(byMode['random-walk'].includes(speedId), 'random-walk shows speed input');
  check(!byMode['random-walk'].includes(waypointId), 'random-walk omits waypoint count input');
  check(!byMode['random-walk'].includes(gridId), 'random-walk omits grid spacing input');
  check(byMode.waypoints.includes(speedId), 'waypoints shows speed input');
  check(byMode.waypoints.includes(waypointId), 'waypoints shows waypoint count input');
  check(!byMode.waypoints.includes(gridId), 'waypoints omits grid spacing input');
  check(byMode.manhattan.includes(speedId), 'manhattan shows speed input');
  check(!byMode.manhattan.includes(waypointId), 'manhattan omits waypoint count input');
  check(byMode.manhattan.includes(gridId), 'manhattan shows grid spacing input');

  const topologyCompact = compact(source('src/ui/signal-tuning/TopologyTab.tsx'));
  check(topologyCompact.includes('min={1}max={50}step={1}'), 'speed slider range is 1-50 step 1');
  check(topologyCompact.includes('min={2}max={8}step={1}'), 'waypoint count slider range is 2-8 step 1');
  check(topologyCompact.includes('min={1}max={20}step={1}'), 'grid spacing slider range is 1-20 step 1');
});

section('(f) modqn-demo bypass', () => {
  const markup = renderTopologyTab({
    ueMobilityMode: 'manhattan',
    ueMobilityParams: { speedKmPerSec: 31, waypointCount: 7, manhattanGridSpacingKm: 13 },
    appMode: 'modqn-demo',
  });
  for (const testId of [
    'topology-tab-ue-mobility-radio',
    'topology-tab-ue-mobility-option-static',
    'topology-tab-ue-mobility-option-random-walk',
    'topology-tab-ue-mobility-option-waypoints',
    'topology-tab-ue-mobility-option-manhattan',
    'topology-tab-ue-mobility-reset',
    ...newParamTestIds,
  ]) {
    check(!markup.includes(testId), `modqn-demo SSR omits UE mobility testid ${testId}`);
  }
  const appSource = source('src/App.tsx');
  check(
    /ueMobilityMode:\s*appMode === 'sinr-experiment'\s*\?\s*sceneTopology\.ueMobilityMode \?\? 'static'\s*:\s*'static'/m.test(appSource),
    'App forces modqn-demo ueMobilityMode to static',
  );
  check(
    /ueMobilityParams:\s*appMode === 'sinr-experiment'\s*\?\s*sceneTopology\.ueMobilityParams \?\? DEFAULT_UE_MOBILITY_PARAMS\s*:\s*DEFAULT_UE_MOBILITY_PARAMS/m.test(appSource),
    'App forces modqn-demo ueMobilityParams to defaults',
  );
});

section('(g) NEGATIVE showcaseArtifactToScene unchanged', () => {
  const replaySource = source('src/showcase/showcaseArtifactToScene.ts');
  check(!/ueMobilityParams|ueMobilityMode|multiUeMobility|mobilityStep/.test(replaySource), 'showcaseArtifactToScene.ts has no UE mobility param references');
  check(gitDiff('src/showcase/showcaseArtifactToScene.ts').trim() === '', 'showcaseArtifactToScene.ts has no git diff');
});

console.log(`\n[validate-phase-g-ue-mobility-params] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
