import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODQN_EXPECTED_EVENT_COUNTS,
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  createModqnReplayPlaybackDisplayState,
  createOmegaRescalarizedModqnReplayPlaybackDisplayState,
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
  assert.equal(visualState.selected.producerBeamId, 'sat-0-beam-1');
  assert.equal(visualState.previous.producerSatId, 'sat-0');
  assert.equal(visualState.selected.producerSatId, 'sat-0');
  assert.deepEqual(
    visualState.previous.position,
    createModqnReplayCanonicalBeamPosition(3),
    'previous serving should use producer localBeamIndex 3 in the canonical display plane',
  );
  assert.deepEqual(
    visualState.selected.position,
    createModqnReplayCanonicalBeamPosition(1),
    'selected serving should use producer localBeamIndex 1 in the canonical display plane',
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
  assert.equal(visualState.previous.producerBeamId, 'sat-0-beam-1');
  assert.equal(visualState.selected.producerBeamId, 'sat-0-beam-1');

  const sharedBeam = visualState.beams.find(beam => beam.canonicalBeamNumber === 2);
  assert.ok(sharedBeam, 'shared previous/selected beam B2 should be present');
  assert.equal(sharedBeam.role, 'previous-and-selected');
  assertNoLiveSceneIdentityLeak(JSON.stringify(visualState));
}

function assertOmegaRescalarizedDisplayState(): void {
  const displayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    false,
    true,
  );
  const focusRow = displayState.currentSlot.focusRow;
  const seededDisplayState = {
    ...displayState,
    currentSlot: {
      ...displayState.currentSlot,
      focusRow: {
        ...focusRow,
        policyDiagnostics: {
          diagnosticsVersion: 'phase-7k-validator-synthetic-topk',
          availableActionCount: 2,
          topCandidates: [
            {
              ...focusRow.selectedServing,
              objectiveQ: {
                r1Throughput: 1,
                r2Handover: 0,
                r3LoadBalance: 0,
              },
            },
            {
              ...focusRow.previousServing,
              objectiveQ: {
                r1Throughput: 10,
                r2Handover: 0,
                r3LoadBalance: 0,
              },
            },
          ],
        },
      },
    },
  };

  const nextDisplayState = createOmegaRescalarizedModqnReplayPlaybackDisplayState(
    seededDisplayState,
    { throughput: 1, handover: 0, loadBalance: 0 },
  );
  assert.ok(nextDisplayState, 'omega re-scalarization should return display state');
  const nextFocusRow = nextDisplayState.currentSlot.focusRow;
  assert.equal(nextFocusRow.selectedServing.beamId, focusRow.previousServing.beamId);
  assert.equal(nextFocusRow.selectedServingSource, 'omega-rescalarized');
  assert.deepEqual(nextFocusRow.producerSelectedServing, focusRow.selectedServing);
  assert.equal(nextFocusRow.producerHandoverEventKind, focusRow.handoverEventKind);
  assert.equal(nextFocusRow.handoverEventKind, 'none');
}

function assertSceneBridgeSource(): void {
  const appSource = readRepoFile('src/App.tsx');
  const mainSceneSource = readRepoFile('src/scene/MainScene.tsx');
  const sceneLayerSource = readReplaySceneLayerSources();
  const helperSource = readRepoFile('src/scene/modqnReplaySceneVisuals.ts');

  assertContains(
    appSource,
    'modqnReplayDisplayState={renderedModqnReplayDisplayState}',
    'App replay-to-scene bridge',
  );
  assertContains(
    appSource,
    "if (handoverMode !== 'decision-overlay-on-live-sinr')",
    'App replay-to-scene mode gate',
  );
  assertContains(
    appSource,
    'createOmegaRescalarizedModqnReplayPlaybackDisplayState',
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
    'SatelliteMarker',
    'R3F replay producer satellite actor',
  );
  assertNotContains(
    sceneLayerSource,
    'BeamDisc',
    'R3F replay layer must not regress to seven debug beam discs',
  );
  assertNotContains(sceneLayerSource, '<planeGeometry', 'R3F replay board must not render a board plane');
  assertNotContains(sceneLayerSource, '<circleGeometry', 'R3F replay board must not render a footprint circle');
  assertNotContains(sceneLayerSource, '<ringGeometry', 'R3F replay board must not render beam rings');
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
    'useReplaySceneTelemetry(visualState, showBoard)',
    'canvas validation attributes must be inactive outside modqn-replay mode',
  );
  assertContains(
    sceneLayerSource,
    'if (!enabled)',
    'canvas validation attributes must be removable when replay layer is inactive',
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
    MODQN_EXPECTED_EVENT_COUNTS['intra-satellite-beam-switch'],
  );
  assert.equal(MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts.none, MODQN_EXPECTED_EVENT_COUNTS.none);
  assert.equal(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts['inter-satellite-handover'],
    MODQN_EXPECTED_EVENT_COUNTS['inter-satellite-handover'],
  );
}

assert.equal(deriveModqnReplaySceneVisualState(null), null);
assertClaimBoundaryCounts();
assertFirstSlotVisualState();
assertNoSwitchSlotVisualState();
assertOmegaRescalarizedDisplayState();
assertSceneBridgeSource();

console.log('MODQN Phase 7K replay scene layer validation passed.');
