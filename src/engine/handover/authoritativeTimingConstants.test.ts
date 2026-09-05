import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SINR_LIVE_SELECTION_HOLD_SEC } from '../../scene/sinrLiveCellModel';
import { loadProfile } from '../../profiles';

/**
 * Authoritative handover timing, asserted as LITERALS.
 *
 * A cross-family review showed that setting `selectionHoldSec` to 0 makes the
 * 1-cell and 7-cell scenarios in check:handover commit at 1.0s instead of
 * 1.75s while every gate still passes -- those scenarios assert THAT a commit
 * happened, not WHEN. Nothing anywhere pinned the hold itself.
 *
 * Written as literals on purpose. Every other reference imports these, so a
 * change to the constant moves the expectation with it and nothing fails --
 * the same shape as the EE threshold, where changing 135 to 130 went unnoticed
 * (see eeCommitPermit.test.ts).
 */
const AUTHORITATIVE_SELECTION_HOLD_SEC = 1;
const AUTHORITATIVE_PROFILE_TRIGGER_TIME_SEC = 3.5;

test('the live-scene selection hold is 1 second', () => {
  assert.equal(SINR_LIVE_SELECTION_HOLD_SEC, AUTHORITATIVE_SELECTION_HOLD_SEC);
  assert.ok(
    SINR_LIVE_SELECTION_HOLD_SEC > 0,
    'a zero hold means a candidate commits the instant it leads, with no stability requirement at all',
  );
});

test('the candidate-rich profile trigger time is 3.5s', () => {
  // The check:handover intra scenarios override this to 1s locally, so this
  // asserts the shipped default rather than what those scenarios observe. Both
  // matter: the override is visible in the scenario, the default is not visible
  // anywhere until it changes something.
  const profile = loadProfile('hobs-2024-candidate-rich');
  assert.equal(profile.handover.triggerTimeSec, AUTHORITATIVE_PROFILE_TRIGGER_TIME_SEC);
});
