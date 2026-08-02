#!/usr/bin/env node
/**
 * Model gate for the r1 energy-efficiency term rendered beside the live SINR.
 *
 * Asserts the CONTRACT against `modqn-paper-reproduction`, not source text:
 *
 *  A. Reference parity — reproduce the reference's own two-step r1 EE credit
 *     (`env/family_b_step.py::_compute_rewards`: rate = b_alloc/load·log2(1+γ),
 *     allocated_power = P_beam/load, credit = rate/allocated_power) from the
 *     live single-expression port.
 *  B. Load cancellation — the keystone. The reference's credit is invariant to
 *     beam load; if this port ever drifts into a load-dependent form, the sweep
 *     below separates it. This invariant is why the live readout needs no
 *     per-beam UE count (and so never consumes the `overlay-demo` service map).
 *  C. dBm→W denominator uses TRANSMIT power (gain stays in the SINR numerator).
 *  D. Fail-closed guards: missing / non-physical inputs yield null, never a
 *     fabricated number.
 *
 * Run via `npm run validate:r1-energy-efficiency:model`.
 */
import { computeR1EnergyEfficiency } from './energyEfficiency';
import { computeLinkBudget } from '../engine/signal/link-budget';
import { loadProfile } from '../profiles/index';
import type { SatelliteSnapshot, UEPosition } from '../engine/signal/types';

let passed = 0;
function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}
function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}
function assertNull(value: unknown, label: string): void {
  if (value !== null) throw new Error(`${label}: expected null, got ${JSON.stringify(value)}`);
}
function assertNotNull<T>(value: T | null, label: string): T {
  if (value === null) throw new Error(`${label}: expected non-null, got null`);
  return value;
}
function assertClose(actual: number, expected: number, relTol: number, label: string): void {
  const denom = Math.max(Math.abs(expected), 1e-12);
  const rel = Math.abs(actual - expected) / denom;
  if (!(rel <= relTol)) {
    throw new Error(`${label}: expected ${expected}, got ${actual} (rel err ${rel})`);
  }
}

/**
 * The reference's own r1 EE credit, transcribed as two steps exactly as
 * `_compute_rewards` writes them — load explicitly present in BOTH terms.
 */
function referenceR1EeCredit(opts: {
  bandwidthHz: number;
  reuse: number;
  sinrLinear: number;
  beamPowerW: number;
  load: number;
}): number {
  const bAllocHz = opts.bandwidthHz / opts.reuse;
  const load = Math.max(opts.load, 1);
  const rate = (bAllocHz / load) * Math.log2(1 + Math.max(opts.sinrLinear, 0));
  const allocatedPowerW = opts.beamPowerW / load;
  return rate / allocatedPowerW;
}

// Reference config anchors: `FamilyBStepConfig.bandwidth_hz = 500e6`,
// `b_alloc_hz = bandwidth_hz / 3.0`. 50 dBm = 100 W of per-beam transmit power.
const REF_BANDWIDTH_MHZ = 500;
const REF_REUSE = 3;
const REF_TX_DBM = 50;
const REF_TX_W = 100;

check('A. reproduces the reference two-step r1 EE credit at 10 dB', () => {
  const live = assertNotNull(
    computeR1EnergyEfficiency({
      sinrDb: 10,
      txPowerDbm: REF_TX_DBM,
      bandwidthMHz: REF_BANDWIDTH_MHZ,
      frequencyReuse: REF_REUSE,
    }),
    'live r1 EE at 10 dB',
  );
  const expected = referenceR1EeCredit({
    bandwidthHz: REF_BANDWIDTH_MHZ * 1e6,
    reuse: REF_REUSE,
    sinrLinear: 10,
    beamPowerW: REF_TX_W,
    load: 4,
  });
  assertClose(live.bitsPerJoule, expected, 1e-12, 'r1 EE vs reference credit');

  // Closed-form anchor, independent of the transcription above.
  const closedForm = ((500e6 / 3) * Math.log2(11)) / 100;
  assertClose(live.bitsPerJoule, closedForm, 1e-12, 'r1 EE vs closed form');
});

check('B. r1 EE is invariant to beam load across a sweep (load cancels)', () => {
  const live = assertNotNull(
    computeR1EnergyEfficiency({
      sinrDb: -3.5,
      txPowerDbm: REF_TX_DBM,
      bandwidthMHz: REF_BANDWIDTH_MHZ,
      frequencyReuse: REF_REUSE,
    }),
    'live r1 EE at -3.5 dB',
  );
  for (const load of [1, 2, 3, 7, 16, 100]) {
    const expected = referenceR1EeCredit({
      bandwidthHz: REF_BANDWIDTH_MHZ * 1e6,
      reuse: REF_REUSE,
      sinrLinear: 10 ** (-3.5 / 10),
      beamPowerW: REF_TX_W,
      load,
    });
    assertClose(live.bitsPerJoule, expected, 1e-12, `r1 EE at load ${load}`);
  }
});

check('C. denominator is transmit power in watts, not EIRP or milliwatts', () => {
  const live = assertNotNull(
    computeR1EnergyEfficiency({
      sinrDb: 0,
      txPowerDbm: 50,
      bandwidthMHz: 100,
      frequencyReuse: 1,
    }),
    'live r1 EE',
  );
  assertClose(live.txPowerW, 100, 1e-12, '50 dBm is 100 W');
  // 0 dB SINR ⇒ log2(2) = 1 ⇒ rate == allocated bandwidth.
  assertClose(live.rateBitsPerSec, 100e6, 1e-12, 'rate at 0 dB equals B_alloc');
  assertClose(live.bitsPerJoule, 1e6, 1e-12, 'eta = B_alloc / P_beam');

  // Halving transmit power doubles EE at fixed SINR (denominator is linear W).
  const halved = assertNotNull(
    computeR1EnergyEfficiency({
      sinrDb: 0,
      txPowerDbm: 50 - 10 * Math.log10(2),
      bandwidthMHz: 100,
      frequencyReuse: 1,
    }),
    'live r1 EE at half power',
  );
  assertClose(halved.bitsPerJoule, 2e6, 1e-9, 'half the watts doubles eta');
});

check('C2. frequency reuse splits the allocated bandwidth', () => {
  const reuse1 = assertNotNull(computeR1EnergyEfficiency({
    sinrDb: 0, txPowerDbm: 50, bandwidthMHz: 300, frequencyReuse: 1,
  }), 'reuse 1');
  const reuse3 = assertNotNull(computeR1EnergyEfficiency({
    sinrDb: 0, txPowerDbm: 50, bandwidthMHz: 300, frequencyReuse: 3,
  }), 'reuse 3');
  assertClose(reuse1.allocatedBandwidthHz, 300e6, 1e-12, 'reuse 1 keeps full band');
  assertClose(reuse3.allocatedBandwidthHz, 100e6, 1e-12, 'reuse 3 takes a third');
  assertClose(reuse3.bitsPerJoule, reuse1.bitsPerJoule / 3, 1e-12, 'eta scales with B_alloc');
});

check('D. fails closed on missing / non-physical inputs', () => {
  const base = {
    sinrDb: 10,
    txPowerDbm: REF_TX_DBM,
    bandwidthMHz: REF_BANDWIDTH_MHZ,
    frequencyReuse: REF_REUSE,
  };
  assertNull(computeR1EnergyEfficiency({ ...base, sinrDb: null }), 'null SINR');
  assertNull(computeR1EnergyEfficiency({ ...base, sinrDb: NaN }), 'NaN SINR');
  assertNull(computeR1EnergyEfficiency({ ...base, txPowerDbm: null }), 'null tx power');
  assertNull(computeR1EnergyEfficiency({ ...base, txPowerDbm: NaN }), 'NaN tx power');
  assertNull(computeR1EnergyEfficiency({ ...base, bandwidthMHz: 0 }), 'zero bandwidth');
  assertNull(computeR1EnergyEfficiency({ ...base, bandwidthMHz: -1 }), 'negative bandwidth');
  assertNull(computeR1EnergyEfficiency({ ...base, frequencyReuse: 0 }), 'zero reuse');
});

check('D2. a floor-sentinel SINR yields a real but vanishing eta, not NaN', () => {
  const live = assertNotNull(
    computeR1EnergyEfficiency({
      sinrDb: -120,
      txPowerDbm: REF_TX_DBM,
      bandwidthMHz: REF_BANDWIDTH_MHZ,
      frequencyReuse: REF_REUSE,
    }),
    'floor SINR',
  );
  if (!(live.bitsPerJoule >= 0) || !Number.isFinite(live.bitsPerJoule)) {
    throw new Error(`floor SINR eta must be finite and non-negative, got ${live.bitsPerJoule}`);
  }
  if (!(live.bitsPerJoule < 1)) {
    throw new Error(`floor SINR eta should be vanishing, got ${live.bitsPerJoule}`);
  }
});

// --- E. the denominator's source of truth, against the REAL link budget -------
// The InfoPanel prices the cell lane's denominator with `channel.maxTxPowerDbm`
// because `SinrLiveCellModel.linkBudgetOptions` passes no
// `beamPowerOverrideDbmByKey`. This pins the mapping that assumption rests on as
// a runtime OUTPUT of `computeLinkBudget`: no override ⇒ the budget transmits at
// max power, and an override ⇒ the budget reports the overridden power. If the
// override knob ever changes meaning, this fails here rather than silently
// skewing a rendered η.
check('E. link-budget txPowerDbm is maxTxPowerDbm without an override, the override with one', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const ue: UEPosition = { latDeg: 0, lonDeg: 0, offsetEastKm: 0, offsetNorthKm: 0 };
  const sat: SatelliteSnapshot = {
    id: 'sat-probe',
    shellId: 'shell-probe',
    altitudeKm: 550,
    ecefKm: [0, 0, 6921],
    rangeKm: 550,
    elevationDeg: 90,
    azimuthDeg: 0,
    beamCellsKm: [{ beamId: 1, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 }],
  };
  const config = {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments: [{ satId: 'sat-probe', beamId: 1 }],
    simTimeSec: 0,
  };

  const plain = computeLinkBudget(ue, [sat], config);
  const servingPlain = plain.find(s => s.satId === 'sat-probe' && s.beamId === 1);
  if (!servingPlain) throw new Error('probe beam produced no link sample');
  assertClose(
    servingPlain.txPowerDbm,
    profile.channel.maxTxPowerDbm,
    1e-12,
    'no override ⇒ maxTxPowerDbm',
  );

  const overriddenDbm = profile.channel.maxTxPowerDbm - 6;
  const overridden = computeLinkBudget(ue, [sat], {
    ...config,
    beamPowerOverrideDbmByKey: new Map([['sat-probe:1', overriddenDbm]]),
  });
  const servingOverridden = overridden.find(s => s.satId === 'sat-probe' && s.beamId === 1);
  if (!servingOverridden) throw new Error('probe beam produced no overridden link sample');
  assertClose(servingOverridden.txPowerDbm, overriddenDbm, 1e-12, 'override ⇒ overridden power');

  // And the readout must actually move with it: 6 dB less power is 4x the EE at
  // fixed SINR, so the denominator is provably the knob the panel reads.
  const atMax = assertNotNull(computeR1EnergyEfficiency({
    sinrDb: 5,
    txPowerDbm: servingPlain.txPowerDbm,
    bandwidthMHz: profile.channel.bandwidthMHz,
    frequencyReuse: profile.beams.frequencyReuse,
  }), 'eta at max power');
  const atOverride = assertNotNull(computeR1EnergyEfficiency({
    sinrDb: 5,
    txPowerDbm: servingOverridden.txPowerDbm,
    bandwidthMHz: profile.channel.bandwidthMHz,
    frequencyReuse: profile.beams.frequencyReuse,
  }), 'eta at overridden power');
  assertClose(
    atOverride.bitsPerJoule / atMax.bitsPerJoule,
    10 ** (6 / 10),
    1e-9,
    'eta scales inversely with transmit watts',
  );
});

console.log(`\n${passed} checks passed.`);
