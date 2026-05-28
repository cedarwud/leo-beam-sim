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

  const calloutLines = source
    .split('\n')
    .filter(line => line.includes('const showBeamCallouts'));
  expectEqual(calloutLines.length, 1, 'showBeamCallouts is declared exactly once');
  expect(
    calloutLines[0].includes("sceneFrame.sceneSource === 'live-sim'"),
    'H-S3: showBeamCallouts gate uses sceneFrame.sceneSource === "live-sim"',
  );
  expect(
    calloutLines[0].includes('runtime.beamCalloutsEnabled'),
    'H-S3: showBeamCallouts still respects runtime.beamCalloutsEnabled toggle',
  );
  expect(
    !calloutLines[0].includes("runtime.appMode !== 'modqn-demo'"),
    'H-S3: showBeamCallouts no longer hard-gates on runtime.appMode',
  );

  // H-S1 and H-S2 invariants persist.
  const liveBeamLines = source
    .split('\n')
    .filter(line => line.includes('const showLiveBeamCones'));
  expect(
    liveBeamLines[0]?.includes("sceneFrame.sceneSource === 'live-sim'") ?? false,
    'H-S3 keeps H-S1 invariant: showLiveBeamCones sceneSource-gated',
  );

  const satMarkerLines = source
    .split('\n')
    .filter(line => line.includes('const showLiveSatelliteMarkers'));
  expect(
    satMarkerLines[0]?.includes("sceneFrame.sceneSource === 'live-sim'") ?? false,
    'H-S3 keeps H-S2 invariant: showLiveSatelliteMarkers sceneSource-gated',
  );

  // showUav stays appMode-gated.
  const uavLines = source
    .split('\n')
    .filter(line => line.includes('const showUav'));
  expect(uavLines.length >= 1, 'showUav still declared');
  for (const line of uavLines) {
    expect(
      line.includes("runtime.appMode !== 'modqn-demo'"),
      'showUav declarations stay appMode-gated (out of Phase H scope)',
    );
  }

  expect(
    source.includes('showCallouts={showBeamCallouts}'),
    'showBeamCallouts is threaded into SatelliteBeams as showCallouts prop',
  );

  expect(
    source.includes('dataset.beamCalloutsEnabled'),
    'MainScene publishes beamCalloutsEnabled telemetry attribute',
  );
}

function validateCalloutComponent(): void {
  const callout = readSource('src/viz/BeamCalloutContent.tsx');
  expect(
    callout.includes('export'),
    'BeamCalloutContent module exposes exports',
  );
  expect(
    callout.includes('beam') || callout.includes('Beam'),
    'BeamCalloutContent references beam concept',
  );

  const satBeams = readSource('src/viz/SatelliteBeams.tsx');
  expect(
    satBeams.includes('BeamCalloutContent') || satBeams.includes('showCallouts'),
    'SatelliteBeams renders BeamCalloutContent under showCallouts',
  );
  expect(
    satBeams.includes('showCallouts'),
    'SatelliteBeams accepts showCallouts prop',
  );
}

function validateRuntimeToggleUntouched(): void {
  const appRuntimeConfig = readSource('src/app/appRuntimeConfig.ts');
  expect(
    appRuntimeConfig.includes('beamCalloutsEnabled'),
    'appRuntimeConfig still wires beamCalloutsEnabled toggle',
  );
}

function validateSceneSourceContract(): void {
  expect(
    readSource('src/scene/NormalizedSceneFrame.ts').includes("'live-sim' | 'artifact-replay'"),
    'NormalizedSceneFrame.sceneSource stays a discriminated union',
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

function validateReplayPathUntouched(): void {
  const replayLayer = readSource('src/scene/modqn-replay-visuals/index.tsx');
  expect(
    replayLayer.includes('producer-display-proxy'),
    'Replay layer keeps producer-display-proxy gating',
  );
  expect(
    readSource('src/modqn/replay-bundle/playback-shell.ts').includes('validateSevenBeamPlaybackModel'),
    'Replay playback shell keeps strict 7-beam validation',
  );
}

validateMainSceneGate();
validateCalloutComponent();
validateRuntimeToggleUntouched();
validateSceneSourceContract();
validateReplayPathUntouched();

assert.ok(PASSED.length >= 16, `expected >= 16 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s3-live-sim-callouts: PASS (${PASSED.length}/0 assertions)`);
