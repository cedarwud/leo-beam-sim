/**
 * Archived TLE fixtures and observer constants for teaching contact window experiments.
 *
 * Sourced directly from repository-validated archives (OneWeb and Starlink)
 * with verified checksums and ephemeris metadata.
 */

import type { ObserverLocation, SatelliteTleRecord } from './types';
import { NTPU_TLE_OBSERVER } from '../../simulator/observer';

/** Authoritative NTPU Observer used across repository experiments. */
export const NTPU_LAB_OBSERVER: ObserverLocation = Object.freeze({
  id: NTPU_TLE_OBSERVER.id,
  label: 'NTPU (National Taipei University, Sanxia)',
  latitudeDeg: NTPU_TLE_OBSERVER.latitudeDeg,
  longitudeDeg: NTPU_TLE_OBSERVER.longitudeDeg,
  heightKm: NTPU_TLE_OBSERVER.heightKm,
});

/** Default Starlink teaching satellite for the guided and hands-on prediction acts. */
export const EXPERIMENT_5_PRIMARY_SATELLITE: SatelliteTleRecord = Object.freeze({
  satelliteId: '44714',
  satelliteName: 'STARLINK-1008',
  noradCatalogId: 44714,
  constellation: 'Starlink',
  orbitalPlane: 'Shell-1',
  epochUtc: '2026-08-24T14:31:31.856Z',
  sourcePath: '/tle-archive/starlink/starlink_20260824.tle',
  line1: '1 44714U 19074B   26236.60522982  .00078599  00000+0  89669-3 0  9992',
  line2: '2 44714  53.1483  98.4192 0004695  79.4604 280.6939 15.61546781374862',
});

/** Alternative satellites available for Experiment 5 single-pass analysis. */
export const EXPERIMENT_5_ALTERNATIVE_SATELLITES: readonly SatelliteTleRecord[] = Object.freeze([
  EXPERIMENT_5_PRIMARY_SATELLITE,
  Object.freeze({
    satelliteId: '49100',
    satelliteName: 'ONEWEB-0314',
    noradCatalogId: 49100,
    constellation: 'OneWeb',
    orbitalPlane: 'Plane-08',
    epochUtc: '2026-08-25T06:14:36.442Z',
    sourcePath: '/tle-archive/oneweb/oneweb_20260825.tle',
    line1: '1 49100U 21075AB  26237.26014401  .00000043  00000+0  77742-4 0  9994',
    line2: '2 49100  87.9210 352.1324 0001483  98.9797 261.1502 13.17649747242664',
  }),
  Object.freeze({
    satelliteId: '49194',
    satelliteName: 'ONEWEB-0325',
    noradCatalogId: 49194,
    constellation: 'OneWeb',
    orbitalPlane: 'Plane-09',
    epochUtc: '2026-08-25T04:28:08.417Z',
    sourcePath: '/tle-archive/oneweb/oneweb_20260825.tle',
    line1: '1 49194U 21083J   26237.18620854  .00000139  00000+0  31988-3 0  9999',
    line2: '2 49194  87.9198 321.7461 0002014 101.8482 258.2876 13.18687135239102',
  }),
  Object.freeze({
    satelliteId: '55159',
    satelliteName: 'ONEWEB-0618',
    noradCatalogId: 55159,
    constellation: 'OneWeb',
    orbitalPlane: 'Plane-04',
    epochUtc: '2026-08-25T05:16:37.413Z',
    sourcePath: '/tle-archive/oneweb/oneweb_20260825.tle',
    line1: '1 55159U 23004V   26237.21987747  .00004335  00000+0  23824-3 0  9995',
    line2: '2 55159  86.9138 149.6066 0014311  46.3362 313.9062 15.13742128192705',
  }),
]);

/**
 * 24-hour constellation subset for Experiment 6.
 * Sourced from real archived OneWeb orbital planes to model constellation
 * passes, outages, and multi-satellite overlap conditions.
 */
export const EXPERIMENT_6_CONSTELLATION_SATELLITES: readonly SatelliteTleRecord[] = Object.freeze([
  EXPERIMENT_5_ALTERNATIVE_SATELLITES[1]!,
  EXPERIMENT_5_ALTERNATIVE_SATELLITES[2]!,
  EXPERIMENT_5_ALTERNATIVE_SATELLITES[3]!,
  Object.freeze({
    satelliteId: '44057',
    satelliteName: 'ONEWEB-0012',
    noradCatalogId: 44057,
    constellation: 'OneWeb',
    orbitalPlane: 'Plane-01',
    epochUtc: '2026-08-25T04:22:40.412Z',
    sourcePath: '/tle-archive/oneweb/oneweb_20260825.tle',
    line1: '1 44057U 19010A   26237.18241218 -.00000051  00000+0 -16764-3 0  9992',
    line2: '2 44057  87.9098 215.0780 0002144  99.5308 260.6065 13.16596627360641',
  }),
  Object.freeze({
    satelliteId: '44058',
    satelliteName: 'ONEWEB-0010',
    noradCatalogId: 44058,
    constellation: 'OneWeb',
    orbitalPlane: 'Plane-01',
    epochUtc: '2026-08-24T16:13:07.461Z',
    sourcePath: '/tle-archive/oneweb/oneweb_20260825.tle',
    line1: '1 44058U 19010B   26236.67578081 -.00000013  00000+0 -67373-4 0  9998',
    line2: '2 44058  87.9104 215.1765 0002260  78.6980 281.4405 13.16595091360628',
  }),
  Object.freeze({
    satelliteId: '44059',
    satelliteName: 'ONEWEB-0008',
    noradCatalogId: 44059,
    constellation: 'OneWeb',
    orbitalPlane: 'Plane-01',
    epochUtc: '2026-08-24T05:52:58.483Z',
    sourcePath: '/tle-archive/oneweb/oneweb_20260825.tle',
    line1: '1 44059U 19010C   26236.24512134  .00000045  00000+0  83640-4 0  9997',
    line2: '2 44059  87.9107 215.2567 0001630  87.9382 272.1936 13.16594778360685',
  }),
  Object.freeze({
    satelliteId: '44060',
    satelliteName: 'ONEWEB-0007',
    noradCatalogId: 44060,
    constellation: 'OneWeb',
    orbitalPlane: 'Plane-02',
    epochUtc: '2026-08-25T02:16:35.421Z',
    sourcePath: '/tle-archive/oneweb/oneweb_20260825.tle',
    line1: '1 44060U 19010D   26237.09485441  .00000175  00000+0  43045-3 0  9991',
    line2: '2 44060  87.8957 245.4817 0002312  91.4585 268.6810 13.15550155360439',
  }),
  Object.freeze({
    satelliteId: '44061',
    satelliteName: 'ONEWEB-0006',
    noradCatalogId: 44061,
    constellation: 'OneWeb',
    orbitalPlane: 'Plane-02',
    epochUtc: '2026-08-25T02:22:18.991Z',
    sourcePath: '/tle-archive/oneweb/oneweb_20260825.tle',
    line1: '1 44061U 19010E   26237.09883092  .00000059  00000+0  12290-3 0  9995',
    line2: '2 44061  87.8969 245.4524 0001963  85.3663 274.7692 13.15548638360482',
  }),
]);

/** Canonical 24-hour target start instant aligned with C-120 and C-90 curricula. */
export const DEFAULT_24_HOUR_SCHEDULE_START_UTC = '2026-08-25T08:00:00.000Z';

/** Canonical pass search window start for STARLINK-1008 over NTPU. */
export const DEFAULT_EXPERIMENT_5_SEARCH_START_UTC = '2026-08-25T00:00:00.000Z';
export const DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC = 4 * 3600; // 4 hours
