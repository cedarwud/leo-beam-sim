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

const OBSERVER = { latDeg: 40, lonDeg: 116 };
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

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
  const sat: CellModelSat = {
    id: 'SAT-INTRA',
    shellId: 'shell-intra-test',
    altitudeKm: 550,
    latDeg: OBSERVER.latDeg,
    lonDeg: OBSERVER.lonDeg,
    topo: { azimuthDeg: 0, elevationDeg: 90 },
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
  assert.equal(commit.to.beamId, variantBeamId);
  assert.equal(commit.sourceFrameId, committedFrame.sourceFrameId);

  const primary = committedFrame.ues[0]!;
  assert.equal(primary.cellId, 0, `${cellCount}-cell target remains geographic cell 0`);
  assert.equal(primary.servingSatId, sat.id);
  assert.equal(primary.servingBeamId, variantBeamId);
  assert.equal(primary.beamIdentity, cellBeamIdentityForLink(sat.id, variantBeamId));
  assert.equal(primary.handoverKind, 'intra');
  assert.equal(committedFrame.intraHandoverCount, 1);
  assert.equal(committedFrame.interHandoverCount, 0);
  assert.equal(primary.servingLinkSample?.beamId, variantBeamId);
  assert.equal(committedFrame.recentHandoverEvents.length, 1);
  assert.equal(committedFrame.recentHandoverEvents[0]!.fromCellId, 0);
  assert.equal(committedFrame.recentHandoverEvents[0]!.toCellId, 0);
  assert.equal(committedFrame.recentHandoverEvents[0]!.fromSatId, sat.id);
  assert.equal(committedFrame.recentHandoverEvents[0]!.toSatId, sat.id);

  const servingCell0Beams = committedFrame.illuminatedBeams.filter(
    item => item.cellId === 0 && item.serving,
  );
  assert.equal(servingCell0Beams.length, 1);
  assert.equal(servingCell0Beams[0]!.beamId, variantBeamId);

  const heldFrame = model.step({
    visibleSats: [sat],
    ues: [ue],
    simTimeSec: committedFrame.simTimeSec + 0.25,
    dtSec: 0.25,
  });
  const heldDecision = model.getHandoverDecisionFrame();
  assert.equal(heldFrame.ues[0]!.cellId, 0);
  assert.equal(heldFrame.ues[0]!.servingBeamId, variantBeamId);
  assert.equal(heldDecision?.serving?.beamId, variantBeamId);
  assert.equal(heldDecision?.recentCommit, null, 'the accepted beam remains stable without a second commit');
}

test('one-cell layout commits a real same-satellite same-cell intra handover', () => {
  assertSameCellIntraCommit(1);
});

test('seven-cell layout commits a same-satellite intra handover without changing membership', () => {
  assertSameCellIntraCommit(7);
});
