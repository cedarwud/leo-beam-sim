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
}

export type SceneLaneUeMarkerShape = 'sphere' | 'cylinder';
export type HandoverStoryLayerPolicy =
  | 'sinr-live'
  | 'profile-derived-demo'
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
   * SINR-serving mosaic (S2). The ambient default on `sinr-live`: every UE
   * marker is coloured by its serving beam (by SINR), partitioning the ~100 UE
   * dots into a coloured cell mosaic (G3). It stays inert on artifact-replay.
   * The sinr-serving TELEMETRY/HUD
   * PROOF, by contrast, is gated tighter than this flag (sinr-live-owned). It is
   * the always-on ambient base, NOT director-gated (Rule#10 default = mosaic +
   * aggregate).
   */
  readonly showSinrServingMosaic: boolean;
  /**
   * SINR-live earth-fixed cell-truth beam cones (S-cells-3). The lane's PRIMARY
   * beam render: one cone per served earth-fixed cell, apex = serving sat, base =
   * FIXED cell centre (from `frame.sinrLiveCells`, the SINR + HandoverManager
   * truth — NOT the round-robin `cellScheduler`). It REPLACES the steered
   * `SatelliteBeams` cones on this lane (which glued a beam onto the UE), so the
   * UE renders visibly off-centre in its cell footprint. Lane-owned to
   * `sinr-live` ONLY and always-on (the ambient base, like the mosaic); a DISTINCT
   * layer from the legacy steered cones.
   */
  readonly showSinrLiveCellBeams: boolean;
  /**
   * G2c ambient live-handover pulse (the "一直有換手" payoff) — now the SINGLE
   * handover-visual layer (C3 collapsed the director cinema pair + candidate
   * highlight into it). Lane-owned to `sinr-live` ONLY and ALWAYS-ON ambient (NOT
   * director-gated): as the sim plays forward, each real per-frame handover
   * (`frame.sinrLiveCells.recentHandoverEvents`) flares its old/new cell cones
   * bright (intra vs inter coloured, C2) then fades them by age, with no seek and
   * no camera move. A distinct layer from the faint ambient serving field
   * (`showSinrLiveCellBeams`); inert on artifact-replay.
   */
  readonly showSinrLiveHandoverPulse: boolean;
  readonly effectiveCinematicMode: RuntimeConfig['cinematicMode'];
  readonly showArtifactFpsCounter: boolean;
}

export function isSceneLaneSourceCompatible(input: SceneLaneSourceCompatibilityInput): boolean {
  // Recorded-replay lanes require an artifact-backed frame. Archived TLE is a
  // peer simulation-shaped source only for sinr-live.
  if (input.sceneLane === 'artifact-replay') {
    return input.sceneSource === 'artifact-replay';
  }

  if (input.sceneLane === 'sinr-live') {
    return input.sceneSource === 'live-sim' || input.sceneSource === 'archived-tle';
  }

  return input.sceneSource === 'live-sim';
}

export function resolveSceneLaneUeMarkerShape(sceneLane: SceneLane): SceneLaneUeMarkerShape {
  // The live SINR lane uses the slim cylinder marker; replay/artifact lanes keep
  // the sphere marker.
  return sceneLane === 'sinr-live'
    ? 'cylinder'
    : 'sphere';
}

export function resolveSceneLaneRenderPlan(input: SceneLaneRenderPlanInput): SceneLaneRenderPlan {
  const sourceCompatible = isSceneLaneSourceCompatible(input);
  const isLiveScene = sourceCompatible && input.sceneSource !== 'artifact-replay';
  const isArtifactReplay = sourceCompatible && input.sceneSource === 'artifact-replay';
  const showSinrLiveViewport = input.sceneLane === 'sinr-live' && isLiveScene;
  const showProfileHandoverStoryLayer = false;
  const showSinrBeamRender = showSinrLiveViewport;
  const showLiveSceneEffects = showSinrBeamRender;
  const showCinematicSpotlight = showSinrLiveViewport && input.cinematicMode === 'spotlight';
  // Director focus is allowed on the live walker lanes (live-focus) and on the
  // artifact-replay lane (cinematic replay). Artifact-replay may own replay speed
  // + display-only UE focus (frontend-render-governance.md), which is exactly what
  // the cinematic camera tween + slow-mo are. Replay-proof stays inert (Rule#8).
  const showDirectorFocus =
    (showSinrLiveViewport || isArtifactReplay) && input.cinematicMode === 'director';
  // SINR-serving mosaic: sinr-live only, always-on ambient default.
  const showSinrServingMosaic = showSinrBeamRender;
  // SINR-live earth-fixed cell-truth CONES = the lane's PRIMARY beam render (see the
  // `showSinrLiveCellBeams` field doc above). Mounts on the live SINR lane via
  // `showSinrBeamRender`. HISTORY (de-staled 2026-06-18): the 2026-06-08
  // "S-cells-4 render reset" briefly PARKED these — that was REVERTED (un-parked
  // 2026-06-11) and the consolidation built ON them (serving-identity colour,
  // legible footprint rings, lattice-phase off-centre). The cones DO render; the
  // legacy steered `SatelliteBeams` mount is RETIRED (dead twin, Tier-2), NOT what
  // renders here. The old reset note lives in
  // `.agent-memory/project_sinr_render_reset_2026-06-08.md` (historical only).
  const showSinrLiveCellBeams = showSinrBeamRender;
  // G2c live-handover pulse: sinr-live ONLY, ALWAYS-ON ambient (NOT director-gated).
  // Same lane gate as the faint ambient cones — the pulse is the bright, age-faded
  // overlay of the real per-frame handovers the cell model already classified, so it
  // mounts whenever the SINR-live viewport is shown, never waiting on a manual arm.
  const showSinrLiveHandoverPulse = showSinrBeamRender;
  const showLiveSatelliteMarkers = isLiveScene && input.sceneLane === 'sinr-live';
  const showLiveBeamCones = showSinrBeamRender;
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
    // S-cells-4d: the legacy 20-hex steered-cover green-disc ground paint is
    // RETIRED. The earth-fixed cell story is now owned by the cell-truth beam
    // cones (`showSinrLiveCellBeams`), whose oblique footprints draw the real 37
    // cells; the old hex disc was a DIFFERENT layout and competed with them. Kept
    // false (not removed) so the hex-cover model + its `validate:vc3a:hex-paint`
    // logic gate stay intact for reuse.
    showEarthFixedCells: false,
    showEarthFixedCellLabels: showSinrLiveViewport && input.beamDensity === 'all',
    showUav: showSinrLiveViewport,
    showLiveBeamCones,
    showLiveSatelliteMarkers,
    showBeamCallouts,
    showLiveSceneEffects,
    // Spine particles are a sinr-live AMBIENT effect (data streaming along the
    // the steered beams).
    showSpineParticles:
      input.effectsEnabled.spineParticles
      && !input.paused
      && !input.reducedMotion
      && showSinrLiveViewport,
    showOrbitTrail:
      input.effectsEnabled.orbitTrail
      && !input.reducedMotion
      && showLiveSceneEffects,
    showGroundRipple,
    showHandoverToastOverlay: showSinrLiveViewport,
    handoverStoryLayerPolicy:
      showSinrLiveViewport
        ? 'sinr-live'
        : input.sceneLane === 'artifact-replay' && isArtifactReplay
          ? 'artifact-owned'
          : 'disabled',
    showProfileHandoverStoryLayer,
    showCinematicSpotlight,
    showDirectorFocus,
    showSinrServingMosaic,
    showSinrLiveCellBeams,
    showSinrLiveHandoverPulse,
    // Replaces legacy single-lane anchor: effectiveCinematicMode: showCinematicSpotlight ? input.cinematicMode : 'off'
    effectiveCinematicMode: showCinematicSpotlight
      ? 'spotlight'
      : showDirectorFocus
        ? 'director'
        : 'off',
    showArtifactFpsCounter: isArtifactReplay,
  };
}
