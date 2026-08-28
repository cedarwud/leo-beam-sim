import assert from 'node:assert/strict';
import test from 'node:test';

import { runMultiCandidateWindow } from './diagnose-multi-candidate-window';
import type { HandoverDecisionFrame } from '../src/engine/handover/candidateDecisionContract';
import {
  buildCandidatePresentationPlan,
  type CandidatePresentationPlan,
} from '../src/engine/handover/candidatePresentationPlan';
import {
  candidatePresentationIdentityLeaseFromPlan,
  createCandidatePresentationIdentityStore,
  type CandidatePresentationIdentityConsumer,
  type CandidatePresentationIdentityStore,
} from '../src/ui/handover-evaluation/candidatePresentationIdentityStore';

function sharedPlan(
  store: CandidatePresentationIdentityStore,
  consumer: CandidatePresentationIdentityConsumer,
  decision: HandoverDecisionFrame,
): CandidatePresentationPlan {
  const draft = buildCandidatePresentationPlan(decision);
  const allocation = store.resolve(
    consumer,
    candidatePresentationIdentityLeaseFromPlan(draft),
  );
  return buildCandidatePresentationPlan(decision, undefined, { identityAllocation: allocation });
}

function assertCollisionFree(plan: CandidatePresentationPlan): void {
  const identities = plan.groups.map(group => group.satelliteIdentity);
  assert.equal(new Set(identities.map(identity => identity.cssColor)).size, identities.length);
  assert.ok(identities.every(identity => !identity.isOverflow));
}

function assertSharedSatelliteTokens(
  scenePlan: CandidatePresentationPlan,
  railPlan: CandidatePresentationPlan,
): number {
  let overlap = 0;
  for (const sceneGroup of scenePlan.groups) {
    const railGroup = railPlan.groups.find(group => group.satelliteId === sceneGroup.satelliteId);
    if (railGroup === undefined) continue;
    overlap += 1;
    assert.equal(railGroup.satelliteIdentity.cssColor, sceneGroup.satelliteIdentity.cssColor);
    assert.equal(railGroup.satelliteIdentity.threeColor, sceneGroup.satelliteIdentity.threeColor);
    assert.equal(railGroup.satelliteIdentity.paletteSlot, sceneGroup.satelliteIdentity.paletteSlot);
  }
  return overlap;
}

test('real Walker sequence keeps scene and throttled rail identities collision-free and equal', () => {
  const store = createCandidatePresentationIdentityStore();
  let frameIndex = 0;
  let comparedOverlaps = 0;
  let crossEpisodeOverlaps = 0;
  let strictModeReplayOverlaps = 0;
  let lastRailPlan: CandidatePresentationPlan | null = null;

  runMultiCandidateWindow({
    durationSec: 300,
    stepSec: 1,
    ueCount: 30,
    onDecisionFrame: ({ decision }) => {
      let scenePlan = sharedPlan(store, 'scene', decision);
      assertCollisionFree(scenePlan);
      if (lastRailPlan !== null) {
        const overlap = assertSharedSatelliteTokens(scenePlan, lastRailPlan);
        comparedOverlaps += overlap;
        if (scenePlan.decision.episodeId !== lastRailPlan.decision.episodeId) {
          crossEpisodeOverlaps += overlap;
        }
      }

      if (frameIndex > 0 && frameIndex % 97 === 0 && lastRailPlan !== null) {
        const committedRailPlan = lastRailPlan;
        store.release('scene', scenePlan.decision.episodeId);
        store.release('rail', committedRailPlan.decision.episodeId);
        assert.equal(store.getCurrentAllocation(), null);

        // React 18 StrictMode replays both passive-effect setups without
        // re-rendering either committed component. The next scene frame must
        // still match the rail plan painted before the cleanup gap.
        store.resolve('scene', candidatePresentationIdentityLeaseFromPlan(scenePlan));
        store.resolve('rail', candidatePresentationIdentityLeaseFromPlan(committedRailPlan));
        scenePlan = sharedPlan(store, 'scene', decision);
        strictModeReplayOverlaps += assertSharedSatelliteTokens(scenePlan, committedRailPlan);
      }

      // A conservative 4:1 proxy for the real high-cadence scene / throttled
      // right-rail split. Different displayed sets stay leased simultaneously.
      if (frameIndex % 4 === 0) {
        const railPlan = sharedPlan(store, 'rail', decision);
        assertCollisionFree(railPlan);
        comparedOverlaps += assertSharedSatelliteTokens(scenePlan, railPlan);
        lastRailPlan = railPlan;
      }

      const activeUnion = store.getCurrentAllocation();
      assert.ok(activeUnion);
      assert.equal(activeUnion.overflowSatelliteIds.length, 0);
      assert.equal(
        new Set(activeUnion.identities.map(identity => identity.cssColor)).size,
        activeUnion.identities.length,
      );
      frameIndex += 1;
    },
  });

  assert.equal(frameIndex, 301);
  assert.ok(comparedOverlaps > 100, `expected substantial cross-consumer overlap, got ${comparedOverlaps}`);
  assert.ok(crossEpisodeOverlaps > 0, 'expected the throttled rail to straddle at least one Walker episode transition');
  assert.ok(strictModeReplayOverlaps > 0, 'expected StrictMode lifecycle replay to compare a committed rail overlap');
});
