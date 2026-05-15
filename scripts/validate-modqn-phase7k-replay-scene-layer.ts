import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  createModqnReplayPlaybackDisplayState,
} from '../src/modqn/replay-bundle/index.ts';
import {
  MODQN_REPLAY_SCENE_BEAM_COUNT,
  MODQN_REPLAY_SCENE_SOURCE,
  createModqnReplayCanonicalBeamPosition,
  deriveModqnReplaySceneVisualState,
} from '../src/scene/modqnReplaySceneVisuals.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function readRepoFile(path: string): string {
  return readFileSync(join(ROOT_DIR, path), 'utf8');
}

function readReplaySceneLayerSources(): string {
  const entry = readRepoFile('src/scene/ModqnReplaySceneLayer.tsx');
  const dirPath = join(ROOT_DIR, 'src/scene/modqn-replay-visuals');
  const files = readdirSync(dirPath)
    .filter(name => name.endsWith('.tsx') || name.endsWith('.ts'))
    .sort();
  const parts = files.map(name => readFileSync(join(dirPath, name), 'utf8'));
  return [entry, ...parts].join('\n');
}

function assertContains(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function assertNotContains(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label} unexpectedly contains ${needle}`);
}

function assertNoLiveSceneIdentityLeak(serialized: string): void {
  assert.doesNotMatch(
    serialized,
    /-P\d+-S\d+/,
    'MODQN replay scene visuals must not project producer sat IDs into live scene constellation IDs',
  );
  assert.doesNotMatch(serialized, /sceneSatId|liveSatId|liveBeamId/i);
}

function assertFirstSlotVisualState(): void {
  const displayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    false,
    true,
  );
  const visualState = deriveModqnReplaySceneVisualState(displayState);

  assert.ok(visualState, 'first replay slot should produce scene visual state');
  assert.equal(visualState.source, MODQN_REPLAY_SCENE_SOURCE);
  assert.equal(visualState.coordinateFrame, 'scene-world-display-layer');
  assert.equal(visualState.beams.length, MODQN_REPLAY_SCENE_BEAM_COUNT);
  assert.equal(visualState.eventKind, 'intra-satellite-beam-switch');
  assert.equal(visualState.switch.activeIntraSatelliteSwitch, true);
  assert.equal(visualState.previous.producerBeamId, 'sat-0-beam-3');
  assert.equal(visualState.selected.producerBeamId, 'sat-0-beam-4');
  assert.equal(visualState.previous.producerSatId, 'sat-0');
  assert.equal(visualState.selected.producerSatId, 'sat-0');
  assert.deepEqual(
    visualState.previous.position,
    createModqnReplayCanonicalBeamPosition(3),
    'previous serving should use producer localBeamIndex 3 in the canonical display plane',
  );
  assert.deepEqual(
    visualState.selected.position,
    createModqnReplayCanonicalBeamPosition(4),
    'selected serving should use producer localBeamIndex 4 in the canonical display plane',
  );
  assert.notDeepEqual(
    visualState.previous.position,
    visualState.selected.position,
    'first replay slot should visibly separate previous and selected beams',
  );
  assertNoLiveSceneIdentityLeak(JSON.stringify(visualState));
}

function assertNoSwitchSlotVisualState(): void {
  const displayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    5,
    true,
    true,
  );
  const visualState = deriveModqnReplaySceneVisualState(displayState);

  assert.ok(visualState, 'sixth replay slot should produce scene visual state');
  assert.equal(visualState.eventKind, 'none');
  assert.equal(visualState.switch.activeIntraSatelliteSwitch, false);
  assert.equal(visualState.previous.producerBeamId, 'sat-0-beam-4');
  assert.equal(visualState.selected.producerBeamId, 'sat-0-beam-4');

  const sharedBeam = visualState.beams.find(beam => beam.canonicalBeamNumber === 5);
  assert.ok(sharedBeam, 'shared previous/selected beam B5 should be present');
  assert.equal(sharedBeam.role, 'previous-and-selected');
  assertNoLiveSceneIdentityLeak(JSON.stringify(visualState));
}

function assertSceneBridgeSource(): void {
  const appSource = readRepoFile('src/App.tsx');
  const mainSceneSource = readRepoFile('src/scene/MainScene.tsx');
  const sceneLayerSource = readReplaySceneLayerSources();
  const helperSource = readRepoFile('src/scene/modqnReplaySceneVisuals.ts');

  assertContains(
    appSource,
    'modqnReplayDisplayState={modqnReplayDisplayState}',
    'App replay-to-scene bridge',
  );
  assertContains(
    mainSceneSource,
    "import { ModqnReplaySceneLayer } from './ModqnReplaySceneLayer';",
    'MainScene scene layer import',
  );
  assertContains(
    mainSceneSource,
    '<ModqnReplaySceneLayer',
    'MainScene R3F content',
  );
  assertContains(
    sceneLayerSource,
    '<circleGeometry',
    'R3F replay beam disc layer',
  );
  assertContains(
    sceneLayerSource,
    '<ringGeometry',
    'R3F replay beam ring layer',
  );
  assertContains(
    sceneLayerSource,
    '<Line',
    'R3F replay switch path',
  );
  assertContains(
    sceneLayerSource,
    'data-modqn-replay-scene-renderer',
    'canvas validation attributes',
  );
  assertContains(
    sceneLayerSource,
    'r3f-world-layer',
    'canvas validation attributes',
  );
  assertNotContains(
    sceneLayerSource,
    'ModqnReplaySceneOverlay',
    'scene layer must not delegate proof to the DOM overlay component',
  );
  assertNotContains(
    helperSource,
    'THREE',
    'plain-data scene visual helper',
  );
  assertNotContains(
    helperSource,
    '../engine',
    'plain-data scene visual helper',
  );
  assertNotContains(
    helperSource,
    '../core',
    'plain-data scene visual helper',
  );
  assertNotContains(
    helperSource,
    'sinr',
    'display-only helper must not derive SINR',
  );
  assertNotContains(
    helperSource,
    'reward',
    'display-only helper must not derive rewards',
  );
}

function assertClaimBoundaryCounts(): void {
  assert.equal(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts['intra-satellite-beam-switch'],
    85,
  );
  assert.equal(MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts.none, 915);
  assert.equal(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts['inter-satellite-handover'],
    0,
  );
}

assert.equal(deriveModqnReplaySceneVisualState(null), null);
assertClaimBoundaryCounts();
assertFirstSlotVisualState();
assertNoSwitchSlotVisualState();
assertSceneBridgeSource();

console.log('MODQN Phase 7K replay scene layer validation passed.');
