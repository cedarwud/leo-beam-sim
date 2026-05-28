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
  expect(showLiveSatelliteMarkersLine !== null, 'MainScene still declares showLiveSatelliteMarkers');

  const showBeamCalloutsLine = matchLineContaining(source, 'const showBeamCallouts =');
  expect(showBeamCalloutsLine !== null, 'MainScene still declares showBeamCallouts');

  const showUavLine = matchLineContaining(source, 'const showUav =');
  expect(showUavLine !== null, 'MainScene still declares showUav');

  assertIncludes(
    source,
    'dataset.beamConeCount',
    'MainScene exposes beam cone count telemetry',
  );
  pass('MainScene exposes beam cone count telemetry');

  assertIncludes(
    source,
    'showLiveBeamCones && !showCellOverlay && viz.displaySats',
    'showLiveBeamCones still gates the legacy SatelliteBeams render block outside the cell lane',
  );
  pass('showLiveBeamCones still gates the legacy SatelliteBeams render block outside the cell lane');

  assertIncludes(
    source,
    'showLiveBeamCones',
    'showLiveBeamCones is referenced (telemetry + render)',
  );
  pass('showLiveBeamCones is referenced (telemetry + render)');

  const occurrences = (source.match(/showLiveBeamCones/g) ?? []).length;
  expect(occurrences >= 4, `showLiveBeamCones referenced at least 4 times (declaration + telemetry + useEffect dep + render gate); found ${occurrences}`);

  expect(
    source.includes('SatelliteBeams'),
    'MainScene imports / renders the live SatelliteBeams component',
  );

  expect(
    source.includes('beamConeCount'),
    'MainScene publishes beamConeCount canvas dataset for browser smoke',
  );

  expect(
    source.includes('viz.satBeams') || source.includes('viz.satBeams.get'),
    'MainScene feeds satBeams from the viz layer into the live-sim beam render',
  );

  expect(
    source.includes('viz.beamSatIds'),
    'MainScene filters live-sim beam render through viz.beamSatIds (no stray cones)',
  );

  expect(
    source.includes('footprintRadius'),
    'MainScene threads footprintRadius into SatelliteBeams (paper beamwidth-derived)',
  );
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
}

function validateProfileUntouched(): void {
  const profileJson = JSON.parse(
    readSource('src/profiles/modqn-4sat-7beam-paper-faithful.json'),
  );
  expect(profileJson.orbit.shells[0].planes === 24, 'Profile uses P=384 pool: 24 Walker planes');
  expect(
    profileJson.orbit.shells[0].satsPerPlane === 16,
    'Profile uses P=384 pool: 16 sats per plane with serving cap L handled by useCellSchedule',
  );
  expect(
    profileJson.orbit.shells[0].inclinationDeg === 53,
    'Profile uses P=384 natural Walker 53° baseline: inclination is 53°',
  );
  expect(profileJson.beams.perSatellite === 7, 'Profile keeps 7 beams per sat');
  expect(
    !('serviceAreaPassTargetsSec' in profileJson.orbit.shells[0]),
    'Profile uses P=384 natural Walker 53° baseline: serviceAreaPassTargetsSec is absent',
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
