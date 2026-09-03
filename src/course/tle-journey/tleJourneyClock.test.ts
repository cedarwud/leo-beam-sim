#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TLE_JOURNEY_BEAT_DURATIONS_SEC,
  TLE_JOURNEY_BEAT_START_TIMES_SEC,
  TLE_JOURNEY_COLUMN_EXPLANATION_DURATION_SEC,
  TLE_JOURNEY_DURATION_SEC,
  TLE_JOURNEY_RAW_RECORD_DURATION_SEC,
  TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT,
  TLE_JOURNEY_SGP4_CHECKPOINT_HOLD_SEC,
  advanceTleJourneyCourseTime,
  clampTleJourneyCourseTime,
  courseTimeToTleJourneyBeat,
  tleJourneyBeatToCourseTime,
  tleJourneySgp4SweepProgress,
  tleJourneySgp4StagedSweepProgress,
  tleJourneyStationToCourseTime,
} from './tleJourneyClock';

test('TLE Journey gives the introduction 10 seconds and each of five column explanations 8 seconds', () => {
  assert.equal(TLE_JOURNEY_RAW_RECORD_DURATION_SEC, 10);
  assert.equal(TLE_JOURNEY_COLUMN_EXPLANATION_DURATION_SEC, 8);
  assert.deepEqual(TLE_JOURNEY_BEAT_DURATIONS_SEC, [10, 40, 24, 24, 24]);
  assert.deepEqual(TLE_JOURNEY_BEAT_START_TIMES_SEC, [0, 10, 50, 74, 98]);
  assert.equal(TLE_JOURNEY_DURATION_SEC, 122);

  const first = courseTimeToTleJourneyBeat(0);
  assert.deepEqual(
    { index: first.stationIndex, id: first.stationId, elapsed: first.beatElapsedSec, progress: first.beatProgress },
    { index: 0, id: 'raw-record', elapsed: 0, progress: 0 },
  );

  const boundary = courseTimeToTleJourneyBeat(10);
  assert.deepEqual(
    { index: boundary.stationIndex, id: boundary.stationId, elapsed: boundary.beatElapsedSec, progress: boundary.beatProgress },
    { index: 1, id: 'column-walk', elapsed: 0, progress: 0 },
  );

  const middle = courseTimeToTleJourneyBeat(62);
  assert.deepEqual(
    { index: middle.stationIndex, id: middle.stationId, elapsed: middle.beatElapsedSec, progress: middle.beatProgress },
    { index: 2, id: 'sgp4-contract', elapsed: 12, progress: 0.5 },
  );

  const end = courseTimeToTleJourneyBeat(TLE_JOURNEY_DURATION_SEC);
  assert.deepEqual(
    { index: end.stationIndex, id: end.stationId, elapsed: end.beatElapsedSec, progress: end.beatProgress },
    { index: 4, id: 'observer-pass', elapsed: 24, progress: 1 },
  );
});

test('column-walk progress advances in exact eight-second fifths', () => {
  const checkpoints = [10, 18, 26, 34, 42];
  checkpoints.forEach((courseTimeSec, index) => {
    const frame = courseTimeToTleJourneyBeat(courseTimeSec);
    assert.equal(frame.stationId, 'column-walk');
    assert.equal(frame.beatElapsedSec, index * 8);
    assert.equal(frame.beatProgress, index / 5);
  });
  assert.equal(courseTimeToTleJourneyBeat(50).stationId, 'sgp4-contract');
});

test('SGP4 keeps its first Epoch frame for six seconds before the orbital sweep', () => {
  assert.equal(tleJourneySgp4SweepProgress(0), 0);
  assert.equal(tleJourneySgp4SweepProgress(5.999), 0);
  assert.equal(tleJourneySgp4SweepProgress(6), 0);
  assert.ok(tleJourneySgp4SweepProgress(6.5) > 0);
  assert.equal(tleJourneySgp4SweepProgress(15), 0.5);
  assert.equal(tleJourneySgp4SweepProgress(24), 1);
});

test('SGP4 autoplay holds four readable representative outputs instead of changing every frame', () => {
  assert.equal(TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT, 4);
  assert.equal(TLE_JOURNEY_SGP4_CHECKPOINT_HOLD_SEC, 4.5);
  assert.equal(tleJourneySgp4StagedSweepProgress(0), 0);
  assert.equal(tleJourneySgp4StagedSweepProgress(10.499), 0);
  assert.equal(tleJourneySgp4StagedSweepProgress(10.5), 1 / 3);
  assert.equal(tleJourneySgp4StagedSweepProgress(14.999), 1 / 3);
  assert.equal(tleJourneySgp4StagedSweepProgress(15), 2 / 3);
  assert.equal(tleJourneySgp4StagedSweepProgress(19.5), 1);
  assert.equal(tleJourneySgp4StagedSweepProgress(24), 1);
});

test('TLE Journey seek conversions clamp and reconstruct stable station frames', () => {
  assert.equal(clampTleJourneyCourseTime(-1), 0);
  assert.equal(clampTleJourneyCourseTime(Number.NaN), 0);
  assert.equal(clampTleJourneyCourseTime(199), 122);
  assert.equal(tleJourneyBeatToCourseTime(2, 3.5), 53.5);
  assert.equal(tleJourneyBeatToCourseTime(-4, 99), 10);
  assert.equal(tleJourneyBeatToCourseTime(99, 99), 122);
  assert.equal(tleJourneyStationToCourseTime('satellite-orbit'), 74);
  assert.equal(tleJourneyStationToCourseTime('observer-pass'), 98);
  assert.deepEqual(courseTimeToTleJourneyBeat(74), courseTimeToTleJourneyBeat(74));
});

test('TLE Journey playback speed is a multiplier on the shared clock', () => {
  assert.equal(advanceTleJourneyCourseTime(10, 1, 0.5), 10.5);
  assert.equal(advanceTleJourneyCourseTime(10, 1, 1), 11);
  assert.equal(advanceTleJourneyCourseTime(10, 1, 1.5), 11.5);
  assert.equal(advanceTleJourneyCourseTime(10, 1, 2), 12);
  assert.equal(advanceTleJourneyCourseTime(121.9, 1, 2), 122);
  assert.equal(advanceTleJourneyCourseTime(10, Number.NaN, 2), 10);
});

console.log('TLE Journey clock mapping, seek, and speed tests pass');
