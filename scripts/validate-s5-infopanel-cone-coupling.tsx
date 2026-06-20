/**
 * Consolidation S5-2b — InfoPanel ACTIVE-SERVING ↔ cone-render coupling (headless).
 *
 * The InfoPanel "ACTIVE SERVING" card is published by
 * `useSimStatePublisher.buildPublishedPrimaryServing`. Before S5-2b it read the
 * STEERED `sim.serving` primary while the cones / mosaic / connected-sat
 * invariant read the EARTH-FIXED CELL truth → when the steered primary sat
 * differed from the cell-truth primary UE's serving sat (~4/1883 frames) the
 * panel labelled a DIFFERENT sat than the cones beamed (a display↔truth lie).
 *
 * This gate drives the REAL exported `buildPublishedPrimaryServing` against the
 * REAL sinr-live runtime (stepRuntimeFrame + attachSinrLiveCellFrame, 100 UEs,
 * candidate-rich) and asserts, per cell-lane frame:
 *
 *   A (LABEL==RENDER, must-hold): published serving sat is null OR ∈ the rendered
 *     cone set (the SAME `resolveSinrLiveCellBeamConeItems` set the s0 gate +
 *     MainScene mount use). The label can never name a sat the cones do not beam.
 *   B (MIRROR): published serving sat === collectConnectedClaims primary-serving
 *     sat. Both call the shared `resolvePrimaryCellServingRecord` → panel ==
 *     invariant == cones, ONE primary oracle, no drift.
 *   C (SINGLE-MODEL, W7): the comparison column shows the CELL-TRUTH runner-up (best
 *     non-serving candidate, upgrading to the pending HO target) — NEVER the steered
 *     candidate. The steered beam id never leaks (cell comparison beamId is null) and the
 *     Δ is a single-model number; the column is blank only when the cell has no contender.
 *   D (NON-VACUOUS): ≥1 sampled frame has a served primary AND >1 coned sat.
 *   E (OFF-LANE byte-identity): with `sinrLiveCells` undefined (steered / MODQN /
 *     artifact lanes) the fn returns the steered block VERBATIM (by reference) —
 *     the duel + delta are preserved untouched.
 *   F (DETERMINISM): the warmed loop run twice is per-frame identical.
 *
 * POSITIVE CONTROLS (each proves a section is non-vacuous — coded to throw):
 *   PC1: a primary cell record re-pointed to an off-cone sat → A fires.
 *   PC2: a steered candidate leaking onto the cell lane → C fires.
 *   PC3: the by-id resolver vs an unconditional ues[0] resolver disagree on a
 *        reordered frame → B fires.
 *
 * Determinism: d6 monotonic-clock protocol (performance.now/Date.now patched).
 */
import assert from 'node:assert/strict';

// ---- Monotonic-clock patch (d6 protocol) ----
const CLOCK_EPOCH_MS = 1_700_000_000_000;
const CLOCK_TICK_MS = 50;
let clockMs = CLOCK_EPOCH_MS;
function advanceClock(): void {
  clockMs += CLOCK_TICK_MS;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).performance = {
  ...((globalThis as any).performance ?? {}),
  now: () => clockMs - CLOCK_EPOCH_MS,
};
Date.now = () => clockMs;

import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';
import { deriveRuntimeVisualSettings } from '../src/scene/runtimeConfig.ts';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry.ts';
import {
  attachSinrLiveCellFrame,
  buildSinrLiveCellLayout,
  createSinrLiveCellModel,
} from '../src/scene/sinrLiveCellRuntime.ts';
import {
  resolveSinrLiveCellBeamConeItems,
  type SinrLiveCellPlacement,
} from '../src/viz/SinrLiveCellBeamCones.tsx';
import { captureVizFrame } from '../src/validation/vizFrameProbe.tsx';
import type { RuntimeConfig, SimFrame, VizFrame } from '../src/scene/types.ts';
import { collectConnectedClaims } from '../src/validation/connectedSatBeamInvariant.ts';
import {
  buildPublishedPrimaryServing,
  type PublishedPrimaryServing,
} from '../src/scene/useSimStatePublisher.ts';
import type { SinrLiveCellFrame } from '../src/scene/sinrLiveCellModel.ts';
import { formatCellServingIdentity, formatPanelBeamIdentity } from '../src/ui/info-panel/formatters.ts';
import { formatFrequencyLabel } from '../src/utils/beamFrequency.ts';

const APP_EPOCH_MS = 1_767_225_600_000;
const UE_COUNT = 100;
const STEP_SEC = 5;
const STEP_COUNT = 120; // 600 s of the live window
const GATE = 'validate:s5:infopanel-cone-coupling';

// A realistic STEERED block used for the cell-lane override input (its content
// is irrelevant on the cell lane — fully overridden) and as the OFF-LANE
// passthrough subject (Section E asserts it survives by reference + value).
const STEERED_BLOCK: PublishedPrimaryServing = {
  servingSatId: 'STEERED-SAT-A',
  servingBeamId: 3,
  servingCellId: null,
  servingSinrDb: 12.5,
  servingElevationDeg: 40,
  servingRangeKm: 800,
  panelPrimary: {
    role: 'serving', satId: 'STEERED-SAT-A', beamId: 3, sinrDb: 12.5,
    elevationDeg: 40, rangeKm: 800, status: 'live',
  },
  comparisonSatId: 'CAND-SAT-B',
  comparisonBeamId: 5,
  comparisonSinrDb: 9.0,
  comparisonElevationDeg: 30,
  comparisonRangeKm: 900,
  comparisonKind: 'candidate',
  panelComparison: {
    role: 'candidate', satId: 'CAND-SAT-B', beamId: 5, sinrDb: 9.0,
    elevationDeg: 30, rangeKm: 900, status: 'derived',
  },
  sinrDeltaDb: -3.5,
};

// ---- Section check helpers (reused by the live loop AND the positive controls,
// so a control proving a helper throws proves the live assertion is non-vacuous).
function checkLabelInCones(published: PublishedPrimaryServing, coneSatIds: ReadonlySet<string>): void {
  if (published.servingSatId === null) return;
  assert.ok(
    coneSatIds.has(published.servingSatId),
    `A label∉render: published ACTIVE SERVING sat ${published.servingSatId} is not in the rendered cone set`,
  );
}
function checkComparison(published: PublishedPrimaryServing): void {
  // W7: the cell lane now surfaces a comparison, but in the CELL-truth model — never the
  // steered candidate. The steered beam id must never leak (cell comparison beamId is
  // null) and the comparison sat must not be the steered candidate. With a contender the Δ
  // is a real single-model number; without one the column is fully blank.
  assert.equal(published.comparisonBeamId, null, 'C: cell-lane comparison must not carry a steered beam id (single-model)');
  assert.notEqual(published.comparisonSatId, STEERED_BLOCK.comparisonSatId, 'C: cell-lane comparison must not be the steered candidate (single-model)');
  if (published.comparisonSatId === null) {
    assert.equal(published.comparisonSinrDb, null, 'C: a no-contender frame has null comparison sinr');
    assert.equal(published.comparisonKind, null, 'C: a no-contender frame has null comparisonKind');
    assert.equal(published.sinrDeltaDb, null, 'C: a no-contender frame has null delta');
    assert.equal(published.panelComparison.role, 'none', 'C: a no-contender frame has panelComparison.role none');
    return;
  }
  assert.ok(
    published.comparisonSinrDb !== null && Number.isFinite(published.comparisonSinrDb),
    'C: a contender frame has a finite cell-truth comparison sinr',
  );
  assert.ok(
    published.comparisonKind === 'candidate' || published.comparisonKind === 'pending',
    'C: a contender frame has comparisonKind candidate|pending',
  );
  assert.ok(
    published.panelComparison.role === 'candidate' || published.panelComparison.role === 'pending',
    'C: a contender frame has panelComparison.role candidate|pending',
  );
  assert.ok(
    published.sinrDeltaDb !== null && Number.isFinite(published.sinrDeltaDb),
    'C: a contender frame has a finite single-model Δ (serving − contender)',
  );
  assert.equal(published.panelComparison.satId, published.comparisonSatId, 'C: panelComparison.satId mirrors comparisonSatId');
}
function primaryClaimSatId(frame: SimFrame): string | null {
  return collectConnectedClaims(frame).find(c => c.surface === 'primary-serving')?.satId ?? null;
}
function checkMirror(published: PublishedPrimaryServing, frame: SimFrame): void {
  assert.equal(
    published.servingSatId,
    primaryClaimSatId(frame),
    'B mirror: published serving sat != collectConnectedClaims primary (resolver drift)',
  );
}

// ---- Shared runtime harness ----
const profile = loadProfile('hobs-2024-candidate-rich');
const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
const geometry = sceneGeometryFromProfile({
  shell: { altitudeKm: profile.orbit.shells[0]?.altitudeKm },
  antenna: { beamwidth3dBRad: profile.antenna.beamwidth3dBRad },
  handover: { triggerTimeSec: profile.handover.triggerTimeSec },
  orbit: { shells: profile.orbit.shells.map(s => ({ id: s.id, altitudeKm: s.altitudeKm })) },
  beams: { frequencyReuse: profile.beams.frequencyReuse },
});
const worldUnitsPerKm = 1 / geometry.kmPerWorldUnit;
const cellLayout = buildSinrLiveCellLayout(profile);
const placementByCellId = new Map<number, SinrLiveCellPlacement>(
  cellLayout.centers.map(center => [center.cellId, {
    cellId: center.cellId,
    worldX: center.localXKm * worldUnitsPerKm,
    worldZ: -center.localYKm * worldUnitsPerKm,
    radiusWorld: cellLayout.cellRadiusKm * worldUnitsPerKm,
  }]),
);
const runtime: RuntimeConfig = {
  appMode: 'sinr-experiment',
  presentationMode: 'demo-readability',
  replay: { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: false, windowLengthSec: 7200 },
  ...deriveRuntimeVisualSettings(false),
  beamDensity: 'all',
  viewport: { width: 1600, height: 1000 },
  ueCount: UE_COUNT,
  uePrimaryAnchorMode: 'observer',
};

function captureViz(sim: SimFrame): VizFrame {
  return captureVizFrame({ sim, geometry, runtime, beamHopping: profile.beamHopping });
}

interface Frame {
  sim: SimFrame;
  coneSatIds: Set<string>;
  published: PublishedPrimaryServing;
}

function runLoop(): Frame[] {
  const replay = { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: false, windowLengthSec: 7200 };
  const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const hoManager = new HandoverManager(profile.handover);
  const secondaryHoManagers = Array.from({ length: UE_COUNT - 1 }, () => new HandoverManager(profile.handover));
  const state = createRuntimeFrameStepState(0);
  const cellModel = createSinrLiveCellModel(profile, true, APP_EPOCH_MS);
  assert.ok(cellModel !== null, 'cell model must build under the sinr-live gate');

  const frames: Frame[] = [];
  for (let step = 0; step < STEP_COUNT; step += 1) {
    advanceClock();
    const out = stepRuntimeFrame({
      profile,
      replay,
      speed: 1,
      paused: step === 0,
      deltaSec: step === 0 ? 0 : STEP_SEC,
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      state,
      ueCount: UE_COUNT,
      secondaryHoManagers,
      uePrimaryAnchorMode: 'observer',
    });
    attachSinrLiveCellFrame(out.frame, cellModel, step === 0 ? 0 : STEP_SEC);

    const viz = captureViz(out.frame);
    const coneSatIds = new Set(
      resolveSinrLiveCellBeamConeItems({
        cellFrame: out.frame.sinrLiveCells,
        placementByCellId,
        satelliteWorldById: viz.coneApexWorldById,
        focusSatIds: null,
      }).map(item => item.satId),
    );
    const published = buildPublishedPrimaryServing(out.frame, STEERED_BLOCK);
    frames.push({ sim: out.frame, coneSatIds, published });
  }
  return frames;
}

const frames = runLoop();

// ---- Sections A / B / C across every cell-lane frame ----
let cellLaneFrames = 0;
let servedFrames = 0;
let nonVacuousFrame = false;
for (const { sim, coneSatIds, published } of frames) {
  assert.ok(sim.sinrLiveCells !== undefined, 'gate must run on the sinr-live cell lane');
  cellLaneFrames += 1;
  checkLabelInCones(published, coneSatIds);   // A
  checkMirror(published, sim);                // B
  checkComparison(published);                 // C
  if (published.servingSatId !== null) servedFrames += 1;
  if (published.servingSatId !== null && coneSatIds.size > 1) nonVacuousFrame = true;
}

// ---- Section D: non-vacuous ----
assert.ok(cellLaneFrames > STEP_COUNT / 2, `vacuous: only ${cellLaneFrames}/${STEP_COUNT} cell-lane frames`);
assert.ok(servedFrames > STEP_COUNT / 2, `vacuous: only ${servedFrames}/${STEP_COUNT} frames had a served primary`);
assert.ok(nonVacuousFrame, 'vacuous: no frame had a served primary AND >1 coned sat');

// ---- Section E: off-lane byte-identity (steered / MODQN / artifact passthrough) ----
const offLaneSim = { sinrLiveCells: undefined, perUePositions: frames[10]!.sim.perUePositions };
const offLanePublished = buildPublishedPrimaryServing(offLaneSim, STEERED_BLOCK);
assert.strictEqual(offLanePublished, STEERED_BLOCK, 'E: off-lane must return the steered block by reference (untouched)');
assert.equal(offLanePublished.servingSatId, 'STEERED-SAT-A', 'E: off-lane serving sat must be the steered passthrough');
assert.equal(offLanePublished.comparisonSatId, 'CAND-SAT-B', 'E: off-lane comparison must be preserved (duel intact)');
assert.equal(offLanePublished.sinrDeltaDb, -3.5, 'E: off-lane delta must be preserved (duel intact)');

// ---- Section F: determinism ----
const framesB = runLoop();
assert.equal(framesB.length, frames.length, 'F: frame count mismatch on re-run');
for (let i = 0; i < frames.length; i += 1) {
  assert.equal(framesB[i]!.published.servingSatId, frames[i]!.published.servingSatId, `F: servingSatId differs at frame ${i}`);
  assert.equal(framesB[i]!.published.comparisonSatId, frames[i]!.published.comparisonSatId, `F: comparison differs at frame ${i}`);
  assert.equal(framesB[i]!.published.sinrDeltaDb, frames[i]!.published.sinrDeltaDb, `F: delta differs at frame ${i}`);
}

// ---- Section G: serving LABEL frequency == rendered cone frequency ----
// The InfoPanel cell-lane identity uses formatCellServingIdentity (0-indexed
// cellFrequencyIndex). A regression to the 1-indexed steered-beam formula
// (formatPanelBeamIdentity → getBeamFrequencyIndex) would name a DIFFERENT
// frequency than the cone for every cell ≠ 0 (mod reuse). This drives the REAL
// shared helper and ties its frequency token to the cone's actual
// IlluminatedCellBeam.frequencyIndex (the render value).
const reuse = profile.beams.frequencyReuse;
let freqCheckedFrames = 0;
for (const { sim, published } of frames) {
  const satId = published.servingSatId;
  const cellId = published.servingCellId;
  if (satId === null || cellId === null) continue;
  const cone = (sim.sinrLiveCells as SinrLiveCellFrame).illuminatedBeams.find(
    b => b.serving && b.satId === satId && b.cellId === cellId,
  );
  if (cone === undefined) continue;
  const coneFreqToken = formatFrequencyLabel(cone.frequencyIndex);
  const label = formatCellServingIdentity(satId, cellId, reuse, 'none');
  assert.ok(
    label.includes(`${coneFreqToken} B`),
    `G: cell-lane serving label "${label}" frequency token != rendered cone ${coneFreqToken} (cell ${cellId})`,
  );
  freqCheckedFrames += 1;
}
assert.ok(freqCheckedFrames > 0, 'G vacuous: no served cell-lane frame had a matching serving cone beam');

// ---- Positive controls (each must THROW; reverted assertions confirm non-vacuity) ----
function assertThrows(fn: () => void, label: string): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert.ok(threw, `positive control did not fire: ${label}`);
}

// PC1 (A non-vacuous): re-point the primary cell record to a sat NOT in the cone
// set → the published label leaves the cones → checkLabelInCones must throw.
const pc1Source = frames.find(f => f.published.servingSatId !== null && f.coneSatIds.size > 0);
assert.ok(pc1Source !== undefined, 'PC1 could not arm: no served cell-lane frame');
{
  const cellFrame = pc1Source.sim.sinrLiveCells as SinrLiveCellFrame;
  const primaryUeId = pc1Source.sim.perUePositions[0]!.id;
  const offConeSat = 'SAT-DEFINITELY-NOT-CONED';
  assert.ok(!pc1Source.coneSatIds.has(offConeSat), 'PC1 fixture sat must be off-cone');
  const mutatedCellFrame: SinrLiveCellFrame = {
    ...cellFrame,
    ues: cellFrame.ues.map(ue => (ue.ueId === primaryUeId ? { ...ue, servingSatId: offConeSat } : ue)),
  };
  const mutatedSim = { sinrLiveCells: mutatedCellFrame, perUePositions: pc1Source.sim.perUePositions };
  const mutatedPublished = buildPublishedPrimaryServing(mutatedSim, STEERED_BLOCK);
  assert.equal(mutatedPublished.servingSatId, offConeSat, 'PC1: re-point did not take');
  assertThrows(() => checkLabelInCones(mutatedPublished, pc1Source.coneSatIds), 'PC1 off-cone label');
}

// PC2 (C non-vacuous): a STEERED candidate leaking onto the cell lane (steered sat + beam
// id) → checkComparison throws (the single-model guard catches the steered-beam leak).
assertThrows(
  () => checkComparison({
    ...frames[10]!.published,
    comparisonSatId: STEERED_BLOCK.comparisonSatId,
    comparisonBeamId: 5,
    comparisonSinrDb: 9.0,
    sinrDeltaDb: 5.0,
    comparisonKind: 'candidate',
  }),
  'PC2 steered candidate leaked onto the cell lane',
);

// PC3 (B non-vacuous): on a frame where the by-id primary differs from ues[0],
// a published value built off ues[0] (the broken resolver) must fail the mirror.
const pc3Source = frames.find(f => {
  const cf = f.sim.sinrLiveCells as SinrLiveCellFrame;
  const primaryUeId = f.sim.perUePositions[0]?.id;
  const byId = cf.ues.find(ue => ue.ueId === primaryUeId)?.servingSatId ?? null;
  const byZero = cf.ues[0]?.servingSatId ?? null;
  return byId !== byZero && byId !== null;
});
if (pc3Source !== undefined) {
  const cf = pc3Source.sim.sinrLiveCells as SinrLiveCellFrame;
  const brokenPublished: PublishedPrimaryServing = {
    ...pc3Source.published,
    servingSatId: cf.ues[0]?.servingSatId ?? null, // the broken "ues[0] unconditional" resolver
  };
  assertThrows(() => checkMirror(brokenPublished, pc3Source.sim), 'PC3 mirror drift');
} else {
  // No naturally-divergent frame in this window: synthesise one so PC3 still
  // proves the mirror check is non-vacuous (reorder so ues[0] != by-id primary).
  const base = frames.find(f => (f.sim.sinrLiveCells as SinrLiveCellFrame).ues.length > 1);
  assert.ok(base !== undefined, 'PC3 could not arm: no multi-UE frame');
  const cf = base.sim.sinrLiveCells as SinrLiveCellFrame;
  const primaryUeId = base.sim.perUePositions[0]!.id;
  const primaryIdx = cf.ues.findIndex(ue => ue.ueId === primaryUeId);
  const otherIdx = cf.ues.findIndex((ue, i) => i !== primaryIdx && ue.servingSatId !== (cf.ues[primaryIdx]?.servingSatId ?? null));
  assert.ok(otherIdx >= 0, 'PC3 could not arm: no UE with a different serving sat');
  const reordered = [cf.ues[otherIdx]!, ...cf.ues.filter((_, i) => i !== otherIdx)];
  const synthFrame: SimFrame = { ...base.sim, sinrLiveCells: { ...cf, ues: reordered } };
  const brokenPublished: PublishedPrimaryServing = {
    ...base.published,
    servingSatId: reordered[0]!.servingSatId, // ues[0] resolver after reorder != by-id primary
  };
  assertThrows(() => checkMirror(brokenPublished, synthFrame), 'PC3 mirror drift (synthetic)');
}

// PC4 (G non-vacuous): the steered-beam frequency formula (the old bug,
// formatPanelBeamIdentity → 1-indexed) MUST disagree with the cell formula
// (formatCellServingIdentity → 0-indexed) for a cell ≠ 0 mod reuse — proving the
// InfoPanel's helper choice is load-bearing and the off-by-one is detectable.
{
  const pc4Cell = 1; // reuse>1: cellFreq=1%reuse=1 (F2) vs beamFreq=(1-1)%reuse=0 (F1)
  const correct = formatCellServingIdentity('SAT-PC4', pc4Cell, reuse, 'none');
  const buggy = formatPanelBeamIdentity('SAT-PC4', pc4Cell, reuse, 'none');
  assert.ok(reuse > 1, 'PC4 requires frequencyReuse > 1 to distinguish the formulas');
  assert.notEqual(correct, buggy, 'PC4: cell vs steered-beam freq formatters agree at cell 1 — the off-by-one is not detectable');
}

console.log(
  `[${GATE}] ${cellLaneFrames} cell-lane frames, ${servedFrames} served-primary, ` +
  'A label∈cones + B mirror(panel==invariant==cones) + C single-model comparison (cell-truth contender, no steered leak) all hold',
);
console.log(`[${GATE}] G label-freq==cone-freq (${freqCheckedFrames} frames), E off-lane passthrough, F determinism A==B, PC1/PC2/PC3/PC4 fired`);
console.log(`[${GATE}] PASS`);
