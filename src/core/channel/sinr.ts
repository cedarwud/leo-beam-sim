/**
 * SINR computation for multi-beam NTN environments.
 */

import type { SinrResult } from './types';

/**
 * Convert dBm to linear milliwatts.
 */
function dbmToLinear(dbm: number): number {
  if (isNaN(dbm) || !isFinite(dbm)) return 0;
  if (dbm < -300) return 0;
  if (dbm > 100) return 10 ** 10;
  return 10 ** (dbm / 10);
}

/**
 * Convert linear milliwatts to dBm.
 */
function linearToDbm(linear: number): number {
  if (isNaN(linear) || !isFinite(linear) || linear <= 1e-30) return -300;
  return 10 * Math.log10(linear);
}

/**
 * Orchestrator-friendly SINR computation.
 */
export function computeSinr(opts: {
  associationActive?: boolean;
  servingRxPowerDbm: number;
  noisePowerDbm: number;
  intraInterferingRxPowersDbm?: number[];
  interInterferingRxPowersDbm?: number[];
}): SinrResult {
  const {
    associationActive = true,
    servingRxPowerDbm,
    noisePowerDbm,
    intraInterferingRxPowersDbm = [],
    interInterferingRxPowersDbm = [],
  } = opts;

  const signalLinear = associationActive ? dbmToLinear(servingRxPowerDbm) : 0;
  const noiseLinear = dbmToLinear(noisePowerDbm);

  let intraInterferenceLinear = 0;
  for (const pDbm of intraInterferingRxPowersDbm) {
    intraInterferenceLinear += dbmToLinear(pDbm);
  }

  let interInterferenceLinear = 0;
  for (const pDbm of interInterferingRxPowersDbm) {
    interInterferenceLinear += dbmToLinear(pDbm);
  }

  const interferenceLinear = intraInterferenceLinear + interInterferenceLinear;
  const denominator = interferenceLinear + noiseLinear;
  const sinrLinear = denominator > 0 ? signalLinear / denominator : 0;
  const sinrDb = sinrLinear > 1e-20 ? 10 * Math.log10(sinrLinear) : -100;

  return {
    signalDbm: servingRxPowerDbm,
    interferenceDbm: linearToDbm(interferenceLinear),
    noiseDbm: noisePowerDbm,
    sinrDb: isNaN(sinrDb) ? -100 : sinrDb,
  };
}
