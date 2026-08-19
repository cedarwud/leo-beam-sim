#!/usr/bin/env node
import { buildNonOverlappingIntraPresentationSlots } from './handoverPresentationSchedule';

let passed = 0;
function check(label: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}

const slots = buildNonOverlappingIntraPresentationSlots({
  interEventTimesSec: [300, 900],
  startSec: 0,
  endSec: 1200,
  durationSec: 8,
  interGuardSec: 45,
  minSpacingSec: 120,
});

check('places deterministic slots in the available timeline gaps', slots.length > 0);
check(
  'does not overlap an inter reservation',
  slots.every(slot => [300, 900].every(time => (
    slot.endSec <= time - 45 || slot.startSec >= time + 45
  ))),
);
check(
  'keeps consecutive intra stories apart',
  slots.slice(1).every((slot, index) => slot.startSec - slots[index]!.startSec >= 120),
);
check(
  'does not place a story outside the requested window',
  slots.every(slot => slot.startSec >= 0 && slot.endSec <= 1200),
);

console.log(`handoverPresentationSchedule.test: ${passed} checks passed`);
