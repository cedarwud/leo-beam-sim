export const INTRA_HANDOVER_TEACHING_DURATION_SEC = 78;
export const INTRA_HANDOVER_TEACHING_ROUTE = '/prototype/intra-handover-teaching';

export const INTRA_HANDOVER_TEACHING_BEATS = Object.freeze([
  {
    id: 'establish',
    order: 1,
    startSec: 0,
    endSec: 10,
    camera: 'wide',
    primaryCue: 'same-satellite',
    learningPhase: 'observation',
    title: '同一顆衛星',
    caption: 'UE 仍由同一顆衛星服務；今天要看的變化只發生在波束身上。',
  },
  {
    id: 'approach',
    order: 2,
    startSec: 10,
    endSec: 20,
    camera: 'approach',
    primaryCue: 'boundary-approach',
    learningPhase: 'observation',
    title: 'UE 接近波束邊界',
    caption: 'UE 沿著地面波束地毯移動，逐漸靠近目前波束與鄰接波束的邊界。',
  },
  {
    id: 'candidate',
    order: 3,
    startSec: 20,
    endSec: 30,
    camera: 'candidate',
    primaryCue: 'candidate-beam',
    title: '同星候選波束',
    learningPhase: 'prediction',
    caption: '請先選擇：UE 應留在舊 beam，還是切到同星候選？',
  },
  {
    id: 'qualify',
    order: 4,
    startSec: 30,
    endSec: 42,
    camera: 'decision',
    primaryCue: 'source-decision',
    learningPhase: 'causal-explanation',
    title: '來源事件判定',
    caption: '來源事件記錄了兩個不同波束與當下 SINR；未發布的 TTT 不在畫面中猜測。',
  },
  {
    id: 'switch',
    order: 5,
    startSec: 42,
    endSec: 54,
    camera: 'switch',
    primaryCue: 'beam-switch',
    learningPhase: 'visible-consequence',
    title: '慢動作換束',
    caption: '舊波束淡出、新波束點亮；衛星身份在整個切換中保持不變。',
  },
  {
    id: 'receipt',
    order: 6,
    startSec: 54,
    endSec: 66,
    camera: 'receipt',
    primaryCue: 'identity-receipt',
    learningPhase: 'causal-explanation',
    title: '身份收據',
    caption: '收據只確認來源事件真正提供的身份與 SINR 差值；EE 沒有來源就不顯示。',
  },
  {
    id: 'after',
    order: 7,
    startSec: 66,
    endSec: 74,
    camera: 'after',
    primaryCue: 'new-beam-stable',
    learningPhase: 'transfer',
    title: '新波束服務',
    caption: '現在的服務波束已改變，但服務衛星仍是同一顆。',
  },
  {
    id: 'compare',
    order: 8,
    startSec: 74,
    endSec: 78,
    camera: 'compare',
    primaryCue: 'inter-contrast',
    learningPhase: 'transfer-check',
    title: '與跨衛星換手比較',
    caption: '同衛星換束改變 beam ID；跨衛星換手則同時改變 satellite ID。',
  },
] as const);

export type IntraHandoverTeachingBeat = (typeof INTRA_HANDOVER_TEACHING_BEATS)[number];
export type IntraHandoverTeachingBeatId = IntraHandoverTeachingBeat['id'];
export type IntraHandoverTeachingCamera = IntraHandoverTeachingBeat['camera'];

export interface IntraHandoverTeachingDirectorState {
  readonly timeSec: number;
  readonly beat: IntraHandoverTeachingBeat;
  readonly beatProgress: number;
}

export function clampIntraHandoverTeachingTime(timeSec: number): number {
  if (!Number.isFinite(timeSec)) return 0;
  return Math.min(INTRA_HANDOVER_TEACHING_DURATION_SEC, Math.max(0, timeSec));
}

export function beatForIntraHandoverTeachingTime(timeSec: number): IntraHandoverTeachingBeat {
  const clamped = clampIntraHandoverTeachingTime(timeSec);
  return INTRA_HANDOVER_TEACHING_BEATS.find(beat => clamped < beat.endSec)
    ?? INTRA_HANDOVER_TEACHING_BEATS[INTRA_HANDOVER_TEACHING_BEATS.length - 1]!;
}

export function directorStateForIntraHandoverTeachingTime(
  timeSec: number,
): IntraHandoverTeachingDirectorState {
  const clamped = clampIntraHandoverTeachingTime(timeSec);
  const beat = beatForIntraHandoverTeachingTime(clamped);
  return Object.freeze({
    timeSec: clamped,
    beat,
    beatProgress: beat.endSec > beat.startSec
      ? Math.min(1, Math.max(0, (clamped - beat.startSec) / (beat.endSec - beat.startSec)))
      : 1,
  });
}

export function seekIntraHandoverTeachingTime(
  currentTimeSec: number,
  deltaSec: number,
): number {
  return clampIntraHandoverTeachingTime(currentTimeSec + (Number.isFinite(deltaSec) ? deltaSec : 0));
}

/** Presentation-only UE path; source identity and event fields stay separate. */
export function ueTeachingPositionForState(state: IntraHandoverTeachingDirectorState): {
  readonly x: number;
  readonly y: number;
} {
  const progress = state.timeSec / INTRA_HANDOVER_TEACHING_DURATION_SEC;
  const x = 260 + progress * 680;
  const y = 520 - Math.sin(progress * Math.PI) * 36;
  return Object.freeze({ x, y });
}
