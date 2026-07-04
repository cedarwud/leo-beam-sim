import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { satelliteTint } from '../src/constants/beamRoleTokens.ts';
import type { NormalizedSceneFrame } from '../src/scene/NormalizedSceneFrame.ts';
import {
  deriveProfileHandoverStoryModel,
  replayProofBeamHoppingSourceGap,
} from '../src/scene/handoverStoryModel.ts';
import {
  buildModqnCellServiceReadout,
  deriveModqnServiceMap,
} from '../src/scene/modqnServiceMap.ts';
import {
  resolveModqnVisualLayers,
} from '../src/scene/modqnVisualLayers.ts';
import { resolveSceneLaneRenderPlan } from '../src/scene/sceneLaneRenderPlan.ts';
import {
  resolveTimelineRailDescriptor,
} from '../src/app/timelineRailAuthority.ts';
import {
  CELL_SCHEDULE_VIZ_SLOT_SEC,
  computeCellScheduleViz,
  type CellScheduleViz,
} from '../src/scene/useCellSchedule.ts';
import {
  HandoverEventRail,
  type HandoverRailEvent,
} from '../src/ui/HandoverEventRail.tsx';
import { ModqnSceneHud } from '../src/ui/modqn-controls/ModqnSceneHud.tsx';
import type { SimState } from '../src/scene/types.ts';
import {
  resolveCellBeamConeOpacity,
  resolveCellBeamConeRenderCount,
  resolveCellBeamConeSatelliteCount,
} from '../src/viz/CellBeamCones.tsx';

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

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function renderPlan(
  sceneLane: Parameters<typeof resolveSceneLaneRenderPlan>[0]['sceneLane'],
  sceneSource: Parameters<typeof resolveSceneLaneRenderPlan>[0]['sceneSource'],
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
  expect(!('showReplayProofLayer' in preview), 'MODQN live cell preview render plan exposes no replay-board flag (board clean-deleted P3 slice-3)');

  // P2 replay stage: the MODQN proof lane now plays the RECORDED dense-Q window
  // (artifact-backed frame via showcaseArtifactToScene), so its render plan
  // resolves as an artifact replay — NOT a live scene. The live/profile/
  // source-backed handover story layer is gone (policy 'disabled'; the recorded
  // beat track is P4), and the live-overlay board (the ModqnReplaySceneLayer + its
  // showReplayProofLayer flag) was clean-deleted in P3 slice-3, superseded by the
  // recorded field stage. Mirrors the scene-lane-governance sync.
  const proof = renderPlan('modqn-replay-proof', 'artifact-replay');
  expectEqual(proof.handoverStoryLayerPolicy, 'disabled', 'MODQN replay proof recorded stage has no live/profile handover story layer');
  expectEqual(proof.showProfileHandoverStoryLayer, false, 'MODQN replay proof does not mount profile-derived story layer');
  expect(!('showReplayProofLayer' in proof), 'MODQN replay proof render plan exposes no replay-board flag (board clean-deleted P3 slice-3; superseded by the recorded field)');
  // Negative control: the live-sim combo is now source-incompatible (fail-closed);
  // the recorded proof lane only renders on an artifact frame, never a live one.
  const proofLiveIncompatible = renderPlan('modqn-replay-proof', 'live-sim');
  expectEqual(proofLiveIncompatible.sourceCompatible, false, 'MODQN replay proof live-sim source is fail-closed (recorded replay only)');
  expect(!('showReplayProofLayer' in proofLiveIncompatible), 'MODQN replay proof on a live-sim frame exposes no replay-board flag (fail-closed above)');

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
  expectEqual(model.events.length, 0, 'story model does not foreground profile-derived cell reassignments as source-backed events');
  expectEqual(
    model.aggregateEventCount,
    schedule.cellReassignments.length,
    'story model keeps profile-derived reassignments aggregated instead of drawing event proof',
  );
  expect(model.focus.ueId === 'ue-0', 'story model focuses the primary UE');
}

function validateVisualLayerModel(): void {
  const baseline = resolveModqnVisualLayers('baseline-faithful');
  expectEqual(baseline.serviceMap, true, 'baseline preset keeps all-UE service map visible');
  expectEqual(baseline.ueCountBadges, true, 'baseline preset keeps per-cell UE count badges visible');
  expectEqual(baseline.beamCones, false, 'baseline preset suppresses beam cones by default');
  expectEqual(baseline.beamConeScope, 'none', 'baseline preset keeps beam cone scope empty');
  expectEqual(baseline.handoverCues, false, 'baseline preset suppresses profile-derived handover cues by default');

  const service = resolveModqnVisualLayers('service-allocation');
  expectEqual(service.beamCones, true, 'service allocation preset enables multi-satellite beam cones');
  expectEqual(service.beamConeScope, 'all-serving-satellites', 'service allocation preset renders all serving satellites');
  expectEqual(service.handoverCues, false, 'service allocation preset keeps foreground handover cues off');
  expectEqual(service.diagnostics, false, 'service allocation preset avoids debug diagnostics');

  const explain = resolveModqnVisualLayers('explain-handover');
  expectEqual(explain.beamCones, true, 'explain preset enables focused beam cones');
  expectEqual(explain.beamConeScope, 'focus-satellite', 'explain preset keeps beam cones focused on one satellite');
  expectEqual(explain.handoverCues, true, 'explain preset enables profile-derived handover cues');
  expectEqual(explain.diagnostics, false, 'explain preset avoids debug diagnostics');

  const debug = resolveModqnVisualLayers('debug');
  expectEqual(debug.beamConeScope, 'all-serving-satellites', 'debug preset can inspect all serving satellite beams');
  expectEqual(debug.footprintEllipses, true, 'debug preset enables footprint ellipses');
  expectEqual(debug.diagnostics, true, 'debug preset enables diagnostics flag');

  const schedule = scheduleAt(1);
  const coneInput = {
    schedule,
    satelliteWorldById: satelliteWorldById(schedule),
    satelliteTintById: tintMap(schedule),
    focusedUe: null,
    appMode: 'modqn-demo',
  };
  expectEqual(
    resolveCellBeamConeSatelliteCount({ ...coneInput, beamConeScope: 'focus-satellite' }),
    1,
    'focused beam cone scope renders one serving satellite',
  );
  expect(
    resolveCellBeamConeSatelliteCount({ ...coneInput, beamConeScope: 'all-serving-satellites' }) > 1,
    'all-serving beam cone scope renders multiple serving satellites',
  );
  expect(
    resolveCellBeamConeRenderCount({ ...coneInput, beamConeScope: 'all-serving-satellites' })
      > resolveCellBeamConeRenderCount({ ...coneInput, beamConeScope: 'focus-satellite' }),
    'all-serving beam cone scope renders more cones than focus scope',
  );
  expect(
    resolveCellBeamConeOpacity('all-serving-satellites') > resolveCellBeamConeOpacity(undefined),
    'service allocation cone opacity is slightly raised above the default cone opacity',
  );
  const activeAssignment = schedule.slot.assignments[0];
  assert.ok(activeAssignment, 'active assignment missing');
  const activePlacement = schedule.placements.find(placement => placement.cellId === activeAssignment.cellId);
  assert.ok(activePlacement, 'active placement missing');
  const idlePlacement = schedule.placements.find(placement => schedule.assignmentByCellId.get(placement.cellId) === undefined);
  assert.ok(idlePlacement, 'idle placement missing');
  const activeTint = '#00ffaa';
  const serviceMap = deriveModqnServiceMap({
    schedule,
    satelliteTintById: new Map([[activeAssignment.satId, activeTint]]),
    ues: [
      {
        id: 'active-ue',
        worldPos: [activePlacement.worldX, 0, activePlacement.worldZ],
      },
      {
        id: 'idle-ue',
        worldPos: [idlePlacement.worldX, 0, idlePlacement.worldZ],
      },
    ] as unknown as NormalizedSceneFrame['ues'],
  });

  expectEqual(serviceMap.servedUeCount, 1, 'service map counts served UEs from active cells');
  expectEqual(serviceMap.idleUeCount, 1, 'service map counts idle UEs from idle cells');
  expectEqual(serviceMap.ueCountByCellId.get(activeAssignment.cellId), 1, 'service map groups served UEs by active cell');
  const activeCellCountForSat = schedule.slot.assignments
    .filter(assignment => assignment.satId === activeAssignment.satId)
    .length;
  expectEqual(
    serviceMap.activeCellCountBySatId.get(activeAssignment.satId),
    activeCellCountForSat,
    'service map counts active cells by serving satellite',
  );
  expectEqual(serviceMap.ueCountBySatId.get(activeAssignment.satId), 1, 'service map counts served UEs by serving satellite');
  expectEqual(serviceMap.satelliteSummaries[0]?.satId, activeAssignment.satId, 'service map exposes satellite service summaries');
  expectEqual(serviceMap.ueById.get('active-ue')?.satId, activeAssignment.satId, 'service map projects UE to serving satellite');
  expectEqual(serviceMap.ueById.get('active-ue')?.markerColor, activeTint, 'service map uses serving satellite tint for UE marker color');
  expectEqual(serviceMap.ueById.get('idle-ue')?.serviceState, 'idle', 'service map marks idle-cell UE as idle');
  const readout = buildModqnCellServiceReadout({
    schedule,
    serviceMap,
    slotSec: CELL_SCHEDULE_VIZ_SLOT_SEC,
  });
  expectEqual(readout.source, 'profile-derived-demo', 'service readout is profile-derived demo');
  expectEqual(readout.claimKind, 'overlay-demo', 'service readout is explicitly non-proof overlay');
  expectEqual(readout.slotSec, CELL_SCHEDULE_VIZ_SLOT_SEC, 'service readout reports cell schedule slot duration');
  expectEqual(readout.nextSlotIndex, schedule.nextSlot.slotIndex, 'service readout reports next slot index');
  expectEqual(readout.activeCellCount, schedule.slot.assignments.length, 'service readout reports active cell count');
  expectEqual(readout.nextChangedCellCount > 0, true, 'service readout reports next-slot cell changes');
  expectEqual(readout.servedUeCount, serviceMap.servedUeCount, 'service readout reports served UE count');
  expectEqual(
    serviceMap.satelliteSummaries.some(summary => summary.activeBeamIds.length > 0),
    true,
    'service readout exposes active beam ids by serving satellite',
  );
}

function validateHudDiagnosticsRender(): void {
  const schedule = scheduleAt(1);
  const activeAssignment = schedule.slot.assignments[0];
  assert.ok(activeAssignment, 'active assignment missing for HUD diagnostics');
  const activePlacement = schedule.placements.find(placement => placement.cellId === activeAssignment.cellId);
  assert.ok(activePlacement, 'active placement missing for HUD diagnostics');
  const serviceMap = deriveModqnServiceMap({
    schedule,
    satelliteTintById: tintMap(schedule),
    ues: [
      {
        id: 'diagnostic-ue',
        worldPos: [activePlacement.worldX, 0, activePlacement.worldZ],
      },
    ] as unknown as NormalizedSceneFrame['ues'],
  });
  const serviceReadout = buildModqnCellServiceReadout({
    schedule,
    serviceMap,
    slotSec: CELL_SCHEDULE_VIZ_SLOT_SEC,
  });
  const simState = {
    simTimeSec: schedule.slotIndex * CELL_SCHEDULE_VIZ_SLOT_SEC,
    hoCount: 0,
    intraHoCount: 0,
    modqnCellServiceReadout: serviceReadout,
  } as unknown as SimState;
  const baseProps = {
    appMode: 'modqn-demo' as const,
    simState,
    bundleProvenanceKind: 'paper-faithful' as const,
    sceneSource: 'live-sim' as const,
  };

  const baselineMarkup = renderToStaticMarkup(React.createElement(ModqnSceneHud, {
    ...baseProps,
    modqnVisualLayerPreset: 'baseline-faithful',
  }));
  const explainMarkup = renderToStaticMarkup(React.createElement(ModqnSceneHud, {
    ...baseProps,
    modqnVisualLayerPreset: 'explain-handover',
  }));
  const serviceMarkup = renderToStaticMarkup(React.createElement(ModqnSceneHud, {
    ...baseProps,
    modqnVisualLayerPreset: 'service-allocation',
  }));
  const debugMarkup = renderToStaticMarkup(React.createElement(ModqnSceneHud, {
    ...baseProps,
    modqnVisualLayerPreset: 'debug',
  }));

  assertContains(baselineMarkup, 'data-service-allocation-visible="false"', 'Baseline HUD reports Service Allocation callout hidden');
  assertContains(baselineMarkup, 'data-service-diagnostics-visible="false"', 'Baseline HUD reports diagnostics hidden');
  assertNotContains(baselineMarkup, 'data-testid="modqn-service-allocation-summary"', 'Baseline HUD omits Service Allocation summary');
  assertContains(serviceMarkup, 'data-service-allocation-visible="true"', 'Service HUD reports Service Allocation callout visible');
  assertContains(serviceMarkup, 'data-testid="modqn-service-allocation-summary"', 'Service HUD renders Service Allocation summary');
  assertContains(serviceMarkup, 'profile-derived overlay', 'Service HUD labels the allocation summary as profile-derived overlay');
  assertContains(serviceMarkup, 'data-service-active-satellite-count=', 'Service HUD exposes active service satellite telemetry');
  assertNotContains(baselineMarkup, 'data-testid="modqn-service-diagnostics"', 'Baseline HUD omits diagnostics markup');
  assertNotContains(explainMarkup, 'data-testid="modqn-service-allocation-summary"', 'Explain HUD omits Service Allocation summary');
  assertNotContains(explainMarkup, 'data-testid="modqn-service-diagnostics"', 'Explain HUD omits diagnostics markup');
  assertContains(debugMarkup, 'data-service-diagnostics-visible="true"', 'Debug HUD reports diagnostics visible');
  assertContains(debugMarkup, 'data-testid="modqn-service-diagnostics"', 'Debug HUD renders diagnostics markup');
  assertContains(debugMarkup, 'data-service-source="profile-derived-demo"', 'Debug diagnostics keep profile-derived source');
  assertContains(debugMarkup, 'data-service-claim-kind="overlay-demo"', 'Debug diagnostics keep overlay-demo claim kind');
  assertContains(debugMarkup, 'data-service-slot-sec="2.5"', 'Debug diagnostics expose slot duration');
  assertContains(debugMarkup, 'overlay · profile-derived', 'Debug diagnostics label overlay/profile-derived boundary');
}

function validateStaticContracts(): void {
  const mainScene = readSource('src/scene/MainScene.tsx');
  const app = readSource('src/App.tsx');
  const railBuilders = readSource('src/app/handoverRailBuilders.ts');
  const appRuntimeConfig = readSource('src/app/appRuntimeConfig.ts');
  const appPersistence = readSource('src/app/appPersistence.ts');
  const appExperienceMode = readSource('src/app/appExperienceMode.ts');
  const modqnServingCount = readSource('src/modqn/servingCount.ts');
  const timelineAuthority = readSource('src/app/timelineRailAuthority.ts');
  const topologyTab = readSource('src/ui/signal-tuning/TopologyTab.tsx');
  const telemetry = readSource('src/scene/SceneTelemetry.tsx');
  const controlBar = readSource('src/ui/ControlBar.tsx');
  const advancedDisplayControls = readSource('src/ui/modqn-controls/ModqnAdvancedDisplayControls.tsx');
  const visualLayers = readSource('src/scene/modqnVisualLayers.ts');
  const serviceMap = readSource('src/scene/modqnServiceMap.ts');
  const cellOverlay = readSource('src/viz/CellOverlay.tsx');
  const cellBeamCones = readSource('src/viz/CellBeamCones.tsx');
  const storyModel = readSource('src/scene/handoverStoryModel.ts');
  const storyLayer = readSource('src/viz/HandoverStoryLayer.tsx');
  const handoverRail = readSource('src/ui/HandoverEventRail.tsx');
  const cellSchedule = readSource('src/scene/useCellSchedule.ts');
  const simStatePublisher = readSource('src/scene/useSimStatePublisher.ts');
  const panelState = readSource('src/scene/panelState.ts');
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
  assertContains(visualLayers, "export type ModqnVisualLayerPreset", 'MODQN visual layer preset contract');
  assertContains(visualLayers, "'baseline-faithful'", 'MODQN visual layers define baseline faithful preset');
  assertContains(visualLayers, "'service-allocation'", 'MODQN visual layers define service allocation preset');
  assertContains(visualLayers, "'explain-handover'", 'MODQN visual layers define explain handover preset');
  assertContains(visualLayers, 'beamCones: false', 'MODQN baseline visual preset suppresses beam cones');
  assertContains(visualLayers, "beamConeScope: 'all-serving-satellites'", 'MODQN service/debug presets can show all serving satellites');
  assertContains(visualLayers, "beamConeScope: 'focus-satellite'", 'MODQN explain preset keeps beam cones focused');
  assertContains(visualLayers, 'handoverCues: false', 'MODQN baseline visual preset suppresses handover cues');
  assertContains(visualLayers, 'handoverCues: true', 'MODQN explain/debug visual presets can enable handover cues');
  assertContains(cellBeamCones, 'resolveCellBeamConeSatelliteCount', 'CellBeamCones exposes rendered serving-satellite count');
  assertContains(cellBeamCones, "resolvedScope === 'focus-satellite'", 'CellBeamCones supports focused one-satellite scope');
  assertContains(cellBeamCones, "resolvedScope === 'none'", 'CellBeamCones supports hidden beam-cone scope');
  assertContains(cellBeamCones, "'all-serving-satellites'", 'CellBeamCones supports all-serving-satellite scope');
  assertContains(serviceMap, 'deriveModqnServiceMap', 'MODQN service map derives all-UE service projection');
  assertContains(serviceMap, 'ueCountByCellId', 'MODQN service map exposes per-cell UE counts');
  assertContains(serviceMap, 'ueCountBySatId', 'MODQN service map exposes per-satellite UE counts');
  assertContains(serviceMap, 'activeCellCountBySatId', 'MODQN service map exposes per-satellite active-cell counts');
  assertContains(serviceMap, 'buildModqnCellServiceReadout', 'MODQN service map builds HUD service readout');
  assertContains(serviceMap, "claimKind: 'overlay-demo'", 'MODQN service readout is explicitly overlay/demo');
  assertContains(serviceMap, 'slotSec', 'MODQN service readout carries slot duration for debug diagnostics');
  assertContains(serviceMap, 'nextChangedCellCount', 'MODQN service readout carries next-slot change count');
  assertContains(serviceMap, 'activeBeamIds', 'MODQN service readout carries per-satellite active beam ids');
  assertContains(serviceMap, 'markerColor', 'MODQN service map exposes satellite-tinted UE marker colors');
  assertContains(cellOverlay, 'showUeCounts', 'CellOverlay can render per-cell UE count badges');
  assertContains(cellOverlay, 'leo-cell-ue-count-badge', 'CellOverlay uses stable UE count badge class');
  assertContains(advancedDisplayControls, 'modqn-layer-preset-control', 'Advanced display controls expose MODQN layer preset control');
  assertContains(advancedDisplayControls, 'MODQN_VISUAL_LAYER_PRESETS.map', 'Advanced display controls render MODQN visual layer presets from shared model');
  assertContains(advancedDisplayControls, "'service-allocation': 'Service'", 'Advanced display controls label Service Allocation preset');
  assertNotContains(controlBar, 'modqn-layer-preset-control', 'ControlBar no longer owns MODQN layer preset control');
  assertContains(app, 'const [modqnVisualLayerPreset, setModqnVisualLayerPreset]', 'App owns MODQN visual layer preset state');
  assertContains(appRuntimeConfig, 'resolveModqnVisualLayers(modqnVisualLayerPreset)', 'appRuntimeConfig resolves MODQN visual layer flags');
  assertContains(modqnServingCount, 'MODQN_SERVING_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const', 'MODQN formal serving-count options are L=2..8');
  assertContains(modqnServingCount, 'MODQN_PAPER_BASELINE_SERVING_COUNT = 4', 'MODQN serving-count model labels L=4 as baseline');
  assertContains(modqnServingCount, 'MODQN_PAPER_SWEEP_MAX_SERVING_COUNT = 8', 'MODQN serving-count model labels L=8 as sweep max');
  assertContains(modqnServingCount, 'MODQN_BEAMS_PER_SERVING_SATELLITE = 7', 'MODQN serving-count model keeps 7 beams per serving satellite');
  assertContains(modqnServingCount, 'return MODQN_PAPER_SWEEP_MAX_SERVING_COUNT', 'MODQN serving-count model migrates legacy L=12 to L=8');
  assertContains(topologyTab, 'MODQN_SERVING_COUNT_OPTIONS.map', 'TopologyTab renders formal MODQN serving-count options from shared model');
  assertContains(topologyTab, 'paper-faithful baseline', 'TopologyTab labels L=4 as baseline');
  assertContains(topologyTab, 'paper sweep max / rich demo', 'TopologyTab labels L=8 as paper sweep max / rich demo');
  assertContains(topologyTab, 'L x 7 MODQN beam actions', 'TopologyTab presents MODQN action catalog as L x 7');
  assertNotContains(topologyTab, 'topology-tab-serving-count-option-12', 'TopologyTab omits L=12 formal option');
  assertNotContains(topologyTab, 'K=28 active beams', 'TopologyTab omits fixed K=28 across L copy');
  assertContains(appPersistence, 'normalizePersistedModqnServingCount(record.cellServingCount)', 'appPersistence normalizes persisted MODQN serving count');
  assertNotContains(appPersistence, 'record.cellServingCount === 12', 'appPersistence does not accept L=12 as a normal value');
  assertContains(appRuntimeConfig, 'normalizeRuntimeModqnServingCount(input.sceneTopology.cellServingCount)', 'appRuntimeConfig normalizes runtime MODQN serving count');
  assertContains(cellSchedule, 'DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT', 'useCellSchedule names the 28-cell cap as display-only');
  assertContains(cellSchedule, 'MODQN action catalog truth is L x 7', 'useCellSchedule documents display cap is not MODQN action truth');
  assertNotContains(cellSchedule, 'PAPER_ACTIVE_BEAMS_PER_SLOT', 'useCellSchedule does not name display cap as paper action truth');
  assertContains(appExperienceMode, "'sinr-experiment': 'hobs-2024-candidate-rich'", 'SINR default profile remains HOBS candidate-rich');
  assertContains(packageJson, '"validate:live-walker:7200-timeline"', 'package exposes committed 7200s live Walker validator');
  assertContains(appRuntimeConfig, 'LIVE_SIM_TIMELINE_DURATION_SEC = 7200', 'live timeline is 7200s only with committed validator coverage');
  assertNotContains(appRuntimeConfig, 'LIVE_SIM_TIMELINE_DURATION_SEC = 1200', 'live timeline does not fall back to the old 1200s window');
  assertContains(app, "from './app/timelineRailAuthority'", 'App delegates timeline and rail source policy');
  assertContains(app, "from './app/liveWalkerHandoverRailAdapter'", 'App delegates live Walker rail event adaptation');
  assertContains(app, "from './scene/liveWalkerHandoverEventIndex'", 'App builds live Walker handover event index outside render');
  assertContains(timelineAuthority, 'Legacy producer trace', 'timeline authority labels selected legacy producer trace');
  assertContains(timelineAuthority, 'It does not export a 2-hour Walker handover timeline.', 'timeline authority reports legacy producer horizon source gap');
  assertContains(timelineAuthority, "'profile-derived-forecast'", 'timeline authority labels precomputed SINR rail as profile-derived forecast');
  assertContains(timelineAuthority, "claimKind: input.sceneLane === 'modqn-replay-proof' ? 'producer-proof' : 'overlay-demo'", 'timeline authority separates producer proof from overlay/demo rail claims');
  assertContains(railBuilders, 'function getModqnReplayVisualTimeline', 'handoverRailBuilders derives slow-motion MODQN replay display axis (extracted from App)');
  assertContains(railBuilders, 'MODQN_REPLAY_VISUAL_MIN_DISPLAY_DURATION_SEC = 60', 'handoverRailBuilders stretches the short legacy producer trace into a readable display playback window');
  assertContains(app, 'producerTraceDisplayDurationSec', 'App separates producer trace source horizon from display-stretched rail axis');
  assertContains(timelineAuthority, 'const producerSourceTimeline: TimelineSurfaceDescriptor', 'timeline authority keeps producer source timeline separate from display-stretched rail axis');
  assertContains(timelineAuthority, 'return { timeline: liveTimeline, rail: liveRail };', 'timeline authority keeps MODQN live preview rail on live Walker event index');
  assertContains(timelineAuthority, 'return { timeline: producerSourceTimeline, rail: producerTrace };', 'timeline authority keeps MODQN replay proof bottom timeline on producer source time');
  assertContains(app, 'buildLiveWalkerHandoverEventIndex({', 'App builds live Walker handover index outside render');
  assertContains(app, 'liveWalkerHandoverEventIndexToRailEvents(liveWalkerHandoverEventIndex)', 'App maps live Walker index to HandoverEventRail events');
  assertContains(app, "if (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview') return liveWalkerHandoverRailEvents;", 'App routes live lanes to source-backed live Walker rail events');
  assertContains(app, "if (sceneLane === 'modqn-replay-proof') return modqnHandoverRailEvents;", 'App keeps MODQN proof rail on producer events');
  assertNotContains(app, 'producerDisplayTimeline', 'App must not promote the slow-motion producer rail axis into the bottom timeline');
  assertContains(timelineAuthority, 'horizonSec: producerDurationSec', 'timeline authority keeps producer source horizon seconds separate from display duration');
  assertContains(app, 'horizonSec={timelineRailDescriptor.timeline.horizonSec}', 'App passes source horizon seconds to TimelineBar separately');
  assertContains(app, 'const liveTimelineWindowStartSec = demoStartOffset;', 'App anchors live timeline display to the selected live Walker window');
  assertContains(app, 'simState.simTimeSec - liveTimelineWindowStartSec', 'App displays live timeline as window elapsed time');
  assertContains(app, 'demoStartOffsetSec: demoStartOffset', 'App does not mutate live Walker window start on seek');
  assertContains(app, 'const absoluteTargetSec = liveTimelineWindowStartSec + target;', 'App converts elapsed bottom seek to absolute Walker time');
  assertContains(handoverRail, "return 'producer trace';", 'handover rail row source label says producer trace, not generic MODQN');
  assertContains(handoverRail, 'data-source-gap-count={String(sourceGapReasons.length)}', 'handover rail exposes source-gap count telemetry');
  assertContains(handoverRail, 'buildEventMapClusters', 'handover rail clusters same-time source rows for fixed event-map display');
  assertContains(handoverRail, 'data-map-layout="fixed-event-map"', 'handover rail exposes fixed event-map layout telemetry');
  assertContains(handoverRail, 'data-map-order="source-time"', 'handover rail keeps producer events sorted by source time');
  assertContains(handoverRail, 'data-cursor-mode="independent"', 'handover rail cursor does not own event ordering');
  assertContains(handoverRail, 'data-axis-kind={axisKind}', 'handover rail exposes display-stretched axis telemetry');
  assertContains(handoverRail, 'data-axis-sec={safeAxisDurationSec.toFixed(3)}', 'handover rail exposes display axis seconds separately');
  assertContains(handoverRail, 'data-axis-current-sec={safeAxisCurrentTimeSec.toFixed(3)}', 'handover rail exposes display cursor seconds');
  assertContains(handoverRail, 'data-axis-playing={animateAxisCursor ? \'true\' : \'false\'}', 'handover rail exposes animated cursor state');
  assertContains(handoverRail, 'data-axis-playback-rate={safeAxisPlaybackRate.toFixed(3)}', 'handover rail exposes display playback rate');
  assertContains(handoverRail, 'displayTimeSec', 'handover rail supports display-stretched marker positions without mutating source time');
  assertContains(handoverRail, 'sourceTimeSec', 'handover rail supports explicit source time');
  assertContains(handoverRail, 'clickTargetSec', 'handover rail supports explicit source-time click targets');
  assertContains(handoverRail, 'data-click-target-sec={cluster.clickTargetSec.toFixed(3)}', 'handover rail exposes click target telemetry');
  assertContains(handoverRail, 'onClick={() => selectClusterAndSeek(cluster)}', 'handover rail routes marker clicks through source-time selection');
  assertContains(handoverRail, 'seekTo(cluster.clickTargetSec);', 'handover rail clicks seek source time instead of display axis');
  assertContains(handoverRail, "(sourceOwner === 'live-walker' || sourceOwner === 'sinr-live-cell-truth')", 'handover rail gates slow-motion focus to a live Walker source horizon (D4 extended the owner gate to also accept sinr-live cell-truth)');
  assertContains(handoverRail, "horizonKind === 'live-walker-window'", 'handover rail slow-motion focus stays on the live Walker window horizon');
  assertContains(handoverRail, 'data-focus-axis-kind={slowMotionFocus?.axisKind ?? \'\'}', 'handover rail exposes slow-motion focus display-axis telemetry');
  assertContains(handoverRail, 'data-testid="handover-event-slow-focus"', 'handover rail renders selected live Walker slow-motion focus panel');
  assertContains(handoverRail, "axisKind: 'display-stretched'", 'handover rail slow-motion focus uses a display axis');
  assertContains(handoverRail, '--handover-rail-axis-duration', 'handover rail cursor animation uses display axis duration');
  assertContains(handoverRail, 'data-testid="handover-event-map-track"', 'handover rail renders source-backed event map track');
  assertNotContains(handoverRail, 'getNearestEvents', 'handover rail omits nearest-event cursor sorting');
  assertNotContains(handoverRail, 'nearestEvents', 'handover rail omits nearest-event state');
  assertNotContains(handoverRail, '.slice(0, 6)', 'handover rail does not cap rows by nearest window');

  assertContains(storyLayer, 'name="handover-story-layer"', 'story layer root');
  assertContains(storyLayer, 'name="handover-story-intra"', 'story layer intra event visual');
  assertContains(storyLayer, 'name="handover-story-inter"', 'story layer inter event visual');
  assertContains(storyLayer, 'dashed={kind ===', 'story layer dashed next-slot halo');
  assertContains(storyLayer, 'notBaselineProof: model.notBaselineProof', 'story layer exposes claim-boundary userData');
  assertContains(storyLayer, 'model.inactiveSlots.map', 'story layer renders inactive ghost slots');
  assertContains(storyLayer, 'model.activeSlots.map', 'story layer renders active solid slots');

  assertContains(mainScene, 'deriveProfileHandoverStoryModel', 'MainScene derives story model');
  assertContains(mainScene, '{showProfileHandoverStoryLayer && modqnVisualLayers.handoverStory && (', 'MainScene gates story layer by render plan and visual preset');
  assertContains(mainScene, 'deriveModqnServiceMap({', 'MainScene derives MODQN all-UE service map');
  assertContains(mainScene, 'buildModqnCellServiceReadout({', 'MainScene builds MODQN service readout from schedule plus service map');
  assertContains(mainScene, 'modqnCellServiceReadout,', 'MainScene passes MODQN service readout into SimState publisher');
  assertContains(mainScene, 'markerColor: mosaic?.markerColor ?? service?.markerColor', 'MainScene passes service-map UE marker colors to GroundScene after SINR mosaic precedence');
  assertContains(mainScene, 'ueCountByCellId={modqnServiceMap.ueCountByCellId}', 'MainScene passes per-cell UE counts to CellOverlay');
  assertContains(mainScene, 'const showCellReassignmentEventArcs = modqnVisualLayers.handoverCues', 'MainScene gates profile-derived handover cues by visual preset');
  assertContains(mainScene, 'selectProfileDerivedHandoverCues', 'MainScene caps profile-derived handover cue density');
  assertContains(mainScene, 'visible={showCellReassignmentEventArcs}', 'MainScene passes explicit cell reassignment arc visibility gate');
  assertContains(mainScene, '{showCellOverlay && modqnVisualLayers.beamCones && (', 'MainScene gates MODQN beam cones by visual preset');
  assertContains(mainScene, 'beamConeScope: renderedCellBeamConeScope', 'MainScene passes visual preset beam cone scope into render-count helper');
  assertContains(mainScene, 'resolveCellBeamConeSatelliteCount', 'MainScene computes MODQN beam-cone satellite telemetry');
  assertContains(mainScene, 'beamConeScope={modqnVisualLayers.beamConeScope}', 'MainScene passes visual preset beam cone scope to CellBeamCones');
  assertContains(telemetry, 'el.dataset.handoverStoryNotBaselineProof', 'SceneTelemetry reports not-baseline-proof telemetry');
  assertContains(telemetry, 'el.dataset.handoverStoryNextCount', 'SceneTelemetry reports next-slot story telemetry');
  assertContains(telemetry, 'el.dataset.modqnVisualLayerPreset', 'SceneTelemetry reports MODQN visual layer preset');
  assertContains(telemetry, 'el.dataset.cellBeamConeScope', 'SceneTelemetry reports MODQN beam cone scope telemetry');
  assertContains(telemetry, 'el.dataset.cellBeamConeSatelliteCount', 'SceneTelemetry reports MODQN beam cone satellite count telemetry');
  assertContains(telemetry, 'el.dataset.modqnServedUeCount', 'SceneTelemetry reports MODQN served UE count');
  assertContains(telemetry, 'el.dataset.modqnHandoverCuesVisible', 'SceneTelemetry reports MODQN handover cue visibility');
  assertContains(simStatePublisher, 'modqnCellServiceReadout,', 'SimState publisher forwards MODQN service readout');
  assertContains(panelState, 'hasModqnCellServiceReadoutChanged', 'panel state change detection includes MODQN service readout');
  assertContains(mainScene, 'replayBackedHandoverStoryVisible', 'MainScene keeps replay proof story telemetry source-backed');
  const artifactStart = mainScene.indexOf('function ArtifactSceneContent');
  const liveStart = mainScene.indexOf('function SceneContent');
  assert.ok(artifactStart >= 0 && liveStart > artifactStart, 'MainScene artifact composer body located');
  const artifactBody = mainScene.slice(artifactStart, liveStart);
  assertNotContains(artifactBody, '<HandoverStoryLayer', 'artifact composer does not mount profile-derived story layer');
  assertContains(artifactBody, 'handoverStoryLayer="artifact-owned"', 'artifact composer reports artifact-owned story policy');

  // P3 slice-3: the board telemetry/render source-gap pins (replayTelemetry /
  // replayLayer / replayConstants) were removed with the clean-deleted board.
  assertContains(hud, 'NOT baseline proof', 'MODQN live cell HUD labels story as not baseline proof');
  assertContains(hud, 'data-modqn-layer-preset', 'MODQN live cell HUD reports visual layer preset');
  assertContains(hud, 'data-testid="modqn-service-readout"', 'MODQN HUD renders service readout');
  assertContains(hud, 'data-service-claim-kind', 'MODQN HUD labels service readout claim kind');
  assertContains(hud, "modqnVisualLayerPreset === 'debug'", 'MODQN HUD gates service diagnostics to Debug preset');
  assertContains(hud, 'data-service-diagnostics-visible', 'MODQN HUD reports Debug-only diagnostics visibility');
  assertContains(hud, 'data-service-slot-sec', 'MODQN HUD exposes schedule slot duration telemetry');
  assertContains(hud, 'data-service-next-change-count', 'MODQN HUD exposes next-slot change telemetry');
  assertContains(hud, 'data-testid="modqn-service-diagnostics"', 'MODQN HUD renders Debug-only service diagnostics');
  assertContains(hud, 'serviceReadout.activeCellCount', 'MODQN HUD shows active-cell service allocation');
  assertContains(hud, 'serviceReadout.servedUeCount', 'MODQN HUD shows served UE allocation');
  assertContains(hud, 'summary.activeBeamIds.join', 'MODQN HUD can summarize active beam ids per satellite');
  assertContains(groundScene, 'secondaryOpacity', 'GroundScene supports secondary UE dimming');
  assertContains(groundScene, 'secondaryScale', 'GroundScene supports secondary UE scale demotion');
  assertContains(groundScene, 'mesh.setColorAt(i, color)', 'GroundScene supports per-UE service marker colors');
  assertContains(groundScene, 'const resolvedMarkerColor = markerColor ?? PRIMARY_COLOR', 'Primary UE consumes service-map marker color');
  assertContains(groundScene, 'markerColor={primary.markerColor}', 'GroundScene passes primary UE marker color into PrimaryUeMarker');
  assertContains(governanceDoc, 'Handover story overlays are lane-owned', 'governance doc records story ownership');
  assertContains(governanceDoc, 'Baseline Faithful', 'governance doc records MODQN baseline visual preset');
  assertContains(governanceDoc, 'Explain Handover', 'governance doc records MODQN explain visual preset');
  assertContains(governanceDoc, 'source=profile-derived-demo', 'governance doc keeps Debug diagnostics source boundary explicit');
  assertContains(laneSdd, 'Handover Story Layer policy', 'lane SDD records story policy');
  assertContains(adr, 'beam-hopping source gap', 'ADR records replay fail-closed source gap');
  assertContains(storySdd, 'Handover Story Model', 'story SDD records shared model');
  assertContains(storySdd, 'not baseline proof', 'story SDD records demo claim boundary');
  assertContains(storySdd, 'Baseline Faithful suppresses these foreground event arcs', 'story SDD records baseline event-arc suppression');
  assertContains(storySdd, 'slot duration, next-slot change count', 'story SDD records Debug-only schedule diagnostics');
  assertContains(packageJson, '"validate:modqn:handover-story-layer"', 'package exposes handover story validator');
}

function validateFixedRailEventMapRender(): void {
  const events: HandoverRailEvent[] = Array.from({ length: 7 }, (_, index) => {
    const timeSec = index + 1;
    const kind = index % 2 === 0 ? 'intra' : 'inter';
    return {
      id: `event-${timeSec}`,
      timeSec,
      displayTimeSec: timeSec * 2,
      kind,
      title: kind === 'intra' ? 'Beam switch' : 'Satellite handover',
      fromLabel: `sat-${index} B1`,
      toLabel: `sat-${index} B2`,
      source: 'modqn-replay',
    };
  });
  const markup = renderToStaticMarkup(React.createElement(HandoverEventRail, {
    events,
    currentTimeSec: 96,
    durationSec: 100,
    onSeek: () => undefined,
    sourceLabel: 'Legacy producer trace 1s-10s - not Walker',
    sourceOwner: 'modqn-producer-trace',
    horizonKind: 'producer-trace',
    horizonLabel: 'producer rows 1s-10s',
    claimKind: 'overlay-demo',
    sourceStartSec: 1,
    sourceEndSec: 10,
    sourceGapReasons: ['Source gap: fixture'],
    axisKind: 'display-stretched',
    axisLabel: 'slow-motion display axis',
    axisDurationSec: 20,
    axisCurrentTimeSec: 18,
    axisPlaying: true,
    axisPlaybackRate: 2,
  }));

  assertContains(markup, 'data-event-count="7"', 'SSR handover event map keeps all source events');
  assertContains(markup, 'data-marker-cluster-count="7"', 'SSR handover event map exposes all marker clusters');
  assertContains(markup, 'data-cursor-mode="independent"', 'SSR handover event map cursor remains independent');
  assertContains(markup, 'data-axis-kind="display-stretched"', 'SSR handover event map uses display-stretched axis when provided');
  assertContains(markup, 'data-axis-sec="20.000"', 'SSR handover event map keeps display axis separate from source horizon');
  assertContains(markup, 'data-axis-playing="true"', 'SSR handover event map enables display sweep while playing');
  assertContains(markup, 'data-axis-playback-rate="2.000"', 'SSR handover event map exposes playback-rate-adjusted display sweep');
  // The source-ordered event LIST was retired (the top intra/inter marker track
  // stays). The rail no longer renders per-row list buttons.
  assertNotContains(markup, 'data-testid="handover-event-row-', 'SSR handover event map no longer renders the source-ordered list');
  assertNotContains(markup, 'data-testid="handover-event-focus"', 'SSR handover event map omits dynamic nearest-event focus card');
}

function validateTimelineAuthority(): void {
  const baseInput = {
    sceneSource: 'live-sim' as const,
    liveDurationSec: 7200,
    liveCurrentTimeSec: 120,
    artifactDurationSec: 240,
    artifactCurrentTimeSec: 12,
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
  expectEqual(livePreview.timeline.sourceOwner, 'live-walker', 'MODQN live preview bottom timeline stays live Walker-owned');
  expectEqual(livePreview.timeline.horizonKind, 'live-walker-window', 'MODQN live preview bottom timeline uses live Walker horizon');
  expectEqual(livePreview.timeline.durationSec, 7200, 'MODQN live preview bottom timeline uses validated 7200s live Walker window');
  expect(livePreview.timeline.horizonLabel.includes('2 h'), 'MODQN live preview bottom timeline may label the validated live Walker horizon as 2 h');
  expectEqual(livePreview.timeline.claimKind, 'overlay-demo', 'MODQN live preview bottom timeline is overlay/demo claim');
  expectEqual(livePreview.rail.sourceOwner, 'live-walker', 'MODQN live preview rail uses live Walker event index');
  expectEqual(livePreview.rail.horizonKind, 'live-walker-window', 'MODQN live preview rail uses live Walker horizon');
  expectEqual(livePreview.rail.durationSec, 7200, 'MODQN live preview rail does not inherit the 10s producer trace');
  expectEqual(livePreview.rail.claimKind, 'overlay-demo', 'MODQN live preview rail labels live Walker events as overlay');
  expectEqual(livePreview.rail.axisKind, 'source-time', 'MODQN live preview rail uses source-time click targets');

  const sinrLive = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'sinr-live',
  });
  expectEqual(sinrLive.rail.sourceOwner, 'sinr-live-cell-truth', 'SINR live rail uses live Walker event index');
  expectEqual(sinrLive.rail.horizonKind, 'live-walker-window', 'SINR live rail uses live Walker horizon');
  expectEqual(sinrLive.rail.claimKind, 'live-truth', 'SINR precomputed rail is a profile-derived forecast');
  expectEqual(sinrLive.rail.axisKind, 'source-time', 'SINR live rail uses source-time click targets');

  const proof = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-replay-proof',
  });
  expectEqual(proof.timeline.sourceOwner, 'modqn-producer-trace', 'MODQN replay proof bottom timeline is producer-owned');
  expectEqual(proof.timeline.horizonKind, 'producer-trace', 'MODQN replay proof bottom timeline uses producer trace horizon');
  expectEqual(proof.timeline.durationSec, 10, 'MODQN replay proof bottom timeline keeps 10s source horizon');
  expectEqual(proof.timeline.axisKind, 'source-time', 'MODQN replay proof bottom timeline uses source-time axis');
  expectEqual(proof.timeline.claimKind, 'producer-proof', 'MODQN replay proof bottom timeline is producer proof');

  const artifactGap = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'artifact-replay',
    sceneSource: 'artifact-replay',
  });
  expectEqual(artifactGap.timeline.sourceOwner, 'artifact-replay', 'artifact replay bottom timeline is artifact-owned');
  expectEqual(artifactGap.rail.sourceGapReasons.length, 1, 'artifact replay rail fails closed when event index is missing');

  const artifactWithEvents = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'artifact-replay',
    sceneSource: 'artifact-replay',
    artifactHandoverEventCount: 2,
  });
  expectEqual(artifactWithEvents.rail.sourceGapReasons.length, 0, 'artifact replay rail accepts artifact-owned event index');
}

validateLanePolicies();
validateProfileDerivedModel();
validateVisualLayerModel();
validateHudDiagnosticsRender();
validateStaticContracts();
validateFixedRailEventMapRender();
validateTimelineAuthority();

expectEqual(replayProofBeamHoppingSourceGap(), 'beam-hopping-schedule', 'replay source-gap helper returns stable reason');
expect(tintMap(scheduleAt(1)).size > 0, 'fixture tint map remains non-empty for story rendering');

console.log(`validate-modqn-handover-story-layer: PASS (${PASSED.length}/0 assertions)`);
