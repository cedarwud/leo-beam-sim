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
const RAMP_LEAD_SEC = 45;

function angularSeparationDeg(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

/**
 * Recommends a starting offset for the demo where satellite density is high.
 * Results are cached in localStorage to prevent blocking on page refreshes.
 */
export function recommendDemoReplayStartOffsetSec(
  profile: Profile,
  epochUtcMs: number,
): number {
  // 1. Highest priority: Manually locked value in Profile JSON
  if (profile.demoStartOffsetSec !== undefined) {
    console.log(`[Recommendation] Using hardcoded start offset from profile: ${profile.demoStartOffsetSec}s`);
    return profile.demoStartOffsetSec;
  }

  // 2. Second priority: Browser localStorage cache
  const configSignature = JSON.stringify(profile.orbit.shells).length;
  const cacheKey = `demo_start_${profile.id}_${epochUtcMs}_${configSignature}`;
  
  // Try to hit browser cache first
  const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
  if (cached) {
    console.log(`[Recommendation] Using cached start offset: ${cached}s`);
    return parseInt(cached, 10);
  }

  console.time('Recommendation Search');
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const elements = generateWalkerConstellation({
    shells: profile.orbit.shells,
    epochUtcMs,
  });

  // Performance optimization: sample satellites for recommendation logic
  const sampleElementStep = elements.length > 1000 ? Math.floor(elements.length / 800) : 1;
  const sampledElements = elements.filter((_, i) => i % sampleElementStep === 0);

  let bestScore = -Infinity;
  let bestStepSec = 0;

  for (let stepSec = 0; stepSec <= RECOMMEND_DURATION_SEC; stepSec += RECOMMEND_STEP_SEC) {
    const visible: { shellId: string; azimuthDeg: number; elevationDeg: number }[] = [];

    for (const element of sampledElements) {
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
    const centralVisible = visible.filter(sat => sat.elevationDeg >= 55);
    const zenithVisible = visible.filter(sat => sat.elevationDeg >= 75);

    const clusterCountScore = Math.pow(centralVisible.length, 2) * 50;
    const azimuthSectors = new Set(centralVisible.map(sat => Math.floor(sat.azimuthDeg / 45)));

    let score =
      clusterCountScore +
      zenithVisible.length * 1000 +
      centralVisible.length * 200 +
      azimuthSectors.size * 500;

    const distinctShells = new Set(centralVisible.map(s => s.shellId));
    score += distinctShells.size * 300;

    if (score > bestScore) {
      bestScore = score;
      bestStepSec = stepSec;
    }
  }

  const result = Math.max(bestStepSec - RAMP_LEAD_SEC, 0);
  if (typeof window !== 'undefined') {
    localStorage.setItem(cacheKey, result.toString());
  }
  console.timeEnd('Recommendation Search');
  return result;
}
