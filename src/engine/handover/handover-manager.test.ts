import assert from 'node:assert/strict';

import { HandoverManager } from './handover-manager';
import type { LinkSample } from '../signal/types';
import { loadProfile } from '../../profiles';

const epochMs = Date.UTC(2026, 0, 1);
const sample = (satId: string, beamId: number, sinrDb: number): LinkSample => ({
  satId,
  beamId,
  sinrDb,
} as LinkSample);

const manager = new HandoverManager(loadProfile('hobs-2024-paper-default').handover, {
  enforceSharedHandoverInterval: true,
});
manager.state = {
  satId: 'sat-a',
  beamId: 0,
  sinrDb: 10,
  triggerTimeSec: 0,
  pendingTarget: null,
};

manager.update(
  [sample('sat-a', 0, 10), sample('sat-b', 0, 20)],
  0,
  epochMs,
);
const inter = manager.update(
  [sample('sat-a', 0, 10), sample('sat-b', 0, 20)],
  4,
  epochMs + 4000,
);
assert.equal(inter.action, 'inter-handover');

// The serving beam disappears immediately after the inter commit. The old
// continuity-rescue exception incorrectly committed an intra here.
const blockedIntra = manager.update(
  [sample('sat-b', 1, 20), sample('sat-a', 0, 5)],
  0.5,
  epochMs + 4500,
);
assert.equal(blockedIntra.action, 'stay');
assert.match(blockedIntra.reason, /guard active/);
assert.equal(manager.eventLog.length, 1);

// After the shared interval, the same rescue is allowed to become the next
// handover; this verifies the lock is an interval, not a permanent ban.
const intra = manager.update(
  [sample('sat-b', 1, 20), sample('sat-a', 0, 5)],
  6,
  epochMs + 10000,
);
assert.equal(intra.action, 'intra-switch');
assert.equal(manager.eventLog.length, 2);

// The reverse kind is also locked out immediately after intra.
const blockedInter = manager.update(
  [sample('sat-b', 1, 10), sample('sat-c', 0, 30)],
  0.5,
  epochMs + 10500,
);
assert.equal(blockedInter.action, 'stay');
assert.match(blockedInter.reason, /guard active/);
assert.equal(manager.eventLog.length, 2);

console.log('handover-manager exclusivity test passed');

// ---------------------------------------------------------------------------
// Time-to-trigger contract.
//
// Red-team mutation C removed the `triggerTimeSec >= this.triggerTimeSec`
// condition from the stable-target commit and produced NO failure anywhere:
// tsc passed, the tests passed, and check:handover printed output identical to
// the baseline. Nothing asserted that a target must actually hold for the full
// trigger time before it may commit.
//
// The assertion is on the EVENT LOG, not just the returned action: a commit is
// only real once it has been logged, and the log is what downstream consumers
// read.
// ---------------------------------------------------------------------------
{
  const tttProfile = loadProfile('hobs-2024-paper-default').handover;
  const ttt = new HandoverManager(tttProfile, { enforceSharedHandoverInterval: false });
  ttt.state = { satId: 'sat-a', beamId: 0, sinrDb: 10, triggerTimeSec: 0, pendingTarget: null };

  // sat-b becomes the pending target and banks 0.5s of the required 3.5s.
  const armed = ttt.update([sample('sat-a', 0, 10), sample('sat-b', 0, 20)], 0.5, epochMs + 500);
  assert.equal(armed.action, 'stay', 'arming a pending target must not commit');
  const eventsBeforeHold = ttt.eventLog.length;

  // The same target stays best, so the trigger keeps accumulating -- but it is
  // still far short of 3.5s, so no commit may happen yet.
  const held = ttt.update([sample('sat-a', 0, 10), sample('sat-b', 0, 20)], 0.5, epochMs + 1000);
  assert.ok(
    ttt.state.triggerTimeSec < tttProfile.triggerTimeSec,
    `precondition: ${ttt.state.triggerTimeSec}s must still be under the ${tttProfile.triggerTimeSec}s trigger time`,
  );
  assert.equal(held.action, 'stay', 'a target below its time-to-trigger must not commit');
  assert.equal(held.provenance, undefined, 'a non-commit decision carries no provenance');
  assert.equal(
    ttt.eventLog.length,
    eventsBeforeHold,
    'no handover event may be logged before the trigger time elapses',
  );

  // Once the trigger time is genuinely satisfied the same sequence DOES commit,
  // so the assertions above are about timing, not about nothing ever committing.
  const committed = ttt.update([sample('sat-a', 0, 10), sample('sat-b', 0, 20)], 3, epochMs + 4000);
  assert.equal(committed.action, 'inter-handover', 'the target must commit once its trigger time elapses');
  assert.ok(ttt.eventLog.length > eventsBeforeHold, 'and the commit must be logged');
}

console.log('handover-manager time-to-trigger contract test passed');
