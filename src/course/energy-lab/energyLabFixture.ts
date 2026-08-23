/**
 * Act 5's classroom fixture.
 *
 * The sweep needs a run to sweep. Until the live-replay bridge is wired to a
 * running simulator this computes the same quantities from the canonical
 * definitions over a pinned synthetic UE set: real formulas, stated parameters,
 * one deterministic frame set.
 *
 * The channel fixture remains a classroom scenario, while the power terms
 * below follow the paper-backed definitions cited by the teaching surface.
 * Swapping the scenario values for a pinned study set changes numbers, not
 * structure.
 *
 *   γ = p·H·G^T(θ) / (I + σ²)
 *   R = (B^w / U) · log₂(1 + γ)
 *   P^p = p / ξ,   P^N = P^f + Σ P^p,   η = R / P^N
 */

import { angleLabGainDb } from '../sixActs/anglePowerChain';

export const ENERGY_LAB_FRAME_SET_DIGEST = 'demo-frames:energy-lab-v1' as const;
export const ENERGY_LAB_SCENARIO_ID = 'energy-lab-demo-v1' as const;

/**
 * Classroom parameters.
 *
 * ξ follows paper (3.15a), and P^f follows paper (3.16a). The channel terms
 * remain scenario quantities because this fixture is not a calibrated RF link
 * budget.
 */
export const ENERGY_LAB_PARAMS = Object.freeze({
  /** Per-beam bandwidth B^w in MHz (500 MHz over 3-colour reuse). */
  beamBandwidthMHz: 500 / 3,
  /** Users sharing one beam, U_{s,v}. */
  usersPerBeam: 4,
  /**
   * Per-beam load U_{s,v} for the one-satellite fixture.
   * This is a scenario declaration, not a measurement. z_{s,v}=1 iff the
   * corresponding entry is greater than zero.
   */
  beamUserCounts: Object.freeze([4, 4, 4, 4, 4, 4, 4]),
  /** Paper Table II: per-active-RF-chain circuit power, W. */
  circuitPowerPerBeamW: 0.338,
  /** Paper Table II: per-active-satellite baseband power, W. */
  basebandPowerPerSatelliteW: 0.2,
  /** Half-power beamwidth in degrees. */
  theta3dbDeg: 3.32,
  /**
   * Signal term at 1 W on boresight, in units of the noise σ².
   *
   * i.e. the SNR the link would have with no interference at all.
   */
  signalOverNoiseAtOneWatt: 1.8,
  /**
   * Inter-beam interference coupling κ.
   *
   * The neighbouring beams run at the SAME swept power, so interference rises
   * with it and γ saturates at roughly 1/κ. Without this term the rate never
   * stops growing and the curve has no right-hand segment at all — which is
   * exactly the "報酬遞減" the act is about.
   */
  interferenceCoupling: 0.5,
  /** Paper (3.15a): maximum effective RF-to-supply efficiency. */
  xiMax: 0.35,
  /** Paper (3.15a): rated RF power p_max, W. */
  pMaxW: 1.65,
  /** Paper (3.15a): power back-off used to define p_sat, dB. */
  powerBackoffDb: 5,
  /** Off-axis angles of the served users, in degrees. */
  userOffAxisDeg: Object.freeze([0.2, 1.1, 2.4, 3.6]),
  /** Below this the link is treated as failing, matching the engine's rule. */
  lowSinrThresholdDb: -5,
});

export type EnergyLabBeamUserCounts = readonly number[];

/** Apply the classroom operation that makes one beam's declared load zero. */
export function energyLabBeamUserCountsForZeroLoad(
  zeroLoadBeamIndex: number | null,
): EnergyLabBeamUserCounts {
  if (zeroLoadBeamIndex === null) return ENERGY_LAB_PARAMS.beamUserCounts;
  if (!Number.isInteger(zeroLoadBeamIndex)
    || zeroLoadBeamIndex < 0
    || zeroLoadBeamIndex >= ENERGY_LAB_PARAMS.beamUserCounts.length) {
    throw new RangeError(`zero-load beam index ${zeroLoadBeamIndex} is outside the fixture`);
  }
  return Object.freeze(ENERGY_LAB_PARAMS.beamUserCounts.map((users, index) => (
    index === zeroLoadBeamIndex ? 0 : users
  )));
}

/** N^act_s(t) = Σ_v 1{U_{s,v}(t)>0} for the one-satellite fixture. */
export function energyLabActiveBeamCount(
  beamUserCounts: EnergyLabBeamUserCounts = ENERGY_LAB_PARAMS.beamUserCounts,
): number {
  return beamUserCounts.reduce((count, users) => count + (users > 0 ? 1 : 0), 0);
}

/** 1{N^act_s(t)>0}, the satellite term in paper (3.16a). */
export function energyLabActiveSatelliteCount(
  beamUserCounts: EnergyLabBeamUserCounts = ENERGY_LAB_PARAMS.beamUserCounts,
): number {
  return energyLabActiveBeamCount(beamUserCounts) > 0 ? 1 : 0;
}

/** p_sat = p_max · 10^(BO/10), as used by paper (3.15a). */
export const ENERGY_LAB_P_SAT_W = ENERGY_LAB_PARAMS.pMaxW
  * 10 ** (ENERGY_LAB_PARAMS.powerBackoffDb / 10);

/** ξ = min{ξ_max, ξ_max · √(p / p_sat)}, paper (3.15a). */
export function energyLabXi(beamPowerW: number): number {
  const p = Math.max(0, beamPowerW);
  return Math.min(
    ENERGY_LAB_PARAMS.xiMax,
    ENERGY_LAB_PARAMS.xiMax * Math.sqrt(p / ENERGY_LAB_P_SAT_W),
  );
}

/**
 * P^f = 0.338 W x N_active_beam + 0.2 W x N_active_satellite  (paper 3.16a).
 *
 * Derived, not chosen: the earlier hand-picked 3 W happened to land near this,
 * which is exactly why a hand-picked constant is dangerous.
 */
export function energyLabFixedOverheadW(
  beamUserCounts: EnergyLabBeamUserCounts = ENERGY_LAB_PARAMS.beamUserCounts,
): number {
  const params = ENERGY_LAB_PARAMS;
  return params.circuitPowerPerBeamW * energyLabActiveBeamCount(beamUserCounts)
    + params.basebandPowerPerSatelliteW * energyLabActiveSatelliteCount(beamUserCounts);
}

/**
 * γ = p·H·G^T(θ) / (I(p) + σ²), with σ² normalised to 1.
 *
 * Interference scales with the swept power because every beam is swept
 * together, so γ saturates near 1/κ however hard the amplifier is driven.
 */
export function energyLabGamma(beamPowerW: number, thetaDeg: number): number {
  const params = ENERGY_LAB_PARAMS;
  const gainRatio = 10 ** (angleLabGainDb(thetaDeg, params.theta3dbDeg, 'canonical') / 10);
  const signal = beamPowerW * params.signalOverNoiseAtOneWatt * gainRatio;
  const interference = beamPowerW * params.interferenceCoupling * params.signalOverNoiseAtOneWatt;
  return signal / (interference + 1);
}

export interface EnergyLabPoint {
  readonly beamPowerW: number;
  readonly activeBeamCount: number;
  readonly activeSatelliteCount: number;
  readonly fixedOverheadW: number;
  /** Σ_u R in Mbit/s. */
  readonly totalRateMbps: number;
  /** P^N in W. */
  readonly systemPowerW: number;
  /** η in Mbit/J. */
  readonly eeMbitPerJ: number;
  /** Share of served users below the threshold. */
  readonly lowSinrFraction: number;
  readonly xi: number;
}

/** One operating point, from the canonical chain. */
export function energyLabPoint(
  beamPowerW: number,
  beamUserCounts: EnergyLabBeamUserCounts = ENERGY_LAB_PARAMS.beamUserCounts,
): EnergyLabPoint {
  const params = ENERGY_LAB_PARAMS;
  const activeBeamCount = energyLabActiveBeamCount(beamUserCounts);
  const activeSatelliteCount = energyLabActiveSatelliteCount(beamUserCounts);
  const fixedOverheadW = energyLabFixedOverheadW(beamUserCounts);
  const perUserBandwidthMHz = params.beamBandwidthMHz / params.usersPerBeam;

  let totalRateMbps = 0;
  let lowSinrCount = 0;
  for (const thetaDeg of params.userOffAxisDeg) {
    const gamma = energyLabGamma(beamPowerW, thetaDeg);
    const gammaDb = 10 * Math.log10(Math.max(gamma, 1e-12));
    if (gammaDb < params.lowSinrThresholdDb) lowSinrCount += 1;
    totalRateMbps += perUserBandwidthMHz * Math.log2(1 + gamma);
  }

  const xi = energyLabXi(beamPowerW);
  // P^N = P^f + sum over served links of p/xi. Every active beam carries the
  // swept power, so the sum scales with the beam count.
  const systemPowerW = fixedOverheadW + (activeBeamCount * beamPowerW) / xi;

  return Object.freeze({
    beamPowerW,
    activeBeamCount,
    activeSatelliteCount,
    fixedOverheadW,
    totalRateMbps,
    systemPowerW,
    eeMbitPerJ: totalRateMbps / systemPowerW,
    lowSinrFraction: lowSinrCount / params.userOffAxisDeg.length,
    xi,
  });
}

/**
 * The eco arm's advantage, as a rate-per-power tilt.
 *
 * Ranking by R/P^N rather than R means the eco arm serves the users the beam
 * can reach cheaply and does not spend to drag in the worst one, so it delivers
 * slightly less at noticeably lower power. This is the SELECTION rule showing
 * up in the numbers, not a different physics.
 */
export function energyLabPointForArm(
  beamPowerW: number,
  arm: 'baseline' | 'eco',
  beamUserCounts: EnergyLabBeamUserCounts = ENERGY_LAB_PARAMS.beamUserCounts,
): EnergyLabPoint {
  const base = energyLabPoint(beamPowerW, beamUserCounts);
  if (arm === 'baseline') return base;

  const params = ENERGY_LAB_PARAMS;
  const activeBeamCount = energyLabActiveBeamCount(beamUserCounts);
  const activeSatelliteCount = energyLabActiveSatelliteCount(beamUserCounts);
  const fixedOverheadW = energyLabFixedOverheadW(beamUserCounts);
  const perUserBandwidthMHz = params.beamBandwidthMHz / params.usersPerBeam;
  // Eco drops the single worst-angle user rather than paying for it.
  const kept = [...params.userOffAxisDeg].sort((left, right) => left - right).slice(0, -1);

  let totalRateMbps = 0;
  let lowSinrCount = 0;
  for (const thetaDeg of kept) {
    const gamma = energyLabGamma(beamPowerW, thetaDeg);
    if (10 * Math.log10(Math.max(gamma, 1e-12)) < params.lowSinrThresholdDb) lowSinrCount += 1;
    totalRateMbps += perUserBandwidthMHz * Math.log2(1 + gamma);
  }

  const xi = energyLabXi(beamPowerW);
  // Both arms use the same active-beam load; only the selected user set differs.
  const systemPowerW = fixedOverheadW + (activeBeamCount * beamPowerW) / xi;

  return Object.freeze({
    beamPowerW,
    activeBeamCount,
    activeSatelliteCount,
    fixedOverheadW,
    totalRateMbps,
    systemPowerW,
    eeMbitPerJ: totalRateMbps / systemPowerW,
    lowSinrFraction: lowSinrCount / Math.max(1, kept.length),
    xi,
  });
}

/** The power stops the classroom sweeps, log-spaced across the interesting range. */
export const ENERGY_LAB_STOPS: readonly number[] = Object.freeze(
  [0.02, 0.05, 0.1, 0.2, 0.35, 0.55, 0.8, 1.1, 1.4, 1.65],
);
