/**
 * Channel module type definitions.
 *
 * Governance:
 *   - SDD: sdd/ntn-sim-core-sdd.md §9.2
 *   - Constraints: sdd/ntn-sim-core-development-constraints.md §3, §4
 *   - This file must not import React, Three.js, or scene code.
 */

/** Result of a full link-budget computation (all channel tiers combined). */
export interface ChannelResult {
  fsplDb: number;
  shadowFadingDb: number;
  clutterLossDb: number;
  implementationLossDb: number;
  beamGainDb: number;
  atmosphericDb: number;
  /** Tier 5: small-scale fading in dB (Shadowed-Rician). 0 if disabled. */
  smallScaleFadingDb: number;
  /** Tier 3.5: phased-array scan loss in dB. 0 if disabled. A7 fix.
   *  @source leo-beam-sim/src/engine/signal/link-budget.ts */
  scanLossDb: number;
  totalPathLossDb: number;
  rxPowerDbm: number;
}

/** Result of SINR computation for a UE in a multi-beam environment. */
export interface SinrResult {
  signalDbm: number;
  interferenceDbm: number;
  noiseDbm: number;
  sinrDb: number;
}

/** Input parameters for beam-gain model computation. */
export interface BeamGainInput {
  offAxisAngleDeg: number;
  model: 'rpsat-3gpp' | 'bessel-j1' | 'bessel-j1j3' | 'itu-r' | 'flat-debug';
  peakGainDbi: number;
  beamDiameterKm: number;
  altitudeKm: number;
  /** Slant range in km. Used for θ_3dB calculation (M2 fix).
   *  If omitted, falls back to altitudeKm (nadir approximation). */
  slantRangeKm?: number;
}

/**
 * Per-interferer pre-computed received power for SINR computation.
 *
 * Use ChannelResult.rxPowerDbm from computeLinkBudget() directly.
 * This ensures all enabled channel tiers (FSPL, beam gain, atmospheric,
 * fading, etc.) are included symmetrically with the serving link.
 */
export interface InterferingSignal {
  /** Pre-computed received power in dBm (= txEirp − totalPathLossDb).
   *  Includes beam gain and all enabled tiers. */
  rxPowerDbm: number;
}

/**
 * Options for SINR computation.
 *
 * Both serving and interfering powers must come from computeLinkBudget()
 * so that all enabled channel tiers are included in the SINR calculation.
 */
export interface SinrComputeOptions {
  /** Pre-computed serving link received power in dBm (ChannelResult.rxPowerDbm). */
  servingRxPowerDbm: number;
  noisePowerDbm: number;
  /** Per-interferer pre-computed received powers. */
  interferingSignals: InterferingSignal[];
}

/** Options for link-budget computation. */
export type LargeScaleModel = '3gpp-baseline' | '3gpp-extended';
export type DeploymentEnvironment = 'rural' | 'suburban' | 'dense-urban';

export interface LinkBudgetOptions {
  distanceKm: number;
  frequencyGhz: number;
  txEirpDbm: number;
  rxAntennaGainDb?: number;
  elevationDeg: number;
  environment: DeploymentEnvironment;
  largeScaleModel?: LargeScaleModel;
  beamGainInput: BeamGainInput | null;
  noisePowerDbm: number;
  implementationLossDb?: number;
  /** Channel tier enable flags. */
  tier1LargeScale: boolean;
  tier2Clutter: boolean;
  tier3BeamGain: boolean;
  tier4Atmospheric: boolean;
  /** Tier 5: small-scale fading (Shadowed-Rician). MS1 fix. */
  tier5Fading?: boolean;
  /**
   * Tier 5 fading model selection. A3 fix.
   * 'shadowed-rician' (default) — 3GPP TR 38.811 standard model.
   * 'loo' — Loo (1985) lognormal+Rayleigh, better for tree-shadowing scenarios.
   * @source beamHO-bench/src/sim/channel/small-scale.ts
   */
  tier5FadingModel?: 'shadowed-rician' | 'loo';
  /**
   * Tier 3.5: phased-array scan loss. A7 fix.
   * Enabled only for Ka-band (≥18 GHz) with phased-array antenna.
   * Requires scanAngleDeg and scanMaxAngleDeg to be set.
   * @source leo-beam-sim/src/engine/signal/link-budget.ts
   */
  tier35ScanLoss?: boolean;
  /** Scan angle from boresight (degrees). Required if tier35ScanLoss enabled. */
  scanAngleDeg?: number;
  /** Maximum scan angle supported by the phased array (degrees). Default 60°. */
  scanMaxAngleDeg?: number;
  /** Maximum scan loss at scanMaxAngleDeg (dB). Default 3 dB (Ka-band phased array).
   *  @source ITU-R S.672, leo-beam-sim reference */
  scanLossMaxDb?: number;
  /** Seeded RNG for shadow fading sampling. */
  rngNext: (() => number) | null;
  /** LOS condition — true for LOS, false for NLOS. */
  isLos: boolean;
}

/** Shadow fading parameters for a given elevation angle. */
export interface ShadowFadingParams {
  losSigmaDb: number;
  nlosSigmaDb: number;
  clutterLossDb: number;
}
