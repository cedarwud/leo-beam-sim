#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIX_ACTS_PHASES,
  SIX_ACTS_TIMELINE_AXIS_LABEL_ZH_HANT,
  SIX_ACTS_TIMELINE_AXIS_UNIT,
  SixActsDirectorError,
  buildSixActsDirectorPlan,
  buildSixActsPolicyContextCard,
  resolveSixActsPhaseAt,
  type SixActsLiveHandoverObservation,
} from './directorScript';
import { loadSixActsTeachingWindow } from './teachingWindow';

const window = loadSixActsTeachingWindow();
const PINNED_COMMIT_MS = Date.parse(window.window.triggerInstantUtc);

function observation(
  overrides: Partial<SixActsLiveHandoverObservation> = {},
): SixActsLiveHandoverObservation {
  return {
    source: 'live-replay',
    commitInstantMs: PINNED_COMMIT_MS,
    conditionStartInstantMs: PINNED_COMMIT_MS - 30_000,
    fromSatelliteId: window.pair.from.satelliteId,
    toSatelliteId: window.pair.to.satelliteId,
    replayStepSec: 1,
    ...overrides,
  };
}

function assertDomainError(
  code: SixActsDirectorError['code'],
  operation: () => unknown,
): void {
  assert.throws(operation, error => {
    assert.ok(error instanceof SixActsDirectorError);
    assert.strictEqual(error.code, code);
    return true;
  });
}

test('the script is six phases mapped onto the existing three-beat vocabulary', () => {
  assert.strictEqual(SIX_ACTS_PHASES.length, 6);
  assert.deepStrictEqual(
    SIX_ACTS_PHASES.map(phase => phase.beat),
    ['before', 'before', 'before', 'decision', 'decision', 'after'],
  );
  assert.deepStrictEqual(SIX_ACTS_PHASES.map(phase => phase.order), [1, 2, 3, 4, 5, 6]);
});

test('the timeline axis is seconds relative to the commit, never steps', () => {
  // Ruling 2026-08-22: one paper step is 1 s and one episode is 10 steps, so
  // the ~5.5 min script is ~33 episodes. A step axis would read as a single
  // continuous decision.
  assert.strictEqual(SIX_ACTS_TIMELINE_AXIS_UNIT, 'seconds-relative-to-commit');
  assert.match(SIX_ACTS_TIMELINE_AXIS_LABEL_ZH_HANT, /秒/);
  assert.ok(!/步|step|回合|episode/i.test(SIX_ACTS_TIMELINE_AXIS_LABEL_ZH_HANT));
});

test('each phase declares which satellite it actually draws', () => {
  assert.deepStrictEqual(
    SIX_ACTS_PHASES.map(phase => phase.requiresVisible.join('+')),
    ['from', 'from', 'from+to', 'from+to', 'from+to', 'to'],
  );
});

test('exactly one phase stops the room, and it is the condition phase', () => {
  const pausing = SIX_ACTS_PHASES.filter(phase => phase.autoPause);
  assert.strictEqual(pausing.length, 1);
  assert.strictEqual(pausing[0].id, 'D-condition');
});

test('a plan places every boundary relative to the live commit', () => {
  const plan = buildSixActsDirectorPlan(observation());

  assert.strictEqual(plan.commitInstantMs, PINNED_COMMIT_MS);
  assert.strictEqual(plan.autoPauseInstantMs, PINNED_COMMIT_MS - 30_000);
  assert.deepStrictEqual(
    plan.phases.map(phase => (phase.startInstantMs - PINNED_COMMIT_MS) / 1000),
    [-300, -180, -90, -30, 0, 30],
  );
  assert.strictEqual(plan.phases[plan.phases.length - 1].endInstantMs, null);
});

test('the plan tracks live replay: move the commit and the whole script moves', () => {
  // The atlas forecast is a 30 s grid; live replay lands wherever it lands.
  const plan = buildSixActsDirectorPlan(observation({
    commitInstantMs: PINNED_COMMIT_MS - 7_000,
    conditionStartInstantMs: PINNED_COMMIT_MS - 37_000,
  }));

  const pinnedPlan = buildSixActsDirectorPlan(observation());

  assert.strictEqual(plan.commitDriftSec, 7);
  assert.strictEqual(plan.autoPauseInstantMs, PINNED_COMMIT_MS - 37_000);
  // Every boundary shifted by exactly the same 7 s the commit did.
  plan.phases.forEach((phase, index) => {
    assert.strictEqual(phase.startInstantMs, pinnedPlan.phases[index].startInstantMs - 7_000);
  });
});

test('the observed condition hold is reported, not assumed from policy', () => {
  const plan = buildSixActsDirectorPlan(observation({
    conditionStartInstantMs: PINNED_COMMIT_MS - 41_000,
  }));

  assert.strictEqual(plan.observedConditionHoldSec, 41);
  assert.strictEqual(window.window.handoverPolicy.tttSec, 30);
});

test('phase lookup resolves the phase covering an instant', () => {
  const plan = buildSixActsDirectorPlan(observation());

  // Phase spans: A [-300,-180) B [-180,-90) C [-90,-30) D [-30,0) E [0,30) F [30,..)
  assert.strictEqual(resolveSixActsPhaseAt(plan, PINNED_COMMIT_MS - 200_000)?.id, 'A-onboarding');
  assert.strictEqual(resolveSixActsPhaseAt(plan, PINNED_COMMIT_MS - 120_000)?.id, 'B-decline');
  assert.strictEqual(resolveSixActsPhaseAt(plan, PINNED_COMMIT_MS - 60_000)?.id, 'C-candidate');
  assert.strictEqual(resolveSixActsPhaseAt(plan, PINNED_COMMIT_MS - 30_000)?.id, 'D-condition');
  assert.strictEqual(resolveSixActsPhaseAt(plan, PINNED_COMMIT_MS)?.id, 'E-execute');
  assert.strictEqual(resolveSixActsPhaseAt(plan, PINNED_COMMIT_MS + 10_000_000)?.id, 'F-new-normal');
  assert.strictEqual(resolveSixActsPhaseAt(plan, PINNED_COMMIT_MS - 400_000), null);
});

test('a replay that committed a different pair is rejected', () => {
  assertDomainError('PAIR_MISMATCH', () =>
    buildSixActsDirectorPlan(observation({ toSatelliteId: '48212' })));
});

test('a commit far from the pinned event is a drift failure, not a re-plan', () => {
  assert.throws(
    () => buildSixActsDirectorPlan(observation({
      commitInstantMs: PINNED_COMMIT_MS + 600_000,
      conditionStartInstantMs: PINNED_COMMIT_MS + 570_000,
    })),
    error => {
      assert.strictEqual((error as { code?: string }).code, 'COMMIT_DRIFT');
      return true;
    },
  );
});

test('a hold shorter than TTT means the rule was not applied, and fails', () => {
  assertDomainError('CONDITION_TOO_SHORT', () =>
    buildSixActsDirectorPlan(observation({
      conditionStartInstantMs: PINNED_COMMIT_MS - 12_000,
    })));
});

test('a plan cannot be built from a non-live observation', () => {
  assertDomainError('NOT_LIVE_OBSERVATION', () =>
    buildSixActsDirectorPlan({
      ...observation(),
      source: 'atlas-forecast' as unknown as 'live-replay',
    }));
});

test('the policy card never shows a valid-event count without its pair', () => {
  const card = buildSixActsPolicyContextCard();

  assert.strictEqual(card.validInterHandoverCount, 329);
  assert.ok(card.forcedContinuityCount > 0);
  assert.match(card.captionZhHant, /329/);
  assert.match(card.captionZhHant, new RegExp(String(card.forcedContinuityCount)));
  assert.match(card.captionZhHant, /3 dB/);
  assert.match(card.captionZhHant, /30 s TTT/);
  assert.match(card.captionZhHant, /不是星座本身穩不穩/);
});
