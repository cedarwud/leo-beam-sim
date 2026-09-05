import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { loadProfile } from '../profiles/index';
import type { LinkSample } from '../engine/signal/types';
import { S3HandoverManager } from './useSimulation';

/**
 * The homepage's EE handover authority rests on the legacy SINR-only manager
 * NOT committing once a link is established: `MainScene.tsx` passes
 * `homepageVisualIdentity && sceneLane === 'sinr-live'` as
 * `suppressLegacyPrimaryHandover`, and `App.tsx` sets homepageVisualIdentity
 * from `window.location.pathname === '/'`.
 *
 * That invariant had no test and no validator -- grepping the whole repo for
 * `suppressLegacyPrimaryHandover` / `suppressPrimaryHandover` returned only
 * useSimulation.ts itself. Deleting the argument at the call site would let the
 * rail engine hand over above the EE floor again with nothing turning red,
 * which is the failure shape SDD §2 F1 describes.
 */
const sample = (satId: string, beamId: number, sinrDb: number): LinkSample =>
  ({ satId, beamId, sinrDb } as LinkSample);

function managerWithSuppression(suppress: boolean): S3HandoverManager {
  return new S3HandoverManager(
    loadProfile('hobs-2024-paper-default').handover,
    { enforceSharedHandoverInterval: true },
    suppress,
  );
}

test('a suppressed manager still performs the initial attach', () => {
  const manager = managerWithSuppression(true);
  const decision = manager.update([sample('sat-a', 0, 10)], 0, 0);
  assert.equal(decision.action, 'inter-handover', 'the legacy manager still supplies the first link');
  assert.equal(decision.provenance, 'manager:initial-attach');
  assert.equal(manager.eventLog.length, 1);
});

test('a suppressed manager never commits again once a link is established', () => {
  const manager = managerWithSuppression(true);
  const attach = manager.update([sample('sat-a', 0, 10)], 0, 0);
  // Assert the PRECONDITION. Without this, a regression that suppressed the
  // initial attach too would leave eventsAfterAttach at 0, every loop iteration
  // returning 'stay', and the final length check comparing 0 === 0 -- the test
  // would pass green while "once a link is established" never happened.
  assert.equal(attach.action, 'inter-handover', 'precondition: the initial attach must have committed');
  const eventsAfterAttach = manager.eventLog.length;
  assert.equal(eventsAfterAttach, 1, 'precondition: exactly one event was logged by that attach');

  // A far better satellite, held stable well past the trigger time. An
  // unsuppressed manager commits this; the homepage EE authority must not see
  // a SINR-only handover appear underneath it.
  for (let step = 1; step <= 30; step += 1) {
    const decision = manager.update(
      [sample('sat-a', 0, 1), sample('sat-b', 0, 40)],
      1,
      step * 1000,
    );
    assert.equal(decision.action, 'stay', `step ${step} must not commit while suppressed`);
    assert.equal(decision.provenance, undefined, 'a non-commit decision carries no provenance');
  }
  assert.equal(manager.eventLog.length, eventsAfterAttach, 'no further events may be logged');
});

test('the same sequence DOES commit without suppression, so the test is not vacuous', () => {
  const manager = managerWithSuppression(false);
  manager.update([sample('sat-a', 0, 10)], 0, 0);
  const eventsAfterAttach = manager.eventLog.length;

  let committedTo: string | null = null;
  for (let step = 1; step <= 30; step += 1) {
    const decision = manager.update(
      [sample('sat-a', 0, 1), sample('sat-b', 0, 40)],
      1,
      step * 1000,
    );
    // Assert WHAT it committed, not merely that the action was not 'stay'.
    // Any unexpected action value would otherwise read as a successful commit.
    if (decision.action === 'inter-handover') committedTo = decision.target?.satId ?? null;
  }
  assert.equal(committedTo, 'sat-b', 'an unsuppressed manager hands over to the better satellite');
  assert.ok(manager.eventLog.length > eventsAfterAttach, 'and logs the event');
});

/**
 * The tests above construct S3HandoverManager directly, so they prove what a
 * suppressed manager DOES -- but they would all stay green if the call site
 * simply stopped asking for suppression. A Gemini-family review pointed that
 * out: deleting the argument in MainScene is the actual failure mode, and
 * nothing here could see it.
 *
 * Checked against source text because the question is whether a call site
 * exists, which behaviour in this file cannot answer. Anchored tightly on the
 * call itself rather than a loose span, so it cannot be satisfied by unrelated
 * nearby text.
 */
const mainSceneSource = await readFile(new URL('./MainScene.tsx', import.meta.url), 'utf8');

test('MainScene actually asks for suppression rather than defaulting to none', () => {
  assert.match(
    mainSceneSource,
    /shouldSuppressLegacyPrimaryHandover\(sceneLane, homepageVisualIdentity\)/,
    'useSimulation must be told when to suppress the legacy manager; without this argument the '
    + 'homepage silently hands primary handover back to the SINR-only engine',
  );
});
