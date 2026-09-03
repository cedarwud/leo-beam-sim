import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE } from './simulationSourceMode';

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');

assert.equal(HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE, false);
assert.match(appSource, /useState<SimulationSourceMode>\(\s*readHomepageSimulationSourceMode/);
assert.match(appSource, /persistSimulationSourceMode\(nextSource\)/);
assert.match(appSource, /HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE[\s\S]*?<SimulationSourceToggle[\s\S]*?value=\{simulationSource\}/);
assert.match(appSource, /const HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE = false/);
assert.match(appSource, /showTeachingAuxiliaryUi=\{HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE\}/);
assert.match(appSource, /data-simulation-source=\{simulationSource\}/);
assert.match(
  appSource,
  /useHomepageCanonicalAnalysis\(\{\s*enabled: isArchivedTleSceneActive,?\s*\}\)/,
  'Walker homepage must not start the archived-TLE analysis producer in the background',
);
assert.match(
  appSource,
  /const isArchivedTleSceneActive = sceneLane === 'sinr-live'[\s\S]*simulationSource === 'archived-tle'/,
);
assert.match(appSource, /simulationSource=\{isArchivedTleSceneActive \? 'archived-tle' : 'walker'\}/);
assert.match(appSource, /canonicalAnalysisError=\{isArchivedTleSceneActive/);
assert.doesNotMatch(appSource, /canonicalAnalysisFrame !== undefined/);
assert.match(appSource, /showHandoverJumpButtons=\{sceneSource === 'live-sim'[\s\S]*isWalkerSceneActive/);
assert.match(appSource, /data-testid="archived-tle-handover-policy-boundary"/);
assert.match(
  appSource,
  /nextSource === 'walker' && walkerRuntimeHasPublishedRef\.current[\s\S]*?requestKey: `source-restore:/,
  'returning to Walker must reconstruct the last published cursor without keeping a hidden runtime mounted',
);

console.log('Homepage defaults to one Walker producer with teaching auxiliary chrome hidden and the source boundary preserved.');
