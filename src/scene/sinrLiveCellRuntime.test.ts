#!/usr/bin/env node
/**
 * Runtime-wiring gate for the SINR-live earth-fixed cell truth (S-cells-2,
 * ADDITIVE). Authority `docs/sinr-live-earth-fixed-cells-mini-sdd.md` §6 +
 * decision S-cells-2-A (additive; `runtimeFrameStep.ts` FROZEN).
 *
 * This gate locks the WIRING CONTRACT, not the cell physics (that is the job of
 * `validate:phase-c:sinr-live-cells:model`). It asserts:
 *   1. the lane gate: the model factory returns `null` when the gate is off
 *      (the non-SINR/artifact lanes) → {@link attachSinrLiveCellFrame} is a
 *      no-op → the frame is byte-identical (other-lane ZERO-DRIFT, the whole
 *      point of the additive design);
 *   2. when the gate is on (sinr-live) the attach hangs a well-formed
 *      {@link SinrLiveCellFrame} on `frame.sinrLiveCells` and mutates NOTHING
 *      else on the frame;
 *   3. the cell layout is built from the live profile at the tunable cell count;
 *   4. the model the factory returns is resettable (so the hook's
 *      `resetAllHoManagers` → `.reset()` wiring produces a clean cold-attach);
 *   5. elevation-mask parity with the cell-layout default (the runtime
 *      `MIN_ELEVATION_DEG = 15` equality is locked by the validate:s3:one-reset
 *      imported-constant VALUE asserts).
 *
 * Run: `npm run validate:phase-c:sinr-live-cells:runtime`.
 */
import { DEFAULT_MIN_ELEVATION_DEG } from '../engine/cells/cellLayout';
import { loadProfile } from '../profiles/index';
import { applyLegacyConstellationPreset } from '../sceneTopology';
import { SinrLiveCellModel, type CellModelSat } from './sinrLiveCellModel';
import {
  SINR_LIVE_CELL_COUNT,
  SINR_LIVE_CELL_MAX_STEERING_DEG,
  SINR_LIVE_CELL_MIN_ELEVATION_DEG,
  attachSinrLiveCellFrame,
  buildSinrLiveCellLayout,
  createSinrLiveCellModel,
  resolveSinrLiveSceneCellCount,
  type CellTruthFrame,
} from './sinrLiveCellRuntime';

let passed = 0;
function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(`FAIL: ${label}`);
}
function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
function check(label: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${label}`);
}

const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const profile = loadProfile('hobs-2024-candidate-rich');
const onewebProfile = applyLegacyConstellationPreset(profile, 'oneweb');
const OBS_LAT = profile.orbit.observerLatDeg;
const OBS_LON = profile.orbit.observerLonDeg;

function makeSat(id: string, opts: { latDeg?: number; lonDeg?: number; elevationDeg: number }): CellModelSat {
  return {
    id,
    shellId: 'shell-test',
    altitudeKm: 550,
    topo: { azimuthDeg: 0, elevationDeg: opts.elevationDeg },
    latDeg: opts.latDeg ?? OBS_LAT,
    lonDeg: opts.lonDeg ?? OBS_LON,
  };
}

/**
 * A frame carrying the minimal cell-truth surface PLUS decoy "existing" fields
 * (shaped like real SimFrame members). The decoys let the zero-drift assertions
 * prove attach touches ONLY `sinrLiveCells` — by reference identity, the
 * strongest no-mutation proof.
 */
type DecoyFrame = CellTruthFrame & {
  serving: { satId: string | null; beamId: number | null; sinrDb: number };
  hoCount: number;
  beamCellsBySatId: Map<string, unknown>;
};

function makeFrame(over: Partial<DecoyFrame> = {}): DecoyFrame {
  return {
    satellites: over.satellites ?? [makeSat('over', { elevationDeg: 90 })],
    perUePositions: over.perUePositions ?? [
      { id: 'centre', eastKm: 0, northKm: 0 },
      { id: 'off', eastKm: 8, northKm: 0 },
    ],
    simTimeSec: over.simTimeSec ?? 0,
    serving: over.serving ?? { satId: 'pre-existing', beamId: 4, sinrDb: 12.5 },
    hoCount: over.hoCount ?? 7,
    beamCellsBySatId: over.beamCellsBySatId ?? new Map([['over', [{ beamId: 1 }]]]),
  };
}

function snapshotNonCellFields(frame: DecoyFrame) {
  return {
    satellites: frame.satellites,
    perUePositions: frame.perUePositions,
    simTimeSec: frame.simTimeSec,
    serving: frame.serving,
    servingSinrDb: frame.serving.sinrDb,
    hoCount: frame.hoCount,
    beamCellsBySatId: frame.beamCellsBySatId,
  };
}

function assertNonCellFieldsUnchanged(
  before: ReturnType<typeof snapshotNonCellFields>,
  frame: DecoyFrame,
  label: string,
): void {
  assert(before.satellites === frame.satellites, `${label}: satellites ref unchanged`);
  assert(before.perUePositions === frame.perUePositions, `${label}: perUePositions ref unchanged`);
  assertEqual(before.simTimeSec, frame.simTimeSec, `${label}: simTimeSec unchanged`);
  assert(before.serving === frame.serving, `${label}: serving ref unchanged`);
  assertEqual(before.servingSinrDb, frame.serving.sinrDb, `${label}: serving.sinrDb value unchanged`);
  assertEqual(before.hoCount, frame.hoCount, `${label}: hoCount unchanged`);
  assert(before.beamCellsBySatId === frame.beamCellsBySatId, `${label}: beamCellsBySatId ref unchanged`);
}

// --- config / layout ---------------------------------------------------------

check('SINR_LIVE_CELL_COUNT is a positive integer (the single S-cells-5 tuning point)', () => {
  assert(Number.isInteger(SINR_LIVE_CELL_COUNT) && SINR_LIVE_CELL_COUNT > 0, 'positive int');
});

check('elevation-mask parity with the cell-layout default (runtime 15° locked by validate:s3:one-reset)', () => {
  assertEqual(SINR_LIVE_CELL_MIN_ELEVATION_DEG, DEFAULT_MIN_ELEVATION_DEG, 'mask == cell-layout default');
});

check('cell layout is built from the live profile at the tunable cell count', () => {
  const layout = buildSinrLiveCellLayout(profile);
  assertEqual(layout.centers.length, SINR_LIVE_CELL_COUNT, 'cell count from const');
  assertEqual(layout.count, SINR_LIVE_CELL_COUNT, 'layout.count from const');
  assertEqual(layout.altitudeKm, profile.orbit.shells[0]!.altitudeKm, 'altitude from profile shell');
  // Cell size uses the SINR-live beamwidth (= profile antenna value); the model's
  // link-budget GAIN is derived from the SAME beamwidth (one antenna).
  assertEqual(layout.beamwidth3dBRad, profile.antenna.beamwidth3dBRad, 'beamwidth = profile antenna');
});

check('Walker OneWeb keeps the homepage ground-cell footprint readable', () => {
  const starlinkLayout = buildSinrLiveCellLayout(profile);
  const onewebLayout = buildSinrLiveCellLayout(onewebProfile);
  assert(onewebProfile.orbit.shells[0]!.altitudeKm > profile.orbit.shells[0]!.altitudeKm, 'OneWeb keeps the higher shell altitude');
  assert(onewebProfile.orbit.shells[0]!.planes < profile.orbit.shells[0]!.planes, 'OneWeb keeps fewer planes');
  assert(onewebProfile.orbit.shells[0]!.satsPerPlane < profile.orbit.shells[0]!.satsPerPlane, 'OneWeb keeps fewer satellites per plane');
  assertEqual(onewebProfile.orbit.shells[0]!.inclinationDeg, profile.orbit.shells[0]!.inclinationDeg, 'OneWeb keeps the same Walker inclination');
  assertEqual(onewebProfile.antenna.beamwidth3dBRad, profile.antenna.beamwidth3dBRad, 'OneWeb keeps the same antenna beamwidth');
  assertEqual(onewebProfile.beams.perSatellite, profile.beams.perSatellite, 'OneWeb keeps the same beam count');
  assert(
    onewebLayout.cellRadiusKm <= starlinkLayout.cellRadiusKm * 1.05,
    `OneWeb ground cells must stay within the Starlink presentation scale (Starlink ${starlinkLayout.cellRadiusKm}, OneWeb ${onewebLayout.cellRadiusKm})`,
  );
});

check('serving-satellite layout selects matching 1/7/19 scene-cell truth', () => {
  assertEqual(resolveSinrLiveSceneCellCount(1), 1, 'serving layout 1 → one scene cell');
  assertEqual(resolveSinrLiveSceneCellCount(7), 7, 'serving layout 7 → seven scene cells');
  assertEqual(resolveSinrLiveSceneCellCount(19), 19, 'serving layout 19 → nineteen scene cells');
  assertEqual(resolveSinrLiveSceneCellCount(undefined), 7, 'missing serving layout → default seven cells');

  const oneCellModel = createSinrLiveCellModel(profile, true, EPOCH_MS, {}, 1)!;
  const nineteenCellModel = createSinrLiveCellModel(profile, true, EPOCH_MS, {}, 19)!;
  assertEqual((oneCellModel as unknown as { cellLayout: { centers: readonly unknown[] } }).cellLayout.centers.length, 1, 'model layout 1');
  assertEqual((nineteenCellModel as unknown as { cellLayout: { centers: readonly unknown[] } }).cellLayout.centers.length, 19, 'model layout 19');
});

// --- profile-backed antenna truth-input --------------------------------------

check('factory keeps the profile antenna values visible to the live cell truth', () => {
  const model = createSinrLiveCellModel(profile, true, EPOCH_MS)!;
  const internals = model as unknown as { antenna: typeof profile.antenna };
  assertEqual(internals.antenna.maxGainDbi, profile.antenna.maxGainDbi, 'peak gain comes from profile');
  assertEqual(internals.antenna.beamwidth3dBRad, profile.antenna.beamwidth3dBRad, 'beamwidth comes from profile');
  assertEqual(internals.antenna.maxSteeringAngleDeg, profile.antenna.maxSteeringAngleDeg, 'max steering comes from profile');
  assertEqual(internals.antenna.scanLossAtMaxSteeringDb, profile.antenna.scanLossAtMaxSteeringDb, 'scan loss comes from profile');
});

check('the presentation coverage guard keeps a >12° cell reachable without changing formula antenna values', () => {
  const model = createSinrLiveCellModel(profile, true, EPOCH_MS)!;
  // A sat whose nadir is ~320 km east of the observer → scan-to-centre ≈ 30°.
  // The coverage guard keeps the fixed presentation cell populated, while the
  // model's antenna (asserted above) remains profile-backed for scan loss/SINR.
  const lonOffsetDeg = 320 / (111.32 * Math.cos((OBS_LAT * Math.PI) / 180));
  const offNadir = makeSat('offnadir', { latDeg: OBS_LAT, lonDeg: OBS_LON + lonOffsetDeg, elevationDeg: 55 });
  const frame = makeFrame({
    satellites: [offNadir],
    perUePositions: [{ id: 'c', eastKm: 0, northKm: 0 }],
    simTimeSec: 0,
  });
  attachSinrLiveCellFrame(frame, model, 1);
  const cell0 = frame.sinrLiveCells!.cells.find(c => c.cellId === 0)!;
  assertEqual(cell0.servingSatId, 'offnadir', 'centre cell served by the presentation coverage guard');
  assert(SINR_LIVE_CELL_MAX_STEERING_DEG > profile.antenna.maxSteeringAngleDeg, 'coverage guard is wider than the default profile control');
});

// --- the lane gate (other-lane zero-drift) -----------------------------------

check('gate OFF (non-SINR lanes) → factory returns null', () => {
  assertEqual(createSinrLiveCellModel(profile, false, EPOCH_MS), null, 'gate off → null model');
});

check('gate ON (sinr-live) → factory returns a SinrLiveCellModel', () => {
  const model = createSinrLiveCellModel(profile, true, EPOCH_MS);
  assert(model instanceof SinrLiveCellModel, 'gate on → real model');
});

check('ADDITIVE no-op: attaching a null model leaves the frame byte-identical (zero-drift)', () => {
  const frame = makeFrame();
  const before = snapshotNonCellFields(frame);
  attachSinrLiveCellFrame(frame, null, 1);
  assertEqual(frame.sinrLiveCells, undefined, 'no sinrLiveCells field added off lane');
  assertNonCellFieldsUnchanged(before, frame, 'null-model attach');
});

// --- gate-on attach: populated + well-formed + zero-drift on other fields -----

check('gate ON attach populates a well-formed sinrLiveCells frame and mutates nothing else', () => {
  const model = createSinrLiveCellModel(profile, true, EPOCH_MS)!;
  const frame = makeFrame();
  const before = snapshotNonCellFields(frame);
  attachSinrLiveCellFrame(frame, model, 0);

  const cells = frame.sinrLiveCells;
  assert(cells !== undefined, 'sinrLiveCells populated on lane');
  assertEqual(cells!.cells.length, SINR_LIVE_CELL_COUNT, 'one record per cell');
  assertEqual(cells!.ues.length, frame.perUePositions.length, 'one record per UE');
  assertEqual(cells!.simTimeSec, frame.simTimeSec, 'cell frame carries the frame sim time');
  assertEqual(cells!.sourceFrameId, `walker:${EPOCH_MS}:${EPOCH_MS}`, 'cell frame carries the accepted source frame id');
  assert(cells!.servedUeCount >= 1, 'at least one UE served by the overhead sat');
  assert(cells!.servingSatCount >= 1, 'at least one serving sat');
  assert(cells!.servedCellCount >= 1, 'at least one cell lit');
  assert(cells!.illuminatedBeams.length >= 1, 'at least one illuminated beam (the cone render surface)');

  const off = cells!.ues.find(u => u.ueId === 'off')!;
  const centre = cells!.ues.find(u => u.ueId === 'centre')!;
  assert(off !== undefined && centre !== undefined, 'both UEs present by id (mapping preserved order/ids)');
  assertEqual(centre.cellId, 0, 'centre UE maps to cell 0');
  assert(off.offAxisDeg > 0, 'off-centre UE keeps a real off-axis angle (the CQ3 truth)');
  assert(off.servingSatId === 'over', 'off UE served by the overhead sat');
  assertEqual(off.beamIdentity, 'over#cell0', 'beam identity = sat × cell');

  // The load-bearing additive invariant: only sinrLiveCells changed.
  assertNonCellFieldsUnchanged(before, frame, 'gate-on attach');
});

check('dt is sanitised: non-finite / negative deltas do not throw and still populate', () => {
  const model = createSinrLiveCellModel(profile, true, EPOCH_MS)!;
  for (const dt of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
    const frame = makeFrame();
    attachSinrLiveCellFrame(frame, model, dt);
    assert(frame.sinrLiveCells !== undefined, `dt=${dt} still populates`);
  }
});

// --- reset wiring (hook calls model.reset() in resetAllHoManagers) ------------

check('the factory model is resettable → reset produces a clean cold-attach', () => {
  const model = createSinrLiveCellModel(profile, true, EPOCH_MS)!;
  const overhead = [makeSat('over', { elevationDeg: 90 })];

  // frame 0: cold attach at cell 0
  const f0 = makeFrame({ satellites: overhead, perUePositions: [{ id: 'm', eastKm: 0, northKm: 0 }], simTimeSec: 0 });
  attachSinrLiveCellFrame(f0, model, 0);
  assertEqual(f0.sinrLiveCells!.ues[0].handoverKind, 'attach', 'first step is a cold attach');

  // frame 1: UE crosses into the east cell under the same sat → intra-HO
  const layout = buildSinrLiveCellLayout(profile);
  const eastCell = layout.centers[1]!;
  const f1 = makeFrame({
    satellites: overhead,
    perUePositions: [{ id: 'm', eastKm: eastCell.localXKm, northKm: eastCell.localYKm }],
    simTimeSec: 1,
  });
  attachSinrLiveCellFrame(f1, model, 1);
  assertEqual(f1.sinrLiveCells!.ues[0].handoverKind, 'intra', 'UE crossing a same-sat cell is an intra-HO');

  // reset → the next attach of the original frame is a cold attach again, proving
  // the per-UE serving memory + per-cell managers were cleared.
  model.reset();
  const f2 = makeFrame({ satellites: overhead, perUePositions: [{ id: 'm', eastKm: 0, northKm: 0 }], simTimeSec: 2 });
  attachSinrLiveCellFrame(f2, model, 0);
  assertEqual(f2.sinrLiveCells!.ues[0].handoverKind, 'attach', 'post-reset step is a fresh cold attach');
});

console.log(
  `\n[sinr-live-cells:runtime] PASS — ${passed} checks `
  + '(lane gate, additive zero-drift, populated+well-formed cell frame, dt sanitisation, reset wiring, '
  + 'antenna self-consistency + steering-override wiring)',
);
