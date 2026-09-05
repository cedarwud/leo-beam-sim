import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfile } from '../profiles/index';
import {
  SinrLiveCellModel,
  cellBeamIdentityForLink,
  cellFrequencyIndex,
  cellIdFromLinkBudgetBeamId,
  cellLinkBudgetBeamId,
  intraCellLinkBudgetBeamId,
  resolveIntraCellBeamCenter,
  type CellModelSat,
  type SinrLiveCellFrame,
} from './sinrLiveCellModel';
import { buildSinrLiveCellLayout } from './sinrLiveCellRuntime';
import { getBeamFrequencyIndex } from '../utils/beamFrequency';
import { elevationAngleRad } from '../engine/cells/cellLayout';

const OBSERVER = { latDeg: 40, lonDeg: 116 };
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
// Directly overhead (90 deg) put real measured EE at ~648k/666k bit/J for the
// normal/alternate beams -- 4-5x the 135,000 bit/J homepage EE floor, so
// `servingBelowEeThreshold` could never engage and the intra-switch TTT/dwell
// logic never got a chance to run. This offset moves the satellite to a real
// ~41 deg elevation, where measured EE lands at ~124k/126k bit/J: genuinely
// below the floor, with the alternate beam still measurably higher than the
// normal one (same ordering as at zenith -- SDD F3's fix, not this offset,
// is what made that ordering reflect real geometry). `sat.topo.elevationDeg`
// itself is only a coarse visibility pre-filter
// (`sat.topo.elevationDeg >= this.minElevationDeg` in sinrLiveCellModel.ts)
// -- the value that actually drives EE/SINR is computed from lat/lon/altitude
// geometry, which is why it has to move here rather than that field.
const SAT_LON_OFFSET_DEG = 6.5;
// The 7-cell layout requires the full default gate set (unlike 1-cell, see
// below), including `steering`. At this offset the real scan angle for both
// candidate beams is ~45.1-45.2deg (measured directly against this fixture),
// which exceeds the base profile's `maxSteeringAngleDeg: 40`. That 40deg
// limit is a real antenna capability figure used elsewhere (candidate
// admission, the live homepage), so it is deliberately NOT changed here.
// Declared teaching-scenario widening instead (SDD
// docs/sdd/FRONTEND-AUTHORITY-REFACTOR-SDD.md SS9's "declared synthetic
// scenario" option), scoped to only this 7-cell test's SinrLiveCellModel
// instance via the existing per-instance override surface
// (`maxSteeringAngleOverrideDeg`/`scanLossAtMaxSteeringOverrideDb`,
// `sinrLiveCellModel.ts` `resolveAntenna()`), which keeps the eligibility
// gate and the link-budget's own scan-loss physics reading the same
// `this.antenna.maxSteeringAngleDeg`, so neither can disagree with the other.
//
// 48deg gives ~2.8deg of margin over the measured ~45.17deg maximum (not a
// round-number guess -- picked above the measured ceiling with headroom).
// The paired scan-loss override keeps the ORIGINAL 40deg point's loss
// unchanged at the base profile's 4 dB (`computeSteeringLossDb` in
// `link-budget.ts` is `scanLossAtMaxSteeringDb * (scanAngle/maxSteering)^2`,
// so solving for the new ceiling that preserves loss=4dB at scanAngle=40deg
// gives `4 * (48/40)^2 = 5.76`); the ~45.1deg beams here see ~5.1 dB, a
// modest, continuous increase over the base 4 dB rather than a discontinuity
// -- this is NOT a claim about Starlink's real steering envelope, only a
// consistent physics extrapolation for this declared teaching scenario.
const SEVEN_CELL_STEERING_OVERRIDE = {
  maxSteeringAngleOverrideDeg: 48,
  scanLossAtMaxSteeringOverrideDb: 5.76,
} as const;

function makeModel(cellCount: 1 | 7): {
  model: SinrLiveCellModel;
  frameAtVariant: SinrLiveCellFrame;
  sat: CellModelSat;
  ue: { readonly id: string; readonly eastKm: number; readonly northKm: number };
  variantBeamId: number;
} {
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const profile = {
    ...baseProfile,
    handover: {
      ...baseProfile.handover,
      sinrThresholdDb: -100,
      offsetDb: 0,
      triggerTimeSec: 1,
      intraSwitchTimeSec: 0.75,
      pingPongGuardSec: 0,
      minimumDistinctCandidateSatellites: 0,
    },
    beams: { ...baseProfile.beams, frequencyReuse: 3 },
  };
  const layout = buildSinrLiveCellLayout(profile, cellCount);
  const altitudeKm = 550;
  const satLatDeg = OBSERVER.latDeg;
  const satLonDeg = OBSERVER.lonDeg + SAT_LON_OFFSET_DEG;
  const realElevationDeg = (elevationAngleRad(
    satLatDeg,
    satLonDeg,
    altitudeKm,
    OBSERVER.latDeg,
    OBSERVER.lonDeg,
  ) * 180) / Math.PI;
  const sat: CellModelSat = {
    id: 'SAT-INTRA',
    shellId: 'shell-intra-test',
    altitudeKm,
    latDeg: satLatDeg,
    lonDeg: satLonDeg,
    topo: { azimuthDeg: 90, elevationDeg: realElevationDeg },
  };
  const variantCenter = resolveIntraCellBeamCenter(
    layout.centers[0]!,
    layout.cellRadiusKm,
    OBSERVER,
  );
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: layout,
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
    ...(cellCount === 7 ? SEVEN_CELL_STEERING_OVERRIDE : {}),
  });
  const ue = {
    id: `ue-${cellCount}`,
    eastKm: variantCenter.localXKm,
    northKm: variantCenter.localYKm,
  };
  const frameAtVariant = model.step({
    visibleSats: [sat],
    ues: [ue],
    simTimeSec: 0,
    dtSec: 0,
  });
  return {
    model,
    frameAtVariant,
    sat,
    ue,
    variantBeamId: intraCellLinkBudgetBeamId(0),
  };
}

function assertSameCellIntraCommit(cellCount: 1 | 7): void {
  const { model, frameAtVariant, sat, ue, variantBeamId } = makeModel(cellCount);
  const decisionAtStart = model.getHandoverDecisionFrame();
  assert.ok(decisionAtStart);

  const normalBeamId = cellLinkBudgetBeamId(0);
  const normalOpportunity = decisionAtStart.opportunities.find(item => item.key.beamId === normalBeamId);
  const variantOpportunity = decisionAtStart.opportunities.find(item => item.key.beamId === variantBeamId);
  assert.ok(normalOpportunity, `${cellCount}-cell layout keeps the normal serving opportunity`);
  assert.ok(variantOpportunity, `${cellCount}-cell layout measures a same-cell alternate opportunity`);
  assert.equal(normalOpportunity.key.satelliteId, sat.id);
  assert.equal(variantOpportunity.key.satelliteId, sat.id);
  assert.equal(cellIdFromLinkBudgetBeamId(variantOpportunity.key.beamId), 0);
  assert.notEqual(variantOpportunity.key.beamId, normalOpportunity.key.beamId);
  assert.equal(
    getBeamFrequencyIndex(variantOpportunity.key.beamId, 3),
    cellFrequencyIndex(0, 3),
    'the alternate beam stays in the geographic cell frequency group',
  );
  assert.ok(
    (variantOpportunity.instantaneousEe?.value ?? -Infinity)
      > (normalOpportunity.instantaneousEe?.value ?? Infinity),
    'the fixed alternate geometry wins the instantaneous EE policy at its boresight',
  );

  const normalProbe = frameAtVariant.primaryCandidateProbeEvidence?.find(
    item => item.key.beamId === normalBeamId,
  );
  const variantProbe = frameAtVariant.primaryCandidateProbeEvidence?.find(
    item => item.key.beamId === variantBeamId,
  );
  assert.ok(normalProbe?.sample?.angleAware);
  assert.ok(variantProbe?.sample?.angleAware);
  assert.notEqual(
    variantProbe.sample.angleAware.thetaRad,
    normalProbe.sample.angleAware.thetaRad,
    'the alternate opportunity is measured with a distinct boresight geometry',
  );

  let committedFrame: SinrLiveCellFrame | null = null;
  let committedDecision = null as ReturnType<SinrLiveCellModel['getHandoverDecisionFrame']>;
  for (let step = 1; step <= 20 && committedFrame === null; step += 1) {
    const simTimeSec = step * 0.25;
    const frame = model.step({
      visibleSats: [sat],
      ues: [ue],
      simTimeSec,
      dtSec: 0.25,
    });
    const decision = model.getHandoverDecisionFrame();
    if (decision?.recentCommit !== null && decision?.recentCommit !== undefined) {
      committedFrame = frame;
      committedDecision = decision;
    }
  }

  assert.ok(committedFrame, `${cellCount}-cell layout eventually commits the candidate`);
  assert.ok(committedDecision?.recentCommit);
  const commit = committedDecision.recentCommit;
  assert.ok(commit.from);
  assert.equal(commit.kind, 'intra-satellite');
  assert.equal(commit.from.satelliteId, sat.id);
  assert.equal(commit.to.satelliteId, sat.id);
  assert.equal(commit.from.beamId, normalBeamId);
  // The production candidate-opportunity measurement enumerates all
  // INTRA_CELL_BEAM_VARIANT_COUNT (6) synthetic same-cell beam variants per
  // geographic cell (sinrLiveCellModel.ts, the `for (variantIndex = 1..6)`
  // loops), not just the one variant this fixture's `resolveIntraCellBeamCenter`
  // call happens to compute for its own geometry assertions above. In the
  // 7-cell layout their real EE values sit within ~1% of each other, so which
  // specific variant wins the InstantaneousEePolicy race is not something this
  // test should pin down -- doing so was fragile (a fork discovered variant 2
  // legitimately outscoring variant 1 by ~0.3% once the steering gate was
  // widened enough to admit both). The acceptance criterion this test actually
  // encodes -- SDD §3 "seven-cell layout commits a same-satellite intra
  // handover without changing membership" -- only requires that the commit
  // stays on this satellite, in this geographic cell, and genuinely switches
  // beams; not which of the 6 mathematically-equivalent alternates wins.
  const committedBeamId = commit.to.beamId;
  assert.equal(
    cellIdFromLinkBudgetBeamId(committedBeamId),
    0,
    `${cellCount}-cell layout commits to a beam still inside geographic cell 0`,
  );
  assert.notEqual(
    committedBeamId,
    normalBeamId,
    'the commit actually switches to a different physical beam, not a no-op',
  );
  assert.equal(commit.sourceFrameId, committedFrame.sourceFrameId);

  const primary = committedFrame.ues[0]!;
  assert.equal(primary.cellId, 0, `${cellCount}-cell target remains geographic cell 0`);
  assert.equal(primary.servingSatId, sat.id);
  assert.equal(primary.servingBeamId, committedBeamId);
  assert.equal(primary.beamIdentity, cellBeamIdentityForLink(sat.id, committedBeamId));
  assert.equal(primary.handoverKind, 'intra');
  assert.equal(committedFrame.intraHandoverCount, 1);
  assert.equal(committedFrame.interHandoverCount, 0);
  assert.equal(primary.servingLinkSample?.beamId, committedBeamId);
  assert.equal(committedFrame.recentHandoverEvents.length, 1);
  assert.equal(committedFrame.recentHandoverEvents[0]!.fromCellId, 0);
  assert.equal(committedFrame.recentHandoverEvents[0]!.toCellId, 0);
  assert.equal(committedFrame.recentHandoverEvents[0]!.fromSatId, sat.id);
  assert.equal(committedFrame.recentHandoverEvents[0]!.toSatId, sat.id);

  const servingCell0Beams = committedFrame.illuminatedBeams.filter(
    item => item.cellId === 0 && item.serving,
  );
  assert.equal(servingCell0Beams.length, 1);
  assert.equal(servingCell0Beams[0]!.beamId, committedBeamId);

  const heldFrame = model.step({
    visibleSats: [sat],
    ues: [ue],
    simTimeSec: committedFrame.simTimeSec + 0.25,
    dtSec: 0.25,
  });
  const heldDecision = model.getHandoverDecisionFrame();
  assert.equal(heldFrame.ues[0]!.cellId, 0);
  assert.equal(heldFrame.ues[0]!.servingBeamId, committedBeamId);
  assert.equal(heldDecision?.serving?.beamId, committedBeamId);
  assert.equal(heldDecision?.recentCommit, null, 'the accepted beam remains stable without a second commit');
}

test('one-cell layout commits a real same-satellite same-cell intra handover', () => {
  assertSameCellIntraCommit(1);
});

test('seven-cell layout commits a same-satellite intra handover without changing membership', () => {
  assertSameCellIntraCommit(7);
});
