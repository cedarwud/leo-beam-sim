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
  readonly showHandoverToastOverlay: boolean;
  readonly handoverStoryLayerPolicy: HandoverStoryLayerPolicy;
  readonly showProfileHandoverStoryLayer: boolean;
  readonly showCinematicSpotlight: boolean;
  readonly showDirectorFocus: boolean;
  /**
   * Handover-cinema candidate-beam highlight (S1). Lane-owned to `sinr-live`
   * ONLY (real SINR, no producer dependency) AND only while the director
   * cinematic camera is engaged. Inert on `modqn-live-cell-preview`,
   * `modqn-replay-proof` (Rule#8), and `artifact-replay`.
   */
  readonly showCandidateHandoverHighlight: boolean;
  /**
   * SINR-serving mosaic (S2). The ambient default on `sinr-live`: every UE
   * marker is coloured by its serving beam (by SINR), partitioning the ~100 UE
   * dots into a coloured cell mosaic (G3). Lane-owned to `sinr-live` ONLY — it
   * is a DISTINCT SINR-serving visualisation, NOT the MODQN cell overlay, so it
   * stays inert on `modqn-live-cell-preview`, `modqn-replay-proof`, and
   * `artifact-replay`. Unlike the candidate highlight it is NOT director-gated:
   * the mosaic is the always-on ambient base (Rule#10 default = mosaic +
   * aggregate).
   */
  readonly showSinrServingMosaic: boolean;
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
  // Director focus is allowed on the live walker lanes (live-focus) and on the
  // artifact-replay lane (cinematic replay). Artifact-replay may own replay speed
  // + display-only UE focus (frontend-render-governance.md), which is exactly what
  // the cinematic camera tween + slow-mo are. Replay-proof stays inert (Rule#8).
  const showDirectorFocus =
    (showSinrLiveViewport || showCellOverlay || isArtifactReplay) && input.cinematicMode === 'director';
  // Handover-cinema candidate highlight (S1): sinr-live ONLY + director cinematic
  // engaged. Narrower than showDirectorFocus on purpose — S1 builds the real-SINR
  // candidate story on the live SINR lane with no producer dependency; the MODQN
  // and artifact variants are later slices.
  const showCandidateHandoverHighlight = showSinrLiveViewport && input.cinematicMode === 'director';
  // SINR-serving mosaic (S2): sinr-live ONLY, always-on ambient default (NOT
  // director-gated). It is a distinct SINR-serving layer, never the MODQN cell
  // overlay — so it is inert on every MODQN/artifact lane.
  const showSinrServingMosaic = showSinrLiveViewport;
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
    showDirectorFocus,
    showCandidateHandoverHighlight,
    showSinrServingMosaic,
    // Replaces legacy single-lane anchor: effectiveCinematicMode: showCinematicSpotlight ? input.cinematicMode : 'off'
    effectiveCinematicMode: showCinematicSpotlight
      ? 'spotlight'
      : showDirectorFocus
        ? 'director'
        : 'off',
    showReplayProofLayer,
    showArtifactFpsCounter: isArtifactReplay,
  };
}
