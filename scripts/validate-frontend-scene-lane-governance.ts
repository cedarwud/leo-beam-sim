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
  cinematicMode: Parameters<typeof resolveSceneLaneRenderPlan>[0]['cinematicMode'] = 'spotlight',
): ReturnType<typeof resolveSceneLaneRenderPlan> {
  return resolveSceneLaneRenderPlan({
    sceneLane,
    sceneSource,
    beamCalloutsEnabled: true,
    beamDensity: 'all',
    cinematicMode,
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
  // Handover-cinema candidate highlight (S1) is gated on the director cinematic
  // mode, so it is OFF under spotlight even on its own lane.
  assert.equal(sinr.showCandidateHandoverHighlight, false, 'SINR live candidate highlight stays off outside director mode');

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

  // ── Handover-cinema candidate-beam highlight (S1) lane ownership ──
  // Lane-owned to sinr-live ONLY, and only while the director cinematic is engaged.
  // Inert on the MODQN cell preview, the replay-proof lane (Rule#8), and artifact.
  assert.equal(
    renderPlan('sinr-live', 'live-sim', false, 'director').showCandidateHandoverHighlight,
    true,
    'SINR live owns the handover-cinema candidate highlight under director mode',
  );
  assert.equal(
    renderPlan('modqn-live-cell-preview', 'live-sim', false, 'director').showCandidateHandoverHighlight,
    false,
    'MODQN cell preview must not mount the S1 candidate highlight (sinr-live only)',
  );
  assert.equal(
    renderPlan('modqn-replay-proof', 'live-sim', true, 'director').showCandidateHandoverHighlight,
    false,
    'MODQN replay proof must stay inert for the candidate highlight (Rule#8)',
  );
  assert.equal(
    renderPlan('artifact-replay', 'artifact-replay', false, 'director').showCandidateHandoverHighlight,
    false,
    'artifact replay must not mount the live SINR candidate highlight',
  );

  // ── SINR-serving mosaic (S2) lane ownership ──
  // Lane-owned to sinr-live ONLY and always-on (NOT director-gated): the ambient
  // default that colours every UE by its serving beam. It is a DISTINCT
  // SINR-serving layer, never the MODQN cell overlay — inert on every MODQN /
  // artifact lane.
  assert.equal(
    renderPlan('sinr-live', 'live-sim').showSinrServingMosaic,
    true,
    'SINR live owns the SINR-serving mosaic as an always-on ambient default (spotlight mode, no director)',
  );
  assert.equal(
    renderPlan('sinr-live', 'live-sim', false, 'director').showSinrServingMosaic,
    true,
    'SINR-serving mosaic stays on under director focus too (it is the ambient base, not focus-scoped)',
  );
  assert.equal(
    renderPlan('modqn-live-cell-preview', 'live-sim').showSinrServingMosaic,
    false,
    'MODQN cell preview must not mount the SINR-serving mosaic (it owns the MODQN cell overlay instead)',
  );
  assert.equal(
    renderPlan('modqn-replay-proof', 'live-sim', true).showSinrServingMosaic,
    false,
    'MODQN replay proof must stay inert for the SINR-serving mosaic (Rule#8)',
  );
  assert.equal(
    renderPlan('artifact-replay', 'artifact-replay').showSinrServingMosaic,
    false,
    'artifact replay must not mount the live SINR-serving mosaic',
  );

  // ── SINR-live earth-fixed cell-truth beam cones (S-cells-3) lane ownership ──
  // The lane's PRIMARY beam render: cones at FIXED cell centres from the cell
  // truth, replacing the steered SatelliteBeams. Lane-owned to sinr-live ONLY and
  // always-on (the ambient base, like the mosaic). A DISTINCT layer from the MODQN
  // `showCellOverlay` cones — inert on every MODQN / artifact lane.
  assert.equal(
    renderPlan('sinr-live', 'live-sim').showSinrLiveCellBeams,
    true,
    'SINR live owns the earth-fixed cell-truth beam cones as an always-on ambient default',
  );
  assert.equal(
    renderPlan('sinr-live', 'live-sim', false, 'director').showSinrLiveCellBeams,
    true,
    'cell-truth cones stay on under director focus too (the ambient base, not focus-scoped)',
  );
  assert.equal(
    renderPlan('modqn-live-cell-preview', 'live-sim').showSinrLiveCellBeams,
    false,
    'MODQN cell preview must not mount the cell-truth cones (it owns the MODQN cell overlay instead)',
  );
  assert.equal(
    renderPlan('modqn-replay-proof', 'live-sim', true).showSinrLiveCellBeams,
    false,
    'MODQN replay proof must stay inert for the cell-truth cones (Rule#8)',
  );
  assert.equal(
    renderPlan('artifact-replay', 'artifact-replay').showSinrLiveCellBeams,
    false,
    'artifact replay must not mount the live cell-truth cones',
  );

  const incompatibleArtifact = renderPlan('artifact-replay', 'live-sim');
  assert.equal(incompatibleArtifact.sourceCompatible, false, 'artifact lane must reject live-sim source');
  assert.equal(incompatibleArtifact.showSinrServingMosaic, false, 'incompatible sinr-live source must not show the mosaic');
  assert.equal(incompatibleArtifact.showSinrLiveCellBeams, false, 'incompatible sinr-live source must not show the cell-truth cones');
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
  ['live', 'modqn'],
  'MODQN live cell preview right sidebar offers live status + co-visible MODQN evidence (opt-in tab)',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr'),
  'live',
  'MODQN live cell preview still DEFAULTS the right sidebar to live status (MODQN evidence is opt-in)',
);
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr')),
  ['replay', 'objective', 'training', 'jobs'],
  'MODQN live cell preview left sidebar exposes the revived ω-objective editor tab alongside replay/training/jobs',
);
assert.equal(
  getDefaultLeftSidebarTabForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr'),
  'replay',
  'MODQN live cell preview still defaults the left sidebar to the replay cue',
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
const beamLoadCylinderSource = readRepoFile('src/viz/BeamLoadCylinder.tsx');
const beamLoadUploadParticlesSource = readRepoFile('src/viz/BeamLoadUploadParticles.tsx');
const handoverStoryLayerSource = readRepoFile('src/viz/HandoverStoryLayer.tsx');
const beamLoadUploadParticleHelpersSource = readRepoFile('src/viz/beamLoadUploadParticles.ts');
const groundSceneSource = readRepoFile('src/viz/GroundScene.tsx');
const modqnReplayCuePanelSource = readRepoFile('src/ui/ModqnReplayCuePanel.tsx');
const mainSceneSource = readRepoFile('src/scene/MainScene.tsx');
const candidateBeamHighlightSource = readRepoFile('src/viz/CandidateBeamHighlight.tsx');
const sinrOffsetExplainerSource = readRepoFile('src/ui/SinrOffsetExplainer.tsx');
const cellScheduleSource = readRepoFile('src/scene/useCellSchedule.ts');
const baseSceneLayoutSource = readRepoFile('src/scene/BaseSceneLayout.tsx');
const sceneTelemetrySource = readRepoFile('src/scene/SceneTelemetry.tsx');
const simStatePublisherSource = readRepoFile('src/scene/useSimStatePublisher.ts');
const panelStateSource = readRepoFile('src/scene/panelState.ts');
const sceneLaneRenderPlanSource = readRepoFile('src/scene/sceneLaneRenderPlan.ts');
const replayLayerSource = readRepoFile('src/scene/modqn-replay-visuals/index.tsx');
const replayTelemetrySource = readRepoFile('src/scene/modqn-replay-visuals/useReplaySceneTelemetry.tsx');
const algorithmDockSource = readRepoFile('src/showcase/dashboard/AlgorithmDock.tsx');
const algorithmDashboardSource = readRepoFile('src/showcase/dashboard/AlgorithmDashboard.tsx');
const liveTelemetryPanelSource = readRepoFile('src/showcase/dashboard/LiveTelemetryPanel.tsx');
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

// C5: the AlgorithmDock is no longer mounted in App (Dashboard view removed). Its
// component file is retained for the future MODQN data-flow diagram project, so the
// component-shape asserts below still run; only the App-side mount is gone.
assert.equal(
  countOccurrences(appSource, '<AlgorithmDock'),
  0,
  'App no longer mounts the AlgorithmDock (C5: Dashboard view removed; dock code retained, unmounted)',
);

assertContains(
  algorithmDockSource,
  'data-testid="algorithm-dock"',
  'AlgorithmDock exposes root test id',
);
assertContains(
  algorithmDockSource,
  'data-testid="algorithm-dock-toggle"',
  'AlgorithmDock exposes collapse toggle test id',
);
assertContains(
  algorithmDockSource,
  'aria-expanded={!collapsed}',
  'AlgorithmDock toggle declares expanded state',
);
assert.equal(
  countOccurrences(algorithmDockSource, '<AlgorithmDashboard'),
  1,
  'AlgorithmDock mounts AlgorithmDashboard exactly once',
);
assertContains(
  algorithmDockSource,
  'variant="dock"',
  'AlgorithmDock renders the dashboard in dock layout variant',
);
assertContains(
  algorithmDockSource,
  'content="flowchart"',
  'AlgorithmDock renders only the flowchart in the dashboard view (C4 split)',
);
assert.equal(
  countOccurrences(algorithmDockSource, '<LiveTelemetryPanel'),
  1,
  'AlgorithmDock mounts LiveTelemetryPanel exactly once',
);
assertContains(
  algorithmDockSource,
  'mode === \'artifact\'',
  'AlgorithmDock keeps artifact and live modes distinct',
);
assertNotContains(algorithmDockSource, "from 'three", 'AlgorithmDock must not import three');
assertNotContains(algorithmDockSource, 'from "three', 'AlgorithmDock must not import three');
assertNotContains(algorithmDockSource, '@react-three/', 'AlgorithmDock must not import react-three');
assertNotContains(algorithmDockSource, '../scene/', 'AlgorithmDock must not import scene modules');
assertNotContains(algorithmDockSource, '../../scene/', 'AlgorithmDock must not import scene modules');
assertNotContains(algorithmDockSource, '../viz/', 'AlgorithmDock must not import viz modules');
assertNotContains(algorithmDockSource, '../../viz/', 'AlgorithmDock must not import viz modules');
assertNotContains(algorithmDockSource, '<Canvas', 'AlgorithmDock must not mount Canvas');

{
  const dockTestIdIndex = algorithmDockSource.indexOf('data-testid="algorithm-dock"');
  const dashboardMountIndex = algorithmDockSource.indexOf('<AlgorithmDashboard');
  assert.ok(dockTestIdIndex >= 0, 'AlgorithmDock root test id exists');
  assert.ok(
    dashboardMountIndex > dockTestIdIndex,
    'AlgorithmDashboard is mounted inside the AlgorithmDock source',
  );
  assertContains(
    algorithmDockSource,
    'MODQN Algorithm Pipeline',
    'AlgorithmDock identifies the dock region',
  );
  assertContains(
    algorithmDockSource,
    'MODQN Live Training',
    'AlgorithmDock identifies the live dock region',
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

// ── C4: flowchart stays in the Dashboard view, the per-frame decision metric
//    tiles move to the artifact-replay sidebar (scene view, co-visible with 3D).
//    The split is display-only (Rule#6) — same artifact fields, different host.
assertContains(
  algorithmDashboardSource,
  "content?: 'all' | 'flowchart' | 'metrics'",
  'AlgorithmDashboard exposes the flowchart/metrics content split (C4)',
);
assertContains(
  algorithmDashboardSource,
  'data-content={content}',
  'AlgorithmDashboard stamps its content section on the root for view/lane gating',
);
// (no-3D / no-scene / no-viz import guards for AlgorithmDashboard are asserted in
//  the existing block below — not duplicated here.)

// App mounts the metric tiles in the artifact-replay sidebar, display-only +
// lane-owned. The flowchart host stays in the AlgorithmDock (Dashboard view).
assertContains(
  appSource,
  "from './showcase/dashboard/AlgorithmDashboard'",
  'App imports AlgorithmDashboard for the artifact-replay sidebar metrics',
);
assert.equal(
  countOccurrences(appSource, '<AlgorithmDashboard'),
  1,
  'App mounts AlgorithmDashboard exactly once (artifact-replay sidebar metrics)',
);
{
  const metricsMountIndex = appSource.indexOf('<AlgorithmDashboard');
  assert.ok(metricsMountIndex >= 0, 'App AlgorithmDashboard mount exists');
  const metricsSlice = appSource.slice(metricsMountIndex, metricsMountIndex + 220);
  assertContains(metricsSlice, 'content="metrics"', 'App sidebar dashboard renders only the metric tiles (C4 split)');
  assertContains(metricsSlice, 'variant="sidebar"', 'App sidebar dashboard uses the sidebar layout variant');
  const artifactTabIndex = appSource.indexOf("activeRightSidebarTab === 'artifact'");
  const liveTabIndex = appSource.indexOf("activeRightSidebarTab === 'live'");
  assert.ok(
    artifactTabIndex >= 0 && artifactTabIndex < metricsMountIndex && metricsMountIndex < liveTabIndex,
    'App sidebar metrics are lane-owned inside the artifact right-sidebar branch',
  );
}
assertNotContains(algorithmDashboardSource, "from 'three", 'AlgorithmDashboard must not import three');
assertNotContains(algorithmDashboardSource, 'from "three', 'AlgorithmDashboard must not import three');
assertNotContains(algorithmDashboardSource, '@react-three/', 'AlgorithmDashboard must not import react-three');
assertNotContains(algorithmDashboardSource, '../scene/', 'AlgorithmDashboard must not import scene modules');
assertNotContains(algorithmDashboardSource, '../../scene/', 'AlgorithmDashboard must not import scene modules');
assertNotContains(algorithmDashboardSource, '../viz/', 'AlgorithmDashboard must not import viz modules');
assertNotContains(algorithmDashboardSource, '../../viz/', 'AlgorithmDashboard must not import viz modules');
assertNotContains(algorithmDashboardSource, '<Canvas', 'AlgorithmDashboard must not mount Canvas');

assertContains(
  liveTelemetryPanelSource,
  'data-testid="live-telemetry-panel"',
  'LiveTelemetryPanel exposes root test id',
);
assertContains(
  liveTelemetryPanelSource,
  'data-plane="A"',
  'LiveTelemetryPanel declares Plane A provenance',
);
assertContains(
  liveTelemetryPanelSource,
  'data-testid="live-telemetry-provenance-chip"',
  'LiveTelemetryPanel exposes INV-1 provenance chips',
);
assertContains(
  liveTelemetryPanelSource,
  'source gap - not shown',
  'LiveTelemetryPanel fails closed on source gaps',
);
assertContains(
  liveTelemetryPanelSource,
  'data-testid="live-telemetry-status-badge"',
  'LiveTelemetryPanel exposes INV-2 status badge',
);
assertNotContains(liveTelemetryPanelSource, "from 'three", 'LiveTelemetryPanel must not import three');
assertNotContains(liveTelemetryPanelSource, 'from "three', 'LiveTelemetryPanel must not import three');
assertNotContains(liveTelemetryPanelSource, '@react-three/', 'LiveTelemetryPanel must not import react-three');
assertNotContains(liveTelemetryPanelSource, '../scene/', 'LiveTelemetryPanel must not import scene modules');
assertNotContains(liveTelemetryPanelSource, '../../scene/', 'LiveTelemetryPanel must not import scene modules');
assertNotContains(liveTelemetryPanelSource, '../viz/', 'LiveTelemetryPanel must not import viz modules');
assertNotContains(liveTelemetryPanelSource, '../../viz/', 'LiveTelemetryPanel must not import viz modules');
assertNotContains(liveTelemetryPanelSource, '<Canvas', 'LiveTelemetryPanel must not mount Canvas');

// Headless Plane-A feed: the single store publisher, mounted independent of any
// sidebar tab so the live dock is never starved (codex [P1]).
const trainingTelemetryFeedSource = readRepoFile('src/showcase/dashboard/TrainingTelemetryFeed.tsx');
assertContains(
  trainingTelemetryFeedSource,
  'publishTelemetryEvent',
  'TrainingTelemetryFeed feeds the live telemetry store',
);
assertContains(
  trainingTelemetryFeedSource,
  'return null',
  'TrainingTelemetryFeed is headless (renders nothing)',
);
assertNotContains(trainingTelemetryFeedSource, "from 'three", 'TrainingTelemetryFeed must not import three');
assertNotContains(trainingTelemetryFeedSource, 'from "three', 'TrainingTelemetryFeed must not import three');
assertNotContains(trainingTelemetryFeedSource, '@react-three/', 'TrainingTelemetryFeed must not import react-three');
assertNotContains(trainingTelemetryFeedSource, '../scene/', 'TrainingTelemetryFeed must not import scene modules');
assertNotContains(trainingTelemetryFeedSource, '../../scene/', 'TrainingTelemetryFeed must not import scene modules');
assertNotContains(trainingTelemetryFeedSource, '../viz/', 'TrainingTelemetryFeed must not import viz modules');
assertNotContains(trainingTelemetryFeedSource, '../../viz/', 'TrainingTelemetryFeed must not import viz modules');
assertNotContains(trainingTelemetryFeedSource, '<Canvas', 'TrainingTelemetryFeed must not mount Canvas');
assertContains(
  appSource,
  "<TrainingTelemetryFeed enabled={appMode === 'modqn-demo'}",
  'App mounts the headless telemetry feed for modqn-demo independent of any tab',
);

// ── FIX-1: render-truth honesty — a non-producer artifact source is loud ──
// The dev middleware stamps `X-Showcase-Artifact-Source`. When the pinned
// producer artifact is absent it falls back to a synthetic fixture; the app
// must read that header, warn, expose it as scene telemetry, and render a
// visible badge so synthetic data can never be silently mistaken for a
// producer result (audit 2026-06-03 A2/A4). Display-only; no truth change.
const artifactSourceBadgeSource = readRepoFile('src/ui/ArtifactSourceBadge.tsx');
assertContains(
  appSource,
  "r.headers.get('X-Showcase-Artifact-Source')",
  'App reads the artifact-source transport header on the replay fetch',
);
assertContains(
  appSource,
  'artifactSource !== PRODUCER_PINNED_SOURCE',
  'App warns whenever the artifact source is not the pinned producer artifact',
);
assertContains(
  appSource,
  "r.headers.get('X-Showcase-Artifact-Source') ?? HEADER_ABSENT_SOURCE",
  'App maps a completed header-absent 200 to the distinct sentinel, not the loading null',
);
assertContains(
  appSource,
  'artifactSource === SYNTHETIC_FIXTURE_SOURCE',
  'App warn copy only calls the synthetic fixture "synthetic"; unverified sources say unverified',
);
assertContains(
  artifactSourceBadgeSource,
  "HEADER_ABSENT_SOURCE = 'header-absent'",
  'badge names the header-absent sentinel distinct from the loading null',
);
assertContains(
  artifactSourceBadgeSource,
  'source === HEADER_ABSENT_SOURCE',
  'badge renders the honesty surface for a completed response with no source header',
);
assertContains(
  appSource,
  "from './ui/ArtifactSourceBadge'",
  'App imports the render-truth honesty badge',
);
assertContains(
  appSource,
  '<ArtifactSourceBadge source={showcaseArtifactSource} />',
  'App mounts the artifact-source honesty badge in the artifact-replay lane',
);
assertContains(
  appSource,
  'data-artifact-source={',
  'App exposes the resolved artifact source as scene telemetry',
);
assertContains(
  artifactSourceBadgeSource,
  "PRODUCER_PINNED_SOURCE = 'producer-pinned'",
  'badge pins the real producer source token',
);
assertContains(
  artifactSourceBadgeSource,
  "SYNTHETIC_FIXTURE_SOURCE = 'synthetic-fixture-fallback'",
  'badge names the synthetic fixture fallback source token',
);
assertContains(
  artifactSourceBadgeSource,
  'source === null || source === PRODUCER_PINNED_SOURCE',
  'badge stays silent for the real producer source and the unknown/loading state',
);
assertContains(
  artifactSourceBadgeSource,
  'data-testid="artifact-source-badge"',
  'badge exposes a browser test id for the honesty surface',
);
// FIX-4: the durable Director cinematic browser gate reads these shell telemetry
// attributes (director FSM phase + effective playback speed). Lock them so they
// cannot be silently removed and quietly disable the gate.
assertContains(
  appSource,
  'data-director-phase={camera.directorPhase}',
  'App exposes the director FSM phase as shell telemetry for the cinematic gate',
);
assertContains(
  appSource,
  'data-effective-speed={playback.effectiveSpeed',
  'App exposes the effective playback speed as shell telemetry for the cinematic gate',
);

// ── ITEM #C: live-walker Director seek-to-next-HO + sat-pair framing ──
// The live Director button mirrors the artifact cinematic (seek to the next
// handover + 0.25x slow-mo + frame the satellite pair) on the live Walker lanes,
// against the validated live Walker event index. Honesty: the seek target is a
// real source-time (resolveLiveWalkerFocusWindow returns window.startSec, never a
// fabricated horizon — docs/live-walker-handover-event-map-sdd.md) and the claim
// stays profile-derived-forecast / overlay-demo, never producer proof. Lock the
// resolver, the live seek + deferred sat-pair focus wiring, and the claim telemetry.
const liveWalkerDirectorFocusSource = readRepoFile('src/scene/liveWalkerDirectorFocus.ts');
assertContains(
  liveWalkerDirectorFocusSource,
  'const window = resolveCinematicReplayWindow(events, kind, nowSec, durationSec);',
  'live Walker Director resolver reuses the proven cinematic event selection',
);
assertContains(
  liveWalkerDirectorFocusSource,
  'seekTargetSec: window.startSec,',
  'live Walker Director seek target is a real source-time lead-in, not a fabricated horizon',
);
assertContains(
  liveWalkerDirectorFocusSource,
  "export type LiveWalkerDirectorFocusClaimKind = 'profile-derived-forecast' | 'overlay-demo';",
  'live Walker Director focus claim is forecast/overlay-demo only, never producer proof',
);
// P3: the director orchestration (requestDirectorFocus + the cinematic/live focus
// lifecycle) was extracted from App into useDirectorOrchestration; App keeps the
// honesty TELEMETRY JSX + the lane-mapped claim const and mounts the hook.
const directorOrchestrationSource = readRepoFile('src/app/useDirectorOrchestration.ts');
assertContains(
  appSource,
  'useDirectorOrchestration({',
  'App wires the extracted director orchestration hook',
);
assertContains(
  directorOrchestrationSource,
  "from '../scene/liveWalkerDirectorFocus'",
  'director hook imports the live Walker Director focus resolver',
);
assertContains(
  directorOrchestrationSource,
  'resolveLiveWalkerFocusWindow(',
  'director hook resolves the next live Walker handover for the Director focus',
);
assertContains(
  appSource,
  "sceneLane === 'modqn-live-cell-preview' ? 'overlay-demo' : 'profile-derived-forecast'",
  'App labels the live Director focus claim by lane (overlay-demo vs profile-derived-forecast)',
);
assertContains(
  directorOrchestrationSource,
  'pendingLiveFocusRef.current = {',
  'director hook arms a deferred live Director focus so the sat-pair pose reads the post-seek frame',
);
assertContains(
  directorOrchestrationSource,
  'camera.requestInterFocus(pending.framing)',
  'director hook passes the resolved live sat-pair framing into the inter-HO Director focus',
);
assertContains(
  appSource,
  'data-live-director-focus-claim={directorFocusEnabled ? liveDirectorFocusClaimKind : undefined}',
  'App exposes the live Director focus claim as honesty telemetry',
);
assertContains(
  appSource,
  'data-live-director-focus-event-sec={liveDirectorFocusEventSec !== null ? liveDirectorFocusEventSec.toFixed(3) : undefined}',
  'App exposes the resolved live Director focus event source-time (binds the seek to a real indexed event)',
);
assertContains(
  directorOrchestrationSource,
  'const cancelPendingLiveFocus = useCallback(() => {',
  'director hook can cancel an armed-but-unfired live Director focus',
);
assertContains(
  directorOrchestrationSource,
  '}, [sceneLane, cancelPendingLiveFocus]);',
  'director hook cancels a stale armed live Director focus on a lane switch (no cross-lane sat-pair leak)',
);
assertNotContains(
  liveWalkerDirectorFocusSource,
  'Math.random',
  'live Walker Director resolver must not fabricate event times',
);

// ── FIX-5 Option C: honest satellite azimuth HUD (artifact-replay only) ──
// A 2D DOM compass-rose HUD recovers the truthful ground-plane azimuth of the
// producer's flattened ECI-proxy satellites without fabricating the missing
// overhead elevation. It is a Shared Surface (no new viewport proof layer): it
// must import no three / react-three / Canvas, must stay lane-owned (mounted
// only on artifact-replay), and must keep its azimuth-only honesty caption so
// it cannot silently start overclaiming elevation/Earth-rotation truth.
const artifactSatelliteCompassSource = readRepoFile('src/ui/ArtifactSatelliteCompass.tsx');
const artifactSatelliteAzimuthsSource = readRepoFile('src/ui/artifactSatelliteAzimuths.ts');
const SATELLITE_COMPASS_HONESTY_LABEL =
  'Satellites — orbital azimuth only (ECI proxy, no elevation/Earth-rotation)';
assertContains(
  artifactSatelliteCompassSource,
  SATELLITE_COMPASS_HONESTY_LABEL,
  'satellite compass keeps the azimuth-only / no-elevation honesty caption',
);
assertContains(
  artifactSatelliteCompassSource,
  'export const SATELLITE_COMPASS_HONESTY_LABEL',
  'satellite compass exports the honesty caption so the governance gate can lock it',
);
assertContains(
  artifactSatelliteCompassSource,
  'data-testid="artifact-satellite-compass"',
  'satellite compass exposes its root test id for the real-data browser smoke',
);
assertContains(
  artifactSatelliteCompassSource,
  'data-testid="artifact-satellite-azimuth-marker"',
  'satellite compass exposes per-satellite azimuth markers for the browser smoke',
);
assertContains(
  artifactSatelliteCompassSource,
  'data-has-elevation={hasElevationData',
  'satellite compass surfaces the data-driven elevation flag (false for the flat proxy)',
);
// Proxy-only gate (codex FIX-5 P2): the azimuth-only / "no elevation" caption is
// truthful ONLY for the flattened ECI proxy. The compass must render nothing for
// a real ecef-km / mixed / elevation-bearing frame, or it overclaims a missing
// limitation in the opposite direction.
assertContains(
  artifactSatelliteCompassSource,
  'if (!isFlatEciProxy) return null',
  'satellite compass renders ONLY for the flat ECI proxy frame (no proxy caption on real geometry)',
);
assertContains(
  artifactSatelliteCompassSource,
  'data-frame-kind="eci-km-no-earth-rotation-proxy"',
  'satellite compass surfaces the proxy frame kind it is honest about',
);
assertContains(
  artifactSatelliteAzimuthsSource,
  'isFlatEciProxy',
  'azimuth helper derives the flat-ECI-proxy gate',
);
assertContains(
  artifactSatelliteAzimuthsSource,
  "FLAT_ECI_PROXY_FRAME = 'eci-km-no-earth-rotation-proxy'",
  'azimuth helper pins the flat ECI proxy frame it gates on',
);
// no-3D-viewport-layer property: a DOM HUD, never a Canvas / three render layer.
assertNotContains(artifactSatelliteCompassSource, "from 'three", 'satellite compass must not import three');
assertNotContains(artifactSatelliteCompassSource, 'from "three', 'satellite compass must not import three');
assertNotContains(artifactSatelliteCompassSource, '@react-three/', 'satellite compass must not import react-three');
assertNotContains(artifactSatelliteCompassSource, '<Canvas', 'satellite compass must not mount a Canvas (no 3D viewport layer)');
assertNotContains(artifactSatelliteCompassSource, 'useFrame', 'satellite compass must not drive a render-loop frame hook');
// display-only: it reads only the NormalizedSceneFrame satellite TYPE + the pure
// azimuth helper; it must not import a scene/viz runtime composer.
assertContains(
  artifactSatelliteCompassSource,
  "import type { NormalizedSatellite } from '../scene/NormalizedSceneFrame'",
  'satellite compass reads only the satellite type (display-only, no scene runtime import)',
);
assertContains(
  artifactSatelliteCompassSource,
  "import { deriveSatelliteAzimuths } from './artifactSatelliteAzimuths'",
  'satellite compass derives azimuths via the pure unit-tested helper',
);
assertContains(
  artifactSatelliteAzimuthsSource,
  'export function deriveSatelliteAzimuths',
  'azimuth helper exports the pure derivation',
);
assertContains(
  artifactSatelliteAzimuthsSource,
  'hasElevationData',
  'azimuth helper reports whether real elevation was present (never fabricated)',
);
assertNotContains(artifactSatelliteAzimuthsSource, "from 'three", 'azimuth helper stays pure (no three import)');
// App mounts it exactly once, lane-gated to artifact-replay.
assertContains(
  appSource,
  "from './ui/ArtifactSatelliteCompass'",
  'App imports the honest satellite azimuth compass',
);
assert.equal(
  countOccurrences(appSource, '<ArtifactSatelliteCompass'),
  1,
  'ArtifactSatelliteCompass is mounted exactly once',
);
{
  const compassMountIndex = appSource.indexOf('<ArtifactSatelliteCompass');
  assert.ok(compassMountIndex >= 0, 'ArtifactSatelliteCompass mount exists in App');
  const compassGuardSlice = appSource.slice(Math.max(0, compassMountIndex - 160), compassMountIndex);
  assertContains(
    compassGuardSlice,
    "sceneLane === 'artifact-replay'",
    'ArtifactSatelliteCompass mount is lane-gated to artifact-replay',
  );
}
assertContains(
  governanceDoc,
  'Artifact Satellite Azimuth HUD (FIX-5 Option C)',
  'governance doc documents the satellite azimuth HUD shared surface',
);
assertContains(
  governanceDoc,
  'never the missing elevation',
  'governance doc records the HUD never fabricates elevation',
);

// The dev middleware is the header EMITTER for the honesty surface — it must
// derive the source from the loader's resolved source, never hardcode synthetic,
// so an env-provided / regenerated real artifact is not mislabeled as fake.
const viteConfigSource = readRepoFile('vite.config.ts');
assertContains(
  viteConfigSource,
  "source.kind === 'synthetic'",
  'dev middleware derives the artifact-source header from the loader source',
);
assertContains(
  viteConfigSource,
  "'external-artifact-path'",
  'dev middleware labels an env-provided external artifact distinctly from the synthetic fixture',
);
assertNotContains(
  viteConfigSource,
  "res.setHeader('X-Showcase-Artifact-Source', 'synthetic-fixture-fallback')",
  'dev middleware must not hardcode the synthetic header on the loader fallback path',
);

// ── Track-2 design-token bridge: value-preserving INV colour contract ──
// The INV-1/2/3 colours are now named :root tokens (src/styles/main.scss). These
// assertions lock both (a) the token VALUES so a future edit cannot silently
// drift an INV colour, and (b) that the INV selectors REFERENCE the tokens so the
// contract cannot be bypassed by re-hardcoding the hex. Together they prove the
// staleness != offline and source-gap distinctions stay byte-identical.
const mainScssSource = readRepoFile('src/styles/main.scss');
for (const [token, value] of [
  // INV-1 truth-plane (chip text + border are distinct hues, both locked)
  ['--leo-plane-live', '#76ead7'],
  ['--leo-plane-live-border', 'rgba(118, 234, 215, 0.5)'],
  ['--leo-plane-paper', '#8fc0ff'],
  ['--leo-plane-paper-border', 'rgba(120, 178, 255, 0.5)'],
  ['--leo-plane-user', '#ffce82'],
  ['--leo-plane-user-border', 'rgba(255, 200, 110, 0.5)'],
  // INV-2 telemetry status (stalled freeze-grey is distinct from offline red)
  ['--leo-telemetry-live-border', 'rgba(129, 246, 188, 0.32)'],
  ['--leo-telemetry-stalled-border', 'rgba(193, 205, 214, 0.32)'],
  ['--leo-telemetry-stalled-bg', 'rgba(160, 173, 184, 0.12)'],
  ['--leo-telemetry-stalled-text', 'rgba(218, 226, 232, 0.88)'],
  ['--leo-telemetry-offline-border', 'rgba(255, 118, 118, 0.32)'],
  ['--leo-telemetry-offline-bg', 'rgba(255, 118, 118, 0.1)'],
  ['--leo-telemetry-offline-text', 'rgba(255, 205, 205, 0.94)'],
  ['--leo-telemetry-frozen-filter', 'grayscale(0.42)'],
  ['--leo-telemetry-idle-border', 'rgba(138, 162, 184, 0.34)'],
  // INV-3 source-gap (absent producer channel; never fabricated)
  ['--leo-source-gap-chip-border', 'rgba(255, 190, 69, 0.34)'],
  ['--leo-source-gap-chip-bg', 'rgba(255, 190, 69, 0.09)'],
  ['--leo-source-gap-chip-text', 'rgba(255, 217, 142, 0.92)'],
  ['--leo-source-gap-text', 'rgba(255, 190, 69, 0.86)'],
  // Interactive accent (teal #76ead7 === rgb(118,234,215))
  ['--leo-accent-rgb', '118, 234, 215'],
] as const) {
  assertContains(
    mainScssSource,
    `${token}: ${value};`,
    `design token ${token} keeps its value-preserving INV literal`,
  );
}
assertContains(mainScssSource, 'color: var(--leo-plane-live);', 'INV-1 live truth-tone chip references the plane-live token');
assertContains(mainScssSource, 'color: var(--leo-plane-paper);', 'INV-1 paper truth-tone chip references the plane-paper token');
assertContains(mainScssSource, 'color: var(--leo-plane-user);', 'INV-1 user truth-tone chip references the plane-user token');
assertContains(mainScssSource, 'border-color: var(--leo-telemetry-stalled-border);', 'INV-2 stalled badge references the staleness token (distinct from offline)');
assertContains(mainScssSource, 'border-color: var(--leo-telemetry-offline-border);', 'INV-2 offline badge references the offline token (distinct from stalled)');
assertContains(mainScssSource, 'border-color: var(--leo-telemetry-idle-border);', 'INV-2 idle badge references the idle token (no-run state distinct from offline)');
assertContains(liveTelemetryPanelSource, 'data-telemetry-status="idle"', 'LiveTelemetryPanel renders an idle (not offline) badge for the no-run empty state');
assertContains(mainScssSource, 'filter: var(--leo-telemetry-frozen-filter);', 'INV-2 frozen tile references the freeze-filter token');
assertContains(mainScssSource, 'background: var(--leo-source-gap-chip-bg);', 'INV-3 source-gap chip references the source-gap background token');
assertContains(mainScssSource, 'color: var(--leo-source-gap-chip-text);', 'INV-3 source-gap chip references the source-gap text token');

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
assertContains(appRuntimeModelSource, "lane === 'modqn-live-cell-preview') return MODQN_RIGHT_SIDEBAR_TABS", 'App runtime model offers cell preview right sidebar live status + co-visible MODQN evidence');
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
  '{showSinrLiveControls && (',
  'ControlBar wraps live-only controls in the SINR live lane',
);
// Live-only controls remain gated behind the showSinrLiveControls branch.
// (Consolidation C1 removed the in-ControlBar playback speed slider, so the
// upper bound is the MODQN-layer group that follows the live block instead.)
{
  const liveOnlyBranchIndex = controlBarSource.indexOf('{showSinrLiveControls && (');
  // Upper bound = the MODQN-layer group that follows the SINR-live block. Every
  // live-only control must sit BETWEEN the branch open and that group, so a future
  // edit that accidentally hoists a control out of the SINR-live branch is caught
  // (codex C1 [P3]).
  const modqnLayerGroupIndex = controlBarSource.indexOf('data-testid="modqn-layer-preset-control"');
  assert.ok(
    liveOnlyBranchIndex >= 0 && modqnLayerGroupIndex > liveOnlyBranchIndex,
    'ControlBar keeps the SINR-live branch before the MODQN-layer group',
  );
  for (const [needle, label] of [
    ['data-testid="beam-density-control"', 'beam density controls'],
    ['data-testid="beam-info-toggle"', 'beam info toggle'],
    ['data-testid="camera-preset-control"', 'camera preset controls'],
    ['Spotlight', 'spotlight control copy'],
    ['HO Slow', 'HO slow control copy'],
  ] as const) {
    const controlIndex = controlBarSource.indexOf(needle, liveOnlyBranchIndex);
    assert.ok(
      controlIndex > liveOnlyBranchIndex && controlIndex < modqnLayerGroupIndex,
      `ControlBar must keep live-only ${label} inside the SINR live branch (before the MODQN-layer group)`,
    );
  }
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
// ── Handover-cinema candidate highlight (S1) lane-ownership source locks ──
assertContains(
  sceneLaneRenderPlanSource,
  'showCandidateHandoverHighlight',
  'Scene lane render plan owns the handover-cinema candidate-highlight gate',
);
assertContains(
  sceneLaneRenderPlanSource,
  "const showCandidateHandoverHighlight = showSinrLiveViewport && input.cinematicMode === 'director'",
  'Candidate highlight is gated sinr-live + director (no producer dependency, inert elsewhere)',
);
assertContains(
  mainSceneSource,
  'showCandidateHandoverHighlight && runtime.candidateHighlight',
  'MainScene mounts the candidate highlight only under the render-plan gate + an armed command',
);
assertContains(
  mainSceneSource,
  '<CandidateBeamHighlight',
  'MainScene mounts the lane-owned CandidateBeamHighlight layer',
);
assertContains(
  candidateBeamHighlightSource,
  'dataset.candidateHandoverHighlightRenderedCount',
  'Candidate highlight publishes a MESH-derived rendered-count observable (validator-provable render)',
);
assertContains(
  sinrOffsetExplainerSource,
  'data-claim-kind="sinr-offset"',
  'SINR explainer is stamped lane-truthful claim-kind="sinr-offset" (never producer/MODQN proof)',
);
// ── SINR-serving mosaic (S2) lane-ownership + distinct-from-MODQN source locks ──
const sinrServingMosaicSource = readRepoFile('src/scene/sinrServingMosaic.ts');
const sinrServingAggregateSource = readRepoFile('src/ui/SinrServingAggregate.tsx');
assertContains(
  sceneLaneRenderPlanSource,
  'const showSinrServingMosaic = showSinrLiveViewport',
  'SINR-serving mosaic is gated sinr-live only (always-on ambient, no producer dependency)',
);
assertContains(
  sinrServingMosaicSource,
  'export function buildSinrServingUeColorMap',
  'SINR-serving mosaic owns its own UE colour derivation (distinct module, not deriveModqnServiceMap)',
);
assertContains(
  sinrServingMosaicSource,
  'export function deriveSinrServingMosaicAggregate',
  'SINR-serving mosaic owns the served N/N + per-beam-load + mean-SINR aggregate',
);
assertNotContains(
  sinrServingMosaicSource,
  "from './modqnServiceMap'",
  'SINR-serving mosaic must NOT import the MODQN cell overlay map (distinct lane-owned layer)',
);
assertContains(
  mainSceneSource,
  'if (!showSinrServingMosaic) return null;',
  'MainScene derives the SINR-serving mosaic colours only under the render-plan gate (sinr-live)',
);
assertContains(
  mainSceneSource,
  "colorTelemetryAttr={showSinrServingMosaic ? 'sinrServingMosaicColorCount' : undefined}",
  'MainScene threads the mosaic mesh-derived colour telemetry only on the sinr-live mosaic lane',
);
assertContains(
  groundSceneSource,
  'function publishInstanceColorTelemetry',
  'GroundScene publishes a MESH-derived distinct-colour count (validator-provable mosaic render)',
);
assertContains(
  sinrServingAggregateSource,
  'data-claim-kind="sinr-serving"',
  'SINR-serving aggregate is stamped lane-truthful claim-kind="sinr-serving" (never producer/MODQN proof)',
);
assertContains(
  sinrServingAggregateSource,
  'live SINR serving · not MODQN',
  'SINR-serving aggregate carries the lane-truthful "not MODQN" disclosure',
);
assertContains(
  appSource,
  '<SinrServingAggregate',
  'App mounts the SINR-serving aggregate HUD',
);
assertContains(
  appSource,
  "visible={sceneLane === 'sinr-live'}",
  'App gates the SINR-serving aggregate HUD to the sinr-live lane',
);

// ── SINR-live earth-fixed cell truth (S-cells-2, ADDITIVE) lane ownership ──
// The cell truth is a NEW optional SimFrame field (`sinrLiveCells`) produced by a
// pure runtime adapter, lane-owned to sinr-live ONLY. The load-bearing property
// is ADDITIVE: `runtimeFrameStep.ts` stays FROZEN and existing frame fields are
// byte-identical, so the three MODQN/artifact lanes see ZERO drift. Render does
// NOT consume the field until S-cells-3 — these locks pin that boundary.
const useSimulationSource = readRepoFile('src/scene/useSimulation.ts');
const sinrLiveCellRuntimeSource = readRepoFile('src/scene/sinrLiveCellRuntime.ts');
const runtimeFrameStepSource = readRepoFile('src/scene/runtimeFrameStep.ts');
const cellLayoutSource = readRepoFile('src/engine/cells/cellLayout.ts');
const sceneTypesSource = readRepoFile('src/scene/types.ts');
// (a) the lane gate: MainScene owns it as sinr-live ONLY and threads it into the
//     single live useSimulation hook.
assertContains(
  mainSceneSource,
  "const useEarthFixedCellTruth = sceneLane === 'sinr-live';",
  'MainScene gates the earth-fixed cell truth to the sinr-live lane only',
);
assertContains(
  mainSceneSource,
  'paperUserArea.kmPerWorldUnit,\n    useEarthFixedCellTruth,\n  );',
  'MainScene threads the cell-truth gate into the live useSimulation hook',
);
// (b) the factory is gated (returns null off lane) → the additive no-op.
assertContains(
  useSimulationSource,
  'createSinrLiveCellModel(profile, useEarthFixedCellTruth, replay.epochUtcMs)',
  'useSimulation builds the cell model only through the lane gate',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'if (!useEarthFixedCellTruth) return null;',
  'cell-truth factory returns null when the lane gate is off (other-lane zero-drift)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'if (model === null) return;',
  'cell-truth attach is a no-op for a null model (additive: off-lane frames untouched)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'frame.sinrLiveCells = model.step(',
  'cell-truth attach mutates ONLY the new sinrLiveCells field',
);
// (c) purity / additivity structural locks: the runtime adapter must not pull the
//     scene-type hub or the frozen runtime stepper, so it CANNOT touch any other
//     frame field — and `runtimeFrameStep.ts` must stay free of cell-truth symbols
//     (FROZEN, S-cells-2-A).
assertNotContains(
  sinrLiveCellRuntimeSource,
  "from './types'",
  'cell-truth adapter must not import the SimFrame hub (stays additive + THREE-free)',
);
assertNotContains(
  sinrLiveCellRuntimeSource,
  "from './runtimeFrameStep'",
  'cell-truth adapter must not import the frozen runtime stepper',
);
assertNotContains(
  runtimeFrameStepSource,
  'sinrLiveCell',
  'runtimeFrameStep.ts stays FROZEN: no cell-truth symbol leaks into buildLinkContext (S-cells-2-A)',
);
// (d) the new SimFrame field is an optional, sinr-live-only addition.
assertContains(
  sceneTypesSource,
  'sinrLiveCells?: SinrLiveCellFrame;',
  'SimFrame carries the cell truth as an OPTIONAL field (undefined off the sinr-live lane)',
);
// (e) S-cells-3 FLIPS the S-cells-2 boundary: render now CONSUMES the cell truth.
//     MainScene reads `sim.sinrLiveCells` to draw the cell-truth beam cones.
assertContains(
  mainSceneSource,
  'sim.sinrLiveCells',
  'MainScene consumes the cell truth in S-cells-3 (cell-truth beam cone render)',
);
// (f) elevation-mask parity: the cell candidate visibility mask equals the
//     runtime linkSats mask (both 15°), pinned to the cell-layout default.
assertContains(
  runtimeFrameStepSource,
  'MIN_ELEVATION_DEG = 15',
  'runtime linkSats elevation mask is 15°',
);
assertContains(
  cellLayoutSource,
  'DEFAULT_MIN_ELEVATION_DEG = 15',
  'cell-layout default elevation mask is 15° (parity with the runtime linkSats mask)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'SINR_LIVE_CELL_MIN_ELEVATION_DEG = DEFAULT_MIN_ELEVATION_DEG',
  'cell-truth adapter pins its mask to the cell-layout default (single source of truth)',
);
// (g) the runtime-wiring gate is wired into package.json.
assertContains(
  packageJson,
  '"validate:phase-c:sinr-live-cells:runtime"',
  'package exposes the S-cells-2 runtime-wiring validator',
);

// ── SINR-live earth-fixed cell-truth RENDER (S-cells-3) lane ownership ──
// The cell truth becomes the lane's PRIMARY beam render: cones at FIXED cell
// centres (apex = serving sat, base = cell centre) replacing the steered,
// UE-anchored SatelliteBeams, so the UE renders visibly off-centre. Lane-owned to
// sinr-live ONLY via a NEW render-plan flag (NOT `showCellOverlay`, which stays
// MODQN-only). Serving comes from the SINR + HandoverManager cell truth, NEVER the
// round-robin `cellScheduler` (codex BLOCK-3).
const sinrLiveCellBeamConesSource = readRepoFile('src/viz/SinrLiveCellBeamCones.tsx');
const useBeamVizSource = readRepoFile('src/scene/useBeamViz.ts');
// (h) the new render-plan flag is lane-gated to the sinr-live viewport, NOT the
//     MODQN cell overlay.
assertContains(
  sceneLaneRenderPlanSource,
  'showSinrLiveCellBeams: boolean',
  'render plan declares the cell-truth beam-cone flag',
);
assertContains(
  sceneLaneRenderPlanSource,
  'const showSinrLiveCellBeams = showSinrLiveViewport;',
  'cell-truth cones are lane-gated to the sinr-live viewport (NOT showCellOverlay)',
);
// (i) MainScene mounts the cell-truth cones AND suppresses the steered
//     SatelliteBeams on this lane (so they do not double-draw / contradict).
assertContains(
  mainSceneSource,
  '<SinrLiveCellBeamCones',
  'MainScene mounts the lane-owned cell-truth beam cones',
);
assertContains(
  mainSceneSource,
  '&& !showSinrLiveCellBeams && viz.displaySats',
  'MainScene suppresses the steered SatelliteBeams cones on the cell-truth lane',
);
// (j) the steered UE-anchor is retired for this lane via the explicit useBeamViz
//     gate; off-lane callers keep the anchored render unchanged.
assertContains(
  mainSceneSource,
  '// S-cells-3: retire the UE-anchor on the sinr-live lane only',
  'MainScene threads the UE-anchor retirement into useBeamViz for sinr-live only',
);
assertContains(
  useBeamVizSource,
  'disableUeAnchor?: boolean',
  'useBeamViz exposes the per-lane UE-anchor retirement flag',
);
assertContains(
  useBeamVizSource,
  '!disableUeAnchor',
  'useBeamViz forces the UE-anchor off when the retirement flag is set',
);
// (k) BLOCK-3 import purity: the cone resolver consumes the cell TRUTH only — it
//     must NOT pull the round-robin scheduler (that display oracle stays
//     MODQN-lane-only in CellBeamCones.tsx).
assertNotContains(
  sinrLiveCellBeamConesSource,
  "from '../scene/useCellSchedule'",
  'cell-truth cone resolver must not import the round-robin useCellSchedule (BLOCK-3)',
);
assertNotContains(
  sinrLiveCellBeamConesSource,
  "from '../engine/cells/cellScheduler'",
  'cell-truth cone resolver must not import the round-robin cellScheduler (BLOCK-3)',
);
assertContains(
  sinrLiveCellBeamConesSource,
  "from '../scene/sinrLiveCellModel'",
  'cell-truth cone resolver consumes the SinrLiveCellFrame truth type',
);
// (l) MainScene places the cones from the SAME layout builder the runtime cell
//     truth uses, so cellIds match `sim.sinrLiveCells` (no placement drift).
assertContains(
  mainSceneSource,
  'buildSinrLiveCellLayout(profile)',
  'MainScene builds cone placements from the same cell layout as the runtime truth',
);
// (m) the render gates are wired into package.json + the live-render suite.
assertContains(
  packageJson,
  '"validate:phase-c:sinr-live-cells:render"',
  'package exposes the S-cells-3 render model gate',
);
assertContains(
  packageJson,
  '"validate:phase-c:sinr-live-cells:render:browser"',
  'package exposes the S-cells-3 render browser gate',
);
assertContains(
  packageJson,
  'sinr-serving-mosaic:browser && npm run validate:phase-c:sinr-live-cells:render:browser',
  'live-render suite includes the S-cells-3 render browser gate',
);

// ── Serving cones, FOCUS-SUBSET of serving sats, frequency-reuse colour (S-cells-4b-fix) ──
// The lane draws SERVING beams only (apex = serving sat, base = served cell), but
// FOCUS-SCOPED to a few satellites — `resolveTopServingFocusSatIds` picks the top
// serving sats by SERVED-CELL count + the primary UE's serving sat (NOT the old
// broken "most-illuminating" fallback that drew the wrong sat). This keeps the
// additive-glow cones readable instead of blowing out the view with every serving
// sat's fan. Continuity keeps the focus stable. Colour = FREQUENCY-REUSE
// (`cellId mod reuse`) so a fan is multi-colour (multibeam pattern, NOT a per-sat
// tint). Breadth of who-is-served stays in the UE mosaic (Rule#6 display filter).
assertContains(
  sinrLiveCellBeamConesSource,
  'if (!beam.serving) continue;',
  'cone resolver draws ONLY serving beams (no idle/illuminating-only cones)',
);
assertNotContains(
  sinrLiveCellBeamConesSource,
  'resolveSinrLiveConeFocusSatIds',
  'the old most-illuminating fallback is gone (it hid the serving sat behind a wrong sat)',
);
assertContains(
  sinrLiveCellBeamConesSource,
  'export function resolveTopServingFocusSatIds',
  'cone focus = top serving sats by served-cell count + preferred (NOT most-illuminating)',
);
assertContains(
  sinrLiveCellBeamConesSource,
  'color: frequencyReuseColor(beam.frequencyIndex)',
  'cone colour = frequency-reuse (one satellite fan is multi-colour, the multibeam pattern — NOT a per-sat tint)',
);
assertContains(
  sinrLiveCellBeamConesSource,
  'blending={THREE.AdditiveBlending}',
  'cones use additive glow (bright beams, not a hazy normal-blend veil)',
);
assertContains(
  mainSceneSource,
  'resolveTopServingFocusSatIds(cellFrame, SINR_LIVE_CONE_MAX_FOCUS_SATS, primaryServingSatId)',
  'MainScene focus-scopes the cones to the top serving sats + the primary UE serving sat',
);
assertContains(
  mainSceneSource,
  'focusSatIds: sinrLiveConeFocusSatIds',
  'MainScene passes the focus subset into the cone resolver (readable cone count)',
);

// ── Mosaic + aggregate re-point to the cell truth (S-cells-4c) ──
// On sinr-live the SERVING displays (3D UE mosaic + the served N/N aggregate HUD +
// per-UE diagnostics) read the EARTH-FIXED CELL truth, NOT the steered serving — a
// UE is "connected" (coloured / counted) only when its cell is lit + served, so the
// dots + cones + counter all agree. The 3D mosaic builds from the cell truth; the
// HUD/diagnostics read it via the published `perUePositions` (cell truth replaces
// the steered serving whenever `sim.sinrLiveCells` is present = the sinr-live gate).
assertContains(
  mainSceneSource,
  'buildSinrServingUeColorMapFromCells(cellFrame.ues)',
  'the 3D mosaic colours UE markers from the cell truth on sinr-live (UE connects only when its cell is lit)',
);
assertContains(
  simStatePublisherSource,
  'const cellTruthUes = sim.sinrLiveCells?.ues;',
  'the published per-UE serving is the cell truth when present (aggregate + diagnostics agree with the cones)',
);
assertContains(
  simStatePublisherSource,
  'servingBeamId: ue.servingSatId === null ? null : ue.cellId,',
  'cell-truth per-UE serving maps cellId → servingBeamId (unserved → null beam, honest)',
);

// ── EarthFixedCells green-disc retired (S-cells-4d) ──
// The legacy 20-hex steered-cover green-disc ground paint is RETIRED on the
// sinr-live lane — the cell-truth beam cones own the earth-fixed cell story, and
// two competing cell layouts on one viewport is a render-governance violation. The
// flag is pinned false and MainScene no longer mounts the component (its hex-cover
// MODEL + `validate:vc3a:hex-paint` logic gate stay intact for reuse).
assertContains(
  sceneLaneRenderPlanSource,
  'showEarthFixedCells: false,',
  'the legacy hex green-disc is retired (flag pinned false) — cell-truth cones own the cell story',
);
assertNotContains(
  mainSceneSource,
  '<EarthFixedCells',
  'MainScene must not mount the retired hex green-disc (no competing 2nd cell layout)',
);

// ── Beam hopping + serving continuity + coverage (S-cells-3 / 4a / 4b-fix) ──
// A satellite forms a fixed number of beams (leo = 7), so the cell truth caps each
// sat to SINR_LIVE_BEAMS_PER_SAT illuminated cells/slot. CONTINUITY: a beam that is
// already SERVING a cell stays LOCKED on it (a connected UE must not blink off every
// hop slot); only the SPARE beam budget hops over the sat's unserved reachable cells.
// Illumination is a scheduling gate; the SERVING sat of a lit cell is still chosen by
// SINR + the HandoverManager (B3 / codex BLOCK-3), never round-robin. Cell SIZE and
// link-budget GAIN come from the SAME realistic 3.32° beamwidth (one antenna);
// coverage of the 200×90 area is delivered by STEERING, not by widening the lobe.
// These locks pin that wiring so it cannot silently regress to a single satellite
// lighting every cell it can see, or to a timer that hops serving beams off their UEs.
const sinrLiveCellModelSource = readRepoFile('src/scene/sinrLiveCellModel.ts');
assertContains(
  sinrLiveCellRuntimeSource,
  'beamsPerSat: SINR_LIVE_BEAMS_PER_SAT',
  'runtime caps the cell model to a per-sat beam budget (beam hopping)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'beamwidthOverrideRad: SINR_LIVE_CELL_BEAMWIDTH_RAD',
  'runtime sets the cell-model link-budget beamwidth to match the cell layout (one antenna)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'beamwidth3dBRad: SINR_LIVE_CELL_BEAMWIDTH_RAD',
  'cell layout is sized by the sinr-live beamwidth (same antenna as the link-budget gain)',
);
assertContains(
  sinrLiveCellModelSource,
  'applyBeamHoppingCap',
  'cell model implements the per-sat beam-hopping illumination cap',
);
assertContains(
  sinrLiveCellModelSource,
  'illuminatedBeams,',
  'cell model emits the illuminated-beam render surface (S-cells-4b cone source)',
);
// Serving continuity (S-cells-4b-fix): the cap LOCKS cells the sat is already
// serving (a connected beam must not hop off its UE), hopping only the spare budget.
assertContains(
  sinrLiveCellModelSource,
  'this.cellManagers.get(cellId)?.state.satId === satId',
  'beam-hopping LOCKS already-serving cells (serving continuity; only spare beams hop)',
);
// The cap GATES candidate illumination; serving is still SINR + HandoverManager.
assertContains(
  sinrLiveCellModelSource,
  'manager.update(candidateSamples',
  'cell serving stays SINR + HandoverManager (illumination cap is not a serving oracle — BLOCK-3)',
);

// ── SINR-live antenna truth-input override (S-cells-4a) ──
// The showcase lane sets its OWN self-consistent peak gain + wider steering as a
// decoupled SINR-live-only truth-input (CLAUDE.md Rule#1/#4): the shared
// `profile.antenna` is NEVER mutated, so the steered lane + baseline-KPI windows
// stay byte-identical. Peak gain MUST be self-consistent with the beamwidth (no
// >100%-efficiency bug). These locks pin (1) the overrides are wired into the
// factory, (2) the model gates candidates by the EFFECTIVE (overridden) steering
// limit — not the profile's — so the candidate list matches the scan-loss ceiling,
// and (3) the runtime gate asserts gain↔beamwidth self-consistency.
assertContains(
  sinrLiveCellRuntimeSource,
  'maxGainDbiOverrideDbi: SINR_LIVE_CELL_MAX_GAIN_DBI',
  'runtime overrides the cell-model peak gain (self-consistent with the beamwidth)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'maxSteeringAngleOverrideDeg: SINR_LIVE_CELL_MAX_STEERING_DEG',
  'runtime overrides the cell-model steering limit (lifts the 12° coverage bottleneck)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'export const SINR_LIVE_CELL_MAX_GAIN_DBI = 33.5',
  'runtime pins the self-consistent peak gain (33.5 dBi @ 3.32°, η=0.6) — NOT the profile 40 dBi bug',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'export const SINR_LIVE_CELL_MAX_STEERING_DEG = 50',
  'runtime pins the wider 50° steering limit (showcase lane only)',
);
assertContains(
  sinrLiveCellModelSource,
  'const maxSteer = this.antenna.maxSteeringAngleDeg',
  'cell model filters candidates by the EFFECTIVE (overridden) steering limit, not profile.antenna',
);
// The truth-input is decoupled: the shared profile antenna is left untouched so
// the steered lane + baseline KPI never drift. The override must NOT be written
// back into the profile.
assertNotContains(
  sinrLiveCellRuntimeSource,
  'profile.antenna.maxGainDbi =',
  'S-cells-4a must NOT mutate the shared profile peak gain (decoupled override only)',
);
// Self-consistency is the load-bearing guard against re-introducing the
// >100%-efficiency pairing; the runtime gate locks it via consistentPeakGainDbi.
const sinrLiveCellRuntimeTestSource = readRepoFile('src/scene/sinrLiveCellRuntime.test.ts');
assertContains(
  sinrLiveCellRuntimeTestSource,
  'consistentPeakGainDbi(SINR_LIVE_CELL_BEAMWIDTH_RAD, SINR_LIVE_CELL_ANTENNA_EFFICIENCY)',
  'runtime gate asserts gain↔beamwidth self-consistency (|maxGainDbi − consistentPeakGainDbi| < 0.5 dB)',
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
  'markerColor: mosaic?.markerColor ?? service?.markerColor',
  'MainScene passes mosaic-or-cell-service colors to UE markers (sinr-serving mosaic falls back to the MODQN cell overlay only on the MODQN lane)',
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
// FIX-7 finding #1 (provenance audit 2026-06-04): the phase-3 contention glow
// MUST derive from the same profile-derived cell-schedule per-UE assignment that
// `modqnServiceMap` already displays (the lane's authoritative shown serving),
// NOT the dead `sim.perUePositions` HandoverManager serving (empty on the
// modqn-demo decision-overlay path). Lock the C1 source and forbid a regression
// to the empty live serving so the glow cannot silently go non-functional again.
assertContains(
  mainSceneSource,
  'deriveBeamLoadContention([...modqnServiceMap.ueById.values()].map(projection => ({',
  'MainScene derives phase-3 contention from the modqnServiceMap cell-schedule assignment (FIX-7 C1)',
);
assertNotContains(
  mainSceneSource,
  'deriveBeamLoadContention(sim.perUePositions',
  'MainScene must not re-wire phase-3 contention to the empty live HandoverManager serving (FIX-7 finding #1)',
);
assertContains(
  mainSceneSource,
  '(NOT producer r3 proof): the glow is a per-UE',
  'MainScene documents the contention overlay-demo provenance (not producer r3)',
);
assertContains(
  mainSceneSource,
  'const focusBeamLoad = beamLoadContentionEnabled',
  'MainScene derives focused UE beam load from the existing contention model',
);
assertContains(
  mainSceneSource,
  "beamLoadContention.byUeId.get(focusedCellBeamConeUe?.id ?? '')",
  'MainScene reuses the existing beamLoadContention by focused UE id',
);
assertContains(
  mainSceneSource,
  '<BeamLoadCylinder',
  'MainScene mounts the focused beam-load cylinder',
);
assertContains(
  mainSceneSource,
  '{showCellOverlay && modqnVisualLayers.handoverStory && (',
  'MainScene gates the focused beam-load cylinder to the explain/debug handover surface',
);
assertContains(
  mainSceneSource,
  'visible={(focusBeamLoad?.load ?? 0) > 0}',
  'MainScene hides the focused beam-load cylinder when the focused UE has no serving-beam load',
);
assertContains(
  beamLoadCylinderSource,
  'visible={false}',
  'BeamLoadCylinder keeps the pooled mesh hidden by default',
);
assertContains(
  beamLoadCylinderSource,
  'mesh.visible = shouldShow',
  'BeamLoadCylinder toggles visibility on the persistent mesh',
);
assertContains(
  beamLoadCylinderSource,
  'mesh.scale.set(1, height, 1)',
  'BeamLoadCylinder encodes beam load by cylinder height',
);
assertNotContains(
  beamLoadCylinderSource,
  'useFrame(',
  'BeamLoadCylinder must not use per-frame work for height updates',
);
assertNotContains(
  beamLoadCylinderSource,
  'new THREE.Mesh',
  'BeamLoadCylinder must not allocate meshes manually',
);
assertNotContains(
  beamLoadCylinderSource,
  '.dispose(',
  'BeamLoadCylinder must not manually dispose pooled objects',
);
assertContains(
  mainSceneSource,
  'import { BeamLoadUploadParticles }',
  'MainScene imports the focused upload-particle layer',
);
// FIX-7 follow-up (audit gap #2, last fake-risk; codex P2): the phase-3 S4 cylinder
// + S5 particles real-render gate reads MESH-derived telemetry the components
// publish from their ACTUAL post-write mesh state, so a broken mesh-write line is
// caught (a model-derived observable would pass while the mesh is broken). Lock the
// component telemetry writes so the render observables cannot be silently dropped.
assertContains(
  beamLoadCylinderSource,
  "gl.domElement.dataset.beamLoadCylinderRendered = mesh.visible ? 'true' : 'false';",
  'BeamLoadCylinder publishes its actual post-toggle mesh.visible as the S4 render observable',
);
assertContains(
  beamLoadUploadParticlesSource,
  'gl.domElement.dataset.uploadParticleRenderedCount = String(renderedCount);',
  'BeamLoadUploadParticles publishes the summed actual InstancedMesh instance count as the S5 render observable',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh && mesh.visible ? mesh.count : 0',
  'BeamLoadUploadParticles render observable sums only visible meshes (real instance count)',
);
assertContains(
  handoverStoryLayerSource,
  'gl.domElement.dataset.handoverStoryRenderedMeshCount = String(renderedMeshCount);',
  'HandoverStoryLayer publishes its actual rendered ring/cue mesh count as the render observable (adversarial #4)',
);
assertContains(
  handoverStoryLayerSource,
  '(object as THREE.Mesh).isMesh && object.visible',
  'HandoverStoryLayer render observable counts only visible scene-graph meshes',
);
assertContains(
  mainSceneSource,
  'resolveCellBeamConeItems',
  'MainScene imports the focus cone resolver for upload particles',
);
assertContains(
  mainSceneSource,
  'const uploadParticlesEnabled =',
  'MainScene names the upload-particle gate',
);
assertContains(
  mainSceneSource,
  "modqnVisualLayerPreset === 'explain-handover'",
  'MainScene limits upload particles to the Explain Handover preset',
);
assertContains(
  mainSceneSource,
  '&& modqnVisualLayers.handoverStory',
  'MainScene keeps upload particles behind the handover-story preset layer',
);
assertContains(
  mainSceneSource,
  'resolveCellBeamConeItems({',
  'MainScene resolves focus cones through CellBeamCones authority',
);
assertContains(
  mainSceneSource,
  "beamConeScope: 'focus-satellite'",
  'MainScene forces upload particles to focused beam cones',
);
assertContains(
  mainSceneSource,
  '<BeamLoadUploadParticles',
  'MainScene mounts upload particles only behind the named gate',
);
assertContains(
  mainSceneSource,
  'focusCones={uploadParticleFocusCones}',
  'MainScene passes resolved focus cones to upload particles',
);
assertContains(
  mainSceneSource,
  'beamLoadContention={beamLoadContention}',
  'MainScene reuses the existing beamLoadContention model for upload particles',
);
assertContains(
  mainSceneSource,
  'focusedUe={focusedCellBeamConeUe}',
  'MainScene passes the focused UE to upload particles',
);
assertContains(
  mainSceneSource,
  'paused={paused}',
  'MainScene threads pause state into upload particles',
);
assertContains(
  mainSceneSource,
  'reducedMotion={runtime.reducedMotion}',
  'MainScene threads reduced-motion state into upload particles',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'UPLOAD_PARTICLES_DEFAULT = 96',
  'Upload particle default per-cone density cap is named',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'UPLOAD_PARTICLES_PER_CONE_HARD_CAP = 128',
  'Upload particle hard per-cone cap is named',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'UPLOAD_PARTICLES_GLOBAL_CAP = 256',
  'Upload particle global cap is named',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'MAX_FOCUS_CONES = 2',
  'Upload particle focused-cone cap is named',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'resolveUploadParticleConeCount',
  'Upload particle helpers clamp focus cone count',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'resolveUploadParticleCountForLoad',
  'Upload particle helpers derive capped count from normalized load',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'resolveUploadParticleGlobalCount',
  'Upload particle helpers enforce the global cap',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'resolveUploadParticleEnabledCount',
  'Upload particle helpers expose disabled/paused/reduced-motion gating',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'normalizeUploadParticleProgress',
  'Upload particle helpers expose deterministic progress wrapping',
);
assertContains(
  beamLoadUploadParticlesSource,
  "from '../scene/beamLoadContention'",
  'Upload particle layer reads existing beam-load contention types/helpers',
);
assertContains(
  beamLoadUploadParticlesSource,
  'beamLoadContention.byUeId.get(input.focusedUe.id)',
  'Upload particle layer prefers focused UE load from the existing contention model',
);
assertContains(
  beamLoadUploadParticlesSource,
  'beamLoadContention.loadByBeamKey.get',
  'Upload particle layer may fall back to existing beamKey load without rebuilding a model',
);
assertContains(
  beamLoadUploadParticlesSource,
  'Array.from({ length: MAX_FOCUS_CONES }',
  'Upload particle layer predeclares exactly MAX_FOCUS_CONES mesh slots',
);
assertContains(
  beamLoadUploadParticlesSource,
  'UPLOAD_PARTICLES_PER_CONE_HARD_CAP',
  'Upload particle layer sizes each InstancedMesh slot by the hard per-cone cap',
);
assertContains(
  beamLoadUploadParticlesSource,
  'useMemo<ConstructorParameters<typeof THREE.InstancedMesh>>',
  'Upload particle layer memoizes InstancedMesh constructor args',
);
assertContains(
  beamLoadUploadParticlesSource,
  'args={meshArgs}',
  'Upload particle layer reuses memoized mesh args instead of reallocating on plan changes',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh.count = plan?.count ?? 0',
  'Upload particle layer toggles active pool count from the plan',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh.visible = (plan?.count ?? 0) > 0',
  'Upload particle layer hides unused pool slots via visibility',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh.setMatrixAt(input.particleIndex, input.dummy.matrix)',
  'Upload particle useFrame path updates instance matrices',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh.instanceMatrix.needsUpdate = true',
  'Upload particle layer marks instance matrices dirty after updates',
);
assertNotContains(
  beamLoadUploadParticlesSource,
  'useState',
  'Upload particle layer must not set React state from frame work',
);
assertNotContains(
  beamLoadUploadParticlesSource,
  'setState',
  'Upload particle layer must not call setState',
);
assertNotContains(
  beamLoadUploadParticlesSource,
  'new THREE.InstancedMesh',
  'Upload particle layer must not manually allocate InstancedMesh objects',
);
// The pooled geometry/material are useMemo-owned and passed to the instanced
// meshes via `args`, so R3F does NOT own/dispose them — the layer MUST release
// them, but ONLY in an unmount cleanup (never per-frame/per-plan). Assert the
// cleanup disposes exist AND that the useFrame body never disposes.
assertContains(
  beamLoadUploadParticlesSource,
  'particleGeometry.dispose()',
  'Upload particle layer releases its pooled geometry on unmount (leak guard)',
);
assertContains(
  beamLoadUploadParticlesSource,
  'particleMaterial.dispose()',
  'Upload particle layer releases its pooled material on unmount (leak guard)',
);
const uploadParticleUseFrameStart = beamLoadUploadParticlesSource.indexOf('useFrame(');
const uploadParticleUseFrameBody = uploadParticleUseFrameStart >= 0
  ? beamLoadUploadParticlesSource.slice(
    uploadParticleUseFrameStart,
    beamLoadUploadParticlesSource.indexOf('});', uploadParticleUseFrameStart),
  )
  : '';
assertNotContains(
  uploadParticleUseFrameBody,
  '.dispose(',
  'Upload particle useFrame path must not dispose pooled objects per frame',
);
assertContains(
  packageJson,
  '"validate:phase-3:upload-particles"',
  'package exposes the Phase 3 upload-particles validator',
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
  modqnHudSource,
  'data-queue-depth-source="source-gap"',
  'MODQN HUD exposes the queue-depth source gap',
);
assertContains(
  modqnHudSource,
  'data-beam-load-shown={beamLoadShown ? \'1\' : \'0\'}',
  'MODQN HUD reports whether the beam-load visual surface is active',
);
assertContains(
  modqnHudSource,
  'Queue/buffer depth: not modeled (full-buffer)',
  'MODQN HUD visibly distinguishes beam load from missing queue depth',
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

// ── Lane Experience Switcher: the single in-app entry point for the lane axis ──
// LaneExperienceBar makes sceneSource (and therefore the whole artifact-replay
// lane) reachable in-app for the first time. It must stay a governance Shared
// Surface (no 3D import), mount exactly once lane-owned, and the transition must
// stay governance-safe (cancel armed/active Director focus + tear down stale
// artifact-replay state on leave) so it cannot become a naive setSceneSource.
const laneExperienceBarSource = readRepoFile('src/ui/LaneExperienceBar.tsx');
assertContains(
  appSource,
  "from './ui/LaneExperienceBar'",
  'App imports the top-level LaneExperienceBar',
);
assert.equal(
  countOccurrences(appSource, '<LaneExperienceBar'),
  1,
  'LaneExperienceBar is mounted exactly once',
);
assertContains(
  appSource,
  '<LaneExperienceBar value={sceneLane} onChange={handleExperienceChange} />',
  'LaneExperienceBar is fed the resolved scene lane and the governance-safe transition handler',
);
assertContains(
  appSource,
  'const [sceneSource, setSceneSource] = useState<SceneSourceMode>',
  'App owns a runtime sceneSource state (the lane switch is no longer URL-only)',
);
assertContains(
  appSource,
  'const handleExperienceChange = useCallback((targetLane: SceneLane) => {',
  'App owns the lane experience transition handler',
);
{
  const handlerIndex = appSource.indexOf('const handleExperienceChange = useCallback');
  assert.ok(handlerIndex >= 0, 'handleExperienceChange exists');
  const handlerSlice = appSource.slice(handlerIndex, handlerIndex + 1400);
  assertContains(
    handlerSlice,
    'cancelPendingLiveFocus();',
    'lane switch cancels an armed/active Director focus (no cross-lane sat-pair leak)',
  );
  assertContains(
    handlerSlice,
    'camera.exitDirectorFocus();',
    'lane switch exits the Director focus FSM',
  );
  assertContains(
    handlerSlice,
    'setShowcaseArtifact(null);',
    'lane switch tears down stale artifact-replay state on leave (FIX-1 cannot show stale provenance)',
  );
  assertContains(
    handlerSlice,
    'syncSceneSourceToUrl(nextSceneSource);',
    'lane switch keeps the URL in sync so the lane stays deep-linkable / reload-stable',
  );
}
assertContains(
  appPersistenceSource,
  'export function syncSceneSourceToUrl(mode: SceneSourceMode): void',
  'appPersistence exposes the display-only URL sync for the runtime lane switch',
);
for (const lane of [
  'sinr-live',
  'modqn-live-cell-preview',
  'modqn-replay-proof',
  'artifact-replay',
] as const) {
  assertContains(
    laneExperienceBarSource,
    `lane: '${lane}'`,
    `LaneExperienceBar offers the ${lane} segment`,
  );
}
assertContains(
  laneExperienceBarSource,
  'data-testid="lane-experience-bar"',
  'LaneExperienceBar exposes its root test id',
);
assertNotContains(laneExperienceBarSource, "from 'three", 'LaneExperienceBar must not import three');
assertNotContains(laneExperienceBarSource, 'from "three', 'LaneExperienceBar must not import three');
assertNotContains(laneExperienceBarSource, '@react-three/', 'LaneExperienceBar must not import react-three');
assertNotContains(laneExperienceBarSource, '<Canvas', 'LaneExperienceBar must not mount a Canvas (no 3D viewport layer)');
assertNotContains(laneExperienceBarSource, '../scene/', 'LaneExperienceBar must not import scene runtime modules');
assertNotContains(laneExperienceBarSource, '../viz/', 'LaneExperienceBar must not import viz modules');
assertContains(
  governanceDoc,
  'Lane Experience Switcher',
  'governance doc documents the lane experience switcher',
);
assertContains(
  governanceDoc,
  'It cancels any armed-but-unfired or active Director focus',
  'governance doc records the governance-safe Director-focus cancel on lane switch',
);

// ── Showcase exposure S3: revived ω-objective editor + co-visible MODQN evidence ──
// The MODQN runtime ω-weight editor (ModqnObjectiveTab) was built but unmounted;
// it is the only EDIT surface for the live ω weights. It is revived as the
// 'objective' left tab on MODQN live lanes. The MODQN evidence panels and the
// LiveKpiStrip are mounted so the built bundle diagnostics + live KPIs are
// reachable in-app. All display-only / overlay-demo against the loaded bundle.
const modqnObjectiveTabSource = readRepoFile('src/ui/ModqnObjectiveTab.tsx');
assertContains(
  appSource,
  "from './ui/ModqnObjectiveTab'",
  'App imports the ω-weight objective editor',
);
assertContains(
  appSource,
  "activeLeftSidebarTab === 'objective' ? (",
  'App renders the revived objective tab branch (was dead registry data with no branch)',
);
assertContains(
  appSource,
  '<ModqnObjectiveTab />',
  'App mounts the ω-weight objective editor on the objective tab',
);
assertContains(
  modqnObjectiveTabSource,
  'applyOmega',
  'objective tab is the ω EDIT surface (apply)',
);
assertContains(
  modqnObjectiveTabSource,
  'resetOmega',
  'objective tab can reset ω to the bundle weights',
);
assertContains(
  controlBarSource,
  'leo-control-bar__group-label',
  'ControlBar gives the MODQN visual-layer preset group a visible heading',
);
// Consolidation C1: playback (play/pause + speed) lives ONLY in the bottom
// TimelineBar; the ControlBar must not duplicate it, and the redundant
// in-ControlBar SINR/MODQN handover-mode switch is gone (LaneExperienceBar owns
// the experience axis).
assertNotContains(
  controlBarSource,
  'data-testid="handover-mode-control"',
  'ControlBar no longer duplicates the SINR/MODQN switch (LaneExperienceBar owns it)',
);
assertNotContains(
  controlBarSource,
  'leo-control-bar__play',
  'ControlBar no longer duplicates the play/pause button (TimelineBar owns playback)',
);
assertNotContains(
  controlBarSource,
  'aria-label="Playback speed"',
  'ControlBar no longer duplicates the playback speed control (TimelineBar owns playback speed)',
);
assertContains(
  governanceDoc,
  'ω-weight editor',
  'governance doc records the revived ω-weight editor on the MODQN live lane',
);

// ── Showcase exposure S4: omega-heuristic decision policy + mandatory banner ──
// The omega-heuristic engine path was always live but had no UI entry. It is
// surfaced via a contained MODQN decision-policy toggle on the modqn-live lane.
// GOVERNANCE: it is "NOT paper MODQN", so App MUST co-mount the disclosure banner
// whenever it is active, and it must never be exposed as a 3rd top-level mode.
assertContains(
  controlBarSource,
  'data-testid="modqn-decision-policy-control"',
  'ControlBar exposes the MODQN decision-policy toggle (paper overlay <-> heuristic ω)',
);
assertContains(
  controlBarSource,
  'data-testid="modqn-decision-policy-heuristic"',
  'ControlBar offers the heuristic ω (NOT paper) decision policy',
);
assertNotContains(
  controlBarSource,
  "mode: 'omega-heuristic'",
  'omega-heuristic must NOT be a 3rd top-level handover mode option',
);
assertContains(
  appSource,
  "from './ui/HeuristicNotPaperBanner'",
  'App imports the NOT-paper disclosure banner',
);
assertContains(
  appSource,
  "handoverMode === 'omega-heuristic' && sceneLane === 'modqn-live-cell-preview' && <HeuristicNotPaperBanner />",
  'App co-mounts the NOT-paper banner gated on omega-heuristic AND the modqn-live lane (never leaks the live heuristic warning onto the artifact / other lanes)',
);
assertContains(
  appSource,
  'onModqnDecisionPolicyChange={handleModqnDecisionPolicyChange}',
  'App wires the MODQN decision-policy toggle',
);
assertContains(
  governanceDoc,
  'modqn-decision-policy-control',
  'governance doc documents the MODQN decision-policy toggle',
);
assertContains(
  governanceDoc,
  'never surfaced without its disclosure',
  'governance doc records the mandatory NOT-paper banner co-mount',
);

// ── Showcase exposure S5: Tier-2 hyperparameter preview ──
// The Tier-2 hyperparameter UI (HyperparamChip + NetworkParamInput) was built but
// never mounted. It is surfaced in the MODQN training tab as an HONEST preview
// (requires-retrain / disabled), never as a wired training control.
const tier2PreviewSource = readRepoFile('src/ui/modqn-training/Tier2PreviewSection.tsx');
assertContains(
  appSource,
  "from './ui/modqn-training/Tier2PreviewSection'",
  'App imports the Tier-2 hyperparameter preview section',
);
assertContains(
  appSource,
  '<Tier2PreviewSection />',
  'App mounts the Tier-2 preview in the MODQN training tab',
);
assertContains(
  tier2PreviewSource,
  'HyperparamChip',
  'Tier-2 preview surfaces the built HyperparamChip component',
);
assertContains(
  tier2PreviewSource,
  'NetworkParamInput',
  'Tier-2 preview surfaces the built NetworkParamInput component',
);
assertContains(
  tier2PreviewSource,
  'requires retrain, not yet wired',
  'Tier-2 preview stays honest that it is not a wired training control',
);

// ── Consolidation C5: Dashboard view/route removed — only the 3D scene renders ──
// C3's top-level ViewModeToggle + full-area Dashboard view were removed: the app
// always shows the 3D Scene + sidebars. The ViewModeToggle / AlgorithmDock component
// files stay on disk (retained for the future MODQN data-flow diagram project) but are
// no longer mounted, and the MODQN pipeline flowchart is deferred to that project. The
// per-frame decision metric tiles stay in the artifact-replay sidebar (the
// AlgorithmDashboard content="metrics" block above).
assert.equal(
  countOccurrences(appSource, '<ViewModeToggle'),
  0,
  'App no longer mounts the ViewModeToggle (C5: Dashboard view removed)',
);
assertNotContains(
  appSource,
  "effectiveViewMode === 'dashboard'",
  'App has no dashboard-view branch — the 3D scene is the only view (C5)',
);
assertContains(
  governanceDoc,
  'Dashboard view',
  'governance doc records the dashboard view history (now removed)',
);

console.log('validate:frontend:scene-lane-governance passed');
