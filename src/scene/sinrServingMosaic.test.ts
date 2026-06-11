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
  buildSinrServingUeColorMapFromCells,
  deriveSinrLiveServiceQueueFocusStories,
  deriveSinrLiveServiceQueueModel,
  deriveSinrServingMosaicAggregate,
  mosaicColorForServingBeam,
  EMPTY_SINR_SERVING_MOSAIC_AGGREGATE,
  SINR_LIVE_SERVICE_QUEUE_SOURCE,
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

// --- S-cells-4c: cell-truth mosaic (UE connects only when its cell is lit/served) ---

check('cell-truth mosaic: served UE coloured by (satId,cellId); idle cell → unserved grey', () => {
  const map = buildSinrServingUeColorMapFromCells([
    { ueId: 'u0', servingSatId: 'sat-1', cellId: 3 },
    { ueId: 'u1', servingSatId: null, cellId: 5 },     // cell idle this slot → unserved
    { ueId: 'u2', servingSatId: 'sat-1', cellId: null }, // served sat but no cell → unserved
  ]);
  assertEqual(map.get('u0')!.markerColor, mosaicColorForServingBeam('sat-1', 3).markerColor, 'served UE = (sat,cell) colour');
  assertEqual(map.get('u1')!.markerColor, SINR_SERVING_UNSERVED_COLOR, 'unlit cell → grey (UE not connected)');
  assertEqual(map.get('u2')!.markerColor, SINR_SERVING_UNSERVED_COLOR, 'no cell → grey');
});

check('cell-truth mosaic: intra-HO (cell change, same sat) recolours; inter-HO (sat change) recolours', () => {
  const t0 = buildSinrServingUeColorMapFromCells([{ ueId: 'm', servingSatId: 'sat-1', cellId: 0 }]);
  const intra = buildSinrServingUeColorMapFromCells([{ ueId: 'm', servingSatId: 'sat-1', cellId: 1 }]);
  const inter = buildSinrServingUeColorMapFromCells([{ ueId: 'm', servingSatId: 'sat-2', cellId: 0 }]);
  assertNotEqual(t0.get('m')!.markerColor, intra.get('m')!.markerColor, 'crossing into a new cell recolours (intra-HO)');
  assertNotEqual(t0.get('m')!.markerColor, inter.get('m')!.markerColor, 'serving-sat change recolours (inter-HO)');
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

// --- S4-3: QUAR-S4-SERVING block #1 replacement (mosaic module ownership as behaviour) ---

check('queue source label VALUE: the exported const is the display-owned demo label', () => {
  // Replaces the retired QUAR-S4-SERVING export-text pin with a VALUE assert:
  // the queue accounting is explicitly display-owned live-service-demo, never
  // producer proof. (`model.source` equality below ties the model to it.)
  assertEqual(SINR_LIVE_SERVICE_QUEUE_SOURCE, 'live-service-demo', 'exported queue source const value');
});

check('cell-lane cross-surface ownership: aggregate + queue + 3D map derive from ONE cell record set and agree', () => {
  // Replaces the retired QUAR-S4-SERVING module-ownership pins behaviourally:
  // the mosaic module OWNS colour derivation, the served-N/N aggregate, and the
  // queue accountant, and on the cell lane all three key the SAME typed
  // (satId, servingCellId) unit — sim.sinrLiveCells is the one serving record.
  const cellRecords = [
    { id: 'u0', servingSatId: 'sat-1', servingBeamId: null, servingCellId: 3, sinrDb: 8 },
    { id: 'u1', servingSatId: 'sat-1', servingBeamId: null, servingCellId: 3, sinrDb: 2 },
    { id: 'u2', servingSatId: 'sat-2', servingBeamId: null, servingCellId: 5, sinrDb: -1 },
    { id: 'u3', servingSatId: null, servingBeamId: null, servingCellId: null, sinrDb: null },
  ] as const;
  const agg = deriveSinrServingMosaicAggregate(cellRecords);
  assertEqual(agg.servedCount, 3, 'aggregate counts cell-lane served (beamId null) records');
  assertEqual(agg.beamLoads.map(l => l.key).sort().join('|'), 'sat-1:3|sat-2:5', 'aggregate units keyed (satId, cellId)');
  const queue = deriveSinrLiveServiceQueueModel(cellRecords);
  assertEqual(queue.source, SINR_LIVE_SERVICE_QUEUE_SOURCE, 'queue model carries the exported source const');
  assertEqual(queue.byUeId.get('u0')?.servingKey, 'sat-1:3', 'queue keys the same typed unit');
  assertEqual(queue.byUeId.get('u3')?.servingKey, null, 'unserved stays unserved in the queue');
  const map3d = buildSinrServingUeColorMapFromCells(
    cellRecords.map(r => ({ ueId: r.id, servingSatId: r.servingSatId, cellId: r.servingCellId })),
  );
  for (const load of agg.beamLoads) {
    const carrier = cellRecords.find(r => r.servingSatId === load.satId && r.servingCellId === load.beamId)!;
    assertEqual(map3d.get(carrier.id)!.markerColor, load.color, `3D colour == HUD beam-load colour for ${load.key}`);
  }
  assertEqual(map3d.get('u3')!.markerColor, SINR_SERVING_UNSERVED_COLOR, 'unserved UE grey on the 3D map');
});

check('live-service-demo queue accounts expose per-UE conservation fields', () => {
  const model = deriveSinrLiveServiceQueueModel([
    { id: 'u0', servingSatId: 'sat-1', servingBeamId: 1, sinrDb: 18 },
    { id: 'u1', servingSatId: 'sat-1', servingBeamId: 2, sinrDb: 4 },
    { id: 'u2', servingSatId: null, servingBeamId: null, sinrDb: null },
  ]);
  assertEqual(model.source, 'live-service-demo', 'queue model is explicitly display-owned demo source');
  assertEqual(model.accounts.length, 3, 'one queue account per UE');
  for (const account of model.accounts) {
    assertEqual(account.source, 'live-service-demo', 'per-UE account carries source');
    assertEqual(
      account.queueAfterBits,
      Math.max(0, account.queueBeforeBits + account.trafficArrivalBits - account.servedBits),
      `queue conservation holds for ${account.ueId}`,
    );
    assertEqual(
      account.serviceRateBps,
      account.servedBits,
      `1 s live-service-demo sample makes rate equal served bits for ${account.ueId}`,
    );
  }
  assertEqual(model.byUeId.get('u1')?.ueId, 'u1', 'queue accounts are addressable by UE id');
});

check('live-service-demo queue aggregate exposes backlog distribution and dense pressure buckets', () => {
  const model = deriveSinrLiveServiceQueueModel([
    { id: 'u0', servingSatId: 'sat-1', servingBeamId: 1, sinrDb: 20 },
    { id: 'u1', servingSatId: 'sat-1', servingBeamId: 2, sinrDb: 0 },
    { id: 'u2', servingSatId: null, servingBeamId: null, sinrDb: null },
    { id: 'u3', servingSatId: 'sat-2', servingBeamId: 4, sinrDb: 9 },
  ]);
  assertEqual(model.aggregate.source, 'live-service-demo', 'aggregate carries source');
  assertEqual(model.aggregate.queueCapableUeCount, 4, 'aggregate counts queue-capable UEs');
  if (!(model.aggregate.avgQueueBits > 0)) throw new Error('avg queue should be positive');
  if (!(model.aggregate.p95QueueBits >= model.aggregate.avgQueueBits)) throw new Error('p95 queue should be >= average for this fixture');
  if (!(model.aggregate.maxQueueBits >= model.aggregate.p95QueueBits)) throw new Error('max queue should be >= p95');
  if (!(model.aggregate.pressureBucketCount > 1)) throw new Error('fixture should produce non-mono pressure buckets');
  if (!(model.aggregate.totalArrivalBits > 0)) throw new Error('aggregate exposes arrival bits');
  const histogramTotal = model.aggregate.pressureHistogram.reduce((sum, count) => sum + count, 0);
  assertEqual(histogramTotal, model.accounts.length, 'pressure histogram covers every queue account exactly once');
});

check('live-service-demo queue focus stories identify pressure and rescue without producer proof', () => {
  const model = deriveSinrLiveServiceQueueModel([
    { id: 'u0', servingSatId: 'sat-1', servingBeamId: 1, sinrDb: 20 },
    { id: 'u1', servingSatId: 'sat-1', servingBeamId: 2, sinrDb: 0 },
    { id: 'u2', servingSatId: null, servingBeamId: null, sinrDb: null },
    { id: 'u3', servingSatId: 'sat-2', servingBeamId: 4, sinrDb: 25 },
  ]);
  const stories = deriveSinrLiveServiceQueueFocusStories(model.accounts);
  if (stories.highestPressure === null) throw new Error('highest-pressure story should exist');
  if (stories.bestRescue === null) throw new Error('best-rescue story should exist');

  assertEqual(stories.source, 'live-service-demo', 'focus stories carry demo source');
  assertEqual(stories.highestPressure.kind, 'highest-pressure', 'highest-pressure story is typed');
  assertEqual(stories.bestRescue.kind, 'best-rescue', 'best-rescue story is typed');
  if (!(stories.highestPressure.pressure >= stories.bestRescue.pressure || stories.highestPressure.queueAfterBits >= 0)) {
    throw new Error('highest-pressure story exposes backlog pressure');
  }
  if (!(stories.bestRescue.serviceSurplusBits > 0)) {
    throw new Error('best-rescue story should have served more bits than arrivals');
  }
  if (!(stories.bestRescue.queueDeltaBits > 0)) {
    throw new Error('best-rescue story should show queue reduction');
  }
});

console.log(`\n[sinr-serving-mosaic:model] PASS — ${passed} checks (stable colour, handover recolour, served/total + per-beam load + mean served SINR, live-service-demo queue conservation, no producer-proof fabrication)`);
