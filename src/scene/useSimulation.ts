import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TopocentricPoint } from '../engine/orbit';
import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  propagateOrbitElement,
} from '../engine/orbit';
import type { ActiveBeamAssignment, LinkSample, SatelliteSnapshot } from '../engine/signal/types';
import { computeLinkBudget } from '../engine/signal/link-budget';
import {
  buildBeamPowerOverrideDbmByKey,
  type BeamPowerControlState,
  updateBeamPowerControlStates,
} from '../engine/signal/power-control';
import { computeTr38811SlantRangeKm } from '../engine/signal/slant-range';
import { HandoverManager } from '../engine/handover/handover-manager';
import type { ServingState } from '../engine/handover/types';
import type { Profile } from '../profiles/types';
import { computeBeamGeometry, generateBeamOffsetsKm } from './beam-layout';
import { scheduleBeamCells, type CandidateBeamCell } from './beam-scheduler';
import type {
  BeamCellState,
  ReplayConfig,
  SatBeamHopState,
  SimFrame,
  VisibleSat,
} from './types';

export const MIN_ELEVATION_DEG = 15;
export const CACHE_ELEVATION_DEG = 10;
export const SKY_DOME_H_RADIUS = 700;
export const SKY_DOME_V_RADIUS = 400;
export const SIM_DURATION_SEC = 1200;
export const SIM_STEP_SEC = 20;
const MAX_STEERING_EXTRA_RINGS = 3;
const RECENT_HO_LINGER_SEC = 2;

interface ShellBeamLayout {
  footprintRadiusKm: number;
  spacingKm: number;
  maxOffsetRadiusKm: number;
  maxSteeringDistanceKm: number;
  maxCoverageRadiusKm: number;
  offsets: ReturnType<typeof generateBeamOffsetsKm>;
}

interface CachedSatState {
  id: string;
  shellId: string;
  altitudeKm: number;
  latDeg: number;
  lonDeg: number;
  ecefKm: [number, number, number];
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
}

interface LatticeSteeringSolution {
  steeringEastKm: number;
  steeringNorthKm: number;
}

interface BeamPowerControlRuntime {
  statesByKey: Map<string, BeamPowerControlState>;
  lastBucketIndex: number | null;
  lastBucketSamples: LinkSample[];
}

function createEmptyBeamPowerControlRuntime(): BeamPowerControlRuntime {
  return {
    statesByKey: new Map(),
    lastBucketIndex: null,
    lastBucketSamples: [],
  };
}

function createEmptyFrame(simTimeSec: number): SimFrame {
  return {
    satellites: [],
    linkSamples: [],
    activeAssignments: [],
    displayAssignments: [],
    beamCellsBySatId: new Map(),
    steeringBeamCellsBySatId: new Map(),
    linkRangeKmBySatId: new Map(),
    beamHopSlotIndex: -1,
    beamHopSlotStartSec: 0,
    beamHopSlotSec: 0,
    beamHopEnabled: false,
    beamHopStatesBySatId: new Map(),
    serving: { satId: null, beamId: null, sinrDb: -Infinity },
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoSourceSinrDb: null,
    recentHoTargetSinrDb: null,
    recentHoDeltaDb: null,
    handoverTriggerProgressSec: 0,
    hoCount: 0,
    lastHoReason: '',
    simTimeSec,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
  };
}

function normalizeReplayOffset(
  startOffsetSec: number,
  maxTimeSec: number,
  loop: boolean,
): number {
  if (maxTimeSec <= 0) return 0;
  if (!loop) return Math.min(Math.max(startOffsetSec, 0), maxTimeSec);
  const wrapped = startOffsetSec % maxTimeSec;
  return wrapped >= 0 ? wrapped : wrapped + maxTimeSec;
}

function interpolateAngleDeg(a: number, b: number, t: number): number {
  let delta = b - a;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return a + delta * t;
}

function createWorldPosition(azimuthDeg: number, elevationDeg: number): THREE.Vector3 {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;
  const horiz = SKY_DOME_H_RADIUS * Math.cos(elRad);

  return new THREE.Vector3(
    horiz * Math.sin(azRad),
    SKY_DOME_V_RADIUS * Math.sin(elRad),
    -horiz * Math.cos(azRad),
  );
}

function createInterpolatedTopo(
  azimuthDeg: number,
  elevationDeg: number,
  rangeKm: number,
): TopocentricPoint {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;
  const cosEl = Math.cos(elRad);

  return {
    eastKm: rangeKm * cosEl * Math.sin(azRad),
    northKm: rangeKm * cosEl * Math.cos(azRad),
    upKm: rangeKm * Math.sin(elRad),
    rangeKm,
    azimuthDeg,
    elevationDeg,
  };
}

function beamAssignmentKey(satId: string, beamId: number): string {
  return `${satId}:${beamId}`;
}

function resolveLatticeSteering(
  nadirEastKm: number,
  nadirNorthKm: number,
  layout: ShellBeamLayout,
): LatticeSteeringSolution {
  let bestTargetEastKm = -nadirEastKm;
  let bestTargetNorthKm = -nadirNorthKm;
  let bestTargetDistanceKm = Math.hypot(bestTargetEastKm, bestTargetNorthKm);

  for (const beam of layout.offsets) {
    const targetEastKm = -(nadirEastKm + beam.dEastKm);
    const targetNorthKm = -(nadirNorthKm + beam.dNorthKm);
    const targetDistanceKm = Math.hypot(targetEastKm, targetNorthKm);

    if (targetDistanceKm < bestTargetDistanceKm) {
      bestTargetEastKm = targetEastKm;
      bestTargetNorthKm = targetNorthKm;
      bestTargetDistanceKm = targetDistanceKm;
    }
  }

  if (bestTargetDistanceKm <= 1e-6) {
    return { steeringEastKm: 0, steeringNorthKm: 0 };
  }

  const steeringScale = Math.min(layout.maxSteeringDistanceKm, bestTargetDistanceKm) / bestTargetDistanceKm;
  return {
    steeringEastKm: bestTargetEastKm * steeringScale,
    steeringNorthKm: bestTargetNorthKm * steeringScale,
  };
}

export function useSimulation(
  profile: Profile,
  replay: ReplayConfig,
  speed: number,
  paused: boolean,
  signalResetKey?: string,
): SimFrame {
  const observer = useMemo(
    () => createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg),
    [profile.orbit.observerLatDeg, profile.orbit.observerLonDeg],
  );

  const beamLayoutsByShellId = useMemo(() => {
    return new Map(
      profile.orbit.shells.map(shell => {
        const geometry = computeBeamGeometry(shell.altitudeKm, profile.antenna.beamwidth3dBRad);
        const offsets = generateBeamOffsetsKm(geometry.spacingKm, profile.beams.perSatellite);
        const maxOffsetRadiusKm = offsets.reduce(
          (maxRadius, beam) => Math.max(maxRadius, Math.hypot(beam.dEastKm, beam.dNorthKm)),
          0,
        );
        const geometryLimitedSteeringKm = maxOffsetRadiusKm + geometry.spacingKm * MAX_STEERING_EXTRA_RINGS;
        const steeringAngleRad = (profile.antenna.maxSteeringAngleDeg * Math.PI) / 180;
        const angleLimitedSteeringKm = shell.altitudeKm * Math.tan(steeringAngleRad);
        const maxSteeringDistanceKm = Math.min(geometryLimitedSteeringKm, angleLimitedSteeringKm);
        return [shell.id, {
          footprintRadiusKm: geometry.footprintRadiusKm,
          spacingKm: geometry.spacingKm,
          maxOffsetRadiusKm,
          maxSteeringDistanceKm,
          maxCoverageRadiusKm: maxOffsetRadiusKm + maxSteeringDistanceKm + geometry.footprintRadiusKm,
          offsets,
        } satisfies ShellBeamLayout];
      }),
    );
  }, [
    profile.antenna.beamwidth3dBRad,
    profile.antenna.maxSteeringAngleDeg,
    profile.beams.perSatellite,
    profile.orbit.shells,
  ]);

  const trajectoryCache = useMemo(() => {
    const elements = generateWalkerConstellation({
      shells: profile.orbit.shells,
      epochUtcMs: replay.epochUtcMs,
    });
    const steps = Math.ceil(SIM_DURATION_SEC / SIM_STEP_SEC) + 1;
    const cache: CachedSatState[][] = new Array(steps);

    for (let step = 0; step < steps; step++) {
      const atUtcMs = replay.epochUtcMs + step * SIM_STEP_SEC * 1000;
      const visible: CachedSatState[] = [];

      for (const element of elements) {
        const orbitPoint = propagateOrbitElement(element, atUtcMs);
        const topo = computeTopocentricPoint(observer, orbitPoint.ecefKm);
        if (topo.elevationDeg < CACHE_ELEVATION_DEG) continue;

        visible.push({
          id: element.id,
          shellId: element.shellId,
          altitudeKm: orbitPoint.altKm,
          latDeg: orbitPoint.latDeg,
          lonDeg: orbitPoint.lonDeg,
          ecefKm: orbitPoint.ecefKm,
          elevationDeg: topo.elevationDeg,
          azimuthDeg: topo.azimuthDeg,
          rangeKm: topo.rangeKm,
        });
      }

      cache[step] = visible;
    }

    return cache;
  }, [observer, profile.orbit.shells, replay.epochUtcMs]);

  const hoManager = useMemo(() => new HandoverManager(profile.handover), [profile.handover]);
  const maxTimeSec = (trajectoryCache.length - 1) * SIM_STEP_SEC;
  const simTimeRef = useRef(normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, replay.loop));
  const recentHoRef = useRef<{
    sourceSatId: string;
    sourceBeamId: number;
    sourceSinrDb: number | null;
    targetSatId: string;
    targetBeamId: number;
    targetSinrDb: number;
    deltaDb: number | null;
    expiresAtSec: number;
  } | null>(null);
  const frameRef = useRef<SimFrame>(createEmptyFrame(simTimeRef.current));
  const beamPowerControlRef = useRef<BeamPowerControlRuntime>(createEmptyBeamPowerControlRuntime());
  const publishNextFrameRef = useRef(true);
  const [, setVersion] = useState(0);

  useEffect(() => {
    const startOffset = normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, replay.loop);
    hoManager.reset();
    simTimeRef.current = startOffset;
    recentHoRef.current = null;
    frameRef.current = createEmptyFrame(startOffset);
    beamPowerControlRef.current = createEmptyBeamPowerControlRuntime();
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [hoManager, maxTimeSec, profile.id, replay.epochUtcMs, replay.loop, replay.startOffsetSec]);

  useEffect(() => {
    hoManager.reset();
    recentHoRef.current = null;
    frameRef.current = createEmptyFrame(simTimeRef.current);
    beamPowerControlRef.current = createEmptyBeamPowerControlRuntime();
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [hoManager, signalResetKey]);

  useEffect(() => {
    // Profile-backed SINR controls must refresh the React UI even when simulation time is paused.
    publishNextFrameRef.current = true;
  }, [profile]);

  useFrame((_, delta) => {
    if (trajectoryCache.length === 0) return;
    const previousSimTimeSec = simTimeRef.current;

    if (!paused) {
      simTimeRef.current += delta * speed;
      if (replay.loop) {
        simTimeRef.current = normalizeReplayOffset(simTimeRef.current, maxTimeSec, true);
      } else {
        simTimeRef.current = Math.min(simTimeRef.current, maxTimeSec);
      }
    }
    const didLoopWrap = replay.loop && simTimeRef.current < previousSimTimeSec;
    if (didLoopWrap) {
      hoManager.reset();
      recentHoRef.current = null;
      beamPowerControlRef.current = createEmptyBeamPowerControlRuntime();
    }

    const rawStep = simTimeRef.current / SIM_STEP_SEC;
    const stepIndex = Math.floor(rawStep);
    const maxStep = trajectoryCache.length - 1;
    const t = rawStep - stepIndex;
    const stepA = replay.loop ? stepIndex % trajectoryCache.length : Math.min(stepIndex, maxStep);
    const stepB = replay.loop
      ? (stepA + 1) % trajectoryCache.length
      : Math.min(stepA + 1, maxStep);

    const cacheA = trajectoryCache[stepA];
    const cacheB = trajectoryCache[stepB];
    const cacheAMap = new Map(cacheA.map(s => [s.id, s]));
    const cacheBMap = new Map(cacheB.map(s => [s.id, s]));
    const satIds = new Set<string>([...cacheAMap.keys(), ...cacheBMap.keys()]);
    const currentRecentHo =
      recentHoRef.current && recentHoRef.current.expiresAtSec > simTimeRef.current
        ? recentHoRef.current
        : null;

    const visibleSats: VisibleSat[] = [];
    for (const satId of satIds) {
      const satA = cacheAMap.get(satId);
      const satB = cacheBMap.get(satId);
      const current = satA ?? satB;
      const next = satB ?? satA;

      if (!current || !next) continue;

      const elevationDeg = satA && satB
        ? satA.elevationDeg + (satB.elevationDeg - satA.elevationDeg) * t
        : current.elevationDeg;
      const azimuthDeg = satA && satB
        ? interpolateAngleDeg(satA.azimuthDeg, satB.azimuthDeg, t)
        : current.azimuthDeg;
      const rangeKm = satA && satB
        ? satA.rangeKm + (satB.rangeKm - satA.rangeKm) * t
        : current.rangeKm;
      const latDeg = satA && satB
        ? satA.latDeg + (satB.latDeg - satA.latDeg) * t
        : current.latDeg;
      const lonDeg = satA && satB
        ? interpolateAngleDeg(satA.lonDeg, satB.lonDeg, t)
        : current.lonDeg;

      visibleSats.push({
        id: current.id,
        shellId: current.shellId,
        altitudeKm: current.altitudeKm,
        world: createWorldPosition(azimuthDeg, elevationDeg),
        topo: createInterpolatedTopo(azimuthDeg, elevationDeg, rangeKm),
        latDeg,
        lonDeg,
      });
    }

    const cosObsLat = Math.cos((observer.latDeg * Math.PI) / 180);
    const linkSats = visibleSats.filter(s => s.topo.elevationDeg >= MIN_ELEVATION_DEG);
    const beamHopEnabled = profile.beamHopping.enabled;
    const beamPowerControl = profile.channel.beamPowerControl;
    const usesBeamPowerControl =
      profile.formulaFamily === 'hobs-tr38811'
      && beamPowerControl !== undefined;
    const beamHopSlotSec = beamHopEnabled ? Math.max(profile.beamHopping.slotSec, 1e-6) : 0;
    const beamHopSlotIndex = beamHopEnabled ? Math.floor(simTimeRef.current / beamHopSlotSec) : -1;
    const beamHopSlotStartSec = beamHopEnabled && beamHopSlotIndex >= 0
      ? beamHopSlotIndex * beamHopSlotSec
      : 0;
    if (usesBeamPowerControl && beamPowerControl) {
      const bucketIndex = Math.floor(
        simTimeRef.current / Math.max(beamPowerControl.updatePeriodSec, 1e-6),
      );

      if (beamPowerControlRef.current.lastBucketIndex === null) {
        beamPowerControlRef.current.lastBucketIndex = bucketIndex;
      } else if (bucketIndex !== beamPowerControlRef.current.lastBucketIndex) {
        beamPowerControlRef.current = {
          statesByKey: updateBeamPowerControlStates(
            beamPowerControlRef.current.lastBucketSamples,
            beamPowerControlRef.current.statesByKey,
            beamPowerControl,
            profile.channel,
          ),
          lastBucketIndex: bucketIndex,
          lastBucketSamples: beamPowerControlRef.current.lastBucketSamples,
        };
      }
    }
    const beamPowerOverrideDbmByKey = usesBeamPowerControl
      ? buildBeamPowerOverrideDbmByKey(beamPowerControlRef.current.statesByKey)
      : undefined;
    const pushUniqueAssignment = (
      assignments: ActiveBeamAssignment[],
      satId: string | null,
      beamId: number | null,
      availableBeamAssignments: Set<string>,
    ) => {
      if (!satId || beamId === null) return;
      const key = beamAssignmentKey(satId, beamId);
      if (!availableBeamAssignments.has(key)) return;
      if (assignments.some(assignment => assignment.satId === satId && assignment.beamId === beamId)) return;
      assignments.push({ satId, beamId });
    };

    const buildLinkContext = (
      state: Pick<ServingState, 'satId' | 'beamId' | 'pendingTarget'>,
      recentHo: typeof currentRecentHo,
    ) => {
      const snapshots: SatelliteSnapshot[] = [];
      const beamHopStatesBySatId = new Map<string, SatBeamHopState>();
      const steeringBeamCellsBySatId = new Map<string, BeamCellState[]>();

      for (const sat of linkSats) {
        const layout = beamLayoutsByShellId.get(sat.shellId);
        if (!layout) continue;

        const nadirEastKm = (sat.lonDeg - observer.lonDeg) * 111.32 * cosObsLat;
        const nadirNorthKm = (sat.latDeg - observer.latDeg) * 111.32;
        const nadirDistanceKm = Math.hypot(nadirEastKm, nadirNorthKm);
        // Keep beam IDs tied to fixed lattice cells instead of always centering Beam 1 on the UE.
        const { steeringEastKm, steeringNorthKm } = resolveLatticeSteering(
          nadirEastKm,
          nadirNorthKm,
          layout,
        );

        const requiredBeamIds = new Set<number>();
        if (state.satId === sat.id && state.beamId !== null) {
          requiredBeamIds.add(state.beamId);
        }
        if (state.pendingTarget?.satId === sat.id) {
          requiredBeamIds.add(state.pendingTarget.beamId);
        }
        if (recentHo?.sourceSatId === sat.id) {
          requiredBeamIds.add(recentHo.sourceBeamId);
        }
        if (recentHo?.targetSatId === sat.id) {
          requiredBeamIds.add(recentHo.targetBeamId);
        }

        const allBeamCells = layout.offsets
          .map(beam => {
            const scanOffsetEastKm = steeringEastKm + beam.dEastKm;
            const scanOffsetNorthKm = steeringNorthKm + beam.dNorthKm;
            const scanDistanceKm = Math.hypot(scanOffsetEastKm, scanOffsetNorthKm);
            const offsetEastKm = nadirEastKm + steeringEastKm + beam.dEastKm;
            const offsetNorthKm = nadirNorthKm + steeringNorthKm + beam.dNorthKm;
            return {
              beamId: beam.beamId,
              offsetEastKm,
              offsetNorthKm,
              scanAngleDeg: (Math.atan(scanDistanceKm / Math.max(sat.altitudeKm, 1e-6)) * 180) / Math.PI,
              distanceToUeKm: Math.hypot(offsetEastKm, offsetNorthKm),
            } satisfies CandidateBeamCell;
          })
          .filter(beam => beam.scanAngleDeg <= profile.antenna.maxSteeringAngleDeg + 1e-6);
        const beamCellById = new Map(allBeamCells.map(beam => [beam.beamId, beam]));
        const candidateBeamCells = allBeamCells
          .filter(beam => beam.distanceToUeKm <= layout.maxOffsetRadiusKm + layout.footprintRadiusKm * 1.5)
          .sort((a, b) => a.distanceToUeKm - b.distanceToUeKm);
        const requiredBeamCells = [...requiredBeamIds]
          .map(beamId => beamCellById.get(beamId))
          .filter((beam): beam is CandidateBeamCell => beam !== undefined);

        if (nadirDistanceKm > layout.maxCoverageRadiusKm && requiredBeamIds.size === 0) {
          continue;
        }

        steeringBeamCellsBySatId.set(
          sat.id,
          allBeamCells.map(beam => ({
            beamId: beam.beamId,
            offsetEastKm: beam.offsetEastKm,
            offsetNorthKm: beam.offsetNorthKm,
            scanAngleDeg: beam.scanAngleDeg,
          })),
        );

        let activeBeamCells: BeamCellState[] = [];
        let activeBeamIds: number[] = [];
        let candidateBeamIds = candidateBeamCells.map(beam => beam.beamId);
        let frameSlotIndex = -1;
        const isProtectedBeamSat = state.satId === sat.id || state.pendingTarget?.satId === sat.id;
        const protectedMinimumActiveBeamCount = isProtectedBeamSat
          ? profile.beamHopping.maxActiveBeamsPerSlot
          : 1;

        if (beamHopEnabled) {
          const scheduled = scheduleBeamCells(
            candidateBeamCells,
            requiredBeamCells,
            sat.id,
            beamHopSlotIndex,
            profile.beamHopping,
            {
              minimumActiveBeamCount: protectedMinimumActiveBeamCount,
              fallbackBeamCells: allBeamCells,
            },
          );
          activeBeamCells = scheduled.activeBeamCells;
          activeBeamIds = scheduled.activeBeamIds;
          candidateBeamIds = scheduled.candidateBeamIds;
          frameSlotIndex = scheduled.frameSlotIndex;
        } else {
          const selectedBeamCells = new Map<number, BeamCellState>();

          for (const requiredBeamId of requiredBeamIds) {
            const beam = beamCellById.get(requiredBeamId);
            if (!beam) continue;
            selectedBeamCells.set(beam.beamId, {
              beamId: beam.beamId,
              offsetEastKm: beam.offsetEastKm,
              offsetNorthKm: beam.offsetNorthKm,
              scanAngleDeg: beam.scanAngleDeg,
            });
          }

          for (const beam of candidateBeamCells) {
            if (selectedBeamCells.size >= profile.beams.maxActivePerSat) break;
            if (selectedBeamCells.has(beam.beamId)) continue;
            selectedBeamCells.set(beam.beamId, {
              beamId: beam.beamId,
              offsetEastKm: beam.offsetEastKm,
              offsetNorthKm: beam.offsetNorthKm,
              scanAngleDeg: beam.scanAngleDeg,
            });
          }

          activeBeamCells = [...selectedBeamCells.values()];
          activeBeamIds = activeBeamCells.map(beam => beam.beamId);
        }

        if (activeBeamCells.length === 0) continue;

        beamHopStatesBySatId.set(sat.id, {
          satId: sat.id,
          slotIndex: beamHopSlotIndex,
          frameSlotIndex,
          activeBeamIds,
          candidateBeamIds,
        });

        const linkRangeKm = profile.formulaFamily === 'hobs-tr38811'
          ? computeTr38811SlantRangeKm(sat.topo.elevationDeg, sat.altitudeKm)
          : sat.topo.rangeKm;

        snapshots.push({
          id: sat.id,
          shellId: sat.shellId,
          altitudeKm: sat.altitudeKm,
          ecefKm: [0, 0, 0] as [number, number, number],
          rangeKm: linkRangeKm,
          elevationDeg: sat.topo.elevationDeg,
          azimuthDeg: sat.topo.azimuthDeg,
          beamCellsKm: activeBeamCells,
        });
      }

      const ue = {
        latDeg: observer.latDeg,
        lonDeg: observer.lonDeg,
        offsetEastKm: 0,
        offsetNorthKm: 0,
      };
      const availableBeamAssignments = new Set(
        snapshots.flatMap(satellite =>
          satellite.beamCellsKm.map(beam => beamAssignmentKey(satellite.id, beam.beamId)),
        ),
      );
      const trackedAssignments: ActiveBeamAssignment[] = [];
      pushUniqueAssignment(trackedAssignments, state.satId, state.beamId, availableBeamAssignments);
      pushUniqueAssignment(
        trackedAssignments,
        state.pendingTarget?.satId ?? null,
        state.pendingTarget?.beamId ?? null,
        availableBeamAssignments,
      );
      const scheduledAssignments = snapshots.flatMap(satellite =>
        satellite.beamCellsKm.map(beam => ({ satId: satellite.id, beamId: beam.beamId })),
      );
      const activeAssignments = beamHopEnabled ? scheduledAssignments : trackedAssignments;
      const beamCellsBySatId = new Map(
        snapshots.map(satellite => [satellite.id, satellite.beamCellsKm]),
      );
      const linkRangeKmBySatId = new Map(
        snapshots.map(satellite => [satellite.id, satellite.rangeKm]),
      );
      const linkSamples = computeLinkBudget(ue, snapshots, {
        formulaFamily: profile.formulaFamily,
        channel: profile.channel,
        antenna: profile.antenna,
        ueAntenna: profile.ueAntenna,
        beams: profile.beams,
        activeAssignments,
        simTimeSec: simTimeRef.current,
        beamPowerOverrideDbmByKey,
      });

      return {
        linkSamples,
        beamCellsBySatId,
        steeringBeamCellsBySatId,
        linkRangeKmBySatId,
        beamHopStatesBySatId,
        availableBeamAssignments,
        activeAssignments,
        trackedAssignments,
      };
    };

    const preDecisionContext = buildLinkContext(hoManager.state, currentRecentHo);

    if (hoManager.state.satId && !linkSats.some(sat => sat.id === hoManager.state.satId)) {
      hoManager.clearServing();
    }

    const previousServingSatId = hoManager.state.satId;
    const decision = hoManager.update(
      preDecisionContext.linkSamples,
      paused ? 0 : delta * speed,
      replay.epochUtcMs + simTimeRef.current * 1000,
    );
    const lastEvent = hoManager.eventLog[hoManager.eventLog.length - 1];

    if (
      decision.action === 'inter-handover' &&
      decision.target &&
      previousServingSatId !== null &&
      lastEvent?.fromBeamId !== null &&
      previousServingSatId !== decision.target.satId
    ) {
      recentHoRef.current = {
        sourceSatId: previousServingSatId,
        sourceBeamId: lastEvent!.fromBeamId!,
        sourceSinrDb: lastEvent?.fromSinrDb ?? null,
        targetSatId: decision.target.satId,
        targetBeamId: decision.target.beamId,
        targetSinrDb: lastEvent?.toSinrDb ?? hoManager.state.sinrDb,
        deltaDb: lastEvent?.deltaDb ?? null,
        expiresAtSec: simTimeRef.current + RECENT_HO_LINGER_SEC,
      };
    }

    const recentHoSourceSatId =
      recentHoRef.current && recentHoRef.current.expiresAtSec > simTimeRef.current
        ? recentHoRef.current.sourceSatId
        : null;
    const recentHoTargetSatId =
      recentHoRef.current && recentHoRef.current.expiresAtSec > simTimeRef.current
        ? recentHoRef.current.targetSatId
        : null;

    const postDecisionRecentHo =
      recentHoRef.current && recentHoRef.current.expiresAtSec > simTimeRef.current
        ? recentHoRef.current
        : null;
    const postDecisionContext = buildLinkContext(hoManager.state, postDecisionRecentHo);
    if (usesBeamPowerControl) {
      beamPowerControlRef.current.lastBucketSamples = postDecisionContext.linkSamples;
    }
    const pendingTargetSinrDb = hoManager.getTrackedSinrDb(
      hoManager.state.pendingTarget?.satId ?? null,
      hoManager.state.pendingTarget?.beamId ?? null,
    );

    const frameActiveAssignments: ActiveBeamAssignment[] = [...postDecisionContext.activeAssignments];
    const displayAssignments = [...postDecisionContext.trackedAssignments];
    pushUniqueAssignment(
      displayAssignments,
      recentHoSourceSatId,
      recentHoSourceSatId ? recentHoRef.current?.sourceBeamId ?? null : null,
      postDecisionContext.availableBeamAssignments,
    );
    pushUniqueAssignment(
      displayAssignments,
      recentHoTargetSatId,
      recentHoTargetSatId ? recentHoRef.current?.targetBeamId ?? null : null,
      postDecisionContext.availableBeamAssignments,
    );

    frameRef.current = {
      satellites: visibleSats,
      linkSamples: postDecisionContext.linkSamples,
      activeAssignments: frameActiveAssignments,
      displayAssignments,
      beamCellsBySatId: postDecisionContext.beamCellsBySatId,
      steeringBeamCellsBySatId: postDecisionContext.steeringBeamCellsBySatId,
      linkRangeKmBySatId: postDecisionContext.linkRangeKmBySatId,
      beamHopSlotIndex,
      beamHopSlotStartSec,
      beamHopSlotSec,
      beamHopEnabled,
      beamHopStatesBySatId: postDecisionContext.beamHopStatesBySatId,
      serving: {
        satId: hoManager.state.satId,
        beamId: hoManager.state.beamId,
        sinrDb: hoManager.state.sinrDb,
      },
      pendingTargetSatId: hoManager.state.pendingTarget?.satId ?? null,
      pendingTargetBeamId: hoManager.state.pendingTarget?.beamId ?? null,
      pendingTargetSinrDb,
      recentHoSourceBeamId: recentHoSourceSatId ? recentHoRef.current?.sourceBeamId ?? null : null,
      recentHoTargetBeamId: recentHoTargetSatId ? recentHoRef.current?.targetBeamId ?? null : null,
      recentHoSourceSinrDb: recentHoSourceSatId ? recentHoRef.current?.sourceSinrDb ?? null : null,
      recentHoTargetSinrDb: recentHoTargetSatId ? recentHoRef.current?.targetSinrDb ?? null : null,
      recentHoDeltaDb: recentHoRef.current?.deltaDb ?? null,
      handoverTriggerProgressSec: hoManager.state.pendingTarget ? hoManager.state.triggerTimeSec : 0,
      hoCount: hoManager.eventLog.length,
      lastHoReason: decision.reason,
      simTimeSec: simTimeRef.current,
      recentHoSourceSatId,
      recentHoTargetSatId,
    };

    if (simTimeRef.current !== previousSimTimeSec || publishNextFrameRef.current) {
      publishNextFrameRef.current = false;
      setVersion(v => v + 1);
    }
  });

  return frameRef.current;
}
