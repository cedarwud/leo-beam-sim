/**
 * Tier 5: Small-scale fading models for NTN channels.
 *
 * Implements two small-scale fading models for NTN channels:
 *
 * 1. Shadowed-Rician (SR) — standard 3GPP TR 38.811 model:
 *    h = sqrt(X)·exp(jθ) + Y + jZ
 *    where X ~ Gamma(m, Ω/m), Y,Z ~ N(0, b₀)
 *
 * 2. Loo model (A3) — 3-component land mobile satellite channel:
 *    r(t) = z(t) · exp(jφ(t)) + x(t) + jy(t)
 *    where z(t) ~ lognormal(μ_z, σ_z) (LOS shadowing),
 *          x,y ~ N(0, σ_m) (NLOS multipath Rayleigh),
 *    suitable for tree-shadowing scenarios (low-elevation suburban/rural).
 *    Particularly used in papers comparing terrestrial and satellite channels.
 *
 * Paper sources:
 *   - PAP-2021-SHADOWED-RICIAN: SR fading model derivation and parameters
 *   - PAP-2024-MADRL-CORE: Loo model application in LEO NTN
 *   - 3GPP TR 38.811 §6.7: small-scale fading reference
 *   - Loo (1985) IEEE Trans. Veh. Technol.: original Loo model derivation
 *
 * Governance:
 *   - SDD: sdd/ntn-sim-core-sdd.md §9.2
 *   - This file must not import React, Three.js, or scene code.
 */

// ---------------------------------------------------------------------------
// SR Parameters by elevation (suburban S-band)
// Source: PAP-2021-SHADOWED-RICIAN Table II (suburban, S-band 2GHz)
// ---------------------------------------------------------------------------

interface SrParams {
  m: number;    // Nakagami shape parameter
  b0: number;   // Average scattered power
  omega: number; // Average LOS power
}

/** Elevation angles for SR parameter lookup. */
const SR_ELEVATIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

/** SR parameters for suburban S-band LOS. */
const SR_S_SUBURBAN_LOS: readonly SrParams[] = [
  { m: 5.0,  b0: 0.063, omega: 0.94 },  // 10°
  { m: 10.0, b0: 0.035, omega: 0.97 },  // 20°
  { m: 12.0, b0: 0.025, omega: 0.98 },  // 30°
  { m: 15.0, b0: 0.018, omega: 0.99 },  // 40°
  { m: 17.0, b0: 0.012, omega: 0.99 },  // 50°
  { m: 19.0, b0: 0.008, omega: 1.00 },  // 60°
  { m: 20.0, b0: 0.005, omega: 1.00 },  // 70°
  { m: 20.0, b0: 0.003, omega: 1.00 },  // 80°
  { m: 20.0, b0: 0.002, omega: 1.00 },  // 90°
];

/** SR parameters for suburban S-band NLOS. */
const SR_S_SUBURBAN_NLOS: readonly SrParams[] = [
  { m: 0.5,  b0: 0.30, omega: 0.10 },  // 10°
  { m: 1.0,  b0: 0.25, omega: 0.15 },  // 20°
  { m: 1.5,  b0: 0.22, omega: 0.20 },  // 30°
  { m: 2.0,  b0: 0.20, omega: 0.25 },  // 40°
  { m: 2.5,  b0: 0.18, omega: 0.30 },  // 50°
  { m: 3.0,  b0: 0.15, omega: 0.35 },  // 60°
  { m: 4.0,  b0: 0.12, omega: 0.40 },  // 70°
  { m: 5.0,  b0: 0.10, omega: 0.45 },  // 80°
  { m: 5.0,  b0: 0.08, omega: 0.50 },  // 90°
];

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

function lerpParams(a: SrParams, b: SrParams, t: number): SrParams {
  return {
    m: a.m + (b.m - a.m) * t,
    b0: a.b0 + (b.b0 - a.b0) * t,
    omega: a.omega + (b.omega - a.omega) * t,
  };
}

function getSrParams(elevationDeg: number, isLos: boolean): SrParams {
  const table = isLos ? SR_S_SUBURBAN_LOS : SR_S_SUBURBAN_NLOS;
  const el = Math.max(SR_ELEVATIONS[0], Math.min(SR_ELEVATIONS[SR_ELEVATIONS.length - 1], elevationDeg));

  let lo = 0;
  for (let i = 0; i < SR_ELEVATIONS.length - 1; i++) {
    if (SR_ELEVATIONS[i + 1] >= el) { lo = i; break; }
  }
  const hi = Math.min(lo + 1, SR_ELEVATIONS.length - 1);

  if (lo === hi) return table[lo];
  const t = (el - SR_ELEVATIONS[lo]) / (SR_ELEVATIONS[hi] - SR_ELEVATIONS[lo]);
  return lerpParams(table[lo], table[hi], t);
}

// ---------------------------------------------------------------------------
// Gamma variate (Marsaglia & Tsang method)
// ---------------------------------------------------------------------------

/**
 * Sample from Gamma(shape, scale) distribution using Marsaglia & Tsang.
 * For shape ≥ 1: direct. For shape < 1: use boost method.
 */
function sampleGamma(shape: number, scale: number, rngNext: () => number): number {
  if (shape < 1) {
    // Boost: Gamma(a) = Gamma(a+1) * U^(1/a)
    const boost = sampleGamma(shape + 1, 1, rngNext);
    const u = rngNext();
    return scale * boost * Math.pow(u === 0 ? 1e-10 : u, 1 / shape);
  }

  // Marsaglia & Tsang for shape ≥ 1
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (;;) {
    let x: number;
    let v: number;

    do {
      // Standard normal via Box-Muller
      const u1 = rngNext();
      const u2 = rngNext();
      x = Math.sqrt(-2 * Math.log(u1 === 0 ? 1e-10 : u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = rngNext();
    const xSq = x * x;

    if (u < 1 - 0.0331 * xSq * xSq) return scale * d * v;
    if (Math.log(u === 0 ? 1e-10 : u) < 0.5 * xSq + d * (1 - v + Math.log(v))) return scale * d * v;
  }
}

// ---------------------------------------------------------------------------
// Loo model parameters (A3)
// Source: Loo (1985); beamHO-bench/src/sim/channel/small-scale.ts
// ---------------------------------------------------------------------------

interface LooParams {
  /** Mean of log-normal LOS component amplitude (dB). */
  muZ_dB: number;
  /** Std-dev of log-normal LOS component shadowing (dB). */
  sigmaZ_dB: number;
  /** Std-dev of NLOS multipath component (linear, per-axis). */
  sigmaM: number;
}

/**
 * Loo model parameters by elevation angle (suburban, S-band).
 * Columns: muZ_dB (mean LOS dB), sigmaZ_dB (LOS shadow σ dB), sigmaM (NLOS Rayleigh σ).
 * Values derived from Loo (1985) Table I and beamHO-bench calibration.
 *
 * @source Loo (1985) IEEE Trans. Veh. Technol. 34(3), Table I
 * @source beamHO-bench/src/sim/channel/small-scale.ts
 */
const LOO_ELEVATIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

const LOO_S_SUBURBAN: readonly LooParams[] = [
  { muZ_dB: -3.0, sigmaZ_dB: 5.0, sigmaM: 0.30 },  // 10°
  { muZ_dB: -1.5, sigmaZ_dB: 4.0, sigmaM: 0.25 },  // 20°
  { muZ_dB: -0.8, sigmaZ_dB: 3.2, sigmaM: 0.20 },  // 30°
  { muZ_dB: -0.4, sigmaZ_dB: 2.5, sigmaM: 0.16 },  // 40°
  { muZ_dB: -0.2, sigmaZ_dB: 2.0, sigmaM: 0.13 },  // 50°
  { muZ_dB: -0.1, sigmaZ_dB: 1.5, sigmaM: 0.10 },  // 60°
  { muZ_dB:  0.0, sigmaZ_dB: 1.2, sigmaM: 0.08 },  // 70°
  { muZ_dB:  0.0, sigmaZ_dB: 1.0, sigmaM: 0.06 },  // 80°
  { muZ_dB:  0.0, sigmaZ_dB: 0.8, sigmaM: 0.05 },  // 90°
];

function getLooParams(elevationDeg: number): LooParams {
  const el = Math.max(LOO_ELEVATIONS[0], Math.min(LOO_ELEVATIONS[LOO_ELEVATIONS.length - 1], elevationDeg));
  let lo = 0;
  for (let i = 0; i < LOO_ELEVATIONS.length - 1; i++) {
    if (LOO_ELEVATIONS[i + 1] >= el) { lo = i; break; }
  }
  const hi = Math.min(lo + 1, LOO_ELEVATIONS.length - 1);
  if (lo === hi) return LOO_S_SUBURBAN[lo];
  const t = (el - LOO_ELEVATIONS[lo]) / (LOO_ELEVATIONS[hi] - LOO_ELEVATIONS[lo]);
  const a = LOO_S_SUBURBAN[lo], b = LOO_S_SUBURBAN[hi];
  return {
    muZ_dB:    a.muZ_dB    + (b.muZ_dB    - a.muZ_dB)    * t,
    sigmaZ_dB: a.sigmaZ_dB + (b.sigmaZ_dB - a.sigmaZ_dB) * t,
    sigmaM:    a.sigmaM    + (b.sigmaM    - a.sigmaM)    * t,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sample Shadowed-Rician fading power in dB.
 *
 * Returns the fading gain/loss in dB (can be positive or negative).
 * Mean fading power is 0 dB (normalized).
 *
 * @tier paper-backed
 * @source PAP-2021-SHADOWED-RICIAN, 3GPP TR 38.811 §6.7
 *
 * @param elevationDeg — elevation angle in degrees
 * @param isLos — LOS condition
 * @param rngNext — seeded RNG function returning [0, 1)
 * @returns fading power in dB
 */
export function sampleShadowedRicianDb(
  elevationDeg: number,
  isLos: boolean,
  rngNext: () => number,
): number {
  const params = getSrParams(elevationDeg, isLos);

  // LOS component amplitude: X ~ Gamma(m, Ω/m), take sqrt for envelope
  const losAmplitude = Math.sqrt(sampleGamma(params.m, params.omega / params.m, rngNext));

  // Scattered components: Y, Z ~ N(0, b₀)
  const u1 = rngNext();
  const u2 = rngNext();
  const r = Math.sqrt(-2 * Math.log(u1 === 0 ? 1e-10 : u1));
  const scatterY = Math.sqrt(params.b0) * r * Math.cos(2 * Math.PI * u2);
  const scatterZ = Math.sqrt(params.b0) * r * Math.sin(2 * Math.PI * u2);

  // Random phase for LOS component
  const theta = rngNext() * 2 * Math.PI;
  const realPart = losAmplitude * Math.cos(theta) + scatterY;
  const imagPart = losAmplitude * Math.sin(theta) + scatterZ;

  // Channel power |h|²
  const powerLinear = realPart * realPart + imagPart * imagPart;

  // Normalize: mean power should be Ω + 2*b₀
  const meanPower = params.omega + 2 * params.b0;
  const normalizedPower = powerLinear / meanPower;

  // Convert to dB (0 dB mean, can be positive or negative)
  return 10 * Math.log10(normalizedPower > 1e-30 ? normalizedPower : 1e-30);
}

/**
 * Sample Loo fading power in dB (A3).
 *
 * Loo model: r(t) = z(t)·exp(jφ) + x + jy
 *   z ~ LogNormal(μ_z, σ_z) — LOS component with multiplicative shadowing
 *   x,y ~ N(0, σ_m)         — NLOS scattered components (Rayleigh)
 *
 * The lognormal shadowing captures slow tree/building occlusion of the LOS path.
 * At low elevation angles (10–30°), σ_z is large and shadowing dominates.
 * At high elevation angles (>60°), the model converges toward Rician.
 *
 * @tier paper-backed
 * @source Loo (1985) IEEE Trans. Veh. Technol. 34(3)
 * @source beamHO-bench/src/sim/channel/small-scale.ts
 *
 * @param elevationDeg — elevation angle in degrees
 * @param rngNext — seeded RNG function returning [0, 1)
 * @returns fading power in dB (normalized, mean ≈ 0 dB)
 */
export function sampleLooDb(
  elevationDeg: number,
  rngNext: () => number,
): number {
  const p = getLooParams(elevationDeg);

  // z ~ LogNormal(μ_z [dB], σ_z [dB]) — LOS amplitude envelope
  // Convert dB params to natural log space: μ_ln = μ_dB/(20/ln10), σ_ln = σ_dB/(20/ln10)
  const dBtoLn = Math.log(10) / 20;
  const muLn    = p.muZ_dB    * dBtoLn;
  const sigmaLn = p.sigmaZ_dB * dBtoLn;

  // Sample standard normal via Box-Muller for z
  const u1z = rngNext(), u2z = rngNext();
  const normalZ = Math.sqrt(-2 * Math.log(u1z === 0 ? 1e-10 : u1z)) * Math.cos(2 * Math.PI * u2z);
  const zAmplitude = Math.exp(muLn + sigmaLn * normalZ);

  // Random phase for LOS component
  const theta = rngNext() * 2 * Math.PI;

  // NLOS Rayleigh: x, y ~ N(0, sigmaM)
  const u1m = rngNext(), u2m = rngNext();
  const r = Math.sqrt(-2 * Math.log(u1m === 0 ? 1e-10 : u1m));
  const x = p.sigmaM * r * Math.cos(2 * Math.PI * u2m);
  const y = p.sigmaM * r * Math.sin(2 * Math.PI * u2m);

  const realPart = zAmplitude * Math.cos(theta) + x;
  const imagPart = zAmplitude * Math.sin(theta) + y;

  // Channel power |r|²
  const powerLinear = realPart * realPart + imagPart * imagPart;

  // Normalize: expected power = E[z²] + 2·σ_m² = exp(2μ_ln + 2σ_ln²) + 2·σ_m²
  const meanLos  = Math.exp(2 * muLn + 2 * sigmaLn * sigmaLn);
  const meanNlos = 2 * p.sigmaM * p.sigmaM;
  const meanPower = meanLos + meanNlos;

  const normalizedPower = powerLinear / (meanPower > 0 ? meanPower : 1);
  return 10 * Math.log10(normalizedPower > 1e-30 ? normalizedPower : 1e-30);
}
