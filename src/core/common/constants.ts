/**
 * Physical constants used across core modules.
 *
 * Tier: normative
 * Source: WGS84 / IAU standard values
 */

/** Earth gravitational parameter (km³/s²). */
export const MU_EARTH_KM3_S2 = 398600.4418;

/** WGS84 semi-major axis (km). */
export const EARTH_RADIUS_KM = 6378.137;

/** WGS84 flattening. */
export const EARTH_FLATTENING = 1 / 298.257223563;

export const TWO_PI = Math.PI * 2;

/** Seconds in one day. */
export const DAY_SECONDS = 86400;

/** Default minimum elevation for satellite visibility (degrees). */
export const MIN_VISIBLE_ELEVATION_DEG = 5;
