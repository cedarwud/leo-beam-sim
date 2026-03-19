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
import type { SatelliteSnapshot } from '../engine/signal/types';
import { computeLinkBudget } from '../engine/signal/link-budget';
import { HandoverManager } from '../engine/handover/handover-manager';
import type { Profile } from '../profiles/types';
import { computeBeamGeometry, generateBeamOffsetsKm } from './beam-layout';
import type { ReplayConfig, SimFrame, VisibleSat } from './types';

export const MIN_ELEVATION_DEG = 5;
export const CACHE_ELEVATION_DEG = 1;
export const SKY_DOME_H_RADIUS = 700;
export const SKY_DOME_V_RADIUS = 400;
export const SIM_DURATION_SEC = 3600;
export const SIM_STEP_SEC = 10;

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

function createEmptyFrame(simTimeSec: number): SimFrame {
  return {
    satellites: [],
    linkSamples: [],
    serving: { satId: null, beamId: null, sinrDb: -Infinity },
    hoCount: 0,
    lastHoReason: '',
    simTimeSec,
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

export function useSimulation(
  profile: Profile,
  replay: ReplayConfig,
  speed: number,
  paused: boolean,
): SimFrame {
  const observer = useMemo(
    () => createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg),
    [profile.orbit.observerLatDeg, profile.orbit.observerLonDeg],
  );

  const beamOffsetsByShellId = useMemo(() => {
    return new Map(
      profile.orbit.shells.map(shell => {
        const geometry = computeBeamGeometry(shell.altitudeKm, profile.antenna.beamwidth3dBRad);
        return [shell.id, generateBeamOffsetsKm(geometry.spacingKm, profile.beams.perSatellite)];
      }),
    );
  }, [profile.antenna.beamwidth3dBRad, profile.beams.perSatellite, profile.orbit.shells]);

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
  const renderAccRef = useRef(0);
  const recentHoRef = useRef<{ satId: string; expiresAtSec: number } | null>(null);
  const frameRef = useRef<SimFrame>(createEmptyFrame(simTimeRef.current));
  const [, setVersion] = useState(0);

  useEffect(() => {
    const startOffset = normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, replay.loop);
    simTimeRef.current = startOffset;
    renderAccRef.current = 0;
    recentHoRef.current = null;
    frameRef.current = createEmptyFrame(startOffset);
    setVersion(v => v + 1);
  }, [hoManager, maxTimeSec, replay.loop, replay.startOffsetSec]);

  useFrame((_, delta) => {
    if (trajectoryCache.length === 0) return;

    if (!paused) {
      simTimeRef.current += delta * speed;
      if (replay.loop) {
        simTimeRef.current = normalizeReplayOffset(simTimeRef.current, maxTimeSec, true);
      } else {
        simTimeRef.current = Math.min(simTimeRef.current, maxTimeSec);
      }
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
    const snapshots: SatelliteSnapshot[] = linkSats.map(sat => {
      const beamOffsets = beamOffsetsByShellId.get(sat.shellId) ?? [];
      const nadirEastKm = (sat.lonDeg - observer.lonDeg) * 111.32 * cosObsLat;
      const nadirNorthKm = (sat.latDeg - observer.latDeg) * 111.32;

      return {
        id: sat.id,
        shellId: sat.shellId,
        altitudeKm: sat.altitudeKm,
        ecefKm: [0, 0, 0],
        rangeKm: sat.topo.rangeKm,
        elevationDeg: sat.topo.elevationDeg,
        azimuthDeg: sat.topo.azimuthDeg,
        beamCellsKm: beamOffsets.map(beam => ({
          beamId: beam.beamId,
          offsetEastKm: nadirEastKm + beam.dEastKm,
          offsetNorthKm: nadirNorthKm + beam.dNorthKm,
        })),
      };
    });

    const ue = {
      latDeg: observer.latDeg,
      lonDeg: observer.lonDeg,
      offsetEastKm: 0,
      offsetNorthKm: 0,
    };
    const linkSamples = computeLinkBudget(ue, snapshots, {
      channel: profile.channel,
      antenna: profile.antenna,
      beams: profile.beams,
    });

    if (hoManager.state.satId && !linkSats.some(sat => sat.id === hoManager.state.satId)) {
      hoManager.state.satId = null;
      hoManager.state.beamId = null;
      hoManager.state.sinrDb = -Infinity;
      hoManager.state.triggerTimeSec = 0;
      hoManager.state.pendingTarget = null;
    }

    const previousServingSatId = hoManager.state.satId;
    const decision = hoManager.update(
      linkSamples,
      paused ? 0 : delta * speed,
      replay.epochUtcMs + simTimeRef.current * 1000,
    );

    if (
      decision.action === 'inter-handover' &&
      decision.target &&
      previousServingSatId !== null &&
      previousServingSatId !== decision.target.satId
    ) {
      recentHoRef.current = {
        satId: decision.target.satId,
        expiresAtSec: simTimeRef.current + 3,
      };
    }

    const recentHoTargetSatId =
      recentHoRef.current && recentHoRef.current.expiresAtSec > simTimeRef.current
        ? recentHoRef.current.satId
        : null;

    frameRef.current = {
      satellites: visibleSats,
      linkSamples,
      serving: {
        satId: hoManager.state.satId,
        beamId: hoManager.state.beamId,
        sinrDb: hoManager.state.sinrDb,
      },
      hoCount: hoManager.eventLog.length,
      lastHoReason: decision.reason,
      simTimeSec: simTimeRef.current,
      recentHoTargetSatId,
    };

    renderAccRef.current += delta;
    if (renderAccRef.current >= 0.25) {
      renderAccRef.current = 0;
      setVersion(v => v + 1);
    }
  });

  return frameRef.current;
}
