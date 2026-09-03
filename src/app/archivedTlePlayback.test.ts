import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  advanceArchivedTlePlaybackCursor,
  resolveArchivedTlePlaybackStart,
} from './archivedTlePlayback';

const appSource = readFileSync(
  fileURLToPath(new URL('../App.tsx', import.meta.url)),
  'utf8',
);

assert.equal(
  advanceArchivedTlePlaybackCursor({
    currentTimeSec: 0,
    deltaSec: 1,
    selectedSpeed: 5,
    durationSec: 7200,
  }),
  5,
  'archived-TLE playback must advance at the selected 5x transport rate',
);
assert.equal(
  advanceArchivedTlePlaybackCursor({
    currentTimeSec: 0,
    deltaSec: 6,
    selectedSpeed: 5,
    durationSec: 7200,
  }),
  30,
  'selected 5x should reach the next 30-second archived anchor in six wall-clock seconds',
);
assert.equal(
  advanceArchivedTlePlaybackCursor({
    currentTimeSec: 7199,
    deltaSec: 1,
    selectedSpeed: 5,
    durationSec: 7200,
  }),
  7200,
  'archived playback must clamp at the complete run end',
);
assert.deepEqual(
  resolveArchivedTlePlaybackStart(7200, 7200),
  { currentTimeSec: 0, restarted: true },
  'pressing Play after the final archived anchor must restart from the run origin',
);
assert.deepEqual(
  resolveArchivedTlePlaybackStart(240, 7200),
  { currentTimeSec: 240, restarted: false },
  'pressing Play during a run must preserve the current cursor',
);

const archivedPlaybackEffect = appSource.match(
  /Archived-TLE homepage playback advances[\s\S]*?\n  }, \[[\s\S]*?\n  \]\);/,
)?.[0] ?? '';
assert.match(
  archivedPlaybackEffect,
  /selectedSpeed:\s*playback\.speed/,
  'the archived-TLE effect must use selected playback.speed, not effectiveSpeed',
);
assert.doesNotMatch(
  archivedPlaybackEffect,
  /selectedSpeed:\s*playback\.effectiveSpeed/,
  'legacy Walker auto-slow must not control archived-TLE playback',
);
assert.match(
  archivedPlaybackEffect,
  /resolveArchivedTlePlaybackStart\(initialTimeSec, timelineDurationSec\)/,
  'the archived-TLE effect must explicitly restart from zero after a completed run',
);

console.log('Archived-TLE playback uses selected transport speed and clamps to the published run.');
