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
  const renderPlan = readSource('src/scene/sceneLaneRenderPlan.ts');

  const liveSatLines = renderPlan
    .split('\n')
    .filter(line => line.includes('const showLiveSatelliteMarkers'));
  expectEqual(liveSatLines.length, 1, 'showLiveSatelliteMarkers is declared exactly once');
  expect(
    liveSatLines[0].includes('isLiveScene'),
    'H-S2: showLiveSatelliteMarkers gate requires live scene source',
  );
  expect(
    !liveSatLines[0].includes("runtime.appMode !== 'modqn-demo'"),
    'H-S2: showLiveSatelliteMarkers no longer gates on runtime.appMode',
  );

  const liveBeamLines = renderPlan
    .split('\n')
    .filter(line => line.includes('const showLiveBeamCones'));
  expectEqual(liveBeamLines.length, 1, 'showLiveBeamCones is declared exactly once');
  expect(
    liveBeamLines[0].includes('showSinrBeamRender'),
    'H-S2 carries H-S1 invariant: showLiveBeamCones lane-gated (showSinrBeamRender)',
  );

  const beamCalloutLines = renderPlan
    .split('\n')
    .filter(line => line.includes('const showBeamCallouts'));
  expectEqual(beamCalloutLines.length, 1, 'showBeamCallouts is declared exactly once');

  expect(
    renderPlan.includes('showUav: showSinrLiveViewport'),
    'showUav is gated to the SINR live viewport lane',
  );

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
  expect(profileJson.orbit.shells[0].planes === 24, 'Profile uses P=384 pool: 24 Walker planes');
  expect(profileJson.orbit.shells[0].satsPerPlane === 16, 'Profile uses P=384 pool: 16 sats per plane');
  expect(profileJson.orbit.shells[0].inclinationDeg === 53, 'Profile uses P=384 natural Walker 53 deg inclination');
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
