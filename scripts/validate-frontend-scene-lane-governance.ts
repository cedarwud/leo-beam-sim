import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveSceneLane,
  shouldRenderModqnReplayScene,
} from '../src/app/sceneLane.ts';
import {
  resolveTimelineRailDescriptor,
} from '../src/app/timelineRailAuthority.ts';
import {
  getDefaultLeftSidebarTabForSceneLane,
  getDefaultRightSidebarTabForSceneLane,
  getLeftSidebarTabsForSceneLane,
  getRightSidebarTabsForSceneLane,
} from '../src/app/appRuntimeModel.ts';
import {
  isSceneLaneSourceCompatible,
  resolveSceneLaneRenderPlan,
  resolveSceneLaneUeMarkerShape,
} from '../src/scene/sceneLaneRenderPlan.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function readRepoFile(path: string): string {
  return readFileSync(join(ROOT_DIR, path), 'utf8');
}

function assertContains(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function assertNotContains(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label} unexpectedly contains ${needle}`);
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function tabKeys<T extends string>(tabs: readonly { readonly key: T }[]): T[] {
  return tabs.map(tab => tab.key);
}

function renderPlan(
  sceneLane: Parameters<typeof resolveSceneLaneRenderPlan>[0]['sceneLane'],
  sceneSource: Parameters<typeof resolveSceneLaneRenderPlan>[0]['sceneSource'],
  replayProofLayerRequested = false,
): ReturnType<typeof resolveSceneLaneRenderPlan> {
  return resolveSceneLaneRenderPlan({
    sceneLane,
    sceneSource,
    beamCalloutsEnabled: true,
    beamDensity: 'all',
    cinematicMode: 'spotlight',
    effectsEnabled: {
      servingRipple: true,
      pendingRipple: true,
      orbitTrail: true,
      spineParticles: true,
    },
    paused: false,
    reducedMotion: false,
    recentHoActive: false,
    replayProofLayerRequested,
  });
}

assert.equal(
  resolveSceneLane({ appMode: 'sinr-experiment', sceneSource: 'live-sim' }),
  'sinr-live',
  'SINR live mode should resolve to the SINR scene lane',
);
assert.equal(
  resolveSceneLane({ appMode: 'modqn-demo', sceneSource: 'live-sim' }),
  'modqn-live-cell-preview',
  'MODQN live mode should default to the clean cell preview lane',
);
assert.equal(
  resolveSceneLane({ appMode: 'modqn-demo', sceneSource: 'live-sim', modqnReplayProofRequested: true }),
  'modqn-replay-proof',
  'MODQN replay proof should require an explicit proof request',
);
assert.equal(
  resolveSceneLane({ appMode: 'modqn-demo', sceneSource: 'artifact-replay', modqnReplayProofRequested: true }),
  'artifact-replay',
  'artifact replay should outrank app mode and proof request',
);
assert.equal(
  shouldRenderModqnReplayScene('sinr-live'),
  false,
  'SINR lane must not render MODQN replay proof',
);
assert.equal(
  shouldRenderModqnReplayScene('modqn-live-cell-preview'),
  false,
  'MODQN live cell preview must not render MODQN replay proof',
);
assert.equal(
  shouldRenderModqnReplayScene('artifact-replay'),
  false,
  'artifact replay must not render MODQN replay proof',
);
assert.equal(
  shouldRenderModqnReplayScene('modqn-replay-proof'),
  true,
  'only the explicit MODQN replay proof lane may render the replay scene layer',
);

assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'sinr-live', sceneSource: 'live-sim' }), true);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'modqn-live-cell-preview', sceneSource: 'live-sim' }), true);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'modqn-replay-proof', sceneSource: 'live-sim' }), true);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'artifact-replay', sceneSource: 'artifact-replay' }), true);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'artifact-replay', sceneSource: 'live-sim' }), false);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'sinr-live', sceneSource: 'artifact-replay' }), false);
assert.equal(resolveSceneLaneUeMarkerShape('sinr-live'), 'cylinder');
assert.equal(resolveSceneLaneUeMarkerShape('modqn-live-cell-preview'), 'sphere');
assert.equal(resolveSceneLaneUeMarkerShape('modqn-replay-proof'), 'sphere');
assert.equal(resolveSceneLaneUeMarkerShape('artifact-replay'), 'sphere');

{
  const sinr = renderPlan('sinr-live', 'live-sim');
  assert.equal(sinr.sourceCompatible, true, 'SINR live source should be compatible');
  assert.equal(sinr.showLiveSceneEffects, true, 'SINR live should own live effects');
  assert.equal(sinr.showCinematicSpotlight, true, 'SINR live should own spotlight effects when requested');
  assert.equal(sinr.effectiveCinematicMode, 'spotlight', 'SINR live may keep spotlight mode');
  assert.equal(sinr.showUav, true, 'SINR live should own UAV visibility');
  assert.equal(sinr.showCellOverlay, false, 'SINR live should not own MODQN cell overlay');
  assert.equal(sinr.showReplayProofLayer, false, 'SINR live should not own MODQN replay proof');
  assert.equal(sinr.handoverStoryLayerPolicy, 'sinr-live', 'SINR live should keep the SINR handover story path');
  assert.equal(sinr.showProfileHandoverStoryLayer, false, 'SINR live must not mount the profile-derived story overlay');

  const cellPreview = renderPlan('modqn-live-cell-preview', 'live-sim');
  assert.equal(cellPreview.sourceCompatible, true, 'MODQN cell lane live source should be compatible');
  assert.equal(cellPreview.showCellOverlay, true, 'MODQN cell lane should own cell overlay');
  assert.equal(cellPreview.showLiveSatelliteMarkers, true, 'MODQN cell lane should keep satellite anchors');
  assert.equal(cellPreview.showLiveBeamCones, false, 'MODQN cell lane should hide legacy live beam cones');
  assert.equal(cellPreview.showLiveSceneEffects, false, 'MODQN cell lane should not inherit SINR live effects');
  assert.equal(cellPreview.showCinematicSpotlight, false, 'MODQN cell lane should not inherit spotlight effects');
  assert.equal(cellPreview.effectiveCinematicMode, 'off', 'MODQN cell lane should force cinematic mode off');
  assert.equal(cellPreview.handoverStoryLayerPolicy, 'profile-derived-demo', 'MODQN cell lane may own the profile-derived story overlay');
  assert.equal(cellPreview.showProfileHandoverStoryLayer, true, 'MODQN cell lane should mount the profile-derived story overlay');

  const proof = renderPlan('modqn-replay-proof', 'live-sim', true);
  assert.equal(proof.sourceCompatible, true, 'MODQN proof lane live source should be compatible');
  assert.equal(proof.showReplayProofLayer, true, 'MODQN proof lane should honor explicit proof request');
  assert.equal(proof.showCellOverlay, false, 'MODQN proof lane should not render cell overlay');
  assert.equal(proof.showLiveBeamCones, false, 'MODQN proof lane should not render legacy live beam cones');
  assert.equal(proof.showLiveSceneEffects, false, 'MODQN proof lane should not inherit SINR live effects');
  assert.equal(proof.showCinematicSpotlight, false, 'MODQN proof lane should not inherit spotlight effects');
  assert.equal(proof.effectiveCinematicMode, 'off', 'MODQN proof lane should force cinematic mode off');
  assert.equal(proof.handoverStoryLayerPolicy, 'modqn-replay-source-backed', 'MODQN proof lane must stay source-backed');
  assert.equal(proof.showProfileHandoverStoryLayer, false, 'MODQN proof lane must not mount the profile-derived story overlay');

  const artifact = renderPlan('artifact-replay', 'artifact-replay');
  assert.equal(artifact.sourceCompatible, true, 'artifact replay source should be compatible');
  assert.equal(artifact.isArtifactReplay, true, 'artifact replay plan should mark artifact replay');
  assert.equal(artifact.showArtifactFpsCounter, true, 'artifact replay may expose artifact FPS diagnostics');
  assert.equal(artifact.showCellOverlay, false, 'artifact replay should not render live cell overlay');
  assert.equal(artifact.showReplayProofLayer, false, 'artifact replay should not render MODQN proof layer');
  assert.equal(artifact.showCinematicSpotlight, false, 'artifact replay should not inherit spotlight effects');
  assert.equal(artifact.effectiveCinematicMode, 'off', 'artifact replay should force cinematic mode off');
  assert.equal(artifact.handoverStoryLayerPolicy, 'artifact-owned', 'artifact replay should keep handover story artifact-owned');
  assert.equal(artifact.showProfileHandoverStoryLayer, false, 'artifact replay must not mount the profile-derived story overlay');

  const incompatibleArtifact = renderPlan('artifact-replay', 'live-sim');
  assert.equal(incompatibleArtifact.sourceCompatible, false, 'artifact lane must reject live-sim source');
  assert.equal(incompatibleArtifact.isLiveScene, false, 'incompatible artifact lane must not become live scene');
  assert.equal(incompatibleArtifact.showArtifactFpsCounter, false, 'incompatible artifact lane must not show artifact diagnostics');
  assert.equal(incompatibleArtifact.showLiveSceneEffects, false, 'incompatible artifact lane must not show live effects');
  assert.equal(incompatibleArtifact.handoverStoryLayerPolicy, 'disabled', 'incompatible artifact lane must disable handover story ownership');
}

assert.deepEqual(
  tabKeys(getRightSidebarTabsForSceneLane('sinr-live', 'sinr-offset')),
  ['live'],
  'SINR live lane right sidebar should only expose live status',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('sinr-live', 'sinr-offset'),
  'live',
  'SINR live lane should default the right sidebar to live status',
);
assert.deepEqual(
  tabKeys(getRightSidebarTabsForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr')),
  ['live'],
  'MODQN live cell preview right sidebar should not mount MODQN evidence directly',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr'),
  'live',
  'MODQN live cell preview should default the right sidebar to live status',
);
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr')),
  ['replay'],
  'MODQN replay proof lane left sidebar should only expose the replay cue',
);
assert.equal(
  getDefaultLeftSidebarTabForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr'),
  'replay',
  'MODQN replay proof lane should default the left sidebar to replay cue',
);
assert.deepEqual(
  tabKeys(getRightSidebarTabsForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr')),
  ['modqn'],
  'MODQN replay proof lane right sidebar should only expose MODQN evidence',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr'),
  'modqn',
  'MODQN replay proof lane should default the right sidebar to MODQN evidence',
);
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr')),
  ['artifact'],
  'artifact replay lane left sidebar should only expose artifact replay',
);
assert.deepEqual(
  tabKeys(getRightSidebarTabsForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr')),
  ['artifact'],
  'artifact replay lane right sidebar should only expose artifact truth',
);
assert.equal(
  getDefaultLeftSidebarTabForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr'),
  'artifact',
  'artifact replay lane should default the left sidebar to artifact replay',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr'),
  'artifact',
  'artifact replay lane should default the right sidebar to artifact truth',
);

const appSource = readRepoFile('src/App.tsx');
const appRuntimeModelSource = readRepoFile('src/app/appRuntimeModel.ts');
const appRuntimeConfigSource = readRepoFile('src/app/appRuntimeConfig.ts');
const appPersistenceSource = readRepoFile('src/app/appPersistence.ts');
const appExperienceModeSource = readRepoFile('src/app/appExperienceMode.ts');
const modqnServingCountSource = readRepoFile('src/modqn/servingCount.ts');
const timelineAuthoritySource = readRepoFile('src/app/timelineRailAuthority.ts');
const controlBarSource = readRepoFile('src/ui/ControlBar.tsx');
const topologyTabSource = readRepoFile('src/ui/signal-tuning/TopologyTab.tsx');
const timelineBarSource = readRepoFile('src/ui/TimelineBar.tsx');
const handoverRailSource = readRepoFile('src/ui/HandoverEventRail.tsx');
const modqnHudSource = readRepoFile('src/ui/modqn-controls/ModqnSceneHud.tsx');
const modqnVisualLayersSource = readRepoFile('src/scene/modqnVisualLayers.ts');
const modqnServiceMapSource = readRepoFile('src/scene/modqnServiceMap.ts');
const cellOverlaySource = readRepoFile('src/viz/CellOverlay.tsx');
const cellBeamConesSource = readRepoFile('src/viz/CellBeamCones.tsx');
const groundSceneSource = readRepoFile('src/viz/GroundScene.tsx');
const modqnReplayCuePanelSource = readRepoFile('src/ui/ModqnReplayCuePanel.tsx');
const mainSceneSource = readRepoFile('src/scene/MainScene.tsx');
const cellScheduleSource = readRepoFile('src/scene/useCellSchedule.ts');
const baseSceneLayoutSource = readRepoFile('src/scene/BaseSceneLayout.tsx');
const sceneTelemetrySource = readRepoFile('src/scene/SceneTelemetry.tsx');
const simStatePublisherSource = readRepoFile('src/scene/useSimStatePublisher.ts');
const panelStateSource = readRepoFile('src/scene/panelState.ts');
const sceneLaneRenderPlanSource = readRepoFile('src/scene/sceneLaneRenderPlan.ts');
const replayLayerSource = readRepoFile('src/scene/modqn-replay-visuals/index.tsx');
const replayTelemetrySource = readRepoFile('src/scene/modqn-replay-visuals/useReplaySceneTelemetry.tsx');
const algorithmDashboardSource = readRepoFile('src/showcase/dashboard/AlgorithmDashboard.tsx');
const governanceDoc = readRepoFile('docs/frontend-render-governance.md');
const laneSdd = readRepoFile('docs/frontend-mode-lane-separation-sdd.md');
const handoverStorySdd = readRepoFile('docs/modqn-handover-story-layer-sdd.md');
const realisticGeometrySdd = readRepoFile('docs/modqn-realistic-beam-geometry-cross-repo-sdd.md');
const realisticGeometryProducerBrief = readRepoFile('docs/modqn-realistic-beam-geometry-phase-ii-producer-brief.md');
const adr = readRepoFile('docs/decisions/ADR-001-scene-lane-render-boundary.md');
const agentsDoc = readRepoFile('AGENTS.md');
const claudeDoc = readRepoFile('CLAUDE.md');
const packageJson = readRepoFile('package.json');

assertContains(modqnServingCountSource, 'MODQN_SERVING_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const', 'MODQN formal serving-count options are L=2..8');
assertContains(modqnServingCountSource, 'MODQN_PAPER_BASELINE_SERVING_COUNT = 4', 'MODQN serving-count model labels L=4 as baseline');
assertContains(modqnServingCountSource, 'MODQN_PAPER_SWEEP_MAX_SERVING_COUNT = 8', 'MODQN serving-count model labels L=8 as sweep max');
assertContains(modqnServingCountSource, 'MODQN_BEAMS_PER_SERVING_SATELLITE = 7', 'MODQN serving-count model keeps 7 beams per serving satellite');
assertContains(modqnServingCountSource, 'return MODQN_PAPER_SWEEP_MAX_SERVING_COUNT', 'MODQN serving-count model migrates legacy L=12 to L=8');
assertContains(realisticGeometrySdd, 'formal `L ∈ {2,3,4,5,6,7,8}`', 'Realistic geometry SDD defers to formal L=2..8 serving authority');
assertContains(realisticGeometrySdd, 'display-only active-cell cap of 28', 'Realistic geometry SDD labels 28 as display-only cap');
assertContains(realisticGeometrySdd, 'display active-cell cap preserves a readable 28/37 hopping overlay', 'Realistic geometry SDD keeps 28/37 hopping as display overlay wording');
assertNotContains(realisticGeometrySdd, 'serving L ∈ {4, 8, 12}', 'Realistic geometry SDD must not keep stale L=12 active design');
assertNotContains(realisticGeometrySdd, 'Phase III training **sweeps `L ∈ {4, 8, 12}`', 'Realistic geometry SDD must not keep stale L=12 training sweep');
assertNotContains(realisticGeometrySdd, 'K = 28 keeps hopping', 'Realistic geometry SDD must not label 28-cell hopping as fixed action truth');
assertNotContains(realisticGeometrySdd, 'With K = 28 active per slot', 'Realistic geometry SDD scheduler text must not label display cap as action truth');
assertNotContains(realisticGeometrySdd, 'K=28 per slot', 'Realistic geometry SDD validator table must not label display cap as action truth');
assertContains(realisticGeometryProducerBrief, '2026-06-01 serving-authority update', 'Producer brief carries serving-authority supersession warning');
assertContains(realisticGeometryProducerBrief, 'Serving cap **L ∈ {2,3,4,5,6,7,8}**', 'Producer brief uses formal L=2..8 serving cap');
assertContains(realisticGeometryProducerBrief, 'display-only cell-overlay cap', 'Producer brief keeps 28 cap display-only unless producer exports it');
assertNotContains(realisticGeometryProducerBrief, 'Serving cap **L ∈ {4,8,12}**', 'Producer brief must not preserve stale formal L=12 selector');
assertNotContains(realisticGeometryProducerBrief, 'sweep set {4,8,12}', 'Producer brief must not preserve stale L=12 sweep set');
assertContains(topologyTabSource, 'MODQN_SERVING_COUNT_OPTIONS.map', 'TopologyTab renders formal MODQN serving-count options from shared model');
assertContains(topologyTabSource, 'paper-faithful baseline', 'TopologyTab labels L=4 as baseline');
assertContains(topologyTabSource, 'paper sweep max / rich demo', 'TopologyTab labels L=8 as paper sweep max / rich demo');
assertContains(topologyTabSource, 'L x 7 MODQN beam actions', 'TopologyTab presents MODQN action catalog as L x 7');
assertNotContains(topologyTabSource, 'topology-tab-serving-count-option-12', 'TopologyTab must not expose L=12 as a formal selector option');
assertNotContains(topologyTabSource, 'K=28 active beams', 'TopologyTab must not claim fixed K=28 across serving counts');
assertContains(appPersistenceSource, 'normalizePersistedModqnServingCount(record.cellServingCount)', 'appPersistence normalizes persisted MODQN serving count');
assertNotContains(appPersistenceSource, 'record.cellServingCount === 12', 'appPersistence must not accept L=12 as a normal value');
assertContains(appRuntimeConfigSource, 'normalizeRuntimeModqnServingCount(input.sceneTopology.cellServingCount)', 'appRuntimeConfig normalizes runtime MODQN serving count');
assertContains(modqnVisualLayersSource, "DEFAULT_MODQN_VISUAL_LAYER_PRESET: ModqnVisualLayerPreset = 'baseline-faithful'", 'MODQN visual layers default to baseline faithful preset');
assertContains(modqnVisualLayersSource, "'service-allocation'", 'MODQN visual layers include service allocation preset');
assertContains(modqnVisualLayersSource, "'explain-handover'", 'MODQN visual layers include explain handover preset');
assertContains(modqnVisualLayersSource, 'beamCones: false', 'MODQN baseline preset keeps beam cones off');
assertContains(modqnVisualLayersSource, "beamConeScope: 'all-serving-satellites'", 'MODQN service/debug presets can show all serving satellite cones');
assertContains(modqnVisualLayersSource, "beamConeScope: 'focus-satellite'", 'MODQN explain preset keeps beam cones focused');
assertContains(modqnVisualLayersSource, 'handoverCues: false', 'MODQN baseline preset keeps handover cues off');
assertContains(modqnVisualLayersSource, 'handoverCues: true', 'MODQN explain/debug presets can enable handover cues');
assertContains(cellBeamConesSource, 'resolveCellBeamConeSatelliteCount', 'CellBeamCones exposes serving-satellite render-count telemetry');
assertContains(cellBeamConesSource, "resolvedScope === 'focus-satellite'", 'CellBeamCones supports focused satellite scope');
assertContains(cellBeamConesSource, "'all-serving-satellites'", 'CellBeamCones supports multi-satellite service allocation scope');
assertContains(modqnServiceMapSource, 'deriveModqnServiceMap', 'MODQN service map derives all-UE service rendering state');
assertContains(modqnServiceMapSource, 'ueCountByCellId', 'MODQN service map exposes per-cell served UE counts');
assertContains(modqnServiceMapSource, 'activeCellCountBySatId', 'MODQN service map exposes per-satellite active-cell counts');
assertContains(modqnServiceMapSource, 'buildModqnCellServiceReadout', 'MODQN service map builds a cell service readout');
assertContains(modqnServiceMapSource, "claimKind: 'overlay-demo'", 'MODQN service readout keeps overlay-demo claim kind');
assertContains(modqnServiceMapSource, 'slotSec', 'MODQN service readout carries display slot duration');
assertContains(modqnServiceMapSource, 'nextChangedCellCount', 'MODQN service readout carries next-slot change count');
assertContains(modqnServiceMapSource, 'activeBeamIds', 'MODQN service readout carries active beam ids without producer-proof claims');
assertContains(cellOverlaySource, 'showUeCounts', 'CellOverlay supports explicit UE-count badge visibility');
assertContains(controlBarSource, 'modqn-layer-preset-control', 'ControlBar exposes MODQN layer preset control');
assertContains(controlBarSource, 'MODQN_VISUAL_LAYER_PRESETS.map', 'ControlBar renders presets from shared MODQN visual layer model');
assertContains(controlBarSource, "'service-allocation': 'Service'", 'ControlBar labels the service allocation preset');
assertContains(appSource, 'const [modqnVisualLayerPreset, setModqnVisualLayerPreset]', 'App owns MODQN visual layer preset state');
assertContains(appRuntimeConfigSource, 'resolveModqnVisualLayers(modqnVisualLayerPreset)', 'appRuntimeConfig resolves MODQN visual layers into runtime flags');
assertContains(cellScheduleSource, 'DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT', 'useCellSchedule names the 28-cell cap as display-only');
assertContains(cellScheduleSource, 'MODQN action catalog truth is L x 7', 'useCellSchedule documents display cap is not MODQN action truth');
assertNotContains(cellScheduleSource, 'PAPER_ACTIVE_BEAMS_PER_SLOT', 'useCellSchedule must not name the display cap as paper action truth');
assertContains(appExperienceModeSource, "'sinr-experiment': 'hobs-2024-candidate-rich'", 'SINR default profile remains HOBS candidate-rich');
assertContains(packageJson, '"validate:live-walker:7200-timeline"', 'package exposes committed 7200s live Walker validator');
assertContains(appRuntimeConfigSource, 'LIVE_SIM_TIMELINE_DURATION_SEC = 7200', 'live timeline is 7200s only with committed validator coverage');
assertNotContains(appRuntimeConfigSource, 'LIVE_SIM_TIMELINE_DURATION_SEC = 1200', 'live timeline must not fall back to the old 1200s window');

assertContains(appSource, "from './app/sceneLane'", 'App scene lane import');
assertContains(appSource, 'modqnReplayProofRequested: modqnReplayProofRequestActive', 'App explicit proof request into scene lane resolver');
assertContains(appSource, 'shouldRenderModqnReplayScene(sceneLane)', 'App replay proof lane gate');
assertContains(appSource, 'data-scene-lane={sceneLane}', 'App browser lane telemetry');
assertContains(appSource, 'showModqnReplayScene={showModqnReplayScene}', 'App MainScene replay prop');
assertContains(appSource, 'sceneLane={sceneLane}', 'App MainScene lane prop');
assertContains(appSource, 'sceneLane={sceneLane}', 'App ControlBar lane prop');
assertContains(appSource, "from './app/timelineRailAuthority'", 'App imports timeline and rail authority module');
assertContains(appSource, "from './app/liveWalkerHandoverRailAdapter'", 'App imports the live Walker rail adapter');
assertContains(appSource, "from './scene/liveWalkerHandoverEventIndex'", 'App imports the live Walker event index helper');
assertContains(timelineAuthoritySource, 'export function resolveTimelineRailDescriptor', 'Timeline authority exports descriptor resolver');
assertContains(timelineAuthoritySource, "'profile-derived-forecast'", 'Timeline authority models profile-derived live Walker forecast claims');
assertContains(appSource, 'buildLiveWalkerHandoverEventIndex({', 'App builds the live Walker event index outside render');
assertContains(appSource, 'liveWalkerHandoverEventIndexToRailEvents(liveWalkerHandoverEventIndex)', 'App adapts live Walker event index to rail events');
assertContains(appSource, 'function getModqnReplayVisualTimeline', 'App derives a slow-motion MODQN replay display axis');
assertContains(appSource, 'MODQN_REPLAY_VISUAL_MIN_DISPLAY_DURATION_SEC = 60', 'App stretches the short legacy producer trace into a readable display playback window');
assertContains(appSource, 'producerTraceDisplayDurationSec', 'App separates MODQN producer source horizon from display-stretched rail duration');
assertContains(timelineAuthoritySource, 'const producerSourceTimeline: TimelineSurfaceDescriptor', 'Timeline authority keeps producer source timeline separate from display-stretched rail axis');
assertContains(timelineAuthoritySource, "return { timeline: liveTimeline, rail: liveRail };", 'Timeline authority keeps MODQN live preview rail on the live Walker event index');
assertContains(timelineAuthoritySource, "return { timeline: producerSourceTimeline, rail: producerTrace };", 'Timeline authority keeps MODQN replay proof bottom timeline on producer source time');
assertNotContains(appSource, 'producerDisplayTimeline', 'App must not promote the slow-motion producer rail axis into the bottom timeline');
assertContains(timelineAuthoritySource, 'horizonSec: producerDurationSec', 'Timeline authority keeps producer source horizon seconds separate from display duration');
assertContains(appSource, 'horizonSec={timelineRailDescriptor.timeline.horizonSec}', 'App passes source horizon seconds to TimelineBar separately');
assertContains(timelineAuthoritySource, "horizonKind: 'producer-trace'", 'Timeline authority models producer trace horizon explicitly');
assertContains(timelineAuthoritySource, 'LEGACY_PRODUCER_TRACE_SOURCE_GAP', 'Timeline authority carries legacy producer trace source-gap copy');
assertContains(appSource, 'const liveTimelineWindowStartSec = demoStartOffset;', 'App anchors live timeline display to the selected live Walker window');
assertContains(appSource, 'simState.simTimeSec - liveTimelineWindowStartSec', 'App displays live timeline as window elapsed time, not absolute sim offset');
assertContains(appSource, 'demoStartOffsetSec: demoStartOffset', 'App does not mutate the live Walker window start when seeking');
assertContains(appSource, 'const absoluteTargetSec = liveTimelineWindowStartSec + target;', 'App converts bottom timeline elapsed seek to absolute Walker time');
assertContains(appSource, 'durationSec={timelineRailDescriptor.rail.durationSec}', 'App handover rail uses descriptor-owned duration');
assertContains(appSource, 'sourceLabel={timelineRailDescriptor.rail.sourceLabel}', 'App handover rail uses descriptor-owned source label');
assertContains(appSource, 'sourceOwner={timelineRailDescriptor.rail.sourceOwner}', 'App handover rail exposes descriptor source owner');
assertContains(appSource, 'sourceGapReasons={timelineRailDescriptor.rail.sourceGapReasons}', 'App handover rail exposes descriptor source gaps');
assertContains(appSource, "if (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview') return liveWalkerHandoverRailEvents;", 'App routes live lanes to the live Walker event index rail');
assertContains(appSource, "if (sceneLane === 'modqn-replay-proof') return modqnHandoverRailEvents;", 'App keeps MODQN replay proof on producer rail events');
assertContains(appSource, 'const timelineDurationSec = timelineRailDescriptor.timeline.durationSec;', 'App timeline duration is descriptor-owned');
assertNotContains(
  appSource,
  "const timelineDurationSec = sceneSource === 'artifact-replay'",
  'App must not derive timeline horizon from sceneSource alone',
);
assertNotContains(
  appSource,
  "const handoverRailSourceLabel = sceneSource === 'artifact-replay'",
  'App must not derive handover rail source labels from free sceneSource strings',
);

assertContains(
  appSource,
  "from './showcase/dashboard/AlgorithmDashboard'",
  'App imports the artifact-lane AlgorithmDashboard',
);
assert.equal(
  countOccurrences(appSource, '<AlgorithmDashboard'),
  1,
  'AlgorithmDashboard is mounted exactly once',
);
{
  const artifactTruthBranchStart = appSource.indexOf('data-testid="artifact-truth-sidebar"');
  const artifactTruthBranchEnd = appSource.indexOf(
    ") : activeRightSidebarTab === 'live' ? (",
    artifactTruthBranchStart,
  );
  assert.ok(artifactTruthBranchStart >= 0, 'artifact truth sidebar branch exists');
  assert.ok(artifactTruthBranchEnd > artifactTruthBranchStart, 'artifact truth sidebar branch has a live-branch boundary');

  const artifactTruthBranch = appSource.slice(artifactTruthBranchStart, artifactTruthBranchEnd);
  const dashboardMountIndex = artifactTruthBranch.indexOf('<AlgorithmDashboard');
  const artifactReplayGuardIndex = artifactTruthBranch.lastIndexOf(
    "sceneSource === 'artifact-replay'",
    dashboardMountIndex,
  );
  assert.ok(dashboardMountIndex >= 0, 'AlgorithmDashboard mount is inside the artifact truth sidebar branch');
  assert.ok(
    artifactReplayGuardIndex >= 0 && artifactReplayGuardIndex < dashboardMountIndex,
    'AlgorithmDashboard mount is gated by sceneSource === artifact-replay',
  );
  assertContains(
    artifactTruthBranch,
    'data-testid="artifact-truth-source-summary"',
    'AlgorithmDashboard shares the artifact truth sidebar region',
  );
}

assertContains(
  algorithmDashboardSource,
  'data-testid="algorithm-dashboard"',
  'AlgorithmDashboard exposes root test id',
);
assertContains(
  algorithmDashboardSource,
  'buildDashboardSeriesModel(artifact)',
  'AlgorithmDashboard consumes the Plane-C dashboard series model',
);
assertContains(
  algorithmDashboardSource,
  'provenance.status',
  'AlgorithmDashboard renders INV-1 provenance status',
);
assertContains(
  algorithmDashboardSource,
  'data-testid="algorithm-dashboard-provenance-chip"',
  'AlgorithmDashboard exposes provenance chips',
);
assertContains(
  algorithmDashboardSource,
  'source gap - not shown',
  'AlgorithmDashboard fails closed on source gaps',
);
assertNotContains(algorithmDashboardSource, "from 'three", 'AlgorithmDashboard must not import three');
assertNotContains(algorithmDashboardSource, 'from "three', 'AlgorithmDashboard must not import three');
assertNotContains(algorithmDashboardSource, '@react-three/', 'AlgorithmDashboard must not import react-three');
assertNotContains(algorithmDashboardSource, '../scene/', 'AlgorithmDashboard must not import scene modules');
assertNotContains(algorithmDashboardSource, '../viz/', 'AlgorithmDashboard must not import viz modules');
assertNotContains(algorithmDashboardSource, '<Canvas', 'AlgorithmDashboard must not mount Canvas');

{
  const baseInput = {
    sceneSource: 'live-sim' as const,
    liveDurationSec: 7200,
    liveCurrentTimeSec: 42,
    artifactDurationSec: 300,
    artifactCurrentTimeSec: 7,
    artifactHandoverEventCount: 0,
    producerTraceRange: {
      startSec: 1,
      endSec: 10,
      durationSec: 10,
      rangeLabel: '1s-10s',
    },
    producerTraceCurrentTimeSec: 1,
    producerTraceDisplayDurationSec: 60,
    producerTraceDisplayCurrentTimeSec: 18,
    bundleProvenanceKind: 'paper-faithful' as const,
  };
  const livePreview = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-live-cell-preview',
  });
  assert.equal(livePreview.timeline.sourceOwner, 'live-walker', 'MODQN live preview bottom timeline uses live Walker source');
  assert.equal(livePreview.timeline.horizonKind, 'live-walker-window', 'MODQN live preview bottom timeline uses live Walker horizon');
  assert.equal(livePreview.timeline.durationSec, 7200, 'MODQN live preview bottom timeline uses the validated 7200s live Walker window');
  assert.ok(livePreview.timeline.horizonLabel.includes('2 h'), 'MODQN live preview bottom timeline may label the validated live Walker horizon as 2 h');
  assert.equal(livePreview.timeline.claimKind, 'overlay-demo', 'MODQN live preview bottom timeline is an overlay/demo claim');
  assert.equal(livePreview.rail.sourceOwner, 'live-walker', 'MODQN live preview rail uses the live Walker event index');
  assert.equal(livePreview.rail.horizonKind, 'live-walker-window', 'MODQN live preview rail uses the live Walker 7200s horizon');
  assert.equal(livePreview.rail.durationSec, 7200, 'MODQN live preview rail does not inherit the 10s producer trace');
  assert.equal(livePreview.rail.claimKind, 'overlay-demo', 'MODQN live preview rail labels live Walker events as overlay/demo');
  assert.equal(livePreview.rail.axisKind, 'source-time', 'MODQN live preview rail click targets use source time');

  const sinrLive = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'sinr-live',
  });
  assert.equal(sinrLive.rail.sourceOwner, 'live-walker', 'SINR live rail uses the live Walker event index');
  assert.equal(sinrLive.rail.horizonKind, 'live-walker-window', 'SINR live rail uses the live Walker 7200s horizon');
  assert.equal(sinrLive.rail.claimKind, 'profile-derived-forecast', 'SINR precomputed rail is a profile-derived forecast');
  assert.equal(sinrLive.rail.axisKind, 'source-time', 'SINR live rail click targets use source time');

  const proof = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-replay-proof',
  });
  assert.equal(proof.timeline.sourceOwner, 'modqn-producer-trace', 'MODQN replay proof bottom timeline uses producer source');
  assert.equal(proof.timeline.horizonKind, 'producer-trace', 'MODQN replay proof bottom timeline uses producer horizon');
  assert.equal(proof.timeline.durationSec, 10, 'MODQN replay proof bottom timeline keeps the 10s producer horizon');
  assert.equal(proof.timeline.axisKind, 'source-time', 'MODQN replay proof bottom timeline uses source time');
  assert.equal(proof.timeline.claimKind, 'producer-proof', 'MODQN replay proof bottom timeline is producer proof');

  const artifactGap = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'artifact-replay',
    sceneSource: 'artifact-replay',
  });
  assert.equal(artifactGap.timeline.sourceOwner, 'artifact-replay', 'artifact replay bottom timeline uses artifact source');
  assert.equal(artifactGap.rail.sourceGapReasons.length, 1, 'artifact replay rail fails closed without a handover event index');
  const artifactWithEvents = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'artifact-replay',
    sceneSource: 'artifact-replay',
    artifactHandoverEventCount: 3,
  });
  assert.equal(artifactWithEvents.rail.sourceGapReasons.length, 0, 'artifact replay rail accepts artifact-owned events when indexed');
}
assertContains(appSource, 'const [modqnReplayProofRequested, setModqnReplayProofRequested] = useState(false);', 'App explicit proof request state');
assertContains(appSource, "handoverMode === 'decision-overlay-on-live-sinr'", 'App proof request is limited to decision overlay mode');
assertContains(appSource, 'setModqnReplayProofRequested(false)', 'App proof request reset outside eligible lane');
assertContains(appSource, "proofViewportActive={sceneLane === 'modqn-replay-proof'}", 'App wires proof viewport active state into cue panel');
assertContains(appSource, 'canToggleModqnReplayProof ? setModqnReplayProofRequested : undefined', 'App wires proof viewport toggle callback only when eligible');
assertContains(appSource, 'getLeftSidebarTabsForSceneLane(sceneLane, handoverMode)', 'App lane-aware left sidebar tabs');
assertContains(appSource, 'getRightSidebarTabsForSceneLane(sceneLane, handoverMode)', 'App lane-aware right sidebar tabs');
assertContains(appSource, "activeLeftSidebarTab === 'artifact'", 'App artifact left sidebar branch');
assertContains(appSource, "activeRightSidebarTab === 'artifact'", 'App artifact right sidebar branch');
assertContains(appSource, "sceneSource !== 'artifact-replay' || activeSceneFrame !== undefined", 'App artifact scene fail-closed gate');
assertContains(appSource, 'data-testid="artifact-scene-fail-closed"', 'App artifact scene fail-closed placeholder');
assertContains(appSource, "if (sceneSource === 'artifact-replay') return;", 'App skips MODQN replay bundle startup fetch in artifact replay');
assertContains(appSource, "sceneSource !== 'artifact-replay' && modqnReplayFetchError !== null", 'App hides MODQN bundle fetch banner in artifact replay');
assertContains(
  appSource,
  "sceneLane === 'modqn-live-cell-preview' && (",
  'App should hide the MODQN Phase I HUD outside the live cell lane',
);
assertContains(
  appSource,
  "sceneLane === 'modqn-live-cell-preview' && <ServiceStatusBanner appMode={appMode} />",
  'App should hide the MODQN training service banner outside the live cell lane',
);
assertNotContains(
  appSource,
  "showModqnReplayScene={appMode === 'modqn-demo'}",
  'App must not mount MODQN replay proof from appMode alone',
);
assertContains(appRuntimeModelSource, 'ARTIFACT_LEFT_SIDEBAR_TABS', 'App runtime model artifact left tabs');
assertContains(appRuntimeModelSource, 'ARTIFACT_RIGHT_SIDEBAR_TABS', 'App runtime model artifact right tabs');
assertContains(appRuntimeModelSource, 'MODQN_REPLAY_PROOF_LEFT_SIDEBAR_TABS', 'App runtime model replay proof left tabs');
assertContains(appRuntimeModelSource, 'MODQN_REPLAY_PROOF_RIGHT_SIDEBAR_TABS', 'App runtime model replay proof right tabs');
assertContains(appRuntimeModelSource, "lane === 'artifact-replay'", 'App runtime model artifact lane override');
assertContains(appRuntimeModelSource, "lane === 'modqn-replay-proof'", 'App runtime model MODQN proof lane override');
assertContains(appRuntimeModelSource, "lane === 'modqn-live-cell-preview') return SINR_RIGHT_SIDEBAR_TABS", 'App runtime model keeps cell preview right sidebar live-status only');
assertContains(appRuntimeModelSource, "if (lane === 'modqn-replay-proof') return 'modqn';", 'App runtime model defaults proof right sidebar to MODQN evidence');

assertContains(timelineBarSource, 'data-source-owner={sourceOwner}', 'TimelineBar exposes source owner telemetry');
assertContains(timelineBarSource, 'data-horizon-kind={horizonKind}', 'TimelineBar exposes horizon kind telemetry');
assertContains(timelineBarSource, 'readonly horizonSec?: number;', 'TimelineBar accepts source horizon seconds separately from display duration');
assertContains(timelineBarSource, 'data-horizon-sec={safeHorizonSec.toFixed(3)}', 'TimelineBar exposes source horizon seconds telemetry');
assertContains(timelineBarSource, 'data-claim-kind={claimKind}', 'TimelineBar exposes claim kind telemetry');
assertContains(timelineBarSource, 'data-testid="timeline-source-label"', 'TimelineBar renders source/horizon label');
assertContains(handoverRailSource, 'data-source-owner={sourceOwner}', 'HandoverEventRail exposes source owner telemetry');
assertContains(handoverRailSource, 'data-horizon-kind={horizonKind}', 'HandoverEventRail exposes horizon kind telemetry');
assertContains(handoverRailSource, 'data-horizon-sec={safeDurationSec.toFixed(3)}', 'HandoverEventRail exposes source horizon seconds');
assertContains(handoverRailSource, 'data-source-gap-count={String(sourceGapReasons.length)}', 'HandoverEventRail exposes source gap count');
assertContains(handoverRailSource, "return 'producer trace';", 'HandoverEventRail labels MODQN rows as producer trace context');
assertContains(handoverRailSource, 'buildEventMapClusters', 'HandoverEventRail builds stable source-time event map clusters');
assertContains(handoverRailSource, 'data-map-layout="fixed-event-map"', 'HandoverEventRail exposes fixed event-map layout telemetry');
assertContains(handoverRailSource, 'data-map-order="source-time"', 'HandoverEventRail keeps source-time map ordering');
assertContains(handoverRailSource, 'data-cursor-mode="independent"', 'HandoverEventRail keeps playback cursor independent from map ordering');
assertContains(handoverRailSource, 'data-axis-kind={axisKind}', 'HandoverEventRail exposes source-time vs display-stretched axis telemetry');
assertContains(handoverRailSource, 'data-axis-sec={safeAxisDurationSec.toFixed(3)}', 'HandoverEventRail exposes display axis seconds separately from source horizon');
assertContains(handoverRailSource, 'data-axis-current-sec={safeAxisCurrentTimeSec.toFixed(3)}', 'HandoverEventRail exposes display axis cursor seconds');
assertContains(handoverRailSource, 'data-axis-playing={animateAxisCursor ? \'true\' : \'false\'}', 'HandoverEventRail exposes animated display-axis cursor state');
assertContains(handoverRailSource, 'data-axis-playback-rate={safeAxisPlaybackRate.toFixed(3)}', 'HandoverEventRail exposes display axis playback rate');
assertContains(handoverRailSource, 'displayTimeSec', 'HandoverEventRail supports display-stretched marker positions without mutating source time');
assertContains(handoverRailSource, 'sourceTimeSec', 'HandoverEventRail accepts explicit source time');
assertContains(handoverRailSource, 'clickTargetSec', 'HandoverEventRail accepts explicit source-time click targets');
assertContains(handoverRailSource, 'data-click-target-sec={cluster.clickTargetSec.toFixed(3)}', 'HandoverEventRail exposes source-time click target telemetry');
assertContains(handoverRailSource, 'onClick={() => selectClusterAndSeek(cluster)}', 'HandoverEventRail routes marker clicks through source-time selection');
assertContains(handoverRailSource, 'seekTo(cluster.clickTargetSec);', 'HandoverEventRail seeks to source click targets, not display axis positions');
assertContains(handoverRailSource, "sourceOwner === 'live-walker' && horizonKind === 'live-walker-window'", 'HandoverEventRail gates slow-motion focus to live Walker source horizon');
assertContains(handoverRailSource, 'data-focus-axis-kind={slowMotionFocus?.axisKind ?? \'\'}', 'HandoverEventRail exposes focus display-axis telemetry');
assertContains(handoverRailSource, 'data-testid="handover-event-slow-focus"', 'HandoverEventRail renders the selected live Walker slow-motion focus panel');
assertContains(handoverRailSource, "axisKind: 'display-stretched'", 'HandoverEventRail slow-motion focus uses a display axis');
assertContains(handoverRailSource, '--handover-rail-axis-duration', 'HandoverEventRail drives display cursor animation from axis duration');
assertContains(appSource, 'axisPlaying={!playback.paused}', 'App pauses the handover rail display sweep with playback state');
assertContains(appSource, 'axisPlaybackRate={playback.effectiveSpeed}', 'App synchronizes handover rail display sweep with playback speed');
assertContains(handoverRailSource, 'data-marker-cluster-count={String(eventMapClusters.length)}', 'HandoverEventRail exposes marker cluster count');
assertContains(handoverRailSource, 'data-testid="handover-event-map-track"', 'HandoverEventRail renders a fixed event-map track');
assertContains(handoverRailSource, 'aria-label="Source-ordered handover event map"', 'HandoverEventRail list is source-ordered, not nearest-event ordered');
assertContains(handoverRailSource, "data-clustered={clustered ? 'true' : 'false'}", 'HandoverEventRail marks clustered same-time events');
assertNotContains(handoverRailSource, 'getNearestEvents', 'HandoverEventRail must not sort rows by distance to the playback cursor');
assertNotContains(handoverRailSource, 'nearestEvents', 'HandoverEventRail rows must not be cursor-nearest owned');
assertNotContains(handoverRailSource, '.slice(0, 6)', 'HandoverEventRail fixed event map must not cap rows by nearest window');
assertNotContains(handoverRailSource, 'Nearest handover events', 'HandoverEventRail must not present a cursor-relative nearest-event list');

assertContains(
  controlBarSource,
  "const isArtifactReplay = sceneLane === 'artifact-replay' || sceneSource === 'artifact-replay';",
  'ControlBar artifact replay branch guard',
);
assertContains(
  controlBarSource,
  'sceneLane?: SceneLane;',
  'ControlBar accepts scene lane',
);
assertContains(
  controlBarSource,
  "const showSinrLiveControls = sceneLane === 'sinr-live';",
  'ControlBar derives live control ownership from scene lane',
);
assertContains(
  controlBarSource,
  'data-testid="artifact-replay-handover-status"',
  'ControlBar artifact replay handover status',
);
assertContains(
  controlBarSource,
  'aria-label="Artifact replay is read-only; handover mode comes from the artifact"',
  'ControlBar artifact replay handover status accessibility label',
);
assertContains(
  controlBarSource,
  'data-scene-source="artifact-replay"',
  'ControlBar artifact replay handover control source marker',
);
assertContains(
  controlBarSource,
  'data-scene-source="live-sim"',
  'ControlBar live handover control source marker',
);
assertContains(
  controlBarSource,
  'const liveAutoSlowActive = showSinrLiveControls && autoSlowActive;',
  'ControlBar keeps HO slow warning live-only',
);
assertContains(
  controlBarSource,
  '{showSinrLiveControls && (',
  'ControlBar wraps live-only controls in the SINR live lane',
);
for (const [needle, label] of [
  ['data-testid="beam-density-control"', 'beam density controls'],
  ['data-testid="beam-info-toggle"', 'beam info toggle'],
  ['data-testid="camera-preset-control"', 'camera preset controls'],
  ['Spotlight', 'spotlight control copy'],
  ['HO Slow', 'HO slow control copy'],
] as const) {
  const liveOnlyBranchIndex = controlBarSource.indexOf('{showSinrLiveControls && (');
  const controlIndex = controlBarSource.indexOf(needle, liveOnlyBranchIndex);
  const speedIndex = controlBarSource.indexOf('aria-label="Playback speed"');
  assert.ok(
    liveOnlyBranchIndex >= 0
      && controlIndex > liveOnlyBranchIndex
      && controlIndex < speedIndex,
    `ControlBar artifact replay must hide live-only ${label}`,
  );
}
{
  const artifactStatusIndex = controlBarSource.indexOf('data-testid="artifact-replay-handover-status"');
  const liveSelectorIndex = controlBarSource.indexOf('{HANDOVER_MODE_OPTIONS.map(option => {');
  const handoverChangeIndex = controlBarSource.indexOf('onHandoverModeChange(option.mode)');
  assert.ok(
    artifactStatusIndex >= 0
      && liveSelectorIndex > artifactStatusIndex
      && handoverChangeIndex > liveSelectorIndex,
    'ControlBar artifact replay must render a read-only status before the live handover selector branch',
  );
}

assertContains(
  modqnReplayCuePanelSource,
  'readonly proofViewportActive?: boolean;',
  'MODQN replay cue proof viewport active prop',
);
assertContains(
  modqnReplayCuePanelSource,
  'readonly onProofViewportActiveChange?: (active: boolean) => void;',
  'MODQN replay cue proof viewport change prop',
);
assertContains(
  modqnReplayCuePanelSource,
  'data-testid="modqn-replay-proof-viewport-toggle"',
  'MODQN replay cue proof viewport toggle',
);
assertContains(
  modqnReplayCuePanelSource,
  "const label = active ? 'Hide proof from viewport' : 'Show proof in viewport';",
  'MODQN replay cue proof viewport toggle label',
);
assertContains(
  modqnReplayCuePanelSource,
  'aria-pressed={active}',
  'MODQN replay cue proof viewport toggle pressed state',
);
assertContains(
  modqnReplayCuePanelSource,
  'disabled={disabled}',
  'MODQN replay cue proof viewport toggle controller wiring guard',
);
assertContains(
  modqnReplayCuePanelSource,
  'Controller wiring required to change MODQN replay proof viewport',
  'MODQN replay cue proof viewport disabled wiring copy',
);

assertContains(
  mainSceneSource,
  'resolveSceneLaneRenderPlan({',
  'MainScene uses the scene lane render plan',
);
assertContains(
  sceneLaneRenderPlanSource,
  'export function isSceneLaneSourceCompatible',
  'Scene lane render plan exposes lane/source compatibility invariant',
);
assertContains(
  sceneLaneRenderPlanSource,
  "input.sceneLane === 'artifact-replay'",
  'Scene lane render plan treats artifact replay as a source-owned lane',
);
assertContains(
  sceneLaneRenderPlanSource,
  'sourceCompatible && input.sceneSource ===',
  'Scene lane render plan derives live/artifact source flags from compatibility',
);
assertContains(
  sceneLaneRenderPlanSource,
  "sceneLane === 'sinr-live' ? 'cylinder' : 'sphere'",
  'Scene lane render plan owns UE marker shape instead of raw appMode',
);
assertContains(
  sceneLaneRenderPlanSource,
  'showCinematicSpotlight',
  'Scene lane render plan owns cinematic spotlight gating',
);
assertContains(
  sceneLaneRenderPlanSource,
  'export type HandoverStoryLayerPolicy',
  'Scene lane render plan owns handover story layer policy',
);
assertContains(
  sceneLaneRenderPlanSource,
  "handoverStoryLayerPolicy:",
  'Scene lane render plan exposes handover story layer telemetry policy',
);
assertContains(
  sceneLaneRenderPlanSource,
  "'profile-derived-demo'",
  'Scene lane render plan allows profile-derived MODQN demo story only by policy',
);
assertContains(
  sceneLaneRenderPlanSource,
  "effectiveCinematicMode: showCinematicSpotlight ? input.cinematicMode : 'off'",
  'Scene lane render plan disables cinematic mode outside the SINR live lane',
);
assertContains(
  mainSceneSource,
  'resolveSceneLaneUeMarkerShape(sceneLane)',
  'MainScene derives UE marker shape from scene lane',
);
assertContains(
  mainSceneSource,
  "const showUav = sceneLane === 'sinr-live';",
  'MainScene render isolation probe derives UAV visibility from scene lane',
);
assertContains(
  mainSceneSource,
  'data-scene-lane={sceneLane}',
  'MainScene render isolation probe exposes scene lane',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.sceneLaneSourceCompatible',
  'MainScene canvas exposes lane/source compatibility telemetry'
);
assertContains(
  mainSceneSource,
  'deriveProfileHandoverStoryModel',
  'MainScene builds the profile-derived handover story model',
);
assertContains(
  mainSceneSource,
  'deriveModqnServiceMap({',
  'MainScene derives MODQN all-UE service map for the cell lane',
);
assertContains(
  mainSceneSource,
  'buildModqnCellServiceReadout({',
  'MainScene builds the MODQN service readout from the cell schedule',
);
assertContains(
  mainSceneSource,
  'slotSec: CELL_SCHEDULE_VIZ_SLOT_SEC',
  'MainScene labels MODQN service diagnostics with the display cell-schedule slot duration',
);
assertContains(
  mainSceneSource,
  'modqnCellServiceReadout,',
  'MainScene passes MODQN service readout into SimState publisher',
);
assertContains(
  mainSceneSource,
  'markerColor: service?.markerColor',
  'MainScene passes service-map colors to UE markers',
);
assertContains(
  groundSceneSource,
  'const resolvedMarkerColor = markerColor ?? PRIMARY_COLOR',
  'GroundScene applies service-map colors to the primary UE marker',
);
assertContains(
  groundSceneSource,
  'markerColor={primary.markerColor}',
  'GroundScene threads primary UE marker color into PrimaryUeMarker',
);
assertContains(
  mainSceneSource,
  'ueCountByCellId={modqnServiceMap.ueCountByCellId}',
  'MainScene passes per-cell UE counts to CellOverlay',
);
assertContains(
  mainSceneSource,
  'const showCellReassignmentEventArcs = modqnVisualLayers.handoverCues',
  'MainScene gates profile-derived cell reassignment cues by MODQN visual preset',
);
assertContains(
  mainSceneSource,
  'selectProfileDerivedHandoverCues',
  'MainScene caps profile-derived handover cue density',
);
assertContains(
  mainSceneSource,
  'visible={showCellReassignmentEventArcs}',
  'MainScene wires cell reassignment event arcs through an explicit visibility gate',
);
assertContains(
  mainSceneSource,
  '<HandoverStoryLayer',
  'MainScene can mount the shared handover story layer',
);
assertContains(
  mainSceneSource,
  '{showProfileHandoverStoryLayer && modqnVisualLayers.handoverStory && (',
  'MainScene gates the shared story layer by scene lane render plan and MODQN visual preset',
);
assertContains(
  mainSceneSource,
  '{showCellOverlay && modqnVisualLayers.beamCones && (',
  'MainScene gates MODQN beam cones by visual preset',
);
assertContains(
  mainSceneSource,
  'beamConeScope: renderedCellBeamConeScope',
  'MainScene passes visual preset beam cone scope into render-count helper',
);
assertContains(
  mainSceneSource,
  'resolveCellBeamConeSatelliteCount',
  'MainScene computes MODQN beam-cone satellite telemetry',
);
assertContains(
  mainSceneSource,
  'beamConeScope={modqnVisualLayers.beamConeScope}',
  'MainScene passes visual preset beam cone scope to CellBeamCones',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.handoverStoryLayer',
  'MainScene canvas reports handover story layer policy'
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.handoverStoryNextCount',
  'MainScene canvas reports next-slot story telemetry'
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.modqnVisualLayerPreset',
  'MainScene canvas reports MODQN visual layer preset telemetry',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.cellBeamConeScope',
  'MainScene canvas reports MODQN beam cone scope telemetry',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.cellBeamConeSatelliteCount',
  'MainScene canvas reports MODQN beam cone satellite count telemetry',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.modqnServedUeCount',
  'MainScene canvas reports MODQN served UE count telemetry',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.modqnHandoverCuesVisible',
  'MainScene canvas reports MODQN handover cue visibility telemetry',
);
assertContains(
  modqnHudSource,
  'data-service-allocation-visible',
  'MODQN HUD exposes Service Allocation callout visibility telemetry',
);
assertContains(
  modqnHudSource,
  'data-testid="modqn-service-allocation-summary"',
  'MODQN HUD renders Service Allocation summary only through the Service preset',
);
assertContains(
  modqnHudSource,
  'data-service-active-satellite-count',
  'MODQN HUD exposes active service satellite count telemetry',
);
assertContains(
  cellBeamConesSource,
  'resolveCellBeamConeOpacity',
  'CellBeamCones exposes preset-aware cone opacity for Service Allocation readability',
);
assertContains(
  modqnHudSource,
  "modqnVisualLayerPreset === 'debug'",
  'MODQN HUD gates service diagnostics to Debug preset',
);
assertContains(
  modqnHudSource,
  'data-service-diagnostics-visible',
  'MODQN HUD exposes Debug-only diagnostics visibility telemetry',
);
assertContains(
  modqnHudSource,
  'data-testid="modqn-service-diagnostics"',
  'MODQN HUD renders schedule diagnostics only through the gated Debug block',
);
assertContains(
  modqnHudSource,
  'data-service-claim-kind',
  'MODQN HUD keeps service diagnostic claim kind visible',
);
assertContains(
  governanceDoc,
  'source=profile-derived-demo',
  'Frontend governance documents the Debug diagnostics source boundary',
);
assertContains(
  laneSdd,
  'profile-derived schedule diagnostics',
  'Lane SDD documents Debug-only schedule diagnostics',
);
assertContains(
  handoverStorySdd,
  'slot duration, next-slot change count',
  'MODQN story SDD documents Debug schedule diagnostic fields',
);
assertContains(
  simStatePublisherSource,
  'modqnCellServiceReadout,',
  'SimState publisher forwards MODQN service readout',
);
assertContains(
  panelStateSource,
  'hasModqnCellServiceReadoutChanged',
  'panel state change detection includes MODQN service readout',
);
assertContains(
  mainSceneSource,
  'replayBackedHandoverStoryVisible',
  'MainScene keeps replay proof handover story telemetry source-backed',
);
assertContains(
  mainSceneSource,
  'function ArtifactSceneContent',
  'MainScene has a dedicated artifact scene composer',
);
assertContains(
  mainSceneSource,
  "sceneFrame?.sceneSource === 'artifact-replay'",
  'MainScene routes artifact frames away from the live scene composer',
);
assertContains(
  mainSceneSource,
  '<ArtifactSceneContent',
  'MainScene mounts the dedicated artifact scene composer',
);
assertContains(
  mainSceneSource,
  'liveSimulationEnabled="0"',
  'Artifact scene telemetry marks live simulation disabled'
);
assertContains(
  mainSceneSource,
  'liveSimulationEnabled="1"',
  'Live scene telemetry marks live simulation enabled'
);
{
  const artifactComposerIndex = mainSceneSource.indexOf('function ArtifactSceneContent');
  const liveHookIndex = mainSceneSource.indexOf('const sim = useSimulation(');
  const liveComposerIndex = mainSceneSource.indexOf('function SceneContent');
  assert.ok(
    artifactComposerIndex >= 0
      && liveHookIndex > liveComposerIndex
      && liveHookIndex > artifactComposerIndex,
    'ArtifactSceneContent must be declared before the live useSimulation hook and must not call it',
  );
  const artifactComposerBody = mainSceneSource.slice(artifactComposerIndex, liveComposerIndex);
  assertNotContains(
    artifactComposerBody,
    'useSimulation(',
    'ArtifactSceneContent must not call the live simulation hook',
  );
  assertNotContains(
    artifactComposerBody,
    'useBeamViz(',
    'ArtifactSceneContent must not call the live beam visual composer',
  );
  assertNotContains(
    artifactComposerBody,
    '<HandoverStoryLayer',
    'ArtifactSceneContent must not mount the profile-derived handover story layer',
  );
}
assertContains(
  sceneLaneRenderPlanSource,
  "input.sceneLane === 'modqn-live-cell-preview' && isLiveScene",
  'Scene lane render plan gates the live cell overlay lane',
);
assertContains(
  sceneLaneRenderPlanSource,
  'const showLiveSceneEffects = showSinrLiveViewport;',
  'Scene lane render plan gates live-only effects to SINR live',
);
assertContains(
  sceneLaneRenderPlanSource,
  "input.sceneLane === 'modqn-replay-proof'",
  'Scene lane render plan models explicit MODQN replay proof lane',
);
for (const [needle, label] of [
  ['{showLiveSceneEffects && <AmbientFootprintRings', 'ambient footprint rings'],
  ['{showLiveSceneEffects && (\\n        <HandoverLinks', 'handover links'],
  ['{showLiveSceneEffects && <IntraHandoverArrow', 'intra handover arrow'],
  ['{showLiveSceneEffects && <IntraGroundShockwave', 'intra ground shockwave'],
  ['{showHandoverToastOverlay && <HandoverToastOverlay', 'handover toast overlay'],
] as const) {
  assertContains(mainSceneSource, needle.replace('\\n', '\n'), `MainScene should source-gate ${label}`);
}

for (const [needle, label] of [
  ['{cinematicSpotlightActive && (\\n        <fogExp2', 'cinematic fog'],
  ['{cinematicSpotlightTargets.map(target => (', 'cinematic point lights'],
] as const) {
  assertContains(baseSceneLayoutSource, needle.replace('\\n', '\n'), `BaseSceneLayout should source-gate ${label}`);
}
assertContains(mainSceneSource, '<ModqnReplaySceneLayer', 'MainScene replay layer host');
assertContains(mainSceneSource, 'showBoard={showReplayProofLayer}', 'MainScene render-plan-gated replay layer');
assertContains(mainSceneSource, "enabled: sceneFrame.sceneSource !== 'artifact-replay'", 'MainScene disables live SimState publisher for artifact replay');
assertContains(readRepoFile('src/scene/useSimStatePublisher.ts'), 'if (!enabled) return;', 'live SimState publisher supports artifact fail-closed disable');
assertContains(
  replayLayerSource,
  'useReplaySceneTelemetry(visualState, showBoard)',
  'Replay telemetry should follow the replay layer gate',
);
assertContains(
  replayTelemetrySource,
  'removeReplayCanvasAttributes(canvas)',
  'Replay telemetry should clear canvas attributes outside proof lane',
);
assertContains(
  replayTelemetrySource,
  'data-handover-story-source-gap',
  'Replay telemetry should report beam-hopping source gaps',
);
assertContains(
  replayTelemetrySource,
  "data-handover-story-layer', 'modqn-replay-source-backed'",
  'Replay telemetry should report source-backed handover story policy',
);
assertContains(
  replayTelemetrySource,
  "data-handover-story-fake-beam-hopping', '0'",
  'Replay telemetry should explicitly reject fake beam hopping',
);
assertContains(
  replayLayerSource,
  'beam hopping schedule: source gap',
  'Replay scene layer should display beam-hopping source gap copy',
);

for (const [source, label] of [
  [governanceDoc, 'frontend render governance doc'],
  [laneSdd, 'frontend mode/lane SDD'],
  [adr, 'scene lane ADR'],
] as const) {
  assertContains(source, 'modqn-live-cell-preview', label);
  assertContains(source, 'modqn-replay-proof', label);
  assertContains(source, 'artifact-replay', label);
}

assertContains(handoverStorySdd, 'Handover Story Model', 'handover story SDD model section');
assertContains(handoverStorySdd, 'modqn-replay-proof', 'handover story SDD replay proof lane');
assertContains(handoverStorySdd, 'source gap', 'handover story SDD source gap policy');
assertContains(handoverStorySdd, 'not baseline proof', 'handover story SDD demo claim boundary');
assertContains(handoverStorySdd, 'suppresses these foreground event arcs', 'handover story SDD records MODQN preview event-arc suppression');
assertContains(governanceDoc, 'without foregrounding them as source-backed', 'governance doc records MODQN preview foreground-event suppression');

assertContains(
  agentsDoc,
  'Frontend Render Governance Rule',
  'AGENTS governance entry',
);
assertContains(
  claudeDoc,
  'Frontend Render Governance Rule',
  'CLAUDE governance entry',
);
assertContains(
  packageJson,
  '"validate:frontend:scene-lane-governance"',
  'package validation script',
);

console.log('validate:frontend:scene-lane-governance passed');
