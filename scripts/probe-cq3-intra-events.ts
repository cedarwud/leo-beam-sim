/**
 * CQ3 empirical probe (throwaway, not a committed validator).
 * Measures intra/inter event counts in the live Walker handover index for the
 * candidate-rich profile with: (a) the current static primary UE, and (b) a
 * range of primary-UE drift waypoint configs. Answers the make-or-break
 * question: does the static UE already produce intra-HO, and does drift
 * increase/spread it?
 */
import { loadProfile } from '../src/profiles/index';
import type { Profile, UeMobilityWaypoint } from '../src/profiles/types';
import { buildLiveWalkerHandoverEventIndex } from '../src/scene/liveWalkerHandoverEventIndex';

const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const DURATION_SEC = 7200;
const EARTH_KM_PER_DEG = 111.32;

function circleWaypoints(
  observerLatDeg: number,
  observerLonDeg: number,
  radiusKm: number,
  periodSec: number,
  totalSec: number,
  stepSec: number,
): UeMobilityWaypoint[] {
  const cosLat = Math.cos((observerLatDeg * Math.PI) / 180);
  const lonKmPerDeg = EARTH_KM_PER_DEG * Math.max(Math.abs(cosLat), 1e-6);
  const points: UeMobilityWaypoint[] = [];
  for (let t = 0; t <= totalSec + 1e-6; t += stepSec) {
    const theta = (2 * Math.PI * t) / periodSec;
    const eastKm = radiusKm * Math.cos(theta) - radiusKm; // start at observer (theta=0 -> 0)
    const northKm = radiusKm * Math.sin(theta);
    points.push({
      timeSec: t,
      latDeg: observerLatDeg + northKm / EARTH_KM_PER_DEG,
      lonDeg: observerLonDeg + eastKm / lonKmPerDeg,
    });
  }
  return points;
}

function summarize(label: string, profile: Profile): void {
  const index = buildLiveWalkerHandoverEventIndex({
    profile,
    epochUtcMs: APP_EPOCH_MS,
    claimKind: 'profile-derived-forecast',
    ueDistributionMode: 'random',
    uePrimaryAnchorMode: 'observer',
    ueDistributionScope: 'beam-footprint',
    ueMobilityMode: 'static',
  });
  const intra = index.events.filter(e => e.kind === 'intra');
  const inter = index.events.filter(e => e.kind === 'inter');
  // bucket intra events into 600s windows to see temporal spread
  const buckets = new Map<number, number>();
  for (const e of intra) {
    const b = Math.floor(e.sourceTimeSec / 600);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const spread = [...buckets.keys()].length;
  const firstFew = intra.slice(0, 6).map(e => `${e.sourceTimeSec.toFixed(0)}s ${e.fromSatId}#${e.fromBeamId}->#${e.toBeamId}`);
  console.log(`\n=== ${label} ===`);
  console.log(`  events total=${index.events.length}  intra=${intra.length}  inter=${inter.length}`);
  console.log(`  intra spread across ${spread}/${Math.ceil(DURATION_SEC / 600)} 10-min buckets`);
  console.log(`  first intra: ${firstFew.join(' | ') || '(none)'}`);
}

const base = loadProfile('hobs-2024-candidate-rich');
const obsLat = base.orbit.observerLatDeg;
const obsLon = base.orbit.observerLonDeg;

summarize('STATIC (current)', base);

const configs: Array<{ r: number; p: number }> = [
  { r: 15, p: 300 },
  { r: 30, p: 600 },
  { r: 30, p: 1200 },
  { r: 50, p: 1200 },
  { r: 80, p: 1800 },
];
for (const { r, p } of configs) {
  const profile: Profile = {
    ...base,
    ueMobility: {
      type: 'waypoints',
      interpolation: 'linear',
      waypoints: circleWaypoints(obsLat, obsLon, r, p, DURATION_SEC, 10),
      generator: `probe circle r=${r}km period=${p}s`,
    },
  };
  summarize(`DRIFT circle r=${r}km period=${p}s`, profile);
}
