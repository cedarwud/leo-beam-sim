import type { HandoverPhase } from '../engine/handover/candidateDecisionContract';
import type { HandoverStoryPhase } from './handoverStoryFrame';

export interface NarrativeCaptionText {
  readonly eventLabelZhHant: string;
  readonly eventLabelEn: string;
  readonly narrationZhHant: string;
  readonly narrationEn: string;
}

/**
 * A displayable "chapter" of the real decision engine's own `HandoverPhase`
 * — not a 1:1 copy of it. `evaluating` and `qualifying` collapse into ONE
 * chapter, `watching-candidates`, because in practice they oscillate back
 * and forth every 1-6s as a candidate's EE crosses its trigger and drops
 * back without stabilizing (measured live on the un-accelerated homepage
 * scene: ~8 flips between the two in a 2-minute window). Captioning each
 * flip individually read as noise — text changing every few seconds with no
 * narrative progress — not narration, and arguably worse than no caption at
 * all. Every other phase keeps its own chapter because each one really is a
 * distinct, narratively meaningful step.
 */
export type NarrativeCaptionChapter =
  | 'initial-attach'
  | 'monitoring'
  | 'watching-candidates'
  | 'selection-hold'
  | 'switching'
  | 'guard';

export function resolveNarrativeCaptionChapter(phase: HandoverPhase): NarrativeCaptionChapter {
  if (phase === 'evaluating' || phase === 'qualifying') return 'watching-candidates';
  return phase;
}

/** Caption projection from the already-normalized accepted story phase. */
export function resolveNarrativeCaptionChapterFromStoryPhase(
  phase: HandoverStoryPhase,
): NarrativeCaptionChapter {
  switch (phase) {
    case 'serving': return 'monitoring';
    case 'measuring': return 'watching-candidates';
    case 'holding': return 'selection-hold';
    case 'switching': return 'switching';
    case 'settled': return 'guard';
  }
}

/**
 * The two "nothing urgent is happening" chapters — service is fine, no
 * commitment is in flight. Every other chapter is an EVENT: something a
 * viewer would consider narratively significant enough to deserve its own
 * guaranteed turn. This distinction is what `advanceNarrativeCaptionHold`
 * uses to decide what may be queued versus what is always instantly
 * superseded — see its own header for why the split exists.
 */
const BASELINE_CHAPTERS: ReadonlySet<NarrativeCaptionChapter> = new Set([
  'monitoring',
  'watching-candidates',
]);

/**
 * Baseline chapters are worth tracking internally (so the hold machinery
 * knows a real event isn't pending — see `advanceNarrativeCaptionHold`) but
 * not worth putting on screen: "still calm" said in words next to a scene
 * that already looks calm reads as redundant, not informative. The caption
 * should appear only when there is something to actually narrate and get
 * out of the way otherwise.
 */
export function isNarrativeCaptionBaselineChapter(chapter: NarrativeCaptionChapter): boolean {
  return BASELINE_CHAPTERS.has(chapter);
}

const CHAPTER_TEXT: Readonly<Record<NarrativeCaptionChapter, NarrativeCaptionText>> = Object.freeze({
  'initial-attach': Object.freeze({
    eventLabelZhHant: '決策狀態：初始接取',
    eventLabelEn: 'Decision state: initial attach',
    narrationZhHant: '尚未建立服務鏈路，正在初始接取。',
    narrationEn: 'No serving link yet. Performing initial attach.',
  }),
  monitoring: Object.freeze({
    eventLabelZhHant: '決策狀態：監測',
    eventLabelEn: 'Decision state: monitoring',
    narrationZhHant: '服務穩定，目前無候選鏈路，持續監測。',
    narrationEn: 'Service is stable with no candidates in range. Monitoring.',
  }),
  'watching-candidates': Object.freeze({
    eventLabelZhHant: '決策狀態：監測候選',
    eventLabelEn: 'Decision state: watching candidates',
    narrationZhHant: '服務穩定，候選鏈路持續受到觀察。',
    narrationEn: 'Service is stable. Candidate links are being watched.',
  }),
  'selection-hold': Object.freeze({
    eventLabelZhHant: '決策狀態：觸發時間累計中',
    eventLabelEn: 'Decision state: time-to-trigger accumulating',
    narrationZhHant: '候選鏈路穩定領先，觸發時間累計中。',
    narrationEn: 'A candidate is holding the lead; time-to-trigger is accumulating.',
  }),
  switching: Object.freeze({
    eventLabelZhHant: '決策狀態：執行換手',
    eventLabelEn: 'Decision state: handover executing',
    narrationZhHant: '正在執行換手，服務鏈路切換中。',
    narrationEn: 'Executing the handover — the serving link is switching.',
  }),
  guard: Object.freeze({
    eventLabelZhHant: '決策狀態：保護期',
    eventLabelEn: 'Decision state: guard window',
    narrationZhHant: '換手剛完成，進入保護期避免立即再次切換。',
    narrationEn: 'Handover just completed. In the guard window to prevent an immediate re-switch.',
  }),
});

export function resolveNarrativeCaptionText(chapter: NarrativeCaptionChapter): NarrativeCaptionText {
  return CHAPTER_TEXT[chapter];
}

/**
 * Floor on how long a chapter stays displayed once it is shown, mirroring
 * `MULTI_CANDIDATE_COMPARISON_MIN_DISPLAY_HOLD_SEC` in
 * `multiCandidateSceneDisplayPolicy.ts` for the same reason: measured real
 * phase durations went as low as 1s (`switching`) and 2s
 * (`selection-hold`), too short to read as anything but a flicker.
 */
export const NARRATIVE_CAPTION_MIN_HOLD_SEC = 3;

export interface NarrativeCaptionHoldState {
  readonly displayedChapter: NarrativeCaptionChapter;
  readonly displayedSinceSec: number;
  /** EVENT chapters seen but not yet given their own minimum-hold turn, oldest first. Never contains a baseline chapter. */
  readonly eventQueue: readonly NarrativeCaptionChapter[];
  /** The most recent BASELINE observation not yet shown, or null. Always latest-wins — never queued, never grows. */
  readonly pendingBaseline: NarrativeCaptionChapter | null;
}

/**
 * Advance the hold state by one observation of the real chapter.
 *
 * A single FIFO queue of every distinct chapter seen (the first version of
 * this function) guarantees no EVENT chapter is skipped, but has no bound on
 * how far it can fall behind: measured live, `watching-candidates` legitimately
 * recurs between almost every real event as EE oscillates near the trigger
 * (`evaluating`/`qualifying` flipping back and forth — collapsed into this one
 * chapter, but each RETURN to it after a different chapter is still a fresh,
 * non-consecutive entry the old dedup did not catch). During a real burst —
 * measured: `evaluating → switching → evaluating → selection-hold →
 * evaluating → switching` inside 25s — a plain FIFO queues FIVE entries while
 * only draining one per `minHoldSec`, so the caption can run many real
 * seconds behind: two genuine handovers 4.3s apart were both still sitting
 * behind a stale `watching-candidates` entry while the displayed caption kept
 * showing "nothing is happening" for 8+ real seconds spanning both commits.
 *
 * The fix is a priority split, not a bigger queue. `watching-candidates` and
 * `monitoring` (`BASELINE_CHAPTERS`) carry no information worth queuing —
 * "calm" between two events is not itself an event — so a baseline
 * observation only ever overwrites a single pending slot (latest reading
 * wins, never accumulates) and is shown ONLY once there is no real event
 * waiting. Genuine events (`selection-hold`, `switching`, `guard`,
 * `initial-attach`) still go through the original FIFO queue, so the
 * guarantee this module exists for — no event chapter is ever silently
 * skipped, each gets its own full minimum hold — is unchanged; only the
 * "calm" filler between them can no longer clog that queue.
 */
export function advanceNarrativeCaptionHold(
  rawChapter: NarrativeCaptionChapter,
  nowSec: number,
  previous: NarrativeCaptionHoldState | null,
  minHoldSec: number = NARRATIVE_CAPTION_MIN_HOLD_SEC,
): NarrativeCaptionHoldState {
  if (previous === null) {
    return { displayedChapter: rawChapter, displayedSinceSec: nowSec, eventQueue: [], pendingBaseline: null };
  }
  let eventQueue = previous.eventQueue;
  let pendingBaseline = previous.pendingBaseline;
  if (BASELINE_CHAPTERS.has(rawChapter)) {
    // Latest reading always wins — never accumulates, never blocks an event.
    pendingBaseline = rawChapter;
  } else {
    const lastQueuedOrDisplayed = eventQueue[eventQueue.length - 1] ?? previous.displayedChapter;
    if (rawChapter !== lastQueuedOrDisplayed) {
      eventQueue = [...eventQueue, rawChapter];
    }
  }

  const elapsedSec = nowSec - previous.displayedSinceSec;
  if (elapsedSec < minHoldSec) {
    return { displayedChapter: previous.displayedChapter, displayedSinceSec: previous.displayedSinceSec, eventQueue, pendingBaseline };
  }
  if (eventQueue.length > 0) {
    const [next, ...rest] = eventQueue;
    return { displayedChapter: next!, displayedSinceSec: nowSec, eventQueue: rest, pendingBaseline };
  }
  if (pendingBaseline !== null && pendingBaseline !== previous.displayedChapter) {
    return { displayedChapter: pendingBaseline, displayedSinceSec: nowSec, eventQueue, pendingBaseline: null };
  }
  return { displayedChapter: previous.displayedChapter, displayedSinceSec: previous.displayedSinceSec, eventQueue, pendingBaseline: null };
}
