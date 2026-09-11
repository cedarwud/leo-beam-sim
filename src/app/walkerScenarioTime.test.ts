import assert from 'node:assert/strict';
import {
  DEFAULT_WALKER_SCENARIO_DATE,
  DEFAULT_WALKER_SCENARIO_EPOCH_UTC_MS,
  DEFAULT_WALKER_SCENARIO_TIME,
  taipeiScenarioTimeToUtcMs,
} from './walkerScenarioTime';

assert.equal(
  taipeiScenarioTimeToUtcMs(DEFAULT_WALKER_SCENARIO_DATE, DEFAULT_WALKER_SCENARIO_TIME),
  Date.parse('2026-09-09T12:00:00.000Z'),
  '20:00 Asia/Taipei must become 12:00 UTC on the same civil date',
);
assert.equal(DEFAULT_WALKER_SCENARIO_EPOCH_UTC_MS, Date.parse('2026-09-09T12:00:00.000Z'));
assert.equal(
  taipeiScenarioTimeToUtcMs('2026-08-12', '00:00'),
  Date.parse('2026-08-11T16:00:00.000Z'),
  'Taipei midnight must map to the preceding UTC date',
);
assert.equal(taipeiScenarioTimeToUtcMs('2026-02-30', '20:00'), null);
assert.equal(taipeiScenarioTimeToUtcMs('2026-08-12', '24:00'), null);
assert.equal(taipeiScenarioTimeToUtcMs('', '20:00'), null);

console.log('Walker scenario time converts Asia/Taipei civil input to a validated UTC epoch.');
