#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SimFrame } from '../../scene/types';
import type { BeamshiftCanonicalInstantaneousEe } from '../../teaching';
import {
  SixActsBridgeError,
  SixActsReplayCollector,
  adaptHomepageSixActsFrameFacts,
  adaptSixActsFrameFacts,
  type SixActsAdaptableEnergyFrame,
  type SixActsAdaptableSimFrame,
  type SixActsFrameFacts,
  type SixActsHomepageFrameState,
} from './liveReplayBridge';
import { buildSixActsDirectorPlan } from './directorScript';
import { declareSixActsCourseThreshold } from './taughtConstants';
import { summarizeSixActsRun } from './runSummary';
import { loadSixActsTeachingWindow } from './teachingWindow';

const window = loadSixActsTeachingWindow();
const EPOCH_MS = Date.parse(window.window.requestedT0Utc);
const FROM = window.pair.from.satelliteId;
const TO = window.pair.to.satelliteId;

/**
 * Compile-time conformance: the real runtime and EE frames must keep satisfying
 * the narrow ports the bridge reads. A scene-layer rename breaks `npm run lint`
 * here rather than silently changing what a lesson teaches.
 */
const _frameConforms: (frame: SimFrame) => SixActsAdaptableSimFrame = frame => frame;
const _energyConforms: (
  energy: BeamshiftCanonicalInstantaneousEe,
) => SixActsAdaptableEnergyFrame = energy => energy;
void _frameConforms;
void _energyConforms;

function facts(overrides: Partial<SixActsFrameFacts> = {}): SixActsFrameFacts {
  return {
    simTimeSec: 0,
    servingSatelliteId: FROM,
    servingSinrDb: -12,
    candidateSatelliteId: TO,
    candidateSinrDb: -9,
    triggerProgressSec: 0,
    lastCommittedHandover: null,
    ratesMbps: [10],
    systemPowerW: 2,
    ...overrides,
  };
}

function assertDomainError(code: SixActsBridgeError['code'], operation: () => unknown): void {
  assert.throws(operation, error => {
    assert.ok(error instanceof SixActsBridgeError);
    assert.strictEqual(error.code, code);
    return true;
  });
}

test('the first frame opens the interval and yields no sample', () => {
  const collector = new SixActsReplayCollector({ epochUtcMs: EPOCH_MS });

  assert.strictEqual(collector.push(facts({ simTimeSec: 10 })), null);
  assert.strictEqual(collector.samples.length, 0);
});

test('a sample covers the interval that ends at its frame', () => {
  const collector = new SixActsReplayCollector({ epochUtcMs: EPOCH_MS });
  collector.push(facts({ simTimeSec: 10 }));
  const sample = collector.push(facts({ simTimeSec: 12.5 }));

  assert.ok(sample);
  assert.strictEqual(sample.durationSec, 2.5);
  assert.strictEqual(sample.instantMs, EPOCH_MS + 12_500);
});

test('a frame that does not advance is refused', () => {
  const collector = new SixActsReplayCollector({ epochUtcMs: EPOCH_MS });
  collector.push(facts({ simTimeSec: 10 }));

  assertDomainError('NON_ADVANCING_FRAME', () => collector.push(facts({ simTimeSec: 10 })));
});

test('an attach commit produces no director observation', () => {
  const collector = new SixActsReplayCollector({ epochUtcMs: EPOCH_MS });
  collector.push(facts({ simTimeSec: 0, servingSatelliteId: null, servingSinrDb: null }));
  collector.push(facts({
    simTimeSec: 1,
    lastCommittedHandover: {
      timeMs: 1000,
      action: 'inter-handover',
      fromSatelliteId: null,
      toSatelliteId: FROM,
      deltaDb: null,
    },
  }));

  assert.strictEqual(collector.observations.length, 0);
});

test('an intra-switch produces no director observation', () => {
  const collector = new SixActsReplayCollector({ epochUtcMs: EPOCH_MS });
  collector.push(facts({ simTimeSec: 0, triggerProgressSec: 5 }));
  collector.push(facts({
    simTimeSec: 1,
    lastCommittedHandover: {
      timeMs: 1000,
      action: 'intra-switch',
      fromSatelliteId: FROM,
      toSatelliteId: FROM,
      deltaDb: 0.2,
    },
  }));

  assert.strictEqual(collector.observations.length, 0);
});

test('the same committed event is never observed twice', () => {
  const collector = new SixActsReplayCollector({ epochUtcMs: EPOCH_MS });
  const commit = {
    timeMs: 3000,
    action: 'inter-handover' as const,
    fromSatelliteId: FROM,
    toSatelliteId: TO,
    deltaDb: 3.4,
  };
  collector.push(facts({ simTimeSec: 0 }));
  collector.push(facts({ simTimeSec: 1, triggerProgressSec: 1 }));
  collector.push(facts({ simTimeSec: 2, triggerProgressSec: 2 }));
  collector.push(facts({ simTimeSec: 3, lastCommittedHandover: commit }));
  // The engine keeps reporting the same "last" event on later frames.
  collector.push(facts({ simTimeSec: 4, lastCommittedHandover: commit }));

  assert.strictEqual(collector.observations.length, 1);
});

/** Replays the pinned window's TTT hold at a 1 s step and commits at t0+6870 s. */
function replayPinnedHandover(): SixActsReplayCollector {
  const collector = new SixActsReplayCollector({ epochUtcMs: EPOCH_MS });
  const commitSec = window.window.triggerOffsetSec;
  const holdSec = window.window.handoverPolicy.tttSec;

  for (let simTimeSec = commitSec - holdSec - 5; simTimeSec < commitSec; simTimeSec += 1) {
    const heldSec = simTimeSec - (commitSec - holdSec);
    collector.push(facts({
      simTimeSec,
      triggerProgressSec: heldSec > 0 ? heldSec : 0,
    }));
  }
  // The commit frame: the engine has already cleared the accumulated hold.
  collector.push(facts({
    simTimeSec: commitSec,
    servingSatelliteId: TO,
    triggerProgressSec: 0,
    candidateSatelliteId: null,
    candidateSinrDb: null,
    lastCommittedHandover: {
      timeMs: commitSec * 1000,
      action: 'inter-handover',
      fromSatelliteId: FROM,
      toSatelliteId: TO,
      deltaDb: 3.39,
    },
  }));
  return collector;
}

test('the condition start survives the commit frame clearing the hold', () => {
  const collector = replayPinnedHandover();
  const observation = collector.findObservation(FROM, TO);

  assert.ok(observation);
  assert.strictEqual(observation.source, 'live-replay');
  assert.strictEqual(observation.commitInstantMs, Date.parse(window.window.triggerInstantUtc));
  // A full 30 s hold, not 29: the mark is the boundary before progress went positive.
  assert.strictEqual(
    (observation.commitInstantMs - observation.conditionStartInstantMs) / 1000,
    window.window.handoverPolicy.tttSec,
  );
  assert.strictEqual(observation.replayStepSec, 1);
});

test('the observation drives the director plan end to end', () => {
  const observation = replayPinnedHandover().findObservation(FROM, TO);
  assert.ok(observation);

  const plan = buildSixActsDirectorPlan(observation);

  assert.strictEqual(plan.commitDriftSec, 0);
  assert.strictEqual(plan.observedConditionHoldSec, 30);
  assert.strictEqual(plan.phases.length, 6);
});

test('the collected samples drive the run summary end to end', () => {
  const collector = replayPinnedHandover();
  const summary = summarizeSixActsRun({
    samples: collector.samples,
    lowSinrThreshold: declareSixActsCourseThreshold(-10, '測試用門檻'),
    runId: 'bridge-test',
    strategyId: 'baseline',
    scenarioId: 'oneweb-20260810T150000Z',
  });

  assert.strictEqual(summary.sampleCount, collector.samples.length);
  assert.strictEqual(summary.numHandovers, 1);
  assert.strictEqual(summary.outageSampleCount, 0);
  assert.strictEqual(summary.lowSinrRatioPercent, 100);
});

test('the adapter reports outage from the energy frame, not the serving id', () => {
  // A UE can still name a serving satellite while the producer has it in
  // outage; what the classroom counts is whether bits moved.
  const adapted = adaptSixActsFrameFacts(
    {
      simTimeSec: 5,
      serving: { satId: FROM, sinrDb: -12 },
      pendingTargetSatId: TO,
      pendingTargetSinrDb: -9,
      handoverTriggerProgressSec: 0,
      lastHoEvent: null,
    },
    {
      systemPowerW: 11,
      users: [
        { ueId: 'ue-12', status: 'outage', sinrDb: -30, rateMbps: 0 },
        { ueId: 'ue-13', status: 'served', sinrDb: -8, rateMbps: 4 },
      ],
    },
    'ue-12',
  );

  assert.strictEqual(adapted.servingSatelliteId, null);
  assert.strictEqual(adapted.servingSinrDb, null);
  assert.deepStrictEqual(adapted.ratesMbps, [0, 4]);
  assert.strictEqual(adapted.systemPowerW, 11);
});

test('the adapter carries the served UE through with its own SINR', () => {
  const adapted = adaptSixActsFrameFacts(
    {
      simTimeSec: 5,
      serving: { satId: FROM, sinrDb: -12 },
      pendingTargetSatId: TO,
      pendingTargetSinrDb: -9,
      handoverTriggerProgressSec: 7,
      lastHoEvent: null,
    },
    { systemPowerW: 11, users: [{ ueId: 'ue-12', status: 'served', sinrDb: -11.5, rateMbps: 3 }] },
    'ue-12',
  );

  assert.strictEqual(adapted.servingSatelliteId, FROM);
  assert.strictEqual(adapted.servingSinrDb, -11.5);
  assert.strictEqual(adapted.candidateSatelliteId, TO);
  assert.strictEqual(adapted.triggerProgressSec, 7);
});

test('an energy frame without the focused UE is a typed failure', () => {
  assertDomainError('FOCUSED_UE_ABSENT', () => adaptSixActsFrameFacts(
    {
      simTimeSec: 0,
      serving: { satId: FROM, sinrDb: -12 },
      pendingTargetSatId: null,
      pendingTargetSinrDb: null,
      handoverTriggerProgressSec: 0,
      lastHoEvent: null,
    },
    { systemPowerW: 1, users: [{ ueId: 'ue-0', status: 'served', sinrDb: -5, rateMbps: 1 }] },
    'ue-12',
  ));
});

function homepageState(
  overrides: Partial<SixActsHomepageFrameState> = {},
): SixActsHomepageFrameState {
  return {
    simTimeSec: 12,
    primaryUeId: null,
    canonicalEe: {
      systemPowerW: null,
      perUserContributions: null,
    },
    angleAwareFormulaFrame: {
      ueId: 'ue-0',
      satId: FROM,
      selected: 1,
      terms: {
        gammaDb: -8.5,
        throughputBps: 6.5e6,
        systemPowerW: 3.25,
      },
    },
    servingSatId: FROM,
    sinrDb: -8.5,
    pendingTargetSatId: TO,
    pendingTargetSinrDb: -4.9,
    handoverTriggerProgressSec: 4,
    lastHoEvent: null,
    ...overrides,
  };
}

test('homepage adapter uses the live formula frame while canonical EE is invalid', () => {
  const adapted = adaptHomepageSixActsFrameFacts(homepageState());

  assert.ok(adapted);
  assert.strictEqual(adapted.servingSatelliteId, FROM);
  assert.strictEqual(adapted.servingSinrDb, -8.5);
  assert.deepStrictEqual(adapted.ratesMbps, [6.5]);
  assert.strictEqual(adapted.systemPowerW, 3.25);
  assert.strictEqual(adapted.candidateSatelliteId, TO);
});

test('homepage adapter fails closed when neither complete EE nor formula frame is available', () => {
  const adapted = adaptHomepageSixActsFrameFacts(homepageState({ angleAwareFormulaFrame: null }));

  assert.strictEqual(adapted, null);
});

test('homepage adapter keeps the complete canonical payload as the preferred source', () => {
  const adapted = adaptHomepageSixActsFrameFacts(homepageState({
    primaryUeId: 'ue-canonical',
    canonicalEe: {
      systemPowerW: 11,
      perUserContributions: [{
        ueId: 'ue-canonical',
        status: 'served',
        satId: FROM,
        sinrDb: -7,
        rateMbps: 4,
      }],
    },
  }));

  assert.ok(adapted);
  assert.strictEqual(adapted.systemPowerW, 11);
  assert.deepStrictEqual(adapted.ratesMbps, [4]);
  assert.strictEqual(adapted.servingSinrDb, -7);
});
