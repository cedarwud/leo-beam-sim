/**
 * Authoritative scientific boundaries and educational disclaimers for contact window labs.
 *
 * Strict Scientific Rule:
 * All results produced in these experiments are labeled "Geometric Contact Opportunity"
 * and NEVER "Guaranteed RF Service".
 */

import type { CalculationProvenance } from './types';

export const SCIENTIFIC_BOUNDARY_LABEL = 'GEOMETRIC_CONTACT_OPPORTUNITY_NOT_GUARANTEED_RF_SERVICE' as const;

export const SCIENTIFIC_DISCLAIMER_EN = Object.freeze(
  'GEOMETRIC CONTACT OPPORTUNITY ONLY — NOT GUARANTEED RF SERVICE: ' +
  'Calculations are derived strictly from SGP4 orbital propagation and WGS84 topocentric coordinate transformations. ' +
  'This model demonstrates orbital line-of-sight visibility above an elevation mask. It does NOT model RF link budget, ' +
  'EIRP/path loss, antenna beam steering latency, mechanical tracking constraints, tropospheric/rain attenuation, ' +
  'Doppler shift PLL carrier acquisition lock time, interference/SINR thresholds, or network protocol connection establishment.'
);

export const SCIENTIFIC_DISCLAIMER_ZH_HANT = Object.freeze(
  '本實驗結果僅代表「空間幾何可見性（幾何窗口）」而非「保證之射頻通訊服務」：' +
  '計算依據 SGP4 軌道外推與 WGS84 地心/站心頂心座標轉換。' +
  '此模型展示衛星相對於地面站仰角門檻的幾何視線通過，並未計入射頻鏈路預算（EIRP/路徑損耗）、' +
  '天線波束轉向速度與機械追蹤極限、對流層/雨衰損耗、都卜勒頻移鎖相耗時、同頻干擾/SINR 門檻，以及通訊協定交握（RRC/Handover）延遲。'
);

export const SCIENTIFIC_ASSUMPTIONS = Object.freeze([
  {
    category: 'ORBITAL_PROPAGATION',
    title: 'SGP4 Analytical Model (WGS84/WGS72)',
    description: 'Propagates satellite state vectors from two-line element (TLE) mean orbital elements in TEME inertial coordinates.',
  },
  {
    category: 'TOPOCENTRIC_GEOMETRY',
    title: 'WGS84 Earth Ellipsoid Topocentric Frame',
    description: 'Transforms TEME -> GMST -> ECEF -> ENU topocentric frame centered at the specified ground station geodetic location.',
  },
  {
    category: 'RF_EXCLUSION',
    title: 'No RF Link Budget / Atmospheric Modeling',
    description: 'RF link-budget variables are intentionally unmodeled; real RF performance depends on frequency band, antenna gain, rain attenuation, and receiver noise figure.',
  },
  {
    category: 'MECHANICAL_EXCLUSION',
    title: 'No Antenna Slew / Pointing Delays',
    description: 'Assumes instantaneous line-of-sight acquisition at AOS; real ground terminals require antenna slew time and doppler frequency lock.',
  },
  {
    category: 'NETWORK_EXCLUSION',
    title: 'No Protocol Connection Handshake Latency',
    description: 'Usable data throughput requires random access, beam allocation, and L2/L3 signaling which reduce effective contact window duration.',
  },
] as const);

export const TEACHING_LEARNING_OBJECTIVES = Object.freeze([
  {
    experiment: 'Experiment 5',
    title: 'Guided Satellite Contact Prediction',
    objectives: [
      'Connect one archived Starlink TLE and the NTPU ground station to the predicted elevation history alpha(t).',
      'Read AOS and LOS as the two crossings of the minimum-elevation threshold.',
      'Compute geometric contact duration as LOS minus AOS.',
    ],
  },
  {
    experiment: 'Experiment 6',
    title: 'Hands-on Minimum-Elevation Prediction',
    objectives: [
      'Hold the TLE, satellite pass, and ground station fixed while changing only the minimum elevation.',
      'Run the same prediction again and compare AOS, LOS, and contact duration.',
      'Explain why a higher minimum elevation delays AOS, advances LOS, and shortens the geometric contact window.',
    ],
  },
] as const);

export function createLabProvenance(observerId: string): CalculationProvenance {
  return Object.freeze({
    model: 'satellite.js@6.0.2-sgp4-wgs84-v1',
    propagationModel: 'SGP4' as const,
    coordinateFrame: 'TEME -> ECEF -> WGS84 Topocentric' as const,
    observerId,
    calculatedAtUtc: new Date().toISOString(),
    scientificCategory: 'GEOMETRIC_CONTACT_OPPORTUNITY' as const,
    isGuaranteedRfService: false as const,
    boundaryDisclaimer: SCIENTIFIC_DISCLAIMER_EN,
  });
}
