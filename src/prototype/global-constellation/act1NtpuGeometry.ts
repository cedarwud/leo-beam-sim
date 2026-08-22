import { geodeticToEcf, degreesToRadians } from 'satellite.js';

import { NTPU_TLE_OBSERVER } from '../../simulator/observer';
import { VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_KM, VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD } from '../../visualLab/globalConstellation';

/**
 * NTPU in the global artifact's display frame.
 *
 * That frame is EARTH-FIXED — the artifact maps ECF straight to world as
 * (x, z, -y) times a scale — so the ground station sits at one fixed point and
 * the cone never needs re-placing as time advances.
 */

const SCALE = VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD
  / VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_KM;

function toWorld(ecf: { x: number; y: number; z: number }): readonly [number, number, number] {
  return [ecf.x * SCALE, ecf.z * SCALE, -ecf.y * SCALE];
}

export function act1NtpuApexWorld(): readonly [number, number, number] {
  return toWorld(geodeticToEcf({
    latitude: degreesToRadians(NTPU_TLE_OBSERVER.latitudeDeg),
    longitude: degreesToRadians(NTPU_TLE_OBSERVER.longitudeDeg),
    height: NTPU_TLE_OBSERVER.heightKm,
  }));
}

/**
 * The local zenith at NTPU, as a world-frame direction.
 *
 * Taken as the geodetic normal (the WGS84 surface normal), not the geocentric
 * radial: they differ by up to ~0.19 deg at mid latitude, and the cone the room
 * is told about is defined against the local horizon, which is the geodetic one.
 */
export function act1NtpuZenithWorld(): readonly [number, number, number] {
  const latitude = degreesToRadians(NTPU_TLE_OBSERVER.latitudeDeg);
  const longitude = degreesToRadians(NTPU_TLE_OBSERVER.longitudeDeg);
  const normalEcf = {
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.cos(latitude) * Math.sin(longitude),
    z: Math.sin(latitude),
  };
  return toWorld(normalEcf);
}

/** World units per kilometre of altitude in the artifact's display frame. */
export const ACT1_WORLD_PER_KM = SCALE;

/**
 * Cone length for a constellation, in world units.
 *
 * Driven by where the constellation actually flies (its median altitude) rather
 * than a fixed number: a 10 deg cone drawn to an arbitrary height is either a
 * sliver or, at 80 deg half-angle, a wash larger than the Earth itself. Ending
 * it at the shell it is about keeps it both honest and readable.
 */
export function act1ConeLengthWorld(medianAltitudeKm: number): number {
  return Math.max(0.02, medianAltitudeKm * SCALE);
}

/**
 * A camera position that puts NTPU in view.
 *
 * The globe is earth-fixed, so without this the lecture opens looking at
 * whatever longitude happens to face the default camera — usually not Taiwan.
 *
 * `tiltDeg` swings the camera off the local zenith towards the north pole. Zero
 * looks straight down and flattens the cone into a disc; a modest tilt keeps
 * NTPU centred while letting the room read the cone as a cone.
 */
export function act1NtpuCameraPosition(
  distanceWorld: number,
  tiltDeg = 26,
): [number, number, number] {
  const [x, y, z] = act1NtpuApexWorld();
  const length = Math.hypot(x, y, z) || 1;
  const radial = { x: x / length, y: y / length, z: z / length };

  // The part of world-up that is perpendicular to the radial gives a "towards
  // the pole" direction in the local tangent plane.
  const dot = radial.y;
  const tangent = { x: -radial.x * dot, y: 1 - radial.y * dot, z: -radial.z * dot };
  const tangentLength = Math.hypot(tangent.x, tangent.y, tangent.z) || 1;

  const tilt = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  return [
    (radial.x * cos + (tangent.x / tangentLength) * sin) * distanceWorld,
    (radial.y * cos + (tangent.y / tangentLength) * sin) * distanceWorld,
    (radial.z * cos + (tangent.z / tangentLength) * sin) * distanceWorld,
  ];
}
