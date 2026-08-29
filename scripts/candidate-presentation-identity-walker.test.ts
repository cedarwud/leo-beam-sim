import assert from 'node:assert/strict';
import test from 'node:test';

import { runMultiCandidateWindow } from './diagnose-multi-candidate-window';
import type { CandidatePresentationPlan } from '../src/engine/handover/candidatePresentationPlan';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
  type AcceptedHandoverPresentationSnapshot,
} from '../src/scene/acceptedHandoverPresentationSnapshot';

function assertCollisionFree(plan: CandidatePresentationPlan): void {
  const identities = plan.groups.map(group => group.satelliteIdentity);
  assert.equal(new Set(identities.map(identity => identity.cssColor)).size, identities.length);
  assert.ok(identities.every(identity => !identity.isOverflow));
}

function assertStableEpisodeSatelliteTokens(
  current: CandidatePresentationPlan,
  previous: CandidatePresentationPlan,
): number {
  let overlap = 0;
  for (const group of current.groups) {
    const prior = previous.groups.find(candidate => candidate.satelliteId === group.satelliteId);
    if (prior === undefined) continue;
    overlap += 1;
    assert.equal(group.satelliteIdentity.cssColor, prior.satelliteIdentity.cssColor);
    assert.equal(group.satelliteIdentity.threeColor, prior.satelliteIdentity.threeColor);
    assert.equal(group.satelliteIdentity.paletteSlot, prior.satelliteIdentity.paletteSlot);
  }
  return overlap;
}

test('real Walker sequence publishes one atomic scene/rail snapshot with stable episode identities', () => {
  const policyConfigHash = createHandoverPresentationPolicyConfigHash(
    'walker-multi-candidate-compatibility-fixture',
  );
  let frameIndex = 0;
  let sameEpisodeIdentityOverlaps = 0;
  let exactSharedPlanFrames = 0;
  let pinRepublicationChecks = 0;
  let previousSnapshot: AcceptedHandoverPresentationSnapshot | null = null;

  runMultiCandidateWindow({
    durationSec: 300,
    stepSec: 1,
    ueCount: 30,
    onDecisionFrame: ({ decision }) => {
      const session = buildAcceptedHandoverPresentationSession({
        decision,
        policyConfigHash,
        pinnedKey: null,
        previousSnapshot,
      });
      const sceneSnapshot = session.snapshot;
      const railSnapshot = session.snapshot;

      assert.equal(sceneSnapshot, railSnapshot);
      assert.equal(sceneSnapshot.plan, railSnapshot.plan);
      assert.equal(sceneSnapshot.sourceFrameId, railSnapshot.sourceFrameId);
      assert.equal(sceneSnapshot.snapshotId, railSnapshot.snapshotId);
      assertCollisionFree(sceneSnapshot.plan);
      exactSharedPlanFrames += 1;

      if (previousSnapshot?.episodeId === sceneSnapshot.episodeId) {
        sameEpisodeIdentityOverlaps += assertStableEpisodeSatelliteTokens(
          sceneSnapshot.plan,
          previousSnapshot.plan,
        );
      }

      if (frameIndex > 0 && frameIndex % 97 === 0) {
        const keyToPin = sceneSnapshot.candidates.at(-1)?.key ?? null;
        if (keyToPin !== null) {
          const pinned = buildAcceptedHandoverPresentationSession({
            decision,
            policyConfigHash,
            pinnedKey: keyToPin,
            previousSnapshot: sceneSnapshot,
          });
          assert.notEqual(pinned.snapshot.snapshotId, sceneSnapshot.snapshotId);
          assert.equal(pinned.snapshot.decision, sceneSnapshot.decision);
          assert.deepEqual(pinned.interaction.pinnedKey, keyToPin);
          assertCollisionFree(pinned.snapshot.plan);
          previousSnapshot = pinned.snapshot;
          pinRepublicationChecks += 1;
        } else {
          previousSnapshot = sceneSnapshot;
        }
      } else {
        previousSnapshot = sceneSnapshot;
      }
      frameIndex += 1;
    },
  });

  assert.equal(frameIndex, 301);
  assert.equal(exactSharedPlanFrames, frameIndex);
  assert.ok(
    sameEpisodeIdentityOverlaps > 100,
    `expected substantial same-episode identity overlap, got ${sameEpisodeIdentityOverlaps}`,
  );
  assert.ok(pinRepublicationChecks > 0, 'expected accepted pin republishes in the Walker sequence');
});
