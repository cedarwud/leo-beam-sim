import assert from 'node:assert/strict';
import {
  isSceneLaneSourceCompatible,
  resolveSceneLaneRenderPlan,
} from './sceneLaneRenderPlan';

assert.equal(isSceneLaneSourceCompatible({
  sceneLane: 'sinr-live',
  sceneSource: 'archived-tle',
}), true);
assert.equal(isSceneLaneSourceCompatible({
  sceneLane: 'artifact-replay',
  sceneSource: 'archived-tle',
}), false);

const plan = resolveSceneLaneRenderPlan({
  sceneLane: 'sinr-live',
  sceneSource: 'archived-tle',
  beamCalloutsEnabled: true,
  beamDensity: 'event-plus-1',
  cinematicMode: 'off',
  effectsEnabled: {
    servingRipple: true,
    pendingRipple: true,
    spineParticles: true,
    orbitTrail: true,
  },
  paused: false,
  reducedMotion: false,
  recentHoActive: false,
});

assert.equal(plan.sourceCompatible, true);
assert.equal(plan.isLiveScene, true);
assert.equal(plan.showSinrLiveCellBeams, true);
assert.equal(plan.showSinrLiveHandoverPulse, true);
assert.equal(plan.showHandoverToastOverlay, true);
assert.equal(plan.showLiveSatelliteMarkers, true);

console.log('archived TLE is compatible only with the SINR simulation renderer.');
