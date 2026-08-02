/**
 * R1 energy efficiency (η) — the MODQN reward-surface EE term, computed live
 * from the SINR this simulator already renders.
 *
 * ## Provenance — the formula is ported, not invented
 *
 * Source of truth: `modqn-paper-reproduction` (the paper reproduction repo).
 * Three call sites there agree on one value, and this module reproduces it:
 *
 * 1. `env/family_b_step.py` (rate, ~L740):
 *        thr_u = b_alloc_hz / load * log2(1 + sinr_u)
 * 2. `env/family_b_step.py` (`_compute_rewards`, r1 EE credit):
 *        allocated_power = beam_power_w / load
 *        r1_ee_credit    = thr_u / allocated_power
 * 3. `analysis/family_b_recalibration.py::family_b_eta_r1` — the eval-axis twin
 *    of (2), routed through `runtime/angle_aware_ee.per_ue_energy_efficiency`.
 *    For a single admitted link the beam share `alpha` collapses to ~1, so its
 *    `eta = R_u / p_alloc` is numerically the same quantity (that repo verifies
 *    the two agree to ~1e-11).
 *
 * ## Why beam load does NOT appear below
 *
 * `load` divides the numerator (rate) and the denominator (allocated power)
 * identically, so it cancels exactly:
 *
 *        η = (B_alloc/load · log2(1+γ)) / (P_beam/load)
 *          =  B_alloc · log2(1+γ) / P_beam
 *
 * This is a property of the reference formula, not a simplification made here.
 * It is also what makes this term safe to render on the live lane: it needs no
 * per-beam UE count, so it never has to consume `ModqnServiceMap`'s
 * `ueCountByCellId` — that projection is `claimKind: 'overlay-demo'` and would
 * have dragged demo-grade provenance into a displayed number (see
 * `src/scene/beamLoadContention.ts` for why that projection is not beam truth).
 *
 * ## Scope of the claim (binding)
 *
 * This is the STANDARD angle-aware EE, i.e. the reference's
 * `r1_energy_efficiency_credit` / `family_b_eta_r1`. Transmit power is
 * angle-INDEPENDENT; the geometry enters only through the numerator
 * (antenna gain → SINR → rate). It is a REWARD-SURFACE ratio in bit/joule.
 *
 * It is deliberately NOT any of the reference's sibling EE surfaces:
 *   - NOT `family_b_physical_ee` (physical consumed power: PA efficiency,
 *     circuit + baseband power). So this number carries no "physical energy
 *     saving" claim.
 *   - NOT `r1_hobs_active_tx_ee` (the system-wide active-TX EE aggregate). So
 *     it carries no "active-TX EE recovery" claim.
 *   - NOT `r1_beam_power_efficiency_credit` (`R_u / P_beam`, which keeps the
 *     load term and is a different quantity).
 * Those three are exactly the EE claims the live lane forbids
 * (`src/app/liveClaimBoundary.ts`); keeping to the r1 reward term is what keeps
 * this readout inside the live boundary.
 */

/** Per-beam transmit power: dBm → watts. */
function dbmToWatts(dbm: number): number {
  return 10 ** ((dbm - 30) / 10);
}

export interface R1EnergyEfficiencyInput {
  /** Live SINR of the serving link, in dB. */
  readonly sinrDb: number | null;
  /**
   * EFFECTIVE per-beam transmit power in dBm — the value the link budget
   * actually used for this beam (`LinkBudgetTerms.txPowerDbm`), which already
   * reflects any beam power-control override. NOT EIRP: the reference prices
   * the denominator with transmit power, since antenna gain belongs inside the
   * SINR numerator only.
   */
  readonly txPowerDbm: number | null;
  /** Total channel bandwidth in MHz (`profile.channel.bandwidthMHz`). */
  readonly bandwidthMHz: number;
  /**
   * Frequency-reuse factor (`profile.beams.frequencyReuse`). The reference
   * hardcodes `b_alloc_hz = bandwidth_hz / 3.0` for its 3-colour reuse; here the
   * profile's own reuse factor is the divisor, so a profile that declares reuse
   * 3 reproduces the reference exactly.
   */
  readonly frequencyReuse: number;
}

export interface R1EnergyEfficiency {
  /** η in bit/joule (equivalently bit/s per watt). */
  readonly bitsPerJoule: number;
  /** Allocated bandwidth actually used as the numerator's B, in Hz. */
  readonly allocatedBandwidthHz: number;
  /** Shannon rate for this link, in bit/s. */
  readonly rateBitsPerSec: number;
  /** Per-beam transmit power used as the denominator, in watts. */
  readonly txPowerW: number;
}

/**
 * Compute the r1 EE term for one serving link. Returns `null` when any input is
 * missing or non-physical — the caller renders a placeholder rather than a
 * fabricated number.
 */
export function computeR1EnergyEfficiency(
  input: R1EnergyEfficiencyInput,
): R1EnergyEfficiency | null {
  const { sinrDb, txPowerDbm, bandwidthMHz, frequencyReuse } = input;

  if (sinrDb === null || !Number.isFinite(sinrDb)) return null;
  if (txPowerDbm === null || !Number.isFinite(txPowerDbm)) return null;
  if (!Number.isFinite(bandwidthMHz) || bandwidthMHz <= 0) return null;
  if (!Number.isFinite(frequencyReuse) || frequencyReuse <= 0) return null;

  const txPowerW = dbmToWatts(txPowerDbm);
  if (!Number.isFinite(txPowerW) || txPowerW <= 0) return null;

  const allocatedBandwidthHz = (bandwidthMHz * 1e6) / frequencyReuse;

  // `max(sinr, 0)` mirrors the reference rate line: a non-positive linear SINR
  // contributes no rate rather than a negative log.
  const sinrLinear = Math.max(10 ** (sinrDb / 10), 0);
  const rateBitsPerSec = allocatedBandwidthHz * Math.log2(1 + sinrLinear);

  const bitsPerJoule = rateBitsPerSec / txPowerW;
  if (!Number.isFinite(bitsPerJoule)) return null;

  return { bitsPerJoule, allocatedBandwidthHz, rateBitsPerSec, txPowerW };
}
