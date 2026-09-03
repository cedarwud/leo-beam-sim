import assert from 'node:assert/strict';
import {
  clampTimelineTime,
  createArchivedTleRunTimelineDescriptor,
} from './timelineRailAuthority';

const ready = createArchivedTleRunTimelineDescriptor({
  runReady: true,
  durationSec: 7200,
  currentTimeSec: 30,
  stepSec: 30,
});

assert.equal(ready.sourceOwner, 'archived-tle-run');
assert.equal(ready.horizonKind, 'archived-tle-window');
assert.equal(ready.claimKind, 'tle-derived-run');
assert.equal(ready.durationSec, 7200);
assert.equal(ready.currentTimeSec, 30);
assert.equal(ready.axisDurationSec, 7200);
assert.equal(ready.axisCurrentTimeSec, 30);
assert.equal(ready.sourceGapReasons.length, 0);
assert.match(ready.horizonLabel, /TLE-derived SGP4/);
assert.match(ready.horizonLabel, /2 h/);
assert.match(ready.axisLabel, /30s anchors/);

const pending = createArchivedTleRunTimelineDescriptor({
  runReady: false,
  durationSec: 7200,
  currentTimeSec: 9000,
  stepSec: 30,
});
assert.equal(pending.sourceOwner, 'archived-tle-run');
assert.equal(pending.currentTimeSec, 7200);
assert.equal(pending.sourceGapReasons.length, 1);
assert.match(pending.sourceGapReasons[0]!, /timeline remains locked/);
assert.match(pending.horizonLabel, /building 2 h run/);
assert.doesNotMatch(pending.horizonLabel, /complete 2 h/);

assert.equal(clampTimelineTime(7201, ready.durationSec), 7200);
assert.equal(clampTimelineTime(-30, ready.durationSec), 0);

console.log('timelineRailAuthority.test.ts: all assertions passed');
