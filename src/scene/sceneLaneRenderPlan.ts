import type { SceneLane } from '../app/sceneLane';
import type { RuntimeConfig } from './types';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';

/**
 * S-FLAG-2 producer-readiness gate for the MODQN-LIVE **service-allocation**
 * overlay family (the all-UE service map / readout / legend / diagnostics grid,
 * the per-cell UE-count badges, and the phase-3 beam-load cylinder + upload
 * particles). Every MODQN lane currently replays a DEGENERATE producer baseline
 * (100 UEs on one beam, 0 handovers, 1 satellite — see the baseline MODQN
 * producer-data defects report), so a map-wide "service allocation" is
 * meaningless noise that drowns the handover-cinema north star on the default
 * surface. The whole family is therefore PARKED OFF by default while the code +
 * data path stays intact (it is the G3 dense-Q proof scaffolding).
 *
 * Un-park trigger: the producer dense-Q export plus the four baseline-defect
 * fixes (spatial per-beam UE assignment / per-beam pattern+interference /
 * reward-scale normalization / real inter-intra HO events) land — see
 * `docs/handoff/producer-dense-q-export-request.md`. Flip this constant to `true`
 * (or wire a runtime producer-readiness signal into
 * `SceneLaneRenderPlanInput.modqnServiceAllocationEnabled`) to revive the whole
 * family in one move. A dev/validator force-enable exists via the
 * `?modqnServiceAllocation=1` URL override (App threads it into the input), so the
 * render path stays provable while the default stays parked.
 */
export const MODQN_SERVICE_ALLOCATION_PRODUCER_READY = false;

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
  /**
   * S-FLAG-2 producer-readiness gate for the MODQN service-allocation overlay
   * family. Optional; defaults to OFF (parked). App threads
   * `MODQN_SERVICE_ALLOCATION_PRODUCER_READY` OR the `?modqnServiceAllocation=1`
   * dev/validator override here. Only ever un-parks the family on the
   * `modqn-live-cell-preview` lane (it is AND-ed with `showCellOverlay`).
   */
  readonly modqnServiceAllocationEnabled?: boolean;
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
  /**
   * S-FLAG-2: gates the MODQN-LIVE service-allocation overlay family (all-UE
   * service map / readout / legend / diagnostics grid, per-cell UE-count badges,
   * phase-3 beam-load cylinder + upload particles). `modqn-live-cell-preview`
   * ONLY and PARKED OFF by default (degenerate producer baseline) — see
   * `MODQN_SERVICE_ALLOCATION_PRODUCER_READY`. The default MODQN-LIVE surface
   * keeps the hex cell overlay, cell beam cones, satellite markers, director
   * cinema, and the scene HUD; only the service-allocation noise is parked. It is
   * NOT the MODQN cell overlay itself (`showCellOverlay`) and never affects any
   * SINR/replay/artifact lane.
   */
  readonly showModqnServiceAllocation: boolean;
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
   * dots into a coloured cell mosaic (G3). The COLOUR render is ALSO mounted on
   * `modqn-live-cell-preview` (consolidation: MODQN renders like SINR — see the
   * `showSinrBeamRender` assignment + the governance matrix); it stays inert on
   * `modqn-replay-proof` and `artifact-replay`. The sinr-serving TELEMETRY/HUD
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
   * layer from the MODQN `showCellOverlay` cones — inert on every MODQN/artifact
   * lane.
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
   * (`showSinrLiveCellBeams`); inert on every MODQN/artifact lane.
   */
  readonly showSinrLiveHandoverPulse: boolean;
  readonly effectiveCinematicMode: RuntimeConfig['cinematicMode'];
  readonly showReplayProofLayer: boolean;
  readonly showArtifactFpsCounter: boolean;
}

export function isSceneLaneSourceCompatible(input: SceneLaneSourceCompatibilityInput): boolean {
  // Recorded-replay lanes require an artifact-backed frame. `modqn-replay-proof`
  // is the MODQN replay STAGE (P2): App feeds it the recorded dense-Q window via
  // `showcaseArtifactToScene` (sceneSource==='artifact-replay'), so it is
  // artifact-source-compatible like `artifact-replay`. The `live-sim` pin it USED
  // to carry belonged to the retired live-overlay single-decision board (the
  // `ModqnReplaySceneLayer`, clean-delete deferred to P3); the stage that replaced
  // it plays a recording, not the live sim. `sinr-live` + `modqn-live-cell-preview`
  // stay live-sim (negative controls: replay-proof/artifact + live-sim ⇒ false).
  if (input.sceneLane === 'artifact-replay' || input.sceneLane === 'modqn-replay-proof') {
    return input.sceneSource === 'artifact-replay';
  }

  return input.sceneSource === 'live-sim';
}

export function resolveSceneLaneUeMarkerShape(sceneLane: SceneLane): SceneLaneUeMarkerShape {
  // sinr-live AND the MODQN live page (which reuses the SINR scene render) use the
  // slim cylinder marker so the live lanes read consistently; only the replay /
  // artifact proof lanes keep the sphere marker.
  return sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview'
    ? 'cylinder'
    : 'sphere';
}

export function resolveSceneLaneRenderPlan(input: SceneLaneRenderPlanInput): SceneLaneRenderPlan {
  const sourceCompatible = isSceneLaneSourceCompatible(input);
  const isLiveScene = sourceCompatible && input.sceneSource === 'live-sim';
  const isArtifactReplay = sourceCompatible && input.sceneSource === 'artifact-replay';
  const showSinrLiveViewport = input.sceneLane === 'sinr-live' && isLiveScene;
  const showCellOverlay = input.sceneLane === 'modqn-live-cell-preview' && isLiveScene;
  const showProfileHandoverStoryLayer = showCellOverlay;
  // MODQN consolidation (Step 2): the SINR-style beam render (steered cones +
  // serving mosaic + live-handover pulse + live effects) now mounts on BOTH the
  // live SINR lane AND the MODQN live-cell-preview lane, so MODQN renders beams
  // like SINR (the MODQN decision overlay then highlights the chosen beam). The
  // proof/artifact lanes stay inert.
  const showSinrBeamRender = showSinrLiveViewport || showCellOverlay;
  // S-FLAG-2: the MODQN service-allocation overlay family is `modqn-live-cell-preview`
  // ONLY and parked OFF until the producer baseline is non-degenerate. Default OFF
  // (`?? false`); App threads `MODQN_SERVICE_ALLOCATION_PRODUCER_READY` / the
  // `?modqnServiceAllocation=1` override. Never un-parks on any non-cell lane
  // (AND-ed with `showCellOverlay`).
  const showModqnServiceAllocation =
    showCellOverlay && (input.modqnServiceAllocationEnabled ?? false);
  const showReplayProofLayer =
    input.sceneLane === 'modqn-replay-proof'
    && isLiveScene
    && input.replayProofLayerRequested;
  const showLiveSceneEffects = showSinrBeamRender;
  const showCinematicSpotlight = showSinrLiveViewport && input.cinematicMode === 'spotlight';
  // Director focus is allowed on the live walker lanes (live-focus) and on the
  // artifact-replay lane (cinematic replay). Artifact-replay may own replay speed
  // + display-only UE focus (frontend-render-governance.md), which is exactly what
  // the cinematic camera tween + slow-mo are. Replay-proof stays inert (Rule#8).
  const showDirectorFocus =
    (showSinrLiveViewport || showCellOverlay || isArtifactReplay) && input.cinematicMode === 'director';
  // SINR-serving mosaic (S2): sinr-live ONLY, always-on ambient default (NOT
  // director-gated). It is a distinct SINR-serving layer, never the MODQN cell
  // overlay — so it is inert on every MODQN/artifact lane.
  const showSinrServingMosaic = showSinrBeamRender;
  // SINR-live earth-fixed cell-truth CONES = the lane's PRIMARY beam render (see the
  // `showSinrLiveCellBeams` field doc above). Mounts on BOTH live lanes via
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
  const showLiveSatelliteMarkers = isLiveScene && (
    input.sceneLane === 'sinr-live'
    || input.sceneLane === 'modqn-live-cell-preview'
  );
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
    showCellOverlay,
    showModqnServiceAllocation,
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
    // steered beams). The MODQN live page reuses the SINR scene for its multi-beam
    // cones but is a PROOF surface, not the ambient experience — gate spine on
    // `showSinrLiveViewport` (sinr-live only) so it does not inherit the streaming
    // particles via the `showSinrBeamRender` OR that lights MODQN's cones.
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
    showSinrServingMosaic,
    showSinrLiveCellBeams,
    showSinrLiveHandoverPulse,
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
