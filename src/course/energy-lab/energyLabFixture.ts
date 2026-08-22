/**
 * Act 5's classroom fixture.
 *
 * The sweep needs a run to sweep. Until the live-replay bridge is wired to a
 * running simulator this computes the same quantities from the canonical
 * definitions over a pinned synthetic UE set: real formulas, stated parameters,
 * one deterministic frame set.
 *
 * Everything here is badged DEMO. The formulas are the authority's; the
 * PARAMETERS are classroom values chosen so the EE peak lands mid-slider, and
 * they are not the study's pinned set. Swapping them for pinned ones later
 * changes numbers, not structure.
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
 * ξ and P^f are NOT classroom choices any more: ADR-006 fixes both, and the
 * earlier power-dependent ξ this file used is the alternative that ADR is on
 * record rejecting. The remaining DEMO values are the channel/interference
 * terms, which the contract leaves as scenario quantities.
 */
export const ENERGY_LAB_PARAMS = Object.freeze({
  /** Per-beam bandwidth B^w in MHz (500 MHz over 3-colour reuse). */
  beamBandwidthMHz: 500 / 3,
  /** Users sharing one beam, U_{s,v}. */
  usersPerBeam: 4,
  /**
   * Active beams and satellites, which is what P^f is a function of.
   * ADR-008's fixture geometry: one satellite, seven beams.
   */
  activeBeamCount: 7,
  activeSatelliteCount: 1,
  /** ADR-006: per-active-RF-chain circuit assumption, W. */
  circuitPowerPerBeamW: 0.338,
  /** ADR-006: per-active-satellite baseband assumption, W. */
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
  /**
   * ADR-006 §29: ξ = 0.35 for every served UE-link, CONSTANT.
   *
   * Not a function of p. ADR-006 lists the power-dependent form among its
   * rejected alternatives, because it makes ξ depend on the cap semantics the
   * single-SINR contract removed.
   */
  xi: 0.35,
  /** Off-axis angles of the served users, in degrees. */
  userOffAxisDeg: Object.freeze([0.2, 1.1, 2.4, 3.6]),
  /** Below this the link is treated as failing, matching the engine's rule. */
  lowSinrThresholdDb: -5,
});

/** ADR-006's constant effective RF-to-supply efficiency. */
export function energyLabXi(): number {
  return ENERGY_LAB_PARAMS.xi;
}

/**
 * P^f = 0.338 W x N_active_beam + 0.2 W x N_active_satellite  (ADR-006).
 *
 * Derived, not chosen: the earlier hand-picked 3 W happened to land near this,
 * which is exactly why a hand-picked constant is dangerous.
 */
export function energyLabFixedOverheadW(): number {
  const params = ENERGY_LAB_PARAMS;
  return params.circuitPowerPerBeamW * params.activeBeamCount
    + params.basebandPowerPerSatelliteW * params.activeSatelliteCount;
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
export function energyLabPoint(beamPowerW: number): EnergyLabPoint {
  const params = ENERGY_LAB_PARAMS;
  const perUserBandwidthMHz = params.beamBandwidthMHz / params.usersPerBeam;

  let totalRateMbps = 0;
  let lowSinrCount = 0;
  for (const thetaDeg of params.userOffAxisDeg) {
    const gamma = energyLabGamma(beamPowerW, thetaDeg);
    const gammaDb = 10 * Math.log10(Math.max(gamma, 1e-12));
    if (gammaDb < params.lowSinrThresholdDb) lowSinrCount += 1;
    totalRateMbps += perUserBandwidthMHz * Math.log2(1 + gamma);
  }

  const xi = energyLabXi();
  // P^N = P^f + sum over served links of p/xi. Every active beam carries the
  // swept power, so the sum scales with the beam count.
  const systemPowerW = energyLabFixedOverheadW() + (params.activeBeamCount * beamPowerW) / xi;

  return Object.freeze({
    beamPowerW,
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
export function energyLabPointForArm(beamPowerW: number, arm: 'baseline' | 'eco'): EnergyLabPoint {
  const base = energyLabPoint(beamPowerW);
  if (arm === 'baseline') return base;

  const params = ENERGY_LAB_PARAMS;
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

  const xi = energyLabXi();
  // Eco serves one fewer link, so one fewer link draws p/xi.
  const systemPowerW = energyLabFixedOverheadW()
    + ((params.activeBeamCount - 1) * beamPowerW) / xi;

  return Object.freeze({
    beamPowerW,
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
