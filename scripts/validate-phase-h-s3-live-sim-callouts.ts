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

  const calloutLines = renderPlan
    .split('\n')
    .filter(line => line.includes('const showBeamCallouts'));
  expectEqual(calloutLines.length, 1, 'showBeamCallouts is declared exactly once');
  expect(
    calloutLines[0].includes('showLiveBeamCones'),
    'H-S3: showBeamCallouts follows the live beam cone lane gate',
  );
  expect(
    calloutLines[0].includes('input.beamCalloutsEnabled'),
    'H-S3: showBeamCallouts still respects runtime.beamCalloutsEnabled toggle',
  );
  expect(
    !calloutLines[0].includes("runtime.appMode !== 'modqn-demo'"),
    'H-S3: showBeamCallouts no longer hard-gates on runtime.appMode',
  );

  // H-S1 and H-S2 invariants persist.
  const liveBeamLines = renderPlan
    .split('\n')
    .filter(line => line.includes('const showLiveBeamCones'));
  expect(
    liveBeamLines[0]?.includes('showSinrBeamRender') ?? false,
    'H-S3 keeps H-S1 invariant: showLiveBeamCones lane-gated (showSinrBeamRender)',
  );

  const satMarkerLines = renderPlan
    .split('\n')
    .filter(line => line.includes('const showLiveSatelliteMarkers'));
  expect(
    satMarkerLines[0]?.includes('isLiveScene') ?? false,
    'H-S3 keeps H-S2 invariant: showLiveSatelliteMarkers requires live scene source',
  );

  expect(
    renderPlan.includes('showUav: showSinrLiveViewport'),
    'showUav is gated to the SINR live viewport lane',
  );

  // W5 (2026-06-20): the per-beam callout RENDER is reimplemented on the cell-cone
  // lane. The legacy render lived only on the retired steered <SatelliteBeams> (gated
  // `showLiveBeamCones && !showSinrLiveCellBeams` = `X && !X`, never rendered) and was
  // removed; W5 mounts a NEW dumb cell-cone callout layer (<SinrLiveCellBeamCallouts>)
  // under showBeamCallouts, fed by the same cell-truth cone items, so the Beam Info
  // toggle now drives a real render. BeamCalloutContent + <SatelliteBeams> survive only
  // as the vc1c/vc2 fixtures (validateCalloutComponent).
  expect(
    source.includes('<SinrLiveCellBeamCallouts'),
    'H-S3 W5: MainScene mounts the cell-cone Beam-Info callout layer',
  );
  {
    const calloutMountIndex = source.indexOf('<SinrLiveCellBeamCallouts');
    const gateIndex = source.lastIndexOf('showBeamCallouts &&', calloutMountIndex);
    expect(
      gateIndex >= 0 && calloutMountIndex - gateIndex < 200,
      'H-S3 W5: the cell-cone Beam-Info callout layer is gated by showBeamCallouts',
    );
  }

  // Telemetry publication was refactored out of MainScene into the shared
  // SceneTelemetry component: MainScene now threads the live showBeamCallouts
  // value into <SceneTelemetry beamCalloutsEnabled=...>, and SceneTelemetry
  // writes the dataset attribute. Assert the SAME property (MainScene publishes
  // the beamCalloutsEnabled telemetry attribute reflecting showBeamCallouts) at
  // its new location/form.
  expect(
    source.includes("beamCalloutsEnabled={showBeamCallouts ? '1' : '0'}"),
    'MainScene publishes beamCalloutsEnabled telemetry reflecting showBeamCallouts',
  );
  const sceneTelemetry = readSource('src/scene/SceneTelemetry.tsx');
  expect(
    sceneTelemetry.includes('dataset.beamCalloutsEnabled = props.beamCalloutsEnabled'),
    'SceneTelemetry writes the beamCalloutsEnabled dataset attribute',
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

function validateLiveCalloutComponent(): void {
  // W5: the LIVE per-beam callout on the cell-cone lane is the new dumb
  // SinrLiveCellBeamCallouts (NOT the steered BeamCalloutContent). It must keep the
  // beam-callout testid and read the cell-truth surfaces directly.
  const callout = readSource('src/viz/SinrLiveCellBeamCallouts.tsx');
  expect(
    callout.includes('data-testid="beam-callout"'),
    'W5: SinrLiveCellBeamCallouts emits the beam-callout testid',
  );
  expect(
    callout.includes('servingSinrByCellId'),
    'W5: SinrLiveCellBeamCallouts reads the per-cell serving SINR',
  );
  expect(
    callout.includes('SinrLiveCellBeamConeRenderItem'),
    'W5: SinrLiveCellBeamCallouts is fed by the cell-truth cone items (not a steered BeamTarget)',
  );
}

function validateRuntimeToggleUntouched(): void {
  // Tier-3: the beam-callout toggle moved OUT of the runtime config bag into the
  // thin direct-prop BeamDisplaySpec (it is a pure display knob, so it belongs
  // on the direct prop, not the 17-input runtime memo). Same intent — the toggle is
  // still wired — pinned to its new home.
  const beamDisplaySpec = readSource('src/scene/beamDisplaySpec.ts');
  expect(
    beamDisplaySpec.includes('beamCalloutsEnabled'),
    'BeamDisplaySpec wires the beamCalloutsEnabled toggle (moved off the runtime bag, Tier-3)',
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
validateLiveCalloutComponent();
validateRuntimeToggleUntouched();
validateSceneSourceContract();
validateReplayPathUntouched();

assert.ok(PASSED.length >= 16, `expected >= 16 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s3-live-sim-callouts: PASS (${PASSED.length}/0 assertions)`);
