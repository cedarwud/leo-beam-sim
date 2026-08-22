/**
 * Act 4 director script v1 — the six-phase classroom plan.
 *
 * This is the headless half of M4: given ONE live-replay observation of the
 * pinned handover, it produces the phase timetable, the narration, and the
 * auto-pause point. It renders nothing; the viewport layer feeds it to the
 * existing `visualLab/story` director and `guidedReplay` annotation overlay.
 *
 * Every instant here comes from the live observation. The teaching-window
 * fixture supplies identity and policy only — there is no code path from the
 * fixture to a phase boundary, which is what keeps the atlas's 30 s offline
 * forecast out of the timetable.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M4).
 */

import {
  assertSixActsCommitMatchesWindow,
  loadSixActsTeachingWindow,
} from './teachingWindow';
import type { SixActsTeachingWindowFixture } from './teachingWindowSchema';

/** Default tolerance between the live commit and the pinned event, in seconds. */
export const SIX_ACTS_COMMIT_DRIFT_TOLERANCE_SEC = 90;

/**
 * The only legend the Act 4 timeline may carry.
 *
 * Never label this axis in steps. One paper step is 1 s and one episode is 10
 * steps, so the ~5.5 minute script is ~33 episodes; a step axis reads as a
 * single continuous decision, which is the opposite of what Act 4 teaches.
 */
export const SIX_ACTS_TIMELINE_AXIS_LABEL_ZH_HANT = '相對換手時刻的秒數' as const;
export const SIX_ACTS_TIMELINE_AXIS_UNIT = 'seconds-relative-to-commit' as const;

export type SixActsPhaseId =
  | 'A-onboarding'
  | 'B-decline'
  | 'C-candidate'
  | 'D-condition'
  | 'E-execute'
  | 'F-new-normal';

/**
 * The existing three-beat vocabulary from `visualLabStoryDirector`.
 *
 * Six phases are a superset of it, not a replacement: the script maps onto the
 * beats the story director already understands so the classroom does not spawn
 * a second story lane.
 */
export type SixActsStoryBeat = 'before' | 'decision' | 'after';

export interface SixActsPhaseSpec {
  readonly id: SixActsPhaseId;
  readonly order: number;
  readonly beat: SixActsStoryBeat;
  readonly titleZhHant: string;
  readonly narrationZhHant: string;
  /** Quantities the floating card shows during this phase. */
  readonly focusQuantities: readonly string[];
  /**
   * Which side of the pair this phase actually draws a link to. Checked against
   * SGP4 by `assertSixActsPlanVisibility`: a phase that draws a set satellite
   * is teaching a link that does not exist.
   */
  readonly requiresVisible: readonly ('from' | 'to')[];
  /** Only Phase D stops the room; the rest keep the replay moving. */
  readonly autoPause: boolean;
  /** Seconds before (negative) or after the live commit that this phase starts. */
  readonly startOffsetSec: number;
}

/**
 * Offsets are relative to the live commit instant and were chosen to fit the
 * proposal's 22–25 min Act 4: three minutes of decline, the TTT window itself
 * for the condition, and a minute of new normal.
 */
export const SIX_ACTS_PHASES: readonly SixActsPhaseSpec[] = Object.freeze([
  Object.freeze({
    id: 'A-onboarding',
    order: 1,
    beat: 'before',
    titleZhHant: '接手初期',
    narrationZhHant: '該服務衛星剛接手連線。先讀取目前幾何：仰角、距離與訊號品質。',
    focusQuantities: ['servingSinrDb', 'servingElevationDeg', 'servingRangeKm'],
    requiresVisible: Object.freeze(['from'] as const),
    autoPause: false,
    startOffsetSec: -300,
  }),
  Object.freeze({
    id: 'B-decline',
    order: 2,
    beat: 'before',
    titleZhHant: '品質下滑',
    narrationZhHant: '服務衛星仰角下降。距離增加、離軸角擴大、仰角降低，三項幾何變化共同造成訊號衰減。',
    focusQuantities: ['servingSinrDb', 'servingElevationDeg', 'servingRangeKm', 'servingOffAxisAngleDeg'],
    requiresVisible: Object.freeze(['from'] as const),
    autoPause: false,
    startOffsetSec: -180,
  }),
  Object.freeze({
    id: 'C-candidate',
    order: 3,
    beat: 'before',
    titleZhHant: '候選出現',
    narrationZhHant: '第二條曲線出現。候選排序列出各衛星的訊號、仰角與剩餘可見時間。',
    focusQuantities: ['candidateSinrDb', 'candidateElevationDeg', 'candidateResidualSec'],
    requiresVisible: Object.freeze(['from', 'to'] as const),
    autoPause: false,
    startOffsetSec: -90,
  }),
  Object.freeze({
    id: 'D-condition',
    order: 4,
    beat: 'decision',
    titleZhHant: '條件判斷',
    narrationZhHant: '規則可表示為：候選必須超過服務門檻，且條件需連續成立整段 TTT；目前 frame 已滿足條件。',
    focusQuantities: ['deltaSinrDb', 'offsetDb', 'tttSec', 'tttProgressSec'],
    requiresVisible: Object.freeze(['from', 'to'] as const),
    autoPause: true,
    startOffsetSec: -30,
  }),
  Object.freeze({
    id: 'E-execute',
    order: 5,
    beat: 'decision',
    titleZhHant: '執行換手',
    narrationZhHant: '執行跨衛星換手。收據記錄已提交事件的 source、target 與 SINR 增益；中斷與訊令成本須由相應觀測欄位提供。',
    focusQuantities: ['interruptionMs', 'signallingCost', 'sinrGainDb'],
    requiresVisible: Object.freeze(['from', 'to'] as const),
    autoPause: false,
    startOffsetSec: 0,
  }),
  Object.freeze({
    id: 'F-new-normal',
    order: 6,
    beat: 'after',
    titleZhHant: '新常態',
    narrationZhHant: '數值回穩。新的服務衛星也會經歷仰角下降，因此相同決策鏈將週期性重現。',
    focusQuantities: ['servingSinrDb', 'servingElevationDeg'],
    requiresVisible: Object.freeze(['to'] as const),
    autoPause: false,
    startOffsetSec: 30,
  }),
]);

export type SixActsDirectorErrorCode =
  | 'NOT_LIVE_OBSERVATION'
  | 'PAIR_MISMATCH'
  | 'NON_MONOTONIC_PHASES'
  | 'CONDITION_TOO_SHORT';

export class SixActsDirectorError extends Error {
  readonly code: SixActsDirectorErrorCode;

  constructor(code: SixActsDirectorErrorCode, message: string) {
    super(message);
    this.name = 'SixActsDirectorError';
    this.code = code;
  }
}

function fail(code: SixActsDirectorErrorCode, message: string): never {
  throw new SixActsDirectorError(code, message);
}

/**
 * What the live replay actually did.
 *
 * `source` is a literal type, not decoration: it is impossible to build a plan
 * from anything the runtime did not observe.
 */
export interface SixActsLiveHandoverObservation {
  readonly source: 'live-replay';
  /** UTC ms at which the replay committed the handover. */
  readonly commitInstantMs: number;
  /** UTC ms at which the offset condition first held in the replay. */
  readonly conditionStartInstantMs: number;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  /** The replay step in seconds, recorded so a beat's resolution is visible. */
  readonly replayStepSec: number;
}

export interface SixActsPhasePlan extends SixActsPhaseSpec {
  readonly startInstantMs: number;
  /** Exclusive; the final phase has no end and carries null. */
  readonly endInstantMs: number | null;
}

export interface SixActsDirectorPlan {
  readonly phases: readonly SixActsPhasePlan[];
  readonly commitInstantMs: number;
  /** Live-observed TTT hold, which need not equal the policy's nominal value. */
  readonly observedConditionHoldSec: number;
  /** How far the live commit sat from the pinned event, in seconds. */
  readonly commitDriftSec: number;
  readonly replayStepSec: number;
  readonly autoPauseInstantMs: number;
  readonly windowVariantId: string;
}

export interface SixActsDirectorPlanOptions {
  readonly fixture?: SixActsTeachingWindowFixture;
  readonly toleranceSec?: number;
}

/**
 * Builds the six-phase plan around one live commit.
 *
 * The plan tracks the replay: move the observed commit and every boundary moves
 * with it. Nothing is read off the atlas forecast.
 */
export function buildSixActsDirectorPlan(
  observation: SixActsLiveHandoverObservation,
  options: SixActsDirectorPlanOptions = {},
): SixActsDirectorPlan {
  if (observation.source !== 'live-replay') {
    fail('NOT_LIVE_OBSERVATION', 'a director plan may only be built from a live replay observation');
  }
  const fixture = options.fixture ?? loadSixActsTeachingWindow();

  if (observation.fromSatelliteId !== fixture.pair.from.satelliteId
    || observation.toSatelliteId !== fixture.pair.to.satelliteId) {
    fail(
      'PAIR_MISMATCH',
      `the replay committed ${observation.fromSatelliteId}->${observation.toSatelliteId}, `
      + `not the pinned ${fixture.pair.from.satelliteId}->${fixture.pair.to.satelliteId}`,
    );
  }

  const commitDriftSec = assertSixActsCommitMatchesWindow(
    observation.commitInstantMs,
    options.toleranceSec ?? SIX_ACTS_COMMIT_DRIFT_TOLERANCE_SEC,
    fixture,
  );

  const observedConditionHoldSec =
    (observation.commitInstantMs - observation.conditionStartInstantMs) / 1000;
  if (observedConditionHoldSec < 0) {
    fail('CONDITION_TOO_SHORT', 'the condition cannot start after the commit');
  }
  // A hold shorter than the policy's TTT means the replay is not applying the
  // rule Phase D is about to draw on screen.
  if (observedConditionHoldSec + 1e-9 < fixture.window.handoverPolicy.tttSec) {
    fail(
      'CONDITION_TOO_SHORT',
      `the replay held the condition for ${observedConditionHoldSec} s, short of the `
      + `${fixture.window.handoverPolicy.tttSec} s TTT it is meant to demonstrate`,
    );
  }

  const ordered = [...SIX_ACTS_PHASES].sort((left, right) => left.order - right.order);
  const phases: SixActsPhasePlan[] = ordered.map((spec, index) => {
    const startInstantMs = observation.commitInstantMs + spec.startOffsetSec * 1000;
    const next = ordered[index + 1];
    const endInstantMs = next === undefined
      ? null
      : observation.commitInstantMs + next.startOffsetSec * 1000;
    return Object.freeze({ ...spec, startInstantMs, endInstantMs });
  });

  for (let index = 1; index < phases.length; index += 1) {
    if (phases[index].startInstantMs <= phases[index - 1].startInstantMs) {
      fail('NON_MONOTONIC_PHASES', `phase ${phases[index].id} does not advance past ${phases[index - 1].id}`);
    }
  }

  const pausePhase = phases.find(phase => phase.autoPause);
  if (pausePhase === undefined) {
    fail('NON_MONOTONIC_PHASES', 'the script must carry exactly one auto-pause phase');
  }

  return Object.freeze({
    phases: Object.freeze(phases),
    commitInstantMs: observation.commitInstantMs,
    observedConditionHoldSec,
    commitDriftSec,
    replayStepSec: observation.replayStepSec,
    autoPauseInstantMs: pausePhase.startInstantMs,
    windowVariantId: fixture.selection.variantId,
  });
}

/**
 * The plan's visibility requirements, ready for `assertSixActsPlanVisibility`.
 *
 * Exposed as a derivation rather than left to the caller: forgetting the check
 * is exactly the failure it exists to prevent.
 */
export function getSixActsVisibilityRequirements(
  plan: SixActsDirectorPlan,
): readonly {
  readonly phaseId: SixActsPhaseId;
  readonly startInstantMs: number;
  readonly requiresVisible: readonly ('from' | 'to')[];
}[] {
  return Object.freeze(plan.phases.map(phase => Object.freeze({
    phaseId: phase.id,
    startInstantMs: phase.startInstantMs,
    requiresVisible: phase.requiresVisible,
  })));
}

/** The phase covering an instant, or null outside the script. */
export function resolveSixActsPhaseAt(
  plan: SixActsDirectorPlan,
  instantMs: number,
): SixActsPhasePlan | null {
  for (const phase of plan.phases) {
    const withinStart = instantMs >= phase.startInstantMs;
    const withinEnd = phase.endInstantMs === null || instantMs < phase.endInstantMs;
    if (withinStart && withinEnd) return phase;
  }
  return null;
}

/**
 * The Act 4 honesty card.
 *
 * A valid-event count on its own reads as "this constellation is stable"; it is
 * only truthful beside the forced-continuity count and the policy that produced
 * both. The pairing is data, so the card cannot be built without it.
 */
export interface SixActsPolicyContextCard {
  readonly validInterHandoverCount: number;
  readonly forcedContinuityCount: number;
  readonly offsetDb: number;
  readonly tttSec: number;
  readonly observerLabel: string;
  readonly captionZhHant: string;
}

export function buildSixActsPolicyContextCard(
  fixture: SixActsTeachingWindowFixture = loadSixActsTeachingWindow(),
): SixActsPolicyContextCard {
  const { validInterHandoverCount, forcedContinuityCount } = fixture.selection.populationContext;
  const { offsetDb, tttSec } = fixture.window.handoverPolicy;
  return Object.freeze({
    validInterHandoverCount,
    forcedContinuityCount,
    offsetDb,
    tttSec,
    observerLabel: fixture.provenance.observer.label,
    captionZhHant:
      `在 ${fixture.provenance.observer.label}、${offsetDb} dB offset ＋ ${tttSec} s TTT 這組政策下，`
      + `90 天有 ${validInterHandoverCount} 次條件式換手、${forcedContinuityCount} 次被迫接替。`
      + '這是這組政策在這個地點的性質，不是星座本身穩不穩。',
  });
}
