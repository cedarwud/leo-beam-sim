/**
 * Teaching energy / power-train model — SIMULATED TEACHING, not paper reproduction.
 *
 * This module is intentionally a separate, purpose-built layer from
 * `src/utils/paperEnergyEfficiency.ts`. That file computes a single-instant,
 * load-dependent, cross-UE average bit/J snapshot; it has no time integration,
 * no PA efficiency, no circuit power, and no delivered-data concept. This file
 * exists to teach the *other* half of the story: how RF Tx power turns into a
 * total electrical power draw (PA input + fixed teaching circuit power), and how a
 * Shannon-capped teaching throughput number is derived from SINR. Neither
 * concept here should ever be blended with `paperEnergyEfficiency.ts`'s output.
 *
 * This file owns the *instantaneous* half of the story plus the tuning knobs,
 * including the per-handover energy cost `e_HO`. The event counting and the
 * `E_HO = N * e_HO` product live one layer up, in `energyLedger.ts`, because
 * they are only meaningful over an accumulation window.
 *
 * Pure functions only: no React, no scene, no App imports. See
 * `src/teaching/energyLedger.ts` for the time-integration layer that turns
 * these instantaneous quantities into a run-level (Σ Mbit / Σ J) reading.
 */

import { sumInstantaneousPowerW } from './canonicalEnergyEfficiency';

export interface EnergyTuningState {
  /** eta_PA: fraction of PA input power that becomes RF output power. */
  readonly paEfficiency: number; // 0.05..1, default 0.35
  /** Fixed teaching-only electronics/circuit power draw, in watts. */
  readonly circuitPowerW: number; // 0..100, default/reset 3 W
  /**
   * e_HO: energy charged to the ledger for each handover event, in joules.
   *
   * Optional so that callers written before this knob existed still compile;
   * when omitted, `resolveEnergyPerHandoverJ` substitutes
   * `DEFAULT_ENERGY_PER_HANDOVER_J`. An explicit `0` is a legitimate setting
   * that switches the handover term off and reduces the ledger to the
   * radio-only behaviour it had before this knob existed. A non-finite or
   * negative value is a broken configuration and fails closed to `null`.
   *
   * Sizing rationale — see `DEFAULT_ENERGY_PER_HANDOVER_J`.
   */
  readonly energyPerHandoverJ?: number; // 0..500, default 3
}

/**
 * Authoritative default per-handover energy, in joules.
 *
 * This is a teaching parameter, not a hardware measurement. At the reference
 * configuration below, 3 J per handover keeps the handover term present in
 * the total-energy calculation without making it dominate the radio term:
 *
 *   P_tx = 50 dBm  ->  P_RF   = 10^(50/10)/1000        = 100 W
 *   eta_PA = 0.35  ->  P_PA   = 100 / 0.35             = 285.71 W
 *   P_circuit = 3  ->  P_total = 285.71 + 3            = 288.71 W
 *   60 s run       ->  E_radio = 288.71 * 60           = 17 322.9 J
 *
 * Handover cadence in that same reference setup is bounded by the handover
 * policy itself: triggerTimeSec (TTT) = 3.5 s plus pingPongGuardSec = 5 s puts
 * a floor of ~8.5 s between inter-satellite handovers, and each serving epoch
 * admits at most 2 intra-beam switches. A 60 s window therefore realistically
 * logs N ~ 6..14 events; N = 10 is the working reference.
 *
 * With N = 10, E_HO = 30 J and the handover share is about 0.17%; at N = 6..14
 * it remains below 0.25% of the reference total.
 */
export const DEFAULT_ENERGY_PER_HANDOVER_J = 3;

export const DEFAULT_ENERGY_TUNING: EnergyTuningState = {
  paEfficiency: 0.35,
  circuitPowerW: 3,
  energyPerHandoverJ: DEFAULT_ENERGY_PER_HANDOVER_J,
};

/**
 * Slider bounds for the tuning knobs.
 *
 * `energyPerHandoverJ`:
 * - min 0 turns the term off entirely (degenerates to the radio-only ledger),
 *   so a student can A/B the handover term against its own absence;
 * - max 500 J is ~1.73 s of the reference 288.71 W draw per handover; at N = 10
 *   over 60 s that is 5 000 J against 17 322.9 J of radio energy, i.e. 22.5% of
 *   the total (36.7% at N = 20). Enough to make the ping-pong lesson dramatic,
 *   not enough for the readout to become pure handover accounting;
 * - step 1 J keeps the authoritative 3 J default on an exact HTML range
 *   position, so the control's displayed and accessibility values agree with
 *   the model state.
 */
export const ENERGY_TUNING_RANGES: Record<keyof EnergyTuningState, { min: number; max: number; step: number }> = {
  paEfficiency: { min: 0.05, max: 1, step: 0.01 },
  circuitPowerW: { min: 0, max: 100, step: 1 },
  energyPerHandoverJ: { min: 0, max: 500, step: 1 },
};

/**
 * Resolves the per-handover energy a caller actually wants charged.
 *
 * - omitted / `undefined` -> `DEFAULT_ENERGY_PER_HANDOVER_J`. This is the
 *   "caller predates the knob" case, not an "unknown value" case, so it takes
 *   the documented default rather than failing closed.
 * - non-finite or negative -> `null`. A negative handover cost would make
 *   handing over *generate* energy, and a NaN would poison the ledger; both are
 *   broken configurations, and the ledger must render an absent value rather
 *   than a fabricated number.
 * - otherwise the value itself, including an explicit `0`.
 */
export function resolveEnergyPerHandoverJ(
  tuning: Pick<EnergyTuningState, 'energyPerHandoverJ'>,
): number | null {
  const { energyPerHandoverJ } = tuning;
  if (energyPerHandoverJ === undefined) return DEFAULT_ENERGY_PER_HANDOVER_J;
  if (!Number.isFinite(energyPerHandoverJ) || energyPerHandoverJ < 0) return null;
  return energyPerHandoverJ;
}

export interface PowerTrainBreakdown {
  readonly txPowerDbm: number;
  /** 10^(dBm/10) / 1000 */
  readonly rfTxPowerW: number;
  /** rfTxPowerW / paEfficiency */
  readonly paInputW: number;
  readonly circuitPowerW: number;
  /** paInputW + teaching circuitPowerW — a simulated teaching total in W. */
  readonly totalPowerW: number;
}

/**
 * Converts a Tx power (dBm) and tuning knobs into a full power-train
 * breakdown. Fails closed: any non-finite intermediate, a non-positive
 * paEfficiency, or a non-positive total power returns `null` rather than a
 * fabricated 0 or Infinity. A `null` here means "this reading is not
 * trustworthy," and callers must render an absent/dash state, never a zero.
 */
export function computePowerTrain(
  txPowerDbm: number,
  tuning: EnergyTuningState,
): PowerTrainBreakdown | null {
  if (!Number.isFinite(txPowerDbm)) return null;

  const { paEfficiency, circuitPowerW } = tuning;
  if (!Number.isFinite(paEfficiency) || paEfficiency <= 0) return null;
  if (!Number.isFinite(circuitPowerW) || circuitPowerW < 0) return null;

  const rfTxPowerW = Math.pow(10, txPowerDbm / 10) / 1000;
  if (!Number.isFinite(rfTxPowerW) || rfTxPowerW < 0) return null;

  const paInputW = rfTxPowerW / paEfficiency;
  if (!Number.isFinite(paInputW)) return null;

  const totalPowerW = sumInstantaneousPowerW([
    { label: 'teaching PA input', powerW: paInputW },
    { label: 'teaching circuitPowerW knob', powerW: circuitPowerW },
  ]);
  if (!Number.isFinite(totalPowerW) || totalPowerW <= 0) return null;

  return {
    txPowerDbm,
    rfTxPowerW,
    paInputW,
    circuitPowerW,
    totalPowerW,
  };
}

export interface TeachingThroughputArgs {
  readonly sinrDb: number;
  readonly bandwidthMHz: number;
  readonly frequencyReuse: number;
}

/**
 * Teaching-grade Shannon throughput: bandwidthMHz * spectralEff / frequencyReuse,
 * where spectralEff = min(8, max(0, log2(1 + 10^(sinrDb/10)))) bit/s/Hz.
 *
 * Semantics mirrored (read-only reference) from
 * `/home/u24/papers/beamshift/src/teaching/experiment/run.ts` `spectralEfficiency()`
 * (~L220-223) and its throughput usage (~L365-376).
 *
 * - -Infinity is the explicit "no service currently" sentinel and returns `0`.
 * - NaN and +Infinity are invalid upstream readings and fail closed to `null`.
 * - A non-finite or non-positive bandwidthMHz/frequencyReuse is an invalid
 *   configuration, so this fails closed to `null`.
 */
export function computeTeachingThroughputMbps(args: TeachingThroughputArgs): number | null {
  const { sinrDb, bandwidthMHz, frequencyReuse } = args;

  if (!Number.isFinite(bandwidthMHz) || bandwidthMHz <= 0) return null;
  if (!Number.isFinite(frequencyReuse) || frequencyReuse <= 0) return null;

  if (sinrDb === Number.NEGATIVE_INFINITY) {
    // No service is a legitimate outcome: zero throughput is the honest answer.
    return 0;
  }
  if (!Number.isFinite(sinrDb)) return null;

  const linearSinr = Math.pow(10, sinrDb / 10);
  const spectralEff = Math.min(8, Math.max(0, Math.log2(1 + linearSinr)));
  return (bandwidthMHz * spectralEff) / frequencyReuse;
}
