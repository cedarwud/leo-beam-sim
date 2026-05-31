import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { satelliteTint } from '../src/constants/beamRoleTokens.ts';
import type { NormalizedSceneFrame } from '../src/scene/NormalizedSceneFrame.ts';
import {
  deriveProfileHandoverStoryModel,
  replayProofBeamHoppingSourceGap,
} from '../src/scene/handoverStoryModel.ts';
import { resolveSceneLaneRenderPlan } from '../src/scene/sceneLaneRenderPlan.ts';
import {
  CELL_SCHEDULE_VIZ_SLOT_SEC,
  computeCellScheduleViz,
  type CellScheduleViz,
} from '../src/scene/useCellSchedule.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEG_TO_RAD = Math.PI / 180;
const CENTER_LAT_DEG = 40;
const CENTER_LON_DEG = 116;
const ALTITUDE_KM = 780;
const BEAMWIDTH_3DB_RAD = 2 * DEG_TO_RAD;
const WORLD_UNITS_PER_KM = 2;
const SATELLITES = [
  { id: 'sat-0' },
  { id: 'sat-1' },
  { id: 'sat-2' },
  { id: 'sat-3' },
] as const;

const PASSED: string[] = [];

function pass(label: string): void {
  PASSED.push(label);
  console.log(`PASS ${String(PASSED.length).padStart(2, '0')}: ${label}`);
}

function expect(condition: boolean, label: string): void {
  assert.ok(condition, label);
  pass(label);
}

function expectEqual<T>(actual: T, expected: T, label: string): void {
  assert.deepEqual(actual, expected, label);
  pass(label);
}

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function assertContains(source: string, needle: string, label: string): void {
  expect(source.includes(needle), `${label} includes ${needle}`);
}

function assertNotContains(source: string, needle: string, label: string): void {
  expect(!source.includes(needle), `${label} omits ${needle}`);
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

function scheduleAt(slotIndex: number): CellScheduleViz {
  return computeCellScheduleViz({
    simTimeSec: slotIndex * CELL_SCHEDULE_VIZ_SLOT_SEC,
    altitudeKm: ALTITUDE_KM,
    beamwidth3dBRad: BEAMWIDTH_3DB_RAD,
    centerLatDeg: CENTER_LAT_DEG,
    centerLonDeg: CENTER_LON_DEG,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
    satellites: SATELLITES,
  });
}

function satelliteWorldById(schedule: CellScheduleViz): ReadonlyMap<string, { x: number; y: number; z: number }> {
  const satIds = [...new Set([
    ...schedule.previousSlot.assignments.map(assignment => assignment.satId),
    ...schedule.slot.assignments.map(assignment => assignment.satId),
    ...schedule.nextSlot.assignments.map(assignment => assignment.satId),
  ])].sort();

  return new Map(satIds.map((satId, index) => [
    satId,
    {
      x: (index - 1.5) * 180,
      y: 620 - index * 18,
      z: (index % 2 === 0 ? -1 : 1) * (80 + index * 30),
    },
  ]));
}

function tintMap(schedule: CellScheduleViz): ReadonlyMap<string, string> {
  const satIds = [...new Set(schedule.slot.assignments.map(assignment => assignment.satId))].sort();
  return new Map(satIds.map((satId, index) => [satId, satelliteTint(satId, index)]));
}

function validateLanePolicies(): void {
  const sinr = renderPlan('sinr-live', 'live-sim');
  expectEqual(sinr.handoverStoryLayerPolicy, 'sinr-live', 'SINR live keeps existing handover story ownership');
  expectEqual(sinr.showLiveBeamCones, true, 'SINR live beam cones remain enabled');
  expectEqual(sinr.showLiveSceneEffects, true, 'SINR live effects remain enabled');
  expectEqual(sinr.showProfileHandoverStoryLayer, false, 'SINR live does not mount profile-derived story layer');

  const preview = renderPlan('modqn-live-cell-preview', 'live-sim');
  expectEqual(preview.handoverStoryLayerPolicy, 'profile-derived-demo', 'MODQN live cell preview owns profile-derived story layer');
  expectEqual(preview.showProfileHandoverStoryLayer, true, 'MODQN live cell preview mounts profile-derived story layer');
  expectEqual(preview.showReplayProofLayer, false, 'MODQN live cell preview does not mount replay proof');

  const proof = renderPlan('modqn-replay-proof', 'live-sim', true);
  expectEqual(proof.handoverStoryLayerPolicy, 'modqn-replay-source-backed', 'MODQN replay proof story remains source-backed');
  expectEqual(proof.showProfileHandoverStoryLayer, false, 'MODQN replay proof does not mount profile-derived story layer');
  expectEqual(proof.showReplayProofLayer, true, 'MODQN replay proof still mounts only through explicit request');

  const artifact = renderPlan('artifact-replay', 'artifact-replay');
  expectEqual(artifact.handoverStoryLayerPolicy, 'artifact-owned', 'artifact replay story ownership stays artifact-owned');
  expectEqual(artifact.showProfileHandoverStoryLayer, false, 'artifact replay does not mount profile-derived story layer');

  const incompatible = renderPlan('modqn-live-cell-preview', 'artifact-replay');
  expectEqual(incompatible.handoverStoryLayerPolicy, 'disabled', 'incompatible lane/source pair disables handover story layer');
  expectEqual(incompatible.showProfileHandoverStoryLayer, false, 'incompatible lane/source pair does not mount story layer');
}

function validateProfileDerivedModel(): void {
  const schedule = scheduleAt(1);
  expect(schedule.cellReassignments.length > 0, 'fixture schedule has readable handover reassignments');
  expect(schedule.nextSlot.assignments.length > 0, 'fixture schedule exposes next slot assignments');
  expect(schedule.nextAssignmentByCellId.size > 0, 'fixture schedule exposes next-slot assignment map');

  const focused = schedule.cellReassignments[0];
  assert.ok(focused, 'focused reassignment missing');
  const sceneFrame = {
    ues: [{
      id: 'ue-0',
      worldPos: [focused.worldX, 0, focused.worldZ],
    }],
  } as unknown as NormalizedSceneFrame;

  const model = deriveProfileHandoverStoryModel({
    sceneLane: 'modqn-live-cell-preview',
    sceneFrame,
    schedule,
    satelliteWorldById: satelliteWorldById(schedule),
  });

  expectEqual(model.lane, 'modqn-live-cell-preview', 'story model keeps resolved lane');
  expectEqual(model.source, 'profile-derived-demo', 'story model is explicitly profile-derived');
  expectEqual(model.notBaselineProof, true, 'story model marks demo preview as not baseline proof');
  expectEqual(model.sourceGaps.length, 0, 'profile-derived live preview has no replay source gaps');
  expect(model.activeSlots.length > 0, 'story model exposes active high-contrast slots');
  expect(model.inactiveSlots.length > 0, 'story model exposes inactive ghost slots');
  expect(model.nextSlots.length > 0, 'story model exposes next-slot dashed halo slots');
  expectEqual(
    model.activeSlots.length + model.inactiveSlots.length,
    schedule.placements.length,
    'story model covers active plus inactive cells exactly once',
  );
  expect(model.events.length <= 1, 'story model foregrounds only one active/recent event');
  expect(model.aggregateEventCount >= 0, 'story model aggregates unfocused events');
  expect(model.focus.ueId === 'ue-0', 'story model focuses the primary UE');
}

function validateStaticContracts(): void {
  const mainScene = readSource('src/scene/MainScene.tsx');
  const telemetry = readSource('src/scene/SceneTelemetry.tsx');
  const storyModel = readSource('src/scene/handoverStoryModel.ts');
  const storyLayer = readSource('src/viz/HandoverStoryLayer.tsx');
  const replayTelemetry = readSource('src/scene/modqn-replay-visuals/useReplaySceneTelemetry.tsx');
  const replayLayer = readSource('src/scene/modqn-replay-visuals/index.tsx');
  const replayConstants = readSource('src/scene/modqn-replay-visuals/constants.ts');
  const hud = readSource('src/ui/modqn-controls/ModqnSceneHud.tsx');
  const groundScene = readSource('src/viz/GroundScene.tsx');
  const governanceDoc = readSource('docs/frontend-render-governance.md');
  const laneSdd = readSource('docs/frontend-mode-lane-separation-sdd.md');
  const storySdd = readSource('docs/modqn-handover-story-layer-sdd.md');
  const adr = readSource('docs/decisions/ADR-001-scene-lane-render-boundary.md');
  const packageJson = readSource('package.json');

  assertContains(storyModel, 'export interface HandoverStoryModel', 'story model contract');
  assertContains(storyModel, 'readonly nextSlots', 'story model next-slot contract');
  assertContains(storyModel, 'notBaselineProof: true', 'story model claim-boundary marker');
  assertContains(storyModel, "return 'beam-hopping-schedule'", 'replay source-gap helper');

  assertContains(storyLayer, 'name="handover-story-layer"', 'story layer root');
  assertContains(storyLayer, 'name="handover-story-intra"', 'story layer intra event visual');
  assertContains(storyLayer, 'name="handover-story-inter"', 'story layer inter event visual');
  assertContains(storyLayer, 'dashed={kind ===', 'story layer dashed next-slot halo');
  assertContains(storyLayer, 'notBaselineProof: model.notBaselineProof', 'story layer exposes claim-boundary userData');
  assertContains(storyLayer, 'model.inactiveSlots.map', 'story layer renders inactive ghost slots');
  assertContains(storyLayer, 'model.activeSlots.map', 'story layer renders active solid slots');

  assertContains(mainScene, 'deriveProfileHandoverStoryModel', 'MainScene derives story model');
  assertContains(mainScene, '{showProfileHandoverStoryLayer && (', 'MainScene gates story layer by render plan');
  assertContains(telemetry, 'el.dataset.handoverStoryNotBaselineProof', 'SceneTelemetry reports not-baseline-proof telemetry');
  assertContains(telemetry, 'el.dataset.handoverStoryNextCount', 'SceneTelemetry reports next-slot story telemetry');
  assertContains(mainScene, 'replayBackedHandoverStoryVisible', 'MainScene keeps replay proof story telemetry source-backed');
  const artifactStart = mainScene.indexOf('function ArtifactSceneContent');
  const liveStart = mainScene.indexOf('function SceneContent');
  assert.ok(artifactStart >= 0 && liveStart > artifactStart, 'MainScene artifact composer body located');
  const artifactBody = mainScene.slice(artifactStart, liveStart);
  assertNotContains(artifactBody, '<HandoverStoryLayer', 'artifact composer does not mount profile-derived story layer');
  assertContains(artifactBody, 'handoverStoryLayer="artifact-owned"', 'artifact composer reports artifact-owned story policy');

  assertContains(replayTelemetry, 'replayProofBeamHoppingSourceGap()', 'replay telemetry uses source-gap helper');
  assertContains(replayTelemetry, "data-handover-story-layer', 'modqn-replay-source-backed'", 'replay telemetry reports source-backed story policy');
  assertContains(replayTelemetry, "data-handover-story-source', 'modqn-replay-proof'", 'replay telemetry reports replay-proof source');
  assertContains(replayTelemetry, "data-handover-story-source-gap", 'replay telemetry reports source gap');
  assertContains(replayTelemetry, "data-handover-story-fake-beam-hopping', '0'", 'replay telemetry rejects fake hopping');
  assertContains(replayLayer, 'beam hopping schedule: source gap', 'replay layer renders source-gap copy');
  assertContains(replayConstants, 'data-handover-story-fake-beam-hopping', 'replay constants clear fake-hopping telemetry');

  assertContains(hud, 'not baseline proof', 'MODQN live cell HUD labels story as not baseline proof');
  assertContains(groundScene, 'secondaryOpacity', 'GroundScene supports secondary UE dimming');
  assertContains(groundScene, 'secondaryScale', 'GroundScene supports secondary UE scale demotion');
  assertContains(governanceDoc, 'Handover story overlays are lane-owned', 'governance doc records story ownership');
  assertContains(laneSdd, 'Handover Story Layer policy', 'lane SDD records story policy');
  assertContains(adr, 'beam-hopping source gap', 'ADR records replay fail-closed source gap');
  assertContains(storySdd, 'Handover Story Model', 'story SDD records shared model');
  assertContains(storySdd, 'not baseline proof', 'story SDD records demo claim boundary');
  assertContains(packageJson, '"validate:modqn:handover-story-layer"', 'package exposes handover story validator');
}

validateLanePolicies();
validateProfileDerivedModel();
validateStaticContracts();

expectEqual(replayProofBeamHoppingSourceGap(), 'beam-hopping-schedule', 'replay source-gap helper returns stable reason');
expect(tintMap(scheduleAt(1)).size > 0, 'fixture tint map remains non-empty for story rendering');

console.log(`validate-modqn-handover-story-layer: PASS (${PASSED.length}/0 assertions)`);
