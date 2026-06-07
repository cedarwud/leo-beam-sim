#!/usr/bin/env node
/**
 * Pure-model gate for the SINR-serving mosaic (S2). No browser. Asserts the
 * colour is stable + deterministic per serving (satId,beamId), that distinct
 * beams get distinct colours, that a handover (serving-beam change) recolours a
 * dot, and that the aggregate counts served/total + per-beam load + mean served
 * SINR over REAL serving truth only (never invents a serving or a SINR).
 *
 * Run: `npm run validate:phase-c:sinr-serving-mosaic:model`.
 */
import {
  buildSinrServingUeColorMap,
  deriveSinrServingMosaicAggregate,
  mosaicColorForServingBeam,
  EMPTY_SINR_SERVING_MOSAIC_AGGREGATE,
  SINR_SERVING_UNSERVED_COLOR,
} from './sinrServingMosaic';

let passed = 0;
const HEX = /^#[0-9a-f]{6}$/;

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
function assertNotEqual<T>(actual: T, unexpected: T, label: string): void {
  if (actual === unexpected) throw new Error(`${label}: expected NOT ${String(unexpected)}`);
}
function assertMatch(value: string, re: RegExp, label: string): void {
  if (!re.test(value)) throw new Error(`${label}: ${value} does not match ${re}`);
}
function check(label: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${label}`);
}

check('colour is deterministic + valid hex per (satId,beamId)', () => {
  const a = mosaicColorForServingBeam('sat-3', 2);
  const b = mosaicColorForServingBeam('sat-3', 2);
  assertEqual(a.markerColor, b.markerColor, 'same input → same colour (stable)');
  assertEqual(a.markerEmissive, b.markerEmissive, 'same input → same emissive (stable)');
  assertMatch(a.markerColor, HEX, 'marker colour is hex');
  assertMatch(a.markerEmissive, HEX, 'marker emissive is hex');
});

check('different serving beams get different colours', () => {
  const sameSatBeamA = mosaicColorForServingBeam('sat-3', 1).markerColor;
  const sameSatBeamB = mosaicColorForServingBeam('sat-3', 2).markerColor;
  const otherSat = mosaicColorForServingBeam('sat-9', 1).markerColor;
  assertNotEqual(sameSatBeamA, sameSatBeamB, 'same sat, different beam → different shade');
  assertNotEqual(sameSatBeamA, otherSat, 'different sat → different hue family');
});

check('a handover (serving-beam change) recolours that UE only', () => {
  const before = buildSinrServingUeColorMap([
    { id: 'u0', servingSatelliteId: 'sat-1', servingBeamId: '1' },
    { id: 'u1', servingSatelliteId: 'sat-1', servingBeamId: '2' },
  ]);
  const after = buildSinrServingUeColorMap([
    { id: 'u0', servingSatelliteId: 'sat-1', servingBeamId: '1' },
    { id: 'u1', servingSatelliteId: 'sat-2', servingBeamId: '5' }, // u1 handed over
  ]);
  assertEqual(before.get('u0')!.markerColor, after.get('u0')!.markerColor, 'unchanged UE keeps colour');
  assertNotEqual(before.get('u1')!.markerColor, after.get('u1')!.markerColor, 'handed-over UE recolours');
});

check('unserved UE (empty serving) gets the muted unserved colour, never a beam colour', () => {
  const map = buildSinrServingUeColorMap([
    { id: 'u0', servingSatelliteId: '', servingBeamId: '' },
    { id: 'u1', servingSatelliteId: 'sat-1', servingBeamId: '' },
  ]);
  assertEqual(map.get('u0')!.markerColor, SINR_SERVING_UNSERVED_COLOR, 'no sat/beam → unserved');
  assertEqual(map.get('u1')!.markerColor, SINR_SERVING_UNSERVED_COLOR, 'no beam → unserved');
});

check('aggregate counts served/total, distinct serving beams, and per-beam load', () => {
  const agg = deriveSinrServingMosaicAggregate([
    { servingSatId: 'sat-1', servingBeamId: 1, sinrDb: 10 },
    { servingSatId: 'sat-1', servingBeamId: 1, sinrDb: 12 },
    { servingSatId: 'sat-1', servingBeamId: 2, sinrDb: 8 },
    { servingSatId: 'sat-2', servingBeamId: 3, sinrDb: 14 },
    { servingSatId: null, servingBeamId: null, sinrDb: null }, // idle
  ]);
  assertEqual(agg.totalCount, 5, 'total counts all UEs');
  assertEqual(agg.servedCount, 4, 'served counts only assigned UEs');
  assertEqual(agg.servingBeamCount, 3, 'three distinct serving beams (non-mono)');
  assertEqual(agg.beamLoads[0].key, 'sat-1:1', 'busiest beam first');
  assertEqual(agg.beamLoads[0].count, 2, 'busiest beam carries 2 UEs');
  assertMatch(agg.beamLoads[0].color, HEX, 'beam-load row carries the mosaic colour');
});

check('aggregate mean SINR is over served-with-finite-SINR only', () => {
  const agg = deriveSinrServingMosaicAggregate([
    { servingSatId: 'sat-1', servingBeamId: 1, sinrDb: 10 },
    { servingSatId: 'sat-1', servingBeamId: 1, sinrDb: 20 },
    { servingSatId: 'sat-2', servingBeamId: 2, sinrDb: null }, // served, no SINR → excluded from mean
    { servingSatId: null, servingBeamId: null, sinrDb: 99 },   // idle → never counted
  ]);
  assertEqual(agg.avgServedSinrDb, 15, 'mean = (10+20)/2, ignores null-SINR + idle');
});

check('empty input → empty aggregate', () => {
  const agg = deriveSinrServingMosaicAggregate([]);
  assertEqual(agg, EMPTY_SINR_SERVING_MOSAIC_AGGREGATE, 'empty → shared empty constant');
});

console.log(`\n[sinr-serving-mosaic:model] PASS — ${passed} checks (stable colour, handover recolour, served/total + per-beam load + mean served SINR, no fabrication)`);
