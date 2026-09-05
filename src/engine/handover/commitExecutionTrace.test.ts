import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HandoverManager } from './handover-manager';
import { loadProfile } from '../../profiles';
import type { LinkSample } from '../signal/types';
import {
  handoverCommitExecutionCursor,
  handoverCommitExecutionsSince,
} from './commitExecutionTrace';

/**
 * The ledger exists because the oracle's runtime-coverage gate previously read
 * records the SCENARIOS built, so a scenario could satisfy coverage for a path
 * whose production route was unreachable. These tests pin the property that
 * makes the ledger worth reading: an entry appears exactly when a commit
 * actually took effect, and never otherwise.
 */
const sample = (satId: string, beamId: number, sinrDb: number): LinkSample =>
  ({ satId, beamId, sinrDb } as LinkSample);

function manager(): HandoverManager {
  return new HandoverManager(
    loadProfile('hobs-2024-paper-default').handover,
    { enforceSharedHandoverInterval: false },
  );
}

test('a real commit appends exactly one execution record', () => {
  const m = manager();
  const cursor = handoverCommitExecutionCursor();
  const decision = m.update([sample('sat-a', 0, 10)], 0, 0);
  assert.equal(decision.action, 'inter-handover', 'precondition: this update commits an initial attach');

  const appended = handoverCommitExecutionsSince(cursor);
  assert.equal(appended.length, 1, 'one commit must append exactly one ledger entry');
  assert.equal(appended[0]!.engine, 'handover-manager');
  assert.equal(appended[0]!.path, 'manager:initial-attach');
  assert.equal(appended[0]!.path, decision.provenance, 'the ledger path must match the published provenance');
  assert.equal(appended[0]!.action, 'inter-handover');
  assert.equal(appended[0]!.to.satelliteId, 'sat-a');
  assert.equal(appended[0]!.from, null, 'an initial attach has no prior link');
});

test('a non-committing update appends nothing', () => {
  const m = manager();
  m.update([sample('sat-a', 0, 10)], 0, 0);

  // A better satellite appears but has not held for its trigger time, so this
  // update arms a pending target rather than committing.
  const cursor = handoverCommitExecutionCursor();
  const pending = m.update([sample('sat-a', 0, 10), sample('sat-b', 0, 20)], 0.5, 500);
  assert.equal(pending.action, 'stay', 'precondition: this update must not commit');
  assert.equal(
    handoverCommitExecutionsSince(cursor).length,
    0,
    'a proposal is not an execution; only a commit that took effect may be witnessed',
  );
});

test('ledger fields match the event the engine actually logged', () => {
  const m = manager();
  // Seed the serving state directly rather than attaching first: an initial
  // attach at 10 dB would leave the serving SINR above the sibling beam's, so
  // no intra-switch would be justified. Same setup the check:handover
  // intra-dwell scenario uses.
  m.state = { satId: 'sat-a', beamId: 0, sinrDb: 0, triggerTimeSec: 0, pendingTarget: null };
  const cursor = handoverCommitExecutionCursor();
  const commit = m.update([sample('sat-a', 0, 0), sample('sat-a', 1, 8)], 1, 1000);
  assert.equal(commit.action, 'intra-switch', 'precondition: an intra-switch commits here');

  const appended = handoverCommitExecutionsSince(cursor);
  assert.equal(appended.length, 1);
  const event = m.eventLog[m.eventLog.length - 1]!;
  assert.equal(appended[0]!.simTimeMs, event.timeMs, 'the ledger must carry the engine time, not a scenario time');
  assert.equal(appended[0]!.to.satelliteId, event.toSatId);
  assert.equal(appended[0]!.to.beamId, event.toBeamId);
  assert.equal(appended[0]!.from?.satelliteId ?? null, event.fromSatId);
  assert.equal(appended[0]!.action, event.action);
});
