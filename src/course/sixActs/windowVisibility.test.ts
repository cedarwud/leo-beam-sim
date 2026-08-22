#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG,
  SIX_ACTS_HORIZON_ELEVATION_DEG,
  SixActsVisibilityError,
  assertSixActsPlanVisibility,
  readSixActsElevation,
} from './windowVisibility';
import {
  buildSixActsDirectorPlan,
  getSixActsVisibilityRequirements,
} from './directorScript';
import { loadSixActsTeachingWindow } from './teachingWindow';

const window = loadSixActsTeachingWindow();
const COMMIT_MS = Date.parse(window.window.triggerInstantUtc);

function at(offsetSec: number): number {
  return COMMIT_MS + offsetSec * 1000;
}

function pinnedPlan() {
  return buildSixActsDirectorPlan({
    source: 'live-replay',
    commitInstantMs: COMMIT_MS,
    conditionStartInstantMs: COMMIT_MS - 30_000,
    fromSatelliteId: window.pair.from.satelliteId,
    toSatelliteId: window.pair.to.satelliteId,
    replayStepSec: 1,
  });
}

test('the three elevation thresholds stay distinct', () => {
  // Conflating the atlas horizon with Act 1's narrated cone is how a teaching
  // claim silently changes rule.
  assert.strictEqual(SIX_ACTS_HORIZON_ELEVATION_DEG, 0);
  assert.strictEqual(SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG, 10);
});

test('the serving satellite is high in the sky when the script opens', () => {
  const reading = readSixActsElevation('from', at(-300));

  assert.strictEqual(reading.satelliteName, 'ONEWEB-0325');
  assert.ok(Math.abs(reading.elevationDeg - 35.32) < 0.05, `got ${reading.elevationDeg}`);
  assert.strictEqual(reading.aboveHorizon, true);
  assert.strictEqual(reading.aboveClassroomCone, true);
});

test('the candidate has not cleared the narrated cone when the script opens', () => {
  // This is why Phase A and B draw no candidate: at -300 s it is up, but only
  // just, and below the 10 deg cone Act 1 told the room about.
  const reading = readSixActsElevation('to', at(-300));

  assert.ok(Math.abs(reading.elevationDeg - 6.35) < 0.05, `got ${reading.elevationDeg}`);
  assert.strictEqual(reading.aboveHorizon, true);
  assert.strictEqual(reading.aboveClassroomCone, false);
});

test('the handover happens in the low-elevation band, as the atlas said', () => {
  const serving = readSixActsElevation('from', COMMIT_MS);
  const candidate = readSixActsElevation('to', COMMIT_MS);

  assert.ok(Math.abs(serving.elevationDeg - window.quality.minimumEventElevationDeg) < 0.05);
  assert.strictEqual(serving.aboveClassroomCone, false);
  // The candidate is near overhead: 3 dB + 30 s TTT waited until the old link
  // was nearly on the ground and the new one nearly at zenith.
  assert.ok(candidate.elevationDeg > 60, `got ${candidate.elevationDeg}`);
});

test('every phase of the pinned plan can draw what it claims', () => {
  const visibility = assertSixActsPlanVisibility(getSixActsVisibilityRequirements(pinnedPlan()));

  assert.strictEqual(visibility.length, 6);
  assert.deepStrictEqual(
    visibility.map(phase => phase.readings.map(reading => reading.side)),
    [['from'], ['from'], ['from', 'to'], ['from', 'to'], ['from', 'to'], ['to']],
  );
  for (const phase of visibility) {
    for (const reading of phase.readings) {
      assert.strictEqual(reading.aboveHorizon, true);
    }
  }
});

test('a phase that would draw a set satellite is refused', () => {
  // The serving satellite drops below the horizon about two minutes after the
  // commit. A script that reached that far would be drawing a link that is not
  // there.
  assert.throws(
    () => assertSixActsPlanVisibility([{
      phaseId: 'F-new-normal',
      startInstantMs: at(120),
      requiresVisible: ['from'],
    }]),
    error => {
      assert.ok(error instanceof SixActsVisibilityError);
      assert.strictEqual(error.code, 'BELOW_HORIZON');
      assert.match(error.message, /ONEWEB-0325/);
      return true;
    },
  );
});

test('a window mined at another observer cannot borrow the NTPU geometry', () => {
  const moved = {
    ...window,
    provenance: { ...window.provenance, observer: { ...window.provenance.observer, latitudeDeg: 0 } },
  };

  assert.throws(() => readSixActsElevation('from', COMMIT_MS, moved), error => {
    assert.ok(error instanceof SixActsVisibilityError);
    assert.strictEqual(error.code, 'PROPAGATION_FAILED');
    return true;
  });
});
