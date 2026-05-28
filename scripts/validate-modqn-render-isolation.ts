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
  assert.equal(shell.inclinationDeg, 53, 'MODQN live display uses P=384 natural Walker 53 deg inclination');
  assert.equal(shell.planes, 24, 'MODQN live display uses P=384 pool: 24 Walker planes');
  assert.equal(shell.satsPerPlane, 16, 'MODQN live display uses P=384 pool: 16 satellites per plane');
  assert.equal(
    'serviceAreaPassTargetsSec' in shell,
    false,
    'MODQN live display omits serviceAreaPassTargetsSec so natural Walker propagation is used',
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

function validateModqnNaturalWalkerVisibility(): void {
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const cache = createTrajectoryCache(profile, observer, Date.UTC(2024, 0, 1));
  const gaps: number[] = [];
  let maxVisibleAbove15 = 0;
  let finiteGeoSampleCount = 0;

  for (let tSec = 0; tSec <= 1200; tSec += 20) {
    const visibleAbove15 = interpolateVisibleSats(cache, tSec, true)
      .filter(sat => sat.topo.elevationDeg >= 15);
    maxVisibleAbove15 = Math.max(maxVisibleAbove15, visibleAbove15.length);
    finiteGeoSampleCount += visibleAbove15
      .filter(sat => Number.isFinite(sat.latDeg) && Number.isFinite(sat.lonDeg))
      .length;
    if (visibleAbove15.length === 0) {
      gaps.push(tSec);
    }
  }

  assert.ok(maxVisibleAbove15 >= 8, 'Natural Walker MODQN profile has sampled >=8 satellites above 15deg for serving cap');
  assert.equal(gaps.length, 0, 'P=384 Natural Walker MODQN profile has continuous sampled >15deg coverage');
  assert.ok(finiteGeoSampleCount > 0, 'Visible MODQN satellite samples carry finite real lat/lon for render isolation');
}

validateProfileTruth();
validateRenderIsolationContracts();
validateModqnNaturalWalkerVisibility();

console.log('validate-modqn-render-isolation: PASS');
