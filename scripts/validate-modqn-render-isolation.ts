import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import profileJson from '../src/profiles/modqn-4sat-7beam-paper-faithful.json' with { type: 'json' };
import { NTPU_CONFIG, NTPU_LARGE_CONFIG, NTPU_OBSERVER } from '../src/config/ntpu.config';
import { createObserverContext } from '../src/engine/orbit';
import type { Profile } from '../src/profiles/types';
import { createTrajectoryCache, interpolateVisibleSats } from '../src/scene/trajectoryFrame';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = profileJson as Profile;

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function assertIncludes(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), label);
}

function assertNear(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function validateProfileTruth(): void {
  assert.equal(profile.orbit.observerLatDeg, 40, 'MODQN profile uses paper service-area latitude 40N');
  assert.equal(profile.orbit.observerLonDeg, 116, 'MODQN profile uses paper service-area longitude 116E');

  const shell = profile.orbit.shells[0];
  assert.ok(shell, 'MODQN profile has a primary shell');
  assert.equal(shell.altitudeKm, 780, 'MODQN truth altitude remains 780 km');
  assert.equal(shell.inclinationDeg, 90, 'MODQN truth inclination follows producer follow-on baseline');
  assert.equal(shell.planes, 4, 'MODQN live display keeps 4 total satellites via 4 planes');
  assert.equal(shell.satsPerPlane, 1, 'MODQN live display keeps 1 satellite per service-area phased plane');
  assert.deepEqual(
    shell.serviceAreaPassTargetsSec,
    [100, 400, 700, 1000],
    'MODQN live display declares deterministic service-area pass targets',
  );
  assert.equal(shell.phasePerturbation, false, 'MODQN live display disables extra phase perturbation');

  assert.equal(profile.beams.perSatellite, 7, 'MODQN paper baseline keeps 7 beams per satellite');
  assert.equal(profile.beams.maxActivePerSat, 7, 'MODQN display keeps all 7 paper beams active');
  assert.equal(profile.beams.frequencyReuse, 1, 'MODQN paper source has no frequency reuse field');

  assertNear(profile.antenna.beamwidth3dBRad, 2 * Math.PI / 180, 1e-12, 'MODQN theta_3dB is 2 degrees in radians');
  assert.deepEqual(
    profile.handover.modqnWeights,
    { throughput: 0.5, handover: 0.3, loadBalance: 0.2 },
    'MODQN objective weights follow producer primary baseline convention',
  );

  assert.equal(profile.ueDistribution?.mode, 'uniform-rectangle', 'MODQN UE area is paper rectangle');
  assert.equal(profile.ueDistribution?.areaWidthKm, 200, 'MODQN UE area width is 200 km');
  assert.equal(profile.ueDistribution?.areaHeightKm, 90, 'MODQN UE area height is 90 km');
}

function validateRenderIsolationContracts(): void {
  const mainScene = readSource('src/scene/MainScene.tsx');
  const appRuntimeConfig = readSource('src/app/appRuntimeConfig.ts');
  const multiUeState = readSource('src/engine/ue/multiUeState.ts');
  const groundScene = readSource('src/viz/GroundScene.tsx');
  const useBeamViz = readSource('src/scene/useBeamViz.ts');

  assert.equal(NTPU_OBSERVER.latitude, 40, 'scene observer latitude tracks paper center');
  assert.equal(NTPU_OBSERVER.longitude, 116, 'scene observer longitude tracks paper center');
  assert.ok(NTPU_CONFIG.visualSatelliteAltitude < 780, 'SINR visual satellite altitude is compressed');
  assert.ok(NTPU_LARGE_CONFIG.visualSatelliteAltitude < 780, 'MODQN visual satellite altitude is compressed');

  assertIncludes(
    useBeamViz,
    'configuredVisualSatelliteAltitude',
    'useBeamViz prefers explicit visual altitude before physical km scaling',
  );
  assertIncludes(
    mainScene,
    "runtime.appMode === 'modqn-demo' ? 'sphere' : 'cylinder'",
    'MainScene makes UE marker shape mode-gated',
  );
  assertIncludes(
    mainScene,
    "runtime.appMode !== 'modqn-demo'",
    'MainScene gates UAV out of MODQN mode',
  );
  assertIncludes(
    appRuntimeConfig,
    "uePrimaryAnchorMode: input.appMode === 'modqn-demo' ? 'distribution' : 'observer'",
    'appRuntimeConfig keeps MODQN UE0 distribution-sampled while preserving SINR observer anchor',
  );
  assertIncludes(
    multiUeState,
    "primaryAnchorMode === 'observer'",
    'UE generator keeps primary anchoring explicit and mode-gated',
  );
  assertIncludes(
    mainScene,
    'data-testid="render-isolation-probe"',
    'MainScene exposes render isolation probe for browser smoke',
  );
  assertIncludes(
    mainScene,
    'data-ue-primary-anchor-mode',
    'MainScene exposes UE primary anchor mode in render isolation probe',
  );
  assertIncludes(
    mainScene,
    'dataset.beamConeCount',
    'MainScene exposes beam cone count for browser smoke',
  );
  assertIncludes(
    mainScene,
    'dataset.firstUePosition',
    'MainScene exposes first UE position for browser smoke',
  );
  assertIncludes(
    useBeamViz,
    "runtime.appMode === 'modqn-demo'",
    'useBeamViz gates candidate beam promotion to MODQN mode',
  );
  assertIncludes(
    useBeamViz,
    'showModqnCandidateBeams && isPrimary',
    'MODQN no-serving state promotes only the primary candidate beam visually',
  );
  assertIncludes(
    useBeamViz,
    'generateBeamOffsetsKm',
    'MODQN no-serving state has a display-only candidate beam fallback',
  );
  assertIncludes(groundScene, 'markerShape?:', 'GroundScene exposes markerShape prop');
  assertIncludes(groundScene, '<sphereGeometry', 'GroundScene can render spherical UE markers');
  assertIncludes(groundScene, "markerShape = 'cylinder'", 'GroundScene keeps SINR cylinder default');
}

function validateModqnServiceAreaVisibility(): void {
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const cache = createTrajectoryCache(profile, observer, Date.UTC(2024, 0, 1));
  const gaps: number[] = [];

  for (let tSec = 0; tSec <= 1200; tSec += 20) {
    const visibleAbove15 = interpolateVisibleSats(cache, tSec, true)
      .filter(sat => sat.topo.elevationDeg >= 15);
    if (visibleAbove15.length === 0) gaps.push(tSec);
  }

  assert.deepEqual(gaps, [], 'MODQN service-area phased profile has no sampled >15deg visibility gaps');
}

validateProfileTruth();
validateRenderIsolationContracts();
validateModqnServiceAreaVisibility();

console.log('validate-modqn-render-isolation: PASS');
