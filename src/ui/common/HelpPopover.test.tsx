#!/usr/bin/env node
// Pure-logic test for HelpPopover's "only one open at a time" registry.
//
// The repo has no jsdom / React Testing Library / test runner wired up
// (package.json only carries tsx + hand-rolled `node --import tsx/esm
// <script>` validators, no @testing-library/react or jest/vitest). So this
// does NOT render <HelpPopover/> — it exercises helpPopoverStore.ts
// directly, which is the actual behavior CONTRACT §3 requires ("全域一次
// 只開一個"). The DOM-level behaviors (Esc, click-outside, focus restore,
// viewport clamp) are implemented in HelpPopover.tsx itself and were
// verified by hand against `npx tsc --noEmit` + code review; there is no
// harness in this repo to assert them headlessly without adding a new
// dependency, which CONTRACT §0.6 forbids.
//
// Run: `node --import tsx/esm src/ui/common/HelpPopover.test.tsx`
import {
  __resetHelpPopoverStoreForTests,
  closeHelpPopover,
  getActiveHelpId,
  openHelpPopover,
  subscribeHelpPopover,
} from './helpPopoverStore';

let passed = 0;
const failures: string[] = [];

function check(label: string, cond: boolean): void {
  if (cond) {
    passed += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failures.push(label);
    console.error(`  [FAIL] ${label}`);
  }
}

// --- initial state ---
__resetHelpPopoverStoreForTests();
check('starts with nothing active', getActiveHelpId() === null);

// --- open sets active id ---
openHelpPopover('a');
check('opening "a" makes it active', getActiveHelpId() === 'a');

// --- opening a second one closes the first (global "one at a time") ---
openHelpPopover('b');
check('opening "b" replaces "a" as the active one', getActiveHelpId() === 'b');
check('"a" is no longer active (its derived open === false)', getActiveHelpId() !== 'a');

// --- close(id) only closes if it matches the active one ---
closeHelpPopover('a');
check('closing a stale id ("a") does not clobber the actually-active "b"', getActiveHelpId() === 'b');
closeHelpPopover('b');
check('closing the actually-active id clears it', getActiveHelpId() === null);

// --- close() with no id clears whatever is active ---
openHelpPopover('c');
closeHelpPopover();
check('closeHelpPopover() with no id clears the active one', getActiveHelpId() === null);

// --- opening the same id twice is a no-op re: notifications ---
let notifyCount = 0;
const unsubscribe = subscribeHelpPopover(() => {
  notifyCount += 1;
});
openHelpPopover('d');
check('opening notifies subscribers', notifyCount === 1);
openHelpPopover('d');
check('re-opening the same id does not re-notify (avoids extra renders)', notifyCount === 1);
openHelpPopover('e');
check('opening a different id notifies again', notifyCount === 2);
unsubscribe();
openHelpPopover('f');
check('unsubscribed listener stops receiving notifications', notifyCount === 2);

// --- close() on an already-closed store is a no-op re: notifications ---
__resetHelpPopoverStoreForTests();
let idleNotifyCount = 0;
const unsubscribeIdle = subscribeHelpPopover(() => {
  idleNotifyCount += 1;
});
closeHelpPopover();
check('closing when nothing is active does not notify', idleNotifyCount === 0);
unsubscribeIdle();

__resetHelpPopoverStoreForTests();

// --- summary ---
if (failures.length > 0) {
  throw new Error(`[help-popover-store] ${passed} passed, ${failures.length} failed: ${failures.join('; ')}`);
}
console.log(`\n[help-popover-store] ${passed} passed, 0 failed`);
