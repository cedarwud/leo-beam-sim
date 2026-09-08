#!/usr/bin/env node
/** Model gate for the live, load-dependent Chapter 5 EE readout. */
import { loadProfile } from '../profiles/index';
import type { PaperEnergyEfficiencyConfig } from '../profiles/types';
import type { UeCellServingRecord } from '../scene/sinrLiveCellModel';
import {
  computePaperBeamPowerW,
  computePaperEnergyEfficiency,
} from './paperEnergyEfficiency';

let passed = 0;
function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}
function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}
function assertClose(actual: number, expected: number, relTol: number, label: string): void {
  const denominator = Math.max(Math.abs(expected), 1e-12);
  const relativeError = Math.abs(actual - expected) / denominator;
  if (!(relativeError <= relTol)) {
    throw new Error(`${label}: expected ${expected}, got ${actual} (rel err ${relativeError})`);
  }
}
function assertNull(value: unknown, label: string): void {
  if (value !== null) throw new Error(`${label}: expected null, got ${JSON.stringify(value)}`);
}

const surface: PaperEnergyEfficiencyConfig = {
  beamPowerBaseW: 0.25,
  beamPowerLoadScaleW: 0.35,
  beamPowerLoadExponent: 0.5,
  beamPowerMaxW: 10,
  publishedReferenceMbitsPerJoule: 596.92,
  ch5DemoBandwidthMHz: 500,
  ch5DemoFrequencyReuse: 1,
};

function ue(
  ueId: string,
  servingSatId: string | null,
  cellId: number | null,
  sinrDb: number | null,
): UeCellServingRecord {
  return {
    ueId,
    cellId,
    cellDistanceKm: 0,
    offAxisDeg: 0,
    servingSatId,
    beamIdentity: servingSatId !== null && cellId !== null ? `${servingSatId}#cell${cellId}` : null,
    frequencyIndex: cellId === null ? null : cellId % 3,
    sinrDb,
    handoverKind: 'none',
  };
}

check('equation (3.37a) uses the configured raw load surface and cap', () => {
  assertClose(computePaperBeamPowerW(1, surface)!, 0.6, 1e-12, 'U=1 power');
  assertClose(computePaperBeamPowerW(4, surface)!, 0.95, 1e-12, 'U=4 power');
  assertClose(computePaperBeamPowerW(1000, surface)!, 10, 1e-12, 'power cap');
});

check('live cell assignments provide U and coverage-weighted EE', () => {
  const frame = {
    ues: [
      ue('ue-a0', 'sat-a', 0, 0),
      ue('ue-a1', 'sat-a', 0, 10),
      ue('ue-b0', 'sat-b', 1, 0),
      ue('ue-u0', null, null, null),
      ue('ue-u1', null, null, null),
    ],
  };
  const result = computePaperEnergyEfficiency({
    frame,
    bandwidthMHz: 100,
    frequencyReuse: 1,
    powerSurface: surface,
  });
  if (result === null) throw new Error('expected live paper EE result');

  const beamA2PowerW = 0.25 + 0.35 * Math.sqrt(2);
  const beamA0 = 100e6 / beamA2PowerW;
  const beamA1 = (100e6 * Math.log2(11)) / beamA2PowerW;
  const beamB0 = 100e6 / 0.6;
  const perServedExpected = (beamA0 + beamA1 + beamB0) / 3;
  assertClose(result.perServedUeBitsPerJoule, perServedExpected, 1e-12, 'per-served EE');
  assertClose(result.coverageFraction, 3 / 5, 1e-12, 'coverage');
  assertClose(
    result.coverageWeightedBitsPerJoule,
    result.perServedUeBitsPerJoule * result.coverageFraction,
    1e-12,
    'coverage weighting',
  );
  if (result.loadSummary.count !== 2 || result.loadSummary.median !== 1.5) {
    throw new Error(`unexpected live beam load summary: ${JSON.stringify(result.loadSummary)}`);
  }
  if (result.throughputSummaryBps.count !== 3 || result.throughputSummaryBps.median !== 100e6) {
    throw new Error(`unexpected throughput summary: ${JSON.stringify(result.throughputSummaryBps)}`);
  }
  assertClose(
    result.perUeRawPowerSummaryW.median,
    beamA2PowerW / 2,
    1e-12,
    'median raw per-UE power share',
  );
  if (result.sinrDbSummary?.count !== 3 || result.finiteSinrServedUeCount !== 3) {
    throw new Error('finite live SINR count must exclude only non-decodable records');
  }
  if (result.publishedReferenceMbitsPerJoule !== 596.92) {
    throw new Error('published Chapter 5 anchor was not carried from settings');
  }
});

check('served-by-assignment UE with null SINR contributes zero and stays visible in U', () => {
  const result = computePaperEnergyEfficiency({
    frame: { ues: [ue('ue-a0', 'sat-a', 0, null)] },
    bandwidthMHz: 100,
    frequencyReuse: 1,
    powerSurface: surface,
  });
  if (result === null) throw new Error('expected assignment-level result');
  if (result.servedUeCount !== 1 || result.finiteSinrServedUeCount !== 0) {
    throw new Error('assignment and finite-SINR populations diverged');
  }
  assertClose(result.throughputSummaryBps.median, 0, 1e-12, 'null SINR throughput');
  assertClose(result.coverageWeightedBitsPerJoule, 0, 1e-12, 'null SINR rate');
});

check('missing or non-physical paper settings fail closed', () => {
  const frame = { ues: [ue('ue-a0', 'sat-a', 0, 0)] };
  assertNull(computePaperEnergyEfficiency({
    frame,
    bandwidthMHz: 100,
    frequencyReuse: 1,
    powerSurface: undefined,
  }), 'missing settings');
  assertNull(computePaperEnergyEfficiency({
    frame,
    bandwidthMHz: 100,
    frequencyReuse: 1,
    powerSurface: { ...surface, beamPowerMaxW: 0 },
  }), 'zero power cap');
  assertNull(computePaperEnergyEfficiency({
    frame,
    bandwidthMHz: 0,
    frequencyReuse: 1,
    powerSurface: surface,
  }), 'zero bandwidth');
});

check('Ch5 demo operating point changes only the displayed bandwidth surface', () => {
  const frame = { ues: [ue('ue-a0', 'sat-a', 0, 0)] };
  const live = computePaperEnergyEfficiency({
    frame,
    bandwidthMHz: 100,
    frequencyReuse: 3,
    powerSurface: surface,
  });
  const demo = computePaperEnergyEfficiency({
    frame,
    bandwidthMHz: surface.ch5DemoBandwidthMHz,
    frequencyReuse: surface.ch5DemoFrequencyReuse,
    powerSurface: surface,
  });
  if (live === null || demo === null) throw new Error('expected both live and demo EE results');
  assertClose(demo.coverageWeightedBitsPerJoule / live.coverageWeightedBitsPerJoule, 15, 1e-12, 'demo/live bandwidth ratio');
  assertClose(demo.loadSummary.median, live.loadSummary.median, 1e-12, 'demo load truth');
  assertClose(demo.sinrDbSummary!.median, live.sinrDbSummary!.median, 1e-12, 'demo SINR truth');
});

check('all shipped profiles carry the same explicit current comparison anchor', () => {
  for (const profileId of [
    'hobs-2024-candidate-rich',
    'hobs-2024-paper-default',
    'hobs-2024-tr38811-research',
    'hobs-2024-mobile-demo-aircraft',
    'hobs-2024-candidate-rich',
    'hobs-2024-tr38811-research',
  ]) {
    const profile = loadProfile(profileId);
    if (profile.energyEfficiency?.paper.publishedReferenceMbitsPerJoule !== 596.92) {
      throw new Error(`${profileId}: missing 596.92 settings anchor`);
    }
    if (
      profile.energyEfficiency.paper.ch5DemoBandwidthMHz !== 500
      || profile.energyEfficiency.paper.ch5DemoFrequencyReuse !== 1
    ) {
      throw new Error(`${profileId}: missing Ch5 demo operating point`);
    }
  }
});

console.log(`\n${passed} checks passed.`);
