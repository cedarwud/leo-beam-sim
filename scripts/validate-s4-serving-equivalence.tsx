/**
 * Consolidation S4-3 — serving-truth EQUIVALENCE gate (the QUAR-S4-SERVING
 * keystone replacement).
 *
 * The registry promise (`tangle-locks.ts`, retired this slice): on sinr-live
 * there is ONE cell serving record — `sim.sinrLiveCells.ues` — and every
 * cell-side consumer reads it: the 3D mosaic colour map, the served-N/N HUD
 * aggregate, the cone render DATA, and the
 * published `perUePositions`. This gate drives a REAL warmed live frame
 * (stepRuntimeFrame + attachSinrLiveCellFrame, the production composition) and
 * asserts the cross-consumer agreement as DATA — render-agnostic (no cone layer
 * needs to be mounted; the S5 render flip is out of scope).
 *
 * Sections:
 *   V. ANTENNA VALUE ASSERTS — imported-constant VALUE asserts (the S3-3
 *      pattern) replacing the retired literal text pins
 *      (`export const SINR_LIVE_CELL_MAX_GAIN_DBI = 33.5` etc.), plus the
 *      factory WIRING: the model the factory returns actually carries the
 *      override values (read via cast — stronger than the retired
 *      `maxGainDbiOverrideDbi: SINR_LIVE_CELL_MAX_GAIN_DBI` text pins) and the
 *      shared `profile.antenna` is NOT written back (decoupled override).
 *   P. PUBLISHER SHAPE (behavioural) — the S4-2 review precondition: an
 *      alias-laundered re-pun (`const cid = ue.cellId; servingBeamId: cid`) is
 *      invisible to the structural sweep AND to any text needle; only executing
 *      the REAL projection catches it. Drives the exported
 *      `buildPublishedPerUePositions` on synthetic cell/steered/single-UE sims
 *      with DISTINGUISHABLE cell ids and asserts the typed output shape.
 *   E. EQUIVALENCE — on the warmed frame: published records == cell truth
 *      byte-for-byte (real projection); 3D colour map == HUD beam-load colour;
 *      aggregate served/keys == cell truth; cone DATA (serving illuminated
 *      beams → cone items) == served cells == every served UE's (satId,
 *      cellId). Non-vacuous (multi-sat,
 *      multi-unit) + run-twice determinism A==B.
 *
 * Run: `npm run validate:s4:serving-equivalence`.
 */
import assert from 'node:assert/strict';

import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import { consistentPeakGainDbi } from '../src/engine/signal/beam-gain';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';
import {
  SINR_LIVE_BEAMS_PER_SAT,
  SINR_LIVE_CELL_ANTENNA_EFFICIENCY,
  SINR_LIVE_CELL_BEAMWIDTH_RAD,
  SINR_LIVE_CELL_COUNT,
  SINR_LIVE_CELL_MAX_GAIN_DBI,
  SINR_LIVE_CELL_MAX_STEERING_DEG,
  SINR_LIVE_CELL_SCAN_LOSS_DB,
  SINR_LIVE_HOP_SLOT_SEC,
  attachSinrLiveCellFrame,
  buildSinrLiveCellLayout,
  createSinrLiveCellModel,
  type CellTruthFrame,
} from '../src/scene/sinrLiveCellRuntime.ts';
import type { SinrLiveCellFrame } from '../src/scene/sinrLiveCellModel.ts';
import { buildPublishedPerUePositions } from '../src/scene/useSimStatePublisher.ts';
import {
  buildSinrServingUeColorMapFromCells,
  deriveSinrServingMosaicAggregate,
  mosaicColorForServingSatellite,
  SINR_SERVING_UNSERVED_COLOR,
} from '../src/scene/sinrServingMosaic.ts';
import {
  resolveSinrLiveCellBeamConeItems,
  resolveTopServingFocusSatIds,
  type SinrLiveCellPlacement,
} from '../src/viz/SinrLiveCellBeamCones.tsx';

const GATE = 'validate:s4:serving-equivalence';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z
const UE_COUNT = 100;
const NOW_MS = 1_000_000; // injected display clock (S3-1) — irrelevant to serving truth
const WARM_TO_SEC = 48;
const WARM_DT_SEC = 6;

function log(line: string): void {
  console.log(`[${GATE}] ${line}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// V. ANTENNA VALUE ASSERTS — imported consts + self-consistency + factory wiring.
// Replaces the retired QUAR-S4-SERVING literal text pins (block #5) and the
// runtime/layout wiring text pins (block #4 const wiring) with VALUE/behaviour.
// ─────────────────────────────────────────────────────────────────────────────
const profile = loadProfile(PROFILE_ID);
{
  // (1)-(6): the sinr-live antenna truth-input VALUES (S-cells-4a/4e decisions).
  assert.equal(SINR_LIVE_CELL_MAX_GAIN_DBI, 33.5, 'V1: peak gain override is 33.5 dBi (self-consistent @ 3.32°, η=0.6)');
  assert.equal(SINR_LIVE_CELL_MAX_STEERING_DEG, 50, 'V2: steering override is 50° (showcase coverage, S-cells-4a)');
  assert.equal(SINR_LIVE_CELL_SCAN_LOSS_DB, 4.5, 'V3: scan loss at max steering is 4.5 dB (paired with 50°)');
  assert.equal(SINR_LIVE_CELL_BEAMWIDTH_RAD, 0.058, 'V4: link-budget/cell-layout beamwidth is 0.058 rad (≈3.32°, one antenna)');
  assert.equal(SINR_LIVE_CELL_ANTENNA_EFFICIENCY, 0.6, 'V5: aperture efficiency is 0.6 (profile parity)');
  assert.equal(SINR_LIVE_CELL_COUNT, 37, 'V6: cell count is 37 (producer hex parity, S-cells-4e)');
  // (7): gain↔beamwidth self-consistency (the >100%-efficiency guard).
  const consistent = consistentPeakGainDbi(SINR_LIVE_CELL_BEAMWIDTH_RAD, SINR_LIVE_CELL_ANTENNA_EFFICIENCY);
  assert.ok(
    Math.abs(SINR_LIVE_CELL_MAX_GAIN_DBI - consistent) < 0.5,
    `V7: |override ${SINR_LIVE_CELL_MAX_GAIN_DBI} − consistentPeakGainDbi ${consistent.toFixed(3)}| < 0.5 dB`,
  );
  // (8): de-bias vs the profile (the override exists BECAUSE the profile pairing is impossible).
  assert.ok(
    SINR_LIVE_CELL_MAX_STEERING_DEG > profile.antenna.maxSteeringAngleDeg,
    `V8a: steering override ${SINR_LIVE_CELL_MAX_STEERING_DEG}° widens the profile ${profile.antenna.maxSteeringAngleDeg}°`,
  );
  assert.ok(
    SINR_LIVE_CELL_MAX_GAIN_DBI < profile.antenna.maxGainDbi - 3,
    `V8b: gain override ${SINR_LIVE_CELL_MAX_GAIN_DBI} de-biases the profile ${profile.antenna.maxGainDbi} dBi`,
  );

  // Factory WIRING (behaviour > the retired text pins): the model the factory
  // returns carries the override values + the hopping config. Private-field read
  // via `as unknown` cast — the s4 wrap-gate precedent, no class pollution.
  const profileGainBefore = profile.antenna.maxGainDbi;
  const profileSteerBefore = profile.antenna.maxSteeringAngleDeg;
  const model = createSinrLiveCellModel(profile, true, APP_EPOCH_MS);
  assert.ok(model !== null, 'V: factory returns a model on the sinr-live lane');
  const internals = model as unknown as {
    antenna: { maxGainDbi: number; maxSteeringAngleDeg: number; scanLossAtMaxSteeringDb: number; beamwidth3dBRad: number };
    beamsPerSat: number;
    hopSlotSec: number;
  };
  assert.equal(internals.antenna.maxGainDbi, SINR_LIVE_CELL_MAX_GAIN_DBI, 'V wiring: gain override reaches the factory model');
  assert.equal(internals.antenna.maxSteeringAngleDeg, SINR_LIVE_CELL_MAX_STEERING_DEG, 'V wiring: steering override reaches the factory model');
  assert.equal(internals.antenna.scanLossAtMaxSteeringDb, SINR_LIVE_CELL_SCAN_LOSS_DB, 'V wiring: scan-loss override reaches the factory model');
  assert.equal(internals.antenna.beamwidth3dBRad, SINR_LIVE_CELL_BEAMWIDTH_RAD, 'V wiring: beamwidth override reaches the factory model');
  assert.equal(internals.beamsPerSat, SINR_LIVE_BEAMS_PER_SAT, 'V wiring: beam-hopping cap wired from the runtime const');
  assert.equal(internals.hopSlotSec, SINR_LIVE_HOP_SLOT_SEC, 'V wiring: hop slot wired from the runtime const');
  // One antenna: the cell LAYOUT is sized by the SAME beamwidth as the link-budget gain.
  assert.equal(
    buildSinrLiveCellLayout(profile).beamwidth3dBRad,
    SINR_LIVE_CELL_BEAMWIDTH_RAD,
    'V wiring: cell layout sized by the same beamwidth as the link budget (one antenna)',
  );
  // Decoupled: the shared profile antenna is NOT written back (behaviour twin of
  // the permanent `profile.antenna.maxGainDbi =` assertNotContains).
  assert.equal(profile.antenna.maxGainDbi, profileGainBefore, 'V decouple: profile peak gain untouched by the factory');
  assert.equal(profile.antenna.maxSteeringAngleDeg, profileSteerBefore, 'V decouple: profile steering untouched by the factory');
  log(`V antenna: 8 VALUE asserts + factory wiring (gain ${SINR_LIVE_CELL_MAX_GAIN_DBI} dBi / steer ${SINR_LIVE_CELL_MAX_STEERING_DEG}° / scan-loss ${SINR_LIVE_CELL_SCAN_LOSS_DB} dB / bw ${SINR_LIVE_CELL_BEAMWIDTH_RAD} rad / η ${SINR_LIVE_CELL_ANTENNA_EFFICIENCY} / ${SINR_LIVE_CELL_COUNT} cells / ${SINR_LIVE_BEAMS_PER_SAT} beams @ ${SINR_LIVE_HOP_SLOT_SEC}s), profile untouched`);
}

// ─────────────────────────────────────────────────────────────────────────────
// P. PUBLISHER SHAPE — behavioural, on the REAL exported projection.
// ─────────────────────────────────────────────────────────────────────────────
{
  // Cell lane: DISTINGUISHABLE cell ids (17/9) so a laundered re-pun
  // (`servingBeamId := cellId` through any alias) shows up as a VALUE, not text.
  const cellSim = {
    sinrLiveCells: {
      ues: [
        { ueId: 'ue-a', cellId: 17, cellDistanceKm: 1, offAxisDeg: 0.2, servingSatId: 'SAT-1', beamIdentity: 'SAT-1#cell17', frequencyIndex: 2, sinrDb: 6.5, handoverKind: 'none' },
        { ueId: 'ue-b', cellId: 9, cellDistanceKm: 2, offAxisDeg: 0.4, servingSatId: null, beamIdentity: null, frequencyIndex: null, sinrDb: null, handoverKind: 'none' },
        { ueId: 'ue-c', cellId: 9, cellDistanceKm: 1, offAxisDeg: 0.1, servingSatId: 'SAT-2', beamIdentity: 'SAT-2#cell9', frequencyIndex: 0, sinrDb: -2, handoverKind: 'none' },
      ],
    } as unknown as SinrLiveCellFrame,
    // decoy steered records — the cell branch must IGNORE them (cell truth wins)
    perUePositions: [
      { id: 'ue-a', eastKm: 0, northKm: 0, servingSatId: 'WRONG', servingBeamId: 99, sinrDb: 0 },
      { id: 'ue-b', eastKm: 0, northKm: 0, servingSatId: 'WRONG', servingBeamId: 99, sinrDb: 0 },
      { id: 'ue-c', eastKm: 0, northKm: 0, servingSatId: 'WRONG', servingBeamId: 99, sinrDb: 0 },
    ],
  };
  const published = buildPublishedPerUePositions(cellSim as Parameters<typeof buildPublishedPerUePositions>[0]);
  assert.ok(published !== undefined, 'P: cell lane publishes a record set');
  assert.equal(published.length, 3, 'P: one record per cell-truth UE');
  const a = published[0];
  assert.equal(a.id, 'ue-a', 'P: id from ueId');
  assert.equal(a.servingSatId, 'SAT-1', 'P: servingSatId is the CELL truth, not the steered decoy');
  assert.equal(a.servingBeamId, null, 'P: cell lane servingBeamId is null (no steered beam under the cell model)');
  assert.equal(a.servingCellId, 17, 'P: typed servingCellId carries the cell identity');
  assert.notEqual(a.servingBeamId, a.servingCellId, 'P ANTI-LAUNDER: servingBeamId must not carry the cell id through ANY alias');
  assert.equal(a.sinrDb, 6.5, 'P: sinrDb from the cell truth');
  assert.equal(published[1].servingCellId, null, 'P: unserved UE publishes null servingCellId (honest)');
  assert.equal(published[1].servingSatId, null, 'P: unserved UE publishes null servingSatId');
  assert.equal(published[2].servingCellId, 9, 'P: second served UE typed cell id');
  // Steered lane (no cell truth): beam id preserved, cell id null.
  const steeredSim = {
    perUePositions: [
      { id: 's-0', eastKm: 0, northKm: 0, servingSatId: 'SAT-3', servingBeamId: 5, sinrDb: 9 },
      { id: 's-1', eastKm: 0, northKm: 0, servingSatId: null, servingBeamId: null, sinrDb: null },
    ],
  };
  const steered = buildPublishedPerUePositions(steeredSim as Parameters<typeof buildPublishedPerUePositions>[0]);
  assert.ok(steered !== undefined, 'P: steered lane publishes');
  assert.equal(steered[0].servingBeamId, 5, 'P: steered beam id preserved');
  assert.equal(steered[0].servingCellId, null, 'P: steered lane servingCellId is explicit null');
  // N<=1 collapses to undefined on BOTH branches (the phase-f contract).
  assert.equal(
    buildPublishedPerUePositions({ sinrLiveCells: { ues: [cellSim.sinrLiveCells.ues[0]] } as unknown as SinrLiveCellFrame, perUePositions: [] } as Parameters<typeof buildPublishedPerUePositions>[0]),
    undefined,
    'P: single-UE cell lane publishes undefined',
  );
  assert.equal(
    buildPublishedPerUePositions({ perUePositions: [steeredSim.perUePositions[0]] } as Parameters<typeof buildPublishedPerUePositions>[0]),
    undefined,
    'P: single-UE steered lane publishes undefined',
  );
  // Determinism.
  const second = buildPublishedPerUePositions(cellSim as Parameters<typeof buildPublishedPerUePositions>[0]);
  assert.deepEqual(second, published, 'P: projection is deterministic (A==B)');
  log('P publisher shape: cell lane {beamId:null, cellId:typed} (anti-launder VALUE check), steered preserved, N<=1 undefined, A==B');
}

// ─────────────────────────────────────────────────────────────────────────────
// E. EQUIVALENCE — one REAL warmed sinr-live frame, every consumer agrees.
// ─────────────────────────────────────────────────────────────────────────────
interface EquivalenceRun {
  cells: SinrLiveCellFrame;
  published: NonNullable<ReturnType<typeof buildPublishedPerUePositions>>;
}

function runWarmFrame(): EquivalenceRun {
  const runProfile = loadProfile(PROFILE_ID);
  const observer = createObserverContext(runProfile.orbit.observerLatDeg, runProfile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(runProfile, observer, APP_EPOCH_MS);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(runProfile);
  const hoManager = new HandoverManager(runProfile.handover);
  const secondaryHoManagers = Array.from({ length: UE_COUNT - 1 }, () => new HandoverManager(runProfile.handover));
  const state = createRuntimeFrameStepState(0);
  const cellModel = createSinrLiveCellModel(runProfile, true, APP_EPOCH_MS);
  assert.ok(cellModel !== null, 'E setup: cell model non-null');
  const replay = { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: false, windowLengthSec: 7200 };
  const step = (paused: boolean, dt: number) => {
    const out = stepRuntimeFrame({
      profile: runProfile, replay, speed: 1, paused, deltaSec: paused ? 0 : dt, nowMs: NOW_MS,
      observer, beamLayoutsByShellId, trajectoryCache, hoManager, state,
      ueCount: UE_COUNT, secondaryHoManagers, uePrimaryAnchorMode: 'observer',
    });
    attachSinrLiveCellFrame(out.frame as unknown as CellTruthFrame, cellModel, out.frame.simTimeSec - out.previousSimTimeSec);
    return out;
  };
  step(true, 0);
  let out = step(false, 0);
  while (state.simTimeSec + WARM_DT_SEC <= WARM_TO_SEC + 1e-9) out = step(false, WARM_DT_SEC);
  const cells = out.frame.sinrLiveCells;
  assert.ok(cells !== undefined, 'E setup: frame carries sinrLiveCells');
  const published = buildPublishedPerUePositions(out.frame);
  assert.ok(published !== undefined, 'E setup: publisher emits the per-UE record set');
  return { cells, published };
}

const runA = runWarmFrame();
const { cells, published } = runA;
const ues = cells.ues;
const servedUes = ues.filter(ue => ue.servingSatId !== null);
const servingPairKey = (satId: string, cellId: number): string => `${satId}:${cellId}`;

// Non-vacuity: a real multi-sat multi-unit served field (the S2 money shot).
{
  const distinctUnits = new Set(servedUes.map(ue => servingPairKey(ue.servingSatId as string, ue.cellId as number)));
  const distinctSats = new Set(servedUes.map(ue => ue.servingSatId as string));
  assert.ok(servedUes.length > UE_COUNT / 3, `E VACUOUS: only ${servedUes.length}/${UE_COUNT} served at t=${WARM_TO_SEC}`);
  assert.ok(distinctUnits.size > 1, `E VACUOUS: mono serving unit (${distinctUnits.size})`);
  assert.ok(distinctSats.size >= 2, `E VACUOUS: single serving sat (${distinctSats.size})`);
}

// E1 — published records == cell truth, byte-for-byte through the REAL projection.
{
  assert.equal(published.length, ues.length, 'E1: one published record per cell-truth UE');
  for (let i = 0; i < ues.length; i += 1) {
    const ue = ues[i];
    const rec = published[i];
    assert.equal(rec.id, ue.ueId, `E1: [${i}] id == ueId`);
    assert.equal(rec.servingSatId, ue.servingSatId, `E1: [${i}] servingSatId == cell truth`);
    assert.equal(rec.servingBeamId, null, `E1: [${i}] servingBeamId null on the cell lane`);
    assert.equal(rec.servingCellId, ue.servingSatId === null ? null : ue.cellId, `E1: [${i}] servingCellId == typed cell truth`);
    assert.equal(rec.sinrDb, ue.sinrDb, `E1: [${i}] sinrDb == cell truth`);
  }
}

// E2 — 3D mosaic colour map (the REAL MainScene input: cellFrame.ues directly).
const colorById = buildSinrServingUeColorMapFromCells(ues);
{
  for (const ue of ues) {
    const color = colorById.get(ue.ueId);
    assert.ok(color !== undefined, `E2: colour map covers ${ue.ueId}`);
    if (ue.servingSatId === null) {
      assert.equal(color.markerColor, SINR_SERVING_UNSERVED_COLOR, `E2: unserved ${ue.ueId} is grey`);
    } else {
      assert.equal(
        color.markerColor,
        mosaicColorForServingSatellite(ue.servingSatId).markerColor,
        `E2: ${ue.ueId} coloured by its SERVING SATELLITE (per-sat hue, semantic-beam-colour SDD §5 Option A)`,
      );
    }
  }
}

// E3 — HUD aggregate over the published records agrees with the cell truth + 3D map.
{
  const aggregate = deriveSinrServingMosaicAggregate(published);
  assert.equal(aggregate.totalCount, ues.length, 'E3: aggregate total == cell-truth UE count');
  assert.equal(aggregate.servedCount, servedUes.length, 'E3: aggregate served == cell-truth served');
  assert.equal(aggregate.servedCount, cells.servedUeCount, 'E3: aggregate served == model servedUeCount');
  const truthUnitKeys = [...new Set(servedUes.map(ue => servingPairKey(ue.servingSatId as string, ue.cellId as number)))].sort();
  const aggregateKeys = aggregate.beamLoads.map(load => load.key).sort();
  assert.deepEqual(aggregateKeys, truthUnitKeys, 'E3: aggregate serving units == distinct cell-truth (satId, cellId) pairs');
  for (const load of aggregate.beamLoads) {
    const carrier = servedUes.find(ue => ue.servingSatId === load.satId && ue.cellId === load.beamId);
    assert.ok(carrier !== undefined, `E3: a cell-truth UE carries ${load.key}`);
    assert.equal(
      load.color,
      colorById.get(carrier.ueId)?.markerColor,
      `E3: HUD beam-load colour == 3D mosaic colour for ${load.key}`,
    );
  }
}

// E5 — cone DATA: serving illuminated beams == served cells == every served UE's unit.
{
  // Synthetic, render-agnostic placement/world inputs: EVERY cell placed, EVERY
  // frame satellite positioned — so the resolver's output is pure serving DATA.
  // CAVEAT (deliberate scope, do not over-read the PASS): because the fixture
  // is all-visible BY CONSTRUCTION, the production dropout class — a served
  // unit losing its cone to the render-derived satelliteWorldById (top-12
  // display cap), a missing placement, or the SINR_LIVE_CONE_MAX_FOCUS_SATS
  // narrowing — can never turn this section red. That render path is S5's
  // one-beam-render scope (population-beyond-display-cap KNOWN-GAP); this gate
  // must NOT be counted as covering it when QUAR-S5-BEAMRENDER retires.
  const layout = buildSinrLiveCellLayout(profile);
  const placementByCellId = new Map<number, SinrLiveCellPlacement>(
    layout.centers.map(center => [center.cellId, {
      cellId: center.cellId,
      worldX: center.localXKm,
      worldZ: -center.localYKm,
      radiusWorld: 1,
    }]),
  );
  const servingSatIds = new Set<string>();
  for (const beam of cells.illuminatedBeams) servingSatIds.add(beam.satId);
  for (const ue of servedUes) servingSatIds.add(ue.servingSatId as string);
  const satelliteWorldById = new Map([...servingSatIds].map((satId, index) => [satId, { x: index * 10, y: 100, z: 0 }]));

  const coneItems = resolveSinrLiveCellBeamConeItems({
    cellFrame: cells,
    placementByCellId,
    satelliteWorldById,
    focusSatIds: null,
  });
  const coneKeys = new Set(coneItems.map(item => servingPairKey(item.satId, item.cellId)));
  const servingBeamKeys = new Set(
    cells.illuminatedBeams.filter(beam => beam.serving).map(beam => servingPairKey(beam.satId, beam.cellId)),
  );
  const servedCellKeys = new Set(
    cells.cells.filter(cell => cell.servingSatId !== null).map(cell => servingPairKey(cell.servingSatId as string, cell.cellId)),
  );
  assert.ok(coneKeys.size > 1, `E5 VACUOUS: ${coneKeys.size} cone items`);
  assert.deepEqual([...coneKeys].sort(), [...servingBeamKeys].sort(), 'E5: cone DATA == serving illuminated beams');
  assert.deepEqual([...servingBeamKeys].sort(), [...servedCellKeys].sort(), 'E5: serving illuminated beams == served cells');
  for (const ue of servedUes) {
    const key = servingPairKey(ue.servingSatId as string, ue.cellId as number);
    assert.ok(coneKeys.has(key), `E5: served UE ${ue.ueId}'s unit ${key} has a cone (dot and cone agree)`);
  }
  // The focus resolver ranks REAL serving sats only (display narrowing never invents one).
  const focus = resolveTopServingFocusSatIds(cells, 9999, null);
  const truthSatIds = new Set(cells.cells.filter(cell => cell.servingSatId !== null).map(cell => cell.servingSatId as string));
  assert.deepEqual([...focus].sort(), [...truthSatIds].sort(), 'E5: uncapped focus set == cell-truth serving sats');
}

// Determinism: a second full run reproduces the same equivalence inputs.
{
  const runB = runWarmFrame();
  assert.deepEqual(
    JSON.parse(JSON.stringify(runB.published)),
    JSON.parse(JSON.stringify(published)),
    'E determinism: published records A==B across runs',
  );
  assert.equal(runB.cells.servedUeCount, cells.servedUeCount, 'E determinism: served count A==B');
}

log(
  `E equivalence: ${servedUes.length}/${ues.length} served, `
  + `${new Set(servedUes.map(ue => ue.servingSatId)).size} serving sats — `
  + 'published==cells (real projection), 3D==HUD colours, aggregate keyed on the typed unit, '
  + 'cones==served cells (DATA, all-visible fixture — render dropout class is S5 scope), A==B',
);
log('PASS — one cell serving record drives publisher + mosaic + aggregate + cone data (QUAR-S4-SERVING replacement)');
