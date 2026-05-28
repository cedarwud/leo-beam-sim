import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function assertIncludes(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), label);
}

function assertNotIncludes(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), label);
}

function matchLineContaining(source: string, anchor: string): string | null {
  const lines = source.split('\n');
  for (const line of lines) {
    if (line.includes(anchor)) return line;
  }
  return null;
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

  const showLiveBeamConesLine = matchLineContaining(source, 'const showLiveBeamCones =');
  expect(showLiveBeamConesLine !== null, 'MainScene declares showLiveBeamCones');
  expect(
    showLiveBeamConesLine!.includes("sceneFrame.sceneSource === 'live-sim'"),
    'H-S1: showLiveBeamCones gate uses sceneFrame.sceneSource === "live-sim"',
  );
  expect(
    !showLiveBeamConesLine!.includes("runtime.appMode !== 'modqn-demo'"),
    'H-S1: showLiveBeamCones no longer gates on runtime.appMode',
  );

  const showLiveSatelliteMarkersLine = matchLineContaining(source, 'const showLiveSatelliteMarkers =');
  expect(showLiveSatelliteMarkersLine !== null, 'MainScene declares showLiveSatelliteMarkers');
  expect(
    showLiveSatelliteMarkersLine!.includes("runtime.appMode !== 'modqn-demo'"),
    'H-S1 boundary: showLiveSatelliteMarkers is still appMode-gated (H-S2 handles it)',
  );

  const showBeamCalloutsLine = matchLineContaining(source, 'const showBeamCallouts =');
  expect(showBeamCalloutsLine !== null, 'MainScene declares showBeamCallouts');
  expect(
    showBeamCalloutsLine!.includes("runtime.appMode !== 'modqn-demo'"),
    'H-S1 boundary: showBeamCallouts is still appMode-gated (H-S3 handles it)',
  );

  const showUavLine = matchLineContaining(source, 'const showUav =');
  expect(showUavLine !== null, 'MainScene declares showUav');
  expect(
    showUavLine!.includes("runtime.appMode !== 'modqn-demo'"),
    'H-S1 boundary: showUav is still appMode-gated (out of Phase H scope)',
  );

  assertIncludes(
    source,
    'dataset.beamConeCount',
    'MainScene exposes beam cone count telemetry',
  );
  pass('MainScene exposes beam cone count telemetry');

  assertIncludes(
    source,
    'showLiveBeamCones && viz.displaySats',
    'showLiveBeamCones still gates the SatelliteBeams render block',
  );
  pass('showLiveBeamCones still gates the SatelliteBeams render block');

  assertIncludes(
    source,
    'showLiveBeamCones',
    'showLiveBeamCones is referenced (telemetry + render)',
  );
  pass('showLiveBeamCones is referenced (telemetry + render)');
}

function validateSceneSourceContract(): void {
  const source = readSource('src/scene/NormalizedSceneFrame.ts');
  assertIncludes(
    source,
    "'live-sim' | 'artifact-replay'",
    'NormalizedSceneFrame.sceneSource is a discriminated union',
  );
  pass('NormalizedSceneFrame.sceneSource is a discriminated union');

  const liveSim = readSource('src/showcase/liveSimToScene.ts');
  assertIncludes(
    liveSim,
    "sceneSource: 'live-sim'",
    'liveSimToScene emits sceneSource=live-sim',
  );
  pass('liveSimToScene emits sceneSource=live-sim');

  const replay = readSource('src/showcase/showcaseArtifactToScene.ts');
  assertIncludes(
    replay,
    "sceneSource: 'artifact-replay'",
    'showcaseArtifactToScene emits sceneSource=artifact-replay',
  );
  pass('showcaseArtifactToScene emits sceneSource=artifact-replay');
}

function validateNoCrossSliceLeakage(): void {
  const source = readSource('src/scene/MainScene.tsx');

  const showLiveBeamConesLines = source
    .split('\n')
    .filter(line => line.includes('const showLiveBeamCones'));
  expectEqual(
    showLiveBeamConesLines.length,
    1,
    'showLiveBeamCones is declared exactly once',
  );
  expect(
    showLiveBeamConesLines[0].includes("sceneFrame.sceneSource === 'live-sim'"),
    'showLiveBeamCones declaration is sceneSource-gated',
  );

  const liveSatLines = source
    .split('\n')
    .filter(line => line.includes('const showLiveSatelliteMarkers'));
  expectEqual(liveSatLines.length, 1, 'showLiveSatelliteMarkers is declared exactly once');
  expect(
    liveSatLines[0].includes("runtime.appMode !== 'modqn-demo'"),
    'showLiveSatelliteMarkers still appMode-gated (H-S2 reserved)',
  );

  const beamCalloutLines = source
    .split('\n')
    .filter(line => line.includes('const showBeamCallouts'));
  expectEqual(beamCalloutLines.length, 1, 'showBeamCallouts is declared exactly once');
  expect(
    beamCalloutLines[0].includes("runtime.appMode !== 'modqn-demo'"),
    'showBeamCallouts still appMode-gated (H-S3 reserved)',
  );

  const uavLines = source
    .split('\n')
    .filter(line => line.includes('const showUav'));
  expect(uavLines.length >= 1, 'showUav is declared at least once (SceneContent + MainScene wrapper)');
  for (const line of uavLines) {
    expect(
      line.includes("runtime.appMode !== 'modqn-demo'"),
      'every showUav declaration is still appMode-gated (out of Phase H scope)',
    );
  }
}

function validateProfileUntouched(): void {
  const profileJson = JSON.parse(
    readSource('src/profiles/modqn-4sat-7beam-paper-faithful.json'),
  );
  expect(profileJson.orbit.shells[0].planes === 4, 'Profile keeps 4 planes (H-S5 reserved)');
  expect(profileJson.orbit.shells[0].satsPerPlane === 1, 'Profile keeps 1 sat per plane (H-S5 reserved)');
  expect(profileJson.beams.perSatellite === 7, 'Profile keeps 7 beams per sat');
  expect(
    Array.isArray(profileJson.orbit.shells[0].serviceAreaPassTargetsSec),
    'Profile keeps serviceAreaPassTargetsSec scripted schedule (H-S5 reserved)',
  );
  expect(
    profileJson.beamHopping.enabled === false,
    'Profile keeps beamHopping disabled (H-S4 reserved)',
  );
}

function validateReplayPathUntouched(): void {
  const replayLayer = readSource('src/scene/modqn-replay-visuals/index.tsx');
  assertIncludes(
    replayLayer,
    'producer-display-proxy',
    'Replay layer keeps producer-display-proxy gating',
  );
  pass('Replay layer keeps producer-display-proxy gating');

  const playbackShell = readSource('src/modqn/replay-bundle/playback-shell.ts');
  assertIncludes(
    playbackShell,
    'validateSevenBeamPlaybackModel',
    'Replay playback shell keeps strict 7-beam validation',
  );
  pass('Replay playback shell keeps strict 7-beam validation');
}

validateMainSceneGate();
validateSceneSourceContract();
validateNoCrossSliceLeakage();
validateProfileUntouched();
validateReplayPathUntouched();

assert.ok(PASSED.length >= 25, `expected >= 25 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s1-live-sim-beams: PASS (${PASSED.length}/0 assertions)`);
