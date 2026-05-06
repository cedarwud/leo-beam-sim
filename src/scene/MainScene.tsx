import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import type { LinkSample } from '../engine/signal/types';
import { getFormulaFamilyLabel } from '../profiles';
import type { Profile } from '../profiles/types';
import type {
  LinkBudgetTerms,
  PanelComparisonState,
  PanelPrimaryState,
  CameraPreset,
  RuntimeConfig,
  SignalSourceState,
  SignalTruthStatus,
  SimState,
} from './types';
import { useSimulation } from './useSimulation';
import { useBeamViz } from './useBeamViz';
import {
  EarthFixedCells,
  createCellCoverCandidate,
  generateHexGrid,
  resolveHexCellCoverAssignments,
  type CellCoverHysteresisState,
} from '../viz/EarthFixedCells';
import { AmbientFootprintRings } from '../viz/AmbientFootprintRings';
import { HandoverLinks } from '../viz/HandoverLinks';
import { BeamPulseClock, SatelliteBeams } from '../viz/SatelliteBeams';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { SpineParticles } from '../viz/SpineParticles';
import { OrbitTrail } from '../viz/OrbitTrail';
import { ServingGroundRipple } from '../viz/ServingGroundRipple';
import { GroundScene } from '../viz/GroundScene';
import { formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import { NTPUScene } from '../components/scene/NTPUScene';
import { UAV } from '../components/scene/UAV';
import { Starfield } from '../components/ui/Starfield';
import {
  CINEMATIC_EVENT_LIGHT_DECAY,
  CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD,
  CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD,
  CINEMATIC_FOG_COLOR,
  CINEMATIC_FOG_DENSITY,
  isSpotlightMode,
  resolveCinematicLightIntensity,
  resolveCinematicSpotlightTargets,
} from './cinematicEffects';

interface SceneContentProps {
  profile: Profile;
  speed: number;
  paused: boolean;
  runtime: RuntimeConfig;
  onSimUpdate: (state: SimState) => void;
}

interface LatchedSignalState {
  satId: string | null;
  beamId: number | null;
  sinrDb: number | null;
}

interface LatchedTopoState {
  satId: string | null;
  beamId: number | null;
  elevationDeg: number | null;
  rangeKm: number | null;
}

interface LatchedBudgetState {
  satId: string | null;
  beamId: number | null;
  budget: LinkBudgetTerms | null;
}

interface HandoverPanelSnapshot {
  phase: 'pending' | 'recent-ho';
  servingSatId: string;
  servingBeamId: number;
  servingSinrDb: number | null;
  comparisonSatId: string;
  comparisonBeamId: number;
  comparisonSinrDb: number | null;
}

const UI_STABLE_UPDATE_INTERVAL_MS = 700;
const UI_HANDOVER_UPDATE_INTERVAL_MS = 250;
const SHOW_BEAMS = true;
const CAMERA_TWEEN_DURATION_MS = 600;

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
};

interface CameraTweenState {
  preset: CameraPreset;
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

function formatCameraVector(vector: THREE.Vector3): string {
  return [vector.x, vector.y, vector.z].map(value => value.toFixed(2)).join(',');
}

function hasNumericDelta(
  previous: number | null,
  next: number | null,
  tolerance = 0.4,
): boolean {
  if (previous === null || next === null) return previous !== next;
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return previous !== next;
  return Math.abs(previous - next) > tolerance;
}

function hasBudgetChanged(
  previous: LinkBudgetTerms | null,
  next: LinkBudgetTerms | null,
): boolean {
  if (!previous || !next) return previous !== next;
  return hasNumericDelta(previous.signalDbm, next.signalDbm, 0.2)
    || hasNumericDelta(previous.intraInterferenceDbm, next.intraInterferenceDbm, 0.2)
    || hasNumericDelta(previous.interInterferenceDbm, next.interInterferenceDbm, 0.2)
    || hasNumericDelta(previous.noiseDbm, next.noiseDbm, 0.2)
    || hasNumericDelta(previous.denominatorDbm, next.denominatorDbm, 0.2)
    || hasNumericDelta(previous.txPowerDbm, next.txPowerDbm, 0.2)
    || hasNumericDelta(previous.pathLossDb, next.pathLossDb, 0.2)
    || hasNumericDelta(previous.beamGainDb, next.beamGainDb, 0.2)
    || hasNumericDelta(previous.steeringLossDb, next.steeringLossDb, 0.2)
    || hasNumericDelta(previous.receiverGainDbi, next.receiverGainDbi, 0.2);
}

function hasSignalSourceChanged(previous: SignalSourceState, next: SignalSourceState): boolean {
  return previous.satId !== next.satId
    || previous.beamId !== next.beamId
    || previous.status !== next.status
    || hasNumericDelta(previous.sinrDb, next.sinrDb)
    || hasNumericDelta(previous.elevationDeg, next.elevationDeg)
    || hasNumericDelta(previous.rangeKm, next.rangeKm);
}

function hasSatelliteVisualIdentityChanged(
  previous: SimState['satelliteVisualIdentityById'],
  next: SimState['satelliteVisualIdentityById'],
): boolean {
  const previousKeys = Object.keys(previous).sort();
  const nextKeys = Object.keys(next).sort();
  if (previousKeys.join(',') !== nextKeys.join(',')) return true;

  return nextKeys.some(key => {
    const previousEntry = previous[key];
    const nextEntry = next[key];
    return previousEntry?.satelliteTintColor !== nextEntry?.satelliteTintColor
      || previousEntry?.satelliteGlyph !== nextEntry?.satelliteGlyph
      || previousEntry?.satelliteVisualIndex !== nextEntry?.satelliteVisualIndex;
  });
}

function hasUiStateChanged(previous: SimState | null, next: SimState): boolean {
  if (!previous) return true;
  return previous.profileId !== next.profileId
    || previous.formulaFamilyLabel !== next.formulaFamilyLabel
    || hasSatelliteVisualIdentityChanged(previous.satelliteVisualIdentityById, next.satelliteVisualIdentityById)
    || hasSignalSourceChanged(previous.physicalServing, next.physicalServing)
    || hasSignalSourceChanged(previous.panelPrimary, next.panelPrimary)
    || previous.panelPrimary.role !== next.panelPrimary.role
    || hasSignalSourceChanged(previous.panelComparison, next.panelComparison)
    || previous.panelComparison.role !== next.panelComparison.role
    || previous.servingSatId !== next.servingSatId
    || previous.servingBeamId !== next.servingBeamId
    || previous.pendingTargetSatId !== next.pendingTargetSatId
    || previous.pendingTargetBeamId !== next.pendingTargetBeamId
    || previous.comparisonSatId !== next.comparisonSatId
    || previous.comparisonBeamId !== next.comparisonBeamId
    || previous.comparisonKind !== next.comparisonKind
    || previous.recentHoSourceSatId !== next.recentHoSourceSatId
    || previous.recentHoTargetSatId !== next.recentHoTargetSatId
    || previous.hoCount !== next.hoCount
    || previous.handoverOffsetDb !== next.handoverOffsetDb
    || previous.handoverTriggerSec !== next.handoverTriggerSec
    || hasNumericDelta(previous.sinrDb, next.sinrDb)
    || hasNumericDelta(previous.pendingTargetSinrDb, next.pendingTargetSinrDb)
    || hasNumericDelta(previous.comparisonSinrDb, next.comparisonSinrDb)
    || hasNumericDelta(previous.sinrDeltaDb, next.sinrDeltaDb)
    || hasBudgetChanged(previous.physicalServingBudget, next.physicalServingBudget)
    || hasBudgetChanged(previous.servingBudget, next.servingBudget)
    || previous.beamHopEnabled !== next.beamHopEnabled
    || previous.beamHopSlotIndex !== next.beamHopSlotIndex
    || previous.beamHopSlotSec !== next.beamHopSlotSec
    || previous.servingBeamActiveThisSlot !== next.servingBeamActiveThisSlot
    || previous.servingSatActiveBeamIds.join(',') !== next.servingSatActiveBeamIds.join(',')
    || previous.pendingTargetActiveBeamIds.join(',') !== next.pendingTargetActiveBeamIds.join(',');
}

function isFinitePanelSinr(sinrDb: number | null): sinrDb is number {
  return sinrDb !== null && Number.isFinite(sinrDb) && sinrDb > MIN_VISIBLE_SINR_DB;
}

function isFiniteBeamSinr(sinrDb: number | null | undefined): sinrDb is number {
  return sinrDb !== null && sinrDb !== undefined && Number.isFinite(sinrDb);
}

function isFinitePanelMetric(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function resolveLatchedSinr(
  latched: LatchedSignalState,
  satId: string | null,
  beamId: number | null,
  nextSinrDb: number | null,
): number | null {
  if (!satId || beamId === null) {
    latched.satId = null;
    latched.beamId = null;
    latched.sinrDb = null;
    return null;
  }

  if (isFinitePanelSinr(nextSinrDb)) {
    latched.satId = satId;
    latched.beamId = beamId;
    latched.sinrDb = nextSinrDb;
    return nextSinrDb;
  }

  if (latched.satId === satId && latched.beamId === beamId) {
    return latched.sinrDb;
  }

  latched.satId = satId;
  latched.beamId = beamId;
  latched.sinrDb = null;
  return null;
}

function resolveLatchedTopo(
  latched: LatchedTopoState,
  satId: string | null,
  beamId: number | null,
  nextElevationDeg: number | null,
  nextRangeKm: number | null,
): { elevationDeg: number | null; rangeKm: number | null } {
  if (!satId || beamId === null) {
    latched.satId = null;
    latched.beamId = null;
    latched.elevationDeg = null;
    latched.rangeKm = null;
    return { elevationDeg: null, rangeKm: null };
  }

  if (isFinitePanelMetric(nextElevationDeg) && isFinitePanelMetric(nextRangeKm)) {
    latched.satId = satId;
    latched.beamId = beamId;
    latched.elevationDeg = nextElevationDeg;
    latched.rangeKm = nextRangeKm;
    return { elevationDeg: nextElevationDeg, rangeKm: nextRangeKm };
  }

  if (latched.satId === satId && latched.beamId === beamId) {
    return { elevationDeg: latched.elevationDeg, rangeKm: latched.rangeKm };
  }

  latched.satId = satId;
  latched.beamId = beamId;
  latched.elevationDeg = null;
  latched.rangeKm = null;
  return { elevationDeg: null, rangeKm: null };
}

function resolveLatchedBudget(
  latched: LatchedBudgetState,
  satId: string | null,
  beamId: number | null,
  nextBudget: LinkBudgetTerms | null,
): LinkBudgetTerms | null {
  if (!satId || beamId === null) {
    latched.satId = null;
    latched.beamId = null;
    latched.budget = null;
    return null;
  }

  if (nextBudget) {
    latched.satId = satId;
    latched.beamId = beamId;
    latched.budget = { ...nextBudget };
    return nextBudget;
  }

  if (latched.satId === satId && latched.beamId === beamId) {
    return latched.budget;
  }

  latched.satId = satId;
  latched.beamId = beamId;
  latched.budget = null;
  return null;
}

function normalizePanelSignal(
  satId: string | null,
  beamId: number | null,
  sinrDb: number | null,
): { satId: string | null; beamId: number | null; sinrDb: number | null } {
  if (!satId || beamId === null) {
    return { satId: null, beamId: null, sinrDb: null };
  }
  return { satId, beamId, sinrDb };
}

function resolveSignalStatus(
  satId: string | null,
  beamId: number | null,
  rawSinrDb: number | null,
  displayedSinrDb: number | null,
): SignalTruthStatus {
  if (!satId || beamId === null) return 'none';
  if (isFinitePanelSinr(rawSinrDb)) return 'live';
  if (displayedSinrDb !== null && Number.isFinite(displayedSinrDb)) return 'latched';
  return 'latched';
}

function extractBudgetTerms(sample: LinkSample | null): LinkBudgetTerms | null {
  if (!sample) return null;
  return {
    signalDbm: sample.signalDbm,
    intraInterferenceDbm: sample.intraInterferenceDbm,
    interInterferenceDbm: sample.interInterferenceDbm,
    noiseDbm: sample.noiseDbm,
    denominatorDbm: sample.denominatorDbm,
    txPowerDbm: sample.txPowerDbm,
    pathLossDb: sample.pathLossDb,
    beamGainDb: sample.beamGainDb,
    steeringLossDb: sample.steeringLossDb,
    receiverGainDbi: sample.receiverGainDbi,
  };
}

function SceneContent({
  profile,
  speed,
  paused,
  runtime,
  onSimUpdate,
}: SceneContentProps) {
  const camera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraTweenRef = useRef<CameraTweenState | null>(null);
  const lastCameraCommandAtRef = useRef<number | null>(null);
  const lastCameraPresetRef = useRef<CameraPreset | null>(null);
  const sim = useSimulation(
    profile,
    runtime.replay,
    speed,
    paused,
    runtime.signalResetKey,
    runtime.handoverResetKey,
  );
  const lastUiUpdateAtRef = useRef(0);
  const lastUiStateRef = useRef<SimState | null>(null);
  const latchedServingSinrRef = useRef<LatchedSignalState>({ satId: null, beamId: null, sinrDb: null });
  const latchedComparisonSinrRef = useRef<LatchedSignalState>({ satId: null, beamId: null, sinrDb: null });
  const latchedPhysicalServingTopoRef = useRef<LatchedTopoState>({ satId: null, beamId: null, elevationDeg: null, rangeKm: null });
  const latchedServingTopoRef = useRef<LatchedTopoState>({ satId: null, beamId: null, elevationDeg: null, rangeKm: null });
  const latchedComparisonTopoRef = useRef<LatchedTopoState>({ satId: null, beamId: null, elevationDeg: null, rangeKm: null });
  const latchedPhysicalServingBudgetRef = useRef<LatchedBudgetState>({ satId: null, beamId: null, budget: null });
  const latchedServingBudgetRef = useRef<LatchedBudgetState>({ satId: null, beamId: null, budget: null });
  const latchedBeamSinrByKeyRef = useRef<Map<string, number>>(new Map());
  const cellCoverHysteresisRef = useRef<CellCoverHysteresisState>(new Map());
  const handoverPanelRef = useRef<HandoverPanelSnapshot | null>(null);
  const writeCameraTelemetry = (preset: CameraPreset | null, transition: 'idle' | 'animating') => {
    const controls = controlsRef.current;
    gl.domElement.dataset.cameraPreset = preset ?? 'manual';
    gl.domElement.dataset.cameraTransition = transition;
    gl.domElement.dataset.cameraPosition = formatCameraVector(camera.position);
    gl.domElement.dataset.cameraTarget = formatCameraVector(controls?.target ?? new THREE.Vector3());
  };
  const applyCameraPose = (preset: CameraPreset, transition: 'idle' | 'animating') => {
    const presetPose = CAMERA_PRESET_POSES[preset];
    const controls = controlsRef.current;
    camera.position.set(...presetPose.position);
    controls?.target.set(...presetPose.target);
    controls?.update();
    writeCameraTelemetry(preset, transition);
  };
  const cells = useMemo(
    () => generateHexGrid({ rows: 4, cols: 5, cellRadius: 80, centerX: 0, centerZ: 0 }),
    [],
  );
  const viz = useBeamViz(sim, profile, runtime, latchedBeamSinrByKeyRef.current);
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
  const showSpineParticles =
    runtime.effectsEnabled.spineParticles
    && !paused
    && !runtime.reducedMotion;
  const showOrbitTrail =
    runtime.effectsEnabled.orbitTrail
    && !runtime.reducedMotion;
  const recentHoActive =
    sim.recentHoSourceSatId !== null
    || sim.recentHoTargetSatId !== null;
  const showGroundRipple =
    (runtime.effectsEnabled.servingRipple || runtime.effectsEnabled.pendingRipple)
    && !paused
    && !runtime.reducedMotion
    && !recentHoActive;
  const cinematicSpotlightActive = isSpotlightMode(runtime.cinematicMode);
  const cinematicSpotlightTargets = useMemo(
    () => resolveCinematicSpotlightTargets({
      satBeams: viz.satBeams,
      cinematicMode: runtime.cinematicMode,
    }),
    [runtime.cinematicMode, viz.satBeams],
  );

  useEffect(() => {
    lastUiUpdateAtRef.current = 0;
    lastUiStateRef.current = null;
    latchedServingSinrRef.current = { satId: null, beamId: null, sinrDb: null };
    latchedComparisonSinrRef.current = { satId: null, beamId: null, sinrDb: null };
    latchedPhysicalServingTopoRef.current = { satId: null, beamId: null, elevationDeg: null, rangeKm: null };
    latchedServingTopoRef.current = { satId: null, beamId: null, elevationDeg: null, rangeKm: null };
    latchedComparisonTopoRef.current = { satId: null, beamId: null, elevationDeg: null, rangeKm: null };
    latchedPhysicalServingBudgetRef.current = { satId: null, beamId: null, budget: null };
    latchedServingBudgetRef.current = { satId: null, beamId: null, budget: null };
    latchedBeamSinrByKeyRef.current = new Map();
    cellCoverHysteresisRef.current.clear();
    handoverPanelRef.current = null;
  }, [runtime.handoverResetKey, runtime.signalResetKey]);

  useEffect(() => {
    writeCameraTelemetry(lastCameraPresetRef.current, cameraTweenRef.current ? 'animating' : 'idle');
  });

  useLayoutEffect(() => {
    const command = runtime.cameraCommand;
    if (!command || lastCameraCommandAtRef.current === command.issuedAtMs) return;

    lastCameraCommandAtRef.current = command.issuedAtMs;
    lastCameraPresetRef.current = command.preset;

    const presetPose = CAMERA_PRESET_POSES[command.preset];
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
      startedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
      fromPosition: camera.position.clone(),
      fromTarget: currentTarget,
      toPosition,
      toTarget,
    };
    writeCameraTelemetry(command.preset, 'animating');
  }, [camera, runtime.cameraCommand, runtime.reducedMotion]);

  useFrame(() => {
    const tween = cameraTweenRef.current;
    if (!tween) {
      if (runtime.reducedMotion && lastCameraPresetRef.current) {
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
      writeCameraTelemetry(tween.preset, 'idle');
      return;
    }

    writeCameraTelemetry(tween.preset, 'animating');
  });

  useEffect(() => {
    const topoBySatId = new Map(sim.satellites.map(sat => [sat.id, sat.topo]));
    const pendingTargetSinrDb = sim.pendingTargetSinrDb;
    const liveServingSinrDb = resolveLatchedSinr(
      latchedServingSinrRef.current,
      sim.serving.satId,
      sim.serving.beamId,
      sim.serving.sinrDb,
    );
    const physicalServingSignal = normalizePanelSignal(
      sim.serving.satId,
      sim.serving.beamId,
      liveServingSinrDb,
    );
    const physicalServingTopo = physicalServingSignal.satId
      ? topoBySatId.get(physicalServingSignal.satId)
      : undefined;
    const physicalServingRangeKm = physicalServingSignal.satId
      ? sim.linkRangeKmBySatId.get(physicalServingSignal.satId) ?? physicalServingTopo?.rangeKm ?? null
      : null;
    const normalizedPhysicalServingTopo = resolveLatchedTopo(
      latchedPhysicalServingTopoRef.current,
      physicalServingSignal.satId,
      physicalServingSignal.beamId,
      physicalServingTopo?.elevationDeg ?? null,
      physicalServingRangeKm,
    );
    const candidateComparisonSample = [...sim.linkSamples]
      .filter(sample => sample.satId !== sim.serving.satId)
      .sort((a, b) => b.sinrDb - a.sinrDb)[0] ?? null;
    const idleComparisonSinrDb = resolveLatchedSinr(
      latchedComparisonSinrRef.current,
      candidateComparisonSample?.satId ?? null,
      candidateComparisonSample?.beamId ?? null,
      candidateComparisonSample?.sinrDb ?? null,
    );
    const previousHandoverPanel = handoverPanelRef.current;
    let panelServingSatId = sim.serving.satId;
    let panelServingBeamId = sim.serving.beamId;
    let panelServingSinrDb = liveServingSinrDb;
    let panelComparisonSatId = candidateComparisonSample?.satId ?? null;
    let panelComparisonBeamId = candidateComparisonSample?.beamId ?? null;
    let panelComparisonSinrDb = idleComparisonSinrDb;
    let panelComparisonKind: SimState['comparisonKind'] = candidateComparisonSample ? 'candidate' : null;

    if (
      sim.pendingTargetSatId !== null
      && sim.pendingTargetBeamId !== null
      && sim.serving.satId !== null
      && sim.serving.beamId !== null
    ) {
      const samePendingPair =
        previousHandoverPanel?.phase === 'pending'
        && previousHandoverPanel.servingSatId === sim.serving.satId
        && previousHandoverPanel.servingBeamId === sim.serving.beamId
        && previousHandoverPanel.comparisonSatId === sim.pendingTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.pendingTargetBeamId;
      const pendingServingSinrDb = isFinitePanelSinr(liveServingSinrDb)
        ? liveServingSinrDb
        : samePendingPair
          ? previousHandoverPanel.servingSinrDb
          : null;
      const pendingComparisonSinrDb = isFinitePanelSinr(pendingTargetSinrDb)
        ? pendingTargetSinrDb
        : samePendingPair
          ? previousHandoverPanel.comparisonSinrDb
          : null;
      handoverPanelRef.current = {
        phase: 'pending',
        servingSatId: sim.serving.satId,
        servingBeamId: sim.serving.beamId,
        servingSinrDb: pendingServingSinrDb,
        comparisonSatId: sim.pendingTargetSatId,
        comparisonBeamId: sim.pendingTargetBeamId,
        comparisonSinrDb: pendingComparisonSinrDb,
      };
      panelServingSatId = handoverPanelRef.current.servingSatId;
      panelServingBeamId = handoverPanelRef.current.servingBeamId;
      panelServingSinrDb = handoverPanelRef.current.servingSinrDb;
      panelComparisonSatId = handoverPanelRef.current.comparisonSatId;
      panelComparisonBeamId = handoverPanelRef.current.comparisonBeamId;
      panelComparisonSinrDb = handoverPanelRef.current.comparisonSinrDb;
      panelComparisonKind = 'pending';
    } else if (
      sim.recentHoSourceSatId !== null
      && sim.recentHoSourceBeamId !== null
      && sim.recentHoTargetSatId !== null
      && sim.recentHoTargetBeamId !== null
    ) {
      const sameRecentPair =
        previousHandoverPanel?.phase === 'recent-ho'
        && previousHandoverPanel.servingSatId === sim.recentHoSourceSatId
        && previousHandoverPanel.servingBeamId === sim.recentHoSourceBeamId
        && previousHandoverPanel.comparisonSatId === sim.recentHoTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.recentHoTargetBeamId;
      const matchesPreviousPendingPair =
        previousHandoverPanel?.phase === 'pending'
        && previousHandoverPanel.servingSatId === sim.recentHoSourceSatId
        && previousHandoverPanel.servingBeamId === sim.recentHoSourceBeamId
        && previousHandoverPanel.comparisonSatId === sim.recentHoTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.recentHoTargetBeamId;
      const recentServingSinrDb = isFinitePanelSinr(sim.recentHoSourceSinrDb)
        ? sim.recentHoSourceSinrDb
        : matchesPreviousPendingPair
          ? previousHandoverPanel.servingSinrDb
          : sameRecentPair
            ? previousHandoverPanel.servingSinrDb
            : null;
      const recentComparisonSinrDb = isFinitePanelSinr(sim.recentHoTargetSinrDb)
        ? sim.recentHoTargetSinrDb
        : matchesPreviousPendingPair
          ? previousHandoverPanel.comparisonSinrDb
          : sameRecentPair
            ? previousHandoverPanel.comparisonSinrDb
            : null;
      handoverPanelRef.current = {
        phase: 'recent-ho',
        servingSatId: sim.recentHoSourceSatId,
        servingBeamId: sim.recentHoSourceBeamId,
        servingSinrDb: recentServingSinrDb,
        comparisonSatId: sim.recentHoTargetSatId,
        comparisonBeamId: sim.recentHoTargetBeamId,
        comparisonSinrDb: recentComparisonSinrDb,
      };
      panelServingSatId = handoverPanelRef.current.servingSatId;
      panelServingBeamId = handoverPanelRef.current.servingBeamId;
      panelServingSinrDb = handoverPanelRef.current.servingSinrDb;
      panelComparisonSatId = handoverPanelRef.current.comparisonSatId;
      panelComparisonBeamId = handoverPanelRef.current.comparisonBeamId;
      panelComparisonSinrDb = handoverPanelRef.current.comparisonSinrDb;
      panelComparisonKind = 'recent-ho';
    } else {
      handoverPanelRef.current = null;
    }

    const normalizedServing = normalizePanelSignal(
      panelServingSatId,
      panelServingBeamId,
      panelServingSinrDb,
    );
    const normalizedComparison = normalizePanelSignal(
      panelComparisonSatId,
      panelComparisonBeamId,
      panelComparisonSinrDb,
    );
    const servingTopo = normalizedServing.satId
      ? topoBySatId.get(normalizedServing.satId)
      : undefined;
    const comparisonTopo = normalizedComparison.satId
      ? topoBySatId.get(normalizedComparison.satId)
      : undefined;
    const servingRangeKm = normalizedServing.satId
      ? sim.linkRangeKmBySatId.get(normalizedServing.satId) ?? servingTopo?.rangeKm ?? null
      : null;
    const comparisonRangeKm = normalizedComparison.satId
      ? sim.linkRangeKmBySatId.get(normalizedComparison.satId) ?? comparisonTopo?.rangeKm ?? null
      : null;
    const normalizedServingTopo = resolveLatchedTopo(
      latchedServingTopoRef.current,
      normalizedServing.satId,
      normalizedServing.beamId,
      servingTopo?.elevationDeg ?? null,
      servingRangeKm,
    );
    const normalizedComparisonTopo = resolveLatchedTopo(
      latchedComparisonTopoRef.current,
      normalizedComparison.satId,
      normalizedComparison.beamId,
      comparisonTopo?.elevationDeg ?? null,
      comparisonRangeKm,
    );
    const visibleBeamKeys = new Set<string>();
    const pushVisibleBeamKey = (satId: string | null, beamId: number | null) => {
      if (!satId || beamId === null) return;
      visibleBeamKeys.add(`${satId}:${beamId}`);
    };

    for (const [satId, beamCells] of sim.beamCellsBySatId.entries()) {
      for (const beam of beamCells) {
        visibleBeamKeys.add(`${satId}:${beam.beamId}`);
      }
    }

    pushVisibleBeamKey(normalizedServing.satId, normalizedServing.beamId);
    pushVisibleBeamKey(normalizedComparison.satId, normalizedComparison.beamId);
    pushVisibleBeamKey(sim.pendingTargetSatId, sim.pendingTargetBeamId);
    pushVisibleBeamKey(sim.recentHoSourceSatId, sim.recentHoSourceBeamId);
    pushVisibleBeamKey(sim.recentHoTargetSatId, sim.recentHoTargetBeamId);

    const nextLatchedBeamSinrByKey = new Map<string, number>();
    for (const key of visibleBeamKeys) {
      const previousSinrDb = latchedBeamSinrByKeyRef.current.get(key);
      if (isFiniteBeamSinr(previousSinrDb)) {
        nextLatchedBeamSinrByKey.set(key, previousSinrDb);
      }
    }

    for (const sample of sim.linkSamples) {
      const key = `${sample.satId}:${sample.beamId}`;
      if (!visibleBeamKeys.has(key) || !isFiniteBeamSinr(sample.sinrDb)) continue;
      nextLatchedBeamSinrByKey.set(key, sample.sinrDb);
    }

    const syncLatchedBeamSinr = (
      satId: string | null,
      beamId: number | null,
      sinrDb: number | null,
    ) => {
      if (!satId || beamId === null || !isFiniteBeamSinr(sinrDb)) return;
      nextLatchedBeamSinrByKey.set(`${satId}:${beamId}`, sinrDb);
    };

    syncLatchedBeamSinr(normalizedServing.satId, normalizedServing.beamId, normalizedServing.sinrDb);
    syncLatchedBeamSinr(normalizedComparison.satId, normalizedComparison.beamId, normalizedComparison.sinrDb);
    latchedBeamSinrByKeyRef.current = nextLatchedBeamSinrByKey;

    const panelSinrDeltaDb =
      normalizedComparison.sinrDb !== null && normalizedServing.sinrDb !== null
        ? normalizedComparison.sinrDb - normalizedServing.sinrDb
        : null;
    const servingSatBeamHopState = physicalServingSignal.satId
      ? sim.beamHopStatesBySatId.get(physicalServingSignal.satId)
      : undefined;
    const pendingTargetBeamHopState = sim.pendingTargetSatId
      ? sim.beamHopStatesBySatId.get(sim.pendingTargetSatId)
      : undefined;
    const servingBeamActiveThisSlot =
      physicalServingSignal.satId && physicalServingSignal.beamId !== null
        ? servingSatBeamHopState?.activeBeamIds.includes(physicalServingSignal.beamId) ?? false
        : null;
    const physicalServingSample = physicalServingSignal.satId && physicalServingSignal.beamId !== null
      ? sim.linkSamples.find(
        sample =>
          sample.satId === physicalServingSignal.satId
          && sample.beamId === physicalServingSignal.beamId,
      ) ?? null
      : null;
    const servingSample = normalizedServing.satId && normalizedServing.beamId !== null
      ? sim.linkSamples.find(
        sample =>
          sample.satId === normalizedServing.satId
          && sample.beamId === normalizedServing.beamId,
      ) ?? null
      : null;
    const physicalServingBudget = resolveLatchedBudget(
      latchedPhysicalServingBudgetRef.current,
      physicalServingSignal.satId,
      physicalServingSignal.beamId,
      extractBudgetTerms(physicalServingSample),
    );
    const servingBudget = resolveLatchedBudget(
      latchedServingBudgetRef.current,
      normalizedServing.satId,
      normalizedServing.beamId,
      extractBudgetTerms(servingSample),
    );
    const panelPrimaryRole: PanelPrimaryState['role'] = normalizedServing.satId
      ? panelComparisonKind === 'recent-ho' ? 'ho-source' : 'serving'
      : 'none';
    const panelPrimaryStatus: SignalTruthStatus = panelPrimaryRole === 'ho-source'
      ? 'recent-ho'
      : resolveSignalStatus(
        normalizedServing.satId,
        normalizedServing.beamId,
        sim.serving.sinrDb,
        normalizedServing.sinrDb,
      );
    const panelComparisonRole: PanelComparisonState['role'] =
      normalizedComparison.satId === null
        ? 'none'
        : panelComparisonKind === 'pending'
          ? 'pending'
          : panelComparisonKind === 'recent-ho'
            ? 'ho-target'
            : 'candidate';
    const panelComparisonStatus: SignalTruthStatus =
      panelComparisonRole === 'none'
        ? 'none'
        : panelComparisonRole === 'ho-target'
          ? 'recent-ho'
          : panelComparisonRole === 'candidate'
            ? 'derived'
            : resolveSignalStatus(
              normalizedComparison.satId,
              normalizedComparison.beamId,
              pendingTargetSinrDb,
              normalizedComparison.sinrDb,
            );
    const physicalServing: SignalSourceState = {
      satId: physicalServingSignal.satId,
      beamId: physicalServingSignal.beamId,
      sinrDb: physicalServingSignal.sinrDb,
      elevationDeg: normalizedPhysicalServingTopo.elevationDeg,
      rangeKm: normalizedPhysicalServingTopo.rangeKm,
      status: resolveSignalStatus(
        physicalServingSignal.satId,
        physicalServingSignal.beamId,
        sim.serving.sinrDb,
        physicalServingSignal.sinrDb,
      ),
    };
    const panelPrimary: PanelPrimaryState = {
      role: panelPrimaryRole,
      satId: normalizedServing.satId,
      beamId: normalizedServing.beamId,
      sinrDb: normalizedServing.sinrDb,
      elevationDeg: normalizedServingTopo.elevationDeg,
      rangeKm: normalizedServingTopo.rangeKm,
      status: panelPrimaryStatus,
    };
    const panelComparison: PanelComparisonState = {
      role: panelComparisonRole,
      satId: normalizedComparison.satId,
      beamId: normalizedComparison.beamId,
      sinrDb: normalizedComparison.sinrDb,
      elevationDeg: normalizedComparisonTopo.elevationDeg,
      rangeKm: normalizedComparisonTopo.rangeKm,
      status: panelComparisonStatus,
    };
    const satelliteVisualIdentityById = Object.fromEntries(
      viz.displaySats.flatMap(sat => {
        if (
          sat.satelliteTintColor === undefined
          || sat.satelliteGlyph === undefined
          || sat.satelliteVisualIndex === undefined
        ) {
          return [];
        }

        return [[sat.id, {
          satelliteTintColor: sat.satelliteTintColor,
          satelliteGlyph: sat.satelliteGlyph,
          satelliteVisualIndex: sat.satelliteVisualIndex,
        }]];
      }),
    );

    const nextState: SimState = {
      profileId: profile.id,
      formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
      satelliteVisualIdentityById,
      physicalServing,
      panelPrimary,
      panelComparison,
      servingSatId: normalizedServing.satId,
      servingBeamId: normalizedServing.beamId,
      servingElevationDeg: normalizedServingTopo.elevationDeg,
      servingRangeKm: normalizedServingTopo.rangeKm,
      pendingTargetSatId: sim.pendingTargetSatId,
      pendingTargetBeamId: sim.pendingTargetBeamId,
      pendingTargetSinrDb,
      comparisonSatId: normalizedComparison.satId,
      comparisonBeamId: normalizedComparison.beamId,
      comparisonElevationDeg: normalizedComparisonTopo.elevationDeg,
      comparisonRangeKm: normalizedComparisonTopo.rangeKm,
      comparisonSinrDb: normalizedComparison.sinrDb,
      comparisonKind: normalizedComparison.satId ? panelComparisonKind : null,
      sinrDeltaDb: panelSinrDeltaDb,
      recentHoSourceSatId: sim.recentHoSourceSatId,
      recentHoTargetSatId: sim.recentHoTargetSatId,
      sinrDb: normalizedServing.sinrDb ?? -Infinity,
      physicalServingBudget,
      servingBudget,
      handoverOffsetDb: profile.handover.offsetDb,
      handoverTriggerProgressSec: sim.handoverTriggerProgressSec,
      handoverTriggerSec: profile.handover.triggerTimeSec,
      hoCount: sim.hoCount,
      lastHoReason: sim.lastHoReason,
      beamHopEnabled: sim.beamHopEnabled,
      beamHopSlotIndex: sim.beamHopSlotIndex,
      beamHopSlotSec: sim.beamHopSlotSec,
      servingBeamActiveThisSlot,
      servingSatActiveBeamIds: servingSatBeamHopState?.activeBeamIds ?? [],
      pendingTargetActiveBeamIds: pendingTargetBeamHopState?.activeBeamIds ?? [],
    };
    const nowMs = performance.now();
    const handoverWindowActive =
      sim.pendingTargetSatId !== null
      || sim.recentHoSourceSatId !== null
      || sim.recentHoTargetSatId !== null;
    const uiIntervalMs = handoverWindowActive
      ? UI_HANDOVER_UPDATE_INTERVAL_MS
      : UI_STABLE_UPDATE_INTERVAL_MS;
    if (
      hasUiStateChanged(lastUiStateRef.current, nextState)
      || nowMs - lastUiUpdateAtRef.current >= uiIntervalMs
    ) {
      lastUiStateRef.current = nextState;
      lastUiUpdateAtRef.current = nowMs;
      onSimUpdate(nextState);
    }
  }, [onSimUpdate, sim]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 600, 750]} fov={60} near={0.1} far={10000} />
      <OrbitControls
        ref={controlsRef}
        enableDamping={false}
        rotateSpeed={0.3}
        zoomSpeed={0.45}
        panSpeed={0.3}
        minDistance={50}
        maxDistance={3000}
      />

      {cinematicSpotlightActive && (
        <fogExp2 attach="fog" args={[CINEMATIC_FOG_COLOR, CINEMATIC_FOG_DENSITY]} />
      )}
      <hemisphereLight args={[0xffffff, 0x444444, resolveCinematicLightIntensity(1.0, runtime.cinematicMode)]} />
      <ambientLight intensity={resolveCinematicLightIntensity(0.2, runtime.cinematicMode)} />
      <directionalLight
        castShadow
        position={[0, 50, 0]}
        intensity={resolveCinematicLightIntensity(1.5, runtime.cinematicMode)}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={1000}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
        shadow-camera-left={500}
        shadow-camera-right={-500}
        shadow-bias={-0.0004}
        shadow-radius={8}
      />
      {cinematicSpotlightTargets.map(target => (
        <pointLight
          key={target.id}
          color={target.color}
          intensity={target.intensity}
          distance={CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD}
          decay={CINEMATIC_EVENT_LIGHT_DECAY}
          position={[target.groundX, CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD, target.groundZ]}
        />
      ))}

      <Suspense fallback={null}>
        <NTPUScene />
      </Suspense>
      <Suspense fallback={null}>
        <UAV position={[0, 10, 0]} scale={10} />
      </Suspense>

      <GroundScene />
      <EarthFixedCells cells={paintedCells} showDebugLabels={runtime.beamDensity === 'all'} />
      <AmbientFootprintRings rings={viz.ambientRings} footprintRadiusWorld={viz.footprintRadiusWorld} />
      <HandoverLinks satellites={viz.displaySats} eventRoles={viz.eventRoles} satBeams={viz.satBeams} />
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
          recentHoActive={recentHoActive}
        />
      )}

      {viz.displaySats.map(sat => (
        <SatelliteMarker
          key={sat.id}
          position={sat.world}
          label={formatSatelliteLabel(sat.id)}
          eventRole={viz.eventRoles.get(sat.id)}
          satelliteTintColor={sat.satelliteTintColor}
        />
      ))}

      {SHOW_BEAMS && viz.displaySats
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
            cinematicMode={runtime.cinematicMode}
          />
        );
        })}
    </>
  );
}

interface MainSceneProps {
  speed: number;
  paused: boolean;
  profile: Profile;
  runtime: RuntimeConfig;
  onSimUpdate: (state: SimState) => void;
}

export const MainScene = memo(function MainScene({
  speed,
  paused,
  profile,
  runtime,
  onSimUpdate,
}: MainSceneProps) {
  return (
    <div className="leo-main-scene" data-testid="leo-main-scene" style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)',
      overflow: 'hidden',
    }}>
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
          <SceneContent
            profile={profile}
            speed={speed}
            paused={paused}
            runtime={runtime}
            onSimUpdate={onSimUpdate}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});

MainScene.displayName = 'MainScene';
