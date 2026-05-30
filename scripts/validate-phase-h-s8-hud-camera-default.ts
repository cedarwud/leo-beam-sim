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

function validateCameraDefault(): void {
  const source = readSource('src/App.tsx');
  expect(
    source.includes('modqnDemoCameraAppliedRef'),
    'App.tsx declares modqnDemoCameraAppliedRef',
  );
  expect(
    source.includes("camera.selectCameraPreset('oblique')"),
    'App.tsx schedules oblique preset on modqn-demo entry (Phase I pull-back from too-close closeup)',
  );
  expect(
    source.includes("appMode === 'modqn-demo' && !modqnDemoCameraAppliedRef.current"),
    'Camera default applied once per modqn-demo session entry',
  );
  expect(
    source.includes("appMode !== 'modqn-demo'") && source.includes('modqnDemoCameraAppliedRef.current = false'),
    'Ref resets when leaving modqn-demo so re-entry re-applies the default',
  );

  const mainScene = readSource('src/scene/MainScene.tsx');
  expect(
    mainScene.includes("'paper-faithful-closeup'"),
    'MainScene exposes paper-faithful-closeup camera preset',
  );
}

function validateHudComponent(): void {
  const source = readSource('src/ui/modqn-controls/ModqnSceneHud.tsx');
  expect(source.includes('export function ModqnSceneHud'), 'ModqnSceneHud exported');
  expect(
    source.includes("if (appMode !== 'modqn-demo') return null"),
    'HUD renders null outside modqn-demo',
  );
  expect(source.includes("data-testid=\"modqn-scene-hud\""), 'HUD root testid present');
  expect(source.includes("data-testid=\"modqn-scene-hud-sim-time\""), 'HUD sim-time testid present');
  expect(source.includes("data-testid=\"modqn-scene-hud-intra-ho\""), 'HUD intra-HO testid present');
  expect(source.includes("data-testid=\"modqn-scene-hud-inter-ho\""), 'HUD inter-HO testid present');
  expect(
    source.includes('live-sim · profile-derived'),
    'Truth chip surfaces live-sim profile-derived label',
  );
  expect(
    source.includes('paper-faithful replay') && source.includes('user-trained replay'),
    'Truth chip distinguishes paper-faithful vs user-trained replay',
  );
  expect(
    source.includes('§4.4') && source.includes('modqn-training-truth-visualization-sdd'),
    'HUD comments cite training-truth SDD §4.4 boundary',
  );
}

function validateHudMount(): void {
  const source = readSource('src/App.tsx');
  expect(
    source.includes("import { ModqnSceneHud } from './ui/modqn-controls/ModqnSceneHud'"),
    'App.tsx imports ModqnSceneHud',
  );
  expect(source.includes('<ModqnSceneHud'), 'App.tsx mounts <ModqnSceneHud />');
  expect(
    source.includes('sceneSource={sceneSource}'),
    'App.tsx threads sceneSource into HUD truth chip',
  );
  expect(
    source.includes('bundleProvenanceKind={bundleProvenanceKind}'),
    'App.tsx threads bundleProvenanceKind into HUD truth chip',
  );
  expect(
    source.includes('simState={simState}'),
    'App.tsx threads simState into HUD',
  );
}

function validatePhaseHInvariantsPreserved(): void {
  const source = readSource('src/scene/MainScene.tsx');
  const renderPlan = readSource('src/scene/sceneLaneRenderPlan.ts');
  expect(
    renderPlan.includes('const showLiveBeamCones = showSinrLiveViewport;'),
    'H-S1 invariant preserved',
  );
  expect(
    renderPlan.includes('const showLiveSatelliteMarkers =')
      && renderPlan.includes('isLiveScene'),
    'H-S2 invariant preserved',
  );
  expect(
    source.includes('<InterHandoverArrow'),
    'H-S6 InterHandoverArrow still mounted',
  );
}

function validateProfileUntouched(): void {
  const profileJson = JSON.parse(
    readSource('src/profiles/modqn-4sat-7beam-paper-faithful.json'),
  );
  expect(profileJson.orbit.shells[0].planes === 24, 'Profile uses P=384 pool: 24 Walker planes');
  expect(profileJson.orbit.shells[0].satsPerPlane === 16, 'Profile uses P=384 pool: 16 sats per plane');
  expect(profileJson.beams.perSatellite === 7, 'Profile still 7 beams per sat');
}

validateCameraDefault();
validateHudComponent();
validateHudMount();
validatePhaseHInvariantsPreserved();
validateProfileUntouched();

assert.ok(PASSED.length >= 18, `expected >= 18 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s8-hud-camera-default: PASS (${PASSED.length}/0 assertions)`);
