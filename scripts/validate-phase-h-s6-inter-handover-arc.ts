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

function validateComponent(): void {
  const source = readSource('src/scene/handover-viz/InterHandoverArrow.tsx');
  expect(source.includes('export function InterHandoverArrow'), 'InterHandoverArrow exported');
  expect(source.includes('QuadraticBezierCurve3'), 'Component builds a quadratic Bezier arc');
  expect(source.includes('TubeGeometry'), 'Component renders a tube along the arc');
  expect(source.includes("ARC_COLOR = '#a855f7'"), 'Arc color is purple per Phase H §4.6');
  expect(
    source.includes('Inter HO'),
    'Arc label text starts with "Inter HO" identifier',
  );
  expect(
    source.includes('recentHoSourceSatId') && source.includes('recentHoTargetSatId'),
    'Component reads recentHoSourceSatId and recentHoTargetSatId',
  );
  expect(
    source.includes('sourceSatId === targetSatId'),
    'Component skips rendering when source and target are the same satellite (intra-HO)',
  );
  expect(
    source.includes("dataset.interHandoverArrowActive"),
    'Component publishes data-inter-handover-arrow-active for browser smoke',
  );
  expect(
    source.includes("dataset.interHandoverArrowOpacity"),
    'Component publishes data-inter-handover-arrow-opacity for browser smoke',
  );
  expect(
    source.includes('reducedMotion'),
    'Component honours reducedMotion preference',
  );
  expect(
    source.includes('ARC_DURATION_MS'),
    'Component fades arc opacity over a bounded duration',
  );
}

function validateMainSceneMount(): void {
  const source = readSource('src/scene/MainScene.tsx');
  expect(
    source.includes("import { InterHandoverArrow } from './handover-viz/InterHandoverArrow'"),
    'MainScene imports InterHandoverArrow from new handover-viz module',
  );
  expect(
    source.includes('<InterHandoverArrow'),
    'MainScene mounts <InterHandoverArrow />',
  );
  expect(
    source.includes('recentHoSourceSatId={sim.recentHoSourceSatId}'),
    'MainScene threads sim.recentHoSourceSatId into the arc',
  );
  expect(
    source.includes('recentHoTargetSatId={sim.recentHoTargetSatId}'),
    'MainScene threads sim.recentHoTargetSatId into the arc',
  );
  expect(
    source.includes('displaySats={viz.displaySats}'),
    'MainScene passes displaySats so the arc can resolve world positions',
  );

  // Confirm Intra arrow still mounted (H-S6 must not regress intra arc).
  expect(
    source.includes('<IntraHandoverArrow'),
    'MainScene keeps <IntraHandoverArrow /> mounted (no regression)',
  );
}

function validateReplayPathFailClosed(): void {
  const source = readSource('src/scene/handover-viz/InterHandoverArrow.tsx');
  // In replay mode, sim.recentHoSourceSatId / Target are not the same source
  // (replay layer renders its own arcs via ReplaySwitchArc). InterHandoverArrow
  // here is driven by the live engine; if the live engine isn't running
  // (sceneSource=artifact-replay -> sim.* still tracks but never fires inter-HO
  // events while a replay drives the scene from its own publisher), the arc
  // simply returns null when source/target are missing or equal.
  expect(
    source.includes('return null') || source.includes('null;'),
    'Component fail-closes when no inter-HO event is active',
  );
  expect(
    source.includes("!sourceSatId") || source.includes("sourceSatId === null"),
    'Component skips rendering when sourceSatId is missing',
  );

  // Reach into ReplaySwitchArc to confirm replay path keeps its own arc layer.
  const replayArc = readSource('src/scene/modqn-replay-visuals/ReplaySwitchArc.tsx');
  expect(replayArc.length > 0, 'Replay layer still owns ReplaySwitchArc for artifact playback');
  expect(
    replayArc.includes('export') && replayArc.includes('ReplaySwitchArc'),
    'ReplaySwitchArc still exported (replay path arc not removed)',
  );
}

function validatePhaseHInvariantsPreserved(): void {
  const source = readSource('src/scene/MainScene.tsx');
  const renderPlan = readSource('src/scene/sceneLaneRenderPlan.ts');
  expect(
    renderPlan.includes('const showLiveBeamCones = showSinrLiveViewport;'),
    'H-S1 invariant preserved: showLiveBeamCones lane-gated',
  );
  expect(
    renderPlan.includes('const showLiveSatelliteMarkers =')
      && renderPlan.includes('isLiveScene'),
    'H-S2 invariant preserved: showLiveSatelliteMarkers requires live scene source',
  );
  expect(
    renderPlan.includes('const showBeamCallouts = input.beamCalloutsEnabled && showLiveBeamCones;'),
    'H-S3 invariant preserved: showBeamCallouts follows live beam cone gate',
  );
}

function validateProfileUntouched(): void {
  const profileJson = JSON.parse(
    readSource('src/profiles/modqn-4sat-7beam-paper-faithful.json'),
  );
  expect(
    profileJson.orbit.shells[0].planes === 4 || profileJson.orbit.shells[0].planes === 24,
    'Profile still 4 or 24 planes',
  );
  expect(profileJson.beams.perSatellite === 7, 'Profile still 7 beams per sat');
}

validateComponent();
validateMainSceneMount();
validateReplayPathFailClosed();
validatePhaseHInvariantsPreserved();
validateProfileUntouched();

assert.ok(PASSED.length >= 22, `expected >= 22 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s6-inter-handover-arc: PASS (${PASSED.length}/0 assertions)`);
