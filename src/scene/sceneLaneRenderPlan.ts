import type { SceneLane } from '../app/sceneLane';
import type { RuntimeConfig } from './types';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';

export interface SceneLaneRenderPlanInput {
  readonly sceneLane: SceneLane;
  readonly sceneSource: NormalizedSceneFrame['sceneSource'];
  readonly beamCalloutsEnabled: boolean;
  readonly beamDensity: RuntimeConfig['beamDensity'];
  readonly cinematicMode: RuntimeConfig['cinematicMode'];
  readonly effectsEnabled: RuntimeConfig['effectsEnabled'];
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  readonly recentHoActive: boolean;
  readonly replayProofLayerRequested: boolean;
}

export type SceneLaneUeMarkerShape = 'sphere' | 'cylinder';
export type HandoverStoryLayerPolicy =
  | 'sinr-live'
  | 'profile-derived-demo'
  | 'modqn-replay-source-backed'
  | 'artifact-owned'
  | 'disabled';

export interface SceneLaneSourceCompatibilityInput {
  readonly sceneLane: SceneLane;
  readonly sceneSource: NormalizedSceneFrame['sceneSource'];
}

export interface SceneLaneRenderPlan {
  readonly sourceCompatible: boolean;
  readonly isLiveScene: boolean;
  readonly isArtifactReplay: boolean;
  readonly showCellOverlay: boolean;
  readonly showEarthFixedCells: boolean;
  readonly showEarthFixedCellLabels: boolean;
  readonly showUav: boolean;
  readonly showLiveBeamCones: boolean;
  readonly showLiveSatelliteMarkers: boolean;
  readonly showBeamCallouts: boolean;
  readonly showLiveSceneEffects: boolean;
  readonly showSpineParticles: boolean;
  readonly showOrbitTrail: boolean;
  readonly showGroundRipple: boolean;
  readonly showInterHandoverArrow: boolean;
  readonly showHandoverToastOverlay: boolean;
  readonly handoverStoryLayerPolicy: HandoverStoryLayerPolicy;
  readonly showProfileHandoverStoryLayer: boolean;
  readonly showCinematicSpotlight: boolean;
  readonly effectiveCinematicMode: RuntimeConfig['cinematicMode'];
  readonly showReplayProofLayer: boolean;
  readonly showArtifactFpsCounter: boolean;
}

export function isSceneLaneSourceCompatible(input: SceneLaneSourceCompatibilityInput): boolean {
  if (input.sceneLane === 'artifact-replay') {
    return input.sceneSource === 'artifact-replay';
  }

  return input.sceneSource === 'live-sim';
}

export function resolveSceneLaneUeMarkerShape(sceneLane: SceneLane): SceneLaneUeMarkerShape {
  return sceneLane === 'sinr-live' ? 'cylinder' : 'sphere';
}

export function resolveSceneLaneRenderPlan(input: SceneLaneRenderPlanInput): SceneLaneRenderPlan {
  const sourceCompatible = isSceneLaneSourceCompatible(input);
  const isLiveScene = sourceCompatible && input.sceneSource === 'live-sim';
  const isArtifactReplay = sourceCompatible && input.sceneSource === 'artifact-replay';
  const showSinrLiveViewport = input.sceneLane === 'sinr-live' && isLiveScene;
  const showCellOverlay = input.sceneLane === 'modqn-live-cell-preview' && isLiveScene;
  const showProfileHandoverStoryLayer = showCellOverlay;
  const showReplayProofLayer =
    input.sceneLane === 'modqn-replay-proof'
    && isLiveScene
    && input.replayProofLayerRequested;
  const showLiveSceneEffects = showSinrLiveViewport;
  const showCinematicSpotlight = showSinrLiveViewport && input.cinematicMode === 'spotlight';
  const showLiveSatelliteMarkers = isLiveScene && (
    input.sceneLane === 'sinr-live'
    || input.sceneLane === 'modqn-live-cell-preview'
  );
  const showLiveBeamCones = showSinrLiveViewport;
  const showBeamCallouts = input.beamCalloutsEnabled && showLiveBeamCones;
  const showGroundRipple =
    showLiveSceneEffects
    && (input.effectsEnabled.servingRipple || input.effectsEnabled.pendingRipple)
    && !input.paused
    && !input.reducedMotion
    && !input.recentHoActive;

  return {
    sourceCompatible,
    isLiveScene,
    isArtifactReplay,
    showCellOverlay,
    showEarthFixedCells: showLiveSceneEffects,
    showEarthFixedCellLabels: showSinrLiveViewport && input.beamDensity === 'all',
    showUav: showSinrLiveViewport,
    showLiveBeamCones,
    showLiveSatelliteMarkers,
    showBeamCallouts,
    showLiveSceneEffects,
    showSpineParticles:
      input.effectsEnabled.spineParticles
      && !input.paused
      && !input.reducedMotion
      && showLiveSceneEffects,
    showOrbitTrail:
      input.effectsEnabled.orbitTrail
      && !input.reducedMotion
      && showLiveSceneEffects,
    showGroundRipple,
    showInterHandoverArrow: showSinrLiveViewport,
    showHandoverToastOverlay: showSinrLiveViewport,
    handoverStoryLayerPolicy:
      showSinrLiveViewport
        ? 'sinr-live'
        : showProfileHandoverStoryLayer
          ? 'profile-derived-demo'
          : input.sceneLane === 'modqn-replay-proof' && isLiveScene
            ? 'modqn-replay-source-backed'
            : input.sceneLane === 'artifact-replay' && isArtifactReplay
              ? 'artifact-owned'
              : 'disabled',
    showProfileHandoverStoryLayer,
    showCinematicSpotlight,
    effectiveCinematicMode: showCinematicSpotlight ? input.cinematicMode : 'off',
    showReplayProofLayer,
    showArtifactFpsCounter: isArtifactReplay,
  };
}
