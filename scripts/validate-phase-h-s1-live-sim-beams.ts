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
  const renderPlan = readSource('src/scene/sceneLaneRenderPlan.ts');

  const showLiveBeamConesLine = matchLineContaining(renderPlan, 'const showLiveBeamCones =');
  expect(showLiveBeamConesLine !== null, 'MainScene declares showLiveBeamCones');
  expect(
    showLiveBeamConesLine!.includes('showSinrLiveViewport'),
    'H-S1: showLiveBeamCones gate uses the SINR live viewport lane',
  );
  expect(
    !showLiveBeamConesLine!.includes("runtime.appMode !== 'modqn-demo'"),
    'H-S1: showLiveBeamCones no longer gates on runtime.appMode',
  );

  const showLiveSatelliteMarkersLine = matchLineContaining(renderPlan, 'const showLiveSatelliteMarkers =');
  expect(showLiveSatelliteMarkersLine !== null, 'MainScene still declares showLiveSatelliteMarkers');

  const showBeamCalloutsLine = matchLineContaining(renderPlan, 'const showBeamCallouts =');
  expect(showBeamCalloutsLine !== null, 'MainScene still declares showBeamCallouts');

  const showUavLine = matchLineContaining(renderPlan, 'showUav:');
  expect(showUavLine !== null, 'MainScene still declares showUav');

  // The dataset.beamConeCount write was extracted into the dedicated
  // SceneTelemetry bridge (src/scene/SceneTelemetry.tsx). MainScene now exposes
  // the beam cone count telemetry by feeding the live-computed count into that
  // bridge via the beamConeCount={...} prop. Same governance intent (MainScene
  // publishes beam-cone-count telemetry), pinned at its current form.
  assertIncludes(
    source,
    'beamConeCount={',
    'MainScene exposes beam cone count telemetry',
  );
  pass('MainScene exposes beam cone count telemetry');

  // Tier-2 dead-twin retirement: the legacy steered SatelliteBeams render block
  // was gated `showLiveBeamCones && !showSinrLiveCellBeams` — and both equal
  // `showSinrLiveViewport`, so the gate was `X && !X`, provably false on every
  // lane (it never rendered). It is REMOVED. The live-sim beam render on the
  // sinr-live lane is now the earth-fixed cell-truth cones (SinrLiveCellBeamCones,
  // gated by showSinrLiveCellBeams). Same governance intent (MainScene renders the
  // live-sim beams), pinned to the current render owner.
  assertIncludes(
    source,
    '{showSinrLiveCellBeams && (',
    'MainScene gates the live-sim cell-truth beam cones on showSinrLiveCellBeams',
  );
  pass('MainScene gates the live-sim cell-truth beam cones on showSinrLiveCellBeams');

  assertIncludes(
    source,
    'showLiveBeamCones',
    'showLiveBeamCones is referenced (telemetry + render)',
  );
  pass('showLiveBeamCones is referenced (telemetry + render)');

  // The render-plan declaration moved out to sceneLaneRenderPlan.ts (verified by
  // validateNoCrossSliceLeakage), the dataset.beamConeCount write moved into the
  // SceneTelemetry bridge, and the legacy steered SatelliteBeams render gate was
  // retired (Tier-2 dead twin — it never rendered). The two remaining MainScene
  // roles still cover the gate: render-plan binding (destructure) + telemetry
  // (beamConeCount compute).
  const occurrences = (source.match(/showLiveBeamCones/g) ?? []).length;
  expect(occurrences >= 2, `showLiveBeamCones referenced at least 2 times (render-plan binding + telemetry); found ${occurrences}`);

  expect(
    source.includes('SinrLiveCellBeamCones'),
    'MainScene imports / renders the live SinrLiveCellBeamCones component (the sinr-live beam render owner)',
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
    source.includes('resolveSinrLiveCellBeamConeItems'),
    'MainScene derives the live-sim beam render set from the serving cell truth (no stray cones)',
  );

  expect(
    source.includes('footprintRadius'),
    'MainScene threads footprintRadius into the live beam render (paper beamwidth-derived)',
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
  const source = readSource('src/scene/sceneLaneRenderPlan.ts');

  const showLiveBeamConesLines = source
    .split('\n')
    .filter(line => line.includes('const showLiveBeamCones'));
  expectEqual(
    showLiveBeamConesLines.length,
    1,
    'showLiveBeamCones is declared exactly once',
  );
  expect(
    showLiveBeamConesLines[0].includes('showSinrLiveViewport'),
    'showLiveBeamCones declaration is scene-lane-gated',
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
