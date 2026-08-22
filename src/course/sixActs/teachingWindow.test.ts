#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SixActsTeachingWindowError,
  assertSixActsCommitMatchesWindow,
  getSixActsQualificationSpan,
  isSixActsAtlasForecastInstant,
  loadSixActsTeachingWindow,
  validateSixActsTeachingWindow,
} from './teachingWindow';
import type { SixActsTeachingWindowFixture } from './teachingWindowSchema';

const window = loadSixActsTeachingWindow();

function mutated(
  apply: (draft: any) => void,
): SixActsTeachingWindowFixture {
  const draft = JSON.parse(JSON.stringify(window));
  apply(draft);
  return draft as SixActsTeachingWindowFixture;
}

function assertDomainError(
  code: SixActsTeachingWindowError['code'],
  operation: () => unknown,
): void {
  assert.throws(operation, error => {
    assert.ok(error instanceof SixActsTeachingWindowError);
    assert.strictEqual(error.code, code);
    return true;
  });
}

test('the pinned window is the top-ranked source-backed OneWeb event', () => {
  assert.strictEqual(window.selection.rank, 1);
  assert.strictEqual(window.selection.sourceEvent, 'inter-handover');
  assert.strictEqual(window.window.constellation, 'oneweb');
  assert.strictEqual(window.window.requestedT0Utc, '2026-08-10T15:00:00.000Z');
  assert.strictEqual(window.window.triggerInstantUtc, '2026-08-10T16:54:30.000Z');
  assert.strictEqual(window.window.triggerOffsetSec, 6870);
  assert.strictEqual(window.pair.from.satelliteId, '49194');
  assert.strictEqual(window.pair.to.satelliteId, '55159');
  assert.deepStrictEqual(window.window.handoverPolicy, {
    offsetDb: 3,
    tttSec: 30,
    anchorStepSec: 30,
  });
});

test('the window is the low-elevation handover the atlas actually found', () => {
  // The proposal's Act 4 rewrite rests on this: valid Offset+TTT events at NTPU
  // only occur low. A window that drifted high would invalidate the script.
  assert.ok(window.quality.minimumEventElevationDeg < 45);
  assert.strictEqual(window.selection.populationContext.validAtLeast45DegCount, 0);
});

test('a valid-event count never travels without its forced-continuity pair', () => {
  const context = window.selection.populationContext;
  assert.strictEqual(context.validInterHandoverCount, 329);
  assert.ok(context.forcedContinuityCount > context.validInterHandoverCount);
});

test('every qualification anchor clears the offset and the span covers TTT', () => {
  const span = getSixActsQualificationSpan();
  assert.strictEqual(span.durationSec, window.window.handoverPolicy.tttSec);
  assert.strictEqual(span.endUtc, window.window.triggerInstantUtc);
  for (const anchor of window.qualification.anchors) {
    assert.ok(anchor.deltaDb >= window.window.handoverPolicy.offsetDb);
  }
});

test('pre-commit delta is candidate minus serving', () => {
  const { preCommit } = window.qualification;
  assert.ok(
    Math.abs(preCommit.candidateSinrDb - preCommit.servingSinrDb - preCommit.deltaDb) < 1e-9,
  );
});

test('the fixture carries no beat timetable', () => {
  assert.strictEqual(window.beatCalibration, 'live-replay-dt');
  const serialized = JSON.stringify(window);
  assert.ok(!/"beat(s|At|Times?)"/i.test(serialized));
});

test('an atlas anchor is recognised as SOURCE-class forecast provenance', () => {
  assert.strictEqual(isSixActsAtlasForecastInstant(window.window.triggerInstantUtc), true);
  assert.strictEqual(isSixActsAtlasForecastInstant('2026-08-10T16:54:29.000Z'), false);
});

test('a live commit near the pinned event reports its drift', () => {
  const pinnedMs = Date.parse(window.window.triggerInstantUtc);
  assert.strictEqual(assertSixActsCommitMatchesWindow(pinnedMs, 5), 0);
  assert.strictEqual(assertSixActsCommitMatchesWindow(pinnedMs - 3000, 5), 3);
});

test('a live commit beyond tolerance means the window drifted, and fails', () => {
  const pinnedMs = Date.parse(window.window.triggerInstantUtc);
  assertDomainError('COMMIT_DRIFT', () =>
    assertSixActsCommitMatchesWindow(pinnedMs + 60_000, 5));
});

test('a hand-edited trigger offset is rejected', () => {
  assertDomainError('TRIGGER_OFFSET_MISMATCH', () =>
    validateSixActsTeachingWindow(mutated(draft => {
      draft.window.triggerOffsetSec = 6871;
    })));
});

test('a qualification anchor below the offset is rejected', () => {
  assertDomainError('OFFSET_NOT_SATISFIED', () =>
    validateSixActsTeachingWindow(mutated(draft => {
      draft.qualification.anchors[1].deltaDb = 2.9;
    })));
});

test('a qualification span shorter than TTT is rejected', () => {
  assertDomainError('TTT_NOT_SATISFIED', () =>
    validateSixActsTeachingWindow(mutated(draft => {
      draft.qualification.anchors = [draft.qualification.anchors[0]];
      draft.qualification.spanSec = 0;
    })));
});

test('a swapped commit target is rejected', () => {
  assertDomainError('PAIR_MISMATCH', () =>
    validateSixActsTeachingWindow(mutated(draft => {
      draft.qualification.postCommit.servingSatelliteId = draft.pair.from.satelliteId;
    })));
});

test('a corrupted TLE digit is rejected by its checksum', () => {
  assertDomainError('INVALID_TLE', () =>
    validateSixActsTeachingWindow(mutated(draft => {
      const line1: string = draft.pair.from.line1;
      draft.pair.from.line1 = `${line1.slice(0, 20)}9${line1.slice(21)}`;
    })));
});

test('a beat-calibration downgrade is rejected', () => {
  assertDomainError('BEAT_CALIBRATION_MISMATCH', () =>
    validateSixActsTeachingWindow(mutated(draft => {
      draft.beatCalibration = 'atlas-forecast';
    })));
});

test('atlas provenance travels with the window', () => {
  assert.match(window.provenance.atlasId, /^tle-event-atlas:[0-9a-f]{64}$/);
  assert.match(window.provenance.atlasArtifactSha256, /^[0-9a-f]{64}$/);
  assert.match(window.provenance.sourceArchiveContentSha256, /^[0-9a-f]{64}$/);
  assert.strictEqual(window.provenance.observer.label, 'NTPU');
  assert.strictEqual(window.provenance.evidenceClass, 'canonical-research');
});
