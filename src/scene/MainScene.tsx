// SDD §7 (v4 review codex NEW-2): MainScene is the **boundary** between the
// live engine and the renderer. `useSimulation` still emits `SimFrame`
// directly; MainScene projects it to `NormalizedSceneFrame` via
// `liveSimToScene` and `sceneGeometryFromProfile`, then passes the normalised
// frame + geometry into `useBeamViz` / `useSimStatePublisher` /
// `HandoverToastOverlay`. The replay path will mount a parallel
// `useReplayPlayback` hook in P3 that constructs NormalizedSceneFrame via
// `showcaseArtifactToScene` instead.
import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
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
import type { ModqnReplayPlaybackDisplayState } from '../modqn/replay-bundle/playback-shell';
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
import { ModqnReplaySceneLayer } from './ModqnReplaySceneLayer';
import { REPLAY_CANVAS_ATTRIBUTES } from './modqn-replay-visuals/constants';
import { satelliteTint } from '../constants/beamRoleTokens';
import {
  EarthFixedCells,
  createCellCoverCandidate,
  generateHexGrid,
  resolveHexCellCoverAssignments,
  type CellCoverHysteresisState,
} from '../viz/EarthFixedCells';
import { AmbientFootprintRings } from '../viz/AmbientFootprintRings';
import { HandoverLinks } from '../viz/HandoverLinks';
import { HandoverToastOverlay } from '../viz/HandoverToastOverlay';
import { IntraHandoverArrow } from '../viz/IntraHandoverArrow';
import { InterHandoverArrow } from './handover-viz/InterHandoverArrow';
import { IntraGroundShockwave } from '../viz/IntraGroundShockwave';
import { BeamPulseClock, SatelliteBeams } from '../viz/SatelliteBeams';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { SpineParticles } from '../viz/SpineParticles';
import { OrbitTrail } from '../viz/OrbitTrail';
import { ServingGroundRipple } from '../viz/ServingGroundRipple';
import { GroundScene } from '../viz/GroundScene';
import { CellOverlay } from '../viz/CellOverlay';
import { CellHandoverArcs } from '../viz/CellHandoverArcs';
import {
  CellBeamCones,
  resolveCellBeamConeItems,
  resolveCellBeamConeRenderCount,
  resolveCellBeamConeSatelliteCount,
} from '../viz/CellBeamCones';
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
  deriveBeamLoadContention,
  EMPTY_BEAM_LOAD_CONTENTION,
} from './beamLoadContention';
import {
  DEFAULT_MODQN_VISUAL_LAYER_PRESET,
  resolveModqnVisualLayers,
} from './modqnVisualLayers';
import { resolveDirectorFocusPose } from './directorFocusPose';

interface SceneContentProps {
  profile: Profile;
  speed: number;
  paused: boolean;
  runtime: RuntimeConfig;
  visualScaleMultipliers: SceneVisualScaleMultipliers;
  modqnReplayDisplayState: ModqnReplayPlaybackDisplayState | null;
  showModqnReplayScene: boolean;
  sceneLane: SceneLane;
  onSimUpdate: (state: SimState) => void;
  sceneFrame?: NormalizedSceneFrame;
}

interface ArtifactSceneContentProps {
  runtime: RuntimeConfig;
  visualScaleMultipliers: SceneVisualScaleMultipliers;
  sceneLane: SceneLane;
  sceneFrame: NormalizedSceneFrame;
}

const SHOW_BEAMS = true;
const CAMERA_TWEEN_DURATION_MS = 600;
const MAX_PROFILE_DERIVED_HANDOVER_CUES = 3;

const CAMERA_PRESET_POSES: Record<CameraPreset, {
  position: [number, number, number];
  target: [number, number, number];
}> = {
  zenith: {
    position: [0, 980, 1],
    target: [0, 0, 0],
  },
  oblique: {
    position: [0, 600, 750],
    target: [0, 0, 0],
  },
  chase: {
    position: [520, 260, -620],
    target: [0, 20, 0],
  },
  'paper-faithful-closeup': {
    position: [0, 320, 380],
    target: [0, 80, 0],
  },
};

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

/**
 * Self-contained Director camera focus FSM (acquire → hold → restore) over the
 * shared OrbitControls camera. SceneContent keeps its own inline copy (entangled
 * with the camera-preset tween + telemetry refs) for the live lanes; this hook is
 * the camera half of the artifact-replay cinematic so ArtifactSceneContent —
 * which has no preset tween machinery — can run the same focus/restore tween.
 * (Future: unify SceneContent onto this hook.) Consumes a real handover focus
 * command; inert unless effectiveCinematicMode === 'director' (Rule#8).
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
  const lastDirectorCommandAtRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const command = directorFocusCommand;
    if (!command || lastDirectorCommandAtRef.current === command.issuedAtMs) return;
    // Inert on lanes the render plan did not mark as director.
    if (effectiveCinematicMode !== 'director') {
      lastDirectorCommandAtRef.current = command.issuedAtMs;
      return;
    }

    const controls = controlsRef.current;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();

    if (command.phase === 'acquiring') {
      const ueWorldPos = sceneFrame.ues[0]?.worldPos;
      if (!ueWorldPos) {
        lastDirectorCommandAtRef.current = command.issuedAtMs;
        return;
      }
      lastDirectorCommandAtRef.current = command.issuedAtMs;
      // Snapshot the pre-focus pose ONCE per cycle so restore returns to the
      // original overview, not the focused pose.
      if (directorSnapshotRef.current === null) {
        directorSnapshotRef.current = {
          position: camera.position.clone(),
          target: controls?.target.clone() ?? new THREE.Vector3(),
        };
      }
      if (controls) controls.enabled = false;

      const pose = resolveDirectorFocusPose(ueWorldPos, alpha, command.kind);
      if (reducedMotion) {
        camera.position.copy(pose.position);
        controls?.target.copy(pose.target);
        controls?.update();
        cameraTweenRef.current = null;
      } else {
        cameraTweenRef.current = {
          preset: null,
          kind: 'director-acquire',
          startedAtMs: nowMs,
          fromPosition: camera.position.clone(),
          fromTarget: controls?.target.clone() ?? new THREE.Vector3(),
          toPosition: pose.position,
          toTarget: pose.target,
        };
      }
      return;
    }

    lastDirectorCommandAtRef.current = command.issuedAtMs;
    const snapshot = directorSnapshotRef.current;
    const toPosition = snapshot?.position.clone() ?? camera.position.clone();
    const toTarget = snapshot?.target.clone() ?? (controls?.target.clone() ?? new THREE.Vector3());

    if (reducedMotion) {
      camera.position.copy(toPosition);
      controls?.target.copy(toTarget);
      if (controls) controls.enabled = true;
      controls?.update();
      directorSnapshotRef.current = null;
      cameraTweenRef.current = null;
    } else {
      cameraTweenRef.current = {
        preset: null,
        kind: 'director-restore',
        startedAtMs: nowMs,
        fromPosition: camera.position.clone(),
        fromTarget: controls?.target.clone() ?? new THREE.Vector3(),
        toPosition,
        toTarget,
      };
    }
  }, [camera, controlsRef, directorFocusCommand, reducedMotion, effectiveCinematicMode, sceneFrame.ues, alpha]);

  // Force-restore if the lane stops being director mid-focus (inertness guarantee).
  useEffect(() => {
    if (effectiveCinematicMode === 'director') return;
    if (directorSnapshotRef.current === null) return;
    const controls = controlsRef.current;
    if (controls) {
      camera.position.copy(directorSnapshotRef.current.position);
      controls.target.copy(directorSnapshotRef.current.target);
      controls.enabled = true;
      controls.update();
    }
    directorSnapshotRef.current = null;
    cameraTweenRef.current = null;
  }, [camera, controlsRef, effectiveCinematicMode]);

  useFrame(() => {
    const tween = cameraTweenRef.current;
    if (!tween) return;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
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
  // defaults (paused/recentHoActive/replayProofLayerRequested do not affect it).
  const effectiveCinematicMode = resolveSceneLaneRenderPlan({
    sceneLane,
    sceneSource: sceneFrame.sceneSource,
    beamCalloutsEnabled: runtime.beamCalloutsEnabled ?? false,
    beamDensity: runtime.beamDensity,
    cinematicMode: runtime.cinematicMode,
    effectsEnabled: runtime.effectsEnabled,
    paused: true,
    reducedMotion: runtime.reducedMotion,
    recentHoActive: false,
    replayProofLayerRequested: false,
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
          sceneLane === 'artifact-replay' && sceneFrame.sceneSource === 'artifact-replay' ? '1' : '0'
        }
        liveSimulationEnabled="0"
        ueMarkerShape={ueMarkerShape}
        uavVisible="0"
        uePrimaryAnchorMode={runtime.uePrimaryAnchorMode ?? 'observer'}
        firstUePosition={formatScenePosition(sceneFrame.ues[0]?.worldPos)}
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
          .map((u) => ({ id: u.id, worldPos: u.worldPos as readonly [number, number, number] }))}
        ueMarkerMultiplier={visualScaleMultipliers.ueMarkerMultiplier}
        markerShape={ueMarkerShape}
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
  modqnReplayDisplayState,
  showModqnReplayScene,
  sceneLane,
  onSimUpdate,
  sceneFrame: propSceneFrame,
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
  const sceneConfig = useMemo(() => (
    runtime.appMode === 'sinr-experiment' ? NTPU_CONFIG : NTPU_LARGE_CONFIG
  ), [runtime.appMode]);
  const paperUserArea = useMemo(
    () => resolveInscribedPaperUserArea(sceneConfig),
    [sceneConfig],
  );
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
  );
  const ueTrailHistory = useUeTrailHistory({
    enabled: runtime.enableUeTrails === true && propSceneFrame === undefined,
    perUePositions: sim.perUePositions,
    resetKey: runtime.signalResetKey,
  });
  const latchedBeamSinrByKeyRef = useRef<Map<string, number>>(new Map());
  const cellCoverHysteresisRef = useRef<CellCoverHysteresisState>(new Map());
  const alpha = sceneConfig.visualAlpha;

  const cameraPresets = useMemo(() => ({
    zenith: {
      position: [0, 980 * alpha, 1] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
    },
    oblique: {
      position: [0, 600 * alpha, 750 * alpha] as [number, number, number],
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
  const cells = useMemo(
    () => generateHexGrid({ rows: 4, cols: 5, cellRadius: 80, centerX: 0, centerZ: 0 }),
    [],
  );
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
  const replayWorldUnitsPerKm = sceneGeometry.kmPerWorldUnit
    ? 1 / sceneGeometry.kmPerWorldUnit
    : 1 / paperUserArea.kmPerWorldUnit;
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
  );
  const worldUnitsPerKm = 1 / (sceneGeometry.kmPerWorldUnit ?? paperUserArea.kmPerWorldUnit);
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
  const cellCoverCandidates = useMemo(() => {
    const displayOrderBySatId = new Map(viz.displaySats.map((sat, index) => [sat.id, index]));

    return [...viz.satBeams.entries()].flatMap(([satelliteId, beams]) => {
      const displayOrder = displayOrderBySatId.get(satelliteId) ?? 0;
      return beams.flatMap(beam => {
        const candidate = createCellCoverCandidate({
          satelliteId,
          beam,
          footprintRadius: viz.footprintRadiusWorld,
          displayOrder,
        });
        return candidate ? [candidate] : [];
      });
    });
  }, [viz.displaySats, viz.footprintRadiusWorld, viz.satBeams]);
  const paintedCells = useMemo(
    () => resolveHexCellCoverAssignments({
      cells,
      beams: cellCoverCandidates,
      hysteresis: cellCoverHysteresisRef.current,
    }),
    [cellCoverCandidates, cells],
  );
  const recentHoActive =
    sim.recentHoSourceSatId !== null
    || sim.recentHoTargetSatId !== null;
  const renderPlan = resolveSceneLaneRenderPlan({
    sceneLane,
    sceneSource: sceneFrame.sceneSource,
    beamCalloutsEnabled: runtime.beamCalloutsEnabled ?? false,
    beamDensity: runtime.beamDensity,
    cinematicMode: runtime.cinematicMode,
    effectsEnabled: runtime.effectsEnabled,
    paused,
    reducedMotion: runtime.reducedMotion,
    recentHoActive,
    replayProofLayerRequested: showModqnReplayScene,
  });
  const {
    showCellOverlay,
    showLiveSceneEffects,
    showEarthFixedCells,
    showEarthFixedCellLabels,
    showUav,
    showLiveBeamCones,
    showLiveSatelliteMarkers,
    showBeamCallouts,
    showSpineParticles,
    showOrbitTrail,
    showGroundRipple,
    showInterHandoverArrow,
    showHandoverToastOverlay,
    handoverStoryLayerPolicy,
    showProfileHandoverStoryLayer,
    showCinematicSpotlight,
    effectiveCinematicMode,
    showReplayProofLayer,
    showArtifactFpsCounter,
  } = renderPlan;
  const modqnVisualLayerPreset = runtime.modqnVisualLayerPreset ?? DEFAULT_MODQN_VISUAL_LAYER_PRESET;
  const modqnVisualLayers = runtime.modqnVisualLayers ?? resolveModqnVisualLayers(modqnVisualLayerPreset);
  const beamLoadContentionEnabled = showCellOverlay && modqnVisualLayers.serviceMap;
  const beamLoadContention = useMemo(
    () => beamLoadContentionEnabled
      ? deriveBeamLoadContention(sim.perUePositions.map(position => ({
        ueId: position.id,
        servingSatId: position.servingSatId,
        servingBeamId: position.servingBeamId,
      })))
      : EMPTY_BEAM_LOAD_CONTENTION,
    [beamLoadContentionEnabled, sim.perUePositions],
  );
  const ueMarkerShape = resolveSceneLaneUeMarkerShape(sceneLane);
  const focusedCellBeamConeUe = sceneFrame.ues[0] || null;
  const focusBeamLoad = beamLoadContentionEnabled
    ? beamLoadContention.byUeId.get(focusedCellBeamConeUe?.id ?? '')
    : undefined;
  const focusBeamLoadTint = focusedCellBeamConeUe?.servingSatelliteId
    ? satelliteTintById.get(focusedCellBeamConeUe.servingSatelliteId)
    : undefined;
  const modqnServiceMap = useMemo(
    () => showCellOverlay && modqnVisualLayers.serviceMap
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
      showCellOverlay,
    ],
  );
  const modqnCellServiceReadout = useMemo(
    () => showCellOverlay && modqnVisualLayers.serviceMap
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
      showCellOverlay,
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
  const uploadParticlesEnabled =
    showCellOverlay
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
  const replayBackedHandoverStoryVisible =
    handoverStoryLayerPolicy === 'modqn-replay-source-backed'
    && showReplayProofLayer;
  const cinematicSpotlightActive = showCinematicSpotlight;
  const cinematicSpotlightTargets = useMemo(
    () => resolveCinematicSpotlightTargets({
      satBeams: viz.satBeams,
      cinematicMode: effectiveCinematicMode,
    }),
    [effectiveCinematicMode, viz.satBeams],
  );

  useEffect(() => {
    cellCoverHysteresisRef.current.clear();
  }, [runtime.handoverResetKey, runtime.signalResetKey]);

  useLayoutEffect(() => {
    const command = runtime.cameraCommand;
    if (!command || lastCameraCommandAtRef.current === command.issuedAtMs) return;

    lastCameraCommandAtRef.current = command.issuedAtMs;
    lastCameraPresetRef.current = command.preset;

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

    const controls = controlsRef.current;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();

    if (command.phase === 'acquiring') {
      const ueWorldPos = sceneFrame.ues[0]?.worldPos;
      if (!ueWorldPos) {
        lastDirectorCommandAtRef.current = command.issuedAtMs;
        return;
      }
      lastDirectorCommandAtRef.current = command.issuedAtMs;

      // Snapshot ONCE per focus cycle: re-targeting (acquiring again while already
      // focused) must preserve the original pre-focus overview pose so `restoring`
      // returns there, not to the current focused pose.
      if (directorSnapshotRef.current === null) {
        directorSnapshotRef.current = {
          position: camera.position.clone(),
          target: controls?.target.clone() ?? new THREE.Vector3(),
        };
      }
      if (controls) controls.enabled = false;

      const pose = resolveDirectorFocusPose(ueWorldPos, alpha, command.kind);
      if (runtime.reducedMotion) {
        camera.position.copy(pose.position);
        controls?.target.copy(pose.target);
        controls?.update();
        cameraTweenRef.current = null;
        cameraPresetRef.current = 'manual';
        cameraTransitionRef.current = 'idle';
      } else {
        cameraTweenRef.current = {
          preset: null,
          kind: 'director-acquire',
          startedAtMs: nowMs,
          fromPosition: camera.position.clone(),
          fromTarget: controls?.target.clone() ?? new THREE.Vector3(),
          toPosition: pose.position,
          toTarget: pose.target,
        };
        cameraPresetRef.current = 'manual';
        cameraTransitionRef.current = 'animating';
      }
      return;
    }

    lastDirectorCommandAtRef.current = command.issuedAtMs;
    const snapshot = directorSnapshotRef.current;
    const toPosition = snapshot?.position.clone() ?? camera.position.clone();
    const toTarget = snapshot?.target.clone() ?? (controls?.target.clone() ?? new THREE.Vector3());

    if (runtime.reducedMotion) {
      camera.position.copy(toPosition);
      controls?.target.copy(toTarget);
      if (controls) controls.enabled = true;
      controls?.update();
      directorSnapshotRef.current = null;
      cameraTweenRef.current = null;
      cameraPresetRef.current = 'manual';
      cameraTransitionRef.current = 'idle';
    } else {
      cameraTweenRef.current = {
        preset: null,
        kind: 'director-restore',
        startedAtMs: nowMs,
        fromPosition: camera.position.clone(),
        fromTarget: controls?.target.clone() ?? new THREE.Vector3(),
        toPosition,
        toTarget,
      };
      cameraTransitionRef.current = 'animating';
    }
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
    if (directorSnapshotRef.current === null) return;
    const controls = controlsRef.current;
    if (controls) {
      camera.position.copy(directorSnapshotRef.current.position);
      controls.target.copy(directorSnapshotRef.current.target);
      controls.enabled = true;
      controls.update();
    }
    directorSnapshotRef.current = null;
    cameraTweenRef.current = null;
    cameraTransitionRef.current = 'idle';
  }, [camera, effectiveCinematicMode]);

  useFrame(() => {
    const tween = cameraTweenRef.current;
    if (!tween) {
      // While the Director holds the camera (snapshot set), suppress the
      // reduced-motion re-pin to the last preset — otherwise it would overwrite
      // the focus/restore pose every frame and undo the focus instantly.
      if (runtime.reducedMotion && lastCameraPresetRef.current && directorSnapshotRef.current === null) {
        applyCameraPose(lastCameraPresetRef.current, 'idle');
      }
      return;
    }

    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
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
        cameraPresetRef.current = 'manual';
      } else if (tween.kind === 'director-acquire') {
        cameraPresetRef.current = 'manual';
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
        visualSatelliteAltitude={String(sceneGeometry.visualSatelliteAltitude ?? '')}
        beamSatelliteCount={viz.satBeams.size}
        sceneSource={sceneFrame.sceneSource}
        beamConeCount={
          SHOW_BEAMS && showLiveBeamCones && !showCellOverlay
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
        modqnVisualLayerPreset={showCellOverlay ? modqnVisualLayerPreset : ''}
        modqnServiceMapEnabled={showCellOverlay && modqnVisualLayers.serviceMap ? '1' : '0'}
        modqnServedUeCount={showCellOverlay ? modqnServiceMap.servedUeCount : 0}
        modqnIdleUeCount={showCellOverlay ? modqnServiceMap.idleUeCount : 0}
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
      {showUav && (
        <Suspense fallback={null}>
          <UAV position={[sim.ueGroundX, 10, sim.ueGroundZ]} scale={10} />
        </Suspense>
      )}

      <GroundScene
        ues={sceneFrame.ues
          .filter((u) => u.worldPos !== undefined)
          .map((u) => {
            const service = modqnServiceMap.ueById.get(u.id);
            // ID alignment verified: liveSimToScene preserves sim.perUePositions
            // ids (`live-ue-${index}`), so contention lookup uses UE id, not index.
            const contention = beamLoadContentionEnabled
              ? beamLoadContention.byUeId.get(u.id)?.normalizedLoad ?? 0
              : undefined;
            return {
              id: u.id,
              worldPos: u.worldPos as readonly [number, number, number],
              markerColor: service?.markerColor,
              markerEmissive: service?.markerEmissive,
              contention,
            };
          })}
        ueMarkerMultiplier={visualScaleMultipliers.ueMarkerMultiplier}
        markerShape={ueMarkerShape}
        ueTrailHistory={showCellOverlay ? undefined : ueTrailHistory}
        secondaryOpacity={showCellOverlay && modqnVisualLayers.serviceMap ? 0.72 : 1.0}
        secondaryScale={showCellOverlay && modqnVisualLayers.serviceMap ? 0.72 : 1.0}
      />
      {showCellOverlay && modqnVisualLayers.activeCellOverlay && (
        <CellOverlay
          schedule={cellSchedule}
          satelliteTintById={satelliteTintById}
          satelliteWorldById={satelliteWorldById}
          showFootprints={modqnVisualLayers.footprintEllipses}
          ueCountByCellId={modqnServiceMap.ueCountByCellId}
          showUeCounts={modqnVisualLayers.ueCountBadges}
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
      {showCellOverlay && modqnVisualLayers.handoverStory && (
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
      {showEarthFixedCells && <EarthFixedCells cells={paintedCells} showDebugLabels={showEarthFixedCellLabels} />}
      {showLiveSceneEffects && <AmbientFootprintRings rings={viz.ambientRings} footprintRadiusWorld={viz.footprintRadiusWorld} />}
      {showLiveSceneEffects && (
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
      <ModqnReplaySceneLayer
        displayState={modqnReplayDisplayState}
        reducedMotion={runtime.reducedMotion}
        showBoard={showReplayProofLayer}
        worldUnitsPerKm={replayWorldUnitsPerKm}
        visualSatelliteAltitudeWorld={sceneGeometry.visualSatelliteAltitude}
      />
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
          recentHoActive={recentHoActive}
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
      {SHOW_BEAMS && showLiveBeamCones && !showCellOverlay && viz.displaySats
        .filter(sat => viz.beamSatIds.has(sat.id))
        .map(sat => {
          const beams = viz.satBeams.get(sat.id);
          if (!beams?.length) return null;

          return (
            <SatelliteBeams
              key={`beams-${sat.id}`}
              satelliteId={sat.id}
              satellitePosition={sat.world}
              beams={beams}
              footprintRadius={viz.footprintRadiusWorld}
              reducedMotion={runtime.reducedMotion}
              cinematicMode={effectiveCinematicMode}
              showCallouts={showBeamCallouts}
            />
          );
        })}
      {showLiveSceneEffects && <IntraHandoverArrow vizFrame={viz} runtime={runtime} />}
      {showInterHandoverArrow && (
        <InterHandoverArrow
          recentHoSourceSatId={sim.recentHoSourceSatId}
          recentHoTargetSatId={sim.recentHoTargetSatId}
          displaySats={viz.displaySats}
          reducedMotion={runtime.reducedMotion}
        />
      )}
      {showLiveSceneEffects && <IntraGroundShockwave vizFrame={viz} runtime={runtime} />}
      {showHandoverToastOverlay && <HandoverToastOverlay frame={sceneFrame} interTriggerSec={profile.handover.triggerTimeSec} />}
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
  modqnReplayDisplayState: ModqnReplayPlaybackDisplayState | null;
  showModqnReplayScene: boolean;
  sceneLane: SceneLane;
  onSimUpdate: (state: SimState) => void;
  sceneFrame?: NormalizedSceneFrame;
}

export const MainScene = memo(function MainScene({
  speed,
  paused,
  profile,
  runtime,
  visualScaleMultipliers,
  modqnReplayDisplayState,
  showModqnReplayScene,
  sceneLane,
  onSimUpdate,
  sceneFrame,
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
        hidden
      />
      <Starfield starCount={180} />
      <Canvas
        shadows
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          alpha: true,
          powerPreference: 'high-performance',
          antialias: true,
        }}
      >
        <Suspense fallback={<Html center><div style={{ color: 'white', fontSize: 20 }}>Loading...</div></Html>}>
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
              modqnReplayDisplayState={modqnReplayDisplayState}
              showModqnReplayScene={showModqnReplayScene}
              sceneLane={sceneLane}
              onSimUpdate={onSimUpdate}
              sceneFrame={sceneFrame}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
});

MainScene.displayName = 'MainScene';
