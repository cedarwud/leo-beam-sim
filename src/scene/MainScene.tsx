// SDD §7 (v4 review codex NEW-2): MainScene is the **boundary** between the
// live engine and the renderer. `useSimulation` still emits `SimFrame`
// directly; MainScene projects it to `NormalizedSceneFrame` via
// `liveSimToScene` and `sceneGeometryFromProfile`, then passes the normalised
// frame + geometry into `useBeamViz` / `useSimStatePublisher` /
// `HandoverToastOverlay`. The replay path will mount a parallel
// `useReplayPlayback` hook in P3 that constructs NormalizedSceneFrame via
// `showcaseArtifactToScene` instead.
import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Profile } from '../profiles/types';
import type {
  CameraPreset,
  RuntimeConfig,
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
import { satelliteTint } from '../constants/beamRoleTokens';
// S-cells-4d: the legacy 20-hex EarthFixedCells green-disc ground paint is retired
// from the sinr-live lane (the cell-truth beam cones own the earth-fixed cell story
// now). Its hex-cover MODEL stays in `../viz/EarthFixedCells` for reuse + the
// `validate:vc3a:hex-paint` logic gate; only this scene's usage is removed.
import { SinrLiveCellFootprintRings } from '../viz/SinrLiveCellFootprintRings';
import { SinrLiveCellBeamCallouts } from '../viz/SinrLiveCellBeamCallouts';
import { HandoverLinks } from '../viz/HandoverLinks';
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
  resolveCandidateBeamConeItems,
  resolveTopServingFocusSatIds,
  type SinrLiveCellPlacement,
} from '../viz/SinrLiveCellBeamCones';
import {
  DEFAULT_BEAM_DISPLAY_SPEC,
  resolveBeamFocusSatIds,
  resolveTriggeredHandoverTargetColor,
  type BeamDisplaySpec,
} from './beamDisplaySpec';
import { SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC, resolvePrimaryCellServingRecord, type SinrLiveCellHandoverEvent } from './sinrLiveCellModel';
import { MANUAL_HANDOVER_DISPLAY_MS, resolveManualHandoverDemoEvent } from './manualHandoverDemo';
import {
  annotateOtherHandoverDisplayUes,
  filterOtherHandoverDisplayUes,
  selectOtherHandoverUeIds,
} from './otherHandoverUeSelector';
import { resolveRecentPrimaryIntraHandoverEvent } from './intraHandoverVisualState';
import { resolveHandoverConeEnvelope } from '../constants/sinrLiveConeStyle';
import { buildSinrLiveCellLayout } from './sinrLiveCellRuntime';
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
import { SceneTelemetry } from './SceneTelemetry';
import {
  resolveCinematicSpotlightTargets,
} from './cinematicEffects';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import { FPSCounter } from './FPSCounter';
import type { SceneLane } from '../app/sceneLane';
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

function lookupSatWorldPos(
  satellites: NormalizedSceneFrame['satellites'],
  satId: string | null | undefined,
): readonly [number, number, number] | null {
  if (!satId) return null;
  const sat = satellites.find(candidate => candidate.id === satId);
  return sat ? sat.worldPos : null;
}

interface SceneContentProps {
  profile: Profile;
  speed: number;
  paused: boolean;
  runtime: RuntimeConfig;
  visualScaleMultipliers: SceneVisualScaleMultipliers;
  sceneLane: SceneLane;
  onSimUpdate: (state: SimState) => void;
  onLiveSeekLanded?: (seekRequestKey: string) => void;
  sceneFrame?: NormalizedSceneFrame;
  /** Tier-2 display-only beam knobs (direct prop, bypasses the runtime bag). */
  beamDisplaySpec?: BeamDisplaySpec;
}

interface ArtifactSceneContentProps {
  runtime: RuntimeConfig;
  visualScaleMultipliers: SceneVisualScaleMultipliers;
  sceneLane: SceneLane;
  sceneFrame: NormalizedSceneFrame;
}

const CAMERA_TWEEN_DURATION_MS = 600;
const MAX_PROFILE_DERIVED_HANDOVER_CUES = 3;
/**
 * How many satellites the beam-cone focus falls back to when the protagonist has NO
 * serving satellite this slot (see the `sinrLiveTargetSatIds` F4 note). Bounded on
 * purpose: the point is "the viewport is never beamless", not "draw everything" —
 * 2 matches the ≤2 breadth the W9 display wiring already allows.
 */
const SINR_LIVE_EMPTY_FOCUS_FALLBACK_SATS = 2;

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
  kind: 'preset' | 'director-acquire' | 'director-restore';
  startedAtMs: number;
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPosition: THREE.Vector3;
  toTarget: THREE.Vector3;
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
    const progress = Math.min(Math.max((nowMs - tween.startedAtMs) / CAMERA_TWEEN_DURATION_MS, 0), 1);
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
    <BaseSceneLayout sceneConfig={sceneConfig} controlsRef={controlsRef}>
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
      {visibleSatellites.map((satellite, index) => {
        const eventRole = sceneFrame.eventRoles.bySatId.get(satellite.id);
        return (
          <SatelliteMarker
            key={satellite.id}
            position={new THREE.Vector3(...satellite.worldPos)}
            label={formatSatelliteLabel(satellite.id)}
            eventRole={eventRole === 'inactive' ? undefined : eventRole}
            satelliteTintColor={satelliteTint(satellite.id, index)}
          />
        );
      })}
      <FPSCounter />
    </BaseSceneLayout>
  );
}

function SceneContent({
  profile,
  speed,
  paused,
  runtime,
  visualScaleMultipliers,
  sceneLane,
  onSimUpdate,
  onLiveSeekLanded,
  sceneFrame: propSceneFrame,
  beamDisplaySpec = DEFAULT_BEAM_DISPLAY_SPEC,
}: SceneContentProps) {
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
  // S-cells-2 (ADDITIVE): the earth-fixed cell truth is lane-owned by sinr-live
  // ONLY. Off on the three MODQN/artifact lanes → useSimulation returns frames
  // byte-identical to today (no `sinrLiveCells` field).
  // MODQN consolidation: the MODQN live page reuses the SINR scene render directly
  // (the SINR cell-truth beam cones), so the cell model runs on modqn-live-cell-preview
  // too — its serving is the live SINR-offset truth (NOT the degenerate MODQN decision
  // override). The MODQN-ness is the Q-value sidebar overlay, not a different scene.
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
    onLiveSeekLanded,
    runtime.primaryJogEastKm ?? 0,
    runtime.primaryJogNorthKm ?? 0,
  );
  const ueTrailHistory = useUeTrailHistory({
    enabled: runtime.enableUeTrails === true && propSceneFrame === undefined,
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
  // S-cells-3: ground placements of the FIXED earth-fixed cells for the cell-truth
  // beam cones. Built from the SAME `buildSinrLiveCellLayout(profile)` the runtime
  // cell truth uses (so cellIds match `sim.sinrLiveCells`) and the SAME
  // `worldUnitsPerKm` the UE markers use (east → +X, north → −Z), so a cone base
  // and its UEs share one frame. Empty off the sinr-live lane.
  const sinrLiveCellPlacementById = useMemo<ReadonlyMap<number, SinrLiveCellPlacement>>(() => {
    if (!useEarthFixedCellTruth) return new Map();
    const layout = buildSinrLiveCellLayout(profile);
    return new Map(layout.centers.map(center => [center.cellId, {
      cellId: center.cellId,
      worldX: center.localXKm * worldUnitsPerKm,
      worldZ: -center.localYKm * worldUnitsPerKm,
      radiusWorld: layout.cellRadiusKm * worldUnitsPerKm,
    }]));
  }, [useEarthFixedCellTruth, profile, worldUnitsPerKm]);
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
    latchedBeamSinrByKeyRef,
    onSimUpdate,
    enabled: sceneFrame.sceneSource !== 'artifact-replay',
    modqnCellServiceReadout,
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
  const manualHandoverEvent = useMemo(
    () => runtime.manualHandoverRequestId === undefined || runtime.manualHandoverKind === undefined
      ? null
      : resolveManualHandoverDemoEvent(
        runtime.manualHandoverKind,
        sim.sinrLiveCells,
        sim.perUePositions[0]?.id,
        [...viz.coneApexWorldById.keys()],
      ),
    [
      runtime.manualHandoverRequestId,
      runtime.manualHandoverKind,
      sim.sinrLiveCells,
      sim.perUePositions,
      viz.coneApexWorldById,
    ],
  );
  // The demonstration's wall CLOCK. It must be state, not a bare `performance.now()` read:
  // the component body only re-evaluates on a render, and the button PAUSES the sim before
  // arming the request, so no frame publish ever comes to trigger one. Driven by the
  // throttled `useFrame` tick below (R3F's loop is independent of `paused`), so the
  // envelope actually walks 單 → 雙 → 單 instead of freezing on phase 1.
  const [manualHandoverNowMs, setManualHandoverNowMs] = useState<number | null>(null);
  const manualHandoverTickRef = useRef<ManualHandoverTickState | null>(null);
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
  // not just of the draw condition. `manualHandoverActive` blanks every other beam
  // layer (serving / candidate / non-serving / pulse / footprints / callouts) so the
  // demonstration cue owns the frame — but the cue itself only draws when
  // `manualHandoverEvent` resolved. When the two disagreed (event null, active true)
  // the button produced a fully BLACK scene for the whole display window: everything
  // suppressed, nothing put back. Deriving both from the same condition makes that
  // state unreachable — no event, no suppression. No cycle: `manualHandoverEvent`
  // (above) does not read `manualHandoverActive`.
  const manualHandoverActive = runtime.manualHandoverRequestId !== undefined
    && runtime.manualHandoverKind !== undefined
    && manualHandoverEvent !== null
    && manualHandoverAgeMs <= MANUAL_HANDOVER_DISPLAY_MS;
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
  // F4 (2026-08-06) — the EMPTY-FOCUS fallback. `resolveBeamFocusSatIds` returns an
  // EMPTY set whenever the protagonist has no serving satellite this slot (beam
  // hopping under K<N, a coverage gap, the first frames before warm-up). Every cone
  // layer below then short-circuits to `[]` and the viewport goes completely BLACK —
  // even while thirty-odd OTHER cells are being served right there. Owner: 「應該隨時
  // 都要有波束才對」. So when the focus set comes back empty we fall back to the top
  // SERVING satellites by served-cell count (`resolveTopServingFocusSatIds`, bounded
  // to 2 — the same ≤2 breadth the W9 wiring lock allows), never to `null`, which
  // would be the unbounded all-sat firehose the original comment warns against.
  // Display-only (Rule#6): this picks what is DRAWN, it reads serving truth and
  // changes none of it. An all-unserved frame still yields an empty set → still
  // draws nothing, which is then honest rather than a bug.
  // Identity note: the memo now also keys on the cell frame (the fallback needs it),
  // so the Set identity is per-frame in fallback mode. Every consumer memo below
  // already keys on `sim.sinrLiveCells`, so this adds no recompute.
  const sinrLiveTargetSatIds = useMemo(
    () => {
      const focus = resolveBeamFocusSatIds(beamDisplaySpec.focusScope, primaryServingRecord);
      if (focus !== null && focus.size === 0) {
        return resolveTopServingFocusSatIds(sim.sinrLiveCells, SINR_LIVE_EMPTY_FOCUS_FALLBACK_SATS, null);
      }
      return focus;
    },
    [
      beamDisplaySpec.focusScope,
      primaryServingRecord?.servingSatId,
      sim.sinrLiveCells,
    ],
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
      if (manualHandoverActive) return [];
      if (!showSinrLiveCellBeams) return [];
      // Other-beams power-view (showNonServingCones) → every serving sat (full
      // breadth). Default → focus to the HERO serving satellite ONLY. Empty target
      // set (no primary serving) draws nothing, never the unbounded all-sat firehose.
      if (!beamDisplaySpec.showNonServingCones && sinrLiveTargetSatIds !== null && sinrLiveTargetSatIds.size === 0) return [];
      return resolveSinrLiveCellBeamConeItems({
        cellFrame: sim.sinrLiveCells,
        placementByCellId: sinrLiveCellPlacementById,
        // S5-2: the serving-sat-COMPLETE cone-apex map (every projected sat, NOT the
        // top-12 `satelliteWorldById` display slice) so a target sat beyond the display
        // cap still gets a cone (display cap applied at DRAW, never at TRUTH).
        satelliteWorldById: viz.coneApexWorldById,
        focusSatIds: beamDisplaySpec.showNonServingCones ? null : sinrLiveTargetSatIds,
      });
    },
    [
      showSinrLiveCellBeams,
      manualHandoverActive,
      sim.sinrLiveCells,
      sinrLiveCellPlacementById,
      viz.coneApexWorldById,
      beamDisplaySpec.showNonServingCones,
      sinrLiveTargetSatIds,
    ],
  );
  // SEMANTIC candidate cue: the imminent inter-handover TARGET sat (`pendingTargetSatId`)
  // and the beams it is painting. 2026-08-06 OWNER DECISION — it now draws that satellite's
  // own BOUNDED multibeam fan, not a single cone (「候選波束…也要有其他波束打在其他地方，不能
  // 只有一個波束」). The cone on YOUR cell keeps the bright candidate blue; the rest of that
  // ONE satellite's beams are the darker, fainter candidate-fan role, so the serving link
  // stays the brightest thing on screen. Bounded by `candidateFanMaxCones` over a single
  // satId — it can never widen into the all-sat firehose. The target sat is still
  // deliberately absent from `sinrLiveTargetSatIds` above (so it floods none of the serving
  // / non-serving / callout layers); this fan is the only thing it draws. Display-only (Rule#6).
  const sinrLiveCandidateBeamConeItems = useMemo(
    () => (manualHandoverActive
      ? []
      : showSinrLiveCellBeams
      ? resolveCandidateBeamConeItems({
        pendingTargetSatId: primaryServingRecord?.pendingTargetSatId,
        servingSatId: primaryServingRecord?.servingSatId,
        primaryCellId: primaryServingRecord?.cellId,
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: viz.coneApexWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        cellFrame: sim.sinrLiveCells,
        maxFanCones: beamDisplaySpec.candidateFanMaxCones,
      })
      : []),
    [
      showSinrLiveCellBeams,
      manualHandoverActive,
      primaryServingRecord?.pendingTargetSatId,
      primaryServingRecord?.servingSatId,
      primaryServingRecord?.cellId,
      sinrLiveCellPlacementById,
      viz.coneApexWorldById,
      profile.beams.frequencyReuse,
      sim.sinrLiveCells,
      beamDisplaySpec.candidateFanMaxCones,
    ],
  );
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
      if (manualHandoverActive) return [];
      if (!showSinrLiveCellBeams) return [];
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
      manualHandoverActive,
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
    () => (showSinrLiveHandoverPulse && !manualHandoverActive
      ? resolveSinrLiveHandoverPulseConeItems({
        // SEMANTIC scene rule: only the HERO serving satellite draws the broad beam
        // layers, so the ambient handover pulse is FOCUSED to it (`sinrLiveTargetSatIds`,
        // serving sat only) too — a handover on any OTHER satellite no longer flashes a
        // cone on a sat that is otherwise dark (the "why is a non-serving/non-candidate sat
        // beaming?" fix). The imminent-handover target is the separate blue candidate cone, not a pulse.
        // Display-only filter; the model's events are unchanged.
        recentHandoverEvents: (sim.sinrLiveCells?.recentHandoverEvents ?? []).filter(
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
        protagonistUeId: sim.perUePositions[0]?.id ?? null,
      })
      : []),
    [showSinrLiveHandoverPulse, manualHandoverActive, manualHandoverEvent, manualHandoverProgressSec, sim.sinrLiveCells, sim.perUePositions, sinrLiveCellPlacementById, viz.coneApexWorldById, profile.beams.frequencyReuse, sinrLiveTargetSatIds, beamDisplaySpec.pulseFocusFollowsScope],
  );
  // beam-stage ① #5: the TRIGGERED intra flash. The ambient pulse above fades over
  // SIM-time (4 s retention → ~0.8 s wall-clock at the 5× demo speed → too brief to
  // read). The DELIBERATE jog handover (the PROTAGONIST's, `ueId === perUePositions[0].id`)
  // instead gets a WALL-CLOCK fade (`beamDisplaySpec.triggeredIntraSustainMs`) with a
  // from(warm)/to(cool) colour split, so the handover DIRECTION is legible and it reads as
  // DISTINCT from the ambient pulse. Since 2026-08-06 BOTH cues (this one and the MANUAL
  // demonstration) walk the SAME five-phase `resolveHandoverConeEnvelope`; only the window
  // differs (triggeredIntraSustainMs vs the longer MANUAL_HANDOVER_DISPLAY_MS). Latched
  // by ref (a new primary handover re-arms the wall-clock start; cleared after the sustain);
  // recomputed per frame on the same `sim.sinrLiveCells` cadence as the pulse, reading
  // `performance.now()` for the wall-clock age. Display-only read-out of the model's own
  // classified handover (Rule#6) — no truth touched.
  const triggeredIntraLatchRef = useRef<{ event: SinrLiveCellHandoverEvent; startedAtMs: number } | null>(null);
  const triggeredIntraConeItems = useMemo(() => {
    if (!showSinrLiveHandoverPulse) { triggeredIntraLatchRef.current = null; return []; }
    // Manual buttons use this same from/to renderer for BOTH kinds. It is an
    // independent display cue, so it must not enter the model's recent-event log
    // or compete with the ambient pulse layer.
    if (manualHandoverActive && manualHandoverEvent) {
      // FIVE-PHASE sequencing (2026-08-06). The manual cue used to hand BOTH cones one
      // shared linear decay, so they appeared together and vanished together — the
      // owner's 「2個同時連線，然後就結束了」. The envelope gives each cone its own alpha
      // (serve → candidate fades in → both held → old fades out → settled), which is the
      // actual shape of a handover. The REAL-handover branch below now walks the SAME
      // envelope on its own shorter window, so the two cues read identically.
      const envelope = resolveHandoverConeEnvelope(
        manualHandoverProgressSec / (MANUAL_HANDOVER_DISPLAY_MS / 1000),
        beamDisplaySpec.triggeredIntraPeakOpacity,
      );
      return resolveTriggeredIntraConeItems({
        event: manualHandoverEvent,
        fromOpacity: envelope.fromOpacity,
        toOpacity: envelope.toOpacity,
        fromColor: beamDisplaySpec.triggeredIntraFromColor,
        toColor: resolveTriggeredHandoverTargetColor(manualHandoverEvent.kind, beamDisplaySpec),
        placementByCellId: sinrLiveCellPlacementById,
        satelliteWorldById: viz.coneApexWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        baseCenterOverride: manualHandoverGroundTarget,
        fromBaseRadiusScale: 0.84,
        toBaseRadiusScale: 1,
      });
    }
    // CONCURRENCY, measured (2026-08-06) — why ONE latch is enough here. This layer is
    // PROTAGONIST-ONLY: the filter below keeps `e.ueId === primaryUeId`, so the 99 other
    // UEs handing over in the same frame never touch this ref (they are the ambient pulse
    // layer's business, and that layer is per-event with its own keys). What CAN collide is
    // the protagonist handing over twice inside one sustain window: the re-arm below then
    // restarts the envelope at phase 1 and the first story is cut off mid-act.
    //
    // Measured (100 UEs, 240 x 5 s steps, four hobs profiles): the protagonist NEVER has
    // more than ONE event in a single frame, so the selection below is never an arbitrary
    // pick between rivals. Across profiles it re-arms 0–11 times per 1200 s; on three of
    // the four the closest re-arm is 150 s+ of sim time and the window closes long first.
    // hobs-2024-mobile-demo-aircraft is the outlier at a 5 s minimum gap, where above 1x
    // playback a story WILL be cut off. The numbers live on the sustain const's doc comment
    // in `src/constants/sinrLiveConeStyle.ts` (this file may not name that const:
    // `validate:frontend:beam-display-spec-purity` holds MainScene to `beamDisplaySpec.*`).
    //
    // A MULTI-latch would not fix that and is deliberately NOT built: the protagonist has
    // one link, so its back-to-back handovers are sequential, not concurrent — drawing two
    // overlapping stories for one UE would be a lie. If the truncation ever needs fixing
    // the honest shapes are a QUEUE (finish act 5, then start the next story) or simply
    // accepting it, since a re-arm restarts at "one beam" and so degrades to "handovers are
    // coming fast" rather than back to the lockstep blink this replaced.
    const primaryUeId = sim.perUePositions[0]?.id;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const primaryEvent = resolveRecentPrimaryIntraHandoverEvent({
      events: sim.sinrLiveCells?.recentHandoverEvents,
      primaryUeId,
      simTimeSec: sim.sinrLiveCells?.simTimeSec ?? sim.simTimeSec,
    });
    const latched = triggeredIntraLatchRef.current;
    if (primaryEvent && (!latched || latched.event.sourceTimeSec !== primaryEvent.sourceTimeSec)) {
      triggeredIntraLatchRef.current = { event: primaryEvent, startedAtMs: nowMs };
    }
    const cur = triggeredIntraLatchRef.current;
    if (!cur) return [];
    const ageMs = nowMs - cur.startedAtMs;
    if (ageMs > beamDisplaySpec.triggeredIntraSustainMs) { triggeredIntraLatchRef.current = null; return []; }
    // REAL handover flash — the SAME five-phase envelope the manual demonstration walks
    // (2026-08-06, owner: 「現在場上的 intra/inter handover 的呈現都要跟 show intra/inter 的
    // 效果一樣，2個波束要呈現出兩個交接的效果」). It used to hand BOTH cones one shared linear
    // decay (`fromOpacity: opacity, toOpacity: opacity`), so the two beams lit together and
    // died together and there was no visible handOVER — just a synchronised blink under an
    // "intra handover" badge. Now the old link holds while the new one fades in, both are
    // held, then the old one releases: 單 → 雙 → 單.
    //
    // TIME HONESTY — this is a RETROSPECTIVE RE-ENACTMENT, not a live transmission. The
    // cell model classifies a handover only AFTER it has happened, so `startedAtMs` is
    // when the event was first OBSERVED, and the "candidate appears → trigger timer →
    // switch" ordering is replayed forwards from that instant. The candidate really
    // appeared BEFORE t=0, not at 19% of the animation. The ORDER is the teaching truth;
    // the timing is not the wall-clock truth. Do not read this cue as a live timeline.
    //
    // Shape shared, length not: the manual demo spends MANUAL_HANDOVER_DISPLAY_MS (8 s,
    // sim paused) on the envelope, this one spends the shorter
    // `beamDisplaySpec.triggeredIntraSustainMs` (5 s) because it fires mid-playback and
    // must finish before the protagonist's NEXT handover re-arms the latch below.
    const envelope = resolveHandoverConeEnvelope(
      ageMs / beamDisplaySpec.triggeredIntraSustainMs,
      beamDisplaySpec.triggeredIntraPeakOpacity,
    );
    return resolveTriggeredIntraConeItems({
      event: cur.event,
      fromOpacity: envelope.fromOpacity,
      toOpacity: envelope.toOpacity,
      fromColor: beamDisplaySpec.triggeredIntraFromColor,
      toColor: resolveTriggeredHandoverTargetColor(cur.event.kind, beamDisplaySpec),
      placementByCellId: sinrLiveCellPlacementById,
      satelliteWorldById: viz.coneApexWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
    });
  }, [showSinrLiveHandoverPulse, manualHandoverActive, manualHandoverEvent, manualHandoverProgressSec, manualHandoverGroundTarget, sim.sinrLiveCells, sim.perUePositions, sinrLiveCellPlacementById, viz.coneApexWorldById, profile.beams.frequencyReuse, beamDisplaySpec.triggeredIntraSustainMs, beamDisplaySpec.triggeredIntraPeakOpacity, beamDisplaySpec.triggeredIntraFromColor, beamDisplaySpec.triggeredIntraToColor, beamDisplaySpec.candidateConeColor]);
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

    const progress = Math.min(Math.max((nowMs - tween.startedAtMs) / CAMERA_TWEEN_DURATION_MS, 0), 1);
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
      } else {
        cameraPresetRef.current = tween.preset;
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
      cinematicSpotlightActive={cinematicSpotlightActive}
      effectiveCinematicMode={effectiveCinematicMode}
      cinematicSpotlightTargets={cinematicSpotlightTargets}
    >
      <SceneTelemetry
        visibleSatelliteCount={viz.displaySats.length}
        firstSatellitePosition={viz.displaySats[0] ? formatCameraVector(viz.displaySats[0].world) : ''}
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
        sceneSource={sceneFrame.sceneSource}
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
      {showUav && afterFirstPaint && (
        <Suspense fallback={null}>
          <UAV position={[sim.ueGroundX, 10, sim.ueGroundZ]} scale={10} />
        </Suspense>
      )}

      <GroundScene
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
            const service = mosaic ? undefined : modqnServiceMap.ueById.get(u.id);
            // ID alignment verified: liveSimToScene preserves sim.perUePositions
            // ids (`live-ue-${index}`), so contention lookup uses UE id, not index.
            const contention = beamLoadContentionEnabled
              ? beamLoadContention.byUeId.get(u.id)?.normalizedLoad ?? 0
              : undefined;
            const isOtherHandover = u.isOtherHandover === true;
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
        ueTrailHistory={showCellOverlay ? undefined : ueTrailHistory}
        secondaryOpacity={showModqnServiceAllocation && modqnVisualLayers.serviceMap ? 0.72 : 1.0}
        secondaryScale={showModqnServiceAllocation && modqnVisualLayers.serviceMap ? 0.72 : 1.0}
        colorTelemetryAttr={sinrServingTelemetryActive ? 'sinrServingMosaicColorCount' : undefined}
      />
      {showCellOverlay && modqnVisualLayers.activeCellOverlay && (
        <CellOverlay
          schedule={cellSchedule}
          satelliteTintById={satelliteTintById}
          satelliteWorldById={satelliteWorldById}
          showFootprints={modqnVisualLayers.footprintEllipses}
          ueCountByCellId={modqnServiceMap.ueCountByCellId}
          showUeCounts={modqnVisualLayers.ueCountBadges && showModqnServiceAllocation}
        />
      )}
      {showProfileHandoverStoryLayer && modqnVisualLayers.handoverStory && (
        <HandoverStoryLayer
          model={handoverStoryModel}
          satelliteTintById={satelliteTintById}
        />
      )}
      {showCellOverlay && (
        <CellHandoverArcs
          visible={showCellReassignmentEventArcs}
          reassignments={profileDerivedHandoverCues}
          satelliteWorldById={satelliteWorldById}
        />
      )}
      {showCellOverlay && modqnVisualLayers.beamCones && (
        <CellBeamCones
          schedule={cellSchedule}
          satelliteWorldById={satelliteWorldById}
          satelliteTintById={satelliteTintById}
          focusedUe={focusedCellBeamConeUe}
          beamConeScope={modqnVisualLayers.beamConeScope}
          appMode={runtime.appMode}
        />
      )}
      {showCellOverlay && modqnVisualLayers.handoverStory && showModqnServiceAllocation && (
        <BeamLoadCylinder
          worldPos={focusedCellBeamConeUe?.worldPos}
          normalizedLoad={focusBeamLoad?.normalizedLoad ?? 0}
          load={focusBeamLoad?.load ?? 0}
          tintColor={focusBeamLoadTint}
          visible={(focusBeamLoad?.load ?? 0) > 0}
        />
      )}
      {uploadParticlesEnabled && (
        <BeamLoadUploadParticles
          focusCones={uploadParticleFocusCones}
          beamLoadContention={beamLoadContention}
          focusedUe={focusedCellBeamConeUe}
          paused={paused}
          reducedMotion={runtime.reducedMotion}
        />
      )}
      {/* S-cells-4d: EarthFixedCells 20-hex green-disc retired — cell-truth cones own the cell story. */}
      {/* beam-stage ① #3: the legacy steered AmbientFootprintRings (rings at `viz.ambientRings`
          = steered beam ground positions) is RETIRED — those sat at the wrong geometry vs the
          earth-fixed cell centres, so they were misaligned with the cones + UE membership (the
          lattice-phase ① shift widened the gap). The cell-truth footprint rings now render with
          the serving cones below (`SinrLiveCellFootprintRings`, gated showSinrLiveCellBeams). */}
      {showLiveSceneEffects && !manualHandoverActive && (
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
      {showOrbitTrail && (
        <OrbitTrail satellites={viz.displaySats} />
      )}
      {showSpineParticles && (
        <SpineParticles satellites={viz.displaySats} satBeams={viz.satBeams} />
      )}
      {showGroundRipple && (
        <ServingGroundRipple
          satBeams={viz.satBeams}
          footprintRadius={viz.footprintRadiusWorld}
          servingEnabled={runtime.effectsEnabled.servingRipple}
          pendingEnabled={runtime.effectsEnabled.pendingRipple}
          paused={paused}
          reducedMotion={runtime.reducedMotion}
          recentHoActive={recentHoActive && !manualHandoverActive}
        />
      )}

      {showLiveSatelliteMarkers && viz.displaySats.map(sat => (
        <SatelliteMarker
          key={sat.id}
          position={sat.world}
          label={formatSatelliteLabel(sat.id)}
          eventRole={viz.eventRoles.get(sat.id)}
          satelliteTintColor={sat.satelliteTintColor}
        />
      ))}
      {/* W9 step 3 dim beam-hopping cones — painted FIRST (behind) so the bright
          serving fan reads on top. Default = the hero serving satellite's hopping cells
          (on-UE vs hopping legibility); "Other beams" opens the full non-serving field. */}
      {!manualHandoverActive && sinrLiveCellNonServingConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={sinrLiveCellNonServingConeItems}
          layer="nonServing"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
          telemetryCountDatasetKey="sinrLiveCellNonServingConeRenderedCount"
        />
      )}
      {showSinrLiveCellBeams && !manualHandoverActive && (
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
          dimShallowCones={beamDisplaySpec.elevationDimEnabled}
          elevationDimFloorDeg={beamDisplaySpec.elevationDimFloorDeg}
          elevationDimCeilDeg={beamDisplaySpec.elevationDimCeilDeg}
          elevationDimMinFactor={beamDisplaySpec.elevationDimMinFactor}
          heroExemptFromElevationDim={beamDisplaySpec.heroExemptFromElevationDim}
          primaryServingSatId={primaryServingRecord?.servingSatId ?? null}
          primaryServingCellId={primaryServingRecord?.cellId ?? null}
        />
      )}
      {/* W9 candidate highlight: the contender / approach sats' cones, recoloured to the
          candidate hue (coneColorOverride) so the handover target reads distinct from the
          protagonist's serving fan. Same opacity/dim as the serving field; display-only
          role colour — the resolver item.color stays serving-identity (colour-match green). */}
      {showSinrLiveCellBeams && !manualHandoverActive && sinrLiveCandidateBeamConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={sinrLiveCandidateBeamConeItems}
          layer="candidate"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
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
      {showSinrLiveCellBeams && !manualHandoverActive && (
        <SinrLiveCellFootprintRings
          items={sinrLiveCellBeamConeItems}
          layer="serving"
          palette={sinrLiveConePalette}
          widthScale={beamDisplaySpec.coneWidthScale}
          primaryServingSatId={primaryServingRecord?.servingSatId ?? null}
          primaryServingCellId={primaryServingRecord?.cellId ?? null}
          telemetryCountDatasetKey="sinrLiveCellFootprintRingRenderedCount"
        />
      )}
      {/* Candidate footprint hex: the contender / approach cells get the SAME 3-layer hex
          in the candidate BLUE (coneColorOverride), so a candidate cell reads blue like its
          cone — the footprint matches the beam. Display-only role colour (Rule#6). */}
      {showSinrLiveCellBeams && !manualHandoverActive && sinrLiveCandidateBeamConeItems.length > 0 && (
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
      {showBeamCallouts && !manualHandoverActive && (
        <SinrLiveCellBeamCallouts
          items={sinrLiveCellBeamConeItems}
          servingSinrByCellId={sinrLiveCellServingSinrByCellId}
          primaryServingSatId={primaryServingRecord?.servingSatId ?? null}
          primaryServingCellId={primaryServingRecord?.cellId ?? null}
          telemetryCountDatasetKey="sinrLiveCellBeamCalloutRenderedCount"
        />
      )}
      {/* G2c ambient live-handover pulse — bright, age-faded cones on each real
          per-frame handover. Per-item opacity (the fade) is carried on each cone,
          so no group opacity is passed. Always-on on sinr-live, decoupled from the
          director cinema above. */}
      {sinrLiveCellPulseConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={sinrLiveCellPulseConeItems}
          layer="pulse"
          palette={sinrLiveConePalette}
          telemetryCountDatasetKey="sinrLiveHandoverPulseConeRenderedCount"
          widthScale={beamDisplaySpec.coneWidthScale}
        />
      )}
      {/* beam-stage ① #5: the TRIGGERED intra flash — the protagonist jog handover held
          ~2.5s WALL-CLOCK with a from(warm)/to(cool) colour split. Items carry their own
          per-item wall-clock opacity + explicit from/to colour, so NO group opacity and NO
          pulse-kind colour props are passed (the explicit item colour wins). Distinct from
          the ambient sim-time pulse above. */}
      {triggeredIntraConeItems.length > 0 && (
        <SinrLiveCellBeamCones
          items={triggeredIntraConeItems}
          layer="triggered"
          palette={sinrLiveConePalette}
          telemetryCountDatasetKey="sinrLiveTriggeredIntraConeRenderedCount"
          widthScale={beamDisplaySpec.coneWidthScale}
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
      {showLiveSceneEffects && !manualHandoverActive && <IntraGroundShockwave vizFrame={viz} runtime={runtime} />}
      {showHandoverToastOverlay && (
        <HandoverToastOverlay
          frame={sceneFrame}
          interTriggerSec={profile.handover.triggerTimeSec}
          manualHandover={manualHandoverActive && manualHandoverEvent
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
      {showArtifactFpsCounter && <FPSCounter />}
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
  onSimUpdate: (state: SimState) => void;
  onLiveSeekLanded?: (seekRequestKey: string) => void;
  sceneFrame?: NormalizedSceneFrame;
  /**
   * Tier-2 thin DIRECT-PROP seam for display-only beam knobs — passed straight
   * from App (its own useState), NOT through buildAppRuntimeConfig / the runtime
   * memo bag, so a toggle re-renders without the invisible-dep-array tax. Optional
   * (defaults to DEFAULT_BEAM_DISPLAY_SPEC); the artifact-replay lane ignores it.
   */
  beamDisplaySpec?: BeamDisplaySpec;
}

export const MainScene = memo(function MainScene({
  speed,
  paused,
  profile,
  runtime,
  visualScaleMultipliers,
  sceneLane,
  onSimUpdate,
  onLiveSeekLanded,
  sceneFrame,
  beamDisplaySpec = DEFAULT_BEAM_DISPLAY_SPEC,
}: MainSceneProps) {
  const ueMarkerShape = resolveSceneLaneUeMarkerShape(sceneLane);
  const showUav = sceneLane === 'sinr-live';

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
        hidden
      />
      <Starfield starCount={180} />
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
          {sceneFrame?.sceneSource === 'artifact-replay' ? (
            <ArtifactSceneContent
              runtime={runtime}
              visualScaleMultipliers={visualScaleMultipliers}
              sceneLane={sceneLane}
              sceneFrame={sceneFrame}
            />
          ) : (
            <SceneContent
              profile={profile}
              speed={speed}
              paused={paused}
              runtime={runtime}
              visualScaleMultipliers={visualScaleMultipliers}
              sceneLane={sceneLane}
              onSimUpdate={onSimUpdate}
              onLiveSeekLanded={onLiveSeekLanded}
              sceneFrame={sceneFrame}
              beamDisplaySpec={beamDisplaySpec}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
});

MainScene.displayName = 'MainScene';
