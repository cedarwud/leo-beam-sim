#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CinematicSeekFadeOverlay } from '../src/ui/CinematicSeekFadeOverlay';
import { ControlBar } from '../src/ui/ControlBar';
import { DirectorControls } from '../src/ui/DirectorControls';
import {
  resolveSceneLaneRenderPlan,
  type SceneLaneRenderPlanInput,
} from '../src/scene/sceneLaneRenderPlan';
import { resolveDirectorFocusPose } from '../src/scene/directorFocusPose';
import type { CameraPreset, DirectorFocusPhase } from '../src/scene/types';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed += 1;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed += 1;
}

function check(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    pass(label);
  } else {
    fail(label, detail);
  }
}

function section(label: string, fn: () => void): void {
  console.log(`\n${label}`);
  try {
    fn();
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function countOccurrences(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function extractConstArray(sourceText: string, constName: string): string {
  const match = sourceText.match(new RegExp(`const\\s+${constName}:[\\s\\S]*?=\\s*\\[([\\s\\S]*?)\\];`));
  return match?.[1] ?? '';
}

function extractConstObject(sourceText: string, constName: string): string {
  const match = sourceText.match(new RegExp(`const\\s+${constName}:[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\};`));
  return match?.[1] ?? '';
}

function renderControlBarMarkup(): string {
  const noop = () => undefined;
  const onCameraPresetSelect = (_preset: CameraPreset) => undefined;
  return renderToString(
    <ControlBar
      selectedProfileId="hobs-2024-candidate-rich"
      profileOptions={[{ id: 'hobs-2024-candidate-rich', label: 'HOBS candidate rich' }]}
      paused={false}
      speed={1}
      effectiveSpeed={1}
      autoSlowActive={false}
      autoSlowApplied={false}
      autoSlowEnabled={true}
      uiMode="presentation"
      beamDensity="event-plus-1"
      beamCalloutsEnabled={true}
      cinematicMode="off"
      onProfileChange={noop}
      onUiModeChange={noop}
      onBeamDensityChange={noop}
      onToggleBeamCallouts={noop}
      onCameraPresetSelect={onCameraPresetSelect}
      onCinematicModeChange={noop}
      onTogglePause={noop}
      onSpeedChange={noop}
      onToggleAutoSlow={noop}
      onHandoverModeChange={noop}
    />,
  );
}

const expectedPresets = ['zenith', 'oblique', 'chase', 'paper-faithful-closeup'] as const;
const expectedTestIds = expectedPresets.map(preset => `camera-preset-${preset}`);

section('(a) CameraPreset union source', () => {
  const typesSource = source('src/scene/types.ts');
  check(
    typesSource.includes("export type CameraPreset = 'zenith' | 'oblique' | 'chase' | 'paper-faithful-closeup'"),
    'CameraPreset union includes paper-faithful-closeup after the existing presets',
  );
});

section('(b) MainScene camera pose source', () => {
  const mainSceneSource = source('src/scene/MainScene.tsx');
  const poseRecord = extractConstObject(mainSceneSource, 'CAMERA_PRESET_POSES');
  check(poseRecord.includes("'paper-faithful-closeup'"), 'CAMERA_PRESET_POSES contains paper-faithful-closeup key');
  check(/'paper-faithful-closeup'[\s\S]*?position:\s*\[\s*0,\s*320,\s*380\s*\]/.test(poseRecord), 'paper-faithful-closeup position is [0, 320, 380]');
  check(/'paper-faithful-closeup'[\s\S]*?target:\s*\[\s*0,\s*80,\s*0\s*\]/.test(poseRecord), 'paper-faithful-closeup target is [0, 80, 0]');
  check(/Record<CameraPreset/.test(mainSceneSource), 'CAMERA_PRESET_POSES remains typed as Record<CameraPreset, ...>');
});

section('(c) ControlBar camera preset source', () => {
  const controlBarSource = source('src/ui/ControlBar.tsx');
  const presetArray = extractConstArray(controlBarSource, 'CAMERA_PRESETS');
  check(countOccurrences(presetArray, /\bpreset:/g) === 4, 'CAMERA_PRESETS array contains 4 preset entries');
  check(presetArray.includes('Paper-faithful close-up'), 'CAMERA_PRESETS contains Paper-faithful close-up label');
  check(presetArray.includes("preset: 'paper-faithful-closeup'"), 'CAMERA_PRESETS contains paper-faithful-closeup preset literal');
  for (const preset of ['zenith', 'oblique', 'chase']) {
    check(presetArray.includes(`preset: '${preset}'`), `CAMERA_PRESETS preserves ${preset}`);
  }
});

section('(d) ControlBar SSR camera preset buttons', () => {
  const markup = renderControlBarMarkup();
  check(markup.includes('data-testid="camera-preset-control"'), 'SSR render preserves camera-preset-control parent testid');
  for (const testId of expectedTestIds) {
    check(markup.includes(`data-testid="${testId}"`), `SSR render contains ${testId}`);
  }
});

section('(e) CameraPreset Record exhaustiveness source', () => {
  const mainSceneSource = source('src/scene/MainScene.tsx');
  const poseRecord = extractConstObject(mainSceneSource, 'CAMERA_PRESET_POSES');
  for (const preset of expectedPresets) {
    const keyPattern = preset === 'paper-faithful-closeup'
      ? /'paper-faithful-closeup'\s*:/
      : new RegExp(`\\b${preset}\\s*:`);
    check(keyPattern.test(poseRecord), `CAMERA_PRESET_POSES contains ${preset} key`);
  }
  check(countOccurrences(poseRecord, /\bposition:\s*\[/g) === 4, 'CAMERA_PRESET_POSES contains 4 position entries');
  check(countOccurrences(poseRecord, /\btarget:\s*\[/g) === 4, 'CAMERA_PRESET_POSES contains 4 target entries');
});

section('(f) Regression: existing preset testids still produce-able', () => {
  const controlBarSource = source('src/ui/ControlBar.tsx');
  const presetArray = extractConstArray(controlBarSource, 'CAMERA_PRESETS');
  for (const preset of ['zenith', 'oblique', 'chase']) {
    check(presetArray.includes(`preset: '${preset}'`), `existing ${preset} array entry still feeds camera-preset-${preset}`);
  }
  check(
    controlBarSource.includes('data-testid={`camera-preset-${option.preset}`}'),
    'ControlBar still derives child camera testids from option.preset',
  );
});

// ----- Phase 2 Director Mode extensions (docs/showcase-master-sdd-v2.md §5) -----

function directorRenderPlanInput(
  overrides: Partial<SceneLaneRenderPlanInput>,
): SceneLaneRenderPlanInput {
  return {
    sceneLane: 'sinr-live',
    sceneSource: 'live-sim',
    beamCalloutsEnabled: false,
    beamDensity: 'event-plus-1',
    cinematicMode: 'director',
    effectsEnabled: {
      spineParticles: false,
      orbitTrail: false,
      servingRipple: false,
      pendingRipple: false,
    },
    paused: false,
    reducedMotion: false,
    recentHoActive: false,
    replayProofLayerRequested: false,
    ...overrides,
  };
}

function directorButtonTag(markup: string, testId: string): string {
  const match = markup.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`));
  return match?.[0] ?? '';
}

function directorButtonDisabled(markup: string, testId: string): boolean {
  return /disabled=""/.test(directorButtonTag(markup, testId));
}

function renderDirectorControlsMarkup(props: {
  intraEnabled: boolean;
  interEnabled: boolean;
  phase: DirectorFocusPhase;
}): string {
  const noop = () => undefined;
  return renderToString(
    <DirectorControls
      intraEnabled={props.intraEnabled}
      interEnabled={props.interEnabled}
      phase={props.phase}
      onIntraFocus={noop}
      onInterFocus={noop}
      onExit={noop}
    />,
  );
}

section('(g) CinematicMode director member source', () => {
  const typesSource = source('src/scene/types.ts');
  check(
    typesSource.includes("export type CinematicMode = 'off' | 'spotlight' | 'director'"),
    "CinematicMode union includes 'director'",
  );
});

section('(h) Render plan: director is lane-gated to live-walker + artifact-replay lanes', () => {
  const sinrLive = resolveSceneLaneRenderPlan(
    directorRenderPlanInput({ sceneLane: 'sinr-live', sceneSource: 'live-sim' }),
  );
  check(
    sinrLive.effectiveCinematicMode === 'director' && sinrLive.showDirectorFocus,
    'director is effective on the sinr-live live lane',
  );

  const cellPreview = resolveSceneLaneRenderPlan(
    directorRenderPlanInput({ sceneLane: 'modqn-live-cell-preview', sceneSource: 'live-sim' }),
  );
  check(
    cellPreview.effectiveCinematicMode === 'director' && cellPreview.showDirectorFocus,
    'director is effective on the modqn-live-cell-preview live lane',
  );

  const replayProof = resolveSceneLaneRenderPlan(
    directorRenderPlanInput({ sceneLane: 'modqn-replay-proof', sceneSource: 'live-sim' }),
  );
  check(
    replayProof.effectiveCinematicMode === 'off' && !replayProof.showDirectorFocus,
    'director is INERT on modqn-replay-proof (effectiveCinematicMode resolves off)',
  );

  // Cinematic replay lane: director IS effective on artifact-replay (the replay
  // timeline is seekable; slow-mo = replay speed, camera = display-only UE focus,
  // both governance-allowed for artifact-replay).
  const artifactReplay = resolveSceneLaneRenderPlan(
    directorRenderPlanInput({ sceneLane: 'artifact-replay', sceneSource: 'artifact-replay' }),
  );
  check(
    artifactReplay.effectiveCinematicMode === 'director' && artifactReplay.showDirectorFocus,
    'director (cinematic replay) is effective on the artifact-replay lane',
  );

  // Incompatible pair fails closed: artifact-replay lane with a live source.
  const artifactReplayWrongSource = resolveSceneLaneRenderPlan(
    directorRenderPlanInput({ sceneLane: 'artifact-replay', sceneSource: 'live-sim' }),
  );
  check(
    artifactReplayWrongSource.effectiveCinematicMode === 'off' && !artifactReplayWrongSource.showDirectorFocus,
    'director is INERT on artifact-replay lane with an incompatible live source',
  );

  const artifactReplayOff = resolveSceneLaneRenderPlan(
    directorRenderPlanInput({ sceneLane: 'artifact-replay', sceneSource: 'artifact-replay', cinematicMode: 'off' }),
  );
  check(
    artifactReplayOff.effectiveCinematicMode === 'off' && !artifactReplayOff.showDirectorFocus,
    'cinematic off stays off on artifact-replay',
  );

  const spotlight = resolveSceneLaneRenderPlan(
    directorRenderPlanInput({ sceneLane: 'sinr-live', sceneSource: 'live-sim', cinematicMode: 'spotlight' }),
  );
  check(
    spotlight.effectiveCinematicMode === 'spotlight' && !spotlight.showDirectorFocus,
    'spotlight path is unaffected by the director addition',
  );

  const off = resolveSceneLaneRenderPlan(
    directorRenderPlanInput({ sceneLane: 'sinr-live', sceneSource: 'live-sim', cinematicMode: 'off' }),
  );
  check(
    off.effectiveCinematicMode === 'off' && !off.showDirectorFocus,
    'cinematic off stays off',
  );
});

section('(i) Single-chain director speed tier source', () => {
  const playbackSource = source('src/usePlaybackControls.ts');
  check(/DIRECTOR_FOCUS_SPEED\s*=\s*0\.05/.test(playbackSource), 'DIRECTOR_FOCUS_SPEED = 0.05 is defined');
  check(playbackSource.includes('directorFocusActive'), 'effectiveSpeed chain consumes directorFocusActive');
  check(
    /directorFocusActive[\s\S]*?Math\.min\(speed,\s*DIRECTOR_FOCUS_SPEED\)/.test(playbackSource),
    'director tier caps the single effectiveSpeed chain at DIRECTOR_FOCUS_SPEED',
  );
});

section('(j) MainScene OrbitControls ownership restore guarantee source', () => {
  const mainSceneSource = source('src/scene/MainScene.tsx');
  check(
    mainSceneSource.includes("if (effectiveCinematicMode !== 'director')"),
    'director command handler is inert unless effectiveCinematicMode is director',
  );
  check(mainSceneSource.includes('controls.enabled = false'), 'acquiring disables OrbitControls');
  check(
    /tween\.kind === 'director-restore'[\s\S]*?controls\.enabled = true/.test(mainSceneSource),
    'director-restore tween completion re-enables OrbitControls',
  );
  check(
    /effectiveCinematicMode === 'director'\) return;[\s\S]*?controls\.enabled = true/.test(mainSceneSource),
    'force-restore guard re-enables OrbitControls when the lane stops being director',
  );
  const enableCount = countOccurrences(mainSceneSource, /controls\.enabled = true/g);
  const disableCount = countOccurrences(mainSceneSource, /controls\.enabled = false/g);
  check(
    disableCount >= 1 && enableCount >= disableCount,
    `every controls.enabled=false (${disableCount}) is matched by a re-enable (${enableCount} found)`,
  );
});

section('(k) DirectorControls SSR — per-kind source gating + inert disabled state', () => {
  const allOff = renderDirectorControlsMarkup({ intraEnabled: false, interEnabled: false, phase: 'idle' });
  check(allOff.includes('data-testid="director-controls"'), 'SSR renders the director-controls container');
  check(allOff.includes('data-testid="director-intra-focus"'), 'SSR renders the intra focus button');
  check(allOff.includes('data-testid="director-inter-focus"'), 'SSR renders the inter focus button');
  check(allOff.includes('data-testid="director-exit-focus"'), 'SSR renders the exit button');
  check(directorButtonDisabled(allOff, 'director-intra-focus'), 'intra focus disabled when no source-backed intra event');
  check(directorButtonDisabled(allOff, 'director-inter-focus'), 'inter focus disabled when no source-backed inter event');
  check(directorButtonDisabled(allOff, 'director-exit-focus'), 'exit disabled while idle');

  const intraOnly = renderDirectorControlsMarkup({ intraEnabled: true, interEnabled: false, phase: 'idle' });
  check(!directorButtonDisabled(intraOnly, 'director-intra-focus'), 'intra focus enabled when a source-backed intra event exists');
  check(directorButtonDisabled(intraOnly, 'director-inter-focus'), 'inter focus stays disabled when no inter event exists');

  const focused = renderDirectorControlsMarkup({ intraEnabled: true, interEnabled: true, phase: 'focused' });
  check(directorButtonDisabled(focused, 'director-intra-focus'), 'focus buttons disabled while a focus is already active');
  check(!directorButtonDisabled(focused, 'director-exit-focus'), 'exit enabled while a focus is active');

  const appSource = source('src/App.tsx');
  check(
    /directorIntraEnabled[\s\S]*?handoverRailEvents\.some\(event => event\.kind === 'intra'\)/.test(appSource),
    'App gates the intra button on a source-backed intra rail event',
  );
  check(
    /directorInterEnabled[\s\S]*?handoverRailEvents\.some\(event => event\.kind === 'inter'\)/.test(appSource),
    'App gates the inter button on a source-backed inter rail event',
  );
});

// ----- D6a: pure Director focus-pose helper extraction + sat-pair framing -----

section('(l) resolveDirectorFocusPose extracted to a pure, renderer-free module', () => {
  const poseSource = source('src/scene/directorFocusPose.ts');
  check(
    /export function resolveDirectorFocusPose/.test(poseSource),
    'directorFocusPose.ts exports resolveDirectorFocusPose',
  );
  check(
    /export interface DirectorFocusFramingPose/.test(poseSource)
    && poseSource.includes('fromSatWorldPos')
    && poseSource.includes('toSatWorldPos'),
    'DirectorFocusFramingPose carries fromSatWorldPos/toSatWorldPos',
  );
  check(
    !/import .*react/i.test(poseSource) && !/@react-three/.test(poseSource),
    'pure module imports no React / react-three-fiber (validator/test loadable)',
  );

  const mainSceneSource = source('src/scene/MainScene.tsx');
  check(
    mainSceneSource.includes("from './directorFocusPose'"),
    'MainScene imports resolveDirectorFocusPose from the extracted module',
  );
  check(
    !/function resolveDirectorFocusPose/.test(mainSceneSource),
    'MainScene no longer defines resolveDirectorFocusPose inline (single source of truth)',
  );
});

section('(m) Director focus pose: inter-HO frames the real source/target sat pair', () => {
  const ue: [number, number, number] = [10, 0, 20];
  const fromSat: [number, number, number] = [110, 400, 50];
  const toSat: [number, number, number] = [-90, 420, -60];

  const interFallback = resolveDirectorFocusPose(ue, 1, 'inter');
  const interFramed = resolveDirectorFocusPose(ue, 1, 'inter', {
    fromSatWorldPos: fromSat,
    toSatWorldPos: toSat,
  });
  check(
    !interFramed.position.equals(interFallback.position)
    && !interFramed.target.equals(interFallback.target),
    'inter pair framing produces a different pose than the legacy kind-only fallback',
  );
  const cx = (ue[0] + fromSat[0] + toSat[0]) / 3;
  const cy = (ue[1] + fromSat[1] + toSat[1]) / 3;
  const cz = (ue[2] + fromSat[2] + toSat[2]) / 3;
  check(
    Math.abs(interFramed.target.x - cx) < 1e-6
    && Math.abs(interFramed.target.y - cy) < 1e-6
    && Math.abs(interFramed.target.z - cz) < 1e-6,
    'inter pair framing retargets to the {UE, fromSat, toSat} centroid',
  );

  const intraFramed = resolveDirectorFocusPose(ue, 1, 'intra', {
    fromSatWorldPos: fromSat,
    toSatWorldPos: toSat,
  });
  const intraFallback = resolveDirectorFocusPose(ue, 1, 'intra');
  check(
    intraFramed.position.equals(intraFallback.position)
    && intraFramed.target.equals(intraFallback.target),
    'intra-HO ignores sat-pair framing by design (single-satellite beam switch)',
  );
});

section('(n) D6b Director framing uses real rail satellite ids', () => {
  const railSource = source('src/ui/HandoverEventRail.tsx');
  check(
    /readonly fromSatId\?: string \| null;/.test(railSource)
    && /readonly toSatId\?: string \| null;/.test(railSource),
    'HandoverRailEvent declares optional fromSatId/toSatId',
  );

  const appSource = source('src/App.tsx');
  check(
    /const decision = frame\?\.modqnDecision/.test(appSource)
    && /const decisionSource = decision\?\.previousSatelliteId \?\? null/.test(appSource)
    && /const decisionTarget = decision\?\.selectedSatelliteId \?\? null/.test(appSource),
    'buildArtifactHandoverRailEvents reads the authoritative per-frame primary modqnDecision pair',
  );
  check(
    /const primaryInterHo =\s*decisionSource !== null && decisionTarget !== null && decisionSource !== decisionTarget/.test(appSource)
    && /const fromSatId = primaryInterHo \? decisionSource : null/.test(appSource)
    && /const toSatId = primaryInterHo \? decisionTarget : null/.test(appSource),
    'artifact framing attaches ONLY for a primary inter-HO and fails closed otherwise (no secondary-event misattribution)',
  );

  const liveAdapterSource = source('src/app/liveWalkerHandoverRailAdapter.ts');
  check(
    /fromSatId:\s*event\.fromSatId/.test(liveAdapterSource)
    && /toSatId:\s*event\.toSatId/.test(liveAdapterSource),
    'live walker rail adapter copies fromSatId/toSatId from source events',
  );

  const cinematicWindowSource = source('src/scene/cinematicReplayWindow.ts');
  check(
    /export interface CinematicReplayWindow[\s\S]*readonly fromSatId: string \| null;[\s\S]*readonly toSatId: string \| null;/.test(cinematicWindowSource),
    'CinematicReplayWindow declares non-optional fromSatId/toSatId',
  );
  check(
    /fromSatId:\s*target\.event\.fromSatId\s*\?\?\s*null/.test(cinematicWindowSource)
    && /toSatId:\s*target\.event\.toSatId\s*\?\?\s*null/.test(cinematicWindowSource),
    'resolveCinematicReplayWindow copies selected event satellite ids',
  );

  const typesSource = source('src/scene/types.ts');
  check(
    /export interface DirectorFocusFraming[\s\S]*fromSatId\?: string \| null;[\s\S]*toSatId\?: string \| null;/.test(typesSource)
    && /export interface RuntimeDirectorFocusCommand[\s\S]*framing\?: DirectorFocusFraming/.test(typesSource),
    'RuntimeDirectorFocusCommand declares optional framing ids',
  );

  const cameraControlsSource = source('src/useCameraControls.ts');
  check(
    /const requestFocus = useCallback\(\(kind: DirectorFocusKind,\s*framing\?: DirectorFocusFraming\)/.test(cameraControlsSource)
    && /requestIntraFocus = useCallback\(\(framing\?: DirectorFocusFraming\)[\s\S]*requestFocus\('intra', framing\)/.test(cameraControlsSource)
    && /requestInterFocus = useCallback\(\(framing\?: DirectorFocusFraming\)[\s\S]*requestFocus\('inter', framing\)/.test(cameraControlsSource),
    'useCameraControls requestFocus accepts framing and intra/inter forward it',
  );

  const mainSceneSource = source('src/scene/MainScene.tsx');
  check(
    /function lookupSatWorldPos/.test(mainSceneSource)
    && /satellites\.find\(candidate => candidate\.id === satId\)/.test(mainSceneSource),
    'MainScene defines lookupSatWorldPos against current scene satellites',
  );
  check(
    countOccurrences(mainSceneSource, /resolveDirectorFocusPose\(ueWorldPos, alpha, command\.kind, framing\)/g) === 1
      && /function applyDirectorFocusCommand/.test(mainSceneSource)
      && countOccurrences(mainSceneSource, /applyDirectorFocusCommand\(\{/g) >= 2,
    'shared applyDirectorFocusCommand passes framing as the 4th pose arg once, called by both director call sites (P1 de-dup)',
  );

  // P3: the director orchestration (requestDirectorFocus + the cinematic/live
  // focus lifecycle) was extracted from App into this hook; assertions that used
  // to read App.tsx now read the hook source (same verbatim logic, new home).
  const directorHookSource = source('src/app/useDirectorOrchestration.ts');
  check(
    /const framing = \{\s*fromSatId: replayWindow\.fromSatId,\s*toSatId: replayWindow\.toSatId,?\s*\}/.test(directorHookSource),
    'Director hook cinematic requestDirectorFocus builds framing from replayWindow satellite ids',
  );
  check(
    /camera\.requestIntraFocus\(framing\)/.test(directorHookSource)
    && /camera\.requestInterFocus\(framing\)/.test(directorHookSource),
    'Director hook cinematic requestDirectorFocus forwards framing to the camera',
  );
  // The cinematic (artifact) lane seeks then frames the pinned event immediately;
  // the live lane's PRIMARY path also frames the pair but deferred (ITEM #C). The
  // no-framing call below is only the legacy fallback when no indexed event resolves.
  check(
    /if \(kind === 'intra'\) camera\.requestIntraFocus\(\);\s*else camera\.requestInterFocus\(\);/.test(directorHookSource),
    'Director hook live requestDirectorFocus keeps a legacy no-framing fallback when no event resolves',
  );
});

section('(o) D3 cinematic seek fade overlay is artifact-lane-only presentation chrome', () => {
  const markup = renderToString(
    <CinematicSeekFadeOverlay
      pulseKey={null}
      reducedMotion={false}
      onPeak={() => undefined}
    />,
  );
  check(
    markup.includes('data-testid="cinematic-seek-fade-overlay"'),
    'SSR render contains cinematic-seek-fade-overlay testid',
  );
  check(
    markup.includes('data-fade-phase="idle"'),
    'SSR render starts idle',
  );
  check(
    markup.includes('pointer-events:none'),
    'SSR render keeps pointer-events none in the style',
  );
  check(
    markup.includes('aria-hidden="true"'),
    'SSR render is aria-hidden',
  );

  const overlaySource = source('src/ui/CinematicSeekFadeOverlay.tsx');
  check(
    !/from ['"]three['"]/.test(overlaySource) && !/@react-three/.test(overlaySource),
    'CinematicSeekFadeOverlay imports no three / @react-three modules',
  );
  check(/export const PEAK_OPACITY = 0\.6;/.test(overlaySource), 'PEAK_OPACITY = 0.6');
  check(/export const FADE_OUT_MS = 150;/.test(overlaySource), 'FADE_OUT_MS = 150');
  check(/export const FADE_IN_MS = 150;/.test(overlaySource), 'FADE_IN_MS = 150');

  const appSource = source('src/App.tsx');
  // P3: cinematic fade state + the deferred-seek closure live in the director hook
  // now; only the overlay MOUNT (which reads the hook's returned fade pulse +
  // peak handler) stays in App.tsx JSX.
  const directorHookSource = source('src/app/useDirectorOrchestration.ts');
  check(
    /const \[cinematicFadePulse, setCinematicFadePulse\] = useState<number \| null>\(null\);/.test(directorHookSource),
    'Director hook declares cinematicFadePulse state',
  );
  check(
    /const pendingCinematicSeekRef = useRef<\(\(\) => void\) \| null>\(null\);/.test(directorHookSource),
    'Director hook declares pendingCinematicSeekRef',
  );
  check(
    /const handleCinematicSeekPeak = useCallback\(\(\) => \{[\s\S]*?pendingCinematicSeekRef\.current = null;[\s\S]*?run\?\.\(\);[\s\S]*?\}, \[\]\);/.test(directorHookSource),
    'Director hook declares handleCinematicSeekPeak and clears the pending closure before running it',
  );
  check(
    /\{\(directorCinematicEnabled \|\| directorFocusEnabled\) && \([\s\S]*?<CinematicSeekFadeOverlay[\s\S]*?pulseKey=\{cinematicFadePulse\}[\s\S]*?reducedMotion=\{runtime\.reducedMotion\}[\s\S]*?onPeak=\{handleCinematicSeekPeak\}/.test(appSource),
    'App mounts CinematicSeekFadeOverlay gated on the director cinematic OR live focus (ITEM #C)',
  );
  check(
    /const runCinematicSeek = \(\) => \{[\s\S]*?replayController\.seek\(replayWindow\.startSec\);[\s\S]*?setActiveCinematicWindow\(replayWindow\);[\s\S]*?camera\.requestInterFocus\(framing\);[\s\S]*?\};/.test(directorHookSource),
    'Director hook keeps the cinematic seek + camera work in one deferred closure',
  );
  check(
    /if \(reducedMotion\) \{\s*runCinematicSeek\(\);\s*\} else \{\s*pendingCinematicSeekRef\.current = runCinematicSeek;\s*setCinematicFadePulse\(prev => \(prev === null \? 0 : prev \+ 1\)\);\s*\}/.test(directorHookSource),
    'Director hook runs synchronously for reduced motion and otherwise bumps the fade pulse after stashing the seek',
  );
  check(
    /replayController,\s*reducedMotion,/.test(directorHookSource),
    'requestDirectorFocus deps include reducedMotion',
  );
});

console.log('\n---');
console.log(`[validate-phase-c-camera-preset] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
