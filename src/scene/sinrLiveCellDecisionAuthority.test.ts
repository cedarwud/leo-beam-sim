import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCellLayout } from '../engine/cells/cellLayout';
import {
  candidateLinkKeyString,
  sameCandidateLinkKey,
} from '../engine/handover/candidateDecisionContract';
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
import { ANGLE_AWARE_SEGMENT_START_POWER_W } from '../engine/signal/angle-aware-ee';

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
  // Real (not display) EE is what the decision authority reads (SDD F3 fix).
  // Initial attach requires the winning candidate's EE to already be >= the
  // 135 Kbit/J floor (there is no "current serving" to compare against yet),
  // so SAT-A starts at lonOffset=0deg (zenith, ~557-637 Kbit/J) exactly as
  // before -- it is still the strongest of the three and wins initial attach
  // legitimately. SAT-A then repositions to lonOffset=5.5deg (real elevation
  // ~41deg, ~122-125 Kbit/J), genuinely below the floor with ~8-10% margin,
  // not a boundary value. SAT-B repositions to zenith (0deg, ~557-637 Kbit/J)
  // -- unambiguously higher than SAT-A's degraded reading and higher than
  // SAT-C's unchanged ~459 Kbit/J, so SAT-B and not SAT-C wins the handover.
  // Values probed empirically via a throwaway script driving the real
  // SinrLiveCellModel, not assumed from elevation alone -- topo.elevationDeg
  // is display/gate only and does not affect the physics (see decisionEe.ts).
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
  assert.equal(initialDecision.mode, 'ee-optimization');
  assert.ok(new Set(initialDecision.opportunities.map(item => item.key.satelliteId)).size >= 3);
  assert.equal(initialDecision.opportunities.some(item => item.forecastEe !== null), false);

  model.step({
    visibleSats: [satellite('SAT-A', 5.5), satellite('SAT-B', 0), satellite('SAT-C', -1.5)],
    ues: [ue],
    simTimeSec: 1,
    dtSec: 1,
  });
  const committedFrame = model.step({
    visibleSats: [satellite('SAT-A', 5.5), satellite('SAT-B', 0), satellite('SAT-C', -1.5)],
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
  assert.equal(committedPrimary.servingLinkSample?.angleAware?.powerW, ANGLE_AWARE_SEGMENT_START_POWER_W);
  assert.notEqual(
    committedOpportunity!.sinr.value,
    committedPrimary.servingLinkSample!.sinrDb,
    'rated RF admission must remain distinct from the committed angle-aware active-link sample',
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
  assert.equal(homepageFrame.handoverDecisionFrame.mode, 'ee-optimization');
});

test('candidate display probes stay frozen and outside the primary decision/serving set', () => {
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const profile = {
    ...baseProfile,
    handover: {
      ...baseProfile.handover,
      sinrThresholdDb: -100,
    },
  };
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: buildCellLayout({
      centerLatDeg: OBSERVER.latDeg,
      centerLonDeg: OBSERVER.lonDeg,
      altitudeKm: 550,
      beamwidth3dBRad: profile.antenna.beamwidth3dBRad,
      cellCount: 1,
    }),
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
  });
  const frame = model.step({
    visibleSats: [satellite('SAT-A', 0), satellite('SAT-B', 1.8), satellite('SAT-C', -1.5)],
    ues: [{ id: 'ue-primary', eastKm: 8, northKm: 2 }],
    simTimeSec: 0,
    dtSec: 0,
  });
  const decision = model.getHandoverDecisionFrame();
  const probes = frame.primaryCandidateProbeEvidence;
  assert.ok(decision);
  assert.ok(probes);
  assert.equal(decision.recentCommit, null);
  assert.deepEqual(
    new Set(probes.map(probe => candidateLinkKeyString(probe.key))),
    new Set(decision.opportunities.map(opportunity => candidateLinkKeyString(opportunity.key))),
  );

  const primaryServing = frame.ues.find(ue => ue.ueId === 'ue-primary');
  assert.ok(primaryServing?.servingSatId);
  assert.ok(primaryServing?.servingBeamId !== null && primaryServing?.servingBeamId !== undefined);
  const servingKey = `${primaryServing.servingSatId}:${primaryServing.servingBeamId}`;
  const servingBeamKeys = new Set(
    frame.illuminatedBeams
      .filter(beam => beam.serving)
      .map(beam => `${beam.satId}:${cellLinkBudgetBeamId(beam.cellId)}`),
  );
  for (const probe of probes) {
    const key = `${probe.key.satelliteId}:${probe.key.beamId}`;
    if (key !== servingKey) assert.equal(servingBeamKeys.has(key), false);
    assert.ok(Object.isFrozen(probe));
    assert.ok(Object.isFrozen(probe.key));
    assert.ok(Object.isFrozen(probe.sample));
  }
  assert.equal(
    frame.ues.filter(ue => ue.ueId === 'ue-primary' && ue.servingLinkSample !== null).length,
    1,
  );
  const decisionJson = JSON.stringify(decision);
  assert.equal(model.getHandoverDecisionFrame(), decision);
  assert.equal(JSON.stringify(model.getHandoverDecisionFrame()), decisionJson);
  const firstProbe = probes[0]!;
  assert.throws(
    () => ((firstProbe.sample as unknown as { sinrDb: number }).sinrDb = -999),
    TypeError,
  );
});

test('multi-candidate beam hopping keeps the primary cell lit for every reachable alternative', () => {
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
    beamHoppingEnabled: true,
    beamsPerSat: 1,
    candidateBeamsPerSat: 1,
    coverageSteeringAngleDeg: 50,
  });
  const frame = model.step({
    visibleSats: [satellite('SAT-A', 0), satellite('SAT-B', 1.8), satellite('SAT-C', -1.5)],
    ues: [{ id: 'ue-primary', eastKm: 8, northKm: 2 }],
    simTimeSec: 0,
    dtSec: 0,
  });
  const decision = model.getHandoverDecisionFrame();
  assert.ok(decision);
  const primaryCellId = frame.ues[0]?.cellId;
  assert.notEqual(primaryCellId, null);
  const primaryBeamId = cellLinkBudgetBeamId(primaryCellId!);
  const primaryCellCandidates = decision.opportunities.filter(item => item.key.beamId === primaryBeamId);
  assert.equal(
    new Set(primaryCellCandidates.map(item => item.key.satelliteId)).size,
    3,
    'all three reachable satellites remain measurable on the primary cell despite one-beam hopping',
  );
  assert(primaryCellCandidates.every(item => (
    item.gates.find(gate => gate.code === 'scheduled-illumination')?.result === 'pass'
  )));
});

test('candidate measurement does not evict an already-serving one-beam satellite', () => {
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
    beamHoppingEnabled: true,
    beamsPerSat: 1,
    candidateBeamsPerSat: 1,
    coverageSteeringAngleDeg: 50,
  });
  const ue = { id: 'ue-primary', eastKm: 8, northKm: 2 };
  const initial = model.step({
    visibleSats: [satellite('SAT-A', 0)],
    ues: [ue],
    simTimeSec: 0,
    dtSec: 0,
  });
  assert.equal(initial.ues[0]?.servingSatId, 'SAT-A');

  const comparison = model.step({
    visibleSats: [satellite('SAT-A', 0), satellite('SAT-B', 1.8), satellite('SAT-C', -1.5)],
    ues: [ue],
    simTimeSec: 1,
    dtSec: 1,
  });
  const decision = model.getHandoverDecisionFrame();
  assert.equal(
    comparison.ues[0]?.servingSatId,
    'SAT-A',
    'adding candidate measurements must preserve the established serving satellite',
  );
  assert.equal(comparison.ues[0]?.servingBeamId, cellLinkBudgetBeamId(comparison.ues[0]?.cellId ?? 0));
  const primaryBeamId = cellLinkBudgetBeamId(comparison.ues[0]?.cellId ?? 0);
  const primaryCellCandidates = decision?.opportunities.filter(item => item.key.beamId === primaryBeamId) ?? [];
  assert.equal(
    new Set(primaryCellCandidates.map(item => item.key.satelliteId)).size,
    3,
    'candidate satellites remain measured on the same primary cell while the serving link stays lit',
  );
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
  // SAT-A starts at zenith (lonOffset=0) so it legitimately wins initial
  // attach (real EE >= the 135 Kbit/J floor, ~637 Kbit/J at this UE's
  // position -- initial attach has no "current serving" to compare against,
  // so the target itself must already clear the floor). SAT-A then degrades
  // to lonOffset=5.5deg (~125 Kbit/J, genuinely below the floor) while still
  // visible, so its real measured EE is what the engine reads for this frame
  // before it vanishes on the next step. SAT-B at 1.5deg reads ~520 Kbit/J,
  // well above SAT-A's degraded reading. See the sibling test above for how
  // these were measured.
  const ue = { id: 'ue-primary', eastKm: 4, northKm: 1 };
  const attached = model.step({
    visibleSats: [satellite('SAT-A', 0), satellite('SAT-B', 1.5)],
    ues: [ue],
    simTimeSec: 0,
    dtSec: 0,
  });
  assert.equal(attached.ues[0]?.servingSatId, 'SAT-A');

  model.step({
    visibleSats: [satellite('SAT-A', 5.5), satellite('SAT-B', 1.5)],
    ues: [ue],
    simTimeSec: 1,
    dtSec: 1,
  });

  const protectedFrame = model.step({
    visibleSats: [satellite('SAT-B', 0)],
    ues: [ue],
    simTimeSec: 2,
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
  // The published frame must not say "detached" and "this cell is served by
  // SAT-A" at the same time. `cells` is assembled before the detach decision,
  // so the detach has to clear the focused row in the same frame; without that
  // patch decision.serving and ues[0].servingSatId read null here while
  // cells[0].servingSatId still read 'SAT-A'.
  assert.equal(detached.cells.some(cell => cell.servingSatId !== null), false);
  assert.equal(detached.cells.some(cell => cell.beamIdentity !== null), false);
  assert.equal(detached.servedCellCount, 0);
});

test('a re-attach after a genuine detach gets a fresh episode ID, never a reused one', () => {
  // Regression for a cross-family review finding: the explicit detach path
  // (git show 072bb9c) calls `primaryDecisionEngine.reset(null)`, which bumps
  // that engine INSTANCE's own generation counter. But the very next step()
  // sees `primaryServingAssignment === null` (cleared by the detach) and
  // unconditionally treats that as "the primary UE identity changed",
  // discarding the just-reset engine instance and constructing a brand new
  // one. A freshly constructed engine starts its own generation counter over
  // at 0, so its starting episode ID collided with whatever the very first
  // engine ever published -- silently reusing a historical episode identity
  // for what is, service-wise, a brand new attach. Consumers that use
  // episode equality as a continuity boundary (e.g.
  // acceptedHandoverPresentationSnapshot.ts:525, the visual-identity
  // allocator's priorAssignmentsFor in handoverVisualIdentity.ts:595, and
  // MainScene.tsx's authorityTransitionRef) can then misattribute state from
  // the vanished episode to the new one.
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

  model.step({ visibleSats: [satellite('SAT-A', 0)], ues: [ue], simTimeSec: 0, dtSec: 0 });
  const episodeA = model.getHandoverDecisionFrame()?.episodeId;
  assert.ok(typeof episodeA === 'string' && episodeA.length > 0);

  model.step({ visibleSats: [], ues: [ue], simTimeSec: 1, dtSec: 1 });
  const episodeDetach1 = model.getHandoverDecisionFrame()?.episodeId;
  assert.notEqual(episodeDetach1, episodeA, 'the detach must not keep A\'s episode identity');

  model.step({ visibleSats: [satellite('SAT-B', 0)], ues: [ue], simTimeSec: 2, dtSec: 1 });
  const reattachDecision = model.getHandoverDecisionFrame();
  assert.equal(reattachDecision?.serving?.satelliteId, 'SAT-B');
  // The actual defect: without the fix, this re-attach's episode ID is
  // byte-identical to episodeA, even though A's service ended for good and
  // this is a materially different service episode (a different satellite,
  // with no commit receipt linking the two).
  assert.notEqual(
    reattachDecision?.episodeId,
    episodeA,
    'a re-attach must not silently reuse a historical episode ID',
  );

  // A second detach/re-attach round trip must not collide with any prior
  // episode ID either -- the defect made every detach collide with every
  // other detach, and every re-attach collide with every other re-attach.
  model.step({ visibleSats: [], ues: [ue], simTimeSec: 3, dtSec: 1 });
  const episodeDetach2 = model.getHandoverDecisionFrame()?.episodeId;
  assert.notEqual(episodeDetach2, episodeDetach1, 'the second detach must not reuse the first detach\'s episode ID');
  assert.notEqual(episodeDetach2, reattachDecision?.episodeId);

  model.step({ visibleSats: [satellite('SAT-B', 0)], ues: [ue], simTimeSec: 4, dtSec: 1 });
  const episodeReattach2 = model.getHandoverDecisionFrame()?.episodeId;
  const seenEpisodeIds = [episodeA, episodeDetach1, reattachDecision?.episodeId, episodeDetach2, episodeReattach2];
  assert.equal(
    new Set(seenEpisodeIds).size,
    seenEpisodeIds.length,
    `every attach/detach cycle must produce a distinct episode ID, got: ${JSON.stringify(seenEpisodeIds)}`,
  );
});

test('a replacement that is visible but outside the steering cone still detaches', () => {
  // The detach guard used to ask `linkSats.length > 0`, i.e. "is any satellite
  // above the minimum elevation". But a satellite becomes a candidate for a
  // cell only if it ALSO falls inside the steering limit, so a satellite at 80
  // degrees elevation and 25 degrees of longitude offset counts in linkSats
  // while being unusable for this cell. The model then held a service identity
  // pointing at the vanished SAT-A indefinitely -- exactly what the explicit
  // detach exists to prevent. The guard now asks whether any satellite can
  // actually reach the cell.
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

  // SAT-B is well above the elevation floor, so it is in `linkSats`, but its
  // cell scan angle exceeds the 50 degree steering limit, so it is not a
  // candidate for this cell.
  const detached = model.step({
    visibleSats: [satellite('SAT-B', 25)],
    ues: [ue],
    simTimeSec: 1,
    dtSec: 1,
  });
  const decision = model.getHandoverDecisionFrame();
  assert.equal(decision?.phase, 'initial-attach');
  assert.equal(decision?.serving, null);
  assert.equal(detached.ues[0]?.servingSatId, null);
  assert.equal(detached.cells.some(cell => cell.servingSatId !== null), false);
});
