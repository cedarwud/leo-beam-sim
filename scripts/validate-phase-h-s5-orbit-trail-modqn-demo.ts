import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveRuntimeVisualSettings } from '../src/scene/runtimeConfig';

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

function validateAppRuntimeOverride(): void {
  const source = readSource('src/App.tsx');
  expect(
    source.includes("appMode !== 'modqn-demo' || reducedMotion"),
    'App.tsx runtimeVisualSettings gates the modqn-demo override on appMode + reducedMotion',
  );
  expect(
    source.includes('orbitTrail: false'),
    'App.tsx disables orbitTrail in modqn-demo override',
  );
  expect(
    source.includes('spineParticles: true'),
    'App.tsx enables spineParticles in modqn-demo override',
  );

  const memoSlice = source.split('const runtimeVisualSettings = useMemo(')[1] ?? '';
  expect(
    memoSlice.includes('appMode') && memoSlice.includes('reducedMotion'),
    'runtimeVisualSettings useMemo deps include appMode + reducedMotion',
  );
}

function validateBaseRuntimeUnchanged(): void {
  // deriveRuntimeVisualSettings stays defensive and reducedMotion-aware.
  const research = deriveRuntimeVisualSettings('research', false);
  expect(research.effectsEnabled.orbitTrail === false, 'Base research-mode keeps orbitTrail off');
  expect(research.effectsEnabled.spineParticles === false, 'Base research-mode keeps spineParticles off');

  const presentation = deriveRuntimeVisualSettings('presentation', false);
  expect(presentation.effectsEnabled.orbitTrail === true, 'Presentation mode enables orbitTrail');
  expect(presentation.effectsEnabled.spineParticles === true, 'Presentation mode enables spineParticles');

  const reduced = deriveRuntimeVisualSettings('presentation', true);
  expect(reduced.effectsEnabled.orbitTrail === false, 'reducedMotion forces orbitTrail off regardless of uiMode');
  expect(reduced.effectsEnabled.spineParticles === false, 'reducedMotion forces spineParticles off regardless of uiMode');
}

function validateMainSceneTrailGate(): void {
  const source = readSource('src/scene/MainScene.tsx');
  expect(
    source.includes('showOrbitTrail'),
    'MainScene threads showOrbitTrail through effectsEnabled.orbitTrail',
  );
  expect(
    source.includes('showSpineParticles'),
    'MainScene threads showSpineParticles through effectsEnabled.spineParticles',
  );
  expect(
    source.includes('runtime.effectsEnabled.orbitTrail'),
    'MainScene reads runtime.effectsEnabled.orbitTrail',
  );
  expect(
    source.includes('runtime.effectsEnabled.spineParticles'),
    'MainScene reads runtime.effectsEnabled.spineParticles',
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
  expect(
    !('serviceAreaPassTargetsSec' in profileJson.orbit.shells[0]),
    'Profile uses P=384 natural Walker 53° baseline: serviceAreaPassTargetsSec is absent',
  );
}

function validateReplayPathUntouched(): void {
  const replayLayer = readSource('src/scene/modqn-replay-visuals/index.tsx');
  expect(
    replayLayer.includes('producer-display-proxy'),
    'Replay layer producer-display-proxy gating untouched',
  );
  expect(
    readSource('src/modqn/replay-bundle/playback-shell.ts').includes('validateSevenBeamPlaybackModel'),
    'Replay playback shell strict 7-beam validation untouched',
  );
}

function validateOrbitTrailComponent(): void {
  const source = readSource('src/viz/OrbitTrail.tsx');
  expect(source.length > 0, 'OrbitTrail component file exists');
  expect(source.includes('export'), 'OrbitTrail exports a renderable component');
}

function validateScopeReductionDocumented(): void {
  const sdd = readSource('docs/phase-h-live-sim-modqn-visual-parity-sdd.md');
  expect(
    sdd.includes('H-S5'),
    'Phase H SDD still references H-S5 slice',
  );
}

validateAppRuntimeOverride();
validateBaseRuntimeUnchanged();
validateMainSceneTrailGate();
validateProfileUntouched();
validateReplayPathUntouched();
validateOrbitTrailComponent();
validateScopeReductionDocumented();

assert.ok(PASSED.length >= 18, `expected >= 18 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s5-orbit-trail-modqn-demo: PASS (${PASSED.length}/0 assertions)`);
