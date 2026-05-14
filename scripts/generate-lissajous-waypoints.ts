import { writeFileSync } from 'node:fs';

interface Waypoint {
  timeSec: number;
  latDeg: number;
  lonDeg: number;
}

const OBSERVER_LAT_DEG = 40;
const OBSERVER_LON_DEG = 116;
const EARTH_KM_PER_DEG = 111.32;
const R_KM = 25;
const F1 = 1.618;
const F2 = 1;
const T_SEC = 240;
const STEP_SEC = 10;
const MAX_TIME_SEC = 300;

function generateLissajousWaypoints(): Waypoint[] {
  const cosObserverLat = Math.cos((OBSERVER_LAT_DEG * Math.PI) / 180);
  const toWaypoint = (timeSec: number): Waypoint => {
    const xKm = R_KM * Math.sin((2 * Math.PI * F1 * timeSec) / T_SEC); // east
    const zKm = R_KM * Math.sin((2 * Math.PI * F2 * timeSec) / T_SEC); // north
    return {
      timeSec,
      latDeg: Number((OBSERVER_LAT_DEG + zKm / EARTH_KM_PER_DEG).toFixed(6)),
      lonDeg: Number((OBSERVER_LON_DEG + xKm / (EARTH_KM_PER_DEG * cosObserverLat)).toFixed(6)),
    };
  };

  return Array.from({ length: Math.floor(MAX_TIME_SEC / STEP_SEC) + 1 }, (_, index) => toWaypoint(index * STEP_SEC));
}

const waypoints = generateLissajousWaypoints();
const payload = {
  type: 'waypoints',
  waypoints,
  interpolation: 'linear',
  generator: 'lissajous(R=25km, f1=1.618, f2=1, T=240s, observerLat=40, observerLon=116)',
} satisfies Record<string, unknown>;
const output = `${JSON.stringify(payload, null, 2)}\n`;

if (process.argv[2]) {
  writeFileSync(process.argv[2], output);
} else {
  process.stdout.write(output);
}
