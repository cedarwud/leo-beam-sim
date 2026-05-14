/**
 * Link-budget computation combining all channel tiers.
 *
 * Tier: normative (composition logic)
 * Sources: per-tier sources documented in individual modules
 *
 * Tier mapping (SDD §9.2.1):
 *   - Tier 0: FSPL (always on)
 *   - Tier 1: large-scale shadow fading
 *   - Tier 2: clutter / elevation-dependent attenuation
 *   - Tier 3: beam gain
 *   - Tier 3.5: phased-array scan loss (Ka-band; A7 fix)
 *   - Tier 4: atmospheric (Ka-band extras)
 *   - Tier 5: small-scale fading (Shadowed-Rician)
 *
 * This file must not import React, Three.js, or scene code.
 */

import type { ChannelResult, LinkBudgetOptions } from './types';
import { computeFspl } from './fspl';
import { getShadowFadingParams, sampleShadowFading } from './shadow-fading';
import { computeBeamGain } from './beam-gain';
import { sampleShadowedRicianDb, sampleLooDb } from './small-scale-fading';

/**
 * Compute the full link budget by composing enabled channel tiers.
 *
 * @tier normative
 *
 * @param opts — link-budget computation options with tier enable flags
 * @returns ChannelResult with per-tier breakdown and total
 */
export function computeLinkBudget(opts: LinkBudgetOptions): ChannelResult {
  const {
    distanceKm,
    frequencyGhz,
    txEirpDbm,
    rxAntennaGainDb = 0,
    elevationDeg,
    environment,
    largeScaleModel,
    beamGainInput,
    tier1LargeScale,
    tier2Clutter,
    tier3BeamGain,
    tier4Atmospheric,
    rngNext,
    isLos,
    tier35ScanLoss,
    scanAngleDeg,
    scanMaxAngleDeg,
    scanLossMaxDb,
    implementationLossDb,
  } = opts;

  // Tier 0: FSPL (always mandatory)
  const fsplDb = computeFspl(distanceKm, frequencyGhz);

  // Tier 1: shadow fading (M3 fix: pass frequencyGhz for band-specific tables)
  let shadowFadingDb = 0;
  if (tier1LargeScale && rngNext) {
    const params = getShadowFadingParams(elevationDeg, environment, frequencyGhz);
    const sigma = isLos ? params.losSigmaDb : params.nlosSigmaDb;
    shadowFadingDb = sampleShadowFading(sigma, rngNext);
  }

  // Tier 2: clutter loss (NLOS only)
  let clutterLossDb = 0;
  if (tier2Clutter && !isLos) {
    const params = getShadowFadingParams(elevationDeg, environment, frequencyGhz);
    clutterLossDb = params.clutterLossDb;
  }

  // Tier 3: beam gain
  let beamGainDb = 0;
  if (tier3BeamGain && beamGainInput) {
    beamGainDb = computeBeamGain(beamGainInput);
  }

  // Tier 3.5: phased-array scan loss (A7 fix)
  // L_scan = L_max × (θ_scan / θ_max)² — quadratic taper from boresight to max scan angle
  // Applies only to Ka-band (≥18 GHz) phased-array antennas.
  // @source leo-beam-sim/src/engine/signal/link-budget.ts
  // @source ITU-R S.672-4 (scan loss reference)
  let scanLossDb = 0;
  if (tier35ScanLoss && frequencyGhz >= 18 && scanAngleDeg != null) {
    const maxAngle = scanMaxAngleDeg ?? 60;
    const lossMax  = scanLossMaxDb  ?? 3.0;
    const ratio = Math.min(scanAngleDeg, maxAngle) / maxAngle;
    scanLossDb = lossMax * ratio * ratio;
  }

  // Tier 4: atmospheric loss (M4 fix: simplified ITU-R model for Ka-band)
  // Gaseous absorption (O2 + H2O) + rain attenuation, elevation-dependent
  // Source: ITU-R P.676 (gaseous), ITU-R P.618 (rain), simplified for LEO NTN
  //
  // @assumption ASSUME-ATM-001
  // Zenith values below are fixed mid-latitude estimates, NOT full ITU-R table lookups.
  //   - gaseous: 0.35 dB (10–25 GHz) / 0.6 dB (25+ GHz)  [ITU-R P.676 typical clear-sky]
  //   - rain:    0.8 dB (10–25 GHz) / 1.5 dB (25+ GHz)   [ITU-R P.618 99% availability]
  //   - scintillation: 0.4 dB (Ka-band)                   [ITU-R P.618 tropospheric]
  // Claim scope: suitable for LEO NTN Ka-band baseline; not for site-specific or
  // availability-sensitive comparisons. See sdd/ntn-sim-core-assumption-policy.md §9.
  let atmosphericDb = 0;
  if (tier4Atmospheric && (largeScaleModel ?? '3gpp-baseline') === '3gpp-extended' && frequencyGhz >= 10) {
    // Gaseous absorption: ~0.15 dB/km at 20 GHz, ~0.25 dB/km at 28 GHz (clear sky)
    // Effective path through atmosphere ≈ 10 km / sin(elevation)
    const zenithGaseousDb = frequencyGhz >= 25 ? 0.6 : 0.35;
    const sinEl = Math.sin(Math.max(elevationDeg, 5) * Math.PI / 180);
    const gaseousDb = zenithGaseousDb / sinEl;

    // Rain attenuation: ITU-R P.618 simplified
    // Typical clear-sky + light rain (availability 99%): ~1-3 dB at Ka-band zenith
    const zenithRainDb = frequencyGhz >= 25 ? 1.5 : 0.8;
    const rainDb = zenithRainDb / sinEl;

    // Scintillation: ~0.3-0.5 dB at Ka-band (tropospheric)
    const scintDb = frequencyGhz >= 18 ? 0.4 : 0;

    atmosphericDb = gaseousDb + rainDb + scintDb;
  }

  // Tier 5: small-scale fading — MS1 (Shadowed-Rician) or A3 (Loo)
  let smallScaleFadingDb = 0;
  if (opts.tier5Fading && rngNext) {
    if (opts.tier5FadingModel === 'loo') {
      // A3 Loo model: suited for low-elevation tree-shadowing scenarios
      // @source Loo (1985), beamHO-bench/src/sim/channel/small-scale.ts
      smallScaleFadingDb = sampleLooDb(elevationDeg, rngNext);
    } else {
      // Default: Shadowed-Rician (3GPP TR 38.811)
      smallScaleFadingDb = sampleShadowedRicianDb(elevationDeg, isLos, rngNext);
    }
  }

  // Total path loss (positive value = loss)
  // smallScaleFadingDb can be + or - (normalized to 0 dB mean)
  const implementationDb = implementationLossDb ?? 0;
  const totalPathLossDb = fsplDb + implementationDb + shadowFadingDb + clutterLossDb + atmosphericDb + scanLossDb - beamGainDb - smallScaleFadingDb;

  // Received power
  const rxPowerDbm = txEirpDbm + rxAntennaGainDb - totalPathLossDb;

  return {
    fsplDb,
    shadowFadingDb,
    clutterLossDb,
    implementationLossDb: implementationDb,
    beamGainDb,
    atmosphericDb,
    scanLossDb,
    smallScaleFadingDb,
    totalPathLossDb,
    rxPowerDbm,
  };
}
