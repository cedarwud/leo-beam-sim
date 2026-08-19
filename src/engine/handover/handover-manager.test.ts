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
