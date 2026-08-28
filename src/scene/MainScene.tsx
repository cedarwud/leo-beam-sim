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
import { useSimulation } from './useSimulation';
import { useUeTrailHistory } from './useUeTrailHistory';
import { useBeamViz } from './useBeamViz';
import {
  CELL_SCHEDULE_VIZ_SLOT_SEC,
  DEFAULT_SERVING_COUNT,
  useCellSchedule,
  type CellReassignment,
} from './useCellSchedule';
import { sceneGeometryFromProfile } from './SceneGeometry';
import { liveSimToScene } from '../showcase/liveSimToScene';
import { useSimStatePublisher } from './useSimStatePublisher';
import { buildMultiCandidateScenePresentation } from './multiCandidateScenePresentation';
import {
  areMultiCandidateFocusPointsWithinSafeFrame,
  resolveMultiCandidateCameraFit,
} from './multiCandidateCameraFit';
import { useCandidateInspectionSelection } from '../ui/handover-evaluation/candidateInspectionSelection';
import { useHomepageCandidatePresentationPlan } from '../ui/handover-evaluation/useHomepageCandidatePresentationPlan';
import { satelliteTint } from '../constants/beamRoleTokens';
// S-cells-4d: the legacy 20-hex EarthFixedCells green-disc ground paint is retired
// from the sinr-live lane (the cell-truth beam cones own the earth-fixed cell story
// now). Its hex-cover MODEL stays in `../viz/EarthFixedCells` for reuse + the
// `validate:vc3a:hex-paint` logic gate; only this scene's usage is removed.
import { SinrLiveCellFootprintRings } from '../viz/SinrLiveCellFootprintRings';
import { SinrLiveCellBeamCallouts } from '../viz/SinrLiveCellBeamCallouts';
import { HandoverLinks } from '../viz/HandoverLinks';
import { MultiCandidateBeamScene } from '../viz/MultiCandidateBeamScene';
import { HandoverToastOverlay } from '../viz/HandoverToastOverlay';
import { IntraGroundShockwave } from '../viz/IntraGroundShockwave';
import { BeamPulseClock } from '../viz/SatelliteBeams';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { SpineParticles } from '../viz/SpineParticles';
import { OrbitTrail } from '../viz/OrbitTrail';
import { ServingGroundRipple } from '../viz/ServingGroundRipple';
import { GroundScene } from '../viz/GroundScene';
import { buildReplayServedStarvedColorMap } from './replayFieldColor';
import { CellOverlay } from '../viz/CellOverlay';
import { CellHandoverArcs } from '../viz/CellHandoverArcs';
import {
  CellBeamCones,
  resolveCellBeamConeItems,
  resolveCellBeamConeRenderCount,
  resolveCellBeamConeSatelliteCount,
} from '../viz/CellBeamCones';
import {
  SinrLiveCellBeamCones,
  resolveSinrLiveHandoverPulseConeItems,
  resolveSinrLiveCellBeamConeItems,
  resolveSinrLiveNonServingConeItems,
  resolveTriggeredIntraConeItems,
  resolveCinemaHandoverPairConeItems,
  resolveCinemaInterServingFanConeItems,
  resolveCandidateBeamConeItems,
  resolveBudgetedSinrLiveBeamConeItems,
  type SinrLiveCellPlacement,
  type SinrLiveCinemaHandoverCandidate,
} from '../viz/SinrLiveCellBeamCones';
import {
  DEFAULT_BEAM_DISPLAY_SPEC,
  resolveBeamFocusSatIds,
  resolveDisplayHeroRecord,
  resolveTriggeredHandoverTargetColor,
  type BeamDisplaySpec,
} from './beamDisplaySpec';
import {
  SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
  cellIdFromLinkBudgetBeamId,
  resolvePrimaryCellServingRecord,
  type SinrLiveCellHandoverEvent,
} from './sinrLiveCellModel';
import { MANUAL_HANDOVER_DISPLAY_MS, resolveManualHandoverDemoEvent } from './manualHandoverDemo';
import {
  resolveHandoverCinemaDisplayMs,
  resolveHandoverCinemaReady,
  resolveHandoverCinemaEnvelope,
  resolveHandoverDisplayIsolation,
  resolveInterCinemaPairAnchor,
  selectHandoverEventsForDisplay,
  type InterCinemaPairAnchor,
  type InterCinemaApexWorld,
} from './handoverDisplayIsolation';
import {
  annotateOtherHandoverDisplayUes,
  filterOtherHandoverDisplayUes,
  selectOtherHandoverUeIds,
} from './otherHandoverUeSelector';
import {
  advanceHandoverPresentation,
  createIdleHandoverPresentationView,
  createHandoverPresentationState,
  type HandoverPresentationEvent,
  type HandoverPresentationSnapshot,
} from './handoverPresentationOwner';
import {
  buildSinrLiveCellLayout,
  resolveSinrLiveBeamsPerSat,
  resolveSinrLiveSceneCellCount,
  SINR_LIVE_ARCHIVED_DISPLAY_CELL_COUNT,
} from './sinrLiveCellRuntime';
import {
  createSinrLiveBeamDisplayFrame,
  resolveSinrLiveConfiguredBeamCount,
} from './sinrLiveBeamDisplayFrame';
import { BeamLoadCylinder } from '../viz/BeamLoadCylinder';
import { BeamLoadUploadParticles } from '../viz/BeamLoadUploadParticles';
import { HandoverStoryLayer } from '../viz/HandoverStoryLayer';
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
import {
  resolveCinematicSpotlightTargets,
} from './cinematicEffects';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import { FPSCounter } from './FPSCounter';
import {
  shouldEnableHomepageMultiCandidateAuthority,
  type SceneLane,
} from '../app/sceneLane';
import {
  isSceneLaneSourceCompatible,
  resolveSceneLaneRenderPlan,
  resolveSceneLaneUeMarkerShape,
} from './sceneLaneRenderPlan';
import { deriveProfileHandoverStoryModel } from './handoverStoryModel';
import {
  buildModqnCellServiceReadout,
  deriveModqnServiceMap,
  EMPTY_MODQN_SERVICE_MAP,
} from './modqnServiceMap';
import {
  buildSinrServingUeColorMap,
  buildSinrServingUeColorMapFromCells,
} from './sinrServingMosaic';
import {
  deriveBeamLoadContention,
  EMPTY_BEAM_LOAD_CONTENTION,
} from './beamLoadContention';
import {
  DEFAULT_MODQN_VISUAL_LAYER_PRESET,
  resolveModqnVisualLayers,
} from './modqnVisualLayers';
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
}: {
  readonly plan: ScenePresentationPlan;
}) {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    gl.domElement.dataset.scenePresentationStage = plan.stage;
    gl.domElement.dataset.scenePresentationVisibleLayers = Object.entries(plan.visible)
      .filter(([, visible]) => visible)
      .map(([layer]) => layer)
      .join(',');
  }, [gl, plan]);
  return null;
}

interface SceneContentProps {
  profile: Profile;
  speed: number;
  paused: boolean;
  runtime: RuntimeConfig;
  visualScaleMultipliers: SceneVisualScaleMultipliers;
  sceneLane: SceneLane;
  /** Display-only medium switch; never enters the simulation producer. */
  campusVisible: boolean;
  onSimUpdate: (state: SimState) => void;
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
}

const CAMERA_TWEEN_DURATION_MS = 600;
const MULTI_CANDIDATE_REFRAME_DURATION_MS = 320;
const MAX_PROFILE_DERIVED_HANDOVER_CUES = 3;
/** Display-only legibility lift for the narrow homepage centre stage. */
const MULTI_CANDIDATE_SATELLITE_SCALE_MULTIPLIER = 6;
const MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER = 1.55;

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

/**
 * PURE manual-handover progress: wall-clock age → the envelope's 0…1 progress ratio.
 * Exported so "does the demonstration actually advance while the sim is paused?" is an
 * executable question. `startedAtMs === undefined` (disarmed) yields an infinite age, which
 * is what makes `manualHandoverActive` false.
 */
export function resolveManualHandoverProgress(input: {
  readonly startedAtMs: number | undefined;
  readonly nowMs: number;
  readonly displayMs: number;
}): { readonly ageMs: number; readonly progressSec: number; readonly progressRatio: number } {
  const ageMs = input.startedAtMs === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, input.nowMs - input.startedAtMs);
  const progressSec = Math.min(input.displayMs / 1000, ageMs / 1000);
  return { ageMs, progressSec, progressRatio: progressSec / (input.displayMs / 1000) };
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

function selectProfileDerivedHandoverCues(
  reassignments: readonly CellReassignment[],
): readonly CellReassignment[] {
  const selected: CellReassignment[] = [];
  const push = (candidate: CellReassignment | undefined) => {
    if (!candidate) return;
    if (selected.some(existing => existing.cellId === candidate.cellId)) return;
    selected.push(candidate);
  };

  push(reassignments.find(reassignment => reassignment.kind === 'intra'));
  push(reassignments.find(reassignment => reassignment.kind === 'inter'));
  for (const reassignment of reassignments) {
    if (selected.length >= MAX_PROFILE_DERIVED_HANDOVER_CUES) break;
    push(reassignment);
  }

  return selected;
}

function ArtifactSceneContent({
  runtime,
  visualScaleMultipliers,
  sceneLane,
  sceneFrame,
  presentationPlan,
  campusVisible,
}: ArtifactSceneContentProps) {
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
  // P2 replay stage: on the modqn-replay-proof lane the recorded field is the sim's
  // red/green LIFE-DEATH signal (starved UE = red, served = green), from the recorded
  // per-UE SINR. The plain artifact-replay lane keeps its neutral markers.
  const isReplayStage = sceneLane === 'modqn-replay-proof';
  const replayFieldColorById = useMemo(
    () => (isReplayStage ? buildReplayServedStarvedColorMap(sceneFrame.ues) : null),
    [isReplayStage, sceneFrame.ues],
  );

  return (
    <BaseSceneLayout
      sceneConfig={sceneConfig}
      controlsRef={controlsRef}
      campusVisible={campusVisible && presentationPlan.visible.campus}
    >
      {!(campusVisible && presentationPlan.visible.campus) && <TeachingFloor />}
      <ScenePresentationCanvasTelemetry plan={presentationPlan} />
      <SceneTelemetry
        visibleSatelliteCount={visibleSatellites.length}
        firstSatellitePosition={formatScenePosition(visibleSatellites[0]?.worldPos)}
        servingSatelliteId={sceneFrame.metrics.servingSatelliteId}
        servingBeamId={sceneFrame.metrics.servingBeamId}
        beamCalloutsEnabled="0"
        simTimeSec={sceneFrame.tSec}
        appMode={runtime.appMode}
        sceneLaneSourceCompatible={
          // P2: use the ONE source-compat authority so the recorded modqn-replay-proof
          // stage (also artifact-backed) reads compatible, not just the artifact-replay
          // lane. Was hardcoded to `sceneLane === 'artifact-replay'`.
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
        modqnVisualLayerPreset=""
        modqnServiceMapEnabled="0"
        modqnServedUeCount={0}
        modqnIdleUeCount={0}
        modqnHandoverCuesVisible="0"
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
      {presentationPlan.visible.ues && (
        <GroundScene
          ues={sceneFrame.ues
            .filter((u) => u.worldPos !== undefined)
            .map((u) => {
              const color = replayFieldColorById?.get(u.id);
              return {
                id: u.id,
                worldPos: u.worldPos as readonly [number, number, number],
                markerColor: color?.markerColor,
                markerEmissive: color?.markerEmissive,
              };
            })}
          ueMarkerMultiplier={visualScaleMultipliers.ueMarkerMultiplier}
          markerShape={ueMarkerShape}
          unlitMarkers={isReplayStage}
          colorTelemetryAttr={isReplayStage ? 'replayFieldColorCount' : undefined}
        />
      )}
      {(presentationPlan.visible['selected-satellite']
        || presentationPlan.visible['candidate-satellite']
        || presentationPlan.visible['context-satellites']) && visibleSatellites.map((satellite, index) => {
        const eventRole = sceneFrame.eventRoles.bySatId.get(satellite.id);
        return (
          <SatelliteMarker
            key={satellite.id}
            position={new THREE.Vector3(...satellite.worldPos)}
            label={formatSatelliteLabel(satellite.id)}
            eventRole={eventRole === 'inactive' ? undefined : eventRole}
            satelliteTintColor={satelliteTint(satellite.id, index)}
            constellation={DEFAULT_SATELLITE_CONSTELLATION}
          />
        );
      })}
      {presentationPlan.visible.diagnostics && <FPSCounter />}
    </BaseSceneLayout>
  );
}

/**
 * Live-orbit source wrapper. Keeping the hook here lets the renderer below be
 * reused verbatim by an archived-TLE source without mounting a hidden Walker
 * simulation beside it.
 */
function SceneContent(props: SceneContentProps) {
  const {
    profile,
    speed,
    paused,
    runtime,
    visualScaleMultipliers,
    sceneLane,
    onLiveSeekLanded,
  } = props;
  const [liveSeekLandedKey, setLiveSeekLandedKey] = useState<string | null>(null);
  const handleLiveSeekLanded = useCallback((seekRequestKey: string) => {
    setLiveSeekLandedKey(seekRequestKey);
    onLiveSeekLanded?.(seekRequestKey);
  }, [onLiveSeekLanded]);
  const sceneConfig = useMemo(() => (
    (runtime.appMode === 'sinr-experiment' || sceneLane === 'modqn-live-cell-preview')
      ? NTPU_CONFIG
      : NTPU_LARGE_CONFIG
  ), [runtime.appMode, sceneLane]);
  const paperUserArea = useMemo(
    () => resolveInscribedPaperUserArea(sceneConfig),
    [sceneConfig],
  );
  const useEarthFixedCellTruth = sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview';
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
  );

  return <SceneRenderContent {...props} sim={sim} simSource="live" liveSeekLandedKey={liveSeekLandedKey} />;
}

interface ArchivedTleSceneContentProps extends SceneContentProps {
  readonly frame: SimulationAnalysisFrame | null;
  readonly nextFrame: SimulationAnalysisFrame | null;
  readonly visualOffsetSec: number;
}

/**
 * Archived-TLE source wrapper for the exact same scene renderer used by the
 * original live homepage. Only the `SimFrame` producer changes here.
 */
function ArchivedTleSceneContent({
  frame,
  nextFrame,
  visualOffsetSec,
  ...renderProps
}: ArchivedTleSceneContentProps) {
  const sceneConfig = useMemo(() => (
    (renderProps.runtime.appMode === 'sinr-experiment'
      || renderProps.sceneLane === 'modqn-live-cell-preview')
      ? NTPU_CONFIG
      : NTPU_LARGE_CONFIG
  ), [renderProps.runtime.appMode, renderProps.sceneLane]);
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
    return <Html center><div style={{ color: 'white', fontSize: 18 }}>TLE 場景計算中</div></Html>;
  }

  return (
    <SceneRenderContent
      {...renderProps}
      sim={sim}
      simSource="archived-tle"
      canonicalScenario={frame.scenario}
      canonicalCandidateSatelliteId={frame.tleState.candidateSatellite?.satelliteId ?? null}
      archivedTlePlacement={archivedTlePlacement ?? undefined}
      constellation={frame.provenance.constellation}
    />
  );
}

function SceneRenderContent({
  profile,
  paused,
  runtime,
  visualScaleMultipliers,
  sceneLane,
  onSimUpdate,
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
  liveSeekLandedKey = null,
  constellation = DEFAULT_SATELLITE_CONSTELLATION,
  presentationPlan,
  campusVisible,
}: SceneRenderContentProps) {
  const camera = useThree(state => state.camera);
  const sceneViewportSize = useThree(state => state.size);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraPresetRef = useRef<string | null>('manual');
  const cameraTransitionRef = useRef<'idle' | 'animating'>('idle');
  const cameraTweenRef = useRef<CameraTweenState | null>(null);
  const lastCameraCommandAtRef = useRef<number | null>(null);
  const lastCameraPresetRef = useRef<CameraPreset | null>(null);
  const lastDirectorCommandAtRef = useRef<number | null>(null);
  const multiCandidateCameraFitKeyRef = useRef<string | null>(null);
  const multiCandidateCameraEpisodeRef = useRef<string | null>(null);
  const multiCandidateCameraUserControlledRef = useRef(false);
  const directorSnapshotRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const directorFocusOrbitRef = useRef<DirectorFocusOrbitState | null>(null);
  // MODQN consolidation: the MODQN live page reuses the SINR scene render directly, so
  // it uses the SAME scene config as sinr-experiment (NTPU_CONFIG: same GLB, scale,
  // satellite altitude, visualAlpha, and CAMERA that the SINR cell-truth cones are tuned
  // for). On NTPU_LARGE_CONFIG the larger frame + top-down camera left the faint cones
  // out of view. The MODQN replay/artifact lanes keep NTPU_LARGE_CONFIG.
  const sceneConfig = useMemo(() => (
    (runtime.appMode === 'sinr-experiment' || sceneLane === 'modqn-live-cell-preview')
      ? NTPU_CONFIG
      : NTPU_LARGE_CONFIG
  ), [runtime.appMode, sceneLane]);
  const paperUserArea = useMemo(
    () => resolveInscribedPaperUserArea(sceneConfig),
    [sceneConfig],
  );
  const useEarthFixedCellTruth = sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview';
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
        handover: { triggerTimeSec: profile.handover.triggerTimeSec },
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
      profile.handover.triggerTimeSec,
      profile.beams.frequencyReuse,
      sceneConfig,
      paperUserArea.kmPerWorldUnit,
    ],
  );
  // P1d: project the live SimFrame → NormalizedSceneFrame at the boundary.
  // useBeamViz now consumes only (frame, geometry) — sim/profile stay
  // confined to MainScene.
  const sceneFrame = useMemo(
    () => propSceneFrame ?? liveSimToScene(sim, sceneGeometry),
    [propSceneFrame, sim, sceneGeometry],
  );
  const selectedOtherHandoverUeIds = useMemo(
    () => new Set(selectOtherHandoverUeIds({
      ues: sim.perUePositions ?? [],
      primaryUeId: sceneFrame.ues[0]?.id,
      triggerTimeSec: profile.handover.triggerTimeSec,
      maxOtherHandoverUes: sceneConfig.maxOtherHandoverUes,
    })),
    [
      profile.handover.triggerTimeSec,
      sceneConfig.maxOtherHandoverUes,
      sceneFrame.ues,
      sim.perUePositions,
    ],
  );
  const displayedUes = useMemo(() => {
    const primaryUeId = sceneFrame.ues[0]?.id;
    const visibleUes = beamDisplaySpec.showOtherHandoverUes
      ? filterOtherHandoverDisplayUes(sceneFrame.ues, primaryUeId, selectedOtherHandoverUeIds)
      : sceneFrame.ues;
    return annotateOtherHandoverDisplayUes(
      visibleUes,
      primaryUeId,
      beamDisplaySpec.showOtherHandoverUes ? selectedOtherHandoverUeIds : new Set(),
    );
  }, [
    beamDisplaySpec.showOtherHandoverUes,
    sceneFrame.ues,
    selectedOtherHandoverUeIds,
  ]);
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
    // lanes (true = anchor OFF) so beams keep true earth-fixed positions and UEs
    // render off-centre. MODQN consolidation: modqn-live-cell-preview reuses the SINR
    // scene render, so it also disables the anchor (anchor-ON squashed all beams onto
    // the primary UE → no visible cones).
    sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview',
  );
  const worldUnitsPerKm = 1 / (sceneGeometry.kmPerWorldUnit ?? paperUserArea.kmPerWorldUnit);
  // The physical projection is nearly circular for the high-elevation hero link
  // (e.g. 81° gives only a 1.02 axis ratio). Legacy `/` is the teaching surface,
  // so exaggerate only the displayed tilt while keeping the model's real axis/theta
  // and power recurrence untouched. `/simulator` and MODQN preview stay physical.
  const sinrLiveEllipseTiltExaggeration = sceneLane === 'sinr-live' ? 3 : 1;
  // S-cells-3: ground placements of the FIXED earth-fixed cells for the cell-truth
  // beam cones. Built from the SAME `buildSinrLiveCellLayout(profile)` the runtime
  // cell truth uses (so cellIds match `sim.sinrLiveCells`) and the SAME
  // `worldUnitsPerKm` the UE markers use (east → +X, north → −Z), so a cone base
  // and its UEs share one frame. Empty off the sinr-live lane.
  const sinrLiveCellPlacementById = useMemo<ReadonlyMap<number, SinrLiveCellPlacement>>(() => {
    if (!useEarthFixedCellTruth) return new Map();
    if (canonicalScenario !== undefined && archivedTlePlacement !== undefined) {
      const placement = archivedTlePlacement;
      return new Map(placement.cells.map(cell => [cell.canonicalCellId, {
        cellId: cell.canonicalCellId,
        worldX: cell.centerKm[0] * worldUnitsPerKm,
        worldZ: -cell.centerKm[1] * worldUnitsPerKm,
        radiusWorld: cell.radiusKm * worldUnitsPerKm,
        worldUnitsPerKm,
      }]));
    }
    const activeLayout = buildSinrLiveCellLayout(
      profile,
      resolveSinrLiveSceneCellCount(runtime.servingBeamCount),
    );
    return new Map(activeLayout.centers.map(center => [center.cellId, {
      cellId: center.cellId,
      worldX: center.localXKm * worldUnitsPerKm,
      worldZ: -center.localYKm * worldUnitsPerKm,
      radiusWorld: activeLayout.cellRadiusKm * worldUnitsPerKm,
      worldUnitsPerKm,
    }]));
  }, [
    archivedTlePlacement,
    canonicalScenario,
    runtime.servingBeamCount,
    useEarthFixedCellTruth,
    profile,
    worldUnitsPerKm,
  ]);
  const cellSchedule = useCellSchedule({
    simTimeSec: sceneFrame.tSec,
    altitudeKm: sceneGeometry.shellAltitudeKm,
    beamwidth3dBRad: sceneGeometry.beamwidth3dBRad,
    centerLatDeg: profile.orbit.observerLatDeg ?? 40,
    centerLonDeg: profile.orbit.observerLonDeg ?? 116,
    worldUnitsPerKm,
    satellites: viz.displaySats.map(satellite => ({
      id: satellite.id,
      latDeg: satellite.latDeg,
      lonDeg: satellite.lonDeg,
      altitudeKm: sceneGeometry.shellAltitudeKm,
    })),
    slotSec: CELL_SCHEDULE_VIZ_SLOT_SEC,
    servingCount: runtime.cellServingCount ?? DEFAULT_SERVING_COUNT,
  });
  const satelliteTintById = useMemo(
    () => new Map(viz.displaySats.map((satellite, index) => [
      satellite.id,
      satelliteTint(satellite.id, index),
    ])),
    [viz.displaySats],
  );
  const satelliteWorldById = useMemo(
    () => new Map(viz.displaySats.map(satellite => [
      satellite.id,
      { x: satellite.world.x, y: satellite.world.y, z: satellite.world.z },
    ])),
    [viz.displaySats],
  );
  const cellHoCounts = useMemo(() => ({
    total: cellSchedule.cellReassignments.length,
    inter: cellSchedule.cellReassignments.filter(reassignment => reassignment.kind === 'inter').length,
    intra: cellSchedule.cellReassignments.filter(reassignment => reassignment.kind === 'intra').length,
  }), [cellSchedule.cellReassignments]);
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
    // S-FLAG-2: producer-readiness gate for the MODQN service-allocation overlay
    // family (parked OFF by default; `?modqnServiceAllocation=1` / producer un-park
    // flips it). The render plan AND-s it with `showCellOverlay`.
    modqnServiceAllocationEnabled: runtime.modqnServiceAllocationEnabled ?? false,
  });
  const {
    showCellOverlay,
    showModqnServiceAllocation,
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
    showProfileHandoverStoryLayer,
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
  const modqnVisualLayerPreset = runtime.modqnVisualLayerPreset ?? DEFAULT_MODQN_VISUAL_LAYER_PRESET;
  const modqnVisualLayers = runtime.modqnVisualLayers ?? resolveModqnVisualLayers(modqnVisualLayerPreset);
  // S-FLAG-2: the MODQN service-allocation overlay family (service map + readout +
  // legend + diagnostics grid, per-cell UE-count badges, phase-3 beam-load
  // cylinder + upload particles) is PARKED behind `showModqnServiceAllocation`
  // (producer-readiness gate, default OFF) instead of `showCellOverlay`. The
  // degenerate producer baseline makes the all-UE allocation meaningless noise;
  // the code + data path stays intact so the producer un-park (or
  // `?modqnServiceAllocation=1`) revives the whole family in one move. The default
  // MODQN-LIVE surface keeps the hex cell overlay + cones + sat markers + cinema +
  // HUD; only this family is parked.
  const beamLoadContentionEnabled = showModqnServiceAllocation && modqnVisualLayers.serviceMap;
  const modqnServiceMap = useMemo(
    () => showModqnServiceAllocation && modqnVisualLayers.serviceMap
      ? deriveModqnServiceMap({
        ues: sceneFrame.ues,
        schedule: cellSchedule,
        satelliteTintById,
      })
      : EMPTY_MODQN_SERVICE_MAP,
    [
      cellSchedule,
      modqnVisualLayers.serviceMap,
      satelliteTintById,
      sceneFrame.ues,
      showModqnServiceAllocation,
    ],
  );
  // SINR-serving mosaic (S2 → S-cells-4c): on `sinr-live` colour every UE marker
  // by its serving beam — a DISTINCT SINR-serving layer, never the MODQN cell
  // overlay (`deriveModqnServiceMap`). The serving truth is the EARTH-FIXED CELL
  // model (`sim.sinrLiveCells.ues`), so a UE is coloured ("connected") ONLY when
  // its cell is lit + served and grey otherwise — consistent with the cones, which
  // now also draw the cell truth. Falls back to the steered serving only if the
  // cell truth is absent (never on a healthy sinr-live frame). Inert on every
  // MODQN/artifact lane via the render-plan gate.
  const sinrServingColorById = useMemo(
    () => {
      if (!showSinrServingMosaic) return null;
      const cellFrame = sim.sinrLiveCells;
      return cellFrame
        ? buildSinrServingUeColorMapFromCells(cellFrame.ues)
        : buildSinrServingUeColorMap(sceneFrame.ues);
    },
    [showSinrServingMosaic, sim.sinrLiveCells, sceneFrame.ues],
  );
  // The sinr-serving mosaic COLOUR primitive is shared with the MODQN cell-preview
  // lane (consolidation: MODQN renders like SINR — governance-locked
  // showSinrServingMosaic=true on `modqn-live-cell-preview`). But the sinr-serving
  // mosaic COLOUR TELEMETRY attr is a sinr-live lane PROOF — it stays
  // sinr-live-owned (the mosaic gate contract pins it sinr-live-only), never
  // threading onto the MODQN canvas. showSinrServingMosaic
  // is `sinr-live OR cell-overlay`; exclude the cell-overlay lane for sinr-live-only.
  const sinrServingTelemetryActive = showSinrServingMosaic && !showCellOverlay;
  // Phase-3 beam-load contention source = the SAME per-UE (satId, beamIndex)
  // cell-schedule assignment that `modqnServiceMap` already uses to colour the UE
  // markers and emit the per-cell UE-count badges (`ueCountByCellId`). Provenance
  // audit 2026-06-04 (FIX-7 finding #1): the earlier `sim.perUePositions` source
  // is EMPTY in this lane — the modqn-demo 4-sat profile + decision-overlay live
  // path acquires no per-UE HandoverManager serving (verified: even the primary
  // `sim.serving.satId` is null), so the contention glow never fired. There is NO
  // producer per-UE serving on the live cell lane (that exists only on the replay
  // `allUeServingHistory` path), so the lane's authoritative displayed assignment
  // is this profile-derived cell schedule. It is `source: 'profile-derived-demo'`
  // / `claimKind: 'overlay-demo'` (NOT producer r3 proof): the glow is a per-UE
  // visual encoding of the already-shown overlay-demo cell load, never a new claim.
  // In the schedule each (satId, beamIndex) is used at most once per slot
  // (cellScheduler `usedBeamKeys`), so grouping UEs by (satId, beamIndex) is 1:1
  // with the display cells — the codex-S2 "one beam split across display cells"
  // concern does not arise here. Idle/unknown UEs carry a null satId and stay
  // unserved (load 0), so they never borrow a neighbour's load (INV-3).
  const beamLoadContention = useMemo(
    () => beamLoadContentionEnabled
      ? deriveBeamLoadContention([...modqnServiceMap.ueById.values()].map(projection => ({
        ueId: projection.ueId,
        servingSatId: projection.satId,
        servingBeamId: projection.beamIndex,
      })))
      : EMPTY_BEAM_LOAD_CONTENTION,
    [beamLoadContentionEnabled, modqnServiceMap],
  );
  // Provenance audit 2026-06-04: count of UEs carrying live beam-load contention
  // (>0 normalized load). Surfaced as canvas telemetry so a durable browser gate
  // can prove the phase-3 contention actually fires on real live geometry, rather
  // than only asserting the `<BeamLoadCylinder>` source string mounts (audit B4).
  const beamLoadContentionUeCount = useMemo(
    () => [...beamLoadContention.byUeId.values()].filter(v => (v.normalizedLoad ?? 0) > 0).length,
    [beamLoadContention],
  );
  const ueMarkerShape = resolveSceneLaneUeMarkerShape(sceneLane);
  const focusedCellBeamConeUe = sceneFrame.ues[0] || null;
  const focusBeamLoad = beamLoadContentionEnabled
    ? beamLoadContention.byUeId.get(focusedCellBeamConeUe?.id ?? '')
    : undefined;
  const focusBeamLoadTint = focusedCellBeamConeUe?.servingSatelliteId
    ? satelliteTintById.get(focusedCellBeamConeUe.servingSatelliteId)
    : undefined;
  const modqnCellServiceReadout = useMemo(
    () => showModqnServiceAllocation && modqnVisualLayers.serviceMap
      ? buildModqnCellServiceReadout({
        schedule: cellSchedule,
        serviceMap: modqnServiceMap,
        slotSec: CELL_SCHEDULE_VIZ_SLOT_SEC,
      })
      : undefined,
    [
      cellSchedule,
      modqnServiceMap,
      modqnVisualLayers.serviceMap,
      showModqnServiceAllocation,
    ],
  );
  useSimStatePublisher({
    profile,
    sim,
    frame: sceneFrame,
    viz,
    signalResetKey: runtime.signalResetKey,
    handoverResetKey: runtime.handoverResetKey,
    measurementResetEpoch: runtime.measurementResetEpoch,
    seekRequestKey: runtime.replay.seekRequestKey,
    latchedBeamSinrByKeyRef,
    onSimUpdate,
    enabled: simSource === 'live' && sceneFrame.sceneSource !== 'artifact-replay',
    modqnCellServiceReadout,
    beamCountBySatellite: runtime.beamCountBySatellite,
    servingBeamCount: runtime.servingBeamCount,
    candidateBeamCount: runtime.candidateBeamCount,
  });
  const handoverStoryModel = useMemo(
    () => showProfileHandoverStoryLayer && modqnVisualLayers.handoverStory
      ? deriveProfileHandoverStoryModel({
        sceneLane,
        sceneFrame,
        schedule: cellSchedule,
        satelliteWorldById,
      })
      : null,
    [
      cellSchedule,
      satelliteWorldById,
      sceneFrame,
      sceneLane,
      modqnVisualLayers.handoverStory,
      showProfileHandoverStoryLayer,
    ],
  );
  const renderedCellBeamConeScope = showCellOverlay && modqnVisualLayers.beamCones
    ? modqnVisualLayers.beamConeScope
    : 'none';
  const cellBeamConeInput = useMemo(() => ({
    schedule: cellSchedule,
    satelliteWorldById,
    satelliteTintById,
    focusedUe: focusedCellBeamConeUe,
    beamConeScope: renderedCellBeamConeScope,
    appMode: runtime.appMode,
  }), [
    cellSchedule,
    focusedCellBeamConeUe,
    renderedCellBeamConeScope,
    runtime.appMode,
    satelliteTintById,
    satelliteWorldById,
  ]);
  const renderedCellBeamConeCount = showCellOverlay && modqnVisualLayers.beamCones
    ? resolveCellBeamConeRenderCount({
      ...cellBeamConeInput,
    })
    : 0;
  const renderedCellBeamConeSatelliteCount = showCellOverlay && modqnVisualLayers.beamCones
    ? resolveCellBeamConeSatelliteCount({
      ...cellBeamConeInput,
    })
    : 0;
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
  const displayHeroRecord = useMemo(() => resolveDisplayHeroRecord(
    primaryServingRecord,
    (sim.sinrLiveCells?.illuminatedBeams ?? [])
      .filter(beam => (
        beam.serving
        && sinrLiveCellPlacementById.has(beam.cellId)
        && viz.coneApexWorldById.has(beam.satId)
      ))
      .map(beam => ({ servingSatId: beam.satId, cellId: beam.cellId })),
  ), [
    primaryServingRecord,
    sim.sinrLiveCells,
    sinrLiveCellPlacementById,
    viz.coneApexWorldById,
  ]);
  const multiCandidateAuthorityActive = sim.handoverDecisionFrame !== null
    && sim.handoverDecisionFrame !== undefined;
  const multiCandidateEpisodeId = sim.handoverDecisionFrame?.episodeId ?? 'inactive';
  const {
    pinnedKey: inspectedCandidateKey,
    togglePinnedKey: toggleInspectedCandidateKey,
  } = useCandidateInspectionSelection(multiCandidateEpisodeId);
  const handoverCandidatePresentationPlan = useHomepageCandidatePresentationPlan(
    'scene',
    sim.handoverDecisionFrame ?? null,
    inspectedCandidateKey,
  );
  const multiCandidateScenePresentation = useMemo(
    () => handoverCandidatePresentationPlan === null
      ? null
      : buildMultiCandidateScenePresentation(handoverCandidatePresentationPlan),
    [handoverCandidatePresentationPlan],
  );
  const renderedLiveSatelliteMarkers = useMemo<readonly {
    readonly id: string;
    readonly world: THREE.Vector3;
    readonly satelliteTintColor?: string;
  }[]>(() => {
    if (multiCandidateScenePresentation === null) return viz.displaySats;
    const displayedSatelliteIds = [...new Set(
      multiCandidateScenePresentation.instructions
        .filter(instruction => instruction.isServing || instruction.cone.visible || instruction.isPinned)
        .map(instruction => instruction.satelliteId),
    )];
    const markers: {
      id: string;
      world: THREE.Vector3;
      satelliteTintColor?: string;
    }[] = [];
    for (const satelliteId of displayedSatelliteIds) {
      const existing = viz.displaySats.find(satellite => satellite.id === satelliteId);
      if (existing !== undefined) {
        markers.push(existing);
        continue;
      }
      const apex = viz.coneApexWorldById.get(satelliteId);
      if (apex === undefined) continue;
      markers.push({
        id: satelliteId,
        world: new THREE.Vector3(apex.x, apex.y, apex.z),
        satelliteTintColor: undefined,
      });
    }
    return markers;
  }, [multiCandidateScenePresentation, viz.coneApexWorldById, viz.displaySats]);
  const multiCandidateCameraFitKey = multiCandidateScenePresentation === null
    ? null
    : [
      multiCandidateScenePresentation.episodeId,
      multiCandidateScenePresentation.serving?.pairKey ?? 'unattached',
      `${Math.round(sceneViewportSize.width)}x${Math.round(sceneViewportSize.height)}`,
      ...[...new Set(multiCandidateScenePresentation.instructions
        .filter(instruction => instruction.isServing || instruction.cone.visible || instruction.isPinned)
        .map(instruction => instruction.satelliteId))].sort(),
    ].join('/');
  useLayoutEffect(() => {
    if (multiCandidateScenePresentation === null || multiCandidateCameraFitKey === null) {
      multiCandidateCameraFitKeyRef.current = null;
      multiCandidateCameraEpisodeRef.current = null;
      multiCandidateCameraUserControlledRef.current = false;
      return;
    }
    if (multiCandidateCameraEpisodeRef.current !== multiCandidateScenePresentation.episodeId) {
      multiCandidateCameraEpisodeRef.current = multiCandidateScenePresentation.episodeId;
      multiCandidateCameraUserControlledRef.current = false;
    }
    if (multiCandidateCameraUserControlledRef.current) return;
    const controls = controlsRef.current;
    if (!(camera instanceof THREE.PerspectiveCamera) || controls === null) return;

    const fitPoints: [number, number, number][] = [];
    const primaryUeWorld = sceneFrame.ues[0]?.worldPos;
    if (primaryUeWorld !== undefined) fitPoints.push([...primaryUeWorld]);
    for (const instruction of multiCandidateScenePresentation.instructions) {
      if (instruction.isServing || instruction.cone.visible || instruction.isPinned) {
        const apex = viz.coneApexWorldById.get(instruction.satelliteId);
        if (apex !== undefined) fitPoints.push([apex.x, apex.y, apex.z]);
      }
      const placement = sinrLiveCellPlacementById.get(cellIdFromLinkBudgetBeamId(instruction.beamId));
      if (placement !== undefined) fitPoints.push([placement.worldX, 0, placement.worldZ]);
    }
    const servingSatelliteWorld = multiCandidateScenePresentation.serving === null
      ? undefined
      : viz.coneApexWorldById.get(multiCandidateScenePresentation.serving.satelliteId);
    const compositionChanged = multiCandidateCameraFitKeyRef.current !== multiCandidateCameraFitKey;
    const focusPoints = [
      primaryUeWorld,
      servingSatelliteWorld === undefined
        ? undefined
        : [servingSatelliteWorld.x, servingSatelliteWorld.y, servingSatelliteWorld.z] as const,
    ].filter((point): point is readonly [number, number, number] => point !== undefined);
    const focusStillContained = focusPoints.length > 0
      && areMultiCandidateFocusPointsWithinSafeFrame({
        points: focusPoints,
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
        verticalFovDeg: camera.fov,
        aspect: sceneViewportSize.width / sceneViewportSize.height,
      });
    // Let orbital motion remain visible against a stationary camera. Reframe
    // only after the real serving span approaches the padded edge; while a
    // reframe tween is already running, do not restart it on every Walker frame.
    if (!compositionChanged && focusStillContained) return;
    if (!compositionChanged && cameraTweenRef.current !== null) return;
    const fit = resolveMultiCandidateCameraFit({
      points: fitPoints,
      focusGroundPoint: primaryUeWorld,
      focusElevatedPoint: servingSatelliteWorld === undefined
        ? undefined
        : [servingSatelliteWorld.x, servingSatelliteWorld.y, servingSatelliteWorld.z],
      currentPosition: [camera.position.x, camera.position.y, camera.position.z],
      currentTarget: [controls.target.x, controls.target.y, controls.target.z],
      verticalFovDeg: camera.fov,
      aspect: sceneViewportSize.width / sceneViewportSize.height,
      minDistance: controls.minDistance,
      maxDistance: Math.min(2850, controls.maxDistance),
    });
    if (fit === null) return;
    directorFocusOrbitRef.current = null;
    lastCameraPresetRef.current = null;
    if (compositionChanged || runtime.reducedMotion) {
      cameraTweenRef.current = null;
      camera.position.set(...fit.position);
      controls.target.set(...fit.target);
      controls.update();
      cameraTransitionRef.current = 'idle';
    } else {
      cameraTweenRef.current = {
        preset: null,
        kind: 'multi-candidate-refit',
        startedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPosition: new THREE.Vector3(...fit.position),
        toTarget: new THREE.Vector3(...fit.target),
        durationMs: MULTI_CANDIDATE_REFRAME_DURATION_MS,
      };
      cameraTransitionRef.current = 'animating';
    }
    cameraPresetRef.current = 'manual';
    multiCandidateCameraFitKeyRef.current = multiCandidateCameraFitKey;
  }, [
    camera,
    multiCandidateCameraFitKey,
    multiCandidateScenePresentation,
    runtime.reducedMotion,
    sceneViewportSize.height,
    sceneViewportSize.width,
    sceneFrame.ues,
    sinrLiveCellPlacementById,
    viz.coneApexWorldById,
  ]);
  const renderedCandidateSatelliteId = simSource === 'archived-tle'
    ? canonicalCandidateSatelliteId
    : multiCandidateAuthorityActive
      ? null
      : primaryServingRecord?.pendingTargetSatId;
  const sinrLiveBeamDisplayFrame = useMemo(() => createSinrLiveBeamDisplayFrame({
    profile,
    runtime,
    servingSatelliteId: displayHeroRecord?.servingSatId,
    candidateSatelliteId: renderedCandidateSatelliteId,
  }), [
    displayHeroRecord?.servingSatId,
    profile,
    renderedCandidateSatelliteId,
    runtime,
  ]);
  const candidateDisplayCellFrame = useMemo(() => {
    if (
      simSource !== 'archived-tle'
      || renderedCandidateSatelliteId === null
      || renderedCandidateSatelliteId === undefined
      || sim.sinrLiveCells === undefined
    ) {
      return sim.sinrLiveCells;
    }
    // The immutable TLE frame defines a same-instant comparison satellite, not
    // a pending handover. Supply its seven display beams only to the candidate
    // resolver; the SimFrame handover fields remain null and no TTT is claimed.
    return {
      ...sim.sinrLiveCells,
      illuminatedBeams: sim.sinrLiveCells.cells.map(cell => ({
        satId: renderedCandidateSatelliteId,
        cellId: cell.cellId,
        frequencyIndex: cell.frequencyIndex,
        serving: false,
      })),
    };
  }, [renderedCandidateSatelliteId, sim.sinrLiveCells, simSource]);
  const manualHandoverEvent = useMemo(
    () => runtime.manualHandoverRequestId === undefined || runtime.manualHandoverKind === undefined
      ? null
      : resolveManualHandoverDemoEvent(
        runtime.manualHandoverKind,
        sim.sinrLiveCells,
        sceneFrame.ues[0]?.id,
        [...viz.coneApexWorldById.keys()],
        {
          sourceSatId: runtime.manualHandoverSourceSatId,
          sourceCellId: runtime.manualHandoverSourceCellId,
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
      runtime.manualHandoverTargetCellId,
      runtime.manualHandoverServingSinrDb,
      runtime.manualHandoverCandidateSinrDb,
      sim.sinrLiveCells,
      sceneFrame.ues,
      viz.coneApexWorldById,
    ],
  );
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
  });
  useFrame(() => {
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const { next, publish } = resolveManualHandoverTick({
      requestId: runtime.manualHandoverRequestId,
      startedAtMs: runtime.manualHandoverStartedAtMs,
      nowMs,
      displayMs: MANUAL_HANDOVER_DISPLAY_MS,
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
    } else if (!previousCinema.settled && nowMs - previousCinema.startedAtMs > resolveHandoverCinemaDisplayMs(handoverCinemaCandidate?.kind ?? null)) {
      cinemaHandoverTickRef.current = { ...previousCinema, publishedAtMs: nowMs, settled: true };
      setCinemaHandoverNowMs(nowMs);
    } else if (!previousCinema.settled && nowMs - previousCinema.publishedAtMs >= MANUAL_HANDOVER_TICK_INTERVAL_MS) {
      cinemaHandoverTickRef.current = { ...previousCinema, publishedAtMs: nowMs };
      setCinemaHandoverNowMs(nowMs);
    }
  });
  const manualHandoverProgress = resolveManualHandoverProgress({
    startedAtMs: runtime.manualHandoverStartedAtMs,
    // Before the first tick lands (the very frame the button arms the request) fall back to
    // a direct clock read, so frame 1 is age ≈ 0 rather than a stale value from a prior run.
    nowMs: manualHandoverNowMs ?? (typeof performance === 'undefined' ? Date.now() : performance.now()),
    displayMs: MANUAL_HANDOVER_DISPLAY_MS,
  });
  const manualHandoverAgeMs = manualHandoverProgress.ageMs;
  // F1 (2026-08-06): `manualHandoverEvent !== null` is part of the ACTIVE condition,
  // not just of the draw condition. The manual cue overlays the moving scene; the
  // display-isolation policy below removes the timeline's primary/candidate/event
  // layers while preserving the dim beam context. When the event cannot resolve, the
  // cue is inactive and the normal scene remains available. No cycle:
  // `manualHandoverEvent` (above) does not read this flag.
  const manualHandoverRequested = runtime.manualHandoverRequestId !== undefined
    && runtime.manualHandoverKind !== undefined
    && manualHandoverAgeMs <= MANUAL_HANDOVER_DISPLAY_MS;
  const manualHandoverActive = manualHandoverRequested
    && manualHandoverEvent !== null;
  const manualHandoverProgressSec = manualHandoverProgress.progressSec;
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
    const readApexWorld = (satId: string): InterCinemaApexWorld | undefined => {
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
  const cinemaInterSatelliteWorldById = useMemo(() => {
    const worldById = new Map(viz.coneApexWorldById);
    if (cinemaInterPairAnchor?.fromApexWorld !== undefined && !worldById.has(cinemaInterPairAnchor.fromSatId)) {
      worldById.set(cinemaInterPairAnchor.fromSatId, cinemaInterPairAnchor.fromApexWorld);
    }
    if (cinemaInterPairAnchor?.toApexWorld !== undefined && !worldById.has(cinemaInterPairAnchor.toSatId)) {
      worldById.set(cinemaInterPairAnchor.toSatId, cinemaInterPairAnchor.toApexWorld);
    }
    return worldById;
  }, [cinemaInterPairAnchor, viz.coneApexWorldById]);
  // The offline cell-truth index supplies the real event/time for the cinema. The
  // pair is now a presentation snapshot: later live-frame changes cannot replace
  // either side while the teaching animation is running.
  const cinemaPairCandidate = useMemo(() => {
    if (handoverCinemaCandidate === null || handoverCinemaCandidate.kind !== 'inter') return handoverCinemaCandidate;
    const pairAnchor = cinemaInterPairAnchor?.eventId === handoverCinemaCandidate.eventId
      ? cinemaInterPairAnchor
      : null;
    if (pairAnchor === null) return handoverCinemaCandidate;
    return {
      ...handoverCinemaCandidate,
      fromSatId: pairAnchor.fromSatId,
      fromCellId: pairAnchor.fromCellId,
      toSatId: pairAnchor.toSatId,
      toCellId: pairAnchor.toCellId,
    };
  }, [cinemaInterPairAnchor, handoverCinemaCandidate]);

  const recentPrimaryHandoverEvent = useMemo<SinrLiveCellHandoverEvent | null>(() => {
    const events = sim.sinrLiveCells?.recentHandoverEvents;
    const currentSimTimeSec = sim.sinrLiveCells?.simTimeSec ?? sim.simTimeSec;
    const protagonistUeId = sceneFrame.ues[0]?.id;
    if (!events || !protagonistUeId || !Number.isFinite(currentSimTimeSec)) return null;
    let latestPrimaryEvent: SinrLiveCellHandoverEvent | null = null;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (
        event.ueId !== protagonistUeId
        || event.fromSatId === null
        || event.fromCellId === null
      ) continue;
      const ageSec = currentSimTimeSec - event.sourceTimeSec;
      if (ageSec < 0 || ageSec >= SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC) continue;
      // Keep an inter story authoritative for the whole retention window even
      // if the classifier also reports a newer same-UE intra transition. The
      // presentation owner is wall-clock paced, so allowing the latest array
      // item to win would replace the visible inter pair mid-animation.
      if (event.kind === 'inter') return event;
      latestPrimaryEvent ??= event;
    }
    return latestPrimaryEvent;
  }, [sceneFrame.ues, sim.simTimeSec, sim.sinrLiveCells]);

  // The model retains background-UE events for telemetry too. They do not own
  // the protagonist's camera story, but a real inter event anywhere still
  // blocks a new intra teaching request and suppresses an intra pulse so the
  // viewport cannot show two handover kinds at once.
  const recentAnyInterHandoverEvent = useMemo<SinrLiveCellHandoverEvent | null>(() => {
    const events = sim.sinrLiveCells?.recentHandoverEvents;
    const currentSimTimeSec = sim.sinrLiveCells?.simTimeSec ?? sim.simTimeSec;
    if (!events || !Number.isFinite(currentSimTimeSec)) return null;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      const ageSec = currentSimTimeSec - event.sourceTimeSec;
      if (
        event.kind === 'inter'
        && event.fromSatId !== null
        && event.fromCellId !== null
        && ageSec >= 0
        && ageSec < SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC
      ) return event;
    }
    return null;
  }, [sim.simTimeSec, sim.sinrLiveCells]);

  const handoverPresentationCandidate = useMemo<HandoverPresentationEvent | null>(() => {
    const endpoint = (
      satId: string | null,
      cellId: number | null,
      satelliteWorldById: ReadonlyMap<string, { readonly x: number; readonly y: number; readonly z: number }>,
    ) => satId === null || cellId === null
      ? null
      : {
        satId,
        cellId,
        drawable: sinrLiveCellPlacementById.has(cellId) && satelliteWorldById.has(satId),
      };

    const naturalCandidate = recentPrimaryHandoverEvent === null
      ? null
      : (() => {
        const from = endpoint(
          recentPrimaryHandoverEvent.fromSatId,
          recentPrimaryHandoverEvent.fromCellId,
          viz.coneApexWorldById,
        );
        const to = endpoint(
          recentPrimaryHandoverEvent.toSatId,
          recentPrimaryHandoverEvent.toCellId,
          viz.coneApexWorldById,
        );
        if (from === null || to === null) return null;
        return {
          eventId: `${simSource}:${recentPrimaryHandoverEvent.ueId}:${recentPrimaryHandoverEvent.sourceTimeSec}:${recentPrimaryHandoverEvent.kind}`,
          source: simSource === 'archived-tle' ? 'tle' : 'walker',
          kind: recentPrimaryHandoverEvent.kind,
          ueId: recentPrimaryHandoverEvent.ueId,
          sourceTimeSec: recentPrimaryHandoverEvent.sourceTimeSec,
          from,
          to,
          // The normalized owner uses the longer inter envelope for both the
          // live Walker story and the explicit cinema story. This keeps the
          // source beam visible until the candidate actually arrives.
          durationMs: recentPrimaryHandoverEvent.kind === 'inter'
            ? resolveHandoverCinemaDisplayMs('inter')
            : beamDisplaySpec.triggeredIntraSustainMs,
        } satisfies HandoverPresentationEvent;
      })();

    // An intra request is never allowed to replace a source-backed inter event,
    // regardless of whether the request came from the automatic scheduler or a
    // button. This is the render-time half of the shared admission gate; App's
    // ref gate covers the parent-effect half.
    if (
      manualHandoverEvent?.kind === 'intra'
      && naturalCandidate?.kind === 'inter'
    ) return naturalCandidate;

    if (manualHandoverActive && manualHandoverEvent !== null) {
      const from = endpoint(manualHandoverEvent.fromSatId, manualHandoverEvent.fromCellId, viz.coneApexWorldById);
      const to = endpoint(manualHandoverEvent.toSatId, manualHandoverEvent.toCellId, viz.coneApexWorldById);
      if (from !== null && to !== null) {
        return {
          eventId: `manual:${runtime.manualHandoverRequestId ?? 'unknown'}`,
          source: 'manual',
          kind: manualHandoverEvent.kind,
          ueId: manualHandoverEvent.ueId,
          sourceTimeSec: manualHandoverEvent.sourceTimeSec,
          from,
          to,
          durationMs: MANUAL_HANDOVER_DISPLAY_MS,
          fromSinrDb: manualHandoverEvent.fromSinrDb,
          toSinrDb: manualHandoverEvent.toSinrDb,
          deltaDb: manualHandoverEvent.deltaDb,
        };
      }
    }

    // A manual request owns the viewport even if its endpoints fail the
    // drawable check. Fail closed: suppress natural visual events instead of
    // allowing an unrelated live handover to replace the requested story.
    if (manualHandoverRequested) return null;

    if (cinemaHandoverReady && cinemaPairCandidate !== null) {
      const from = endpoint(
        cinemaPairCandidate.fromSatId,
        cinemaPairCandidate.fromCellId,
        cinemaInterSatelliteWorldById,
      );
      const to = endpoint(
        cinemaPairCandidate.toSatId,
        cinemaPairCandidate.toCellId,
        cinemaInterSatelliteWorldById,
      );
      if (from !== null && to !== null) {
        return {
          eventId: `cinema:${cinemaPairCandidate.eventId}`,
          source: 'cinema',
          kind: cinemaPairCandidate.kind,
          ueId: cinemaPairCandidate.ueId,
          sourceTimeSec: cinemaPairCandidate.sourceTimeSec,
          from,
          to,
          durationMs: resolveHandoverCinemaDisplayMs(cinemaPairCandidate.kind),
        };
      }
    }

    // Once the director button is armed, the natural retention buffer is no
    // longer allowed to become a second presentation owner. Until the exact
    // cinema frame lands, keep the current serving field and suppress all
    // stale handover overlays; after it lands, the cinema branch above owns it.
    if (handoverCinemaArmed) return null;

    // A natural inter event is the first visible owner for this frame. This
    // ordering matters on the warm-start frame: the parent automatic-intra
    // effect must not turn a simultaneous natural intra cue into the owner
    // before the inter pair has acquired the presentation lock. Once an owner
    // is active, advanceHandoverPresentation still prevents any candidate from
    // preempting it.
    return naturalCandidate;
  }, [
    beamDisplaySpec.triggeredIntraSustainMs,
    cinemaHandoverReady,
    cinemaInterSatelliteWorldById,
    cinemaPairCandidate,
    handoverCinemaArmed,
    manualHandoverRequested,
    manualHandoverActive,
    manualHandoverEvent,
    recentPrimaryHandoverEvent,
    runtime.manualHandoverRequestId,
    simSource,
    sinrLiveCellPlacementById,
    viz.coneApexWorldById,
  ]);

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
  handoverPresentationStateRef.current = handoverPresentationStep.state;
  const handoverPresentation = handoverPresentationStep.view;
  // App's automatic intra scheduler is a parent effect, while this owner lives
  // inside the R3F render tree. Publish the lock during render (ref-only) so the
  // parent cannot arm a competing intra between these two effect phases.
  const handoverPresentationBusy = handoverPresentationStep.state.mode === 'presenting'
    || (handoverPresentationStep.state.mode === 'cooldown'
      && handoverPresentationNowMs < handoverPresentationStep.state.cooldownUntilMs);
  onHandoverPresentationBusyChange?.(handoverPresentationBusy || recentAnyInterHandoverEvent !== null);
  const handoverPresentationSource = handoverPresentation.event?.source ?? null;
  const presentedCinemaHandoverActive = handoverPresentation.active
    && handoverPresentationSource === 'cinema';
  const presentedInterHandoverActive = handoverPresentation.active
    && handoverPresentation.event?.kind === 'inter';
  const manualHandoverPresentationActive = handoverPresentation.active
    && handoverPresentationSource === 'manual'
    && manualHandoverActive;
  // A natural inter story owns the viewport until the shared presentation
  // owner releases it. Direct runtime effects must not paint an intra cue over
  // that owner even if an older frame still carries an intra latch.
  const concurrentIntraVisualSuppressed = (
    handoverPresentation.active
    && handoverPresentation.event?.kind === 'inter'
  ) || recentAnyInterHandoverEvent !== null;
  // `pendingTargetSatId` is the live model's pre-fire inter candidate. It is
  // intentionally not a second visual owner: the candidate fan must not paint
  // here and then disappear when the normalized handover story acquires the
  // viewport. The story owner below will paint the same target once, after its
  // serving lead-in, together with the badge and ho-slow state.
  const naturalInterCandidatePending = simSource === 'live'
    && !multiCandidateAuthorityActive
    && primaryServingRecord?.pendingTargetSatId !== null
    && primaryServingRecord?.pendingTargetSatId !== undefined
    && primaryServingRecord.pendingTargetSatId !== primaryServingRecord.servingSatId;
  const presentationHandoverEnvelope = resolveHandoverCinemaEnvelope(
    handoverPresentation.event?.kind ?? null,
    handoverPresentation.progress01,
    beamDisplaySpec.triggeredIntraPeakOpacity,
  );
  const handoverDisplayIsolation = resolveHandoverDisplayIsolation({
    manualHandoverActive: handoverPresentation.active && handoverPresentationSource === 'manual',
    manualHandoverRequested,
    cinemaCandidateActive: handoverPresentation.active && handoverPresentationSource === 'cinema',
    cinemaCandidateArmed: handoverCinemaArmed,
    cinemaCandidateReady: cinemaHandoverReady,
    cinemaCandidateKind: handoverPresentation.event?.kind ?? handoverCinemaKind,
    presentationSource: handoverPresentationSource
      ?? (handoverPresentationStep.state.mode === 'idle' && handoverCinemaArmed ? 'cinema' : undefined),
    naturalPresentationActive: handoverPresentation.active
      && (handoverPresentationSource === 'walker' || handoverPresentationSource === 'tle'),
    naturalInterCandidatePending,
    presentationKind: handoverPresentation.event?.kind ?? null,
    presentationMode: handoverPresentationStep.state.mode,
  });

  const presentedHandoverPairCandidate = useMemo<SinrLiveCinemaHandoverCandidate | null>(() => {
    const event = handoverPresentation.event;
    if (!handoverPresentation.active || event === null) return null;
    return {
      eventId: event.eventId,
      ueId: event.ueId ?? null,
      kind: event.kind,
      sourceTimeSec: event.sourceTimeSec ?? sim.simTimeSec,
      fromSatId: event.from.satId,
      fromCellId: event.from.cellId,
      toSatId: event.to.satId,
      toCellId: event.to.cellId,
    };
  }, [handoverPresentation.active, handoverPresentation.event, sim.simTimeSec]);
  const presentationSatelliteWorldById = presentedCinemaHandoverActive
    ? cinemaInterSatelliteWorldById
    : viz.coneApexWorldById;

  useEffect(() => {
    onHandoverPresentationChange?.({
      view: handoverPresentation,
      mode: handoverPresentationStep.state.mode,
      cooldownUntilMs: handoverPresentationStep.state.cooldownUntilMs,
    });
  }, [
    handoverPresentation.active,
    handoverPresentation.autoSlowActive,
    handoverPresentation.event?.eventId,
    handoverPresentation.phase,
    handoverPresentationStep.state.cooldownUntilMs,
    handoverPresentationStep.state.mode,
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
  const cinemaInterDisplayCellFrame = useMemo(() => {
    if (presentedHandoverPairCandidate?.kind !== 'inter' || sim.sinrLiveCells === undefined) {
      return sim.sinrLiveCells;
    }
    const sourceSatId = presentedHandoverPairCandidate.fromSatId;
    const targetSatId = presentedHandoverPairCandidate.toSatId;
    return {
      ...sim.sinrLiveCells,
      illuminatedBeams: sim.sinrLiveCells.cells.flatMap(cell => [
        {
          satId: sourceSatId,
          cellId: cell.cellId,
          frequencyIndex: cell.frequencyIndex,
          serving: false,
        },
        {
          satId: targetSatId,
          cellId: cell.cellId,
          frequencyIndex: cell.frequencyIndex,
          serving: false,
        },
      ]),
    };
  }, [presentedHandoverPairCandidate, sim.sinrLiveCells]);

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

  // The ONE appearance palette for every cone + footprint mount (2026-08-06 consolidation).
  // Built once from `beamDisplaySpec` and handed to all five cone mounts + both footprint
  // mounts, so a mount no longer carries its own colour/opacity precedence — it declares
  // its LAYER, each cone's ROLE is derived, and the role decides colour + opacity in the
  // single decision point `resolveSinrLiveConeRoleStyle`. Every value here is a spec field,
  // so the prompt-editable control surface is unchanged.
  const sinrLiveConePalette = useMemo(
    () => ({
      heroColor: beamDisplaySpec.heroConeColor,
      servingFanColor: beamDisplaySpec.servingFanConeColor,
      backgroundColor: beamDisplaySpec.backgroundConeColor,
      candidateColor: beamDisplaySpec.candidateConeColor,
      candidateFanColor: beamDisplaySpec.candidateFanConeColor,
      pulseIntraColor: beamDisplaySpec.pulseIntraColor,
      pulseInterColor: beamDisplaySpec.pulseInterColor,
      heroOpacity: beamDisplaySpec.heroConeOpacity,
      servingConeOpacity: beamDisplaySpec.servingConeOpacity,
      backgroundOpacity: beamDisplaySpec.backgroundConeOpacity,
      candidateOpacity: beamDisplaySpec.candidateConeOpacity,
      candidateFanOpacity: beamDisplaySpec.candidateFanConeOpacity,
      nonServingOpacity: beamDisplaySpec.nonServingConeOpacity,
    }),
    [
      beamDisplaySpec.heroConeColor,
      beamDisplaySpec.servingFanConeColor,
      beamDisplaySpec.backgroundConeColor,
      beamDisplaySpec.candidateConeColor,
      beamDisplaySpec.candidateFanConeColor,
      beamDisplaySpec.pulseIntraColor,
      beamDisplaySpec.pulseInterColor,
      beamDisplaySpec.heroConeOpacity,
      beamDisplaySpec.servingConeOpacity,
      beamDisplaySpec.backgroundConeOpacity,
      beamDisplaySpec.candidateConeOpacity,
      beamDisplaySpec.candidateFanConeOpacity,
      beamDisplaySpec.nonServingConeOpacity,
    ],
  );

  const sinrLiveCellBeamConeItems = useMemo(
    () => {
      if (!showSinrLiveCellBeams) return [];
      if (handoverDisplayIsolation.hideNormalBeamField) return [];
      // Other-beams power-view (showNonServingCones) → every serving sat (full
      // breadth). Default → focus to the HERO serving satellite ONLY. Empty target
      // set (no primary serving) draws nothing, never the unbounded all-sat firehose.
      if (!beamDisplaySpec.showNonServingCones && sinrLiveTargetSatIds !== null && sinrLiveTargetSatIds.size === 0) return [];
      const rawItems = resolveSinrLiveCellBeamConeItems({
        cellFrame: sim.sinrLiveCells,
        placementByCellId: sinrLiveCellPlacementById,
        // S5-2: the serving-sat-COMPLETE cone-apex map (every projected sat, NOT the
        // top-12 `satelliteWorldById` display slice) so a target sat beyond the display
        // cap still gets a cone (display cap applied at DRAW, never at TRUTH).
        satelliteWorldById: viz.coneApexWorldById,
        focusSatIds: beamDisplaySpec.showNonServingCones ? null : sinrLiveTargetSatIds,
      });
      const servingBeamBudget = resolveSinrLiveConfiguredBeamCount({
        profile,
        runtime,
        satelliteId: displayHeroRecord?.servingSatId,
        role: 'serving',
      });
      const items = beamDisplaySpec.showNonServingCones
        ? rawItems
        : resolveBudgetedSinrLiveBeamConeItems({
          existingItems: rawItems,
          satId: displayHeroRecord?.servingSatId,
          maxCones: servingBeamBudget,
          placementByCellId: sinrLiveCellPlacementById,
          satelliteWorldById: viz.coneApexWorldById,
          frequencyReuse: profile.beams.frequencyReuse,
          role: 'servingFan',
          renderKeyPrefix: 'serving-display-fan',
          preferredCellId: displayHeroRecord?.cellId,
        });
      if (
        !handoverDisplayIsolation.hidePrimaryServingBeam
        || displayHeroRecord?.servingSatId == null
        || displayHeroRecord.cellId == null
      ) {
        return items;
      }
      return items.filter(item => (
        item.satId !== displayHeroRecord.servingSatId
        || item.cellId !== displayHeroRecord.cellId
      ));
    },
    [
      showSinrLiveCellBeams,
      sim.sinrLiveCells,
      sinrLiveCellPlacementById,
      viz.coneApexWorldById,
      beamDisplaySpec.showNonServingCones,
      sinrLiveTargetSatIds,
      profile,
      runtime,
      handoverDisplayIsolation.hideNormalBeamField,
      handoverDisplayIsolation.hidePrimaryServingBeam,
      displayHeroRecord,
    ],
  );
  // SEMANTIC candidate cue: the imminent inter-handover TARGET sat (`pendingTargetSatId`)
  // and the beams it is painting. 2026-08-06 OWNER DECISION — it now draws that satellite's
  // own BOUNDED multibeam fan, not a single cone (「候選波束…也要有其他波束打在其他地方，不能
  // 只有一個波束」). The cone on YOUR cell keeps the bright candidate blue; the rest of that
  // ONE satellite's beams are the darker, fainter candidate-fan role, so the serving link
  // stays the brightest thing on screen. Bounded by that satellite's live beam budget
  // over a single satId — it can never widen into the all-sat firehose. The target sat is still
  // deliberately absent from `sinrLiveTargetSatIds` above (so it floods none of the serving
  // / non-serving / callout layers); this fan is the only thing it draws. Display-only (Rule#6).
  const sinrLiveCandidateBeamConeItems = useMemo(
    () => {
      if (!showSinrLiveCellBeams || handoverDisplayIsolation.hideCandidateFan) {
        if (!handoverDisplayIsolation.showCinemaCandidateFan) return [];
      }
      if (!showSinrLiveCellBeams) return [];

      const isInterPresentation = handoverDisplayIsolation.showCinemaCandidateFan
        && presentedHandoverPairCandidate?.kind === 'inter';
      const pendingTargetSatId = isInterPresentation
        ? presentedHandoverPairCandidate.toSatId
        : renderedCandidateSatelliteId;
      const servingSatId = isInterPresentation
        ? presentedHandoverPairCandidate.fromSatId
        : primaryServingRecord?.servingSatId;
      const primaryCellId = isInterPresentation
        ? presentedHandoverPairCandidate.toCellId
        : primaryServingRecord?.cellId;
      const candidateBeamBudget = resolveSinrLiveConfiguredBeamCount({
        profile,
        runtime,
        satelliteId: pendingTargetSatId,
        role: 'candidate',
      });
      const rawItems = resolveCandidateBeamConeItems({
        pendingTargetSatId,
        servingSatId,
        primaryCellId,
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: isInterPresentation ? presentationSatelliteWorldById : viz.coneApexWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        cellFrame: isInterPresentation ? cinemaInterDisplayCellFrame : candidateDisplayCellFrame,
        maxFanCones: candidateBeamBudget,
      });
      if (!isInterPresentation) {
        return resolveBudgetedSinrLiveBeamConeItems({
          existingItems: rawItems,
          satId: pendingTargetSatId,
          maxCones: candidateBeamBudget,
          placementByCellId: sinrLiveCellPlacementById,
          satelliteWorldById: viz.coneApexWorldById,
          frequencyReuse: profile.beams.frequencyReuse,
          role: 'candidateFan',
          renderKeyPrefix: 'candidate-display-fan',
        });
      }

      // The exact candidate primary cone is owned by the cinema pair. Keep only
      // the target satellite's other beams here and let them follow its target
      // opacity, so the whole fan arrives and leaves as one handover actor.
      const targetOpacity = presentationHandoverEnvelope.phase === 'settled'
        ? beamDisplaySpec.triggeredIntraPeakOpacity
        : presentationHandoverEnvelope.toOpacity;
      const candidateFanOpacity = beamDisplaySpec.candidateFanConeOpacity * targetOpacity;
      if (candidateFanOpacity <= 0) return [];
      return resolveBudgetedSinrLiveBeamConeItems({
        existingItems: rawItems.filter(item => item.role === 'candidateFan'),
        satId: pendingTargetSatId,
        // The cinema pair owns the target's primary cone, so the separate fan
        // may occupy the remaining budget only.
        maxCones: Math.max(0, candidateBeamBudget - 1),
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: presentationSatelliteWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        role: 'candidateFan',
        renderKeyPrefix: 'cinema-candidate-display-fan',
      })
        .map(item => ({
          ...item,
          role: handoverPresentation.targetRole === 'serving' ? 'servingFan' as const : item.role,
          opacity: candidateFanOpacity,
        }));
    },
    [
      showSinrLiveCellBeams,
      handoverDisplayIsolation.hideCandidateFan,
      handoverDisplayIsolation.showCinemaCandidateFan,
      renderedCandidateSatelliteId,
      primaryServingRecord?.servingSatId,
      primaryServingRecord?.cellId,
      presentedHandoverPairCandidate,
      presentationHandoverEnvelope,
      handoverPresentation.targetRole,
      beamDisplaySpec.candidateFanConeOpacity,
      beamDisplaySpec.triggeredIntraPeakOpacity,
      sinrLiveCellPlacementById,
      viz.coneApexWorldById,
      presentationSatelliteWorldById,
      profile.beams.frequencyReuse,
      candidateDisplayCellFrame,
      cinemaInterDisplayCellFrame,
      profile,
      runtime,
    ],
  );

  // Inter-only source fan: the pair owns the primary source cone, while this bounded
  // fan keeps the rest of the original serving satellite's beams visible until the
  // source side releases. Display-only; no serving ownership or live calculation moves.
  const sinrLiveCinemaInterServingFanConeItems = useMemo(() => {
    if (
      !showSinrLiveCellBeams
      || !handoverDisplayIsolation.showCinemaCandidateFan
      || presentedHandoverPairCandidate?.kind !== 'inter'
    ) return [];
    const sourceBeamBudget = resolveSinrLiveConfiguredBeamCount({
      profile,
      runtime,
      satelliteId: presentedHandoverPairCandidate.fromSatId,
      role: 'serving',
    });
    const sourceFanOpacity = beamDisplaySpec.servingConeOpacity * presentationHandoverEnvelope.fromOpacity;
    const rawItems = resolveCinemaInterServingFanConeItems({
      candidate: presentedHandoverPairCandidate,
      opacity: sourceFanOpacity,
      placementByCellId: sinrLiveCellPlacementById,
      satelliteWorldById: presentationSatelliteWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
      cellFrame: cinemaInterDisplayCellFrame,
      maxFanCones: sourceBeamBudget,
    });
    return resolveBudgetedSinrLiveBeamConeItems({
      existingItems: rawItems,
      satId: presentedHandoverPairCandidate.fromSatId,
      // The cinema pair owns the source primary cone, so this fan uses the
      // remaining serving-satellite budget.
      maxCones: Math.max(0, sourceBeamBudget - 1),
      placementByCellId: sinrLiveCellPlacementById,
      satelliteWorldById: presentationSatelliteWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
      role: 'servingFan',
      renderKeyPrefix: 'cinema-serving-display-fan',
    }).map(item => ({ ...item, opacity: sourceFanOpacity }));
  }, [
    showSinrLiveCellBeams,
    handoverDisplayIsolation.showCinemaCandidateFan,
    presentedHandoverPairCandidate,
    beamDisplaySpec.servingConeOpacity,
    presentationHandoverEnvelope,
    sinrLiveCellPlacementById,
    presentationSatelliteWorldById,
    profile.beams.frequencyReuse,
    cinemaInterDisplayCellFrame,
    profile,
    runtime,
  ]);
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
  const sinrLiveCellNonServingConeItems = useMemo(
    () => {
      if (!showSinrLiveCellBeams || handoverDisplayIsolation.hideNormalBeamField) return [];
      if (!beamDisplaySpec.showNonServingCones && sinrLiveTargetSatIds !== null && sinrLiveTargetSatIds.size === 0) return [];
      return resolveSinrLiveNonServingConeItems({
        cellFrame: sim.sinrLiveCells,
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: viz.coneApexWorldById,
        focusSatIds: beamDisplaySpec.showNonServingCones ? null : sinrLiveTargetSatIds,
      });
    },
    [
      showSinrLiveCellBeams,
      handoverDisplayIsolation.hideNormalBeamField,
      beamDisplaySpec.showNonServingCones,
      sim.sinrLiveCells,
      sinrLiveCellPlacementById,
      viz.coneApexWorldById,
      sinrLiveTargetSatIds,
    ],
  );
  // G2c ambient live-handover pulse: the real per-frame handovers the cell model
  // classified (`sim.sinrLiveCells.recentHandoverEvents`) → bright, age-faded cones
  // on each event's old/new cell. ALWAYS-ON on sinr-live (not director-gated) so the
  // sim playing forward shows continuous handovers with no seek/no camera. Uses the
  // serving-sat-COMPLETE apex map (`viz.coneApexWorldById`, like the ambient cones)
  // so a handover on any serving sat draws even beyond the display cap. Display-only
  // read-out of truth (Rule#6); the serving decision is unchanged.
  const sinrLiveCellPulseConeItems = useMemo(
    () => {
      if (
        handoverDisplayIsolation.hideTimelinePulse
        || handoverDisplayIsolation.suppressNaturalHandoverLayers
        || !showSinrLiveHandoverPulse
      ) return [];
      const selectedHandoverEvents = selectHandoverEventsForDisplay(
        sim.sinrLiveCells?.recentHandoverEvents,
        sceneFrame.ues[0]?.id ?? null,
        beamDisplaySpec.showOtherHandoverUes,
      );
      const selectedHandoverEventSet = new Set(selectedHandoverEvents);
      return resolveSinrLiveHandoverPulseConeItems({
        // SEMANTIC scene rule: only the HERO serving satellite draws the broad beam
        // layers, so the ambient handover pulse is FOCUSED to it (`sinrLiveTargetSatIds`,
        // serving sat only) too — a handover on any OTHER satellite no longer flashes a
        // cone on a sat that is otherwise dark (the "why is a non-serving/non-candidate sat
        // beaming?" fix). The imminent-handover target is the separate blue candidate cone, not a pulse.
        // Display-only filter; the model's events are unchanged.
        recentHandoverEvents: (sim.sinrLiveCells?.recentHandoverEvents ?? []).filter(
          event => selectedHandoverEventSet.has(event),
        ).filter(
          event => !concurrentIntraVisualSuppressed || event.kind === 'inter',
        ).filter(
            e => sinrLiveTargetSatIds === null || !beamDisplaySpec.pulseFocusFollowsScope
              || sinrLiveTargetSatIds.has(e.toSatId)
              || (e.fromSatId !== null && sinrLiveTargetSatIds.has(e.fromSatId)),
          ),
        simTimeSec: sim.sinrLiveCells?.simTimeSec ?? 0,
        retentionSec: SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: viz.coneApexWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        // PER-SIDE focus gate (2026-08-06). The event filter above admits an event when
        // EITHER end touches a focused sat — but an INTER handover's two ends are two
        // DIFFERENT satellites, so the far end still lit a cone on a satellite that draws
        // nothing else, for one of the other 99 UEs. Measured: 50% of all pulse cones, and
        // 100% of the `from` sides, were exactly that. The gate keeps a side only when its
        // OWN satellite is focused, or when the handover is the protagonist's (whose inter
        // HO should show both ends — that is the story). Display-only (Rule#6).
        focusSatIds: beamDisplaySpec.pulseFocusFollowsScope ? sinrLiveTargetSatIds : null,
        protagonistUeId: sceneFrame.ues[0]?.id ?? null,
      });
    },
    [handoverDisplayIsolation.hideTimelinePulse, handoverDisplayIsolation.suppressNaturalHandoverLayers, concurrentIntraVisualSuppressed, showSinrLiveHandoverPulse, sim.sinrLiveCells, sceneFrame.ues, sinrLiveCellPlacementById, viz.coneApexWorldById, profile.beams.frequencyReuse, sinrLiveTargetSatIds, beamDisplaySpec.pulseFocusFollowsScope, beamDisplaySpec.showOtherHandoverUes],
  );
  // Manual and naturally observed Walker/TLE events share the coordinator's
  // single latched pair. Incoming events cannot restart this envelope; they are
  // presentation-suppressed until the active story and cooldown have finished.
  const triggeredIntraConeItems = useMemo(() => {
    if (
      !showSinrLiveCellBeams
      || !handoverPresentation.active
      || handoverPresentation.event?.source !== 'manual'
      || handoverPresentation.event?.kind !== 'intra'
      || presentedCinemaHandoverActive
      || presentedHandoverPairCandidate === null
      || presentedHandoverPairCandidate.fromCellId === null
      || presentedHandoverPairCandidate.toCellId === null
    ) return [];
    const event: SinrLiveCellHandoverEvent = {
      ueId: presentedHandoverPairCandidate.ueId ?? sceneFrame.ues[0]?.id ?? 'ue-0',
      kind: presentedHandoverPairCandidate.kind,
      sourceTimeSec: presentedHandoverPairCandidate.sourceTimeSec,
      fromSatId: presentedHandoverPairCandidate.fromSatId,
      fromCellId: presentedHandoverPairCandidate.fromCellId,
      toSatId: presentedHandoverPairCandidate.toSatId,
      toCellId: presentedHandoverPairCandidate.toCellId,
    };
    const isManual = handoverPresentation.event?.source === 'manual';
    return resolveTriggeredIntraConeItems({
      event,
      fromOpacity: presentationHandoverEnvelope.fromOpacity,
      toOpacity: presentationHandoverEnvelope.phase === 'settled'
        ? beamDisplaySpec.triggeredIntraPeakOpacity
        : presentationHandoverEnvelope.toOpacity,
      fromColor: beamDisplaySpec.triggeredIntraFromColor,
      toColor: handoverPresentation.targetRole === 'serving'
        ? beamDisplaySpec.heroConeColor
        : resolveTriggeredHandoverTargetColor(event.kind, beamDisplaySpec),
      placementByCellId: sinrLiveCellPlacementById,
      satelliteWorldById: presentationSatelliteWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
      baseCenterOverride: isManual ? manualHandoverGroundTarget : undefined,
      fromBaseRadiusScale: isManual ? 0.84 : undefined,
      toBaseRadiusScale: isManual ? 1 : undefined,
    });
  }, [
    beamDisplaySpec.candidateConeColor,
    beamDisplaySpec.heroConeColor,
    beamDisplaySpec.triggeredIntraFromColor,
    beamDisplaySpec.triggeredIntraPeakOpacity,
    beamDisplaySpec.triggeredIntraToColor,
    handoverPresentation.active,
    handoverPresentation.event,
    handoverPresentation.targetRole,
    manualHandoverGroundTarget,
    presentationHandoverEnvelope,
    presentedCinemaHandoverActive,
    presentedHandoverPairCandidate,
    presentationSatelliteWorldById,
    profile.beams.frequencyReuse,
    showSinrLiveCellBeams,
    sceneFrame.ues,
    sinrLiveCellPlacementById,
  ]);
  // Focused cinema pair: the candidate detail is already resolved from the live
  // handover index, so draw its exact old/new cell cones above the ordinary field.
  // The acquired side stays visible after the narrated transition while the focus
  // remains armed; this keeps the final handover state readable instead of ending
  // on an empty viewport. Display-only; no simulation record is changed.
  const sinrLiveCinemaHandoverPairConeItems = useMemo(() => {
    if (!showSinrLiveCellBeams || !presentedInterHandoverActive || presentedHandoverPairCandidate === null) return [];
    return resolveCinemaHandoverPairConeItems({
      candidate: presentedHandoverPairCandidate,
      fromOpacity: presentationHandoverEnvelope.fromOpacity,
      toOpacity: presentationHandoverEnvelope.phase === 'settled'
        ? beamDisplaySpec.triggeredIntraPeakOpacity
        : presentationHandoverEnvelope.toOpacity,
      fromColor: beamDisplaySpec.triggeredIntraFromColor,
      toColor: handoverPresentation.targetRole === 'serving'
        ? beamDisplaySpec.heroConeColor
        : resolveTriggeredHandoverTargetColor(presentedHandoverPairCandidate.kind, beamDisplaySpec),
      placementByCellId: sinrLiveCellPlacementById,
      satelliteWorldById: presentationSatelliteWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
      baseCenterOverride: presentedHandoverPairCandidate.kind === 'inter' ? manualHandoverGroundTarget : undefined,
      fromBaseRadiusScale: presentedHandoverPairCandidate.kind === 'inter' ? 0.84 : undefined,
      toBaseRadiusScale: presentedHandoverPairCandidate.kind === 'inter' ? 1 : undefined,
    });
  }, [
    showSinrLiveCellBeams,
    presentedInterHandoverActive,
    presentedHandoverPairCandidate,
    manualHandoverGroundTarget,
    presentationHandoverEnvelope,
    handoverPresentation.targetRole,
    beamDisplaySpec.heroConeColor,
    beamDisplaySpec.triggeredIntraPeakOpacity,
    beamDisplaySpec.triggeredIntraFromColor,
    beamDisplaySpec.triggeredIntraToColor,
    beamDisplaySpec.candidateConeColor,
    sinrLiveCellPlacementById,
    presentationSatelliteWorldById,
    profile.beams.frequencyReuse,
  ]);
  // Keep the marker roles aligned with the anchored inter shot while the live
  // simulation is being rebuilt at the selected event lead-in. This is a
  // presentation identity only; the right rail and the published serving truth
  // continue to read the live frame unchanged.
  const cinemaDisplayServingSatId = presentedInterHandoverActive && presentedHandoverPairCandidate !== null
    ? handoverPresentation.targetRole === 'serving'
      ? presentedHandoverPairCandidate.toSatId
      : presentedHandoverPairCandidate.fromSatId
    : sceneFrame.metrics.servingSatelliteId;
  const cinemaDisplayCandidateSatId = presentedInterHandoverActive
    ? presentedHandoverPairCandidate !== null && handoverPresentation.targetRole === 'candidate'
      ? presentedHandoverPairCandidate.toSatId
      : null
    : renderedCandidateSatelliteId;
  const sinrLiveCellServedCount = showSinrLiveCellBeams
    ? sim.sinrLiveCells?.servedCellCount ?? 0
    : 0;
  // Max off-axis angle among SERVED UEs — the real "UE off-centre" lever. > 0 means
  // UEs genuinely sit off their cell centres (the steered render collapsed this to ~0).
  const sinrLiveCellUeOffAxisMaxDeg = showSinrLiveCellBeams
    ? (sim.sinrLiveCells?.ues.reduce(
      (max, ue) => (ue.servingSatId !== null && ue.offAxisDeg > max ? ue.offAxisDeg : max),
      0,
    ) ?? 0)
    : 0;
  const uploadParticlesEnabled =
    showCellOverlay
    && showModqnServiceAllocation
    && modqnVisualLayerPreset === 'explain-handover'
    && modqnVisualLayers.handoverStory;
  const uploadParticleFocusCones = useMemo(
    () => uploadParticlesEnabled
      ? resolveCellBeamConeItems({
        ...cellBeamConeInput,
        beamConeScope: 'focus-satellite',
      })
      : [],
    [
      cellBeamConeInput,
      uploadParticlesEnabled,
    ],
  );
  const profileDerivedHandoverCues = useMemo(
    () => selectProfileDerivedHandoverCues(cellSchedule.cellReassignments),
    [cellSchedule.cellReassignments],
  );
  // Cell schedule churn is a profile-derived overlay cue, not primary-UE
  // source-backed handover truth. It is hidden in the baseline preset and only
  // appears in explicit explain/debug presets.
  const showCellReassignmentEventArcs = modqnVisualLayers.handoverCues;
  // The `modqn-replay-source-backed` story policy already requires the
  // modqn-replay-proof lane on a live-sim frame, which is exactly what the retired
  // `showReplayProofLayer` flag encoded — so gating on the policy alone is
  // value-identical to the old `policy && showReplayProofLayer` (P3 slice-3: the
  // dead board flag was removed).
  const replayBackedHandoverStoryVisible =
    handoverStoryLayerPolicy === 'modqn-replay-source-backed';
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

  return (
    <BaseSceneLayout
      sceneConfig={sceneConfig}
      controlsRef={controlsRef}
      campusVisible={campusVisible && presentationPlan.visible.campus}
      cinematicSpotlightActive={cinematicSpotlightActive && presentationPlan.visible['event-effects']}
      effectiveCinematicMode={effectiveCinematicMode}
      cinematicSpotlightTargets={presentationPlan.visible['event-effects'] ? cinematicSpotlightTargets : []}
      onControlsStart={() => {
        if (multiCandidateAuthorityActive) {
          multiCandidateCameraUserControlledRef.current = true;
          cameraPresetRef.current = 'manual';
        }
      }}
    >
      {!(campusVisible && presentationPlan.visible.campus) && <TeachingFloor />}
      <ScenePresentationCanvasTelemetry plan={presentationPlan} />
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
        liveSimulationEnabled="1"
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
        beamLoadContentionUeCount={showModqnServiceAllocation ? beamLoadContentionUeCount : 0}
        visualSatelliteAltitude={String(sceneGeometry.visualSatelliteAltitude ?? '')}
        beamSatelliteCount={
          showSinrLiveCellBeams
            // S-cells-3: on the sinr-live lane the cell-truth cones REPLACE
            // the steered SatelliteBeams, so report the satellite count from
            // the cones that actually render (keeps the attr honest).
            ? renderedSinrLiveCellBeamConeSatelliteCount
            : viz.satBeams.size
        }
        // Archived-TLE reuses the normalized scene frame for geometry, but its
        // provenance must not fall back to the frame's historical live-sim tag.
        // Keep the live branch byte-for-byte unchanged while exposing the source
        // actually used by this shared renderer to the canvas telemetry.
        sceneSource={simSource === 'archived-tle' ? 'archived-tle' : sceneFrame.sceneSource}
        beamConeCount={
          showSinrLiveCellBeams
            // S-cells-3: on the sinr-live lane the cell-truth cones REPLACE the
            // steered SatelliteBeams, so report the cones that actually render
            // (keeps this attr honest — it is not the suppressed steered count).
            ? renderedSinrLiveCellBeamConeCount
            : showLiveBeamCones && !showCellOverlay
              ? [...viz.satBeams.values()].reduce((count, beams) => count + beams.length, 0)
              : 0
        }
        cellOverlaySlotIndex={showCellOverlay ? String(cellSchedule.slotIndex) : ''}
        cellOverlayActiveCount={showCellOverlay ? String(cellSchedule.slot.assignments.length) : ''}
        cellOverlayIdleCount={showCellOverlay ? String(cellSchedule.slot.idleCellIds.length) : ''}
        cellOverlayCellCount={showCellOverlay ? String(cellSchedule.layout.count) : ''}
        cellServingCount={showCellOverlay ? String(cellSchedule.servingCount) : ''}
        cellVisibleCount={showCellOverlay ? String(cellSchedule.visibleCount) : ''}
        cellHoReassignmentCount={showCellOverlay ? String(cellHoCounts.total) : ''}
        cellHoInterCount={showCellOverlay ? String(cellHoCounts.inter) : ''}
        cellHoIntraCount={showCellOverlay ? String(cellHoCounts.intra) : ''}
        cellBeamConeCount={showCellOverlay ? String(renderedCellBeamConeCount) : ''}
        cellBeamConeScope={showCellOverlay ? renderedCellBeamConeScope : ''}
        cellBeamConeSatelliteCount={showCellOverlay ? String(renderedCellBeamConeSatelliteCount) : ''}
        sinrLiveCellBeamConeCount={showSinrLiveCellBeams ? String(renderedSinrLiveCellBeamConeCount) : ''}
        sinrLiveCellServingSatCount={showSinrLiveCellBeams ? String(renderedSinrLiveCellBeamConeSatelliteCount) : ''}
        sinrLiveCellServedCount={showSinrLiveCellBeams ? String(sinrLiveCellServedCount) : ''}
        sinrLiveCellUeOffAxisMaxDeg={showSinrLiveCellBeams ? sinrLiveCellUeOffAxisMaxDeg.toFixed(3) : ''}
        sinrLiveHandoverPulseConeCount={showSinrLiveHandoverPulse ? String(sinrLiveCellPulseConeItems.length) : ''}
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
        modqnVisualLayerPreset={showCellOverlay ? modqnVisualLayerPreset : ''}
        modqnServiceMapEnabled={showModqnServiceAllocation && modqnVisualLayers.serviceMap ? '1' : '0'}
        modqnServedUeCount={showModqnServiceAllocation ? modqnServiceMap.servedUeCount : 0}
        modqnIdleUeCount={showModqnServiceAllocation ? modqnServiceMap.idleUeCount : 0}
        modqnHandoverCuesVisible={showCellOverlay && showCellReassignmentEventArcs ? '1' : '0'}
        handoverStoryLayer={handoverStoryLayerPolicy}
        handoverStoryVisible={handoverStoryModel || replayBackedHandoverStoryVisible ? '1' : '0'}
        handoverStorySource={
          handoverStoryModel?.source ?? (replayBackedHandoverStoryVisible ? 'modqn-replay-proof' : '')
        }
        handoverStoryNotBaselineProof={handoverStoryModel?.notBaselineProof ? '1' : '0'}
        handoverStoryEventCount={handoverStoryModel?.events.length ?? 0}
        handoverStoryAggregateEventCount={handoverStoryModel?.aggregateEventCount ?? 0}
        handoverStoryActiveCount={handoverStoryModel?.activeSlots.length ?? 0}
        handoverStoryInactiveCount={handoverStoryModel?.inactiveSlots.length ?? 0}
        handoverStoryNextCount={handoverStoryModel?.nextSlots.length ?? 0}
        cameraPresetRef={cameraPresetRef}
        cameraTransitionRef={cameraTransitionRef}
        controlsRef={controlsRef}
      />
      {presentationPlan.visible.uav && showUav && afterFirstPaint && (
        <Suspense fallback={null}>
          <UAV position={[sim.ueGroundX, 10, sim.ueGroundZ]} scale={10} />
        </Suspense>
      )}

      {presentationPlan.visible.ues && <GroundScene
        ues={displayedUes
          .filter((u) => u.worldPos !== undefined)
          .map((u, index) => {
            // The primary UE (index 0) stays the red focus anchor; the SINR
            // serving mosaic colours the secondary population by serving beam (the
            // G3 money shot). The mosaic COLOUR render is shared with the MODQN
            // cell-preview lane too (consolidation: showSinrServingMosaic is also
            // true there); modqnServiceMap is only the fallback where the mosaic
            // has no colour for a UE. (The sinr-serving mosaic COLOUR telemetry
            // attr, by contrast, stays sinr-live-owned — see sinrServingTelemetryActive.)
            const mosaic = index === 0 ? undefined : sinrServingColorById?.get(u.id);
            const service = mosaic || !presentationPlan.visible['load-overlays']
              ? undefined
              : modqnServiceMap.ueById.get(u.id);
            // ID alignment verified: liveSimToScene preserves sim.perUePositions
            // ids (`live-ue-${index}`), so contention lookup uses UE id, not index.
            const contention = presentationPlan.visible['load-overlays'] && beamLoadContentionEnabled
              ? beamLoadContention.byUeId.get(u.id)?.normalizedLoad ?? 0
              : undefined;
            const isOtherHandover = presentationPlan.visible['event-effects']
              && u.isOtherHandover === true;
            return {
              id: u.id,
              worldPos: u.worldPos as readonly [number, number, number],
              markerColor: isOtherHandover
                ? '#facc15'
                : mosaic?.markerColor ?? service?.markerColor,
              markerEmissive: isOtherHandover
                ? '#f59e0b'
                : mosaic?.markerEmissive ?? service?.markerEmissive,
              contention,
              isOtherHandover,
            };
          })}
        ueMarkerMultiplier={visualScaleMultipliers.ueMarkerMultiplier}
        markerShape={ueMarkerShape}
        ueTrailHistory={presentationPlan.visible['motion-guides'] && !showCellOverlay
          ? ueTrailHistory
          : undefined}
        secondaryOpacity={presentationPlan.visible['load-overlays']
          && showModqnServiceAllocation
          && modqnVisualLayers.serviceMap ? 0.72 : 1.0}
        secondaryScale={presentationPlan.visible['load-overlays']
          && showModqnServiceAllocation
          && modqnVisualLayers.serviceMap ? 0.72 : 1.0}
        colorTelemetryAttr={sinrServingTelemetryActive ? 'sinrServingMosaicColorCount' : undefined}
      />}
      {presentationPlan.visible['ground-overlays'] && showCellOverlay && modqnVisualLayers.activeCellOverlay && (
        <CellOverlay
          schedule={cellSchedule}
          satelliteTintById={satelliteTintById}
          satelliteWorldById={satelliteWorldById}
          showFootprints={modqnVisualLayers.footprintEllipses}
          ueCountByCellId={modqnServiceMap.ueCountByCellId}
          showUeCounts={modqnVisualLayers.ueCountBadges && showModqnServiceAllocation}
        />
      )}
      {presentationPlan.visible['event-effects'] && showProfileHandoverStoryLayer && modqnVisualLayers.handoverStory && (
        <HandoverStoryLayer
          model={handoverStoryModel}
          satelliteTintById={satelliteTintById}
        />
      )}
      {presentationPlan.visible['event-effects'] && showCellOverlay && (
        <CellHandoverArcs
          visible={showCellReassignmentEventArcs}
          reassignments={profileDerivedHandoverCues}
          satelliteWorldById={satelliteWorldById}
        />
      )}
      {presentationPlan.visible['serving-beams'] && showCellOverlay && modqnVisualLayers.beamCones && (
        <CellBeamCones
          schedule={cellSchedule}
          satelliteWorldById={satelliteWorldById}
          satelliteTintById={satelliteTintById}
          focusedUe={focusedCellBeamConeUe}
          beamConeScope={modqnVisualLayers.beamConeScope}
          appMode={runtime.appMode}
        />
      )}
      {presentationPlan.visible['load-overlays'] && showCellOverlay && modqnVisualLayers.handoverStory && showModqnServiceAllocation && (
        <BeamLoadCylinder
          worldPos={focusedCellBeamConeUe?.worldPos}
          normalizedLoad={focusBeamLoad?.normalizedLoad ?? 0}
          load={focusBeamLoad?.load ?? 0}
          tintColor={focusBeamLoadTint}
          visible={(focusBeamLoad?.load ?? 0) > 0}
        />
      )}
      {presentationPlan.visible['load-overlays'] && uploadParticlesEnabled && (
        <BeamLoadUploadParticles
          focusCones={uploadParticleFocusCones}
          beamLoadContention={beamLoadContention}
          focusedUe={focusedCellBeamConeUe}
          paused={paused}
          reducedMotion={runtime.reducedMotion}
        />
      )}
      {/* S-cells-4d: the old 20-hex green-disc paint is retired. The legacy SINR
          ground reference is restored below as fixed six-sided cells, while the
          satellite projection ellipses remain a separate moving-shape layer. */}
      {/* beam-stage ① #3: the legacy steered AmbientFootprintRings (rings at `viz.ambientRings`
          = steered beam ground positions) is RETIRED — those sat at the wrong geometry vs the
          earth-fixed cell centres, so they were misaligned with the cones + UE membership (the
          lattice-phase ① shift widened the gap). The cell-truth footprint rings now render with
          the serving cones below (`SinrLiveCellFootprintRings`, gated showSinrLiveCellBeams). */}
      {presentationPlan.visible['event-effects']
        && showLiveSceneEffects
        && !multiCandidateAuthorityActive
        && !handoverDisplayIsolation.hideTimelineEffects
        && !handoverDisplayIsolation.suppressNaturalHandoverLayers
        && (
        <HandoverLinks
          satellites={viz.displaySats}
          eventRoles={viz.eventRoles}
          satBeams={viz.satBeams}
          primaryUeAnchor={sceneFrame.ues[0]?.worldPos as
            | readonly [number, number, number]
            | undefined}
        />
      )}
      <BeamPulseClock reducedMotion={runtime.reducedMotion} />
      {!multiCandidateAuthorityActive && presentationPlan.visible['motion-guides'] && showOrbitTrail && (
        <OrbitTrail satellites={viz.displaySats} />
      )}
      {!multiCandidateAuthorityActive && presentationPlan.visible['motion-guides'] && showSpineParticles && (
        <SpineParticles satellites={viz.displaySats} satBeams={viz.satBeams} />
      )}
      {presentationPlan.visible['event-effects']
        && showGroundRipple
        && !multiCandidateAuthorityActive
        && !handoverDisplayIsolation.suppressNaturalHandoverLayers
        && (
        <ServingGroundRipple
          satBeams={viz.satBeams}
          footprintRadius={viz.footprintRadiusWorld}
          servingEnabled={runtime.effectsEnabled.servingRipple}
          pendingEnabled={runtime.effectsEnabled.pendingRipple}
          paused={paused}
          reducedMotion={runtime.reducedMotion}
          recentHoActive={recentHoActive && !handoverDisplayIsolation.hideTimelineEffects}
        />
      )}

      {showLiveSatelliteMarkers && renderedLiveSatelliteMarkers.map(sat => {
        const layer = sat.id === cinemaDisplayServingSatId
          ? 'selected-satellite'
          : sat.id === cinemaDisplayCandidateSatId
            ? 'candidate-satellite'
            : 'context-satellites';
        if (!multiCandidateAuthorityActive && !presentationPlan.visible[layer]) return null;
        return (
          <SatelliteMarker
            key={sat.id}
            position={sat.world}
            label={formatSatelliteLabel(sat.id)}
            eventRole={multiCandidateAuthorityActive ? undefined : viz.eventRoles.get(sat.id)}
            satelliteTintColor={multiCandidateAuthorityActive ? undefined : sat.satelliteTintColor}
            constellation={constellation}
            showLabel={!multiCandidateAuthorityActive}
            scaleMultiplier={multiCandidateAuthorityActive
              ? MULTI_CANDIDATE_SATELLITE_SCALE_MULTIPLIER
              : 1}
          />
        );
      })}
      {multiCandidateScenePresentation !== null
        && sceneFrame.ues[0]?.worldPos !== undefined
        && showSinrLiveCellBeams
        && presentationPlan.visible['serving-beams']
        && presentationPlan.visible['candidate-beams']
        && (
          <MultiCandidateBeamScene
            presentation={multiCandidateScenePresentation}
            placementByCellId={sinrLiveCellPlacementById}
            satelliteWorldById={viz.coneApexWorldById}
            primaryUeWorld={sceneFrame.ues[0].worldPos}
            widthScale={beamDisplaySpec.coneWidthScale * MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER}
            reducedMotion={runtime.reducedMotion}
            onCandidateSelect={toggleInspectedCandidateKey}
          />
        )}
      {/* W9 step 3 dim beam-hopping cones — painted FIRST (behind) so the bright
          serving fan reads on top. Default = the hero serving satellite's hopping cells
          (on-UE vs hopping legibility); "Other beams" opens the full non-serving field. */}
      {!multiCandidateAuthorityActive && presentationPlan.visible['ambient-beams'] && sinrLiveCellNonServingConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={sinrLiveCellNonServingConeItems}
          layer="nonServing"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
          ellipseTiltExaggeration={sinrLiveEllipseTiltExaggeration}
          telemetryCountDatasetKey="sinrLiveCellNonServingConeRenderedCount"
        />
      )}
      {!multiCandidateAuthorityActive && presentationPlan.visible['serving-beams'] && showSinrLiveCellBeams && (
        // a-cone: dim near-horizontal (low-elevation serving sat) cones so the
        // ambient field reads as beams coming DOWN, not shooting across the field.
        // The primary serving sat's beams render BRIGHT + saturated + dim-exempt
        // (the hero beam pops against the faint ambient field). Display-only; the
        // serving truth + cone count are unchanged.
        <SinrLiveCellBeamCones
          items={sinrLiveCellBeamConeItems}
          layer="serving"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
          ellipseTiltExaggeration={sinrLiveEllipseTiltExaggeration}
          dimShallowCones={beamDisplaySpec.elevationDimEnabled}
          elevationDimFloorDeg={beamDisplaySpec.elevationDimFloorDeg}
          elevationDimCeilDeg={beamDisplaySpec.elevationDimCeilDeg}
          elevationDimMinFactor={beamDisplaySpec.elevationDimMinFactor}
          heroExemptFromElevationDim={beamDisplaySpec.heroExemptFromElevationDim}
          primaryServingSatId={displayHeroRecord?.servingSatId ?? null}
          primaryServingCellId={displayHeroRecord?.cellId ?? null}
        />
      )}
      {!multiCandidateAuthorityActive && presentationPlan.visible['serving-beams'] && showSinrLiveCellBeams && sinrLiveCinemaInterServingFanConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={sinrLiveCinemaInterServingFanConeItems}
          layer="serving"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
          ellipseTiltExaggeration={sinrLiveEllipseTiltExaggeration}
          dimShallowCones={beamDisplaySpec.elevationDimEnabled}
          elevationDimFloorDeg={beamDisplaySpec.elevationDimFloorDeg}
          elevationDimCeilDeg={beamDisplaySpec.elevationDimCeilDeg}
          elevationDimMinFactor={beamDisplaySpec.elevationDimMinFactor}
          heroExemptFromElevationDim={beamDisplaySpec.heroExemptFromElevationDim}
          telemetryCountDatasetKey="sinrLiveCinemaInterServingFanRenderedCount"
        />
      )}
      {/* W9 candidate highlight: the contender / approach sats' cones, recoloured to the
          candidate hue (coneColorOverride) so the handover target reads distinct from the
          protagonist's serving fan. Same opacity/dim as the serving field; display-only
          role colour — the resolver item.color stays serving-identity (colour-match green). */}
      {!multiCandidateAuthorityActive && presentationPlan.visible['candidate-beams'] && showSinrLiveCellBeams && sinrLiveCandidateBeamConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={sinrLiveCandidateBeamConeItems}
          layer="candidate"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
          ellipseTiltExaggeration={sinrLiveEllipseTiltExaggeration}
          dimShallowCones={beamDisplaySpec.elevationDimEnabled}
          elevationDimFloorDeg={beamDisplaySpec.elevationDimFloorDeg}
          elevationDimCeilDeg={beamDisplaySpec.elevationDimCeilDeg}
          elevationDimMinFactor={beamDisplaySpec.elevationDimMinFactor}
          telemetryCountDatasetKey="sinrLiveCellCandidateConeRenderedCount"
        />
      )}
      {/* beam-stage ① #3 + W4 double-layer hex: cell-truth footprint HEXES — two nested
          hexagon bands per serving cone, at the SAME base centre / radius / serving-identity
          colour, so each beam reads as a distinct double-hex with its UEs scattered off-centre
          inside. Replaces the retired steered AmbientFootprintRings AND the persistent grey
          SinrLiveCellGrid (cells show only when served). */}
      {!multiCandidateAuthorityActive && presentationPlan.visible['serving-footprints'] && showSinrLiveCellBeams && !handoverDisplayIsolation.active && (
        <SinrLiveCellFootprintRings
          items={sinrLiveCellBeamConeItems}
          visible={!handoverDisplayIsolation.hideNormalBeamField}
          layer="serving"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
          primaryServingSatId={displayHeroRecord?.servingSatId ?? null}
          primaryServingCellId={displayHeroRecord?.cellId ?? null}
          telemetryCountDatasetKey="sinrLiveCellFootprintRingRenderedCount"
        />
      )}
      {/* Candidate footprint hex: the contender / approach cells get the SAME 3-layer hex
          in the candidate BLUE (coneColorOverride), so a candidate cell reads blue like its
          cone — the footprint matches the beam. Display-only role colour (Rule#6). */}
      {!multiCandidateAuthorityActive && presentationPlan.visible['candidate-footprints'] && showSinrLiveCellBeams && sinrLiveCandidateBeamConeItems.length > 0 && (
        <SinrLiveCellFootprintRings
          items={sinrLiveCandidateBeamConeItems}
          layer="candidate"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
          telemetryCountDatasetKey="sinrLiveCellCandidateFootprintRenderedCount"
        />
      )}
      {/* W5 Beam Info: per-beam scene callouts (SAT · Cell·F · serving SINR) on the
          rendered serving cones, gated by the Beam Info toggle (showBeamCallouts). The
          old BeamCalloutContent only mounted inside the retired steered SatelliteBeams;
          this cell-cone callout layer reads the same cell-truth items + per-cell SINR. */}
      {!multiCandidateAuthorityActive && presentationPlan.visible.annotations && showSceneOverlays && showBeamCallouts && sinrLiveCellBeamConeItems.length > 0 && (
        <SinrLiveCellBeamCallouts
          // Display-only 19-beam substrate cells have no UE/SINR record, so
          // they show as geometry only and never receive a fabricated info chip.
          items={sinrLiveCellBeamConeItems.filter(item => !item.displayOnly)}
          servingSinrByCellId={sinrLiveCellServingSinrByCellId}
          primaryServingSatId={displayHeroRecord?.servingSatId ?? null}
          primaryServingCellId={displayHeroRecord?.cellId ?? null}
          telemetryCountDatasetKey="sinrLiveCellBeamCalloutRenderedCount"
        />
      )}
      {/* G2c ambient live-handover pulse — bright, age-faded cones on each real
          per-frame handover. Per-item opacity (the fade) is carried on each cone,
          so no group opacity is passed. Always-on on sinr-live, decoupled from the
          director cinema above. */}
      {!multiCandidateAuthorityActive && presentationPlan.visible['event-effects'] && sinrLiveCellPulseConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={sinrLiveCellPulseConeItems}
          layer="pulse"
          palette={sinrLiveConePalette}
          telemetryCountDatasetKey="sinrLiveHandoverPulseConeRenderedCount"
          widthScale={beamDisplaySpec.coneWidthScale}
          ellipseTiltExaggeration={sinrLiveEllipseTiltExaggeration}
        />
      )}
      {/* beam-stage ① #5: the TRIGGERED intra flash — the protagonist jog handover held
          ~2.5s WALL-CLOCK with a from(warm)/to(cool) colour split. Items carry their own
          per-item wall-clock opacity + explicit from/to colour, so NO group opacity and NO
          pulse-kind colour props are passed (the explicit item colour wins). Distinct from
          the ambient sim-time pulse above. */}
      {!multiCandidateAuthorityActive && presentationPlan.visible['event-effects'] && triggeredIntraConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={triggeredIntraConeItems}
          layer="triggered"
          palette={sinrLiveConePalette}
          telemetryCountDatasetKey="sinrLiveTriggeredIntraConeRenderedCount"
          widthScale={beamDisplaySpec.coneWidthScale}
          ellipseTiltExaggeration={sinrLiveEllipseTiltExaggeration}
        />
      )}
      {/* Focused cinema pair: exact source/candidate cones from the indexed event.
          The display-isolation policy suppresses the normal candidate fan and timeline
          event layers while this is active, leaving these two handover ends legible. */}
      {!multiCandidateAuthorityActive && presentationPlan.visible['event-effects'] && sinrLiveCinemaHandoverPairConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={sinrLiveCinemaHandoverPairConeItems}
          layer="triggered"
          palette={sinrLiveConePalette}
          telemetryCountDatasetKey="sinrLiveCinemaHandoverPairRenderedCount"
          widthScale={beamDisplaySpec.coneWidthScale}
          ellipseTiltExaggeration={sinrLiveEllipseTiltExaggeration}
        />
      )}
      {/* Tier-2 dead-twin retirement: the legacy steered <SatelliteBeams> render
          block was gated `showLiveBeamCones && !showSinrLiveCellBeams`, and both
          equal `showSinrLiveViewport` — so the gate was `X && !X`, provably false
          on EVERY lane. It never rendered (zero visual change on removal) but kept
          MainScene falsely pointing at SatelliteBeams.tsx as if it were the live
          renderer (the "改波束改不對 — edit the wrong file" trap). The live sinr-live
          beam render is the earth-fixed cell-truth cones above (SinrLiveCellBeamCones,
          gated by showSinrLiveCellBeams). The SatelliteBeams component survives only
          as the vc1c/vc2 validation-fixture subject — it is no longer mounted in-app. */}
      {presentationPlan.visible['event-effects']
        && showLiveSceneEffects
        && !multiCandidateAuthorityActive
        && !handoverDisplayIsolation.hideTimelineEffects
        && !handoverDisplayIsolation.suppressNaturalHandoverLayers
        && !concurrentIntraVisualSuppressed
        && <IntraGroundShockwave vizFrame={viz} runtime={runtime} />}
      {showSceneOverlays && (
        <>
      {presentationPlan.visible['event-effects']
        && showHandoverToastOverlay
        && !multiCandidateAuthorityActive
        && (
          (manualHandoverPresentationActive && manualHandoverEvent !== null)
          || (handoverPresentation.active && handoverPresentation.event !== null)
          || (!handoverDisplayIsolation.hideTimelineEffects
            && !handoverDisplayIsolation.suppressNaturalHandoverLayers)
        )
        && (
        <HandoverToastOverlay
          frame={sceneFrame}
          interTriggerSec={profile.handover.triggerTimeSec}
          preferredKind={handoverPresentation.active
            ? handoverPresentation.event?.kind ?? null
            : null}
          presentationHandover={handoverPresentation.active && handoverPresentation.event
            ? {
              kind: handoverPresentation.event.kind,
              sourceSatId: handoverPresentation.event.from.satId,
              sourceBeamId: handoverPresentation.event.from.cellId,
              targetSatId: handoverPresentation.event.to.satId,
              targetBeamId: handoverPresentation.event.to.cellId,
              progressSec: handoverPresentation.progress01 * handoverPresentation.event.durationMs / 1000,
              targetSec: handoverPresentation.event.durationMs / 1000,
            }
            : null}
          manualHandover={manualHandoverPresentationActive && manualHandoverEvent
            ? {
              kind: manualHandoverEvent.kind,
              sourceSatId: manualHandoverEvent.fromSatId,
              sourceBeamId: manualHandoverEvent.fromCellId,
              targetSatId: manualHandoverEvent.toSatId,
              targetBeamId: manualHandoverEvent.toCellId,
              progressSec: manualHandoverProgressSec,
              targetSec: MANUAL_HANDOVER_DISPLAY_MS / 1000,
            }
            : null}
        />
      )}
        </>
      )}
      {presentationPlan.visible.diagnostics && showArtifactFpsCounter && <FPSCounter />}
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
  /** Display-only scene-medium switch owned by the homepage shell. */
  campusVisible: boolean;
  onSimUpdate: (state: SimState) => void;
  onLiveSeekLanded?: (seekRequestKey: string) => void;
  sceneFrame?: NormalizedSceneFrame;
  /**
   * Accepted immutable archived-TLE frame for the homepage centre.  Passing
   * this prop (including `null` while the first frame loads) selects the TLE
   * scene lane and prevents the legacy Walker runtime from mounting.
   */
  canonicalAnalysisFrame?: SimulationAnalysisFrame | null;
  /** Adjacent completed TLE anchor for centre-only visual interpolation. */
  canonicalAnalysisNextFrame?: SimulationAnalysisFrame | null;
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
}

export const MainScene = memo(function MainScene({
  speed,
  paused,
  profile,
  runtime,
  visualScaleMultipliers,
  sceneLane,
  campusVisible,
  onSimUpdate,
  onLiveSeekLanded,
  sceneFrame,
  canonicalAnalysisFrame,
  canonicalAnalysisNextFrame,
  canonicalVisualOffsetSec = 0,
  beamDisplaySpec = DEFAULT_BEAM_DISPLAY_SPEC,
  showSceneOverlays = true,
  handoverCinemaCandidate = null,
  handoverCinemaArmed = false,
  handoverCinemaKind = null,
  onHandoverPresentationChange,
  onHandoverPresentationBusyChange,
  constellation = DEFAULT_SATELLITE_CONSTELLATION,
}: MainSceneProps) {
  const ueMarkerShape = resolveSceneLaneUeMarkerShape(sceneLane);
  const showUav = sceneLane === 'sinr-live';
  const homepageTleSceneActive = canonicalAnalysisFrame !== undefined;
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

  return (
    <div className="leo-main-scene" data-testid="leo-main-scene" style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)',
      overflow: 'hidden',
    }}>
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
        data-scene-source={homepageTleSceneActive ? 'archived-tle' : (sceneFrame?.sceneSource ?? 'live-simulation')}
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
          data-handover-decision="not-in-frame"
          hidden
        />
      )}
      {presentationPlan.visible.backdrop && <Starfield starCount={180} />}
      <Canvas
        // PERF (recorded proof stage): the modqn-replay-proof lane plays a RECORDED
        // artifact, so it renders ON-DEMAND (mount + scrub/interaction + each
        // frame-advance re-render) instead of a continuous rAF — escaping the ~9 FPS
        // software-WebGL ceiling while idle/paused. The live lanes keep 'always'
        // (their ambient effects + live sim animation need every frame). Positions
        // flow declaratively from `sceneFrame` props, so a playback tick re-renders
        // the graph and r3f invalidates one frame; nothing is driven imperatively
        // that 'demand' would freeze. Display-only (Rule#6) — no truth touched.
        frameloop={sceneLane === 'modqn-replay-proof' ? 'demand' : 'always'}
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
          {homepageTleSceneActive ? (
            <ArchivedTleSceneContent
              frame={canonicalAnalysisFrame ?? null}
              nextFrame={canonicalAnalysisNextFrame ?? null}
              visualOffsetSec={canonicalVisualOffsetSec}
              profile={profile}
              speed={speed}
              paused={paused}
              runtime={runtime}
              visualScaleMultipliers={visualScaleMultipliers}
              sceneLane={sceneLane}
              campusVisible={campusVisible}
              onSimUpdate={onSimUpdate}
              onLiveSeekLanded={onLiveSeekLanded}
              beamDisplaySpec={beamDisplaySpec}
              showSceneOverlays={showSceneOverlays}
              handoverCinemaCandidate={handoverCinemaCandidate}
              handoverCinemaArmed={handoverCinemaArmed}
              handoverCinemaKind={handoverCinemaKind}
              onHandoverPresentationChange={onHandoverPresentationChange}
              onHandoverPresentationBusyChange={onHandoverPresentationBusyChange}
              constellation={constellation}
              presentationPlan={presentationPlan}
            />
          ) : sceneFrame?.sceneSource === 'artifact-replay' ? (
            <ArtifactSceneContent
              runtime={runtime}
              visualScaleMultipliers={visualScaleMultipliers}
              sceneLane={sceneLane}
              campusVisible={campusVisible}
              sceneFrame={sceneFrame}
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
              campusVisible={campusVisible}
              onSimUpdate={onSimUpdate}
              onLiveSeekLanded={onLiveSeekLanded}
              sceneFrame={sceneFrame}
              beamDisplaySpec={beamDisplaySpec}
              showSceneOverlays={showSceneOverlays}
              handoverCinemaCandidate={handoverCinemaCandidate}
              handoverCinemaArmed={handoverCinemaArmed}
              handoverCinemaKind={handoverCinemaKind}
              onHandoverPresentationChange={onHandoverPresentationChange}
              onHandoverPresentationBusyChange={onHandoverPresentationBusyChange}
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
