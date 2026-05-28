import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

const PASSED: string[] = [];

function pass(label: string): void {
  PASSED.push(label);
}

function expect(condition: boolean, label: string): void {
  assert.ok(condition, label);
  pass(label);
}

function expectEqual<T>(actual: T, expected: T, label: string): void {
  assert.deepEqual(actual, expected, label);
  pass(label);
}

function validateMainSceneGate(): void {
  const source = readSource('src/scene/MainScene.tsx');

  const liveSatLines = source
    .split('\n')
    .filter(line => line.includes('const showLiveSatelliteMarkers'));
  expectEqual(liveSatLines.length, 1, 'showLiveSatelliteMarkers is declared exactly once');
  expect(
    liveSatLines[0].includes("sceneFrame.sceneSource === 'live-sim'"),
    'H-S2: showLiveSatelliteMarkers gate uses sceneFrame.sceneSource === "live-sim"',
  );
  expect(
    !liveSatLines[0].includes("runtime.appMode !== 'modqn-demo'"),
    'H-S2: showLiveSatelliteMarkers no longer gates on runtime.appMode',
  );

  const liveBeamLines = source
    .split('\n')
    .filter(line => line.includes('const showLiveBeamCones'));
  expectEqual(liveBeamLines.length, 1, 'showLiveBeamCones is declared exactly once');
  expect(
    liveBeamLines[0].includes("sceneFrame.sceneSource === 'live-sim'"),
    'H-S2 carries H-S1 invariant: showLiveBeamCones sceneSource-gated',
  );

  const beamCalloutLines = source
    .split('\n')
    .filter(line => line.includes('const showBeamCallouts'));
  expectEqual(beamCalloutLines.length, 1, 'showBeamCallouts is declared exactly once');

  const uavLines = source
    .split('\n')
    .filter(line => line.includes('const showUav'));
  expect(uavLines.length >= 1, 'showUav declared (SceneContent + MainScene wrapper)');
  for (const line of uavLines) {
    expect(
      line.includes("runtime.appMode !== 'modqn-demo'"),
      'showUav declarations stay appMode-gated (out of Phase H scope)',
    );
  }

  expect(
    source.includes('viz.displaySats.map(sat => ('),
    'MainScene maps displaySats through SatelliteMarker render',
  );
  expect(
    source.includes('showLiveSatelliteMarkers && viz.displaySats.map'),
    'showLiveSatelliteMarkers still gates the SatelliteMarker map',
  );
}

function validateSatelliteMarkerContract(): void {
  const marker = readSource('src/viz/SatelliteMarker.tsx');
  expect(marker.includes('eventRole'), 'SatelliteMarker accepts eventRole prop for replay tint');
  expect(
    marker.includes('label') || marker.includes('Label'),
    'SatelliteMarker renders label text',
  );
}

function validateSceneSourceContract(): void {
  const source = readSource('src/scene/NormalizedSceneFrame.ts');
  expect(
    source.includes("'live-sim' | 'artifact-replay'"),
    'NormalizedSceneFrame.sceneSource discriminator stays a union',
  );
  expect(
    readSource('src/showcase/liveSimToScene.ts').includes("sceneSource: 'live-sim'"),
    'liveSimToScene emits sceneSource=live-sim',
  );
  expect(
    readSource('src/showcase/showcaseArtifactToScene.ts').includes("sceneSource: 'artifact-replay'"),
    'showcaseArtifactToScene emits sceneSource=artifact-replay',
  );
}

function validateProfileUntouched(): void {
  const profileJson = JSON.parse(
    readSource('src/profiles/modqn-4sat-7beam-paper-faithful.json'),
  );
  expect(profileJson.orbit.shells[0].planes === 4, 'Profile keeps 4 planes (H-S5 reserved)');
  expect(profileJson.orbit.shells[0].satsPerPlane === 1, 'Profile keeps 1 sat per plane');
  expect(profileJson.beams.perSatellite === 7, 'Profile keeps 7 beams per sat');
  expect(
    profileJson.beamHopping.enabled === false,
    'Profile keeps beamHopping disabled (H-S4 reserved)',
  );
}

function validateReplayPathUntouched(): void {
  const replayLayer = readSource('src/scene/modqn-replay-visuals/index.tsx');
  expect(
    replayLayer.includes('producer-display-proxy'),
    'Replay layer keeps producer-display-proxy gating',
  );
  expect(
    replayLayer.includes('SatelliteMarker'),
    'Replay layer still uses SatelliteMarker for its proxy markers',
  );

  const playbackShell = readSource('src/modqn/replay-bundle/playback-shell.ts');
  expect(
    playbackShell.includes('validateSevenBeamPlaybackModel'),
    'Replay playback shell keeps strict 7-beam validation',
  );
}

validateMainSceneGate();
validateSatelliteMarkerContract();
validateSceneSourceContract();
validateProfileUntouched();
validateReplayPathUntouched();

assert.ok(PASSED.length >= 18, `expected >= 18 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s2-live-sim-sat-markers: PASS (${PASSED.length}/0 assertions)`);
