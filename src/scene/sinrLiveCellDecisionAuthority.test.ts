import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCellLayout } from '../engine/cells/cellLayout';
import { sameCandidateLinkKey } from '../engine/handover/candidateDecisionContract';
import { loadProfile } from '../profiles/index';
import {
  SinrLiveCellModel,
  cellLinkBudgetBeamId,
  type CellModelSat,
} from './sinrLiveCellModel';
import {
  attachSinrLiveCellFrame,
  createSinrLiveCellModel,
  type CellTruthFrame,
} from './sinrLiveCellRuntime';

const OBSERVER = { latDeg: 25.1519, lonDeg: 121.7811 };
const EPOCH_MS = Date.UTC(2026, 7, 27, 12, 0, 0);

function satellite(id: string, lonOffsetDeg: number): CellModelSat {
  return {
    id,
    shellId: 'walker-authority-test',
    altitudeKm: 550,
    latDeg: OBSERVER.latDeg,
    lonDeg: OBSERVER.lonDeg + lonOffsetDeg,
    topo: {
      azimuthDeg: lonOffsetDeg < 0 ? 270 : lonOffsetDeg > 0 ? 90 : 0,
      elevationDeg: 80,
    },
  };
}

test('primary multi-candidate authority commits one remeasured link without changing membership', () => {
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const profile = {
    ...baseProfile,
    handover: {
      ...baseProfile.handover,
      sinrThresholdDb: -100,
      offsetDb: 0.1,
      triggerTimeSec: 1,
      pingPongGuardSec: 1,
    },
  };
  const layout = buildCellLayout({
    centerLatDeg: OBSERVER.latDeg,
    centerLonDeg: OBSERVER.lonDeg,
    altitudeKm: 550,
    beamwidth3dBRad: profile.antenna.beamwidth3dBRad,
    cellCount: 7,
  });
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
  const ue = { id: 'ue-primary', eastKm: 8, northKm: 2 };
  const initial = model.step({
    visibleSats: [satellite('SAT-A', 0), satellite('SAT-B', 1.8), satellite('SAT-C', -1.5)],
    ues: [ue],
    simTimeSec: 0,
    dtSec: 0,
  });
  const initialPrimary = initial.ues[0]!;
  assert.equal(initialPrimary.servingSatId, 'SAT-A');
  assert.ok(initialPrimary.servingBeamId !== null);
  const membershipCellId = initialPrimary.cellId;
  const initialDecision = model.getHandoverDecisionFrame();
  assert.ok(initialDecision);
  assert.equal(initialDecision.mode, 'sinr-offset');
  assert.ok(new Set(initialDecision.opportunities.map(item => item.key.satelliteId)).size >= 3);
  assert.equal(initialDecision.opportunities.some(item => item.forecastEe !== null), false);

  model.step({
    visibleSats: [satellite('SAT-A', 1.8), satellite('SAT-B', 0), satellite('SAT-C', -1.5)],
    ues: [ue],
    simTimeSec: 1,
    dtSec: 1,
  });
  const committedFrame = model.step({
    visibleSats: [satellite('SAT-A', 1.8), satellite('SAT-B', 0), satellite('SAT-C', -1.5)],
    ues: [ue],
    simTimeSec: 2,
    dtSec: 1,
  });
  const decision = model.getHandoverDecisionFrame();
  assert.ok(decision?.recentCommit, 'TTT + selection hold must produce one accepted commit receipt');
  assert.equal(decision.recentCommit.to.satelliteId, 'SAT-B');
  assert.equal(decision.recentCommit.newLinkStarted, true);
  assert.equal(decision.recentCommit.oldLinkEnded, true);
  assert.ok(decision.serving && sameCandidateLinkKey(decision.serving, decision.recentCommit.to));

  const committedPrimary = committedFrame.ues[0]!;
  assert.equal(committedPrimary.cellId, membershipCellId, 'geographic membership must not become a beam id');
  assert.equal(committedPrimary.servingSatId, decision.recentCommit.to.satelliteId);
  assert.equal(committedPrimary.servingBeamId, decision.recentCommit.to.beamId);
  assert.equal(committedPrimary.servingLinkSample?.satId, decision.recentCommit.to.satelliteId);
  assert.equal(committedPrimary.servingLinkSample?.beamId, decision.recentCommit.to.beamId);
  assert.ok(Number.isFinite(committedPrimary.servingLinkSample?.sinrDb));
  const committedOpportunity = decision.opportunities.find(opportunity => (
    decision.serving !== null && sameCandidateLinkKey(opportunity.key, decision.serving)
  ));
  assert.equal(committedOpportunity?.sinr.status, 'available');
  assert.deepEqual(committedOpportunity?.sinrMeasurementContext, {
    purpose: 'sinr-offset-admission',
    powerModel: 'profile-rated-rf',
    profileId: profile.id,
    epochToken: `walker:${EPOCH_MS}`,
    ratedTransmitPowerDbm: profile.channel.maxTxPowerDbm ?? null,
    activeInterferenceKeys: committedOpportunity?.sinrMeasurementContext?.activeInterferenceKeys,
  });
  assert.equal(committedPrimary.servingLinkSample?.angleAware?.powerW, 2);
  assert.notEqual(
    committedOpportunity!.sinr.value,
    committedPrimary.servingLinkSample!.sinrDb,
    'rated RF admission must remain distinct from the committed 2 W active-link sample',
  );
  assert.equal(
    committedFrame.ues.filter(item => item.ueId === ue.id && item.servingLinkSample !== null).length,
    1,
    'the primary UE must expose exactly one active data-link sample',
  );
  const servingBeams = committedFrame.illuminatedBeams.filter(item => item.serving);
  assert.equal(
    servingBeams.length,
    1,
    'an unshared old manager beam must not remain marked as a second serving path',
  );
  assert.equal(servingBeams[0]?.satId, decision.recentCommit.to.satelliteId);
  assert.equal(cellLinkBudgetBeamId(servingBeams[0]!.cellId), decision.recentCommit.to.beamId);
});

test('runtime attach publishes the model decision only when the explicit homepage gate is enabled', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const legacyModel = createSinrLiveCellModel(profile, true, EPOCH_MS);
  const homepageModel = createSinrLiveCellModel(
    profile,
    true,
    EPOCH_MS,
    {},
    undefined,
    undefined,
    false,
    'earth-fixed-cell',
    true,
  );
  assert.ok(legacyModel);
  assert.ok(homepageModel);
  const makeFrame = (): CellTruthFrame => ({
    satellites: [satellite('SAT-A', 0), satellite('SAT-B', 1)],
    perUePositions: [{ id: 'ue-primary', eastKm: 8, northKm: 2 }],
    simTimeSec: 0,
  });
  const legacyFrame = makeFrame();
  attachSinrLiveCellFrame(legacyFrame, legacyModel, 0);
  assert.equal(legacyFrame.handoverDecisionFrame, null);

  const homepageFrame = makeFrame();
  attachSinrLiveCellFrame(homepageFrame, homepageModel, 0);
  assert.ok(homepageFrame.handoverDecisionFrame);
  assert.equal(homepageFrame.handoverDecisionFrame, homepageModel.getHandoverDecisionFrame());
  assert.equal(homepageFrame.handoverDecisionFrame.mode, 'sinr-offset');
});

test('a vanished serving pair uses an explicit measured service-continuity transaction', () => {
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const profile = {
    ...baseProfile,
    handover: {
      ...baseProfile.handover,
      sinrThresholdDb: -100,
      offsetDb: 0.1,
      triggerTimeSec: 5,
      pingPongGuardSec: 1,
    },
  };
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: buildCellLayout({
      centerLatDeg: OBSERVER.latDeg,
      centerLonDeg: OBSERVER.lonDeg,
      altitudeKm: 550,
      beamwidth3dBRad: profile.antenna.beamwidth3dBRad,
      cellCount: 7,
    }),
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
  });
  const ue = { id: 'ue-primary', eastKm: 4, northKm: 1 };
  const attached = model.step({
    visibleSats: [satellite('SAT-A', 0), satellite('SAT-B', 1.5)],
    ues: [ue],
    simTimeSec: 0,
    dtSec: 0,
  });
  assert.equal(attached.ues[0]?.servingSatId, 'SAT-A');

  const protectedFrame = model.step({
    visibleSats: [satellite('SAT-B', 0)],
    ues: [ue],
    simTimeSec: 1,
    dtSec: 1,
  });
  const decision = model.getHandoverDecisionFrame();
  assert.equal(decision?.mode, 'service-continuity-protection');
  assert.equal(decision?.recentCommit?.mode, 'service-continuity-protection');
  assert.equal(decision?.recentCommit?.from?.satelliteId, 'SAT-A');
  assert.equal(decision?.recentCommit?.to.satelliteId, 'SAT-B');
  assert.equal(protectedFrame.ues[0]?.servingSatId, 'SAT-B');
  assert.equal(protectedFrame.ues[0]?.servingBeamId, decision?.recentCommit?.to.beamId);
  assert.equal(protectedFrame.ues[0]?.servingLinkSample?.satId, 'SAT-B');
  assert.equal(protectedFrame.illuminatedBeams.filter(item => item.serving).length, 1);
});

test('a vanished serving pair with no safe replacement publishes an explicit detach', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: buildCellLayout({
      centerLatDeg: OBSERVER.latDeg,
      centerLonDeg: OBSERVER.lonDeg,
      altitudeKm: 550,
      beamwidth3dBRad: profile.antenna.beamwidth3dBRad,
      cellCount: 7,
    }),
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
  });
  const ue = { id: 'ue-primary', eastKm: 0, northKm: 0 };
  const attached = model.step({
    visibleSats: [satellite('SAT-A', 0)],
    ues: [ue],
    simTimeSec: 0,
    dtSec: 0,
  });
  assert.equal(attached.ues[0]?.servingSatId, 'SAT-A');

  const detached = model.step({
    visibleSats: [],
    ues: [ue],
    simTimeSec: 1,
    dtSec: 1,
  });
  const decision = model.getHandoverDecisionFrame();
  assert.equal(decision?.mode, 'service-continuity-protection');
  assert.equal(decision?.phase, 'initial-attach');
  assert.equal(decision?.serving, null);
  assert.equal(decision?.recentCommit, null);
  assert.equal(detached.ues[0]?.servingSatId, null);
  assert.equal(detached.ues[0]?.servingBeamId, null);
  assert.equal(detached.ues[0]?.servingLinkSample, null);
  assert.equal(detached.illuminatedBeams.some(item => item.serving), false);
});
