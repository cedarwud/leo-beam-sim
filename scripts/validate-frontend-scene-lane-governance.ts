import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveSceneLane,
  shouldRenderModqnReplayScene,
} from '../src/app/sceneLane.ts';
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
const controlBarSource = readRepoFile('src/ui/ControlBar.tsx');
const modqnReplayCuePanelSource = readRepoFile('src/ui/ModqnReplayCuePanel.tsx');
const mainSceneSource = readRepoFile('src/scene/MainScene.tsx');
const sceneLaneRenderPlanSource = readRepoFile('src/scene/sceneLaneRenderPlan.ts');
const replayLayerSource = readRepoFile('src/scene/modqn-replay-visuals/index.tsx');
const replayTelemetrySource = readRepoFile('src/scene/modqn-replay-visuals/useReplaySceneTelemetry.tsx');
const governanceDoc = readRepoFile('docs/frontend-render-governance.md');
const laneSdd = readRepoFile('docs/frontend-mode-lane-separation-sdd.md');
const handoverStorySdd = readRepoFile('docs/modqn-handover-story-layer-sdd.md');
const adr = readRepoFile('docs/decisions/ADR-001-scene-lane-render-boundary.md');
const agentsDoc = readRepoFile('AGENTS.md');
const claudeDoc = readRepoFile('CLAUDE.md');
const packageJson = readRepoFile('package.json');

assertContains(appSource, "from './app/sceneLane'", 'App scene lane import');
assertContains(appSource, 'modqnReplayProofRequested: modqnReplayProofRequestActive', 'App explicit proof request into scene lane resolver');
assertContains(appSource, 'shouldRenderModqnReplayScene(sceneLane)', 'App replay proof lane gate');
assertContains(appSource, 'data-scene-lane={sceneLane}', 'App browser lane telemetry');
assertContains(appSource, 'showModqnReplayScene={showModqnReplayScene}', 'App MainScene replay prop');
assertContains(appSource, 'sceneLane={sceneLane}', 'App MainScene lane prop');
assertContains(appSource, 'sceneLane={sceneLane}', 'App ControlBar lane prop');
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
  mainSceneSource,
  'dataset.sceneLaneSourceCompatible',
  'MainScene canvas exposes lane/source compatibility telemetry',
);
assertContains(
  mainSceneSource,
  'deriveProfileHandoverStoryModel',
  'MainScene builds the profile-derived handover story model',
);
assertContains(
  mainSceneSource,
  '<HandoverStoryLayer',
  'MainScene can mount the shared handover story layer',
);
assertContains(
  mainSceneSource,
  '{showProfileHandoverStoryLayer && (',
  'MainScene gates the shared story layer by scene lane render plan',
);
assertContains(
  mainSceneSource,
  'dataset.handoverStoryLayer',
  'MainScene canvas reports handover story layer policy',
);
assertContains(
  mainSceneSource,
  'dataset.handoverStoryNextCount',
  'MainScene canvas reports next-slot story telemetry',
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
  "dataset.liveSimulationEnabled = '0'",
  'Artifact scene telemetry marks live simulation disabled',
);
assertContains(
  mainSceneSource,
  "dataset.liveSimulationEnabled = '1'",
  'Live scene telemetry marks live simulation enabled',
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
  ['{cinematicSpotlightActive && (\\n        <fogExp2', 'cinematic fog'],
  ['{cinematicSpotlightTargets.map(target => (', 'cinematic point lights'],
] as const) {
  assertContains(mainSceneSource, needle.replace('\\n', '\n'), `MainScene should source-gate ${label}`);
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
