import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceNarrativeCaptionHold,
  isNarrativeCaptionBaselineChapter,
  NARRATIVE_CAPTION_MIN_HOLD_SEC,
  resolveNarrativeCaptionChapter,
  resolveNarrativeCaptionChapterFromStoryPhase,
  resolveNarrativeCaptionText,
  type NarrativeCaptionHoldState,
} from './narrativeCaptionPolicy';

test('only the two calm chapters are baseline; every event chapter is not', () => {
  assert.equal(isNarrativeCaptionBaselineChapter('monitoring'), true);
  assert.equal(isNarrativeCaptionBaselineChapter('watching-candidates'), true);
  assert.equal(isNarrativeCaptionBaselineChapter('initial-attach'), false);
  assert.equal(isNarrativeCaptionBaselineChapter('selection-hold'), false);
  assert.equal(isNarrativeCaptionBaselineChapter('switching'), false);
  assert.equal(isNarrativeCaptionBaselineChapter('guard'), false);
});

test('evaluating and qualifying collapse into one watching-candidates chapter; every other phase keeps its own', () => {
  assert.equal(resolveNarrativeCaptionChapter('evaluating'), 'watching-candidates');
  assert.equal(resolveNarrativeCaptionChapter('qualifying'), 'watching-candidates');
  assert.equal(resolveNarrativeCaptionChapter('initial-attach'), 'initial-attach');
  assert.equal(resolveNarrativeCaptionChapter('monitoring'), 'monitoring');
  assert.equal(resolveNarrativeCaptionChapter('selection-hold'), 'selection-hold');
  assert.equal(resolveNarrativeCaptionChapter('switching'), 'switching');
  assert.equal(resolveNarrativeCaptionChapter('guard'), 'guard');
});

test('normalized accepted story phases project to caption chapters without rereading engine phase', () => {
  assert.equal(resolveNarrativeCaptionChapterFromStoryPhase('serving'), 'monitoring');
  assert.equal(resolveNarrativeCaptionChapterFromStoryPhase('measuring'), 'watching-candidates');
  assert.equal(resolveNarrativeCaptionChapterFromStoryPhase('holding'), 'selection-hold');
  assert.equal(resolveNarrativeCaptionChapterFromStoryPhase('switching'), 'switching');
  assert.equal(resolveNarrativeCaptionChapterFromStoryPhase('settled'), 'guard');
});

test('every chapter resolves distinct, non-empty bilingual text', () => {
  const chapters = [
    'initial-attach', 'monitoring', 'watching-candidates', 'selection-hold', 'switching', 'guard',
  ] as const;
  const seen = new Set<string>();
  for (const chapter of chapters) {
    const text = resolveNarrativeCaptionText(chapter);
    assert.ok(text.eventLabelZhHant.length > 0);
    assert.ok(text.eventLabelEn.length > 0);
    assert.ok(text.narrationZhHant.length > 0);
    assert.ok(text.narrationEn.length > 0);
    assert.ok(!seen.has(text.narrationZhHant), `duplicate narration for ${chapter}`);
    seen.add(text.narrationZhHant);
  }
});

test('a fresh hold adopts the first observed chapter immediately', () => {
  const state = advanceNarrativeCaptionHold('monitoring', 0, null);
  assert.deepEqual(state, { displayedChapter: 'monitoring', displayedSinceSec: 0, eventQueue: [], pendingBaseline: null });
});

test('an EVENT chapter change within the minimum hold is queued, not shown immediately', () => {
  const opened = advanceNarrativeCaptionHold('selection-hold', 0, null);
  const held = advanceNarrativeCaptionHold('switching', 1, opened);
  assert.equal(held.displayedChapter, 'selection-hold');
  assert.deepEqual(held.eventQueue, ['switching']);
});

test('the queued EVENT chapter is promoted once the minimum hold elapses', () => {
  const opened = advanceNarrativeCaptionHold('selection-hold', 0, null);
  const held = advanceNarrativeCaptionHold('switching', 1, opened);
  const promoted = advanceNarrativeCaptionHold(
    'switching',
    NARRATIVE_CAPTION_MIN_HOLD_SEC,
    held,
  );
  assert.equal(promoted.displayedChapter, 'switching');
  assert.equal(promoted.displayedSinceSec, NARRATIVE_CAPTION_MIN_HOLD_SEC);
  assert.deepEqual(promoted.eventQueue, []);
});

test('a short-lived EVENT chapter still gets its own turn instead of being skipped', () => {
  // Reproduces the measured real sequence: selection-hold -> switching (1s) -> guard,
  // with a 3s minimum hold. `switching` must not be silently replaced by `guard`.
  let state: NarrativeCaptionHoldState | null = advanceNarrativeCaptionHold('selection-hold', 0, null);
  state = advanceNarrativeCaptionHold('switching', 2, state);
  assert.equal(state.displayedChapter, 'selection-hold', 'still holding, switching only queued so far');
  state = advanceNarrativeCaptionHold('guard', 3, state);
  assert.equal(state.displayedChapter, 'switching', 'switching gets promoted, not skipped, at the 3s mark');
  assert.deepEqual(state.eventQueue, ['guard']);
  state = advanceNarrativeCaptionHold('guard', 6, state);
  assert.equal(state.displayedChapter, 'guard');
  assert.deepEqual(state.eventQueue, []);
});

test('repeated observations of the same raw chapter do not requeue or reset the hold clock', () => {
  const opened = advanceNarrativeCaptionHold('monitoring', 0, null);
  const still1 = advanceNarrativeCaptionHold('monitoring', 1, opened);
  const still2 = advanceNarrativeCaptionHold('monitoring', 2, still1);
  assert.deepEqual(still2, { displayedChapter: 'monitoring', displayedSinceSec: 0, eventQueue: [], pendingBaseline: 'monitoring' });
});

test('oscillation collapsed upstream into one chapter never queues against itself', () => {
  // evaluating/qualifying flips are pre-collapsed by resolveNarrativeCaptionChapter,
  // so the hold machinery itself never sees them as distinct chapters to begin with.
  let state: NarrativeCaptionHoldState | null = advanceNarrativeCaptionHold(
    resolveNarrativeCaptionChapter('evaluating'), 0, null,
  );
  state = advanceNarrativeCaptionHold(resolveNarrativeCaptionChapter('qualifying'), 1, state);
  state = advanceNarrativeCaptionHold(resolveNarrativeCaptionChapter('evaluating'), 2, state);
  assert.deepEqual(state.eventQueue, []);
  assert.equal(state.displayedChapter, 'watching-candidates');
});

test('a BASELINE chapter recurring between real events never clogs the event queue (regression: the 8s-stale-caption bug)', () => {
  // Reproduces the exact measured live sequence that produced the bug: two
  // real handovers 4.3s apart, with `watching-candidates` (the collapsed
  // evaluating/qualifying reading) legitimately recurring between almost
  // every step. `evaluating -> switching -> evaluating -> selection-hold ->
  // evaluating -> switching`, all inside ~10s, 3s minimum hold. With the old
  // plain-FIFO design this queued 5 entries and left the caption stuck on
  // `watching-candidates` while both real commits happened behind it,
  // unseen, for 8+ seconds. Every EVENT chapter below must still get its own
  // turn, in order, and the caption must never fall more than one
  // minHoldSec cycle behind the most recent EVENT.
  let state: NarrativeCaptionHoldState | null = advanceNarrativeCaptionHold('watching-candidates', 0, null);
  state = advanceNarrativeCaptionHold('switching', 2, state);
  assert.equal(state.displayedChapter, 'watching-candidates', 'still within the first hold window');
  state = advanceNarrativeCaptionHold('watching-candidates', 4, state);
  assert.equal(state.displayedChapter, 'switching', 'the real event is promoted, not left behind a baseline reading');
  assert.deepEqual(state.eventQueue, []);
  state = advanceNarrativeCaptionHold('selection-hold', 6, state);
  assert.equal(state.displayedChapter, 'switching', 'still within switching\'s own hold window');
  state = advanceNarrativeCaptionHold('watching-candidates', 7, state);
  assert.equal(state.displayedChapter, 'selection-hold', 'second real event promoted on schedule, not stuck behind baseline noise');
  assert.deepEqual(state.eventQueue, []);
  state = advanceNarrativeCaptionHold('switching', 9, state);
  assert.equal(state.displayedChapter, 'selection-hold', 'still within selection-hold\'s own hold window');
  state = advanceNarrativeCaptionHold('switching', 10, state);
  assert.equal(state.displayedChapter, 'switching', 'third real event promoted, caption never fell behind by more than one hold cycle');
  assert.deepEqual(state.eventQueue, []);
});

test('a pending baseline reading is only shown once the event queue is fully drained', () => {
  let state: NarrativeCaptionHoldState | null = advanceNarrativeCaptionHold('selection-hold', 0, null);
  state = advanceNarrativeCaptionHold('switching', 1, state);
  state = advanceNarrativeCaptionHold('watching-candidates', 2, state);
  assert.deepEqual(state.eventQueue, ['switching']);
  assert.equal(state.pendingBaseline, 'watching-candidates');
  state = advanceNarrativeCaptionHold('watching-candidates', 3, state);
  assert.equal(state.displayedChapter, 'switching', 'the queued event drains before the pending baseline is considered');
  assert.equal(state.pendingBaseline, 'watching-candidates');
  state = advanceNarrativeCaptionHold('watching-candidates', 6, state);
  assert.equal(state.displayedChapter, 'watching-candidates', 'once the queue is empty, the pending baseline finally gets shown');
  assert.equal(state.pendingBaseline, null);
});
