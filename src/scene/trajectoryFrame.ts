import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  propagateOrbitElement,
} from '../engine/orbit';
import type { Profile } from '../profiles/types';
import type { VisibleSat } from './types';
import {
  createInterpolatedTopo,
  createWorldPosition,
  interpolateAngleDeg,
  type CachedSatState,
} from './simulationHelpers';
import { SKY_DOME_H_RADIUS, SKY_DOME_V_RADIUS } from './sceneScale';

const SIM_DURATION_SEC = 7200;
const SIM_STEP_SEC = 20;
const CACHE_ELEVATION_DEG = 10;

export interface UeObserverPosition {
  latDeg: number;
  lonDeg: number;
}

// L5 (startup-perf SDD): `createTrajectoryCache` is a PURE, deterministic function
// of (shells, observer lat/lon, epoch). On a sinr-live load it is built at least
// twice with identical inputs — once for the live scene (`useSimulation`) and once
// for the offline cinema handover-index scan (`sinrLiveCellHandoverEventIndex`),
// ~0.9 s each. A single-entry module-level memo lets the second back-to-back build
// reuse the first. Returning the SAME array reference is safe because the cache is
// treated strictly read-only downstream: `interpolateVisibleSats` copies scalars
// and builds fresh `world`/`topo` objects per frame, and nothing mutates a
// `CachedSatState`. A different key recomputes (single entry → last key wins); the
// key encodes every input, so a stale/colliding hit is impossible — a miss only
// ever recomputes the identical deterministic result. The memo-bypassing
// `computeTrajectoryCache` stays exported for the bake (L2) and the determinism
// gate, which proves `memoized === fresh compute`.
let memoizedTrajectoryKey: string | null = null;
let memoizedTrajectoryCache: CachedSatState[][] | null = null;

function trajectoryCacheKey(
  profile: Profile,
  observer: ReturnType<typeof createObserverContext>,
  epochUtcMs: number,
): string {
  return JSON.stringify({
    shells: profile.orbit.shells,
    latDeg: observer.latDeg,
    lonDeg: observer.lonDeg,
    epochUtcMs,
  });
}

export function createTrajectoryCache(
  profile: Profile,
  observer: ReturnType<typeof createObserverContext>,
  epochUtcMs: number,
): CachedSatState[][] {
  const key = trajectoryCacheKey(profile, observer, epochUtcMs);
  if (key === memoizedTrajectoryKey && memoizedTrajectoryCache !== null) {
    return memoizedTrajectoryCache;
  }
  const cache = computeTrajectoryCache(profile, observer, epochUtcMs);
  memoizedTrajectoryKey = key;
  memoizedTrajectoryCache = cache;
  return cache;
}

// Memo-bypassing pure compute. Prefer `createTrajectoryCache` at runtime; use this
// only when a fresh, un-memoized cache is required (the L2 bake emitter and the L5
// determinism gate, which asserts memoized output equals a fresh compute).
export function computeTrajectoryCache(
  profile: Profile,
  observer: ReturnType<typeof createObserverContext>,
  epochUtcMs: number,
): CachedSatState[][] {
  const elements = generateWalkerConstellation({
    shells: profile.orbit.shells,
    epochUtcMs,
    observerLatDeg: observer.latDeg,
    observerLonDeg: observer.lonDeg,
  });
  const steps = Math.ceil(SIM_DURATION_SEC / SIM_STEP_SEC) + 1;
  const cache: CachedSatState[][] = new Array(steps);

  for (let step = 0; step < steps; step++) {
    const atUtcMs = epochUtcMs + step * SIM_STEP_SEC * 1000;
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
}

export function getTrajectoryMaxTimeSec(trajectoryCache: readonly CachedSatState[][]): number {
  return Math.max(0, trajectoryCache.length - 1) * SIM_STEP_SEC;
}

export function resolveWaypointObserver(
  mobility: Profile['ueMobility'],
  simTimeSec: number,
  observerLatDeg: number,
  observerLonDeg: number,
): UeObserverPosition {
  if (
    !mobility
    || mobility.type !== 'waypoints'
    || mobility.interpolation !== 'linear'
    || !Array.isArray(mobility.waypoints)
    || mobility.waypoints.length === 0
  ) {
    return { latDeg: observerLatDeg, lonDeg: observerLonDeg };
  }

  const waypoints = mobility.waypoints.filter(
    point => Number.isFinite(point.timeSec) && Number.isFinite(point.latDeg) && Number.isFinite(point.lonDeg),
  );
  if (waypoints.length === 0) return { latDeg: observerLatDeg, lonDeg: observerLonDeg };

  const first = waypoints[0];
  if (simTimeSec <= first.timeSec) {
    return { latDeg: first.latDeg, lonDeg: first.lonDeg };
  }

  const last = waypoints[waypoints.length - 1];
  if (simTimeSec >= last.timeSec) {
    return { latDeg: last.latDeg, lonDeg: last.lonDeg };
  }

  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1];
    const next = waypoints[index];
    const durationSec = next.timeSec - previous.timeSec;
    if (durationSec <= 0) continue;
    if (simTimeSec <= next.timeSec) {
      const t = (simTimeSec - previous.timeSec) / durationSec;
      return {
        latDeg: previous.latDeg + (next.latDeg - previous.latDeg) * t,
        lonDeg: previous.lonDeg + (next.lonDeg - previous.lonDeg) * t,
      };
    }
  }

  return { latDeg: last.latDeg, lonDeg: last.lonDeg };
}

export function interpolateVisibleSats(
  trajectoryCache: readonly CachedSatState[][],
  simTimeSec: number,
  loop: boolean,
): VisibleSat[] {
  const rawStep = simTimeSec / SIM_STEP_SEC;
  const stepIndex = Math.floor(rawStep);
  const maxStep = trajectoryCache.length - 1;
  const t = rawStep - stepIndex;
  const stepA = loop ? stepIndex % trajectoryCache.length : Math.min(stepIndex, maxStep);
  const stepB = loop
    ? (stepA + 1) % trajectoryCache.length
    : Math.min(stepA + 1, maxStep);

  const cacheA = trajectoryCache[stepA];
  const cacheB = trajectoryCache[stepB];
  const cacheAMap = new Map(cacheA.map(sat => [sat.id, sat]));
  const cacheBMap = new Map(cacheB.map(sat => [sat.id, sat]));
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
      world: createWorldPosition(azimuthDeg, elevationDeg, SKY_DOME_H_RADIUS, SKY_DOME_V_RADIUS),
      topo: createInterpolatedTopo(azimuthDeg, elevationDeg, rangeKm),
      latDeg,
      lonDeg,
    });
  }

  return visibleSats;
}
