#!/usr/bin/env node
/**
 * Pure-model gate for the SINR-live earth-fixed cell model (S-cells-1). No
 * browser, no runtime mutation. Authority `docs/sinr-live-earth-fixed-cells-
 * mini-sdd.md` §5/§6; decisions A1 + B3.
 *
 * Asserts the CONTRACT: UE→nearest-cell membership; the four SEPARATED
 * identities (cell / beam=sat×cell / freq=cellId%reuse / handover=serving-SAT
 * change) — codex BLOCK-4; per-(sat,cell) scan/slant/off-axis geometry — §5.3;
 * serving by SINR + HandoverManager policy, NOT round-robin — codex BLOCK-3;
 * intra/inter classification; and — the keystone faithfulness check — that the
 * reported frequency identity EQUALS the co-channel interference partition
 * `computeLinkBudget` actually uses. Crucially: a UE off the cell centre keeps a
 * real off-axis angle (the CQ3 fix — beam is NOT re-snapped onto the UE).
 *
 * Run: `npm run validate:phase-c:sinr-live-cells:model`.
 */
import { buildCellLayout } from '../engine/cells/cellLayout';
import { getBeamFrequencyIndex } from '../utils/beamFrequency';
import { loadProfile } from '../profiles/index';
import { applySignalTuning, createSignalTuningState } from '../signalTuning';
// S4-3 (QUAR-S4-SERVING block #4 replacement): the hopping checks bind to the
// RUNTIME-wired consts, so the behaviour the gate proves is the shipped config.
import { SINR_LIVE_BEAMS_PER_SAT, SINR_LIVE_HOP_SLOT_SEC } from './sinrLiveCellRuntime';
import {
  SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
  SinrLiveCellModel,
  type CellModelSat,
  assignUeToNearestCell,
  cellBeamIdentity,
  cellFrequencyIndex,
  cellIdFromLinkBudgetBeamId,
  cellLinkBudgetBeamId,
  classifyServingTransition,
  computeCellScanGeometry,
  listCellCandidateSats,
  satNadirOffsetKm,
} from './sinrLiveCellModel';

let passed = 0;

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(`FAIL: ${label}`);
}
function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
function assertNear(actual: number, expected: number, tol: number, label: string): void {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${label}: expected ${expected}±${tol}, got ${actual}`);
  }
}
function check(label: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${label}`);
}

const OBSERVER = { latDeg: 0, lonDeg: 0 };
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const profile = loadProfile('hobs-2024-candidate-rich');

function testLayout(cellCount = 7) {
  return buildCellLayout({
    centerLatDeg: OBSERVER.latDeg,
    centerLonDeg: OBSERVER.lonDeg,
    altitudeKm: 550,
    beamwidth3dBRad: 0.058,
    cellCount,
  });
}

/** Minimal CellModelSat stub; the model reads only id/shellId/altitudeKm/lat/lon/topo. */
function makeSat(params: {
  id: string;
  latDeg: number;
  lonDeg: number;
  elevationDeg: number;
  azimuthDeg?: number;
  altitudeKm?: number;
}): CellModelSat {
  return {
    id: params.id,
    shellId: 'shell-test',
    altitudeKm: params.altitudeKm ?? 550,
    topo: { azimuthDeg: params.azimuthDeg ?? 0, elevationDeg: params.elevationDeg },
    latDeg: params.latDeg,
    lonDeg: params.lonDeg,
  };
}

// --- frequency identity (§5.2) + interference-partition equivalence -----------

check('frequency identity = cellId mod reuse, stable + 0-based, NOT a beamIndex', () => {
  assertEqual(cellFrequencyIndex(0, 3), 0, 'cell 0 → F0');
  assertEqual(cellFrequencyIndex(1, 3), 1, 'cell 1 → F1');
  assertEqual(cellFrequencyIndex(3, 3), 0, 'cell 3 wraps to F0');
  assertEqual(cellFrequencyIndex(7, 3), 1, 'cell 7 → F1');
  assertEqual(cellFrequencyIndex(5, 1), 0, 'reuse 1 → single colour');
  // stable per cell (same id → same colour every call)
  assertEqual(cellFrequencyIndex(4, 3), cellFrequencyIndex(4, 3), 'stable');
});

check('KEYSTONE: reported freq identity == computeLinkBudget interference partition', () => {
  // computeLinkBudget groups co-channel by getBeamFrequencyIndex((cellId+1)) =
  // (cellId+1-1) mod reuse = cellId mod reuse. If these ever diverge the
  // displayed colour would not explain the interference.
  for (const reuse of [1, 2, 3, 7]) {
    for (let cellId = 0; cellId < 20; cellId += 1) {
      assertEqual(
        getBeamFrequencyIndex(cellLinkBudgetBeamId(cellId), reuse),
        cellFrequencyIndex(cellId, reuse),
        `reuse=${reuse} cell=${cellId} partition matches`,
      );
    }
  }
});

check('cell↔link-budget beamId round-trips, and beam identity = sat × cell', () => {
  assertEqual(cellIdFromLinkBudgetBeamId(cellLinkBudgetBeamId(0)), 0, 'cell 0 round-trip');
  assertEqual(cellIdFromLinkBudgetBeamId(cellLinkBudgetBeamId(36)), 36, 'cell 36 round-trip');
  assertEqual(cellBeamIdentity('sat-A', 5), 'sat-A#cell5', 'beam identity string');
  assert(cellBeamIdentity('sat-A', 5) !== cellBeamIdentity('sat-B', 5), 'same cell, diff sat → diff beam');
  assert(cellBeamIdentity('sat-A', 5) !== cellBeamIdentity('sat-A', 6), 'same sat, diff cell → diff beam');
});

// --- membership (§5.1) --------------------------------------------------------

check('UE → nearest earth-fixed cell membership', () => {
  const layout = testLayout(7);
  assertEqual(assignUeToNearestCell({ eastKm: 0, northKm: 0 }, layout).cellId, 0, 'origin → centre cell 0');
  // cell 1 centre sits ~27.6 km east; a UE at 26 km east is nearest cell 1.
  assertEqual(assignUeToNearestCell({ eastKm: 26, northKm: 0 }, layout).cellId, 1, 'east UE → east cell 1');
  const empty = buildCellLayout({ centerLatDeg: 0, centerLonDeg: 0, altitudeKm: 550, beamwidth3dBRad: 0.058, cellCount: 1 });
  assertEqual(assignUeToNearestCell({ eastKm: 9999, northKm: 0 }, empty).cellId, 0, 'always resolves a cell when cells exist');
});

// --- per-(sat,cell) geometry (§5.3) -------------------------------------------

check('per-(sat,cell) scan angle, slant range, elevation to the FIXED cell centre', () => {
  const layout = testLayout(7);
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const centre = layout.centers[0];
  const east = layout.centers[1];

  assertEqual(satNadirOffsetKm(overhead, OBSERVER).eastKm, 0, 'overhead sat nadir east = 0');

  const gCentre = computeCellScanGeometry(overhead, centre, OBSERVER);
  assertNear(gCentre.scanAngleDeg, 0, 0.05, 'scan to centre cell ≈ 0°');
  assert(gCentre.slantRangeKm >= 550 - 1, 'slant range ≥ altitude');
  assert(gCentre.elevationDeg > 80, 'centre cell sees overhead sat near-zenith');

  const gEast = computeCellScanGeometry(overhead, east, OBSERVER);
  assert(gEast.scanAngleDeg > gCentre.scanAngleDeg, 'off-centre cell has larger scan angle');
  assert(gEast.slantRangeKm > gCentre.slantRangeKm, 'off-centre cell has longer slant range');
  assertNear(gEast.nadirToCellKm, Math.hypot(east.localXKm, east.localYKm), 0.01, 'nadir→cell dist matches geometry');
});

check('candidate sats filtered by per-cell geometric elevation + steering reach', () => {
  const layout = testLayout(7);
  const centre = layout.centers[0];
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  // lon 30° ≈ 3340 km east: cell→sat elevation ≈ 9° (sub-mask) AND scan ≈ 80° (un-steerable).
  const far = makeSat({ id: 'far', latDeg: 0, lonDeg: 30, elevationDeg: 9 });
  const cands = listCellCandidateSats(centre, [overhead, far], OBSERVER, 12, 15);
  const overGeom = cands.find(c => c.satId === 'over');
  assert(overGeom !== undefined && overGeom.elevationDeg > 80 && overGeom.scanAngleDeg < 1, 'overhead sat candidate, high-elev low-scan');
  assert(!cands.some(c => c.satId === 'far'), 'distant sat (sub-mask + un-steerable) rejected');
  // The gate uses the GEOMETRIC cell→sat elevation, NOT the observer-relative topo.
  assertEqual(computeCellScanGeometry(overhead, centre, OBSERVER).satId, 'over', 'geometry keyed by sat id');
});

check('step() pre-filters satellites by observer-relative elevation mask (mirrors runtime linkSats)', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  // geographically overhead (would light cells) but its observer-relative topo
  // elevation is below the 15° mask → step must drop it before serving.
  const belowMask = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 5 });
  const frame = model.step({ visibleSats: [belowMask], ues: [{ id: 'a', eastKm: 0, northKm: 0 }], simTimeSec: 0, dtSec: 1 });
  assertEqual(frame.servedCellCount, 0, 'sub-mask sat serves nothing');
  assertEqual(frame.ues[0].servingSatId, null, 'UE unserved under a sub-mask sat');
});

// --- handover identity / classification (§5.2, codex BLOCK-4) ------------------

check('serving transition classification: none/attach/drop/intra/inter', () => {
  assertEqual(classifyServingTransition(null, { satId: null, cellId: 3 }), 'none', 'never served');
  assertEqual(classifyServingTransition(null, { satId: 'S', cellId: 3 }), 'attach', 'cold attach is not a HO');
  assertEqual(classifyServingTransition({ satId: 'S', cellId: 3 }, { satId: null, cellId: 3 }), 'drop', 'service drop');
  assertEqual(
    classifyServingTransition({ satId: 'S', cellId: 3 }, { satId: 'S', cellId: 4 }),
    'intra',
    'same sat, cell changes → intra',
  );
  assertEqual(
    classifyServingTransition({ satId: 'S', cellId: 3 }, { satId: 'T', cellId: 3 }),
    'inter',
    'serving sat changes → inter',
  );
  assertEqual(
    classifyServingTransition({ satId: 'S', cellId: 3 }, { satId: 'S', cellId: 3 }),
    'none',
    'unchanged serving → none',
  );
});

// --- integration: real computeLinkBudget + HandoverManager --------------------

check('CQ3 FIX: a UE off the cell centre keeps a real off-axis angle and is still served', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });

  const frame = model.step({
    visibleSats: [overhead],
    ues: [
      { id: 'centre', eastKm: 0, northKm: 0 },     // at cell-0 centre → off-axis ≈ 0
      { id: 'off', eastKm: 8, northKm: 0 },         // inside cell 0, off-centre → real off-axis
    ],
    simTimeSec: 0,
    dtSec: 1,
  });

  const centre = frame.ues.find(u => u.ueId === 'centre')!;
  const off = frame.ues.find(u => u.ueId === 'off')!;
  assertEqual(centre.cellId, 0, 'centre UE in cell 0');
  assertEqual(off.cellId, 0, 'off-centre UE still in cell 0');
  assertNear(centre.offAxisDeg, 0, 0.05, 'centre UE off-axis ≈ 0');
  assert(off.offAxisDeg > 0.5, 'off-centre UE has a REAL off-axis angle (not re-snapped onto the UE)');
  assert(off.offAxisDeg < 2, 'off-axis stays within a beamwidth for an in-cell UE');
  assert(centre.servingSatId === 'over' && off.servingSatId === 'over', 'both UEs served by the overhead sat');
  assert(Number.isFinite(off.sinrDb ?? NaN), 'off-centre UE has a finite SINR');
  assert(off.servingLinkSample !== null && off.servingLinkSample !== undefined, 'cell UE record keeps its complete serving LinkSample');
  assertEqual(off.servingLinkSample?.sinrDb, off.sinrDb, 'record SINR equals the stored serving LinkSample SINR');
  assert(Number.isFinite(off.servingLinkSample?.signalDbm ?? NaN), 'stored serving LinkSample keeps the signal term');
  // The off-axis angle must PENALISE the SINR (beam-gain rolloff in computeLinkBudget),
  // not merely populate a display field — this is the load-bearing half of the CQ3 fix.
  assert((off.sinrDb ?? Infinity) < (centre.sinrDb ?? -Infinity), 'off-axis UE SINR rolls off below the cell-centre UE (off-axis flows into the link budget)');
  // four identities present + separated
  assertEqual(off.beamIdentity, 'over#cell0', 'beam identity = sat × cell');
  assertEqual(off.frequencyIndex, cellFrequencyIndex(0, profile.beams.frequencyReuse), 'freq identity = cellId%reuse');
});

check('cold attach is not a handover; UE crossing into a same-sat cell IS an intra-HO', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const eastCell = layout.centers[1];

  const f0 = model.step({ visibleSats: [overhead], ues: [{ id: 'm', eastKm: 0, northKm: 0 }], simTimeSec: 0, dtSec: 1 });
  assertEqual(f0.ues[0].handoverKind, 'attach', 'first acquisition is a cold attach');
  assertEqual(f0.ues[0].cellId, 0, 'UE starts in cell 0');
  assertEqual(f0.intraHandoverCount, 0, 'no intra on attach');
  assertEqual(f0.recentHandoverEvents.length, 0, 'a cold attach emits NO live-pulse handover event');

  // move the UE into the east cell, still under the same overhead sat
  const f1 = model.step({
    visibleSats: [overhead],
    ues: [{ id: 'm', eastKm: eastCell.localXKm, northKm: eastCell.localYKm }],
    simTimeSec: 1,
    dtSec: 1,
  });
  assertEqual(f1.ues[0].cellId, 1, 'UE crossed into cell 1');
  assertEqual(f1.ues[0].servingSatId, 'over', 'still served by the same sat');
  assertEqual(f1.ues[0].handoverKind, 'intra', 'same sat + new cell → intra-HO');
  assertEqual(f1.intraHandoverCount, 1, 'one intra this frame');
  assertEqual(f1.interHandoverCount, 0, 'no inter (sat unchanged)');

  // G2: the intra-HO is exposed as a live-pulse event carrying the old→new pair
  // + its fire time, so the ambient pulse can light cell 0→cell 1 and fade by age.
  assertEqual(f1.recentHandoverEvents.length, 1, 'the intra-HO emits exactly one live-pulse event');
  const ev = f1.recentHandoverEvents[0];
  assertEqual(ev.kind, 'intra', 'event kind matches the classified transition');
  assertEqual(ev.ueId, 'm', 'event carries the UE that handed over');
  assertEqual(ev.fromCellId, 0, 'fromCellId = the cell handed OFF');
  assertEqual(ev.toCellId, 1, 'toCellId = the cell handed ONTO');
  assertEqual(ev.fromSatId, 'over', 'intra keeps the same sat (from)');
  assertEqual(ev.toSatId, 'over', 'intra keeps the same sat (to)');
  assertEqual(ev.sourceTimeSec, 1, 'event fire-time = the frame sim-time');
});

check('live-pulse handover events fade out of the retention window by sim-time', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const eastCell = layout.centers[1];

  model.step({ visibleSats: [overhead], ues: [{ id: 'm', eastKm: 0, northKm: 0 }], simTimeSec: 0, dtSec: 1 });
  const fired = model.step({
    visibleSats: [overhead],
    ues: [{ id: 'm', eastKm: eastCell.localXKm, northKm: eastCell.localYKm }],
    simTimeSec: 1,
    dtSec: 1,
  });
  assertEqual(fired.recentHandoverEvents.length, 1, 'the HO is present the frame it fires');

  // Still in window one retention-horizon later (boundary kept), then dropped past it.
  const atHorizon = model.step({
    visibleSats: [overhead],
    ues: [{ id: 'm', eastKm: eastCell.localXKm, northKm: eastCell.localYKm }],
    simTimeSec: 1 + SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
    dtSec: 1,
  });
  assertEqual(atHorizon.recentHandoverEvents.length, 1, 'the HO is still exposed AT the retention horizon (age = window)');

  const pastHorizon = model.step({
    visibleSats: [overhead],
    ues: [{ id: 'm', eastKm: eastCell.localXKm, northKm: eastCell.localYKm }],
    simTimeSec: 1 + SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC + 0.5,
    dtSec: 1,
  });
  assertEqual(pastHorizon.recentHandoverEvents.length, 0, 'the HO is pruned once it ages past the retention window');
});

check('cumulative handover totals accumulate monotonically and reset on reset/rebase', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const c1 = layout.centers[1];
  const c2 = layout.centers[2];
  const atCell = (id: string, c: { localXKm: number; localYKm: number }, simTimeSec: number) =>
    model.step({ visibleSats: [overhead], ues: [{ id, eastKm: c.localXKm, northKm: c.localYKm }], simTimeSec, dtSec: 1 });

  const f0 = model.step({ visibleSats: [overhead], ues: [{ id: 'm', eastKm: 0, northKm: 0 }], simTimeSec: 0, dtSec: 1 });
  assertEqual(f0.cumulativeIntraHandoverCount, 0, 'cold attach does not increment the cumulative total');
  assertEqual(f0.cumulativeInterHandoverCount, 0, 'no inter on attach');

  const f1 = atCell('m', c1, 1);
  assertEqual(f1.intraHandoverCount, 1, 'one intra this frame (per-frame count)');
  assertEqual(f1.cumulativeIntraHandoverCount, 1, 'cumulative picks up the first intra-HO');

  const f2 = atCell('m', c2, 2);
  assertEqual(f2.intraHandoverCount, 1, 'still a per-frame count of 1');
  assertEqual(f2.cumulativeIntraHandoverCount, 2, 'cumulative is MONOTONIC — it SUMS across frames, unlike the per-frame count');

  const f3 = atCell('m', c2, 3);
  assertEqual(f3.cumulativeIntraHandoverCount, 2, 'a no-HO frame holds the cumulative total steady (never decrements)');

  // A rebase (timeline seek / loop-wrap) opens a fresh continuity epoch: the totals
  // reset so a replayed span is never double-counted (mirrors recentHandovers).
  model.rebase(-2000);
  const fr = atCell('m', c2, 1);
  assertEqual(fr.cumulativeIntraHandoverCount, 0, 'rebase resets the cumulative totals (the post-seek re-acquire is not a handover)');

  atCell('m', c1, 2); // bump it back above zero so the reset assertion is meaningful
  model.reset();
  const fz = model.step({ visibleSats: [overhead], ues: [{ id: 'm', eastKm: 0, northKm: 0 }], simTimeSec: 0, dtSec: 1 });
  assertEqual(fz.cumulativeIntraHandoverCount, 0, 'reset zeroes the cumulative totals');
  assertEqual(fz.cumulativeInterHandoverCount, 0, 'reset zeroes inter too');
});

check('idle cells: no visible sats → every cell unserved, every UE null SINR (honest)', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const frame = model.step({
    visibleSats: [],
    ues: [{ id: 'a', eastKm: 0, northKm: 0 }, { id: 'b', eastKm: 20, northKm: 10 }],
    simTimeSec: 0,
    dtSec: 1,
  });
  assertEqual(frame.servedCellCount, 0, 'no cell served');
  assertEqual(frame.servedUeCount, 0, 'no UE served');
  assertEqual(frame.servingSatCount, 0, 'no serving sats');
  assert(frame.ues.every(u => u.servingSatId === null && u.sinrDb === null), 'all UEs unserved with null SINR');
  assert(frame.cells.every(c => c.servingSatId === null && c.beamIdentity === null), 'all cells idle');
});

check('multiple cells served by one overhead sat report distinct beam + freq identities', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const frame = model.step({ visibleSats: [overhead], ues: [], simTimeSec: 0, dtSec: 1 });
  const served = frame.cells.filter(c => c.servingSatId !== null);
  assert(served.length >= 3, 'overhead sat lights several cells');
  assert(served.every(c => c.servingSatId === 'over'), 'all lit cells served by the overhead sat');
  const beamIds = new Set(served.map(c => c.beamIdentity));
  assertEqual(beamIds.size, served.length, 'each lit cell has a distinct sat×cell beam identity');
  // freq identity is the stable geographic colour, not a per-cell unique value
  const colours = new Set(served.map(c => c.frequencyIndex));
  assert(colours.size <= profile.beams.frequencyReuse, 'freq colours bounded by reuse factor');
});

check('illuminated beams: post-hopping lit (sat,cell) pairs; serving flag + freq match the cells', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const frame = model.step({ visibleSats: [overhead], ues: [], simTimeSec: 0, dtSec: 1 });
  assert(frame.illuminatedBeams.length > 0, 'overhead sat lights beams (the cone render surface)');
  const servingCellIds = new Set(frame.cells.filter(c => c.servingSatId === 'over').map(c => c.cellId));
  for (const b of frame.illuminatedBeams) {
    assertEqual(b.satId, 'over', 'only the overhead sat illuminates here');
    assertEqual(b.serving, servingCellIds.has(b.cellId), `beam serving flag matches cell ${b.cellId} serving`);
    assertEqual(b.frequencyIndex, cellFrequencyIndex(b.cellId, profile.beams.frequencyReuse), 'beam freq = cell freq');
  }
  // each served cell contributes exactly one serving illuminated beam (its serving sat lights it).
  const servingBeams = frame.illuminatedBeams.filter(b => b.serving).length;
  assertEqual(servingBeams, frame.servedCellCount, 'serving illuminated beams == served cells');
});

check('KEYSTONE: co-channel interference lowers cell SINR; orthogonal colours do not', () => {
  // Locks the interference field the SDD calls the keystone. reuse=1 → every lit
  // neighbour is co-channel; reuse=999 → each cell a unique colour → no co-channel
  // interferer. A model that never lights the interference field would show NO gap.
  const layout = testLayout(7);
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  function cell0Sinr(frequencyReuse: number): number {
    const p = { ...profile, beams: { ...profile.beams, frequencyReuse } };
    const m = new SinrLiveCellModel({ profile: p, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
    m.step({ visibleSats: [overhead], ues: [], simTimeSec: 0, dtSec: 1 });           // cold attach, empty field
    const f = m.step({ visibleSats: [overhead], ues: [], simTimeSec: 1, dtSec: 1 }); // candidates now see the lit field
    return f.cells.find(c => c.cellId === 0)!.servingSinrDb ?? NaN;
  }
  const coChannel = cell0Sinr(1);
  const orthogonal = cell0Sinr(999);
  assert(Number.isFinite(coChannel) && Number.isFinite(orthogonal), 'cell 0 served in both configs');
  assert(coChannel < orthogonal - 0.5, `co-channel interference lowers SINR (${coChannel.toFixed(2)} < ${orthogonal.toFixed(2)})`);
});

check('a cell never self-interferes: continuous serving keeps an interferer-free boresight SINR', () => {
  // reuse 999 isolates the own-cell beam as the ONLY possible co-channel interferer.
  // If the model wrongly lit cell C while measuring C's own candidates, C's boresight
  // beam (same position, same colour) would crater the SINR on the second frame.
  const layout = testLayout(7);
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const p = { ...profile, beams: { ...profile.beams, frequencyReuse: 999 } };
  const m = new SinrLiveCellModel({ profile: p, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const f0 = m.step({ visibleSats: [overhead], ues: [], simTimeSec: 0, dtSec: 1 });
  const f1 = m.step({ visibleSats: [overhead], ues: [], simTimeSec: 1, dtSec: 1 });
  const s0 = f0.cells.find(c => c.cellId === 0)!.servingSinrDb ?? NaN;
  const s1 = f1.cells.find(c => c.cellId === 0)!.servingSinrDb ?? NaN;
  assert(Number.isFinite(s0) && Number.isFinite(s1), 'cell 0 served both frames');
  assert(s1 > s0 - 1, `frame-2 boresight SINR not cratered by its own prior beam (${s1.toFixed(2)} ≈ ${s0.toFixed(2)})`);
});

check('gain-floored UE: served-by-assignment with null SINR (honest boundary, mirrors S2)', () => {
  const layout = buildCellLayout({ centerLatDeg: 0, centerLonDeg: 0, altitudeKm: 550, beamwidth3dBRad: 0.058, cellCount: 1 });
  const m = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const f = m.step({ visibleSats: [overhead], ues: [{ id: 'far', eastKm: 1000, northKm: 0 }], simTimeSec: 0, dtSec: 1 });
  const far = f.ues[0];
  assertEqual(far.cellId, 0, 'far UE still maps to the only cell');
  assert(far.offAxisDeg > 20, 'far UE genuinely off-axis (beyond the beam-gain floor)');
  assertEqual(far.servingSatId, 'over', 'cell is served (decided at the cell centre)');
  assertEqual(far.sinrDb, null, 'far UE has null SINR (no decodable signal at this off-axis)');
  assertEqual(f.servedUeCount, 1, 'still counted as served-by-assignment (mirrors S2 aggregate)');
});

check('served → drop end-to-end when the cell loses every candidate (drop is not a HO)', () => {
  const layout = testLayout(7);
  const m = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  m.step({ visibleSats: [overhead], ues: [{ id: 'u', eastKm: 0, northKm: 0 }], simTimeSec: 0, dtSec: 1 });
  const f = m.step({ visibleSats: [], ues: [{ id: 'u', eastKm: 0, northKm: 0 }], simTimeSec: 1, dtSec: 1 });
  assertEqual(f.ues[0].servingSatId, null, 'unserved after the sat disappears');
  assertEqual(f.ues[0].handoverKind, 'drop', 'service drop classified');
  assertEqual(f.intraHandoverCount, 0, 'drop is not an intra-HO');
  assertEqual(f.interHandoverCount, 0, 'drop is not an inter-HO');
});

check('serving sat replaced (A leaves, B arrives) → inter-HO end-to-end', () => {
  const layout = testLayout(7);
  const m = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const satA = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const satB = makeSat({ id: 'B', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const fa = m.step({ visibleSats: [satA], ues: [{ id: 'u', eastKm: 0, northKm: 0 }], simTimeSec: 0, dtSec: 1 });
  assertEqual(fa.ues[0].servingSatId, 'A', 'first served by A');
  const fb = m.step({ visibleSats: [satB], ues: [{ id: 'u', eastKm: 0, northKm: 0 }], simTimeSec: 1, dtSec: 1 });
  assertEqual(fb.ues[0].servingSatId, 'B', 'now served by B');
  assertEqual(fb.ues[0].handoverKind, 'inter', 'serving sat A→B → inter-HO');
  assertEqual(fb.interHandoverCount, 1, 'one inter this frame');
  assertEqual(fb.intraHandoverCount, 0, 'no intra');
});

// --- beam hopping: per-sat beam cap + rotating illumination window (§5.3) ------

check('beam-hopping cap: one satellite lights at most the runtime-wired beamsPerSat cells/slot', () => {
  const layout = testLayout(19); // 19 candidate cells under one overhead sat
  // Non-vacuity: the cap must actually bind over this layout (cap < cell count).
  assert(SINR_LIVE_BEAMS_PER_SAT < 19, `cap test non-vacuous (cap ${SINR_LIVE_BEAMS_PER_SAT} < 19 cells)`);
  const m = new SinrLiveCellModel({
    profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS,
    beamsPerSat: SINR_LIVE_BEAMS_PER_SAT, hopSlotSec: SINR_LIVE_HOP_SLOT_SEC,
  });
  const sat = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const f = m.step({ visibleSats: [sat], ues: [], simTimeSec: 0, dtSec: 1 });
  assert(f.servedCellCount <= SINR_LIVE_BEAMS_PER_SAT, `served cells capped to ${SINR_LIVE_BEAMS_PER_SAT} (got ${f.servedCellCount})`);
  assert(f.servedCellCount >= 1, 'at least one cell lit');
  const litCellsBySat = f.cells.filter(c => c.servingSatId === 'A').length;
  assert(litCellsBySat <= SINR_LIVE_BEAMS_PER_SAT, `sat A lights ≤ ${SINR_LIVE_BEAMS_PER_SAT} cells (got ${litCellsBySat})`);
});

check('no cap by default (beamsPerSat = Infinity) → the overhead sat lights more cells than the cap', () => {
  const layout = testLayout(19);
  const m = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const sat = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const f = m.step({ visibleSats: [sat], ues: [], simTimeSec: 0, dtSec: 1 });
  assert(
    f.servedCellCount > SINR_LIVE_BEAMS_PER_SAT,
    `uncapped pure model lights > ${SINR_LIVE_BEAMS_PER_SAT} cells (got ${f.servedCellCount}) — proves the cap actually constrains`,
  );
});

check('serving continuity: a beam SERVING a cell does NOT hop off it across slots', () => {
  // The connected-beam invariant (user-reported): once a cell is served, the
  // serving beam stays locked on it across hop slots — it must not blink off.
  // (QUAR-S4-SERVING block #4's continuity text pin retired into this behaviour.)
  const layout = testLayout(19);
  const m = new SinrLiveCellModel({
    profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS,
    beamsPerSat: SINR_LIVE_BEAMS_PER_SAT, hopSlotSec: SINR_LIVE_HOP_SLOT_SEC,
  });
  const sat = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const slot0 = m.step({ visibleSats: [sat], ues: [], simTimeSec: 0, dtSec: 1 });
  const served0 = new Set(slot0.cells.filter(c => c.servingSatId === 'A').map(c => c.cellId));
  assert(served0.size > 0, 'sat serves at least one cell in slot 0');
  // advance several hop slots
  let f = slot0;
  for (let slot = 1; slot <= 4; slot += 1) {
    f = m.step({ visibleSats: [sat], ues: [], simTimeSec: slot * SINR_LIVE_HOP_SLOT_SEC, dtSec: SINR_LIVE_HOP_SLOT_SEC });
  }
  const servedLater = new Set(f.cells.filter(c => c.servingSatId === 'A').map(c => c.cellId));
  for (const cellId of served0) {
    assert(servedLater.has(cellId), `served cell ${cellId} stays served across hop slots (beam did not hop off)`);
  }
});

check('beam hopping idle honesty: a UE in an un-illuminated cell this slot is unserved', () => {
  const layout = testLayout(19);
  const m = new SinrLiveCellModel({
    profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS,
    beamsPerSat: SINR_LIVE_BEAMS_PER_SAT, hopSlotSec: SINR_LIVE_HOP_SLOT_SEC,
  });
  const sat = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  // Put one UE in every cell centre; with the beam cap over 19 cells, the
  // overflow UEs must be unserved (their cell is dark this slot) — honest.
  const ues = layout.centers.map(c => ({ id: `ue${c.cellId}`, eastKm: c.localXKm, northKm: c.localYKm }));
  const f = m.step({ visibleSats: [sat], ues, simTimeSec: 0, dtSec: 1 });
  const served = f.ues.filter(u => u.servingSatId !== null).length;
  const unserved = f.ues.filter(u => u.servingSatId === null).length;
  assert(served <= SINR_LIVE_BEAMS_PER_SAT, `served UEs bounded by the ${SINR_LIVE_BEAMS_PER_SAT}-beam cap (got ${served})`);
  assert(unserved >= layout.centers.length - SINR_LIVE_BEAMS_PER_SAT, `the rest are honestly unserved (got ${unserved})`);
});

check('signal-profile update preserves live cell handover continuity', () => {
  const layout = testLayout(7);
  const model = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const overhead = makeSat({ id: 'over', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const eastCell = layout.centers[1]!;

  model.step({ visibleSats: [overhead], ues: [{ id: 'm', eastKm: 0, northKm: 0 }], simTimeSec: 0, dtSec: 0 });
  const fired = model.step({
    visibleSats: [overhead],
    ues: [{ id: 'm', eastKm: eastCell.localXKm, northKm: eastCell.localYKm }],
    simTimeSec: 1,
    dtSec: 1,
  });
  assertEqual(fired.recentHandoverEvents.length, 1, 'pre-update frame has a live intra-HO');

  const tuning = createSignalTuningState(profile);
  tuning.maxTxPowerDbm += 1;
  model.updateRuntimeProfile(applySignalTuning(profile, tuning), 7);

  const after = model.step({
    visibleSats: [overhead],
    ues: [{ id: 'm', eastKm: eastCell.localXKm, northKm: eastCell.localYKm }],
    simTimeSec: 2,
    dtSec: 1,
  });
  assertEqual(after.ues[0].handoverKind, 'none', 'profile update does not cold-attach the UE');
  assertEqual(after.recentHandoverEvents.length, 1, 'profile update preserves the live-HO pulse window');
});

console.log(`\n[sinr-live-cells:model] PASS — ${passed} checks (membership, 4 identities, per-cell geometry, SINR+HandoverManager serving, co-channel + self-interference, intra/inter/drop, CQ3 off-axis rolloff, gain-floor + idle-cell honesty, beam-hopping cap + serving continuity + idle honesty, live signal-profile continuity, illuminated-beam render surface)`);
