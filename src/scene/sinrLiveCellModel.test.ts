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
import {
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

check('beam-hopping cap: one satellite lights at most `beamsPerSat` cells/slot', () => {
  const layout = testLayout(19); // 19 candidate cells under one overhead sat
  const m = new SinrLiveCellModel({
    profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS,
    beamsPerSat: 7, hopSlotSec: 2.5,
  });
  const sat = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const f = m.step({ visibleSats: [sat], ues: [], simTimeSec: 0, dtSec: 1 });
  assert(f.servedCellCount <= 7, `served cells capped to 7 (got ${f.servedCellCount})`);
  assert(f.servedCellCount >= 1, 'at least one cell lit');
  const litCellsBySat = f.cells.filter(c => c.servingSatId === 'A').length;
  assert(litCellsBySat <= 7, `sat A lights ≤ 7 cells (got ${litCellsBySat})`);
});

check('no cap by default (beamsPerSat = Infinity) → the overhead sat lights > 7 cells', () => {
  const layout = testLayout(19);
  const m = new SinrLiveCellModel({ profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS });
  const sat = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const f = m.step({ visibleSats: [sat], ues: [], simTimeSec: 0, dtSec: 1 });
  assert(f.servedCellCount > 7, `uncapped pure model lights > 7 cells (got ${f.servedCellCount}) — proves the cap actually constrains`);
});

check('beam hopping: the lit cell set ROTATES across slots (every cell served periodically)', () => {
  const layout = testLayout(19);
  const m = new SinrLiveCellModel({
    profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS,
    beamsPerSat: 7, hopSlotSec: 2.5,
  });
  const sat = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  const slot0 = m.step({ visibleSats: [sat], ues: [], simTimeSec: 0, dtSec: 1 });
  const slot1 = m.step({ visibleSats: [sat], ues: [], simTimeSec: 2.5, dtSec: 2.5 });
  const lit0 = new Set(slot0.cells.filter(c => c.servingSatId !== null).map(c => c.cellId));
  const lit1 = new Set(slot1.cells.filter(c => c.servingSatId !== null).map(c => c.cellId));
  // The window advanced: at least one cell lit in slot 1 was NOT lit in slot 0.
  const fresh = [...lit1].filter(c => !lit0.has(c));
  assert(fresh.length > 0, `hopping lit a fresh cell in slot 1 (lit0=${[...lit0]}, lit1=${[...lit1]})`);
});

check('beam hopping idle honesty: a UE in an un-illuminated cell this slot is unserved', () => {
  const layout = testLayout(19);
  const m = new SinrLiveCellModel({
    profile, cellLayout: layout, observer: OBSERVER, epochUtcMs: EPOCH_MS,
    beamsPerSat: 7, hopSlotSec: 2.5,
  });
  const sat = makeSat({ id: 'A', latDeg: 0, lonDeg: 0, elevationDeg: 90 });
  // Put one UE in every cell centre; with a 7-beam cap over 19 cells, > 7 UEs
  // must be unserved (their cell is dark this slot) — honest, not borrowed.
  const ues = layout.centers.map(c => ({ id: `ue${c.cellId}`, eastKm: c.localXKm, northKm: c.localYKm }));
  const f = m.step({ visibleSats: [sat], ues, simTimeSec: 0, dtSec: 1 });
  const served = f.ues.filter(u => u.servingSatId !== null).length;
  const unserved = f.ues.filter(u => u.servingSatId === null).length;
  assert(served <= 7, `served UEs bounded by the 7-beam cap (got ${served})`);
  assert(unserved >= layout.centers.length - 7, `the rest are honestly unserved (got ${unserved})`);
});

console.log(`\n[sinr-live-cells:model] PASS — ${passed} checks (membership, 4 identities, per-cell geometry, SINR+HandoverManager serving, co-channel + self-interference, intra/inter/drop, CQ3 off-axis rolloff, gain-floor + idle-cell honesty, beam-hopping cap + rotation + idle honesty, illuminated-beam render surface)`);
