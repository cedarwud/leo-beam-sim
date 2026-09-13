// SDD §7 (v4 review codex NEW-2): MainScene is the **boundary** between the
// live engine and the renderer. `useSimulation` still emits `SimFrame`
// directly; MainScene projects it to `NormalizedSceneFrame` via
// `liveSimToScene` and `sceneGeometryFromProfile`, then passes the normalised
// frame + geometry into `useBeamViz` / `useSimStatePublisher` /
// `HandoverToastOverlay`. The replay path will mount a parallel
// `useReplayPlayback` hook in P3 that constructs NormalizedSceneFrame via
// `showcaseArtifactToScene` instead.
import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Profile } from '../profiles/types';
import type {
  CameraPreset,
  RuntimeConfig,
  SimFrame,
  SimState,
} from './types';
import type { SceneVisualScaleMultipliers } from '../sceneVisualScale';
import type { HomepageBeamMetricsProjection } from '../homepage/controller/contracts';
import type {
  HandoverTeachingSurfaceProjection,
} from './handoverTeachingSurfaceProjection';
import type {
  InstructorHandoverTransportSnapshot,
} from '../homepage/teaching/instructorHandoverTransport';
import type {
  StudentHandoverActivityState,
} from '../homepage/teaching/studentHandoverActivityState';
import type { HandoverSurfaceBindingSet } from './handoverSurfaceBinding';
import { useSimulation } from './useSimulation';
import { useUeTrailHistory } from './useUeTrailHistory';
import { useBeamViz } from './useBeamViz';
import { sceneGeometryFromProfile } from './SceneGeometry';
import { useSimStatePublisher } from './useSimStatePublisher';
import {
  MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER,
  MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED,
  resolveMultiCandidateComparisonPolicy,
  resolveMultiCandidateMarkerPolicy,
  resolveMultiCandidatePresentationPolicy,
  resolveMultiCandidateRenderIdentity,
  type MultiCandidateCentralMarkerFilter,
  type MultiCandidateComparisonLatch,
  type MultiCandidatePresentationHold,
} from './multiCandidateSceneDisplayPolicy';
import {
  buildCandidateSceneRenderReceipt,
  isCandidateSceneRenderReceiptReady,
} from './candidateSceneRenderReceipt';
import {
  useCandidateInspectionSelection,
  type CandidateInspectionSnapshotInput,
} from '../ui/handover-evaluation/candidateInspectionSelection';
import {
  HOMEPAGE_SATELLITE_COLOR_COUNT,
} from '../homepage/controller/homepageSatelliteVisualIdentity';
import {
  homepageBeamEeKey,
  homepageBeamEeNormalizedByKey,
  homepageSatelliteEeProgressById as homepageSatelliteEeProgressByIdFromMetrics,
} from '../homepage/controller/homepageBeamEeProjection';
import {
  HOMEPAGE_PRIMARY_UE_MARKER_COLOR,
  HOMEPAGE_PRIMARY_UE_MARKER_EMISSIVE,
} from '../homepage/controller/homepageAccentPalette';
import {
  restrictHomepageBeamItems,
  resolveServingFanSatelliteIds,
  resolveServingConeBudgetFan,
  resolveServingConeFocusSatIds,
} from '../appearance/beamVisibilityContract';
import { resolveHomepageSceneGeometryPolicy } from '../homepage/controller/homepageSceneGeometryPolicy';
import { HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR } from '../constants/handoverVisualIdentity';
// S-cells-4d: the legacy 20-hex EarthFixedCells green-disc ground paint is retired
// from the sinr-live lane (the cell-truth beam cones own the earth-fixed cell story
// now). Its hex-cover MODEL stays in `../viz/EarthFixedCells` for reuse + the
// `validate:vc3a:hex-paint` logic gate; only this scene's usage is removed.
import {
  resolveMultiCandidateBeamScene,
  selectCentralMultiCandidateSceneInstructions,
  selectHomepageCandidateSceneInstructions,
} from '../viz/MultiCandidateBeamScene';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { SPINE_PARTICLES_PER_BEAM } from '../viz/SpineParticles';
import { SceneGroundUeLayer } from './SceneGroundUeLayer';
import { GroundScene } from '../viz/GroundScene';
import {
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveCinemaHandoverCandidate,
} from '../viz/SinrLiveCellBeamCones';
import {
  DEFAULT_BEAM_DISPLAY_SPEC,
  resolveBeamFocusSatIds,
  resolveDisplayHeroPrimary,
  resolveDisplayHeroRecord,
  type BeamDisplaySpec,
} from './beamDisplaySpec';
import {
  cellLinkBudgetBeamId,
  cellIdFromLinkBudgetBeamId,
  resolvePrimaryCellServingRecord,
  type SinrLiveCellHandoverEvent,
} from './sinrLiveCellModel';
import { MANUAL_HANDOVER_DISPLAY_MS, resolveManualHandoverDemoEvent } from './manualHandoverDemo';
import {
  HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
  HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
} from '../homepage/controller/homepageHandoverTiming';
import {
  resolveHandoverCinemaDisplayMs,
  resolveHandoverCinemaReady,
  resolveInterCinemaPairAnchor,
  selectHandoverEventsForDisplay,
  type InterCinemaPairAnchor,
} from './handoverDisplayIsolation';
import { resolveHandoverPresentationDurations } from '../appearance/handoverTimingEnvelope';
import {
  resolveAuthorityPresentationCandidate,
  resolveCinemaDisplaySatelliteIds,
  resolveCinemaInterSatelliteWorldById,
  resolveCinemaPairCandidate,
  resolveHandoverPresentationDisplayPolicy,
  resolveManualHandoverDisplayMs,
  resolveManualHandoverDisplayState,
  resolveHomepageEeProgressVisible,
  resolveSinrLiveCellTelemetry,
} from './handoverPresentationDisplayPolicy';
import {
  resolveDisplayedOtherHandoverUes,
  selectOtherHandoverUeIds,
} from './otherHandoverUeSelector';
import {
  advanceHandoverPresentation,
  createIdleHandoverPresentationView,
  createHandoverPresentationState,
  type HandoverPresentationSnapshot,
} from './handoverPresentationOwner';
import {
  buildSinrLiveCellLayout,
  resolveSinrLiveSceneCellCount,
  SINR_LIVE_ARCHIVED_DISPLAY_CELL_COUNT,
} from './sinrLiveCellRuntime';
import { createSinrLiveBeamDisplayFrame } from './sinrLiveBeamDisplayFrame';
import { SceneSatelliteMarkerLayer } from './SceneSatelliteMarkerLayer';
import { SceneMultiCandidateLayer } from './SceneMultiCandidateLayer';
import { SceneSinrLiveBeamLayers } from './SceneSinrLiveBeamLayers';
import { SceneHandoverMotionLayers } from './SceneHandoverMotionLayers';
import { SceneAcceptedHandoverCue } from './SceneAcceptedHandoverCue';
import { SceneIntraGroundShockwave } from './SceneIntraGroundShockwave';
import { SceneHandoverToastLayer } from './SceneHandoverToastLayer';
import { SceneHorizonBoundary } from './SceneHorizonBoundary';
import { SceneNarrativeCaption, type NarrativeCaptionDisplay } from './SceneNarrativeCaption';
import { formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import {
  NTPU_CONFIG,
  NTPU_LARGE_CONFIG,
  resolveInscribedPaperUserArea,
} from '../config/ntpu.config';
import { UAV } from '../components/scene/UAV';
import { Starfield } from '../components/ui/Starfield';
import { BaseSceneLayout } from './BaseSceneLayout';
import { TeachingFloor } from './TeachingFloor';
import { SceneTelemetry } from './SceneTelemetry';
import { SceneHandoverStoryCanvasTelemetry } from './SceneHandoverStoryCanvasTelemetry';
import { SceneRenderPlanCanvasTelemetry } from './SceneRenderPlanCanvasTelemetry';
import {
  resolveBoundSceneHandoverStoryFrameSet,
  resolveBoundSceneHandoverSurfaceBindingSet,
} from './sceneHandoverStoryFrameSet';
import { resolvePresentationHandoverStoryFrame } from './handoverStoryFrame';
import { resolveSceneRenderPlan } from './sceneRenderPlan';
import {
  resolveCinematicSpotlightTargets,
} from './cinematicEffects';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import { FPSCounter } from './FPSCounter';
import {
  shouldEnableHomepageMultiCandidateAuthority,
  shouldSuppressLegacyPrimaryHandover,
  type SceneLane,
} from '../app/sceneLane';
import type { SimulationSourceMode } from '../app/simulationSourceMode';
import { resolveNaturalHandoverProtagonistId } from './naturalHandoverProtagonist';
import {
  commitReceiptMatchesHandoverPresentation,
  resolveHandoverAuthorityJoin,
  type AuthorityHandoverTransition,
} from './handoverAuthorityJoin';
import { resolveHandoverEventCuePolicy } from './handoverEventCuePolicy';
import {
  isSceneLaneSourceCompatible,
  resolveSceneLaneRenderPlan,
  resolveSceneLaneUeMarkerShape,
} from './sceneLaneRenderPlan';
import {
  resolveSinrServingUeColorMap,
} from './sinrServingMosaic';
import { EMPTY_BEAM_LOAD_CONTENTION } from './beamLoadContention';
import { resolveDirectorFocusPose } from './directorFocusPose';
import { LIVE_CINEMATIC_CAMERA_ENABLED } from '../app/appRuntimeConfig';
import type { SimulationAnalysisFrame, SimulatorConstellation } from '../simulator/types';
import { adaptSimulationAnalysisFrameToArchivedTleSimFrame } from './archivedTleSimFrameAdapter';
import {
  buildArchivedTleSevenCellPlacement,
  type ArchivedTleSevenCellPlacement,
} from './archivedTleSevenCellPlacement';
import {
  isScenePresenterEnabled,
  readScenePresentationStageFromSearch,
  resolveScenePresentationPlan,
  type ScenePresentationPlan,
  type ScenePresentationStageId,
} from './presentation/scenePresentation';
import { ScenePresentationToolbar } from './presentation/ScenePresentationToolbar';
import { DEFAULT_SATELLITE_CONSTELLATION } from '../viz/satelliteModelCatalog';
import {
  type AcceptedHandoverPresentationSnapshot,
} from './acceptedHandoverPresentationSnapshot';
import { useHandoverConeItems } from './useHandoverConeItems';
import { selectCandidateConeGeometry } from './candidateConeItems';
import { resolveSatelliteSurfaceColor } from '../appearance/satelliteSurfaceModifiers';
import { resolveHandoverOverlayCueColors } from '../appearance/handoverOverlayIdentity';
import { resolveSinrLiveEllipseTiltExaggeration } from '../appearance/coneGeometryContract';
import { resolveHandoverToastCopy } from '../appearance/handoverToastCopy';
import { useSinrLiveCellBeamConeItems } from './useSinrLiveCellBeamConeItems';
import { useSinrLiveCandidateBeamConeItems } from './useSinrLiveCandidateBeamConeItems';
import { useSinrLiveCinemaInterServingFanConeItems } from './useSinrLiveCinemaInterServingFanConeItems';
import { useSinrLiveCellNonServingConeItems } from './useSinrLiveCellNonServingConeItems';
import { useLiveBeamIdentityColorMap, useSceneIdentityColorLadder } from './useSceneIdentityColorLadder';
import { useSinrLiveConePalette } from './useSinrLiveConePalette';
import type { SceneFrameResolutionInput } from './sceneFrameResolver';
import { useSceneFrame } from './useSceneFrame';
import type { MultiCandidateSatelliteColorsInput } from './multiCandidateSatelliteColors';
import { useMultiCandidateSatelliteColors } from './useMultiCandidateSatelliteColors';
import type { RenderedLiveSatelliteMarkersInput } from './renderedLiveSatelliteMarkers';
import { useRenderedLiveSatelliteMarkers } from './useRenderedLiveSatelliteMarkers';
import type { HandoverPresentationCandidateInput } from './handoverPresentationCandidate';
import { useHandoverPresentationCandidate } from './useHandoverPresentationCandidate';
import type { BeamInfoItemsInput } from './beamInfoItems';
import {
  type HomepageSceneBeamVisibilityInput,
} from './homepageSceneBeamVisibility';
import { useHomepageBeamVisibility } from './useHomepageBeamVisibility';
import { useBeamInfoItems } from './useBeamInfoItems';
import { resolveSinrLiveCellPlacementById } from './sinrLiveCellPlacement';
import { resolveMultiCandidateBeamColors } from './multiCandidateBeamColors';
import { resolveHandoverMarkerSatelliteIds } from './handoverMarkerSatelliteIds';
import { resolveTeachingLabelSatelliteIds } from './satelliteMarkerLabelPolicy';
import { resolveHomepageIntraCellAnchor } from './homepageIntraCellAnchor';
import { resolveSinrLiveCellTruthSpineParticlePlans } from './sinrLiveCellTruthSpineParticlePlans';
import { resolveLatchedAuthorityTransition } from './latchedAuthorityTransition';
import {
  resolveCandidateDisplayCellFrame,
  resolveCinemaInterDisplayCellFrame,
} from './sceneDisplayCellFrames';
import {
  resolveRecentInterHandoverEvent,
  resolveRecentPrimaryHandoverEvent,
} from './recentHandoverPresentationEvent';
import {
  advanceNarrativeCaptionHold,
  isNarrativeCaptionBaselineChapter,
  resolveNarrativeCaptionChapterFromStoryPhase,
  resolveNarrativeCaptionText,
  type NarrativeCaptionHoldState,
} from './narrativeCaptionPolicy';
import { resolveAdditiveHandoverConeColoring } from './additiveHandoverConeColoring';
import { resolveAuthoritySpineParticlePlans } from './multiCandidateAuthoritySpineParticlePlans';
import { resolveMultiCandidateSceneRenderStatus } from './multiCandidateSceneRenderStatus';
import {
  formatSceneSurfaceReasons,
  resolveCoreSceneSurfacePlan,
  type CoreSceneSurfacePlan,
} from './sceneSurfacePlan';

function lookupSatWorldPos(
  satellites: NormalizedSceneFrame['satellites'],
  satId: string | null | undefined,
): readonly [number, number, number] | null {
  if (!satId) return null;
  const sat = satellites.find(candidate => candidate.id === satId);
  return sat ? sat.worldPos : null;
}

function ScenePresentationCanvasTelemetry({
  plan,
  surfacePlan,
}: {
  readonly plan: ScenePresentationPlan;
  readonly surfacePlan?: CoreSceneSurfacePlan;
}) {
  const gl = useThree(state => state.gl);
  const hasSurfacePlan = surfacePlan !== undefined;
  const storyOwner = surfacePlan?.storyOwner ?? '';
  const mountedSurfaceIds = surfacePlan?.mountedSurfaceIds.join(',') ?? '';
  const visibleSurfaceIds = surfacePlan?.visibleSurfaceIds.join(',') ?? '';
  const surfaceReasons = surfacePlan ? formatSceneSurfaceReasons(surfacePlan) : '';
  useEffect(() => {
    gl.domElement.dataset.scenePresentationStage = plan.stage;
    gl.domElement.dataset.scenePresentationVisibleLayers = Object.entries(plan.visible)
      .filter(([, visible]) => visible)
      .map(([layer]) => layer)
      .join(',');
    if (hasSurfacePlan) {
      gl.domElement.dataset.sceneStoryOwner = storyOwner;
      gl.domElement.dataset.sceneCoreMountedSurfaces = mountedSurfaceIds;
      gl.domElement.dataset.sceneCoreVisibleSurfaces = visibleSurfaceIds;
      gl.domElement.dataset.sceneCoreSurfaceReasons = surfaceReasons;
    } else {
      delete gl.domElement.dataset.sceneStoryOwner;
      delete gl.domElement.dataset.sceneCoreMountedSurfaces;
      delete gl.domElement.dataset.sceneCoreVisibleSurfaces;
      delete gl.domElement.dataset.sceneCoreSurfaceReasons;
    }
  }, [
    gl,
    mountedSurfaceIds,
    plan,
    storyOwner,
    hasSurfacePlan,
    surfaceReasons,
    visibleSurfaceIds,
  ]);
  return null;
}

interface SceneContentProps {
  profile: Profile;
  speed: number;
  paused: boolean;
  runtime: RuntimeConfig;
  visualScaleMultipliers: SceneVisualScaleMultipliers;
  sceneLane: SceneLane;
  /** Root-only compact satellite identity projection; other lanes omit it. */
  homepageVisualIdentity?: boolean;
  /** Exact active-TLE names for homepage labels; raw IDs remain join keys. */
  homepageSatelliteNameById?: ReadonlyMap<string, string> | null;
  /** Homepage-only frame-local EE colour projection; other lanes omit it. */
  homepageBeamMetrics?: HomepageBeamMetricsProjection | null;
  /** Display-only medium switch; never enters the simulation producer. */
  campusVisible: boolean;
  onSimUpdate: (state: SimState) => void;
  /** App-accepted atomic candidate snapshot shared with the right rail. */
  acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  /** R4 shell-owned normalized frames shared by scene, rail and captions. */
  handoverSurfaceBindingsRef: MutableRefObject<HandoverSurfaceBindingSet>
  /** R5 single source-time transport published on scene/rail/caption. */
  instructorHandoverSnapshotRef?: MutableRefObject<InstructorHandoverTransportSnapshot | null>;
  /** R6 activity identity published beside the same R5 source-time owner. */
  studentHandoverActivityStateRef?: MutableRefObject<StudentHandoverActivityState | null>;
  onLiveSeekLanded?: (seekRequestKey: string) => void;
  sceneFrame?: NormalizedSceneFrame;
  /** Display-only spacecraft model family; archived frames carry this from provenance. */
  constellation?: SimulatorConstellation;
  /** Presentation-only mount plan; existing lane gates remain authoritative. */
  presentationPlan: ScenePresentationPlan;
  /** Tier-2 display-only beam knobs (direct prop, bypasses the runtime bag). */
  beamDisplaySpec?: BeamDisplaySpec;
  /** Focused live handover-cinema candidate used only by the cone presentation layer. */
  handoverCinemaCandidate?: SinrLiveCinemaHandoverCandidate | null;
  /** The cinema button owns the display while its requested frame is landing. */
  handoverCinemaArmed?: boolean;
  handoverCinemaKind?: 'intra' | 'inter' | null;
  /** Downstream presentation status; never a handover-decision input. */
  onHandoverPresentationChange?: (snapshot: HandoverPresentationSnapshot) => void;
  /** Imperative render-time gate; the callback must only update a ref. */
  onHandoverPresentationBusyChange?: (busy: boolean) => void;
  /** Display-only switch for HTML/callout information over the stage. */
  showSceneOverlays?: boolean;
  /** Exact shell-owned authored projection shared with the rail and caption. */
  teachingSurfaceProjectionRef?: MutableRefObject<HandoverTeachingSurfaceProjection | null>;
  /** One App-owned join key shared by the homepage rail and scene. */
  focusedJoinKey?: string | null;
  onFocusJoinKeyChange?: (joinKey: string | null) => void;
  /** Gates only the short-lived event captions; highlights remain available. */
  teachingNarrativeEnabled?: boolean;
}

interface SceneRenderContentProps extends SceneContentProps {
  /** Fully resolved scene state. The renderer must not infer its orbit source. */
  sim: SimFrame;
  /** Prevent archived-TLE presentation state from publishing into the legacy live rail. */
  simSource: 'live' | 'archived-tle';
  /** Optional seven-cell placement carried by the immutable canonical TLE frame. */
  canonicalScenario?: SimulationAnalysisFrame['scenario'];
  /** Same-frame comparison identity; this is not a handover-pending claim. */
  canonicalCandidateSatelliteId?: string | null;
  /** One exact display mapping shared by adapter, cones, footprints, and UEs. */
  archivedTlePlacement?: ArchivedTleSevenCellPlacement;
  /** Immutable canonical TTT carried by the accepted TLE trace. */
  canonicalHandoverTttSec?: number;
  /** Exact canonical event semantic; forced continuity is not Offset+TTT. */
  canonicalHandoverEvent?: SimulationAnalysisFrame['handover'];
  /** Provenance carrier for the projection wrapper; never a compute input. */
  archivedTleFrameIdentity?: Pick<SimulationAnalysisFrame, 'frameId' | 'provenance'>;
  /** Exact live seek key consumed by useSimulation; display-only cinema timing gate. */
  liveSeekLandedKey?: string | null;
}

interface ArtifactSceneContentProps {
  runtime: RuntimeConfig;
  visualScaleMultipliers: SceneVisualScaleMultipliers;
  sceneLane: SceneLane;
  /** Display-only medium switch; never enters the simulation producer. */
  campusVisible: boolean;
  sceneFrame: NormalizedSceneFrame;
  presentationPlan: ScenePresentationPlan;
  handoverSurfaceBindingsRef: MutableRefObject<HandoverSurfaceBindingSet>
  /** R5 single source-time transport published on scene/rail/caption. */
  instructorHandoverSnapshotRef?: MutableRefObject<InstructorHandoverTransportSnapshot | null>;
  /** R6 activity identity published beside the same R5 source-time owner. */
  studentHandoverActivityStateRef?: MutableRefObject<StudentHandoverActivityState | null>;
}

const CAMERA_TWEEN_DURATION_MS = 600;
/**
 * The central candidate layer follows the authoritative pre-selection phase
 * rather than a second wall-clock timer.  The engine's TTT/selection clocks
 * remain the only duration source; this keeps the candidate story visible
 * until the actual switching frame without adding an artificial pause.
 */
/**
 * How often the manual-handover demonstration republishes its wall clock (ms).
 *
 * The demonstration is a 6 s wall-clock animation, so its progress needs a CLOCK, and
 * that clock has to be a re-render (the envelope is derived in the component body). At
 * 60 fps a per-frame `setState` would be 360 renders — and `triggeredIntraConeItems`'s
 * memo has a 14-entry dep array, so each one is a full cone recompute. 50 ms (~20 Hz) is
 * far above the perceptual threshold for a fade that lasts seconds, at ~1/3 the cost.
 */
const MANUAL_HANDOVER_TICK_INTERVAL_MS = 50;

/** The manual-handover demonstration's per-frame tick bookkeeping (see {@link resolveManualHandoverTick}). */
interface ManualHandoverTickState {
  /** Which request this tick belongs to — a NEW button press restarts the clock. */
  readonly requestId: number;
  /** Wall clock at the last published tick. */
  readonly publishedAtMs: number;
  /** The window has elapsed and the final frame was published — go quiet. */
  readonly settled: boolean;
}

/** Focused cinema pair clock; keyed by the indexed event, not by simulation state. */
interface CinemaHandoverTickState {
  readonly eventId: string;
  readonly startedAtMs: number;
  readonly publishedAtMs: number;
  readonly ready: boolean;
  readonly settled: boolean;
}

/**
 * PURE tick decision for the manual-handover demonstration (2026-08-06 bug fix).
 *
 * THE BUG: `App.requestManualHandover` calls `playback.setPaused(true)` BEFORE arming the
 * request, so from that moment `useSimulation` publishes no frames and NOTHING re-renders
 * MainScene for the whole 6 s window. The demonstration's age was derived from
 * `performance.now()` in the component BODY, which therefore evaluated exactly once, at
 * age ≈ 0 — so `resolveManualHandoverConeEnvelope` was pinned to phase 1
 * (`fromOpacity = peak`, `toOpacity = 0`) and the audience saw ONE beam for six seconds
 * and then nothing. The four-phase envelope was never wrong; it was never ADVANCED.
 *
 * THE CLOCK: R3F's `useFrame`, which runs on the Canvas render loop
 * (`frameloop="always"` on every live lane). `paused` gates `stepRuntimeFrame`, NOT the
 * R3F loop — so this keeps ticking precisely while the sim is stopped, which is exactly
 * the window that needs it.
 *
 * Pure + exported so the throttle/lifecycle can be executed and VALUE-asserted headlessly
 * (a React-free simulated frame loop) instead of inferred from reading the component.
 *
 * Returns the next tick state and whether the caller should publish a re-render:
 *  - request disarmed → clear the state, publish once (so the last frame drops the cue);
 *  - a new/changed requestId → publish immediately (frame 1 of the demonstration);
 *  - past the display window → publish ONE final frame, then `settled` silences it (no
 *    permanent per-frame setState after the demonstration ends);
 *  - otherwise publish only when `intervalMs` has elapsed since the last publish.
 */
export function resolveManualHandoverTick(input: {
  readonly requestId: number | undefined;
  readonly startedAtMs: number | undefined;
  readonly nowMs: number;
  readonly displayMs: number;
  readonly previous: ManualHandoverTickState | null;
  readonly intervalMs?: number;
}): { readonly next: ManualHandoverTickState | null; readonly publish: boolean } {
  const intervalMs = input.intervalMs ?? MANUAL_HANDOVER_TICK_INTERVAL_MS;
  if (input.requestId === undefined || input.startedAtMs === undefined) {
    // Disarmed. Publish once IF we were ticking, so the frame that drops the cue draws.
    return { next: null, publish: input.previous !== null };
  }
  const previous = input.previous;
  if (previous === null || previous.requestId !== input.requestId) {
    return { next: { requestId: input.requestId, publishedAtMs: input.nowMs, settled: false }, publish: true };
  }
  if (input.nowMs - input.startedAtMs > input.displayMs) {
    if (previous.settled) return { next: previous, publish: false };
    return { next: { ...previous, publishedAtMs: input.nowMs, settled: true }, publish: true };
  }
  if (input.nowMs - previous.publishedAtMs < intervalMs) return { next: previous, publish: false };
  return { next: { requestId: input.requestId, publishedAtMs: input.nowMs, settled: false }, publish: true };
}

interface CameraTweenState {
  preset: CameraPreset | null;
  kind: 'preset' | 'director-acquire' | 'director-restore' | 'multi-candidate-refit';
  startedAtMs: number;
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPosition: THREE.Vector3;
  toTarget: THREE.Vector3;
  durationMs?: number;
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}

type DirectorSnapshot = { position: THREE.Vector3; target: THREE.Vector3 };
type DirectorSnapshotRef = MutableRefObject<DirectorSnapshot | null>;
type CameraTweenRef = MutableRefObject<CameraTweenState | null>;
/**
 * The four points the Director acquire/restore FSM hands control back to its
 * caller. The artifact hook ignores them; the live SceneContent maps them to its
 * camera-preset telemetry refs (cameraPresetRef / cameraTransitionRef).
 */
type DirectorFocusTransition = 'acquire-applied' | 'acquire-tween' | 'restore-applied' | 'restore-tween';

// CQ1 (cinema quality): after the acquire tween lands, the camera used to HOLD a
// single static pose for the whole focus — the shot read as a frozen zoom. Instead
// it now gently ORBITS the focus subject (slow azimuth arc around `center`) with a
// subtle dolly/rise "breathing" so the cinema feels like cinematography, not a
// freeze-frame. This is display-only motion (Rule#6): it never touches SINR / HO /
// decision truth, only the presentation camera. Suppressed under reduced motion.
const DIRECTOR_FOCUS_ORBIT_ANGULAR_SPEED = 0.16; // rad/s, ~quarter-turn over the focus hold
const DIRECTOR_FOCUS_ORBIT_DOLLY_AMPLITUDE = 0.07; // ±7% in/out breathing on the orbit radius
const DIRECTOR_FOCUS_ORBIT_RISE_AMPLITUDE = 0.06; // ±6% gentle vertical bob
const DIRECTOR_FOCUS_ORBIT_BREATH_PERIOD_SEC = 9;

interface DirectorFocusOrbitState {
  /** The focus target the camera arcs around (= the landed acquire-pose target). */
  readonly center: THREE.Vector3;
  /** The landed acquire-pose camera offset from `center` (rotated/scaled each frame). */
  readonly baseOffset: THREE.Vector3;
  readonly startedAtMs: number;
}
type DirectorFocusOrbitRef = MutableRefObject<DirectorFocusOrbitState | null>;

/**
 * Advance the continuous Director focus orbit by one frame: rotate the landed
 * acquire offset around the vertical axis through `center`, with a slow dolly +
 * rise "breath" so the framing stays alive without losing the subject. Keeps
 * `controls.target` pinned to `center` so the subject stays centred while the
 * camera arcs. Pure presentation motion.
 */
function advanceDirectorFocusOrbit(ctx: {
  readonly camera: THREE.Camera;
  readonly controls: OrbitControlsImpl | null;
  readonly orbit: DirectorFocusOrbitState;
  readonly nowMs: number;
}): void {
  const { camera, controls, orbit, nowMs } = ctx;
  const tSec = Math.max(0, (nowMs - orbit.startedAtMs) / 1000);
  const angle = tSec * DIRECTOR_FOCUS_ORBIT_ANGULAR_SPEED;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const breath = Math.sin((tSec / DIRECTOR_FOCUS_ORBIT_BREATH_PERIOD_SEC) * Math.PI * 2);
  const dolly = 1 + DIRECTOR_FOCUS_ORBIT_DOLLY_AMPLITUDE * breath;
  const base = orbit.baseOffset;
  const rotatedX = (base.x * cos - base.z * sin) * dolly;
  const rotatedZ = (base.x * sin + base.z * cos) * dolly;
  const liftedY = base.y * (1 + DIRECTOR_FOCUS_ORBIT_RISE_AMPLITUDE * breath);
  camera.position.set(
    orbit.center.x + rotatedX,
    orbit.center.y + liftedY,
    orbit.center.z + rotatedZ,
  );
  if (controls) {
    controls.target.copy(orbit.center);
    controls.update();
  }
}

/**
 * Shared Director acquire/restore camera FSM (ITEM #C P1 de-dup, 2026-06-04).
 *
 * The acquire→hold→restore decision used to be duplicated verbatim in the
 * artifact-lane `useDirectorCameraFocus` hook and the live-lane `SceneContent`
 * effect — a must-change-in-lockstep copy the architecture audit flagged. Both
 * now call this one function so the focus framing, snapshot-once, reduced-motion,
 * and restore semantics live in a single place. The caller is responsible for the
 * `!command` / already-handled / `effectiveCinematicMode !== 'director'` guards
 * (they gate the effect itself); this only runs the acquire/restore body. The
 * per-consumer tween-application useFrame is intentionally NOT shared — the live
 * lane interleaves it with the camera-preset tween — so this returns only the FSM
 * decision via the shared refs + `onTransition` for preset-telemetry mirroring.
 */
function applyDirectorFocusCommand(ctx: {
  readonly command: NonNullable<RuntimeConfig['directorFocusCommand']>;
  readonly camera: THREE.Camera;
  readonly controls: OrbitControlsImpl | null;
  readonly sceneFrame: NormalizedSceneFrame;
  readonly alpha: number;
  readonly reducedMotion: boolean;
  readonly nowMs: number;
  readonly lastCommandAtRef: MutableRefObject<number | null>;
  readonly snapshotRef: DirectorSnapshotRef;
  readonly tweenRef: CameraTweenRef;
  readonly orbitRef?: DirectorFocusOrbitRef;
  readonly onTransition?: (transition: DirectorFocusTransition) => void;
}): void {
  const {
    command, camera, controls, sceneFrame, alpha, reducedMotion, nowMs,
    lastCommandAtRef, snapshotRef, tweenRef, orbitRef, onTransition,
  } = ctx;

  // CQ1: any new acquire/restore command supersedes a running focus orbit — the
  // acquire/restore tween now owns the camera until it lands (and re-establishes
  // the orbit on completion). Clearing here covers re-target-while-focused too.
  if (orbitRef) orbitRef.current = null;

  if (command.phase === 'acquiring') {
    const ueWorldPos = sceneFrame.ues[0]?.worldPos;
    if (!ueWorldPos) {
      return;
    }
    lastCommandAtRef.current = command.issuedAtMs;
    // Snapshot ONCE per focus cycle: re-targeting (acquiring again while already
    // focused) must preserve the original pre-focus overview pose so `restoring`
    // returns there, not to the current focused pose.
    if (snapshotRef.current === null) {
      snapshotRef.current = {
        position: camera.position.clone(),
        target: controls?.target.clone() ?? new THREE.Vector3(),
      };
    }
    if (controls) controls.enabled = false;

    const framing = command.framing
      ? {
          fromSatWorldPos: lookupSatWorldPos(sceneFrame.satellites, command.framing.fromSatId),
          toSatWorldPos: lookupSatWorldPos(sceneFrame.satellites, command.framing.toSatId),
        }
      : undefined;
    const pose = resolveDirectorFocusPose(ueWorldPos, alpha, command.kind, framing);
    if (reducedMotion) {
      camera.position.copy(pose.position);
      controls?.target.copy(pose.target);
      controls?.update();
      tweenRef.current = null;
      onTransition?.('acquire-applied');
    } else {
      tweenRef.current = {
        preset: null,
        kind: 'director-acquire',
        startedAtMs: nowMs,
        fromPosition: camera.position.clone(),
        fromTarget: controls?.target.clone() ?? new THREE.Vector3(),
        toPosition: pose.position,
        toTarget: pose.target,
      };
      onTransition?.('acquire-tween');
    }
    return;
  }

  lastCommandAtRef.current = command.issuedAtMs;
  const snapshot = snapshotRef.current;
  const toPosition = snapshot?.position.clone() ?? camera.position.clone();
  const toTarget = snapshot?.target.clone() ?? (controls?.target.clone() ?? new THREE.Vector3());

  if (reducedMotion) {
    camera.position.copy(toPosition);
    controls?.target.copy(toTarget);
    if (controls) controls.enabled = true;
    controls?.update();
    snapshotRef.current = null;
    tweenRef.current = null;
    onTransition?.('restore-applied');
  } else {
    tweenRef.current = {
      preset: null,
      kind: 'director-restore',
      startedAtMs: nowMs,
      fromPosition: camera.position.clone(),
      fromTarget: controls?.target.clone() ?? new THREE.Vector3(),
      toPosition,
      toTarget,
    };
    onTransition?.('restore-tween');
  }
}

/**
 * Shared force-restore: snap the camera back to the pre-focus snapshot when a lane
 * stops being director mid-focus (inertness guarantee). Caller gates on
 * `effectiveCinematicMode !== 'director'`; this no-ops when no snapshot is held and
 * otherwise restores + clears the refs, calling `onRestored` (live lane uses it to
 * reset its camera-transition telemetry).
 */
function forceRestoreDirectorFocus(ctx: {
  readonly camera: THREE.Camera;
  readonly controls: OrbitControlsImpl | null;
  readonly snapshotRef: DirectorSnapshotRef;
  readonly tweenRef: CameraTweenRef;
  readonly orbitRef?: DirectorFocusOrbitRef;
  readonly onRestored?: () => void;
}): void {
  const { camera, controls, snapshotRef, tweenRef, orbitRef, onRestored } = ctx;
  if (orbitRef) orbitRef.current = null;
  if (snapshotRef.current === null) return;
  if (controls) {
    camera.position.copy(snapshotRef.current.position);
    controls.target.copy(snapshotRef.current.target);
    controls.enabled = true;
    controls.update();
  }
  snapshotRef.current = null;
  tweenRef.current = null;
  onRestored?.();
}

/**
 * Director camera focus FSM (acquire → hold → restore) over the shared
 * OrbitControls camera, for ArtifactSceneContent (which has no camera-preset tween
 * machinery). The acquire/restore decision is shared with the live SceneContent
 * effect via applyDirectorFocusCommand / forceRestoreDirectorFocus above; this
 * hook only owns the wiring (refs + the director tween-application useFrame).
 * Consumes a real handover focus command; inert unless
 * effectiveCinematicMode === 'director' (Rule#8).
 */
function useDirectorCameraFocus(params: {
  readonly controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  readonly sceneFrame: NormalizedSceneFrame;
  readonly directorFocusCommand: RuntimeConfig['directorFocusCommand'];
  readonly reducedMotion: boolean;
  readonly effectiveCinematicMode: RuntimeConfig['cinematicMode'];
  readonly alpha: number;
}): void {
  const { controlsRef, sceneFrame, directorFocusCommand, reducedMotion, effectiveCinematicMode, alpha } = params;
  const camera = useThree(state => state.camera);
  const cameraTweenRef = useRef<CameraTweenState | null>(null);
  const directorSnapshotRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const directorFocusOrbitRef = useRef<DirectorFocusOrbitState | null>(null);
  const lastDirectorCommandAtRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const command = directorFocusCommand;
    if (!command || lastDirectorCommandAtRef.current === command.issuedAtMs) return;
    // Inert on lanes the render plan did not mark as director.
    if (effectiveCinematicMode !== 'director') {
      lastDirectorCommandAtRef.current = command.issuedAtMs;
      return;
    }
    applyDirectorFocusCommand({
      command,
      camera,
      controls: controlsRef.current,
      sceneFrame,
      alpha,
      reducedMotion,
      nowMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
      lastCommandAtRef: lastDirectorCommandAtRef,
      snapshotRef: directorSnapshotRef,
      tweenRef: cameraTweenRef,
      orbitRef: directorFocusOrbitRef,
    });
  }, [camera, controlsRef, directorFocusCommand, reducedMotion, effectiveCinematicMode, sceneFrame.ues, alpha]);

  // Force-restore if the lane stops being director mid-focus (inertness guarantee).
  useEffect(() => {
    if (effectiveCinematicMode === 'director') return;
    forceRestoreDirectorFocus({
      camera,
      controls: controlsRef.current,
      snapshotRef: directorSnapshotRef,
      tweenRef: cameraTweenRef,
      orbitRef: directorFocusOrbitRef,
    });
  }, [camera, controlsRef, effectiveCinematicMode]);

  useFrame(() => {
    const tween = cameraTweenRef.current;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    if (!tween) {
      // CQ1: between acquire-land and restore, gently orbit the focus subject.
      const orbit = directorFocusOrbitRef.current;
      if (orbit && !reducedMotion) {
        advanceDirectorFocusOrbit({ camera, controls: controlsRef.current, orbit, nowMs });
      }
      return;
    }
    const progress = Math.min(Math.max(
      (nowMs - tween.startedAtMs) / (tween.durationMs ?? CAMERA_TWEEN_DURATION_MS),
      0,
    ), 1);
    const eased = easeInOutCubic(progress);
    const controls = controlsRef.current;

    camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
    if (controls) {
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      controls.update();
    }

    if (progress >= 1) {
      camera.position.copy(tween.toPosition);
      controls?.target.copy(tween.toTarget);
      controls?.update();
      cameraTweenRef.current = null;
      if (tween.kind === 'director-restore') {
        if (controls) controls.enabled = true;
        directorSnapshotRef.current = null;
        directorFocusOrbitRef.current = null;
      } else if (tween.kind === 'director-acquire' && !reducedMotion && controls) {
        // CQ1: start the continuous focus orbit from the landed acquire pose.
        directorFocusOrbitRef.current = {
          center: controls.target.clone(),
          baseOffset: camera.position.clone().sub(controls.target),
          startedAtMs: nowMs,
        };
      }
    }
  });
}

function formatCameraVector(vector: THREE.Vector3): string {
  return [vector.x, vector.y, vector.z].map(value => value.toFixed(2)).join(',');
}

function formatScenePosition(position: readonly [number, number, number] | undefined): string {
  return position ? position.map(value => value.toFixed(2)).join(',') : '';
}

function ArtifactSceneContent({
  runtime,
  visualScaleMultipliers,
  sceneLane,
  sceneFrame,
  presentationPlan,
  campusVisible,
  handoverSurfaceBindingsRef,
  instructorHandoverSnapshotRef,
  studentHandoverActivityStateRef,
}: ArtifactSceneContentProps) {
  const handoverSurfaceBindings = handoverSurfaceBindingsRef.current;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const sceneConfig = useMemo(() => (
    runtime.appMode === 'sinr-experiment' ? NTPU_CONFIG : NTPU_LARGE_CONFIG
  ), [runtime.appMode]);
  const alpha = sceneConfig.visualAlpha;
  // Director cinematic on the artifact-replay lane: resolve effectiveCinematicMode
  // through the same lane plan as the live path (single source of truth). Only
  // effectiveCinematicMode is consumed here, so the live-only inputs use inert
  // defaults (paused/recentHoActive do not affect it).
  const effectiveCinematicMode = resolveSceneLaneRenderPlan({
    sceneLane,
    sceneSource: sceneFrame.sceneSource,
    beamCalloutsEnabled: false,
    beamDensity: runtime.beamDensity,
    cinematicMode: runtime.cinematicMode,
    effectsEnabled: runtime.effectsEnabled,
    paused: true,
    reducedMotion: runtime.reducedMotion,
    recentHoActive: false,
  }).effectiveCinematicMode;
  useDirectorCameraFocus({
    controlsRef,
    sceneFrame,
    directorFocusCommand: runtime.directorFocusCommand,
    reducedMotion: runtime.reducedMotion,
    effectiveCinematicMode,
    alpha,
  });
  const ueMarkerShape = resolveSceneLaneUeMarkerShape(sceneLane);
  const visibleSatellites = useMemo(
    () => sceneFrame.satellites.filter(satellite => satellite.visible),
    [sceneFrame.satellites],
  );
  const storyFrames = resolveBoundSceneHandoverStoryFrameSet({
    lane: 'artifact-replay',
    localPresentation: null,
    sharedBindings: handoverSurfaceBindings,
  });
  const sceneRenderPlan = resolveSceneRenderPlan({
    lane: 'artifact-replay',
    presentation: presentationPlan,
    storyFrames,
    corePlan: null,
    controls: {
      campusVisible,
      showHorizonBoundary: false,
      showUav: false,
      afterFirstPaint: true,
      showOrbitTrail: false,
      showSpineParticles: false,
      showGroundRipple: false,
      showLiveSatelliteMarkers: false,
      showSinrLiveCellBeams: false,
      showLiveSceneEffects: false,
      showSceneOverlays: false,
      showHandoverToastOverlay: false,
      homepageVisualIdentity: false,
      showFpsCounter: true,
      cinematicSpotlightActive: false,
      narrativeCaptionEnabled: false,
    },
    story: {
      suppressNaturalHandoverLayers: false,
      hideTimelineEffects: false,
      concurrentIntraVisualSuppressed: false,
      multiCandidateSceneLayerVisible: false,
      candidateComparisonSceneActive: false,
      multiCandidateCentralOverlayActive: false,
      multiCandidateIdentityTransitionActive: false,
      acceptedCueHasTransition: false,
      handoverEventCueDrawable: false,
      handoverPresentationActive: false,
      handoverPresentationHasEvent: false,
      manualHandoverPresentationActive: false,
      manualHandoverHasEvent: false,
    },
    inventory: {
      visibleSatelliteCount: visibleSatellites.length,
      visibleUeCount: sceneFrame.ues.filter(ue => ue.worldPos !== undefined).length,
      narrativeCaptionPresent: false,
    },
  });
  return (
    <BaseSceneLayout
      sceneConfig={sceneConfig}
      controlsRef={controlsRef}
      campusVisible={sceneRenderPlan.surfaces['ground.campus'].visible}
    >
      {sceneRenderPlan.surfaces['ground.teaching-floor'].mounted && <TeachingFloor />}
      <ScenePresentationCanvasTelemetry plan={presentationPlan} />
      <SceneRenderPlanCanvasTelemetry plan={sceneRenderPlan} />
      <SceneHandoverStoryCanvasTelemetry
        frameSet={storyFrames}
        lane="artifact-replay"
        sharedBindingsRef={handoverSurfaceBindingsRef}
        instructorTransportRef={instructorHandoverSnapshotRef}
        studentActivityStateRef={studentHandoverActivityStateRef}
      />
      <SceneTelemetry
        visibleSatelliteCount={visibleSatellites.length}
        firstSatellitePosition={formatScenePosition(visibleSatellites[0]?.worldPos)}
        servingSatelliteId={sceneFrame.metrics.servingSatelliteId}
        servingBeamId={sceneFrame.metrics.servingBeamId}
        beamCalloutsEnabled="0"
        simTimeSec={sceneFrame.tSec}
        appMode={runtime.appMode}
        sceneLaneSourceCompatible={
          isSceneLaneSourceCompatible({ sceneLane, sceneSource: sceneFrame.sceneSource }) ? '1' : '0'
        }
        liveSimulationEnabled="0"
        ueMarkerShape={ueMarkerShape}
        uavVisible="0"
        uePrimaryAnchorMode={runtime.uePrimaryAnchorMode ?? 'observer'}
        firstUePosition={formatScenePosition(sceneFrame.ues[0]?.worldPos)}
        otherHandoverFilterEnabled="0"
        otherHandoverPendingUeCount={0}
        otherHandoverSelectedUeCount={0}
        otherHandoverCueUeCount={0}
        otherHandoverSelectedUeIds=""
        renderedUeCount={sceneFrame.ues.filter(u => u.worldPos !== undefined).length}
        beamLoadContentionUeCount={0}
        visualSatelliteAltitude={String(sceneFrame.geometry.visualSatelliteAltitude ?? '')}
        beamSatelliteCount="0"
        sceneSource={sceneFrame.sceneSource}
        beamConeCount="0"
        cellOverlaySlotIndex=""
        cellOverlayActiveCount=""
        cellOverlayIdleCount=""
        cellOverlayCellCount=""
        cellServingCount=""
        cellVisibleCount=""
        cellHoReassignmentCount=""
        cellHoInterCount=""
        cellHoIntraCount=""
        cellBeamConeCount=""
        cellBeamConeScope=""
        cellBeamConeSatelliteCount=""
        sinrLiveCellBeamConeCount=""
        sinrLiveCellServingSatCount=""
        sinrLiveCellServedCount=""
        sinrLiveCellUeOffAxisMaxDeg=""
        sinrLiveHandoverPulseConeCount=""
        multiCandidateAuthorityActive="0"
        multiCandidateDecisionPhase=""
        multiCandidateRenderedPairCount="0"
        multiCandidateSceneGlobalSolidDataLinkCount="0"
        multiCandidateCarrierFallbackActive="0"
        multiCandidateEventCueCount="0"
        multiCandidateSceneRenderStatus="inactive"
        handoverPresentationActive="0"
        handoverPresentationSource=""
        handoverPresentationKind=""
        handoverPresentationPhase=""
        handoverAutoSlowActive="0"
        handoverDisplayIsolationActive="0"
        beamBudgetGlobal=""
        beamBudgetServing=""
        beamBudgetCandidate=""
        beamHoppingEnabled="0"
        handoverStoryLayer="artifact-owned"
        handoverStoryVisible="0"
        handoverStorySource=""
        handoverStoryNotBaselineProof="0"
        handoverStoryEventCount={0}
        handoverStoryAggregateEventCount={0}
        handoverStoryActiveCount={0}
        handoverStoryInactiveCount={0}
        handoverStoryNextCount={0}
        controlsRef={controlsRef}
        shouldClearReplayAttributes={true}
      />
      {sceneRenderPlan.surfaces['ground.ues'].mounted && (
        <GroundScene
          ues={sceneFrame.ues
            .filter((u) => u.worldPos !== undefined)
            .map((u) => {
              return {
                id: u.id,
                worldPos: u.worldPos as readonly [number, number, number],
              };
            })}
          ueMarkerMultiplier={visualScaleMultipliers.ueMarkerMultiplier}
          markerShape={ueMarkerShape}
        />
      )}
      {sceneRenderPlan.surfaces['satellite.markers'].mounted && visibleSatellites.map((satellite) => {
        const eventRole = sceneFrame.eventRoles.bySatId.get(satellite.id);
        return (
          <SatelliteMarker
            key={satellite.id}
            position={new THREE.Vector3(...satellite.worldPos)}
            label={formatSatelliteLabel(satellite.id)}
            eventRole={eventRole === 'inactive' ? undefined : eventRole}
            // The replay marker is the SAME surface as the live marker, so it
            // asks the same table the same question. It used to call
            // `satelliteTint`, a 4-colour hash unrelated to the identity ladder,
            // and therefore drew this spacecraft a different colour than the
            // live lane drew it.
            satelliteTintColor={resolveSatelliteSurfaceColor(satellite.id, 'marker')}
            constellation={DEFAULT_SATELLITE_CONSTELLATION}
          />
        );
      })}
      {sceneRenderPlan.surfaces['diagnostics.fps'].mounted && <FPSCounter />}
    </BaseSceneLayout>
  );
}

/** Live-orbit source wrapper. It is not mounted while archived TLE owns the scene. */
function SceneContent(props: SceneContentProps) {
  const {
    profile,
    speed,
    paused,
    runtime,
    visualScaleMultipliers,
    sceneLane,
    homepageVisualIdentity,
    onLiveSeekLanded,
  } = props;
  const [liveSeekLandedKey, setLiveSeekLandedKey] = useState<string | null>(null);
  const handleLiveSeekLanded = useCallback((seekRequestKey: string) => {
    setLiveSeekLandedKey(seekRequestKey);
    onLiveSeekLanded?.(seekRequestKey);
  }, [onLiveSeekLanded]);
  const sceneConfig = useMemo(() => (
    runtime.appMode === 'sinr-experiment' ? NTPU_CONFIG : NTPU_LARGE_CONFIG
  ), [runtime.appMode]);
  const paperUserArea = useMemo(
    () => resolveInscribedPaperUserArea(sceneConfig),
    [sceneConfig],
  );
  const useEarthFixedCellTruth = sceneLane === 'sinr-live';
  const sim = useSimulation(
    profile,
    runtime.replay,
    speed,
    paused,
    runtime.signalResetKey,
    runtime.handoverResetKey,
    visualScaleMultipliers.beamFootprintMultiplier,
    runtime.ueCount,
    runtime.ueDistributionMode,
    runtime.uePrimaryAnchorMode,
    runtime.ueMobilityMode,
    runtime.ueMobilityParams,
    runtime.ueDistributionScope,
    runtime.ueDistributionRadiusKm,
    paperUserArea.kmPerWorldUnit,
    useEarthFixedCellTruth,
    handleLiveSeekLanded,
    runtime.primaryJogEastKm ?? 0,
    runtime.primaryJogNorthKm ?? 0,
    runtime.beamCountBySatellite,
    runtime.servingBeamCount,
    runtime.candidateBeamCount,
    runtime.beamHoppingEnabled ?? false,
    sceneLane === 'sinr-live' ? 'sampled-steering' : 'earth-fixed-cell',
    runtime.focusCellId ?? null,
    shouldEnableHomepageMultiCandidateAuthority(sceneLane),
    runtime.eeThresholdKbitPerJoule,
    shouldSuppressLegacyPrimaryHandover(sceneLane, homepageVisualIdentity),
  );

  return <SceneRenderContent {...props} sim={sim} simSource="live" liveSeekLandedKey={liveSeekLandedKey} />;
}

interface ArchivedTleSceneContentProps extends SceneContentProps {
  readonly frame: SimulationAnalysisFrame | null;
  readonly nextFrame: SimulationAnalysisFrame | null;
  readonly visualOffsetSec: number;
  readonly errorMessage: string | null;
}

/**
 * Archived-TLE source wrapper for the exact same scene renderer used by the
 * original live homepage. Only the `SimFrame` producer changes here.
 */
function ArchivedTleSceneContent({
  frame,
  nextFrame,
  visualOffsetSec,
  errorMessage,
  ...renderProps
}: ArchivedTleSceneContentProps) {
  const sceneConfig = useMemo(() => (
    renderProps.runtime.appMode === 'sinr-experiment' ? NTPU_CONFIG : NTPU_LARGE_CONFIG
  ), [renderProps.runtime.appMode]);
  const paperUserArea = useMemo(
    () => resolveInscribedPaperUserArea(sceneConfig),
    [sceneConfig],
  );
  const archivedTlePlacement = useMemo<ArchivedTleSevenCellPlacement | null>(() => {
    if (frame === null) return null;
    const layout = buildSinrLiveCellLayout(
      renderProps.profile,
      SINR_LIVE_ARCHIVED_DISPLAY_CELL_COUNT,
    );
    return buildArchivedTleSevenCellPlacement({
      cells: frame.scenario.cells,
      sourceCellRadiusKm: layout.cellRadiusKm,
      // The 200 x 90 km paper rectangle is an inscribed analysis area. The
      // renderer's ground mesh is larger, so fit the compact teaching cluster
      // against the actual configured scene bounds converted to the same km
      // scale. Keeping this mapping at fitScale=1 preserves the prototype-like
      // spacing while still proving the selected footprints fit the scene.
      boundsKm: {
        widthKm: sceneConfig.scene.measuredBoundsWu.width
          * sceneConfig.scene.scale
          * paperUserArea.kmPerWorldUnit,
        heightKm: sceneConfig.scene.measuredBoundsWu.depth
          * sceneConfig.scene.scale
          * paperUserArea.kmPerWorldUnit,
      },
    });
  }, [
    frame?.scenario.cells,
    paperUserArea.kmPerWorldUnit,
    renderProps.profile,
    sceneConfig.scene.measuredBoundsWu.depth,
    sceneConfig.scene.measuredBoundsWu.width,
    sceneConfig.scene.scale,
  ]);
  const sim = useMemo(
    () => frame === null
      ? null
      : adaptSimulationAnalysisFrameToArchivedTleSimFrame(frame, {
        nextFrame,
        visualOffsetSec,
        worldUnitsPerKm: 1 / paperUserArea.kmPerWorldUnit,
        displayPlacement: archivedTlePlacement ?? undefined,
      }),
    [archivedTlePlacement, frame, nextFrame, paperUserArea.kmPerWorldUnit, visualOffsetSec],
  );

  if (frame === null || sim === null) {
    return (
      <Html center>
        <div
          role={errorMessage === null ? 'status' : 'alert'}
          data-testid={errorMessage === null ? 'archived-tle-scene-loading' : 'archived-tle-scene-error'}
          style={{
            color: 'white',
            fontSize: 18,
            minWidth: 240,
            maxWidth: 520,
            lineHeight: 1.4,
            textAlign: 'center',
            whiteSpace: errorMessage === null ? 'nowrap' : 'normal',
          }}
        >
          {errorMessage === null ? 'TLE 場景計算中' : `TLE 場景無法載入：${errorMessage}`}
        </div>
      </Html>
    );
  }

  return (
    <SceneRenderContent
      {...renderProps}
      sim={sim}
      simSource="archived-tle"
      canonicalHandoverTttSec={frame.handover?.tttSec}
      canonicalHandoverEvent={frame.handover}
      archivedTleFrameIdentity={frame}
      canonicalScenario={frame.scenario}
      canonicalCandidateSatelliteId={frame.tleState.candidateSatellite?.satelliteId ?? null}
      archivedTlePlacement={archivedTlePlacement ?? undefined}
      constellation={frame.provenance.constellation}
    />
  );
}

function SceneRenderContent({
  profile,
  speed,
  paused,
  runtime,
  visualScaleMultipliers,
  sceneLane,
  homepageVisualIdentity = false,
  homepageSatelliteNameById = null,
  homepageBeamMetrics = null,
  onSimUpdate,
  acceptedHandoverPresentation,
  handoverSurfaceBindingsRef,
  instructorHandoverSnapshotRef,
  studentHandoverActivityStateRef,
  sceneFrame: propSceneFrame,
  beamDisplaySpec = DEFAULT_BEAM_DISPLAY_SPEC,
  showSceneOverlays = true,
  handoverCinemaCandidate = null,
  handoverCinemaArmed = false,
  handoverCinemaKind = null,
  onHandoverPresentationChange,
  onHandoverPresentationBusyChange,
  sim,
  simSource,
  canonicalScenario,
  canonicalCandidateSatelliteId,
  archivedTlePlacement,
  canonicalHandoverTttSec,
  canonicalHandoverEvent,
  archivedTleFrameIdentity,
  liveSeekLandedKey = null,
  constellation = DEFAULT_SATELLITE_CONSTELLATION,
  presentationPlan,
  campusVisible,
  teachingSurfaceProjectionRef,
  focusedJoinKey = null,
  onFocusJoinKeyChange,
  teachingNarrativeEnabled = false,
}: SceneRenderContentProps) {
  const handoverSurfaceBindings = handoverSurfaceBindingsRef.current;
  const teachingSurfaceProjection = teachingSurfaceProjectionRef?.current ?? null;
  const homepageBeamEeByKey = useMemo<ReadonlyMap<string, number | null> | null>(() => {
    if (!homepageVisualIdentity || homepageBeamMetrics === null) return null;
    return homepageBeamEeNormalizedByKey(homepageBeamMetrics.metrics);
  }, [homepageBeamMetrics, homepageVisualIdentity]);
  const homepageBeamEeBitsPerJouleByKey = useMemo<ReadonlyMap<string, number | null> | null>(() => {
    if (!homepageVisualIdentity || homepageBeamMetrics === null) return null;
    return new Map(
      homepageBeamMetrics.metrics.map(metric => [
        homepageBeamEeKey(metric.satelliteId, metric.beamId),
        metric.energyEfficiencyBitsPerJoule,
      ] as const),
    );
  }, [homepageBeamMetrics, homepageVisualIdentity]);
  const homepageSatelliteEeProgressById = useMemo<ReadonlyMap<string, number | null> | null>(() => {
    if (!homepageVisualIdentity || homepageBeamMetrics === null) return null;
    return homepageSatelliteEeProgressByIdFromMetrics(homepageBeamMetrics.metrics);
  }, [homepageBeamMetrics, homepageVisualIdentity]);
  const homepageIdentityPaletteIndexBySatelliteId = useMemo<ReadonlyMap<string, number | null> | null>(() => {
    if (!homepageVisualIdentity || acceptedHandoverPresentation === null) return null;
    return new Map(
      Object.entries(acceptedHandoverPresentation.plan.identityAllocation.assignments).map(([satelliteId, identity]) => [
        satelliteId,
        identity.paletteIndex,
      ] as const),
    );
  }, [acceptedHandoverPresentation, homepageVisualIdentity]);
  const camera = useThree(state => state.camera);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraPresetRef = useRef<string | null>('manual');
  const cameraTransitionRef = useRef<'idle' | 'animating'>('idle');
  const cameraTweenRef = useRef<CameraTweenState | null>(null);
  const lastCameraCommandAtRef = useRef<number | null>(null);
  const lastCameraPresetRef = useRef<CameraPreset | null>(null);
  const lastDirectorCommandAtRef = useRef<number | null>(null);
  const directorSnapshotRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const directorFocusOrbitRef = useRef<DirectorFocusOrbitState | null>(null);
  const sceneConfig = useMemo(() => (
    runtime.appMode === 'sinr-experiment' ? NTPU_CONFIG : NTPU_LARGE_CONFIG
  ), [runtime.appMode]);
  const paperUserArea = useMemo(
    () => resolveInscribedPaperUserArea(sceneConfig),
    [sceneConfig],
  );
  const handoverTriggerTimeSec = canonicalHandoverTttSec
    ?? profile.handover.triggerTimeSec;
  const useEarthFixedCellTruth = sceneLane === 'sinr-live';
  const ueTrailHistory = useUeTrailHistory({
    enabled: simSource === 'live'
      && runtime.enableUeTrails === true
      && propSceneFrame === undefined,
    perUePositions: sim.perUePositions,
    resetKey: runtime.signalResetKey,
  });
  const latchedBeamSinrByKeyRef = useRef<Map<string, number>>(new Map());
  const alpha = sceneConfig.visualAlpha;

  const cameraPresets = useMemo(() => ({
    zenith: {
      position: [0, 980 * alpha, 1] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
    },
    oblique: {
      // Keep the live default pulled back after the display-only satellite
      // altitude increase; NTPU_CONFIG has visualAlpha < 1, so use a larger
      // base pose rather than letting alpha return to the old close-up.
      position: [0, 1400 * alpha, 1850 * alpha] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
    },
    chase: {
      position: [520 * alpha, 260 * alpha, -620 * alpha] as [number, number, number],
      target: [0, 20 * alpha, 0] as [number, number, number],
    },
    'paper-faithful-closeup': {
      position: [0, 320 * alpha, 380 * alpha] as [number, number, number],
      target: [0, 80 * alpha, 0] as [number, number, number],
    },
  }), [alpha]);

  const applyCameraPose = (preset: CameraPreset, transition: 'idle' | 'animating') => {
    const presetPose = cameraPresets[preset];
    const controls = controlsRef.current;
    camera.position.set(...presetPose.position);
    controls?.target.set(...presetPose.target);
    controls?.update();
    cameraPresetRef.current = preset;
    cameraTransitionRef.current = transition;
  };
  // P1c §A / SDD §3 Q7 C4 / D9: derive `SceneGeometry` from the live profile
  // so downstream code (deriveLiveSceneFields, P1d migrations) consumes the
  // shell-level constants through the same interface as the replay path.
  // `useBeamViz` reads `Profile` directly today; threading geometry here makes
  // the type available for the gradual migration.
  const sceneGeometry = useMemo(
    () => {
      if (propSceneFrame) {
        return propSceneFrame.geometry;
      }
      return sceneGeometryFromProfile({
        shell: { altitudeKm: profile.orbit.shells[0]?.altitudeKm },
        antenna: { beamwidth3dBRad: profile.antenna.beamwidth3dBRad },
        handover: { triggerTimeSec: handoverTriggerTimeSec },
        orbit: {
          shells: profile.orbit.shells.map(s => ({ id: s.id, altitudeKm: s.altitudeKm })),
        },
        beams: { frequencyReuse: profile.beams.frequencyReuse },
        visualAlpha: sceneConfig.visualAlpha,
        visualSatelliteAltitude: sceneConfig.visualSatelliteAltitude,
        kmPerWorldUnit: paperUserArea.kmPerWorldUnit,
      });
    },
    [
      propSceneFrame,
      profile.orbit.shells,
      profile.antenna.beamwidth3dBRad,
      handoverTriggerTimeSec,
      profile.beams.frequencyReuse,
      sceneConfig,
      paperUserArea.kmPerWorldUnit,
    ],
  );
  // P1d: project the live SimFrame → NormalizedSceneFrame at the boundary.
  // useBeamViz now consumes only (frame, geometry) — sim/profile stay
  // confined to MainScene.
  const sceneFrameInput = useMemo<SceneFrameResolutionInput>(
    () => ({
      archivedTleFrameIdentity,
      propSceneFrame,
      sceneGeometry,
      sim,
      simSource,
    }),
    [archivedTleFrameIdentity, propSceneFrame, sceneGeometry, sim, simSource],
  );
  const { sceneFrame } = useSceneFrame({ sceneFrameInput });
  const naturalHandoverProtagonistUeId = resolveNaturalHandoverProtagonistId({
    simSource,
    canonicalPrimaryUeId: sim.sinrLiveCells?.primaryUeId,
    sceneFrameFirstUeId: sceneFrame.ues[0]?.id,
  });
  const selectedOtherHandoverUeIds = useMemo(
    () => new Set(selectOtherHandoverUeIds({
      ues: sim.perUePositions ?? [],
      primaryUeId: sceneFrame.ues[0]?.id,
      triggerTimeSec: handoverTriggerTimeSec,
      maxOtherHandoverUes: sceneConfig.maxOtherHandoverUes,
    })),
    [
      handoverTriggerTimeSec,
      sceneConfig.maxOtherHandoverUes,
      sceneFrame.ues,
      sim.perUePositions,
    ],
  );
  const displayedUes = useMemo(
    () => resolveDisplayedOtherHandoverUes(
      sceneFrame.ues,
      sceneFrame.ues[0]?.id,
      beamDisplaySpec.showOtherHandoverUes,
      selectedOtherHandoverUeIds,
    ),
    [beamDisplaySpec.showOtherHandoverUes, sceneFrame.ues, selectedOtherHandoverUeIds],
  );
  const pendingOtherHandoverUeCount = useMemo(
    () => (sim.perUePositions ?? []).filter(ue => ue.pendingTargetSatId !== null).length,
    [sim.perUePositions],
  );
  // P1c §E: live-default display caps per SDD §13 Cat A. Replay path will
  // wire mode-appropriate defaults (default 4 sats / 4 beams / 4 events for
  // the trigger artifact's 4-satellite constellation).
  const viz = useBeamViz(
    sceneFrame,
    sceneGeometry,
    runtime,
    latchedBeamSinrByKeyRef.current,
    undefined,
    profile.beamHopping,
    visualScaleMultipliers,
    // S5-2 PHASE A: cones un-parked → retire the UE-anchor on the LIVE SINR-scene
    // lane (true = anchor OFF) so beams keep true earth-fixed positions and UEs
    // render off-centre.
    sceneLane === 'sinr-live',
  );
  const worldUnitsPerKm = 1 / (sceneGeometry.kmPerWorldUnit ?? paperUserArea.kmPerWorldUnit);
  // The physical projection is nearly circular for the high-elevation hero link
  // (e.g. 81° gives only a 1.02 axis ratio). Legacy `/` is the teaching surface,
  // so exaggerate only the displayed tilt while keeping the model's real axis/theta
  // and power recurrence untouched. `/simulator` stays physical.
  const sinrLiveEllipseTiltExaggeration = resolveSinrLiveEllipseTiltExaggeration(sceneLane);
  // S-cells-3: ground placements of the FIXED earth-fixed cells for the cell-truth
  // beam cones. Built from the SAME `buildSinrLiveCellLayout(profile)` the runtime
  // cell truth uses (so cellIds match `sim.sinrLiveCells`) and the SAME
  // `worldUnitsPerKm` the UE markers use (east → +X, north → −Z), so a cone base
  // and its UEs share one frame. Empty off the sinr-live lane.
  const sinrLiveCellPlacementById = useMemo(() => resolveSinrLiveCellPlacementById({
    enabled: useEarthFixedCellTruth,
    hasCanonicalScenario: canonicalScenario !== undefined,
    archivedTlePlacement,
    profile,
    servingBeamCount: runtime.servingBeamCount,
    worldUnitsPerKm,
  }), [
    archivedTlePlacement,
    canonicalScenario,
    profile,
    runtime.servingBeamCount,
    useEarthFixedCellTruth,
    worldUnitsPerKm,
  ]);
  const recentHoActive =
    sim.recentHoSourceSatId !== null
    || sim.recentHoTargetSatId !== null;
  const renderPlan = resolveSceneLaneRenderPlan({
    sceneLane,
    sceneSource: sceneFrame.sceneSource,
    beamCalloutsEnabled: beamDisplaySpec.beamCalloutsEnabled,
    beamDensity: runtime.beamDensity,
    cinematicMode: runtime.cinematicMode,
    effectsEnabled: runtime.effectsEnabled,
    paused,
    reducedMotion: runtime.reducedMotion,
    recentHoActive,
  });
  const {
    showLiveSceneEffects,
    showUav,
    showLiveBeamCones,
    showLiveSatelliteMarkers,
    showBeamCallouts,
    showSpineParticles,
    showOrbitTrail,
    showGroundRipple,
    showHandoverToastOverlay,
    handoverStoryLayerPolicy,
    showCinematicSpotlight,
    showSinrServingMosaic,
    showSinrLiveCellBeams,
    showSinrLiveHandoverPulse,
    effectiveCinematicMode,
    showArtifactFpsCounter,
  } = renderPlan;
  // L5 (startup-perf SDD): flips true one rAF after the first commit — i.e. after the
  // first paint. Gates deferred mounts of decorative, heavy GLB models (the 9.9 MB
  // uav.glb) so their fetch + main-thread parse runs OFF the first-paint critical
  // path. Re-arms on remount (lane change). The model's own <Suspense fallback={null}>
  // keeps the one-frame-later pop-in seamless.
  const [afterFirstPaint, setAfterFirstPaint] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAfterFirstPaint(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  // WHICH SOURCE colours the UE markers -> resolveSinrServingUeColorMap in
  // sinrServingMosaic.ts, which owns both the cell-truth-vs-steered choice and
  // the per-UE colours it produces. The lane gate stays here.
  const sinrServingColorById = useMemo(
    () => resolveSinrServingUeColorMap({
      enabled: showSinrServingMosaic,
      cellFrame: sim.sinrLiveCells,
      sceneUes: sceneFrame.ues,
    }),
    [showSinrServingMosaic, sim.sinrLiveCells, sceneFrame.ues],
  );
  const sinrServingTelemetryActive = showSinrServingMosaic;
  const ueMarkerShape = resolveSceneLaneUeMarkerShape(sceneLane);
  const multiCandidateEpisodeId = acceptedHandoverPresentation?.episodeId
    ?? sim.handoverDecisionFrame?.episodeId
    ?? 'inactive';
  const candidateInspectionSnapshot = useMemo<CandidateInspectionSnapshotInput | null>(
    () => acceptedHandoverPresentation === null
      ? null
      : {
        episodeId: acceptedHandoverPresentation.episodeId,
        snapshotId: acceptedHandoverPresentation.snapshotId,
        validKeys: acceptedHandoverPresentation.plan.scientificCandidateKeys,
      },
    [acceptedHandoverPresentation],
  );
  const {
    pinnedKey: inspectedCandidateKey,
    togglePinnedKey: toggleInspectedCandidateKey,
  } = useCandidateInspectionSelection(multiCandidateEpisodeId, candidateInspectionSnapshot);
  useSimStatePublisher({
    profile,
    sim,
    frame: sceneFrame,
    sourceEpochUtcMs: runtime.replay.epochUtcMs,
    homepageControllerEnabled: homepageVisualIdentity && sceneLane === 'sinr-live' && simSource === 'live',
    playbackSpeed: speed,
    viz,
    signalResetKey: runtime.signalResetKey,
    handoverResetKey: runtime.handoverResetKey,
    measurementResetEpoch: runtime.measurementResetEpoch,
    seekRequestKey: runtime.replay.seekRequestKey,
    latchedBeamSinrByKeyRef,
    onSimUpdate,
    enabled: simSource === 'live' && sceneFrame.sceneSource !== 'artifact-replay',
    beamCountBySatellite: runtime.beamCountBySatellite,
    servingBeamCount: runtime.servingBeamCount,
    candidateBeamCount: runtime.candidateBeamCount,
    candidateInspectionPinnedKey: inspectedCandidateKey,
  });
  // S-cells-3: cell-truth beam cones for the sinr-live lane. Serving comes from
  // `sim.sinrLiveCells` (SINR + HandoverManager truth, NOT the round-robin
  // scheduler). The render-count + serving-sat + off-axis values feed the durable
  // browser gate (UE off-centre = cones at fixed cells while UEs sit off-axis).
  // Resolve the cones ONCE per frame; the component + telemetry both read this
  // memoised array (no redundant resolver passes).
  // W9 step 1 — the sinr-live cell lane renders the serving sat's FULL multibeam fan
  // (all the cells it serves this slot, post beam-hopping), not just the primary UE's
  // one cone. Semantic focus (7fb5991, sinr-live-semantic-beam-colour-sdd): the default
  // focuses to the HERO serving satellite ONLY (`sinrLiveTargetSatIds`, size 1) — NOT a
  // ≤3 set. The imminent-handover target does NOT join this set; it draws a SEPARATE
  // single blue candidate cone below. The "Other beams" toggle (showNonServingCones)
  // opens the full breadth power-view. Rule#6 display filter — the serving truth + the
  // s0/s4 must-hold resolver (focusSatIds=null) are unchanged; this only narrows what is DRAWN.
  // primaryServingRecord = the focus/centre UE's serving (satId, cellId) — the SAME
  // primary oracle the s0 connected-sat invariant + the InfoPanel publisher read; its
  // cone renders as the bright saturated hero beam.
  const primaryServingRecord = sim.sinrLiveCells
    ? resolvePrimaryCellServingRecord(sim.sinrLiveCells, sim.perUePositions)
    : null;
  // The primary record carries two different cell identities: `cellId` is the
  // UE's geographic membership, while `servingBeamId` is the authoritative
  // Walker pair selected by the handover transaction.  The cone resolver is
  // keyed by the latter's earth-fixed beam surrogate.  Feeding membership
  // `cellId` into the homepage display gate made the data-link line survive
  // while its exact serving cone was filtered out after a beam switch.
  const displayHeroPrimary = resolveDisplayHeroPrimary(
    primaryServingRecord,
    cellIdFromLinkBudgetBeamId,
  );
  const displayHeroRecord = useMemo(() => resolveDisplayHeroRecord(
    displayHeroPrimary,
    (sim.sinrLiveCells?.illuminatedBeams ?? [])
      .filter(beam => (
        beam.serving
        && sinrLiveCellPlacementById.has(beam.cellId)
        && viz.coneApexWorldById.has(beam.satId)
      ))
      .map(beam => ({
        servingSatId: beam.satId,
        cellId: beam.cellId,
        beamId: beam.beamId ?? null,
      })),
  ), [
    displayHeroPrimary,
    sim.sinrLiveCells,
    sinrLiveCellPlacementById,
    viz.coneApexWorldById,
  ]);
  // Candidate authority and display hysteresis are pure policy; the ref is
  // only the adapter-owned memory for the publication-gap latch.
  const multiCandidateComparisonLatchRef = useRef<MultiCandidateComparisonLatch | null>(null);
  // Adapter-owned memory for the comparison overlay's own minimum-display
  // hold (see MULTI_CANDIDATE_COMPARISON_MIN_DISPLAY_HOLD_SEC) — keyed to the
  // live sim clock so it freezes while paused instead of racing ahead.
  const multiCandidateDisplayHoldSinceSecRef = useRef<number | null>(null);
  const multiCandidateComparisonPolicy = resolveMultiCandidateComparisonPolicy({
    acceptedPresentation: acceptedHandoverPresentation,
    simSource,
    sceneLane,
    previousLatch: multiCandidateComparisonLatchRef.current,
    centralOverlayEnabled: MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED,
    teachingLectureActive: runtime.teachingLectureKind != null,
    nowSec: sim.simTimeSec,
    previousDisplayHoldSinceSec: multiCandidateDisplayHoldSinceSecRef.current,
  });
  multiCandidateComparisonLatchRef.current = multiCandidateComparisonPolicy.nextLatch;
  multiCandidateDisplayHoldSinceSecRef.current = multiCandidateComparisonPolicy.nextDisplayHoldSinceSec;
  const {
    acceptedDecision: acceptedHandoverDecisionFrame,
    snapshotMatchesFrame: multiCandidateSnapshotMatchesFrame,
    authorityActive: multiCandidateAuthorityActive,
    decisionAuthorityPresent: multiCandidateDecisionAuthorityPresent,
    rawComparisonPhase: rawMultiCandidateComparisonPhase,
    preSelectionComparisonPhase,
    latchedComparisonPhase: latchedMultiCandidateComparisonPhase,
    comparisonPhase: multiCandidateComparisonPhase,
    centralOverlayActive: multiCandidateCentralOverlayActive,
  } = multiCandidateComparisonPolicy;
  const sceneJoinKeyByPair = useMemo<ReadonlyMap<string, string>>(() => {
    const byPair = new Map<string, string>();
    for (const link of acceptedHandoverPresentation?.plan.displayedLinks ?? []) {
      byPair.set(`${link.key.satelliteId}|${link.key.beamId}`, link.sceneJoinKey);
    }
    // Older/partial snapshots can omit a link while the metric projection still
    // has the pair. Keep the metric join as a fail-soft fallback for that row.
    for (const metric of homepageBeamMetrics?.metrics ?? []) {
      if (!byPair.has(`${metric.satelliteId}|${metric.beamId}`)) {
        byPair.set(`${metric.satelliteId}|${metric.beamId}`, metric.joinKey);
      }
    }
    return byPair;
  }, [acceptedHandoverPresentation, homepageBeamMetrics]);
  const resolveSceneJoinKey = useCallback((cone: SinrLiveCellBeamConeRenderItem): string | null => {
    const beamId = cone.beamId ?? cellLinkBudgetBeamId(cone.cellId);
    return sceneJoinKeyByPair.get(`${cone.satId}|${beamId}`) ?? null;
  }, [sceneJoinKeyByPair]);
  const narrativeCaptionHoldRef = useRef<NarrativeCaptionHoldState | null>(null);
  const narrativeCaptionStoryIdRef = useRef<string | null>(null);
  const acceptedCaptionBinding = handoverSurfaceBindings?.accepted ?? null;
  const acceptedCaptionStoryId = acceptedCaptionBinding?.identity.storyId ?? null;
  const narrativeStreamKey = [
    simSource,
    runtime.replay.seekRequestKey ?? '',
    runtime.signalResetKey ?? '',
    runtime.handoverResetKey ?? '',
    runtime.measurementResetEpoch ?? 0,
  ].join('|');
  const narrativeStreamKeyRef = useRef('');
  const [narrativeCaption, setNarrativeCaption] = useState<NarrativeCaptionDisplay | null>(null);
  // A homepage teaching lecture (the Inter/Intra Handover buttons) owns its
  // OWN top-of-scene caption (`HandoverTeachingCaption`, driven by the
  // authored script's phases) whenever it is open. This caption narrates the
  // REAL background decision engine instead, which keeps running the whole
  // time a lecture is open — the lecture never reads from or writes to it
  // (see `HandoverTeachingBeamCones.tsx`'s own header) — so without this
  // exclusion both captions would try to occupy the same top-of-scene spot
  // at once.
  const narrativeCaptionActive = homepageVisualIdentity
    && teachingNarrativeEnabled
    && runtime.teachingLectureKind == null;
  // Split from the active-path effect below on purpose — see the historical
  // note in git blame: an earlier version folded this into the same effect
  // as a dependency-array bailout, but that effect's OLD dependency list
  // included `viz.displaySats` (a fresh array reference on effectively every
  // render), so the bailout still dispatched `setNarrativeCaption` every
  // single frame even while the feature was off, which a real crash log
  // (`Maximum update depth exceeded`) blamed as contributing render
  // pressure. The active-path effect below no longer depends on
  // `viz.displaySats` at all (this redesign dropped the old horizon-crossing
  // cue, which was its only consumer), but keeping the off-path bailout on
  // its own effect with only the boolean as a dependency is still the
  // simplest way to guarantee it can never re-fire from frame churn.
  useEffect(() => {
    if (narrativeCaptionActive) return;
    setNarrativeCaption(null);
    narrativeCaptionHoldRef.current = null;
    narrativeCaptionStoryIdRef.current = null;
  }, [narrativeCaptionActive]);

  useEffect(() => {
    if (!narrativeCaptionActive) return;
    if (narrativeStreamKeyRef.current !== narrativeStreamKey) {
      narrativeStreamKeyRef.current = narrativeStreamKey;
      narrativeCaptionHoldRef.current = null;
      narrativeCaptionStoryIdRef.current = null;
      setNarrativeCaption(null);
    }
    if (acceptedCaptionBinding === null) {
      if (narrativeCaptionHoldRef.current !== null
        || narrativeCaptionStoryIdRef.current !== null) {
        narrativeCaptionHoldRef.current = null;
        narrativeCaptionStoryIdRef.current = null;
        setNarrativeCaption(null);
      }
      return;
    }
    const incomingStoryId = acceptedCaptionBinding.identity.storyId;
    const storyChanged = narrativeCaptionStoryIdRef.current !== incomingStoryId;
    if (storyChanged) {
      narrativeCaptionHoldRef.current = null;
      setNarrativeCaption(null);
    }
    const previousHold = narrativeCaptionHoldRef.current;
    const rawChapter = resolveNarrativeCaptionChapterFromStoryPhase(
      acceptedCaptionBinding.identity.phase,
    );
    const nowSec = acceptedCaptionBinding.frame.clock.currentSec;
    const nextHold = advanceNarrativeCaptionHold(rawChapter, nowSec, previousHold);
    narrativeCaptionHoldRef.current = nextHold;
    const chapterUnchanged = previousHold !== null
      && previousHold.displayedChapter === nextHold.displayedChapter;
    if (chapterUnchanged && !storyChanged) return;
    narrativeCaptionStoryIdRef.current = incomingStoryId;
    // A baseline chapter ("still calm") reads as redundant next to a scene
    // that already looks calm — show the caption only for chapters worth
    // actually narrating, and let it disappear the rest of the time.
    setNarrativeCaption(isNarrativeCaptionBaselineChapter(nextHold.displayedChapter)
      ? null
      : {
        chapter: nextHold.displayedChapter,
        text: resolveNarrativeCaptionText(nextHold.displayedChapter),
        storyId: acceptedCaptionStoryId,
      });
  }, [
    acceptedCaptionBinding,
    acceptedCaptionStoryId,
    narrativeCaptionActive,
    narrativeStreamKey,
  ]);
  const handoverAuthorityJoin = useMemo(
    () => resolveHandoverAuthorityJoin(
      acceptedHandoverPresentation?.decision ?? null,
      acceptedHandoverPresentation?.commit ?? null,
    ),
    [acceptedHandoverPresentation],
  );
  // The engine exposes the authority transition only on its switching frame;
  // the existing wall-clock presentation deliberately continues through the
  // following guard frames.  Retain that exact transition identity so the
  // post-commit cue cannot be rebuilt from a later legacy event or a newer
  // sourceFrameId.
  const authorityTransitionRef = useRef<AuthorityHandoverTransition | null>(null);
  // A parameter/reset action can reseat the decision stream without issuing a
  // replay seek.  Include every producer reset identity so a transition from
  // the previous stream can never leak into the new scene/rail frame.
  const authorityTransitionResetKeyRef = useRef<string>([
    runtime.replay.seekRequestKey ?? '',
    runtime.signalResetKey ?? '',
    runtime.handoverResetKey ?? '',
    runtime.measurementResetEpoch ?? 0,
  ].join('|'));
  const currentAuthorityResetKey = [
    runtime.replay.seekRequestKey ?? '',
    runtime.signalResetKey ?? '',
    runtime.handoverResetKey ?? '',
    runtime.measurementResetEpoch ?? 0,
  ].join('|');
  if (authorityTransitionResetKeyRef.current !== currentAuthorityResetKey) {
    authorityTransitionResetKeyRef.current = currentAuthorityResetKey;
    authorityTransitionRef.current = null;
  }
  if (authorityTransitionRef.current?.episodeId !== multiCandidateEpisodeId) {
    authorityTransitionRef.current = null;
  }
  if (handoverAuthorityJoin?.transition !== null && handoverAuthorityJoin?.transition !== undefined) {
    authorityTransitionRef.current = handoverAuthorityJoin.transition;
  }
  const handoverCandidatePresentationPlan = multiCandidateAuthorityActive
    ? acceptedHandoverPresentation?.plan ?? null
    : null;
  const multiCandidateScenePresentationHoldRef = useRef<MultiCandidatePresentationHold | null>(null);
  const multiCandidatePresentationPolicy = resolveMultiCandidatePresentationPolicy({
    acceptedPresentation: acceptedHandoverPresentation,
    candidatePresentationPlan: handoverCandidatePresentationPlan,
    homepageVisualIdentity,
    sceneLane,
    simSource,
    authorityActive: multiCandidateAuthorityActive,
    comparisonPhase: multiCandidateComparisonPhase,
    preSelectionComparisonPhase,
    showSinrLiveCellBeams,
    sceneLayerEnabled: showSinrLiveCellBeams
      && (
        presentationPlan.visible['serving-beams']
        || presentationPlan.visible['candidate-beams']
      ),
    previousHold: multiCandidateScenePresentationHoldRef.current,
    centralOverlayEnabled: MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED,
    teachingLectureActive: runtime.teachingLectureKind != null,
  });
  multiCandidateScenePresentationHoldRef.current = multiCandidatePresentationPolicy.nextHold;
  const {
    candidateReviewPresentation: multiCandidateCandidateReviewPresentation,
    candidateComparisonSceneActive,
    scenePresentationForRender: multiCandidateScenePresentationForRender,
    scenePresentationHoldActive: multiCandidateScenePresentationHoldActive,
    sceneVisualActive: multiCandidateSceneVisualActive,
    sceneLayerVisible: multiCandidateSceneLayerVisible,
  } = multiCandidatePresentationPolicy;
  const multiCandidateSceneRenderPlan = useMemo(() => {
    const primaryUeWorld = sceneFrame.ues[0]?.worldPos;
    if (
      multiCandidateScenePresentationForRender === null
      || primaryUeWorld === undefined
      || !multiCandidateSceneLayerVisible
    ) return null;
    return resolveMultiCandidateBeamScene({
      presentation: multiCandidateScenePresentationForRender,
      placementByCellId: sinrLiveCellPlacementById,
      // The accepted snapshot may promote a service/candidate satellite that
      // is outside the ambient top-12 marker slice.  SceneProjection must use
      // the full cone-apex map so a real accepted solid link cannot be turned
      // into an unmapped pair merely because the marker cap changed.
      satelliteWorldById: viz.coneApexWorldById,
      primaryUeWorld,
      widthScale: beamDisplaySpec.coneWidthScale * MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER,
      reducedMotion: runtime.reducedMotion,
      homepageVisualIdentity,
      homepageIdentityPaletteIndexBySatelliteId: homepageIdentityPaletteIndexBySatelliteId ?? undefined,
    });
  }, [
    beamDisplaySpec.coneWidthScale,
    multiCandidateSceneLayerVisible,
    multiCandidateScenePresentationForRender,
    runtime.reducedMotion,
    sceneFrame.ues,
    sinrLiveCellPlacementById,
    viz.coneApexWorldById,
    homepageVisualIdentity,
    homepageIdentityPaletteIndexBySatelliteId,
  ]);
  const multiCandidateCandidateReviewRenderPlan = useMemo(() => {
    const primaryUeWorld = sceneFrame.ues[0]?.worldPos;
    if (
      !candidateComparisonSceneActive
      || multiCandidateCandidateReviewPresentation === null
      || primaryUeWorld === undefined
    ) return null;
    return resolveMultiCandidateBeamScene({
      presentation: multiCandidateCandidateReviewPresentation,
      placementByCellId: sinrLiveCellPlacementById,
      // Keep the review projection on the same full source map as the primary
      // candidate scene; displaySats is only the bounded ambient marker list.
      satelliteWorldById: viz.coneApexWorldById,
      primaryUeWorld,
      widthScale: beamDisplaySpec.coneWidthScale,
      reducedMotion: runtime.reducedMotion,
      homepageVisualIdentity,
      homepageIdentityPaletteIndexBySatelliteId: homepageIdentityPaletteIndexBySatelliteId ?? undefined,
    });
  }, [
    beamDisplaySpec.coneWidthScale,
    candidateComparisonSceneActive,
    multiCandidateCandidateReviewPresentation,
    runtime.reducedMotion,
    sceneFrame.ues,
    sinrLiveCellPlacementById,
    viz.coneApexWorldById,
    homepageVisualIdentity,
    homepageIdentityPaletteIndexBySatelliteId,
  ]);
  // WHO DECIDES a beam / cell / satellite identity colour → useSceneIdentityColorLadder.
  // The rungs and the three resolvers live in that module; the precedence ORDER
  // lives in appearance/resolveBeamAppearance.ts. Nothing here may build a second set.
  const {
    resolveSceneAcceptedBeamColorSources,
    resolveSceneAcceptedBeamColor,
    resolveSceneAcceptedCellColor,
    resolveSceneSatelliteColorSources,
    resolveSceneSatelliteColor,
  } = useSceneIdentityColorLadder({
    acceptedHandoverPresentation,
    homepageBeamEeByKey,
    homepageIdentityPaletteIndexBySatelliteId,
    homepageVisualIdentity,
  });
  // The orbit trail is a SATELLITE SURFACE, so its colour comes from the
  // satellite table in `appearance/satelliteSurfaceModifiers.ts` — identity
  // first, then the `orbitTrail` row's paling. It used to read the
  // `satelliteTintColor` channel that `useBeamViz` now fills from the satellite
  // identity ladder. The trail still has its own legitimate surface modifier,
  // so it derives its paleness from that same identity rather than replacing it
  // with a second palette.
  const orbitTrailSatellites = useMemo(() => viz.displaySats.map(satellite => ({
    ...satellite,
    satelliteTintColor: resolveSatelliteSurfaceColor(
      satellite.id,
      'orbitTrail',
      resolveSceneSatelliteColorSources,
    ),
  })), [resolveSceneSatelliteColorSources, viz.displaySats]);
  const selectCandidateSceneInstructions = homepageVisualIdentity
    ? selectHomepageCandidateSceneInstructions
    : selectCentralMultiCandidateSceneInstructions;
  const multiCandidateRenderIdentity = useMemo(() => resolveMultiCandidateRenderIdentity({
    candidateReviewRenderPlan: multiCandidateCandidateReviewRenderPlan,
    sceneRenderPlan: multiCandidateSceneRenderPlan,
    selectInstructions: selectCandidateSceneInstructions,
  }), [
    multiCandidateCandidateReviewRenderPlan,
    multiCandidateSceneRenderPlan,
    selectCandidateSceneInstructions,
  ]);
  const {
    candidateComparisonVisibleSatelliteIds,
    candidateComparisonOrdinalBySatelliteId,
    servingCarrierRenderable: multiCandidateServingCarrierRenderable,
  } = multiCandidateRenderIdentity;
  const multiCandidateAuthoritySpineParticlePlans = useMemo(() => (
    resolveAuthoritySpineParticlePlans({
      enabled: multiCandidateCentralOverlayActive,
      serving: multiCandidateSceneRenderPlan?.instructions.find(instruction => instruction.isServing),
      primaryUeWorld: sceneFrame.ues[0]?.worldPos,
      particlesPerBeam: SPINE_PARTICLES_PER_BEAM,
    })
  ), [multiCandidateCentralOverlayActive, multiCandidateSceneRenderPlan, sceneFrame.ues]);
  const multiCandidateSatelliteColorsInput = useMemo<MultiCandidateSatelliteColorsInput>(
    () => ({
      acceptedSatelliteIdentities: Object.values(
        acceptedHandoverPresentation?.plan.identityAllocation.assignments ?? {},
      ).map(identity => ({
        satelliteId: identity.satelliteId,
        cssColor: identity.cssColor,
      })),
      candidateSatelliteIdentities: (multiCandidateCandidateReviewRenderPlan?.instructions ?? [])
        .map(instruction => ({
          satelliteId: instruction.satelliteId,
          satelliteColor: instruction.satelliteColor,
        })),
      ambientSatelliteIds: viz.displaySats.map(satellite => satellite.id),
      resolveSceneSatelliteColor,
      resolveAmbientFallbackColor: satelliteId => resolveSceneSatelliteColor(satelliteId),
    }),
    [
      acceptedHandoverPresentation,
      multiCandidateCandidateReviewRenderPlan,
      resolveSceneSatelliteColor,
      viz.displaySats,
    ],
  );
  const { multiCandidateSatelliteColorById } = useMultiCandidateSatelliteColors({ multiCandidateSatelliteColorsInput });
  const multiCandidateBeamColors = useMemo(() => resolveMultiCandidateBeamColors({
    sceneInstructions: multiCandidateSceneRenderPlan?.instructions ?? [],
    authorityDisplayedLinks: acceptedHandoverPresentation?.plan.displayedLinks ?? [],
    authorityActive: multiCandidateAuthorityActive,
    resolveBeamColor: resolveSceneAcceptedBeamColor,
  }), [
    acceptedHandoverPresentation,
    multiCandidateAuthorityActive,
    multiCandidateSceneRenderPlan,
    resolveSceneAcceptedBeamColor,
  ]);
  const multiCandidateBeamColorBySatelliteCell = multiCandidateBeamColors.bySatelliteCell;
  const multiCandidateBeamColorBySatelliteBeam = multiCandidateBeamColors.bySatelliteBeam;
  // WHICH ROSTER defines the live sat/beam → identity colour lookup → useLiveBeamIdentityColorMap.
  const liveBeamIdentityColorBySatelliteBeam = useLiveBeamIdentityColorMap({
    acceptedHandoverPresentation,
    resolveSceneAcceptedBeamColor,
    satBeams: viz.satBeams,
  });
  // Keep the central marker filter stable across the short publication gap
  // between two UI snapshots.  The accepted rail snapshot remains the source
  // of truth; this display-only latch prevents every ambient GLB from becoming
  // visible for one render and then disappearing again, which was perceived
  // as satellite flicker during playback.
  const multiCandidateCentralMarkerFilterRef = useRef<MultiCandidateCentralMarkerFilter | null>(null);
  const acceptedComparisonEpisodeKey = multiCandidatePresentationPolicy.episodeKey;
  const multiCandidateMarkerPolicy = resolveMultiCandidateMarkerPolicy({
    simSource,
    canonicalCandidateSatelliteId,
    primaryPendingTargetSatelliteId: primaryServingRecord?.pendingTargetSatId,
    sceneVisualActive: multiCandidateSceneVisualActive,
    centralOverlayActive: multiCandidateCentralOverlayActive,
    candidateComparisonSceneActive,
    preSelectionComparisonPhase,
    acceptedComparisonEpisodeKey,
    previousFilter: multiCandidateCentralMarkerFilterRef.current,
    candidateComparisonRenderPlan: multiCandidateCandidateReviewRenderPlan,
    sceneRenderPlan: multiCandidateSceneRenderPlan,
    candidateComparisonVisibleSatelliteIds,
    homepageVisualIdentity,
    selectInstructions: selectCandidateSceneInstructions,
  });
  multiCandidateCentralMarkerFilterRef.current = multiCandidateMarkerPolicy.nextFilter;
  const {
    centralMarkerSatelliteIds: multiCandidateCentralMarkerSatelliteIds,
    renderedCandidateSatelliteId,
    homepageCandidateStageLabelActive,
    homepageCandidateStageVisibleSatelliteIds,
    homepageSatelliteLabelActive,
    satelliteCandidateLabelActive,
    satelliteCandidateLabelVisibleSatelliteIds,
  } = multiCandidateMarkerPolicy;
  const handoverMarkerSatelliteIds = useMemo(() => resolveHandoverMarkerSatelliteIds({
    multiCandidateSceneVisualActive,
    multiCandidateCentralMarkerSatelliteIds,
    renderedCandidateSatelliteId,
    candidateComparisonSceneActive,
    candidateReviewRenderPlanPresent: multiCandidateCandidateReviewRenderPlan !== null,
    candidateComparisonVisibleSatelliteIds,
    handoverCinemaCandidate,
    authorityTransition: handoverAuthorityJoin?.transition,
  }), [
    handoverAuthorityJoin,
    handoverCinemaCandidate,
    candidateComparisonSceneActive,
    candidateComparisonVisibleSatelliteIds,
    multiCandidateCandidateReviewRenderPlan,
    multiCandidateCentralMarkerSatelliteIds,
    multiCandidateSceneVisualActive,
    renderedCandidateSatelliteId,
  ]);
  const renderedLiveSatelliteMarkersInput = useMemo<RenderedLiveSatelliteMarkersInput>(
    () => ({
      displaySats: viz.displaySats,
      handoverMarkerSatelliteIds,
      identityColorBySatelliteId: multiCandidateSatelliteColorById,
      coneApexWorldById: viz.coneApexWorldById,
      resolveFallbackColor: satelliteId => resolveSceneSatelliteColor(satelliteId),
    }),
    [
      handoverMarkerSatelliteIds,
      multiCandidateSatelliteColorById,
      resolveSceneSatelliteColor,
      viz.coneApexWorldById,
      viz.displaySats,
    ],
  );
  const { renderedLiveSatelliteMarkers } = useRenderedLiveSatelliteMarkers({ renderedLiveSatelliteMarkersInput });
  // Camera ownership is deliberately absent from the comparison projection.
  // The homepage keeps the scene-configured initial pose and OrbitControls; a
  // candidate episode may add markers/cones, but it cannot fit, track, tween,
  // or write a camera pose. Any future camera story must be an explicit user
  // command, not a side effect of candidate data changing.
  const sinrLiveBeamDisplayFrame = useMemo(() => createSinrLiveBeamDisplayFrame({
    profile,
    runtime,
    servingSatelliteId: displayHeroRecord?.servingSatId,
    candidateSatelliteId: renderedCandidateSatelliteId,
    roleCountsRepresentFocusedCells: homepageVisualIdentity,
  }), [
    displayHeroRecord?.servingSatId,
    homepageVisualIdentity,
    profile,
    renderedCandidateSatelliteId,
    runtime,
  ]);
  const candidateDisplayCellFrame = useMemo(
    () => resolveCandidateDisplayCellFrame({
      source: sim.sinrLiveCells,
      sceneSource: simSource,
      candidateSatelliteId: renderedCandidateSatelliteId,
    }),
    [renderedCandidateSatelliteId, sim.sinrLiveCells, simSource],
  );
  const manualHandoverEvent = useMemo(
    () => runtime.manualHandoverRequestId === undefined || runtime.manualHandoverKind === undefined
      ? null
      : resolveManualHandoverDemoEvent(
        runtime.manualHandoverKind,
        sim.sinrLiveCells,
        sim.sinrLiveCells?.primaryUeId ?? sceneFrame.ues[0]?.id,
        [...viz.coneApexWorldById.keys()],
        {
          sourceSatId: runtime.manualHandoverSourceSatId,
          sourceCellId: runtime.manualHandoverSourceCellId,
          targetSatId: runtime.manualHandoverTargetSatId,
          targetCellId: runtime.manualHandoverTargetCellId,
          servingSinrDb: runtime.manualHandoverServingSinrDb,
          candidateSinrDb: runtime.manualHandoverCandidateSinrDb,
        },
      ),
    [
      runtime.manualHandoverRequestId,
      runtime.manualHandoverKind,
      runtime.manualHandoverSourceSatId,
      runtime.manualHandoverSourceCellId,
      runtime.manualHandoverTargetSatId,
      runtime.manualHandoverTargetCellId,
      runtime.manualHandoverServingSinrDb,
      runtime.manualHandoverCandidateSinrDb,
      sim.sinrLiveCells,
      sceneFrame.ues,
      viz.coneApexWorldById,
    ],
  );
  const manualHandoverDisplayMs = resolveManualHandoverDisplayMs({
    homepageVisualIdentity,
    kind: runtime.manualHandoverKind,
    homepageIntraMs: HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
    homepageInterMs: HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
    defaultMs: MANUAL_HANDOVER_DISPLAY_MS,
  });
  const manualHandoverBeamRecord = manualHandoverEvent?.kind === 'intra' && sim.sinrLiveCells !== undefined
    ? resolvePrimaryCellServingRecord(sim.sinrLiveCells, sim.perUePositions)
    : null;
  // The demonstration's wall CLOCK. It must be state, not a bare `performance.now()` read:
  // the component body only re-evaluates on a render, and the button PAUSES the sim before
  // arming the request, so no frame publish ever comes to trigger one. Driven by the
  // throttled `useFrame` tick below (R3F's loop is independent of `paused`), so the
  // envelope actually walks 單 → 雙 → 單 instead of freezing on phase 1.
  const [manualHandoverNowMs, setManualHandoverNowMs] = useState<number | null>(null);
  const [cinemaHandoverNowMs, setCinemaHandoverNowMs] = useState<number | null>(null);
  const manualHandoverTickRef = useRef<ManualHandoverTickState | null>(null);
  const cinemaHandoverTickRef = useRef<CinemaHandoverTickState | null>(null);
  const cinemaHandoverReady = resolveHandoverCinemaReady({
    active: handoverCinemaCandidate !== null,
    kind: handoverCinemaCandidate?.kind,
    requestedSeekKey: runtime.replay.seekRequestKey,
    landedSeekKey: liveSeekLandedKey,
    requestedSeekTargetSec: runtime.replay.seekTargetSec,
    currentSimTimeSec: sim.simTimeSec,
  });
  const handoverPresentationDurations = resolveHandoverPresentationDurations({
    homepageVisualIdentity,
    naturalIntraMs: beamDisplaySpec.triggeredIntraSustainMs,
  });
  useFrame(() => {
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const { next, publish } = resolveManualHandoverTick({
      requestId: runtime.manualHandoverRequestId,
      startedAtMs: runtime.manualHandoverStartedAtMs,
      nowMs,
      displayMs: manualHandoverDisplayMs,
      previous: manualHandoverTickRef.current,
    });
    manualHandoverTickRef.current = next;
    if (publish) setManualHandoverNowMs(next === null ? null : nowMs);

    const cinemaEventId = handoverCinemaCandidate?.eventId;
    const previousCinema = cinemaHandoverTickRef.current;
    if (cinemaEventId === undefined) {
      if (previousCinema !== null) {
        cinemaHandoverTickRef.current = null;
        setCinemaHandoverNowMs(null);
      }
    } else if (previousCinema === null || previousCinema.eventId !== cinemaEventId) {
      cinemaHandoverTickRef.current = {
        eventId: cinemaEventId,
        startedAtMs: nowMs,
        publishedAtMs: nowMs,
        ready: cinemaHandoverReady,
        settled: false,
      };
      setCinemaHandoverNowMs(cinemaHandoverReady ? nowMs : null);
    } else if (!previousCinema.ready && cinemaHandoverReady) {
      cinemaHandoverTickRef.current = {
        ...previousCinema,
        startedAtMs: nowMs,
        publishedAtMs: nowMs,
        ready: true,
        settled: false,
      };
      setCinemaHandoverNowMs(nowMs);
    } else if (!cinemaHandoverReady) {
      // The candidate is known during the fade/seek arm window, but its story
      // clock must remain at phase 0 until useSimulation reports this exact seek.
    } else if (!previousCinema.settled && nowMs - previousCinema.startedAtMs > (
      handoverCinemaCandidate?.kind === 'inter'
        ? handoverPresentationDurations.cinemaInterMs
        : handoverPresentationDurations.cinemaIntraMs
    )) {
      cinemaHandoverTickRef.current = { ...previousCinema, publishedAtMs: nowMs, settled: true };
      setCinemaHandoverNowMs(nowMs);
    } else if (!previousCinema.settled && nowMs - previousCinema.publishedAtMs >= MANUAL_HANDOVER_TICK_INTERVAL_MS) {
      cinemaHandoverTickRef.current = { ...previousCinema, publishedAtMs: nowMs };
      setCinemaHandoverNowMs(nowMs);
    }
  });
  const manualHandoverDisplayState = resolveManualHandoverDisplayState({
    startedAtMs: runtime.manualHandoverStartedAtMs,
    // Before the first tick lands (the very frame the button arms the request) fall back to
    // a direct clock read, so frame 1 is age ≈ 0 rather than a stale value from a prior run.
    nowMs: manualHandoverNowMs ?? (typeof performance === 'undefined' ? Date.now() : performance.now()),
    displayMs: manualHandoverDisplayMs,
    requestId: runtime.manualHandoverRequestId,
    kind: runtime.manualHandoverKind,
    eventPresent: manualHandoverEvent !== null,
  });
  const {
    ageMs: manualHandoverAgeMs,
    requested: manualHandoverRequested,
    active: manualHandoverActive,
    progressSec: manualHandoverProgressSec,
  } = manualHandoverDisplayState;
  // F1 (2026-08-06): `manualHandoverEvent !== null` is part of the ACTIVE condition,
  // not just of the draw condition. The manual cue overlays the moving scene; the
  // display-isolation policy below removes the timeline's primary/candidate/event
  // layers while preserving the dim beam context. When the event cannot resolve, the
  // cue is inactive and the normal scene remains available. No cycle:
  // `manualHandoverEvent` (above) does not read this flag.
  // The explicit demo is UE-centred, not cell-centred: both transition cones
  // must terminate at the red primary UE so the audience can see that the link
  // is changing for this UE rather than jumping between unrelated cells.
  const manualHandoverGroundTarget = useMemo(() => {
    const worldPos = sceneFrame.ues[0]?.worldPos;
    return worldPos === undefined
      ? new THREE.Vector3(sim.ueGroundX, 0, sim.ueGroundZ)
      : new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]);
  }, [sceneFrame.ues, sim.ueGroundX, sim.ueGroundZ]);
  // The live seek rebuilds the frame from a reset state. Keep the complete visible
  // pair from the instant the inter shot is armed, otherwise the pair can change to
  // the post-seek serving/pending record on a later render.
  const cinemaInterPairAnchorRef = useRef<InterCinemaPairAnchor | null>(null);
  if (handoverCinemaCandidate?.kind !== 'inter') {
    cinemaInterPairAnchorRef.current = null;
  } else if (cinemaInterPairAnchorRef.current?.eventId !== handoverCinemaCandidate.eventId) {
    // The indexed event is the handover story's immutable source of identity.
    // The live frame is rebuilt by the seek and may already expose a different
    // serving/pending record; reading it here makes the service beam jump before
    // the story starts and can select a third satellite. Presentation must stay
    // latched to this event pair until the story settles.
    const readApexWorld = (satId: string) => {
      const world = viz.coneApexWorldById.get(satId);
      return world === undefined ? undefined : { x: world.x, y: world.y, z: world.z };
    };
    cinemaInterPairAnchorRef.current = resolveInterCinemaPairAnchor({
      eventId: handoverCinemaCandidate.eventId,
      captured: null,
      fallback: {
        fromSatId: handoverCinemaCandidate.fromSatId,
        fromCellId: handoverCinemaCandidate.fromCellId,
        toSatId: handoverCinemaCandidate.toSatId,
        toCellId: handoverCinemaCandidate.toCellId,
        fromApexWorld: readApexWorld(handoverCinemaCandidate.fromSatId),
        toApexWorld: readApexWorld(handoverCinemaCandidate.toSatId),
      },
    });
  }
  const cinemaInterPairAnchor = cinemaInterPairAnchorRef.current;
  const cinemaInterSatelliteWorldById = useMemo(
    () => resolveCinemaInterSatelliteWorldById({
      current: viz.coneApexWorldById,
      anchor: cinemaInterPairAnchor,
    }),
    [cinemaInterPairAnchor, viz.coneApexWorldById],
  );
  // The offline cell-truth index supplies the real event/time for the cinema. The
  // pair is now a presentation snapshot: later live-frame changes cannot replace
  // either side while the teaching animation is running.
  const cinemaPairCandidate = useMemo(
    () => resolveCinemaPairCandidate({
      candidate: handoverCinemaCandidate,
      anchor: cinemaInterPairAnchor,
    }),
    [cinemaInterPairAnchor, handoverCinemaCandidate],
  );

  const authorityHandoverPresentationCandidate = useMemo(() => resolveAuthorityPresentationCandidate({
    enabled: multiCandidateAuthorityActive,
    homepageVisualIdentity,
    authorityJoin: handoverAuthorityJoin,
    simSource,
    hasCellPlacement: cellId => sinrLiveCellPlacementById.has(cellId),
    hasSatelliteWorld: satelliteId => viz.coneApexWorldById.has(satelliteId),
    durationMs: {
      intra: handoverPresentationDurations.cinemaIntraMs,
      inter: handoverPresentationDurations.cinemaInterMs,
    },
  }),
    [
      handoverAuthorityJoin,
      homepageVisualIdentity,
      multiCandidateAuthorityActive,
      simSource,
      sinrLiveCellPlacementById,
      viz.coneApexWorldById,
    ],
  );

  const recentPrimaryHandoverEvent = useMemo<SinrLiveCellHandoverEvent | null>(
    () => resolveRecentPrimaryHandoverEvent({
      events: sim.sinrLiveCells?.recentHandoverEvents,
      primaryUeId: naturalHandoverProtagonistUeId,
      simTimeSec: sim.sinrLiveCells?.simTimeSec ?? sim.simTimeSec,
    }),
    [naturalHandoverProtagonistUeId, sim.simTimeSec, sim.sinrLiveCells],
  );

  // The model retains background-UE events for telemetry too. They do not own
  // the protagonist's camera story, but a real inter event anywhere still
  // blocks a new intra teaching request and suppresses an intra pulse so the
  // viewport cannot show two handover kinds at once.
  const recentAnyInterHandoverEvent = useMemo<SinrLiveCellHandoverEvent | null>(
    () => resolveRecentInterHandoverEvent({
      events: sim.sinrLiveCells?.recentHandoverEvents,
      simTimeSec: sim.sinrLiveCells?.simTimeSec ?? sim.simTimeSec,
    }),
    [sim.simTimeSec, sim.sinrLiveCells],
  );

  const handoverPresentationCandidateInput = useMemo<HandoverPresentationCandidateInput>(
    () => ({
      authority: {
        active: multiCandidateAuthorityActive,
        candidate: authorityHandoverPresentationCandidate,
        centralOverlayActive: multiCandidateCentralOverlayActive,
        decisionAuthorityPresent: multiCandidateDecisionAuthorityPresent,
        acceptedPresentation: acceptedHandoverPresentation,
      },
      manual: {
        active: manualHandoverActive,
        requested: manualHandoverRequested,
        requestId: runtime.manualHandoverRequestId,
        displayMs: manualHandoverDisplayMs,
        event: manualHandoverEvent,
        beamRecord: manualHandoverBeamRecord,
      },
      natural: {
        event: recentPrimaryHandoverEvent,
        source: simSource,
        satelliteWorldById: viz.coneApexWorldById,
      },
      cinema: {
        ready: cinemaHandoverReady,
        armed: handoverCinemaArmed,
        candidate: cinemaPairCandidate,
        satelliteWorldById: cinemaInterSatelliteWorldById,
      },
      placementByCellId: sinrLiveCellPlacementById,
      durations: {
        naturalIntraMs: handoverPresentationDurations.naturalIntraMs,
        naturalInterMs: handoverPresentationDurations.naturalInterMs,
        cinemaIntraMs: handoverPresentationDurations.cinemaIntraMs,
        cinemaInterMs: handoverPresentationDurations.cinemaInterMs,
      },
      teachingLectureActive: runtime.teachingLectureKind != null,
    }),
    [
      acceptedHandoverPresentation,
      authorityHandoverPresentationCandidate,
      beamDisplaySpec.triggeredIntraSustainMs,
      cinemaHandoverReady,
      cinemaInterSatelliteWorldById,
      cinemaPairCandidate,
      handoverCinemaArmed,
      handoverPresentationDurations,
      homepageVisualIdentity,
      manualHandoverActive,
      manualHandoverBeamRecord,
      manualHandoverDisplayMs,
      manualHandoverEvent,
      manualHandoverRequested,
      multiCandidateAuthorityActive,
      multiCandidateCentralOverlayActive,
      multiCandidateDecisionAuthorityPresent,
      recentPrimaryHandoverEvent,
      runtime.manualHandoverRequestId,
      runtime.teachingLectureKind,
      simSource,
      sinrLiveCellPlacementById,
      viz.coneApexWorldById,
    ],
  );
  const { handoverPresentationCandidate } = useHandoverPresentationCandidate({ handoverPresentationCandidateInput });


  const handoverPresentationStateRef = useRef(createHandoverPresentationState());
  const handoverPresentationSourceRef = useRef(simSource);
  if (handoverPresentationSourceRef.current !== simSource) {
    handoverPresentationSourceRef.current = simSource;
    handoverPresentationStateRef.current = createHandoverPresentationState();
  }
  const handoverPresentationNowMs = manualHandoverNowMs
    ?? cinemaHandoverNowMs
    ?? (typeof performance === 'undefined' ? Date.now() : performance.now());
  const handoverPresentationStep = advanceHandoverPresentation(
    handoverPresentationStateRef.current,
    {
      nowMs: handoverPresentationNowMs,
      candidate: handoverPresentationCandidate,
      owner: manualHandoverRequested
        ? 'manual'
        : handoverCinemaArmed ? 'cinema' : 'natural',
    },
  );
  // The immutable decision frame owns the pair and the atomic serving commit;
  // this established wall-clock owner owns only how long that exact event is
  // readable. It intentionally continues through guard so a one-frame engine
  // boundary cannot collapse the handover animation into an invisible jump.
  handoverPresentationStateRef.current = handoverPresentationStep.state;
  const handoverPresentation = handoverPresentationStep.view;
  const handoverPresentationMode = handoverPresentationStep.state.mode;
  const handoverPresentationCooldownUntilMs = handoverPresentationStep.state.cooldownUntilMs;
  // App's automatic intra scheduler is a parent effect, while this owner lives
  // inside the R3F render tree. Publish the lock during render (ref-only) so the
  // parent cannot arm a competing intra between these two effect phases.
  const handoverPresentationBusy = handoverPresentationMode === 'presenting'
    || (handoverPresentationMode === 'cooldown'
      && handoverPresentationNowMs < handoverPresentationCooldownUntilMs);
  // Only the normalized presentation owner may lock the transport/controls.
  // A retained inter event is still useful for suppressing competing scene
  // layers below, but it is not a new busy source; treating it as one made a
  // completed inter handover disable Next Intra for the rest of the retention
  // window.
  onHandoverPresentationBusyChange?.(handoverPresentationBusy);
  // A natural inter story owns the viewport until the shared presentation
  // owner releases it. Direct runtime effects must not paint an intra cue over
  // that owner even if an older frame still carries an intra latch.
  // `pendingTargetSatId` is the live model's pre-fire inter candidate. It is
  // intentionally not a second visual owner: the candidate fan must not paint
  // here and then disappear when the normalized handover story acquires the
  // viewport. The story owner below will paint the same target once, after its
  // serving lead-in, together with the badge and ho-slow state.
  const handoverPresentationDisplayPolicy = resolveHandoverPresentationDisplayPolicy({
    presentation: handoverPresentation,
    presentationMode: handoverPresentationMode,
    manualHandoverActive,
    manualHandoverRequested,
    handoverCinemaArmed,
    handoverCinemaReady: cinemaHandoverReady,
    handoverCinemaKind,
    recentAnyInterHandoverEventPresent: recentAnyInterHandoverEvent !== null,
    simSource,
    multiCandidateCentralOverlayActive,
    primaryServingRecord,
    preserveConfiguredServingFan: homepageVisualIdentity,
    teachingLectureActive: runtime.teachingLectureKind != null,
    peakOpacity: beamDisplaySpec.triggeredIntraPeakOpacity,
    fallbackSimTimeSec: sim.simTimeSec,
    homepageVisualIdentity,
  });
  const {
    source: handoverPresentationSource,
    presentedCinemaHandoverActive,
    presentedInterHandoverActive,
    manualHandoverPresentationActive,
    concurrentIntraVisualSuppressed,
    presentationHandoverEnvelope,
    handoverDisplayIsolation,
    teachingLectureFieldCleared,
    presentedHandoverPairCandidate,
  } = handoverPresentationDisplayPolicy;
  // Null off a lecture, so every other route keeps its existing label policy.
  // Identity comes only from the shell-owned normalized projection.
  const teachingStoryFrame = teachingSurfaceProjection?.binding.frame ?? null;
  const teachingLabelSatelliteIds = useMemo<ReadonlySet<string> | null>(() => resolveTeachingLabelSatelliteIds(
    teachingStoryFrame?.from.satelliteId ?? null,
    teachingStoryFrame?.to.satelliteId ?? null,
  ), [teachingStoryFrame]);

  // The current serving spacecraft is allowed to expose its configured
  // multibeam fan (1/7/19).  This is intentionally satellite-scoped only for
  // the serving identity; candidate/other spacecrafts still need an exact
  // (satellite, cell) entry in `homepageBeamVisibility` below.  Keeping this
  // distinction explicit prevents a transient candidate satellite frame from
  // turning its whole fan into visible cone geometry.
  const homepageBeamFanSatelliteIds = useMemo(
    () => resolveServingFanSatelliteIds(
      displayHeroRecord?.servingSatId,
      primaryServingRecord?.servingSatId,
    ),
    [displayHeroRecord?.servingSatId, primaryServingRecord?.servingSatId],
  );
  // An intra handover changes the source/target beam identity, but the
  // narrated pair must land on one geographic cell. Use the source cell's
  // existing earth-fixed placement as the presentation anchor; this keeps
  // both cones/footprints on the same visible hex while retaining the real
  // from/to cell ids in the event and rail joins. Inter handovers continue to
  // use the UE-centred anchor below because their two satellites are distinct.
  const homepageIntraCellAnchor = useMemo(() => {
    const point = resolveHomepageIntraCellAnchor({
      presentedHandoverPairCandidate,
      handoverPresentationCandidate,
      recentPrimaryHandoverEvent,
      manualHandoverEvent,
      displayHeroCellId: displayHeroRecord?.cellId,
      placementByCellId: sinrLiveCellPlacementById,
      fallback: {
        x: manualHandoverGroundTarget.x,
        y: manualHandoverGroundTarget.y,
        z: manualHandoverGroundTarget.z,
      },
    });
    return new THREE.Vector3(point.x, point.y, point.z);
  }, [
    displayHeroRecord?.cellId,
    handoverPresentationCandidate,
    manualHandoverEvent,
    manualHandoverGroundTarget,
    presentedHandoverPairCandidate,
    recentPrimaryHandoverEvent,
    sinrLiveCellPlacementById,
  ]);
  // Homepage-only final geometry gate. The decision/snapshot still carries the
  // complete eligible candidate set for the rail, but physical-looking cone
  // geometry is allowed only for exact (satellite, cell/beam) identities owned
  // by the current story. A satellite-level allow-list was too broad: it let
  // every beam in a selected satellite's fan flash on and off as the live frame
  // changed. This gate is display-only and cannot change the decision.
  const homepageSceneBeamVisibilityInput = useMemo<HomepageSceneBeamVisibilityInput>(
    () => ({
      displayHeroRecord,
      primaryServingRecord,
      renderedCandidateSatelliteId,
      presentedHandoverPairCandidate,
      handoverPresentationCandidate,
      handoverAuthorityJoin,
      cinemaPairCandidate,
      recentPrimaryHandoverEvent,
    }),
    [
      cinemaPairCandidate,
      displayHeroRecord?.cellId,
      displayHeroRecord?.beamId,
      displayHeroRecord?.servingSatId,
      handoverAuthorityJoin,
      handoverPresentationCandidate,
      presentedHandoverPairCandidate,
      primaryServingRecord?.pendingTargetSatId,
      primaryServingRecord?.intraCandidateLinkSample?.beamId,
      primaryServingRecord?.cellId,
      primaryServingRecord?.servingSatId,
      primaryServingRecord?.servingBeamId,
      recentPrimaryHandoverEvent,
      renderedCandidateSatelliteId,
    ],
  );
  const { homepageBeamVisibility } = useHomepageBeamVisibility({ homepageSceneBeamVisibilityInput });
  const restrictSceneBeamItems = useCallback(
    (items: readonly SinrLiveCellBeamConeRenderItem[]): readonly SinrLiveCellBeamConeRenderItem[] => (
      restrictHomepageBeamItems(items, {
        homepageVisualIdentity,
        allowedBeamIdentities: homepageBeamVisibility,
        allowAllBeamSatelliteIds: homepageBeamFanSatelliteIds,
      })
    ),
    [homepageBeamFanSatelliteIds, homepageBeamVisibility, homepageVisualIdentity],
  );
  const authorityTransition = authorityTransitionRef.current;
  const authorityPresentationCommitObserved = authorityTransition !== null
    && handoverPresentation.event?.eventId === authorityTransition.eventId
    && commitReceiptMatchesHandoverPresentation(
      acceptedHandoverPresentation?.commit,
      handoverPresentation.event,
    );
  const presentationSatelliteWorldById = presentedCinemaHandoverActive
    ? cinemaInterSatelliteWorldById
    : viz.coneApexWorldById;
  // The comparison layer parks on the atomic `switching` frame, but the
  // established handover choreography must keep its exact episode identity
  // through the wall-clock transition.  This flag is intentionally derived
  // from the latched authority transition rather than from the current
  // candidate list, so an intra or inter switch cannot fall back to the old
  // semantic warm/cool colours while the accepted link is changing.
  const multiCandidateIdentityTransitionActive = runtime.teachingLectureKind == null
    && multiCandidateAuthorityActive
    && authorityTransition !== null
    && handoverPresentation.event?.eventId === authorityTransition.eventId;

  // Homepage geometry has one display owner at a time. This is a pure gate
  // over the existing accepted presentation/event layers: it does not create
  // a clock, candidate list, decision, or presentation state. In particular,
  // a handover pair replaces the ambient serving/candidate cone mounts for the
  // duration of the story, so an old pulse cannot flash a third beam through
  // the same frame.
  const homepageSceneGeometryPolicy = resolveHomepageSceneGeometryPolicy({
    homepageVisualIdentity,
    candidateReviewActive: candidateComparisonSceneActive
      || (multiCandidateSceneVisualActive
        && !handoverPresentation.active
        && !multiCandidateIdentityTransitionActive),
    authorityTransitionActive: multiCandidateIdentityTransitionActive,
    presentationActive: handoverPresentation.active,
    presentationSource: handoverPresentationSource,
    presentationKind: handoverPresentation.event?.kind ?? null,
    presentationMode: handoverPresentationMode,
    // Homepage natural events use the normalized wall-clock pair below. Do
    // not let the raw retention buffer replay the same event after cooldown;
    // that legacy pulse fallback remains available on non-homepage lanes.
    naturalPulseAvailable: !homepageVisualIdentity && recentPrimaryHandoverEvent !== null,
  });

  useEffect(() => {
    onHandoverPresentationChange?.({
      view: handoverPresentation,
      mode: handoverPresentationMode,
      cooldownUntilMs: handoverPresentationCooldownUntilMs,
    });
  }, [
    handoverPresentation.active,
    handoverPresentation.autoSlowActive,
    handoverPresentation.event?.eventId,
    handoverPresentation.phase,
    handoverPresentationCooldownUntilMs,
    handoverPresentationMode,
    onHandoverPresentationChange,
  ]);
  useEffect(() => () => {
    onHandoverPresentationChange?.({
      view: createIdleHandoverPresentationView(),
      mode: 'idle',
      cooldownUntilMs: 0,
    });
    onHandoverPresentationBusyChange?.(false);
  }, [onHandoverPresentationBusyChange, onHandoverPresentationChange]);

  // The inter cinema is intentionally self-contained: after the live seek, rebuild a
  // display-only two-satellite fan frame from the already-published earth-fixed cells.
  // This keeps the anchored source satellite's other beams visible even when the live
  // frame has moved on to the target satellite. It is never passed back to the model.
  const cinemaInterDisplayCellFrame = useMemo(
    () => resolveCinemaInterDisplayCellFrame({
      source: sim.sinrLiveCells,
      pairCandidate: presentedHandoverPairCandidate,
    }),
    [presentedHandoverPairCandidate, sim.sinrLiveCells],
  );

  // SEMANTIC scene focus (docs/sinr-live-semantic-beam-colour-sdd.md): the broad serving
  // fan / non-serving / footprint / callout / pulse layers focus to the HERO serving
  // satellite ONLY, so the steady scene is ONE satellite — your serving link. The
  // imminent inter-handover target does NOT join this broad set (it would flood every
  // layer with its whole multibeam fan); it draws a SINGLE dim candidate beam below
  // (`sinrLiveCandidateBeamConeItems`), so "inter = 2 sats" reads as your green fan + ONE
  // blue incoming beam, not two full fans. Display-only render-focus (Rule#6) — the
  // serving truth + the s0/s4 must-holds (focusSatIds=null resolver) are unchanged. Keyed
  // on the stable satId string so the Set identity (and the cone memo) stays stable.
  // The display focus sat-id set is now derived from `beamDisplaySpec.focusScope`
  // (default 'heroOnly' = the serving sat only, byte-identical with the old hardcoded memo).
  // `null` = 'allServing' breadth (no focus filter). Keyed on focusScope + the record's sat
  // ids so the Set identity (and the cone memos) stays stable across unrelated re-renders.
  //
  // A temporarily unserved protagonist no longer turns a valid serving field into
  // either a black scene or an all-grey scene. `displayHeroRecord` is a complete,
  // drawable fallback pair; it changes only which existing cone gets the HERO style.
  const sinrLiveTargetSatIds = useMemo(
    () => resolveBeamFocusSatIds(beamDisplaySpec.focusScope, displayHeroRecord),
    [beamDisplaySpec.focusScope, displayHeroRecord],
  );

  // WHICH PALETTE every SINR-live cone/footprint paints with → useSinrLiveConePalette.
  const multiCandidateServingBeamColor = multiCandidateSceneRenderPlan?.instructions.find(
    instruction => instruction.isServing,
  )?.beamColor ?? null;
  const { sinrLiveConePalette, activeServingConePalette } = useSinrLiveConePalette({
    beamDisplaySpec,
    multiCandidateCentralOverlayActive,
    multiCandidateServingBeamColor,
  });

  const { sinrLiveCellBeamConeItems } = useSinrLiveCellBeamConeItems({
    geometry: {
      cellFrame: sim.sinrLiveCells,
      placementByCellId: sinrLiveCellPlacementById,
      satelliteWorldById: viz.coneApexWorldById,
      focusSatIds: resolveServingConeFocusSatIds(
        homepageVisualIdentity,
        beamDisplaySpec.showNonServingCones,
        sinrLiveTargetSatIds,
      ),
      frequencyReuse: profile.beams.frequencyReuse,
      servingBeamBudget: sinrLiveBeamDisplayFrame.serving.configuredBeamCount,
      allowHeroFallback: homepageVisualIdentity,
      budgetServingFan: resolveServingConeBudgetFan(
        homepageVisualIdentity,
        beamDisplaySpec.showNonServingCones,
      ),
      displayHeroRecord,
    },
    presentation: {
      showSinrLiveCellBeams,
      renderServingField: homepageSceneGeometryPolicy.renderServingField,
      showNonServingCones: beamDisplaySpec.showNonServingCones,
      hideNormalBeamField: handoverDisplayIsolation.hideNormalBeamField,
      hidePrimaryServingBeam: handoverDisplayIsolation.hidePrimaryServingBeam,
      preserveConfiguredServingFan: handoverDisplayIsolation.preserveConfiguredServingFan,
      teachingLectureFieldCleared,
      multiCandidateCentralOverlayActive,
      homepageVisualIdentity,
      homepageBeamVisibility,
      homepageBeamFanSatelliteIds,
      resolveSceneAcceptedBeamColor,
      restrictHomepageBeamItems: restrictSceneBeamItems,
    },
  });
  // Keep the streaming particles on the same geometry authority as the visible
  // SINR-live cones.  Passing no plan used to activate SpineParticles' legacy
  // `viz.satBeams` fallback, whose steered endpoints can sit in an unpainted
  // area while the earth-fixed cell cone/grid is elsewhere.  The ambient stream
  // therefore follows the one visible hero cell cone, and disappears when that
  // cone is not drawable instead of flying toward a stale target.
  const sinrLiveCellTruthSpineParticlePlans = useMemo(() => resolveSinrLiveCellTruthSpineParticlePlans({
    enabled: showSinrLiveCellBeams,
    multiCandidateCentralOverlayActive,
    displayHeroRecord,
    coneItems: sinrLiveCellBeamConeItems,
    restrictItems: restrictSceneBeamItems,
    particlesPerBeam: SPINE_PARTICLES_PER_BEAM,
  }), [
    displayHeroRecord,
    multiCandidateCentralOverlayActive,
    restrictSceneBeamItems,
    showSinrLiveCellBeams,
    sinrLiveCellBeamConeItems,
  ]);
  // Candidate cue: the imminent inter-handover TARGET beam. The homepage paints
  // only the exact prepared pair on the canvas; other hard-eligible candidates
  // remain decision/rail evidence and never become a transient fan. Legacy lanes
  // retain their previous bounded fan behavior below.
  const candidateConeSelection = selectCandidateConeGeometry({
    presentedHandoverPairCandidate,
    showCinemaCandidateFan: handoverDisplayIsolation.showCinemaCandidateFan,
    renderedCandidateSatelliteId,
    primaryServingRecord,
    candidateDisplayCellFrame,
    cinemaInterDisplayCellFrame,
    normalSatelliteWorldById: viz.coneApexWorldById,
    cinemaSatelliteWorldById: presentationSatelliteWorldById,
    placementByCellId: sinrLiveCellPlacementById,
    frequencyReuse: profile.beams.frequencyReuse,
    maxFanCones: sinrLiveBeamDisplayFrame.candidate.configuredBeamCount,
  });
  const { isInterPresentation: candidateIsInterPresentation, ...candidateConeGeometry } = candidateConeSelection;
  const { sinrLiveCandidateBeamConeItems } = useSinrLiveCandidateBeamConeItems({
    geometry: candidateConeGeometry,
    presentation: {
      candidateComparisonSceneActive,
      renderCandidateField: homepageSceneGeometryPolicy.renderCandidateField,
      homepageVisualIdentity,
      showSinrLiveCellBeams,
      hideCandidateFan: handoverDisplayIsolation.hideCandidateFan,
      showCinemaCandidateFan: handoverDisplayIsolation.showCinemaCandidateFan,
      isInterPresentation: candidateIsInterPresentation,
      handoverPhase: presentationHandoverEnvelope.phase,
      handoverToOpacity: presentationHandoverEnvelope.toOpacity,
      candidateFanConeOpacity: beamDisplaySpec.candidateFanConeOpacity,
      triggeredIntraPeakOpacity: beamDisplaySpec.triggeredIntraPeakOpacity,
      targetRole: handoverPresentation.targetRole,
      acceptedHandoverPresentation,
      restrictHomepageBeamItems: restrictSceneBeamItems,
    },
  });

  // Inter-only source fan: the pair owns the primary source cone, while this bounded
  // fan keeps the rest of the original serving satellite's beams visible until the
  // source side releases in legacy lanes. The homepage keeps the pair atomic: no
  // extra source fan is allowed to appear behind it.
  const { sinrLiveCinemaInterServingFanConeItems } = useSinrLiveCinemaInterServingFanConeItems({ acceptedHandoverPresentation, beamDisplaySpec, cinemaInterDisplayCellFrame, handoverDisplayIsolation, homepageVisualIdentity, presentationHandoverEnvelope, presentationSatelliteWorldById, presentedHandoverPairCandidate, profile, restrictHomepageBeamItems: restrictSceneBeamItems, runtime, showSinrLiveCellBeams, sinrLiveCellPlacementById });
  // W5 Beam-Info callouts: per-cell serving SINR (dB) keyed by cellId, for the
  // <Html> chips. Reads the cell model's own serving SINR — display-only.
  const sinrLiveCellServingSinrByCellId = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const cell of sim.sinrLiveCells?.cells ?? []) {
      map.set(cell.cellId, cell.servingSinrDb);
    }
    return map;
  }, [sim.sinrLiveCells]);
  const renderedSinrLiveCellBeamConeCount = sinrLiveCellBeamConeItems.length;
  const renderedSinrLiveCellBeamConeSatelliteCount = new Set(
    sinrLiveCellBeamConeItems.map(item => item.satId),
  ).size;
  // W9 step 3 — the DIM beam-hopping cells: the co-channel / secondary illuminated
  // beams (a sat lights a cell it is NOT the chosen server of — pure hopping coverage,
  // no UE served there) from the SEPARATE non-serving resolver (the serving resolver
  // stays serving-only for the s0/s4 must-holds). Drawn behind the bright serving fan
  // at the dim `nonServing` opacity, so on-UE (serving, bright) reads distinct from
  // hopping (non-serving, dim). Default → the SAME hero serving satellite's hopping cells
  // (its own fan's empty cells); the "Other beams" power-view (showNonServingCones)
  // opens every non-serving co-channel beam in the field. Display-only (Rule#6); the
  // showNonServingCones switch + the target-sat set are in the dep-array (the
  // invisible-dep-array bug fix), so toggling either re-renders.
  const { sinrLiveCellNonServingConeItems } = useSinrLiveCellNonServingConeItems({ acceptedHandoverPresentation, beamDisplaySpec, handoverDisplayIsolation, homepageVisualIdentity, restrictHomepageBeamItems: restrictSceneBeamItems, showSinrLiveCellBeams, sim, sinrLiveCellPlacementById, sinrLiveTargetSatIds, viz });
  // G2c ambient live-handover pulse: the real per-frame handovers the cell model
  // classified (`sim.sinrLiveCells.recentHandoverEvents`) → bright, age-faded cones
  // on each event's old/new cell. ALWAYS-ON on sinr-live (not director-gated) so the
  // sim playing forward shows continuous handovers with no seek/no camera. Uses the
  // serving-sat-COMPLETE apex map (`viz.coneApexWorldById`, like the ambient cones)
  // so a handover on any serving sat draws even beyond the display cap. Display-only
  // read-out of truth (Rule#6); the serving decision is unchanged.
  const { sinrLiveCellPulseConeItems, triggeredIntraConeItems, sinrLiveCinemaHandoverPairConeItems, authorityHandoverPairConeItems } = useHandoverConeItems({
    pulse: {
      policy: {
        enabled: showSinrLiveHandoverPulse,
        hideTimelinePulse: handoverDisplayIsolation.hideTimelinePulse,
        suppressNaturalHandoverLayers: handoverDisplayIsolation.suppressNaturalHandoverLayers,
        renderNaturalPulse: homepageSceneGeometryPolicy.renderNaturalPulse,
        homepageVisualIdentity,
        concurrentIntraVisualSuppressed,
        showOtherHandoverUes: beamDisplaySpec.showOtherHandoverUes,
        pulseFocusFollowsScope: beamDisplaySpec.pulseFocusFollowsScope,
      },
      frame: {
        recentHandoverEvents: sim.sinrLiveCells?.recentHandoverEvents,
        simTimeSec: sim.sinrLiveCells?.simTimeSec ?? 0,
      },
      geometry: {
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: viz.coneApexWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        focusSatIds: sinrLiveTargetSatIds,
        protagonistUeId: naturalHandoverProtagonistUeId,
        protagonistIntraBaseCenterOverride: homepageIntraCellAnchor,
      },
      output: {
        resolveSceneAcceptedBeamColor,
        restrictHomepageBeamItems: restrictSceneBeamItems,
      },
      // The comparison overlay is an identity SOURCE (ladder rung 0), supplied
      // to the ONE paint. It used to be applied as a SECOND paint downstream,
      // which discarded the accepted snapshot this lane had already resolved.
      // The pulse lane is steady state to the overlay: no handover shade.
      overlay: {
        centralOverlayActive: multiCandidateCentralOverlayActive,
        beamColorBySatelliteCell: multiCandidateBeamColorBySatelliteCell,
        laneKind: null,
      },
    },
    triggeredIntra: {
      policy: {
        enabled: showSinrLiveCellBeams,
        renderTriggeredIntra: homepageSceneGeometryPolicy.renderTriggeredIntra,
        homepageVisualIdentity,
        presentedCinemaHandoverActive,
        handoverActive: handoverPresentation.active,
        handoverEventSource: handoverPresentation.event?.source ?? null,
        handoverEventKind: handoverPresentation.event?.kind ?? null,
      },
      candidate: presentedHandoverPairCandidate,
      fallbackUeId: sceneFrame.ues[0]?.id,
      envelope: {
        fromOpacity: presentationHandoverEnvelope.fromOpacity,
        phase: presentationHandoverEnvelope.phase,
        toOpacity: presentationHandoverEnvelope.toOpacity,
      },
      triggeredIntraPeakOpacity: beamDisplaySpec.triggeredIntraPeakOpacity,
      geometry: {
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: presentationSatelliteWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        manualBaseCenterOverride: homepageIntraCellAnchor,
      },
      output: {
        resolveSceneAcceptedBeamColor,
        restrictHomepageBeamItems: restrictSceneBeamItems,
      },
      // The overlay shades this lane as one intra pair regardless of the
      // event's own kind — the lane's story, not the item's memory.
      overlay: {
        centralOverlayActive: multiCandidateCentralOverlayActive,
        beamColorBySatelliteCell: multiCandidateBeamColorBySatelliteCell,
        laneKind: 'intra',
      },
    },
    cinemaPair: {
      policy: {
        enabled: showSinrLiveCellBeams,
        homepageVisualIdentity,
        renderCinemaPair: homepageSceneGeometryPolicy.renderCinemaPair,
        handoverActive: handoverPresentation.active,
        presentedInterHandoverActive,
        presentedCinemaHandoverActive,
        handoverEventKind: handoverPresentation.event?.kind ?? null,
      },
      candidate: presentedHandoverPairCandidate,
      envelope: {
        fromOpacity: presentationHandoverEnvelope.fromOpacity,
        phase: presentationHandoverEnvelope.phase,
        toOpacity: presentationHandoverEnvelope.toOpacity,
      },
      triggeredIntraPeakOpacity: beamDisplaySpec.triggeredIntraPeakOpacity,
      geometry: {
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: presentationSatelliteWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        homepageIntraCellAnchor,
        manualHandoverGroundTarget,
      },
      output: {
        resolveSceneAcceptedBeamColor,
        restrictHomepageBeamItems: restrictSceneBeamItems,
      },
      // The overlay takes the presented pair's own kind for this lane, which is
      // the same candidate object the resolver already reads.
      overlay: {
        centralOverlayActive: multiCandidateCentralOverlayActive,
        beamColorBySatelliteCell: multiCandidateBeamColorBySatelliteCell,
        laneKind: presentedHandoverPairCandidate?.kind ?? null,
      },
    },
    authorityPair: {
      policy: {
        enabled: showSinrLiveCellBeams,
        centralOverlayActive: multiCandidateCentralOverlayActive,
        identityTransitionActive: multiCandidateIdentityTransitionActive,
        handoverActive: handoverPresentation.active,
        homepageVisualIdentity,
        renderAuthorityPair: homepageSceneGeometryPolicy.renderAuthorityPair,
        authorityPresentationCommitObserved,
      },
      candidate: presentedHandoverPairCandidate,
      envelope: {
        fromOpacity: presentationHandoverEnvelope.fromOpacity,
        phase: presentationHandoverEnvelope.phase,
        toOpacity: presentationHandoverEnvelope.toOpacity,
      },
      beamColorBySatelliteBeam: multiCandidateBeamColorBySatelliteBeam,
      geometry: {
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: viz.coneApexWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        homepageIntraCellAnchor,
        manualHandoverGroundTarget,
      },
      output: {
        resolveSceneAcceptedBeamColor,
        restrictHomepageBeamItems: restrictSceneBeamItems,
      },
    },
  });
  // Manual and naturally observed Walker/TLE events share the coordinator's
  // single latched pair. Incoming events cannot restart this envelope; they are
  // presentation-suppressed until the active story and cooldown have finished.

  // Focused cinema pair: the candidate detail is already resolved from the live
  // handover index, so draw its exact old/new cell cones above the ordinary field.
  // The acquired side stays visible after the narrated transition while the focus
  // remains armed; this keeps the final handover state readable instead of ending
  // on an empty viewport. Display-only; no simulation record is changed.

  const latchedAuthorityTransition = useMemo<AuthorityHandoverTransition | null>(() => resolveLatchedAuthorityTransition({
    multiCandidateCentralOverlayActive,
    multiCandidateIdentityTransitionActive,
    presentationActive: handoverPresentation.active,
    presentationEvent: handoverPresentation.event,
    authorityTransition: authorityTransitionRef.current,
    authorityPresentationCommitObserved,
  }), [
    handoverPresentation.active,
    handoverPresentation.event,
    handoverPresentation.phase,
    authorityPresentationCommitObserved,
    multiCandidateCentralOverlayActive,
    multiCandidateIdentityTransitionActive,
    authorityTransition?.eventId,
    authorityTransition?.sourceFrameId,
  ]);
  // One render-only admission gate for the existing event cue. It joins the
  // accepted transition to the already-active wall-clock presentation and
  // current decision phase; it does not create a transition or advance time.
  const handoverEventCuePolicy = resolveHandoverEventCuePolicy({
    transition: latchedAuthorityTransition,
    phase: acceptedHandoverDecisionFrame?.phase ?? null,
    presentationOwner: handoverPresentation.event?.source === 'manual'
      ? 'manual'
      : handoverPresentation.event?.source === 'cinema'
        ? 'cinema'
        : handoverPresentation.event === null ? null : 'natural',
    presentationView: handoverPresentation,
  });
  const {
    pulseItems: additiveHandoverPulseConeItems,
    triggeredIntraItems: additiveTriggeredIntraConeItems,
    cinemaPairItems: additiveCinemaHandoverPairConeItems,
  } = useMemo(
    () => resolveAdditiveHandoverConeColoring({
      pulseItems: sinrLiveCellPulseConeItems,
      triggeredIntraItems: triggeredIntraConeItems,
      cinemaPairItems: sinrLiveCinemaHandoverPairConeItems,
      centralOverlayActive: multiCandidateCentralOverlayActive,
      authorityPresentationCommitObserved,
      beamColorBySatelliteCell: multiCandidateBeamColorBySatelliteCell,
      presentationPairKind: presentedHandoverPairCandidate?.kind,
    }),
    [
      authorityPresentationCommitObserved,
      multiCandidateBeamColorBySatelliteCell,
      multiCandidateCentralOverlayActive,
      presentedHandoverPairCandidate?.kind,
      sinrLiveCellPulseConeItems,
      sinrLiveCinemaHandoverPairConeItems,
      triggeredIntraConeItems,
    ],
  );
  // Beam Info is an explicit inspection control. During an inter story the
  // ordinary serving field is intentionally isolated, so using only
  // `sinrLiveCellBeamConeItems` made the toggle appear to stop working exactly
  // when the user needed to identify the two handover beams. Prefer the
  // currently rendered presentation pair (or the triggered intra pair), then
  // fill with the ordinary serving fan. Deduplicate by satellite/cell so one
  // label still corresponds to one visible beam rather than stacking callouts
  // from overlapping display layers.
  const beamInfoItemsInput = useMemo<BeamInfoItemsInput<SinrLiveCellBeamConeRenderItem>>(
    () => ({
      layers: {
        additiveCinemaHandoverPair: additiveCinemaHandoverPairConeItems,
        additiveTriggeredIntra: additiveTriggeredIntraConeItems,
        authorityHandoverPair: authorityHandoverPairConeItems,
        serving: sinrLiveCellBeamConeItems,
      },
      presentation: {
        homepageVisualIdentity,
        multiCandidateCentralOverlayActive,
        multiCandidateIdentityTransitionActive,
        active: handoverPresentation.active,
        event: handoverPresentation.event,
      },
    }),
    [
      additiveCinemaHandoverPairConeItems,
      additiveTriggeredIntraConeItems,
      authorityHandoverPairConeItems,
      handoverPresentation.active,
      handoverPresentation.event,
      homepageVisualIdentity,
      multiCandidateCentralOverlayActive,
      multiCandidateIdentityTransitionActive,
      sinrLiveCellBeamConeItems,
    ],
  );
  const { beamInfoItems } = useBeamInfoItems({ beamInfoItemsInput });
  const teachingSurfaceReady = teachingSurfaceProjection !== null
    && teachingSurfaceProjectionRef !== undefined;
  const coreSceneSurfacePlan = resolveCoreSceneSurfacePlan({
    stage: {
      ambientBeams: presentationPlan.visible['ambient-beams'],
      servingBeams: presentationPlan.visible['serving-beams'],
      candidateBeams: presentationPlan.visible['candidate-beams'],
      eventEffects: presentationPlan.visible['event-effects'],
      servingFootprints: presentationPlan.visible['serving-footprints'],
      candidateFootprints: presentationPlan.visible['candidate-footprints'],
    },
    runtime: {
      showSinrLiveCellBeams,
      showBeamCallouts,
      teachingLectureActive: runtime.teachingLectureKind != null,
    },
    story: {
      homepageVisualIdentity,
      multiCandidateSceneVisualActive,
      multiCandidateCentralOverlayActive,
      multiCandidateIdentityTransitionActive,
      handoverPresentationActive: handoverPresentation.active,
      candidateReviewActive: candidateComparisonSceneActive,
    },
    isolation: {
      active: handoverDisplayIsolation.active,
      hideNormalBeamField: handoverDisplayIsolation.hideNormalBeamField,
      preserveConfiguredServingFan: handoverDisplayIsolation.preserveConfiguredServingFan,
    },
    inventory: {
      nonServingConeCount: sinrLiveCellNonServingConeItems.length,
      cinemaInterServingFanConeCount: sinrLiveCinemaInterServingFanConeItems.length,
      candidateConeCount: sinrLiveCandidateBeamConeItems.length,
      pulseConeCount: additiveHandoverPulseConeItems.length,
      triggeredIntraConeCount: additiveTriggeredIntraConeItems.length,
      cinemaPairConeCount: additiveCinemaHandoverPairConeItems.length,
      authorityTransitionConeCount: authorityHandoverPairConeItems.length,
      beamInfoCount: beamInfoItems.length,
      teachingReady: teachingSurfaceReady,
    },
  });
  const multiCandidateEventCueCount = (multiCandidateCentralOverlayActive || multiCandidateIdentityTransitionActive)
    ? (
      presentationPlan.visible['event-effects'] && handoverEventCuePolicy.drawable
        ? 1
        : 0
    )
    : 0;
  const multiCandidateSceneRenderReceipt = useMemo(() => (
    acceptedHandoverPresentation === null
      || !multiCandidateSnapshotMatchesFrame
      || multiCandidateSceneRenderPlan === null
      || !isCandidateSceneRenderReceiptReady(
        acceptedHandoverPresentation,
        multiCandidateSceneRenderPlan,
      )
      ? null
      : buildCandidateSceneRenderReceipt({
        snapshot: acceptedHandoverPresentation,
        renderPlan: multiCandidateSceneRenderPlan,
        eventCueCount: multiCandidateEventCueCount,
      })
  ), [
    acceptedHandoverPresentation,
    handoverEventCuePolicy.drawable,
    multiCandidateEventCueCount,
    multiCandidateSceneRenderPlan,
    multiCandidateSnapshotMatchesFrame,
  ]);
  const multiCandidateCandidateReviewSceneRenderReceipt = useMemo(() => (
    acceptedHandoverPresentation === null
      || !multiCandidateSnapshotMatchesFrame
      || multiCandidateCandidateReviewRenderPlan === null
      || !isCandidateSceneRenderReceiptReady(
        acceptedHandoverPresentation,
        multiCandidateCandidateReviewRenderPlan,
      )
      ? null
      : buildCandidateSceneRenderReceipt({
        snapshot: acceptedHandoverPresentation,
        renderPlan: multiCandidateCandidateReviewRenderPlan,
        eventCueCount: 0,
      })
  ), [
    acceptedHandoverPresentation,
    multiCandidateCandidateReviewRenderPlan,
    multiCandidateSnapshotMatchesFrame,
  ]);
  // The parked legacy overlay is intentionally null, but the additive review
  // layer is still a real scene acknowledgement. Telemetry/status must follow
  // whichever projection is actually mounted or the browser gate would report
  // `missing-scene-plan` while the candidate links are visibly rendered.
  const mountedMultiCandidateSceneRenderPlan = candidateComparisonSceneActive
    ? multiCandidateCandidateReviewRenderPlan
    : multiCandidateSceneRenderPlan;
  const multiCandidateSceneRenderStatus = resolveMultiCandidateSceneRenderStatus({
    hasAcceptedSnapshot: acceptedHandoverPresentation !== null,
    sourceFrameMatches: multiCandidateSnapshotMatchesFrame,
    decisionPhase: acceptedHandoverPresentation?.phase ?? null,
    hardEligibleCount: acceptedHandoverPresentation?.counts.hardEligible ?? 0,
    comparisonPhase: multiCandidateComparisonPhase,
    hasScenePlan: mountedMultiCandidateSceneRenderPlan !== null,
    unmappedPairCount: mountedMultiCandidateSceneRenderPlan?.unmappedPairs.length ?? 0,
  });
  // Keep the marker roles aligned with the anchored inter shot while the live
  // simulation is being rebuilt at the selected event lead-in. This is a
  // presentation identity only; the right rail and the published serving truth
  // continue to read the live frame unchanged.
  const cinemaDisplaySatelliteIds = resolveCinemaDisplaySatelliteIds({
    presentedInterHandoverActive,
    presentedHandoverPairCandidate,
    targetRole: handoverPresentation.targetRole,
    servingSatelliteId: sceneFrame.metrics.servingSatelliteId,
    renderedCandidateSatelliteId,
  });
  const cinemaDisplayServingSatId = cinemaDisplaySatelliteIds.servingSatelliteId;
  const cinemaDisplayCandidateSatId = cinemaDisplaySatelliteIds.candidateSatelliteId;
  const sinrLiveCellTelemetry = resolveSinrLiveCellTelemetry({
    showSinrLiveCellBeams,
    servedCellCount: sim.sinrLiveCells?.servedCellCount,
    ues: sim.sinrLiveCells?.ues,
  });
  const sinrLiveCellServedCount = sinrLiveCellTelemetry.servedCellCount;
  const sinrLiveCellUeOffAxisMaxDeg = sinrLiveCellTelemetry.ueOffAxisMaxDeg;
  const homepageEeProgressVisible = resolveHomepageEeProgressVisible({
    homepageVisualIdentity,
    multiCandidateCentralOverlayActive,
    multiCandidateIdentityTransitionActive,
    handoverPresentationActive: handoverPresentation.active,
  });
  const cinematicSpotlightActive = showCinematicSpotlight;
  const cinematicSpotlightTargets = useMemo(
    () => resolveCinematicSpotlightTargets({
      satBeams: viz.satBeams,
      cinematicMode: effectiveCinematicMode,
    }),
    [effectiveCinematicMode, viz.satBeams],
  );

  useLayoutEffect(() => {
    const command = runtime.cameraCommand;
    if (!command || lastCameraCommandAtRef.current === command.issuedAtMs) return;

    lastCameraCommandAtRef.current = command.issuedAtMs;
    lastCameraPresetRef.current = command.preset;
    // CQ1: a manual camera preset supersedes any running focus orbit so the orbit
    // cannot resume around the stale focus centre after the preset tween lands.
    directorFocusOrbitRef.current = null;

    const presetPose = cameraPresets[command.preset];
    const controls = controlsRef.current;
    const toPosition = new THREE.Vector3(...presetPose.position);
    const toTarget = new THREE.Vector3(...presetPose.target);
    const currentTarget = controls?.target.clone() ?? new THREE.Vector3();

    if (runtime.reducedMotion) {
      cameraTweenRef.current = null;
      applyCameraPose(command.preset, 'idle');
      return;
    }

    cameraTweenRef.current = {
      preset: command.preset,
      kind: 'preset',
      startedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
      fromPosition: camera.position.clone(),
      fromTarget: currentTarget,
      toPosition,
      toTarget,
    };
    cameraPresetRef.current = command.preset;
    cameraTransitionRef.current = 'animating';
  }, [camera, runtime.cameraCommand, runtime.reducedMotion, cameraPresets]);

  useLayoutEffect(() => {
    const command = runtime.directorFocusCommand;
    if (!command || lastDirectorCommandAtRef.current === command.issuedAtMs) return;

    // Rule#8 / §5.4: the Director is inert on lanes the render plan did not
    // mark as director, so stale commands cannot fire later on replay lanes.
    if (effectiveCinematicMode !== 'director') {
      lastDirectorCommandAtRef.current = command.issuedAtMs;
      return;
    }

    // 運鏡 PARK (LIVE_CINEMATIC_CAMERA_ENABLED): suppress the live Director camera
    // MOTION (acquire/restore tween + orbit) while leaving the director FSM, the
    // candidate highlight, the seek, and the slow-mo intact — so the Intra/Inter-HO
    // buttons show the handover effect IN PLACE. Consume the command (advance the
    // de-dup ref) so the one-shot stays consistent; flip the flag to restore the move.
    if (!LIVE_CINEMATIC_CAMERA_ENABLED) {
      lastDirectorCommandAtRef.current = command.issuedAtMs;
      return;
    }

    // Shared acquire/restore FSM (see applyDirectorFocusCommand). The live lane
    // also mirrors the camera-preset telemetry refs the artifact hook does not
    // track — `onTransition` maps each FSM transition to that telemetry exactly as
    // the prior inline copy did.
    applyDirectorFocusCommand({
      command,
      camera,
      controls: controlsRef.current,
      sceneFrame,
      alpha,
      reducedMotion: runtime.reducedMotion,
      nowMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
      lastCommandAtRef: lastDirectorCommandAtRef,
      snapshotRef: directorSnapshotRef,
      tweenRef: cameraTweenRef,
      orbitRef: directorFocusOrbitRef,
      onTransition: (transition) => {
        if (transition === 'acquire-applied' || transition === 'acquire-tween' || transition === 'restore-applied') {
          cameraPresetRef.current = 'manual';
        }
        cameraTransitionRef.current = transition === 'acquire-tween' || transition === 'restore-tween'
          ? 'animating'
          : 'idle';
      },
    });
  }, [
    camera,
    runtime.directorFocusCommand,
    runtime.reducedMotion,
    effectiveCinematicMode,
    sceneFrame.ues,
    alpha,
  ]);

  useEffect(() => {
    if (effectiveCinematicMode === 'director') return;
    forceRestoreDirectorFocus({
      camera,
      controls: controlsRef.current,
      snapshotRef: directorSnapshotRef,
      tweenRef: cameraTweenRef,
      orbitRef: directorFocusOrbitRef,
      onRestored: () => { cameraTransitionRef.current = 'idle'; },
    });
  }, [camera, effectiveCinematicMode]);

  useFrame(() => {
    const tween = cameraTweenRef.current;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    if (!tween) {
      // CQ1: between acquire-land and restore, gently orbit the focus subject so the
      // cinema reads as cinematography, not a frozen zoom (display-only motion).
      const orbit = directorFocusOrbitRef.current;
      if (orbit && !runtime.reducedMotion) {
        advanceDirectorFocusOrbit({ camera, controls: controlsRef.current, orbit, nowMs });
        return;
      }
      // While the Director holds the camera (snapshot set), suppress the
      // reduced-motion re-pin to the last preset — otherwise it would overwrite
      // the focus/restore pose every frame and undo the focus instantly.
      if (runtime.reducedMotion && lastCameraPresetRef.current && directorSnapshotRef.current === null) {
        applyCameraPose(lastCameraPresetRef.current, 'idle');
      }
      return;
    }

    const progress = Math.min(Math.max(
      (nowMs - tween.startedAtMs) / (tween.durationMs ?? CAMERA_TWEEN_DURATION_MS),
      0,
    ), 1);
    const eased = easeInOutCubic(progress);
    const controls = controlsRef.current;

    camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
    if (controls) {
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      controls.update();
    }

    if (progress >= 1) {
      camera.position.copy(tween.toPosition);
      controls?.target.copy(tween.toTarget);
      controls?.update();
      cameraTweenRef.current = null;
      if (tween.kind === 'director-restore') {
        if (controls) controls.enabled = true;
        directorSnapshotRef.current = null;
        directorFocusOrbitRef.current = null;
        cameraPresetRef.current = 'manual';
      } else if (tween.kind === 'director-acquire') {
        cameraPresetRef.current = 'manual';
        // CQ1: start the continuous focus orbit from the landed acquire pose.
        if (!runtime.reducedMotion && controls) {
          directorFocusOrbitRef.current = {
            center: controls.target.clone(),
            baseOffset: camera.position.clone().sub(controls.target),
            startedAtMs: nowMs,
          };
        }
      } else if (tween.kind === 'preset') {
        cameraPresetRef.current = tween.preset;
      } else {
        cameraPresetRef.current = 'manual';
      }
      cameraTransitionRef.current = 'idle';
      return;
    }

    if (tween.kind === 'preset') cameraPresetRef.current = tween.preset;
    cameraTransitionRef.current = 'animating';
  });

  const acceptedHandoverCueColors = resolveHandoverOverlayCueColors({
    centralOverlayActive: multiCandidateCentralOverlayActive,
    beamColorBySatelliteCell: multiCandidateBeamColorBySatelliteCell,
    neutralColor: HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
    source: latchedAuthorityTransition === null
      ? null
      : {
        satelliteId: latchedAuthorityTransition.from.satelliteId,
        cellId: cellIdFromLinkBudgetBeamId(latchedAuthorityTransition.from.beamId),
      },
    target: latchedAuthorityTransition === null
      ? null
      : {
        satelliteId: latchedAuthorityTransition.to.satelliteId,
        cellId: cellIdFromLinkBudgetBeamId(latchedAuthorityTransition.to.beamId),
      },
    resolveAcceptedCellColor: resolveSceneAcceptedCellColor,
  });
  const handoverToastCopy = resolveHandoverToastCopy({
    homepageVisualIdentity,
    presentationActive: multiCandidateCentralOverlayActive || multiCandidateIdentityTransitionActive,
    presentationKind: handoverPresentation.event?.kind ?? null,
    presentationPhase: handoverPresentation.phase,
    authorityPresentationCommitObserved,
    forcedContinuity: canonicalHandoverEvent?.event === 'forced-continuity',
    forcedContinuityReason: canonicalHandoverEvent?.event === 'forced-continuity'
      ? canonicalHandoverEvent.reason
      : undefined,
  });
  const localPresentationStoryFrame = resolvePresentationHandoverStoryFrame({
    view: handoverPresentation,
  });
  const sceneHandoverBoundaryInput = {
    lane: simSource === 'archived-tle' ? 'archived-tle' : 'live',
    localPresentation: localPresentationStoryFrame,
    sharedBindings: handoverSurfaceBindings,
  } as const;
  const sceneHandoverStoryFrames = resolveBoundSceneHandoverStoryFrameSet(
    sceneHandoverBoundaryInput,
  );
  const sceneHandoverSurfaceBindings = resolveBoundSceneHandoverSurfaceBindingSet(
    sceneHandoverBoundaryInput,
  );
  const sceneRenderPlan = resolveSceneRenderPlan({
    lane: simSource === 'archived-tle' ? 'archived-tle' : 'live',
    presentation: presentationPlan,
    storyFrames: sceneHandoverStoryFrames,
    corePlan: coreSceneSurfacePlan,
    controls: {
      campusVisible,
      showHorizonBoundary: sceneLane === 'sinr-live',
      showUav,
      afterFirstPaint,
      showOrbitTrail,
      showSpineParticles,
      showGroundRipple,
      showLiveSatelliteMarkers,
      showSinrLiveCellBeams,
      showLiveSceneEffects,
      showSceneOverlays,
      showHandoverToastOverlay,
      homepageVisualIdentity,
      showFpsCounter: showArtifactFpsCounter,
      cinematicSpotlightActive,
      narrativeCaptionEnabled: narrativeCaptionActive,
    },
    story: {
      suppressNaturalHandoverLayers: handoverDisplayIsolation.suppressNaturalHandoverLayers,
      hideTimelineEffects: handoverDisplayIsolation.hideTimelineEffects,
      concurrentIntraVisualSuppressed,
      multiCandidateSceneLayerVisible,
      candidateComparisonSceneActive,
      multiCandidateCentralOverlayActive,
      multiCandidateIdentityTransitionActive,
      acceptedCueHasTransition: latchedAuthorityTransition !== null,
      handoverEventCueDrawable: handoverEventCuePolicy.drawable,
      handoverPresentationActive: handoverPresentation.active,
      handoverPresentationHasEvent: handoverPresentation.event !== null,
      manualHandoverPresentationActive,
      manualHandoverHasEvent: manualHandoverEvent !== null,
    },
    inventory: {
      visibleSatelliteCount: renderedLiveSatelliteMarkers.length,
      visibleUeCount: displayedUes.filter(ue => ue.worldPos !== undefined).length,
      narrativeCaptionPresent: narrativeCaption !== null,
    },
  });

  return (
    <BaseSceneLayout
      sceneConfig={sceneConfig}
      controlsRef={controlsRef}
      campusVisible={sceneRenderPlan.surfaces['ground.campus'].visible}
      cinematicSpotlightActive={sceneRenderPlan.surfaces['scene.cinematic-spotlight'].visible}
      effectiveCinematicMode={effectiveCinematicMode}
      cinematicSpotlightTargets={sceneRenderPlan.surfaces['scene.cinematic-spotlight'].visible
        ? cinematicSpotlightTargets
        : []}
    >
      {sceneRenderPlan.surfaces['ground.teaching-floor'].mounted && <TeachingFloor />}
      <ScenePresentationCanvasTelemetry
        plan={presentationPlan}
        surfacePlan={coreSceneSurfacePlan}
      />
      <SceneRenderPlanCanvasTelemetry plan={sceneRenderPlan} />
      <SceneHandoverStoryCanvasTelemetry
        frameSet={sceneHandoverStoryFrames}
        lane={simSource === 'archived-tle' ? 'archived-tle' : 'live'}
        sharedBindingsRef={handoverSurfaceBindingsRef}
        instructorTransportRef={instructorHandoverSnapshotRef}
        studentActivityStateRef={studentHandoverActivityStateRef}
      />
      <SceneTelemetry
        visibleSatelliteCount={renderedLiveSatelliteMarkers.length}
        firstSatellitePosition={renderedLiveSatelliteMarkers[0]
          ? formatCameraVector(renderedLiveSatelliteMarkers[0].world)
          : ''}
        servingSatelliteId={sceneFrame.metrics.servingSatelliteId}
        servingBeamId={sceneFrame.metrics.servingBeamId}
        beamCalloutsEnabled={showBeamCallouts ? '1' : '0'}
        simTimeSec={sceneFrame.tSec}
        appMode={runtime.appMode}
        sceneLaneSourceCompatible={renderPlan.sourceCompatible ? '1' : '0'}
        liveSimulationEnabled={simSource === 'live' ? '1' : '0'}
        ueMarkerShape={ueMarkerShape}
        uavVisible={showUav ? '1' : '0'}
        uePrimaryAnchorMode={runtime.uePrimaryAnchorMode ?? 'observer'}
        firstUePosition={formatScenePosition(sceneFrame.ues[0]?.worldPos)}
        otherHandoverFilterEnabled={beamDisplaySpec.showOtherHandoverUes ? '1' : '0'}
        otherHandoverPendingUeCount={pendingOtherHandoverUeCount}
        otherHandoverSelectedUeCount={selectedOtherHandoverUeIds.size}
        otherHandoverCueUeCount={displayedUes.filter(u => u.isOtherHandover === true).length}
        otherHandoverSelectedUeIds={Array.from(selectedOtherHandoverUeIds).join(',')}
        renderedUeCount={displayedUes.filter(u => u.worldPos !== undefined).length}
        beamLoadContentionUeCount={0}
        visualSatelliteAltitude={String(sceneGeometry.visualSatelliteAltitude ?? '')}
        beamSatelliteCount={
          showSinrLiveCellBeams
            // S-cells-3: on the sinr-live lane the cell-truth cones REPLACE
            // the steered SatelliteBeams, so report the satellite count from
            // the cones that actually render (keeps the attr honest).
            ? renderedSinrLiveCellBeamConeSatelliteCount
            : viz.satBeams.size
        }
        sceneSource={sceneFrame.sceneSource}
        beamConeCount={
          showSinrLiveCellBeams
            // S-cells-3: on the sinr-live lane the cell-truth cones REPLACE the
            // steered SatelliteBeams, so report the cones that actually render
            // (keeps this attr honest — it is not the suppressed steered count).
            ? renderedSinrLiveCellBeamConeCount
            : showLiveBeamCones
              ? [...viz.satBeams.values()].reduce((count, beams) => count + beams.length, 0)
              : 0
        }
        cellOverlaySlotIndex=""
        cellOverlayActiveCount=""
        cellOverlayIdleCount=""
        cellOverlayCellCount=""
        cellServingCount=""
        cellVisibleCount=""
        cellHoReassignmentCount=""
        cellHoInterCount=""
        cellHoIntraCount=""
        cellBeamConeCount=""
        cellBeamConeScope=""
        cellBeamConeSatelliteCount=""
        sinrLiveCellBeamConeCount={showSinrLiveCellBeams ? String(renderedSinrLiveCellBeamConeCount) : ''}
        sinrLiveCellServingSatCount={showSinrLiveCellBeams ? String(renderedSinrLiveCellBeamConeSatelliteCount) : ''}
        sinrLiveCellServedCount={showSinrLiveCellBeams ? String(sinrLiveCellServedCount) : ''}
        sinrLiveCellUeOffAxisMaxDeg={showSinrLiveCellBeams ? sinrLiveCellUeOffAxisMaxDeg.toFixed(3) : ''}
        sinrLiveHandoverPulseConeCount={showSinrLiveHandoverPulse ? String(sinrLiveCellPulseConeItems.length) : ''}
        multiCandidateAuthorityActive={multiCandidateAuthorityActive ? '1' : '0'}
        multiCandidateDecisionPhase={acceptedHandoverDecisionFrame?.phase ?? ''}
        multiCandidateRenderedPairCount={String(
          multiCandidateSceneRenderPlan?.telemetry.renderedPairCount ?? 0
        )}
        multiCandidateSceneGlobalSolidDataLinkCount={String(
          multiCandidateSceneRenderPlan?.solidDataLinkCount
            ?? acceptedHandoverPresentation?.activeDataLinkCount
            ?? 0
        )}
        multiCandidateCarrierFallbackActive={
          multiCandidateCentralOverlayActive && !multiCandidateServingCarrierRenderable ? '1' : '0'
        }
        multiCandidateEventCueCount={String(multiCandidateEventCueCount)}
        multiCandidateSceneRenderStatus={multiCandidateSceneRenderStatus}
        liveDecisionEpisodeId={acceptedHandoverDecisionFrame?.episodeId ?? ''}
        liveDecisionSourceFrameId={acceptedHandoverDecisionFrame?.sourceFrameId ?? ''}
        liveDecisionSimTimeMs={acceptedHandoverDecisionFrame?.simTimeMs ?? ''}
        liveDecisionServingKey={acceptedHandoverDecisionFrame?.serving
          ? `${acceptedHandoverDecisionFrame.serving.satelliteId}:${acceptedHandoverDecisionFrame.serving.beamId}`
          : ''}
        liveDecisionCommitTo={acceptedHandoverDecisionFrame?.recentCommit
          ? `${acceptedHandoverDecisionFrame.recentCommit.to.satelliteId}:${acceptedHandoverDecisionFrame.recentCommit.to.beamId}`
          : ''}
        acceptedSnapshotEpochToken={acceptedHandoverPresentation?.epochToken ?? ''}
        acceptedSnapshotServingKey={acceptedHandoverPresentation?.serving
          ? `${acceptedHandoverPresentation.serving.key.satelliteId}:${acceptedHandoverPresentation.serving.key.beamId}`
          : ''}
        handoverPresentationActive={handoverPresentation.active ? '1' : '0'}
        handoverPresentationSource={handoverPresentationSource ?? ''}
        handoverPresentationKind={handoverPresentation.event?.kind ?? ''}
        handoverPresentationPhase={handoverPresentation.phase ?? ''}
        handoverAutoSlowActive={handoverPresentation.autoSlowActive ? '1' : '0'}
        handoverDisplayIsolationActive={handoverDisplayIsolation.active ? '1' : '0'}
        beamBudgetGlobal={String(sinrLiveBeamDisplayFrame.globalBeamCount)}
        beamBudgetServing={String(sinrLiveBeamDisplayFrame.serving.configuredBeamCount)}
        beamBudgetCandidate={String(sinrLiveBeamDisplayFrame.candidate.configuredBeamCount)}
        beamHoppingEnabled={sinrLiveBeamDisplayFrame.beamHoppingEnabled ? '1' : '0'}
        handoverStoryLayer={handoverStoryLayerPolicy}
        handoverStoryVisible="0"
        handoverStorySource=""
        handoverStoryNotBaselineProof="0"
        handoverStoryEventCount={0}
        handoverStoryAggregateEventCount={0}
        handoverStoryActiveCount={0}
        handoverStoryInactiveCount={0}
        handoverStoryNextCount={0}
        cameraPresetRef={cameraPresetRef}
        cameraTransitionRef={cameraTransitionRef}
        controlsRef={controlsRef}
      />
      <SceneHorizonBoundary
        visible={sceneRenderPlan.surfaces['ground.horizon-boundary'].visible}
        satellites={viz.displaySats}
      />
      <SceneNarrativeCaption
        caption={narrativeCaption}
        enabled={sceneRenderPlan.surfaces['annotation.narrative-caption'].visible}
        storyBinding={sceneHandoverSurfaceBindings.accepted}
        storyBindingsRef={handoverSurfaceBindingsRef}
      />
      {sceneRenderPlan.surfaces['ground.uav'].mounted && (
        <Suspense fallback={null}>
          <UAV position={[sim.ueGroundX, 10, sim.ueGroundZ]} scale={10} />
        </Suspense>
      )}

      <SceneGroundUeLayer
        visible={sceneRenderPlan.surfaces['ground.ues'].visible}
        ues={displayedUes}
        marker={{
          markerMultiplier: visualScaleMultipliers.ueMarkerMultiplier,
          markerShape: ueMarkerShape,
          trailHistory: ueTrailHistory,
          trailVisible: presentationPlan.visible['motion-guides'],
          secondaryOpacity: 1.0,
          secondaryScale: 1.0,
          colorTelemetryAttr: sinrServingTelemetryActive
            ? 'sinrServingMosaicColorCount'
            : undefined,
        }}
        appearance={{
          sinrServingColorById: sinrServingColorById,
          beamLoadContention: EMPTY_BEAM_LOAD_CONTENTION,
          beamLoadContentionEnabled: false,
          loadOverlaysVisible: presentationPlan.visible['load-overlays'],
          eventEffectsVisible: presentationPlan.visible['event-effects'],
          homepageVisualIdentity: homepageVisualIdentity === true,
        }}
      />
      {/* S-cells-4d: the old 20-hex green-disc paint is retired. The legacy SINR
          ground reference is restored below as fixed six-sided cells, while the
          satellite projection ellipses remain a separate moving-shape layer. */}
      {/* beam-stage ① #3: the legacy steered AmbientFootprintRings (rings at `viz.ambientRings`
          = steered beam ground positions) is RETIRED — those sat at the wrong geometry vs the
          earth-fixed cell centres, so they were misaligned with the cones + UE membership (the
          lattice-phase ① shift widened the gap). The cell-truth footprint rings now render with
          the serving cones below (`SinrLiveCellFootprintRings`, gated showSinrLiveCellBeams). */}
      <SceneHandoverMotionLayers
        reducedMotion={runtime.reducedMotion}
        orbitTrail={{
          mounted: sceneRenderPlan.surfaces['motion.orbit-trail'].mounted,
          satellites: orbitTrailSatellites,
        }}
        spineParticles={{
          mounted: sceneRenderPlan.surfaces['motion.spine-particles'].mounted,
          satellites: viz.displaySats,
          satBeams: viz.satBeams,
          plans: multiCandidateCentralOverlayActive
            ? multiCandidateAuthoritySpineParticlePlans
            : sinrLiveCellTruthSpineParticlePlans,
        }}
        groundRipple={{
          mounted: sceneRenderPlan.surfaces['motion.ground-ripple'].mounted,
          satBeams: viz.satBeams,
          footprintRadius: viz.footprintRadiusWorld,
          servingEnabled: runtime.effectsEnabled.servingRipple,
          pendingEnabled: !multiCandidateCentralOverlayActive && runtime.effectsEnabled.pendingRipple,
          identityColorBySatelliteId: multiCandidateSatelliteColorById,
          identityColorBySatelliteBeamId: liveBeamIdentityColorBySatelliteBeam,
          paused,
          reducedMotion: runtime.reducedMotion,
          recentHoActive: recentHoActive && !handoverDisplayIsolation.hideTimelineEffects,
        }}
      />

      <SceneSatelliteMarkerLayer
        satellites={renderedLiveSatelliteMarkers}
        visibility={{
          mounted: sceneRenderPlan.surfaces['satellite.markers'].mounted,
          selectedSatellite: presentationPlan.visible['selected-satellite'],
          candidateSatellite: presentationPlan.visible['candidate-satellite'],
          contextSatellites: presentationPlan.visible['context-satellites'],
          centralMarkerSatelliteIds: multiCandidateCentralMarkerSatelliteIds,
        }}
        identity={{
          constellation,
          eventRoles: viz.eventRoles,
          multiCandidateColorById: multiCandidateSatelliteColorById,
          homepageNameById: homepageSatelliteNameById,
        }}
        labels={{
          candidateLabelActive: satelliteCandidateLabelActive,
          candidateOrdinalBySatelliteId: candidateComparisonOrdinalBySatelliteId,
          candidateVisibleSatelliteIds: satelliteCandidateLabelVisibleSatelliteIds,
          teachingLabelSatelliteIds,
          selectedLayerSatelliteId: cinemaDisplayServingSatId,
          candidateLayerSatelliteId: cinemaDisplayCandidateSatId,
          homepageLabelActive: homepageSatelliteLabelActive,
          homepageEeProgressById: homepageSatelliteEeProgressById,
          homepageEeProgressVisible: homepageEeProgressVisible,
          handoverMarkerSatelliteIds,
          heroSatelliteId: displayHeroRecord?.servingSatId,
          candidateEeSatelliteId: renderedCandidateSatelliteId,
        }}
        emphasis={{
          multiCandidateSceneVisualActive,
          candidateComparisonSceneActive,
          candidateComparisonVisibleSatelliteIds,
          liveSource: simSource === 'live',
        }}
      />
      <SceneMultiCandidateLayer
        context={{
          placementByCellId: sinrLiveCellPlacementById,
          satelliteWorldById: viz.coneApexWorldById,
          primaryUeWorld: sceneFrame.ues[0]?.worldPos ?? null,
          reducedMotion: runtime.reducedMotion,
          homepageVisualIdentity,
          satelliteNameById: homepageSatelliteNameById,
          homepageBeamEeByKey: homepageBeamEeByKey ?? undefined,
          homepageIdentityPaletteIndexBySatelliteId: homepageIdentityPaletteIndexBySatelliteId ?? undefined,
          onCandidateSelect: toggleInspectedCandidateKey,
          focusedJoinKey,
          onFocusJoinKeyChange,
        }}
        central={{
          active: sceneRenderPlan.surfaces['candidate.central'].mounted,
          presentation: multiCandidateScenePresentationForRender,
          widthScale: beamDisplaySpec.coneWidthScale * MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER,
          renderReceipt: multiCandidateSceneRenderReceipt,
        }}
        review={{
          active: sceneRenderPlan.surfaces['candidate.review'].mounted,
          presentation: multiCandidateCandidateReviewPresentation,
          widthScale: beamDisplaySpec.coneWidthScale,
          renderReceipt: multiCandidateCandidateReviewSceneRenderReceipt,
        }}
      />
      <SceneAcceptedHandoverCue
        mounted={sceneRenderPlan.surfaces['handover.accepted-cue'].mounted}
        transition={latchedAuthorityTransition}
        placementByCellId={sinrLiveCellPlacementById}
        progress01={handoverPresentation.progress01}
        sourceColor={acceptedHandoverCueColors.sourceColor}
        targetColor={acceptedHandoverCueColors.targetColor}
      />
      <SceneSinrLiveBeamLayers
        focusedJoinKey={focusedJoinKey}
        onFocusJoinKeyChange={onFocusJoinKeyChange}
        resolveJoinKey={resolveSceneJoinKey}
        appearance={{
          homepageVisualIdentity,
          homepageBeamEeByKey: homepageBeamEeByKey ?? undefined,
          homepageIdentityPaletteIndexBySatelliteId: homepageIdentityPaletteIndexBySatelliteId ?? undefined,
          widthScale: beamDisplaySpec.coneWidthScale,
          ellipseTiltExaggeration: sinrLiveEllipseTiltExaggeration,
        }}
        cones={[
          {
            key: 'non-serving',
            mounted: sceneRenderPlan
              .surfaces['beam.non-serving-cones'].mounted,
            items: sinrLiveCellNonServingConeItems,
            layer: 'nonServing',
            palette: sinrLiveConePalette,
            telemetryCountDatasetKey: 'sinrLiveCellNonServingConeRenderedCount',
          },
          {
            key: 'serving',
            mounted: sceneRenderPlan
              .surfaces['beam.serving-cones'].mounted,
            items: sinrLiveCellBeamConeItems,
            layer: 'serving',
            palette: activeServingConePalette,
            elevationDimming: {
              enabled: beamDisplaySpec.elevationDimEnabled,
              floorDeg: beamDisplaySpec.elevationDimFloorDeg,
              ceilDeg: beamDisplaySpec.elevationDimCeilDeg,
              minFactor: beamDisplaySpec.elevationDimMinFactor,
              heroExempt: beamDisplaySpec.heroExemptFromElevationDim,
              primaryServing: {
                satId: displayHeroRecord?.servingSatId ?? null,
                cellId: displayHeroRecord?.cellId ?? null,
                beamId: displayHeroRecord?.beamId ?? null,
              },
            },
            telemetryCountDatasetKey: 'sinrLiveCellBeamConeRenderedCount',
          },
          {
            key: 'cinema-inter-serving-fan',
            mounted: sceneRenderPlan
              .surfaces['beam.cinema-inter-serving-fan'].mounted,
            items: sinrLiveCinemaInterServingFanConeItems,
            layer: 'serving',
            palette: sinrLiveConePalette,
            elevationDimming: {
              enabled: beamDisplaySpec.elevationDimEnabled,
              floorDeg: beamDisplaySpec.elevationDimFloorDeg,
              ceilDeg: beamDisplaySpec.elevationDimCeilDeg,
              minFactor: beamDisplaySpec.elevationDimMinFactor,
              heroExempt: beamDisplaySpec.heroExemptFromElevationDim,
            },
            telemetryCountDatasetKey: 'sinrLiveCinemaInterServingFanRenderedCount',
          },
          {
            key: 'candidate',
            mounted: sceneRenderPlan
              .surfaces['beam.candidate-cones'].mounted,
            items: sinrLiveCandidateBeamConeItems,
            layer: 'candidate',
            palette: sinrLiveConePalette,
            elevationDimming: {
              enabled: beamDisplaySpec.elevationDimEnabled,
              floorDeg: beamDisplaySpec.elevationDimFloorDeg,
              ceilDeg: beamDisplaySpec.elevationDimCeilDeg,
              minFactor: beamDisplaySpec.elevationDimMinFactor,
              heroExempt: beamDisplaySpec.heroExemptFromElevationDim,
            },
            telemetryCountDatasetKey: 'sinrLiveCellCandidateConeRenderedCount',
          },
          {
            key: 'handover-pulse',
            mounted: sceneRenderPlan
              .surfaces['handover.pulse-cones'].mounted,
            items: additiveHandoverPulseConeItems,
            layer: 'pulse',
            palette: sinrLiveConePalette,
            telemetryCountDatasetKey: 'sinrLiveHandoverPulseConeRenderedCount',
          },
          {
            key: 'triggered-intra',
            mounted: sceneRenderPlan
              .surfaces['handover.triggered-intra-cones'].mounted,
            items: additiveTriggeredIntraConeItems,
            layer: 'triggered',
            palette: sinrLiveConePalette,
            telemetryCountDatasetKey: 'sinrLiveTriggeredIntraConeRenderedCount',
          },
          {
            key: 'cinema-handover-pair',
            mounted: sceneRenderPlan
              .surfaces['handover.cinema-pair-cones'].mounted,
            items: additiveCinemaHandoverPairConeItems,
            layer: 'triggered',
            palette: sinrLiveConePalette,
            telemetryCountDatasetKey: 'sinrLiveCinemaHandoverPairRenderedCount',
          },
          {
            key: 'authority-transition',
            mounted: sceneRenderPlan
              .surfaces['handover.authority-transition-cones'].mounted,
            items: authorityHandoverPairConeItems,
            layer: 'triggered',
            palette: sinrLiveConePalette,
            telemetryCountDatasetKey: 'multiCandidateAuthorityTransitionConeRenderedCount',
          },
        ]}
        footprints={[
          {
            key: 'serving',
            mounted: sceneRenderPlan
              .surfaces['beam.serving-footprints'].mounted,
            visible: sceneRenderPlan
              .surfaces['beam.serving-footprints'].visible,
            items: sinrLiveCellBeamConeItems,
            layer: 'serving',
            palette: activeServingConePalette,
            primaryServing: {
              satId: displayHeroRecord?.servingSatId ?? null,
              cellId: displayHeroRecord?.cellId ?? null,
              beamId: displayHeroRecord?.beamId ?? null,
            },
            telemetryCountDatasetKey: 'sinrLiveCellFootprintRingRenderedCount',
          },
          {
            key: 'candidate',
            mounted: sceneRenderPlan
              .surfaces['beam.candidate-footprints'].mounted,
            items: sinrLiveCandidateBeamConeItems,
            layer: 'candidate',
            palette: sinrLiveConePalette,
            telemetryCountDatasetKey: 'sinrLiveCellCandidateFootprintRenderedCount',
          },
        ]}
        callouts={{
          mounted: sceneRenderPlan
            .surfaces['beam.callouts'].mounted,
          items: beamInfoItems,
          servingSinrByCellId: sinrLiveCellServingSinrByCellId,
          primaryServing: {
            satId: displayHeroRecord?.servingSatId ?? null,
            cellId: displayHeroRecord?.cellId ?? null,
            beamId: displayHeroRecord?.beamId ?? null,
          },
          frameSnapshot: sim.sinrLiveCells?.angleAwareFormulaFrame ?? null,
          homepageBeamEeBitsPerJouleByKey: homepageVisualIdentity
            ? homepageBeamEeBitsPerJouleByKey
            : undefined,
          homepageBeamEeByKey: homepageVisualIdentity ? homepageBeamEeByKey : undefined,
          homepageIdentityPaletteIndexBySatelliteId: homepageVisualIdentity
            ? homepageIdentityPaletteIndexBySatelliteId
            : undefined,
          homepageVisualIdentity,
          satelliteNameById: homepageSatelliteNameById,
          telemetryCountDatasetKey: 'sinrLiveCellBeamCalloutRenderedCount',
          sourceProvenance: simSource === 'live' ? 'synthetic-walker' : 'archived-tle',
        }}
        teaching={teachingSurfaceReady && teachingSurfaceProjectionRef !== undefined
          ? {
            mounted: sceneRenderPlan.surfaces['teaching.handover-cones'].mounted,
            projectionRef: teachingSurfaceProjectionRef,
            placementByCellId: sinrLiveCellPlacementById,
            satelliteWorldById: viz.coneApexWorldById,
          }
          : null}
      />
      {/* Tier-2 dead-twin retirement: the legacy steered <SatelliteBeams> render
          block was gated `showLiveBeamCones && !showSinrLiveCellBeams`, and both
          equal `showSinrLiveViewport` — so the gate was `X && !X`, provably false
          on EVERY lane. It never rendered (zero visual change on removal) but kept
          MainScene falsely pointing at SatelliteBeams.tsx as if it were the live
          renderer (the "改波束改不對 — edit the wrong file" trap). The live sinr-live
          beam render is the earth-fixed cell-truth cones above (SinrLiveCellBeamCones,
          gated by showSinrLiveCellBeams). The SatelliteBeams component survives only
          as the vc1c/vc2 validation-fixture subject — it is no longer mounted in-app. */}
      <SceneIntraGroundShockwave
        mounted={sceneRenderPlan.surfaces['handover.intra-shockwave'].mounted}
        vizFrame={viz}
        runtime={runtime}
        identityColorBySatelliteId={multiCandidateSatelliteColorById}
        identityColorBySatelliteBeamId={liveBeamIdentityColorBySatelliteBeam}
      />
      <SceneHandoverToastLayer
        mounted={sceneRenderPlan.surfaces['handover.toast'].mounted}
        toast={{
          frame: sceneFrame,
          interTriggerSec: handoverTriggerTimeSec,
          homepageVisualIdentity,
          eventLabel: handoverToastCopy.eventLabel,
          eventReason: handoverToastCopy.eventReason,
          preferredKind: handoverPresentation.active
            ? handoverPresentation.event?.kind ?? null
            : null,
          presentationHandover: handoverPresentation.active && handoverPresentation.event
            ? {
              kind: handoverPresentation.event.kind,
              sourceSatId: handoverPresentation.event.from.satId,
              sourceBeamId: handoverPresentation.event.from.beamId
                ?? cellLinkBudgetBeamId(handoverPresentation.event.from.cellId),
              targetSatId: handoverPresentation.event.to.satId,
              targetBeamId: handoverPresentation.event.to.beamId
                ?? cellLinkBudgetBeamId(handoverPresentation.event.to.cellId),
              progressSec: handoverPresentation.progress01 * handoverPresentation.event.durationMs / 1000,
              targetSec: handoverPresentation.event.durationMs / 1000,
            }
            : null,
          manualHandover: manualHandoverPresentationActive && manualHandoverEvent
            ? {
              kind: manualHandoverEvent.kind,
              sourceSatId: manualHandoverEvent.fromSatId,
              sourceBeamId: manualHandoverEvent.fromCellId === null
                ? null
                : manualHandoverBeamRecord?.servingLinkSample?.beamId
                  ?? cellLinkBudgetBeamId(manualHandoverEvent.fromCellId),
              targetSatId: manualHandoverEvent.toSatId,
              targetBeamId: manualHandoverEvent.toCellId === null
                ? null
                : manualHandoverBeamRecord?.intraCandidateLinkSample?.beamId
                  ?? cellLinkBudgetBeamId(manualHandoverEvent.toCellId),
              progressSec: manualHandoverProgressSec,
              targetSec: manualHandoverDisplayMs / 1000,
            }
            : null,
        }}
      />
      {sceneRenderPlan.surfaces['diagnostics.fps'].mounted && <FPSCounter />}
    </BaseSceneLayout>
  );
}

interface MainSceneProps {
  speed: number;
  paused: boolean;
  profile: Profile;
  runtime: RuntimeConfig;
  visualScaleMultipliers: SceneVisualScaleMultipliers;
  sceneLane: SceneLane;
  /** Root-only compact satellite identity projection; other routes omit it. */
  homepageVisualIdentity?: boolean;
  /** Exact active-TLE names for homepage labels; raw IDs remain join keys. */
  homepageSatelliteNameById?: ReadonlyMap<string, string> | null;
  /** Homepage-only frame-local EE colour projection; other routes omit it. */
  homepageBeamMetrics?: HomepageBeamMetricsProjection | null;
  /** Explicit homepage producer choice; frame availability never selects it. */
  simulationSource: SimulationSourceMode;
  /** Display-only scene-medium switch owned by the homepage shell. */
  campusVisible: boolean;
  onSimUpdate: (state: SimState) => void;
  /** One App-accepted snapshot instance consumed by both canvas and right rail. */
  acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  /** R4 shell-owned story bindings shared with right-rail and caption surfaces. */
  handoverSurfaceBindingsRef: MutableRefObject<HandoverSurfaceBindingSet>
  /** R5 single source-time transport published on scene/rail/caption. */
  instructorHandoverSnapshotRef?: MutableRefObject<InstructorHandoverTransportSnapshot | null>;
  /** R6 activity identity published beside the same R5 source-time owner. */
  studentHandoverActivityStateRef?: MutableRefObject<StudentHandoverActivityState | null>;
  onLiveSeekLanded?: (seekRequestKey: string) => void;
  sceneFrame?: NormalizedSceneFrame;
  /** Accepted immutable archived-TLE frame for the homepage centre. */
  canonicalAnalysisFrame?: SimulationAnalysisFrame | null;
  /** Adjacent completed TLE anchor for centre-only visual interpolation. */
  canonicalAnalysisNextFrame?: SimulationAnalysisFrame | null;
  /** Visible fail-closed reason when the selected TLE producer cannot publish. */
  canonicalAnalysisError?: string | null;
  /** Continuous source-time offset from the canonical lower anchor. */
  canonicalVisualOffsetSec?: number;
  /**
   * Tier-2 thin DIRECT-PROP seam for display-only beam knobs — passed straight
   * from App (its own useState), NOT through buildAppRuntimeConfig / the runtime
   * memo bag, so a toggle re-renders without the invisible-dep-array tax. Optional
   * (defaults to DEFAULT_BEAM_DISPLAY_SPEC); the artifact-replay lane ignores it.
   */
  beamDisplaySpec?: BeamDisplaySpec;
  /**
   * Focused live handover-cinema candidate. This is a presentation-only projection
   * of the indexed event; the scene uses its exact old/new cell identities to draw
   * the pair and never feeds it back into the simulation.
   */
  handoverCinemaCandidate?: SinrLiveCinemaHandoverCandidate | null;
  /** True while the handover director has claimed the legacy scene display. */
  handoverCinemaArmed?: boolean;
  handoverCinemaKind?: 'intra' | 'inter' | null;
  /** Spacecraft family for the live legacy Walker presentation. */
  constellation?: SimulatorConstellation;
  /** Reports only a drawable, coordinator-owned visual story to playback. */
  onHandoverPresentationChange?: (snapshot: HandoverPresentationSnapshot) => void;
  /** Imperative render-time gate; the callback must only update a ref. */
  onHandoverPresentationBusyChange?: (busy: boolean) => void;
  /** Display-only switch for HTML/callout information over the stage. */
  showSceneOverlays?: boolean;
  /** One App-owned join key shared by the homepage rail and scene. */
  focusedJoinKey?: string | null;
  onFocusJoinKeyChange?: (joinKey: string | null) => void;
  /** Gates only the short-lived event captions; highlights remain available. */
  teachingNarrativeEnabled?: boolean;
  /** Exact shell-owned teaching projection shared with scene, rail and caption. */
  teachingSurfaceProjectionRef?: MutableRefObject<HandoverTeachingSurfaceProjection | null>;
}

export const MainScene = memo(function MainScene({
  speed,
  paused,
  profile,
  runtime,
  visualScaleMultipliers,
  sceneLane,
  homepageVisualIdentity = false,
  homepageSatelliteNameById = null,
  homepageBeamMetrics = null,
  simulationSource,
  campusVisible,
  onSimUpdate,
  acceptedHandoverPresentation,
  handoverSurfaceBindingsRef,
  instructorHandoverSnapshotRef,
  studentHandoverActivityStateRef,
  onLiveSeekLanded,
  sceneFrame,
  canonicalAnalysisFrame,
  canonicalAnalysisNextFrame,
  canonicalAnalysisError = null,
  canonicalVisualOffsetSec = 0,
  beamDisplaySpec = DEFAULT_BEAM_DISPLAY_SPEC,
  showSceneOverlays = true,
  handoverCinemaCandidate = null,
  handoverCinemaArmed = false,
  handoverCinemaKind = null,
  onHandoverPresentationChange,
  onHandoverPresentationBusyChange,
  focusedJoinKey = null,
  onFocusJoinKeyChange,
  teachingNarrativeEnabled = false,
  teachingSurfaceProjectionRef,
  constellation = DEFAULT_SATELLITE_CONSTELLATION,
}: MainSceneProps) {
  const ueMarkerShape = resolveSceneLaneUeMarkerShape(sceneLane);
  const showUav = sceneLane === 'sinr-live';
  const homepageTleSceneActive = sceneLane === 'sinr-live'
    && simulationSource === 'archived-tle';
  const [presentationStage, setPresentationStage] = useState<ScenePresentationStageId>(() => (
    typeof window === 'undefined'
      ? 'full'
      : readScenePresentationStageFromSearch(window.location.search)
  ));
  const presentationPlan = useMemo(
    () => resolveScenePresentationPlan(presentationStage),
    [presentationStage],
  );
  const presenterEnabled = useMemo(
    () => typeof window !== 'undefined' && isScenePresenterEnabled(window.location.search),
    [],
  );
  const selectPresentationStage = (stage: ScenePresentationStageId): void => {
    setPresentationStage(stage);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('sceneStage', stage);
    window.history.replaceState(window.history.state, '', url);
  };
  const teachingSceneBinding = teachingSurfaceProjectionRef?.current?.binding ?? null;

  return (
    <div
      className="leo-main-scene"
      data-testid="leo-main-scene"
      data-accepted-handover-snapshot-id={acceptedHandoverPresentation?.snapshotId ?? ''}
      data-accepted-handover-episode-id={acceptedHandoverPresentation?.episodeId ?? ''}
      data-accepted-handover-source-frame-id={acceptedHandoverPresentation?.sourceFrameId ?? ''}
      data-accepted-handover-phase={acceptedHandoverPresentation?.phase ?? ''}
      data-accepted-handover-sim-time-sec={acceptedHandoverPresentation === null
        ? ''
        : String(acceptedHandoverPresentation.simTimeMs / 1000)}
      data-accepted-handover-active-data-link-count={acceptedHandoverPresentation?.activeDataLinkCount.toString() ?? ''}
      data-homepage-visual-identity={homepageVisualIdentity ? 'compact-six-family' : 'default'}
      data-homepage-satellite-color-count={homepageVisualIdentity
        ? String(HOMEPAGE_SATELLITE_COLOR_COUNT)
        : ''}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)',
        overflow: 'hidden',
      }}
    >
      <div
        data-testid="render-isolation-probe"
        data-app-mode={runtime.appMode}
        data-scene-lane={sceneLane}
        data-ue-marker-shape={ueMarkerShape}
        data-uav-visible={showUav ? '1' : '0'}
        data-ue-primary-anchor-mode={runtime.uePrimaryAnchorMode ?? 'observer'}
        data-live-timeline-seek-key={runtime.replay.seekRequestKey ?? ''}
        data-live-timeline-seek-target={runtime.replay.seekTargetSec?.toFixed(3) ?? ''}
        data-manual-handover-request-id={runtime.manualHandoverRequestId?.toString() ?? ''}
        data-manual-handover-kind={runtime.manualHandoverKind ?? ''}
        data-teaching-lecture-kind={runtime.teachingLectureKind ?? ''}
        data-teaching-scene-story={teachingSceneBinding === null
          ? ''
          : `${teachingSceneBinding.frame.kind}:${teachingSceneBinding.frame.from.satelliteId}`
            + `#${teachingSceneBinding.frame.from.cellId ?? '-'}`
            + `>${teachingSceneBinding.frame.to.satelliteId}`
            + `#${teachingSceneBinding.frame.to.cellId ?? '-'}`}
        data-scene-source={homepageTleSceneActive
          ? 'archived-tle'
          : (sceneFrame?.sceneSource ?? 'live-simulation')}
        data-scene-presentation-stage={presentationPlan.stage}
        data-campus-visible={campusVisible ? '1' : '0'}
        data-scene-presentation-visible-layers={Object.entries(presentationPlan.visible)
          .filter(([, visible]) => visible)
          .map(([layer]) => layer)
          .join(',')}
        hidden
      />
      {homepageTleSceneActive && (
        <div
          data-testid="homepage-tle-center"
          data-analysis-frame-id={canonicalAnalysisFrame?.frameId ?? ''}
          data-tle-frame-id={canonicalAnalysisFrame?.tleFrameId ?? ''}
          data-selected-satellite-id={canonicalAnalysisFrame?.selectedSatelliteId ?? ''}
          data-instant-utc={canonicalAnalysisFrame?.instantUtc ?? ''}
          data-selected-position-teme-km={canonicalAnalysisFrame
            ? [
              canonicalAnalysisFrame.tleState.selectedSatellite.positionTemeKm.x,
              canonicalAnalysisFrame.tleState.selectedSatellite.positionTemeKm.y,
              canonicalAnalysisFrame.tleState.selectedSatellite.positionTemeKm.z,
            ].join(',')
            : ''}
          data-selected-velocity-teme-km-per-sec={canonicalAnalysisFrame
            ? [
              canonicalAnalysisFrame.tleState.selectedSatellite.velocityTemeKmPerSec.x,
              canonicalAnalysisFrame.tleState.selectedSatellite.velocityTemeKmPerSec.y,
              canonicalAnalysisFrame.tleState.selectedSatellite.velocityTemeKmPerSec.z,
            ].join(',')
            : ''}
          data-scene-source="archived-tle"
          data-propagation-model={canonicalAnalysisFrame?.provenance.propagationModel ?? ''}
          data-archive-id={canonicalAnalysisFrame?.provenance.archiveId ?? ''}
          data-run-anchor-count={canonicalAnalysisFrame?.runAnchor?.anchorCount ?? ''}
          data-run-duration-sec={canonicalAnalysisFrame?.runAnchor?.durationSec ?? ''}
          data-run-step-sec={canonicalAnalysisFrame?.runAnchor?.stepSec ?? ''}
          data-earth-sphere="false"
          data-handover-decision={canonicalAnalysisFrame?.handover?.event ?? ''}
          data-handover-state={canonicalAnalysisFrame?.handover?.state ?? ''}
          data-handover-reason={canonicalAnalysisFrame?.handover?.reason ?? ''}
          data-handover-progress-sec={canonicalAnalysisFrame?.handover?.progressSec ?? ''}
          data-handover-cumulative-count={canonicalAnalysisFrame?.handover?.cumulativeCount ?? ''}
          hidden
        />
      )}
      {presentationPlan.visible.backdrop && <Starfield starCount={180} />}
      <Canvas
        // Keep the established render loop for live and paused scenes.  A paused
        // simulation still needs the R3F clock for direct OrbitControls input and
        // the existing camera-preset/director tween; pausing the producer is
        // separate from pausing the renderer.  The recorded proof lane remains
        // demand-driven as its own explicit performance policy.
        frameloop="always"
        // PERF (software-WebGL box, no GPU — SwiftShader/llvmpipe, ~3.5 FPS measured):
        // the bottleneck is FRAGMENT FILL, not mesh count. The ONE big motion win that does
        // NOT touch edge quality is dropping the SHADOW PASS (the whole scene re-rendered into
        // a 4096² depth map every frame) — so `shadows` is off. dpr + antialias are LEFT AT
        // DEFAULT on purpose: cutting them sped the frame up but JAGGED every edge (the
        // footprint hexagons read as "changed"), and on a CPU rasterizer MSAA is the lesser
        // cost vs the shadow pass — so we keep the crisp edges and take the shadow-pass win.
        // (Re-enable `shadows` on a real-GPU demo box; drop dpr→1 / antialias→false only if a
        // viewer explicitly wants more motion at the cost of jagged edges.)
        // Display-only (Rule#6) — render config only, no SINR/handover/geometry truth touched.
        shadows={false}
        dpr={1}
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          alpha: true,
          powerPreference: 'high-performance',
          antialias: true,
        }}
      >
        <Suspense fallback={<Html center><div style={{ color: 'white', fontSize: 22 }}>Loading...</div></Html>}>
          {sceneFrame?.sceneSource === 'artifact-replay' ? (
            <ArtifactSceneContent
              runtime={runtime}
              visualScaleMultipliers={visualScaleMultipliers}
              sceneLane={sceneLane}
              campusVisible={campusVisible}
              sceneFrame={sceneFrame}
              presentationPlan={presentationPlan}
              handoverSurfaceBindingsRef={handoverSurfaceBindingsRef}
              instructorHandoverSnapshotRef={instructorHandoverSnapshotRef}
              studentHandoverActivityStateRef={studentHandoverActivityStateRef}
            />
          ) : homepageTleSceneActive ? (
              <ArchivedTleSceneContent
                frame={canonicalAnalysisFrame ?? null}
                nextFrame={canonicalAnalysisNextFrame ?? null}
                visualOffsetSec={canonicalVisualOffsetSec}
                errorMessage={canonicalAnalysisError}
                profile={profile}
                speed={speed}
                paused={paused}
                runtime={runtime}
                visualScaleMultipliers={visualScaleMultipliers}
                sceneLane={sceneLane}
                homepageVisualIdentity={homepageVisualIdentity}
                homepageSatelliteNameById={homepageSatelliteNameById}
                homepageBeamMetrics={homepageBeamMetrics}
                campusVisible={campusVisible}
                onSimUpdate={onSimUpdate}
                acceptedHandoverPresentation={acceptedHandoverPresentation}
                handoverSurfaceBindingsRef={handoverSurfaceBindingsRef}
                instructorHandoverSnapshotRef={instructorHandoverSnapshotRef}
                studentHandoverActivityStateRef={studentHandoverActivityStateRef}
                onLiveSeekLanded={onLiveSeekLanded}
                beamDisplaySpec={beamDisplaySpec}
                showSceneOverlays={showSceneOverlays}
                handoverCinemaCandidate={handoverCinemaCandidate}
                handoverCinemaArmed={handoverCinemaArmed}
                handoverCinemaKind={handoverCinemaKind}
                onHandoverPresentationChange={onHandoverPresentationChange}
                onHandoverPresentationBusyChange={onHandoverPresentationBusyChange}
                focusedJoinKey={focusedJoinKey}
                onFocusJoinKeyChange={onFocusJoinKeyChange}
                teachingNarrativeEnabled={teachingNarrativeEnabled}
                teachingSurfaceProjectionRef={teachingSurfaceProjectionRef}
                constellation={constellation}
                presentationPlan={presentationPlan}
              />
          ) : (
              <SceneContent
                profile={profile}
                speed={speed}
                paused={paused}
                runtime={runtime}
                visualScaleMultipliers={visualScaleMultipliers}
                sceneLane={sceneLane}
                homepageVisualIdentity={homepageVisualIdentity}
                homepageSatelliteNameById={homepageSatelliteNameById}
                homepageBeamMetrics={homepageBeamMetrics}
                campusVisible={campusVisible}
                onSimUpdate={onSimUpdate}
                acceptedHandoverPresentation={acceptedHandoverPresentation}
                handoverSurfaceBindingsRef={handoverSurfaceBindingsRef}
                instructorHandoverSnapshotRef={instructorHandoverSnapshotRef}
                studentHandoverActivityStateRef={studentHandoverActivityStateRef}
                onLiveSeekLanded={onLiveSeekLanded}
                sceneFrame={sceneFrame}
                beamDisplaySpec={beamDisplaySpec}
                showSceneOverlays={showSceneOverlays}
                handoverCinemaCandidate={handoverCinemaCandidate}
                handoverCinemaArmed={handoverCinemaArmed}
                handoverCinemaKind={handoverCinemaKind}
                onHandoverPresentationChange={onHandoverPresentationChange}
                onHandoverPresentationBusyChange={onHandoverPresentationBusyChange}
                focusedJoinKey={focusedJoinKey}
                onFocusJoinKeyChange={onFocusJoinKeyChange}
                teachingNarrativeEnabled={teachingNarrativeEnabled}
                teachingSurfaceProjectionRef={teachingSurfaceProjectionRef}
                constellation={constellation}
                presentationPlan={presentationPlan}
              />
          )}
        </Suspense>
      </Canvas>
      {presenterEnabled && (
        <div className="scene-presentation-toolbar-host">
          <ScenePresentationToolbar
            currentStage={presentationPlan.stage}
            onStageChange={selectPresentationStage}
          />
        </div>
      )}
    </div>
  );
});

MainScene.displayName = 'MainScene';
