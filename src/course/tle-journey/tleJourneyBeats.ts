/**
 * Geometry, SGP4 math, and coordinate adapters for the 6-beat TLE Journey.
 *
 * Projects existing validated repository TLE, SGP4, and observer derivation APIs:
 * - Line validation from `src/tle/validation.ts`
 * - Snapshot propagation from `src/tle/propagation.ts`
 * - Topocentric observer geometry from `src/simulator/observer.ts`
 * - Earth sphere scaling from `src/prototype/visual-lab-g0/visualLabGlobalSceneAdapter.ts`
 *
 * Explicit coordinate transformation pipeline:
 * TLE (Keplerian) -> SGP4 -> TEME (ECI) -> GMST Rotation -> ECEF (WGS84) -> NTPU Topocentric (SEZ) -> Scene Display (Three.js Y-up).
 */

import { eciToEcf, geodeticToEcf, gstime, type EciVec3 } from 'satellite.js';

import { NTPU_TLE_OBSERVER, deriveObserverLinkGeometry } from '../../simulator/observer';
import { VISUAL_LAB_EARTH_RADIUS, VISUAL_LAB_EARTH_RADIUS_KM } from '../../prototype/visual-lab-g0/visualLabGlobalSceneAdapter';
import { validateTleLines } from '../../tle/validation';
import { deriveSatelliteAltitudeKm, propagateTleSnapshot } from '../../tle/propagation';
import { TLE_PROPAGATION_MODEL, TLE_SOURCE_KIND, type ResolvedTleSnapshot } from '../../tle/types';
import { SAMPLE_TLE } from './tleJourneyStations';
import { deriveTleFacts } from './tleFields';
import { findTleJourneyPass, type TleJourneyPass } from './tleJourneyPass';

export const SCENE_EARTH_SCALE = VISUAL_LAB_EARTH_RADIUS / VISUAL_LAB_EARTH_RADIUS_KM;

export const TLE_COORDINATE_CHAIN_DISCLOSURE = Object.freeze([
  '1. TLE 軌道根數 (Keplerian Elements: i, Ω, e, ω, M, n, B*)',
  '2. SGP4 傳播模型 (Simplified General Perturbations 4)',
  '3. TEME 慣性座標系 (True Equator, Mean Equinox ECI, 單位: km)',
  '4. GMST 格林威治恆星時自轉矩陣 (Earth Rotation Matrix)',
  '5. ECEF 地球固定座標系 (Earth-Centered Earth-Fixed / WGS84, 單位: km)',
  '6. NTPU Topocentric 局部站心座標 (SEZ: 仰角 Elevation, 方位角 Azimuth, 斜距 Range)',
  '7. Scene 3D 顯示座標 (Three.js Y-up, 依 WGS84 ECEF 對齊)',
]);

/**
 * The three values emitted by SGP4 for position are Cartesian components,
 * not three independent measurements or longitude/latitude values.  Keep the
 * teaching definition next to the propagation contract so the scene and its
 * tests cannot silently drift apart.
 */
export const TEME_POSITION_COMPONENT_DEFINITIONS = Object.freeze([
  Object.freeze({
    axis: 'x' as const,
    labelZhHant: 'x 分量',
    descriptionZhHant: 'TEME X 軸；真赤道面／平春分點方向。',
  }),
  Object.freeze({
    axis: 'y' as const,
    labelZhHant: 'y 分量',
    descriptionZhHant: 'TEME Y 軸；真赤道面／正交方向。',
  }),
  Object.freeze({
    axis: 'z' as const,
    labelZhHant: 'z 分量',
    descriptionZhHant: 'TEME Z 軸；垂直真赤道面／真北極。',
  }),
] as const);

export interface SatelliteOrbitalSourceIdentity {
  readonly sourcePath: string;
  readonly catalogId: string;
  readonly satelliteName: string;
  readonly epochUtc: string;
  readonly contentDigest: string;
  readonly sourceKind: typeof TLE_SOURCE_KIND;
  readonly propagationModel: typeof TLE_PROPAGATION_MODEL;
}

export interface SatelliteOrbitalState {
  readonly instantUtc: string;
  readonly instantMs: number;
  readonly positionTemeKm: { readonly x: number; readonly y: number; readonly z: number };
  readonly velocityTemeKmPerSec: { readonly x: number; readonly y: number; readonly z: number };
  readonly positionEcefKm: { readonly x: number; readonly y: number; readonly z: number };
  readonly position3D: readonly [number, number, number];
  readonly speedKmPerSec: number;
  readonly altitudeKm: number;
  readonly radiusKm: number;
  readonly elevationDeg: number;
  readonly azimuthDeg: number;
  readonly rangeKm: number;
  readonly isVisibleFromNtpu: boolean;
  readonly source: SatelliteOrbitalSourceIdentity;
  readonly coordinateDisclosure: readonly string[];
}

export type SatelliteOrbitalResult =
  | {
      readonly ok: true;
      readonly state: SatelliteOrbitalState;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly errorCode: 'INVALID_TLE' | 'PROPAGATION_FAILED';
    };

export interface GroundObserverState {
  readonly position3D: readonly [number, number, number];
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly heightKm: number;
}

export interface OrbitTrailEndpointSummary {
  /** TLE epoch used as the first frame of the trail. */
  readonly startInstantUtc: string;
  /** One SGP4 orbital period after the epoch. */
  readonly endInstantUtc: string;
  readonly orbitalPeriodMin: number;
  readonly startEcefKm: { readonly x: number; readonly y: number; readonly z: number };
  readonly endEcefKm: { readonly x: number; readonly y: number; readonly z: number };
  /** Central angle projected onto the Earth surface, in degrees. */
  readonly centralAngleDeg: number;
  /** Ground-track arc length using the visual lab's WGS84 mean-radius scale. */
  readonly groundTrackDistanceKm: number;
  /** Signed geocentric longitude delta, normalized to [-180, 180]. */
  readonly longitudeShiftDeg: number;
}

/**
 * Deterministic FNV-1a hash over normalized TLE content.
 */
export function computeTleDigest(line1: string, line2: string): string {
  let hash = 0x811c9dc5;
  const combined = `${line1.trimEnd()}\n${line2.trimEnd()}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Propagates the pinned TLE to an offset in minutes from its epoch.
 * Returns a typed unavailable result when input or propagation fails.
 */
export function calculateSatelliteOrbitalResult(
  line1: string,
  line2: string,
  offsetMin: number,
): SatelliteOrbitalResult {
  // Step 1: Validate TLE lines upfront
  let validated;
  try {
    validated = validateTleLines(line1, line2);
  } catch (error) {
    return Object.freeze({
      ok: false,
      reason: error instanceof Error ? error.message : 'Invalid TLE lines',
      errorCode: 'INVALID_TLE' as const,
    });
  }

  // Step 2: Derive facts and compute requested instant
  let facts;
  try {
    facts = deriveTleFacts(line1, line2);
  } catch (error) {
    return Object.freeze({
      ok: false,
      reason: error instanceof Error ? error.message : 'Unusable TLE facts',
      errorCode: 'INVALID_TLE' as const,
    });
  }

  const epochMs = Date.parse(facts.epochUtc);
  const instantMs = epochMs + offsetMin * 60_000;
  const when = new Date(instantMs);
  const instantUtc = when.toISOString();

  // Step 3: Propagate through repository SGP4 pipeline
  const snapshot: ResolvedTleSnapshot = {
    satelliteId: validated.identity.satelliteId,
    satelliteName: SAMPLE_TLE.name,
    epochUtc: validated.epoch.epochUtc,
    line1: validated.line1,
    line2: validated.line2,
    sourcePath: SAMPLE_TLE.sourcePath,
    sourceKind: TLE_SOURCE_KIND,
    requestedInstantUtc: instantUtc,
    ageMs: Math.abs(offsetMin * 60_000),
    maxPropagationAgeMs: 7 * 86_400_000,
    provenance: {
      satelliteId: validated.identity.satelliteId,
      satelliteName: SAMPLE_TLE.name,
      sourcePath: SAMPLE_TLE.sourcePath,
      sourceKind: TLE_SOURCE_KIND,
      epochUtc: validated.epoch.epochUtc,
      line1: validated.line1,
      line2: validated.line2,
      archiveId: 'starlink-20260824-teaching',
    },
  };

  let propagated;
  try {
    propagated = propagateTleSnapshot(snapshot, instantUtc);
  } catch (error) {
    return Object.freeze({
      ok: false,
      reason: error instanceof Error ? error.message : 'SGP4 propagation failed',
      errorCode: 'PROPAGATION_FAILED' as const,
    });
  }

  const pTeme = propagated.positionTemeKm;
  const vTeme = propagated.velocityTemeKmPerSec;
  const radiusKm = Math.hypot(pTeme.x, pTeme.y, pTeme.z);
  const speedKmPerSec = Math.hypot(vTeme.x, vTeme.y, vTeme.z);

  // Derive altitude above WGS84 ellipsoid via repository derivation
  let altitudeKm: number;
  try {
    altitudeKm = deriveSatelliteAltitudeKm(pTeme, instantUtc);
  } catch {
    altitudeKm = radiusKm - VISUAL_LAB_EARTH_RADIUS_KM;
  }

  // Derive NTPU observer link geometry via repository observer derivation
  const observerGeometry = deriveObserverLinkGeometry(pTeme, instantUtc, NTPU_TLE_OBSERVER);

  // Convert TEME -> ECEF via GST rotation
  const gmst = gstime(when);
  const ecf = eciToEcf(pTeme as EciVec3<number>, gmst);
  const positionEcefKm = Object.freeze({ x: ecf.x, y: ecf.y, z: ecf.z });

  // Convert ECEF -> Three.js World coordinates (matching EarthSphere)
  // ECF Z (North Pole up) -> Three.js Y
  // ECF X (Prime meridian) -> Three.js X
  // ECF Y (90 deg E) -> Three.js -Z
  const position3D: readonly [number, number, number] = Object.freeze([
    ecf.x * SCENE_EARTH_SCALE,
    ecf.z * SCENE_EARTH_SCALE,
    -ecf.y * SCENE_EARTH_SCALE,
  ] as const);

  const digest = computeTleDigest(line1, line2);

  const state: SatelliteOrbitalState = Object.freeze({
    instantUtc,
    instantMs,
    positionTemeKm: pTeme,
    velocityTemeKmPerSec: vTeme,
    positionEcefKm,
    position3D,
    speedKmPerSec,
    altitudeKm,
    radiusKm,
    elevationDeg: observerGeometry.elevationDeg,
    azimuthDeg: observerGeometry.azimuthDeg,
    rangeKm: observerGeometry.rangeKm,
    isVisibleFromNtpu: observerGeometry.elevationDeg >= 10,
    source: Object.freeze({
      sourcePath: SAMPLE_TLE.sourcePath,
      catalogId: validated.identity.satelliteId,
      satelliteName: SAMPLE_TLE.name,
      epochUtc: validated.epoch.epochUtc,
      contentDigest: digest,
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
    }),
    coordinateDisclosure: TLE_COORDINATE_CHAIN_DISCLOSURE,
  });

  return Object.freeze({
    ok: true,
    state,
  });
}

/**
 * Propagates the pinned TLE, returning null on invalid input or propagation error.
 */
export function calculateSatelliteState(
  line1: string,
  line2: string,
  offsetMin: number,
): SatelliteOrbitalState | null {
  const result = calculateSatelliteOrbitalResult(line1, line2, offsetMin);
  return result.ok ? result.state : null;
}

/**
 * Computes 3D position of the NTPU ground station on Earth in Three.js coordinates.
 */
export function calculateNtpuObserver3D(): GroundObserverState {
  const ecf = geodeticToEcf({
    latitude: NTPU_TLE_OBSERVER.latitudeDeg * Math.PI / 180,
    longitude: NTPU_TLE_OBSERVER.longitudeDeg * Math.PI / 180,
    height: NTPU_TLE_OBSERVER.heightKm,
  });

  const position3D: readonly [number, number, number] = Object.freeze([
    ecf.x * SCENE_EARTH_SCALE,
    ecf.z * SCENE_EARTH_SCALE,
    -ecf.y * SCENE_EARTH_SCALE,
  ] as const);

  return Object.freeze({
    position3D,
    latitudeDeg: NTPU_TLE_OBSERVER.latitudeDeg,
    longitudeDeg: NTPU_TLE_OBSERVER.longitudeDeg,
    heightKm: NTPU_TLE_OBSERVER.heightKm,
  });
}

/**
 * Computes one full orbital-period window in Earth-fixed scene coordinates.
 * The window is intentionally open because Earth rotates between samples.
 */
export function calculateOrbitTrailPoints(
  line1: string,
  line2: string,
  steps = 128,
  referenceInstantMs?: number,
): readonly (readonly [number, number, number])[] {
  let validated;
  try {
    validated = validateTleLines(line1, line2);
  } catch {
    return Object.freeze([]);
  }

  let facts;
  try {
    facts = deriveTleFacts(line1, line2);
  } catch {
    return Object.freeze([]);
  }

  const baseMs = referenceInstantMs ?? Date.parse(facts.epochUtc);
  const periodMs = facts.orbitalPeriodMin * 60_000;
  const points: Array<readonly [number, number, number]> = [];

  for (let i = 0; i <= steps; i++) {
    const instantMs = baseMs + (i / steps) * periodMs;
    const when = new Date(instantMs);
    const instantUtc = when.toISOString();

    const snapshot: ResolvedTleSnapshot = {
      satelliteId: validated.identity.satelliteId,
      satelliteName: SAMPLE_TLE.name,
      epochUtc: validated.epoch.epochUtc,
      line1: validated.line1,
      line2: validated.line2,
      sourcePath: SAMPLE_TLE.sourcePath,
      sourceKind: TLE_SOURCE_KIND,
      requestedInstantUtc: instantUtc,
      ageMs: Math.abs(instantMs - Date.parse(facts.epochUtc)),
      maxPropagationAgeMs: 7 * 86_400_000,
      provenance: {
        satelliteId: validated.identity.satelliteId,
        satelliteName: SAMPLE_TLE.name,
        sourcePath: SAMPLE_TLE.sourcePath,
        sourceKind: TLE_SOURCE_KIND,
        epochUtc: validated.epoch.epochUtc,
        line1: validated.line1,
        line2: validated.line2,
      },
    };

    try {
      const propagated = propagateTleSnapshot(snapshot, instantUtc);
      // TEME is an inertial frame.  Earth-fixed coordinates must use the
      // sidereal time of the *same* propagated instant; reusing the epoch GST
      // makes a full-orbit trail appear artificially closed while the Earth
      // has actually rotated underneath it.
      const ecf = eciToEcf(propagated.positionTemeKm as EciVec3<number>, gstime(when));
      points.push(Object.freeze([
        ecf.x * SCENE_EARTH_SCALE,
        ecf.z * SCENE_EARTH_SCALE,
        -ecf.y * SCENE_EARTH_SCALE,
      ] as const));
    } catch {
      // Propagation failed; skip point
    }
  }

  return Object.freeze(points);
}

/**
 * Computes the actual endpoints of the displayed Earth-fixed orbit window.
 *
 * The endpoint is intentionally derived from the same SGP4/ECEF path as the
 * renderer, rather than from an ideal circular-orbit approximation.  This
 * gives the lesson a concrete answer to "does it return to the start?": the
 * inertial phase is approximately one orbit later, but Earth rotation moves
 * the ground track in the Earth-fixed frame.
 */
export function calculateOrbitTrailEndpointSummary(
  line1: string,
  line2: string,
): OrbitTrailEndpointSummary | null {
  let facts;
  try {
    facts = deriveTleFacts(line1, line2);
  } catch {
    return null;
  }

  const start = calculateSatelliteState(line1, line2, 0);
  const end = calculateSatelliteState(line1, line2, facts.orbitalPeriodMin);
  if (start === null || end === null) return null;

  const startEcefKm = Object.freeze({ ...start.positionEcefKm });
  const endEcefKm = Object.freeze({ ...end.positionEcefKm });
  const startRadiusKm = Math.hypot(startEcefKm.x, startEcefKm.y, startEcefKm.z);
  const endRadiusKm = Math.hypot(endEcefKm.x, endEcefKm.y, endEcefKm.z);
  const dot = startEcefKm.x * endEcefKm.x
    + startEcefKm.y * endEcefKm.y
    + startEcefKm.z * endEcefKm.z;
  const cosine = Math.max(-1, Math.min(1, dot / (startRadiusKm * endRadiusKm)));
  const centralAngleRad = Math.acos(cosine);
  const longitudeDeg = (ecef: { readonly x: number; readonly y: number }): number => {
    const longitude = Math.atan2(ecef.y, ecef.x) * 180 / Math.PI;
    return longitude;
  };
  const rawLongitudeShift = longitudeDeg(endEcefKm) - longitudeDeg(startEcefKm);
  const longitudeShiftDeg = ((rawLongitudeShift + 540) % 360) - 180;

  return Object.freeze({
    startInstantUtc: start.instantUtc,
    endInstantUtc: end.instantUtc,
    orbitalPeriodMin: facts.orbitalPeriodMin,
    startEcefKm,
    endEcefKm,
    centralAngleDeg: centralAngleRad * 180 / Math.PI,
    groundTrackDistanceKm: centralAngleRad * VISUAL_LAB_EARTH_RADIUS_KM,
    longitudeShiftDeg,
  });
}

/**
 * Cached teaching pass at NTPU on 2026-08-25, propagated from the latest
 * available Starlink archive publication (2026-08-24).
 */
let cachedPass: TleJourneyPass | null = null;
export const TLE_JOURNEY_PASS_SAMPLE_STEP_SEC = 5;

export function getTeachingPass(): TleJourneyPass | null {
  if (cachedPass === null) {
    cachedPass = findTleJourneyPass(
      SAMPLE_TLE.line1,
      SAMPLE_TLE.line2,
      Date.parse('2026-08-25T00:00:00.000Z'),
      4 * 3600,
      TLE_JOURNEY_PASS_SAMPLE_STEP_SEC,
      10,
    );
  }
  return cachedPass;
}
