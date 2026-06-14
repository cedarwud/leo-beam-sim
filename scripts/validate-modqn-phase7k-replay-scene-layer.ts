import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODQN_EXPECTED_EVENT_COUNTS,
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  createModqnReplayPlaybackDisplayState,
  createOmegaRescalarizedModqnReplayPlaybackDisplayState,
} from '../src/modqn/replay-bundle/index.ts';
import {
  MODQN_REPLAY_SCENE_BEAM_COUNT,
  MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD,
  MODQN_REPLAY_SCENE_SOURCE,
  deriveModqnReplaySceneVisualState,
} from '../src/scene/modqnReplaySceneVisuals.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function readRepoFile(path: string): string {
  return readFileSync(join(ROOT_DIR, path), 'utf8');
}

function readReplaySceneLayerSources(): string {
  const entry = readRepoFile('src/scene/ModqnReplaySceneLayer.tsx');
  const dirPath = join(ROOT_DIR, 'src/scene/modqn-replay-visuals');
  const files = readdirSync(dirPath)
    .filter(name => name.endsWith('.tsx') || name.endsWith('.ts'))
    .sort();
  const parts = files.map(name => readFileSync(join(dirPath, name), 'utf8'));
  return [entry, ...parts].join('\n');
}

function assertContains(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function assertNotContains(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label} unexpectedly contains ${needle}`);
}

function assertNoLiveSceneIdentityLeak(serialized: string): void {
  assert.doesNotMatch(
    serialized,
    /-P\d+-S\d+/,
    'MODQN replay scene visuals must not project producer sat IDs into live scene constellation IDs',
  );
  assert.doesNotMatch(serialized, /sceneSatId|liveSatId|liveBeamId/i);
}

function pointDistance(a: { readonly x: number; readonly y: number; readonly z: number }, b: { readonly x: number; readonly y: number; readonly z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function assertFirstSlotVisualState(): void {
  const displayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    false,
    true,
  );
  const visualState = deriveModqnReplaySceneVisualState(displayState);

  assert.ok(visualState, 'first replay slot should produce scene visual state');
  assert.equal(visualState.source, MODQN_REPLAY_SCENE_SOURCE);
  assert.equal(visualState.coordinateFrame, 'scene-world-display-layer');
  assert.equal(visualState.geometrySource, 'display-canonical-lens');
  assert.equal(visualState.beams.length, MODQN_REPLAY_SCENE_BEAM_COUNT);
  assert.equal(visualState.expectedProducerSatelliteCount, 4);
  assert.equal(visualState.producerSatelliteStateCount, 0);
  assert.equal(visualState.slotDecisionRowCount, 100);
  assert.equal(visualState.truthAudit.highestSceneLevel, 'T0');
  assert.equal(visualState.truthAudit.levels.find(level => level.level === 'T4')?.status, 'absent');
  assert.equal(visualState.truthAudit.levels.find(level => level.level === 'T5')?.status, 'absent');
  assert.equal(visualState.eventKind, 'intra-satellite-beam-switch');
  assert.equal(visualState.switch.activeHandover, true);
  assert.equal(visualState.switch.activeIntraSatelliteSwitch, true);
  assert.equal(visualState.previous.producerBeamId, 'sat-0-beam-3');
  assert.equal(visualState.selected.producerBeamId, 'sat-0-beam-1');
  assert.equal(visualState.previous.producerSatId, 'sat-0');
  assert.equal(visualState.selected.producerSatId, 'sat-0');
  const intraSwitchDistance = pointDistance(visualState.previous.position, visualState.selected.position);
  assert.ok(
    intraSwitchDistance > 0,
    'first replay slot should visibly separate previous and selected beams in the handover lens',
  );
  assert.ok(
    intraSwitchDistance < MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD * 2,
    'intra-satellite replay lens should keep previous/selected footprints close enough to overlap',
  );
  assertNoLiveSceneIdentityLeak(JSON.stringify(visualState));
}

function assertSourceBackedGeometryVisualState(): void {
  const baseDisplayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    false,
    true,
  );
  const baseFocusRow = baseDisplayState.currentSlot.focusRow;
  const beamStates = Array.from({ length: 7 }, (_, localBeamIndex) => ({
    beamId: `sat-0-beam-${localBeamIndex}`,
    beamIndex: localBeamIndex,
    satId: 'sat-0',
    satIndex: 0,
    localBeamIndex,
    centerLocalTangentKm: {
      east: localBeamIndex === 3 ? 23.6 : 0,
      north: localBeamIndex === 1 ? 33.9 : localBeamIndex === 3 ? -7 : localBeamIndex * 6,
    },
    footprintKm: 27.2,
    footprintProvenance: {
      displayOnly: false,
      policy: 'validator-renderable-footprint',
    },
    frequencyReuseGroup: 'paper-unspecified',
  }));
  const displayState = {
    ...baseDisplayState,
    currentSlot: {
      ...baseDisplayState.currentSlot,
      focusRow: {
        ...baseFocusRow,
        decisionUserPosition: {
          localTangentKm: { east: 36.9, north: -6.75 },
        },
        userPosition: {
          localTangentKm: { east: 36.9, north: -6.74 },
        },
        decisionActionValidityMask: [
          true, true, true, true, true, true, true,
          false, false, false, false, false, false, false,
          false, false, false, false, false, false, false,
          false, false, false, false, false, false, false,
        ],
        satelliteStates: [
          {
            satId: 'sat-0',
            satIndex: 0,
            subSatellitePoint: { latDeg: 0.06, lonDeg: 0 },
            coordinateFrameKind: 'topocentric-local-tangent',
          },
          {
            satId: 'sat-1',
            satIndex: 1,
            subSatellitePoint: { latDeg: 89.94, lonDeg: 180 },
            coordinateFrameKind: 'topocentric-local-tangent',
          },
          {
            satId: 'sat-2',
            satIndex: 2,
            subSatellitePoint: { latDeg: -0.06, lonDeg: -180 },
            coordinateFrameKind: 'topocentric-local-tangent',
          },
          {
            satId: 'sat-3',
            satIndex: 3,
            subSatellitePoint: { latDeg: -89.94, lonDeg: 0 },
            coordinateFrameKind: 'topocentric-local-tangent',
          },
        ],
        beamStates,
      },
    },
  };
  const visualState = deriveModqnReplaySceneVisualState(displayState, {
    worldUnitsPerKm: 10,
    visualSatelliteAltitudeWorld: 380,
  });

  assert.ok(visualState, 'source-backed replay slot should produce scene visual state');
  assert.equal(visualState.coordinateFrame, 'producer-local-tangent-display-layer');
  assert.equal(visualState.geometrySource, 'producer-beam-state');
  assert.equal(visualState.beams.length, 7);
  assert.equal(visualState.satellites.length, 4);
  assert.equal(visualState.producerSatelliteStateCount, 4);
  assert.equal(visualState.renderedSatelliteStateCount, 4);
  assert.ok(visualState.focusedUser, 'source-backed replay state should expose the focused UE marker');
  assert.equal(visualState.truthAudit.levels.find(level => level.level === 'T1')?.status, 'partial');
  assert.equal(visualState.truthAudit.levels.find(level => level.level === 'T2')?.status, 'partial');
  assert.equal(visualState.truthAudit.levels.find(level => level.level === 'T4')?.status, 'absent');
  assert.equal(visualState.truthAudit.levels.find(level => level.level === 'T5')?.status, 'absent');
  assert.equal(
    visualState.beams.every(beam => beam.geometrySource === 'producer-beam-state'),
    true,
    'all synthetic source-backed beams should retain producer-beam-state provenance',
  );
  assertNoLiveSceneIdentityLeak(JSON.stringify(visualState));
}

function assertDisplayOnlyProducerGeometryRendersProxyWithoutTruthClaim(): void {
  const baseDisplayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    false,
    true,
  );
  const baseFocusRow = baseDisplayState.currentSlot.focusRow;
  const beamStates = Array.from({ length: 7 }, (_, localBeamIndex) => ({
    beamId: `sat-0-beam-${localBeamIndex}`,
    beamIndex: localBeamIndex,
    satId: 'sat-0',
    satIndex: 0,
    localBeamIndex,
    centerLocalTangentKm: {
      east: localBeamIndex === 3 ? 23.6 : 0,
      north: localBeamIndex === 1 ? 33.9 : localBeamIndex === 3 ? -7 : localBeamIndex * 6,
    },
    footprintKm: 27.2,
    footprintProvenance: {
      displayOnly: true,
      policy: 'display-derived-altitude-tan-half-angle',
    },
    frequencyReuseGroup: 'paper-unspecified',
    frequencyReuseProvenance: {
      displayOnly: true,
      policy: 'paper-unspecified-frequency-reuse',
    },
  }));
  const displayState = {
    ...baseDisplayState,
    currentSlot: {
      ...baseDisplayState.currentSlot,
      focusRow: {
        ...baseFocusRow,
        decisionUserPosition: {
          localTangentKm: { east: 36.9, north: -6.75 },
        },
        userPosition: {
          localTangentKm: { east: 36.9, north: -6.74 },
        },
        decisionActionValidityMask: [
          true, true, true, true, true, true, true,
          false, false, false, false, false, false, false,
          false, false, false, false, false, false, false,
          false, false, false, false, false, false, false,
        ],
        satelliteStates: [
          {
            satId: 'sat-0',
            satIndex: 0,
            subSatellitePoint: { latDeg: 0.06, lonDeg: 0 },
            coordinateFrameKind: 'eci-km-no-earth-rotation-proxy',
          },
          {
            satId: 'sat-1',
            satIndex: 1,
            subSatellitePoint: { latDeg: 89.94, lonDeg: 180 },
            coordinateFrameKind: 'eci-km-no-earth-rotation-proxy',
          },
          {
            satId: 'sat-2',
            satIndex: 2,
            subSatellitePoint: { latDeg: -0.06, lonDeg: -180 },
            coordinateFrameKind: 'eci-km-no-earth-rotation-proxy',
          },
          {
            satId: 'sat-3',
            satIndex: 3,
            subSatellitePoint: { latDeg: -89.94, lonDeg: 0 },
            coordinateFrameKind: 'eci-km-no-earth-rotation-proxy',
          },
        ],
        beamStates,
      },
    },
  };
  const visualState = deriveModqnReplaySceneVisualState(displayState, {
    worldUnitsPerKm: 10,
    visualSatelliteAltitudeWorld: 380,
  });

  assert.ok(visualState, 'display-only producer geometry should still produce visible proxy replay cues');
  assert.equal(visualState.coordinateFrame, 'producer-local-tangent-display-layer');
  assert.equal(visualState.geometrySource, 'producer-display-proxy');
  assert.equal(visualState.beams.length, MODQN_REPLAY_SCENE_BEAM_COUNT);
  assert.equal(visualState.satellites.length, 1);
  assert.equal(visualState.producerSatelliteStateCount, 4);
  assert.equal(visualState.renderedSatelliteStateCount, 1);
  assert.equal(visualState.truthAudit.highestSceneLevel, 'T1');
  assert.equal(visualState.truthAudit.levels.find(level => level.level === 'T1')?.status, 'partial');
  assert.equal(visualState.truthAudit.levels.find(level => level.level === 'T2')?.status, 'absent');
  assert.equal(
    visualState.beams.every(beam => beam.geometrySource === 'producer-display-proxy'),
    true,
    'display-only footprint provenance may render only as producer-display-proxy geometry',
  );
  assertNoLiveSceneIdentityLeak(JSON.stringify(visualState));
}

function assertNoSwitchSlotVisualState(): void {
  const displayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    5,
    true,
    true,
  );
  const visualState = deriveModqnReplaySceneVisualState(displayState);

  assert.ok(visualState, 'sixth replay slot should produce scene visual state');
  assert.equal(visualState.eventKind, 'none');
  assert.equal(visualState.switch.activeHandover, false);
  assert.equal(visualState.switch.activeIntraSatelliteSwitch, false);
  assert.equal(visualState.previous.producerBeamId, 'sat-0-beam-1');
  assert.equal(visualState.selected.producerBeamId, 'sat-0-beam-1');
  assert.deepEqual(
    visualState.previous.position,
    visualState.selected.position,
    'no-switch replay slot should draw previous and selected at the same footprint',
  );

  const sharedBeam = visualState.beams.find(beam => beam.canonicalBeamNumber === 2);
  assert.ok(sharedBeam, 'shared previous/selected beam B2 should be present');
  assert.equal(sharedBeam.role, 'previous-and-selected');
  assertNoLiveSceneIdentityLeak(JSON.stringify(visualState));
}

function assertInterSatelliteVisualState(): void {
  const baseDisplayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    true,
    true,
  );
  const baseFocusRow = baseDisplayState.currentSlot.focusRow;
  const displayState = {
    ...baseDisplayState,
    currentSlot: {
      ...baseDisplayState.currentSlot,
      focusRow: {
        ...baseFocusRow,
        selectedServing: {
          ...baseFocusRow.selectedServing,
          beamId: 'sat-1-beam-1',
          satId: 'sat-1',
          satIndex: 1,
        },
        handoverEventKind: 'inter-satellite-handover' as const,
      },
    },
  };
  const visualState = deriveModqnReplaySceneVisualState(displayState);

  assert.ok(visualState, 'inter-satellite replay slot should produce scene visual state');
  assert.equal(visualState.eventKind, 'inter-satellite-handover');
  assert.equal(visualState.switch.activeHandover, true);
  assert.equal(visualState.switch.activeIntraSatelliteSwitch, false);
  assert.equal(visualState.switch.label, 'Inter-sat handover');
  assert.notEqual(
    visualState.previous.producerSatId,
    visualState.selected.producerSatId,
    'inter-satellite handover should preserve distinct producer sat IDs',
  );
  assert.notDeepEqual(
    visualState.previous.position,
    visualState.selected.position,
    'inter-satellite handover should be visually separated even when local beam IDs overlap',
  );
  assertNoLiveSceneIdentityLeak(JSON.stringify(visualState));
}

function assertOmegaRescalarizedDisplayState(): void {
  const displayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    false,
    true,
  );
  const focusRow = displayState.currentSlot.focusRow;
  const seededDisplayState = {
    ...displayState,
    currentSlot: {
      ...displayState.currentSlot,
      focusRow: {
        ...focusRow,
        policyDiagnostics: {
          diagnosticsVersion: 'phase-7k-validator-synthetic-topk',
          availableActionCount: 2,
          topCandidates: [
            {
              ...focusRow.selectedServing,
              objectiveQ: {
                r1Throughput: 1,
                r2Handover: 0,
                r3LoadBalance: 0,
              },
            },
            {
              ...focusRow.previousServing,
              objectiveQ: {
                r1Throughput: 10,
                r2Handover: 0,
                r3LoadBalance: 0,
              },
            },
          ],
        },
      },
    },
  };

  const nextDisplayState = createOmegaRescalarizedModqnReplayPlaybackDisplayState(
    seededDisplayState,
    { throughput: 1, handover: 0, loadBalance: 0 },
  );
  assert.ok(nextDisplayState, 'omega re-scalarization should return display state');
  const nextFocusRow = nextDisplayState.currentSlot.focusRow;
  assert.equal(nextFocusRow.selectedServing.beamId, focusRow.previousServing.beamId);
  assert.equal(nextFocusRow.selectedServingSource, 'omega-rescalarized');
  assert.deepEqual(nextFocusRow.producerSelectedServing, focusRow.selectedServing);
  assert.equal(nextFocusRow.producerHandoverEventKind, focusRow.handoverEventKind);
  assert.equal(nextFocusRow.handoverEventKind, 'none');
}

function assertSceneBridgeSource(): void {
  const appSource = readRepoFile('src/App.tsx');
  const railBuildersSource = readRepoFile('src/app/handoverRailBuilders.ts');
  const mainSceneSource = readRepoFile('src/scene/MainScene.tsx');
  const sceneLayerSource = readReplaySceneLayerSources();
  const helperSource = readRepoFile('src/scene/modqnReplaySceneVisuals.ts');
  const cuePanelSource = readRepoFile('src/ui/ModqnReplayCuePanel.tsx');

  assertContains(
    appSource,
    'modqnReplayDisplayState={renderedModqnReplayDisplayState}',
    'App replay-to-scene bridge',
  );
  assertContains(
    appSource,
    "if (handoverMode !== 'decision-overlay-on-live-sinr')",
    'App replay-to-scene mode gate',
  );
  assertContains(
    appSource,
    'createOmegaRescalarizedModqnReplayPlaybackDisplayState',
    'App replay-to-scene bridge',
  );
  assertContains(
    railBuildersSource,
    'MODQN_REPLAY_HANDOVER_SLOT_SEC',
    'handoverRailBuilders replay handover slot hold bridge (extracted from App)',
  );
  assertContains(
    railBuildersSource,
    'MODQN_REPLAY_STABLE_SLOT_SEC',
    'handoverRailBuilders replay stable slot hold bridge (extracted from App)',
  );
  assertContains(
    railBuildersSource,
    'resolveModqnReplayVisualSlotOffset',
    'handoverRailBuilders replay variable-duration slot resolver (extracted from App)',
  );
  assertContains(
    appSource,
    '<ModqnReplayCuePanel',
    'App replay sidebar cue panel',
  );
  assertContains(
    appSource,
    'modqnReplayProofRequested: modqnReplayProofRequestActive',
    'App must resolve the scene lane before mounting replay scene proof',
  );
  assertContains(
    appSource,
    'shouldRenderModqnReplayScene(sceneLane)',
    'App must gate replay scene proof by scene lane',
  );
  assertContains(
    appSource,
    'showModqnReplayScene={showModqnReplayScene}',
    'App must pass lane-gated replay proof state into MainScene',
  );
  assertNotContains(
    appSource,
    "showModqnReplayScene={appMode === 'modqn-demo'}",
    'App must not mount replay scene proof from broad MODQN mode alone',
  );
  assertContains(
    mainSceneSource,
    'import { ModqnReplaySceneLayer }',
    'MainScene scene layer import',
  );
  assertContains(
    mainSceneSource,
    '<ModqnReplaySceneLayer',
    'MainScene R3F content',
  );
  assertContains(
    mainSceneSource,
    'worldUnitsPerKm={replayWorldUnitsPerKm}',
    'MainScene should pass scene scale into the replay truth layer',
  );
  assertNotContains(
    mainSceneSource,
    'createModqnProducerContextSatellites',
    'MODQN replay must not compute consumer-invented compressed context satellites',
  );
  assertNotContains(
    mainSceneSource,
    'generateWalkerConstellation',
    'MODQN replay must not use the live profile orbit as replay producer truth',
  );
  assertNotContains(
    mainSceneSource,
    'modqnProducerContextSatellites.map',
    'MODQN replay must not render compressed context satellite lanes',
  );
  assertNotContains(
    sceneLayerSource,
    'producerContextSatellitePositions',
    'MODQN replay must not use fallback/static producer-context satellite positions',
  );
  assertContains(
    sceneLayerSource,
    'SatelliteMarker',
    'R3F replay layer may render source-backed producer satellite states',
  );
  assertContains(
    sceneLayerSource,
    'data-modqn-replay-producer-satellite-state-count',
    'MODQN replay should publish producer satellite state count for browser smoke',
  );
  assertContains(
    sceneLayerSource,
    'data-modqn-replay-rendered-satellite-state-count',
    'MODQN replay should publish rendered satellite state count for browser smoke',
  );
  assertContains(
    sceneLayerSource,
    'data-modqn-replay-slot-decision-row-count',
    'MODQN replay should publish source slot row count for browser smoke',
  );
  assertContains(
    sceneLayerSource,
    'data-modqn-replay-truth-level',
    'MODQN replay should publish highest truth level for browser smoke',
  );
  assertContains(
    sceneLayerSource,
    'data-modqn-replay-source-gap-count',
    'MODQN replay should publish source-gap count for browser smoke',
  );
  assertContains(
    readRepoFile('src/scene/sceneLaneRenderPlan.ts'),
    "input.sceneLane === 'modqn-replay-proof'",
    'MODQN replay proof has an explicit scene lane before it can own the viewport',
  );
  assertContains(
    mainSceneSource,
    'showLiveSatelliteMarkers && viz.displaySats',
    'MODQN replay must hide live satellite markers and rely on producer-context markers',
  );
  assertContains(
    mainSceneSource,
    'showLiveBeamCones && !showCellOverlay && !showSinrLiveCellBeams && viz.displaySats',
    'MODQN replay must not also render legacy live SINR beam cones',
  );
  assertContains(
    sceneLayerSource,
    'modqn-replay-scene-beam-discs',
    'R3F replay beam activation layer',
  );
  assertContains(sceneLayerSource, 'producer-beam-state', 'R3F replay should consume producer beamState geometry when present');
  assertContains(sceneLayerSource, 'producer-display-proxy', 'R3F replay should render display-only producer geometry as a proxy layer');
  assertContains(sceneLayerSource, 'modqn-replay-proxy-beam-links', 'R3F replay should show proxy satellite-to-footprint beam links');
  assertContains(sceneLayerSource, 'modqn-replay-scene-beam-footprint', 'R3F replay source-backed beam footprints');
  assertContains(sceneLayerSource, 'modqn-replay-focused-user', 'R3F replay focused UE marker');
  assertNotContains(sceneLayerSource, 'modqn-replay-scene-beam-cone', 'R3F replay must not render consumer-invented satellite-to-footprint cones');
  assertContains(sceneLayerSource, '<circleGeometry', 'R3F replay beam footprints');
  assertContains(sceneLayerSource, '<ringGeometry', 'R3F replay beam activation rings');
  assertContains(
    sceneLayerSource,
    'modqn-replay-scene-active-beam-pulse',
    'R3F replay active beam pulse',
  );
  assertNotContains(sceneLayerSource, '<planeGeometry', 'R3F replay board must not render a board plane');
  assertContains(
    sceneLayerSource,
    '<Line',
    'R3F replay switch path',
  );
  assertContains(
    sceneLayerSource,
    'data-modqn-replay-scene-renderer',
    'canvas validation attributes',
  );
  assertContains(
    sceneLayerSource,
    'useReplaySceneTelemetry(visualState, showBoard)',
    'canvas validation attributes must be inactive outside modqn-replay mode',
  );
  assertContains(
    sceneLayerSource,
    'if (!enabled)',
    'canvas validation attributes must be removable when replay layer is inactive',
  );
  assertContains(
    sceneLayerSource,
    'r3f-world-layer',
    'canvas validation attributes',
  );
  assertNotContains(
    sceneLayerSource,
    'ModqnReplaySceneOverlay',
    'scene layer must not delegate proof to the DOM overlay component',
  );
  assertNotContains(
    helperSource,
    'THREE',
    'plain-data scene visual helper',
  );
  assertNotContains(
    helperSource,
    '../engine',
    'plain-data scene visual helper',
  );
  assertNotContains(
    helperSource,
    '../core',
    'plain-data scene visual helper',
  );
  assertNotContains(
    helperSource,
    'sinr',
    'display-only helper must not derive SINR',
  );
  assertNotContains(
    helperSource,
    'reward',
    'display-only helper must not derive rewards',
  );
  assertContains(
    helperSource,
    'activeHandover',
    'display helper should expose intra/inter handover activation state',
  );
  assertContains(
    helperSource,
    'createTruthAudit',
    'display helper should expose fail-closed truth-level audit',
  );
  assertContains(
    helperSource,
    'footprintProvenance',
    'display helper must inspect beam footprint provenance before rendering producer geometry',
  );
  assertContains(
    helperSource,
    'displayOnly',
    'display helper must reject display-only geometry as scene truth',
  );
  assertContains(
    helperSource,
    'no-earth-rotation-proxy',
    'display helper must reject proxy satellite coordinate frames as scene truth',
  );
  assertContains(
    helperSource,
    'Do not animate beam hopping.',
    'truth audit must explicitly fail closed for missing beam hopping schedule',
  );
  assertContains(
    helperSource,
    'Do not use color to imply different frequencies.',
    'truth audit must explicitly fail closed for missing frequency truth',
  );
  assertContains(
    cuePanelSource,
    'deriveModqnReplaySceneVisualState(displayState)',
    'cue panel must derive from display-only visual state',
  );
  assertContains(
    cuePanelSource,
    'data-testid="modqn-replay-cue-panel"',
    'cue panel browser smoke hook',
  );
  assertContains(
    cuePanelSource,
    'data-handover-event-kind={visualState.eventKind}',
    'cue panel event-kind proof hook',
  );
  assertContains(
    cuePanelSource,
    'data-beam-role={roleTone(beam.role)}',
    'cue panel beam role proof hook',
  );
  assertContains(
    cuePanelSource,
    'data-truth-level={level.level}',
    'cue panel should expose truth-level audit hooks',
  );
  assertContains(
    cuePanelSource,
    'data-truth-status={level.status}',
    'cue panel should expose source-gap status hooks',
  );
  assertNotContains(
    cuePanelSource,
    '../engine',
    'cue panel must not derive engine truth',
  );
  assertNotContains(
    cuePanelSource,
    'sinr',
    'cue panel must not infer SINR',
  );
  assertNotContains(
    cuePanelSource,
    'scalarReward',
    'cue panel must not derive scalar rewards',
  );
  assertNotContains(
    cuePanelSource,
    'rewardVector',
    'cue panel must not derive reward vectors',
  );
}

function assertClaimBoundaryCounts(): void {
  assert.equal(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts['intra-satellite-beam-switch'],
    MODQN_EXPECTED_EVENT_COUNTS['intra-satellite-beam-switch'],
  );
  assert.equal(MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts.none, MODQN_EXPECTED_EVENT_COUNTS.none);
  assert.equal(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts['inter-satellite-handover'],
    MODQN_EXPECTED_EVENT_COUNTS['inter-satellite-handover'],
  );
}

assert.equal(deriveModqnReplaySceneVisualState(null), null);
assertClaimBoundaryCounts();
assertFirstSlotVisualState();
assertSourceBackedGeometryVisualState();
assertDisplayOnlyProducerGeometryRendersProxyWithoutTruthClaim();
assertNoSwitchSlotVisualState();
assertInterSatelliteVisualState();
assertOmegaRescalarizedDisplayState();
assertSceneBridgeSource();

console.log('MODQN Phase 7K replay scene layer validation passed.');
