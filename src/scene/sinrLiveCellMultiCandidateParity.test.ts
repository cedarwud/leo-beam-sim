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

/**
 * Fixed S1 compatibility fixture.  One geographic cell is intentional: it
 * makes the old cell-manager target and the new candidate pair refer to the
 * same cell/beam identity, so this test isolates the inter-satellite decision
 * seam rather than testing multi-cell beam ranking.
 */
const OBSERVER = { latDeg: 25.1519, lonDeg: 121.7811 };
const EPOCH_MS = Date.UTC(2026, 7, 27, 12, 0, 0);
const PRIMARY_UE = { id: 'ue-parity', eastKm: 0, northKm: 0 };

function satellite(id: string, lonOffsetDeg: number): CellModelSat {
  return {
    id,
    shellId: 'walker-fixed-parity-fixture',
    altitudeKm: 550,
    latDeg: OBSERVER.latDeg,
    lonDeg: OBSERVER.lonDeg + lonOffsetDeg,
    topo: {
      azimuthDeg: lonOffsetDeg < 0 ? 270 : lonOffsetDeg > 0 ? 90 : 0,
      elevationDeg: 80,
    },
  };
}

function createProfile() {
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  return {
    ...baseProfile,
    // This fixture isolates the legacy/new authority seam. Keep its narrow
    // antenna envelope and the historical single-target admission rule so a
    // production candidate-rich steering/readability setting cannot change
    // the expected handover timing of this fixed synthetic geometry.
    antenna: {
      ...baseProfile.antenna,
      maxSteeringAngleDeg: 12,
    },
    handover: {
      ...baseProfile.handover,
      // Keep the fixture focused on the target/clock seam, not the profile's
      // production admission threshold or its long presentation guard.
      sinrThresholdDb: -100,
      offsetDb: 0.1,
      triggerTimeSec: 1,
      pendingTargetHoldSec: 0,
      pingPongGuardSec: 1,
      minimumDistinctCandidateSatellites: 0,
    },
  };
}

function createModelPair() {
  const profile = createProfile();
  const cellLayout = buildCellLayout({
    centerLatDeg: OBSERVER.latDeg,
    centerLonDeg: OBSERVER.lonDeg,
    altitudeKm: 550,
    beamwidth3dBRad: profile.antenna.beamwidth3dBRad,
    cellCount: 1,
  });
  const shared = {
    profile,
    cellLayout,
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
  } as const;

  return {
    profile,
    cellLayout,
    legacy: new SinrLiveCellModel({
      ...shared,
      candidateOpportunityMeasurementEnabled: false,
      multiCandidateDecisionEnabled: false,
    }),
    multiCandidate: new SinrLiveCellModel({
      ...shared,
      candidateOpportunityMeasurementEnabled: true,
      multiCandidateDecisionEnabled: true,
    }),
  };
}

function satellitesAt(simTimeSec: number): readonly CellModelSat[] {
  // The first six seconds preserve the initial A serving state.  At t=7 B is
  // overhead and remains the best candidate through the common t=8 commit.
  return [
    satellite('SAT-A', simTimeSec === 0 ? 0 : 1.8),
    satellite('SAT-B', simTimeSec < 7 ? 1.8 : 0),
    satellite('SAT-C', -1.5),
  ];
}

test('fixed-frame S1 compatibility keeps legacy and multi-candidate inter-HO parity', () => {
  const { profile, cellLayout, legacy, multiCandidate } = createModelPair();
  const timeline = Array.from({ length: 9 }, (_, simTimeSec) => ({
    simTimeSec,
    dtSec: simTimeSec === 0 ? 0 : 1,
    visibleSats: satellitesAt(simTimeSec),
  }));

  let legacyEvent: ReturnType<typeof legacy.step>['recentHandoverEvents'][number] | undefined;
  let selectedBeforeCommit: { satelliteId: string; beamId: number } | null = null;
  let newCommit: NonNullable<ReturnType<SinrLiveCellModel['getHandoverDecisionFrame']>>['recentCommit'] = null;
  let legacyCommitFrame: ReturnType<typeof legacy.step> | null = null;

  for (const frameInput of timeline) {
    const legacyFrame = legacy.step({
      visibleSats: frameInput.visibleSats,
      ues: [PRIMARY_UE],
      simTimeSec: frameInput.simTimeSec,
      dtSec: frameInput.dtSec,
    });
    const multiFrame = multiCandidate.step({
      visibleSats: frameInput.visibleSats,
      ues: [PRIMARY_UE],
      simTimeSec: frameInput.simTimeSec,
      dtSec: frameInput.dtSec,
    });
    const decision = multiCandidate.getHandoverDecisionFrame();

    const interEvent = legacyFrame.recentHandoverEvents.find(event => (
      event.ueId === PRIMARY_UE.id && event.kind === 'inter'
    ));
    if (interEvent !== undefined) {
      legacyEvent ??= interEvent;
      legacyCommitFrame ??= legacyFrame;
    }
    if (decision?.selectedTarget !== null && decision?.selectedTarget !== undefined) {
      selectedBeforeCommit ??= decision.selectedTarget;
    }
    if (decision?.recentCommit !== null && decision?.recentCommit !== undefined) {
      newCommit ??= decision.recentCommit;
    }

    // Keep both runtimes in a served state throughout the fixture; this also
    // proves that the new transaction did not merely detach/re-attach.
    assert.equal(multiFrame.ues[0]?.servingSatId !== null, true);
  }

  assert.ok(legacyEvent, 'legacy manager must emit one inter handover event');
  assert.ok(legacyCommitFrame, 'legacy runtime must publish the inter-HO frame');
  assert.ok(selectedBeforeCommit, 'new runtime must expose a selected target before commit');
  assert.ok(newCommit, 'new runtime must publish a commit receipt');

  const expectedLegacyTarget = {
    satelliteId: legacyEvent.toSatId,
    beamId: cellLinkBudgetBeamId(legacyEvent.toCellId),
  };
  assert.equal(legacyEvent.fromSatId, 'SAT-A');
  assert.equal(legacyEvent.toSatId, 'SAT-B');
  assert.equal(legacyEvent.fromCellId, 0);
  assert.equal(legacyEvent.toCellId, 0);
  assert.deepEqual(selectedBeforeCommit, expectedLegacyTarget);
  assert.ok(newCommit.from, 'new commit must carry the old serving pair');
  assert.ok(sameCandidateLinkKey(newCommit.from, {
    satelliteId: legacyEvent.fromSatId!,
    beamId: cellLinkBudgetBeamId(legacyEvent.fromCellId!),
  }));
  assert.ok(sameCandidateLinkKey(newCommit.to, expectedLegacyTarget));

  // The two public surfaces use different vocabulary, but must classify the
  // same physical transition as inter-satellite and fire on the same frame.
  assert.equal(legacyEvent.kind, 'inter');
  assert.equal(newCommit.kind, 'inter-satellite');
  assert.equal(legacyEvent.sourceTimeSec, 8);
  assert.equal(newCommit.simTimeMs, EPOCH_MS + legacyEvent.sourceTimeSec * 1000);
  assert.equal(legacyCommitFrame.simTimeSec, legacyEvent.sourceTimeSec);
  assert.equal(legacyCommitFrame.ues[0]?.handoverKind, 'inter');
  assert.equal(legacyCommitFrame.ues[0]?.servingSatId, newCommit.to.satelliteId);
  assert.equal(legacyCommitFrame.ues[0]?.servingBeamId, newCommit.to.beamId);
  assert.equal(newCommit.oldLinkEnded, true);
  assert.equal(newCommit.newLinkStarted, true);
  // The fixed fixture still uses the historical profile admission values above,
  // but the homepage multi-candidate lane now has one explicit decision
  // authority: same-frame instantaneous EE. Keep this assertion aligned with
  // that authority rather than treating the profile's legacy policy label as a
  // second runtime decision source.
  assert.equal(newCommit.mode, 'ee-optimization');
  assert.equal(profile.handover.policy, 'sinr-offset');
  assert.equal(cellLayout.centers.length, 1);
});
