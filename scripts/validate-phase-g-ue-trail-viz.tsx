#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createSceneTopologyState, getSceneTopologyResetKey, hasSceneTopologyOverrides } from '../src/sceneTopology';
import {
  UE_TRAIL_HISTORY_LIMIT,
  appendUeTrailHistory,
  type UeTrailHistory,
} from '../src/scene/useUeTrailHistory';
import { GroundScene } from '../src/viz/GroundScene';
import { UeTrail } from '../src/viz/UeTrail';
import { TopologyTab } from '../src/ui/signal-tuning/TopologyTab';
import { loadProfile } from '../src/profiles';

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

function compact(value: string): string {
  return value.replace(/\s+/g, '');
}

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

function gitDiff(relativePath: string): string {
  return execFileSync('git', ['diff', '--', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function textFromMarkup(markup: string): string {
  return markup
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderTopologyTab(
  enableUeTrails: boolean | null,
  appMode: 'sinr-experiment' | 'modqn-demo' = 'sinr-experiment',
): string {
  const noop = () => undefined;
  return renderToString(
    <TopologyTab
      topology={{ ...createSceneTopologyState(), enableUeTrails }}
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

const trailTestIds = [
  'topology-tab-ue-trails-toggle',
  'topology-tab-ue-trails-label',
] as const;

section('(a) UeTrail source contract', () => {
  const trailSource = source('src/viz/UeTrail.tsx');
  const trailCompact = compact(trailSource);
  check(trailSource.includes('export function UeTrail'), 'UeTrail component is exported');
  check(trailSource.includes('history: UeTrailHistory'), 'UeTrail props include history');
  check(trailSource.includes('maxOpacity?: number'), 'UeTrail props include optional maxOpacity');
  check(trailSource.includes("const TRAIL_COLOR = '#7a8a96';"), 'UeTrail uses muted grey #7a8a96');
  check(trailSource.includes('<lineSegments renderOrder={2}>'), 'UeTrail renders three.js line segments');
  check(trailSource.includes('transparent') && trailSource.includes('opacity={opacity}'), 'UeTrail line material uses opacity');
  check(trailCompact.includes('ueIndex===0'), 'UeTrail skips primary UE index 0');
});

section('(b) sceneTopology field + reset key', () => {
  const sceneTopologySource = source('src/sceneTopology.ts');
  const base = createSceneTopologyState();
  const enabled = { ...base, enableUeTrails: true };
  check(sceneTopologySource.includes('enableUeTrails: boolean | null'), 'SceneTopologyState declares enableUeTrails');
  check(sceneTopologySource.includes('enableUeTrails: null'), 'createSceneTopologyState defaults enableUeTrails to null');
  check(sceneTopologySource.includes('topology.enableUeTrails === true'), 'hasSceneTopologyOverrides checks true-only trail override');
  check(base.enableUeTrails === null, 'createSceneTopologyState returns enableUeTrails null');
  check(!hasSceneTopologyOverrides(base), 'null enableUeTrails is not an override');
  check(hasSceneTopologyOverrides(enabled), 'true enableUeTrails is an override');
  check(getSceneTopologyResetKey(base) !== getSceneTopologyResetKey(enabled), 'enableUeTrails changes topology reset key');
});

section('(c) useUeTrailHistory ring buffer behavior', () => {
  let history: UeTrailHistory = [];
  for (let i = 0; i < 35; i++) {
    history = appendUeTrailHistory(history, [[i, 0, i + 1]]);
  }
  check(UE_TRAIL_HISTORY_LIMIT === 30, 'UE trail history limit is hardcoded to 30');
  check(history.length === 1, 'history keeps one outer entry for one UE');
  check(history[0].length === 30, 'history length is capped at 30 after 35 pushes');
  check(history[0][0][0] === 5, 'history drops oldest five samples after 35 pushes');
  check(history[0][29][0] === 34, 'history keeps newest sample');
});

section('(d) GroundScene mounts UeTrail conditionally', () => {
  const groundSource = source('src/viz/GroundScene.tsx');
  const mainSceneSource = source('src/scene/MainScene.tsx');
  check(groundSource.includes('readonly ueTrailHistory?: UeTrailHistory'), 'GroundScene prop accepts optional ueTrailHistory');
  check(groundSource.includes('ueTrailHistory !== undefined') && groundSource.includes('<UeTrail history={ueTrailHistory} />'), 'GroundScene mounts UeTrail only when history prop is present');
  check(mainSceneSource.includes('useUeTrailHistory'), 'MainScene imports and calls useUeTrailHistory');
  check(mainSceneSource.includes('runtime.enableUeTrails === true && propSceneFrame === undefined'), 'MainScene gates trail history to live scene when toggle is true');
  check(mainSceneSource.includes('ueTrailHistory={showCellOverlay ? undefined : ueTrailHistory}'), 'MainScene passes ueTrailHistory to GroundScene');
});

section('(e) TopologyTab toggle + testids', () => {
  const topologySource = source('src/ui/signal-tuning/TopologyTab.tsx');
  for (const testId of priorTopologyTestIds) {
    check(topologySource.includes(testId), `TopologyTab preserves prior testid ${testId}`);
  }
  for (const testId of trailTestIds) {
    check(topologySource.includes(testId), `TopologyTab contains new trail testid ${testId}`);
  }
  check(countOccurrences(topologySource, 'topology-tab-') >= 37, 'TopologyTab preserves prior topology-tab testid string literals');
  check(topologySource.includes('enableUeTrails: event.target.checked ? true : null'), 'unchecked trail toggle writes null');

  const defaultMarkup = renderTopologyTab(null);
  const enabledMarkup = renderTopologyTab(true);
  const defaultText = textFromMarkup(defaultMarkup);
  check(defaultMarkup.includes('data-testid="topology-tab-ue-trails-toggle"'), 'SSR renders UE trails toggle');
  check(defaultMarkup.includes('data-testid="topology-tab-ue-trails-label"'), 'SSR renders UE trails label testid');
  check(defaultText.includes('Show UE trails'), 'SSR renders Show UE trails label');
  check(!/data-testid="topology-tab-ue-trails-toggle"[^>]*checked=""/.test(defaultMarkup), 'SSR default toggle is unchecked');
  check(/data-testid="topology-tab-ue-trails-toggle"[^>]*checked=""/.test(enabledMarkup), 'SSR true toggle is checked');
});

section('(f) modqn-demo bypass', () => {
  const appRuntimeConfigSource = source('src/app/appRuntimeConfig.ts');
  const markup = renderTopologyTab(true, 'modqn-demo');
  check(
    appRuntimeConfigSource.includes("enableUeTrails: input.appMode === 'sinr-experiment'"),
    'appRuntimeConfig computes enableUeTrails from app mode',
  );
  check(
    appRuntimeConfigSource.includes('trainingTopology.enableUeTrails === true'),
    'appRuntimeConfig lets modqn-demo training truth drive trail runtime flag',
  );
  for (const testId of trailTestIds) {
    check(!markup.includes(`data-testid="${testId}"`), `modqn-demo SSR omits ${testId}`);
  }
  check(!textFromMarkup(markup).includes('Show UE trails'), 'modqn-demo SSR omits UE trail label text');
});

section('(g) NEGATIVE showcaseArtifactToScene unchanged', () => {
  const replaySource = source('src/showcase/showcaseArtifactToScene.ts');
  check(!/UeTrail|ueTrail|enableUeTrails|useUeTrailHistory/.test(replaySource), 'showcaseArtifactToScene.ts has no UE trail references');
  check(gitDiff('src/showcase/showcaseArtifactToScene.ts').trim() === '', 'showcaseArtifactToScene.ts has no git diff');
});

section('(h) SSR trail markup presence/absence', () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  const history: UeTrailHistory = [
    [[0, 0, 0], [1, 0, 1], [2, 0, 2]],
    [[10, 0, 0], [11, 0, 1], [12, 0, 2]],
    [[20, 0, 0], [21, 0, 1], [22, 0, 2]],
  ];
  try {
    const trailMarkup = renderToString(<UeTrail history={history} />);
    check(trailMarkup.includes('<lineSegments'), 'UeTrail SSR emits lineSegments markup');
    check(countOccurrences(trailMarkup, '<lineSegments') === 4, 'UeTrail SSR emits two segment lines per secondary UE and none for primary');

    const withHistory = renderToString(<GroundScene ues={[]} ueTrailHistory={history} />);
    const withoutHistory = renderToString(<GroundScene ues={[]} />);
    check(withHistory.includes('<lineSegments'), 'GroundScene SSR with history includes UeTrail markup');
    check(!withoutHistory.includes('<lineSegments'), 'GroundScene SSR without history omits UeTrail markup');
  } finally {
    console.error = originalConsoleError;
  }
});

console.log('\n---');
console.log(`[validate-phase-g-ue-trail-viz] ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
