import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  propagateOrbitElement,
} from '../engine/orbit';
import type { Profile } from '../profiles/types';

const RECOMMEND_DURATION_SEC = 3600;
const RECOMMEND_STEP_SEC = 10;
const HIGH_ELEVATION_DEG = 45;
const CENTRAL_ELEVATION_DEG = 60;
const ZENITH_ELEVATION_DEG = 75;
const RAMP_LEAD_SEC = 45;
const AZIMUTH_SECTOR_DEG = 45;
const MIN_DIRECTION_SECTORS = 2;

function angularSeparationDeg(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

export function recommendDemoReplayStartOffsetSec(
  profile: Profile,
  epochUtcMs: number,
): number {
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const elements = generateWalkerConstellation({
    shells: profile.orbit.shells,
    epochUtcMs,
  });

  let bestScore = -Infinity;
  let bestStepSec = 0;

  for (let stepSec = 0; stepSec <= RECOMMEND_DURATION_SEC; stepSec += RECOMMEND_STEP_SEC) {
    const visible: { shellId: string; azimuthDeg: number; elevationDeg: number }[] = [];

    for (const element of elements) {
      const orbitPoint = propagateOrbitElement(element, epochUtcMs + stepSec * 1000);
      const topo = computeTopocentricPoint(observer, orbitPoint.ecefKm);
      if (topo.elevationDeg < HIGH_ELEVATION_DEG) continue;

      visible.push({
        shellId: element.shellId,
        azimuthDeg: topo.azimuthDeg,
        elevationDeg: topo.elevationDeg,
      });
    }

    if (visible.length === 0) continue;

    visible.sort((a, b) => b.elevationDeg - a.elevationDeg);

    const centralVisible = visible.filter(sat => sat.elevationDeg >= CENTRAL_ELEVATION_DEG);
    const zenithVisible = visible.filter(sat => sat.elevationDeg >= ZENITH_ELEVATION_DEG);
    const topDistinctShells: typeof centralVisible = [];
    const seenShells = new Set<string>();
    for (const sat of centralVisible) {
      if (seenShells.has(sat.shellId)) continue;
      topDistinctShells.push(sat);
      seenShells.add(sat.shellId);
      if (topDistinctShells.length >= 3) break;
    }

    const azimuthSectors = new Set(
      centralVisible
        .slice(0, 6)
        .map(sat => Math.floor(sat.azimuthDeg / AZIMUTH_SECTOR_DEG)),
    );

    let score =
      zenithVisible.length * 160 +
      centralVisible.length * 70 +
      Math.min(visible.length, 6) * 10 +
      topDistinctShells.reduce((sum, sat) => sum + sat.elevationDeg * 1.5, 0) +
      seenShells.size * 60 +
      Math.min(azimuthSectors.size, 4) * 20;

    for (let i = 0; i < topDistinctShells.length; i++) {
      for (let j = i + 1; j < topDistinctShells.length; j++) {
        const separation = angularSeparationDeg(
          topDistinctShells[i].azimuthDeg,
          topDistinctShells[j].azimuthDeg,
        );
        score += Math.min(separation, 90) / 8;
        if (separation < 12) score -= 8;
      }
    }

    if (centralVisible.length === 0) score -= 200;
    if (zenithVisible.length === 0) score -= 60;
    if (azimuthSectors.size < MIN_DIRECTION_SECTORS) score -= 180;
    if (azimuthSectors.size < 3) score -= 40;

    if (score > bestScore) {
      bestScore = score;
      bestStepSec = stepSec;
    }
  }

  return Math.max(bestStepSec - RAMP_LEAD_SEC, 0);
}
