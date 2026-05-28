import { clamp, degToRad, normalizeAngleRad } from './math';
import type { OrbitElement } from './types';
import type { Shell } from '../../profiles/types';

const TWO_PI = Math.PI * 2;
const DAY_SEC = 86400;
const MU_EARTH_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;

function gmstRad(utcMs: number): number {
  const jd = utcMs / 86400000 + 2440587.5;
  const centuries = (jd - 2451545.0) / 36525.0;
  const gmstDeg =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * centuries * centuries -
    (centuries * centuries * centuries) / 38710000;
  return normalizeAngleRad(degToRad(gmstDeg));
}

function getServiceAreaPassTargets(shell: Shell): number[] | null {
  if (shell.satsPerPlane !== 1 || !Array.isArray(shell.serviceAreaPassTargetsSec)) {
    return null;
  }

  const targets = shell.serviceAreaPassTargetsSec.filter(Number.isFinite);
  return targets.length >= shell.planes ? targets.slice(0, shell.planes) : null;
}

function createServiceAreaPassElement(input: {
  shell: Shell;
  planeIndex: number;
  targetPassSec: number;
  epochUtcMs: number;
  observerLatDeg: number;
  observerLonDeg: number;
  inclinationRad: number;
  meanMotionRevPerDay: number;
}): OrbitElement {
  const {
    shell,
    planeIndex,
    targetPassSec,
    epochUtcMs,
    observerLatDeg,
    observerLonDeg,
    inclinationRad,
    meanMotionRevPerDay,
  } = input;
  const meanMotionRadPerSec = (meanMotionRevPerDay * TWO_PI) / DAY_SEC;
  const observerLatRad = degToRad(observerLatDeg);
  const observerLonRad = degToRad(observerLonDeg);
  const sinArgLatitude = clamp(
    Math.sin(observerLatRad) / Math.max(Math.sin(inclinationRad), 1e-9),
    -1,
    1,
  );
  const targetArgumentLatitudeRad = Math.asin(sinArgLatitude);
  const targetGmstRad = gmstRad(epochUtcMs + targetPassSec * 1000);
  const targetEciLonRad = observerLonRad + targetGmstRad;
  const targetX = Math.cos(observerLatRad) * Math.cos(targetEciLonRad);
  const targetY = Math.cos(observerLatRad) * Math.sin(targetEciLonRad);
  const orbitPlaneX = Math.cos(targetArgumentLatitudeRad);
  const orbitPlaneY = Math.sin(targetArgumentLatitudeRad) * Math.cos(inclinationRad);
  const raanRad = normalizeAngleRad(
    Math.atan2(targetY, targetX) - Math.atan2(orbitPlaneY, orbitPlaneX),
  );
  const meanAnomalyRad = normalizeAngleRad(
    targetArgumentLatitudeRad - meanMotionRadPerSec * targetPassSec,
  );

  return {
    id: `${shell.id}-P${planeIndex}-S0`,
    shellId: shell.id,
    altitudeKm: shell.altitudeKm,
    epochUtcMs,
    eccentricity: 0.0001,
    inclinationRad,
    raanRad,
    argPerigeeRad: 0,
    meanAnomalyRad,
    meanMotionRevPerDay,
  };
}

/**
 * Generate Walker delta constellation orbital elements.
 * Each shell uses a standard Walker(i, T, P, F=1) pattern unless it declares a
 * one-satellite-per-plane service-area phasing target.
 */
export function generateWalkerConstellation(config: {
  shells: Shell[];
  epochUtcMs: number;
  observerLatDeg?: number;
  observerLonDeg?: number;
}): OrbitElement[] {
  const elements: OrbitElement[] = [];

  for (const shell of config.shells) {
    const semiMajorKm = EARTH_RADIUS_KM + shell.altitudeKm;
    const meanMotionRadPerSec = Math.sqrt(MU_EARTH_KM3_S2 / (semiMajorKm ** 3));
    const meanMotionRevPerDay = (meanMotionRadPerSec * DAY_SEC) / TWO_PI;
    const incRad = degToRad(shell.inclinationDeg);
    const totalSats = shell.planes * shell.satsPerPlane;
    const serviceAreaPassTargets = getServiceAreaPassTargets(shell);

    if (
      serviceAreaPassTargets !== null
      && config.observerLatDeg !== undefined
      && config.observerLonDeg !== undefined
    ) {
      for (let p = 0; p < shell.planes; p++) {
        elements.push(createServiceAreaPassElement({
          shell,
          planeIndex: p,
          targetPassSec: serviceAreaPassTargets[p],
          epochUtcMs: config.epochUtcMs,
          observerLatDeg: config.observerLatDeg,
          observerLonDeg: config.observerLonDeg,
          inclinationRad: incRad,
          meanMotionRevPerDay,
        }));
      }
      continue;
    }

    for (let p = 0; p < shell.planes; p++) {
      const raanRad = (TWO_PI * p) / shell.planes;
      const planePhaseOffset = (TWO_PI * p) / totalSats; 

      for (let s = 0; s < shell.satsPerPlane; s++) {
        // Source: modqn-paper-reproduction/configs/modqn-paper-baseline.resolved-template.yaml
        // resolved_assumptions.orbit_layout.value.in_plane_spacing_deg = 90
        // (ASSUME-MODQN-REP-001). Paper-faithful profiles disable this
        // display-only clustering perturbation.
        const seed = (p * 13 + s * 7) % 100;
        const perturbation = shell.phasePerturbation === false
          ? 0
          : (seed / 100 - 0.5) * (TWO_PI / shell.satsPerPlane) * 0.8;
        
        const meanAnomalyRad = (TWO_PI * s) / shell.satsPerPlane + planePhaseOffset + perturbation;
        elements.push({
          id: `${shell.id}-P${p}-S${s}`,
          shellId: shell.id,
          altitudeKm: shell.altitudeKm,
          epochUtcMs: config.epochUtcMs,
          eccentricity: 0.0001,
          inclinationRad: incRad,
          raanRad,
          argPerigeeRad: 0,
          meanAnomalyRad: meanAnomalyRad % TWO_PI,
          meanMotionRevPerDay,
        });
      }
    }
  }

  return elements;
}
