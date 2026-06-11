#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import { createObserverContext } from '../src/engine/orbit';
import {
  createMobilityStates,
  DEFAULT_UE_MOBILITY_PARAMS,
  mobilityStep,
  type UeMobilityMode,
} from '../src/engine/ue/multiUeMobility';
import type { UePosition } from '../src/engine/ue/multiUeState';
import { loadProfile } from '../src/profiles';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep';
import {
  createSceneTopologyState,
  getSceneTopologyResetKey,
  hasSceneTopologyOverrides,
} from '../src/sceneTopology';

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

function distance(position: Pick<UePosition, 'eastKm' | 'northKm'>): number {
  return Math.hypot(position.eastKm, position.northKm);
}

function gitDiff(relativePath: string): string {
  return execFileSync('git', ['diff', '--', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function makePosition(id: string, eastKm: number, northKm: number, scale = 2): UePosition {
  return {
    id,
    eastKm,
    northKm,
    groundX: eastKm * scale,
    groundZ: -northKm * scale,
  };
}

function runStaticFramePair() {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const replay = {
    epochUtcMs: Date.UTC(2026, 0, 1),
    startOffsetSec: 0,
    loop: true,
  };
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, replay.epochUtcMs);
  const state = createRuntimeFrameStepState(0);
  const common = {
    profile,
    replay,
    speed: 1,
    paused: false,
    deltaSec: 1,
    observer,
    beamLayoutsByShellId: createBeamLayoutsByShellId(profile),
    trajectoryCache,
    hoManager: new HandoverManager(profile.handover),
    ueCount: 5,
    ueDistributionMode: 'random' as const,
    ueMobilityMode: 'static' as const,
    state,
  };
  const first = stepRuntimeFrame(common).frame;
  const second = stepRuntimeFrame(common).frame;
  return { first, second };
}

section('(a) multiUeMobility source contract', () => {
  const mobilitySource = source('src/engine/ue/multiUeMobility.ts');
  check(
    mobilitySource.includes("export type UeMobilityMode = 'static' | 'random-walk' | 'waypoints' | 'manhattan'"),
    'UeMobilityMode exports the 4-mode union',
  );
  for (const expected of [
    'export interface UePerMobilityState',
    'export function createMobilityStates',
    'export function mobilityStep',
    'function randomWalkStep',
    'function waypointStep',
    'function manhattanStep',
    "mode === 'static'",
  ]) {
    check(mobilitySource.includes(expected), `multiUeMobility.ts contains ${expected}`);
  }
  check(mobilitySource.includes('speedKmPerSec: 5'), 'default speedKmPerSec is 5');
  check(mobilitySource.includes('waypointCount: 4'), 'default waypointCount is 4');
  check(mobilitySource.includes('manhattanGridSpacingKm: 5'), 'default manhattanGridSpacingKm is 5');
  check(!/from ['"].*react/.test(mobilitySource), 'multiUeMobility.ts does not import React');
  check(!/from ['"].*three/.test(mobilitySource), 'multiUeMobility.ts does not import Three.js');
});

section('(b) behavioral mobilityStep per mode', () => {
  const params = DEFAULT_UE_MOBILITY_PARAMS;
  const footprintRadiusKm = 30;
  const modes: UeMobilityMode[] = ['static', 'random-walk', 'waypoints', 'manhattan'];
  const primary = makePosition('live-ue-0', 0, 0);

  for (const mode of modes) {
    const state = createMobilityStates(2, mode, params, 42)[0];
    const stepped = mobilityStep(primary, state, mode, params, 1, footprintRadiusKm);
    check(sameJson(stepped.position, primary), `${mode} keeps primary UE unchanged when called directly`);
  }

  const staticPosition = makePosition('live-ue-1', 7, -3);
  const staticStep = mobilityStep(
    staticPosition,
    createMobilityStates(2, 'static', params, 42)[1],
    'static',
    params,
    1,
    footprintRadiusKm,
  );
  check(sameJson(staticStep.position, staticPosition), 'static mode returns secondary position unchanged');

  const randomPosition = makePosition('live-ue-1', 1, 1);
  const randomStep = mobilityStep(
    randomPosition,
    createMobilityStates(2, 'random-walk', params, 42)[1],
    'random-walk',
    params,
    1,
    footprintRadiusKm,
  );
  const randomDelta = Math.hypot(
    randomStep.position.eastKm - randomPosition.eastKm,
    randomStep.position.northKm - randomPosition.northKm,
  );
  check(randomDelta > 0, 'random-walk mode returns a moved secondary position');
  check(randomDelta <= params.speedKmPerSec + 1e-9, 'random-walk move magnitude is <= speed * deltaSec');
  check(distance(randomStep.position) <= footprintRadiusKm + 1e-9, 'random-walk preserves footprint boundary');

  const waypointState = createMobilityStates(2, 'waypoints', params, 42)[1];
  const waypointPosition = makePosition('live-ue-1', 0, 0);
  const waypointTarget = waypointState.waypoints[0];
  const waypointStepResult = mobilityStep(
    waypointPosition,
    waypointState,
    'waypoints',
    params,
    1,
    footprintRadiusKm,
  );
  const targetEastKm = waypointTarget.eastRatio * footprintRadiusKm;
  const targetNorthKm = waypointTarget.northRatio * footprintRadiusKm;
  const beforeDistance = Math.hypot(targetEastKm - waypointPosition.eastKm, targetNorthKm - waypointPosition.northKm);
  const afterDistance = Math.hypot(targetEastKm - waypointStepResult.position.eastKm, targetNorthKm - waypointStepResult.position.northKm);
  check(afterDistance < beforeDistance, 'waypoints mode moves toward the active waypoint');
  check(distance(waypointStepResult.position) <= footprintRadiusKm + 1e-9, 'waypoints mode preserves footprint boundary');

  const manhattanState = createMobilityStates(2, 'manhattan', params, 42)[1];
  const manhattanPosition = makePosition('live-ue-1', 2.1, 3.6);
  const initialized = mobilityStep(manhattanPosition, manhattanState, 'manhattan', params, 0, footprintRadiusKm);
  const manhattanStepResult = mobilityStep(
    initialized.position,
    initialized.state,
    'manhattan',
    params,
    1,
    footprintRadiusKm,
  );
  const movedEast = Math.abs(manhattanStepResult.position.eastKm - initialized.position.eastKm) > 1e-9;
  const movedNorth = Math.abs(manhattanStepResult.position.northKm - initialized.position.northKm) > 1e-9;
  check(movedEast !== movedNorth, 'manhattan mode moves along exactly one axis');
  check(distance(manhattanStepResult.position) <= footprintRadiusKm + 1e-9, 'manhattan mode preserves footprint boundary');
});

section('(c) sceneTopology source + behavior', () => {
  const sceneTopologySource = source('src/sceneTopology.ts');
  check(sceneTopologySource.includes('ueMobilityMode: UeMobilityMode | null'), 'SceneTopologyState declares ueMobilityMode');
  check(sceneTopologySource.includes("topology.ueMobilityMode ?? 'static'"), 'topology reset/evidence keys include ueMobilityMode default');
  const baseTopology = createSceneTopologyState();
  const staticTopology = { ...baseTopology, ueMobilityMode: 'static' as const };
  const movingTopology = { ...baseTopology, ueMobilityMode: 'random-walk' as const };
  check(baseTopology.ueMobilityMode === null, 'createSceneTopologyState defaults ueMobilityMode to null');
  check(getSceneTopologyResetKey(baseTopology) === getSceneTopologyResetKey(staticTopology), 'null and static reset keys are equivalent');
  check(getSceneTopologyResetKey(baseTopology) !== getSceneTopologyResetKey(movingTopology), 'moving mobility mode changes reset key');
  check(!hasSceneTopologyOverrides(staticTopology), 'static mobility is not treated as a topology override');
  check(hasSceneTopologyOverrides(movingTopology), 'moving mobility is treated as a topology override');
});

section('(d) runtimeFrameStep source grep', () => {
  const runtimeSource = source('src/scene/runtimeFrameStep.ts');
  const runtimeUeSource = source('src/scene/runtimeUeFrame.ts');
  const mobilityIndex = runtimeSource.indexOf('applyPerTickUeMobility({');
  const secondaryHoIndex = runtimeSource.indexOf('stepSecondaryUeHandovers({');
  const fillSinrIndex = runtimeSource.indexOf('fillPerUeServingSinr({');
  check(runtimeSource.includes('ueMobilityMode?: UeMobilityMode'), 'runtimeFrameStep input accepts ueMobilityMode');
  check(runtimeSource.includes("ueMobilityMode = 'static'"), 'runtimeFrameStep defaults ueMobilityMode to static');
  check(runtimeUeSource.includes("if (ueMobilityMode === 'static'"), 'runtime UE helper skips mobility in static mode');
  check(runtimeUeSource.includes('for (let i = 1; i < perUePositions.length; i += 1)'), 'runtime UE helper mobility loop starts from secondary UE index 1');
  check(runtimeUeSource.includes('perUePositions[i] = {'), 'runtime UE helper updates secondary UE position fields');
  check(mobilityIndex >= 0 && secondaryHoIndex >= 0 && mobilityIndex < secondaryHoIndex, 'per-tick mobility step appears before secondary UE handover loop');
  check(mobilityIndex >= 0 && fillSinrIndex >= 0 && mobilityIndex < fillSinrIndex, 'per-tick mobility step appears before fallback per-UE SINR fill');
});

section('(e) useSimulation + App + MainScene source grep', () => {
  const useSimulationSource = source('src/scene/useSimulation.ts');
  const appSource = source('src/App.tsx');
  const appPersistenceSource = source('src/app/appPersistence.ts');
  const appRuntimeConfigSource = source('src/app/appRuntimeConfig.ts');
  const mainSceneSource = source('src/scene/MainScene.tsx');
  check(useSimulationSource.includes('mobilityStatesRef'), 'useSimulation maintains mobilityStatesRef');
  check(useSimulationSource.includes('createMobilityStates(effectiveUeCount, ueMobilityMode'), 'useSimulation initializes mobility states by ueCount and mode');
  check(useSimulationSource.includes('mobilityStates: mobilityStatesRef.current'), 'useSimulation passes mobilityStates to stepRuntimeFrame');
  check(appSource.includes('buildAppRuntimeConfig'), 'App delegates runtime config construction');
  check(appPersistenceSource.includes('record.ueMobilityMode'), 'appPersistence reads persisted ueMobilityMode');
  check(appRuntimeConfigSource.includes("ueMobilityMode: input.appMode === 'sinr-experiment'"), 'appRuntimeConfig gates ueMobilityMode by app mode');
  check(appRuntimeConfigSource.includes("trainingTopology.ueMobilityMode ?? 'static'"), 'appRuntimeConfig lets modqn-demo user-trained artifacts drive mobility from training truth');
  check(mainSceneSource.includes('runtime.ueMobilityMode'), 'MainScene threads runtime.ueMobilityMode into useSimulation');
});

section('(f) replay and handover negative assertions', () => {
  const replaySource = source('src/showcase/showcaseArtifactToScene.ts');
  const handoverSource = source('src/engine/handover/handover-manager.ts');
  check(!/multiUeMobility|ueMobilityMode|mobilityStep|createMobilityStates/.test(replaySource), 'showcaseArtifactToScene.ts has no UE mobility references');
  check(!/multiUeMobility|ueMobilityMode|mobilityStep|createMobilityStates/.test(handoverSource), 'handover-manager.ts has no UE mobility references');
  check(gitDiff('src/showcase/showcaseArtifactToScene.ts').trim() === '', 'showcaseArtifactToScene.ts has no git diff');
  // S3-2: handover-manager.ts is now legitimately owned by the S3 program (it added
  // rebase()). The old `git diff == ''` freeze enforced nothing post-commit (git diff
  // is working-tree-vs-index only), so it would wave through ANY committed edit. Replace
  // it with an HONEST content lock: the file stays UE-mobility-free (asserted at line 269
  // above) AND keeps the reset-vs-rebase contract — reset() still nukes eventLog (cold
  // start) while rebase() preserves it (the S3-2 served-survives-wrap fix; the rebase/reset
  // body equivalence is gated behaviorally by validate:s3:served-survives-wrap).
  check(handoverSource.includes('rebase(deltaMs: number): void'), 'handover-manager.ts exposes the S3-2 rebase(deltaMs) clock-rebase');
  check(
    /reset\(\): void \{[\s\S]*?this\.eventLog = \[\];[\s\S]*?\n {2}\}/.test(handoverSource),
    'handover-manager.ts reset() still nukes eventLog (cold-start contract; rebase, by contrast, preserves it)',
  );
});

section('(g) zero-drift behavioral static mode', () => {
  const { first, second } = runStaticFramePair();
  const firstPositions = first.perUePositions.map(pos => ({
    id: pos.id,
    groundX: pos.groundX,
    groundZ: pos.groundZ,
    eastKm: pos.eastKm,
    northKm: pos.northKm,
  }));
  const secondPositions = second.perUePositions.map(pos => ({
    id: pos.id,
    groundX: pos.groundX,
    groundZ: pos.groundZ,
    eastKm: pos.eastKm,
    northKm: pos.northKm,
  }));
  check(sameJson(firstPositions, secondPositions), 'ueMobilityMode=static keeps perUePositions unchanged across consecutive frames');
});

section('(h) modqn-demo Track-2 truth assertion', () => {
  const appRuntimeConfigSource = source('src/app/appRuntimeConfig.ts');
  check(
    /ueMobilityMode:\s*input\.appMode === 'sinr-experiment'\s*\?\s*input\.sceneTopology\.ueMobilityMode \?\? 'static'\s*:\s*trainingTopology\.ueMobilityMode \?\? 'static'/m.test(appRuntimeConfigSource),
    'appRuntimeConfig uses training truth for modqn-demo mobility',
  );
});

console.log(`\n[validate-phase-g-ue-mobility-step] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
